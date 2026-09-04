# -*- coding: utf-8 -*-
"""
Haftalık Saatlik Satış Yoğunluğu Isı Haritası Servisi
"""
import datetime
from backend.araclar.depolama_araclari import get_sales_for_date
from backend.araclar.metin_duzenleyici import format_price_display


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
            is_cancelled = s.get("is_cancelled") or s.get("payment_type") == "İptal Edildi" or str(s.get("receipt_no", "")).startswith("FIS-IPTAL")
            if is_cancelled:
                continue

            is_ret = s.get("is_return") or "iade" in str(s.get("payment_type", "")).lower() or str(s.get("receipt_no", "")).startswith("FIS-IADE")
            if is_ret:
                amt = abs(float(s.get("total_amount", 0.0)))
                total_heatmap_rev -= amt
                day_totals[w_day]["revenue"] -= amt
                continue

            amt = float(s.get("total_amount", 0.0))
            in_place_ret = 0.0
            if isinstance(s.get("returns"), list):
                for r in s["returns"]:
                    in_place_ret += float(r.get("refund_amount", 0.0))

            net_amt = max(0.0, amt - in_place_ret)
            total_heatmap_rev += net_amt
            total_heatmap_receipts += 1
            
            day_totals[w_day]["revenue"] += net_amt
            day_totals[w_day]["receipt_count"] += 1
            
            t_str = str(s.get("time") or s.get("datetime") or "12:00:00")
            try:
                time_part = t_str.split(" ")[-1] if " " in t_str else t_str
                h_int = int(time_part.split(":")[0].strip())
                h_int = max(0, min(23, h_int))
            except Exception:
                h_int = 12
                
            hour_totals[h_int]["revenue"] += net_amt
            hour_totals[h_int]["receipt_count"] += 1
            
            matrix[w_day][h_int]["revenue"] += net_amt
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
