# -*- coding: utf-8 -*-
"""
Market Raf Etiketi & Fiyat Baskı Sistemi - Ana Sunucu Başlatıcı
"""
# Sunucu otomatik güncelleme tetiklendi
import os
import sys
import time
import signal
import webbrowser
import threading
import logging
from flask import Flask, render_template, send_from_directory, request

# src paket yolunu ekle
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.config import BASE_DIR, STATIC_DIR, TEMPLATES_DIR
from src.utils.watcher import get_local_ip, ensure_ssl_certs, free_port, start_code_watcher
from src.services.excel_service import clear_diff_cache

# Blueprint Rotaları
from src.routes.catalog_routes import catalog_bp
from src.routes.sync_routes import sync_bp
from src.routes.backup_routes import backup_bp
from src.routes.template_routes import template_bp
from src.routes.print_routes import print_bp
from src.routes.report_routes import report_bp
from src.routes.scale_routes import scale_bp

# Werkzeug'in ham HTTP erişim loglarını (GET /api/... 200) sustur
logging.getLogger('werkzeug').setLevel(logging.ERROR)

app = Flask(__name__, static_folder=STATIC_DIR, template_folder=TEMPLATES_DIR)
app.config['MAX_CONTENT_LENGTH'] = 64 * 1024 * 1024  # 64 MB dosya yükleme limiti
app.config['TEMPLATES_AUTO_RELOAD'] = True
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
app.jinja_env.auto_reload = True

# Blueprint'leri kaydet
app.register_blueprint(catalog_bp)
app.register_blueprint(sync_bp)
app.register_blueprint(backup_bp)
app.register_blueprint(template_bp)
app.register_blueprint(print_bp)
app.register_blueprint(report_bp)
app.register_blueprint(scale_bp)

def get_device_label(ip: str) -> str:
    """İstemci IP adresini anlaşılır cihaz ismine dönüştürür."""
    if not ip or ip in ("127.0.0.1", "localhost", "::1", "192.168.1.34"):
        return "💻 [Bu Laptop]"
    elif ip == "192.168.1.33":
        return "🖥️ [Ana Bilgisayar]"
    elif ip == "192.168.1.61":
        return "⚖️ [DIGI Terazi]"
    else:
        return f"📱 [Cihaz: {ip}]"

@app.context_processor
def inject_cache_bust():
    return dict(cache_bust=int(time.time()))

@app.after_request
def log_user_action_and_headers(response):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0, post-check=0, pre-check=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"

    # Gereksiz/sürekli tekrarlayan arka plan sorgularını terminale basma (spam engelleme)
    path = request.path
    if path.startswith("/static/") or path in ("/favicon.ico", "/api/scale/status"):
        return response

    if request.method == "GET" and path in ("/api/scale/products", "/api/products", "/api/scale/settings"):
        return response

    # Anlaşılır Türkçe eylem mesajları
    ip = request.remote_addr or "Bilinmiyor"
    device = get_device_label(ip)
    now_time = time.strftime("%H:%M:%S")

    action_msg = None
    if path == "/api/scale/send_all_stream":
        action_msg = "🚀 Teraziye Toplu Fiyat Gönderme İşlemi Başlattı"
    elif path == "/api/scale/fetch_prices_stream" or path == "/api/scale/fetch_prices":
        action_msg = "📥 DIGI SM-100 Terazisinden Güncel Fiyatları Çekti"
    elif path.startswith("/api/scale/send_price/"):
        plu_id = path.split("/")[-1]
        action_msg = f"🚀 PLU {plu_id} için Teraziye Tekli Fiyat Gönderdi"
    elif path == "/api/scale/products" and request.method == "POST":
        action_msg = "✏️ Manav Ürün / Fiyat Listesini Güncelledi"
    elif path.startswith("/api/print"):
        action_msg = "🖨️ Barkod / Raf Etiketi Baskısı Gönderdi"
    elif path.startswith("/api/sync"):
        action_msg = "🔄 Fiyat Listesi Senkronizasyonu Çalıştırdı"
    elif path == "/":
        action_msg = "🌐 Masaüstü Yönetim Panelini Açtı"
    elif path == "/mobile":
        action_msg = "📱 Canlı Mobil Terminal Arayüzünü Açtı"

    if action_msg:
        print(f"[{now_time}] {device:<22} -> {action_msg}")

    return response

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/mobile")
def mobile_terminal():
    return render_template("mobile.html")

@app.route("/static/<path:filename>")
def serve_static(filename):
    res = send_from_directory(STATIC_DIR, filename)
    res.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
    res.headers["Pragma"] = "no-cache"
    res.headers["Expires"] = "0"
    return res

def run_server(host="0.0.0.0", port=5000):
    free_port(port)
    free_port(port + 1)
    time.sleep(0.5)

    def ignore_sigint(sig, frame):
        pass
    signal.signal(signal.SIGINT, ignore_sigint)

    local_ip = get_local_ip()
    cert_path, key_path = ensure_ssl_certs(local_ip)

    url = f"http://127.0.0.1:{port}"
    mobile_http = f"http://{local_ip}:{port}/mobile"
    mobile_https = f"https://{local_ip}:{port + 1}/mobile" if cert_path else None

    # Canlı Kod İzleyicisini başlat (değişiklik olduğunda önbelleği sıfırlar ve terminale basar)
    start_code_watcher(on_change_callback=clear_diff_cache)

    print("=" * 70)
    print("[BASLATILDI] Market Raf Etiketi Paneli & Canlı Mobil Terminal")
    print(f"[*] Masaustu Panel       : {url}")
    print(f"[*] Mobil HTTP (Normal)  : {mobile_http}")
    if mobile_https:
        print(f"[*] Mobil HTTPS (Kamera) : {mobile_https}")
    print("[*] Canlı Kod İzleyici   : Devrede (Modüler Mimari Aktif)")
    print("=" * 70)

    try:
        webbrowser.open(url)
    except Exception:
        pass

    if cert_path and key_path:
        from werkzeug.serving import make_server
        http_srv = make_server(host, port, app, threaded=True)
        https_srv = make_server(host, port + 1, app, ssl_context=(cert_path, key_path), threaded=True)

        t_http = threading.Thread(target=http_srv.serve_forever, daemon=True)
        t_http.start()
        print(f"[HTTPS SUNUCUSU AKTİF] Port {port + 1} üzerinde SSL canlı kamera servisi devrede.")
        https_srv.serve_forever()
    else:
        app.run(host=host, port=port, debug=False, use_reloader=False, threaded=True)

if __name__ == "__main__":
    run_server("0.0.0.0", 5000)
