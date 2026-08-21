# -*- coding: utf-8 -*-
"""
Günlük Rapor ve Faaliyet Geçmişi API Rotaları
"""
from flask import Blueprint, jsonify, request
from src.services.report_service import (
    get_all_daily_reports_summary,
    get_daily_report_detail,
    log_price_change,
    log_printed_batch
)

report_bp = Blueprint('report_bp', __name__)

@report_bp.route("/api/reports/daily", methods=["GET"])
def api_get_daily_reports_summary():
    """Tüm günlerin özet metrik listesini döner."""
    summaries = get_all_daily_reports_summary()
    return jsonify({
        "status": "success",
        "reports": summaries
    })

@report_bp.route("/api/reports/daily/<string:day_key>", methods=["GET"])
def api_get_daily_report_detail(day_key):
    """Belirli bir günün detaylı fiyat değişim ve basım kayıtlarını döner."""
    detail = get_daily_report_detail(day_key)
    if not detail:
        return jsonify({
            "status": "error",
            "message": "Belirtilen güne ait rapor bulunamadı."
        }), 404

    return jsonify({
        "status": "success",
        "detail": detail
    })

@report_bp.route("/api/reports/log-event", methods=["POST"])
def api_log_manual_report_event():
    """İstemciden (Mobil/PC) gelen anlık log olaylarını kaydeder."""
    req_data = request.json or {}
    event_type = req_data.get("type", "")
    source = req_data.get("source", "PC")

    if event_type == "price_change":
        log_price_change(
            barcode=req_data.get("barcode", ""),
            title=req_data.get("title", ""),
            old_price=req_data.get("old_price", ""),
            new_price=req_data.get("new_price", ""),
            source=source
        )
    elif event_type == "printed_batch":
        log_printed_batch(
            items=req_data.get("items", []),
            source=source
        )

    return jsonify({"status": "success"})
