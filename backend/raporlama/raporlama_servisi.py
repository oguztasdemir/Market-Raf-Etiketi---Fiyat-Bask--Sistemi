# -*- coding: utf-8 -*-
"""
Kapsamlı Günlük & Aylık Faaliyet, Satış, POS Kasa, Fiyat ve Etiket Raporlama Servisi
"""
import os
import re
import calendar
import datetime
from backend.ayarlar import DATA_DIR, SALES_DIR, REPORTS_FILE
from backend.araclar.depolama_araclari import load_json, save_json, get_sales_for_date, list_all_sales_files
from backend.araclar.metin_duzenleyici import get_online_or_system_date, format_price_display

MONTH_NAMES_TR = [
    "", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
]

def is_utility_helper_item(title: str, barcode: str = "") -> bool:
    """
    Kasadaki 1TL, 5TL, 10TL, Terazi Barkodsuz gibi hızlı tutar/yardımcı kalemlerin
    en çok satan ürünler listelerine ve istatistiklerine girmesini engeller.
    """
    if not title:
        return True
    t_clean = str(title).strip().upper()
    
    # 1TL, 5TL, 10TL, 20TL, 50TL, 100TL, 200TL kalıpları
    patterns = [
        r'^\d+\s*TL\b',
        r'^\d+\s*TL',
        r'^\d+,\d+\s*TL',
        r'^\d+\.\d+\s*TL',
        r'HIZLI TUTAR',
        r'BARKODSUZ',
        r'YARDIMCI'
    ]
    for pat in patterns:
        if re.search(pat, t_clean):
            return True
            
    if "1TL" in t_clean or "5TL" in t_clean or "10TL" in t_clean or "TERAZI / BARKODSUZ" in t_clean or "BARKODSUZ" in t_clean:
        return True

    return False

def is_kg_item(title: str, unit: str = "Adet", is_scale_item: bool = False, barcode: str = "") -> bool:
    """Ürünün tartım (Kg) mı yoksa Adet mi olduğunu belirler."""
    if is_scale_item:
        return True
    u = str(unit or "").strip().lower()
    if u in ["kg", "kilo", "gram", "gr"]:
        return True
    t = str(title or "").strip().upper()
    if " KG" in t and not any(k in t for k in ["ADET", "DMT", "DEMET", "TANE", "PK", "PAKET"]):
        return True
    bc = str(barcode or "").strip()
    if bc.startswith("270") or bc.startswith("280") or bc.startswith("290"):
        if not any(k in t for k in ["ADET", "DMT", "DEMET", "TANE", "PK", "PAKET"]):
            return True
    return False

def detect_product_category(title: str = "", is_scale: bool = False, unit: str = "Adet", barcode: str = "") -> str:
    """Ürünün reyon / ürün grubunu akıllıca tespit eder."""
    if is_kg_item(title, unit, is_scale, barcode) or str(barcode).startswith("PLU_"):
        return "Manav & Terazi"
        
    t_clean = str(title or "").lower()
    
    # 1. Temel Gıda & Şarküteri
    gida_kw = [
        "süt", "peynir", "yoğurt", "un", "şeker", "yağ", "zeytin", "ekmek", "makarna", "pirinç",
        "et", "tavuk", "balık", "salça", "helva", "sucuk", "sosis", "salam", "yumurta", "tereyağ",
        "kaşar", "bulgur", "nohut", "mercimek", "fasulye", "makarna", "erişte", "tuz", "baharat",
        "bal", "reçel", "çorba", "konserve", "ton", "tost", "böreklik", "yufka", "lor", "kaymak"
    ]
    if any(k in t_clean for k in gida_kw):
        return "Temel Gıda & Şarküteri"
        
    # 2. İçecek & Atıştırmalık
    snack_kw = [
        "su", "kola", "coca", "pepsi", "fanta", "sprite", "gazoz", "meyve suyu", "çay", "kahve",
        "bisküvi", "çikolata", "gofret", "kek", "cips", "fındık", "fıstık", "çekirdek", "sakız",
        "enerji", "maden suyu", "soda", "ayran", "şalgam", "limonata", "ice tea", "lipton", "eti",
        "ülker", "haribo", "dondurma", "şekerleme", "bonbon"
    ]
    if any(k in t_clean for k in snack_kw):
        return "İçecek & Atıştırmalık"
        
    # 3. Temizlik & Kozmetik
    clean_kw = [
        "deterjan", "yumuşatıcı", "sabun", "şampuan", "peçete", "havlu", "diş", "kolonya",
        "çamaşır", "bulaşık", "temizleyici", "çöp", "bez", "jilet", "pamuk", "ped", "ıslak mendil",
        "kireç", "parlatıcı", "tuz ruhu", "çamaşır suyu", "ace", "domestos", "fairy", "prıl", "pril",
        "ariel", "omo", "yumoş", "vernel", "pantene", "elidor", "colgate", "sensodyne"
    ]
    if any(k in t_clean for k in clean_kw):
        return "Temizlik & Kozmetik"
        
    return "Genel & Diğer"

def _get_today_key() -> str:
    """Gün anahtarını döner (Örn: 2026-08-22)."""
    return datetime.datetime.now().strftime("%Y-%m-%d")

def _get_now_time_str() -> str:
    """Saat bilgisini döner (Örn: 16:25)."""
    return datetime.datetime.now().strftime("%H:%M")

def _get_display_date_str() -> str:
    """Türkçe gün metnini döner (Örn: 22 Ağu 2026)."""
    return get_online_or_system_date()

def _ensure_reports_structure() -> dict:
    """Rapor dosyasını yükler."""
    if not os.path.exists(REPORTS_FILE):
        save_json(REPORTS_FILE, {})
        return {}
    data = load_json(REPORTS_FILE, {})
    if not isinstance(data, dict):
        data = {}
    return data

def log_price_change(barcode: str, title: str, old_price: str, new_price: str, source: str = "PC"):
    """Fiyat değişikliğini günlük rapora işler."""
    if not barcode or not new_price or old_price == new_price:
        return

    reports = _ensure_reports_structure()
    day_key = _get_today_key()
    
    if day_key not in reports:
        reports[day_key] = {
            "date_key": day_key,
            "display_date": _get_display_date_str(),
            "stats": {
                "mobile_price_changes": 0,
                "pc_price_changes": 0,
                "total_printed_barcodes": 0,
                "mobile_printed_barcodes": 0,
                "pc_printed_barcodes": 0
            },
            "price_changes": [],
            "printed_items": []
        }

    reports[day_key]["price_changes"].append({
        "barcode": barcode,
        "title": title,
        "old_price": old_price,
        "new_price": new_price,
        "time": _get_now_time_str(),
        "source": source
    })

    if source.upper() == "MOBILE":
        reports[day_key]["stats"]["mobile_price_changes"] += 1
    else:
        reports[day_key]["stats"]["pc_price_changes"] += 1

    save_json(REPORTS_FILE, reports)

def log_printed_batch(items: list, source: str = "PC"):
    """Basılan barkod grubunu günlük rapora işler."""
    if not items or not isinstance(items, list):
        return

    reports = _ensure_reports_structure()
    day_key = _get_today_key()

    if day_key not in reports:
        reports[day_key] = {
            "date_key": day_key,
            "display_date": _get_display_date_str(),
            "stats": {
                "mobile_price_changes": 0,
                "pc_price_changes": 0,
                "total_printed_barcodes": 0,
                "mobile_printed_barcodes": 0,
                "pc_printed_barcodes": 0
            },
            "price_changes": [],
            "printed_items": []
        }

    day_report = reports[day_key]
    src_clean = "MOBILE" if "MOB" in str(source).upper() else "PC"
    batch_count = sum(int(item.get("copies", 1)) for item in items)

    day_report["stats"]["total_printed_barcodes"] = day_report["stats"].get("total_printed_barcodes", 0) + batch_count
    if src_clean == "MOBILE":
        day_report["stats"]["mobile_printed_barcodes"] = day_report["stats"].get("mobile_printed_barcodes", 0) + batch_count
    else:
        day_report["stats"]["pc_printed_barcodes"] = day_report["stats"].get("pc_printed_barcodes", 0) + batch_count

    day_report["printed_items"].insert(0, {
        "time": _get_now_time_str(),
        "total_count": batch_count,
        "source": src_clean,
        "items": items
    })
    save_json(REPORTS_FILE, reports)

def get_monthly_calendar_report(year: int = None, month: int = None) -> dict:
    """
    Belirtilen yıl ve ay için takvim günleri ve aylık kümülatif istatistikleri döner.
    """
    now = datetime.datetime.now()
    y = int(year or now.year)
    m = int(month or now.month)

    # Ay sınırları ve gün kısıtlaması (Daha gelmemiş gelecek günler listede gözükmez)
    _, num_days = calendar.monthrange(y, m)
    month_key = f"{y:04d}-{m:02d}"
    month_name_tr = f"{MONTH_NAMES_TR[m]} {y}"

    today_dt = now.date()
    if y == today_dt.year and m == today_dt.month:
        max_day = min(num_days, today_dt.day)
    elif (y < today_dt.year) or (y == today_dt.year and m < today_dt.month):
        max_day = num_days
    else:
        max_day = 0  # Gelecek aylar için henüz gün gelmedi

    activity_reports = _ensure_reports_structure()
    days_data = []

    monthly_total_sales = 0.0
    monthly_receipt_count = 0
    monthly_sold_adet = 0.0
    monthly_sold_kg = 0.0
    payment_breakdown = {"Nakit": 0.0, "Kredi Kartı": 0.0}
    product_sales_counter = {}
    best_day = {"date": "-", "total": 0.0}

    for day in range(1, max_day + 1):
        day_date = datetime.date(y, m, day)
        date_str = day_date.strftime("%Y-%m-%d")
        weekday = day_date.weekday()  # 0: Pazartesi, 6: Pazar

        # Günlük satışları oku (Yıl/Ay hiyerarşisi)
        daily_sales = get_sales_for_date(date_str)

        day_sales_total = 0.0
        day_receipts = len(daily_sales)
        day_sold_adet = 0.0
        day_sold_kg = 0.0
        day_cash = 0.0
        day_card = 0.0

        for sale in daily_sales:
            amt = float(sale.get("total_amount", 0.0))
            day_sales_total += amt
            ptype = sale.get("payment_type", "Nakit")
            if "kart" in ptype.lower():
                day_card += amt
                payment_breakdown["Kredi Kartı"] += amt
            else:
                day_cash += amt
                payment_breakdown["Nakit"] += amt

            for item in sale.get("items", []):
                t = item.get("title", "Ürün")
                q = float(item.get("quantity", 1))
                tot = float(item.get("total_price", 0.0))
                bc = item.get("barcode", "")
                unit_val = item.get("unit", "Adet")
                scale_flag = item.get("is_scale_item", False)
                
                is_kg = is_kg_item(t, unit_val, scale_flag, bc)
                if is_kg:
                    day_sold_kg += q
                    monthly_sold_kg += q
                else:
                    day_sold_adet += q
                    monthly_sold_adet += q

                if not is_utility_helper_item(t, bc):
                    if t not in product_sales_counter:
                        product_sales_counter[t] = {
                            "title": t,
                            "quantity": 0.0,
                            "revenue": 0.0,
                            "is_kg": is_kg,
                            "unit": "Kg" if is_kg else "Adet"
                        }
                    product_sales_counter[t]["quantity"] += q
                    product_sales_counter[t]["revenue"] += tot

        monthly_total_sales += day_sales_total
        monthly_receipt_count += day_receipts

        if day_sales_total > best_day["total"]:
            best_day = {"date": f"{day} {MONTH_NAMES_TR[m]}", "total": day_sales_total}

        # Günlük fiyat ve etiket aktiviteleri
        act = activity_reports.get(date_str, {})
        stats = act.get("stats", {})
        price_changes = int(stats.get("mobile_price_changes", 0) + stats.get("pc_price_changes", 0))
        printed_count = int(stats.get("total_printed_barcodes", 0))

        # Günün en çok satan ürünü özeti (Yardımcı kalemler hariç)
        day_top_item_str = ""
        if daily_sales:
            d_counter = {}
            for s in daily_sales:
                for it in s.get("items", []):
                    t = it.get("title", "Ürün")
                    bc = it.get("barcode", "")
                    unit_val = it.get("unit", "Adet")
                    scale_flag = it.get("is_scale_item", False)
                    is_kg = is_kg_item(t, unit_val, scale_flag, bc)
                    if not is_utility_helper_item(t, bc):
                        if t not in d_counter:
                            d_counter[t] = {"q": 0.0, "is_kg": is_kg}
                        d_counter[t]["q"] += float(it.get("quantity", 1))
            if d_counter:
                top_p, top_data = max(d_counter.items(), key=lambda x: x[1]["q"])
                top_q = top_data["q"]
                if top_data["is_kg"]:
                    q_disp = f"{top_q:.2f} Kg"
                else:
                    q_disp = f"{int(top_q) if top_q.is_integer() else round(top_q, 1)} Ad"
                day_top_item_str = f"{top_p} ({q_disp})"

        has_data = day_receipts > 0 or price_changes > 0 or printed_count > 0

        # Günlük adet ve kg özet metni
        sold_parts = []
        if day_sold_adet > 0:
            sold_parts.append(f"{int(day_sold_adet) if day_sold_adet.is_integer() else round(day_sold_adet, 1)} Adet")
        if day_sold_kg > 0:
            sold_parts.append(f"{day_sold_kg:.2f} Kg")
        day_sold_summary = " • ".join(sold_parts) if sold_parts else "0 Adet"

        days_data.append({
            "day": day,
            "date": date_str,
            "weekday": weekday,
            "is_today": (date_str == _get_today_key()),
            "has_data": has_data,
            "sales_total": round(day_sales_total, 2),
            "sales_total_str": format_price_display(day_sales_total),
            "receipt_count": day_receipts,
            "items_sold": round(day_sold_adet + day_sold_kg, 2),
            "sold_adet": round(day_sold_adet, 1),
            "sold_kg": round(day_sold_kg, 2),
            "sold_summary_str": day_sold_summary,
            "cash_total": round(day_cash, 2),
            "card_total": round(day_card, 2),
            "price_changes_count": price_changes,
            "printed_barcodes_count": printed_count,
            "day_top_item_str": day_top_item_str
        })

    # En çok satan ürünler (İlk 6)
    top_products = []
    for title, info in sorted(product_sales_counter.items(), key=lambda x: x[1]["revenue"], reverse=True)[:6]:
        is_k = info.get("is_kg", False)
        q_val = info["quantity"]
        if is_k:
            q_str = f"{q_val:.2f} Kg"
        else:
            q_str = f"{int(q_val) if q_val.is_integer() else q_val:.1f} Adet"

        top_products.append({
            "title": title,
            "quantity": round(q_val, 2) if is_k else round(q_val, 1),
            "quantity_str": q_str,
            "unit": info.get("unit", "Adet"),
            "revenue": round(info["revenue"], 2),
            "revenue_str": format_price_display(info["revenue"])
        })

    avg_basket = round(monthly_total_sales / monthly_receipt_count, 2) if monthly_receipt_count > 0 else 0.0

    # Aylık toplam fiyat ve baskı faaliyetleri
    total_monthly_price_changes = sum(d["price_changes_count"] for d in days_data)
    total_monthly_printed_barcodes = sum(d["printed_barcodes_count"] for d in days_data)

    now_dt = datetime.datetime.now()
    is_current_month = (y == now_dt.year and m == now_dt.month)
    is_past_month = (y < now_dt.year) or (y == now_dt.year and m < now_dt.month)

    if is_current_month:
        month_period_title = f"{month_name_tr} Ayı Performansı (Ayın {now_dt.day}'sine Kadarki Durum)"
        month_status_badge = f"Devam Eden Ay (Bugün: {now_dt.day} {MONTH_NAMES_TR[m]})"
    elif is_past_month:
        month_period_title = f"{month_name_tr} Ayı Kapanış Performansı (Tamamlandı)"
        month_status_badge = "Ay Tamamlandı (Kapanış Raporu)"
    else:
        month_period_title = f"{month_name_tr} Ayı Gelecek Dönem"
        month_status_badge = "Gelecek Dönem"

    # Aylık genel Adet ve Kg özet metni
    m_sold_parts = []
    if monthly_sold_adet > 0:
        m_sold_parts.append(f"{int(monthly_sold_adet) if monthly_sold_adet.is_integer() else round(monthly_sold_adet, 1)} Adet")
    if monthly_sold_kg > 0:
        m_sold_parts.append(f"{monthly_sold_kg:.2f} Kg")
    monthly_sold_summary = " • ".join(m_sold_parts) if m_sold_parts else "0 Adet • 0,00 Kg"

    return {
        "status": "success",
        "year": y,
        "month": m,
        "month_name_tr": month_name_tr,
        "month_period_title": month_period_title,
        "month_status_badge": month_status_badge,
        "is_current_month": is_current_month,
        "is_past_month": is_past_month,
        "first_weekday": datetime.date(y, m, 1).weekday(),
        "total_days": num_days,
        "days": days_data,
        "monthly_summary": {
            "month_period_title": month_period_title,
            "month_status_badge": month_status_badge,
            "is_current_month": is_current_month,
            "is_past_month": is_past_month,
            "total_sales": round(monthly_total_sales, 2),
            "total_sales_str": format_price_display(monthly_total_sales),
            "receipt_count": monthly_receipt_count,
            "items_sold": round(monthly_sold_adet + monthly_sold_kg, 2),
            "sold_adet": round(monthly_sold_adet, 1),
            "sold_kg": round(monthly_sold_kg, 2),
            "sold_summary_str": monthly_sold_summary,
            "avg_basket": avg_basket,
            "avg_basket_str": format_price_display(avg_basket),
            "total_price_changes": total_monthly_price_changes,
            "total_printed_barcodes": total_monthly_printed_barcodes,
            "payment_breakdown": {
                "cash": round(payment_breakdown["Nakit"], 2),
                "cash_str": format_price_display(payment_breakdown["Nakit"]),
                "card": round(payment_breakdown["Kredi Kartı"], 2),
                "card_str": format_price_display(payment_breakdown["Kredi Kartı"])
            },
            "best_day": {
                "date": best_day["date"],
                "total": round(best_day["total"], 2),
                "total_str": format_price_display(best_day["total"])
            },
            "top_products": top_products
        }
    }

def get_detailed_day_report(date_str: str = None) -> dict:
    """
    Seçilen gün için tüm satışları, fişleri, saatlik dağılımı ve aktiviteleri döner.
    """
    d_str = date_str or _get_today_key()

    # Satışlar (Yıl/Ay hiyerarşisi)
    sales = get_sales_for_date(d_str)

    total_amount = 0.0
    cash_total = 0.0
    card_total = 0.0
    day_sold_adet = 0.0
    day_sold_kg = 0.0
    cashier_dict = {}
    
    # Kategori / Reyon Ciro Dağılım Havuzu
    category_map = {
        "Manav & Terazi": {"name": "Manav & Terazi", "revenue": 0.0, "items_count": 0.0, "color": "#10b981", "icon": "🥦"},
        "Temel Gıda & Şarküteri": {"name": "Temel Gıda & Şarküteri", "revenue": 0.0, "items_count": 0.0, "color": "#38bdf8", "icon": "🥛"},
        "İçecek & Atıştırmalık": {"name": "İçecek & Atıştırmalık", "revenue": 0.0, "items_count": 0.0, "color": "#f59e0b", "icon": "🍫"},
        "Temizlik & Kozmetik": {"name": "Temizlik & Kozmetik", "revenue": 0.0, "items_count": 0.0, "color": "#c084fc", "icon": "🧼"},
        "Genel & Diğer": {"name": "Genel & Diğer", "revenue": 0.0, "items_count": 0.0, "color": "#94a3b8", "icon": "📦"}
    }
    
    # 24 Saatlik Detaylı Satış ve Ciro Havuzu
    hourly_data = {}
    for h in range(0, 24):
        h_start = f"{h:02d}:00"
        h_end = f"{(h+1)%24:02d}:00"
        hourly_data[h_start] = {
            "hour": h_start,
            "hour_num": h,
            "hour_label": f"{h_start} - {h_end}",
            "revenue": 0.0,
            "receipt_count": 0,
            "items_sold": 0.0,
            "sold_adet": 0.0,
            "sold_kg": 0.0,
            "cash": 0.0,
            "card": 0.0
        }

    for s in sales:
        amt = float(s.get("total_amount", 0.0))
        total_amount += amt
        ptype = s.get("payment_type", "Nakit")
        is_card = "kart" in ptype.lower()
        if is_card:
            card_total += amt
        else:
            cash_total += amt

        # Kasiyer bazlı detaylı toplama
        c_name = s.get("cashier", "Kasiyer") or "Kasiyer"
        if c_name not in cashier_dict:
            cashier_dict[c_name] = {
                "cashier": c_name,
                "receipt_count": 0,
                "items_sold": 0.0,
                "cash": 0.0,
                "card": 0.0,
                "total": 0.0
            }
        cashier_dict[c_name]["receipt_count"] += 1
        cashier_dict[c_name]["total"] += amt
        if is_card:
            cashier_dict[c_name]["card"] += amt
        else:
            cashier_dict[c_name]["cash"] += amt

        # Satış Saati Tespiti
        t_str = str(s.get("time") or s.get("datetime") or "12:00:00")
        try:
            time_part = t_str.split(" ")[-1] if " " in t_str else t_str
            h_int = int(time_part.split(":")[0].strip())
            h_key = f"{h_int:02d}:00"
        except Exception:
            h_key = "12:00"

        if h_key in hourly_data:
            hourly_data[h_key]["revenue"] += amt
            hourly_data[h_key]["receipt_count"] += 1
            if is_card:
                hourly_data[h_key]["card"] += amt
            else:
                hourly_data[h_key]["cash"] += amt

        for item in s.get("items", []):
            t = item.get("title", "Ürün")
            q = float(item.get("quantity", 1))
            tot_price = float(item.get("total_price", 0.0))
            unit_val = item.get("unit", "Adet")
            scale_flag = item.get("is_scale_item", False)
            bc = item.get("barcode", "")
            is_kg = is_kg_item(t, unit_val, scale_flag, bc)
            
            # Kategori Tespit ve Ekleme
            cat = detect_product_category(t, scale_flag, unit_val, bc)
            if cat in category_map:
                category_map[cat]["revenue"] += tot_price
                category_map[cat]["items_count"] += q

            if is_kg:
                day_sold_kg += q
                if h_key in hourly_data:
                    hourly_data[h_key]["sold_kg"] += q
            else:
                day_sold_adet += q
                if h_key in hourly_data:
                    hourly_data[h_key]["sold_adet"] += q
            
            if h_key in hourly_data:
                hourly_data[h_key]["items_sold"] += q
            
            cashier_dict[c_name]["items_sold"] += q

    # Kasiyer Performans Listesi
    cashier_performance = []
    for c_name, c_data in cashier_dict.items():
        c_tot = round(c_data["total"], 2)
        c_pct = round((c_tot / total_amount * 100), 1) if total_amount > 0 else 0.0
        cashier_performance.append({
            "cashier": c_name,
            "receipt_count": c_data["receipt_count"],
            "items_sold": round(c_data["items_sold"], 1),
            "cash": round(c_data["cash"], 2),
            "cash_str": format_price_display(c_data["cash"]),
            "card": round(c_data["card"], 2),
            "card_str": format_price_display(c_data["card"]),
            "total": c_tot,
            "total_str": format_price_display(c_tot),
            "percentage": c_pct
        })
    cashier_performance.sort(key=lambda x: x["total"], reverse=True)

    # Kategori / Reyon Ciro Dağılım Listesi
    category_breakdown = []
    for cat_key, cat_data in category_map.items():
        c_rev = round(cat_data["revenue"], 2)
        c_pct = round((c_rev / total_amount * 100), 1) if total_amount > 0 else 0.0
        if c_rev > 0 or total_amount == 0:
            category_breakdown.append({
                "category": cat_key,
                "icon": cat_data["icon"],
                "color": cat_data["color"],
                "revenue": c_rev,
                "revenue_str": format_price_display(c_rev),
                "items_count": round(cat_data["items_count"], 1),
                "percentage": c_pct
            })
    category_breakdown.sort(key=lambda x: x["revenue"], reverse=True)

    # Dün ve Geçen Hafta Karşılaştırmaları (Trend Analizi)
    yesterday_comparison = None
    last_week_comparison = None
    try:
        curr_dt = datetime.datetime.strptime(d_str, "%Y-%m-%d").date()
        yesterday_str = (curr_dt - datetime.timedelta(days=1)).strftime("%Y-%m-%d")
        last_week_str = (curr_dt - datetime.timedelta(days=7)).strftime("%Y-%m-%d")
        
        yest_sales = get_sales_for_date(yesterday_str)
        yest_total = sum(float(s.get("total_amount", 0.0)) for s in yest_sales)
        
        if yest_total > 0:
            diff_y = total_amount - yest_total
            pct_y = round((diff_y / yest_total) * 100, 1)
            yesterday_comparison = {
                "date": yesterday_str,
                "total": round(yest_total, 2),
                "total_str": format_price_display(yest_total),
                "diff_amount": round(diff_y, 2),
                "diff_amount_str": format_price_display(abs(diff_y)),
                "diff_percent": pct_y,
                "is_positive": diff_y >= 0
            }

        lw_sales = get_sales_for_date(last_week_str)
        lw_total = sum(float(s.get("total_amount", 0.0)) for s in lw_sales)
        
        if lw_total > 0:
            diff_lw = total_amount - lw_total
            pct_lw = round((diff_lw / lw_total) * 100, 1)
            last_week_comparison = {
                "date": last_week_str,
                "total": round(lw_total, 2),
                "total_str": format_price_display(lw_total),
                "diff_amount": round(diff_lw, 2),
                "diff_amount_str": format_price_display(abs(diff_lw)),
                "diff_percent": pct_lw,
                "is_positive": diff_lw >= 0
            }
    except Exception:
        pass

    # Saatlik Detay Listesini Oluştur ve En Yoğun Saati Bul
    hourly_breakdown = []
    max_rev = 0.0
    peak_hour_entry = None

    for h in range(0, 24):
        h_key = f"{h:02d}:00"
        h_info = hourly_data[h_key]
        rev = round(h_info["revenue"], 2)
        pct = round((rev / total_amount * 100), 1) if total_amount > 0 else 0.0
        
        entry = {
            "hour": h_info["hour"],
            "hour_num": h_info["hour_num"],
            "hour_label": h_info["hour_label"],
            "revenue": rev,
            "revenue_str": format_price_display(rev),
            "receipt_count": h_info["receipt_count"],
            "items_sold": round(h_info["items_sold"], 1),
            "sold_adet": round(h_info["sold_adet"], 1),
            "sold_kg": round(h_info["sold_kg"], 2),
            "cash": round(h_info["cash"], 2),
            "cash_str": format_price_display(h_info["cash"]),
            "card": round(h_info["card"], 2),
            "card_str": format_price_display(h_info["card"]),
            "percentage": pct,
            "is_peak": False
        }
        if rev > max_rev:
            max_rev = rev
            peak_hour_entry = entry
        hourly_breakdown.append(entry)

    if peak_hour_entry and max_rev > 0:
        peak_hour_entry["is_peak"] = True

    # Günlük ürün bazlı satış sıralaması (Çoktan aza - Yardımcı kalemler hariç)
    day_product_counter = {}
    for s in sales:
        for item in s.get("items", []):
            t = item.get("title", "Ürün")
            bc = item.get("barcode", "")
            unit_val = item.get("unit", "Adet")
            scale_flag = item.get("is_scale_item", False)
            is_kg = is_kg_item(t, unit_val, scale_flag, bc)

            if not is_utility_helper_item(t, bc):
                q = float(item.get("quantity", 1))
                tot = float(item.get("total_price", 0.0))
                if t not in day_product_counter:
                    day_product_counter[t] = {
                        "title": t,
                        "barcode": bc,
                        "quantity": 0.0,
                        "revenue": 0.0,
                        "is_kg": is_kg,
                        "unit": "Kg" if is_kg else "Adet"
                    }
                day_product_counter[t]["quantity"] += q
                day_product_counter[t]["revenue"] += tot

    day_top_products = []
    for t, info in sorted(day_product_counter.items(), key=lambda x: (x[1]["quantity"], x[1]["revenue"]), reverse=True):
        is_k = info.get("is_kg", False)
        q_val = info["quantity"]
        if is_k:
            q_str = f"{q_val:.2f} Kg"
        else:
            q_str = f"{int(q_val) if q_val.is_integer() else q_val:.1f} Adet"

        day_top_products.append({
            "title": t,
            "barcode": info["barcode"],
            "quantity": round(q_val, 2) if is_k else round(q_val, 1),
            "quantity_str": q_str,
            "unit": info.get("unit", "Adet"),
            "revenue": round(info["revenue"], 2),
            "revenue_str": format_price_display(info["revenue"])
        })

    # Fiyat değişiklikleri & Baskılar
    activity_reports = _ensure_reports_structure()
    act = activity_reports.get(d_str, {})
    price_changes = act.get("price_changes", [])
    printed_items = act.get("printed_items", [])
    stats = act.get("stats", {})

    total_printed_labels = stats.get("total_printed_barcodes", 0)
    if not total_printed_labels and printed_items:
        total_printed_labels = sum(int(pi.get("total_count", 1)) for pi in printed_items)

    new_products_count = sum(1 for pc in price_changes if pc.get("old_price") in ["0,00 TL", "0.00 TL", "", "-", "Yeni Ürün"])
    updated_prices_count = len(price_changes) - new_products_count if len(price_changes) >= new_products_count else len(price_changes)

    return {
        "status": "success",
        "date": d_str,
        "is_today": (d_str == _get_today_key()),
        "total_amount": round(total_amount, 2),
        "total_amount_str": format_price_display(total_amount),
        "receipt_count": len(sales),
        "items_sold": round(day_sold_adet + day_sold_kg, 2),
        "sold_adet": round(day_sold_adet, 1),
        "sold_kg": round(day_sold_kg, 2),
        "sold_summary_str": (f"{int(day_sold_adet) if day_sold_adet.is_integer() else round(day_sold_adet, 1)} Adet" if day_sold_adet > 0 else "0 Adet") + (f" • {day_sold_kg:.2f} Kg" if day_sold_kg > 0 else ""),
        "cash_total": round(cash_total, 2),
        "cash_total_str": format_price_display(cash_total),
        "card_total": round(card_total, 2),
        "card_total_str": format_price_display(card_total),
        "price_changes_count": len(price_changes),
        "updated_prices_count": updated_prices_count,
        "new_products_count": new_products_count,
        "total_printed_labels": total_printed_labels,
        "day_top_products": day_top_products,
        "cashier_performance": cashier_performance,
        "category_breakdown": category_breakdown,
        "yesterday_comparison": yesterday_comparison,
        "last_week_comparison": last_week_comparison,
        "hourly_breakdown": hourly_breakdown,
        "peak_hour": peak_hour_entry,
        "hourly_sales": [
            {"hour": h["hour"], "amount": h["revenue"], "amount_str": h["revenue_str"], "receipt_count": h["receipt_count"]}
            for h in hourly_breakdown if h["revenue"] > 0
        ],
        "sales_list": list(reversed(sales)),
        "price_changes": price_changes,
        "printed_items": printed_items
    }

def get_weekly_heatmap_report(year: int = None, month: int = None) -> dict:
    """
    Haftanın 7 günü (Pazartesi-Pazar) ve 24 saati için satış yoğunluğu ısı haritası (Heatmap) üretir.
    """
    today_dt = datetime.datetime.now().date()
    y = year or today_dt.year
    m = month or today_dt.month
    
    num_days = calendar.monthrange(y, m)[1]
    
    day_names = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"]
    day_short_names = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"]

    # 7 x 24 Matris Yapısı
    matrix = {}
    day_totals = {d: {"weekday": d, "day_name": day_names[d], "short_name": day_short_names[d], "revenue": 0.0, "receipt_count": 0} for d in range(7)}
    hour_totals = {h: {"hour": h, "hour_label": f"{h:02d}:00", "revenue": 0.0, "receipt_count": 0} for h in range(24)}

    for d in range(7):
        matrix[d] = {}
        for h in range(24):
            matrix[d][h] = {
                "weekday": d,
                "day_name": day_names[d],
                "short_name": day_short_names[d],
                "hour": h,
                "hour_str": f"{h:02d}:00",
                "hour_range": f"{h:02d}:00 - {(h+1)%24:02d}:00",
                "revenue": 0.0,
                "receipt_count": 0,
                "items_sold": 0.0
            }

    total_heatmap_rev = 0.0
    total_heatmap_receipts = 0
    
    for day in range(1, num_days + 1):
        day_date = datetime.date(y, m, day)
        date_str = day_date.strftime("%Y-%m-%d")
        w_day = day_date.weekday() # 0: Pazartesi .. 6: Pazar
        
        sales = get_sales_for_date(date_str)
        if not sales:
            continue
        for s in sales:
            amt = float(s.get("total_amount", 0.0))
            total_heatmap_rev += amt
            total_heatmap_receipts += 1
            
            day_totals[w_day]["revenue"] += amt
            day_totals[w_day]["receipt_count"] += 1
            
            t_str = str(s.get("time") or s.get("datetime") or "12:00:00")
            try:
                time_part = t_str.split(" ")[-1] if " " in t_str else t_str
                h_int = int(time_part.split(":")[0].strip())
                h_int = max(0, min(23, h_int))
            except Exception:
                h_int = 12
                
            hour_totals[h_int]["revenue"] += amt
            hour_totals[h_int]["receipt_count"] += 1
            
            matrix[w_day][h_int]["revenue"] += amt
            matrix[w_day][h_int]["receipt_count"] += 1
            
            for item in s.get("items", []):
                matrix[w_day][h_int]["items_sold"] += float(item.get("quantity", 1))

    # Maksimum yoğunluğu tespit et
    max_cell_rev = max((matrix[d][h]["revenue"] for d in range(7) for h in range(24)), default=0.0)
    
    flat_cells = []
    peak_cell = None
    max_score = 0.0

    for d in range(7):
        for h in range(24):
            cell = matrix[d][h]
            rev = round(cell["revenue"], 2)
            rcpt = cell["receipt_count"]
            cell["revenue"] = rev
            cell["revenue_str"] = format_price_display(rev)
            
            # Yoğunluk Skoru (0 - 100)
            score = (rev / max_cell_rev * 100) if max_cell_rev > 0 else 0.0
            cell["intensity_score"] = round(score, 1)
            
            # Renk Seviyesi (0: Yok, 1: Düşük, 2: Orta, 3: Yüksek, 4: Zirve)
            if score == 0 or rev == 0:
                level = 0
            elif score < 25:
                level = 1
            elif score < 55:
                level = 2
            elif score < 80:
                level = 3
            else:
                level = 4
            cell["level"] = level
            
            if score > max_score and rev > 0:
                max_score = score
                peak_cell = cell
                
            flat_cells.append(cell)

    # Formatlanan Gün Toplamları
    for dt in day_totals.values():
        dt["revenue_str"] = format_price_display(round(dt["revenue"], 2))

    # Formatlanan Saat Toplamları
    for ht in hour_totals.values():
        ht["revenue_str"] = format_price_display(round(ht["revenue"], 2))

    # En Yoğun Gün
    busiest_day = max(day_totals.values(), key=lambda x: x["revenue"], default=None)

    # En Yoğun Saat Dilimi
    peak_hour = max(hour_totals.values(), key=lambda x: x["revenue"], default=None)

    # Önerilen Kasa / Personel Takviye Saatleri
    staffing_alerts = []
    for cell in sorted(flat_cells, key=lambda x: x["intensity_score"], reverse=True):
        if cell["intensity_score"] >= 40 and len(staffing_alerts) < 4:
            staffing_alerts.append({
                "day_name": cell["day_name"],
                "hour_range": cell["hour_range"],
                "revenue_str": cell["revenue_str"],
                "receipt_count": cell["receipt_count"],
                "intensity_score": cell["intensity_score"]
            })

    tr_months = ["", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
    m_name = tr_months[m] if 1 <= m <= 12 else str(m)

    return {
        "status": "success",
        "year": y,
        "month": m,
        "month_name": m_name,
        "total_revenue": round(total_heatmap_rev, 2),
        "total_revenue_str": format_price_display(total_heatmap_rev),
        "total_receipts": total_heatmap_receipts,
        "matrix": matrix,
        "flat_cells": flat_cells,
        "day_totals": list(day_totals.values()),
        "hour_totals": list(hour_totals.values()),
        "busiest_day": busiest_day,
        "peak_hour": peak_hour,
        "peak_cell": peak_cell,
        "staffing_alerts": staffing_alerts
    }
