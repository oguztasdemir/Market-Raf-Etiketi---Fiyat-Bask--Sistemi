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

def main():
    port = 5000
    
    # Start the backend web/API server in a background thread
    print("Desktop App: Starting background server on port 5000...")
    start_backend_server(port)
    
    # Give the server a second to initialize and bind
    time.sleep(1.0)
    
    api = DesktopApi()
    
    # Create the window in Fullscreen mode pointing to local server
    print("Desktop App: Launching Fullscreen GUI window...")
    window = webview.create_window(
        "OYMAPOS - Raf Etiketi & Satış Sistemi",
        f"http://127.0.0.1:{port}",
        fullscreen=True,
        width=1280,
        height=800,
        min_size=(1024, 768),
        js_api=api
    )
    api.window = window
    
    # Start the webview window loop (blocks until closed)
    webview.start()
    
    print("Desktop App: Window closed. Exiting.")

if __name__ == '__main__':
    main()
