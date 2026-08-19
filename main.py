"""
Termal Market Raf Etiketi Yazıcı Sunucusu (Ana Başlatıcı)
"""
import os
import sys
import time
import socket
import webbrowser
import subprocess
from flask import Flask, jsonify, request, send_from_directory

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

# Flask uygulaması
app = Flask(
    __name__,
    template_folder=TEMPLATES_DIR,
    static_folder=STATIC_DIR,
    static_url_path="/static"
)

@app.after_request
def add_cors_headers(response):
    """CORS desteği: Herhangi bir tarayıcı kaynağından erişime izin verir."""
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response

@app.route("/api/print/send", methods=["OPTIONS"])
@app.route("/api/devices", methods=["OPTIONS"])
@app.route("/api/preview/zpl", methods=["OPTIONS"])
def handle_options():
    return "", 200

@app.route("/")
@app.route("/index.html")
def index():
    """Ana tasarım ve önizleme paneli."""
    return send_from_directory(TEMPLATES_DIR, "index.html")

@app.route("/api/devices", methods=["GET"])
def api_devices():
    """Bağlı USB donanımını ve yazıcı kuyruklarını listeler."""
    usb_devices = get_connected_usb_devices()
    printers = get_windows_printers()
    return jsonify({
        "status": "success",
        "usb_connected": len(usb_devices) > 0,
        "usb_devices": usb_devices,
        "printers": printers,
        "default_printer": printers[0] if printers else "Termal Etiket Yazici"
    })

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
    print(f"\n[BASKI TALEBİ] Yazıcı: {selected_printer} | Yön: {orientation} | Boyut: {width_mm}x{height_mm}mm | Adet: {copies}")
    print(f"-> Ürün: {u_title} - Fiyat: {u_price}")

    # ZPL kodunu üret (Görsel 2 Kalibrasyonu)
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
        print(f"[BAŞARILI] {len(zpl_command)} bayt iletildi. Etiket basıldı!")
        return jsonify({
            "status": "success",
            "message": f"'{selected_printer}' yazıcısına iletildi! Etiket basıldı.",
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

def run_server(host="127.0.0.1", port=5000):
    free_port(port)
    time.sleep(0.5)

    url = f"http://{host}:{port}"
    print("=" * 60)
    print("Market Raf Etiketi Yazıcı Sunucusu Başlatıldı!")
    print(f"Panel Adresi : {url}")
    print("=" * 60)

    try:
        webbrowser.open(url)
    except Exception:
        pass

    app.run(host=host, port=port, debug=False, use_reloader=False)

if __name__ == "__main__":
    run_server("127.0.0.1", 5000)
