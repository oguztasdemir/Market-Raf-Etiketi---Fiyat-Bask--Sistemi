# -*- coding: utf-8 -*-
"""
Kasa X Raporu, Günlük Avans & Kasa Giriş / Çıkış Hareketleri
"""
import os, time, datetime
from backend.ayarlar import SETTINGS_FILE, CASH_MOVEMENTS_FILE, EXPENSES_FILE, CUSTOMERS_FILE
from backend.araclar.depolama_araclari import load_json, save_json, get_sales_for_date
from backend.araclar.metin_duzenleyici import format_price_display
from backend.kasa.kasiyer_servisi import get_active_cashier



def get_x_report_data() -> dict:
    """
    Gün içi anlık ara kasa mutabakat raporu (X Raporu) hesaplar.
    Mükerrer veya iptal fişleri ayıklar, net satışları, veresiye tahsilatlarını,
    toptancı çıkışlarını ve çekmecedeki gerçek fiziki nakit miktarını kuruşu kuruşuna hesaplar.
    """
    now = datetime.datetime.now()
    today_str = now.strftime("%Y-%m-%d")
    today_formatted = now.strftime("%d.%m.%Y")
    sales = get_sales_for_date(today_str)
    
    gross_sales = 0.0
    cash_sales = 0.0
    card_sales = 0.0
    debt_sales = 0.0
    
    return_total = 0.0
    return_cash = 0.0
    return_card = 0.0
    return_debt = 0.0
    
    completed_receipts = 0
    cancelled_receipts = 0
    total_items = 0.0
    vat_breakdown = {}
    
    for s in sales:
        is_cancelled = s.get("is_cancelled") or s.get("payment_type") == "İptal Edildi" or str(s.get("receipt_no", "")).startswith("FIS-IPTAL")
        if is_cancelled:
            cancelled_receipts += 1
            continue

        is_standalone_ret = s.get("is_return") or "iade" in str(s.get("payment_type", "")).lower() or str(s.get("receipt_no", "")).startswith("FIS-IADE")
        if is_standalone_ret:
            amt = abs(float(s.get("total_amount", 0.0)))
            return_total += amt
            ptype = str(s.get("payment_type", "Nakit")).lower()
            if "kart" in ptype or "kredi" in ptype:
                return_card += amt
            elif "veresiye" in ptype or "cari" in ptype:
                return_debt += amt
            else:
                return_cash += amt
            continue

        # Normal Tamamlanan Satış
        completed_receipts += 1
        amt = float(s.get("total_amount", 0.0))
        gross_sales += amt
        total_items += float(s.get("total_quantity", 1))

        # Ödeme Türü Ayrıştırma
        pb = s.get("payment_breakdown")
        if isinstance(pb, dict) and pb:
            for b_key, b_val in pb.items():
                b_k = str(b_key).lower()
                val = float(b_val or 0.0)
                if "kart" in b_k or "kredi" in b_k:
                    card_sales += val
                elif "veresiye" in b_k or "cari" in b_k:
                    debt_sales += val
                else:
                    cash_sales += val
        else:
            ptype = str(s.get("payment_type", "Nakit")).lower()
            if "kart" in ptype or "kredi" in ptype:
                card_sales += amt
            elif "veresiye" in ptype or "cari" in ptype:
                debt_sales += amt
            else:
                cash_sales += amt

        # Fiş İçi İadeleri Kontrol Et
        if isinstance(s.get("returns"), list):
            for r in s["returns"]:
                r_amt = float(r.get("refund_amount", 0.0))
                r_type = str(r.get("refund_type", "Nakit")).lower()
                return_total += r_amt
                if "kart" in r_type or "kredi" in r_type:
                    return_card += r_amt
                elif "veresiye" in r_type or "cari" in r_type:
                    return_debt += r_amt
                else:
                    return_cash += r_amt

        # KDV Hesaplama
        for itm in (s.get("items") or []):
            t_price = float(itm.get("total_price", 0.0))
            kdv_r = int(itm.get("kdv") or itm.get("vat_rate") or (1 if (itm.get("unit") == "Kg" or itm.get("is_scale_item")) else 10))
            r_k = str(kdv_r)
            if r_k not in vat_breakdown:
                vat_breakdown[r_k] = {"rate": kdv_r, "taxable": 0.0, "tax_amount": 0.0, "total": 0.0}
            matrah = round(t_price / (1.0 + (kdv_r / 100.0)), 2)
            kdv_val = round(t_price - matrah, 2)
            vat_breakdown[r_k]["taxable"] = round(vat_breakdown[r_k]["taxable"] + matrah, 2)
            vat_breakdown[r_k]["tax_amount"] = round(vat_breakdown[r_k]["tax_amount"] + kdv_val, 2)
            vat_breakdown[r_k]["total"] = round(vat_breakdown[r_k]["total"] + t_price, 2)

    net_sales = round(max(0.0, gross_sales - return_total), 2)
    net_cash_sales = round(max(0.0, cash_sales - return_cash), 2)
    net_card_sales = round(max(0.0, card_sales - return_card), 2)
    net_debt_sales = round(max(0.0, debt_sales - return_debt), 2)

    from backend.ayarlar import SETTINGS_FILE, CASH_MOVEMENTS_FILE, EXPENSES_FILE
    settings = load_json(SETTINGS_FILE, {})
    opening_cash = float(settings.get("daily_cash_advance", 500.0))

    # Günün Veresiye Tahsilatları (Müşteri Cari Ödemeleri)
    debt_collections_cash = 0.0
    debt_collections_card = 0.0
    try:
        customers = load_json(CUSTOMERS_FILE, [])
        for c in customers:
            for t in (c.get("transactions") or []):
                raw_time = str(t.get("timestamp") or t.get("date") or t.get("created_at") or "")
                t_type = str(t.get("type", "")).lower()
                if ("payment" in t_type or "tahsilat" in t_type or "odeme" in t_type) and (today_str in raw_time or today_formatted in raw_time):
                    t_amt = float(t.get("amount", 0.0))
                    t_meth = str(t.get("payment_method") or t.get("method") or "Nakit").lower()
                    if "kart" in t_meth or "kredi" in t_meth:
                        debt_collections_card += t_amt
                    else:
                        debt_collections_cash += t_amt
    except Exception:
        pass

    debt_collections_total = round(debt_collections_cash + debt_collections_card, 2)

    # Günün Kasa Hareketleri (Giriş / Çıkış / Toptancı / Gider)
    all_movements = load_json(CASH_MOVEMENTS_FILE, [])
    today_movements = [m for m in all_movements if str(m.get("date", "")) in (today_str, today_formatted)]

    cash_inflow = sum(float(m.get("amount", 0.0)) for m in today_movements if m.get("type") == "in")
    cash_outflow = sum(float(m.get("amount", 0.0)) for m in today_movements if m.get("type") == "out")

    # Çekmecedeki Gerçek Fiziki Nakit
    current_cash_in_drawer = round(opening_cash + net_cash_sales + debt_collections_cash + cash_inflow - cash_outflow, 2)

    active_c = get_active_cashier()
    market_name = settings.get("market_name", "YARENLER MARKET")

    return {
        "status": "success",
        "report_type": "X_RAPORU",
        "title": "GÜN İÇİ ARA KASA MUTABAKATI (X RAPORU)",
        "date": now.strftime("%d.%m.%Y"),
        "time": now.strftime("%H:%M:%S"),
        "market_name": market_name,
        "active_cashier": active_c.get("cashier_name", "Kasiyer"),
        "opening_cash": opening_cash,
        "opening_cash_str": format_price_display(opening_cash),
        "gross_sales": round(gross_sales, 2),
        "gross_sales_str": format_price_display(gross_sales),
        "cash_sales": round(net_cash_sales, 2),
        "cash_sales_str": format_price_display(net_cash_sales),
        "card_sales": round(net_card_sales, 2),
        "card_sales_str": format_price_display(net_card_sales),
        "debt_sales": round(net_debt_sales, 2),
        "debt_sales_str": format_price_display(net_debt_sales),
        "debt_collections_total": debt_collections_total,
        "debt_collections_total_str": format_price_display(debt_collections_total),
        "debt_collections_cash": debt_collections_cash,
        "return_total": round(return_total, 2),
        "return_total_str": f"-{format_price_display(return_total)}",
        "cash_inflow": round(cash_inflow, 2),
        "cash_inflow_str": f"+{format_price_display(cash_inflow)}",
        "cash_outflow": round(cash_outflow, 2),
        "cash_outflow_str": f"-{format_price_display(cash_outflow)}",
        "net_sales": round(net_sales, 2),
        "net_sales_str": format_price_display(net_sales),
        "total_sales": round(net_sales, 2),
        "total_sales_str": format_price_display(net_sales),
        "receipt_count": completed_receipts,
        "cancelled_count": cancelled_receipts,
        "total_items_sold": round(total_items, 1),
        "current_cash_in_drawer": round(current_cash_in_drawer, 2),
        "current_cash_in_drawer_str": format_price_display(current_cash_in_drawer),
        "vat_breakdown": vat_breakdown,
        "today_movements": today_movements
    }

def set_cash_advance(amount: float) -> dict:
    """Kasa açılış nakit avansını kaydeder."""
    from backend.ayarlar import SETTINGS_FILE
    settings = load_json(SETTINGS_FILE, {})
    settings["daily_cash_advance"] = round(float(amount), 2)
    save_json(SETTINGS_FILE, settings)
    return {"status": "success", "daily_cash_advance": settings["daily_cash_advance"]}

# =========================================================
# KASA GİRİŞ / ÇIKIŞ & MASRAF / TOPTANCI ÖDEMESİ HAREKETLERİ
# =========================================================

def get_cash_movements(date_str: str = None) -> list:
    """Kasa hareketlerini (Çıkış/Giriş) yükler."""
    from backend.ayarlar import CASH_MOVEMENTS_FILE
    movements = load_json(CASH_MOVEMENTS_FILE, [])
    if date_str:
        movements = [m for m in movements if str(m.get("date", "")) == date_str]
    movements.sort(key=lambda x: (x.get("date", ""), x.get("time", "")), reverse=True)
    return movements

def add_cash_movement(data: dict) -> dict:
    """
    Yeni kasa çıkışı veya girişi ekler.
    Toptancı, Fırın/Ekmek, Masraf veya Avans çıkışlarını hem kasa hareketlerine hem de muhasebe giderlerine kaydeder.
    """
    from backend.ayarlar import CASH_MOVEMENTS_FILE, EXPENSES_FILE
    
    m_type = str(data.get("type", "out")).lower().strip() # "out" (Çıkış) veya "in" (Giriş)
    amount = float(data.get("amount", 0.0))
    category = str(data.get("category", "Toptancı / Mal Alımı")).strip()
    description = str(data.get("description", "")).strip()
    cashier = str(data.get("cashier", "Kasa 1")).strip()

    if amount <= 0:
        return {"status": "error", "message": "Lütfen geçerli bir tutar giriniz."}

    now = datetime.datetime.now()
    m_id = f"cflow_{now.strftime('%Y%m%d_%H%M%S')}_{int(time.time() * 1000) % 10000}"
    
    movement = {
        "id": m_id,
        "type": m_type,
        "amount": round(amount, 2),
        "amount_str": format_price_display(amount),
        "category": category,
        "description": description or ("Kasa Çıkışı" if m_type == "out" else "Kasa Girişi"),
        "cashier": cashier,
        "date": now.strftime("%Y-%m-%d"),
        "time": now.strftime("%H:%M:%S"),
        "created_at": now.strftime("%d.%m.%Y %H:%M:%S")
    }

    # 1. Kasa Hareketleri Dosyasına Kaydet
    movements = load_json(CASH_MOVEMENTS_FILE, [])
    movements.append(movement)
    save_json(CASH_MOVEMENTS_FILE, movements)

    # 2. Eğer Kasa Çıkışı (Masraf/Toptancı) ise Muhasebe Giderlerine de İşle
    if m_type == "out":
        all_expenses = load_json(EXPENSES_FILE, [])
        all_expenses.append({
            "id": f"exp_{m_id}",
            "title": f"[KASA ÇIKIŞI] {category} - {description}" if description else f"[KASA ÇIKIŞI] {category}",
            "category": category if category in ["Dükkan Kirası", "Personel Maaşı & Avans", "Elektrik, Su & Faturalar", "Toptancı / Mal Alımı", "Temizlik & Sarf Malzeme"] else "Vergi, Muhasebe & Diğer",
            "amount": round(amount, 2),
            "date": now.strftime("%Y-%m-%d"),
            "time": now.strftime("%H:%M:%S"),
            "payment_type": "Nakit",
            "created_by": cashier
        })
        save_json(EXPENSES_FILE, all_expenses)

    action_label = "Kasa Çıkışı" if m_type == "out" else "Kasa Girişi"
    return {
        "status": "success",
        "message": f"✓ {amount:.2f} TL tutarındaki {action_label} ({category}) başarıyla kaydedildi.",
        "movement": movement
    }

def delete_cash_movement(movement_id: str) -> dict:
    """Kasa hareketini siler."""
    from backend.ayarlar import CASH_MOVEMENTS_FILE, EXPENSES_FILE
    movements = load_json(CASH_MOVEMENTS_FILE, [])
    orig_len = len(movements)
    movements = [m for m in movements if str(m.get("id")) != str(movement_id)]
    
    if len(movements) < orig_len:
        save_json(CASH_MOVEMENTS_FILE, movements)
        # Giderlerden de sil
        all_expenses = load_json(EXPENSES_FILE, [])
        all_expenses = [e for e in all_expenses if str(e.get("id")) != f"exp_{movement_id}"]
        save_json(EXPENSES_FILE, all_expenses)
        return {"status": "success", "message": "Kasa hareketi silindi."}
    
    return {"status": "error", "message": "Kayıt bulunamadı."}
