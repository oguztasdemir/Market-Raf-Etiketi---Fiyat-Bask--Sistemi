# -*- coding: utf-8 -*-
"""
Manav & Barkodlu Terazi API Rotaları
"""
import json
from flask import Blueprint, jsonify, request, Response
from backend.terazi.terazi_servisi import (
    get_scale_settings,
    save_scale_settings,
    get_scales_pool,
    save_scales_pool,
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

@scale_bp.route('/api/scale/scales_pool', methods=['GET', 'POST'])
def scales_pool_endpoint():
    """Çoklu terazi havuzunu listeler veya günceller."""
    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        pool = data.get('scales_list', [])
        saved = save_scales_pool(pool)
        return jsonify({"status": "success", "message": "Terazi havuzu güncellendi.", "scales_list": saved})
    return jsonify({"status": "success", "scales_list": get_scales_pool()})

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
    """Tüm manav ürünlerini (1-400 arası Tartılı PLU slotları + Adet/Demet barkodlu ürünler) döner."""
    import json
    db_products = get_manav_products()
    products_map = {}
    adet_products = []

    for p in db_products:
        unit_val = (p.get("unit") or "").lower()
        is_adet = unit_val in ('adet', 'demet', 'paket', 'pk')
        if is_adet:
            adet_products.append(p)
        else:
            try:
                plu_val = int(p.get("plu", 0))
                if plu_val > 0:
                    products_map[plu_val] = p
            except:
                pass
            
    all_slots = []
    # 1. 1-400 arası Tartılı (Kg) PLU slotları
    for plu in range(1, 401):
        if plu in products_map:
            all_slots.append(products_map[plu])
        else:
            empty_item = {
                "plu": plu,
                "barcode": "",
                "title": "",
                "name": "",
                "price": "",
                "scale_price": "",
                "unit": "Kg",
                "origin": "TÜRKİYE",
                "sync_status": "synced",
                "raw_json": json.dumps({
                    "plu": plu,
                    "barcode": "",
                    "title": "",
                    "name": "",
                    "price": "",
                    "scale_price": "",
                    "unit": "Kg",
                    "origin": "TÜRKİYE",
                    "sync_status": "synced"
                }, ensure_ascii=False)
            }
            all_slots.append(empty_item)

    # 2. Adet / Demet ürünleri (PLU'suz, barkodlu ürünler)
    for a_p in adet_products:
        all_slots.append(a_p)
            
    diff_count = sum(1 for p in db_products if p.get('unit', 'Kg').lower() not in ('adet', 'demet', 'paket', 'pk') and (p.get('sync_status') == 'diff' or p.get('price') != p.get('scale_price')))
    return jsonify({
        "status": "success",
        "products": all_slots,
        "total": len(all_slots),
        "diff_count": diff_count
    })

@scale_bp.route('/api/scale/products', methods=['POST'])
def save_product():
    """Yeni manav ürünü ekler veya mevcut PLU/Barkod'u günceller."""
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

    is_adet = unit.lower() in ('adet', 'demet', 'paket', 'pk')

    if not title or not price:
        return jsonify({"status": "error", "message": "Ürün Adı ve Fiyat zorunludur."}), 400

    plu_int = None
    if plu is not None and str(plu).strip() != "":
        try:
            plu_int = int(plu)
        except:
            if not is_adet:
                return jsonify({"status": "error", "message": "Geçersiz PLU numarası."}), 400

    if not is_adet and (plu_int is None or plu_int <= 0):
        return jsonify({"status": "error", "message": "Tartılı (Kg) ürünler için geçerli bir PLU Numarası zorunludur."}), 400

    if not barcode:
        if is_adet:
            # Adet ürünü için otomatik EAN-13 veya 270 serisi üret
            products = get_manav_products()
            used_bc = {p.get("barcode") for p in products if p.get("barcode")}
            for seq in range(1001, 9999):
                cand_bc = f"270{seq:04d}"
                if cand_bc not in used_bc:
                    barcode = cand_bc
                    break
        elif plu_int:
            barcode = f"27{plu_int:05d}"

    if not ("TL" in price or "₺" in price):
        price = f"{price} TL"

    products = get_manav_products()
    found = False
    for p in products:
        # Eşleşme kriteri: Adet ürünlerinde barkod veya PLU, Tartılıda PLU veya Barkod
        matched = False
        if is_adet and barcode and p.get("barcode") == barcode:
            matched = True
        elif plu_int and p.get("plu") and int(p.get("plu", 0)) == plu_int:
            matched = True
        elif barcode and p.get("barcode") == barcode:
            matched = True

        if matched:
            p["title"] = title
            p["price"] = price
            p["unit"] = unit
            p["origin"] = origin
            p["barcode"] = barcode
            p["kdv"] = kdv
            p["vat_rate"] = kdv
            if plu_int and not is_adet:
                p["plu"] = plu_int
            elif is_adet:
                p["plu"] = None
                p["scale_price"] = "-"
                p["sync_status"] = "synced"
            if not is_adet and p.get("price") != p.get("scale_price"):
                p["sync_status"] = "diff"
            found = True
            break

    if not found:
        products.append({
            "plu": None if is_adet else plu_int,
            "barcode": barcode,
            "title": title,
            "price": price,
            "unit": unit,
            "origin": origin,
            "kdv": kdv,
            "vat_rate": kdv,
            "scale_price": "-",
            "sync_status": "synced" if is_adet else "diff"
        })

    save_all_manav_products(products)
    return jsonify({
        "status": "success",
        "message": f"'{title}' başarıyla kaydedildi.",
        "products": get_manav_products()
    })

@scale_bp.route('/api/scale/products/<plu_or_barcode>', methods=['DELETE'])
def delete_product(plu_or_barcode):
    """PLU veya Barkod ile ürünü listeden siler."""
    products = get_manav_products()
    new_list = []
    for p in products:
        p_plu = str(p.get("plu", ""))
        p_bc = str(p.get("barcode", ""))
        if p_plu == str(plu_or_barcode) or p_bc == str(plu_or_barcode):
            continue
        new_list.append(p)

    if len(new_list) == len(products):
        return jsonify({"status": "error", "message": f"Ürün ({plu_or_barcode}) bulunamadı."}), 404

    save_all_manav_products(new_list)
    return jsonify({
        "status": "success",
        "message": f"Ürün ({plu_or_barcode}) başarıyla silindi.",
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
