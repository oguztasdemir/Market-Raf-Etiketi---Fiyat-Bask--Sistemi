# -*- coding: utf-8 -*-
"""
Müşteri Veresiye, Cari Hesap ve Borç/Alacak Takip Rotaları
"""
import os
import datetime
from flask import Blueprint, jsonify, request
from backend.ayarlar import DATA_DIR
from backend.araclar.depolama_araclari import load_json, save_json, _STORAGE_LOCK

CUSTOMERS_FILE = os.path.join(DATA_DIR, "sistem_ve_ayarlar", "musteriler.json")

customer_bp = Blueprint('customer_bp', __name__)

@customer_bp.route("/api/customers", methods=["GET"])
def api_get_customers():
    """Tüm müşterileri ve güncel bakiye durumlarını döner."""
    customers = load_json(CUSTOMERS_FILE, [])
    return jsonify({"status": "success", "count": len(customers), "customers": customers})

@customer_bp.route("/api/customers", methods=["POST"])
def api_create_or_update_customer():
    """Yeni müşteri ekler veya mevcut müşteriyi günceller."""
    req_data = request.json or {}
    cust_id = str(req_data.get("id") or f"cust_{int(datetime.datetime.now().timestamp() * 1000)}")
    name = (req_data.get("name") or req_data.get("ad_soyad") or "").strip().upper()
    phone = (req_data.get("phone") or req_data.get("telefon") or "").strip()
    notes = (req_data.get("notes") or req_data.get("not") or "").strip()
    credit_limit = float(req_data.get("credit_limit") or 0.0)

    if not name:
        return jsonify({"status": "error", "message": "Müşteri Adı Soyadı zorunludur."}), 400

    with _STORAGE_LOCK:
        customers = load_json(CUSTOMERS_FILE, [])
        found = False
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        for c in customers:
            if c.get("id") == cust_id:
                c["name"] = name
                c["phone"] = phone
                c["notes"] = notes
                c["credit_limit"] = credit_limit
                c["updated_at"] = now_str
                found = True
                break

        if not found:
            new_customer = {
                "id": cust_id,
                "name": name,
                "phone": phone,
                "balance": 0.0,  # Pozitif: Borçlu, Negatif: Alacaklı
                "credit_limit": credit_limit,
                "notes": notes,
                "created_at": now_str,
                "transactions": []
            }
            customers.append(new_customer)

        save_json(CUSTOMERS_FILE, customers)
    return jsonify({"status": "success", "message": "Müşteri başarıyla kaydedildi.", "customer_id": cust_id})

@customer_bp.route("/api/customers/<cust_id>/transaction", methods=["POST"])
def api_add_customer_transaction(cust_id):
    """
    Müşteriye veresiye borç ekler veya tahsilat/ödeme kaydeder.
    Tür: 'debt' (Veresiye Satış Borcu) veya 'payment' (Tahsilat / Ödeme)
    """
    req_data = request.json or {}
    tx_type = req_data.get("type", "debt")  # 'debt' veya 'payment'
    amount = float(req_data.get("amount") or 0.0)
    description = req_data.get("description") or ("Veresiye Satış" if tx_type == "debt" else "Nakit Tahsilat")
    receipt_no = req_data.get("receipt_no", "")
    actor = req_data.get("actor", "Kasiyer")

    if amount <= 0:
        return jsonify({"status": "error", "message": "Geçerli bir tutar girin."}), 400

    with _STORAGE_LOCK:
        customers = load_json(CUSTOMERS_FILE, [])
        target_cust = None
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        for c in customers:
            if c.get("id") == cust_id:
                target_cust = c
                break

        if not target_cust:
            return jsonify({"status": "error", "message": "Müşteri bulunamadı."}), 404

        if "transactions" not in target_cust:
            target_cust["transactions"] = []

        old_balance = float(target_cust.get("balance") or 0.0)
        if tx_type == "debt":
            new_balance = round(old_balance + amount, 2)
        else:
            new_balance = round(old_balance - amount, 2)

        tx_entry = {
            "id": f"tx_{int(datetime.datetime.now().timestamp() * 1000)}",
            "timestamp": now_str,
            "type": tx_type,
            "amount": amount,
            "old_balance": old_balance,
            "new_balance": new_balance,
            "description": description,
            "receipt_no": receipt_no,
            "actor": actor
        }

        target_cust["transactions"].insert(0, tx_entry)
        target_cust["balance"] = new_balance
        target_cust["updated_at"] = now_str

        save_json(CUSTOMERS_FILE, customers)
        return jsonify({
            "status": "success",
            "message": f"İşlem kaydedildi. Güncel Bakiye: {new_balance:,.2f} TL",
            "new_balance": new_balance,
            "transaction": tx_entry
        })
