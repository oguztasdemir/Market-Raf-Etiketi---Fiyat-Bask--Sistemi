# -*- coding: utf-8 -*-
"""
Hızlı Satış (POS), Sepet & Kasa Satış Motoru
"""
import os
import re
import time
import datetime
from backend.ayarlar import PRODUCTS_FILE, MANAV_PRODUCTS_FILE, SALES_DIR, CUSTOMERS_FILE
from backend.araclar.depolama_araclari import load_json, save_json
from backend.araclar.metin_duzenleyici import parse_price_val, format_price_display
from backend.kasa.kasiyer_servisi import get_active_cashier
from backend.terazi.terazi_servisi import test_scale_connection

def parse_scale_barcode(barcode: str) -> dict:
    """
    27 ile başlayan 13 haneli DIGI/Teraoka terazi barkodlarını ayrıştırır.
    Örnek: '2701001015003'
    - '27': Manav/Terazi Ön Eki
    - '01': Departman (1)
    - '001': PLU No (1 = Domates)
    - '01500': Gramaj (1500 gram = 1.500 Kg)
    - '3': EAN Kontrol Kodu
    """
    clean_bc = str(barcode).strip()
    if not (clean_bc.startswith("27") and len(clean_bc) == 13):
        return None

    try:
        # PLU Çıkarımı: 2. ve 7. karakterler arası (01001 -> PLU 1)
        plu_part = clean_bc[2:7]
        plu = int(plu_part.lstrip("0") or "0")
        if plu == 0:
            # Alternatif 4. ve 7. karakter arası (001 -> PLU 1)
            plu = int(clean_bc[4:7].lstrip("0") or "1")

        # Gramaj: 7. ve 12. karakterler arası (01500 -> 1.500 kg)
        grams = int(clean_bc[7:12])
        weight_kg = round(grams / 1000.0, 3)

        # Manav ürününden birim fiyatı bul
        manav_prods = load_json(MANAV_PRODUCTS_FILE, [])
        matched_item = None
        for p in manav_prods:
            if int(p.get("plu", 0)) == plu:
                matched_item = p
                break

        if matched_item:
            unit_price_val = parse_price_val(matched_item.get("price", "0"))
            total_price_val = round(unit_price_val * weight_kg, 2)

            return {
                "is_scale_item": True,
                "plu": plu,
                "barcode": clean_bc,
                "title": matched_item.get("title", f"PLU {plu}"),
                "unit": "Kg",
                "quantity": weight_kg,
                "unit_price": unit_price_val,
                "unit_price_str": matched_item.get("price", "0,00 TL"),
                "total_price": total_price_val,
                "total_price_str": format_price_display(total_price_val),
                "origin": matched_item.get("origin", "TÜRKİYE")
            }
    except Exception as e:
        print(f"Terazi barkodu ayrıştırma hatası: {e}")

    return None

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
                "title": "1TL (Terazi / Barkodsuz)",
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

    # 3. Standart Ürün Veritabanında Arama
    products = load_json(PRODUCTS_FILE, [])
    for p in products:
        bc = str(p.get("barcode", "")).strip()
        sk = str(p.get("stock_code", "")).strip()
        if bc == q or sk == q:
            price_val = parse_price_val(p.get("price", "0"))
            return {
                "status": "success",
                "source": "catalog",
                "product": {
                    "is_scale_item": False,
                    "barcode": bc,
                    "stock_code": sk,
                    "title": p.get("title", ""),
                    "unit": p.get("unit", "Adet"),
                    "quantity": 1,
                    "unit_price": price_val,
                    "unit_price_str": p.get("price", "0,00 TL"),
                    "total_price": price_val,
                    "total_price_str": p.get("price", "0,00 TL"),
                    "origin": p.get("origin", "TÜRKİYE")
                }
            }

    # 3. Manav Ürünlerinde Gerçek Barkod Arama
    manav_prods = load_json(MANAV_PRODUCTS_FILE, [])
    for p in manav_prods:
        bc = str(p.get("barcode", "")).strip()
        if bc and bc == q:
            price_val = parse_price_val(p.get("price", "0"))
            return {
                "status": "success",
                "source": "manav",
                "product": {
                    "is_scale_item": (p.get("unit", "Kg") == "Kg"),
                    "plu": int(p.get("plu", 1)),
                    "barcode": bc,
                    "title": p.get("title", ""),
                    "unit": p.get("unit", "Adet"),
                    "quantity": 1.0,
                    "unit_price": price_val,
                    "unit_price_str": p.get("price", "0,00 TL"),
                    "total_price": price_val,
                    "total_price_str": p.get("price", "0,00 TL"),
                    "origin": p.get("origin", "TÜRKİYE")
                }
            }

    # 4. İsim bazlı arama (Sadece harf içeren veya en az 3 karakterli metin aramalarında)
    if not (q.isdigit() and len(q) < 6):
        q_lower = q.lower()
        for p in products:
            if q_lower in str(p.get("title", "")).lower():
                price_val = parse_price_val(p.get("price", "0"))
                return {
                    "status": "success",
                    "source": "catalog_fuzzy",
                    "product": {
                        "is_scale_item": False,
                        "barcode": p.get("barcode", ""),
                        "title": p.get("title", ""),
                        "unit": p.get("unit", "Adet"),
                        "quantity": 1,
                        "unit_price": price_val,
                        "unit_price_str": p.get("price", "0,00 TL"),
                        "total_price": price_val,
                        "total_price_str": p.get("price", "0,00 TL"),
                        "origin": p.get("origin", "TÜRKİYE")
                    }
                }

    return {"status": "error", "message": f"'{q}' barkodlu ürün bulunamadı."}

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

        score = 0
        if title_norm.startswith(q_norm):
            score = 95
        elif f" {q_norm}" in f" {title_norm}":
            score = 75
        elif q_norm in title_norm or (bc and q_norm in bc) or (brand and q_norm in normalize(brand)):
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
    Satışı tamamlar, fiş numarası üretir ve günlük satış dosyasına kaydeder.
    """
    items = sale_data.get("items", [])
    if not items:
        return {"status": "error", "message": "Sepette ürün bulunmuyor."}

    total_amount = float(sale_data.get("total_amount", 0.0))
    payment_type = sale_data.get("payment_type", "Nakit")  # Nakit veya Kredi Kartı veya Parçalı
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
    receipt_no = f"FIS-{now.strftime('%Y%m%d')}-{int(time.time()) % 10000:04d}"

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
        "total_vat": round(total_vat, 2),
        "vat_breakdown": vat_breakdown,
        "received_cash": received_cash,
        "change_amount": change_amount,
        "item_count": len(items),
        "total_quantity": sum(float(i.get("quantity", 1)) for i in items),
        "items": items
    }

    # Günlük satış dosyasına ekle
    daily_file = os.path.join(SALES_DIR, f"{date_str}.json")
    daily_sales = load_json(daily_file, [])
    daily_sales.append(sale_record)
    save_json(daily_file, daily_sales)

    return {
        "status": "success",
        "message": f"Satış başarıyla tamamlandı. Fiş No: {receipt_no}",
        "receipt": sale_record
    }

def get_dashboard_summary() -> dict:
    """
    Sağ panel ve ana ekran için canlı finansal, satış, donanım ve stok özetlerini hesaplar.
    """
    now = datetime.datetime.now()
    today_str = now.strftime("%Y-%m-%d")
    month_prefix = now.strftime("%Y-%m")

    daily_total = 0.0
    daily_count = 0
    daily_items_sold = 0

    monthly_total = 0.0
    monthly_count = 0

    # Satış dosyalarını tara
    if os.path.exists(SALES_DIR):
        for f in os.listdir(SALES_DIR):
            if f.endswith(".json"):
                f_path = os.path.join(SALES_DIR, f)
                sales = load_json(f_path, [])
                if f.startswith(today_str):
                    for s in sales:
                        daily_total += float(s.get("total_amount", 0.0))
                        daily_count += 1
                        daily_items_sold += float(s.get("total_quantity", 0))

                if f.startswith(month_prefix):
                    for s in sales:
                        monthly_total += float(s.get("total_amount", 0.0))
                        monthly_count += 1

    # Toplam kayıtlı ürün sayısı
    prods = load_json(PRODUCTS_FILE, [])
    manav_prods = load_json(MANAV_PRODUCTS_FILE, [])
    total_products = len(prods) + len(manav_prods)

    # Terazi canlı bağlantı durumu
    scale_conn = test_scale_connection()

    # Mağaza ayarları
    from backend.ayarlar import SETTINGS_FILE
    settings = load_json(SETTINGS_FILE, {})
    market_name = settings.get("market_name", "YARENLER MARKET")

    active_c = get_active_cashier()

    lifetime_sales = int(settings.get("lifetime_sales_count", 0)) + monthly_count
    lifetime_sales_str = f"{lifetime_sales:,}".replace(",", ".")

    return {
        "market_name": market_name,
        "active_cashier": active_c.get("cashier_name", "Kasa 1 (Kasiyer 1)"),
        "daily_total": round(daily_total, 2),
        "daily_total_str": format_price_display(daily_total),
        "daily_receipt_count": daily_count,
        "daily_items_sold": round(daily_items_sold, 1),
        "monthly_total": round(monthly_total, 2),
        "monthly_total_str": format_price_display(monthly_total),
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
    """Tanımlı hızlı satış butonlarını döner (Maksimum 6 adet)."""
    buttons = load_json(QUICK_BUTTONS_FILE, DEFAULT_QUICK_BUTTONS)
    if not isinstance(buttons, list) or len(buttons) == 0:
        buttons = DEFAULT_QUICK_BUTTONS
        save_json(QUICK_BUTTONS_FILE, buttons)
    return buttons[:6]

def save_quick_buttons(buttons: list):
    """Hızlı buton listesini kaydeder."""
    save_json(QUICK_BUTTONS_FILE, buttons[:6])

def add_quick_button(title: str, code: str, price: float = 0.0, unit: str = "Adet", color: str = "#3b82f6") -> dict:
    """Yeni özel barkod/hızlı buton ekler (Maksimum 6 sınırını denetler)."""
    buttons = get_quick_buttons()
    if len(buttons) >= 6:
        return {
            "status": "error",
            "message": "En fazla 6 adet özel hızlı ürün butonu tanımlayabilirsiniz."
        }

    # Zaten var mı?
    clean_code = str(code).strip()
    for b in buttons:
        if b.get("code") == clean_code:
            return {
                "status": "error",
                "message": f"'{clean_code}' kodlu hızlı buton zaten mevcut."
            }

    new_btn = {
        "id": f"btn_{int(time.time())}_{len(buttons)+1}",
        "title": title.strip() or f"Ürün {len(buttons)+1}",
        "code": clean_code,
        "type": "custom",
        "price": float(price or 0.0),
        "unit": unit or "Adet",
        "color": color or "#3b82f6"
    }
    buttons.append(new_btn)
    save_quick_buttons(buttons)

    return {
        "status": "success",
        "message": f"'{title}' hızlı buton olarak eklendi.",
        "button": new_btn,
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

def get_quick_category_products(category: str = "manav_adet") -> list:
    """
    Seçili kategoriye göre (MANAV ADET, MANAV KG veya BARKODSUZ) alfabetik sıralı hızlı ürün listesi döner.
    """
    cat = str(category or "").strip().lower()
    
    # Türkçe karakter duyarlı alfabetik (A-Z) sıralama
    def tr_sort_key(item):
        t = item["title"].lower()
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
                "id": f"plu_{p.get('plu')}",
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
                "id": f"plu_{p.get('plu')}",
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
        presets = [
            {"id": "bs_5", "title": "Muhtelif 5 TL", "price": 5.0, "price_str": "5,00 TL", "unit": "Adet", "barcode": "BARKODSUZ", "is_scale_item": False},
            {"id": "bs_10", "title": "Muhtelif 10 TL", "price": 10.0, "price_str": "10,00 TL", "unit": "Adet", "barcode": "BARKODSUZ", "is_scale_item": False},
            {"id": "bs_15", "title": "Muhtelif 15 TL", "price": 15.0, "price_str": "15,00 TL", "unit": "Adet", "barcode": "BARKODSUZ", "is_scale_item": False},
            {"id": "bs_20", "title": "Muhtelif 20 TL", "price": 20.0, "price_str": "20,00 TL", "unit": "Adet", "barcode": "BARKODSUZ", "is_scale_item": False},
            {"id": "bs_25", "title": "Muhtelif 25 TL", "price": 25.0, "price_str": "25,00 TL", "unit": "Adet", "barcode": "BARKODSUZ", "is_scale_item": False},
            {"id": "bs_50", "title": "Muhtelif 50 TL", "price": 50.0, "price_str": "50,00 TL", "unit": "Adet", "barcode": "BARKODSUZ", "is_scale_item": False},
            {"id": "bs_100", "title": "Muhtelif 100 TL", "price": 100.0, "price_str": "100,00 TL", "unit": "Adet", "barcode": "BARKODSUZ", "is_scale_item": False},
            {"id": "bs_poset", "title": "Market Poşeti", "price": 0.50, "price_str": "0,50 TL", "unit": "Adet", "barcode": "POSET", "is_scale_item": False}
        ]
        return presets
    else:
        return []
