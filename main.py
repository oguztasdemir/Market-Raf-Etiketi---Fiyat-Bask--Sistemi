# -*- coding: utf-8 -*-
"""
Market Raf Etiketi, Kasa (POS) & Barkod Sistemi - Ana Başlatıcı (main.py)
Canlı Güncelleme: 16:18
Bu tek dosya hem Masaüstü GUI penceresini açar, hem de yerel ağdaki mobil
cihazların ve diğer bilgisayarların (Web / Mobil Terminal) bağlanabilmesi için
Flask sunucusunu (0.0.0.0:5000) arka planda kesintisiz çalıştırır.
"""
import os
import sys
import time
import threading
import logging
from flask import Flask, render_template, send_from_directory, request

# Windows terminal Türkçe karakter desteği
if sys.platform.startswith('win'):
    try:
        if hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        if hasattr(sys.stderr, 'reconfigure'):
            sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

# Proje dizinini Python yoluna ekle
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.ayarlar import STATIC_DIR, TEMPLATES_DIR
from backend.araclar.excel_dosya_izleyici import get_local_ip, ensure_ssl_certs, free_port, start_code_watcher
from backend.katalog.excel_katalog_servisi import clear_diff_cache

# Blueprint Rotaları
from backend.katalog.katalog_rotalari import catalog_bp
from backend.yedekleme.yedekleme_rotalari import backup_bp
from backend.tasarim.tasarim_sablon_rotalari import template_bp
from backend.yazdirma.yazdirma_rotalari import print_bp
from backend.raporlama.rapor_rotalari import report_bp
from backend.terazi.terazi_rotalari import scale_bp
from backend.kasa.hizli_satis_rotalari import pos_bp
from backend.muhasebe.muhasebe_rotalari import accounting_bp

# Ham Werkzeug HTTP erişim loglarını sustur
logging.getLogger('werkzeug').setLevel(logging.ERROR)

# Flask Uygulama Tanımı
app = Flask(__name__, static_folder=STATIC_DIR, static_url_path='/frontend', template_folder=TEMPLATES_DIR)
app.config['MAX_CONTENT_LENGTH'] = 64 * 1024 * 1024  # 64 MB dosya yükleme limiti
app.config['TEMPLATES_AUTO_RELOAD'] = True
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
app.jinja_env.auto_reload = True

# Blueprint'leri kaydet
app.register_blueprint(catalog_bp)
app.register_blueprint(backup_bp)
app.register_blueprint(template_bp)
app.register_blueprint(print_bp)
app.register_blueprint(report_bp)
app.register_blueprint(scale_bp)
app.register_blueprint(pos_bp)
app.register_blueprint(accounting_bp)

def get_device_label(ip):
    """İstemci IP adresini anlaşılır cihaz ismine dönüştürür."""
    if not ip or ip in ("127.0.0.1", "localhost", "::1", "192.168.1.34"):
        return "[Bu Bilgisayar]"
    elif ip == "192.168.1.33":
        return "[Ana Bilgisayar]"
    elif ip == "192.168.1.61":
        return "[DIGI Terazi]"
    else:
        return f"[Cihaz: {ip}]"

@app.context_processor
def inject_cache_bust():
    return dict(cache_bust=int(time.time()))

@app.after_request
def log_user_action_and_headers(response):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0, post-check=0, pre-check=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"

    path = request.path
    if path.startswith("/frontend/") or path.startswith("/static/") or path in ("/favicon.ico", "/api/scale/status"):
        return response

    if request.method == "GET" and path in ("/api/scale/products", "/api/products", "/api/scale/settings", "/api/pos/quick_category_items", "/api/pos/dashboard_summary"):
        return response

    try:
        ip = request.remote_addr or "Bilinmiyor"
        device = get_device_label(ip)
        now_time = time.strftime("%H:%M:%S")

        action_msg = None
        if path == "/api/scale/send_all_stream":
            action_msg = "Teraziye Toplu Fiyat Gönderme İşlemi Başlattı"
        elif path in ("/api/scale/fetch_prices_stream", "/api/scale/fetch_prices"):
            action_msg = "DIGI SM-100 Terazisinden Güncel Fiyatları Çekti"
        elif path.startswith("/api/scale/send_price/"):
            plu_id = path.split("/")[-1]
            action_msg = f"PLU {plu_id} için Teraziye Tekli Fiyat Gönderdi"
        elif path == "/api/scale/products" and request.method == "POST":
            action_msg = "Manav Ürün / Fiyat Listesini Güncelledi"
        elif path == "/api/pos/checkout":
            action_msg = "Hızlı Kasa (POS) Satışını Tamamladı"
        elif path.startswith("/api/print"):
            action_msg = "Barkod / Raf Etiketi Baskısı Gönderdi"
        elif path.startswith("/api/sync"):
            action_msg = "Fiyat Listesi Senkronizasyonu Çalıştırdı"
        elif path == "/":
            action_msg = "Masaüstü Yönetim Panelini Açtı"
        elif path == "/mobile":
            action_msg = "Canlı Mobil Terminal Arayüzünü Açtı"

        if action_msg:
            print(f"[{now_time}] {device:<18} -> {action_msg}")
            from backend.kasa.hizli_satis_rotalari import record_device_activity
            record_device_activity(ip, action_msg)
    except Exception:
        pass

    return response

@app.route("/")
def index():
    return render_template("masaustu/index.html", cache_bust=int(time.time()))

@app.route("/mobile")
def mobile_terminal():
    return render_template("mobil/mobile.html", cache_bust=int(time.time()))

@app.route("/frontend/<path:filename>")
@app.route("/static/<path:filename>")
def serve_static(filename):
    res = send_from_directory(STATIC_DIR, filename)
    res.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0, post-check=0, pre-check=0"
    res.headers["Pragma"] = "no-cache"
    res.headers["Expires"] = "-1"
    res.headers["Surrogate-Control"] = "no-store"
    return res

def start_backend_server(port=5000):
    """Flask sunucusunu yerel ağa açık olarak (0.0.0.0) kesintisiz çalıştırır."""
    from werkzeug.serving import make_server

    free_port(port)
    free_port(port + 1)
    time.sleep(0.3)

    local_ip = get_local_ip()
    cert_path, key_path = ensure_ssl_certs(local_ip)

    # 1. Standart HTTP Sunucusu (Port 5000 - Tüm Ağ 0.0.0.0)
    try:
        http_srv = make_server("0.0.0.0", port, app, threaded=True)
        t_http = threading.Thread(target=http_srv.serve_forever, daemon=True)
        t_http.start()
    except Exception as e:
        print(f"[HATA] HTTP Sunucu Başlatılamadı: {e}")

    # 2. SSL Canlı Mobil Kamera Servisi (Port 5001 - Tüm Ağ 0.0.0.0)
    if cert_path and key_path:
        try:
            https_srv = make_server("0.0.0.0", port + 1, app, ssl_context=(cert_path, key_path), threaded=True)
            t_https = threading.Thread(target=https_srv.serve_forever, daemon=True)
            t_https.start()
        except Exception as e:
            print(f"[HATA] HTTPS Kamera Sunucusu Başlatılamadı: {e}")

def main():
    """Uygulamayı başlatır: Hem yerel GUI penceresini hem de Web/Mobil sunucusunu açar."""
    port = 5000
    local_ip = get_local_ip()

    # Dosya ve kod değişiklik izleyicisini başlat
    start_code_watcher(on_change_callback=clear_diff_cache)

    print("=" * 70)
    print("[BASLATILDI] Market Raf Etiketi, POS & Barkod Sistemi")
    print(f"[*] Masaüstü Panel       : http://127.0.0.1:{port}")
    print(f"[*] Yerel Ağ / Web       : http://{local_ip}:{port}")
    print(f"[*] Mobil HTTP (Normal)  : http://{local_ip}:{port}/mobile")
    print(f"[*] Mobil HTTPS (Kamera) : https://{local_ip}:{port + 1}/mobile")
    print("=" * 70)

    # 1. Arka planda Web & Mobil sunucusunu başlat (tüm ağa açık 0.0.0.0)
    start_backend_server(port)
    time.sleep(0.6)

    # 2. Masaüstü GUI Penceresini Başlat (Webview)
    try:
        import webview
        window = webview.create_window(
            title="Market Raf Etiketi & POS Yönetim Sistemi",
            url=f"http://127.0.0.1:{port}",
            width=1366,
            height=768,
            min_size=(1024, 600),
            confirm_close=False,
            text_select=True
        )
        webview.start(private_mode=False)
        print("\n" + "=" * 70)
        print("[BİLGİ] Masaüstü penceresi kapatıldı.")
        print(f"[AKTİF] Web & Mobil Sunucusu arka planda kesintisiz çalışmaya devam ediyor:")
        print(f"[*] Web Panel            : http://{local_ip}:{port}")
        print(f"[*] Mobil Terminal       : http://{local_ip}:{port}/mobile")
        print(f"[*] Mobil Kamera (HTTPS) : https://{local_ip}:{port + 1}/mobile")
        print("=" * 70 + "\n")
    except Exception as e:
        # Eğer webview desteklenmiyorsa veya headless çalıştırılıyorsa standart tarayıcıyı aç
        import webbrowser
        try:
            webbrowser.open(f"http://127.0.0.1:{port}")
        except Exception:
            pass

    # Masaüstü penceresi kapatılsa dahi sunucunun arka planda kesintisiz çalışmasını sağla
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[BİLGİ] Sunucu kullanıcı tarafından durduruldu.")

if __name__ == "__main__":
    main()
