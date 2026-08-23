# -*- coding: utf-8 -*-
"""
Günlük & Aylık Rapor, Kasa Faaliyetleri ve Fiyat Geçmişi API Rotaları
"""
import datetime
from flask import Blueprint, jsonify, request
from backend.raporlama.raporlama_servisi import (
    get_monthly_calendar_report,
    get_detailed_day_report,
    log_price_change,
    log_printed_batch
)

report_bp = Blueprint('report_bp', __name__)

@report_bp.route("/api/reports/calendar", methods=["GET"])
def api_get_monthly_calendar():
    """Belirtilen yıl ve ay için takvim günleri ve aylık istatistikleri döner."""
    year = request.args.get("year", type=int)
    month = request.args.get("month", type=int)
    res = get_monthly_calendar_report(year, month)
    return jsonify(res)

@report_bp.route("/api/reports/day_detail", methods=["GET"])
def api_get_day_detail():
    """Belirli bir günün tüm kasa satışlarını, fişlerini ve aktivitelerini döner."""
    date_str = request.args.get("date")
    res = get_detailed_day_report(date_str)
    return jsonify(res)

@report_bp.route("/api/reports/daily", methods=["GET"])
def api_get_daily_reports_summary():
    """Mevcut günün özetini döner."""
    today = datetime.datetime.now().strftime("%Y-%m-%d")
    res = get_detailed_day_report(today)
    return jsonify({"status": "success", "report": res})

@report_bp.route("/api/reports/daily/<string:day_key>", methods=["GET"])
def api_get_daily_report_detail(day_key):
    """Belirli bir günün detaylarını döner."""
    res = get_detailed_day_report(day_key)
    return jsonify({"status": "success", "detail": res})

@report_bp.route("/api/reports/log-event", methods=["POST"])
def api_log_manual_report_event():
    """İstemciden gelen log olaylarını kaydeder."""
    req_data = request.get_json(silent=True) or {}
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
