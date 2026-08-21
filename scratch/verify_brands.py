import json
import re
from collections import Counter
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open("data/products.json", "r", encoding="utf-8") as f:
    products = json.load(f)

brand_counts = Counter()
garbage = []

for p in products:
    b = str(p.get("brand", "")).strip()
    brand_counts[b] += 1
    if re.match(r'^[\d\.\,\'\-\s]+$', b) or len(b) <= 2 or b.startswith('0') or b.startswith('477'):
        garbage.append((b, p.get("title", ""), p.get("barcode", "")))

print(f"Toplam Ürün: {len(products)}")
print(f"Toplam Marka: {len(brand_counts)}")
print(f"Çöp / Rakam Marka: {len(garbage)}")

print("\n--- İLK 30 MARKA ---")
for b, c in brand_counts.most_common(30):
    print(f"  {b}: {c} ürün")

print("\n--- 'ÜLKER', 'BİZİM', 'ETİ', 'ŞÖLEN', 'NESTLE' KONTROLÜ ---")
for target in ['ÜLKER', 'ÜLKER BİZİM', 'ETİ', 'ŞÖLEN', 'NESTLE']:
    print(f"  {target}: {brand_counts.get(target, 0)} ürün")
