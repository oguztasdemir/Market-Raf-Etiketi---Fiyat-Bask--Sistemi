# -*- coding: utf-8 -*-
"""
Etiket Modelleri ve Şablonlar API Rotaları
"""
from flask import Blueprint, jsonify, request
from backend.tasarim.tasarim_servisi import (
    get_all_templates, get_template_by_id, save_or_update_template, delete_template
)

template_bp = Blueprint('template_bp', __name__)

@template_bp.route("/api/templates", methods=["GET"])
def api_get_templates():
    """Tüm etiket şablonlarını döner."""
    templates = get_all_templates()
    return jsonify({"status": "success", "templates": templates})

@template_bp.route("/api/templates/<tpl_id>", methods=["GET"])
def api_get_template(tpl_id):
    """Tekil şablon detayını döner."""
    tpl = get_template_by_id(tpl_id)
    return jsonify({"status": "success", "template": tpl})

@template_bp.route("/api/templates", methods=["POST"])
def api_save_template():
    """Şablon kaydeder veya günceller."""
    data = request.json or {}
    saved = save_or_update_template(data)
    return jsonify({"status": "success", "template": saved})

@template_bp.route("/api/templates/<tpl_id>", methods=["DELETE"])
def api_delete_template(tpl_id):
    """Şablon siler."""
    if tpl_id == 'default':
        return jsonify({"status": "error", "message": "Varsayılan şablon silinemez."}), 400
    success = delete_template(tpl_id)
    if success:
        return jsonify({"status": "success", "message": "Şablon silindi."})
    return jsonify({"status": "error", "message": "Şablon bulunamadı."}), 404
