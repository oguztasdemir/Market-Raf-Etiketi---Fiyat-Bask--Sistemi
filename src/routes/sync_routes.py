# -*- coding: utf-8 -*-
"""
Excel/CSV Dosya Yükleme, Fark Analizi, Senkronizasyon ve Arşiv API Rotaları
"""
import os
import datetime
from flask import Blueprint, jsonify, request, send_file
from src.config import SISTEM_EXCELI_DIR, PRODUCTS_FILE
from src.utils.storage import load_json, save_json
from src.utils.text_cleaner import clean_barcode, clean_product_title, format_price_display, get_online_or_system_date
from src.services.backup_service import create_products_backup
from src.services.excel_service import (
    analyze_excel_diff, get_latest_excel_path, clear_diff_cache
)

sync_bp = Blueprint('sync_bp', __name__)

@sync_bp.route("/api/catalog/sync-status", methods=["GET"])
def api_catalog_sync_status():
    """En güncel sistem excel/csv dosyasının analiz durumunu döner."""
    force = request.args.get("force")
    if force:
        clear_diff_cache()
    latest_excel = get_latest_excel_path()
    if not latest_excel:
        return jsonify({
            "status": "empty",
            "message": "Henüz sistemde yüklü bir stok Excel/CSV dosyası bulunmuyor.",
            "stats": {"total_excel_rows": 0, "changed_count": 0, "new_count": 0, "matched_count": 0, "blacklisted_count": 0},
            "changed_prices": [],
            "new_products": [],
            "matched_products": [],
            "blacklisted_items": []
        })

    diff_result = analyze_excel_diff(latest_excel)
    return jsonify(diff_result)

@sync_bp.route("/api/catalog/upload-excel", methods=["POST"])
def api_catalog_upload_excel():
    """Yeni bir Excel/CSV stok dosyası yükler ve otomatik analiz eder."""
    if 'file' not in request.files:
        return jsonify({"status": "error", "message": "Dosya yüklenmedi."}), 400

    file = request.files['file']
    if not file or file.filename == '':
        return jsonify({"status": "error", "message": "Geçerli bir dosya seçilmedi."}), 400

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ['.xlsx', '.xls', '.csv']:
        return jsonify({"status": "error", "message": "Sadece .xlsx, .xls veya .csv dosyaları desteklenir."}), 400

    now_str = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    safe_filename = f"stok_{now_str}{ext}"
    target_path = os.path.join(SISTEM_EXCELI_DIR, safe_filename)

    try:
        file.save(target_path)
    except Exception as e:
        return jsonify({"status": "error", "message": f"Dosya kaydedilemedi: {str(e)}"}), 500

    clear_diff_cache()
    diff_result = analyze_excel_diff(target_path)
    return jsonify(diff_result)

@sync_bp.route("/api/catalog/apply-sync", methods=["POST"])
def api_catalog_apply_sync():
    """Seçilen fiyat değişikliklerini ve/veya yeni ürünleri products.json'a uygular."""
    req_data = request.json or {}
    action = req_data.get("action", "update_prices")
    items = req_data.get("items", [])

    if not items:
        return jsonify({"status": "error", "message": "Güncellenecek ürün listesi boş."}), 400

    products = load_json(PRODUCTS_FILE, [])
    prod_map = {clean_barcode(p.get('barcode', '')): p for p in products if p.get('barcode')}

    now_date = get_online_or_system_date()
    now_full = datetime.datetime.now()
    now_time_str = f"{now_date} {now_full.strftime('%H:%M')}"

    updated_count = 0
    added_count = 0

    for item in items:
        barcode = clean_barcode(item.get('barcode', ''))
        if not barcode:
            continue
        
        new_price = item.get('new_price') or item.get('excel_price')
        if not new_price:
            continue
        formatted_price = format_price_display(new_price)

        if barcode in prod_map:
            p = prod_map[barcode]
            if 'label_price' not in p or not p['label_price']:
                p['label_price'] = p.get('price', formatted_price)
            p['price'] = formatted_price
            p['date'] = now_date
            p['updated_at'] = now_time_str
            updated_count += 1
        else:
            raw_title = item.get('excel_title') or item.get('current_title') or "YENİ ÜRÜN"
            clean_title = clean_product_title(raw_title)
            new_prod = {
                "barcode": barcode,
                "title": clean_title,
                "title1": clean_title,
                "title2": "",
                "brand": item.get('brand') if (item.get('brand') and item.get('brand') not in ['DİĞER', 'DIGER']) else "YARENLER",
                "origin": "TÜRKİYE",
                "price": formatted_price,
                "label_price": "",
                "date": now_date,
                "updated_at": now_time_str
            }
            products.append(new_prod)
            prod_map[barcode] = new_prod
            added_count += 1

    backup_name = create_products_backup(reason=f"Fiyat Senkronizasyonu ({len(items)} Ürün)")
    save_json(PRODUCTS_FILE, products)
    clear_diff_cache()

    latest_excel = get_latest_excel_path()
    latest_sync_data = analyze_excel_diff(latest_excel) if latest_excel else None

    return jsonify({
        "status": "success",
        "message": f"Senkronizasyon tamamlandı: {updated_count} ürünün fiyatı güncellendi, {added_count} yeni ürün stoğa eklendi.",
        "updated_count": updated_count,
        "added_count": added_count,
        "backup_name": backup_name,
        "latest_sync_data": latest_sync_data
    })

@sync_bp.route("/api/catalog/excel-history", methods=["GET"])
def api_catalog_excel_history():
    """Geçmişte yüklenmiş tüm stok Excel/CSV dosyalarını özet istatistikleriyle döner."""
    if not os.path.exists(SISTEM_EXCELI_DIR):
        return jsonify({"status": "success", "history": []})

    files = [
        f for f in os.listdir(SISTEM_EXCELI_DIR)
        if f.lower().endswith(('.xlsx', '.xls', '.csv'))
    ]
    history = []
    latest_file = get_latest_excel_path()
    latest_basename = os.path.basename(latest_file) if latest_file else None

    for f in files:
        fpath = os.path.join(SISTEM_EXCELI_DIR, f)
        mtime = os.path.getmtime(fpath)
        dt_str = datetime.datetime.fromtimestamp(mtime).strftime("%d %b %Y %H:%M")
        size_kb = f"{os.path.getsize(fpath) / 1024:.1f} KB"
        
        diff_res = analyze_excel_diff(fpath)
        stats = diff_res.get('stats', {}) if diff_res.get('status') == 'success' else {}

        history.append({
            "filename": f,
            "date": dt_str,
            "size": size_kb,
            "timestamp": mtime,
            "is_latest": (f == latest_basename),
            "stats": stats
        })

    history.sort(key=lambda x: x['timestamp'], reverse=True)
    return jsonify({"status": "success", "history": history})

@sync_bp.route("/api/catalog/excel-delete", methods=["POST"])
def api_catalog_excel_delete():
    """Belirtilen Excel/CSV dosyasını sistemden siler."""
    req_data = request.json or {}
    filename = req_data.get("filename", "")
    if not filename:
        return jsonify({"status": "error", "message": "Dosya adı belirtilmedi."}), 400

    target_path = os.path.join(SISTEM_EXCELI_DIR, os.path.basename(filename))
    if not os.path.exists(target_path):
        return jsonify({"status": "error", "message": "Dosya bulunamadı."}), 404

    try:
        os.remove(target_path)
        clear_diff_cache()
        return jsonify({"status": "success", "message": f"'{filename}' başarıyla silindi."})
    except Exception as e:
        return jsonify({"status": "error", "message": f"Dosya silinemedi: {str(e)}"}), 500

@sync_bp.route("/api/catalog/excel-download/<path:filename>", methods=["GET"])
def api_catalog_excel_download(filename):
    """Arşivdeki Excel/CSV dosyasını kullanıcıya indirtir."""
    target_path = os.path.join(SISTEM_EXCELI_DIR, os.path.basename(filename))
    if not os.path.exists(target_path):
        return jsonify({"status": "error", "message": "Dosya bulunamadı."}), 404
    return send_file(target_path, as_attachment=True, download_name=filename)

@sync_bp.route("/api/catalog/excel-detail/<path:filename>", methods=["GET"])
def api_catalog_excel_detail(filename):
    """Arşivdeki Excel/CSV dosyasının detaylı fark analizini döner."""
    target_path = os.path.join(SISTEM_EXCELI_DIR, os.path.basename(filename))
    if not os.path.exists(target_path):
        return jsonify({"status": "error", "message": "Dosya bulunamadı."}), 404

    diff_result = analyze_excel_diff(target_path)
    return jsonify(diff_result)
