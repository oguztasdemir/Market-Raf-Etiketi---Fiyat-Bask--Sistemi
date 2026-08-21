import json
import re
from collections import Counter
import sys

sys.stdout.reconfigure(encoding='utf-8')

products = json.load(open('data/products.json', encoding='utf-8'))
print(f"Toplam Ürün Sayısı: {len(products)}")

# 1. Marka dağılımı
brands = Counter(p.get('brand', '') for p in products)
print("\n--- En Çok Ürünü Olan Markalar ---")
for b, c in brands.most_common(30):
    print(f"  {b}: {c}")

print("\n--- Şüpheli / Az Ürünü Olan Markalar (Son 30) ---")
for b, c in list(brands.most_common())[-30:]:
    print(f"  {b}: {c}")

# 2. Ürün adlarında sorunlu durumlar
weird_titles = []
for p in products:
    t = p.get('title', '')
    bc = p.get('barcode', '')
    b = p.get('brand', '')
    if not t or len(t) < 3:
        weird_titles.append((bc, t, "Çok kısa başlık"))
    elif re.search(r'[\*\#\$\@\^\&\(\)\{\}\[\]\<\>\=\+\_\~]', t):
        weird_titles.append((bc, t, "Özel karakter içeriyor"))
    elif re.search(r'\s{2,}', t):
        weird_titles.append((bc, t, "Çift boşluk içeriyor"))
    elif t != t.upper():
        weird_titles.append((bc, t, "Büyük harf değil"))

print(f"\nÖzel Karakter / Format Sorunu Olan Başlık Sayısı: {len(weird_titles)}")
for item in weird_titles[:15]:
    print(f"  [{item[0]}] '{item[1]}' -> {item[2]}")

# 3. Fiyat kontrolü
bad_prices = []
for p in products:
    pr = p.get('price', '')
    if not pr or not pr.endswith('TL') or ',' not in pr:
        bad_prices.append((p.get('barcode', ''), pr))
print(f"\nFormatı Düzgün Olmayan Fiyat Sayısı: {len(bad_prices)}")
for item in bad_prices[:10]:
    print(f"  [{item[0]}] '{item[1]}'")
