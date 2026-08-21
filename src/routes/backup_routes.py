# -*- coding: utf-8 -*-
"""
Veritabanı Güvenli Yedekleme API Rotaları
"""
from flask import Blueprint, jsonify, request
from src.services.backup_service import (
    get_backups_list, create_products_backup, restore_products_backup, rollback_latest_backup, delete_products_backup, delete_all_products_backups
)
from src.services.excel_service import clear_diff_cache

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
