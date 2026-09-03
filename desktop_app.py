# -*- coding: utf-8 -*-
import sys
import os
import time
import webview

# Ensure path includes directory of this script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from main import start_backend_server

class DesktopApi:
    def __init__(self):
        self.window = None

    def toggle_fullscreen(self):
        if self.window:
            self.window.toggle_fullscreen()
            return self.window.fullscreen
        return False

    def close_app(self):
        if self.window:
            self.window.destroy()
        else:
            os._exit(0)

def is_server_running(port=5000):
    """Check if the backend server is already running on port 5000."""
    import urllib.request
    try:
        req = urllib.request.Request(f"http://127.0.0.1:{port}/api/settings", headers={'User-Agent': 'DesktopAppHealth'})
        with urllib.request.urlopen(req, timeout=0.8) as res:
            return res.status == 200
    except Exception:
        return False

def main():
    port = 5000
    
    # Parse module or title argument
    # Usage: python desktop_app.py --module=manav (or --tab=tab-manav, --module=kasa, etc.)
    target_tab = None
    window_title = "OYMAPOS - Raf Etiketi & Satış Sistemi"
    
    for arg in sys.argv[1:]:
        if arg.startswith('--module=') or arg.startswith('--tab=') or arg.startswith('--page='):
            mod_val = arg.split('=', 1)[1].strip()
            target_tab = mod_val if mod_val.startswith('tab-') else f"tab-{mod_val}"
        elif arg == '--manav' or arg == '--terazi':
            target_tab = 'tab-manav'
            window_title = "OYMAPOS - Barkodlu Terazi & Manav Yönetimi"
        elif arg == '--katalog' or arg == '--stok':
            target_tab = 'tab-catalog'
            window_title = "OYMAPOS - Toplu Ürün & Stok Kataloğu"
        elif arg == '--hizli-urun' or arg == '--fiyat':
            target_tab = 'tab-sync'
            window_title = "OYMAPOS - Hızlı Ürün & Fiyat Değiştirme"
        elif arg == '--kasa' or arg == '--pos':
            target_tab = 'tab-pos'
            window_title = "OYMAPOS - Hızlı Kasa (POS) Satış Terminali"
        elif arg == '--tasarim' or arg == '--etiket':
            target_tab = 'tab-design'
            window_title = "OYMAPOS - Raf Etiketi & Şablon Tasarım Stüdyosu"

    if target_tab:
        if target_tab == 'tab-manav':
            window_title = "OYMAPOS - Barkodlu Terazi & Manav Yönetimi"
        elif target_tab == 'tab-catalog':
            window_title = "OYMAPOS - Toplu Ürün & Stok Kataloğu"
        elif target_tab == 'tab-sync':
            window_title = "OYMAPOS - Hızlı Ürün & Fiyat Değiştirme"
        elif target_tab == 'tab-pos':
            window_title = "OYMAPOS - Hızlı Kasa (POS) Satış Terminali"
        elif target_tab == 'tab-design':
            window_title = "OYMAPOS - Raf Etiketi & Şablon Tasarım Stüdyosu"

    # Start the backend server only if not already running (allows multiple concurrent window executables)
    if not is_server_running(port):
        print(f"Desktop App: Starting background server on port {port}...")
        start_backend_server(port)
        time.sleep(1.0)
    else:
        print(f"Desktop App: Backend server already active on port {port}. Attaching window directly.")

    api = DesktopApi()
    url_target = f"http://127.0.0.1:{port}" + (f"?tab={target_tab}" if target_tab else "")

    try:
        print(f"Desktop App: Launching GUI window '{window_title}' -> {url_target}")
        window = webview.create_window(
            window_title,
            url_target,
            fullscreen=(target_tab is None),
            width=1280,
            height=800,
            min_size=(1024, 768),
            js_api=api
        )
        api.window = window
        webview.start()
    except Exception as e:
        print(f"Webview GUI baslatilamadi ({e}). Varsayilan tarayici uzerinden aciliyor...")
        import webbrowser
        webbrowser.open(url_target)
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            pass
    
    print(f"Desktop App ({window_title}): Window closed. Exiting.")

if __name__ == '__main__':
    main()

