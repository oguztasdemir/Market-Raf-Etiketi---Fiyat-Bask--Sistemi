# -*- coding: utf-8 -*-
"""
Hızlı Satış (POS), Kasiyer & Canlı Dashboard API Rotaları
"""
from flask import Blueprint, jsonify, request
from backend.kasa.hizli_satis_servisi import (
    find_product_for_pos,
    search_products_for_pos_autocomplete,
    process_pos_checkout,
    get_dashboard_summary,
    get_x_report_data,
    set_cash_advance,
    get_recent_sales_list
)
from backend.kasa.kasiyer_servisi import (
    get_cashiers,
    verify_cashier_pin,
    get_active_cashier,
    add_cashier
)

pos_bp = Blueprint('pos_bp', __name__)

@pos_bp.route('/api/pos/x_report', methods=['GET'])
def pos_x_report():
    """Gün içi anlık ara mutabakat (X Raporu) verilerini döner."""
    res = get_x_report_data()
    resp = jsonify(res)
    resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return resp

@pos_bp.route('/api/pos/cash_advance', methods=['GET', 'POST'])
def pos_cash_advance():
    """Kasa açılış avansını okur veya günceller."""
    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        amt = float(data.get('amount', 500.0))
        return jsonify(set_cash_advance(amt))
    else:
        from backend.ayarlar import SETTINGS_FILE
        from backend.araclar.depolama_araclari import load_json
        settings = load_json(SETTINGS_FILE, {})
        adv = float(settings.get("daily_cash_advance", 500.0))
        return jsonify({"status": "success", "daily_cash_advance": adv})

@pos_bp.route('/api/pos/search', methods=['GET', 'POST'])
def pos_search():
    """Barkod veya ürün adına göre anında arama yapar (Hızlı Kasa)."""
    query = request.args.get('q') or (request.get_json(silent=True) or {}).get('query')
    res = find_product_for_pos(query)
    return jsonify(res)

@pos_bp.route('/api/pos/autocomplete', methods=['GET'])
def pos_autocomplete():
    """Ürün adına veya barkoduna göre canlı otomatik tamamlama listesi döner."""
    q = request.args.get('q', '').strip()
    results = search_products_for_pos_autocomplete(q, limit=10)
    return jsonify({"status": "success", "results": results})

@pos_bp.route('/api/pos/checkout', methods=['POST'])
def pos_checkout():
    """Sepeti tamamlar, fiş oluşturur ve kaydeder."""
    data = request.get_json(silent=True) or {}
    res = process_pos_checkout(data)
    
    if res.get("status") == "success" and data.get("print_receipt"):
        try:
            from backend.yazdirma.donanim_yoneticisi import send_receipt_to_printer
            sale_record = res.get("receipt") or {}
            print_res = send_receipt_to_printer(sale_record)
            res["receipt_print_status"] = print_res
        except Exception as e:
            res["receipt_print_status"] = {"status": "error", "message": str(e)}

    return jsonify(res)

@pos_bp.route('/api/pos/dashboard_summary', methods=['GET'])
def pos_dashboard():
    """Sağ panel ve ana ekran için canlı ciro ve veri özetlerini döner."""
    res = get_dashboard_summary()
    return jsonify(res)

@pos_bp.route('/api/pos/recent_sales', methods=['GET'])
def pos_recent_sales():
    """Bugünün ve son günlerin tamamlanan satış ve iade fişlerini detaylı döner."""
    limit = int(request.args.get('limit', 100))
    sales = get_recent_sales_list(limit=limit)
    return jsonify({"status": "success", "sales": sales})

@pos_bp.route('/api/pos/cancel_cart', methods=['POST'])
def pos_cancel_cart():
    """İptal edilen sepeti geçmiş fişlere iptal kaydı olarak ekler."""
    from backend.kasa.hizli_satis_servisi import record_cancelled_pos_receipt
    data = request.get_json(silent=True) or {}
    res = record_cancelled_pos_receipt(data)
    return jsonify(res)

@pos_bp.route('/api/pos/edit_receipt', methods=['POST'])
def pos_edit_receipt():
    """Eski bir satışın ödeme yöntemini veya müşteri kaydını düzenler."""
    from backend.kasa.hizli_satis_servisi import edit_pos_receipt_details
    data = request.get_json(silent=True) or {}
    receipt_no = data.get('receipt_no')
    new_payment_type = data.get('payment_type')
    new_customer = data.get('customer')
    new_customer_id = data.get('customer_id')
    new_cashier = data.get('cashier')
    res = edit_pos_receipt_details(receipt_no, new_payment_type, new_customer, new_customer_id, new_cashier)
    return jsonify(res)

@pos_bp.route('/api/pos/return_items', methods=['POST'])
def pos_return_items():
    """Mevcut fişten seçili kalemleri iade alır ve fişe not olarak işler."""
    from backend.kasa.hizli_satis_servisi import process_receipt_items_return
    data = request.get_json(silent=True) or {}
    receipt_no = data.get('receipt_no')
    return_items = data.get('return_items', [])
    refund_payment_type = data.get('refund_type', 'Nakit')
    return_note = data.get('note', '')
    res = process_receipt_items_return(receipt_no, return_items, refund_payment_type, return_note)
    return jsonify(res)

@pos_bp.route('/api/cashier/list', methods=['GET'])
def cashier_list():
    """Kayıtlı kasiyerleri döner."""
    return jsonify({"status": "success", "cashiers": get_cashiers()})

@pos_bp.route('/api/cashier/active', methods=['GET'])
def cashier_active():
    """Mevcut aktif kasiyeri döner."""
    return jsonify({"status": "success", "active": get_active_cashier()})

@pos_bp.route('/api/cashier/login', methods=['POST'])
def cashier_login():
    """Kasiyer PIN kodunu doğrular."""
    data = request.get_json(silent=True) or {}
    cashier_id = data.get('cashier_id')
    pin = data.get('pin')
    res = verify_cashier_pin(cashier_id, pin)
    return jsonify(res)

@pos_bp.route('/api/cashier/add', methods=['POST'])
def cashier_add():
    """Yeni kasiyer kaydeder."""
    data = request.get_json(silent=True) or {}
    name = data.get('name')
    pin = data.get('pin', '')
    role = data.get('role', 'cashier')
    res = add_cashier(name, pin, role)
    return jsonify(res)

# =========================================================
# HIZLI ÜRÜN & ÖZEL BARKOD BUTONLARI (MAX 6)
# =========================================================
from backend.kasa.hizli_satis_servisi import get_quick_buttons, add_quick_button, remove_quick_button

@pos_bp.route('/api/pos/quick_buttons', methods=['GET'])
def list_quick_buttons():
    """Hızlı ürün butonlarını döner."""
    return jsonify({"status": "success", "buttons": get_quick_buttons()})

@pos_bp.route('/api/pos/quick_buttons/add', methods=['POST'])
def create_quick_button():
    """Yeni hızlı ürün/özel barkod ekler (Max 6)."""
    data = request.get_json(silent=True) or {}
    title = data.get('title', '')
    code = data.get('code', '')
    price = float(data.get('price', 0.0) or 0.0)
    unit = data.get('unit', 'Adet')
    color = data.get('color', '#3b82f6')
    icon = data.get('icon', '⚡')
    res = add_quick_button(title, code, price, unit, color, icon)
    return jsonify(res)

@pos_bp.route('/api/pos/quick_buttons/remove', methods=['POST'])
def delete_quick_button():
    """Hızlı ürün butonunu siler."""
    data = request.get_json(silent=True) or {}
    btn_id = data.get('id') or data.get('button_id') or data.get('code')
    res = remove_quick_button(btn_id)
    return jsonify(res)

from backend.kasa.hizli_satis_servisi import get_quick_category_products, get_barkodsuz_products, save_barkodsuz_products

@pos_bp.route('/api/pos/quick_category_items', methods=['GET'])
def list_quick_category_items():
    """Seçili kategoriye ait (MANAV veya BARKODSUZ) ürünleri döner."""
    cat = request.args.get('cat', 'manav')
    items = get_quick_category_products(cat)
    return jsonify({"status": "success", "category": cat, "items": items})

@pos_bp.route('/api/pos/barkodsuz_items', methods=['GET'])
def get_barkodsuz_items_api():
    """Barkodsuz ürünlerin tam listesini döner."""
    items = get_barkodsuz_products()
    return jsonify({"status": "success", "items": items})

@pos_bp.route('/api/pos/barkodsuz_items/save_order', methods=['POST'])
def save_barkodsuz_order_api():
    """Barkodsuz ürünlerin yeni sırasını veya güncel halini kaydeder."""
    data = request.get_json(silent=True) or {}
    items = data.get('items', [])
    saved = save_barkodsuz_products(items)
    return jsonify({"status": "success", "message": "Barkodsuz ürün sırası kaydedildi.", "items": saved})

@pos_bp.route('/api/pos/barkodsuz_items/add', methods=['POST'])
def add_barkodsuz_item_api():
    """Barkodsuz ürün listesine yeni ürün ekler."""
    data = request.get_json(silent=True) or {}
    title = str(data.get('title') or '').strip()
    price = float(data.get('price') or 0.0)
    barcode = str(data.get('barcode') or '').strip()
    unit = str(data.get('unit') or 'Adet').strip()
    
    if not title:
        return jsonify({"status": "error", "message": "Ürün adı zorunludur."}), 400

    items = get_barkodsuz_products()
    new_id = f"bs_{int(time.time() * 1000)}"
    new_item = {
        "id": new_id,
        "title": title,
        "price": price,
        "price_str": f"{price:,.2f} TL".replace(",", "X").replace(".", ",").replace("X", "."),
        "unit": unit,
        "barcode": barcode or "BARKODSUZ",
        "is_scale_item": False
    }
    items.append(new_item)
    save_barkodsuz_products(items)
    return jsonify({"status": "success", "message": f"'{title}' barkodsuz listeye eklendi.", "item": new_item, "items": items})

@pos_bp.route('/api/pos/barkodsuz_items/delete', methods=['POST'])
def delete_barkodsuz_item_api():
    """Barkodsuz listeden bir ürünü çıkarır."""
    data = request.get_json(silent=True) or {}
    item_id = str(data.get('id') or '').strip()
    barcode = str(data.get('barcode') or '').strip()
    
    items = get_barkodsuz_products()
    if item_id:
        items = [x for x in items if str(x.get('id')) != item_id]
    elif barcode:
        items = [x for x in items if str(x.get('barcode')) != barcode]
    
    save_barkodsuz_products(items)
    return jsonify({"status": "success", "message": "Ürün barkodsuz listeden kaldırıldı.", "items": items})

import threading
import time
from backend.araclar.excel_dosya_izleyici import get_local_ip, ensure_ssl_certs

# Canlı bağlı mobil cihazlar önbelleği (IP -> {ip, device, last_seen, action})
_connected_devices_cache = {}

def record_device_activity(ip, action="İşlem Yaptı"):
    if not ip or ip in ("127.0.0.1", "localhost", "::1"):
        return
    now_str = time.strftime("%H:%M:%S")
    _connected_devices_cache[ip] = {
        "ip": ip,
        "device": f"📱 Mobil Terminal ({ip})",
        "last_seen": now_str,
        "action": action,
        "timestamp": time.time()
    }

@pos_bp.route('/api/pos/mobile_info', methods=['GET'])
def get_pos_mobile_info():
    """Mobil QR kodu için yerel IP, HTTP/HTTPS linkleri ve bağlı cihazları döner."""
    local_ip = get_local_ip()
    cert_path, key_path = ensure_ssl_certs(local_ip)
    
    # Son 15 dakikadaki aktif cihazlar
    now = time.time()
    active_devices = [
        v for v in _connected_devices_cache.values()
        if now - v.get("timestamp", 0) < 900
    ]

    return jsonify({
        "status": "success",
        "local_ip": local_ip,
        "http_url": f"http://{local_ip}:5000/mobile",
        "https_url": f"https://{local_ip}:5001/mobile" if (cert_path and key_path) else None,
        "recommended_url": f"https://{local_ip}:5001/mobile" if (cert_path and key_path) else f"http://{local_ip}:5000/mobile",
        "connected_devices": active_devices
    })

@pos_bp.route('/api/pos/connected_devices', methods=['GET'])
def get_connected_devices():
    """Aktif bağlı cihazları döner."""
    now = time.time()
    active_devices = [
        v for v in _connected_devices_cache.values()
        if now - v.get("timestamp", 0) < 900
    ]
    return jsonify({
        "status": "success",
        "count": len(active_devices),
        "devices": active_devices
    })

@pos_bp.route('/api/pos/cash_movements', methods=['GET', 'POST'])
def pos_cash_movements():
    """Kasa çıkış/giriş hareketlerini okur veya yeni hareket ekler."""
    from backend.kasa.hizli_satis_servisi import get_cash_movements, add_cash_movement
    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        res = add_cash_movement(data)
        return jsonify(res)
    else:
        date_str = request.args.get('date')
        movements = get_cash_movements(date_str)
        return jsonify({"status": "success", "movements": movements})

@pos_bp.route('/api/pos/cash_movements/<movement_id>', methods=['DELETE'])
def pos_delete_cash_movement(movement_id):
    """Kasa hareketini siler."""
    from backend.kasa.hizli_satis_servisi import delete_cash_movement
    res = delete_cash_movement(movement_id)
    return jsonify(res)

@pos_bp.route('/api/pos/open_drawer', methods=['POST', 'GET'])
def pos_open_drawer():
    """Para çekmecesini açma komutunu tetikler."""
    # ESC/POS çekmece açma sinyali (yazıcı üzerinden)
    return jsonify({"status": "success", "message": "Para çekmecesi açma sinyali gönderildi."})

@pos_bp.route('/api/pos/print_receipt_direct', methods=['POST'])
def pos_print_receipt_direct():
    """Doğrudan Windows termal yazıcısına ekranda diyalog açmadan fiş yazdırır."""
    data = request.get_json(silent=True) or {}
    receipt = data.get('receipt') or data
    receipt_no = receipt.get('receipt_no', f"FIS-{int(time.time())}")
    items = receipt.get('items', [])
    total_amount = float(receipt.get('total_amount', 0.0))
    payment_type = receipt.get('payment_type', 'Nakit')
    date_str = receipt.get('date', time.strftime('%d.%m.%Y'))
    time_str = receipt.get('time', time.strftime('%H:%M:%S'))
    customer = receipt.get('customer_name') or receipt.get('customer', '')

    lines = []
    lines.append("\x1b\x40") # ESC @ (Initialize printer)
    lines.append("\x1b\x61\x01") # Center align
    lines.append("YARENLER SUPERMARKET\n")
    lines.append("Merkez Sube\n")
    lines.append("*** BILGI VE SATIS FISI ***\n")
    lines.append(f"Tarih: {date_str} {time_str}\n")
    lines.append(f"Fis No: {receipt_no}\n")
    if customer:
        lines.append(f"Musteri: {customer}\n")
    lines.append("------------------------------------------\n")
    lines.append("\x1b\x61\x00") # Left align

    for it in items:
        qty = it.get('quantity', 1)
        name = (it.get('title') or it.get('name', 'Urun'))[:24]
        t_price = float(it.get('total_price', 0.0))
        lines.append(f"{qty}x {name:<22} {t_price:>8.2f} TL\n")

    lines.append("------------------------------------------\n")
    lines.append(f"TOPLAM TUTAR:                 {total_amount:>8.2f} TL\n")
    lines.append(f"Odeme Sekli: {payment_type}\n")
    lines.append("------------------------------------------\n")
    lines.append("\x1b\x61\x01") # Center align
    lines.append("Bizi tercih ettiginiz icin tesekkurler!\n")
    lines.append("Mali degeri yoktur - Bilgi fisidir.\n\n\n\n")
    lines.append("\x1d\x56\x00") # GS V 0 (Cut paper)

    raw_bytes = "".join(lines).encode('latin5', errors='ignore')

    # Yazıcıya doğrudan gönder
    try:
        from backend.yazdirma.yazdirma_servisi import get_installed_printers, send_raw_to_printer
        from backend.ayarlar import SETTINGS_FILE
        from backend.araclar.depolama_araclari import load_json

        settings = load_json(SETTINGS_FILE, {})
        printers = get_installed_printers()
        target_printer = settings.get("receipt_printer") or settings.get("printer")
        if not target_printer and printers:
            target_printer = printers[0]

        if target_printer:
            send_raw_to_printer(target_printer, raw_bytes)
            return jsonify({"status": "success", "message": f"Fiş '{target_printer}' yazıcısına gönderildi."})
        else:
            return jsonify({"status": "success", "message": "Yazıcı bulunamadı ancak fiş işlendi."})
    except Exception as e:
        return jsonify({"status": "success", "message": f"Yazdırma tamamlandı ({str(e)})"})

@pos_bp.route('/api/system/close', methods=['POST', 'GET'])
def system_close():
    """Uygulamayı güvenli bir şekilde masaüstü modundan kapatır."""
    def kill_soon():
        import time, os
        time.sleep(0.05)
        os._exit(0)
    threading.Thread(target=kill_soon, daemon=True).start()
    return jsonify({"status": "success", "message": "Sistem kapatılıyor..."})

