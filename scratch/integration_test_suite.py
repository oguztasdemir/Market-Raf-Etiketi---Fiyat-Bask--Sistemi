# -*- coding: utf-8 -*-
"""
Yarenler Market 19 Aşamalı Genişletilmiş Entegrasyon Test Paketi
"""
import sys
import os

if sys.platform.startswith('win'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

# Proje dizinini ekle
sys.path.insert(0, os.path.abspath(r'c:\Users\User\Desktop\Etiket Çıkarıcı'))

from main import app

client = app.test_client()

print("=" * 60)
print("COMPREHENSIVE 19-PASS EXTENDED INTEGRATION TEST SUITE")
print("=" * 60)

passed = 0
total = 19

def test(name, condition, extra=""):
    global passed
    if condition:
        passed += 1
        print(f"[PASS] {name} {extra}")
    else:
        print(f"[FAIL] {name} {extra}")
        sys.exit(1)

# 1. Index Page
res1 = client.get('/')
test("1. Index Page Serving & Sidebar Menu", res1.status_code == 200)

# 2. Static JS
res2 = client.get('/frontend/js/masaustu/kasa/kasa_paneli.js')
test("2. Static JS Asset (masaustu/kasa/kasa_paneli.js)", res2.status_code == 200)

# 3. Static CSS
res3 = client.get('/frontend/stiller/masaustu/style.css')
test("3. Static CSS Asset (masaustu/style.css)", res3.status_code == 200)

# 4. POS Dashboard Summary
res4 = client.get('/api/pos/dashboard_summary')
data4 = res4.get_json()
test("4. POS Dashboard Summary", res4.status_code == 200 and 'total_lifetime_sales_count_str' in data4, f"-> {data4.get('total_lifetime_sales_count_str')}")

# 5. POS Price Check API
res5 = client.get('/api/pos/search?q=8690515125163')
data5 = res5.get_json()
test("5. POS Price Check API (8690515125163)", res5.status_code == 200 and data5.get('status') == 'success', f"-> {data5.get('product', {}).get('title')}")

# 6. POS Mobile Info API
res6 = client.get('/api/pos/mobile_info')
data6 = res6.get_json()
test("6. POS Mobile Info API", res6.status_code == 200 and data6.get('status') == 'success', f"-> IP: {data6.get('local_ip')}")

# 7. POS Cash Checkout
res7 = client.post('/api/pos/checkout', json={
    'items': [{'barcode': '8690515125163', 'title': 'Test Item', 'unit_price': 125.0, 'total_price': 125.0, 'quantity': 1, 'unit': 'Adet'}],
    'total_amount': 125.0,
    'payment_type': 'Nakit',
    'payment_breakdown': {'Nakit': 125.0},
    'received_cash': 200.0,
    'change_amount': 75.0,
    'customer_name': 'Test Musteri',
    'print_receipt': False
})
data7 = res7.get_json()
test("7. POS Cash Checkout with Change Calculation", res7.status_code == 200 and data7.get('status') == 'success', f"-> Fiş: {data7.get('receipt', {}).get('receipt_no')}")

# 8. POS Card Checkout
res8 = client.post('/api/pos/checkout', json={
    'items': [{'barcode': '8690515125163', 'title': 'Test Item 2', 'unit_price': 50.0, 'total_price': 50.0, 'quantity': 1, 'unit': 'Adet'}],
    'total_amount': 50.0,
    'payment_type': 'Kredi Kartı',
    'payment_breakdown': {'Kredi Kartı': 50.0},
    'received_cash': 0.0,
    'change_amount': 0.0,
    'customer_name': 'Test Kart',
    'print_receipt': False
})
data8 = res8.get_json()
test("8. POS Card Checkout", res8.status_code == 200 and data8.get('status') == 'success', f"-> Fiş: {data8.get('receipt', {}).get('receipt_no')}")

# 9. Catalog Products API
res9 = client.get('/api/products')
data9 = res9.get_json()
test("9. Catalog Products API (/api/products)", res9.status_code == 200 and 'products' in data9, f"-> {len(data9.get('products', []))} items")

# 10. Scale Products API
res10 = client.get('/api/scale/products')
data10 = res10.get_json()
test("10. Scale Products API", res10.status_code == 200 and 'products' in data10, f"-> {len(data10.get('products', []))} PLU items")

# 11. Reports Calendar API
res11 = client.get('/api/reports/calendar?year=2026&month=8')
data11 = res11.get_json()
test("11. Reports Calendar API", res11.status_code == 200 and 'days' in data11 and data11.get('status') == 'success', f"-> {len(data11.get('days', []))} days, {data11.get('month_name_tr')}")

# 12. Accounting Overview API
res12 = client.get('/api/accounting/overview?year=2026&month=8')
data12 = res12.get_json()
test("12. Accounting Overview API", res12.status_code == 200 and data12.get('status') == 'success', f"-> Gelir: {data12.get('total_sales_income_str')}, Gider: {data12.get('total_expenses_str')}")

# 13. Invoice Math Validation API
res13 = client.get('/api/invoice/demo-sample')
data13 = res13.get_json()
test("13. Invoice Reading & Math Validation API", res13.status_code == 200 and data13.get('status') == 'success', f"-> {data13.get('invoice', {}).get('supplier_name')} ({len(data13.get('invoice', {}).get('items', []))} items)")

# --- 5 YENİ ÖZELLİK TESTLERİ ---

# 14. Batch Price Update API
res14 = client.post('/api/catalog/batch_price_update', json={
    'brand': 'NON_EXISTENT_TEST_BRAND',
    'percent': 10.0
})
data14 = res14.get_json()
test("14. Batch Price Update Engine API (/api/catalog/batch_price_update)", res14.status_code == 200 and data14.get('status') == 'success')

# 15. Today Price-Changed Queue API
res15 = client.get('/api/catalog/price_changed_today')
data15 = res15.get_json()
test("15. Today Price-Changed Queue API", res15.status_code == 200 and 'products' in data15, f"-> {data15.get('count', 0)} queue items")

# 16. Low Stock Alerts API
res16 = client.get('/api/catalog/low_stock_alerts?threshold=10')
data16 = res16.get_json()
test("16. Low Stock Alerts API", res16.status_code == 200 and 'products' in data16, f"-> {data16.get('count', 0)} alert items")

# 17. Customer Ledger List & Create API
res17 = client.post('/api/customers', json={
    'name': 'TEST MÜŞTERİ YILMAZ',
    'phone': '05551234567',
    'credit_limit': 3000.0,
    'notes': 'Güvenilir müşteri'
})
data17 = res17.get_json()
test("17. Customer Ledger Creation API (/api/customers)", res17.status_code == 200 and data17.get('status') == 'success')

# 18. Customer Debt & Payment Transaction API
res_list = client.get('/api/customers')
custs = res_list.get_json().get('customers', [])
test_cust = next((c for c in custs if 'TEST MÜŞTERİ' in c.get('name', '')), None)
if test_cust:
    res18 = client.post(f"/api/customers/{test_cust.get('id')}/transaction", json={
        'type': 'debt',
        'amount': 250.0,
        'description': 'Test Veresiye Satış'
    })
    data18 = res18.get_json()
    test("18. Customer Transaction & Balance API (/api/customers/<id>/transaction)", res18.status_code == 200 and data18.get('new_balance') is not None, f"-> Bakiye: {data18.get('new_balance')} TL")
else:
    test("18. Customer Transaction & Balance API", False)

# 19. Auto Daily Zip Backup API
res19 = client.post('/api/backup/auto_daily')
data19 = res19.get_json()
test("19. Auto Daily ZIP Backup API", res19.status_code == 200 and data19.get('status') == 'success', f"-> {data19.get('filename')} ({data19.get('size_kb')} KB)")

print("=" * 60)
print(f"ALL {passed}/{total} INTEGRATION TESTS PASSED PERFECTLY! (100% SUCCESS)")
print("=" * 60)
