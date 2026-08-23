# -*- coding: utf-8 -*-
"""
Kapsamlı Günlük & Aylık Faaliyet, Satış, POS Kasa, Fiyat ve Etiket Raporlama Servisi
"""
import os
import re
import calendar
import datetime
from backend.ayarlar import DATA_DIR, PRODUCTS_FILE, SALES_DIR
from backend.araclar.depolama_araclari import load_json, save_json
from backend.araclar.metin_duzenleyici import get_online_or_system_date, format_price_display, parse_price_val

REPORTS_FILE = os.path.join(DATA_DIR, "daily_reports.json")

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

def log_printed_item(barcode: str, title: str, price: str, count: int = 1, source: str = "PC"):
    """Basılan tekli etiket bilgisini günlük rapora işler."""
    log_printed_batch([{"barcode": barcode, "title": title, "price": price, "copies": count}], source=source)

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

        # Günlük satışları oku
        sale_file = os.path.join(SALES_DIR, f"{date_str}.json")
        daily_sales = load_json(sale_file, []) if os.path.exists(sale_file) else []

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

    # Satışlar
    sale_file = os.path.join(SALES_DIR, f"{d_str}.json")
    sales = load_json(sale_file, []) if os.path.exists(sale_file) else []

    total_amount = 0.0
    cash_total = 0.0
    card_total = 0.0
    day_sold_adet = 0.0
    day_sold_kg = 0.0
    cashier_totals = {}
    hourly_distribution = {f"{h:02d}:00": 0.0 for h in range(8, 24)}

    for s in sales:
        amt = float(s.get("total_amount", 0.0))
        total_amount += amt
        ptype = s.get("payment_type", "Nakit")
        if "kart" in ptype.lower():
            card_total += amt
        else:
            cash_total += amt

        for item in s.get("items", []):
            t = item.get("title", "Ürün")
            q = float(item.get("quantity", 1))
            unit_val = item.get("unit", "Adet")
            scale_flag = item.get("is_scale_item", False)
            bc = item.get("barcode", "")
            is_kg = is_kg_item(t, unit_val, scale_flag, bc)
            if is_kg:
                day_sold_kg += q
            else:
                day_sold_adet += q

        # Kasiyer bazlı toplam
        c_name = s.get("cashier", "Kasiyer")
        cashier_totals[c_name] = cashier_totals.get(c_name, 0.0) + amt

        # Saatlik dağılım
        t_str = s.get("time", "12:00:00")
        hour_key = f"{t_str.split(':')[0]}:00"
        if hour_key in hourly_distribution:
            hourly_distribution[hour_key] += amt

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
        "cashier_performance": [
            {"cashier": k, "total": round(v, 2), "total_str": format_price_display(v)}
            for k, v in cashier_totals.items()
        ],
        "hourly_sales": [
            {"hour": h, "amount": round(val, 2), "amount_str": format_price_display(val)}
            for h, val in hourly_distribution.items() if val > 0
        ],
        "sales_list": list(reversed(sales)),
        "price_changes": price_changes,
        "printed_items": printed_items
    }
