import json
import re
import sys
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8')

with open('data/products.json', 'r', encoding='utf-8') as f:
    products = json.load(f)

# Find all generic words used as brands
GENERIC_CATEGORY_BRANDS = [
    'CİPS', 'CIPS', 'SİGARA', 'SIGARA', 'ÇAY', 'CAY', 'SU', 'SODA', 'OYUNCAK', 
    'SÜT', 'SUT', 'PEYNİR', 'PEYNIR', 'ŞEKER', 'SEKER', 'BİSKÜVİ', 'BISKUVI',
    'ÇİKOLATA', 'CIKOLATA', 'KAHVE', 'DETERJAN', 'SABUN', 'ŞAMPUAN', 'SAMPUAN',
    'MAKARNA', 'PİLİÇ', 'PILIC', 'TAVUK', 'ET', 'BAKLİYAT', 'BAKLIYAT', 'UN', 'YAĞ', 'YAG',
    'DONDURMA', 'EKMEK', 'YUMURTA', 'GAZOZ', 'KOLA', 'MEYVE SUYU', 'MEYVESUYU',
    'PEÇETE', 'PECETE', 'MENDİL', 'MENDIL', 'ISLAK MENDİL', 'ÇORAP', 'CORAP', 'PİL', 'PIL',
    'YARENLER', 'DİĞER', 'DIGER', 'TURKİYE', 'TÜRKİYE'
]

generic_items = [p for p in products if p.get('brand') in GENERIC_CATEGORY_BRANDS]
print(f"Kategori Adı veya Genel İsim Verilmiş Markalı Ürün Sayısı: {len(generic_items)}")

for g in GENERIC_CATEGORY_BRANDS:
    matching = [p for p in products if p.get('brand') == g]
    if matching:
        print(f"\n--- Marka: '{g}' ({len(matching)} Ürün) ---")
        for p in matching[:10]:
            print(f"  [{p.get('barcode')}] {p.get('title')}")

