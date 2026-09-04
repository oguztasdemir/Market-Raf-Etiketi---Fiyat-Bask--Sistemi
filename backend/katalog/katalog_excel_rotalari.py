# -*- coding: utf-8 -*-
"""
Katalog Excel Yükleme, Fark Analizi ve Senkronizasyon Rotaları
"""
import os, datetime
from flask import Blueprint, jsonify, request, send_file
from werkzeug.utils import secure_filename
from backend.ayarlar import SISTEM_EXCELI_DIR, PRODUCTS_FILE
from backend.araclar.depolama_araclari import load_json, save_json
from backend.katalog.excel_katalog_servisi import analyze_excel_diff, get_latest_excel_path, clear_diff_cache
from backend.yedekleme.yedekleme_servisi import create_products_backup
from backend.raporlama.raporlama_servisi import log_price_change

excel_catalog_bp = Blueprint('excel_catalog_bp', __name__)


# =========================================================
# KATALOG GÜNCELLEME & EXCEL / CSV SENKRONİZASYON ROTALARI
# =========================================================

@excel_catalog_bp.route("/api/catalog/sync-status", methods=["GET"])
def api_catalog_sync_status():
    """En son yüklenen Excel/CSV stok dosyasının fark analizini döner."""
    latest_file = get_latest_excel_path()
    if not latest_file:
        return jsonify({"status": "no_file", "message": "Henüz yüklenmiş Excel/CSV dosyası bulunmuyor."})

    res = analyze_excel_diff(latest_file)
    return jsonify(res)


@excel_catalog_bp.route("/api/catalog/apply-sync", methods=["POST"])
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


@excel_catalog_bp.route("/api/catalog/upload-excel", methods=["POST"])
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


@excel_catalog_bp.route("/api/catalog/excel-history", methods=["GET"])
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


@excel_catalog_bp.route("/api/catalog/excel-detail/<path:filename>", methods=["GET"])
def api_catalog_excel_detail(filename):
    """Arşivdeki belirli bir Excel dosyasının detaylı fark analizini döner."""
    safe_name = os.path.basename(filename)
    fpath = os.path.join(SISTEM_EXCELI_DIR, safe_name)
    if not os.path.exists(fpath):
        return jsonify({"status": "error", "message": "Dosya bulunamadı."}), 404

    res = analyze_excel_diff(fpath)
    return jsonify(res)


@excel_catalog_bp.route("/api/catalog/excel-download/<path:filename>", methods=["GET"])
def api_catalog_excel_download(filename):
    """Arşivdeki Excel dosyasını indirmek üzere sunar."""
    safe_name = os.path.basename(filename)
    fpath = os.path.join(SISTEM_EXCELI_DIR, safe_name)
    if not os.path.exists(fpath):
        return jsonify({"status": "error", "message": "Dosya bulunamadı."}), 404

    return send_file(fpath, as_attachment=True, download_name=safe_name)


@excel_catalog_bp.route("/api/catalog/excel-delete", methods=["POST"])
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

