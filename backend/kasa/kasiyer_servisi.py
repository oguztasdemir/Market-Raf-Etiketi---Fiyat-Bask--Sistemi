# -*- coding: utf-8 -*-
"""
Kasiyer, Vardiya & Yetki Yönetim Servisi (Çalışan Kadrosuyla Birleştirilmiş)
"""
import time
import datetime
from backend.ayarlar import EMPLOYEES_FILE
from backend.araclar.depolama_araclari import load_json, save_json

CURRENT_SHIFT = {
    "active_cashier_id": "kasa1",
    "active_cashier_name": "Kasa 1 (Kasiyer)",
    "shift_start": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    "opening_cash": 0.0,
    "total_sales_count": 0,
    "total_cash": 0.0,
    "total_card": 0.0,
    "total_credit": 0.0
}

def get_cashiers() -> list:
    """Kayıtlı ve aktif çalışanları kasiyer listesi olarak döner."""
    employees = load_json(EMPLOYEES_FILE, [])
    cashiers = []
    for emp in employees:
        if emp.get("active") != False:
            cashiers.append({
                "id": emp.get("id"),
                "name": emp.get("name"),
                "pin": emp.get("pin", ""),
                "role": emp.get("role_id"),
                "role_name": emp.get("role_name"),
                "active": emp.get("active", True),
                "created_at": emp.get("created_at")
            })
    return cashiers

def save_cashiers(cashiers: list):
    """Kasiyer listesini kaydeder (Çalışanlar tablosuna yansıtır)."""
    # Geriye dönük uyumluluk için çalışanlar tablosundaki pin ve active durumlarını günceller
    employees = load_json(EMPLOYEES_FILE, [])
    updated = False
    for c in cashiers:
        for emp in employees:
            if emp.get("id") == c.get("id"):
                emp["pin"] = str(c.get("pin", "")).strip()
                emp["active"] = c.get("active", True)
                updated = True
    if updated:
        save_json(EMPLOYEES_FILE, employees)

def verify_cashier_pin(cashier_id: str, pin: str = "") -> dict:
    """Kasiyer PIN kodunu doğrular ve aktif oturum açar."""
    cashiers = get_cashiers()
    pin_str = str(pin or "").strip()

    for c in cashiers:
        if c.get("id") == cashier_id or c.get("name") == cashier_id:
            expected_pin = str(c.get("pin", "") or "").strip()

            if expected_pin == pin_str:
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

def add_cashier(name: str, pin: str, role: str = "kasiyer") -> dict:
    """Yeni kasiyeri çalışan kadrosuna ekler."""
    employees = load_json(EMPLOYEES_FILE, [])
    new_id = f"emp_{int(time.time())}"
    
    role_name = "Kasiyer"
    if role == "admin":
        role_name = "Yönetici (Müdür)"
        
    new_emp = {
        "id": new_id,
        "name": name.strip(),
        "role_id": role,
        "role_name": role_name,
        "pin": str(pin).strip(),
        "phone": "",
        "active": True,
        "custom_permissions": None,
        "created_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    }
    employees.append(new_emp)
    save_json(EMPLOYEES_FILE, employees)
    return {
        "status": "success", 
        "message": f"{name} başarıyla çalışan kadrosuna eklendi.", 
        "cashier": {
            "id": new_id,
            "name": name.strip(),
            "pin": str(pin).strip(),
            "role": role,
            "active": True
        }
    }
