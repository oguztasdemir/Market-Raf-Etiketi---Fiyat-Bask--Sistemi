# -*- coding: utf-8 -*-
"""
Etiket Şablonları Yönetim Servisi
"""
import uuid
import datetime
from src.config import TEMPLATES_FILE
from src.utils.storage import load_json, save_json

DEFAULT_FACTORY_TEMPLATE = {
    "id": "default",
    "name": "Varsayılan Standart Model",
    "is_locked": True,
    "top_right_mode": "empty",
    "top_right_text": "",
    "elements": [
        {"id": "title1", "type": "text", "x": 10, "y": 8, "fontSize": 16, "fontWeight": "800", "content": "{{title1}}"},
        {"id": "title2", "type": "text", "x": 10, "y": 28, "fontSize": 14, "fontWeight": "700", "content": "{{title2}}"},
        {"id": "brand_box", "type": "box", "x": 10, "y": 48, "width": 120, "height": 22},
        {"id": "brand_text", "type": "text", "x": 14, "y": 52, "fontSize": 11, "fontWeight": "800", "content": "ÜRETİCİ: {{brand}}"},
        {"id": "origin_box", "type": "box", "x": 140, "y": 48, "width": 130, "height": 22},
        {"id": "origin_text", "type": "text", "x": 144, "y": 52, "fontSize": 11, "fontWeight": "800", "content": "ÜRETİM YERİ: {{origin}}"},
        {"id": "date_box", "type": "box", "x": 280, "y": 48, "width": 140, "height": 22},
        {"id": "date_text", "type": "text", "x": 284, "y": 52, "fontSize": 11, "fontWeight": "800", "content": "DEĞ. TARİHİ: {{date}}"},
        {"id": "unit_price", "type": "text", "x": 10, "y": 76, "fontSize": 10, "fontWeight": "700", "content": "{{unit_price}}"},
        {"id": "barcode", "type": "barcode", "x": 10, "y": 92, "width": 200, "height": 45, "content": "{{barcode}}"},
        {"id": "price", "type": "text", "x": 240, "y": 80, "fontSize": 44, "fontWeight": "900", "content": "{{price}}"}
    ]
}

def get_all_templates() -> list:
    """Tüm şablonları döner, yoksa varsayılanı oluşturur."""
    templates = load_json(TEMPLATES_FILE, [])
    if not templates:
        templates = [DEFAULT_FACTORY_TEMPLATE]
        save_json(TEMPLATES_FILE, templates)
    return templates

def get_template_by_id(tpl_id: str) -> dict:
    """ID'ye göre şablon bulur."""
    templates = get_all_templates()
    for t in templates:
        if t.get('id') == tpl_id:
            return t
    return templates[0] if templates else DEFAULT_FACTORY_TEMPLATE

def save_or_update_template(tpl_data: dict) -> dict:
    """Şablon oluşturur veya günceller."""
    templates = get_all_templates()
    tpl_id = tpl_data.get('id')
    now_str = datetime.datetime.now().strftime("%d %b %Y %H:%M")

    if not tpl_id or tpl_id == 'new':
        tpl_id = str(uuid.uuid4())[:8]
        tpl_data['id'] = tpl_id
        tpl_data['created_at'] = now_str
        tpl_data['updated_at'] = now_str
        templates.append(tpl_data)
    else:
        found = False
        for i, t in enumerate(templates):
            if t.get('id') == tpl_id:
                if t.get('is_locked') and tpl_id == 'default':
                    pass
                tpl_data['updated_at'] = now_str
                templates[i] = tpl_data
                found = True
                break
        if not found:
            tpl_data['id'] = tpl_id
            tpl_data['created_at'] = now_str
            tpl_data['updated_at'] = now_str
            templates.append(tpl_data)

    save_json(TEMPLATES_FILE, templates)
    return tpl_data

def delete_template(tpl_id: str) -> bool:
    """Şablonu siler (varsayılan kilitli şablon silinemez)."""
    if tpl_id == 'default':
        return False
    templates = get_all_templates()
    new_templates = [t for t in templates if t.get('id') != tpl_id]
    if len(new_templates) != len(templates):
        save_json(TEMPLATES_FILE, new_templates)
        return True
    return False
