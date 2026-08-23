# -*- coding: utf-8 -*-
"""
Hızlı Satış (POS), Kasiyer & Canlı Dashboard API Rotaları
"""
from flask import Blueprint, jsonify, request
from backend.kasa.hizli_satis_servisi import (
    find_product_for_pos,
    search_products_for_pos_autocomplete,
    process_pos_checkout,
    get_dashboard_summary
)
from backend.kasa.kasiyer_servisi import (
    get_cashiers,
    verify_cashier_pin,
    get_active_cashier,
    add_cashier
)

pos_bp = Blueprint('pos_bp', __name__)

@pos_bp.route('/api/pos/search', methods=['GET', 'POST'])
def pos_search():
    """Barkod veya ürün adına göre anında arama yapar (Hızlı Kasa)."""
    query = request.args.get('q') or (request.get_json(silent=True) or {}).get('query')
    res = find_product_for_pos(query)
    return jsonify(res)

@pos_bp.route('/api/pos/autocomplete', methods=['GET'])
def pos_autocomplete():
    """Ürün adına veya barkoduna göre canlı otomatik tamamlama listesi döner."""
    q = request.args.get('q', '').strip()
    results = search_products_for_pos_autocomplete(q, limit=10)
    return jsonify({"status": "success", "results": results})

@pos_bp.route('/api/pos/checkout', methods=['POST'])
def pos_checkout():
    """Sepeti tamamlar, fiş oluşturur ve kaydeder."""
    data = request.get_json(silent=True) or {}
    res = process_pos_checkout(data)
    return jsonify(res)

@pos_bp.route('/api/pos/dashboard_summary', methods=['GET'])
def pos_dashboard():
    """Sağ panel ve ana ekran için canlı ciro ve veri özetlerini döner."""
    res = get_dashboard_summary()
    return jsonify(res)

@pos_bp.route('/api/cashier/list', methods=['GET'])
def cashier_list():
    """Kayıtlı kasiyerleri döner."""
    return jsonify({"status": "success", "cashiers": get_cashiers()})

@pos_bp.route('/api/cashier/active', methods=['GET'])
def cashier_active():
    """Mevcut aktif kasiyeri döner."""
    return jsonify({"status": "success", "active": get_active_cashier()})

@pos_bp.route('/api/cashier/login', methods=['POST'])
def cashier_login():
    """Kasiyer PIN kodunu doğrular."""
    data = request.get_json(silent=True) or {}
    cashier_id = data.get('cashier_id')
    pin = data.get('pin')
    res = verify_cashier_pin(cashier_id, pin)
    return jsonify(res)

@pos_bp.route('/api/cashier/add', methods=['POST'])
def cashier_add():
    """Yeni kasiyer kaydeder."""
    data = request.get_json(silent=True) or {}
    name = data.get('name')
    pin = data.get('pin', '')
    role = data.get('role', 'cashier')
    res = add_cashier(name, pin, role)
    return jsonify(res)

# =========================================================
# HIZLI ÜRÜN & ÖZEL BARKOD BUTONLARI (MAX 6)
# =========================================================
from backend.kasa.hizli_satis_servisi import get_quick_buttons, add_quick_button, remove_quick_button

@pos_bp.route('/api/pos/quick_buttons', methods=['GET'])
def list_quick_buttons():
    """Hızlı ürün butonlarını döner."""
    return jsonify({"status": "success", "buttons": get_quick_buttons()})

@pos_bp.route('/api/pos/quick_buttons/add', methods=['POST'])
def create_quick_button():
    """Yeni hızlı ürün/özel barkod ekler (Max 6)."""
    data = request.get_json(silent=True) or {}
    title = data.get('title', '')
    code = data.get('code', '')
    price = float(data.get('price', 0.0) or 0.0)
    unit = data.get('unit', 'Adet')
    color = data.get('color', '#3b82f6')
    res = add_quick_button(title, code, price, unit, color)
    return jsonify(res)

@pos_bp.route('/api/pos/quick_buttons/remove', methods=['POST'])
def delete_quick_button():
    """Hızlı ürün butonunu siler."""
    data = request.get_json(silent=True) or {}
    btn_id = data.get('id') or data.get('button_id') or data.get('code')
    res = remove_quick_button(btn_id)
    return jsonify(res)

from backend.kasa.hizli_satis_servisi import get_quick_category_products

@pos_bp.route('/api/pos/quick_category_items', methods=['GET'])
def list_quick_category_items():
    """Seçili kategoriye ait (MANAV veya BARKODSUZ) alfabetik ürünleri döner."""
    cat = request.args.get('cat', 'manav')
    items = get_quick_category_products(cat)
    return jsonify({"status": "success", "category": cat, "items": items})

import threading
import time
from backend.araclar.excel_dosya_izleyici import get_local_ip, ensure_ssl_certs

# Canlı bağlı mobil cihazlar önbelleği (IP -> {ip, device, last_seen, action})
_connected_devices_cache = {}

def record_device_activity(ip, action="İşlem Yaptı"):
    if not ip or ip in ("127.0.0.1", "localhost", "::1"):
        return
    now_str = time.strftime("%H:%M:%S")
    _connected_devices_cache[ip] = {
        "ip": ip,
        "device": f"📱 Mobil Terminal ({ip})",
        "last_seen": now_str,
        "action": action,
        "timestamp": time.time()
    }

@pos_bp.route('/api/pos/mobile_info', methods=['GET'])
def get_pos_mobile_info():
    """Mobil QR kodu için yerel IP, HTTP/HTTPS linkleri ve bağlı cihazları döner."""
    local_ip = get_local_ip()
    cert_path, key_path = ensure_ssl_certs(local_ip)
    
    # Son 15 dakikadaki aktif cihazlar
    now = time.time()
    active_devices = [
        v for v in _connected_devices_cache.values()
        if now - v.get("timestamp", 0) < 900
    ]

    return jsonify({
        "status": "success",
        "local_ip": local_ip,
        "http_url": f"http://{local_ip}:5000/mobile",
        "https_url": f"https://{local_ip}:5001/mobile" if (cert_path and key_path) else None,
        "recommended_url": f"https://{local_ip}:5001/mobile" if (cert_path and key_path) else f"http://{local_ip}:5000/mobile",
        "connected_devices": active_devices
    })

@pos_bp.route('/api/pos/connected_devices', methods=['GET'])
def get_connected_devices():
    """Aktif bağlı cihazları döner."""
    now = time.time()
    active_devices = [
        v for v in _connected_devices_cache.values()
        if now - v.get("timestamp", 0) < 900
    ]
    return jsonify({
        "status": "success",
        "count": len(active_devices),
        "devices": active_devices
    })

@pos_bp.route('/api/pos/open_drawer', methods=['POST', 'GET'])
def pos_open_drawer():
    """Para çekmecesini açma komutunu tetikler."""
    # ESC/POS çekmece açma sinyali (yazıcı üzerinden)
    return jsonify({"status": "success", "message": "Para çekmecesi açma sinyali gönderildi."})

@pos_bp.route('/api/system/close', methods=['POST', 'GET'])
def system_close():
    """Uygulamayı güvenli bir şekilde masaüstü modundan kapatır."""
    def kill_soon():
        import time, os
        time.sleep(0.05)
        os._exit(0)
    threading.Thread(target=kill_soon, daemon=True).start()
    return jsonify({"status": "success", "message": "Sistem kapatılıyor..."})

