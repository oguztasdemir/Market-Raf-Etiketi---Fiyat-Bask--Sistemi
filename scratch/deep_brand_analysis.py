import json
import re
from collections import Counter
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open("data/products.json", "r", encoding="utf-8") as f:
    products = json.load(f)

print(f"Toplam Ürün Sayısı: {len(products)}")

brand_counts = Counter()
garbage_brands = []

for p in products:
    brand = str(p.get("brand", "")).strip()
    brand_counts[brand] += 1
    # Check garbage indicators: digits only, floats, short numbers, unit like '50'Lİ', 'GR', 'ML', '0.0'
    if re.match(r'^[\d\.\,\'\-\s]+$', brand) or len(brand) <= 1 or re.match(r'^\d+[\'A-ZÇĞİÖŞÜ]+$', brand):
        garbage_brands.append((brand, p.get("title", ""), p.get("barcode", "")))

print(f"\nToplam Farklı Marka Sayısı: {len(brand_counts)}")
print(f"Şüpheli / Çöp Marka Sayısı: {len(garbage_brands)}")

print("\n--- İlk 30 Şüpheli / Çöp Marka Örneği ---")
for b, title, barcode in garbage_brands[:30]:
    print(f"Marka: '{b}' | Ürün: '{title}' | Barkod: '{barcode}'")

print("\n--- En Çok Ürünü Olan İlk 30 Marka ---")
for b, count in brand_counts.most_common(30):
    print(f"Marka: '{b}' -> {count} ürün")

print("\n--- 1-2 Ürünü Olan Markalardan Bazı Örnekler (A-Z) ---")
low_brands = sorted([b for b, c in brand_counts.items() if c <= 2])
for b in low_brands[:40]:
    print(f"'{b}'")
