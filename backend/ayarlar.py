# -*- coding: utf-8 -*-
"""
Market Raf Etiketi & Fiyat Baskı Sistemi - Konfigürasyon ve Dizin Yolları
"""
import os

# Ana Proje Dizini
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

# Veri Dizinleri
DATA_DIR = os.path.join(BASE_DIR, 'data')
BACKUPS_DIR = os.path.join(DATA_DIR, 'backups')
SISTEM_EXCELI_DIR = os.path.join(DATA_DIR, 'sistem_exceli')
STATIC_DIR = os.path.join(BASE_DIR, 'frontend')
TEMPLATES_DIR = os.path.join(BASE_DIR, 'frontend', 'sayfalar')
FONTS_DIR = os.path.join(DATA_DIR, 'fonts')
CERTS_DIR = os.path.join(DATA_DIR, 'certs')

# JSON Veritabanı Dosyaları
PRODUCTS_FILE = os.path.join(DATA_DIR, 'products.json')
BLACKLIST_FILE = os.path.join(DATA_DIR, 'black_list.json')
TEMPLATES_FILE = os.path.join(DATA_DIR, 'templates.json')
SETTINGS_FILE = os.path.join(DATA_DIR, 'settings.json')
DRAFT_CACHE_FILE = os.path.join(DATA_DIR, 'draft_cache.json')
MANAV_PRODUCTS_FILE = os.path.join(DATA_DIR, 'manav_products.json')
SCALE_SETTINGS_FILE = os.path.join(DATA_DIR, 'scale_settings.json')
SCALE_EXPORT_DIR = os.path.join(DATA_DIR, 'scale_export')
CASHIERS_FILE = os.path.join(DATA_DIR, 'cashiers.json')
CUSTOMERS_FILE = os.path.join(DATA_DIR, 'customers.json')
SALES_DIR = os.path.join(DATA_DIR, 'sales')
QUICK_BUTTONS_FILE = os.path.join(DATA_DIR, 'quick_buttons.json')
CUSTOM_BARCODES_FILE = os.path.join(DATA_DIR, 'custom_barcodes.json')
SCALE_TOOLS_DIR = os.path.join(BASE_DIR, 'backend', 'terazi', 'motor')

# Gerekli klasörlerin varlığını garantiye al
for directory in [DATA_DIR, BACKUPS_DIR, SISTEM_EXCELI_DIR, FONTS_DIR, CERTS_DIR, SCALE_EXPORT_DIR, SALES_DIR, SCALE_TOOLS_DIR]:
    os.makedirs(directory, exist_ok=True)
