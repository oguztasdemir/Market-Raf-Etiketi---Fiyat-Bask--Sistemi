import urllib.request
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:5000"

def test_api():
    print("--- 1. Ürün Kataloğu API Testi ---")
    try:
        req = urllib.request.Request(f"{BASE_URL}/api/products")
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            print(f"Toplam Ürün: {len(data.get('products', []))}")
            first_prod = data.get('products', [])[0]
            print(f"İlk Ürün: {first_prod.get('title')} | Barkod: {first_prod.get('barcode')} | Fiyat: {first_prod.get('price')}")
    except Exception as e:
        print(f"Hata 1: {e}")

    print("\n--- 2. Toplu Fiyat Güncelleme API Testi ---")
    try:
        payload = json.dumps({
            "barcodes": ["8690504074380"],
            "price": "45,00 TL"
        }).encode('utf-8')
        req = urllib.request.Request(f"{BASE_URL}/api/catalog/batch-price-update", data=payload, headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            print(f"Fiyat Güncelleme Yanıtı: {data}")
    except Exception as e:
        print(f"Hata 2: {e}")

    print("\n--- 3. Toplu Marka Güncelleme API Testi ---")
    try:
        payload = json.dumps({
            "barcodes": ["8690504074380"],
            "brand": "ÜLKER"
        }).encode('utf-8')
        req = urllib.request.Request(f"{BASE_URL}/api/catalog/batch-brand-update", data=payload, headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            print(f"Marka Güncelleme Yanıtı: {data}")
    except Exception as e:
        print(f"Hata 3: {e}")

if __name__ == "__main__":
    test_api()
