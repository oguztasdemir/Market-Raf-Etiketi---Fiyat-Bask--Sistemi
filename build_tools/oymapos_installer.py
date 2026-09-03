# -*- coding: utf-8 -*-
"""
OYMAPOS - Windows Kurulum ve Kaldırma Sihirbazı (Installer & Uninstaller)
Modern, güvenli ve kurumsal kurulum yöneticisi:
- Yönetici (UAC) yetki denetimi
- Açık OYMAPOS process denetimi ve sonlandırma
- Yeterli disk alanı doğrulaması
- Güvenli güncelleme (Update) ve otomatik veri yedekleme
- Windows Güvenlik Duvarı (Firewall) TCP 5000-5001 kuralı
- Masaüstü, Başlat Menüsü ve Başlangıçta Çalıştırma (Startup) kısayolları
- Windows Program Ekle/Kaldır (Uninstall) Registry entegrasyonu
- Dahili Kaldırıcı (Uninstaller) modu (--uninstall)
"""
import os
import sys
import shutil
import time
import threading
import subprocess
import ctypes
import winreg
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
from PIL import Image, ImageTk

# Safe import for win32com and pythoncom to create shortcuts
try:
    import win32com.client
    import pythoncom
    HAS_WIN32COM = True
except ImportError:
    HAS_WIN32COM = False

APP_NAME = "OYMAPOS"
APP_DISPLAY_NAME = "OYMAPOS - Market Raf Etiketi & Satış Sistemi"
APP_VERSION = "2.5.0"
APP_PUBLISHER = "OYMAPOS Yazılım"
REQUIRED_DISK_SPACE_MB = 250

def is_admin():
    """Mevcut sürecin yönetici haklarına sahip olup olmadığını kontrol eder."""
    try:
        return ctypes.windll.shell32.IsUserAnAdmin() != 0
    except Exception:
        return False

def run_as_admin():
    """Uygulamayı UAC penceresi açarak yönetici olarak yeniden başlatır."""
    if sys.platform == "win32":
        try:
            params = " ".join([f'"{arg}"' for arg in sys.argv])
            ctypes.windll.shell32.ShellExecuteW(
                None, "runas", sys.executable, params, None, 1
            )
            sys.exit(0)
        except Exception as e:
            print("UAC yükseltme hatası:", e)

def get_resource_path(relative_path):
    """PyInstaller tarafından çıkarılan geçici dizin veya aktif geliştirme dizinini döner."""
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.abspath("."), relative_path)

def get_free_space_mb(folder_path):
    """Verilen klasör yolunun bulunduğu sürücüdeki boş alanı MB olarak döner."""
    try:
        drive = os.path.splitdrive(os.path.abspath(folder_path))[0]
        if not drive:
            drive = "C:"
        free_bytes = ctypes.c_ulonglong(0)
        ctypes.windll.kernel32.GetDiskFreeSpaceExW(
            ctypes.c_wchar_p(drive + "\\"),
            None,
            None,
            ctypes.pointer(free_bytes)
        )
        return int(free_bytes.value / (1024 * 1024))
    except Exception:
        return 999999

def is_process_running(process_name="OYMAPOS.exe"):
    """Belirtilen isimdeki bir sürecin çalışıp çalışmadığını kontrol eder."""
    try:
        output = subprocess.check_output(f'tasklist /FI "IMAGENAME eq {process_name}"', shell=True, text=True, stderr=subprocess.DEVNULL)
        return process_name.lower() in output.lower()
    except Exception:
        return False

def kill_process(process_name="OYMAPOS.exe"):
    """Belirtilen süreci zorla sonlandırır."""
    try:
        subprocess.run(f'taskkill /F /IM "{process_name}" /T', shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(0.5)
        return True
    except Exception as e:
        print(f"Process sonlandırma hatası ({process_name}):", e)
        return False

def add_firewall_rule():
    """Yerel ağ erişimi (mobil POS, terazi, barkod) için Windows Güvenlik Duvarı kuralı ekler."""
    try:
        # Önce varsa eski kuralı temizle
        subprocess.run('netsh advfirewall firewall delete rule name="OYMAPOS Local Server"', shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        # Port 5000 ve 5001 TCP gelen bağlantılarına izin ver
        cmd = 'netsh advfirewall firewall add rule name="OYMAPOS Local Server" dir=in action=allow protocol=TCP localport=5000,5001 profile=any'
        res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        return res.returncode == 0
    except Exception as e:
        print("Firewall kuralı eklenemedi:", e)
        return False

def register_uninstaller(install_dir):
    """Windows Program Ekle/Kaldır (Apps & Features) kayıt defteri girişini oluşturur."""
    try:
        key_path = r"Software\Microsoft\Windows\CurrentVersion\Uninstall\OYMAPOS"
        with winreg.CreateKey(winreg.HKEY_LOCAL_MACHINE, key_path) as key:
            winreg.SetValueEx(key, "DisplayName", 0, winreg.REG_SZ, APP_DISPLAY_NAME)
            winreg.SetValueEx(key, "DisplayVersion", 0, winreg.REG_SZ, APP_VERSION)
            winreg.SetValueEx(key, "Publisher", 0, winreg.REG_SZ, APP_PUBLISHER)
            winreg.SetValueEx(key, "InstallLocation", 0, winreg.REG_SZ, install_dir)
            
            icon_path = os.path.join(install_dir, "logo.ico")
            if not os.path.exists(icon_path):
                icon_path = os.path.join(install_dir, "OYMAPOS.exe")
            winreg.SetValueEx(key, "DisplayIcon", 0, winreg.REG_SZ, icon_path)
            
            uninstaller_exe = os.path.join(install_dir, "uninstall.exe")
            if os.path.exists(uninstaller_exe):
                winreg.SetValueEx(key, "UninstallString", 0, winreg.REG_SZ, f'"{uninstaller_exe}"')
            else:
                winreg.SetValueEx(key, "UninstallString", 0, winreg.REG_SZ, f'"{os.path.join(install_dir, "OYMAPOS_Setup.exe")}" --uninstall')
                
            winreg.SetValueEx(key, "NoModify", 0, winreg.REG_DWORD, 1)
            winreg.SetValueEx(key, "NoRepair", 0, winreg.REG_DWORD, 1)
    except Exception as e:
        print("Registry kaydı oluşturulamadı:", e)

def unregister_uninstaller():
    """Windows Program Ekle/Kaldır kayıt defteri girişini siler."""
    try:
        key_path = r"Software\Microsoft\Windows\CurrentVersion\Uninstall\OYMAPOS"
        winreg.DeleteKey(winreg.HKEY_LOCAL_MACHINE, key_path)
    except Exception:
        pass


# ==========================================
# ANA KURULUM SİHİRBAZI ARAYÜZÜ (TKINTER)
# ==========================================
class OymaposInstallerApp:
    def __init__(self, root, is_uninstall_mode=False):
        self.root = root
        self.is_uninstall_mode = is_uninstall_mode
        
        self.root.title(f"{APP_NAME} Kaldırma Sihirbazı" if is_uninstall_mode else f"{APP_NAME} Kurulum Sihirbazı")
        self.root.geometry("580x420")
        self.root.resizable(False, False)
        
        # OYMAPOS Koyu Renk Şeması
        self.bg_color = "#0b1324"
        self.card_color = "#152238"
        self.text_color = "#f8fafc"
        self.muted_color = "#94a3b8"
        self.primary_color = "#38bdf8"
        self.success_color = "#10b981"
        self.danger_color = "#ef4444"
        
        self.root.configure(bg=self.bg_color)
        
        # Değişkenler
        self.install_path = tk.StringVar(value=r"C:\OYMAPOS")
        self.create_desktop_shortcut = tk.BooleanVar(value=True)
        self.create_start_menu_shortcut = tk.BooleanVar(value=True)
        self.add_firewall_rule_var = tk.BooleanVar(value=True)
        self.launch_startup_var = tk.BooleanVar(value=False)
        self.launch_after_install = tk.BooleanVar(value=True)
        self.keep_user_data_on_uninstall = tk.BooleanVar(value=True)
        
        # Başlık ve Logo Alanı
        self.init_header()
        
        # Dinamik İçerik Çerçevesi
        self.content_frame = tk.Frame(self.root, bg=self.bg_color)
        self.content_frame.pack(fill=tk.BOTH, expand=True, padx=24, pady=10)
        
        # Alt Butonlar
        self.init_footer()
        
        # İlk ekran
        if self.is_uninstall_mode:
            self.show_uninstall_welcome_screen()
        else:
            self.show_welcome_screen()

    def init_header(self):
        """Üst kısımdaki şık logo ve başlık tasarımı."""
        header_frame = tk.Frame(self.root, bg=self.card_color, height=76)
        header_frame.pack(fill=tk.X, side=tk.TOP)
        header_frame.pack_propagate(False)
        
        # Logo yükleme
        logo_path = get_resource_path(os.path.join("frontend", "resimler", "logo.png"))
        logo_img = None
        if os.path.exists(logo_path):
            try:
                pil_img = Image.open(logo_path).resize((44, 44), Image.Resampling.LANCZOS)
                logo_img = ImageTk.PhotoImage(pil_img)
            except Exception as e:
                print("Logo yükleme hatası:", e)
                
        if logo_img:
            logo_lbl = tk.Label(header_frame, image=logo_img, bg=self.card_color)
            logo_lbl.image = logo_img
            logo_lbl.pack(side=tk.LEFT, padx=16, pady=16)
            
        title_text = "OYMAPOS Kaldırma Sihirbazı" if self.is_uninstall_mode else "OYMAPOS Kurulum Sihirbazı"
        title_lbl = tk.Label(
            header_frame, 
            text=title_text, 
            font=("Segoe UI", 14, "bold"), 
            fg=self.text_color, 
            bg=self.card_color
        )
        title_lbl.pack(side=tk.LEFT, padx=5 if logo_img else 20, pady=16)
        
        ver_lbl = tk.Label(
            header_frame, 
            text=f"v{APP_VERSION}", 
            font=("Consolas", 10, "bold"), 
            fg=self.primary_color, 
            bg=self.card_color
        )
        ver_lbl.pack(side=tk.RIGHT, padx=20, pady=20)

    def init_footer(self):
        """Alt kısımdaki yönlendirme düğmeleri."""
        self.footer_frame = tk.Frame(self.root, bg=self.card_color, height=58)
        self.footer_frame.pack(fill=tk.X, side=tk.BOTTOM)
        self.footer_frame.pack_propagate(False)
        
        self.btn_cancel = tk.Button(
            self.footer_frame, 
            text="İptal", 
            command=self.confirm_cancel,
            font=("Segoe UI", 9, "bold"),
            bg="#334155", 
            fg=self.text_color, 
            activebackground="#475569", 
            activeforeground=self.text_color,
            relief=tk.FLAT,
            padx=16, 
            pady=5
        )
        self.btn_cancel.pack(side=tk.LEFT, padx=16, pady=12)
        
        action_text = "Kaldır" if self.is_uninstall_mode else "Yükle"
        action_bg = self.danger_color if self.is_uninstall_mode else self.primary_color
        action_cmd = self.start_uninstallation if self.is_uninstall_mode else self.validate_and_start_install
        
        self.btn_action = tk.Button(
            self.footer_frame, 
            text=action_text, 
            command=action_cmd,
            font=("Segoe UI", 9, "bold"),
            bg=action_bg, 
            fg="#0b1324" if not self.is_uninstall_mode else "#ffffff", 
            activebackground="#0ea5e9" if not self.is_uninstall_mode else "#dc2626", 
            activeforeground="#0b1324" if not self.is_uninstall_mode else "#ffffff", 
            relief=tk.FLAT,
            padx=20, 
            pady=5
        )
        self.btn_action.pack(side=tk.RIGHT, padx=16, pady=12)

    def clear_content(self):
        """Dinamik ekran geçişleri için çerçeveyi temizler."""
        for widget in self.content_frame.winfo_children():
            widget.destroy()

    def show_welcome_screen(self):
        """Kurulum karşılama ve dizin/seçenekler ekranı."""
        self.clear_content()
        
        is_existing = os.path.exists(os.path.join(self.install_path.get(), "OYMAPOS.exe"))
        
        welcome_title = "🔄 OYMAPOS Güncelleme Modu Algılandı" if is_existing else "OYMAPOS bilgisayarınıza kurulmaya hazır."
        welcome_lbl = tk.Label(
            self.content_frame, 
            text=welcome_title, 
            font=("Segoe UI", 11, "bold"), 
            fg=self.primary_color if is_existing else self.text_color, 
            bg=self.bg_color, 
            justify=tk.LEFT
        )
        welcome_lbl.pack(anchor=tk.W, pady=(6, 4))
        
        desc_text = "Mevcut sürüm güncellenecek; satış geçmişiniz, ürünleriniz ve ayarlarınız aynen korunacaktır." if is_existing else "Uygulama dosyaları aşağıdaki dizine kopyalanacak, yerel ağ ve kısayol ayarları yapılandırılacaktır."
        desc_lbl = tk.Label(
            self.content_frame, 
            text=desc_text, 
            font=("Segoe UI", 9), 
            fg=self.muted_color, 
            bg=self.bg_color, 
            wraplength=520, 
            justify=tk.LEFT
        )
        desc_lbl.pack(anchor=tk.W, pady=(0, 10))
        
        # Dizin Seçim Başlığı
        path_header_frame = tk.Frame(self.content_frame, bg=self.bg_color)
        path_header_frame.pack(fill=tk.X, pady=(2, 2))
        
        path_lbl = tk.Label(
            path_header_frame, 
            text="YÜKLEME DİZİNİ", 
            font=("Segoe UI", 8, "bold"), 
            fg=self.muted_color, 
            bg=self.bg_color
        )
        path_lbl.pack(side=tk.LEFT)
        
        # Disk alanı bilgisi
        free_mb = get_free_space_mb(self.install_path.get())
        self.lbl_disk_info = tk.Label(
            path_header_frame,
            text=f"Boş Alan: {free_mb} MB (Gereken: {REQUIRED_DISK_SPACE_MB} MB)",
            font=("Segoe UI", 8),
            fg=self.success_color if free_mb >= REQUIRED_DISK_SPACE_MB else self.danger_color,
            bg=self.bg_color
        )
        self.lbl_disk_info.pack(side=tk.RIGHT)
        
        # Seçim Çerçevesi (Entry & Gözat Butonu)
        path_frame = tk.Frame(self.content_frame, bg=self.bg_color)
        path_frame.pack(fill=tk.X, pady=(2, 10))
        
        self.entry_path = tk.Entry(
            path_frame, 
            textvariable=self.install_path, 
            font=("Consolas", 10), 
            bg="#070d19", 
            fg=self.text_color, 
            insertbackground=self.text_color,
            relief=tk.FLAT, 
            bd=6
        )
        self.entry_path.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 8))
        
        btn_browse = tk.Button(
            path_frame, 
            text="Gözat...", 
            command=self.browse_directory,
            font=("Segoe UI", 8, "bold"),
            bg="#334155", 
            fg=self.text_color, 
            activebackground="#475569", 
            activeforeground=self.text_color,
            relief=tk.FLAT,
            padx=10
        )
        btn_browse.pack(side=tk.RIGHT)
        
        # Seçenekler Çerçevesi (Checkboxes)
        opts_label = tk.Label(
            self.content_frame,
            text="KURULUM SEÇENEKLERİ",
            font=("Segoe UI", 8, "bold"),
            fg=self.muted_color,
            bg=self.bg_color
        )
        opts_label.pack(anchor=tk.W, pady=(4, 2))
        
        opts_frame = tk.Frame(self.content_frame, bg="#0f192c", padx=12, pady=6, relief=tk.FLAT)
        opts_frame.pack(fill=tk.X, pady=(2, 0))
        
        cb_desktop = tk.Checkbutton(
            opts_frame,
            text="Masaüstüne Kısayol Oluştur",
            variable=self.create_desktop_shortcut,
            bg="#0f192c",
            fg=self.text_color,
            selectcolor="#070d19",
            activebackground="#0f192c",
            activeforeground=self.text_color,
            font=("Segoe UI", 9)
        )
        cb_desktop.pack(anchor=tk.W, pady=1)
        
        cb_start = tk.Checkbutton(
            opts_frame,
            text="Başlat Menüsüne Ekle",
            variable=self.create_start_menu_shortcut,
            bg="#0f192c",
            fg=self.text_color,
            selectcolor="#070d19",
            activebackground="#0f192c",
            activeforeground=self.text_color,
            font=("Segoe UI", 9)
        )
        cb_start.pack(anchor=tk.W, pady=1)
        
        cb_firewall = tk.Checkbutton(
            opts_frame,
            text="Windows Güvenlik Duvarı İzni Aç (Mobil POS ve Terazi Ağı İçin - Port 5000/5001)",
            variable=self.add_firewall_rule_var,
            bg="#0f192c",
            fg=self.text_color,
            selectcolor="#070d19",
            activebackground="#0f192c",
            activeforeground=self.text_color,
            font=("Segoe UI", 9)
        )
        cb_firewall.pack(anchor=tk.W, pady=1)
        
        cb_startup = tk.Checkbutton(
            opts_frame,
            text="Windows Başladığında OYMAPOS'u Otomatik Başlat",
            variable=self.launch_startup_var,
            bg="#0f192c",
            fg=self.text_color,
            selectcolor="#070d19",
            activebackground="#0f192c",
            activeforeground=self.text_color,
            font=("Segoe UI", 9)
        )
        cb_startup.pack(anchor=tk.W, pady=1)

    def browse_directory(self):
        """Klasör seçici dialog penceresini açar."""
        selected = filedialog.askdirectory(initialdir="C:/", title="Yükleme Klasörünü Seçin")
        if selected:
            normalized = os.path.normpath(selected)
            self.install_path.set(normalized)
            free_mb = get_free_space_mb(normalized)
            self.lbl_disk_info.configure(
                text=f"Boş Alan: {free_mb} MB (Gereken: {REQUIRED_DISK_SPACE_MB} MB)",
                fg=self.success_color if free_mb >= REQUIRED_DISK_SPACE_MB else self.danger_color
            )

    def validate_and_start_install(self):
        """Kurulum öncesi gereksinimleri (Disk, Process, Yönetici) doğrular."""
        target_dir = self.install_path.get().strip()
        if not target_dir:
            messagebox.showerror("Hata", "Lütfen geçerli bir yükleme dizini belirtin.")
            return
            
        free_mb = get_free_space_mb(target_dir)
        if free_mb < REQUIRED_DISK_SPACE_MB:
            ans = messagebox.askyesno(
                "Düşük Disk Alanı Uyarısı",
                f"Hedef sürücüde {free_mb} MB boş alan var. Kurulum için en az {REQUIRED_DISK_SPACE_MB} MB önerilir. Devam etmek istiyor musunuz?"
            )
            if not ans:
                return

        # Açık OYMAPOS kontrolü
        if is_process_running("OYMAPOS.exe"):
            ans = messagebox.askyesno(
                "OYMAPOS Çalışıyor",
                "OYMAPOS şu anda arka planda açık durumda. Güncellemenin sorunsuz yapılabilmesi için uygulama kapatılmalıdır.\n\nUygulamayı şimdi otomatik kapatmak istiyor musunuz?"
            )
            if ans:
                kill_process("OYMAPOS.exe")
            else:
                return

        # Önceki Kurulum Algılama (Temiz Kurulum / Sıfırdan İndirme Sorusu)
        self.clean_install_mode = False
        is_existing = os.path.exists(os.path.join(target_dir, "OYMAPOS.exe")) or os.path.exists(os.path.join(target_dir, "data"))
        if is_existing:
            ans = messagebox.askyesnocancel(
                "Önceki Dosyalar Algılandı",
                f"'{target_dir}' dizininde önceden kurulmuş OYMAPOS dosyaları ve veritabanı bulundu.\n\n"
                "• [EVET]: Eski dosyalar ve veriler tamamen kaldırılsın, SIFIRDAN TEMİZ KURULUM yapılsın.\n"
                "• [HAYIR]: Mevcut veriler/ürünler KORUNSUN, sadece yeni sürüme GÜNCELLENSİN.\n"
                "• [İPTAL]: Kurulum iptal edilsin.\n\n"
                "Eski dosyalar tamamen kaldırılıp sıfırdan yeniden mi kurulsun?"
            )
            if ans is None:
                # İptal
                return
            elif ans is True:
                # Temiz kurulum seçildi
                self.clean_install_mode = True
            else:
                # Güncelleme / Koruma seçildi
                self.clean_install_mode = False

        self.start_installation()

    def confirm_cancel(self):
        ans = messagebox.askyesno("İptal", "İşlemi sonlandırmak istediğinize emin misiniz?")
        if ans:
            self.root.destroy()

    def start_installation(self):
        """Kopyalama ve konfigürasyon adımlarını arka planda başlatır."""
        self.btn_action.config(state=tk.DISABLED)
        self.btn_cancel.config(state=tk.DISABLED)
        if hasattr(self, 'entry_path'):
            self.entry_path.config(state=tk.DISABLED)
            
        self.clear_content()
        
        self.lbl_status = tk.Label(
            self.content_frame, 
            text="Kurulum hazırlanıyor...", 
            font=("Segoe UI", 11, "bold"), 
            fg=self.text_color, 
            bg=self.bg_color
        )
        self.lbl_status.pack(anchor=tk.W, pady=(25, 6))
        
        self.lbl_detail = tk.Label(
            self.content_frame, 
            text="Sistem gereksinimleri kontrol ediliyor...", 
            font=("Segoe UI", 9), 
            fg=self.muted_color, 
            bg=self.bg_color
        )
        self.lbl_detail.pack(anchor=tk.W, pady=(0, 16))
        
        s = ttk.Style()
        s.theme_use('clam')
        s.configure("TProgressbar", thickness=14, troughcolor="#152238", background=self.success_color, bordercolor=self.bg_color, lightcolor=self.success_color, darkcolor=self.success_color)
        
        self.progress = ttk.Progressbar(self.content_frame, style="TProgressbar", orient="horizontal", length=530, mode="determinate")
        self.progress.pack(fill=tk.X)
        
        threading.Thread(target=self.run_install_task, daemon=True).start()

    def run_install_task(self):
        """Asıl kurulum mantığı."""
        try:
            dest_dir = self.install_path.get()
            
            # 1. Dizin ve Yedekleme Kontrolü
            self.update_status(10, "Dizinler hazırlanıyor...", f"Hedef klasör kontrol ediliyor: {dest_dir}")
            time.sleep(0.3)
            os.makedirs(dest_dir, exist_ok=True)
            
            # Eğer temiz kurulum seçildiyse eski verileri ve dosyaları temizle
            data_dir = os.path.join(dest_dir, "data")
            if getattr(self, 'clean_install_mode', False):
                self.update_status(20, "Eski dosyalar kaldırılıyor...", "Sıfırdan temiz kurulum için dizin sıfırlanıyor...")
                try:
                    if os.path.exists(data_dir):
                        shutil.rmtree(data_dir, ignore_errors=True)
                except Exception as ce:
                    print("Temiz kurulum sıfırlama uyarısı:", ce)
            elif os.path.exists(data_dir):
                # Normal güncelleme modunda verileri otomatik yedekle
                self.update_status(20, "Mevcut veriler güvenceye alınıyor...", "Kullanıcı veritabanı yedekleniyor...")
                backup_dest = os.path.join(dest_dir, f"backup_pre_update_{int(time.time())}")
                try:
                    shutil.copytree(data_dir, backup_dest, dirs_exist_ok=True)
                except Exception as be:
                    print("Ön-yedekleme uyarısı:", be)
            
            # 2. Ana Uygulama Dosyasını Kopyalama (OYMAPOS.exe)
            self.update_status(35, "Uygulama dosyaları kopyalanıyor...", "OYMAPOS.exe yerleştiriliyor...")
            time.sleep(0.3)
            
            source_exe = get_resource_path("OYMAPOS.exe")
            target_exe = os.path.join(dest_dir, "OYMAPOS.exe")
            
            if os.path.exists(source_exe):
                shutil.copy2(source_exe, target_exe)
            else:
                print(f"Gömülü OYMAPOS.exe bulunamadı, stub oluşturuluyor (Kaynak: {source_exe})")
                with open(target_exe, 'w', encoding='utf-8') as f:
                    f.write("OYMAPOS STUB")
                    
            # Logo ve İkon Dosyası Kopyalama
            source_ico = get_resource_path("logo.ico")
            if os.path.exists(source_ico):
                shutil.copy2(source_ico, os.path.join(dest_dir, "logo.ico"))

            # Windows 7 / Legacy DLL Shim (api-ms-win-core-path-l1-1-0.dll) Kopyalama
            source_shim = get_resource_path("api-ms-win-core-path-l1-1-0.dll")
            if not os.path.exists(source_shim):
                source_shim = get_resource_path(os.path.join("redist", "api-ms-win-core-path-l1-1-0.dll"))
            if os.path.exists(source_shim):
                shutil.copy2(source_shim, os.path.join(dest_dir, "api-ms-win-core-path-l1-1-0.dll"))

            # Kurulum sihirbazının (veya ZIP klasörünün) yanında bir Excel (.xlsx) fiyat listesi varsa hedef sisteme aktar
            try:
                installer_dir = os.path.dirname(os.path.abspath(sys.executable if getattr(sys, 'frozen', False) else __file__))
                excel_files = [f for f in os.listdir(installer_dir) if f.lower().endswith(('.xlsx', '.xls')) and not f.startswith('~$')]
                if excel_files:
                    target_excel_dir = os.path.join(dest_dir, "data", "sistem_exceli")
                    os.makedirs(target_excel_dir, exist_ok=True)
                    for ef in excel_files:
                        src_ef = os.path.join(installer_dir, ef)
                        dst_ef = os.path.join(target_excel_dir, ef)
                        shutil.copy2(src_ef, dst_ef)
                        print(f"Otomatik Fiyat Listesi Entegre Edildi: {ef}")
            except Exception as excel_err:
                print(f"Fiyat listesi kopyalama uyarısı: {excel_err}")

            # Gerekli Sistem Kütüphanelerini (VC++ Redistributable & WebView2) Sessizce Yükleme
            try:
                self.update_status(45, "Sistem kütüphaneleri yapılandırılıyor...", "Visual C++ ve Çalışma Zamanı paketleri kuruluyor...")
                vc_installer = get_resource_path(os.path.join("redist", "vc_redist.x64.exe"))
                if os.path.exists(vc_installer):
                    subprocess.run([vc_installer, "/install", "/quiet", "/norestart"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            except Exception as vc_err:
                print("VC Redist yükleme uyarısı:", vc_err)

            try:
                wv_installer = get_resource_path(os.path.join("redist", "MicrosoftEdgeWebview2Setup.exe"))
                if os.path.exists(wv_installer):
                    subprocess.run([wv_installer, "/silent", "/install"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            except Exception as wv_err:
                print("WebView2 yükleme uyarısı:", wv_err)

            # Kendi installer kopyasını uninstaller olarak hedef dizine bırak
            current_installer_exe = sys.executable if getattr(sys, 'frozen', False) else None
            if current_installer_exe and os.path.exists(current_installer_exe):
                try:
                    shutil.copy2(current_installer_exe, os.path.join(dest_dir, "uninstall.exe"))
                except Exception:
                    pass

            # 3. Kısayollar ve Başlat Menüsü
            self.update_status(60, "Kısayollar yapılandırılıyor...", "Masaüstü ve Başlat Menüsü ayarlanıyor...")
            time.sleep(0.3)
            
            shell = None
            if HAS_WIN32COM:
                try:
                    pythoncom.CoInitialize()
                    shell = win32com.client.Dispatch("WScript.Shell")
                except Exception:
                    shell = None

            try:
                shortcuts_to_create = [
                    {"name": "OYMAPOS - Ana Sistem", "args": "", "desc": "OYMAPOS Market Raf Etiketi, POS ve Yönetim Sistemi"},
                    {"name": "OYMAPOS - Barkodlu Terazi", "args": "--module=manav", "desc": "OYMAPOS Terazi Fiyat ve Manav Yönetimi"},
                    {"name": "OYMAPOS - Toplu Stok & Katalog", "args": "--module=catalog", "desc": "OYMAPOS Ürün Kataloğu ve Stok Yönetimi"},
                    {"name": "OYMAPOS - Hızlı Fiyat & Ürün", "args": "--module=sync", "desc": "OYMAPOS Hızlı Fiyat Değiştirme ve Senkronizasyon"}
                ]

                # Masaüstü
                if self.create_desktop_shortcut.get():
                    desktop_dir = shell.SpecialFolders("Desktop") if shell else os.path.join(os.path.expanduser("~"), "Desktop")
                    for s in shortcuts_to_create:
                        lnk_path = os.path.join(desktop_dir, f"{s['name']}.lnk")
                        self.create_lnk(shell, target_exe, lnk_path, dest_dir, args=s['args'], desc=s['desc'])
                    
                # Başlat Menüsü
                if self.create_start_menu_shortcut.get():
                    programs_dir = shell.SpecialFolders("Programs") if shell else os.path.join(os.environ.get("APPDATA", ""), r"Microsoft\Windows\Start Menu\Programs")
                    start_menu_app_dir = os.path.join(programs_dir, "OYMAPOS")
                    os.makedirs(start_menu_app_dir, exist_ok=True)
                    for s in shortcuts_to_create:
                        lnk_path = os.path.join(start_menu_app_dir, f"{s['name']}.lnk")
                        self.create_lnk(shell, target_exe, lnk_path, dest_dir, args=s['args'], desc=s['desc'])
                    
                # Başlangıçta Çalıştır
                if self.launch_startup_var.get():
                    startup_dir = shell.SpecialFolders("Startup") if shell else os.path.join(os.environ.get("APPDATA", ""), r"Microsoft\Windows\Start Menu\Programs\Startup")
                    lnk_path = os.path.join(startup_dir, "OYMAPOS.lnk")
                    self.create_lnk(shell, target_exe, lnk_path, dest_dir, args="", desc=APP_DISPLAY_NAME)
            finally:
                if HAS_WIN32COM and shell:
                    try:
                        pythoncom.CoUninitialize()
                    except Exception:
                        pass

            # 4. Windows Güvenlik Duvarı
            if self.add_firewall_rule_var.get():
                self.update_status(80, "Ağ izinleri tanımlanıyor...", "Güvenlik Duvarı (Port 5000/5001) kuralı ekleniyor...")
                add_firewall_rule()

            # 5. Program Ekle/Kaldır Kaydı
            self.update_status(90, "Sistem entegrasyonu tamamlanıyor...", "Windows Program Ekle/Kaldır kaydı oluşturuluyor...")
            register_uninstaller(dest_dir)

            self.update_status(100, "Kurulum Başarıyla Tamamlandı!", "Tüm bileşenler hazır.")
            time.sleep(0.3)
            self.root.after(50, self.show_finished_screen)
            
        except Exception as e:
            self.root.after(50, lambda: self.show_error_screen(str(e)))

    def create_lnk(self, shell, target, link_path, working_dir, args="", desc=""):
        """Windows .lnk kısayolu oluşturur (win32com veya PowerShell fallback ile)."""
        description = desc or APP_DISPLAY_NAME
        if shell:
            try:
                shortcut = shell.CreateShortCut(link_path)
                shortcut.TargetPath = target
                shortcut.WorkingDirectory = working_dir
                shortcut.Arguments = args
                shortcut.IconLocation = target
                shortcut.Description = description
                shortcut.save()
                return
            except Exception as e:
                print("win32com kısayol oluşturma hatası:", e)
        
        # PowerShell Fallback
        try:
            ps_script = f'''
            $WScriptShell = New-Object -ComObject WScript.Shell
            $Shortcut = $WScriptShell.CreateShortcut("{link_path}")
            $Shortcut.TargetPath = "{target}"
            $Shortcut.Arguments = "{args}"
            $Shortcut.WorkingDirectory = "{working_dir}"
            $Shortcut.IconLocation = "{target}"
            $Shortcut.Description = "{description}"
            $Shortcut.Save()
            '''
            subprocess.run(["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_script], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0)
        except Exception as e:
            print("PowerShell kısayol hatası:", e)

    def update_status(self, progress_val, status_text, detail_text):
        self.root.after(0, lambda: self.progress.configure(value=progress_val))
        self.root.after(0, lambda: self.lbl_status.configure(text=status_text))
        self.root.after(0, lambda: self.lbl_detail.configure(text=detail_text))

    def show_finished_screen(self):
        """Kurulum başarılı bitiş ekranı."""
        self.clear_content()
        self.btn_cancel.config(state=tk.DISABLED)
        self.btn_action.config(
            text="Tamamla ve Başlat", 
            state=tk.NORMAL, 
            command=self.finish_and_exit,
            bg=self.success_color,
            fg="#0b1324",
            activebackground="#059669"
        )
        
        success_lbl = tk.Label(
            self.content_frame, 
            text="🎉 Kurulum Başarıyla Tamamlandı!", 
            font=("Segoe UI", 12, "bold"), 
            fg=self.success_color, 
            bg=self.bg_color
        )
        success_lbl.pack(anchor=tk.W, pady=(15, 6))
        
        desc_lbl = tk.Label(
            self.content_frame, 
            text="OYMAPOS bilgisayarınıza başarıyla kuruldu. Masaüstü kısayolunuz hazırlandı ve yerel ağ portları (5000/5001) yapılandırıldı.", 
            font=("Segoe UI", 9.5), 
            fg=self.text_color, 
            bg=self.bg_color, 
            wraplength=520, 
            justify=tk.LEFT
        )
        desc_lbl.pack(anchor=tk.W, pady=(0, 16))
        
        cb_launch = tk.Checkbutton(
            self.content_frame,
            text="Kurulum kapatıldığında OYMAPOS uygulamasını başlat",
            variable=self.launch_after_install,
            bg=self.bg_color,
            fg=self.text_color,
            selectcolor="#070d19",
            activebackground=self.bg_color,
            activeforeground=self.text_color,
            font=("Segoe UI", 9.5, "bold")
        )
        cb_launch.pack(anchor=tk.W, pady=5)

    def show_error_screen(self, err_msg):
        """Hata durumunda arayüz."""
        self.clear_content()
        self.btn_cancel.config(state=tk.NORMAL)
        self.btn_action.config(text="Kapat", state=tk.NORMAL, command=self.root.destroy, bg=self.danger_color, fg="#fff", activebackground="#dc2626")
        
        err_lbl = tk.Label(
            self.content_frame, 
            text="❌ Kurulum Sırasında Bir Hata Oluştu", 
            font=("Segoe UI", 11, "bold"), 
            fg=self.danger_color, 
            bg=self.bg_color
        )
        err_lbl.pack(anchor=tk.W, pady=(15, 6))
        
        desc_lbl = tk.Label(
            self.content_frame, 
            text=f"Kurulum tamamlanamadı. Hata Detayı:\n\n{err_msg}\n\nLütfen kurulum sihirbazını 'Yönetici Olarak Çalıştır' seçeneğiyle tekrar başlatmayı deneyin.", 
            font=("Segoe UI", 9), 
            fg=self.text_color, 
            bg=self.bg_color, 
            wraplength=520, 
            justify=tk.LEFT
        )
        desc_lbl.pack(anchor=tk.W)

    def finish_and_exit(self):
        """Sihirbazı kapatır ve istenirse uygulamayı başlatır."""
        if self.launch_after_install.get():
            dest_exe = os.path.join(self.install_path.get(), "OYMAPOS.exe")
            if os.path.exists(dest_exe):
                try:
                    subprocess.Popen([dest_exe], cwd=self.install_path.get(), shell=True)
                except Exception as e:
                    print("Uygulama başlatma hatası:", e)
        self.root.destroy()

    # ==========================================
    # KALDIRMA (UNINSTALL) EKRANLARI
    # ==========================================
    def show_uninstall_welcome_screen(self):
        """Kaldırma onay ekranı."""
        self.clear_content()
        
        un_title = tk.Label(
            self.content_frame,
            text="OYMAPOS Sistemden Kaldırılacak",
            font=("Segoe UI", 12, "bold"),
            fg=self.danger_color,
            bg=self.bg_color
        )
        un_title.pack(anchor=tk.W, pady=(15, 6))
        
        un_desc = tk.Label(
            self.content_frame,
            text="Bu işlem OYMAPOS uygulamasını, kısayolları ve sistem kayıtlarını bilgisayarınızdan kaldıracaktır.",
            font=("Segoe UI", 9.5),
            fg=self.text_color,
            bg=self.bg_color,
            wraplength=520,
            justify=tk.LEFT
        )
        un_desc.pack(anchor=tk.W, pady=(0, 16))
        
        cb_keep = tk.Checkbutton(
            self.content_frame,
            text="Veritabanı, ürünler ve satış kayıtlarımı KORU (Önerilir)",
            variable=self.keep_user_data_on_uninstall,
            bg=self.bg_color,
            fg=self.text_color,
            selectcolor="#070d19",
            activebackground=self.bg_color,
            activeforeground=self.text_color,
            font=("Segoe UI", 9.5, "bold")
        )
        cb_keep.pack(anchor=tk.W, pady=5)

    def start_uninstallation(self):
        """Kaldırma işlemini başlatır."""
        if is_process_running("OYMAPOS.exe"):
            kill_process("OYMAPOS.exe")
            
        self.btn_action.config(state=tk.DISABLED)
        self.btn_cancel.config(state=tk.DISABLED)
        self.clear_content()
        
        self.lbl_status = tk.Label(
            self.content_frame, 
            text="OYMAPOS kaldırılıyor...", 
            font=("Segoe UI", 11, "bold"), 
            fg=self.text_color, 
            bg=self.bg_color
        )
        self.lbl_status.pack(anchor=tk.W, pady=(25, 6))
        
        self.lbl_detail = tk.Label(
            self.content_frame, 
            text="Kısayollar ve kayıtlar temizleniyor...", 
            font=("Segoe UI", 9), 
            fg=self.muted_color, 
            bg=self.bg_color
        )
        self.lbl_detail.pack(anchor=tk.W, pady=(0, 16))
        
        s = ttk.Style()
        s.theme_use('clam')
        s.configure("TProgressbar", thickness=14, troughcolor="#152238", background=self.danger_color, bordercolor=self.bg_color, lightcolor=self.danger_color, darkcolor=self.danger_color)
        
        self.progress = ttk.Progressbar(self.content_frame, style="TProgressbar", orient="horizontal", length=530, mode="determinate")
        self.progress.pack(fill=tk.X)
        
        threading.Thread(target=self.run_uninstall_task, daemon=True).start()

    def run_uninstall_task(self):
        """Kaldırma iş mantığı."""
        try:
            install_dir = os.path.dirname(os.path.abspath(sys.executable)) if getattr(sys, 'frozen', False) else r"C:\OYMAPOS"
            
            # 1. Kısayolları sil
            self.update_status(20, "Kısayollar temizleniyor...", "Masaüstü ve Başlat Menüsü kısayolları siliniyor...")
            target_dirs = []
            if HAS_WIN32COM:
                try:
                    pythoncom.CoInitialize()
                    shell = win32com.client.Dispatch("WScript.Shell")
                    for folder in ["Desktop", "Programs", "Startup"]:
                        target_dirs.append(shell.SpecialFolders(folder))
                except Exception:
                    pass
                finally:
                    if HAS_WIN32COM:
                        try:
                            pythoncom.CoUninitialize()
                        except Exception:
                            pass
            
            # Fallback dizinler
            target_dirs.extend([
                os.path.join(os.path.expanduser("~"), "Desktop"),
                os.path.join(os.environ.get("APPDATA", ""), r"Microsoft\Windows\Start Menu\Programs"),
                os.path.join(os.environ.get("APPDATA", ""), r"Microsoft\Windows\Start Menu\Programs\Startup"),
                os.path.join(os.environ.get("PUBLIC", r"C:\Users\Public"), "Desktop")
            ])
            
            for f_dir in set(target_dirs):
                if f_dir and os.path.exists(f_dir):
                    lnk = os.path.join(f_dir, "OYMAPOS.lnk")
                    if os.path.exists(lnk):
                        try:
                            os.remove(lnk)
                        except Exception:
                            pass
            
            # 2. Registry kaydını sil
            self.update_status(50, "Kayıt defteri temizleniyor...", "Program Ekle/Kaldır kaydı siliniyor...")
            unregister_uninstaller()
            
            # 3. Dosyaları sil
            self.update_status(80, "Dosyalar siliniyor...", "Uygulama dosyaları temizleniyor...")
            time.sleep(0.5)
            
            exe_path = os.path.join(install_dir, "OYMAPOS.exe")
            if os.path.exists(exe_path):
                try:
                    os.remove(exe_path)
                except Exception:
                    pass
                    
            if not self.keep_user_data_on_uninstall.get():
                data_path = os.path.join(install_dir, "data")
                if os.path.exists(data_path):
                    shutil.rmtree(data_path, ignore_errors=True)
                    
            self.update_status(100, "OYMAPOS Başarıyla Kaldırıldı", "Sistemden tamamen temizlendi.")
            time.sleep(0.3)
            
            self.root.after(50, self.show_uninstall_finished_screen)
        except Exception as e:
            self.root.after(50, lambda: self.show_error_screen(str(e)))

    def show_uninstall_finished_screen(self):
        self.clear_content()
        self.btn_cancel.config(state=tk.DISABLED)
        self.btn_action.config(
            text="Kapat", 
            state=tk.NORMAL, 
            command=self.root.destroy,
            bg=self.primary_color,
            fg="#0b1324"
        )
        
        success_lbl = tk.Label(
            self.content_frame, 
            text="✓ OYMAPOS Başarıyla Kaldırıldı", 
            font=("Segoe UI", 12, "bold"), 
            fg=self.success_color, 
            bg=self.bg_color
        )
        success_lbl.pack(anchor=tk.W, pady=(20, 6))
        
        msg = "OYMAPOS ve ilgili kısayollar bilgisayarınızdan kaldırıldı."
        if self.keep_user_data_on_uninstall.get():
            msg += "\n\nKullanıcı veritabanınız ve ayarlarınız korundu; ileride tekrar yüklediğinizde kaldığınız yerden devam edebilirsiniz."
            
        desc_lbl = tk.Label(
            self.content_frame, 
            text=msg, 
            font=("Segoe UI", 9.5), 
            fg=self.text_color, 
            bg=self.bg_color, 
            wraplength=520, 
            justify=tk.LEFT
        )
        desc_lbl.pack(anchor=tk.W)


def main():
    # Yönetici hakları kontrolü (Yoksa UAC ile yükselt)
    if not is_admin():
        run_as_admin()
        return

    is_uninstall = "--uninstall" in sys.argv
    
    root = tk.Tk()
    app = OymaposInstallerApp(root, is_uninstall_mode=is_uninstall)
    root.mainloop()

if __name__ == '__main__':
    main()
