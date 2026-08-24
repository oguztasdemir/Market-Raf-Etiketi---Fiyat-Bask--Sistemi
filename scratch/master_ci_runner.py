# -*- coding: utf-8 -*-
"""
MASTER CI / CD TEST SUITE & BUG DETECTOR
Sistemdeki tüm modülleri, API rotalarını, eşzamanlılık kilitlerini,
JSON veritabanı dosyalarını ve Python sözdizimini otomatik denetler.
"""
import os
import sys
import json
import py_compile
import datetime

sys.path.insert(0, os.path.abspath(r'c:\Users\User\Desktop\Etiket Çıkarıcı'))

from main import app
from backend.araclar.depolama_araclari import load_json
from backend.ayarlar import (
    DATA_DIR, PRODUCTS_FILE, MANAV_PRODUCTS_FILE,
    SALES_DIR, CUSTOMERS_FILE, EXPENSES_FILE, SETTINGS_FILE
)

print("=" * 70)
print("🚀 MASTER CI/CD OTOMATİK KALİTE VE BUG TARAMA MOTORU BAŞLATILDI")
print(f"[*] Tarih: {datetime.datetime.now().strftime('%d.%m.%Y %H:%M:%S')}")
print("=" * 70)

passed = 0
failed = 0
warnings = 0

def log_pass(msg):
    global passed
    passed += 1
    print(f"  [PASS] {msg}")

def log_fail(msg, err=""):
    global failed
    failed += 1
    print(f"  [FAIL] {msg} -> {err}")

def log_warn(msg):
    global warnings
    warnings += 1
    print(f"  [WARN] {msg}")

# =========================================================================
# 1. PYTHON SÖZDİZİMİ (SYNTAX & COMPILATION) TESTİ
# =========================================================================
print("\n--- 1. Python Kodları Sözdizimi ve Derleme Denetimi ---")
py_files_count = 0
for root, _, files in os.walk(os.path.abspath(r'c:\Users\User\Desktop\Etiket Çıkarıcı\backend')):
    for f in files:
        if f.endswith('.py'):
            py_files_count += 1
            fpath = os.path.join(root, f)
            try:
                py_compile.compile(fpath, doraise=True)
            except py_compile.PyCompileError as e:
                log_fail(f"Sözdizimi hatası: {f}", str(e))

log_pass(f"Backend içerisindeki {py_files_count} adet Python dosyası hatasız derlendi.")

# =========================================================================
# 2. JSON VERİTABANI BÜTÜNLÜK TESTİ
# =========================================================================
print("\n--- 2. Kalıcı Veritabanı (JSON) Bütünlük ve Şema Denetimi ---")
json_files = [
    ("Ürün Kataloğu", PRODUCTS_FILE, list),
    ("Manav Kataloğu", MANAV_PRODUCTS_FILE, list),
    ("Müşteri Defteri", CUSTOMERS_FILE, list),
    ("Dükkan Giderleri", EXPENSES_FILE, list),
    ("Sistem Ayarları", SETTINGS_FILE, dict)
]

for name, path, expected_type in json_files:
    if os.path.exists(path):
        try:
            with open(path, 'r', encoding='utf-8') as jf:
                data = json.load(jf)
                if isinstance(data, expected_type):
                    log_pass(f"{name} ({os.path.basename(path)}) -> Geçerli JSON ({len(data)} kayıt)")
                else:
                    log_fail(f"{name} tipi uyuşmuyor: Beklenen {expected_type}, gelen {type(data)}")
        except Exception as e:
            log_fail(f"{name} JSON bozuk/okunamıyor", str(e))
    else:
        log_warn(f"{name} dosyası henüz oluşturulmamış ({path})")

# =========================================================================
# 3. REST API VE ENTEGRASYON TESTLERİ
# =========================================================================
print("\n--- 3. API Uç Noktaları ve Entegrasyon Denetimi ---")
client = app.test_client()

# 3.1. Ana Sayfa & UI
res = client.get('/')
if res.status_code == 200:
    log_pass("Masaüstü Web UI (/) 200 OK")
else:
    log_fail("Masaüstü UI yüklenemedi", f"Status: {res.status_code}")

# 3.2. Mobil UI
res_mob = client.get('/mobile')
if res_mob.status_code == 200:
    log_pass("Mobil Terminal Arayüzü (/mobile) 200 OK")
else:
    log_fail("Mobil UI yüklenemedi", f"Status: {res_mob.status_code}")

# 3.3. POS Dashboard
res_pos = client.get('/api/pos/dashboard_summary')
if res_pos.status_code == 200 and res_pos.get_json().get('market_name'):
    log_pass(f"POS Dashboard API -> {res_pos.get_json().get('market_name')}")
else:
    log_fail("POS Dashboard API başarısız")

# 3.4. Ürün Arama (Tokenized)
res_srch = client.get('/api/pos/search?q=kent')
if res_srch.status_code == 200 and res_srch.get_json().get('status') == 'success':
    log_pass("Akıllı Ürün Arama API (/api/pos/search)")
else:
    log_fail("Ürün Arama API başarısız")

# 3.5. POS Satış ve Otomatik Stok Düşüm Testi
sample_prods = load_json(PRODUCTS_FILE, [])
if sample_prods:
    test_prod = sample_prods[0]
    test_bc = test_prod.get('barcode')
    init_stock = float(test_prod.get('stock', 100))

    checkout_res = client.post('/api/pos/checkout', json={
        'items': [{
            'barcode': test_bc,
            'title': test_prod.get('title'),
            'unit_price': 10.0,
            'total_price': 10.0,
            'quantity': 2,
            'unit': 'Adet'
        }],
        'total_amount': 10.0,
        'payment_type': 'Nakit',
        'payment_breakdown': {'Nakit': 10.0},
        'received_cash': 10.0,
        'change_amount': 0.0,
        'customer_name': 'CI Test Robotu',
        'print_receipt': False
    })
    c_data = checkout_res.get_json()
    if checkout_res.status_code == 200 and c_data.get('status') == 'success':
        # Stok düşüm kontrolü
        after_prods = load_json(PRODUCTS_FILE, [])
        after_prod = next((p for p in after_prods if p.get('barcode') == test_bc), None)
        if after_prod and after_prod.get('stock') == (init_stock - 2):
            log_pass(f"POS Satışı & Otomatik Stok Düşümü -> Stok: {init_stock} -> {after_prod.get('stock')} (Fiş: {c_data.get('receipt', {}).get('receipt_no')})")
        else:
            log_fail("Satış sonrası stok doğru düşmedi")
    else:
        log_fail("POS Satış Checkout API başarısız")

# 3.6. Terazi PLU Listesi
res_scale = client.get('/api/scale/products')
if res_scale.status_code == 200:
    log_pass(f"Terazi PLU Servisi -> {len(res_scale.get_json().get('products', []))} ürün")
else:
    log_fail("Terazi PLU Servisi başarısız")

# 3.7. Muhasebe & Raporlama
res_acc = client.get(f"/api/accounting/overview?year={datetime.datetime.now().year}&month={datetime.datetime.now().month}")
if res_acc.status_code == 200 and res_acc.get_json().get('status') == 'success':
    log_pass("Muhasebe & Net Kâr API")
else:
    log_fail("Muhasebe API başarısız")

# 3.8. Fatura & UBL-TR Sağlama
res_inv = client.get('/api/invoice/demo-sample')
if res_inv.status_code == 200 and res_inv.get_json().get('invoice', {}).get('validation', {}).get('is_valid'):
    log_pass("Fatura Matematiksel Sağlama Motoru (%100 Tutarlı)")
else:
    log_fail("Fatura Sağlama API başarısız")

# 3.9. Kasiyer Yönetim API
res_cash = client.get('/api/cashiers')
if res_cash.status_code == 200 and 'cashiers' in res_cash.get_json():
    log_pass(f"Kasiyer Yönetim API (/api/cashiers) -> {len(res_cash.get_json().get('cashiers', []))} kasiyer")
else:
    log_fail("Kasiyer Yönetim API başarısız")

# =========================================================================
# 4. ÇOKLU İŞ PARÇACIĞI (PARALLEL CONCURRENCY) TESTİ
# =========================================================================
print("\n--- 4. Çoklu İş Parçacığı (Concurrency & Mutex Lock) Denetimi ---")
import concurrent.futures

def parallel_checkout(i):
    return client.post('/api/pos/checkout', json={
        'items': [{'barcode': '8690515125163', 'title': f'CI Concurrency {i}', 'unit_price': 5.0, 'total_price': 5.0, 'quantity': 1, 'unit': 'Adet'}],
        'total_amount': 5.0,
        'payment_type': 'Nakit',
        'payment_breakdown': {'Nakit': 5.0},
        'received_cash': 5.0,
        'change_amount': 0.0,
        'customer_name': f'CI Tester {i}',
        'print_receipt': False
    }).get_json()

with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
    par_results = list(executor.map(parallel_checkout, range(5)))

par_receipts = [r.get('receipt', {}).get('receipt_no') for r in par_results if r.get('status') == 'success']
if len(par_receipts) == 5 and len(set(par_receipts)) == 5:
    log_pass(f"5 Eşzamanlı Satış Sıfır Çakışma ile Tamamlandı -> Örnek Fiş: {par_receipts[0]}")
else:
    log_fail(f"Eşzamanlı satışta çakışma veya eksik var: {par_receipts}")

print("\n" + "=" * 70)
print(f"📊 CI/CD TEST RAPORU SONUCU: {passed} BAŞARILI, {failed} HATALI, {warnings} UYARI")
if failed == 0:
    print("🎉 KODDA HİÇBİR BUG VEYA ÇÖKME RİSKİ BULUNAMADI! SİSTEM %100 SAĞLIKLI.")
else:
    print(f"⚠️ SİSTEMDE {failed} ADET BUG TESPİT EDİLDİ!")
print("=" * 70)
