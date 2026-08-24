# -*- coding: utf-8 -*-
"""
Veritabanı Güvenli Yedekleme API Rotaları
"""
from flask import Blueprint, jsonify, request
from backend.yedekleme.yedekleme_servisi import (
    get_backups_list, create_products_backup, restore_products_backup, rollback_latest_backup, delete_products_backup, delete_all_products_backups
)
from backend.katalog.excel_katalog_servisi import clear_diff_cache

backup_bp = Blueprint('backup_bp', __name__)

@backup_bp.route("/api/backup/list", methods=["GET"])
def api_get_backups():
    """Tüm veritabanı yedeklerinin listesini döner."""
    backups = get_backups_list()
    return jsonify({"status": "success", "backups": backups})

@backup_bp.route("/api/backup/create", methods=["POST"])
def api_create_backup():
    """Manuel kullanıcı yedeği alır."""
    req_data = request.json or {}
    reason = req_data.get("reason", "Manuel Kullanıcı Yedeği")
    fname = create_products_backup(reason=reason)
    if fname:
        return jsonify({"status": "success", "message": f"'{fname}' yedeği başarıyla oluşturuldu.", "filename": fname})
    return jsonify({"status": "error", "message": "Yedek oluşturulamadı."}), 500

@backup_bp.route("/api/backup/restore", methods=["POST"])
def api_restore_backup():
    """Belirtilen yedek dosyasını geri yükler."""
    req_data = request.json or {}
    filename = req_data.get("filename")
    if not filename:
        return jsonify({"status": "error", "message": "Yedek dosyası adı belirtilmedi."}), 400

    success, msg = restore_products_backup(filename)
    if success:
        clear_diff_cache()
        return jsonify({"status": "success", "message": msg})
    return jsonify({"status": "error", "message": msg}), 500

@backup_bp.route("/api/backup/rollback-latest", methods=["POST"])
def api_rollback_latest():
    """Son otomatik güvenlik yedeğine geri döner."""
    success, msg = rollback_latest_backup()
    if success:
        clear_diff_cache()
        return jsonify({"status": "success", "message": msg})
    return jsonify({"status": "error", "message": msg}), 500

@backup_bp.route("/api/backup/delete", methods=["POST"])
def api_delete_backup():
    """Belirtilen yedek dosyasını siler."""
    req_data = request.json or {}
    filename = req_data.get("filename")
    if not filename:
        return jsonify({"status": "error", "message": "Yedek dosyası adı belirtilmedi."}), 400

    success, msg = delete_products_backup(filename)
    if success:
        return jsonify({"status": "success", "message": msg})
    return jsonify({"status": "error", "message": msg}), 404 if "bulunamadı" in msg else 500

@backup_bp.route("/api/backup/delete-all", methods=["POST"])
def api_delete_all_backups():
    """Tüm yedek dosyalarını siler."""
    success, msg, count = delete_all_products_backups()
    return jsonify({"status": "success", "message": msg, "count": count})


@backup_bp.route("/api/backup/auto_daily", methods=["POST"])
def api_auto_daily_backup():
    """Tüm veri klasörünü tarih damgalı güvenli günlük ZIP yedeği olarak arşivler."""
    import zipfile
    import os
    import datetime
    from backend.ayarlar import DATA_DIR

    backup_dir = os.path.join(DATA_DIR, "yedekler", "sistem")
    os.makedirs(backup_dir, exist_ok=True)

    today_str = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    zip_filename = f"gunluk_tam_yedek_{today_str}.zip"
    zip_filepath = os.path.join(backup_dir, zip_filename)

    try:
        with zipfile.ZipFile(zip_filepath, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(DATA_DIR):
                # Yedekler klasörünü tekrar içine yedekleme
                if "yedekler" in root:
                    continue
                for file in files:
                    full_p = os.path.join(root, file)
                    rel_p = os.path.relpath(full_p, DATA_DIR)
                    zipf.write(full_p, rel_p)

        file_size_kb = round(os.path.getsize(zip_filepath) / 1024, 1)

        # 30 günden eski otomatik yedekleri rotasyon ile temizle (En az son 10 yedek korunur)
        try:
            all_zips = [os.path.join(backup_dir, f) for f in os.listdir(backup_dir) if f.startswith("gunluk_tam_yedek_") and f.endswith(".zip")]
            all_zips.sort(key=os.path.getmtime, reverse=True)
            if len(all_zips) > 10:
                for old_zip in all_zips[30:]:
                    try:
                        os.remove(old_zip)
                    except Exception:
                        pass
        except Exception:
            pass

        return jsonify({
            "status": "success",
            "message": f"Günlük sistem arşivi '{zip_filename}' ({file_size_kb} KB) oluşturuldu.",
            "filename": zip_filename,
            "size_kb": file_size_kb
        })
    except Exception as e:
        return jsonify({"status": "error", "message": f"Otomatik yedekleme hatası: {str(e)}"}), 500

