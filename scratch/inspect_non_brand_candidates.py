import json
from collections import Counter
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open("data/products.json", "r", encoding="utf-8") as f:
    products = json.load(f)

brand_counts = Counter()
brand_samples = {}

for p in products:
    b = str(p.get("brand", "DİĞER")).strip()
    brand_counts[b] += 1
    if b not in brand_samples:
        brand_samples[b] = []
    if len(brand_samples[b]) < 3:
        brand_samples[b].append((p.get("title", ""), p.get("barcode", "")))

# Filter brands with only 1 or 2 products
rare_brands = [(b, count) for b, count in brand_counts.items() if count <= 2]

print(f"Toplam Marka: {len(brand_counts)}")
print(f"1 veya 2 Ürünü Olan Marka Sayısı: {len(rare_brands)}")

print("\n--- 1-2 Ürünü Olan Markalardan Şüpheli/Jenerik Olabileceklerin Örnekleri ---")
for b, count in sorted(rare_brands, key=lambda x: x[0])[:120]:
    samples = brand_samples[b]
    first_title = samples[0][0] if samples else ""
    print(f"Marka: '{b}' ({count} ürün) -> Örnek Ürün: '{first_title}'")
