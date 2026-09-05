import os
import re
import time
import random
import datetime
import threading
from backend.ayarlar import PRODUCTS_FILE, MANAV_PRODUCTS_FILE, SALES_DIR, CUSTOMERS_FILE
from backend.araclar.depolama_araclari import load_json, save_json, get_sales_for_date, save_sales_for_date, list_all_sales_files
from backend.araclar.metin_duzenleyici import parse_price_val, format_price_display, clean_barcode
from backend.kasa.kasiyer_servisi import get_active_cashier
from backend.terazi.terazi_servisi import test_scale_connection

_RECEIPT_SEQ_LOCK = threading.Lock()
_RECEIPT_SEQ = int(time.time() * 1000) % 100000

def get_next_receipt_no(now: datetime.datetime) -> str:
    """A000.000.001 formatında sıralı ve şık fiş seri numarası üretir (SQLite satislar tablosuyla tam senkron)."""
    from backend.araclar.sqlite_servisi import get_connection
    with _RECEIPT_SEQ_LOCK:
        try:
            with get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) FROM satislar;")
                row = cursor.fetchone()
                db_count = row[0] if row else 0
        except Exception:
            db_count = 0

        from backend.ayarlar import SETTINGS_FILE
        settings = load_json(SETTINGS_FILE, {})
        base_count = int(settings.get("lifetime_sales_count", 0))
        current_seq = max(db_count, base_count) + 1
        settings["lifetime_sales_count"] = current_seq
        save_json(SETTINGS_FILE, settings)

    limit = 999_999_999
    c_val = max(1, current_seq)
    letter_index = (c_val - 1) // limit
    letter = chr(65 + (letter_index % 26))
    num = ((c_val - 1) % limit) + 1
    num_str = f"{num:09d}"
    return f"{letter}{num_str[0:3]}.{num_str[3:6]}.{num_str[6:9]}"


# --- Modüler Terazi Barkod Servisi Entegrasyonu ---
from backend.kasa.terazi_barkod_servisi import (
    parse_scale_barcode,
    get_manufacturer_by_barcode_prefix,
    GS1_MANUFACTURER_MAP
)

def safe_parse_float(val, default=0.0) -> float:
    """Virgüllü ('0,00') veya noktalı sayıları güvenli şekilde floata çevirir."""
    if val is None:
        return default
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip().replace('TL', '').replace('tl', '').replace('₺', '').replace(',', '.').strip()
    try:
        return float(s)
    except Exception:
        return default

def find_product_for_pos(query: str) -> dict:
    """
    Barkod veya ürün adına göre anında arama yapar (Hızlı Kasa).
    """
    q = str(query).strip()
    if not q:
        return {"status": "error", "message": "Boş arama sorgusu."}

    # 1. Özel Kod: 1 veya *1 -> 1TL (Terazi / Barkodsuz)
    if q in ("1", "1TL", "1.0", "1,0"):
        return {
            "status": "success",
            "source": "special_one_lira",
            "product": {
                "is_scale_item": False,
                "barcode": "1",
                "stock_code": "1",
                "title": "1TL",
                "brand": "ÖZEL",
                "unit": "Adet",
                "quantity": 1,
                "unit_price": 1.0,
                "unit_price_str": "1,00 TL",
                "total_price": 1.0,
                "total_price_str": "1,00 TL",
                "origin": "TÜRKİYE"
            }
        }

    # 2. Terazi Barkodu Kontrolü (27 ile başlayan 13 hane)
    scale_item = parse_scale_barcode(q)
    if scale_item:
        return {
            "status": "success",
            "source": "scale_barcode",
            "product": scale_item
        }

    # 3. Standart Ürün Veritabanında Arama (Bellek İçi O(1) Hash Haritası ve Çoklu Barkodlar)
    from backend.katalog.katalog_rotalari import get_indexed_products
    products, bc_map = get_indexed_products()
    
    clean_q = clean_barcode(q)
    if clean_q and clean_q in bc_map:
        p = bc_map[clean_q]
        bc = str(p.get("barcode", "")).strip()
        sk = str(p.get("stock_code", "")).strip()
        price_val = parse_price_val(p.get("price", "0"))
        brand_val = p.get("brand") or p.get("firma") or get_manufacturer_by_barcode_prefix(bc)
        return {
            "status": "success",
            "source": "catalog",
            "detected_brand": brand_val,
            "product": {
                "is_scale_item": False,
                "barcode": bc,
                "barcodes": p.get("barcodes") or [bc],
                "stock_code": sk,
                "title": p.get("title", ""),
                "brand": brand_val,
                "unit": p.get("unit", "Adet"),
                "quantity": 1,
                "unit_price": price_val,
                "unit_price_str": p.get("price", "0,00 TL"),
                "total_price": price_val,
                "total_price_str": p.get("price", "0,00 TL"),
                "origin": p.get("origin", "TÜRKİYE"),
                "stock": p.get("stock", 0),
                "kdv": p.get("kdv", 10),
                "vat_rate": p.get("vat_rate", 10)
            }
        }

    q_clean = q.lstrip('0') if q.isdigit() else q
    for p in products:
        bc = str(p.get("barcode", "")).strip()
        sk = str(p.get("stock_code", "")).strip()
        
        all_barcodes = []
        if bc: all_barcodes.append(bc)
        for b in (p.get("barcodes") or p.get("alternate_barcodes") or []):
            b_str = str(b).strip()
            if b_str and b_str not in all_barcodes:
                all_barcodes.append(b_str)

        is_matched = False
        if bc == q or sk == q or q in all_barcodes:
            is_matched = True
        elif q_clean:
            for b in all_barcodes:
                if b.isdigit() and b.lstrip('0') == q_clean:
                    is_matched = True
                    break

        if is_matched:
            price_val = parse_price_val(p.get("price", "0"))
            brand_val = p.get("brand") or p.get("firma") or get_manufacturer_by_barcode_prefix(bc)
            return {
                "status": "success",
                "source": "catalog",
                "detected_brand": brand_val,
                "product": {
                    "is_scale_item": False,
                    "barcode": bc,
                    "barcodes": all_barcodes,
                    "stock_code": sk,
                    "title": p.get("title", ""),
                    "brand": brand_val,
                    "unit": p.get("unit", "Adet"),
                    "quantity": 1,
                    "unit_price": price_val,
                    "unit_price_str": p.get("price", "0,00 TL"),
                    "buying_price": safe_parse_float(p.get("buying_price"), 0.0),
                    "kdv": int(safe_parse_float(p.get("kdv"), 10)),
                    "stock": safe_parse_float(p.get("stock"), 0.0),
                    "total_price": price_val,
                    "total_price_str": p.get("price", "0,00 TL"),
                    "origin": p.get("origin", "TÜRKİYE"),
                    "alternate_barcodes": all_barcodes
                }
            }

    # 4. Manav Ürünlerinde Gerçek Barkod Arama
    manav_prods = load_json(MANAV_PRODUCTS_FILE, [])
    for p in manav_prods:
        bc = str(p.get("barcode", "")).strip()
        bc_clean = bc.lstrip('0') if bc.isdigit() else bc
        if bc and (bc == q or (q_clean and bc_clean == q_clean)):
            price_val = parse_price_val(p.get("price", "0"))
            return {
                "status": "success",
                "source": "manav",
                "detected_brand": "MANAV",
                "product": {
                    "is_scale_item": (p.get("unit", "Kg") == "Kg"),
                    "plu": int(p.get("plu", 1)),
                    "barcode": bc,
                    "title": p.get("title", ""),
                    "brand": "MANAV",
                    "unit": p.get("unit", "Adet"),
                    "quantity": 1.0,
                    "unit_price": price_val,
                    "unit_price_str": p.get("price", "0,00 TL"),
                    "total_price": price_val,
                    "total_price_str": p.get("price", "0,00 TL"),
                    "origin": p.get("origin", "TÜRKİYE")
                }
            }

    # 5. İsim bazlı arama (Sadece harf içeren veya en az 3 karakterli metin aramalarında)
    if not (q.isdigit() and len(q) < 6):
        q_lower = q.lower()
        for p in products:
            if q_lower in str(p.get("title", "")).lower():
                price_val = parse_price_val(p.get("price", "0"))
                brand_val = p.get("brand") or p.get("firma") or get_manufacturer_by_barcode_prefix(p.get("barcode", ""))
                return {
                    "status": "success",
                    "source": "catalog_fuzzy",
                    "detected_brand": brand_val,
                    "product": {
                        "is_scale_item": False,
                        "barcode": p.get("barcode", ""),
                        "title": p.get("title", ""),
                        "brand": brand_val,
                        "unit": p.get("unit", "Adet"),
                        "quantity": 1,
                        "unit_price": price_val,
                        "unit_price_str": p.get("price", "0,00 TL"),
                        "buying_price": safe_parse_float(p.get("buying_price"), 0.0),
                        "kdv": int(safe_parse_float(p.get("kdv"), 10)),
                        "stock": safe_parse_float(p.get("stock"), 0.0),
                        "total_price": price_val,
                        "total_price_str": p.get("price", "0,00 TL"),
                        "origin": p.get("origin", "TÜRKİYE")
                    }
                }

    # 6. Kayıtlı Olmayan Yeni Barkod İçin Firma/Marka Tahmini
    detected_brand = get_manufacturer_by_barcode_prefix(q)
    return {
        "status": "error",
        "message": f"'{q}' barkodlu ürün veritabanında kayıtlı değil.",
        "barcode": q,
        "detected_brand": detected_brand
    }

def search_products_for_pos_autocomplete(query: str, limit: int = 10) -> list:
    """
    POS arama kutusu için canlı, benzerlik puanlı ve Türkçe karakter uyumlu otomatik tamamlama.
    Katalogdaki ürünleri ve manav ürünlerini tarar, en alakalı ilk 10 ürünü döner.
    """
    q = str(query or "").strip().lower()
    if not q or len(q) < 2:
        return []

    def normalize(text):
        if not text:
            return ""
        t = str(text).lower()
        tr_map = str.maketrans("çğışöüİIı", "cgisouiii")
        return t.translate(tr_map)

    q_norm = normalize(q)
    tokens = [t for t in q_norm.split() if t]
    results = []
    seen_keys = set()

    # 1. Manav Ürünleri
    manav_prods = load_json(MANAV_PRODUCTS_FILE, [])
    for p in manav_prods:
        title = str(p.get("title") or p.get("name") or "").strip()
        if not title:
            continue
        title_norm = normalize(title)
        bc = str(p.get("barcode", "")).strip()
        plu = str(p.get("plu", "")).strip()

        score = 0
        if title_norm.startswith(q_norm):
            score = 100
        elif f" {q_norm}" in f" {title_norm}":
            score = 80
        elif len(tokens) > 1 and all(tok in title_norm or tok in bc or (plu and tok == plu) for tok in tokens):
            score = 70
        elif q_norm in title_norm or (bc and q_norm in bc) or (plu and q_norm == plu):
            score = 50

        if score > 0:
            price_val = parse_price_val(p.get("price", "0"))
            key = f"manav_{plu}_{title}"
            if key not in seen_keys:
                seen_keys.add(key)
                is_kg = (str(p.get("unit", "")).strip().lower() == "kg")
                results.append({
                    "score": score,
                    "id": f"plu_{plu}",
                    "title": title,
                    "barcode": bc or (f"PLU-{plu}" if plu else "MANAV"),
                    "plu": int(plu) if plu.isdigit() else None,
                    "unit": p.get("unit", "Adet" if not is_kg else "Kg"),
                    "unit_price": price_val,
                    "price_str": format_price_display(price_val),
                    "is_scale_item": is_kg,
                    "type_badge": "🥬 Manav"
                })

    # 2. Katalog Ürünleri
    catalog_prods = load_json(PRODUCTS_FILE, [])
    for p in catalog_prods:
        title = str(p.get("title", "") or p.get("title1", "")).strip()
        if not title:
            continue
        title_norm = normalize(title)
        bc = str(p.get("barcode", "")).strip()
        brand = str(p.get("brand", "")).strip()
        brand_norm = normalize(brand)

        score = 0
        if title_norm.startswith(q_norm):
            score = 95
        elif f" {q_norm}" in f" {title_norm}":
            score = 75
        elif len(tokens) > 1 and all(tok in title_norm or tok in bc or tok in brand_norm for tok in tokens):
            score = 65
        elif q_norm in title_norm or (bc and q_norm in bc) or (brand_norm and q_norm in brand_norm):
            score = 40

        if score > 0:
            price_val = parse_price_val(p.get("price", "0"))
            key = f"cat_{bc}_{title}"
            if key not in seen_keys:
                seen_keys.add(key)
                unit_str = p.get("unit", "Adet")
                is_kg = (unit_str.lower() == "kg")
                results.append({
                    "score": score,
                    "id": f"prod_{bc}",
                    "title": title,
                    "barcode": bc,
                    "brand": brand,
                    "plu": None,
                    "unit": unit_str,
                    "unit_price": price_val,
                    "price_str": format_price_display(price_val),
                    "is_scale_item": is_kg,
                    "type_badge": "📦 Ürün"
                })

    # Skora ve alfabetiğe göre sırala
    results.sort(key=lambda x: (-x["score"], x["title"]))
    return results[:limit]

def process_pos_checkout(sale_data: dict) -> dict:
    """
    Satışı veya İadeyi tamamlar, fiş numarası üretir, stokları günceller ve günlük satış dosyasına kaydeder.
    """
    items = sale_data.get("items", [])
    if not items:
        return {"status": "error", "message": "Sepette ürün bulunmuyor."}

    total_amount = float(sale_data.get("total_amount", 0.0))
    payment_type = sale_data.get("payment_type", "Nakit")
    is_return = bool(sale_data.get("is_return") or "iade" in payment_type.lower())

    payment_breakdown = sale_data.get("payment_breakdown", {})
    if not payment_breakdown:
        if "kart" in payment_type.lower() and "nakit" not in payment_type.lower():
            payment_breakdown = {"Nakit": 0.0, "Kredi Kartı": total_amount}
        else:
            payment_breakdown = {"Nakit": total_amount, "Kredi Kartı": 0.0}

    received_cash = float(sale_data.get("received_cash", total_amount))
    change_amount = float(sale_data.get("change_amount", 0.0))
    customer_name = sale_data.get("customer_name", "Perakende Müşteri")

    active_cashier = get_active_cashier()
    now = datetime.datetime.now()
    date_str = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%H:%M:%S")
    
    if is_return:
        receipt_no = f"FIS-IADE-{now.strftime('%Y%m%d')}-{now.strftime('%H%M%S')}-{random.randint(1000, 9999)}"
    else:
        receipt_no = get_next_receipt_no(now)

    vat_breakdown = {}
    total_vat = 0.0
    for itm in items:
        tot = float(itm.get("total_price", 0.0))
        kdv_rate = int(itm.get("kdv") or itm.get("vat_rate") or (1 if (itm.get("unit") == "Kg" or itm.get("is_scale_item")) else 10))
        matrah = round(tot / (1.0 + (kdv_rate / 100.0)), 2)
        kdv_amt = round(tot - matrah, 2)
        total_vat += kdv_amt

        rate_key = str(kdv_rate)
        if rate_key not in vat_breakdown:
            vat_breakdown[rate_key] = {"kdv_rate": kdv_rate, "matrah": 0.0, "kdv_tutari": 0.0, "toplam": 0.0}
        vat_breakdown[rate_key]["matrah"] = round(vat_breakdown[rate_key]["matrah"] + matrah, 2)
        vat_breakdown[rate_key]["kdv_tutari"] = round(vat_breakdown[rate_key]["kdv_tutari"] + kdv_amt, 2)
        vat_breakdown[rate_key]["toplam"] = round(vat_breakdown[rate_key]["toplam"] + tot, 2)

    sale_record = {
        "receipt_no": receipt_no,
        "date": date_str,
        "time": time_str,
        "timestamp": now.isoformat(),
        "cashier": active_cashier.get("cashier_name", "Kasiyer"),
        "customer": customer_name,
        "payment_type": payment_type,
        "payment_breakdown": payment_breakdown,
        "total_amount": total_amount,
        "is_return": is_return,
        "total_vat": round(total_vat, 2),
        "vat_breakdown": vat_breakdown,
        "received_cash": received_cash,
        "change_amount": change_amount,
        "item_count": len(items),
        "total_quantity": sum(float(i.get("quantity", 1)) for i in items),
        "items": items
    }

    # Günlük satış dosyasına ekle (Yıl/Ay hiyerarşisi)
    daily_sales = get_sales_for_date(date_str)
    daily_sales.append(sale_record)
    save_sales_for_date(date_str, daily_sales)

    # Otomatik Stok Güncelleme (Satışta Düş, İadede Yükselt)
    try:
        from backend.araclar.depolama_araclari import _STORAGE_LOCK
        with _STORAGE_LOCK:
            products = load_json(PRODUCTS_FILE, [])
            prod_dict = {clean_barcode(p.get("barcode", "")): p for p in products if p.get("barcode")}
            stock_updated = False
            for itm in items:
                bc = clean_barcode(itm.get("barcode", ""))
                qty = float(itm.get("quantity", 1.0))
                if bc in prod_dict:
                    current_stock = float(prod_dict[bc].get("stock", 100))
                    if is_return or itm.get("is_return"):
                        prod_dict[bc]["stock"] = round(current_stock + abs(qty), 2)
                    else:
                        prod_dict[bc]["stock"] = round(current_stock - qty, 2)
                    stock_updated = True
            if stock_updated:
                save_json(PRODUCTS_FILE, products)
                from backend.katalog.katalog_rotalari import invalidate_product_cache
                invalidate_product_cache()
    except Exception as e:
        print(f"[UYARI] Satış/İade sonrası stok güncelleme hatası: {e}")


    # Müşteri Veresiye / Cari Hesabına Otomatik İşleme
    if "veresiye" in payment_type.lower() or "cari" in payment_type.lower() or sale_data.get("customer_id"):
        try:
            from backend.araclar.depolama_araclari import _STORAGE_LOCK
            with _STORAGE_LOCK:
                customers = load_json(CUSTOMERS_FILE, [])
                cust_id = sale_data.get("customer_id")
                matched_cust = None
                
                if cust_id:
                    for c in customers:
                        if c.get("id") == cust_id:
                            matched_cust = c
                            break
                
                if not matched_cust and customer_name and customer_name != "Perakende Müşteri":
                    for c in customers:
                        if c.get("name", "").strip().upper() == customer_name.strip().upper():
                            matched_cust = c
                            break
                    if not matched_cust:
                        matched_cust = {
                            "id": f"cust_{int(now.timestamp() * 1000)}",
                            "name": customer_name.strip().upper(),
                            "phone": "",
                            "balance": 0.0,
                            "credit_limit": 0.0,
                            "notes": "Hızlı Kasa Veresiye Satışından Eklendi",
                            "created_at": now.strftime("%Y-%m-%d %H:%M:%S"),
                            "updated_at": now.strftime("%Y-%m-%d %H:%M:%S"),
                            "transactions": []
                        }
                        customers.append(matched_cust)

                if matched_cust:
                    old_bal = float(matched_cust.get("balance") or 0.0)
                    delta = -total_amount if is_return else total_amount
                    new_bal = round(old_bal + delta, 2)
                    tx_entry = {
                        "id": f"tx_{int(now.timestamp() * 1000)}",
                        "timestamp": now.strftime("%Y-%m-%d %H:%M:%S"),
                        "type": "credit" if is_return else "debt",
                        "amount": round(total_amount, 2),
                        "old_balance": old_bal,
                        "new_balance": new_bal,
                        "payment_method": "Veresiye",
                        "description": f"{'Veresiye İade' if is_return else 'Veresiye Satış'} ({receipt_no})",
                        "receipt_no": receipt_no,
                        "actor": active_cashier.get("cashier_name", "Kasiyer"),
                        "items": items
                    }
                    if "transactions" not in matched_cust:
                        matched_cust["transactions"] = []
                    matched_cust["transactions"].insert(0, tx_entry)
                    matched_cust["balance"] = new_bal
                    matched_cust["updated_at"] = now.strftime("%Y-%m-%d %H:%M:%S")
                    save_json(CUSTOMERS_FILE, customers)
        except Exception as e:
            print(f"[UYARI] Veresiye cari kaydetme hatası: {e}")

    action_label = "İade işlemi" if is_return else "Satış"
    return {
        "status": "success",
        "message": f"{action_label} başarıyla tamamlandı. Fiş No: {receipt_no}",
        "receipt": sale_record
    }


# --- Modüler İade ve Fiş Düzenleme Servisi Entegrasyonu ---
from backend.kasa.pos_iade_servisi import (
    record_cancelled_pos_receipt,
    edit_pos_receipt_details,
    process_receipt_items_return
)

def get_recent_sales_list(limit: int = 100) -> list:
    """Bugünün ve son 7 günün tamamlanan satış/iptal fişlerini (ve tüm veresiye fişlerini) en yeniden eskiye döner."""
    now = datetime.datetime.now()
    cutoff_date = (now - datetime.timedelta(days=7)).strftime("%Y-%m-%d")
    today_str = now.strftime("%Y-%m-%d")
    
    today_sales = get_sales_for_date(today_str)
    # Bağımsız FIS-IADE fişlerini gösterme (artık fiş içi iade uygulanıyor)
    filtered_today = [s for s in today_sales if not str(s.get("receipt_no", "")).startswith("FIS-IADE")]
    all_sales = list(filtered_today)

    if len(all_sales) < limit:
        all_files = list_all_sales_files()
        for f in reversed(all_files):
            if not f.endswith(f"{today_str}.json"):
                f_date = os.path.basename(f).replace('.json', '')
                prev_sales = load_json(f, [])
                for s in prev_sales:
                    if str(s.get("receipt_no", "")).startswith("FIS-IADE"):
                        continue
                    
                    is_veresiye = (
                        "veresiye" in str(s.get("payment_type", "")).lower() or 
                        "cari" in str(s.get("payment_type", "")).lower() or 
                        bool(s.get("customer_id"))
                    )
                    
                    # 7 günden yeni olanlar VEYA veresiye fişleri dahil edilir
                    if f_date >= cutoff_date or is_veresiye:
                        all_sales.append(s)

                if len(all_sales) >= limit:
                    break
    
    return all_sales[-limit:][::-1]

def get_dashboard_summary() -> dict:
    """
    Sağ panel ve ana ekran için canlı finansal, satış, donanım ve stok özetlerini hesaplar.
    """
    now = datetime.datetime.now()
    today_str = now.strftime("%Y-%m-%d")
    month_prefix = now.strftime("%Y-%m")

    daily_gross = 0.0
    daily_returns = 0.0
    daily_count = 0
    daily_items_sold = 0

    monthly_gross = 0.0
    monthly_returns = 0.0
    monthly_count = 0

    # Satış dosyalarını tara (Tüm Yıl/Ay klasörleri - İptalleri Atla & Fiş İçi İadeleri Dahil Et)
    for f_path in list_all_sales_files():
        fname = os.path.basename(f_path)
        sales = load_json(f_path, [])
        if fname.startswith(today_str):
            for s in sales:
                is_cancelled = s.get("is_cancelled") or s.get("payment_type") == "İptal Edildi" or str(s.get("receipt_no", "")).startswith("FIS-IPTAL")
                if is_cancelled:
                    continue

                amt = float(s.get("total_amount", 0.0))
                is_ret = bool(s.get("is_return") or "iade" in str(s.get("payment_type", "")).lower() or str(s.get("receipt_no", "")).startswith("FIS-IADE"))
                if is_ret:
                    daily_returns += abs(amt)
                else:
                    daily_gross += amt
                    daily_items_sold += float(s.get("total_quantity", 0))
                    daily_count += 1
                    
                    # Fiş içi iadeler
                    if isinstance(s.get("returns"), list):
                        for r in s["returns"]:
                            daily_returns += float(r.get("refund_amount", 0.0))

        if fname.startswith(month_prefix):
            for s in sales:
                is_cancelled = s.get("is_cancelled") or s.get("payment_type") == "İptal Edildi" or str(s.get("receipt_no", "")).startswith("FIS-IPTAL")
                if is_cancelled:
                    continue

                amt = float(s.get("total_amount", 0.0))
                is_ret = bool(s.get("is_return") or "iade" in str(s.get("payment_type", "")).lower() or str(s.get("receipt_no", "")).startswith("FIS-IADE"))
                if is_ret:
                    monthly_returns += abs(amt)
                else:
                    monthly_gross += amt
                    monthly_count += 1

                    # Fiş içi iadeler
                    if isinstance(s.get("returns"), list):
                        for r in s["returns"]:
                            monthly_returns += float(r.get("refund_amount", 0.0))

    daily_net = round(max(0.0, daily_gross - daily_returns), 2)
    monthly_net = round(max(0.0, monthly_gross - monthly_returns), 2)

    # Toplam kayıtlı ürün sayısı
    prods = load_json(PRODUCTS_FILE, [])
    manav_prods = load_json(MANAV_PRODUCTS_FILE, [])
    total_products = len(prods) + len(manav_prods)

    # Terazi canlı bağlantı durumu (Hızlı 0.4s soket testi)
    scale_conn = test_scale_connection(timeout_sec=0.4)

    # Mağaza ayarları
    from backend.ayarlar import SETTINGS_FILE
    settings = load_json(SETTINGS_FILE, {})
    market_name = settings.get("market_name", "YARENLER MARKET")

    active_c = get_active_cashier()

    from backend.araclar.sqlite_servisi import get_connection
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM satislar;")
            row = cursor.fetchone()
            total_db_sales = row[0] if row else 0
    except Exception:
        total_db_sales = 0

    lifetime_sales = max(total_db_sales, int(settings.get("lifetime_sales_count", 0)))
    
    # A000.000.001 Formatı (1 milyarda B'ye döner)
    limit = 999_999_999
    c_val = max(1, lifetime_sales)
    letter_index = (c_val - 1) // limit
    letter = chr(65 + (letter_index % 26))
    num = ((c_val - 1) % limit) + 1
    num_str = f"{num:09d}"
    lifetime_sales_str = f"{letter}{num_str[0:3]}.{num_str[3:6]}.{num_str[6:9]}"

    return {
        "market_name": market_name,
        "active_cashier": active_c.get("cashier_name", "Kasa 1 (Kasiyer 1)"),
        "daily_gross": round(daily_gross, 2),
        "daily_gross_str": format_price_display(daily_gross),
        "daily_returns": round(daily_returns, 2),
        "daily_returns_str": f"-{format_price_display(daily_returns)}",
        "daily_total": round(daily_net, 2),
        "daily_total_str": format_price_display(daily_net),
        "daily_receipt_count": daily_count,
        "daily_items_sold": round(daily_items_sold, 1),
        "monthly_gross": round(monthly_gross, 2),
        "monthly_gross_str": format_price_display(monthly_gross),
        "monthly_returns": round(monthly_returns, 2),
        "monthly_returns_str": f"-{format_price_display(monthly_returns)}",
        "monthly_total": round(monthly_net, 2),
        "monthly_total_str": format_price_display(monthly_net),
        "monthly_receipt_count": monthly_count,
        "total_lifetime_sales_count": lifetime_sales,
        "total_lifetime_sales_count_str": lifetime_sales_str,
        "total_catalog_products": total_products,
        "market_products_count": len(prods),
        "manav_products_count": len(manav_prods),
        "scale_status": {
            "online": scale_conn.get("online", False),
            "ip": scale_conn.get("ip", "192.168.1.61"),
            "ping_ms": scale_conn.get("ping_ms")
        },
        "system_time": now.strftime("%d.%m.%Y %H:%M")
    }

# =========================================================
# HIZLI SATIŞ ÖZEL BARKOD & HIZLI ÜRÜN BUTONLARI (MAX 6)
# =========================================================
from backend.ayarlar import QUICK_BUTTONS_FILE

DEFAULT_QUICK_BUTTONS = [
    {
        "id": "btn_barkodsuz",
        "title": "🏷️ Barkodsuz Ürün",
        "code": "barkodsuz",
        "type": "special",
        "price": 0.0,
        "unit": "Adet",
        "color": "#0284c7"
    },
    {
        "id": "btn_manav",
        "title": "🥬 Manav / Terazi",
        "code": "manav",
        "type": "special",
        "price": 0.0,
        "unit": "Kg",
        "color": "#059669"
    }
]

def get_quick_buttons() -> list:
    """Tanımlı hızlı satış butonlarını döner."""
    buttons = load_json(QUICK_BUTTONS_FILE, DEFAULT_QUICK_BUTTONS)
    if not isinstance(buttons, list) or len(buttons) == 0:
        buttons = DEFAULT_QUICK_BUTTONS
        save_json(QUICK_BUTTONS_FILE, buttons)
    return buttons

def save_quick_buttons(buttons: list):
    """Hızlı buton listesini kaydeder."""
    save_json(QUICK_BUTTONS_FILE, buttons[:50])

def add_quick_button(title: str, code: str, price: float = 0.0, unit: str = "Adet", color: str = "#3b82f6", icon: str = "⚡") -> dict:
    """Yeni özel barkod/hızlı buton ekler veya günceller."""
    buttons = get_quick_buttons()

    clean_code = str(code).strip()
    found = False
    for b in buttons:
        if b.get("code") == clean_code or (b.get("title") == title.strip() and clean_code):
            b["title"] = title.strip() or b.get("title")
            b["code"] = clean_code
            b["price"] = float(price or 0.0)
            b["unit"] = unit or "Adet"
            b["color"] = color or "#3b82f6"
            b["icon"] = icon or "⚡"
            found = True
            break

    if not found:
        new_btn = {
            "id": f"btn_{int(time.time())}_{len(buttons)+1}",
            "title": title.strip() or f"Ürün {len(buttons)+1}",
            "code": clean_code,
            "type": "custom",
            "price": float(price or 0.0),
            "unit": unit or "Adet",
            "color": color or "#3b82f6",
            "icon": icon or "⚡"
        }
        buttons.append(new_btn)

    save_quick_buttons(buttons)
    return {
        "status": "success",
        "message": f"'{title}' hızlı kasa butonu olarak kaydedildi.",
        "buttons": buttons
    }

def remove_quick_button(button_id: str) -> dict:
    """Hızlı butonu siler."""
    buttons = get_quick_buttons()
    initial_len = len(buttons)
    buttons = [b for b in buttons if b.get("id") != button_id and b.get("code") != button_id]

    if len(buttons) == initial_len:
        return {"status": "error", "message": "Buton bulunamadı."}

    save_quick_buttons(buttons)
    return {
        "status": "success",
        "message": "Hızlı buton başarıyla kaldırıldı.",
        "buttons": buttons
    }

def get_barkodsuz_products() -> list:
    """Kayıtlı barkodsuz ürünler listesini ve özel sırasını döner."""
    from backend.ayarlar import BARKODSUZ_PRODUCTS_FILE, PRODUCTS_FILE
    from backend.katalog.katalog_rotalari import get_indexed_products

    saved_items = load_json(BARKODSUZ_PRODUCTS_FILE, None)
    if saved_items and isinstance(saved_items, list) and len(saved_items) > 0:
        # Kayıtlı listedeki ürünlerin güncel fiyatlarını katalogdan eşle
        _, bc_map = get_indexed_products()
        for itm in saved_items:
            bc = str(itm.get("barcode") or "").strip()
            if bc and bc in bc_map:
                itm["price"] = parse_price_val(bc_map[bc].get("price", itm.get("price", 0.0)))
                itm["price_str"] = format_price_display(itm["price"])
                itm["unit"] = str(bc_map[bc].get("unit") or itm.get("unit", "Adet"))
            elif "price_str" not in itm:
                itm["price_str"] = format_price_display(itm.get("price", 0.0))
        return saved_items

    # İlk defa çalışıyorsa varsayılan ürünleri yükle ve kaydet
    all_prods, bc_map = get_indexed_products()
    def resolve_catalog_product(search_barcode, search_title_kw, fallback_title, fallback_price, fallback_unit="Adet"):
        clean_bc = str(search_barcode).strip()
        matched = None
        if clean_bc and clean_bc in bc_map:
            matched = bc_map[clean_bc]
        else:
            for p in all_prods:
                p_bc = str(p.get("barcode") or "").strip()
                p_title = str(p.get("title") or p.get("title1") or "").lower()
                if clean_bc and p_bc.lower() == clean_bc.lower():
                    matched = p
                    break
                if search_title_kw and search_title_kw.lower() in p_title:
                    matched = p
                    break
        
        if matched:
            p_price = parse_price_val(matched.get("price", fallback_price))
            p_unit = str(matched.get("unit") or fallback_unit)
            p_title = str(matched.get("title") or matched.get("title1") or fallback_title)
            p_code = str(matched.get("barcode") or clean_bc)
            return {
                "id": f"bs_{p_code}",
                "title": fallback_title or p_title,
                "price": p_price,
                "price_str": format_price_display(p_price),
                "unit": p_unit,
                "barcode": p_code,
                "is_scale_item": False
            }
        else:
            return {
                "id": f"bs_{clean_bc}",
                "title": fallback_title,
                "price": float(fallback_price),
                "price_str": format_price_display(fallback_price),
                "unit": fallback_unit,
                "barcode": clean_bc,
                "is_scale_item": False
            }

    default_items = [
        resolve_catalog_product("BEBETO BURGER", "bebeto jelibon burger", "Bebeto Jelibon Burger", 10.0),
        resolve_catalog_product("Beyaz Yumurta", "beyaz yumurta", "Beyaz Yumurta Adet", 4.50),
        resolve_catalog_product("24000055", "futbol topu", "Futbol Topu", 150.0),
        resolve_catalog_product("KARTON BARDAK", "karton bardak", "Karton Bardak", 2.0),
        resolve_catalog_product("8681873050341", "çakmak tokai", "Çakmak Küçük Boy", 15.0),
        resolve_catalog_product("5 TL", "özkaynak 10 lt", "Özkaynak 10Lt Su", 80.0),
        resolve_catalog_product("ERİK-MUNZUR 5LT", "munzur 5 lt", "Erikli Munzur Su 5Lt", 70.0),
        resolve_catalog_product("24000024", "su 5 litre", "Buzdağı Su 5Lt", 40.0),
    ]
    save_json(BARKODSUZ_PRODUCTS_FILE, default_items)
    return default_items

def save_barkodsuz_products(items: list) -> list:
    """Barkodsuz ürünler sırasını ve listesini kaydeder."""
    from backend.ayarlar import BARKODSUZ_PRODUCTS_FILE
    save_json(BARKODSUZ_PRODUCTS_FILE, items)
    return items

def get_quick_category_products(category: str = "manav_adet") -> list:
    """
    Seçili kategoriye göre (MANAV ADET veya BARKODSUZ) sıralı hızlı ürün listesi döner.
    """
    cat = str(category or "").strip().lower()
    
    # Türkçe karakter duyarlı alfabetik (A-Z) sıralama
    def tr_sort_key(item):
        t = item.get("title", "").lower()
        tr_map = str.maketrans("çğışöü", "cgisou")
        return t.translate(tr_map)

    if cat in ["manav", "manav_adet", "adet"]:
        manav_prods = load_json(MANAV_PRODUCTS_FILE, [])
        items = []
        
        for p in manav_prods:
            name = str(p.get("title") or p.get("name") or "").strip()
            upper_name = name.upper()
            
            if upper_name.startswith("MNV "):
                name = name[4:].strip()
                upper_name = name.upper()
                
            if not name or "ÜRÜN " in upper_name or "URUN " in upper_name:
                continue
            
            if any(w in upper_name for w in ["BEYPiLi", "BEYPİLİÇ", "BONFİLE", "BULGUR", "KESTANE", "SEKER", "ŞEKER"]):
                continue

            unit = str(p.get("unit", "")).strip()
            if unit.lower() != "adet":
                continue

            price_val = parse_price_val(p.get("price", "0"))
            items.append({
                "id": f"plu_{p.get('plu') or p.get('barcode')}",
                "plu": p.get("plu"),
                "title": name,
                "price": price_val,
                "price_str": format_price_display(price_val),
                "unit": "Adet",
                "barcode": p.get("barcode", ""),
                "is_scale_item": False
            })
        
        return sorted(items, key=tr_sort_key)

    elif cat in ["manav_kg", "kg"]:
        manav_prods = load_json(MANAV_PRODUCTS_FILE, [])
        items = []
        
        for p in manav_prods:
            name = str(p.get("title") or p.get("name") or "").strip()
            upper_name = name.upper()
            
            if upper_name.startswith("MNV "):
                name = name[4:].strip()
                upper_name = name.upper()
                
            if not name or "ÜRÜN " in upper_name or "URUN " in upper_name:
                continue
            
            if any(w in upper_name for w in ["BEYPiLi", "BEYPİLİÇ", "BONFİLE", "BULGUR", "KESTANE", "SEKER", "ŞEKER"]):
                continue

            unit = str(p.get("unit", "")).strip()
            if unit.lower() == "adet":
                continue

            price_val = parse_price_val(p.get("price", "0"))
            items.append({
                "id": f"plu_{p.get('plu') or p.get('barcode')}",
                "plu": p.get("plu"),
                "title": name,
                "price": price_val,
                "price_str": format_price_display(price_val),
                "unit": "Kg",
                "barcode": p.get("barcode", ""),
                "is_scale_item": True
            })
        
        return sorted(items, key=tr_sort_key)
    
    elif cat == "barkodsuz":
        # Kullanıcının belirlediği sıralı barkodsuz ürün listesini döner
        return get_barkodsuz_products()
    else:
        return []


# --- Modüler Kasa Hareketleri & X Raporu Servisi Entegrasyonu ---
from backend.kasa.kasa_hareket_servisi import (
    get_x_report_data,
    set_cash_advance,
    get_cash_movements,
    add_cash_movement,
    delete_cash_movement
)
