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
import signal
import threading
import logging
import subprocess
import webbrowser
from flask import Flask, render_template, send_from_directory, request

# KÜRESEL ÇÖKME KORUMASI (GLOBAL CRASH PREVENTER)
def global_exception_handler(exctype, value, tb):
    import traceback
    import datetime
    err_msg = "".join(traceback.format_exception(exctype, value, tb))
    print(f"!!! [KÜRESEL HATA KORUMASI] Beklenmedik hata yakalandı:\n{err_msg}")
    try:
        with open("global_crash_preventer.log", "a", encoding="utf-8") as f:
            f.write(f"[{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [SYS] {err_msg}\n")
    except Exception:
        pass

def global_thread_exception_handler(args):
    import traceback
    import datetime
    err_msg = "".join(traceback.format_exception(args.exc_type, args.exc_value, args.exc_traceback))
    print(f"!!! [KÜRESEL THREAD KORUMASI] {args.thread.name} içinde hata:\n{err_msg}")
    try:
        with open("global_crash_preventer.log", "a", encoding="utf-8") as f:
            f.write(f"[{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [THREAD: {args.thread.name}] {err_msg}\n")
    except Exception:
        pass

sys.excepthook = global_exception_handler
threading.excepthook = global_thread_exception_handler

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

from backend.ayarlar import STATIC_DIR, TEMPLATES_DIR, DATA_DIR, BASE_DIR
from backend.araclar.excel_dosya_izleyici import get_local_ip, ensure_ssl_certs, free_port, start_code_watcher
from backend.katalog.excel_katalog_servisi import clear_diff_cache

# Blueprint Rotaları
from backend.katalog.katalog_rotalari import catalog_bp
from backend.katalog.katalog_excel_rotalari import excel_catalog_bp
from backend.katalog.katalog_toplu_zam_rotalari import batch_catalog_bp
from backend.yedekleme.yedekleme_rotalari import backup_bp
from backend.tasarim.tasarim_sablon_rotalari import template_bp
from backend.yazdirma.yazdirma_rotalari import print_bp
from backend.raporlama.rapor_rotalari import report_bp
from backend.terazi.terazi_rotalari import scale_bp
from backend.kasa.hizli_satis_rotalari import pos_bp
from backend.musteri.musteri_rotalari import customer_bp
from backend.market.market_rotalari import market_bp
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
app.register_blueprint(excel_catalog_bp)
app.register_blueprint(batch_catalog_bp)
app.register_blueprint(backup_bp)
app.register_blueprint(template_bp)
app.register_blueprint(print_bp)
app.register_blueprint(report_bp)
app.register_blueprint(scale_bp)
app.register_blueprint(pos_bp)
app.register_blueprint(customer_bp)
app.register_blueprint(market_bp)
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

from werkzeug.exceptions import HTTPException

@app.errorhandler(Exception)
def handle_global_exception(e):
    """Beklenmedik tüm istisnaları yakalar, loglar ve sunucunun çökmesini engeller."""
    from flask import jsonify
    if isinstance(e, HTTPException):
        if e.code == 404:
            if request.path.startswith("/api/"):
                return jsonify({"status": "error", "message": "Bulunamadı"}), 404
            return render_template("masaustu/index.html", cache_bust=int(time.time())), 404
        return jsonify({"status": "error", "message": e.description}), e.code

    err_str = str(e)
    print(f"[UYARI] İstisna yakalandı ve izole edildi ({request.path}): {err_str}")
    if request.path.startswith("/api/"):
        return jsonify({
            "status": "error",
            "message": "İşlem sırasında geçici bir hata oluştu ancak sistem güvenle kurtarıldı.",
            "error": err_str,
            "recovered": True
        }), 500
    return render_template("masaustu/index.html", cache_bust=int(time.time()))

from backend.araclar.sistem_kurtarma_servisi import check_and_repair_system

# Sunucu başlangıcında sistem ve eksik dosya bütünlük kontrolü
try:
    _repair_report = check_and_repair_system()
    if _repair_report.get("status") != "healthy" or _repair_report.get("directories_created") or _repair_report.get("seed_restored"):
        print(f"[*] [SİSTEM KORUMASI] Dosya ve Veritabanı Bütünlüğü Tarandı: {_repair_report}")
except Exception as _ex:
    print(f"[UYARI] Sistem ön kontrol uyarısı: {_ex}")

@app.route("/api/system/health_check", methods=["GET", "POST"])
def api_system_health_check():
    """Tüm sistem dosyalarını, tabloları ve ayarları tarayıp eksikleri onarır."""
    from flask import jsonify
    report = check_and_repair_system()
    return jsonify(report)

@app.before_request
def check_installation():
    marker_path = os.path.join(DATA_DIR, "installed.marker")
    if not os.path.exists(marker_path):
        # Otomatik onarım çalıştır
        try:
            check_and_repair_system()
        except Exception:
            pass

        if not os.path.exists(marker_path):
            allowed_paths = [
                "/setup",
                "/api/setup/execute",
                "/favicon.ico"
            ]
            path = request.path
            if path.startswith("/frontend/") or path.startswith("/static/"):
                return
            if path not in allowed_paths:
                from flask import redirect
                return redirect("/setup")


@app.route("/setup")
def setup_page():
    return render_template("kurulum/setup.html")

@app.route("/favicon.ico")
def favicon():
    return ('', 204)

@app.route("/")
def index():
    local_ip = get_local_ip()
    return render_template("masaustu/index.html", cache_bust=int(time.time()), local_ip=local_ip)

@app.route("/mobile")
def mobile_terminal():
    return render_template("mobil/mobile.html", cache_bust=int(time.time()))

@app.route("/indir/dosya")
@app.route("/download/file")
def download_setup_file():
    """Doğrudan zip dosyasını indiren uç nokta."""
    from flask import send_file
    import os

    dist_dir = os.path.join(BASE_DIR, "dist")
    portable_zip = os.path.join(dist_dir, "OYMAPOS_Windows7_Kurulumsuz.zip")
    if not os.path.exists(portable_zip):
        portable_zip = os.path.join(dist_dir, "OYMAPOS_Windows7_Tam_Paket.zip")
        
    if os.path.exists(portable_zip):
        return send_file(
            portable_zip,
            as_attachment=True,
            download_name="OYMAPOS_Windows7_Kurulumsuz.zip",
            mimetype="application/zip"
        )
    return "Kurulumsuz paket sunucuda bulunamadı.", 404

@app.route("/indir", methods=["GET"])
@app.route("/download", methods=["GET"])
@app.route("/setup-indir", methods=["GET"])
def download_setup():
    """İndirmeye basınca açılan, kurulumu adım adım anlatan ve indirmeyi başlatan rehber sayfası."""
    from flask import render_template_string
    import os

    dist_dir = os.path.join(BASE_DIR, "dist")
    zip_path = os.path.join(dist_dir, "OYMAPOS_Windows7_Kurulumsuz.zip")
    file_size_mb = f"{round(os.path.getsize(zip_path) / (1024 * 1024), 1)} MB" if os.path.exists(zip_path) else "170 MB"

    html = f"""<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OYMAPOS - Windows 7 / 8 / 10 / 11 Hızlı Kurulum Rehberi</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', -apple-system, sans-serif; }}
    body {{
      background: radial-gradient(circle at 50% 0%, #0f172a, #020617);
      color: #f8fafc;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 30px 20px;
    }}
    .container {{
      max-width: 680px;
      width: 100%;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(16px);
      border: 1px solid #1e293b;
      border-radius: 20px;
      padding: 36px;
      box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.7);
    }}
    .header {{
      text-align: center;
      margin-bottom: 28px;
    }}
    .badge {{
      display: inline-block;
      background: rgba(14, 165, 233, 0.15);
      color: #38bdf8;
      border: 1px solid rgba(14, 165, 233, 0.35);
      font-size: 11.5px;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      padding: 5px 14px;
      border-radius: 30px;
      margin-bottom: 12px;
    }}
    h1 {{
      font-size: 24px;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 8px;
      letter-spacing: -0.5px;
    }}
    .subtitle {{
      font-size: 13.5px;
      color: #94a3b8;
      line-height: 1.5;
    }}
    .download-action {{
      background: linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.9));
      border: 1.5px solid #334155;
      border-radius: 16px;
      padding: 20px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 30px;
    }}
    .file-info {{
      display: flex;
      flex-direction: column;
      gap: 3px;
    }}
    .file-name {{
      font-size: 15px;
      font-weight: 700;
      color: #38bdf8;
      display: flex;
      align-items: center;
      gap: 8px;
    }}
    .file-meta {{
      font-size: 12px;
      color: #64748b;
    }}
    .btn-download {{
      background: linear-gradient(135deg, #0284c7, #2563eb);
      color: #ffffff;
      text-decoration: none;
      font-weight: 700;
      font-size: 14.5px;
      padding: 13px 24px;
      border-radius: 10px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 20px rgba(37, 99, 235, 0.4);
      transition: all 0.2s;
      white-space: nowrap;
    }}
    .btn-download:hover {{
      transform: translateY(-2px);
      box-shadow: 0 6px 25px rgba(37, 99, 235, 0.6);
      background: linear-gradient(135deg, #0369a1, #1d4ed8);
    }}
    .steps-title {{
      font-size: 14px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #cbd5e1;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }}
    .step-list {{
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 24px;
    }}
    .step-item {{
      background: rgba(30, 41, 59, 0.45);
      border: 1px solid rgba(51, 65, 85, 0.6);
      border-radius: 12px;
      padding: 14px 16px;
      display: flex;
      align-items: flex-start;
      gap: 14px;
    }}
    .step-num {{
      background: #0284c7;
      color: #ffffff;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 13px;
      flex-shrink: 0;
      margin-top: 1px;
    }}
    .step-text strong {{
      display: block;
      font-size: 13.5px;
      color: #f1f5f9;
      margin-bottom: 3px;
    }}
    .step-text p {{
      font-size: 12.5px;
      color: #94a3b8;
      line-height: 1.45;
    }}
    .code-tag {{
      background: #090e1a;
      border: 1px solid #334155;
      padding: 2px 7px;
      border-radius: 5px;
      color: #38bdf8;
      font-family: monospace;
      font-weight: 700;
      font-size: 12px;
    }}
    .tip-box {{
      background: rgba(16, 185, 129, 0.08);
      border: 1px dashed rgba(16, 185, 129, 0.35);
      border-radius: 10px;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 12.5px;
      color: #34d399;
    }}
    .tip-box span:first-child {{
      font-size: 18px;
    }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge">🚀 Kurulumsuz & Taşınabilir Sürüm</div>
      <h1>OYMAPOS Sistem İndirme ve Başlatma</h1>
      <p class="subtitle">Windows 7, 8, 10 ve 11 işletim sistemlerinde hiçbir kuruluma gerek kalmadan tek tıkla çalışır.</p>
    </div>

    <div class="download-action">
      <div class="file-info">
        <div class="file-name">📦 OYMAPOS_Windows7_Kurulumsuz.zip</div>
        <div class="file-meta">Boyut: {file_size_mb} &bull; Python 3.8.10 Gömülü Motor &bull; Şifresiz Doğrudan İndirme</div>
      </div>
      <a href="/indir/dosya" class="btn-download" id="autoDownloadBtn">
        <span>⬇️</span>
        <span>Hemen İndir</span>
      </a>
    </div>

    <div class="steps-title">
      <span>📋</span> <span>Nasıl Çalıştırılır? (Sadece 2 Adım)</span>
    </div>

    <div class="step-list">
      <div class="step-item">
        <div class="step-num">1</div>
        <div class="step-text">
          <strong>İndirilen Dosyayı Klasöre Çıkartın</strong>
          <p>İndirilen <span class="code-tag">OYMAPOS_Windows7_Kurulumsuz.zip</span> dosyasına sağ tıklayıp <em>"Buraya Ayıkla"</em> veya <em>"Tümünü Ayıkla"</em> diyerek Masaüstüne bir klasör olarak çıkarın.</p>
        </div>
      </div>

      <div class="step-item">
        <div class="step-num">2</div>
        <div class="step-text">
          <strong>OYMAPOS.exe Dosyasına Çift Tıklayın</strong>
          <p>Klasörün içindeki <span class="code-tag">OYMAPOS.exe</span> dosyasına çift tıklayın. Sistem 2 saniye içinde arkada çalışıp tarayıcınızda kasa ve etiket ekranını otomatik olarak açacaktır!</p>
        </div>
      </div>
    </div>

    <div class="tip-box">
      <span>💡</span>
      <span><strong>İpucu:</strong> Herhangi bir kurulum (Setup), yönetici şifresi veya ekstra DLL yüklemenize gerek yoktur. Klasörü dilediğiniz zaman USB bellekle başka bilgisayarlara da taşıyabilirsiniz.</span>
    </div>
  </div>

  <script>
    // Sayfa açıldığında indirmeyi otomatik olarak da tetikle
    window.addEventListener('load', () => {{
      setTimeout(() => {{
        const btn = document.getElementById('autoDownloadBtn');
        if (btn) {{
          window.location.href = btn.href;
        }}
      }}, 600);
    }});
  </script>
</body>
</html>
"""
    return render_template_string(html)



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
    """Web ve Mobil Sunucusunu başlatır ve varsayılan web tarayıcısını açar."""
    import webbrowser
    port = 5000
    local_ip = get_local_ip()

    # Dosya ve kod değişiklik izleyicisini başlat
    start_code_watcher(on_change_callback=clear_diff_cache)

    print("=" * 70)
    print("🚀 [WEB MODU] Market Raf Etiketi, POS & Barkod Sistemi Başlatıldı")
    print(f"[*] Web Yönetim Paneli   : http://127.0.0.1:{port}")
    print(f"[*] Yerel Ağ / Web       : http://{local_ip}:{port}")
    print(f"[*] Mobil HTTP (Normal)  : http://{local_ip}:{port}/mobile")
    print(f"[*] Mobil HTTPS (Kamera) : https://{local_ip}:{port + 1}/mobile")
    print("=" * 70)

    # 1. Arka planda Web & Mobil sunucusunu başlat (tüm ağa açık 0.0.0.0)
    start_backend_server(port)
    time.sleep(0.6)


    # 3. Kiosk Printing Moduyla Tarayıcıyı Başlat (Sıfır Önizleme, Doğrudan Yazdırma)
    app_url = f"http://127.0.0.1:{port}"
    chrome_paths = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"
    ]
    browser_launched = False
    for b_path in chrome_paths:
        if os.path.exists(b_path):
            try:
                subprocess.Popen([b_path, "--kiosk-printing", app_url])
                browser_launched = True
                print(f"[*] Kiosk Yazdırma Moduyla Tarayıcı Başlatıldı: {b_path}")
                break
            except Exception:
                pass

    if not browser_launched:
        try:
            webbrowser.open(app_url)
        except Exception as e:
            print(f"[UYARI] Tarayıcı otomatik açılamadı: {e}")

    # CTRL+C ile yanlışlıkla sunucunun kapatılmasını engelle (Arka planda kesintisiz çalışır)
    try:
        signal.signal(signal.SIGINT, signal.SIG_IGN)
    except Exception:
        pass

    print("\n[BİLGİ] Sunucu kesintisiz modda arka planda çalışıyor (CTRL+C korumalı).\n")

    while True:
        try:
            time.sleep(1)
        except Exception:
            pass

if __name__ == "__main__":
    main()
