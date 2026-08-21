import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, ".")

from src.utils.text_cleaner import score_product_match

with open("data/products.json", "r", encoding="utf-8") as f:
    products = json.load(f)

# 'sütaş süt' araması yap
matches_sut = []
for p in products:
    score = score_product_match("sütaş süt", p)
    if score > 0:
        matches_sut.append((p.get("title"), p.get("brand"), score))

print(f"Toplam 'sütaş süt' Eşleşmesi: {len(matches_sut)}")
print("--- İLK 15 EŞLEŞEN ÜRÜN ---")
for t, b, s in matches_sut[:15]:
    print(f"  [{s:.1f}p] {t} ({b})")

# Eşleşenlerin içinde peynir var mı kontrolü
peynir_matches = [t for t, b, s in matches_sut if 'peynir' in t.lower() or 'kaşar' in t.lower()]
print(f"\nHatalı Peynir/Kaşar Eşleşmesi Sayısı: {len(peynir_matches)}")
if peynir_matches:
    print(f"Hatalı olanlar: {peynir_matches}")
else:
    print("✓ MÜKEMMEL: Sıfır peynir eşleşti! Yalnızca süt ürünleri geldi.")
