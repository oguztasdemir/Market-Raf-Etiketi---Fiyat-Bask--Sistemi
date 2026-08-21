import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, ".")

from src.utils.text_cleaner import score_product_match

with open("data/products.json", "r", encoding="utf-8") as f:
    products = json.load(f)

# 'sütaş peynir' araması yap
matches_peynir = []
for p in products:
    score = score_product_match("sütaş peynir", p)
    if score > 0:
        matches_peynir.append((p.get("title"), p.get("brand"), score))

print(f"Toplam 'sütaş peynir' Eşleşmesi: {len(matches_peynir)}")
print("--- İLK 10 EŞLEŞEN ÜRÜN ---")
for t, b, s in matches_peynir[:10]:
    print(f"  [{s:.1f}p] {t} ({b})")

sut_matches = [t for t, b, s in matches_peynir if 'süt' in t.lower() and 'peynir' not in t.lower()]
print(f"\nHatalı Süt Eşleşmesi Sayısı: {len(sut_matches)}")
