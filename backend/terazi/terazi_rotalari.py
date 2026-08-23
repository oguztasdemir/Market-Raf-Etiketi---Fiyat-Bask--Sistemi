# -*- coding: utf-8 -*-
"""
Manav & Barkodlu Terazi API Rotaları
"""
import json
from flask import Blueprint, jsonify, request, Response
from backend.terazi.terazi_servisi import (
    get_scale_settings,
    save_scale_settings,
    get_manav_products,
    save_all_manav_products,
    test_scale_connection,
    send_plu_to_scale,
    send_all_plus_to_scale,
    stream_all_plus_to_scale,
    fetch_prices_from_scale,
    stream_fetch_prices_from_scale
)

scale_bp = Blueprint('scale_bp', __name__)

@scale_bp.route('/api/scale/fetch_prices', methods=['POST', 'GET'])
def fetch_prices_endpoint():
    """DIGI SM-100 terazisinden gerçek ürünleri ve fiyatları çeker."""
    res = fetch_prices_from_scale()
    return jsonify(res)

@scale_bp.route('/api/scale/fetch_prices_stream', methods=['GET', 'POST'])
def fetch_prices_stream_endpoint():
    """DIGI SM-100 terazisinden ürünleri çekerken canlı SSE akışı sağlar."""
    def event_stream():
        try:
            for event in stream_fetch_prices_from_scale():
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        except Exception as e:
            err_data = {"type": "error", "message": f"Akış hatası: {str(e)}"}
            yield f"data: {json.dumps(err_data, ensure_ascii=False)}\n\n"

    return Response(
        event_stream(),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
            'Connection': 'keep-alive'
        }
    )

@scale_bp.route('/api/scale/status', methods=['GET'])
def get_status():
    """Terazinin ağ ve bağlantı durumunu döner."""
    settings = get_scale_settings()
    test_res = test_scale_connection(settings.get('ip'), settings.get('port'))
    return jsonify({
        "status": "success",
        "settings": settings,
        "connection": test_res
    })

@scale_bp.route('/api/scale/test_connection', methods=['POST'])
def test_connection_endpoint():
    """Belirtilen veya kayıtlı IP/Port üzerinden bağlantı testi yapar."""
    data = request.get_json(silent=True) or {}
    ip = data.get('ip')
    port = data.get('port')
    res = test_scale_connection(ip, port)
    return jsonify({
        "status": "success" if res.get("online") else "warning",
        "result": res
    })

@scale_bp.route('/api/scale/settings', methods=['POST'])
def update_settings_endpoint():
    """Terazi ayarlarını kaydeder."""
    data = request.get_json(silent=True) or {}
    updated = save_scale_settings(data)
    return jsonify({
        "status": "success",
        "message": "Terazi ayarları kaydedildi.",
        "settings": updated
    })

@scale_bp.route('/api/scale/products', methods=['GET'])
def get_products():
    """Tüm manav ürünlerini PLU sırasına göre döner."""
    products = get_manav_products()
    diff_count = sum(1 for p in products if p.get('sync_status') == 'diff' or p.get('price') != p.get('scale_price'))
    return jsonify({
        "status": "success",
        "products": products,
        "total": len(products),
        "diff_count": diff_count
    })

@scale_bp.route('/api/scale/products', methods=['POST'])
def save_product():
    """Yeni manav ürünü ekler veya mevcut PLU'yu günceller."""
    data = request.get_json(silent=True) or {}
    plu = data.get('plu')
    title = data.get('title', '').strip().upper()
    price = data.get('price', '').strip()
    unit = data.get('unit', 'Kg').strip()
    origin = data.get('origin', 'TÜRKİYE').strip().upper()
    barcode = data.get('barcode', '').strip()
    try:
        kdv = int(data.get('kdv', 1))
    except Exception:
        kdv = 1

    if not plu or not title or not price:
        return jsonify({"status": "error", "message": "PLU Numarası, Ürün Adı ve Fiyat zorunludur."}), 400

    try:
        plu_int = int(plu)
    except:
        return jsonify({"status": "error", "message": "Geçersiz PLU numarası."}), 400

    if not barcode:
        barcode = f"27{plu_int:05d}"

    if not ("TL" in price or "₺" in price):
        price = f"{price} TL"

    products = get_manav_products()
    found = False
    for p in products:
        if int(p.get("plu", 0)) == plu_int:
            p["title"] = title
            p["price"] = price
            p["unit"] = unit
            p["origin"] = origin
            p["barcode"] = barcode
            p["kdv"] = kdv
            p["vat_rate"] = kdv
            if p.get("price") != p.get("scale_price"):
                p["sync_status"] = "diff"
            found = True
            break

    if not found:
        products.append({
            "plu": plu_int,
            "barcode": barcode,
            "title": title,
            "price": price,
            "unit": unit,
            "origin": origin,
            "kdv": kdv,
            "vat_rate": kdv,
            "scale_price": "-",
            "sync_status": "diff"
        })

    save_all_manav_products(products)
    return jsonify({
        "status": "success",
        "message": f"PLU {plu_int} ({title}) başarıyla kaydedildi.",
        "products": get_manav_products()
    })

@scale_bp.route('/api/scale/products/<int:plu>', methods=['DELETE'])
def delete_product(plu):
    """PLU ürününü listeden siler."""
    products = get_manav_products()
    new_list = [p for p in products if int(p.get("plu", 0)) != plu]
    if len(new_list) == len(products):
        return jsonify({"status": "error", "message": f"PLU {plu} bulunamadı."}), 404

    save_all_manav_products(new_list)
    return jsonify({
        "status": "success",
        "message": f"PLU {plu} başarıyla silindi.",
        "products": get_manav_products()
    })

@scale_bp.route('/api/scale/send_price/<int:plu>', methods=['POST'])
def send_single_price(plu):
    """Tek bir PLU ürününü teraziye aktarır."""
    products = get_manav_products()
    target_product = next((p for p in products if int(p.get("plu", 0)) == plu), None)
    if not target_product:
        return jsonify({"status": "error", "message": f"PLU {plu} bulunamadı."}), 404

    res = send_plu_to_scale(target_product)
    return jsonify(res)

@scale_bp.route('/api/scale/send_all', methods=['POST'])
def send_all():
    """Tüm manav ürünlerini teraziye aktarır."""
    res = send_all_plus_to_scale()
    return jsonify(res)

@scale_bp.route('/api/scale/send_all_stream', methods=['GET', 'POST'])
def send_all_stream_endpoint():
    """
    Tüm manav ürünlerini DIGI SM-100 terazisine aktarırken canlı SSE akışı sağlar.
    """
    def event_stream():
        try:
            for event in stream_all_plus_to_scale():
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        except Exception as e:
            err_data = {"type": "error", "message": f"Sunucu akış hatası: {str(e)}"}
            yield f"data: {json.dumps(err_data, ensure_ascii=False)}\n\n"

    return Response(
        event_stream(),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
            'Connection': 'keep-alive'
        }
    )
