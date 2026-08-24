# -*- coding: utf-8 -*-
"""
Market Raf Etiketi, Kasa & Terazi Sistemi - Sadeleştirilmiş 6 Çekirdek Dizin ve Dosya Yolları
"""
import os

# Ana Proje Dizini
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

# Ana Veri ve Arayüz Dizinleri
DATA_DIR = os.path.join(BASE_DIR, 'data')
STATIC_DIR = os.path.join(BASE_DIR, 'frontend')
TEMPLATES_DIR = os.path.join(BASE_DIR, 'frontend', 'sayfalar')
SCALE_TOOLS_DIR = os.path.join(BASE_DIR, 'backend', 'terazi', 'motor')

# 1. 📦 ÜRÜNLER DİZİNİ (Ürün Kataloğu, Manav & Barkodlar)
URUNLER_DIR = os.path.join(DATA_DIR, 'urunler')
KATALOG_DIR = URUNLER_DIR  # Geriye dönük uyumluluk takma adı
PRODUCTS_FILE = os.path.join(URUNLER_DIR, 'urunler.json')
MANAV_PRODUCTS_FILE = os.path.join(URUNLER_DIR, 'manav_urunleri.json')
CUSTOM_BARCODES_FILE = os.path.join(URUNLER_DIR, 'ozel_barkodlar.json')
PRODUCT_ACTIVITIES_FILE = os.path.join(URUNLER_DIR, 'urun_faaliyetleri.json')

# 2. 🛒 SATIŞ & KASA DİZİNİ (Satış Fişleri & Günlük/Aylık Raporlar)
SATIS_KASA_DIR = os.path.join(DATA_DIR, 'satis_ve_kasa')
SALES_DIR = os.path.join(SATIS_KASA_DIR, 'satislar')
REPORTS_FILE = os.path.join(SATIS_KASA_DIR, 'gunluk_raporlar.json')
QUICK_BUTTONS_FILE = os.path.join(SATIS_KASA_DIR, 'hizli_butonlar.json')

# 3. 🧾 FATURALAR DİZİNİ (Şirket Şirket Gruplanmış Fatura & Görsel Arşivi)
INVOICES_DIR = os.path.join(DATA_DIR, 'faturalar')

# 4. ⚙️ SİSTEM & AYARLAR DİZİNİ (Mağaza Kimliği, Kasiyerler, Giderler, Terazi, Excel, SSL)
SISTEM_AYARLAR_DIR = os.path.join(DATA_DIR, 'sistem_ve_ayarlar')
SETTINGS_FILE = os.path.join(SISTEM_AYARLAR_DIR, 'ayarlar.json')
CASHIERS_FILE = os.path.join(SISTEM_AYARLAR_DIR, 'kasiyerler.json')
EXPENSES_FILE = os.path.join(SISTEM_AYARLAR_DIR, 'giderler.json')
SCALE_SETTINGS_FILE = os.path.join(SISTEM_AYARLAR_DIR, 'terazi_ayarlari.json')
CUSTOMERS_FILE = os.path.join(SISTEM_AYARLAR_DIR, 'musteriler.json')
SCALE_EXPORT_DIR = os.path.join(SISTEM_AYARLAR_DIR, 'terazi_aktarim')
SISTEM_EXCELI_DIR = os.path.join(SISTEM_AYARLAR_DIR, 'sistem_exceli')
CERTS_DIR = os.path.join(SISTEM_AYARLAR_DIR, 'sertifikalar')

# 5. 🎨 ŞABLONLAR DİZİNİ (Etiket Tasarımı, ZPL Şablonları & Taslak Önbelleği)
SABLONLAR_DIR = os.path.join(DATA_DIR, 'sablonlar')
TEMPLATES_FILE = os.path.join(SABLONLAR_DIR, 'sablonlar.json')
DRAFT_CACHE_FILE = os.path.join(SABLONLAR_DIR, 'taslak_onbellegi.json')

# 6. 💾 YEDEKLER DİZİNİ (Sistematik Ürünler, Fatura ve Sistem Yedekleri)
BACKUPS_DIR = os.path.join(DATA_DIR, 'yedekler')
URUNLER_BACKUPS_DIR = os.path.join(BACKUPS_DIR, 'urunler')
CATALOG_BACKUPS_DIR = URUNLER_BACKUPS_DIR  # Geriye dönük uyumluluk takma adı
INVOICE_BACKUPS_DIR = os.path.join(BACKUPS_DIR, 'faturalar')
SYSTEM_BACKUPS_DIR = os.path.join(BACKUPS_DIR, 'sistem')

# Gerekli tüm klasörlerin varlığını otomatik garantiye al
TUM_DIZINLER = [
    DATA_DIR, URUNLER_DIR, SATIS_KASA_DIR, SALES_DIR, INVOICES_DIR,
    SISTEM_AYARLAR_DIR, SCALE_EXPORT_DIR, SISTEM_EXCELI_DIR, CERTS_DIR,
    SABLONLAR_DIR, BACKUPS_DIR, URUNLER_BACKUPS_DIR, INVOICE_BACKUPS_DIR,
    SYSTEM_BACKUPS_DIR, SCALE_TOOLS_DIR
]

for directory in TUM_DIZINLER:
    os.makedirs(directory, exist_ok=True)
