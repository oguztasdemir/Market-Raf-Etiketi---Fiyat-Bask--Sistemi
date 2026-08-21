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
from flask import Flask, render_template, send_from_directory

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

@app.context_processor
def inject_cache_bust():
    return dict(cache_bust=int(time.time()))

@app.after_request
def add_no_cache_headers(response):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0, post-check=0, pre-check=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
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
