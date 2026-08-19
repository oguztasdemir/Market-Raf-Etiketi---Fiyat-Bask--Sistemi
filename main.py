"""
Termal Market Raf Etiketi Yazıcı Sunucusu (Ana Başlatıcı)
Masaüstü Panel + Mobil Barkod Terminali + Şablon Tasarımcısı
"""
import os
import sys
import json
import time
import signal
import socket
import logging
import webbrowser
import subprocess
from flask import Flask, jsonify, request, send_from_directory, render_template

# Gereksiz GET/POST 200 HTTP loglarını sustur (Sadece Hatalar ve Özel Mesajlar)
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

# Modüler kaynakları içeri aktar
from src.zpl_generator import generate_market_shelf_zpl, clean_tr
from src.printer_service import (
    get_connected_usb_devices,
    get_windows_printers,
    print_raw_zpl
)

# Mutlak dizin yolları
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
STATIC_DIR = os.path.join(BASE_DIR, "static")
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

PRODUCTS_FILE = os.path.join(DATA_DIR, "products.json")
TEMPLATES_FILE = os.path.join(DATA_DIR, "templates.json")
SETTINGS_FILE = os.path.join(DATA_DIR, "settings.json")

# Flask uygulaması
app = Flask(
    __name__,
    template_folder=TEMPLATES_DIR,
    static_folder=STATIC_DIR,
    static_url_path="/static"
)

def get_local_ip():
    """Bilgisayarın yerel ağ IP adresini (192.168.x.x vb.) tespit eder."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

# --- JSON Yardımcıları ---
def load_json(filepath, default_data):
    if os.path.exists(filepath):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return default_data
    return default_data

def save_json(filepath, data):
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"[HATA] JSON kaydetme başarısız: {e}")
        return False

@app.after_request
def add_cors_headers(response):
    """CORS desteği: Mobil ve tarayıcı kaynaklarına tam izin verir."""
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS, DELETE"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response

@app.route("/api/print/send", methods=["OPTIONS"])
@app.route("/api/devices", methods=["OPTIONS"])
@app.route("/api/preview/zpl", methods=["OPTIONS"])
@app.route("/api/products", methods=["OPTIONS"])
@app.route("/api/templates", methods=["OPTIONS"])
@app.route("/api/settings", methods=["OPTIONS"])
def handle_options():
    return "", 200

# --- Web Sayfaları ---
@app.route("/")
@app.route("/index.html")
def index():
    """Ana Masaüstü Yönetim ve Tasarım Paneli."""
    return send_from_directory(TEMPLATES_DIR, "index.html")

@app.route("/mobile")
@app.route("/mobile.html")
def mobile():
    """Mobil Kamera Barkod Okuma ve Hızlı Yazdırma Terminali."""
    return send_from_directory(TEMPLATES_DIR, "mobile.html")

# --- API Endpointleri ---

@app.route("/api/network/ip", methods=["GET"])
def api_network_ip():
    """Mobil cihazların bağlanabilmesi için yerel ağ adresini döner."""
    ip = get_local_ip()
    port = 5000
    mobile_url = f"http://{ip}:{port}/mobile"
    return jsonify({
        "status": "success",
        "ip": ip,
        "port": port,
        "mobile_url": mobile_url
    })

@app.route("/api/current-date", methods=["GET"])
def api_current_date():
    """İnternetten güncel tarihi döner."""
    from src.zpl_generator import get_online_or_system_date
    current_d = get_online_or_system_date()
    return jsonify({"status": "success", "date": current_d})

@app.route("/api/devices", methods=["GET"])
def api_devices():
    """Bağlı USB donanımını ve yazıcı kuyruklarını listeler."""
    usb_devices = get_connected_usb_devices()
    printers = get_windows_printers()
    settings = load_json(SETTINGS_FILE, {})
    default_p = settings.get("printer") or (printers[0] if printers else "Termal Etiket Yazici")
    return jsonify({
        "status": "success",
        "usb_connected": len(usb_devices) > 0,
        "usb_devices": usb_devices,
        "printers": printers,
        "default_printer": default_p
    })

# --- Ürün & Stok API (Sade: Barkod, Ürün Adı, Fiyat) ---
@app.route("/api/products/search", methods=["GET"])
def api_products_search():
    """Barkod veya ürün adına göre stok araması yapar."""
    q = request.args.get("q", "").strip().lower()
    products = load_json(PRODUCTS_FILE, [])
    if not q:
        return jsonify({"status": "success", "products": products})
    
    matches = [
        p for p in products 
        if q in str(p.get("barcode", "")).lower() or 
           q in str(p.get("title", "")).lower() or
           q in str(p.get("title1", "")).lower()
    ]
    return jsonify({"status": "success", "products": matches})

@app.route("/api/products/<barcode>", methods=["GET"])
def api_product_get(barcode):
    """Barkod ile tek bir ürünün stok bilgisini getirir."""
    products = load_json(PRODUCTS_FILE, [])
    barcode = barcode.strip()
    for p in products:
        if str(p.get("barcode")) == barcode:
            return jsonify({"status": "success", "product": p})
    return jsonify({"status": "error", "message": "Ürün stokta bulunamadı."}), 404

@app.route("/api/products", methods=["POST"])
def api_product_save():
    """Yeni ürün ekler veya mevcut ürünü günceller (Barkod - Ürün Adı - Fiyat)."""
    data = request.json or {}
    barcode = str(data.get("barcode", "")).strip()
    title = str(data.get("title") or data.get("title1", "")).strip()
    price = str(data.get("price", "")).strip()

    if not barcode or not title:
        return jsonify({"status": "error", "message": "Barkod ve Ürün Adı zorunludur."}), 400
    
    new_item = {
        "barcode": barcode,
        "title": title,
        "price": price
    }

    products = load_json(PRODUCTS_FILE, [])
    found = False
    for i, p in enumerate(products):
        if str(p.get("barcode")) == barcode:
            products[i] = new_item
            found = True
            break
    if not found:
        products.append(new_item)
    
    save_json(PRODUCTS_FILE, products)
    print(f"[STOK GÜNCELLENDİ] Barkod: {barcode} | Ürün: {title} | Fiyat: {price}")
    return jsonify({"status": "success", "product": new_item, "message": "Ürün stoğa kaydedildi."})

# --- Şablon (Template) API ---
@app.route("/api/templates", methods=["GET"])
def api_templates_get():
    """Tüm etiket şablonlarını listeler."""
    templates = load_json(TEMPLATES_FILE, [])
    return jsonify({"status": "success", "templates": templates})

@app.route("/api/templates", methods=["POST"])
def api_template_save():
    """Yeni etiket modeli kaydeder veya günceller."""
    tpl = request.json or {}
    tpl_id = tpl.get("id") or f"tpl_{int(time.time())}"
    tpl["id"] = tpl_id
    
    templates = load_json(TEMPLATES_FILE, [])
    
    # Kilitli fabrika şablonunu koru
    if tpl_id == "default":
        tpl["is_locked"] = True
    else:
        tpl["is_locked"] = False
        
    found = False
    for i, t in enumerate(templates):
        if t.get("id") == tpl_id:
            templates[i] = tpl
            found = True
            break
    if not found:
        templates.append(tpl)
        
    save_json(TEMPLATES_FILE, templates)
    print(f"[ŞABLON KAYDEDİLDİ] Model Adı: {tpl.get('name')}")
    return jsonify({"status": "success", "template": tpl, "message": "Şablon kaydedildi."})

@app.route("/api/templates/<template_id>", methods=["DELETE"])
def api_template_delete(template_id):
    """Şablon siler (Fabrika başlangıç şablonu silinemez)."""
    if template_id == "default":
        return jsonify({"status": "error", "message": "Başlangıç fabrika şablonu silinemez!"}), 403
    
    templates = load_json(TEMPLATES_FILE, [])
    new_list = [t for t in templates if t.get("id") != template_id]
    save_json(TEMPLATES_FILE, new_list)
    print(f"[ŞABLON SİLİNDİ] ID: {template_id}")
    return jsonify({"status": "success", "message": "Şablon silindi."})

# --- Ayarlar API ---
@app.route("/api/settings", methods=["GET"])
def api_settings_get():
    """Sistem ayarlarını döner."""
    settings = load_json(SETTINGS_FILE, {})
    return jsonify({"status": "success", "settings": settings})

@app.route("/api/settings", methods=["POST"])
def api_settings_save():
    """Sistem ayarlarını günceller."""
    settings = request.json or {}
    save_json(SETTINGS_FILE, settings)
    print("[AYARLAR] Sistem ayarları başarıyla güncellendi.")
    return jsonify({"status": "success", "message": "Ayarlar kaydedildi."})

# --- Yazdırma & Önizleme API ---
@app.route("/api/preview/zpl", methods=["POST"])
def api_preview_zpl():
    """Önizleme ve hata ayıklama için ZPL kodunu döndürür."""
    payload = request.json or {}
    data = payload.get("data", {})
    orientation = payload.get("orientation", "POR")
    width_mm = float(payload.get("width_mm") or 76)
    height_mm = float(payload.get("height_mm") or 40)
    x_offset = int(payload.get("x_offset") or 0)
    y_offset = int(payload.get("y_offset") or 0)
    dpi = int(payload.get("dpi") or 203)

    zpl_command = generate_market_shelf_zpl(
        data,
        orientation=orientation,
        x_offset=x_offset,
        y_offset=y_offset,
        width_mm=width_mm,
        height_mm=height_mm,
        dpi=dpi
    )
    return jsonify({"status": "success", "zpl": zpl_command})

@app.route("/api/print/send", methods=["POST"])
def api_print_send():
    """Etiket verilerini alır, ZPL üretir ve doğrudan yazıcıya gönderir."""
    payload = request.json or {}
    data = payload.get("data", {})
    selected_printer = payload.get("printer") or "Termal Etiket Yazici"
    orientation = payload.get("orientation", "POR")
    width_mm = float(payload.get("width_mm") or 76)
    height_mm = float(payload.get("height_mm") or 40)
    x_offset = int(payload.get("x_offset") or 0)
    y_offset = int(payload.get("y_offset") or 0)
    dpi = int(payload.get("dpi") or 203)
    copies = int(payload.get("copies") or 1)

    u_title = clean_tr(data.get('title1', ''))
    u_price = clean_tr(data.get('price', ''))
    client_ip = request.remote_addr
    print(f"\n[BASKI TALEBİ] Yazıcı: {selected_printer} | Yön: {orientation} | Boyut: {width_mm}x{height_mm}mm | Adet: {copies} | Kaynak: {client_ip}")
    print(f"-> Ürün: {u_title} | Fiyat: {u_price}")

    # ZPL kodunu üret
    zpl_command = generate_market_shelf_zpl(
        data,
        orientation=orientation,
        x_offset=x_offset,
        y_offset=y_offset,
        width_mm=width_mm,
        height_mm=height_mm,
        dpi=dpi,
        copies=copies
    )

    # Yazıcıya gönder
    try:
        print_raw_zpl(selected_printer, zpl_command, doc_name="Market Raf Etiketi")
        print(f"[BAŞARILI] {len(zpl_command)} bayt yazıcıya iletildi. {copies} adet etiket basıldı!")
        return jsonify({
            "status": "success",
            "message": f"'{selected_printer}' yazıcısına iletildi! {copies} adet etiket basıldı.",
            "zpl": zpl_command
        })
    except Exception as e:
        print(f"[HATA] Yazdırma başarısız: {e}")
        return jsonify({
            "status": "error",
            "message": f"Yazdırma hatası: {str(e)}",
            "zpl": zpl_command
        }), 500

def free_port(port=5000):
    """Port 5000'de asılı kalan eski işlemleri temizler."""
    try:
        cmd = f'powershell -Command "Get-NetTCPConnection -LocalPort {port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object {{ if ($_ -ne $PID) {{ Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }} }}"'
        subprocess.run(cmd, shell=True, capture_output=True)
    except Exception:
        pass

def run_server(host="0.0.0.0", port=5000):
    free_port(port)
    time.sleep(0.5)

    # Ctrl+C ile kapanmayı engelle
    def ignore_sigint(sig, frame):
        pass
    signal.signal(signal.SIGINT, ignore_sigint)

    local_ip = get_local_ip()
    url = f"http://127.0.0.1:{port}"
    mobile_url = f"http://{local_ip}:{port}/mobile"

    print("=" * 65)
    print("[BASLATILDI] Market Raf Etiketi Paneli & Mobil Terminal")
    print(f"[*] Masaustu Panel : {url}")
    print(f"[*] Mobil Terminal  : {mobile_url}")
    print("=" * 65)

    try:
        webbrowser.open(url)
    except Exception:
        pass

    app.run(host=host, port=port, debug=False, use_reloader=False)

if __name__ == "__main__":
    run_server("0.0.0.0", 5000)
