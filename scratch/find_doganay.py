import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open("data/products.json", "r", encoding="utf-8") as f:
    products = json.load(f)

for p in products:
    t = p.get("title", "").lower()
    b = p.get("brand", "").lower()
    if 'salgam' in t or 'şalgam' in t or 'dogan' in t or 'doğan' in t or 'dogan' in b or 'doğan' in b:
        print(f"Barkod: {p.get('barcode')} | Başlık: '{p.get('title')}' | Marka: '{p.get('brand')}'")
