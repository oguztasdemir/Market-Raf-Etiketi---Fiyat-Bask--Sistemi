# -*- coding: utf-8 -*-
import os
import json
import sqlite3
import pandas as pd
import io
import zipfile
import datetime
import shutil
from backend.araclar.sqlite_servisi import init_db, db_session, DB_PATH
from backend.ayarlar import DATA_DIR, PRODUCTS_FILE, MANAV_PRODUCTS_FILE, SETTINGS_FILE, MARKET_PROFILE_FILE, EMPLOYEES_FILE

SEED_PRODUCTS_FILE = os.path.join(os.path.dirname(__file__), "..", "katalog", "seed_urunler.json")
SEED_MANAV_PRODUCTS_FILE = os.path.join(os.path.dirname(__file__), "..", "katalog", "seed_manav_urunleri.json")
MARKER_FILE = os.path.join(DATA_DIR, "installed.marker")

def export_prices_to_excel():
    """
    Mevcut veritabanındaki tüm Market Ürünlerini ve Manav / Terazi Ürünlerini 
    ayrı sayfalar (sheet) halinde Excel (.xlsx) formatında BytesIO olarak döndürür.
    Kurulum sihirbazı veya yedekleme aktarımında birebir uyumludur.
    """
    conn = sqlite3.connect(DB_PATH)
    
    # 1. Market Ürünleri
    query_urunler = """
        SELECT barcode, title, brand, category, vat, buy_price, price_num, stock, unit, origin 
        FROM urunler
        ORDER BY title ASC
    """
    df_urunler = pd.read_sql_query(query_urunler, conn)
    df_urunler.columns = [
        "Barkod", "Ürün Adı", "Marka", "Kategori", "KDV (%)", 
        "Alış Fiyatı (TL)", "Satış Fiyatı (TL)", "Stok", "Birim", "Menşei"
    ]
    
    # 2. Manav / Terazi Ürünleri
    query_manav = """
        SELECT plu, barcode, title, name, price, scale_price, unit, origin
        FROM manav_urunleri
        ORDER BY plu ASC
    """
    df_manav = pd.read_sql_query(query_manav, conn)
    conn.close()
    
    import re
    # OpenPyXL için geçersiz karakterleri temizleme (ASCII kontrol karakterleri vb.)
    ILLEGAL_CHARACTERS_RE = re.compile(r'[\000-\010]|[\013-\014]|[\016-\037]')
    
    def clean_str(val):
        if val is None or pd.isna(val):
            return ""
        return ILLEGAL_CHARACTERS_RE.sub('', str(val)).strip()

    for col in df_urunler.columns:
        if df_urunler[col].dtype == object:
            df_urunler[col] = df_urunler[col].apply(clean_str)

    # Fiyat temizleme (sayısal hale getirme)
    def clean_price_val(val):
        if not val or pd.isna(val):
            return 0.0
        s = str(val).replace("TL", "").replace("tl", "").replace("₺", "").replace(" ", "").replace(",", ".").strip()
        try:
            return float(s)
        except Exception:
            return 0.0

    if not df_manav.empty:
        df_manav["Satis_Fiyati"] = df_manav["price"].apply(clean_price_val)
        df_manav["Terazi_Fiyati"] = df_manav["scale_price"].apply(clean_price_val)
        df_manav_export = df_manav[["plu", "barcode", "title", "name", "Satis_Fiyati", "Terazi_Fiyati", "unit", "origin"]].copy()
        df_manav_export.columns = [
            "PLU No", "Barkod", "Ürün Adı (Etiket)", "Kısa Ad", 
            "Satış Fiyatı (TL)", "Terazi Fiyatı (TL)", "Birim", "Menşei"
        ]
        for col in df_manav_export.columns:
            if df_manav_export[col].dtype == object:
                df_manav_export[col] = df_manav_export[col].apply(clean_str)
    else:
        df_manav_export = pd.DataFrame(columns=[
            "PLU No", "Barkod", "Ürün Adı (Etiket)", "Kısa Ad", 
            "Satış Fiyatı (TL)", "Terazi Fiyatı (TL)", "Birim", "Menşei"
        ])
    
    # Excel oluşturma (Multi-sheet)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df_urunler.to_excel(writer, index=False, sheet_name="Market Ürünleri")
        df_manav_export.to_excel(writer, index=False, sheet_name="Manav & Terazi Ürünleri")
        
    output.seek(0)
    return output

def restore_from_backup_zip(zip_bytes):
    """Mevcut bir OYMAPOS zip yedeğinden tüm verileri çıkartıp kurulumu tamamlar."""
    print("=== YEDEKTEN GERİ YÜKLEME BAŞLATILDI ===")
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        with zipfile.ZipFile(io.BytesIO(zip_bytes), 'r') as zipf:
            zipf.extractall(DATA_DIR)
            
        # SQLite veritabanı şemasını kontrol et/tazele
        init_db()
        
        # Kurulum tamamlandı işaretini koy
        with open(MARKER_FILE, "w", encoding="utf-8") as f:
            f.write(f"Installed via backup at {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            
        print("=== YEDEKTEN GERİ YÜKLEME BAŞARIYLA TAMAMLANDI ===")
        return True, "Yedek başarıyla geri yüklendi ve sistem hazırlandı!"
    except Exception as e:
        print(f"Yedek geri yükleme hatası: {e}")
        return False, f"Yedek dosyası açılamadı veya bozuk: {str(e)}"

def execute_setup(market_info, excel_file_bytes=None):
    """Sistemi sıfırdan ilklendirir, opsiyonel seed kataloğu yükler, opsiyonel Excel fiyatlarını uygular."""
    print("=== KURULUM İŞLEMİ BAŞLATILDI ===")
    
    # 1. Eski veritabanını kaldır
    if os.path.exists(DB_PATH):
        try:
            os.remove(DB_PATH)
            print("Eski veritabanı dosyası silindi.")
        except Exception as e:
            print(f"Uyarı: Eski veritabanı silinemedi, tablolar sıfırlanacak: {e}")
            
    # 2. Veritabanı tablolarını sıfırdan yarat
    init_db()
    
    # 3. Seed ürün listesini oku (Opsiyonel)
    include_seed = market_info.get("include_seed_catalog", True)
    seed_products = []
    if include_seed and os.path.exists(SEED_PRODUCTS_FILE):
        with open(SEED_PRODUCTS_FILE, "r", encoding="utf-8") as f:
            seed_products = json.load(f)
        print(f"Seed dosyasından {len(seed_products)} ürün yüklendi.")
    else:
        print("Sıfır boş veritabanı seçildi.")
    
    # 4. Opsiyonel Excel Fiyatlarını uygula
    excel_prices = {}
    if excel_file_bytes:
        try:
            excel_file = pd.ExcelFile(io.BytesIO(excel_file_bytes))
            for sheet_name in excel_file.sheet_names:
                df = pd.read_excel(excel_file, sheet_name=sheet_name)
                
                barcode_col = None
                buy_col = None
                sell_col = None
                vat_col = None
                
                for col in df.columns:
                    col_upper = str(col).upper()
                    if "BARKOD" in col_upper:
                        barcode_col = col
                    elif "ALIŞ" in col_upper or "ALIS" in col_upper:
                        buy_col = col
                    elif "SATIŞ" in col_upper or "SATIS" in col_upper or "TERAZİ" in col_upper:
                        sell_col = col
                    elif "KDV" in col_upper:
                        vat_col = col
                
                if barcode_col:
                    for _, row in df.iterrows():
                        bc = str(row[barcode_col]).split('.')[0].strip()
                        if not bc or bc == 'nan':
                            continue
                        
                        buy_price = float(row[buy_col]) if buy_col and pd.notna(row[buy_col]) else 0.0
                        sell_price = float(row[sell_col]) if sell_col and pd.notna(row[sell_col]) else 0.0
                        vat = float(row[vat_col]) if vat_col and pd.notna(row[vat_col]) else 0.0
                        
                        excel_prices[bc] = {
                            "buy_price": buy_price,
                            "price_num": sell_price,
                            "vat": vat
                        }
            print(f"Excel dosyalarından toplam {len(excel_prices)} adet ürün/fiyat eşleştirildi.")
        except Exception as e:
            print(f"Excel fiyat yükleme hatası: {e}")
            
    # 5. Ürünleri güncelle ve SQLite'a toplu yaz
    with db_session() as conn:
        cursor = conn.cursor()
        
        urunler_rows = []
        for p in seed_products:
            bc = p.get("barcode", "").strip()
            
            if bc in excel_prices:
                p["buy_price"] = excel_prices[bc]["buy_price"]
                p["price_num"] = excel_prices[bc]["price_num"]
                p["vat"] = excel_prices[bc]["vat"]
                p["price"] = f"{p['price_num']:.2f} TL".replace(".", ",")
            else:
                p["buy_price"] = 0.0
                p["price_num"] = 0.0
                p["price"] = ""
                
            raw_json = json.dumps(p, ensure_ascii=False)
            
            urunler_rows.append((
                bc,
                p.get("title", ""),
                p.get("title1", ""),
                p.get("title2", ""),
                p.get("brand", ""),
                p.get("price", ""),
                p.get("price_num", 0.0),
                p.get("buy_price", 0.0),
                p.get("vat", 0.0),
                0.0, # stock
                p.get("origin", "TÜRKİYE"),
                p.get("unit", "Adet"),
                p.get("category", "Genel"),
                datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                raw_json
            ))
            
        if urunler_rows:
            cursor.executemany("""
                INSERT OR REPLACE INTO urunler (
                    barcode, title, title1, title2, brand, price, price_num, buy_price, vat, stock, origin, unit, category, date, updated_at, raw_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, urunler_rows)
        
        # 6. Manav ürünlerini de sıfırla veya güncelle
        manav_products = []
        if include_seed:
            manav_source = SEED_MANAV_PRODUCTS_FILE if os.path.exists(SEED_MANAV_PRODUCTS_FILE) else MANAV_PRODUCTS_FILE
            if os.path.exists(manav_source):
                try:
                    with open(manav_source, "r", encoding="utf-8") as f:
                        manav_products = json.load(f)
                except:
                    pass
                
        manav_rows = []
        for m in manav_products:
            plu = m.get("plu")
            bc = m.get("barcode", "")
            
            if bc in excel_prices:
                m["price"] = f"{excel_prices[bc]['price_num']:.2f} TL".replace(".", ",")
                m["scale_price"] = m["price"]
            else:
                m["price"] = ""
                m["scale_price"] = ""
                
            raw_json = json.dumps(m, ensure_ascii=False)
            manav_rows.append((
                plu,
                bc,
                m.get("title", ""),
                m.get("name", ""),
                m.get("price", ""),
                m.get("scale_price", ""),
                m.get("unit", "Kg"),
                m.get("origin", "TÜRKİYE"),
                m.get("sync_status", "synced"),
                raw_json
            ))
            
        if manav_rows:
            cursor.executemany("""
                INSERT OR REPLACE INTO manav_urunleri (
                    plu, barcode, title, name, price, scale_price, unit, origin, sync_status, raw_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, manav_rows)
            
        # 7. Create default Admin cashier profile
        cursor.execute("DELETE FROM calisanlar")
        cursor.execute("""
            INSERT INTO calisanlar (id, name, role_id, role_name, pin, phone, active, raw_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, ("admin", "Yönetici", "admin", "Müdür", "1234", "", 1, json.dumps({
            "id": "admin", "name": "Yönetici", "role_id": "admin", "role_name": "Müdür", "pin": "1234", "phone": "", "active": 1
        })))
        cursor.execute("""
            INSERT INTO calisanlar (id, name, role_id, role_name, pin, phone, active, raw_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, ("kasa1", "Kasa 1 (Kasiyer)", "admin", "Müdür", "1234", "", 1, json.dumps({
            "id": "kasa1", "name": "Kasa 1 (Kasiyer)", "role_id": "admin", "role_name": "Müdür", "pin": "1234", "phone": "", "active": 1
        })))

        
    # Write JSON files for previews/backups compatibility
    with open(PRODUCTS_FILE, "w", encoding="utf-8") as f:
        json.dump(seed_products, f, ensure_ascii=False, indent=2)
        
    if manav_products:
        with open(MANAV_PRODUCTS_FILE, "w", encoding="utf-8") as f:
            json.dump(manav_products, f, ensure_ascii=False, indent=2)

    # 8. Save Market Settings
    settings_payload = {
        "market_name": market_info.get("market_name", "YARENLER SÜPERMARKET"),
        "branch_name": market_info.get("branch_name", "Merkez Şube"),
        "phone": market_info.get("phone", ""),
        "address": market_info.get("address", ""),
        "tax_office": market_info.get("tax_office", ""),
        "tax_no": market_info.get("tax_no", ""),
        "receipt_paper_width": market_info.get("receipt_paper_width", "80mm"),
        "daily_cash_advance": float(market_info.get("daily_cash_advance") or 500.0),
        "receipt_footer_note": market_info.get("receipt_footer_note", "Bizi tercih ettiğiniz için teşekkür ederiz. İyi günler dileriz!"),
        "scale_model": market_info.get("scale_model", "DIGI_SM100"),
        "scale_ip": market_info.get("scale_ip", "192.168.1.61"),
        "auto_backup_enabled": market_info.get("auto_backup_enabled", True)
    }
    
    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(settings_payload, f, ensure_ascii=False, indent=2)
        
    with open(MARKET_PROFILE_FILE, "w", encoding="utf-8") as f:
        json.dump(settings_payload, f, ensure_ascii=False, indent=2)
        
    try:
        from backend.araclar.sqlite_servisi import set_setting
        for k, v in settings_payload.items():
            set_setting(k, str(v))
    except Exception as e:
        print("SQLite ayarlar tablosuna kaydedilemedi:", e)

    # 9. Create marker file to complete installation
    with open(MARKER_FILE, "w", encoding="utf-8") as f:
        f.write(f"Installed at {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        
    print("=== KURULUM BAŞARIYLA TAMAMLANDI ===")
    return True, "Kurulum başarıyla tamamlandı!"
