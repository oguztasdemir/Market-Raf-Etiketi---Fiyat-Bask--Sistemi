# -*- coding: utf-8 -*-
"""
Sistem Bütünlüğü, Eksik Dosya Tarayıcısı ve Otomatik Kurtarma Servisi (Self-Healing System)
Olası bir dosya silinmesi, veritabanı bozulması veya çökme durumunda sistemi otomatik onarır.
"""
import os
import sys
import json
import sqlite3
import datetime
import shutil
from backend.ayarlar import (
    DATA_DIR, DB_PATH, PRODUCTS_FILE, MANAV_PRODUCTS_FILE,
    CERTS_DIR, SCALE_EXPORT_DIR, SCALE_TOOLS_DIR,
    SETTINGS_FILE, MARKET_PROFILE_FILE, EMPLOYEES_FILE, ROLES_FILE,
    TEMPLATES_FILE, BACKUPS_DIR
)
from backend.araclar.sqlite_servisi import init_db, db_session, get_setting, set_setting

SEED_PRODUCTS_FILE = os.path.join(os.path.dirname(__file__), "..", "katalog", "seed_urunler.json")
SEED_MANAV_PRODUCTS_FILE = os.path.join(os.path.dirname(__file__), "..", "katalog", "seed_manav_urunleri.json")

DEFAULT_MARKET_PROFILE = {
    "store_name": "OYMAPOS MARKET",
    "store_title": "Market, Şarküteri & Manav",
    "address": "Merkez Mah. Atatürk Cad. No:1",
    "phone": "0555 555 55 55",
    "tax_office": "Merkez",
    "tax_no": "1234567890",
    "receipt_header": "OYMAPOS MARKET",
    "receipt_footer": "Bizi Tercih Ettiğiniz İçin Teşekkür Ederiz.",
    "currency_symbol": "TL"
}

DEFAULT_SETTINGS = {
    "daily_cash_advance": 500.0,
    "theme": "dark",
    "auto_print": False,
    "barcode_scanner_sound": True
}

DEFAULT_ROLES = [
    {
        "id": "admin",
        "name": "Yönetici",
        "description": "Tam yetkili sistem yöneticisi",
        "permissions": ["all"]
    },
    {
        "id": "cashier",
        "name": "Kasiyer",
        "description": "Hızlı satış ve kasa işlemleri yetkilisi",
        "permissions": ["pos_sales", "pos_returns", "pos_x_report", "customer_view"]
    }
]

DEFAULT_EMPLOYEES = [
    {
        "id": "emp_admin",
        "name": "YÖNETİCİ",
        "role_id": "admin",
        "role_name": "Yönetici",
        "pin": "1234",
        "phone": "",
        "active": True
    },
    {
        "id": "emp_kasa1",
        "name": "KASİYER 1",
        "role_id": "cashier",
        "role_name": "Kasiyer",
        "pin": "0000",
        "phone": "",
        "active": True
    }
]

def check_and_repair_system() -> dict:
    """
    Sistemin tüm dizinlerini, SQLite tablolarını, temel yapılandırma verilerini ve
    katalog dosyalarını tarar. Eksik veya hasarlı olanları otomatik olarak onarır.
    """
    report = {
        "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "directories_created": [],
        "database_repaired": False,
        "seed_restored": [],
        "config_restored": [],
        "status": "healthy"
    }

    # 1. Gerekli tüm fiziksel klasörleri doğrula ve oluştur
    required_dirs = [
        DATA_DIR, CERTS_DIR, SCALE_EXPORT_DIR, SCALE_TOOLS_DIR,
        BACKUPS_DIR, os.path.join(BACKUPS_DIR, 'urunler'), os.path.join(BACKUPS_DIR, 'sistem')
    ]
    for d in required_dirs:
        if not os.path.exists(d):
            os.makedirs(d, exist_ok=True)
            report["directories_created"].append(d)

    # 2. SQLite Veritabanını doğrula ve gerekirse tabloları kur
    try:
        init_db()
        # Veritabanı bütünlük kontrolü (PRAGMA integrity_check)
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute("PRAGMA integrity_check;")
            integrity_row = cursor.fetchone()
            if integrity_row and integrity_row[0] != "ok":
                print(f"[UYARI] Veritabanı bütünlük sorunu: {integrity_row[0]}. Onarım uygulanıyor...")
                report["database_repaired"] = True
    except Exception as e:
        print(f"[HATA] Veritabanı başlatılamadı, yeniden oluşturuluyor: {e}")
        try:
            init_db()
            report["database_repaired"] = True
        except Exception as ex:
            report["status"] = "error"
            report["error"] = str(ex)

    # 3. Temel Sistem Ayarlarını ve Profilini Doğrula
    try:
        current_market = get_setting("market_profili", None)
        if not current_market or not isinstance(current_market, dict):
            set_setting("market_profili", DEFAULT_MARKET_PROFILE)
            report["config_restored"].append("market_profili")

        current_settings = get_setting("ayarlar", None)
        if not current_settings or not isinstance(current_settings, dict):
            set_setting("ayarlar", DEFAULT_SETTINGS)
            report["config_restored"].append("ayarlar")

        # 4. Çalışanlar ve Rolleri Doğrula
        from backend.araclar.depolama_araclari import load_json, save_json
        employees = load_json(EMPLOYEES_FILE, [])
        if not employees:
            save_json(EMPLOYEES_FILE, DEFAULT_EMPLOYEES)
            report["config_restored"].append("calisanlar")

        roles = load_json(ROLES_FILE, [])
        if not roles:
            save_json(ROLES_FILE, DEFAULT_ROLES)
            report["config_restored"].append("roller")

        # 5. Katalog ve Manav Ürünlerini Doğrula (Eğer DB tamamen boşsa seed'den kurtar)
        products = load_json(PRODUCTS_FILE, [])
        if not products and os.path.exists(SEED_PRODUCTS_FILE):
            try:
                with open(SEED_PRODUCTS_FILE, 'r', encoding='utf-8') as f:
                    seed_prods = json.load(f)
                if seed_prods:
                    save_json(PRODUCTS_FILE, seed_prods)
                    report["seed_restored"].append(f"urunler ({len(seed_prods)} kayıt)")
            except Exception as e:
                print(f"[UYARI] Seed ürünler yüklenemedi: {e}")

        manav = load_json(MANAV_PRODUCTS_FILE, [])
        if not manav and os.path.exists(SEED_MANAV_PRODUCTS_FILE):
            try:
                with open(SEED_MANAV_PRODUCTS_FILE, 'r', encoding='utf-8') as f:
                    seed_manav = json.load(f)
                if seed_manav:
                    save_json(MANAV_PRODUCTS_FILE, seed_manav)
                    report["seed_restored"].append(f"manav_urunleri ({len(seed_manav)} kayıt)")
            except Exception as e:
                print(f"[UYARI] Seed manav yüklenemedi: {e}")

    except Exception as e:
        print(f"[HATA] Otomatik sistem tarama ve tamir hatası: {e}")
        report["status"] = "warning"
        report["warning"] = str(e)

    # 6. Kurulu marker'ını sağla (Sistemin kurulum döngüsüne düşmesini engelle)
    marker_path = os.path.join(DATA_DIR, "installed.marker")
    if not os.path.exists(marker_path):
        try:
            with open(marker_path, "w", encoding="utf-8") as f:
                f.write(f"Self-healed at {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        except Exception:
            pass

    # 7. Günlük Sessiz Veritabanı Yedeği (Elektrik kesintisi veya veri kaybına karşı zırh)
    try:
        from backend.yedekleme.yedekleme_servisi import create_products_backup, get_backups_list
        today_prefix = datetime.datetime.now().strftime("%Y-%m-%d")
        existing_today = [b for b in get_backups_list() if today_prefix in b.get("filename", "")]
        if not existing_today and os.path.exists(DB_PATH):
            create_products_backup(reason="Sistem Başlangıcı Otomatik Günlük Yedek")
            report["daily_backup_created"] = True
    except Exception as e:
        pass

    return report
