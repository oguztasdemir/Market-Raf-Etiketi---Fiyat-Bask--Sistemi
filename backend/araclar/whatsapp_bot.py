# -*- coding: utf-8 -*-
import os
import time
import threading
import datetime
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from backend.araclar.depolama_araclari import load_json, save_json
from backend.ayarlar import DATA_DIR

CHROME_PROFILE_DIR = os.path.join(DATA_DIR, "whatsapp_chrome_profile")
QUEUE_FILE = os.path.join(DATA_DIR, "sistem_ve_ayarlar", "whatsapp_bot_queue.json")
MARKER_FILE = os.path.join(CHROME_PROFILE_DIR, "authenticated.marker")

class WhatsAppBot:
    def __init__(self):
        self.driver = None
        self.daemon_thread = None
        self.is_running = False
        self.lock = threading.Lock()
        self.status_msg = "Sistem başlatılmadı."
        
    def get_chrome_options(self, headless=True):
        options = Options()
        options.add_argument(f"--user-data-dir={CHROME_PROFILE_DIR}")
        options.add_argument("--profile-directory=Default")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--window-size=1200,800")
        options.add_argument("--disable-extensions")
        # Prevent automation detection
        options.add_argument("--disable-blink-features=AutomationControlled")
        options.add_experimental_option("useAutomationExtension", False)
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        
        if headless:
            options.add_argument("--headless=new")
        return options

    def check_setup_status(self):
        return os.path.exists(MARKER_FILE)

    def run_setup(self):
        """Kullanıcının QR kodunu taratması için görünür Chrome penceresi açar."""
        with self.lock:
            if self.is_running or self.driver:
                return False, "Bot zaten çalışıyor veya kurulum açık."
            
            try:
                os.makedirs(CHROME_PROFILE_DIR, exist_ok=True)
                options = self.get_chrome_options(headless=False)
                self.driver = webdriver.Chrome(options=options)
                self.status_msg = "Görünür Chrome açıldı. QR kod taranması bekleniyor..."
                
                self.driver.get("https://web.whatsapp.com")
                
                # Wait for main pane search box which indicates successful login
                print("WhatsApp Bot Setup: Waiting for QR Scan...")
                login_wait = WebDriverWait(self.driver, 120)
                login_wait.until(
                    EC.presence_of_element_located((By.XPATH, '//div[@contenteditable="true"]'))
                )
                
                # Create marker file
                with open(MARKER_FILE, "w") as f:
                    f.write(f"Authenticated at {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
                
                self.driver.quit()
                self.driver = None
                self.status_msg = "Giriş başarılı! Kurulum tamamlandı."
                return True, "Kurulum başarılı! Artık botu başlatabilirsiniz."
            except Exception as e:
                if self.driver:
                    try:
                        self.driver.quit()
                    except:
                        pass
                    self.driver = None
                self.status_msg = f"Kurulum hatası: {str(e)}"
                return False, f"Hata: {str(e)}"

    def start_daemon(self):
        """Arka planda headless mesaj gönderim botunu başlatır."""
        with self.lock:
            if self.is_running:
                return True, "Bot zaten arka planda çalışıyor."
            
            if not self.check_setup_status():
                return False, "Önce QR kodu taratarak kurulum yapmalısınız."
                
            self.is_running = True
            self.daemon_thread = threading.Thread(target=self._daemon_loop, name="WhatsAppBotDaemon", daemon=True)
            self.daemon_thread.start()
            self.status_msg = "Arka plan bot servisi aktif."
            return True, "Bot arka planda başlatıldı."

    def stop_daemon(self):
        """Bot servisini durdurur ve driver'ı kapatır."""
        with self.lock:
            self.is_running = False
            if self.driver:
                try:
                    self.driver.quit()
                except:
                    pass
                self.driver = None
            self.status_msg = "Bot durduruldu."
            return True, "Bot durduruldu."

    def _init_driver(self):
        if not self.driver:
            try:
                options = self.get_chrome_options(headless=True)
                self.driver = webdriver.Chrome(options=options)
                self.driver.get("https://web.whatsapp.com")
                # Wait briefly for session to load
                time.sleep(5)
            except Exception as e:
                print("Driver başlatılamadı:", e)
                self.driver = None

    def _daemon_loop(self):
        print("WhatsApp Bot: Arka plan döngüsü başladı.")
        
        while self.is_running:
            try:
                # Load queue
                queue = load_json(QUEUE_FILE, [])
                pending_items = [item for item in queue if item.get("status") == "pending"]
                
                if pending_items:
                    # Initialize browser if not already open
                    self._init_driver()
                    
                    if not self.driver:
                        print("WhatsApp Bot: Tarayıcı başlatılamadığı için bekleniyor...")
                        time.sleep(10)
                        continue
                        
                    for item in pending_items:
                        if not self.is_running:
                            break
                            
                        phone = item.get("phone", "").replace("+", "").replace(" ", "").strip()
                        text = item.get("text", "")
                        item_id = item.get("id")
                        
                        print(f"WhatsApp Bot: Mesaj gönderiliyor -> {phone}")
                        
                        # Process sending
                        success = self._send_via_selenium(phone, text)
                        
                        # Reload queue to prevent race conditions during write
                        queue = load_json(QUEUE_FILE, [])
                        for q in queue:
                            if q.get("id") == item_id:
                                q["status"] = "sent" if success else "failed"
                                q["sent_at"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                                break
                        save_json(QUEUE_FILE, queue[-200:])
                        
                # Sleep between queue checks
                time.sleep(5)
                
            except Exception as e:
                print("WhatsApp Bot Daemon Hatası:", e)
                time.sleep(5)
                
        # Clean up driver on loop exit
        if self.driver:
            try:
                self.driver.quit()
            except:
                pass
            self.driver = None
        print("WhatsApp Bot: Arka plan döngüsü sonlandı.")

    def _send_via_selenium(self, phone, text):
        try:
            # Navigate to direct link
            encoded_text = urllib_parse_quote(text) if 'urllib_parse_quote' in globals() else text
            # Since we can just format text or use python's urllib
            import urllib.parse
            encoded_text = urllib.parse.quote(text)
            
            url = f"https://web.whatsapp.com/send?phone={phone}&text={encoded_text}"
            self.driver.get(url)
            
            # Wait for either Send button OR invalid number dialog
            wait = WebDriverWait(self.driver, 35)
            
            # Custom expected condition to check for send button or invalid alert
            def send_or_error_check(d):
                # Check for send button
                send_buttons = d.find_elements(By.XPATH, '//span[@data-icon="send"]/ancestor::button')
                if send_buttons:
                    return send_buttons[0]
                    
                # Check for invalid number dialog (containing "bulunmuyor" or "invalid")
                dialogs = d.find_elements(By.XPATH, '//div[contains(text(), "bulunmuyor") or contains(text(), "invalid") or contains(text(), "geçersiz")]')
                if dialogs:
                    return "error_dialog"
                return False
                
            result = wait.until(send_or_error_check)
            
            if result == "error_dialog":
                print(f"WhatsApp Bot: Numara geçersiz ({phone})")
                # Dismiss dialog
                ok_buttons = self.driver.find_elements(By.XPATH, '//button//div[contains(text(), "Tamam") or contains(text(), "OK")]')
                if ok_buttons:
                    ok_buttons[0].click()
                return False
                
            # Click send button
            result.click()
            # Wait 5 seconds for message to transmit
            time.sleep(5)
            return True
            
        except Exception as e:
            print(f"WhatsApp Bot Gönderim Hatası ({phone}):", e)
            return False

# Global bot instance
wp_bot = WhatsAppBot()
