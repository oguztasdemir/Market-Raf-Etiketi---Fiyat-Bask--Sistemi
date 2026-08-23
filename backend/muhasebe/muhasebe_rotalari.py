# -*- coding: utf-8 -*-
"""
Market Gelir / Gider & Muhasebe API Rotaları
"""
from flask import Blueprint, jsonify, request
from backend.muhasebe.muhasebe_servisi import (
    get_accounting_overview,
    add_new_expense,
    delete_expense_by_id
)

accounting_bp = Blueprint('accounting_bp', __name__)

@accounting_bp.route("/api/accounting/overview", methods=["GET"])
def api_accounting_overview():
    """Aylık satış geliri, giderler, dükkan kirası, personel maaşları ve net kâr dökümünü döner."""
    year = request.args.get("year", type=int)
    month = request.args.get("month", type=int)
    res = get_accounting_overview(year, month)
    return jsonify(res)

@accounting_bp.route("/api/accounting/expenses", methods=["POST"])
def api_add_expense():
    """Yeni gider ekler."""
    data = request.json or {}
    res = add_new_expense(data)
    return jsonify(res)

@accounting_bp.route("/api/accounting/expenses/delete", methods=["POST"])
def api_delete_expense():
    """Gider siler."""
    data = request.json or {}
    exp_id = data.get("id")
    res = delete_expense_by_id(exp_id)
    return jsonify(res)
