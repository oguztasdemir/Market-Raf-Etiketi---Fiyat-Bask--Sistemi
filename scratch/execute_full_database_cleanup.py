import json
import datetime
import shutil
import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, ".")

from src.utils.brand_detector import detect_brand_from_title
from src.services.excel_service import clear_diff_cache

# 1. Tam Zaman Damgalı Güvenlik Yedeği Al
now_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
backup_dir = "data/backups"
os.makedirs(backup_dir, exist_ok=True)
backup_file = os.path.join(backup_dir, f"backup_full_json_cleanup_{now_str}.json")
shutil.copyfile("data/products.json", backup_file)
print(f"✓ Güvenlik yedeği alındı: {backup_file}")

# 2. Ürünleri Yükle ve Baştan Sona Normalize Et
with open("data/products.json", "r", encoding="utf-8") as f:
    products = json.load(f)

cleaned_products = []
updated_brand_count = 0
updated_price_count = 0

for p in products:
    # A. Başlık
    raw_title = str(p.get("title") or p.get("title1") or "").strip()
    clean_title = re.sub(r'[\r\n\t]+', ' ', raw_title)
    clean_title = re.sub(r'\s+', ' ', clean_title).strip()
    
    # B. Marka
    old_b = p.get("brand", "")
    new_b = detect_brand_from_title(clean_title, products) or "DİĞER"
    if old_b != new_b:
        updated_brand_count += 1
        
    # C. Fiyat Formatı
    raw_price = str(p.get("price", "0,00 TL")).replace('₺', 'TL').strip()
    if not raw_price.endswith('TL'):
        raw_price = f"{raw_price} TL"
    if p.get("price") != raw_price:
        updated_price_count += 1
        
    # D. Barkod
    raw_barcode = str(p.get("barcode", "")).strip()

    # E. Yapılandırılmış Nesne
    cleaned_products.append({
        "barcode": raw_barcode,
        "title": clean_title,
        "title1": p.get("title1") or clean_title,
        "title2": p.get("title2") or "",
        "brand": new_b,
        "price": raw_price,
        "stock": p.get("stock", 100),
        "origin": p.get("origin", "TÜRKİYE"),
        "unit": p.get("unit", "Adet")
    })

# 3. Dosyayı Kaydet
with open("data/products.json", "w", encoding="utf-8") as f:
    json.dump(cleaned_products, f, ensure_ascii=False, indent=2)

clear_diff_cache()

print(f"\n=======================================================")
print(f"✓ Başarıyla {len(cleaned_products)} ürün normalize edildi ve kaydedildi.")
print(f"[*] Düzeltilen Marka Sayısı : {updated_brand_count}")
print(f"[*] Düzeltilen Fiyat Formatı: {updated_price_count}")
print(f"[*] Dosya Yolu               : data/products.json")
print(f"=======================================================\n")
