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

@template_bp.route("/api/templates/create", methods=["POST"])
def api_create_template():
    """Yeni bir şablon modeli oluşturur."""
    data = request.json or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"status": "error", "message": "Model adı boş olamaz."}), 400
    
    new_tpl = {
        "name": name,
        "description": data.get("description", "Özel etiket modeli."),
        "label_size": data.get("label_size", "size-76x40"),
        "top_right_mode": data.get("top_right_mode", "empty"),
        "top_right_text": data.get("top_right_text", ""),
        "price_font_size": data.get("price_font_size", 38),
        "title_font_size": data.get("title_font_size", 13),
        "show_barcode": data.get("show_barcode", True),
        "show_unit_price": data.get("show_unit_price", True),
        "show_origin": data.get("show_origin", True),
        "show_date": data.get("show_date", True),
        "custom_layers": data.get("custom_layers", []),
        "is_locked": False
    }
    saved = save_or_update_template(new_tpl)
    return jsonify({"status": "success", "template": saved})

@template_bp.route("/api/templates/<tpl_id>/duplicate", methods=["POST"])
def api_duplicate_template(tpl_id):
    """Mevcut bir şablonu kopyalayarak yeni bir şablon oluşturur."""
    source_tpl = get_template_by_id(tpl_id)
    if not source_tpl:
        return jsonify({"status": "error", "message": "Kopyalanacak kaynak şablon bulunamadı."}), 404
    
    data = request.json or {}
    custom_name = (data.get("name") or "").strip()
    copy_name = custom_name if custom_name else f"{source_tpl.get('name', 'Model')} (Kopya)"
    
    dup_tpl = dict(source_tpl)
    dup_tpl["id"] = "new"
    dup_tpl["name"] = copy_name
    dup_tpl["is_locked"] = False
    dup_tpl["description"] = f"{source_tpl.get('name', 'Model')} modelinden kopyalandı."
    
    saved = save_or_update_template(dup_tpl)
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

