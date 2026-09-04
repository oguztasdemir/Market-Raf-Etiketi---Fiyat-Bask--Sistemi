# -*- coding: utf-8 -*-
"""
Katalog Toplu Zam, Fiyat Değişenler, Kritik Stok & Kurulum Dışa Aktarma Rotaları
"""
import os, datetime
from flask import Blueprint, jsonify, request, send_file
from backend.ayarlar import PRODUCTS_FILE, SALES_DIR
from backend.araclar.depolama_araclari import load_json, save_json, list_all_sales_files
from backend.araclar.metin_duzenleyici import parse_price_val, clean_barcode
from backend.yedekleme.yedekleme_servisi import create_products_backup
from backend.katalog.excel_katalog_servisi import clear_diff_cache
from backend.katalog.katalog_rotalari import log_product_activity, get_indexed_products, invalidate_product_cache

batch_catalog_bp = Blueprint('batch_catalog_bp', __name__)


@batch_catalog_bp.route("/api/catalog/batch_price_update", methods=["POST"])
def api_batch_price_update():
    """
    Seçilen marka veya kategoriye göre toplu zam / fiyat güncellemesi uygular.
    Parametreler:
      - brand: Filtrelenecek marka (örn: 'BEYPAZARI', 'SÜTAŞ', 'TÜMÜ')
      - category_prefix: Başlık ön eki (örn: 'SODA', 'SÜT', 'TÜMÜ')
      - percent: Yüzde artış (örn: 15.0 -> +%15)
      - flat_amount: Sabit TL artış (örn: 5.0 -> +5 TL)
      - round_to: Yuvarlama (0.25, 0.50, 1.00 veya 0.0)
    """
    req_data = request.json or {}
    brand_filter = (req_data.get("brand") or "").strip().upper()
    cat_filter = (req_data.get("category_prefix") or "").strip().upper()
    percent = float(req_data.get("percent") or 0.0)
    flat_amount = float(req_data.get("flat_amount") or 0.0)
    round_to = float(req_data.get("round_to") or 0.0)
    actor = req_data.get("actor", "Yönetici")

    if percent == 0.0 and flat_amount == 0.0:
        return jsonify({"status": "error", "message": "Lütfen geçerli bir yüzde veya sabit artış tutarı girin."}), 400

    products = load_json(PRODUCTS_FILE, [])
    updated_products = []
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    today_date = datetime.datetime.now().strftime("%Y-%m-%d")

    # Yedek al
    create_products_backup("Toplu Zam Öncesi Otomatik Yedek")

    for p in products:
        p_brand = (p.get("brand") or "").upper()
        p_title = (p.get("title") or "").upper()

        match = True
        if brand_filter and brand_filter != "TÜMÜ" and p_brand != brand_filter:
            match = False
        if cat_filter and cat_filter != "TÜMÜ" and not p_title.startswith(cat_filter):
            match = False

        if match:
            old_price_str = p.get("price", "0,00 TL")
            old_val = parse_price_val(old_price_str)
            if old_val <= 0:
                continue

            # Yeni fiyat hesabı
            new_val = old_val
            if percent != 0.0:
                new_val += new_val * (percent / 100.0)
            if flat_amount != 0.0:
                new_val += flat_amount

            # Yuvarlama
            if round_to > 0:
                new_val = round(new_val / round_to) * round_to

            new_val = max(0.25, round(new_val, 2))
            new_price_str = f"{new_val:,.2f} TL".replace(",", "X").replace(".", ",").replace("X", ".")

            if old_price_str != new_price_str:
                p["price"] = new_price_str
                p["old_price"] = old_price_str
                p["price_updated_at"] = now_str
                p["price_updated_date"] = today_date
                updated_products.append({
                    "barcode": p.get("barcode"),
                    "title": p.get("title"),
                    "old_price": old_price_str,
                    "new_price": new_price_str
                })
                log_product_activity(
                    p.get("barcode"),
                    "price",
                    f"Toplu Fiyat Güncellemesi ({'+%' + str(percent) if percent else ''}{'+' + str(flat_amount) + 'TL' if flat_amount else ''})",
                    f"{old_price_str} ➔ {new_price_str}",
                    actor
                )

    if updated_products:
        save_json(PRODUCTS_FILE, products)
        invalidate_product_cache()
        clear_diff_cache()

    return jsonify({
        "status": "success",
        "message": f"{len(updated_products)} adet ürünün fiyatı başarıyla güncellendi.",
        "updated_count": len(updated_products),
        "updated_products": updated_products[:50]  # İlk 50 örnek
    })


@batch_catalog_bp.route("/api/catalog/price_changed_today", methods=["GET"])
def api_get_price_changed_today():
    """Bugün veya seçilen tarihte fiyatı değişen ürünleri etiket baskı kuyruğu olarak döner."""
    target_date = request.args.get("date") or datetime.datetime.now().strftime("%Y-%m-%d")
    products = load_json(PRODUCTS_FILE, [])
    
    queue = []
    for p in products:
        if p.get("price_updated_date") == target_date or p.get("price_updated_at", "").startswith(target_date):
            queue.append({
                "barcode": p.get("barcode"),
                "title": p.get("title") or p.get("title1"),
                "brand": p.get("brand"),
                "price": p.get("price"),
                "old_price": p.get("old_price"),
                "price_updated_at": p.get("price_updated_at")
            })

    return jsonify({
        "status": "success",
        "date": target_date,
        "count": len(queue),
        "products": queue
    })


@batch_catalog_bp.route("/api/catalog/low_stock_alerts", methods=["GET"])
def api_get_low_stock_alerts():
    """Belirlenen kritik stok limitinin altındaki ürünleri listeler."""
    try:
        threshold = int(request.args.get("threshold", 5))
    except Exception:
        threshold = 5

    products = load_json(PRODUCTS_FILE, [])
    low_stock = []

    for p in products:
        try:
            stock = int(p.get("stock") or 0)
        except Exception:
            stock = 0

        # Sadece stok takibi yapılan ve stoğu threshold altında olanlar
        if 0 <= stock <= threshold and p.get("stock") is not None:
            low_stock.append({
                "barcode": p.get("barcode"),
                "title": p.get("title") or p.get("title1"),
                "brand": p.get("brand"),
                "price": p.get("price"),
                "stock": stock,
                "unit": p.get("unit", "Adet")
            })

    return jsonify({
        "status": "success",
        "threshold": threshold,
        "count": len(low_stock),
        "products": low_stock
    })

@batch_catalog_bp.route("/api/catalog/expiring_products", methods=["GET"])
def api_get_expiring_products():
    """Son kullanma tarihi yaklaşan (3, 7, 15 gün) ürünleri listeler."""
    try:
        days_ahead = int(request.args.get("days", 7))
    except Exception:
        days_ahead = 7

    products, _ = get_indexed_products()
    expiring = []
    now = datetime.date.today()
    target_limit = now + datetime.timedelta(days=days_ahead)

    for p in products:
        exp_date_str = str(p.get("expiration_date") or p.get("skt") or "").strip()
        if not exp_date_str:
            continue
        try:
            # Desteklenen formatlar: YYYY-MM-DD, DD.MM.YYYY, DD/MM/YYYY
            if "-" in exp_date_str and len(exp_date_str.split("-")[0]) == 4:
                exp_d = datetime.datetime.strptime(exp_date_str, "%Y-%m-%d").date()
            elif "." in exp_date_str:
                exp_d = datetime.datetime.strptime(exp_date_str, "%d.%m.%Y").date()
            elif "/" in exp_date_str:
                exp_d = datetime.datetime.strptime(exp_date_str, "%d/%m/%Y").date()
            else:
                continue

            days_remaining = (exp_d - now).days
            if days_remaining <= days_ahead:
                expiring.append({
                    "barcode": p.get("barcode"),
                    "title": p.get("title") or p.get("title1"),
                    "brand": p.get("brand"),
                    "price": p.get("price"),
                    "stock": p.get("stock", 0),
                    "expiration_date": exp_d.strftime("%d.%m.%Y"),
                    "days_remaining": days_remaining,
                    "is_expired": days_remaining < 0,
                    "status_badge": "🔴 Günü Geçti!" if days_remaining < 0 else (f"⚠️ Son {days_remaining} Gün" if days_remaining <= 3 else f"📅 {days_remaining} Gün Kaldı")
                })
        except Exception:
            continue

    expiring.sort(key=lambda x: x["days_remaining"])
    return jsonify({
        "status": "success",
        "days_filter": days_ahead,
        "count": len(expiring),
        "products": expiring
    })

@batch_catalog_bp.route("/api/catalog/supplier_order_sheet", methods=["GET"])
def api_generate_supplier_order_sheet():
    """Toptancı ve firmalara göre kritik stok ve sipariş listesi üretir."""
    supplier_filter = request.args.get("supplier", "").strip().upper()
    try:
        threshold = int(request.args.get("threshold", 5))
    except Exception:
        threshold = 5

    products, _ = get_indexed_products()
    supplier_groups = {}

    for p in products:
        try:
            stock = int(p.get("stock") or 0)
        except Exception:
            stock = 0

        if stock <= threshold:
            supplier = (p.get("company") or p.get("supplier") or p.get("brand") or "GENEL TOPTANCI").strip().upper()
            if supplier_filter and supplier_filter != "TÜMÜ" and supplier != supplier_filter:
                continue

            if supplier not in supplier_groups:
                supplier_groups[supplier] = {
                    "supplier_name": supplier,
                    "item_count": 0,
                    "items": []
                }
            
            suggested_order = max(10, (threshold * 3) - stock)
            supplier_groups[supplier]["items"].append({
                "barcode": p.get("barcode"),
                "title": p.get("title") or p.get("title1"),
                "current_stock": stock,
                "suggested_order": suggested_order,
                "unit": p.get("unit", "Adet"),
                "last_cost": p.get("last_cost") or p.get("buying_price", "0,00"),
                "sale_price": p.get("price", "0,00")
            })
            supplier_groups[supplier]["item_count"] += 1

    return jsonify({
        "status": "success",
        "threshold": threshold,
        "total_suppliers": len(supplier_groups),
        "suppliers": list(supplier_groups.values())
    })


@batch_catalog_bp.route("/api/setup/export_prices", methods=["GET"])
@batch_catalog_bp.route("/api/katalog/export_excel", methods=["GET"])
def api_setup_export_prices():
    """Mevcut veritabanındaki tüm Market ve Manav ürünlerini Excel formatında indirmeyi sağlar."""
    from backend.araclar.setup_servisi import export_prices_to_excel
    from flask import send_file
    try:
        excel_io = export_prices_to_excel()
        return send_file(
            excel_io,
            as_attachment=True,
            download_name="OYMAPOS_Urun_ve_Fiyat_Katalogu.xlsx",
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except Exception as e:
        return jsonify({"status": "error", "message": f"Excel dışa aktarma hatası: {str(e)}"}), 500


@batch_catalog_bp.route("/api/setup/execute", methods=["POST"])
def api_setup_execute():
    """Kurulum formunu ve opsiyonel Excel fiyat dosyasını işleyip kurulumu tamamlar."""
    from backend.araclar.setup_servisi import execute_setup
    
    market_name = request.form.get("market_name", "").strip()
    branch_name = request.form.get("branch_name", "Merkez Şube").strip()
    phone = request.form.get("phone", "").strip()
    address = request.form.get("address", "").strip()
    tax_office = request.form.get("tax_office", "").strip()
    tax_no = request.form.get("tax_no", "").strip()
    paper_width = request.form.get("receipt_paper_width", "80mm").strip()
    cash_advance = request.form.get("daily_cash_advance", "500.0").strip()
    footer_note = request.form.get("receipt_footer_note", "Bizi tercih ettiğiniz için teşekkür ederiz. İyi günler dileriz!").strip()
    scale_model = request.form.get("scale_model", "DIGI_SM100").strip()
    scale_ip = request.form.get("scale_ip", "192.168.1.61").strip()
    include_seed = request.form.get("include_seed_catalog", "true").lower() in ("true", "1", "on", "yes")
    
    if not market_name:
        return jsonify({"status": "error", "message": "Lütfen market / ticari ünvan adını giriniz."}), 400
        
    market_info = {
        "market_name": market_name,
        "branch_name": branch_name,
        "phone": phone,
        "address": address,
        "tax_office": tax_office,
        "tax_no": tax_no,
        "receipt_paper_width": paper_width,
        "daily_cash_advance": cash_advance,
        "receipt_footer_note": footer_note,
        "scale_model": scale_model,
        "scale_ip": scale_ip,
        "include_seed_catalog": include_seed
    }

    
    excel_file = request.files.get("price_excel")
    excel_bytes = None
    if excel_file and excel_file.filename:
        try:
            excel_bytes = excel_file.read()
        except Exception as e:
            return jsonify({"status": "error", "message": f"Dosya okuma hatası: {str(e)}"}), 400
            
    success, msg = execute_setup(market_info, excel_bytes)
    if success:
        return jsonify({"status": "success", "message": msg})
    else:
        return jsonify({"status": "error", "message": msg}), 500


@batch_catalog_bp.route("/api/setup/restore_backup", methods=["POST"])
def api_setup_restore_backup():
    """ZIP formatındaki OYMAPOS yedeğini yükleyerek sistemi geri yükler ve kurulumu tamamlar."""
    from backend.araclar.setup_servisi import restore_from_backup_zip
    
    backup_file = request.files.get("backup_zip")
    if not backup_file or not backup_file.filename:
        return jsonify({"status": "error", "message": "Lütfen geçerli bir .zip yedek dosyası seçiniz."}), 400
        
    try:
        zip_bytes = backup_file.read()
    except Exception as e:
        return jsonify({"status": "error", "message": f"Dosya okuma hatası: {str(e)}"}), 400
        
    success, msg = restore_from_backup_zip(zip_bytes)
    if success:
        return jsonify({"status": "success", "message": msg})
    else:
        return jsonify({"status": "error", "message": msg}), 500









