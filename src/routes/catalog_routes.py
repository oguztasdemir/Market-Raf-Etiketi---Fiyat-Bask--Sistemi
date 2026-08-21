# -*- coding: utf-8 -*-
"""
Ürün Kataloğu, Ürün Arama, CRUD ve Kara Liste API Rotaları
"""
import datetime
from flask import Blueprint, jsonify, request
from src.config import PRODUCTS_FILE, BLACKLIST_FILE
from src.utils.storage import load_json, save_json
from src.utils.text_cleaner import clean_barcode, clean_product_title, format_price_display, get_online_or_system_date, get_online_or_system_datetime
from src.services.backup_service import create_products_backup
from src.services.excel_service import clear_diff_cache
from src.services.report_service import log_price_change, log_printed_batch

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
    source = req_data.get("source", "PC")

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
            "label_price": "",
            "date": now_datetime,
            "updated_at": now_datetime
        }
        products.append(new_prod)
        log_price_change(barcode, title, "Yeni Ürün", price, source=source)

    create_products_backup("Manuel Ürün Kaydı")
    save_json(PRODUCTS_FILE, products)
    clear_diff_cache()

    return jsonify({"status": "success", "message": "Ürün başarıyla kaydedildi."})

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

@catalog_bp.route("/api/blacklist", methods=["GET"])
def api_get_blacklist():
    """Kara listedeki ürünleri döner."""
    blacklist = load_json(BLACKLIST_FILE, [])
    return jsonify({"status": "success", "blacklist": blacklist})

@catalog_bp.route("/api/blacklist/add", methods=["POST"])
def api_add_blacklist():
    """Ürünü kara listeye ekler."""
    data = request.json or {}
    barcode = clean_barcode(data.get("barcode"))
    title = clean_product_title(data.get("title") or "KARA LİSTE")
    reason = data.get("reason", "Kullanıcı Tarafından Engellendi")

    if not barcode and not title:
        return jsonify({"status": "error", "message": "Barkod veya başlık gereklidir."}), 400

    blacklist = load_json(BLACKLIST_FILE, [])
    if any(clean_barcode(b.get("barcode")) == barcode for b in blacklist if barcode):
        return jsonify({"status": "success", "message": "Ürün zaten kara listede."})

    blacklist.append({
        "barcode": barcode,
        "title": title,
        "reason": reason
    })
    save_json(BLACKLIST_FILE, blacklist)
    clear_diff_cache()

    return jsonify({"status": "success", "message": "Ürün kara listeye eklendi."})

@catalog_bp.route("/api/blacklist/batch-add", methods=["POST"])
def api_batch_add_blacklist():
    """Seçilen ürünleri topluca kara listeye ekler ve isteğe bağlı katalogdan kaldırır."""
    data = request.json or {}
    items = data.get("items", [])
    barcodes = data.get("barcodes", [])
    reason = data.get("reason", "Kullanıcı Tarafından Engellendi")
    delete_from_catalog = data.get("delete_from_catalog", True)

    blacklist = load_json(BLACKLIST_FILE, [])
    existing_bcs = {clean_barcode(b.get("barcode", "")) for b in blacklist if b.get("barcode")}
    
    products = load_json(PRODUCTS_FILE, [])
    prod_map = {clean_barcode(p.get("barcode", "")): p for p in products if p.get("barcode")}

    added_count = 0
    target_barcodes = set()

    if items:
        for it in items:
            bc = clean_barcode(it.get("barcode", ""))
            if bc and bc not in existing_bcs:
                blacklist.append({
                    "barcode": bc,
                    "title": clean_product_title(it.get("title") or "KARA LİSTE"),
                    "reason": reason
                })
                existing_bcs.add(bc)
                target_barcodes.add(bc)
                added_count += 1
    elif barcodes:
        for bc_raw in barcodes:
            bc = clean_barcode(bc_raw)
            if bc and bc not in existing_bcs:
                p_title = prod_map.get(bc, {}).get("title", "KARA LİSTE")
                blacklist.append({
                    "barcode": bc,
                    "title": clean_product_title(p_title),
                    "reason": reason
                })
                existing_bcs.add(bc)
                target_barcodes.add(bc)
                added_count += 1

    if added_count > 0:
        save_json(BLACKLIST_FILE, blacklist)

        if delete_from_catalog:
            products = [p for p in products if clean_barcode(p.get("barcode", "")) not in target_barcodes]
            save_json(PRODUCTS_FILE, products)

        create_products_backup(f"Toplu Kara Listeye Eklendi ({added_count} Ürün)")
        clear_diff_cache()

    return jsonify({
        "status": "success",
        "message": f"{added_count} ürün kara listeye eklendi.",
        "added_count": added_count
    })

@catalog_bp.route("/api/blacklist/remove", methods=["POST"])
def api_remove_blacklist():
    """Ürünü kara listeden çıkarır."""
    data = request.json or {}
    barcode = clean_barcode(data.get("barcode"))
    blacklist = load_json(BLACKLIST_FILE, [])
    new_bl = [b for b in blacklist if clean_barcode(b.get("barcode")) != barcode]

    save_json(BLACKLIST_FILE, new_bl)
    clear_diff_cache()

    return jsonify({"status": "success", "message": "Ürün kara listeden çıkarıldı."})

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

