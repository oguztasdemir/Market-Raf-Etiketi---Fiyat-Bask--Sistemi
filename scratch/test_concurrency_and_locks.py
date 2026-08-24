# -*- coding: utf-8 -*-
"""
Çoklu İş Parçacığı (Multi-Threaded) Eşzamanlılık ve Kilit Doğrulama Testi
"""
import sys
import os
import concurrent.futures
import threading

sys.path.insert(0, os.path.abspath(r'c:\Users\User\Desktop\Etiket Çıkarıcı'))

from main import app
from backend.araclar.depolama_araclari import load_json, save_json
from backend.ayarlar import PRODUCTS_FILE

print("=" * 60)
print("MULTI-THREADED CONCURRENCY & LOCK INTEGRITY TEST")
print("=" * 60)

client = app.test_client()

# 1. Test 10 Concurrent Checkouts in parallel
def perform_checkout(index):
    res = client.post('/api/pos/checkout', json={
        'items': [{'barcode': '8690515125163', 'title': f'Concurrent Item {index}', 'unit_price': 10.0, 'total_price': 10.0, 'quantity': 1, 'unit': 'Adet'}],
        'total_amount': 10.0,
        'payment_type': 'Nakit',
        'payment_breakdown': {'Nakit': 10.0},
        'received_cash': 10.0,
        'change_amount': 0.0,
        'customer_name': f'Tester {index}',
        'print_receipt': False
    })
    return res.get_json()

with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
    results = list(executor.map(perform_checkout, range(10)))

receipt_nos = [r.get('receipt', {}).get('receipt_no') for r in results if r.get('status') == 'success']
assert len(receipt_nos) == 10, f"Expected 10 successful checkouts, got {len(receipt_nos)}"
assert len(set(receipt_nos)) == 10, f"Receipt collision detected! Receipts: {receipt_nos}"
print(f"[PASS] 10 Concurrent Checkouts Completed with 0 Collisions! Sample Receipt: {receipt_nos[0]}")

# 2. Test 10 Concurrent Customer Transactions on same customer
res_cust = client.get('/api/customers').get_json()
customers = res_cust.get('customers', [])
if customers:
    test_cust = customers[0]
    cust_id = test_cust.get('id')
    start_bal = float(test_cust.get('balance', 0.0))

    def add_transaction(index):
        res = client.post(f"/api/customers/{cust_id}/transaction", json={
            'type': 'debt',
            'amount': 5.0,
            'description': f'Eşzamanlı Borç {index}'
        })
        return res.get_json()

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        tx_results = list(executor.map(add_transaction, range(10)))

    successes = [r for r in tx_results if r.get('status') == 'success']
    assert len(successes) == 10, f"Expected 10 successful transactions, got {len(successes)}"
    
    # Verify final balance
    res_after = client.get('/api/customers').get_json()
    cust_after = next((c for c in res_after.get('customers', []) if c.get('id') == cust_id), None)
    expected_bal = round(start_bal + 50.0, 2)
    assert round(float(cust_after.get('balance', 0.0)), 2) == expected_bal, f"Balance mismatch! Expected {expected_bal}, got {cust_after.get('balance')}"
    print(f"[PASS] 10 Concurrent Customer Transactions correctly updated balance from {start_bal} to {cust_after.get('balance')} TL (Atomic Lock Verified)!")

# 3. Test High-Frequency In-Memory Catalog Cache Reads
def fast_read(index):
    prods = load_json(PRODUCTS_FILE, [])
    return len(prods)

with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
    read_results = list(executor.map(fast_read, range(50)))

assert all(r == read_results[0] for r in read_results)
print(f"[PASS] 50 Parallel High-Speed Cache Reads Completed across 20 threads ({read_results[0]} items each)!")

print("=" * 60)
print("ALL CONCURRENCY & CRASH-PREVENTION TESTS PASSED 100%!")
print("=" * 60)
