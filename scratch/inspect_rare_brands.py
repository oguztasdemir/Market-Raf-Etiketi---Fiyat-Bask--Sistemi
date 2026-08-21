import json
import re
from collections import Counter
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open("data/products.json", "r", encoding="utf-8") as f:
    products = json.load(f)

# Tüm mevcut markaları frekansıyla listele
brands_counter = Counter()
for p in products:
    b = str(p.get("brand", "")).strip()
    brands_counter[b] += 1

print(f"Toplam Ürün: {len(products)}")
print(f"Toplam Marka: {len(brands_counter)}")

# Tek tek tüm markaları inceleyip kategorize edelim
print("\n--- TÜM MARKALARIN LİSTESİ VE ÜRÜN SAYILARI ---")
sorted_all = sorted(brands_counter.items(), key=lambda x: (-x[1], x[0]))

for b, count in sorted_all:
    if count >= 5:
        print(f"[POPÜLER] {b}: {count} ürün")

print("\n--- 1-4 ÜRÜNÜ OLAN ŞÜPHELİ KELİMELER/MARKALAR ---")
rare_brands = [b for b, count in sorted_all if count < 5]
for b in sorted(rare_brands)[:100]:
    print(f"  - '{b}' (Ürün sayısı: {brands_counter[b]})")
