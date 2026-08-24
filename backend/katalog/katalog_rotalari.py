# -*- coding: utf-8 -*-
"""
Ürün Kataloğu, Ürün Arama, CRUD ve Kara Liste API Rotaları
"""
import os
import datetime
from flask import Blueprint, jsonify, request, send_file
from werkzeug.utils import secure_filename
from backend.ayarlar import PRODUCTS_FILE, CUSTOM_BARCODES_FILE, SISTEM_EXCELI_DIR, PRODUCT_ACTIVITIES_FILE, SALES_DIR
from backend.araclar.depolama_araclari import load_json, save_json, list_all_sales_files
from backend.araclar.metin_duzenleyici import clean_barcode, clean_product_title, format_price_display, get_online_or_system_datetime
from backend.yedekleme.yedekleme_servisi import create_products_backup
from backend.katalog.excel_katalog_servisi import analyze_excel_diff, get_latest_excel_path, clear_diff_cache
from backend.raporlama.raporlama_servisi import log_price_change, log_printed_batch

catalog_bp = Blueprint('catalog_bp', __name__)

@catalog_bp.route("/api/products", methods=["GET"])
def api_get_products():
    """Tüm ürün kataloğunu döner."""
    products = load_json(PRODUCTS_FILE, [])
    return jsonify({"status": "success", "products": products})

@catalog_bp.route("/api/products/search", methods=["GET"])
def api_search_products():
    """Ürün arama (barkod veya isim)."""
    q = request.args.get("q", "").strip().lower()
    if not q:
        return jsonify({"status": "success", "products": []})

    products = load_json(PRODUCTS_FILE, [])
    results = []
    for p in products:
        barcode = str(p.get("barcode", "")).lower()
        title = str(p.get("title", "") or p.get("title1", "")).lower()
        if q in barcode or q in title:
            results.append(p)
            if len(results) >= 50:
                break

    return jsonify({"status": "success", "products": results})

@catalog_bp.route("/api/products/<path:barcode>", methods=["GET"])
def api_get_product(barcode):
    """Barkod ile tekil ürün detayını döner."""
    clean_bc = clean_barcode(barcode)
    if not clean_bc:
        return jsonify({"status": "error", "message": "Geçersiz barkod."}), 400

    products = load_json(PRODUCTS_FILE, [])
    for p in products:
        if clean_barcode(p.get("barcode")) == clean_bc:
            return jsonify({"status": "success", "product": p})

    return jsonify({"status": "not_found", "message": "Ürün bulunamadı."}), 404

@catalog_bp.route("/api/products", methods=["POST"])
def api_create_or_update_product():
    """Yeni ürün ekler veya mevcut ürünü günceller."""
    req_data = request.json or {}
    barcode = clean_barcode(req_data.get("barcode"))
    title = clean_product_title(req_data.get("title") or req_data.get("title1") or "")
    title2 = str(req_data.get("title2") or "").strip()
    brand = (req_data.get("brand") or "YARENLER").strip().upper()
    origin = str(req_data.get("origin") or "TÜRKİYE").strip().upper()
    price = format_price_display(req_data.get("price"))
    buying_price = req_data.get("buying_price")
    try:
        buying_price_val = float(str(buying_price).replace(',', '.')) if buying_price is not None and str(buying_price).strip() != '' else 0.0
    except Exception:
        buying_price_val = 0.0

    try:
        sale_price_val = float(str(price).replace(',', '.')) if price else 0.0
    except Exception:
        sale_price_val = 0.0

    profit_margin = 0.0
    if buying_price_val > 0 and sale_price_val > 0:
        profit_margin = round(((sale_price_val - buying_price_val) / buying_price_val) * 100, 1)

    unit = req_data.get("unit") or "Adet"
    category = req_data.get("category") or ""
    stock = req_data.get("stock") or 0
    source = req_data.get("source", "PC")

    kdv_input = req_data.get("kdv")
    if kdv_input is None:
        kdv_input = req_data.get("vat_rate")
    try:
        kdv_val = int(kdv_input) if kdv_input is not None and str(kdv_input).strip() != '' else (1 if (unit == "Kg" or "manav" in str(category).lower()) else 10)
    except Exception:
        kdv_val = 10

    if not barcode or not title:
        return jsonify({"status": "error", "message": "Barkod ve Ürün Adı zorunludur."}), 400

    products = load_json(PRODUCTS_FILE, [])
    found = False
    now_datetime = get_online_or_system_datetime()

    for p in products:
        if clean_barcode(p.get("barcode")) == barcode:
            old_p = p.get("price", "")
            p["title"] = title
            p["title1"] = title
            if title2:
                p["title2"] = title2
            p["price"] = price
            p["buying_price"] = format_price_display(buying_price_val) if buying_price_val > 0 else (p.get("buying_price") or "0,00")
            p["profit_margin"] = profit_margin if buying_price_val > 0 else (p.get("profit_margin") or 0.0)
            p["unit"] = unit
            p["kdv"] = kdv_val
            p["vat_rate"] = kdv_val
            if category: p["category"] = category
            p["stock"] = stock
            p["brand"] = brand
            p["origin"] = origin
            p["date"] = now_datetime
            p["updated_at"] = now_datetime
            # Manuel fiyat değişiminde etiket fiyatı (label_price) basılmadığı sürece değişmez!
            if "label_price" not in p:
                p["label_price"] = old_p or ""
            found = True
            
            if old_p and old_p != price:
                log_price_change(barcode, title, old_p, price, source=source)
            break

    if not found:
        new_prod = {
            "barcode": barcode,
            "title": title,
            "title1": title,
            "title2": title2,
            "brand": brand,
            "origin": origin,
            "price": price,
            "buying_price": format_price_display(buying_price_val) if buying_price_val > 0 else "0,00",
            "profit_margin": profit_margin,
            "unit": unit,
            "kdv": kdv_val,
            "vat_rate": kdv_val,
            "category": category,
            "stock": stock,
            "label_price": "",
            "date": now_datetime,
            "updated_at": now_datetime
        }
        products.append(new_prod)
        log_price_change(barcode, title, "Yeni Ürün", price, source=source)

    create_products_backup("Manuel Ürün Kaydı")
    save_json(PRODUCTS_FILE, products)
    clear_diff_cache()

    return jsonify({"status": "success", "message": "Ürün başarıyla kaydedildi.", "product": p if found else new_prod})

@catalog_bp.route("/api/products/<path:barcode>", methods=["DELETE"])
def api_delete_product(barcode):
    """Ürünü katalogdan siler."""
    clean_bc = clean_barcode(barcode)
    products = load_json(PRODUCTS_FILE, [])
    new_prods = [p for p in products if clean_barcode(p.get("barcode")) != clean_bc]

    if len(new_prods) == len(products):
        return jsonify({"status": "error", "message": "Ürün bulunamadı."}), 404

    create_products_backup(f"Ürün Silindi ({clean_bc})")
    save_json(PRODUCTS_FILE, new_prods)
    clear_diff_cache()

    return jsonify({"status": "success", "message": "Ürün silindi."})

@catalog_bp.route("/api/catalog/sync-batch", methods=["POST"])
def api_catalog_sync_batch():
    """Basımı yapılan ürünlerin etiket fiyatlarını topluca günceller ve rapora işler."""
    req_data = request.json or {}
    items = req_data.get("items", [])
    source = req_data.get("source", "PC")
    if not items:
        return jsonify({"status": "error", "message": "Ürün listesi boş."}), 400

    products = load_json(PRODUCTS_FILE, [])
    prod_map = {clean_barcode(p.get("barcode", "")): p for p in products if p.get("barcode")}
    
    now_datetime = get_online_or_system_datetime()
    updated_count = 0

    for item in items:
        bc = clean_barcode(item.get("barcode", ""))
        if not bc:
            continue
        p_price = format_price_display(item.get("price") or item.get("excel_price"))

        if bc in prod_map:
            old_p = prod_map[bc].get("price", "")
            prod_map[bc]["price"] = p_price
            prod_map[bc]["label_price"] = p_price
            prod_map[bc]["date"] = now_datetime
            prod_map[bc]["updated_at"] = now_datetime
            prod_map[bc]["last_printed_at"] = now_datetime
            if item.get("title"):
                clean_t = clean_product_title(item["title"])
                prod_map[bc]["title"] = clean_t
                prod_map[bc]["title1"] = clean_t
            
            if old_p and old_p != p_price:
                log_price_change(bc, prod_map[bc].get("title", "Ürün"), old_p, p_price, source=source)
            updated_count += 1
        else:
            raw_title = clean_product_title(item.get("title") or item.get("title1") or item.get("excel_title") or "YENİ ÜRÜN")
            new_item = {
                "barcode": bc,
                "title": raw_title,
                "title1": raw_title,
                "title2": "",
                "brand": (item.get("brand") or "YARENLER").strip().upper(),
                "origin": "TÜRKİYE",
                "price": p_price,
                "label_price": p_price,
                "date": now_datetime,
                "updated_at": now_datetime,
                "last_printed_at": now_datetime
            }
            products.append(new_item)
            prod_map[bc] = new_item
            log_price_change(bc, raw_title, "Yeni Ürün", p_price, source=source)
            updated_count += 1

    # Basılan etiketleri rapora kaydet
    log_printed_batch(items, source=source)

    if updated_count > 0:
        create_products_backup(f"Toplu Baskı Sonrası Etiket Eşitleme ({updated_count} Ürün)")
        save_json(PRODUCTS_FILE, products)
        clear_diff_cache()

    return jsonify({
        "status": "success",
        "message": f"{updated_count} ürünün etiket fiyatı başarıyla eşitlendi.",
        "updated_count": updated_count
    })

@catalog_bp.route("/api/catalog/sync-label-price", methods=["POST"])
def api_sync_single_label_price():
    """Tek bir ürünün etiket fiyatını güncel fiyatıyla eşitler."""
    req_data = request.json or {}
    barcode = clean_barcode(req_data.get("barcode"))
    if not barcode:
        return jsonify({"status": "error", "message": "Barkod belirtilmedi."}), 400

    products = load_json(PRODUCTS_FILE, [])
    found = False
    for p in products:
        if clean_barcode(p.get("barcode")) == barcode:
            p["label_price"] = p.get("price")
            found = True
            break

    if not found:
        return jsonify({"status": "error", "message": "Ürün bulunamadı."}), 404

    save_json(PRODUCTS_FILE, products)
    clear_diff_cache()
    return jsonify({"status": "success", "message": "Etiket fiyatı güncellendi."})

@catalog_bp.route("/api/catalog/batch-price-update", methods=["POST"])
def api_catalog_batch_price_update():
    """Seçilen ürünlerin fiyatlarını topluca günceller."""
    req_data = request.json or {}
    barcodes = req_data.get("barcodes", [])
    items = req_data.get("items", [])
    common_price = req_data.get("price")

    if not barcodes and not items:
        return jsonify({"status": "error", "message": "Güncellenecek ürün listesi boş."}), 400

    products = load_json(PRODUCTS_FILE, [])
    prod_map = {clean_barcode(p.get("barcode", "")): p for p in products if p.get("barcode")}
    
    updated_count = 0
    now_datetime = get_online_or_system_datetime()

    if items:
        for it in items:
            bc = clean_barcode(it.get("barcode", ""))
            raw_p = it.get("price")
            if bc and bc in prod_map and raw_p:
                old_p = prod_map[bc].get("price", "")
                formatted_p = format_price_display(raw_p)
                prod_map[bc]["price"] = formatted_p
                prod_map[bc]["date"] = now_datetime
                prod_map[bc]["updated_at"] = now_datetime
                if old_p != formatted_p:
                    log_price_change(bc, prod_map[bc].get("title", "Ürün"), old_p, formatted_p, source="PC")
                updated_count += 1
    elif barcodes and common_price:
        formatted_p = format_price_display(common_price)
        for bc_raw in barcodes:
            bc = clean_barcode(bc_raw)
            if bc and bc in prod_map:
                old_p = prod_map[bc].get("price", "")
                prod_map[bc]["price"] = formatted_p
                prod_map[bc]["date"] = now_datetime
                prod_map[bc]["updated_at"] = now_datetime
                if old_p != formatted_p:
                    log_price_change(bc, prod_map[bc].get("title", "Ürün"), old_p, formatted_p, source="PC")
                updated_count += 1

    if updated_count > 0:
        create_products_backup(f"Toplu Fiyat Güncelleme ({updated_count} Ürün)")
        save_json(PRODUCTS_FILE, products)
        clear_diff_cache()

    return jsonify({
        "status": "success",
        "message": f"{updated_count} ürünün fiyatı başarıyla güncellendi.",
        "updated_count": updated_count
    })

@catalog_bp.route("/api/catalog/batch-brand-update", methods=["POST"])
def api_catalog_batch_brand_update():
    """Seçilen ürünlerin firma/markasını topluca günceller."""
    req_data = request.json or {}
    barcodes = req_data.get("barcodes", [])
    new_brand = str(req_data.get("brand") or "").strip().upper()

    if not barcodes or not new_brand:
        return jsonify({"status": "error", "message": "Barkod listesi veya marka adı eksik."}), 400

    products = load_json(PRODUCTS_FILE, [])
    prod_map = {clean_barcode(p.get("barcode", "")): p for p in products if p.get("barcode")}
    
    updated_count = 0
    for bc_raw in barcodes:
        bc = clean_barcode(bc_raw)
        if bc and bc in prod_map:
            prod_map[bc]["brand"] = new_brand
            updated_count += 1

    if updated_count > 0:
        create_products_backup(f"Toplu Marka Güncelleme ({updated_count} Ürün -> {new_brand})")
        save_json(PRODUCTS_FILE, products)
        clear_diff_cache()

    return jsonify({
        "status": "success",
        "message": f"{updated_count} ürünün markası '{new_brand}' olarak güncellendi.",
        "updated_count": updated_count
    })


# =========================================================
# ÖZEL BARKOD YÖNETİMİ (MAKSİMUM 6 ADET)
# =========================================================

DEFAULT_CUSTOM_BARCODES = [
    {"id": "cb_1", "name": "ÖZEL KOD 1", "code": "OZEL01"},
    {"id": "cb_2", "name": "ÖZEL KOD 2", "code": "OZEL02"},
    {"id": "cb_3", "name": "ÖZEL KOD 3", "code": "OZEL03"}
]

@catalog_bp.route("/api/custom_barcodes", methods=["GET"])
def api_get_custom_barcodes():
    """Kayıtlı özel barkod listesini döner (Maksimum 6 adet)."""
    items = load_json(CUSTOM_BARCODES_FILE, None)
    if items is None:
        items = DEFAULT_CUSTOM_BARCODES
        save_json(CUSTOM_BARCODES_FILE, items)
    return jsonify({"status": "success", "custom_barcodes": items[:6]})


@catalog_bp.route("/api/custom_barcodes/save", methods=["POST"])
def api_save_custom_barcode():
    """Yeni özel barkod ekler veya mevcut olanı günceller (Maks 6 adet)."""
    req_data = request.json or {}
    item_id = str(req_data.get("id") or "").strip()
    name = str(req_data.get("name") or "").strip()
    code = str(req_data.get("code") or "").strip().upper()

    if not name or not code:
        return jsonify({"status": "error", "message": "Özel barkod adı ve kodu boş bırakılamaz."}), 400

    items = load_json(CUSTOM_BARCODES_FILE, DEFAULT_CUSTOM_BARCODES)

    # Güncelleme mi, yeni kayıt mı?
    found_idx = -1
    for idx, it in enumerate(items):
        if str(it.get("id")) == item_id:
            found_idx = idx
            break

    if found_idx != -1:
        # Güncelleme
        items[found_idx]["name"] = name
        items[found_idx]["code"] = code
    else:
        # Yeni Kayıt (Maks 6 kontrolü)
        if len(items) >= 6:
            return jsonify({
                "status": "error",
                "message": "En fazla 6 adet özel barkod tanımlayabilirsiniz. Lütfen mevcut olanlardan birini silin veya düzenleyin."
            }), 400
        new_id = f"cb_{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}"
        items.append({"id": new_id, "name": name, "code": code})

    save_json(CUSTOM_BARCODES_FILE, items[:6])
    return jsonify({
        "status": "success",
        "message": f"'{name}' özel barkodu başarıyla kaydedildi.",
        "custom_barcodes": items[:6]
    })


@catalog_bp.route("/api/custom_barcodes/delete", methods=["POST"])
def api_delete_custom_barcode():
    """Özel barkodu siler."""
    req_data = request.json or {}
    item_id = str(req_data.get("id") or "").strip()

    if not item_id:
        return jsonify({"status": "error", "message": "Silinecek barkod ID'si eksik."}), 400

    items = load_json(CUSTOM_BARCODES_FILE, DEFAULT_CUSTOM_BARCODES)
    items = [it for it in items if str(it.get("id")) != item_id]

    save_json(CUSTOM_BARCODES_FILE, items[:6])
    return jsonify({
        "status": "success",
        "message": "Özel barkod silindi.",
        "custom_barcodes": items[:6]
    })


# =========================================================
# KATALOG GÜNCELLEME & EXCEL / CSV SENKRONİZASYON ROTALARI
# =========================================================

@catalog_bp.route("/api/catalog/sync-status", methods=["GET"])
def api_catalog_sync_status():
    """En son yüklenen Excel/CSV stok dosyasının fark analizini döner."""
    latest_file = get_latest_excel_path()
    if not latest_file:
        return jsonify({"status": "no_file", "message": "Henüz yüklenmiş Excel/CSV dosyası bulunmuyor."})

    res = analyze_excel_diff(latest_file)
    return jsonify(res)


@catalog_bp.route("/api/catalog/apply-sync", methods=["POST"])
def api_catalog_apply_sync():
    """Excel/CSV fark analizinden seçilen veya tüm ürünleri kataloğa aktarır/günceller."""
    req_data = request.json or {}
    items = req_data.get("items", [])
    action = req_data.get("action", "all")

    if not items:
        return jsonify({"status": "error", "message": "Aktarılacak ürün bulunamadı."}), 400

    products = load_json(PRODUCTS_FILE, [])
    prod_map = {clean_barcode(p.get("barcode", "")): p for p in products if p.get("barcode")}

    applied_count = 0
    now_datetime = get_online_or_system_datetime()

    for it in items:
        bc = clean_barcode(it.get("barcode", ""))
        excel_price = it.get("excel_price") or it.get("price")
        excel_title = it.get("excel_title") or it.get("title")
        brand = it.get("brand") or "DİĞER"

        if not bc:
            continue

        if bc in prod_map:
            # Fiyat Güncelleme
            old_p = prod_map[bc].get("price", "")
            if excel_price:
                formatted_p = format_price_display(excel_price)
                prod_map[bc]["price"] = formatted_p
                prod_map[bc]["date"] = now_datetime
                prod_map[bc]["updated_at"] = now_datetime
                if old_p != formatted_p:
                    log_price_change(bc, prod_map[bc].get("title", "Ürün"), old_p, formatted_p, source="Excel Senkronizasyon")
                applied_count += 1
        else:
            # Yeni Ürün Ekleme
            if excel_price and excel_price != "0,00 TL":
                formatted_p = format_price_display(excel_price)
                new_prod = {
                    "barcode": bc,
                    "title": clean_product_title(excel_title or "YENİ ÜRÜN"),
                    "title1": clean_product_title(excel_title or "YENİ ÜRÜN"),
                    "title2": "",
                    "brand": brand,
                    "price": formatted_p,
                    "label_price": "",  # Henüz raf etiketi basılmadı rozeti için boş
                    "stock": 100,
                    "origin": "TÜRKİYE",
                    "unit": "Adet",
                    "date": now_datetime,
                    "updated_at": now_datetime
                }
                products.append(new_prod)
                prod_map[bc] = new_prod
                log_price_change(bc, new_prod["title"], "-", formatted_p, source="Excel Yeni Ürün")
                applied_count += 1

    if applied_count > 0:
        create_products_backup(f"Excel Senkronizasyon ({applied_count} Ürün)")
        save_json(PRODUCTS_FILE, products)
        clear_diff_cache()

    latest_file = get_latest_excel_path()
    latest_diff = analyze_excel_diff(latest_file) if latest_file else {}

    return jsonify({
        "status": "success",
        "message": f"{applied_count} ürün başarıyla güncellendi.",
        "applied_count": applied_count,
        "latest_sync_data": latest_diff
    })


@catalog_bp.route("/api/catalog/upload-excel", methods=["POST"])
def api_catalog_upload_excel():
    """Yeni Excel veya CSV stok listesi yükler ve anında analiz eder."""
    if 'file' not in request.files:
        return jsonify({"status": "error", "message": "Yüklenecek dosya seçilmedi."}), 400

    file = request.files['file']
    if not file or not file.filename:
        return jsonify({"status": "error", "message": "Geçersiz dosya."}), 400

    filename = file.filename
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ['.xlsx', '.xls', '.csv']:
        return jsonify({"status": "error", "message": "Sadece .xlsx, .xls veya .csv dosyaları desteklenir."}), 400

    now_str = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    safe_name = f"stok_{now_str}{ext}"
    dest_path = os.path.join(SISTEM_EXCELI_DIR, safe_name)

    os.makedirs(SISTEM_EXCELI_DIR, exist_ok=True)
    file.save(dest_path)
    clear_diff_cache()

    res = analyze_excel_diff(dest_path)
    return jsonify(res)


@catalog_bp.route("/api/catalog/excel-history", methods=["GET"])
def api_catalog_excel_history():
    """Yüklenen geçmiş Excel ve CSV dosyalarının arşiv listesini döner."""
    if not os.path.exists(SISTEM_EXCELI_DIR):
        return jsonify({"status": "success", "history": []})

    files = [
        f for f in os.listdir(SISTEM_EXCELI_DIR)
        if f.lower().endswith(('.xlsx', '.xls', '.csv'))
    ]

    history = []
    latest_path = get_latest_excel_path()
    latest_name = os.path.basename(latest_path) if latest_path else None

    for fname in sorted(files, reverse=True):
        fpath = os.path.join(SISTEM_EXCELI_DIR, fname)
        mtime = os.path.getmtime(fpath)
        dt_str = datetime.datetime.fromtimestamp(mtime).strftime("%d %b %Y %H:%M")
        size_kb = f"{os.path.getsize(fpath) / 1024:.1f} KB"

        stats = {}
        try:
            diff_res = analyze_excel_diff(fpath)
            stats = diff_res.get("stats", {})
        except Exception:
            pass

        history.append({
            "filename": fname,
            "date": dt_str,
            "size": size_kb,
            "timestamp": mtime,
            "is_latest": (fname == latest_name),
            "stats": stats
        })

    history.sort(key=lambda x: x["timestamp"], reverse=True)
    return jsonify({"status": "success", "history": history})


@catalog_bp.route("/api/catalog/excel-detail/<path:filename>", methods=["GET"])
def api_catalog_excel_detail(filename):
    """Arşivdeki belirli bir Excel dosyasının detaylı fark analizini döner."""
    safe_name = os.path.basename(filename)
    fpath = os.path.join(SISTEM_EXCELI_DIR, safe_name)
    if not os.path.exists(fpath):
        return jsonify({"status": "error", "message": "Dosya bulunamadı."}), 404

    res = analyze_excel_diff(fpath)
    return jsonify(res)


@catalog_bp.route("/api/catalog/excel-download/<path:filename>", methods=["GET"])
def api_catalog_excel_download(filename):
    """Arşivdeki Excel dosyasını indirmek üzere sunar."""
    safe_name = os.path.basename(filename)
    fpath = os.path.join(SISTEM_EXCELI_DIR, safe_name)
    if not os.path.exists(fpath):
        return jsonify({"status": "error", "message": "Dosya bulunamadı."}), 404

    return send_file(fpath, as_attachment=True, download_name=safe_name)


@catalog_bp.route("/api/catalog/excel-delete", methods=["POST"])
def api_catalog_excel_delete():
    """Arşivden belirtilen Excel dosyasını siler."""
    req_data = request.json or {}
    filename = req_data.get("filename")
    if not filename:
        return jsonify({"status": "error", "message": "Dosya adı belirtilmedi."}), 400

    safe_name = os.path.basename(filename)
    fpath = os.path.join(SISTEM_EXCELI_DIR, safe_name)
    if not os.path.exists(fpath):
        return jsonify({"status": "error", "message": "Dosya bulunamadı."}), 404

    try:
        os.remove(fpath)
        clear_diff_cache()
        return jsonify({"status": "success", "message": f"'{safe_name}' başarıyla silindi."})
    except Exception as e:
        return jsonify({"status": "error", "message": f"Silme hatası: {str(e)}"}), 500


def log_product_activity(barcode, activity_type, title, details="", actor="Kasa / Sistem", meta=None):
    """Ürünle ilgili tüm geçmiş faaliyetleri (fiyat, etiket basımı, satış, stok) kaydeder."""
    clean_bc = clean_barcode(barcode)
    if not clean_bc:
        return
    
    activities_db = load_json(PRODUCT_ACTIVITIES_FILE, {})
    if clean_bc not in activities_db:
        activities_db[clean_bc] = []
    
    now_str = datetime.datetime.now().strftime("%d.%m.%Y %H:%M:%S")
    entry = {
        "id": f"act_{int(datetime.datetime.now().timestamp() * 1000)}",
        "timestamp": now_str,
        "type": activity_type,  # 'price', 'print', 'sale', 'stock', 'info'
        "title": title,
        "details": details,
        "actor": actor,
        "meta": meta or {}
    }
    
    activities_db[clean_bc].insert(0, entry)
    if len(activities_db[clean_bc]) > 100:
        activities_db[clean_bc] = activities_db[clean_bc][:100]
        
    save_json(PRODUCT_ACTIVITIES_FILE, activities_db)


@catalog_bp.route("/api/products/<path:barcode>/activities", methods=["GET"])
def api_get_product_activities(barcode):
    """Belirtilen ürünün tüm geçmiş faaliyet günlüğünü döner."""
    clean_bc = clean_barcode(barcode)
    if not clean_bc:
        return jsonify({"status": "error", "message": "Geçersiz barkod."}), 400

    activities_db = load_json(PRODUCT_ACTIVITIES_FILE, {})
    activities = list(activities_db.get(clean_bc, []))

    # Otomatik olarak data/satislar/ klasöründeki geçmiş fiş satışlarını da tara (Yıl/Ay hiyerarşisi)
    try:
        for fpath in list_all_sales_files()[:15]:
            receipts = load_json(fpath, [])
            for r in receipts:
                for item in r.get("items", []):
                    if clean_barcode(item.get("barcode")) == clean_bc:
                        activities.append({
                            "id": f"sale_{r.get('receipt_no', '')}",
                            "timestamp": r.get("datetime") or r.get("time", ""),
                            "type": "sale",
                            "title": f"Kasa Satışı ({item.get('quantity', 1)} Adet)",
                            "details": f"Fiş #{r.get('receipt_no', '')} | Ödeme: {r.get('payment_type', 'Nakit').upper()} | Tutar: {item.get('total', item.get('price', ''))}",
                            "actor": r.get("cashier", "Kasiyer"),
                            "meta": {"receipt_no": r.get("receipt_no"), "quantity": item.get("quantity")}
                        })
    except Exception as e:
        print("Geçmiş satış tarama hatası:", e)

    # Tarihe göre sırala
    return jsonify({
        "status": "success",
        "barcode": clean_bc,
        "count": len(activities),
        "activities": activities
    })


@catalog_bp.route("/api/products/<path:barcode>/activities", methods=["POST"])
def api_add_product_activity(barcode):
    """Ürüne özel manuel not veya işlem kaydı ekler."""
    clean_bc = clean_barcode(barcode)
    req_data = request.json or {}
    act_type = req_data.get("type", "info")
    title = req_data.get("title", "İşlem Kaydı")
    details = req_data.get("details", "")
    actor = req_data.get("actor", "Kullanıcı")

    log_product_activity(clean_bc, act_type, title, details, actor)
    return jsonify({"status": "success", "message": "Faaliyet kaydı başarıyla eklendi."})


@catalog_bp.route("/api/catalog/batch_price_update", methods=["POST"])
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
            try:
                clean_old = old_price_str.replace("TL", "").replace(".", "").replace(",", ".").strip()
                old_val = float(clean_old)
            except Exception:
                continue

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

    return jsonify({
        "status": "success",
        "message": f"{len(updated_products)} adet ürünün fiyatı başarıyla güncellendi.",
        "updated_count": len(updated_products),
        "updated_products": updated_products[:50]  # İlk 50 örnek
    })


@catalog_bp.route("/api/catalog/price_changed_today", methods=["GET"])
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


@catalog_bp.route("/api/catalog/low_stock_alerts", methods=["GET"])
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




