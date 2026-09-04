# -*- coding: utf-8 -*-
"""
Seçilen Günün Detaylı Satış, Saatlik ve Kategori Dökümü Servisi
"""
import datetime
from backend.araclar.depolama_araclari import get_sales_for_date
from backend.araclar.metin_duzenleyici import format_price_display
from backend.raporlama.raporlama_servisi import (
    _get_today_key,
    is_utility_helper_item,
    is_kg_item,
    detect_product_category,
    _ensure_reports_structure
)


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
        is_cancelled = s.get("is_cancelled") or s.get("payment_type") == "İptal Edildi" or str(s.get("receipt_no", "")).startswith("FIS-IPTAL")
        if is_cancelled:
            continue

        is_ret = s.get("is_return") or "iade" in str(s.get("payment_type", "")).lower() or str(s.get("receipt_no", "")).startswith("FIS-IADE")
        if is_ret:
            amt = abs(float(s.get("total_amount", 0.0)))
            total_amount -= amt
            pb = s.get("payment_breakdown")
            if isinstance(pb, dict) and pb:
                for b_k, b_v in pb.items():
                    b_str = str(b_k).lower()
                    b_amt = abs(float(b_v or 0.0))
                    if "kart" in b_str or "kredi" in b_str:
                        card_total -= b_amt
                    elif "veresiye" in b_str or "cari" in b_str:
                        pass
                    else:
                        cash_total -= b_amt
            else:
                ptype = str(s.get("payment_type", "Nakit")).lower()
                if "kart" in ptype or "kredi" in ptype:
                    card_total -= amt
                elif "veresiye" in ptype or "cari" in ptype:
                    pass
                else:
                    cash_total -= amt
            continue

        amt = float(s.get("total_amount", 0.0))
        
        # Fiş içi iade düşümü
        in_place_ret = 0.0
        if isinstance(s.get("returns"), list):
            for r in s["returns"]:
                r_amt = float(r.get("refund_amount", 0.0))
                in_place_ret += r_amt
                r_type = str(r.get("refund_type", "Nakit")).lower()
                if "kart" in r_type or "kredi" in r_type:
                    card_total -= r_amt
                elif "veresiye" in r_type or "cari" in r_type:
                    pass
                else:
                    cash_total -= r_amt

        net_amt = max(0.0, amt - in_place_ret)
        total_amount += net_amt

        # Satış ödeme türü ve parçalı ödeme ayrımı
        cur_sale_cash = 0.0
        cur_sale_card = 0.0
        pb = s.get("payment_breakdown")
        if isinstance(pb, dict) and pb:
            for b_k, b_v in pb.items():
                b_str = str(b_k).lower()
                b_amt = float(b_v or 0.0)
                if "kart" in b_str or "kredi" in b_str:
                    card_total += b_amt
                    cur_sale_card += b_amt
                elif "veresiye" in b_str or "cari" in b_str:
                    pass
                else:
                    cash_total += b_amt
                    cur_sale_cash += b_amt
        else:
            ptype = str(s.get("payment_type", "Nakit")).lower()
            if "kart" in ptype or "kredi" in ptype:
                card_total += amt
                cur_sale_card += amt
            elif "veresiye" in ptype or "cari" in ptype:
                pass
            else:
                cash_total += amt
                cur_sale_cash += amt

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
        cashier_dict[c_name]["card"] += cur_sale_card
        cashier_dict[c_name]["cash"] += cur_sale_cash

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
            hourly_data[h_key]["card"] += cur_sale_card
            hourly_data[h_key]["cash"] += cur_sale_cash

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

