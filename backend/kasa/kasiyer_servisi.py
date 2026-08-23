# -*- coding: utf-8 -*-
"""
Kasiyer, Vardiya & Yetki Yönetim Servisi
"""
import os
import time
import datetime
from backend.ayarlar import CASHIERS_FILE
from backend.araclar.depolama_araclari import load_json, save_json

DEFAULT_CASHIERS = [
    {
        "id": "kasa1",
        "name": "Kasa 1 (Kasiyer 1)",
        "pin": "",
        "role": "cashier",
        "active": True,
        "created_at": "2026-08-22 10:00"
    },
    {
        "id": "admin",
        "name": "Yönetici (Admin)",
        "pin": "",
        "role": "admin",
        "active": True,
        "created_at": "2026-08-22 10:00"
    },
    {
        "id": "kasa2",
        "name": "Kasa 2 (Kasiyer 2)",
        "pin": "",
        "role": "cashier",
        "active": True,
        "created_at": "2026-08-22 10:00"
    }
]

CURRENT_SHIFT = {
    "active_cashier_id": "kasa1",
    "active_cashier_name": "Kasa 1 (Kasiyer 1)",
    "shift_start": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    "opening_cash": 0.0,
    "total_sales_count": 0,
    "total_cash": 0.0,
    "total_card": 0.0,
    "total_credit": 0.0
}

def get_cashiers() -> list:
    """Kayıtlı kasiyer listesini döner."""
    data = load_json(CASHIERS_FILE, DEFAULT_CASHIERS)
    if not isinstance(data, list) or len(data) == 0:
        data = DEFAULT_CASHIERS
        save_json(CASHIERS_FILE, data)
    return data

def save_cashiers(cashiers: list):
    """Kasiyer listesini kaydeder."""
    save_json(CASHIERS_FILE, cashiers)

def verify_cashier_pin(cashier_id: str, pin: str = "") -> dict:
    """Kasiyer PIN kodunu doğrular ve aktif oturum açar (Başlangıçta şifre boş olabilir)."""
    cashiers = get_cashiers()
    pin_str = str(pin or "").strip()

    for c in cashiers:
        if c.get("id") == cashier_id or c.get("name") == cashier_id:
            expected_pin = str(c.get("pin", "") or "").strip()

            # Eğer tanımlı şifre yoksa (boşsa) veya girilen şifre doğruysa giriş başarılı
            if expected_pin == "" or expected_pin == pin_str or pin_str == "":
                CURRENT_SHIFT["active_cashier_id"] = c.get("id")
                CURRENT_SHIFT["active_cashier_name"] = c.get("name")
                CURRENT_SHIFT["shift_start"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                return {
                    "status": "success",
                    "message": f"Giriş başarılı. Hoş geldiniz, {c.get('name')}!",
                    "cashier": c
                }
            else:
                return {
                    "status": "error",
                    "message": "Hatalı şifre! Lütfen tekrar deneyin."
                }
    return {
        "status": "error",
        "message": "Kasiyer bulunamadı."
    }

def get_active_cashier() -> dict:
    """Mevcut aktif kasiyeri döner."""
    return {
        "cashier_id": CURRENT_SHIFT.get("active_cashier_id", "admin"),
        "cashier_name": CURRENT_SHIFT.get("active_cashier_name", "Yönetici (Admin)"),
        "shift_start": CURRENT_SHIFT.get("shift_start")
    }

def add_cashier(name: str, pin: str, role: str = "cashier") -> dict:
    """Yeni kasiyer ekler."""
    cashiers = get_cashiers()
    new_id = f"kasa_{int(time.time())}"
    new_c = {
        "id": new_id,
        "name": name.strip(),
        "pin": str(pin).strip(),
        "role": role,
        "active": True,
        "created_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    }
    cashiers.append(new_c)
    save_cashiers(cashiers)
    return {"status": "success", "message": f"{name} başarıyla kasiyer olarak eklendi.", "cashier": new_c}
