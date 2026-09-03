# -*- coding: utf-8 -*-
"""
Etiket Şablonları Yönetim Servisi
"""
import uuid
import datetime
from backend.ayarlar import TEMPLATES_FILE
from backend.araclar.depolama_araclari import load_json, save_json

DEFAULT_FACTORY_TEMPLATE = {
    "id": "default",
    "name": "Varsayılan Standart Model",
    "is_locked": True,
    "description": "Görsel 2 standart fabrika raf etiketi. Kilitli fabrika başlangıç tasarımıdır.",
    "label_size": "size-76x40",
    "top_right_mode": "empty",
    "top_right_text": "",
    "price_font_size": 38,
    "title_font_size": 13,
    "show_barcode": True,
    "show_unit_price": True,
    "show_origin": True,
    "show_date": True,
    "custom_layers": []
}

def get_all_templates() -> list:
    """Tüm şablonları döner, yoksa varsayılanı oluşturur."""
    templates = load_json(TEMPLATES_FILE, [])
    if not templates:
        templates = [dict(DEFAULT_FACTORY_TEMPLATE)]
        save_json(TEMPLATES_FILE, templates)
    else:
        # Default modelin her zaman mevcut ve kilitli olduğunu garanti et
        has_default = any(t.get('id') == 'default' for t in templates)
        if not has_default:
            templates.insert(0, dict(DEFAULT_FACTORY_TEMPLATE))
            save_json(TEMPLATES_FILE, templates)
    return templates

def get_template_by_id(tpl_id: str) -> dict:
    """ID'ye göre şablon bulur."""
    templates = get_all_templates()
    for t in templates:
        if t.get('id') == tpl_id:
            return t
    return templates[0] if templates else dict(DEFAULT_FACTORY_TEMPLATE)

def save_or_update_template(tpl_data: dict) -> dict:
    """Şablon oluşturur veya günceller."""
    templates = get_all_templates()
    tpl_id = tpl_data.get('id')
    now_str = datetime.datetime.now().strftime("%d %b %Y %H:%M")

    # Kilitli varsayılan model düzenlenmeye çalışılırsa yeni bir kopya oluştur
    if tpl_id == 'default':
        tpl_id = str(uuid.uuid4())[:8]
        tpl_data['id'] = tpl_id
        tpl_data['is_locked'] = False
        tpl_data['name'] = f"{tpl_data.get('name', 'Model')} (Özel)"
        tpl_data['created_at'] = now_str
        tpl_data['updated_at'] = now_str
        templates.append(tpl_data)
        save_json(TEMPLATES_FILE, templates)
        return tpl_data

    if not tpl_id or tpl_id == 'new':
        tpl_id = str(uuid.uuid4())[:8]
        tpl_data['id'] = tpl_id
        tpl_data['is_locked'] = False
        tpl_data['created_at'] = now_str
        tpl_data['updated_at'] = now_str
        templates.append(tpl_data)
    else:
        found = False
        for i, t in enumerate(templates):
            if t.get('id') == tpl_id:
                tpl_data['updated_at'] = now_str
                tpl_data['is_locked'] = False
                templates[i] = tpl_data
                found = True
                break
        if not found:
            tpl_data['id'] = tpl_id
            tpl_data['is_locked'] = False
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
