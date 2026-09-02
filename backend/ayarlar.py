# -*- coding: utf-8 -*-
"""
Market Raf Etiketi, Kasa & Terazi Sistemi - Sadeleştirilmiş SQLite Mimarisi ve Çekirdek Dizinler
"""
import os
import sys

# Ana Proje Dizini ve Dizinlerin Çözümlenmesi (PyInstaller EXE Uyumlu)
if getattr(sys, 'frozen', False):
    BUNDLE_DIR = sys._MEIPASS
    BASE_DIR = BUNDLE_DIR
    STATIC_DIR = os.path.join(BUNDLE_DIR, 'frontend')
    TEMPLATES_DIR = os.path.join(BUNDLE_DIR, 'frontend', 'sayfalar')
    # DATA_DIR executable ile aynı klasörde olmalı (kalıcı veri için)
    DATA_DIR = os.path.join(os.path.dirname(sys.executable), 'data')
else:
    BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    STATIC_DIR = os.path.join(BASE_DIR, 'frontend')
    TEMPLATES_DIR = os.path.join(BASE_DIR, 'frontend', 'sayfalar')
    DATA_DIR = os.path.join(BASE_DIR, 'data')

SCALE_TOOLS_DIR = os.path.join(os.path.dirname(__file__), 'terazi', 'motor')

# 🗄️ 1. TEK VE ANA VERİTABANI
DB_PATH = os.path.join(DATA_DIR, 'market_sistemi.db')

# ⚙️ 2. AKTİF FİZİKSEL DİZİNLER (Sertifikalar, Terazi Aktarımı, Yedekler)
CERTS_DIR = os.path.join(DATA_DIR, 'sertifikalar')
SCALE_EXPORT_DIR = os.path.join(DATA_DIR, 'terazi_aktarim')
SISTEM_EXCELI_DIR = os.path.join(DATA_DIR, 'sistem_exceli')
BACKUPS_DIR = os.path.join(DATA_DIR, 'yedekler')
URUNLER_BACKUPS_DIR = os.path.join(BACKUPS_DIR, 'urunler')
CATALOG_BACKUPS_DIR = URUNLER_BACKUPS_DIR
SYSTEM_BACKUPS_DIR = os.path.join(BACKUPS_DIR, 'sistem')

# 🔄 3. GERİYE DÖNÜK UYUMLULUK SANAL KİMLİKLERİ (SQLite Yönlendirmeleri İçin)
SISTEM_AYARLAR_DIR = DATA_DIR
URUNLER_DIR = DATA_DIR
KATALOG_DIR = DATA_DIR
SATIS_KASA_DIR = DATA_DIR
SABLONLAR_DIR = DATA_DIR
RECEIPTS_DIR = os.path.join(DATA_DIR, 'fisler')
SALES_DIR = os.path.join(DATA_DIR, 'satislar')

PRODUCTS_FILE = os.path.join(DATA_DIR, 'urunler.json')
MANAV_PRODUCTS_FILE = os.path.join(DATA_DIR, 'manav_urunleri.json')
BARKODSUZ_PRODUCTS_FILE = os.path.join(DATA_DIR, 'barkodsuz_urunler.json')
CUSTOM_BARCODES_FILE = os.path.join(DATA_DIR, 'ozel_barkodlar.json')
PRODUCT_ACTIVITIES_FILE = os.path.join(DATA_DIR, 'urun_faaliyetleri.json')
REPORTS_FILE = os.path.join(DATA_DIR, 'gunluk_raporlar.json')
QUICK_BUTTONS_FILE = os.path.join(DATA_DIR, 'hizli_butonlar.json')
SETTINGS_FILE = os.path.join(DATA_DIR, 'ayarlar.json')
MARKET_PROFILE_FILE = os.path.join(DATA_DIR, 'market_profili.json')
EMPLOYEES_FILE = os.path.join(DATA_DIR, 'calisanlar.json')
EMPLOYEE_LOGS_FILE = os.path.join(DATA_DIR, 'calisan_hareketleri.json')
ROLES_FILE = os.path.join(DATA_DIR, 'roller.json')
EXPENSES_FILE = os.path.join(DATA_DIR, 'giderler.json')
CASH_MOVEMENTS_FILE = os.path.join(DATA_DIR, 'kasa_hareketleri.json')
SCALE_SETTINGS_FILE = os.path.join(DATA_DIR, 'terazi_ayarlari.json')
CUSTOMERS_FILE = os.path.join(DATA_DIR, 'musteriler.json')
TEMPLATES_FILE = os.path.join(DATA_DIR, 'sablonlar.json')
DRAFT_CACHE_FILE = os.path.join(DATA_DIR, 'taslak_onbellegi.json')

# 📁 Yalnızca fiziksel dosya barındıran aktif klasörleri oluştur
TUM_DIZINLER = [
    DATA_DIR, CERTS_DIR, SCALE_EXPORT_DIR, SCALE_TOOLS_DIR
]

for directory in TUM_DIZINLER:
    os.makedirs(directory, exist_ok=True)
