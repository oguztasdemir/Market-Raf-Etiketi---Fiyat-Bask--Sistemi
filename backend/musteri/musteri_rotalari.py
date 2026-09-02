# -*- coding: utf-8 -*-
"""
Müşteri Veresiye, Cari Hesap, Borç/Alacak ve Fatura Takip Rotaları
"""
import os
import datetime
from flask import Blueprint, jsonify, request
from backend.ayarlar import CUSTOMERS_FILE
from backend.araclar.depolama_araclari import load_json, save_json, _STORAGE_LOCK
from backend.yazdirma.zpl_etiket_kodlayici import clean_tr

customer_bp = Blueprint('customer_bp', __name__)

@customer_bp.route("/api/customers", methods=["GET"])
def api_get_customers():
    """Tüm müşterileri ve güncel bakiye durumlarını döner."""
    customers = load_json(CUSTOMERS_FILE, [])
    # Toplam alacak ve borçlu müşteri sayısı hesapla
    total_credit = sum(float(c.get("balance") or 0.0) for c in customers if float(c.get("balance") or 0.0) > 0)
    return jsonify({
        "status": "success",
        "count": len(customers),
        "total_credit": round(total_credit, 2),
        "customers": customers
    })

@customer_bp.route("/api/customers/<cust_id>", methods=["GET"])
def api_get_customer_detail(cust_id):
    """Tekil müşterinin hesap kartını, işlem geçmişini ve satın aldığı ürün dökümünü döner."""
    customers = load_json(CUSTOMERS_FILE, [])
    target = None
    for c in customers:
        if c.get("id") == cust_id:
            target = c
            break

    if not target:
        return jsonify({"status": "error", "message": "Müşteri bulunamadı."}), 404

    txs = target.get("transactions", [])
    total_debt = sum(float(t.get("amount", 0.0)) for t in txs if t.get("type") == "debt")
    total_paid = sum(float(t.get("amount", 0.0)) for t in txs if t.get("type") == "payment")
    balance = float(target.get("balance") or 0.0)

    return jsonify({
        "status": "success",
        "customer": target,
        "summary": {
            "total_debt": round(total_debt, 2),
            "total_paid": round(total_paid, 2),
            "balance": round(balance, 2),
            "credit_limit": float(target.get("credit_limit") or 0.0),
            "transaction_count": len(txs)
        }
    })

def format_phone_number_tr(phone_str: str) -> str:
    """Telefon numarasını standart okunabilir formata (+90 553 140 1638) dönüştürür."""
    if not phone_str:
        return ""
    digits = "".join(filter(str.isdigit, phone_str))
    if not digits:
        return phone_str.strip()

    # Uluslararası başka ülke kodu varsa
    if phone_str.strip().startswith("+") and not digits.startswith("90"):
        if len(digits) <= 4:
            return f"+{digits}"
        elif len(digits) <= 7:
            return f"+{digits[:2]} {digits[2:5]} {digits[5:]}"
        else:
            return f"+{digits[:2]} {digits[2:5]} {digits[5:8]} {digits[8:]}".strip()

    # Türkiye (+90) Formatı
    if digits.startswith("90"):
        digits = digits[2:]
    elif digits.startswith("0"):
        digits = digits[1:]

    digits = digits[:10]  # Maksimum 10 hane ulusal numara

    if len(digits) <= 3:
        return f"+90 {digits}" if digits else "+90"
    elif len(digits) <= 6:
        return f"+90 {digits[:3]} {digits[3:]}"
    elif len(digits) <= 10:
        return f"+90 {digits[:3]} {digits[3:6]} {digits[6:]}"

    return f"+90 {digits[:3]} {digits[3:6]} {digits[6:10]}"

@customer_bp.route("/api/customers", methods=["POST"])
@customer_bp.route("/api/customers/quick_add", methods=["POST"])
def api_create_or_update_customer():
    """Yeni müşteri ekler veya mevcut müşteriyi günceller."""
    req_data = request.json or {}
    cust_id = str(req_data.get("id") or f"cust_{int(datetime.datetime.now().timestamp() * 1000)}")
    name = (req_data.get("name") or req_data.get("ad_soyad") or "").strip().upper()
    phone = format_phone_number_tr((req_data.get("phone") or req_data.get("telefon") or "").strip())
    notes = (req_data.get("notes") or req_data.get("not") or "").strip()
    credit_limit = float(req_data.get("credit_limit") or 0.0)

    if not name:
        return jsonify({"status": "error", "message": "Müşteri Adı Soyadı zorunludur."}), 400

    with _STORAGE_LOCK:
        customers = load_json(CUSTOMERS_FILE, [])
        found = False
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        for c in customers:
            if c.get("id") == cust_id:
                c["name"] = name
                c["phone"] = phone
                c["notes"] = notes
                c["credit_limit"] = credit_limit
                c["updated_at"] = now_str
                found = True
                break

        if not found:
            new_customer = {
                "id": cust_id,
                "name": name,
                "phone": phone,
                "balance": 0.0,  # Pozitif: Borçlu, Negatif: Alacaklı
                "credit_limit": credit_limit,
                "notes": notes,
                "created_at": now_str,
                "updated_at": now_str,
                "transactions": []
            }
            customers.append(new_customer)

        save_json(CUSTOMERS_FILE, customers)
    return jsonify({
        "status": "success",
        "message": "Müşteri başarıyla kaydedildi.",
        "customer": c if found else new_customer,
        "customer_id": cust_id
    })

@customer_bp.route("/api/customers/<cust_id>/transaction", methods=["POST"])
def api_add_customer_transaction(cust_id):
    """
    Müşteriye veresiye borç ekler veya tahsilat/ödeme kaydeder.
    Tür: 'debt' (Veresiye Satış Borcu) veya 'payment' (Tahsilat / Ödeme)
    """
    req_data = request.json or {}
    tx_type = req_data.get("type", "debt")  # 'debt' veya 'payment'
    amount = float(req_data.get("amount") or 0.0)
    payment_method = req_data.get("payment_method", "Nakit")
    description = req_data.get("description") or ("Veresiye Satış" if tx_type == "debt" else f"{payment_method} Tahsilat")
    receipt_no = req_data.get("receipt_no", "")
    actor = req_data.get("actor", "Kasiyer")
    items = req_data.get("items", [])

    if amount <= 0:
        return jsonify({"status": "error", "message": "Geçerli bir tutar girin."}), 400

    with _STORAGE_LOCK:
        customers = load_json(CUSTOMERS_FILE, [])
        target_cust = None
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        for c in customers:
            if c.get("id") == cust_id:
                target_cust = c
                break

        if not target_cust:
            return jsonify({"status": "error", "message": "Müşteri bulunamadı."}), 404

        if "transactions" not in target_cust:
            target_cust["transactions"] = []

        old_balance = float(target_cust.get("balance") or 0.0)
        if tx_type == "debt":
            new_balance = round(old_balance + amount, 2)
        else:
            new_balance = round(old_balance - amount, 2)

        tx_entry = {
            "id": f"tx_{int(datetime.datetime.now().timestamp() * 1000)}",
            "timestamp": now_str,
            "type": tx_type,
            "amount": round(amount, 2),
            "old_balance": round(old_balance, 2),
            "new_balance": round(new_balance, 2),
            "payment_method": payment_method,
            "description": description,
            "receipt_no": receipt_no,
            "actor": actor,
            "items": items
        }

        target_cust["transactions"].insert(0, tx_entry)
        target_cust["balance"] = new_balance
        target_cust["updated_at"] = now_str

        save_json(CUSTOMERS_FILE, customers)
        return jsonify({
            "status": "success",
            "message": f"İşlem kaydedildi. Güncel Bakiye: {new_balance:,.2f} TL",
            "old_balance": old_balance,
            "paid_amount": amount,
            "new_balance": new_balance,
            "transaction": tx_entry
        })

@customer_bp.route("/api/customers/<cust_id>", methods=["DELETE"])
def api_delete_customer(cust_id):
    """Müşteriyi ve cari kartını siler."""
    with _STORAGE_LOCK:
        customers = load_json(CUSTOMERS_FILE, [])
        filtered = [c for c in customers if c.get("id") != cust_id]
        save_json(CUSTOMERS_FILE, filtered)
    return jsonify({"status": "success", "message": "Müşteri kaydı silindi."})

@customer_bp.route("/api/customers/<cust_id>/whatsapp_url", methods=["GET"])
def api_get_customer_whatsapp_url(cust_id):
    """Müşteri için hazır WhatsApp bakiye hatırlatma linki ve metni üretir."""
    import urllib.parse
    from backend.araclar.excel_dosya_izleyici import get_local_ip
    from backend.ayarlar import SETTINGS_FILE

    customers = load_json(CUSTOMERS_FILE, [])
    cust = next((c for c in customers if c.get("id") == cust_id), None)
    if not cust:
        return jsonify({"status": "error", "message": "Müşteri bulunamadı."}), 404

    settings = load_json(SETTINGS_FILE, {})
    market_name = settings.get("market_name", "YARENLER MARKET")
    phone = cust.get("phone", "").strip()
    clean_digits = "".join(filter(str.isdigit, phone))
    
    if clean_digits.startswith("0"):
        clean_digits = "90" + clean_digits[1:]
    elif clean_digits.startswith("5") and len(clean_digits) == 10:
        clean_digits = "90" + clean_digits

    balance = float(cust.get("balance") or 0.0)
    now_str = datetime.datetime.now().strftime("%d.%m.%Y")
    
    local_ip = get_local_ip()
    port = request.host.split(':')[-1] if ':' in request.host else '5000'

    last_receipt = ""
    for t in cust.get("transactions", []):
        if t.get("receipt_no"):
            last_receipt = t.get("receipt_no")
            break

    receipt_link = f"http://{local_ip}:{port}/fis/{last_receipt}" if last_receipt else ""

    if balance > 0:
        msg_text = (
            f"Sayın {cust.get('name')},\n\n"
            f"🏪 *{market_name}* nezdindeki güncel veresiye/cari bakiyeniz: *{balance:,.2f} TL*'dir.\n"
            f"📅 Tarih: {now_str}\n"
        )
        if receipt_link:
            msg_text += f"🧾 Son Alışveriş Fişiniz: {receipt_link}\n\n"
        msg_text += "Hayırlı ve bereketli günler dileriz."
    elif balance < 0:
        msg_text = (
            f"Sayın {cust.get('name')},\n\n"
            f"🏪 *{market_name}* hesabınızda *{abs(balance):,.2f} TL* alacağınız bulunmaktadır.\n"
            f"📅 Tarih: {now_str}\n\n"
            f"İyi günler dileriz."
        )
    else:
        msg_text = (
            f"Sayın {cust.get('name')},\n\n"
            f"🏪 *{market_name}* hesabınızda borç/alacak bakiyeniz bulunmamaktadır (Bakiye: 0,00 TL).\n\n"
            f"Bizi tercih ettiğiniz için teşekkür ederiz."
        )

    encoded_msg = urllib.parse.quote(msg_text)
    wa_url = f"https://wa.me/{clean_digits}?text={encoded_msg}" if clean_digits else f"https://wa.me/?text={encoded_msg}"

    return jsonify({
        "status": "success",
        "phone": clean_digits,
        "customer_name": cust.get("name"),
        "balance": balance,
        "message_text": msg_text,
        "whatsapp_url": wa_url
    })

@customer_bp.route("/fis/<receipt_no>", methods=["GET"])
@customer_bp.route("/api/receipt/digital/<receipt_no>", methods=["GET"])
def api_view_digital_receipt(receipt_no):
    """Müşterinin WhatsApp'tan tıklayıp telefonunda açabileceği şık dijital bilgi fişi sayfası."""
    import glob
    from flask import render_template_string

    found_sale = None
    sales_files = glob.glob(os.path.join(DATA_DIR, "satis_ve_kasa", "satislar", "**", "*.json"), recursive=True)
    for sf in sales_files:
        data = load_json(sf, [])
        for s in data:
            if s.get("receipt_no") == receipt_no or s.get("id") == receipt_no:
                found_sale = s
                break
        if found_sale:
            break

    found_tx = None
    target_cust = None
    customers = load_json(CUSTOMERS_FILE, [])
    for c in customers:
        for t in c.get("transactions", []):
            if t.get("receipt_no") == receipt_no or t.get("id") == receipt_no:
                found_tx = t
                target_cust = c
                break
        if found_tx:
            break

    items = []
    total_amount = 0.0
    date_str = ""
    market_name = "YARENLER SÜPERMARKET"
    payment_type = "Veresiye / Cari"
    customer_name = target_cust.get("name") if target_cust else ""
    remaining_balance = target_cust.get("balance", 0.0) if target_cust else None

    if found_sale:
        items = found_sale.get("items", [])
        total_amount = float(found_sale.get("total_price") or found_sale.get("total") or 0.0)
        date_str = found_sale.get("timestamp") or found_sale.get("date") or ""
        payment_type = found_sale.get("payment_type", "Veresiye")
        if not customer_name:
            customer_name = found_sale.get("customer_name") or found_sale.get("customer", "")
    elif found_tx:
        items = found_tx.get("items", [])
        total_amount = float(found_tx.get("amount") or 0.0)
        date_str = found_tx.get("timestamp") or ""
        payment_type = found_tx.get("payment_method") or ("Veresiye Satış" if found_tx.get("type") == "debt" else "Tahsilat")
    else:
        date_str = datetime.datetime.now().strftime("%d.%m.%Y %H:%M")

    html_template = """
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Dijital Bilgi Fişi - {{ receipt_no }}</title>
      <style>
        body { background: #0f172a; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; padding: 20px; margin: 0; }
        .receipt-card { background: #ffffff; color: #000000; width: 100%; max-width: 360px; border-radius: 12px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); padding: 20px; font-family: 'Courier New', Courier, monospace; font-size: 13px; line-height: 1.4; box-sizing: border-box; }
        .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 12px; margin-bottom: 12px; }
        .title { font-size: 18px; font-weight: 900; font-family: sans-serif; letter-spacing: 0.5px; }
        .table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
        .table th { border-bottom: 1px solid #000; text-align: left; padding: 4px 0; }
        .table td { padding: 5px 0; }
        .totals { border-top: 1px dashed #000; border-bottom: 2px dashed #000; padding: 8px 0; margin-top: 8px; }
        .row { display: flex; justify-content: space-between; margin: 3px 0; }
        .grand-total { font-size: 16px; font-weight: 900; margin-top: 6px; }
        .footer { text-align: center; margin-top: 14px; font-size: 11px; color: #444; }
        .btn-print { display: block; width: 100%; max-width: 360px; margin: 12px auto 0; background: #0284c7; color: #fff; text-align: center; padding: 12px; border-radius: 8px; text-decoration: none; font-weight: 800; font-family: sans-serif; box-sizing: border-box; }
      </style>
    </head>
    <body>
      <div style="width: 100%; max-width: 360px;">
        <div class="receipt-card">
          <div class="header">
            <div class="title">{{ market_name }}</div>
            <div style="font-size: 11px; margin-top: 2px;">Merkez Şube</div>
            <div style="font-size: 11px; font-weight: bold; margin-top: 6px;">*** ELEKTRONİK BİLGİ FİŞİ ***</div>
            <div style="font-size: 11px; color: #555; margin-top: 4px;">Tarih: {{ date_str }}</div>
            <div style="font-size: 11px; color: #555;">Fiş No: {{ receipt_no }}</div>
            {% if customer_name %}
            <div style="font-size: 12px; font-weight: bold; color: #0284c7; margin-top: 4px;">Müşteri: {{ customer_name }}</div>
            {% endif %}
          </div>

          <table class="table">
            <thead>
              <tr>
                <th style="width: 50%;">Ürün Adı</th>
                <th style="width: 15%; text-align: center;">Adet</th>
                <th style="width: 35%; text-align: right;">Tutar</th>
              </tr>
            </thead>
            <tbody>
              {% for it in items %}
              <tr>
                <td>{{ it.title or it.name or 'Ürün' }}</td>
                <td style="text-align: center;">{{ it.quantity or it.qty or 1 }}</td>
                <td style="text-align: right;">{{ "{:,.2f}".format(it.total_price or it.price or 0.0) }} TL</td>
              </tr>
              {% else %}
              <tr>
                <td colspan="3" style="text-align: center; padding: 10px 0; color: #777;">Veresiye İşlem Dökümü</td>
              </tr>
              {% endfor %}
            </tbody>
          </table>

          <div class="totals">
            <div class="row grand-total">
              <span>İŞLEM TUTARI:</span>
              <span>{{ "{:,.2f}".format(total_amount) }} TL</span>
            </div>
            <div class="row" style="font-size: 11px; color: #444;">
              <span>Ödeme / İşlem Türü:</span>
              <span>{{ payment_type }}</span>
            </div>
            {% if remaining_balance is not none %}
            <div class="row" style="font-size: 13px; font-weight: bold; color: #b91c1c; margin-top: 6px; border-top: 1px dashed #aaa; padding-top: 4px;">
              <span>GÜNCEL KALAN BORÇ:</span>
              <span>{{ "{:,.2f}".format(remaining_balance) }} TL</span>
            </div>
            {% endif %}
          </div>

          <div class="footer">
            <p style="margin: 4px 0; font-weight: bold;">Bizi tercih ettiğiniz için teşekkür ederiz!</p>
            <p style="margin: 2px 0; font-size: 10px;">Mali değeri yoktur • Bilgi amaçlı düzenlenmiştir.</p>
          </div>
        </div>
        <a href="javascript:window.print()" class="btn-print">🖨️ Fişi Yazdır / PDF Olarak Kaydet</a>
      </div>
    </body>
    </html>
    """

    return render_template_string(
        html_template,
        receipt_no=receipt_no,
        market_name=market_name,
        date_str=date_str,
        customer_name=customer_name,
        items=items,
        total_amount=total_amount,
        payment_type=payment_type,
        remaining_balance=remaining_balance
    )


def generate_receipt_pdf(receipt_no):
    """Verilen fiş numarası için 80mm termal formatında PDF üretir ve dosya yolunu döner."""
    import glob
    from reportlab.lib.pagesizes import mm
    from reportlab.pdfgen import canvas
    
    os.makedirs(os.path.join(DATA_DIR, "fisler"), exist_ok=True)
    pdf_filename = f"{receipt_no}.pdf"
    pdf_path = os.path.join(DATA_DIR, "fisler", pdf_filename)
    
    # Fiş verisini bul
    found_sale = None
    sales_files = glob.glob(os.path.join(DATA_DIR, "satis_ve_kasa", "satislar", "**", "*.json"), recursive=True)
    for sf in sales_files:
        data = load_json(sf, [])
        for s in data:
            if s.get("receipt_no") == receipt_no or s.get("id") == receipt_no:
                found_sale = s
                break
        if found_sale:
            break

    found_tx = None
    target_cust = None
    customers = load_json(CUSTOMERS_FILE, [])
    for c in customers:
        for t in c.get("transactions", []):
            if t.get("receipt_no") == receipt_no or t.get("id") == receipt_no:
                found_tx = t
                target_cust = c
                break
        if found_tx:
            break

    items = []
    total_amount = 0.0
    date_str = datetime.datetime.now().strftime("%d.%m.%Y %H:%M")
    market_name = clean_tr("YARENLER SÜPERMARKET")
    customer_name = clean_tr(target_cust.get("name", "")) if target_cust else ""
    remaining_balance = target_cust.get("balance", 0.0) if target_cust else None

    if found_sale:
        items = found_sale.get("items", [])
        total_amount = float(found_sale.get("total_price") or found_sale.get("total") or 0.0)
        date_str = found_sale.get("timestamp") or found_sale.get("date") or date_str
        if not customer_name:
            customer_name = clean_tr(found_sale.get("customer_name") or found_sale.get("customer", ""))
    elif found_tx:
        items = found_tx.get("items", [])
        total_amount = float(found_tx.get("amount") or 0.0)
        date_str = found_tx.get("timestamp") or date_str

    item_count = len(items)
    page_height = max(130, 85 + (item_count * 8)) * mm
    
    c = canvas.Canvas(pdf_path, pagesize=(80*mm, page_height))
    y = page_height - 10*mm
    
    c.setFont('Helvetica-Bold', 12)
    c.drawCentredString(40*mm, y, market_name)
    y -= 5*mm
    c.setFont('Helvetica', 8)
    c.drawCentredString(40*mm, y, 'BILGI VE VERESIYE FISI')
    y -= 4*mm
    c.setLineWidth(0.5)
    c.line(5*mm, y, 75*mm, y)
    y -= 5*mm
    
    c.setFont('Helvetica', 8)
    if customer_name:
        c.drawString(6*mm, y, f"Musteri: {customer_name}")
        y -= 4.5*mm
    c.drawString(6*mm, y, f"Tarih: {date_str}")
    y -= 4.5*mm
    c.drawString(6*mm, y, f"Fis No: {receipt_no}")
    y -= 4*mm
    c.line(5*mm, y, 75*mm, y)
    y -= 5*mm
    
    c.setFont('Helvetica', 7.5)
    for it in items:
        qty = it.get('quantity', 1)
        title = clean_tr(str(it.get('title') or it.get('name') or 'Urun'))[:22]
        tot = float(it.get('total_price') or it.get('price') or 0.0)
        c.drawString(6*mm, y, f"{qty}x {title}")
        c.drawRightString(74*mm, y, f"{tot:.2f} TL")
        y -= 4.5*mm

    c.line(5*mm, y, 75*mm, y)
    y -= 5*mm
    
    c.setFont('Helvetica-Bold', 9)
    c.drawString(6*mm, y, "TOPLAM TUTAR:")
    c.drawRightString(74*mm, y, f"{total_amount:.2f} TL")
    y -= 5*mm
    
    if remaining_balance is not None:
        c.setFont('Helvetica-Bold', 8.5)
        c.drawString(6*mm, y, "GUNCEL BORC:")
        c.drawRightString(74*mm, y, f"{remaining_balance:.2f} TL")
        y -= 5*mm

    c.line(5*mm, y, 75*mm, y)
    y -= 5*mm
    c.setFont('Helvetica', 7)
    c.drawCentredString(40*mm, y, 'Bizi tercih ettiginiz icin tesekkur ederiz!')
    c.save()
    
    return pdf_path, pdf_filename


@customer_bp.route("/api/receipt/pdf/<receipt_no>", methods=["GET"])
def api_download_receipt_pdf(receipt_no):
    from flask import send_file
    try:
        pdf_path, pdf_filename = generate_receipt_pdf(receipt_no)
        if os.path.exists(pdf_path):
            return send_file(pdf_path, as_attachment=True, download_name=pdf_filename, mimetype='application/pdf')
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    return jsonify({"status": "error", "message": "Fiş bulunamadı"}), 404


@customer_bp.route("/api/whatsapp/send_automated", methods=["POST"])
def api_send_automated_whatsapp():
    """Bot olarak kullanıcı onayı / açılır pencere gerektirmeden arka planda otomatik mesaj ve PDF gönderimi."""
    data = request.get_json() or {}
    phone = data.get("phone", "")
    text = data.get("text", "")
    receipt_no = data.get("receipt_no", "")
    
    pdf_url = None
    if receipt_no:
        try:
            pdf_path, pdf_filename = generate_receipt_pdf(receipt_no)
            pdf_url = f"/api/receipt/pdf/{receipt_no}"
        except Exception as e:
            print("PDF üretim hatası:", e)

    os.makedirs(os.path.join(DATA_DIR, "sistem_ve_ayarlar"), exist_ok=True)
    queue_file = os.path.join(DATA_DIR, "sistem_ve_ayarlar", "whatsapp_bot_queue.json")
    queue = load_json(queue_file, [])
    queue.append({
        "id": f"wp_{int(datetime.datetime.now().timestamp()*1000)}",
        "phone": phone,
        "text": text,
        "receipt_no": receipt_no,
        "pdf_url": pdf_url,
        "status": "pending",
        "created_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    })
    save_json(queue_file, queue[-200:])

    # Autostart daemon if not running to process the message
    from backend.araclar.whatsapp_bot import wp_bot
    if wp_bot.check_setup_status() and not wp_bot.is_running:
        wp_bot.start_daemon()

    return jsonify({
        "status": "success",
        "message": "Mesaj otomatik gönderim kuyruğuna eklendi (Arka planda gönderilecek).",
        "is_bot_active": wp_bot.is_running,
        "pdf_url": pdf_url
    })


@customer_bp.route("/api/whatsapp/status", methods=["GET"])
def api_whatsapp_status():
    from backend.araclar.whatsapp_bot import wp_bot, QUEUE_FILE
    setup_ok = wp_bot.check_setup_status()
    queue = load_json(QUEUE_FILE, [])
    pending_count = len([x for x in queue if x.get("status") == "pending"])
    return jsonify({
        "status": "success",
        "is_setup": setup_ok,
        "is_running": wp_bot.is_running,
        "status_message": wp_bot.status_msg,
        "pending_messages": pending_count,
        "total_queue": len(queue)
    })


@customer_bp.route("/api/whatsapp/setup", methods=["POST"])
def api_whatsapp_setup():
    from backend.araclar.whatsapp_bot import wp_bot
    import threading
    # Run setup in a background thread so the request returns immediately
    thread = threading.Thread(target=wp_bot.run_setup, daemon=True)
    thread.start()
    return jsonify({
        "status": "success",
        "message": "QR kod ekranı sunucu masaüstünde açılıyor. Lütfen telefonunuzdan taratın."
    })


@customer_bp.route("/api/whatsapp/start", methods=["POST"])
def api_whatsapp_start():
    from backend.araclar.whatsapp_bot import wp_bot
    success, msg = wp_bot.start_daemon()
    return jsonify({
        "status": "success" if success else "error",
        "message": msg
    })


@customer_bp.route("/api/whatsapp/stop", methods=["POST"])
def api_whatsapp_stop():
    from backend.araclar.whatsapp_bot import wp_bot
    success, msg = wp_bot.stop_daemon()
    return jsonify({
        "status": "success" if success else "error",
        "message": msg
    })
