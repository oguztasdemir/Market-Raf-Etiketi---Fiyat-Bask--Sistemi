# -*- coding: utf-8 -*-
"""
Kasa Satış İptal, Fiş Düzenleme & Ürün İade Motoru
"""
import os, time, datetime, random
from backend.ayarlar import SALES_DIR, PRODUCTS_FILE, CUSTOMERS_FILE
from backend.araclar.depolama_araclari import load_json, save_json, get_sales_for_date, save_sales_for_date, list_all_sales_files
from backend.araclar.metin_duzenleyici import format_price_display
from backend.kasa.kasiyer_servisi import get_active_cashier


def record_cancelled_pos_receipt(data: dict) -> dict:
    """Kullanıcının sepeti silerek iptal ettiği satış fişini geçmişe kaydeder."""
    now = datetime.datetime.now()
    date_str = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%H:%M:%S")
    receipt_no = f"FIS-IPTAL-{now.strftime('%Y%m%d-%H%M%S')}-{random.randint(1000, 9999)}"
    items = data.get("items", [])
    total_val = sum(float(i.get("total_price", 0.0)) for i in items)
    active_cashier = get_active_cashier()

    record = {
        "receipt_no": receipt_no,
        "date": date_str,
        "time": time_str,
        "timestamp": now.isoformat(),
        "cashier": active_cashier.get("cashier_name", "Kasiyer"),
        "customer": data.get("customer_name") or "İptal Edilen Sepet",
        "payment_type": "İptal Edildi",
        "payment_breakdown": { "İptal": total_val },
        "total_amount": total_val,
        "is_cancelled": True,
        "is_return": False,
        "item_count": len(items),
        "total_quantity": sum(float(i.get("quantity", 1)) for i in items),
        "items": items
    }

    daily_sales = get_sales_for_date(date_str)
    daily_sales.append(record)
    save_sales_for_date(date_str, daily_sales)
    return {"status": "success", "receipt_no": receipt_no, "receipt": record}

def edit_pos_receipt_details(receipt_no: str, new_payment_type: str, new_customer: str = None, new_customer_id: str = None, new_cashier: str = None) -> dict:
    """Eski bir satışın ödeme türünü (Nakit/Kart/Veresiye), müşterisini veya kasiyerini düzenler."""
    all_files = list_all_sales_files()
    found = False
    target_record = None

    for f_path in all_files:
        sales = load_json(f_path, [])
        modified = False
        for s in sales:
            if s.get("receipt_no") == receipt_no:
                old_payment_type = s.get("payment_type", "")
                old_customer_id = s.get("customer_id")
                old_amount = float(s.get("total_amount", 0.0))

                s["payment_type"] = new_payment_type
                if new_payment_type:
                    s["payment_breakdown"] = { new_payment_type: old_amount }
                if new_customer is not None:
                    s["customer"] = new_customer
                if new_customer_id is not None:
                    s["customer_id"] = new_customer_id
                if new_cashier is not None:
                    s["cashier"] = new_cashier

                # Veresiye Cari Bakiyesi Dengelemesi ve Hareket Kaydı
                try:
                    from backend.araclar.depolama_araclari import _STORAGE_LOCK
                    with _STORAGE_LOCK:
                        customers = load_json(CUSTOMERS_FILE, [])
                        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                        
                        is_old_veresiye = "veresiye" in str(old_payment_type).lower() or "cari" in str(old_payment_type).lower()
                        is_new_veresiye = "veresiye" in str(new_payment_type).lower() or "cari" in str(new_payment_type).lower()

                        old_target_cust_id = old_customer_id
                        new_target_cust_id = new_customer_id or old_customer_id

                        # 1. Eski müşteriden borç düş (Eğer eski fiş veresiye ise ve ya veresiye kapandı ya da müşteri değişti)
                        if is_old_veresiye and (not is_new_veresiye or (new_customer_id and new_customer_id != old_customer_id)):
                            for c in customers:
                                if c.get("id") == old_target_cust_id or c.get("name") == s.get("customer"):
                                    old_b = float(c.get("balance", 0.0))
                                    new_b = round(old_b - old_amount, 2)
                                    c["balance"] = new_b
                                    c["updated_at"] = now_str
                                    if "transactions" not in c:
                                        c["transactions"] = []
                                    c["transactions"].insert(0, {
                                        "id": f"tx_adj_{int(datetime.datetime.now().timestamp() * 1000)}",
                                        "timestamp": now_str,
                                        "type": "credit",
                                        "amount": round(old_amount, 2),
                                        "old_balance": round(old_b, 2),
                                        "new_balance": round(new_b, 2),
                                        "payment_method": new_payment_type or "Nakit",
                                        "description": f"Fiş #{receipt_no} düzenlendi (Borç Aktarımı/Düşümü)",
                                        "receipt_no": receipt_no,
                                        "actor": new_cashier or s.get("cashier", "Kasiyer")
                                    })
                                    break

                        # 2. Yeni müşteriye borç ekle (Eğer yeni fiş veresiye ise ve ya yeni veresiye yapıldı ya da müşteri değişti)
                        if is_new_veresiye and (not is_old_veresiye or (new_customer_id and new_customer_id != old_customer_id)):
                            for c in customers:
                                if c.get("id") == new_target_cust_id or c.get("name") == (new_customer or s.get("customer")):
                                    old_b = float(c.get("balance", 0.0))
                                    new_b = round(old_b + old_amount, 2)
                                    c["balance"] = new_b
                                    c["updated_at"] = now_str
                                    if "transactions" not in c:
                                        c["transactions"] = []
                                    c["transactions"].insert(0, {
                                        "id": f"tx_adj_{int(datetime.datetime.now().timestamp() * 1000)}",
                                        "timestamp": now_str,
                                        "type": "debt",
                                        "amount": round(old_amount, 2),
                                        "old_balance": round(old_b, 2),
                                        "new_balance": round(new_b, 2),
                                        "payment_method": "Veresiye",
                                        "description": f"Fiş #{receipt_no} düzenlendi (Borç Aktarımı/Ekleme)",
                                        "receipt_no": receipt_no,
                                        "actor": new_cashier or s.get("cashier", "Kasiyer")
                                    })
                                    break

                        save_json(CUSTOMERS_FILE, customers)
                except Exception as ex:
                    print(f"Cari güncelleme uyarısı: {ex}")

                modified = True
                found = True
                target_record = s
                break
        if modified:
            # Tarih bazlı kaydet (SQLite satislar tablosunu ve dosyayı günceller)
            rec_date = s.get("date") or datetime.datetime.now().strftime("%Y-%m-%d")
            save_sales_for_date(rec_date, sales)
            save_json(f_path, sales)
            break


    if found:
        return {"status": "success", "message": f"Fiş #{receipt_no} başarıyla güncellendi.", "receipt": target_record}
    else:
        return {"status": "error", "message": f"Fiş #{receipt_no} bulunamadı."}

def process_receipt_items_return(receipt_no: str, return_items: list, refund_payment_type: str = "Nakit", return_note: str = "") -> dict:
    """Mevcut bir satış fişinden seçili veya tüm ürünleri iade alır ve fişin içine not olarak işler."""
    if not receipt_no or not return_items:
        return {"status": "error", "message": "Geçersiz iade parametreleri."}

    now = datetime.datetime.now()
    date_str = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%H:%M:%S")

    all_files = list_all_sales_files()
    found = False
    target_record = None

    for f_path in all_files:
        sales = load_json(f_path, [])
        modified = False
        for s in sales:
            if s.get("receipt_no") == receipt_no:
                return_total = 0.0
                for itm in return_items:
                    u_price = float(itm.get("unit_price") or itm.get("price", 0.0))
                    qty = float(itm.get("quantity", 1.0))
                    tot = float(itm.get("total_price", u_price * qty))
                    return_total += tot

                return_total = round(return_total, 2)

                # Stokları geri artır
                try:
                    from backend.araclar.depolama_araclari import _STORAGE_LOCK
                    with _STORAGE_LOCK:
                        products = load_json(PRODUCTS_FILE, [])
                        prod_dict = {str(p.get("barcode", "")).strip(): p for p in products if p.get("barcode")}
                        stock_up = False
                        for itm in return_items:
                            bc = str(itm.get("barcode", "")).strip()
                            qty = float(itm.get("quantity", 1.0))
                            if bc in prod_dict:
                                cur_st = float(prod_dict[bc].get("stock", 100))
                                prod_dict[bc]["stock"] = round(cur_st + abs(qty), 2)
                                stock_up = True
                        if stock_up:
                            save_json(PRODUCTS_FILE, products)
                except Exception as ex:
                    print(f"İade stok artırma hatası: {ex}")

                # Veresiye Cari Bakiyesi Düşümü (eğer fiş veresiye ise)
                if "veresiye" in str(s.get("payment_type", "")).lower() or s.get("customer_id"):
                    try:
                        from backend.araclar.depolama_araclari import _STORAGE_LOCK
                        with _STORAGE_LOCK:
                            customers = load_json(CUSTOMERS_FILE, [])
                            for c in customers:
                                if c.get("id") == s.get("customer_id") or c.get("name") == s.get("customer"):
                                    c["balance"] = round(max(0.0, float(c.get("balance", 0.0)) - return_total), 2)
                                    break
                            save_json(CUSTOMERS_FILE, customers)
                    except Exception as ex:
                        print(f"İade cari güncelleme hatası: {ex}")

                # Fiş içine iade kaydı notu ekle
                if "returns" not in s or not isinstance(s["returns"], list):
                    s["returns"] = []

                s["returns"].append({
                    "timestamp": now.isoformat(),
                    "date": date_str,
                    "time": time_str,
                    "items": return_items,
                    "refund_amount": return_total,
                    "refund_type": refund_payment_type,
                    "note": return_note or f"{len(return_items)} kalem ürün iade alındı"
                })

                total_ret = sum(float(r.get("refund_amount", 0.0)) for r in s["returns"])
                orig_tot = float(s.get("total_amount", 0.0))
                s["total_returned_amount"] = round(total_ret, 2)
                s["net_amount"] = round(max(0.0, orig_tot - total_ret), 2)
                s["is_fully_returned"] = bool(s["net_amount"] <= 0.01)
                s["is_partially_returned"] = bool(s["net_amount"] > 0.01 and total_ret > 0)

                modified = True
                found = True
                target_record = s
                break
        if modified:
            save_json(f_path, sales)
            break

    if found:
        return {
            "status": "success",
            "message": f"Fiş #{receipt_no} için {return_total:.2f} TL tutarındaki ürün iadesi fişe işlendi.",
            "receipt": target_record
        }
    else:
        return {"status": "error", "message": f"Fiş #{receipt_no} bulunamadı."}

