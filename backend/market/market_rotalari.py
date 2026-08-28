# -*- coding: utf-8 -*-
"""
Market Yönetimi, Çalışanlar & Rol Bazlı Yetkilendirme (RBAC) & Vardiya/İzin Raporları API Rotaları
"""
import os
import json
import time
from datetime import datetime
from flask import Blueprint, request, jsonify
from backend.ayarlar import (
    MARKET_PROFILE_FILE, EMPLOYEES_FILE, EMPLOYEE_LOGS_FILE, ROLES_FILE,
    CASHIERS_FILE, SETTINGS_FILE, SALES_DIR, REPORTS_FILE, PRODUCT_ACTIVITIES_FILE
)
from backend.araclar.depolama_araclari import load_json, save_json, list_all_sales_files

market_bp = Blueprint('market_bp', __name__)

DEFAULT_PERMISSIONS = [
    {"key": "perm_pos", "title": "Hızlı Satış (POS)", "category": "Kasa", "desc": "Kasa satış ekranını kullanabilme"},
    {"key": "perm_pos_discount", "title": "İskonto / İkram", "category": "Kasa", "desc": "Kasada indirim/iskonto uygulayabilme"},
    {"key": "perm_pos_cancel", "title": "Fiş İptali", "category": "Kasa", "desc": "Kasada sepet ve fiş iptali yapabilme"},
    {"key": "perm_catalog_view", "title": "Katalog Görüntüleme", "category": "Ürünler", "desc": "Ürün arama ve listeyi inceleme"},
    {"key": "perm_catalog_edit", "title": "Ürün Düzenleme", "category": "Ürünler", "desc": "Ürün adı, fiyatı ve stok güncelleme"},
    {"key": "perm_print_labels", "title": "Etiket Basma", "category": "Etiketler", "desc": "Tekli ve toplu raf etiketi yazdırma"},
    {"key": "perm_batch_price", "title": "Toplu Zam Motoru", "category": "Etiketler", "desc": "Marka/kategoriye toplu fiyat artışı yapma"},
    {"key": "perm_manav_plu", "title": "Manav & Terazi", "category": "Terazi", "desc": "Terazi PLU fiyatlarını yönetme"},
    {"key": "perm_invoice", "title": "Fatura Okuma", "category": "Stok", "desc": "Fatura okuma ve stok eşleştirme"},
    {"key": "perm_customers", "title": "Cari & Veresiye", "category": "Müşteriler", "desc": "Müşteri hesaplarını görme ve tahsilat yapma"},
    {"key": "perm_reports", "title": "Günlük Raporlar", "category": "Finans", "desc": "Ciro ve günlük satış raporlarını görme"},
    {"key": "perm_accounting", "title": "Muhasebe", "category": "Finans", "desc": "Market giderleri ve kasa durumuna erişim"},
    {"key": "perm_settings", "title": "Sistem Ayarları", "category": "Yönetim", "desc": "Yazıcı ve genel sistem ayarlarını yönetme"}
]

DEFAULT_ROLES = [
    {
        "id": "admin",
        "name": "Yönetici (Müdür)",
        "icon": "👑",
        "color": "#38bdf8",
        "is_active": True,
        "description": "Tüm sistem, kasa, katalog ve muhasebe üzerinde tam yetkili.",
        "permissions": ["perm_pos", "perm_pos_discount", "perm_pos_cancel", "perm_catalog_view", "perm_catalog_edit", "perm_print_labels", "perm_batch_price", "perm_manav_plu", "perm_invoice", "perm_customers", "perm_reports", "perm_accounting", "perm_settings"]
    },
    {
        "id": "kasiyer",
        "name": "Kasiyer",
        "icon": "🛒",
        "color": "#34d399",
        "is_active": True,
        "description": "Hızlı Satış, barkod okuma, cari tahsilat ve fiyat sorgulama yetkileri.",
        "permissions": ["perm_pos", "perm_catalog_view", "perm_customers"]
    },
    {
        "id": "raf_sorumlusu",
        "name": "Raf Sorumlusu",
        "icon": "🏷️",
        "color": "#a855f7",
        "is_active": True,
        "description": "Ürün kataloğu, etiket basma, fiyatı değişenleri basma ve etiket düzenleme.",
        "permissions": ["perm_catalog_view", "perm_print_labels", "perm_batch_price"]
    },
    {
        "id": "kasap",
        "name": "Kasap & Şarküteri",
        "icon": "🥩",
        "color": "#f87171",
        "is_active": True,
        "description": "Et ve şarküteri reyonu, terazi tartımı, gramajlı etiket basımı, SKT ve parti takibi.",
        "permissions": ["perm_manav_plu", "perm_print_labels", "perm_catalog_view", "perm_pos"]
    },
    {
        "id": "manav",
        "name": "Manav Sorumlusu",
        "icon": "🥬",
        "color": "#10b981",
        "is_active": True,
        "description": "Manav reyonu, terazi PLU fiyatları ve terazi etiket basımı.",
        "permissions": ["perm_manav_plu", "perm_print_labels", "perm_catalog_view"]
    },
    {
        "id": "unlu_mamul",
        "name": "Fırın & Unlu Mamüller",
        "icon": "🥖",
        "color": "#fbbf24",
        "is_active": True,
        "description": "Ekmek, unlu mamüller ve sıcak unlu mamül etiketleme ve hızlı satış.",
        "permissions": ["perm_pos", "perm_print_labels", "perm_catalog_view"]
    },
    {
        "id": "depocu",
        "name": "Depocu / Mal Kabul",
        "icon": "📦",
        "color": "#f59e0b",
        "is_active": True,
        "description": "Fatura okuma, irsaliye kontrolü, ürün eşleştirme ve stok kontrolü.",
        "permissions": ["perm_catalog_view", "perm_invoice"]
    }
]

DEFAULT_EMPLOYEES = [
    {
        "id": "admin",
        "name": "Yönetici (Admin)",
        "role_id": "admin",
        "role_name": "Yönetici (Müdür)",
        "pin": "",
        "phone": "0555 000 0000",
        "active": True,
        "custom_permissions": None,
        "created_at": "2026-08-24 10:00"
    },
    {
        "id": "kasa1",
        "name": "Kasa 1 (Kasiyer)",
        "role_id": "kasiyer",
        "role_name": "Kasiyer",
        "pin": "",
        "phone": "",
        "active": True,
        "custom_permissions": None,
        "created_at": "2026-08-24 10:00"
    },
    {
        "id": "raf1",
        "name": "Ahmet (Raf Sorumlusu)",
        "role_id": "raf_sorumlusu",
        "role_name": "Raf Sorumlusu",
        "pin": "",
        "phone": "",
        "active": True,
        "custom_permissions": None,
        "created_at": "2026-08-24 10:00"
    }
]

def get_effective_permissions(emp, roles_map):
    """Çalışanın geçerli izin listesini hesaplar."""
    mode = get_current_operating_mode()
    if mode in ["SOLO", "FULL_TRUST"] or emp.get("role_id") == "admin":
        return [p["key"] for p in DEFAULT_PERMISSIONS]
    if emp.get("custom_permissions") is not None and isinstance(emp.get("custom_permissions"), list):
        return emp.get("custom_permissions")
    role = roles_map.get(emp.get("role_id"))
    if role:
        return role.get("permissions", [])
    return ["perm_pos", "perm_catalog_view"]

# =========================================================
# 1. MARKET PROFİLİ & ÇALIŞMA / YETKİ MODU API
# =========================================================
def get_current_operating_mode():
    profile = load_json(MARKET_PROFILE_FILE, {})
    mode = profile.get("operating_mode")
    if not mode:
        employees = load_json(EMPLOYEES_FILE, DEFAULT_EMPLOYEES)
        active_staff = [e for e in employees if e.get("active") != False and e.get("role_id") != "admin" and str(e.get("id")) != "admin"]
        mode = "SOLO" if len(active_staff) == 0 else "SOLO"
    return mode

@market_bp.route("/api/market/operating-mode", methods=["GET", "POST"])
def api_market_operating_mode():
    """Market çalışma ve yetki modunu getirir / günceller:
    - 'SOLO': Tek Kişilik Bakkal / Çalışan Yok (PIN/Şifre Yok, %100 Tam Yetki)
    - 'FULL_TRUST': Tüm Çalışanlar Tam Yetkili (Serbest Geçiş, Kısıtlama Yok)
    - 'STRICT_RBAC': Çok Çalışanlı / Rol Bazlı Yetki Modu (PIN Şifreli, Yetki Matrisi)
    """
    profile = load_json(MARKET_PROFILE_FILE, {
        "market_name": "YARENLER SÜPERMARKET",
        "branch": "Merkez Şube",
        "authorized_person": "Ahmet Yılmaz",
        "phone": "0212 000 00 00",
        "email": "info@yarenlermarket.com",
        "address": "Atatürk Cad. No: 123",
        "tax_office": "Kadıköy",
        "tax_number": "1234567890",
        "receipt_footer_note": "Bizi tercih ettiğiniz için teşekkür ederiz.",
        "operating_mode": "SOLO"
    })
    
    if request.method == "POST":
        req = request.json or {}
        new_mode = str(req.get("operating_mode", "")).strip().upper()
        if new_mode in ["SOLO", "FULL_TRUST", "STRICT_RBAC"]:
            profile["operating_mode"] = new_mode
            save_json(MARKET_PROFILE_FILE, profile)
            mode_labels = {
                "SOLO": "Tek Kişilik Bakkal / Çalışan Yok (Tam Yetki, Şifresiz)",
                "FULL_TRUST": "Tüm Çalışanlar Tam Yetkili (Güven Modu)",
                "STRICT_RBAC": "Çok Çalışanlı / Rol Bazlı Yetki Modu (PIN Korumalı)"
            }
            return jsonify({
                "status": "success",
                "message": f"İşletme çalışma modu '{mode_labels.get(new_mode)}' olarak güncellendi.",
                "operating_mode": new_mode
            })
        return jsonify({"status": "error", "message": "Geçersiz çalışma modu."}), 400

    current_mode = profile.get("operating_mode") or get_current_operating_mode()
    return jsonify({
        "status": "success",
        "operating_mode": current_mode,
        "modes": [
            {
                "id": "SOLO",
                "name": "Tek Kişilik Bakkal / Çalışan Yok",
                "badge": "🏪 Bakkal Modu",
                "desc": "Market tek kişi tarafından yönetiliyor. Şifre, PIN veya yetki kısıtlaması olmadan tüm ekranlar (Masaüstü & Mobil) doğrudan tam yetkiyle açılır.",
                "color": "#10b981",
                "icon": "🏪"
            },
            {
                "id": "FULL_TRUST",
                "name": "Tüm Çalışanlar Tam Yetkili",
                "badge": "🤝 Güven Modu",
                "desc": "Birden fazla personel var ancak hepsi tam yetkili. Personel seçimi yapılabilir fakat PIN veya yetki engeli çıkarılmaz.",
                "color": "#38bdf8",
                "icon": "🤝"
            },
            {
                "id": "STRICT_RBAC",
                "name": "Çok Çalışanlı / Rol Bazlı Yetki",
                "badge": "🔒 Gelişmiş Kadro",
                "desc": "Personeller PIN şifresiyle giriş yapar ve sadece kendi reyon ve rollerine izin verilen alanlara erişebilir.",
                "color": "#a855f7",
                "icon": "🔒"
            }
        ]
    })

@market_bp.route("/api/market/profile", methods=["GET", "POST"])
def api_market_profile():
    default_prof = {
        "market_name": "YARENLER SÜPERMARKET",
        "branch": "Merkez Şube",
        "authorized_person": "Ahmet Yılmaz",
        "phone": "0212 000 00 00",
        "email": "info@yarenlermarket.com",
        "address": "Atatürk Cad. No: 123",
        "tax_office": "Kadıköy",
        "tax_number": "1234567890",
        "receipt_footer_note": "Bizi tercih ettiğiniz için teşekkür ederiz.",
        "operating_mode": "SOLO"
    }
    profile = load_json(MARKET_PROFILE_FILE, default_prof)
    if not profile.get("operating_mode"):
        profile["operating_mode"] = get_current_operating_mode()

    if request.method == "POST":
        req = request.json or {}
        profile.update({
            "market_name": str(req.get("market_name", profile.get("market_name", ""))).strip(),
            "branch": str(req.get("branch", profile.get("branch", ""))).strip(),
            "authorized_person": str(req.get("authorized_person", profile.get("authorized_person", ""))).strip(),
            "phone": str(req.get("phone", profile.get("phone", ""))).strip(),
            "email": str(req.get("email", profile.get("email", ""))).strip(),
            "address": str(req.get("address", profile.get("address", ""))).strip(),
            "tax_office": str(req.get("tax_office", profile.get("tax_office", ""))).strip(),
            "tax_number": str(req.get("tax_number", profile.get("tax_number", ""))).strip(),
            "receipt_footer_note": str(req.get("receipt_footer_note", profile.get("receipt_footer_note", ""))).strip(),
            "operating_mode": str(req.get("operating_mode", profile.get("operating_mode", "SOLO"))).strip()
        })
        save_json(MARKET_PROFILE_FILE, profile)
        return jsonify({"status": "success", "message": "Market profil bilgileri kaydedildi.", "profile": profile})
    else:
        return jsonify({"status": "success", "profile": profile})


# =========================================================
# 2. ÇALIŞMA ALANLARI / ROLLER API
# =========================================================
@market_bp.route("/api/market/roles", methods=["GET", "POST"])
def api_market_roles():
    roles = load_json(ROLES_FILE, DEFAULT_ROLES)
    existing_ids = {r.get("id") for r in roles}
    added = False
    for def_r in DEFAULT_ROLES:
        if def_r.get("id") not in existing_ids:
            roles.append(def_r)
            added = True
    if added:
        save_json(ROLES_FILE, roles)

    if request.method == "POST":
        req = request.json or {}
        role_id = str(req.get("id", "")).strip().lower().replace(" ", "_")
        name = str(req.get("name", "")).strip()
        if not name:
            return jsonify({"status": "error", "message": "Rol adı boş olamaz."}), 400
        
        found = False
        for r in roles:
            if r.get("id") == role_id:
                r["name"] = name
                r["icon"] = req.get("icon", r.get("icon", "💼"))
                r["color"] = req.get("color", r.get("color", "#38bdf8"))
                r["description"] = req.get("description", r.get("description", ""))
                r["permissions"] = req.get("permissions", r.get("permissions", []))
                if "is_active" in req:
                    r["is_active"] = req.get("is_active", True)
                found = True
                break
        if not found:
            roles.append({
                "id": role_id or f"rol_{int(time.time())}",
                "name": name,
                "icon": req.get("icon", "💼"),
                "color": req.get("color", "#38bdf8"),
                "is_active": req.get("is_active", True),
                "description": req.get("description", ""),
                "permissions": req.get("permissions", ["perm_pos", "perm_catalog_view"])
            })
        save_json(ROLES_FILE, roles)
        return jsonify({"status": "success", "message": "Çalışma alanı (Rol) kaydedildi.", "roles": roles})
    else:
        return jsonify({"status": "success", "roles": roles, "permissions_catalog": DEFAULT_PERMISSIONS})

@market_bp.route("/api/market/roles/toggle", methods=["POST"])
def api_market_role_toggle():
    req = request.json or {}
    role_id = str(req.get("id", "")).strip().lower()
    if not role_id:
        return jsonify({"status": "error", "message": "Rol ID gerekli."}), 400

    roles = load_json(ROLES_FILE, DEFAULT_ROLES)
    for r in roles:
        if r.get("id") == role_id:
            r["is_active"] = not r.get("is_active", True)
            save_json(ROLES_FILE, roles)
            durum = "aktif edildi" if r["is_active"] else "pasife alındı"
            return jsonify({"status": "success", "message": f"{r['name']} reyonu {durum}.", "roles": roles})

    return jsonify({"status": "error", "message": "Rol bulunamadı."}), 404

@market_bp.route("/api/market/roles/<path:role_id>", methods=["DELETE", "GET", "POST"])
def api_market_role_by_id(role_id):
    role_id = str(role_id).strip().lower()
    roles = load_json(ROLES_FILE, DEFAULT_ROLES)
    
    if request.method == "DELETE":
        if role_id in ("admin", "kasiyer"):
            return jsonify({"status": "error", "message": "Temel sistem rolleri silinemez."}), 400
        roles = [r for r in roles if r.get("id") != role_id]
        save_json(ROLES_FILE, roles)
        return jsonify({"status": "success", "message": "Çalışma alanı silindi.", "roles": roles})
    
    matched = next((r for r in roles if r.get("id") == role_id), None)
    if matched:
        return jsonify({"status": "success", "role": matched})
    return jsonify({"status": "error", "message": "Rol bulunamadı."}), 404

@market_bp.route("/api/market/roles/delete", methods=["POST"])
def api_market_role_delete():
    req = request.json or {}
    role_id = str(req.get("id", "")).strip().lower()
    if not role_id:
        return jsonify({"status": "error", "message": "Rol ID gerekli."}), 400
    if role_id in ("admin", "kasiyer"):
        return jsonify({"status": "error", "message": "Temel sistem rolleri silinemez."}), 400

    roles = load_json(ROLES_FILE, DEFAULT_ROLES)
    roles = [r for r in roles if r.get("id") != role_id]
    save_json(ROLES_FILE, roles)
    return jsonify({"status": "success", "message": "Çalışma alanı silindi.", "roles": roles})


# =========================================================
# 3. ÇALIŞANLAR & İZİN MATRİSİ API
# =========================================================
@market_bp.route("/api/market/employees", methods=["GET", "POST"])
def api_market_employees():
    employees = load_json(EMPLOYEES_FILE, DEFAULT_EMPLOYEES)
    roles = load_json(ROLES_FILE, DEFAULT_ROLES)
    roles_map = {r["id"]: r for r in roles}

    if request.method == "POST":
        req = request.json or {}
        name = str(req.get("name", "")).strip()
        if not name:
            return jsonify({"status": "error", "message": "Çalışan adı boş bırakılamaz."}), 400

        eid = str(req.get("id", "")).strip().lower() or name.lower().replace(" ", "_")
        role_id = str(req.get("role_id", "kasiyer")).strip()
        pin = str(req.get("pin", "")).strip()
        phone = str(req.get("phone", "")).strip()
        active = req.get("active", True)
        custom_perms = req.get("custom_permissions", None)

        role = roles_map.get(role_id, {"name": "Kasiyer", "permissions": ["perm_pos", "perm_catalog_view"]})

        found = False
        for emp in employees:
            if str(emp.get("id")) == eid:
                emp["name"] = name
                emp["role_id"] = role_id
                emp["role_name"] = role.get("name", "Kasiyer")
                if "pin" in req:
                    emp["pin"] = pin
                emp["phone"] = phone
                emp["active"] = active
                if "custom_permissions" in req:
                    emp["custom_permissions"] = custom_perms
                found = True
                break

        if not found:
            employees.append({
                "id": eid,
                "name": name,
                "role_id": role_id,
                "role_name": role.get("name", "Kasiyer"),
                "pin": pin,
                "phone": phone,
                "active": active,
                "custom_permissions": custom_perms,
                "created_at": time.strftime("%Y-%m-%d %H:%M")
            })

        save_json(EMPLOYEES_FILE, employees)
        sync_cashiers_from_employees(employees)

        return jsonify({"status": "success", "message": f"{name} çalışan kaydı güncellendi.", "employees": employees})
    else:
        enriched = []
        for emp in employees:
            emp_copy = dict(emp)
            emp_copy["effective_permissions"] = get_effective_permissions(emp, roles_map)
            enriched.append(emp_copy)
        return jsonify({
            "status": "success",
            "employees": enriched,
            "roles": roles,
            "permissions_catalog": DEFAULT_PERMISSIONS
        })

@market_bp.route("/api/market/employees/delete", methods=["POST"])
def api_market_employee_delete():
    req = request.json or {}
    eid = str(req.get("id", "")).strip()
    if not eid:
        return jsonify({"status": "error", "message": "Silinecek çalışan ID'si eksik."}), 400
    if eid == "admin":
        return jsonify({"status": "error", "message": "Ana Yönetici (Admin) hesabı silinemez."}), 400

    employees = load_json(EMPLOYEES_FILE, DEFAULT_EMPLOYEES)
    employees = [e for e in employees if str(e.get("id")) != eid]
    save_json(EMPLOYEES_FILE, employees)
    sync_cashiers_from_employees(employees)
    return jsonify({"status": "success", "message": "Çalışan kaydı silindi.", "employees": employees})

@market_bp.route("/api/market/employees/permissions", methods=["POST"])
def api_market_employee_permissions():
    req = request.json or {}
    eid = str(req.get("id", "")).strip()
    permissions = req.get("permissions")

    if not eid:
        return jsonify({"status": "error", "message": "Çalışan ID'si eksik."}), 400

    employees = load_json(EMPLOYEES_FILE, DEFAULT_EMPLOYEES)
    found = False
    for emp in employees:
        if str(emp.get("id")) == eid:
            emp["custom_permissions"] = permissions
            found = True
            break

    if not found:
        return jsonify({"status": "error", "message": "Çalışan bulunamadı."}), 404

    save_json(EMPLOYEES_FILE, employees)
    return jsonify({"status": "success", "message": "İzinler başarıyla güncellendi.", "employees": employees})


# =========================================================
# 3.1 ÇALIŞANA ÖZEL MOBİL QR BAĞLANTI & TOKEN YENİLEME
# =========================================================
import secrets
from backend.araclar.excel_dosya_izleyici import get_local_ip, ensure_ssl_certs

def get_or_create_employee_token(emp):
    if not emp.get("qr_token"):
        emp["qr_token"] = f"tok_{emp.get('id')}_{secrets.token_hex(8)}"
    return emp["qr_token"]

@market_bp.route("/api/market/employees/qr-info", methods=["GET"])
def api_market_employee_qr_info():
    """Çalışanın kişisel mobil bağlantı QR bilgilerini ve güvenli linkini döner."""
    eid = str(request.args.get("id", "")).strip()
    if not eid:
        return jsonify({"status": "error", "message": "Çalışan ID gerekli."}), 400

    employees = load_json(EMPLOYEES_FILE, DEFAULT_EMPLOYEES)
    emp = next((e for e in employees if str(e.get("id")) == eid), None)
    if not emp:
        return jsonify({"status": "error", "message": "Çalışan bulunamadı."}), 404

    token = get_or_create_employee_token(emp)
    save_json(EMPLOYEES_FILE, employees)

    local_ip = get_local_ip()
    cert_path, key_path = ensure_ssl_certs(local_ip)
    
    http_url = f"http://{local_ip}:5000/mobile?auth_token={token}"
    https_url = f"https://{local_ip}:5001/mobile?auth_token={token}" if (cert_path and key_path) else None

    return jsonify({
        "status": "success",
        "employee": {
            "id": emp.get("id"),
            "name": emp.get("name"),
            "role_name": emp.get("role_name"),
            "role_id": emp.get("role_id"),
            "pin": emp.get("pin")
        },
        "qr_token": token,
        "local_ip": local_ip,
        "http_url": http_url,
        "https_url": https_url,
        "mobile_url": https_url or http_url
    })

@market_bp.route("/api/market/employees/regenerate-qr", methods=["POST"])
def api_market_employee_regenerate_qr():
    """QR kodunun çalınması/sızması durumunda eski kodu anında geçersiz kılıp yeni güvenli QR üretir."""
    req = request.json or {}
    eid = str(req.get("id", "")).strip()
    if not eid:
        return jsonify({"status": "error", "message": "Çalışan ID gerekli."}), 400

    employees = load_json(EMPLOYEES_FILE, DEFAULT_EMPLOYEES)
    found_emp = None
    for emp in employees:
        if str(emp.get("id")) == eid:
            # Eski tokenı geçersiz kıl, yepyeni kriptografik token ata
            emp["qr_token"] = f"tok_{emp.get('id')}_{secrets.token_hex(12)}"
            emp["qr_regenerated_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
            found_emp = emp
            break

    if not found_emp:
        return jsonify({"status": "error", "message": "Çalışan bulunamadı."}), 404

    save_json(EMPLOYEES_FILE, employees)

    local_ip = get_local_ip()
    cert_path, key_path = ensure_ssl_certs(local_ip)
    token = found_emp["qr_token"]
    http_url = f"http://{local_ip}:5000/mobile?auth_token={token}"
    https_url = f"https://{local_ip}:5001/mobile?auth_token={token}" if (cert_path and key_path) else None

    return jsonify({
        "status": "success",
        "message": f"'{found_emp.get('name')}' için eski QR kod iptal edildi, yeni güvenli QR kod oluşturuldu!",
        "qr_token": token,
        "mobile_url": https_url or http_url,
        "http_url": http_url
    })

@market_bp.route("/api/market/employees/by-token", methods=["GET"])
def api_market_employee_by_token():
    """Mobilden QR okutulduğunda auth_token ile personeli anında doğrular ve giriş yaptırır."""
    token = str(request.args.get("token", "")).strip()
    if not token:
        return jsonify({"status": "error", "message": "Token eksik."}), 400

    employees = load_json(EMPLOYEES_FILE, DEFAULT_EMPLOYEES)
    roles = load_json(ROLES_FILE, DEFAULT_ROLES)
    roles_map = {r["id"]: r for r in roles}

    emp = next((e for e in employees if str(e.get("qr_token")) == token and e.get("active") != False), None)
    if not emp:
        return jsonify({
            "status": "error", 
            "message": "Geçersiz veya süresi dolmuş / yenilenmiş QR Kod! Lütfen yöneticinizden yeni QR isteyin."
        }), 401

    emp_data = dict(emp)
    emp_data["effective_permissions"] = get_effective_permissions(emp, roles_map)

    return jsonify({
        "status": "success",
        "employee": emp_data
    })


# =========================================================
# 4. VARDİYA, ANLIK MOLA / İZİN & ÇIKIŞ TAKİBİ
# =========================================================
@market_bp.route("/api/market/shift/action", methods=["POST"])
def api_market_shift_action():
    req = request.json or {}
    eid = str(req.get("id", "")).strip()
    ename = str(req.get("name", "")).strip()
    action = str(req.get("action", "login")).strip() # login, start_break, end_break, logout

    if not eid:
        return jsonify({"status": "error", "message": "Çalışan ID belirtilmedi."}), 400

    logs_data = load_json(EMPLOYEE_LOGS_FILE, {"active_states": {}, "logs": []})
    active_states = logs_data.get("active_states", {})
    logs = logs_data.get("logs", [])

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    now_ts = int(time.time())

    state = active_states.get(eid, {"status": "off", "since": now_str, "since_ts": now_ts, "break_start": None})

    msg = ""
    if action in ("login", "start_shift"):
        state["status"] = "working"
        state["since"] = now_str
        state["since_ts"] = now_ts
        state["shift_start"] = now_str
        state["shift_start_ts"] = now_ts
        state["break_start"] = None
        logs.insert(0, {
            "id": f"log_{now_ts}",
            "employee_id": eid,
            "employee_name": ename,
            "action": "Vardiya Girişi",
            "time": now_str,
            "details": "Sisteme giriş yaptı ve göreve başladı."
        })
        msg = f"{ename} için vardiya başlatıldı."

    elif action == "start_break":
        state["status"] = "on_break"
        state["break_start"] = now_str
        state["break_start_ts"] = now_ts
        logs.insert(0, {
            "id": f"log_{now_ts}",
            "employee_id": eid,
            "employee_name": ename,
            "action": "Molaya Çıktı",
            "time": now_str,
            "details": "Anlık mola / izne ayrıldı."
        })
        msg = f"{ename} molaya çıktı."

    elif action == "end_break":
        break_duration_min = 0
        if state.get("break_start_ts"):
            break_duration_min = round((now_ts - state["break_start_ts"]) / 60.0, 1)
        state["status"] = "working"
        state["break_start"] = None
        logs.insert(0, {
            "id": f"log_{now_ts}",
            "employee_id": eid,
            "employee_name": ename,
            "action": "Moladan Döndü",
            "time": now_str,
            "details": f"Mola bitti ({break_duration_min} dk sürdü). Göreve devam ediyor."
        })
        msg = f"{ename} moladan döndü ve göreve başladı."

    elif action in ("logout", "end_shift"):
        work_duration_hr = 0
        if state.get("shift_start_ts"):
            work_duration_hr = round((now_ts - state["shift_start_ts"]) / 3600.0, 2)
        state["status"] = "off"
        state["break_start"] = None
        logs.insert(0, {
            "id": f"log_{now_ts}",
            "employee_id": eid,
            "employee_name": ename,
            "action": "Güvenli Çıkış",
            "time": now_str,
            "details": f"Vardiyasını tamamladı ({work_duration_hr} saat)."
        })
        msg = f"{ename} güvenli çıkış yaptı."

    active_states[eid] = state
    # Logları son 300 ile sınırla
    logs_data["logs"] = logs[:300]
    logs_data["active_states"] = active_states
    save_json(EMPLOYEE_LOGS_FILE, logs_data)

    return jsonify({
        "status": "success",
        "message": msg,
        "current_state": state
    })

# =========================================================
# 5. ÇALIŞAN PERFORMANS & VARDİYA RAPORLARI
# =========================================================
@market_bp.route("/api/market/employee-reports", methods=["GET"])
def api_market_employee_reports():
    employees = load_json(EMPLOYEES_FILE, DEFAULT_EMPLOYEES)
    logs_data = load_json(EMPLOYEE_LOGS_FILE, {"active_states": {}, "logs": []})
    active_states = logs_data.get("active_states", {})
    logs = logs_data.get("logs", [])

    # Satış cirolarını hesapla (Satış loglarından)
    sales_stats = {} # eid -> { turnover, count }
    try:
        sales_files = list_all_sales_files()
        for fpath in sales_files:
            s_data = load_json(fpath, {})
            receipts = s_data.get("receipts", []) if isinstance(s_data, dict) else (s_data if isinstance(s_data, list) else [])
            for r in receipts:
                cid = str(r.get("cashier_id") or r.get("cashier") or "admin").strip().lower()
                total_amt = float(r.get("total_amount") or r.get("total", 0.0) or 0.0)
                if cid not in sales_stats:
                    sales_stats[cid] = {"turnover": 0.0, "count": 0}
                sales_stats[cid]["turnover"] += total_amt
                sales_stats[cid]["count"] += 1
    except Exception as e:
        print("Sales stats calculation error:", e)

    # Etiket faaliyet sayıları
    label_stats = {} # eid -> count
    try:
        activities_data = load_json(PRODUCT_ACTIVITIES_FILE, {})
        if isinstance(activities_data, dict):
            for bc, act_list in activities_data.items():
                if isinstance(act_list, list):
                    for act in act_list:
                        eid = str(act.get("user") or act.get("cashier") or "admin").strip().lower()
                        label_stats[eid] = label_stats.get(eid, 0) + 1
        elif isinstance(activities_data, list):
            for act in activities_data:
                eid = str(act.get("user") or act.get("cashier") or "admin").strip().lower()
                label_stats[eid] = label_stats.get(eid, 0) + 1
    except Exception:
        pass

    reports = []
    for emp in employees:
        eid = str(emp.get("id"))
        state = active_states.get(eid, {"status": "off", "since": "-", "break_start": None})
        s_info = sales_stats.get(eid, {"turnover": 0.0, "count": 0})
        # İsimle de eşle
        if s_info["count"] == 0:
            for k, v in sales_stats.items():
                if k in emp.get("name", "").lower():
                    s_info = v
                    break

        # Mola sayısı ve toplam mola dakikasını loglardan hesapla
        emp_logs = [l for l in logs if str(l.get("employee_id")) == eid or (emp.get("name") and emp.get("name") in str(l.get("employee_name", "")))]
        break_count = sum(1 for l in emp_logs if "Mola" in str(l.get("action", "")))
        shift_count = sum(1 for l in emp_logs if "Vardiya" in str(l.get("action", "")) or "Giriş" in str(l.get("action", "")))
        
        # Mola dakikalarını topla
        total_break_mins = 0.0
        for l in emp_logs:
            det = str(l.get("details", ""))
            if "dk sürdü" in det:
                try:
                    # örn: 'Mola bitti (15.5 dk sürdü)'
                    part = det.split("(")[1].split(" dk")[0]
                    total_break_mins += float(part)
                except Exception:
                    pass

        # Eğer şu an moladaysa anlık geçen süreyi de ekle
        if state.get("status") == "on_break" and state.get("break_start_ts"):
            current_break_min = round((time.time() - state["break_start_ts"]) / 60.0, 1)
            total_break_mins += current_break_min

        l_count = label_stats.get(eid, 0)
        avg_basket = round(s_info["turnover"] / s_info["count"], 2) if s_info["count"] > 0 else 0.0

        reports.append({
            "id": eid,
            "name": emp.get("name"),
            "role_name": emp.get("role_name", "Kasiyer"),
            "status": state.get("status", "off"),
            "since": state.get("since", "-"),
            "break_count": break_count,
            "total_break_minutes": round(total_break_mins, 1),
            "shift_count": max(shift_count, 1 if state.get("status") == "working" else 0),
            "total_sales_turnover": round(s_info["turnover"], 2),
            "total_sales_count": s_info["count"],
            "avg_basket": avg_basket,
            "total_labels_printed": l_count
        })

    return jsonify({
        "status": "success",
        "reports": reports,
        "recent_logs": logs[:60]
    })

@market_bp.route("/api/market/employee-detail-logs", methods=["GET"])
def api_market_employee_detail_logs():
    eid = str(request.args.get("id", "")).strip()
    if not eid:
        return jsonify({"status": "error", "message": "Çalışan ID gerekli."}), 400

    employees = load_json(EMPLOYEES_FILE, DEFAULT_EMPLOYEES)
    emp = next((e for e in employees if str(e.get("id")) == eid), None)
    if not emp:
        return jsonify({"status": "error", "message": "Çalışan bulunamadı."}), 404

    logs_data = load_json(EMPLOYEE_LOGS_FILE, {"active_states": {}, "logs": []})
    all_logs = logs_data.get("logs", [])
    emp_logs = [l for l in all_logs if str(l.get("employee_id")) == eid or (emp.get("name") and emp.get("name") in str(l.get("employee_name", "")))]

    return jsonify({
        "status": "success",
        "employee": emp,
        "logs": emp_logs[:100]
    })

def sync_cashiers_from_employees(employees):
    """Çalışanları kasa kasiyer listesiyle eşitler."""
    cashiers = []
    for emp in employees:
        if emp.get("active") is not False:
            cashiers.append({
                "id": emp.get("id"),
                "name": emp.get("name"),
                "pin": emp.get("pin", ""),
                "role": "admin" if emp.get("role_id") == "admin" else "cashier",
                "role_name": emp.get("role_name", "Kasiyer"),
                "active": True
            })
    save_json(CASHIERS_FILE, cashiers)
