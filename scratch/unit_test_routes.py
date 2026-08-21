import sys
import os
import json

sys.path.insert(0, os.getcwd())
sys.stdout.reconfigure(encoding='utf-8')

from main import app

client = app.test_client()

print("--- 1. Ürün Kataloğu Test Client Testi ---")
res = client.get('/api/products')
print(f"Status: {res.status_code}")
data = res.get_json()
print(f"Toplam Ürün: {len(data.get('products', []))}")

print("\n--- 2. Toplu Fiyat Güncelleme Endpoint Testi ---")
res = client.post('/api/catalog/batch-price-update', json={
    "barcodes": ["8690504074380"],
    "price": "45,00 TL"
})
print(f"Status: {res.status_code}")
print(f"Yanıt: {res.get_json()}")

print("\n--- 3. Toplu Marka Güncelleme Endpoint Testi ---")
res = client.post('/api/catalog/batch-brand-update', json={
    "barcodes": ["8690504074380"],
    "brand": "ÜLKER"
})
print(f"Status: {res.status_code}")
print(f"Yanıt: {res.get_json()}")

print("\n--- 4. Tekil Ürün Detay Güncelleme Testi ---")
res = client.post('/api/products', json={
    "barcode": "8690504074380",
    "title": "ÜLKER ALTINBAŞAK GRİSSİNİ 125 GR",
    "brand": "ÜLKER",
    "price": "45,00 TL",
    "origin": "TÜRKİYE"
})
print(f"Status: {res.status_code}")
print(f"Yanıt: {res.get_json()}")
