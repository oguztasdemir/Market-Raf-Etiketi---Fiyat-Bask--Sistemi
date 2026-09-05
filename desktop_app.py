# -*- coding: utf-8 -*-
import sys
import os

# Windows 7 DLL Uyumluluk ve Yükleme Koruması
if sys.platform.startswith('win'):
    cur_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.abspath(os.path.join(cur_dir, "..")) if os.path.basename(cur_dir).lower() == "app" else cur_dir
    py_dir = os.path.join(root_dir, "python_runtime")
    bin_dir = os.path.join(root_dir, "app", "bin")
    
    # DLLs ve pywin32 yollarını ekle
    dll_paths = [
        py_dir,
        os.path.join(py_dir, "DLLs"),
        os.path.join(py_dir, "Lib", "site-packages", "pywin32_system32"),
        os.path.join(py_dir, "Lib", "site-packages", "win32"),
        bin_dir,
        root_dir
    ]
    for p in dll_paths:
        if os.path.isdir(p):
            if p not in sys.path:
                sys.path.insert(0, p)
            cur_p = os.environ.get("PATH", "")
            if p not in cur_p:
                os.environ["PATH"] = p + ";" + cur_p
    
    # Win32 SetDllDirectoryW ve DLL ön-yükleme ile _socket / select çözümlemesini garantiye al
    try:
        import ctypes
        ctypes.windll.kernel32.SetDllDirectoryW(py_dir)
        # Windows 7 ws2_32, ucrtbase ve vcruntime140'ı belleğe al
        ctypes.windll.kernel32.LoadLibraryW("ws2_32.dll")
        if os.path.exists(os.path.join(py_dir, "ucrtbase.dll")):
            ctypes.cdll.LoadLibrary(os.path.join(py_dir, "ucrtbase.dll"))
        if os.path.exists(os.path.join(py_dir, "vcruntime140.dll")):
            ctypes.cdll.LoadLibrary(os.path.join(py_dir, "vcruntime140.dll"))
        if os.path.exists(os.path.join(py_dir, "api-ms-win-core-path-l1-1-0.dll")):
            ctypes.cdll.LoadLibrary(os.path.join(py_dir, "api-ms-win-core-path-l1-1-0.dll"))
    except Exception:
        pass

# Windows 7 select & selectors çökme koruması
try:
    import select
except Exception:
    import types
    mod_select = types.ModuleType('select')
    mod_select.error = OSError
    def dummy_select(r, w, x, t=None):
        import time
        if t: time.sleep(min(t, 0.05))
        return list(r), list(w), list(x)
    mod_select.select = dummy_select
    sys.modules['select'] = mod_select

try:
    import selectors
except Exception:
    pass

import time

try:
    import webview
    HAS_WEBVIEW = True
except Exception:
    webview = None
    HAS_WEBVIEW = False

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
        # Sunucu tam hazır olana kadar bekle (Maksimum 6 saniye)
        for _ in range(30):
            time.sleep(0.2)
            if is_server_running(port):
                break
    else:
        print(f"Desktop App: Backend server already active on port {port}. Attaching window directly.")

    url_target = f"http://127.0.0.1:{port}" + (f"?tab={target_tab}" if target_tab else "")

    # Windows 7 uyumluluğu için GUI başlatma denemesi
    gui_started = False
    if HAS_WEBVIEW and webview:
        try:
            print(f"Desktop App: Launching GUI window '{window_title}' -> {url_target}")
            api = DesktopApi()
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
            # Windows 7'de edgechromium yerine winforms/mshtml veya otomatik mod denenir
            webview.start()
            gui_started = True
            return
        except Exception as e:
            print(f"[UYARI] Webview GUI baslatilamadi ({e}). Tarayici moduna geciliyor...")

    # Webview yoksa veya Windows 7'de başlatılamazsa kurulu olan tarayıcılarda bağımsız uygulama modunda aç
    import subprocess
    import webbrowser
    
    browser_candidates = [
        [r"C:\Program Files\Google\Chrome\Application\chrome.exe", f"--app={url_target}", "--start-maximized"],
        [r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe", f"--app={url_target}", "--start-maximized"],
        [r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe", f"--app={url_target}", "--start-maximized"],
        [r"C:\Program Files\Microsoft\Edge\Application\msedge.exe", f"--app={url_target}", "--start-maximized"],
        [r"C:\Program Files\Mozilla Firefox\firefox.exe", "-kiosk", url_target],
        [r"C:\Program Files (x86)\Mozilla Firefox\firefox.exe", "-kiosk", url_target],
        [r"C:\Program Files\Opera\launcher.exe", url_target]
    ]
    
    opened = False
    for b_info in browser_candidates:
        b_path = b_info[0]
        if os.path.exists(b_path):
            try:
                subprocess.Popen(b_info)
                opened = True
                print(f"Desktop App: Tarayici pencere modunda baslatildi: {b_path}")
                break
            except Exception:
                pass

    if not opened:
        try:
            webbrowser.open(url_target)
            print("Desktop App: Varsayilan tarayicida acildi.")
        except Exception as e:
            print(f"Desktop App Tarayici Hatasi: {e}")

    # Arka plan sunucusunun kapanmaması için bekleme döngüsü
    try:
        while True:
            time.sleep(1)
    except (KeyboardInterrupt, SystemExit):
        pass

if __name__ == '__main__':
    main()

