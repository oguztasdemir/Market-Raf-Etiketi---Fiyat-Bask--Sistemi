# -*- coding: utf-8 -*-
"""
SQLite Veritabanı Servisi - Market, Kasa & Terazi Sistemi
Tüm verileri tek ve sağlam bir ACID uyumlu SQLite veritabanında yönetir.
"""
import os
import sys
import sqlite3
import json
import threading
from contextlib import contextmanager

# Kök dizini PYTHONPATH'e ekle
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from backend.ayarlar import DATA_DIR

DB_PATH = os.path.join(DATA_DIR, "market_sistemi.db")
_DB_LOCK = threading.RLock()

def get_connection():
    """Thread-safe SQLite bağlantısı oluşturur ve optimize PRAGMA ayarlarını uygular."""
    conn = sqlite3.connect(DB_PATH, timeout=20.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    # Performans ve bozulma koruması için WAL modu ve normal senkronizasyon
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA busy_timeout = 10000;")
    return conn

@contextmanager
def db_session():
    """Transaction yönetimli SQLite oturum context manager'ı."""
    with _DB_LOCK:
        conn = get_connection()
        try:
            yield conn
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()

def init_db():
    """Veritabanı tablolarını ve indekslerini otomatik oluşturur."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with db_session() as conn:
        cursor = conn.cursor()
        
        # 1. Ürün Kataloğu
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS urunler (
            barcode TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            title1 TEXT,
            title2 TEXT,
            brand TEXT,
            price TEXT,
            price_num REAL DEFAULT 0.0,
            buy_price REAL DEFAULT 0.0,
            vat REAL DEFAULT 0.0,
            stock REAL DEFAULT 0.0,
            origin TEXT,
            unit TEXT,
            category TEXT,
            date TEXT,
            updated_at TEXT,
            raw_json TEXT
        );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_urunler_title ON urunler(title);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_urunler_category ON urunler(category);")

        # 2. Manav Ürünleri & Hızlı Tuşlar
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS manav_urunleri (
            plu INTEGER PRIMARY KEY,
            barcode TEXT,
            title TEXT NOT NULL,
            name TEXT,
            price TEXT,
            scale_price TEXT,
            unit TEXT DEFAULT 'Kg',
            origin TEXT,
            sync_status TEXT,
            raw_json TEXT
        );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_manav_barcode ON manav_urunleri(barcode);")

        # 3. Özel / Kısayol Barkodlar
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS ozel_barkodlar (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            code TEXT,
            raw_json TEXT
        );
        """)

        # 4. Ürün Faaliyetleri (Fiyat & Stok Değişim Geçmişi)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS urun_faaliyetleri (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            barkod TEXT,
            islem_tipi TEXT,
            detay TEXT,
            kullanici TEXT,
            tarih TEXT,
            raw_json TEXT
        );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_faaliyet_barkod ON urun_faaliyetleri(barkod);")

        # 5. Satış Fişleri
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS satislar (
            receipt_no TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            time TEXT,
            timestamp TEXT,
            cashier TEXT,
            customer TEXT,
            customer_id TEXT,
            payment_type TEXT,
            total_amount REAL DEFAULT 0.0,
            received_cash REAL DEFAULT 0.0,
            change_amount REAL DEFAULT 0.0,
            items_count INTEGER DEFAULT 0,
            raw_json TEXT
        );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_satislar_date ON satislar(date);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_satislar_cust ON satislar(customer_id);")

        # 6. Kasa Hareketleri (Nakit Giriş / Çıkış)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS kasa_hareketleri (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            amount REAL DEFAULT 0.0,
            amount_str TEXT,
            category TEXT,
            description TEXT,
            cashier TEXT,
            date TEXT,
            time TEXT,
            created_at TEXT,
            raw_json TEXT
        );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_kasa_date ON kasa_hareketleri(date);")

        # 7. Müşteriler & Veresiye Defteri
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS musteriler (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT,
            balance REAL DEFAULT 0.0,
            credit_limit REAL DEFAULT 0.0,
            notes TEXT,
            created_at TEXT,
            raw_json TEXT
        );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_musteri_phone ON musteriler(phone);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_musteri_name ON musteriler(name);")

        # 8. Giderler
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS giderler (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            time TEXT,
            category TEXT,
            category_code TEXT,
            title TEXT,
            amount REAL DEFAULT 0.0,
            payment_method TEXT,
            recipient TEXT,
            notes TEXT,
            invoice_no TEXT,
            user TEXT,
            raw_json TEXT
        );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_giderler_date ON giderler(date);")

        # 10. Çalışanlar, Kasiyerler ve Roller
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS calisanlar (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            role_id TEXT,
            role_name TEXT,
            pin TEXT,
            phone TEXT,
            active INTEGER DEFAULT 1,
            raw_json TEXT
        );
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS calisan_hareketleri (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            calisan_id TEXT,
            hareket_tipi TEXT,
            tarih TEXT,
            saat TEXT,
            aciklama TEXT,
            raw_json TEXT
        );
        """)

        # 10. Roller

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS roller (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            permissions_json TEXT,
            raw_json TEXT
        );
        """)

        # 11. Şablonlar & Taslak Önbelleği
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS sablonlar (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            label_size TEXT,
            raw_json TEXT
        );
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS taslak_onbellegi (
            key TEXT PRIMARY KEY,
            raw_json TEXT,
            updated_at TEXT
        );
        """)

        # 12. Sistem Ayarları & Genel Key-Value Depolama
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS sistem_ayarlari (
            anahtar TEXT PRIMARY KEY,
            deger_json TEXT NOT NULL,
            updated_at TEXT
        );
        """)

# --- YARDIMCI VERİ TABANI FONKSİYONLARI ---

def get_setting(key: str, default=None):
    """sistem_ayarlari tablosundan JSON ayrıştırılmış ayarı çeker."""
    try:
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT deger_json FROM sistem_ayarlari WHERE anahtar = ?", (key,))
            row = cursor.fetchone()
            if row and row['deger_json']:
                return json.loads(row['deger_json'])
    except Exception as e:
        print(f"[UYARI] get_setting hatası ({key}): {e}")
    return default

def set_setting(key: str, value) -> bool:
    """sistem_ayarlari tablosuna veri yazar."""
    try:
        import datetime
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        val_json = json.dumps(value, ensure_ascii=False)
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO sistem_ayarlari (anahtar, deger_json, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(anahtar) DO UPDATE SET deger_json = excluded.deger_json, updated_at = excluded.updated_at
            """, (key, val_json, now_str))
        return True
    except Exception as e:
        print(f"[HATA] set_setting hatası ({key}): {e}")
        return False

def backup_sqlite_db(target_path: str) -> bool:
    """SQLite backup API'sini kullanarak canlı, kilitlenmesiz ve kusursuz .db yedeği alır."""
    os.makedirs(os.path.dirname(target_path), exist_ok=True)
    with _DB_LOCK:
        try:
            source_conn = get_connection()
            dest_conn = sqlite3.connect(target_path)
            with dest_conn:
                source_conn.backup(dest_conn)
            dest_conn.close()
            source_conn.close()
            return True
        except Exception as e:
            print(f"[HATA] SQLite backup hatası: {e}")
            return False

# İlk modül yüklendiğinde DB şemasını hazırla
try:
    init_db()
except Exception as _e:
    print(f"[UYARI] DB Başlatma Hatası: {_e}")
