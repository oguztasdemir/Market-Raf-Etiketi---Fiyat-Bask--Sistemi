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
from backend.araclar.metin_duzenleyici import clean_barcode, clean_product_title, format_price_display, get_online_or_system_datetime, parse_price_val
from backend.yedekleme.yedekleme_servisi import create_products_backup
from backend.katalog.excel_katalog_servisi import analyze_excel_diff, get_latest_excel_path, clear_diff_cache
from backend.raporlama.raporlama_servisi import log_price_change, log_printed_batch

catalog_bp = Blueprint('catalog_bp', __name__)

_INDEX_CACHE = {"mtime": 0, "barcode_map": {}, "products": []}

def invalidate_product_cache():
    """Ürün indeks önbelleğini anında sıfırlar ve yenilenmeye zorlar."""
    global _INDEX_CACHE
    _INDEX_CACHE = {"mtime": 0, "barcode_map": {}, "products": []}

def get_indexed_products():
    """Ürünleri hafızada indeksli ve O(1) arama haritasıyla hazır tutar."""
    global _INDEX_CACHE
    products = load_json(PRODUCTS_FILE, [])
    if not products:
        return [], {}

    if _INDEX_CACHE.get("products") and len(_INDEX_CACHE["products"]) == len(products):
        return _INDEX_CACHE["products"], _INDEX_CACHE["barcode_map"]

    bc_map = {}
    for p in products:
        bc = clean_barcode(p.get("barcode"))
        if bc:
            bc_map[bc] = p
        for alt_bc in (p.get("barcodes") or p.get("alternate_barcodes") or []):
            c_alt = clean_barcode(alt_bc)
            if c_alt and c_alt not in bc_map:
                bc_map[c_alt] = p
    _INDEX_CACHE = {"products": products, "barcode_map": bc_map}
    return products, bc_map

def find_product_by_barcode(barcode: str):
    """O(1) hızında barkod veya alternatif barkoddan ürün bulur."""
    clean_bc = clean_barcode(barcode)
    if not clean_bc:
        return None
    _, bc_map = get_indexed_products()
    return bc_map.get(clean_bc)

@catalog_bp.route("/api/catalog/generate_internal_barcode", methods=["GET"])
def api_generate_internal_barcode():
    """Barkodsuz ürünler için GS1 standartlarında otomatik mağaza içi EAN-13 barkod üretir (2000000000000 serisi)."""
    _, bc_map = get_indexed_products()
    
    # 200 ön ekiyle başlayan ilk boş EAN-13 numarasını bul
    base_prefix = "200"
    for seq in range(1, 100000):
        raw_12 = f"{base_prefix}{seq:09d}"
        digits = [int(c) for c in raw_12]
        checksum = (10 - (sum(digits[idx] * (1 if idx % 2 == 0 else 3) for idx in range(12)) % 10)) % 10
        full_ean = f"{raw_12}{checksum}"
        if full_ean not in bc_map:
            return jsonify({
                "status": "success",
                "barcode": full_ean,
                "type": "EAN-13 (Mağaza İçi Özel Barkod)",
                "prefix": "200"
            })

    return jsonify({"status": "error", "message": "Kullanılabilir mağaza içi barkod üretilemedi."}), 500

@catalog_bp.route("/api/products", methods=["GET"])
def api_get_products():
    """Tüm ürün kataloğunu döner."""
    products, _ = get_indexed_products()
    return jsonify({"status": "success", "products": products})

@catalog_bp.route("/api/products/search", methods=["GET"])
def api_search_products():
    """Yüksek hızlı ürün arama (barkod O(1) veya başlık tam/kısmi eşleme)."""
    q = request.args.get("q", "").strip().lower()
    if not q:
        return jsonify({"status": "success", "products": []})

    products, bc_map = get_indexed_products()
    clean_q = clean_barcode(q)
    
    # 1. Tam barkod eşleşmesi (O(1))
    if clean_q and clean_q in bc_map:
        return jsonify({"status": "success", "products": [bc_map[clean_q]]})

    # 2. Hızlı başlık ve kısmi barkod taraması
    results = []
    tokens = q.split()
    for p in products:
        title = str(p.get("title", "") or p.get("title1", "")).lower()
        barcode = str(p.get("barcode", "")).lower()
        
        # Tüm kelime parçaları başlıkta veya barkodda geçiyor mu
        if all(tok in title or tok in barcode for tok in tokens):
            results.append(p)
            if len(results) >= 50:
                break

    return jsonify({"status": "success", "products": results})

@catalog_bp.route("/api/products/<path:barcode>", methods=["GET"])
def api_get_product(barcode):
    """Barkod ile tekil ürün detayını döner (O(1))."""
    prod = find_product_by_barcode(barcode)
    if prod:
        return jsonify({"status": "success", "product": prod})
    return jsonify({"status": "not_found", "message": "Ürün bulunamadı."}), 404

@catalog_bp.route("/api/products", methods=["POST"])
def api_create_or_update_product():
    """Yeni ürün ekler veya mevcut ürünü günceller."""
    req_data = request.json or {}
    barcode = clean_barcode(req_data.get("barcode"))
    old_barcode = clean_barcode(req_data.get("old_barcode"))
    
    title = clean_product_title(req_data.get("title") or req_data.get("title1") or "")
    title2 = str(req_data.get("title2") or "").strip()
    brand = (req_data.get("brand") or "YARENLER").strip().upper()
    origin = str(req_data.get("origin") or "TÜRKİYE").strip().upper()
    price = format_price_display(req_data.get("price"))
    buying_price_val = parse_price_val(req_data.get("buying_price"))
    sale_price_val = parse_price_val(req_data.get("price"))

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
    
    # Barkod değiştiyse eski barkodu silerek kaydet (çift kayıt oluşmasın)
    if old_barcode and old_barcode != barcode:
        products = [p for p in products if clean_barcode(p.get("barcode")) != old_barcode]
    found = False
    now_datetime = get_online_or_system_datetime()

    # Alternatif / Çoklu Barkodlar
    barcodes_in = req_data.get("barcodes") or req_data.get("alternate_barcodes") or req_data.get("custom_barcode") or []
    if isinstance(barcodes_in, list):
        unified_barcodes = [clean_barcode(b) for b in barcodes_in if clean_barcode(b)]
    elif isinstance(barcodes_in, str):
        unified_barcodes = [clean_barcode(b) for b in barcodes_in.split(",") if clean_barcode(b)]
    else:
        unified_barcodes = []

    if barcode and barcode not in unified_barcodes:
        unified_barcodes.insert(0, barcode)

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
            p["custom_barcode"] = req_data.get("custom_barcode") or ""
            p["barcodes"] = unified_barcodes
            p["alternate_barcodes"] = unified_barcodes
            no_label = bool(req_data.get("no_label", False))
            p["no_label"] = no_label
            is_special = bool(req_data.get("is_special", req_data.get("special_category", False)))
            p["is_special"] = is_special
            p["special_category"] = is_special
            # Manuel fiyat değişiminde etiket fiyatı (label_price) basılmadığı sürece değişmez (etiket muaf ise senkronize kalır)!
            if no_label:
                p["label_price"] = price
            elif "label_price" not in p:
                p["label_price"] = old_p or ""
            found = True
            
            if old_p and old_p != price:
                log_price_change(barcode, title, old_p, price, source=source)
            break

    if not found:
        no_label = bool(req_data.get("no_label", False))
        is_special = bool(req_data.get("is_special", req_data.get("special_category", False)))
        new_prod = {
            "barcode": barcode,
            "barcodes": unified_barcodes,
            "custom_barcode": req_data.get("custom_barcode") or "",
            "alternate_barcodes": unified_barcodes,
            "title": title,
            "title1": title,
            "title2": title2,
            "price": price,
            "buying_price": format_price_display(buying_price_val) if buying_price_val > 0 else "0,00",
            "profit_margin": profit_margin if buying_price_val > 0 else 0.0,
            "unit": unit,
            "kdv": kdv_val,
            "vat_rate": kdv_val,
            "category": category,
            "stock": stock,
            "brand": brand,
            "origin": origin,
            "date": now_datetime,
            "updated_at": now_datetime,
            "label_price": price if no_label else "",
            "no_label": no_label,
            "is_special": is_special,
            "special_category": is_special
        }
        products.append(new_prod)
        log_price_change(barcode, title, "Yeni Ürün", price, source=source)

    create_products_backup("Manuel Ürün Kaydı")
    save_json(PRODUCTS_FILE, products)
    invalidate_product_cache()
    clear_diff_cache()

    return jsonify({"status": "success", "message": "Ürün başarıyla kaydedildi.", "product": p if found else new_prod})

@catalog_bp.route("/api/products/add_barcode", methods=["POST"])
def api_add_product_barcode():
    """Mevcut bir ürüne ek/alternatif barkod ekler."""
    req_data = request.json or {}
    primary_barcode = clean_barcode(req_data.get("barcode") or req_data.get("id"))
    new_barcode = clean_barcode(req_data.get("new_barcode"))

    if not primary_barcode or not new_barcode:
        return jsonify({"status": "error", "message": "Ana barkod ve eklenecek yeni barkod zorunludur."}), 400

    products = load_json(PRODUCTS_FILE, [])
    target_prod = None

    for p in products:
        p_bcs = p.get("barcodes", [])
        if clean_barcode(p.get("barcode")) == primary_barcode or primary_barcode in [clean_barcode(b) for b in p_bcs]:
            target_prod = p
            break

    if not target_prod:
        return jsonify({"status": "error", "message": "Ürün bulunamadı."}), 404

    if "barcodes" not in target_prod:
        target_prod["barcodes"] = [target_prod.get("barcode")] if target_prod.get("barcode") else []

    if new_barcode in target_prod["barcodes"]:
        return jsonify({"status": "error", "message": "Bu barkod zaten bu ürüne kayıtlı."}), 400

    target_prod["barcodes"].append(new_barcode)
    target_prod["alternate_barcodes"] = target_prod["barcodes"]
    save_json(PRODUCTS_FILE, products)
    invalidate_product_cache()

    return jsonify({
        "status": "success",
        "message": f"'{new_barcode}' barkodu '{target_prod.get('title')}' ürününe başarıyla eklendi.",
        "barcodes": target_prod["barcodes"]
    })

@catalog_bp.route("/api/products/remove_barcode", methods=["POST"])
def api_remove_product_barcode():
    """Üründen alternatif bir barkodu kaldırır."""
    req_data = request.json or {}
    primary_barcode = clean_barcode(req_data.get("barcode") or req_data.get("id"))
    remove_bc = clean_barcode(req_data.get("remove_barcode"))

    if not primary_barcode or not remove_bc:
        return jsonify({"status": "error", "message": "Barkod bilgisi eksik."}), 400

    products = load_json(PRODUCTS_FILE, [])
    target_prod = None

    for p in products:
        p_bcs = p.get("barcodes", [])
        if clean_barcode(p.get("barcode")) == primary_barcode or primary_barcode in [clean_barcode(b) for b in p_bcs]:
            target_prod = p
            break

    if not target_prod:
        return jsonify({"status": "error", "message": "Ürün bulunamadı."}), 404

    bcs = target_prod.get("barcodes", [])
    if remove_bc in bcs:
        bcs.remove(remove_bc)
        target_prod["barcodes"] = bcs
        target_prod["alternate_barcodes"] = bcs
        save_json(PRODUCTS_FILE, products)
        invalidate_product_cache()
        return jsonify({"status": "success", "message": "Barkod başarıyla silindi.", "barcodes": bcs})

    return jsonify({"status": "error", "message": "Silinecek barkod bulunamadı."}), 404

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
    invalidate_product_cache()
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
        invalidate_product_cache()
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
                if prod_map[bc].get("no_label"):
                    prod_map[bc]["label_price"] = formatted_p
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
                if prod_map[bc].get("no_label"):
                    prod_map[bc]["label_price"] = formatted_p
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

@catalog_bp.route("/api/catalog/batch-label-exempt", methods=["POST"])
def api_catalog_batch_label_exempt():
    """Seçilen ürünlerin etiket muafiyeti durumunu (no_label) topluca günceller."""
    req_data = request.json or {}
    barcodes = req_data.get("barcodes", [])
    exempt = req_data.get("exempt", None) # True, False or None (toggle)

    if not barcodes:
        return jsonify({"status": "error", "message": "Barkod listesi boş."}), 400

    products = load_json(PRODUCTS_FILE, [])
    prod_map = {clean_barcode(p.get("barcode", "")): p for p in products if p.get("barcode")}
    
    updated_count = 0
    now_datetime = get_online_or_system_datetime()
    
    for bc_raw in barcodes:
        bc = clean_barcode(bc_raw)
        if bc and bc in prod_map:
            target_exempt = not prod_map[bc].get("no_label", False) if exempt is None else bool(exempt)
            prod_map[bc]["no_label"] = target_exempt
            prod_map[bc]["updated_at"] = now_datetime
            if target_exempt:
                prod_map[bc]["label_price"] = prod_map[bc].get("price", "")
            updated_count += 1

    if updated_count > 0:
        create_products_backup(f"Toplu Etiket Muafiyeti ({updated_count} Ürün)")
        save_json(PRODUCTS_FILE, products)
        clear_diff_cache()

    return jsonify({
        "status": "success",
        "message": f"{updated_count} ürünün etiket muafiyet durumu güncellendi.",
        "updated_count": updated_count
    })

@catalog_bp.route("/api/catalog/batch-special-category", methods=["POST"])
def api_catalog_batch_special_category():
    """Seçilen ürünlerin Özel Kategori durumunu (is_special) ve özel barkod alanını günceller."""
    req_data = request.json or {}
    barcodes = req_data.get("barcodes", [])
    is_special = req_data.get("is_special", None) # True, False or None (toggle)
    category = req_data.get("category", "")
    custom_bc = req_data.get("custom_barcode", None)
    custom_bc_name = req_data.get("custom_barcode_name", None)

    if not barcodes:
        return jsonify({"status": "error", "message": "Barkod listesi boş."}), 400

    products = load_json(PRODUCTS_FILE, [])
    prod_map = {clean_barcode(p.get("barcode", "")): p for p in products if p.get("barcode")}
    
    updated_count = 0
    now_datetime = get_online_or_system_datetime()
    
    for bc_raw in barcodes:
        bc = clean_barcode(bc_raw)
        if bc and bc in prod_map:
            target_special = not prod_map[bc].get("is_special", False) if is_special is None else bool(is_special)
            prod_map[bc]["is_special"] = target_special
            prod_map[bc]["special_category"] = target_special
            if target_special:
                if custom_bc:
                    prod_map[bc]["custom_barcode"] = custom_bc
                if custom_bc_name:
                    prod_map[bc]["custom_barcode_name"] = custom_bc_name
            else:
                prod_map[bc]["custom_barcode"] = None
                prod_map[bc]["custom_barcode_name"] = None
            prod_map[bc]["updated_at"] = now_datetime
            updated_count += 1

    if updated_count > 0:
        create_products_backup(f"Toplu Özel Kategori Güncelleme ({updated_count} Ürün)")
        save_json(PRODUCTS_FILE, products)
        clear_diff_cache()

    return jsonify({
        "status": "success",
        "message": f"{updated_count} ürünün Özel Kategori durumu güncellendi.",
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
    {"id": "cb_1", "name": "BARKODSUZ ÜRÜNLER (GENEL)", "code": "OZEL-BARKODSUZ"},
    {"id": "cb_2", "name": "MANAV ÜRÜNLERİ", "code": "OZEL-MANAV"},
    {"id": "cb_3", "name": "KASAP & ŞARKÜTERİ", "code": "OZEL-KASAP"},
    {"id": "cb_4", "name": "EKMEK & UNLU MAMUL", "code": "OZEL-EKMEK"},
    {"id": "cb_5", "name": "POŞET & AMBALAJ", "code": "OZEL-POSET"},
    {"id": "cb_6", "name": "YUMURTA & ÇİFTLİK", "code": "OZEL-YUMURTA"}
]

@catalog_bp.route("/api/custom_barcodes", methods=["GET"])
def api_get_custom_barcodes():
    """Kayıtlı özel barkod listesini döner (Maksimum 6 adet)."""
    items = load_json(CUSTOM_BARCODES_FILE, None)
    if not items:
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
    """Özel barkodu siler ve bu özel barkoda sahip ürünlerin özel barkodlarını temizler."""
    req_data = request.json or {}
    item_id = str(req_data.get("id") or "").strip()

    if not item_id:
        return jsonify({"status": "error", "message": "Silinecek barkod ID'si eksik."}), 400

    items = load_json(CUSTOM_BARCODES_FILE, DEFAULT_CUSTOM_BARCODES)
    deleted_item = next((it for it in items if str(it.get("id")) == item_id), None)
    
    items = [it for it in items if str(it.get("id")) != item_id]
    save_json(CUSTOM_BARCODES_FILE, items[:6])

    affected_count = 0
    if deleted_item:
        deleted_code = str(deleted_item.get("code", "")).strip().upper()
        deleted_name = str(deleted_item.get("name", "")).strip().upper()
        
        # Ürünler veritabanında bu özel barkoda sahip olanları temizle
        from backend.araclar.depolama_araclari import _STORAGE_LOCK
        with _STORAGE_LOCK:
            products = load_json(PRODUCTS_FILE, [])
            for p in products:
                cb = str(p.get("custom_barcode") or "").strip().upper()
                c_name = str(p.get("custom_barcode_name") or "").strip().upper()
                
                # Eşleşme kontrolü
                if cb == deleted_code or (deleted_name and c_name == deleted_name) or (deleted_code == "OZEL-MANAV" and (p.get("brand") == "MANAV" or cb.startswith("27"))):
                    p["custom_barcode"] = None
                    p["custom_barcode_name"] = None
                    if isinstance(p.get("alternate_barcodes"), list):
                        p["alternate_barcodes"] = [b for b in p["alternate_barcodes"] if str(b).upper() != deleted_code]
                    affected_count += 1

            if affected_count > 0:
                save_json(PRODUCTS_FILE, products)

    msg = f"Özel barkod silindi. {affected_count} adet ürünün özel barkodu temizlendi (barkodsuz bırakıldı)." if affected_count > 0 else "Özel barkod silindi."
    return jsonify({
        "status": "success",
        "message": msg,
        "affected_products": affected_count,
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
    """Belirtilen ürünün geçmiş faaliyet günlüğünü döner (Satışlar gün gün özetlenir)."""
    clean_bc = clean_barcode(barcode)
    if not clean_bc:
        return jsonify({"status": "error", "message": "Geçersiz barkod."}), 400

    activities_db = load_json(PRODUCT_ACTIVITIES_FILE, {})
    activities = list(activities_db.get(clean_bc, []))

    # Satışları tek tek fiş olarak değil, GÜN GÜN özet olarak topla
    daily_sales = {}
    try:
        for fpath in list_all_sales_files()[:20]:
            receipts = load_json(fpath, [])
            for r in receipts:
                dt_raw = str(r.get("datetime") or r.get("time") or "").strip()
                date_key = dt_raw.split(" ")[0] if " " in dt_raw else (dt_raw[:10] if len(dt_raw) >= 10 else "Bugün")
                for item in r.get("items", []):
                    if clean_barcode(item.get("barcode")) == clean_bc:
                        try:
                            qty = float(item.get("quantity") or 1)
                        except (ValueError, TypeError):
                            qty = 1.0
                        try:
                            p_val = float(item.get("unit_price") or item.get("price") or 0.0)
                        except (ValueError, TypeError):
                            p_val = 0.0

                        if date_key not in daily_sales:
                            daily_sales[date_key] = {"date": date_key, "total_qty": 0.0, "total_amount": 0.0, "receipt_count": 0}
                        daily_sales[date_key]["total_qty"] += qty
                        daily_sales[date_key]["total_amount"] += (qty * p_val)
                        daily_sales[date_key]["receipt_count"] += 1

        for d_key, d_info in daily_sales.items():
            qty_num = int(d_info["total_qty"]) if d_info["total_qty"].is_integer() else round(d_info["total_qty"], 2)
            c_str = f"{d_info['total_amount']:,.2f} TL".replace(",", "X").replace(".", ",").replace("X", ".")
            activities.append({
                "id": f"daily_sale_{d_key.replace('-', '')}",
                "timestamp": f"{d_key} 20:00",
                "type": "sale",
                "title": f"📅 Günlük Satış: {qty_num} Adet Satıldı",
                "details": f"Toplam Günlük Ciro: {c_str} | {d_info['receipt_count']} Fiş İşlemi",
                "actor": "Kasa Satışları",
                "meta": {"total_qty": d_info["total_qty"], "total_amount": d_info["total_amount"], "receipt_count": d_info["receipt_count"]}
            })
    except Exception as e:
        print("Geçmiş satış tarama hatası:", e)

    # Tarihe göre sırala (En yeni en üstte)
    activities.sort(key=lambda a: str(a.get("timestamp") or ""), reverse=True)

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

@catalog_bp.route("/api/catalog/expiring_products", methods=["GET"])
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

@catalog_bp.route("/api/catalog/supplier_order_sheet", methods=["GET"])
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


@catalog_bp.route("/api/setup/export_prices", methods=["GET"])
@catalog_bp.route("/api/katalog/export_excel", methods=["GET"])
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


@catalog_bp.route("/api/setup/execute", methods=["POST"])
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


@catalog_bp.route("/api/setup/restore_backup", methods=["POST"])
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









