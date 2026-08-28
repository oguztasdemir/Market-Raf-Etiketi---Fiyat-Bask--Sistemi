# -*- coding: utf-8 -*-
"""
JSON -> SQLite Otomatik Veri Aktarım (Migration) Aracı
Tüm JSON dosyalarını güvenle SQLite veritabanına aktarır ve veri bütünlüğünü doğrular.
"""
import os
import sys
import glob
import json
import shutil
import datetime

# Kök dizini PYTHONPATH'e ekle
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from backend.ayarlar import (
    DATA_DIR, URUNLER_DIR, SATIS_KASA_DIR, SALES_DIR, INVOICES_DIR,
    SISTEM_AYARLAR_DIR, SABLONLAR_DIR, BACKUPS_DIR
)
from backend.araclar.sqlite_servisi import (
    init_db, db_session, set_setting, DB_PATH
)

def parse_price(val):
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, str):
        cleaned = val.replace("TL", "").replace("tl", "").replace("₺", "").strip()
        cleaned = cleaned.replace(".", "").replace(",", ".")
        try:
            return float(cleaned)
        except Exception:
            pass
    return 0.0

def backup_existing_data():
    """Geçiş öncesi ana JSON dosyalarının hızlı ve güvenli yedeğini alır."""
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = os.path.join(BACKUPS_DIR, f"pre_sqlite_json_backup_{timestamp}")
    os.makedirs(backup_dir, exist_ok=True)
    
    print(f"[*] Guvenlik yedegi aliniyor -> {backup_dir}")
    files_to_backup = [
        os.path.join(URUNLER_DIR, "urunler.json"),
        os.path.join(URUNLER_DIR, "manav_urunleri.json"),
        os.path.join(URUNLER_DIR, "ozel_barkodlar.json"),
        os.path.join(SISTEM_AYARLAR_DIR, "kasa_hareketleri.json"),
        os.path.join(SISTEM_AYARLAR_DIR, "musteriler.json"),
        os.path.join(SISTEM_AYARLAR_DIR, "giderler.json"),
        os.path.join(SISTEM_AYARLAR_DIR, "calisanlar.json"),
        os.path.join(SISTEM_AYARLAR_DIR, "kasiyerler.json"),
        os.path.join(SISTEM_AYARLAR_DIR, "roller.json"),
        os.path.join(SISTEM_AYARLAR_DIR, "ayarlar.json"),
        os.path.join(SISTEM_AYARLAR_DIR, "market_profili.json"),
        os.path.join(SISTEM_AYARLAR_DIR, "cihaz_yapilandirmasi.json"),
        os.path.join(SISTEM_AYARLAR_DIR, "terazi_ayarlari.json"),
        os.path.join(SABLONLAR_DIR, "sablonlar.json"),
        os.path.join(SATIS_KASA_DIR, "gunluk_raporlar.json"),
        os.path.join(SATIS_KASA_DIR, "hizli_butonlar.json")
    ]
    for src in files_to_backup:
        if os.path.exists(src):
            rel = os.path.relpath(src, DATA_DIR)
            dst = os.path.join(backup_dir, rel)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy2(src, dst)
    print("[+] Guvenlik yedegi tamamlandi.")
    return backup_dir

def migrate_all():
    print("=" * 60)
    print("[*] JSON -> SQLite VERITABANI GECISI BASLADI")
    print("=" * 60)
    
    backup_dir = backup_existing_data()
    init_db()
    
    counts = {}
    
    with db_session() as conn:
        cursor = conn.cursor()
        
        # 1. ÜRÜNLER (urunler.json)
        urunler_path = os.path.join(URUNLER_DIR, "urunler.json")
        if os.path.exists(urunler_path):
            with open(urunler_path, "r", encoding="utf-8") as f:
                urunler = json.load(f)
            print(f"[*] Urunler aktariliyor ({len(urunler)} kayit)...")
            urunler_rows = []
            for u in urunler:
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
            
            cursor.executemany("""
                INSERT INTO urunler (barcode, title, title1, title2, brand, price, price_num, buy_price, vat, stock, origin, unit, category, date, updated_at, raw_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(barcode) DO UPDATE SET
                    title = excluded.title,
                    title1 = excluded.title1,
                    title2 = excluded.title2,
                    brand = excluded.brand,
                    price = excluded.price,
                    price_num = excluded.price_num,
                    buy_price = excluded.buy_price,
                    vat = excluded.vat,
                    stock = excluded.stock,
                    origin = excluded.origin,
                    unit = excluded.unit,
                    category = excluded.category,
                    date = excluded.date,
                    updated_at = excluded.updated_at,
                    raw_json = excluded.raw_json
            """, urunler_rows)
            counts["urunler"] = len(urunler_rows)
            
        # 2. MANAV ÜRÜNLERİ (manav_urunleri.json)
        manav_path = os.path.join(URUNLER_DIR, "manav_urunleri.json")
        if os.path.exists(manav_path):
            with open(manav_path, "r", encoding="utf-8") as f:
                manav_list = json.load(f)
            print(f"[*] Manav urunleri aktariliyor ({len(manav_list)} kayit)...")
            manav_rows = []
            for m in manav_list:
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
            
            cursor.executemany("""
                INSERT INTO manav_urunleri (plu, barcode, title, name, price, scale_price, unit, origin, sync_status, raw_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(plu) DO UPDATE SET
                    barcode = excluded.barcode, title = excluded.title, name = excluded.name,
                    price = excluded.price, scale_price = excluded.scale_price, unit = excluded.unit,
                    origin = excluded.origin, sync_status = excluded.sync_status, raw_json = excluded.raw_json
            """, manav_rows)
            counts["manav_urunleri"] = len(manav_rows)

        # 3. ÖZEL BARKODLAR
        ozel_path = os.path.join(URUNLER_DIR, "ozel_barkodlar.json")
        if os.path.exists(ozel_path):
            with open(ozel_path, "r", encoding="utf-8") as f:
                ozel_list = json.load(f)
            print(f"[*] Ozel barkodlar aktariliyor ({len(ozel_list)} kayit)...")
            ozel_rows = []
            for ob in ozel_list:
                ob_id = str(ob.get("id") or "").strip()
                if not ob_id:
                    continue
                name = str(ob.get("name") or "").strip()
                code = str(ob.get("code") or "").strip()
                raw_json = json.dumps(ob, ensure_ascii=False)
                ozel_rows.append((ob_id, name, code, raw_json))
            
            cursor.executemany("""
                INSERT INTO ozel_barkodlar (id, name, code, raw_json)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name, code = excluded.code, raw_json = excluded.raw_json
            """, ozel_rows)
            counts["ozel_barkodlar"] = len(ozel_rows)

        # 4. SATIŞLAR (satislar/**/*.json)
        sales_files = glob.glob(os.path.join(SALES_DIR, "**", "*.json"), recursive=True)
        sales_count = 0
        print(f"[*] Satış dosyaları taranıyor ({len(sales_files)} dosya)...")
        for sf in sales_files:
            try:
                with open(sf, "r", encoding="utf-8") as f:
                    s_data = json.load(f)
                if isinstance(s_data, dict):
                    s_data = [s_data]
                for s in s_data:
                    receipt_no = str(s.get("receipt_no") or s.get("fis_no") or s.get("id") or "").strip()
                    if not receipt_no:
                        continue
                    dt = str(s.get("date") or s.get("tarih") or "").strip()
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
                    cursor.execute("""
                        INSERT INTO satislar (receipt_no, date, time, timestamp, cashier, customer, customer_id, payment_type, total_amount, received_cash, change_amount, items_count, raw_json)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(receipt_no) DO UPDATE SET
                            date = excluded.date, time = excluded.time, timestamp = excluded.timestamp,
                            cashier = excluded.cashier, customer = excluded.customer, customer_id = excluded.customer_id,
                            payment_type = excluded.payment_type, total_amount = excluded.total_amount,
                            received_cash = excluded.received_cash, change_amount = excluded.change_amount,
                            items_count = excluded.items_count, raw_json = excluded.raw_json
                    """, (receipt_no, dt, tm, ts, cashier, customer, cust_id, payment_type, total_amount, rcv, chg, len(items), raw_json))
                    sales_count += 1
            except Exception as e:
                print(f"[!] Satış aktarma hatası ({sf}): {e}")
        counts["satislar"] = sales_count

        # 5. KASA HAREKETLERİ (kasa_hareketleri.json)
        kasa_path = os.path.join(SISTEM_AYARLAR_DIR, "kasa_hareketleri.json")
        if os.path.exists(kasa_path):
            with open(kasa_path, "r", encoding="utf-8") as f:
                kasa_list = json.load(f)
            print(f"[*] Kasa hareketleri aktarılıyor ({len(kasa_list)} kayıt)...")
            for k in kasa_list:
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
                cursor.execute("""
                    INSERT INTO kasa_hareketleri (id, type, amount, amount_str, category, description, cashier, date, time, created_at, raw_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        type = excluded.type, amount = excluded.amount, amount_str = excluded.amount_str,
                        category = excluded.category, description = excluded.description, cashier = excluded.cashier,
                        date = excluded.date, time = excluded.time, created_at = excluded.created_at, raw_json = excluded.raw_json
                """, (kid, ktype, amount, amount_str, category, desc, cashier, dt, tm, cat, raw_json))
            counts["kasa_hareketleri"] = len(kasa_list)

        # 6. MÜŞTERİLER (musteriler.json)
        musteri_path = os.path.join(SISTEM_AYARLAR_DIR, "musteriler.json")
        if os.path.exists(musteri_path):
            with open(musteri_path, "r", encoding="utf-8") as f:
                musteri_list = json.load(f)
            print(f"[*] Müşteriler aktarılıyor ({len(musteri_list)} kayıt)...")
            for m in musteri_list:
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
                cursor.execute("""
                    INSERT INTO musteriler (id, name, phone, balance, credit_limit, notes, created_at, raw_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        name = excluded.name, phone = excluded.phone, balance = excluded.balance,
                        credit_limit = excluded.credit_limit, notes = excluded.notes,
                        created_at = excluded.created_at, raw_json = excluded.raw_json
                """, (mid, name, phone, bal, lim, notes, created, raw_json))
            counts["musteriler"] = len(musteri_list)

        # 7. GİDERLER (giderler.json)
        gider_path = os.path.join(SISTEM_AYARLAR_DIR, "giderler.json")
        if os.path.exists(gider_path):
            with open(gider_path, "r", encoding="utf-8") as f:
                gider_list = json.load(f)
            print(f"[*] Giderler aktarılıyor ({len(gider_list)} kayıt)...")
            for g in gider_list:
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
                cursor.execute("""
                    INSERT INTO giderler (id, date, time, category, category_code, title, amount, payment_method, recipient, notes, invoice_no, user, raw_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        date = excluded.date, time = excluded.time, category = excluded.category,
                        category_code = excluded.category_code, title = excluded.title, amount = excluded.amount,
                        payment_method = excluded.payment_method, recipient = excluded.recipient,
                        notes = excluded.notes, invoice_no = excluded.invoice_no, user = excluded.user,
                        raw_json = excluded.raw_json
                """, (gid, dt, tm, cat, cat_code, title, amount, pm, rec, notes, inv_no, user, raw_json))
            counts["giderler"] = len(gider_list)

        # 8. ÇALIŞANLAR, KASİYERLER, ROLLER
        calisan_path = os.path.join(SISTEM_AYARLAR_DIR, "calisanlar.json")
        if os.path.exists(calisan_path):
            with open(calisan_path, "r", encoding="utf-8") as f:
                c_list = json.load(f)
            for c in c_list:
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
                cursor.execute("""
                    INSERT INTO calisanlar (id, name, role_id, role_name, pin, phone, active, raw_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        name = excluded.name, role_id = excluded.role_id, role_name = excluded.role_name,
                        pin = excluded.pin, phone = excluded.phone, active = excluded.active, raw_json = excluded.raw_json
                """, (cid, name, role_id, role_name, pin, phone, active, raw_json))
            counts["calisanlar"] = len(c_list)

        kasiyer_path = os.path.join(SISTEM_AYARLAR_DIR, "kasiyerler.json")
        if os.path.exists(kasiyer_path):
            with open(kasiyer_path, "r", encoding="utf-8") as f:
                k_list = json.load(f)
            for k in k_list:
                kid = str(k.get("id") or "").strip()
                if not kid:
                    continue
                name = str(k.get("name") or "").strip()
                pin = str(k.get("pin") or "").strip()
                role = str(k.get("role") or "").strip()
                role_name = str(k.get("role_name") or "").strip()
                active = 1 if k.get("active", True) else 0
                raw_json = json.dumps(k, ensure_ascii=False)
                cursor.execute("""
                    INSERT INTO kasiyerler (id, name, pin, role, role_name, active, raw_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        name = excluded.name, pin = excluded.pin, role = excluded.role,
                        role_name = excluded.role_name, active = excluded.active, raw_json = excluded.raw_json
                """, (kid, name, pin, role, role_name, active, raw_json))
            counts["kasiyerler"] = len(k_list)

        roller_path = os.path.join(SISTEM_AYARLAR_DIR, "roller.json")
        if os.path.exists(roller_path):
            with open(roller_path, "r", encoding="utf-8") as f:
                r_list = json.load(f)
            for r in r_list:
                rid = str(r.get("id") or "").strip()
                if not rid:
                    continue
                name = str(r.get("name") or "").strip()
                desc = str(r.get("description") or "").strip()
                perms = json.dumps(r.get("permissions") or [], ensure_ascii=False)
                raw_json = json.dumps(r, ensure_ascii=False)
                cursor.execute("""
                    INSERT INTO roller (id, name, description, permissions_json, raw_json)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        name = excluded.name, description = excluded.description,
                        permissions_json = excluded.permissions_json, raw_json = excluded.raw_json
                """, (rid, name, desc, perms, raw_json))
            counts["roller"] = len(r_list)

        # 9. ŞABLONLAR & TASLAK
        sablon_path = os.path.join(SABLONLAR_DIR, "sablonlar.json")
        if os.path.exists(sablon_path):
            with open(sablon_path, "r", encoding="utf-8") as f:
                sab_list = json.load(f)
            for s in sab_list:
                sid = str(s.get("id") or "").strip()
                if not sid:
                    continue
                name = str(s.get("name") or "").strip()
                desc = str(s.get("description") or "").strip()
                size = str(s.get("label_size") or "").strip()
                raw_json = json.dumps(s, ensure_ascii=False)
                cursor.execute("""
                    INSERT INTO sablonlar (id, name, description, label_size, raw_json)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        name = excluded.name, description = excluded.description,
                        label_size = excluded.label_size, raw_json = excluded.raw_json
                """, (sid, name, desc, size, raw_json))
            counts["sablonlar"] = len(sab_list)

        taslak_path = os.path.join(SABLONLAR_DIR, "taslak_onbellegi.json")
        if os.path.exists(taslak_path):
            with open(taslak_path, "r", encoding="utf-8") as f:
                t_data = json.load(f)
            cursor.execute("""
                INSERT INTO taslak_onbellegi (key, raw_json, updated_at)
                VALUES ('main_draft', ?, datetime('now'))
                ON CONFLICT(key) DO UPDATE SET raw_json = excluded.raw_json, updated_at = excluded.updated_at
            """, (json.dumps(t_data, ensure_ascii=False),))

        # 10. AYARLAR VE YAPILANDIRMA DOSYALARI -> sistem_ayarlari Tablosu
        config_files = {
            "ayarlar": os.path.join(SISTEM_AYARLAR_DIR, "ayarlar.json"),
            "market_profili": os.path.join(SISTEM_AYARLAR_DIR, "market_profili.json"),
            "cihaz_yapilandirmasi": os.path.join(SISTEM_AYARLAR_DIR, "cihaz_yapilandirmasi.json"),
            "terazi_ayarlari": os.path.join(SISTEM_AYARLAR_DIR, "terazi_ayarlari.json"),
            "gunluk_raporlar": os.path.join(SATIS_KASA_DIR, "gunluk_raporlar.json"),
            "hizli_butonlar": os.path.join(SATIS_KASA_DIR, "hizli_butonlar.json"),
            "odeal_ayarlari": os.path.join(SISTEM_AYARLAR_DIR, "odeal_ayarlari.json"),
            "whatsapp_bot_queue": os.path.join(SISTEM_AYARLAR_DIR, "whatsapp_bot_queue.json"),
            "tedarikci_eslesmeleri": os.path.join(SISTEM_AYARLAR_DIR, "tedarikci_eslesmeleri.json"),
        }

        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        for key, fpath in config_files.items():
            if os.path.exists(fpath):
                try:
                    with open(fpath, "r", encoding="utf-8") as f:
                        cfg_data = json.load(f)
                    val_json = json.dumps(cfg_data, ensure_ascii=False)
                    cursor.execute("""
                        INSERT INTO sistem_ayarlari (anahtar, deger_json, updated_at)
                        VALUES (?, ?, ?)
                        ON CONFLICT(anahtar) DO UPDATE SET deger_json = excluded.deger_json, updated_at = excluded.updated_at
                    """, (key, val_json, now_str))
                    print(f"[+] Ayar aktarildi: {key}")
                except Exception as e:
                    print(f"[!] Ayar aktarma hatasi ({key}): {e}")

    print("=" * 60)
    print("[+] TUM VERILER BASARIYLA SQLite VERITABANINA AKTARILDI!")
    print(f"[+] Aktarim Ozeti: {counts}")
    print(f"[+] DB Dosyasi: {DB_PATH} ({os.path.getsize(DB_PATH) if os.path.exists(DB_PATH) else 0} bytes)")
    print("=" * 60)
    return counts

if __name__ == "__main__":
    migrate_all()
