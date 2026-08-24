# -*- coding: utf-8 -*-
"""
Market Gelir / Gider, Dükkan Kirası, Personel Maaşı & Muhasebe Servisi
"""
import os
import time
import calendar
import datetime
from backend.ayarlar import SALES_DIR, EXPENSES_FILE
from backend.araclar.depolama_araclari import load_json, save_json, get_sales_for_date

CATEGORY_METADATA = {
    "Dükkan Kirası": {"icon": "🏢", "color": "#f59e0b", "code": "rent"},
    "Personel Maaşı & Avans": {"icon": "👥", "color": "#38bdf8", "code": "salary"},
    "Elektrik, Su & Faturalar": {"icon": "💡", "color": "#ec4899", "code": "utilities"},
    "Toptancı / Mal Alımı": {"icon": "🚚", "color": "#10b981", "code": "supplier"},
    "Temizlik & Sarf Malzeme": {"icon": "🧹", "color": "#8b5cf6", "code": "cleaning"},
    "Vergi, Muhasebe & Diğer": {"icon": "🧾", "color": "#cbd5e1", "code": "tax_other"}
}

def format_currency(val: float) -> str:
    """Tutar değerini 1.250,50 TL formatına çevirir."""
    try:
        val = float(val)
        return f"{val:,.2f} TL".replace(",", "X").replace(".", ",").replace("X", ".")
    except Exception:
        return "0,00 TL"

def get_accounting_overview(year: int = None, month: int = None) -> dict:
    """
    Belirtilen yıl ve ay için satış gelirleri, giderler, dükkan kirası, personel maaşları ve net kâr hesaplar.
    """
    now = datetime.datetime.now()
    y = year or now.year
    m = month or now.month

    num_days = calendar.monthrange(y, m)[1]
    month_prefix = f"{y:04d}-{m:02d}"

    # 1. Satış Gelirlerini Hesapla (Yıl/Ay hiyerarşisi)
    total_sales_income = 0.0
    cash_income = 0.0
    card_income = 0.0
    total_receipts = 0

    for day in range(1, num_days + 1):
        date_str = f"{month_prefix}-{day:02d}"
        sales = get_sales_for_date(date_str)
        for s in sales:
            amt = float(s.get("total_amount", 0.0))
            ptype = str(s.get("payment_type", "Nakit")).lower()
            total_sales_income += amt
            total_receipts += 1
            if "kart" in ptype or "kredi" in ptype:
                card_income += amt
            else:
                cash_income += amt

    # 2. Giderleri Hesapla
    all_expenses = load_json(EXPENSES_FILE, [])
    month_expenses = []
    total_expenses = 0.0

    category_sums = {cat: 0.0 for cat in CATEGORY_METADATA}

    for exp in all_expenses:
        exp_date = str(exp.get("date", ""))
        if exp_date.startswith(month_prefix):
            amt = float(exp.get("amount", 0.0))
            total_expenses += amt
            cat = exp.get("category", "Vergi, Muhasebe & Diğer")
            if cat in category_sums:
                category_sums[cat] += amt
            else:
                category_sums["Vergi, Muhasebe & Diğer"] += amt

            meta = CATEGORY_METADATA.get(cat, CATEGORY_METADATA["Vergi, Muhasebe & Diğer"])
            exp_copy = dict(exp)
            exp_copy["amount_str"] = format_currency(amt)
            exp_copy["icon"] = meta["icon"]
            exp_copy["color"] = meta["color"]
            month_expenses.append(exp_copy)

    # Sıralama: En son tarihli gider en üstte
    month_expenses.sort(key=lambda x: (x.get("date", ""), x.get("time", "")), reverse=True)

    # 3. Kategori Bazlı Gider Dağılımı Listesi
    category_breakdown = []
    for cat_name, cat_total in category_sums.items():
        meta = CATEGORY_METADATA[cat_name]
        pct = round((cat_total / total_expenses * 100), 1) if total_expenses > 0 else 0.0
        category_breakdown.append({
            "category": cat_name,
            "code": meta["code"],
            "icon": meta["icon"],
            "color": meta["color"],
            "total": round(cat_total, 2),
            "total_str": format_currency(cat_total),
            "percentage": pct
        })

    category_breakdown.sort(key=lambda x: x["total"], reverse=True)

    # 4. Net Kâr ve Finansal Sağlık Göstergesi
    net_profit = total_sales_income - total_expenses
    profit_margin = round((net_profit / total_sales_income * 100), 1) if total_sales_income > 0 else 0.0

    tr_months = ["", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
    month_name = tr_months[m] if 1 <= m <= 12 else str(m)

    return {
        "status": "success",
        "year": y,
        "month": m,
        "month_name": month_name,
        "total_sales_income": round(total_sales_income, 2),
        "total_sales_income_str": format_currency(total_sales_income),
        "cash_income": round(cash_income, 2),
        "cash_income_str": format_currency(cash_income),
        "card_income": round(card_income, 2),
        "card_income_str": format_currency(card_income),
        "total_receipts": total_receipts,
        "total_expenses": round(total_expenses, 2),
        "total_expenses_str": format_currency(total_expenses),
        "net_profit": round(net_profit, 2),
        "net_profit_str": format_currency(net_profit),
        "is_profit": net_profit >= 0,
        "profit_margin": profit_margin,
        "category_breakdown": category_breakdown,
        "expenses": month_expenses,
        "all_categories": [
            {"name": k, "icon": v["icon"], "code": v["code"]} for k, v in CATEGORY_METADATA.items()
        ]
    }

def add_new_expense(data: dict) -> dict:
    """Yeni bir gider kaydı ekler."""
    title = str(data.get("title", "")).strip()
    category = str(data.get("category", "Vergi, Muhasebe & Diğer")).strip()
    amount = float(data.get("amount", 0.0))
    date_val = str(data.get("date", "")).strip() or datetime.datetime.now().strftime("%Y-%m-%d")
    time_val = str(data.get("time", "")).strip() or datetime.datetime.now().strftime("%H:%M")
    payment_method = str(data.get("payment_method", "Kasa Nakit")).strip()
    recipient = str(data.get("recipient", "")).strip()
    notes = str(data.get("notes", "")).strip()

    if not title or amount <= 0:
        return {"status": "error", "message": "Geçerli bir gider başlığı ve tutarı giriniz."}

    exp_id = f"exp-{int(time.time() * 1000)}"
    meta = CATEGORY_METADATA.get(category, CATEGORY_METADATA["Vergi, Muhasebe & Diğer"])

    new_item = {
        "id": exp_id,
        "date": date_val,
        "time": time_val,
        "category": category,
        "category_code": meta["code"],
        "title": title,
        "amount": round(amount, 2),
        "payment_method": payment_method,
        "recipient": recipient,
        "notes": notes,
        "created_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    }

    expenses = load_json(EXPENSES_FILE, [])
    expenses.append(new_item)
    save_json(EXPENSES_FILE, expenses)

    return {"status": "success", "message": "Gider kaydı başarıyla eklendi.", "expense": new_item}

def delete_expense_by_id(exp_id: str) -> dict:
    """Gider kaydını siler."""
    if not exp_id:
        return {"status": "error", "message": "Geçersiz gider ID."}

    expenses = load_json(EXPENSES_FILE, [])
    filtered = [e for e in expenses if e.get("id") != exp_id]
    save_json(EXPENSES_FILE, filtered)

    return {"status": "success", "message": "Gider kaydı silindi."}
