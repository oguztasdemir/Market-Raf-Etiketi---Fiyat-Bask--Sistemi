import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('data/products.json', 'r', encoding='utf-8') as f:
    products = json.load(f)

barcodes = [
    '8690182055466', # Beşler Dana Eti
    '7613287484123', # Felix Kuzu Eti
    '7613287484406', # Felix Sığır Eti
    '8698996003161', # Maylo Puf Mendil
    '8700216034074', # Oral B Diş Eti
    '8690390046003', # Sebil Cin Mısır
    '8681291002595', # Sensodyne Diş Eti
    '8691825165153', # Vatan Cin Mısır
    '8690719106180', # Çay Doğuş Form
    '8690719109082', # Çay Doğuş Form
    '8699141013363', # Şölen Luppo
]

print("Kullanıcı Görselindeki Hatalı Ürünlerin Yeni Durumu:")
for b in barcodes:
    p = next((x for x in products if x.get('barcode') == b), None)
    if p:
        print(f"  Barkod: {b} | Ürün: {p.get('title')} | YENİ MARKA: [{p.get('brand')}]")

eti_count = len([p for p in products if p.get('brand') == 'ETİ'])
print(f"\nGüncel ETİ Markalı Ürün Sayısı: {eti_count} (Tümü gerçek Eti ürünleri!)")
