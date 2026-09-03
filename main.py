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

@app.route("/indir", methods=["GET", "POST"])
@app.route("/download", methods=["GET", "POST"])
@app.route("/setup-indir", methods=["GET", "POST"])
def download_setup():
    """Aynı Wi-Fi ağındaki diğer bilgisayarlardan Setup/EXE dosyasını sadece yetkili şifreyle indirmeyi sağlar."""
    import datetime
    from flask import send_file, render_template_string
    from backend.kasa.kasiyer_servisi import get_cashiers
    from backend.araclar.depolama_araclari import load_json
    from backend.ayarlar import SETTINGS_FILE

    # İzinli şifreler: Kullanıcının belirlediği 1234567 ve sistem ayarlarındaki özel şifreler
    valid_pins = {"1234567"}
    settings = load_json(SETTINGS_FILE, {})
    if settings.get("admin_pin"):
        valid_pins.add(str(settings.get("admin_pin")).strip())
    if settings.get("security_pin"):
        valid_pins.add(str(settings.get("security_pin")).strip())

    try:
        cashiers = get_cashiers()
        for c in cashiers:
            if c.get("role") == "admin" and c.get("pin"):
                valid_pins.add(str(c.get("pin")).strip())
    except Exception:
        pass

    # GET ile URL parametresinde (?pin=1234567) veya POST ile formdan şifre kontrolü
    provided_pin = request.values.get("pin", "").strip() or request.values.get("password", "").strip()
    
    if provided_pin and provided_pin in valid_pins:
        import io, zipfile, openpyxl
        from backend.ayarlar import PRODUCTS_FILE, MANAV_PRODUCTS_FILE
        
        dist_dir = os.path.join(BASE_DIR, "dist")
        setup_file = os.path.join(dist_dir, "OYMAPOS_Setup.exe")
        app_file = os.path.join(dist_dir, "OYMAPOS.exe")
        
        target_installer = setup_file if os.path.exists(setup_file) else (app_file if os.path.exists(app_file) else None)
        if not target_installer:
            return "İndirilebilir kurulum dosyası sunucuda bulunamadı. Lütfen önce derleme yapın.", 404

        # 1. O anki güncel ürünleri bellekte Excel (.xlsx) olarak oluştur
        products = load_json(PRODUCTS_FILE, [])
        manav_products = load_json(MANAV_PRODUCTS_FILE, [])

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Guncel_Fiyat_Listesi"
        
        headers = ["Stok Kodu", "Barkod", "Ürün Adı", "Kategori", "Marka", "Birim", "KDV Oranı (%)", "Satış Fiyatı (TL)", "Eski Fiyat (TL)", "Son Güncelleme"]
        ws.append(headers)
        
        for p in products:
            ws.append([
                str(p.get("stock_code") or ""),
                str(p.get("barcode") or ""),
                str(p.get("title") or p.get("title1") or ""),
                str(p.get("category") or "Genel"),
                str(p.get("brand") or ""),
                str(p.get("unit") or "Adet"),
                str(p.get("vat_rate") or 1),
                str(p.get("price") or 0.0),
                str(p.get("old_price") or ""),
                str(p.get("price_updated_at") or p.get("updated_at") or "")
            ])

        # Manav sayfası varsa ekle
        if manav_products:
            ws_manav = wb.create_sheet(title="Manav_Terazi_PLU")
            ws_manav.append(["PLU No", "Barkod", "Ürün Adı", "Kategori", "Fiyat (TL)", "Birim"])
            for m in manav_products:
                ws_manav.append([
                    str(m.get("plu") or ""),
                    str(m.get("barcode") or ""),
                    str(m.get("name") or m.get("title") or ""),
                    str(m.get("category") or "Manav"),
                    str(m.get("price") or 0.0),
                    str(m.get("unit") or "Kg")
                ])

        excel_buf = io.BytesIO()
        wb.save(excel_buf)
        excel_buf.seek(0)
        
        now_str = datetime.datetime.now().strftime("%Y%m%d_%H%M")
        excel_filename = f"Guncel_Fiyat_Listesi_{now_str}.xlsx"

        # 2. Setup EXE ve Excel'i tek bir ZIP paketi haline getir (Stream)
        zip_buf = io.BytesIO()
        with zipfile.ZipFile(zip_buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
            installer_name = os.path.basename(target_installer)
            zf.write(target_installer, arcname=installer_name)
            zf.writestr(excel_filename, excel_buf.getvalue())
            
            # Gerekli Sistem DLL ve Çalışma Zamanı (Runtime) Kurucularını ZIP'e Ekle ve Doğrula
            redist_dir = os.path.join(BASE_DIR, "build_tools", "redist")
            
            # Gerekli kritik DLL'ler
            essential_dlls = [
                "api-ms-win-core-path-l1-1-0.dll",
                "vcruntime140.dll",
                "msvcp140.dll",
                "vcruntime140_1.dll"
            ]
            dll_check_results = {}
            
            # 1. Visual C++ Çalışma DLL'lerini topla (vcruntime140, msvcp140, vcruntime140_1)
            for dll_name in ["vcruntime140.dll", "msvcp140.dll", "vcruntime140_1.dll"]:
                src_candidate = None
                r_cand = os.path.join(redist_dir, dll_name)
                dist_cand = os.path.join(dist_dir, dll_name)
                sys32_cand = os.path.join(os.environ.get("WINDIR", "C:\\Windows"), "System32", dll_name)
                
                if os.path.exists(r_cand):
                    src_candidate = r_cand
                elif os.path.exists(dist_cand):
                    src_candidate = dist_cand
                elif os.path.exists(sys32_cand):
                    src_candidate = sys32_cand
                
                if src_candidate and os.path.exists(src_candidate):
                    zf.write(src_candidate, arcname=dll_name)
                    zf.write(src_candidate, arcname=os.path.join("Sistem_Kutuphaneleri_Gereksinimler", dll_name))
                    dll_check_results[dll_name] = "MEVCUT - PAKETE EKLENDİ"
                else:
                    dll_check_results[dll_name] = "SİSTEM STANDARDI (GEREKİRSE VC_REDIST İLE KURULACAK)"

            # 2. Çalışma Zamanı (Runtime) EXE Kurucularını Ekle
            # NOT: api-ms-win-core-path-l1-1-0.dll sadece Win7 için gerekirse özel klasörde tutulmalı, kök dizine konmamalıdır!
            if os.path.exists(redist_dir):
                for rf in ["vc_redist.x64.exe", "MicrosoftEdgeWebview2Setup.exe"]:
                    r_path = os.path.join(redist_dir, rf)
                    if os.path.exists(r_path):
                        zf.write(r_path, arcname=os.path.join("Sistem_Kutuphaneleri_Gereksinimler", rf))
                
                # Win7 özel DLL'ini sadece gerekirse alt klasöre ekle
                legacy_dll = os.path.join(redist_dir, "api-ms-win-core-path-l1-1-0.dll")
                if os.path.exists(legacy_dll):
                    zf.write(legacy_dll, arcname=os.path.join("Sistem_Kutuphaneleri_Gereksinimler", "Windows7_Ozel_Yama_DLL", "api-ms-win-core-path-l1-1-0.dll"))
            
            # 3. DLL Doğrulama Raporu ve Kurulum Rehberi
            dll_status_lines = "\n".join([f"  [OK] {k}: {v}" for k, v in dll_check_results.items()])
            readme_text = f"""OYMAPOS Market Raf Etiketi, Kasa & Terazi Sistemi
Paket Doğrulama ve Oluşturulma Tarihi: {datetime.datetime.now().strftime('%d.%m.%Y %H:%M:%S')}

SİSTEM DLL & ÇALIŞMA ZAMANI SAĞLIK RAPORU:
{dll_status_lines}

İÇERİK VE KURULUM ADIMLARI:
1. {installer_name} -> Kurulum Sihirbazı (Çift tıklayarak kurun)
2. {excel_filename} -> Sistemde kayıtlı en güncel {len(products)} adet ürün ve fiyat listesi
3. api-ms-win-core-path-l1-1-0.dll -> Eski Windows sürümleri için hazır DLL kütüphanesi
4. Sistem_Kutuphaneleri_Gereksinimler/ -> Windows 7/8/10/11 eksik DLL ve çalışma kütüphaneleri:
   * vc_redist.x64.exe -> Visual C++ Redistributable (Tüm Windows sürümleri için)
   * MicrosoftEdgeWebview2Setup.exe -> WebView2 Çalışma Zamanı (Masaüstü kasa arayüzü motoru)

ÖZET TALİMAT:
- Kurulum sihirbazı çalışırken yanındaki bu Excel dosyasını otomatik olarak algılar ve tüm fiyatları sisteme aktarır.
- Başka bir bilgisayara kurarken 'DLL bulunamadı' hatası alırsanız, ZIP içindeki 'Sistem_Kutuphaneleri_Gereksinimler' klasöründeki 'vc_redist.x64.exe' dosyasını çalıştırınız.
"""
            zf.writestr("KULLANIM_VE_DLL_DOGRULAMA.txt", readme_text)

        zip_buf.seek(0)
        zip_filename = f"OYMAPOS_Kurulum_Ve_Guncel_Fiyatlar_{now_str}.zip"
        
        return send_file(
            zip_buf,
            as_attachment=True,
            download_name=zip_filename,
            mimetype="application/zip"
        )

    # Şifre girilmemişse veya hatalıysa şık güvenlik şifre ekranını göster
    error_msg = "⚠️ Hatalı Yönetici Şifresi! Lütfen tekrar deneyin." if provided_pin else None
    html_page = f"""
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>OYMAPOS - Güvenli Kurulum İndirme</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
      <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }}
        body {{ background: #030712; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }}
        .card {{ background: #0b1329; border: 1.5px solid #1e293b; border-radius: 16px; width: 100%; max-width: 440px; padding: 32px; box-shadow: 0 20px 50px rgba(0,0,0,0.6); text-align: center; }}
        .icon {{ font-size: 48px; margin-bottom: 12px; }}
        h2 {{ font-size: 20px; font-weight: 800; color: #f8fafc; margin-bottom: 6px; }}
        p {{ font-size: 13px; color: #94a3b8; margin-bottom: 24px; line-height: 1.5; }}
        .inp-group {{ margin-bottom: 20px; text-align: left; }}
        label {{ font-size: 11.5px; font-weight: 700; color: #cbd5e1; margin-bottom: 6px; display: block; }}
        input {{ width: 100%; padding: 12px 16px; font-size: 16px; font-weight: 800; background: #060b17; border: 1.5px solid #334155; border-radius: 10px; color: #38bdf8; letter-spacing: 2px; text-align: center; outline: none; transition: 0.15s; }}
        input:focus {{ border-color: #38bdf8; box-shadow: 0 0 12px rgba(56,189,248,0.25); }}
        .btn {{ width: 100%; padding: 14px; font-size: 14px; font-weight: 800; background: linear-gradient(135deg, #0284c7, #0369a1); border: none; border-radius: 10px; color: #ffffff; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 15px rgba(2,132,199,0.35); transition: 0.15s; }}
        .btn:hover {{ transform: translateY(-1px); box-shadow: 0 6px 20px rgba(2,132,199,0.45); }}
        .err {{ background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.35); color: #f87171; padding: 10px; border-radius: 8px; font-size: 12px; font-weight: 700; margin-bottom: 16px; }}
        .footer-note {{ margin-top: 20px; font-size: 11px; color: #64748b; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">🛡️</div>
        <h2>Güvenli Wi-Fi Kurulum İndirme</h2>
        <p>İzinsiz kopyalama ve indirmeleri önlemek için lütfen <strong>Yönetici / Kasiyer PIN Kodunu</strong> girin.</p>
        
        {f'<div class="err">{error_msg}</div>' if error_msg else ''}
        
        <form method="POST" action="/indir">
          <div class="inp-group">
            <label for="pin">Yönetici Şifresi / PIN Kodu:</label>
            <input type="password" id="pin" name="pin" autofocus placeholder="••••" required autocomplete="off">
          </div>
          <button type="submit" class="btn">
            <span>📥</span>
            <span>Doğrula ve Setup İndir</span>
          </button>
        </form>
        
        <div class="footer-note">OYMAPOS Market Raf Etiketi & POS Güvenlik Sistemi</div>
      </div>
    </body>
    </html>
    """
    return render_template_string(html_page)

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

    print("\n[BİLGİ] Sunucu çalışıyor. Durdurmak için CTRL+C tuşlarına basınız.\n")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[BİLGİ] Sunucu kullanıcı tarafından durduruldu.")

if __name__ == "__main__":
    main()
