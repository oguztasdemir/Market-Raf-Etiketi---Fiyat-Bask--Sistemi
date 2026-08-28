# -*- coding: utf-8 -*-
"""
Market Raf Etiketi & Barkodlu POS Sistemi - Masaüstü GUI & EXE Başlatıcı (web_gui.py)
----------------------------------------------------------------------------------
Bu dosya PyInstaller ile .EXE üretmek ve masaüstü bağımsız pencere (PyWebView)
olarak çalıştırmak için tasarlanmıştır.

Kullanım:
  1. Python ile doğrudan çalıştırma: python web_gui.py
  2. PyInstaller ile EXE derleme: pyinstaller --noconsole --onefile web_gui.py
"""
import os
import sys
import time
import threading

# Windows terminal Türkçe karakter ve High-DPI desteği
if sys.platform.startswith('win'):
    try:
        if hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        if hasattr(sys.stderr, 'reconfigure'):
            sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

# Proje dizinini Python yoluna ekle
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from backend.araclar.excel_dosya_izleyici import get_local_ip
from backend.katalog.excel_katalog_servisi import clear_diff_cache
from main import app, start_backend_server, start_code_watcher

def run_desktop_app():
    """Arka planda sunucuyu başlatır ve PyWebView masaüstü penceresini açar."""
    port = 5000
    local_ip = get_local_ip()

    # Dosya ve kod değişiklik izleyicisini başlat
    start_code_watcher(on_change_callback=clear_diff_cache)

    print("=" * 70)
    print("💻 [EXE / MASAÜSTÜ GUI] Market Yönetim Sistemi Başlatılıyor...")
    print(f"[*] Yerel Arayüz         : http://127.0.0.1:{port}")
    print(f"[*] Yerel Ağ / Web       : http://{local_ip}:{port}")
    print(f"[*] Mobil Kamera (HTTPS) : https://{local_ip}:{port + 1}/mobile")
    print("=" * 70)

    # 1. Arka planda sunucuyu başlat
    start_backend_server(port)
    time.sleep(0.5)

    # 2. PyWebView ile Masaüstü Penceresi Aç
    try:
        import webview
        
        # Pencereyi oluştur
        window = webview.create_window(
            title="Market Raf Etiketi & POS Yönetim Sistemi",
            url=f"http://127.0.0.1:{port}",
            width=1366,
            height=768,
            min_size=(1024, 600),
            confirm_close=False,
            text_select=True,
            zoomable=True
        )

        def on_closed():
            print("\n[BİLGİ] Masaüstü penceresi kapatıldı. Uygulama sonlandırılıyor...")
            os._exit(0)

        window.events.closed += on_closed

        # Webview GUI döngüsünü başlat
        webview.start(private_mode=False)

    except Exception as e:
        print(f"[UYARI] PyWebView başlatılamadı ({e}), standart tarayıcı açılıyor...")
        import webbrowser
        webbrowser.open(f"http://127.0.0.1:{port}")
        
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            os._exit(0)

if __name__ == "__main__":
    run_desktop_app()
