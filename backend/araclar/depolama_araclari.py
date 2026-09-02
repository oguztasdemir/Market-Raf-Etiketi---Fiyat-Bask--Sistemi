# -*- coding: utf-8 -*-
"""
SQLite Tabanlı Depolama ve Veri Erişim Katmanı
Tüm veri okuma ve yazma işlemlerini SQLite (.db) veritabanı üzerinden ultra-hızlı ve güvenli şekilde gerçekleştirir.
Geriye dönük %100 tam uyumluluk (load_json / save_json API) sağlar.
"""
import os
import sys
import json
import threading
from backend.ayarlar import (
    DATA_DIR, PRODUCTS_FILE, MANAV_PRODUCTS_FILE, CUSTOM_BARCODES_FILE,
    CASH_MOVEMENTS_FILE, CUSTOMERS_FILE, EXPENSES_FILE,
    EMPLOYEES_FILE, ROLES_FILE,
    SETTINGS_FILE, MARKET_PROFILE_FILE, SCALE_SETTINGS_FILE,
    REPORTS_FILE, QUICK_BUTTONS_FILE, TEMPLATES_FILE, DRAFT_CACHE_FILE,
    SALES_DIR
)
from backend.araclar.sqlite_servisi import (
    get_connection, db_session, get_setting, set_setting, DB_PATH
)

_STORAGE_LOCK = threading.RLock()

# Ayar Dosyası Adları -> SQLite Ayar Anahtarı Eşleme Tablosu
_CONFIG_NAME_MAP = {
    "ayarlar.json": "ayarlar",
    "market_profili.json": "market_profili",
    "cihaz_yapilandirmasi.json": "cihaz_yapilandirmasi",
    "terazi_ayarlari.json": "terazi_ayarlari",
    "gunluk_raporlar.json": "gunluk_raporlar",
    "hizli_butonlar.json": "hizli_butonlar",
    "odeal_ayarlari.json": "odeal_ayarlari",
    "whatsapp_bot_queue.json": "whatsapp_bot_queue",
}

def load_json(file_path: str, default=None):
    """
    JSON dosya adına karşılık gelen SQLite tablosundan veya ayarlarından veriyi anında okur.
    Böylece dosya boyutu ne olursa olsun RAM şişmesi ve dosya kilitlenme sorunları yaşanmaz.
    """
    if not file_path:
        return default if default is not None else []

    fname = os.path.basename(file_path).lower()
    if not os.path.exists(DB_PATH):
        return _fallback_load_json(file_path, default)

    try:
        # 1. Ayar / Yapılandırma Dosyası mı?
        if fname in _CONFIG_NAME_MAP:
            setting_key = _CONFIG_NAME_MAP[fname]
            val = get_setting(setting_key, default)
            return val if val is not None else (default if default is not None else {})

        # 2. Ürünler Tablosu
        if fname == "urunler.json":
            with get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT raw_json FROM urunler;")
                rows = cursor.fetchall()
                if not rows and default is not None:
                    return default
                return [json.loads(r['raw_json']) for r in rows if r['raw_json']]

        # 3. Manav Ürünleri
        if fname == "manav_urunleri.json":
            with get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT raw_json FROM manav_urunleri ORDER BY plu ASC;")
                rows = cursor.fetchall()
                if not rows and default is not None:
                    return default
                return [json.loads(r['raw_json']) for r in rows if r['raw_json']]

        # 4. Özel Barkodlar
        if fname == "ozel_barkodlar.json":
            with get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT raw_json FROM ozel_barkodlar;")
                rows = cursor.fetchall()
                if not rows and default is not None:
                    return default
                return [json.loads(r['raw_json']) for r in rows if r['raw_json']]

        # 5. Kasa Hareketleri
        if fname == "kasa_hareketleri.json":
            with get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT raw_json FROM kasa_hareketleri ORDER BY rowid DESC;")
                rows = cursor.fetchall()
                if not rows and default is not None:
                    return default
                return [json.loads(r['raw_json']) for r in rows if r['raw_json']]

        # 6. Müşteriler
        if fname == "musteriler.json":
            with get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT raw_json FROM musteriler;")
                rows = cursor.fetchall()
                if not rows and default is not None:
                    return default
                return [json.loads(r['raw_json']) for r in rows if r['raw_json']]

        # 7. Giderler
        if fname == "giderler.json":
            with get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT raw_json FROM giderler ORDER BY date DESC, time DESC;")
                rows = cursor.fetchall()
                if not rows and default is not None:
                    return default
                return [json.loads(r['raw_json']) for r in rows if r['raw_json']]

        # 8. Çalışanlar
        if fname == "calisanlar.json":
            with get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT raw_json FROM calisanlar;")
                rows = cursor.fetchall()
                if not rows and default is not None:
                    return default
                return [json.loads(r['raw_json']) for r in rows if r['raw_json']]

        # 10. Roller
        if fname == "roller.json":
            with get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT raw_json FROM roller;")
                rows = cursor.fetchall()
                if not rows and default is not None:
                    return default
                return [json.loads(r['raw_json']) for r in rows if r['raw_json']]

        # 11. Şablonlar
        if fname == "sablonlar.json":
            with get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT raw_json FROM sablonlar;")
                rows = cursor.fetchall()
                if not rows and default is not None:
                    return default
                return [json.loads(r['raw_json']) for r in rows if r['raw_json']]

        # 12. Taslak Önbelleği
        if fname == "taslak_onbellegi.json":
            with get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT raw_json FROM taslak_onbellegi WHERE key = 'main_draft';")
                row = cursor.fetchone()
                if row and row['raw_json']:
                    return json.loads(row['raw_json'])
                return default if default is not None else {}

        # 13. Günlük Satış Fişleri (örn: 2026-09-01.json)
        if (fname.endswith(".json") and len(fname) == 15 and fname[:10].count("-") == 2) or "satis" in file_path.replace("\\", "/"):
            date_key = fname.replace(".json", "")
            if len(date_key) == 10 and date_key.count("-") == 2:
                sales = get_sales_for_date(date_key)
                if sales:
                    return sales
                return default if default is not None else []


    except Exception as e:
        print(f"[UYARI] SQLite load_json hatası ({file_path}): {e}")

    return _fallback_load_json(file_path, default)

def save_json(file_path: str, data) -> bool:
    """
    Veriyi doğrudan SQLite veritabanındaki ilgili tabloya transaction güvenliğiyle yazar.
    """
    if not file_path:
        return False

    fname = os.path.basename(file_path).lower()
    if not os.path.exists(DB_PATH):
        return _fallback_save_json(file_path, data)

    try:
        # 1. Ayarlar / Yapılandırma Dosyası mı?
        if fname in _CONFIG_NAME_MAP:
            setting_key = _CONFIG_NAME_MAP[fname]
            return set_setting(setting_key, data)

        # 2. Ürünler Tablosu
        if fname == "urunler.json" and isinstance(data, list):
            from backend.araclar.json_to_db_aktarici import parse_price
            urunler_rows = []
            for u in data:
                bc = str(u.get("barcode") or u.get("barkod") or "").strip()
                if not bc:
                    continue
                title = str(u.get("title") or u.get("urun_adi") or u.get("name") or "").strip()
                title1 = str(u.get("title1") or "").strip()
                title2 = str(u.get("title2") or "").strip()
                brand = str(u.get("brand") or "").strip()
                price = str(u.get("price") or u.get("fiyat") or "").strip()
                price_num = float(u.get("price_num") or parse_price(price))
                buy_price = float(u.get("buy_price") or u.get("alis_fiyati") or 0.0)
                vat = float(u.get("vat") or u.get("kdv") or 0.0)
                stock = float(u.get("stock") or u.get("stok") or 0.0)
                origin = str(u.get("origin") or u.get("mensei") or "").strip()
                unit = str(u.get("unit") or u.get("birim") or "Adet").strip()
                category = str(u.get("category") or u.get("kategori") or "Genel").strip()
                date_str = str(u.get("date") or u.get("tarih") or "").strip()
                updated_at = str(u.get("updated_at") or "").strip()
                raw_json = json.dumps(u, ensure_ascii=False)
                urunler_rows.append((bc, title, title1, title2, brand, price, price_num, buy_price, vat, stock, origin, unit, category, date_str, updated_at, raw_json))

            with db_session() as conn:
                cursor = conn.cursor()
                # 1. Geçici aktif barkodlar tablosu oluştur ve doldur
                cursor.execute("CREATE TEMP TABLE IF NOT EXISTS temp_active_barcodes (barcode TEXT PRIMARY KEY);")
                cursor.execute("DELETE FROM temp_active_barcodes;")
                
                active_barcodes = [(row[0],) for row in urunler_rows]
                cursor.executemany("INSERT OR IGNORE INTO temp_active_barcodes (barcode) VALUES (?);", active_barcodes)
                
                # 2. Artık listede olmayan eski ürünleri sil
                cursor.execute("DELETE FROM urunler WHERE barcode NOT IN (SELECT barcode FROM temp_active_barcodes);")
                
                # 3. Kalan ve yeni ürünleri ekle/güncelle (INSERT OR REPLACE)
                cursor.executemany("""
                    INSERT OR REPLACE INTO urunler (barcode, title, title1, title2, brand, price, price_num, buy_price, vat, stock, origin, unit, category, date, updated_at, raw_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, urunler_rows)
            return True

        # 3. Manav Ürünleri
        if fname == "manav_urunleri.json" and isinstance(data, list):
            manav_rows = []
            for m in data:
                plu = int(m.get("plu") or 0)
                if not plu:
                    continue
                bc = str(m.get("barcode") or m.get("stock_code") or "").strip()
                title = str(m.get("title") or "").strip()
                name = str(m.get("name") or "").strip()
                price = str(m.get("price") or "").strip()
                scale_price = str(m.get("scale_price") or "").strip()
                unit = str(m.get("unit") or "Kg").strip()
                origin = str(m.get("origin") or "TÜRKİYE").strip()
                sync_status = str(m.get("sync_status") or "").strip()
                raw_json = json.dumps(m, ensure_ascii=False)
                manav_rows.append((plu, bc, title, name, price, scale_price, unit, origin, sync_status, raw_json))

            with db_session() as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM manav_urunleri;")
                cursor.executemany("""
                    INSERT INTO manav_urunleri (plu, barcode, title, name, price, scale_price, unit, origin, sync_status, raw_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, manav_rows)
            return True

        # 4. Özel Barkodlar
        if fname == "ozel_barkodlar.json" and isinstance(data, list):
            ozel_rows = []
            for ob in data:
                ob_id = str(ob.get("id") or "").strip()
                if not ob_id:
                    continue
                name = str(ob.get("name") or "").strip()
                code = str(ob.get("code") or "").strip()
                raw_json = json.dumps(ob, ensure_ascii=False)
                ozel_rows.append((ob_id, name, code, raw_json))

            with db_session() as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM ozel_barkodlar;")
                cursor.executemany("""
                    INSERT INTO ozel_barkodlar (id, name, code, raw_json)
                    VALUES (?, ?, ?, ?)
                """, ozel_rows)
            return True

        # 5. Kasa Hareketleri
        if fname == "kasa_hareketleri.json" and isinstance(data, list):
            kasa_rows = []
            for k in data:
                kid = str(k.get("id") or "").strip()
                if not kid:
                    continue
                ktype = str(k.get("type") or "").strip()
                amount = float(k.get("amount") or 0.0)
                amount_str = str(k.get("amount_str") or "").strip()
                category = str(k.get("category") or "").strip()
                desc = str(k.get("description") or "").strip()
                cashier = str(k.get("cashier") or "").strip()
                dt = str(k.get("date") or "").strip()
                tm = str(k.get("time") or "").strip()
                cat = str(k.get("created_at") or "").strip()
                raw_json = json.dumps(k, ensure_ascii=False)
                kasa_rows.append((kid, ktype, amount, amount_str, category, desc, cashier, dt, tm, cat, raw_json))

            with db_session() as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM kasa_hareketleri;")
                cursor.executemany("""
                    INSERT INTO kasa_hareketleri (id, type, amount, amount_str, category, description, cashier, date, time, created_at, raw_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, kasa_rows)
            return True

        # 6. Müşteriler
        if fname == "musteriler.json" and isinstance(data, list):
            cust_rows = []
            for m in data:
                mid = str(m.get("id") or "").strip()
                if not mid:
                    continue
                name = str(m.get("name") or m.get("ad_soyad") or "").strip()
                phone = str(m.get("phone") or m.get("telefon") or "").strip()
                bal = float(m.get("balance") or m.get("bakiye") or 0.0)
                lim = float(m.get("credit_limit") or m.get("limit") or 0.0)
                notes = str(m.get("notes") or m.get("notlar") or "").strip()
                created = str(m.get("created_at") or "").strip()
                raw_json = json.dumps(m, ensure_ascii=False)
                cust_rows.append((mid, name, phone, bal, lim, notes, created, raw_json))

            with db_session() as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM musteriler;")
                cursor.executemany("""
                    INSERT INTO musteriler (id, name, phone, balance, credit_limit, notes, created_at, raw_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, cust_rows)
            return True

        # 7. Giderler
        if fname == "giderler.json" and isinstance(data, list):
            gider_rows = []
            for g in data:
                gid = str(g.get("id") or "").strip()
                if not gid:
                    continue
                dt = str(g.get("date") or "").strip()
                tm = str(g.get("time") or "").strip()
                cat = str(g.get("category") or "").strip()
                cat_code = str(g.get("category_code") or "").strip()
                title = str(g.get("title") or "").strip()
                amount = float(g.get("amount") or 0.0)
                pm = str(g.get("payment_method") or "").strip()
                rec = str(g.get("recipient") or "").strip()
                notes = str(g.get("notes") or "").strip()
                inv_no = str(g.get("invoice_no") or "").strip()
                user = str(g.get("user") or "").strip()
                raw_json = json.dumps(g, ensure_ascii=False)
                gider_rows.append((gid, dt, tm, cat, cat_code, title, amount, pm, rec, notes, inv_no, user, raw_json))

            with db_session() as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM giderler;")
                cursor.executemany("""
                    INSERT INTO giderler (id, date, time, category, category_code, title, amount, payment_method, recipient, notes, invoice_no, user, raw_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, gider_rows)
            return True

        # 8. Çalışanlar
        if fname == "calisanlar.json" and isinstance(data, list):
            c_rows = []
            for c in data:
                cid = str(c.get("id") or "").strip()
                if not cid:
                    continue
                name = str(c.get("name") or "").strip()
                role_id = str(c.get("role_id") or "").strip()
                role_name = str(c.get("role_name") or "").strip()
                pin = str(c.get("pin") or "").strip()
                phone = str(c.get("phone") or "").strip()
                active = 1 if c.get("active", True) else 0
                raw_json = json.dumps(c, ensure_ascii=False)
                c_rows.append((cid, name, role_id, role_name, pin, phone, active, raw_json))

            with db_session() as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM calisanlar;")
                cursor.executemany("""
                    INSERT INTO calisanlar (id, name, role_id, role_name, pin, phone, active, raw_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, c_rows)
            return True

        # 10. Roller
        if fname == "roller.json" and isinstance(data, list):
            r_rows = []
            for r in data:
                rid = str(r.get("id") or "").strip()
                if not rid:
                    continue
                name = str(r.get("name") or "").strip()
                desc = str(r.get("description") or "").strip()
                perms = json.dumps(r.get("permissions") or [], ensure_ascii=False)
                raw_json = json.dumps(r, ensure_ascii=False)
                r_rows.append((rid, name, desc, perms, raw_json))

            with db_session() as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM roller;")
                cursor.executemany("""
                    INSERT INTO roller (id, name, description, permissions_json, raw_json)
                    VALUES (?, ?, ?, ?, ?)
                """, r_rows)
            return True

        # 11. Şablonlar
        if fname == "sablonlar.json" and isinstance(data, list):
            sab_rows = []
            for s in data:
                sid = str(s.get("id") or "").strip()
                if not sid:
                    continue
                name = str(s.get("name") or "").strip()
                desc = str(s.get("description") or "").strip()
                size = str(s.get("label_size") or "").strip()
                raw_json = json.dumps(s, ensure_ascii=False)
                sab_rows.append((sid, name, desc, size, raw_json))

            with db_session() as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM sablonlar;")
                cursor.executemany("""
                    INSERT INTO sablonlar (id, name, description, label_size, raw_json)
                    VALUES (?, ?, ?, ?, ?)
                """, sab_rows)
            return True

        # 12. Taslak
        if fname == "taslak_onbellegi.json":
            with db_session() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO taslak_onbellegi (key, raw_json, updated_at)
                    VALUES ('main_draft', ?, datetime('now'))
                    ON CONFLICT(key) DO UPDATE SET raw_json = excluded.raw_json, updated_at = excluded.updated_at
                """, (json.dumps(data, ensure_ascii=False),))
            return True

        # 13. Günlük Satış Fişleri (örn: 2026-09-01.json)
        if (fname.endswith(".json") and len(fname) == 15 and fname[:10].count("-") == 2) or "satis" in file_path.replace("\\", "/"):
            date_key = fname.replace(".json", "")
            if len(date_key) == 10 and date_key.count("-") == 2 and isinstance(data, list):
                return save_sales_for_date(date_key, data)


    except Exception as e:
        print(f"[HATA] SQLite save_json hatası ({file_path}): {e}")

    return _fallback_save_json(file_path, data)

# --- SATIŞ FİŞLERİ SQLITE ERİŞİMİ ---

def get_sales_for_date(date_str: str) -> list:
    """Belirtilen günün satış fişlerini SQLite 'satislar' tablosundan anında okur."""
    if not os.path.exists(DB_PATH):
        return []
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT raw_json FROM satislar WHERE date = ? ORDER BY time ASC;", (date_str,))
            rows = cursor.fetchall()
            return [json.loads(r['raw_json']) for r in rows if r['raw_json']]
    except Exception as e:
        print(f"[UYARI] get_sales_for_date hatası ({date_str}): {e}")
        return []

def save_sales_for_date(date_str: str, data: list) -> bool:
    """Belirtilen günün satış fişlerini SQLite 'satislar' tablosuna kaydeder/günceller."""
    if not os.path.exists(DB_PATH) or not isinstance(data, list):
        return False
    try:
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM satislar WHERE date = ?;", (date_str,))
            sales_rows = []
            for s in data:
                receipt_no = str(s.get("receipt_no") or s.get("fis_no") or s.get("id") or "").strip()
                if not receipt_no:
                    continue
                dt = str(s.get("date") or s.get("tarih") or date_str).strip()
                tm = str(s.get("time") or s.get("saat") or "").strip()
                ts = str(s.get("timestamp") or "").strip()
                cashier = str(s.get("cashier") or s.get("kasiyer") or "").strip()
                customer = str(s.get("customer") or s.get("musteri") or "").strip()
                cust_id = str(s.get("customer_id") or s.get("musteri_id") or "").strip()
                payment_type = str(s.get("payment_type") or s.get("odeme_tipi") or "").strip()
                total_amount = float(s.get("total_amount") or s.get("toplam_tutar") or 0.0)
                rcv = float(s.get("received_cash") or 0.0)
                chg = float(s.get("change_amount") or 0.0)
                items = s.get("items") or s.get("kalemler") or []
                raw_json = json.dumps(s, ensure_ascii=False)
                sales_rows.append((receipt_no, dt, tm, ts, cashier, customer, cust_id, payment_type, total_amount, rcv, chg, len(items), raw_json))

            cursor.executemany("""
                INSERT INTO satislar (receipt_no, date, time, timestamp, cashier, customer, customer_id, payment_type, total_amount, received_cash, change_amount, items_count, raw_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, sales_rows)
        return True
    except Exception as e:
        print(f"[HATA] save_sales_for_date hatası ({date_str}): {e}")
        return False

def list_all_sales_files() -> list:
    """Sistemdeki tüm satış tarihlerini döner (Geriye dönük rota uyumluluğu için sanal liste)."""
    if not os.path.exists(DB_PATH):
        return []
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT DISTINCT date FROM satislar ORDER BY date DESC;")
            rows = cursor.fetchall()
            dates = [r['date'] for r in rows if r['date']]
            return [os.path.join(SALES_DIR, f"{d}.json") for d in dates]
    except Exception as e:
        print(f"[UYARI] list_all_sales_files hatası: {e}")
        return []

def get_sales_filepath(date_str: str) -> str:
    """Satış dosyası yolunu döner (Geriye dönük uyumluluk)."""
    return os.path.join(SALES_DIR, f"{date_str}.json")

# --- FALLBACK FILE I/O (Sadece DB dışı geçici veya bilinmeyen dosyalar için) ---

def _fallback_load_json(file_path: str, default=None):
    with _STORAGE_LOCK:
        if not os.path.exists(file_path):
            return default if default is not None else []
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return default if default is not None else []

def _fallback_save_json(file_path: str, data) -> bool:
    with _STORAGE_LOCK:
        try:
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return True
        except Exception:
            return False
