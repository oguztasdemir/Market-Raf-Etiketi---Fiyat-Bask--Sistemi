import json
import datetime
import shutil
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, ".")

from src.utils.brand_detector import detect_brand_from_title
from src.services.excel_service import clear_diff_cache

# 1. Otomatik Güvenlik Yedeği Al
now_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
backup_dir = "data/backups"
os.makedirs(backup_dir, exist_ok=True)
backup_file = os.path.join(backup_dir, f"backup_pre_brand_cleanup_{now_str}.json")
shutil.copyfile("data/products.json", backup_file)
print(f"✓ Güvenlik yedeği alındı: {backup_file}")

# 2. Ürünleri Yükle ve Markalarını Temizle
with open("data/products.json", "r", encoding="utf-8") as f:
    products = json.load(f)

changed_count = 0
for p in products:
    title = p.get("title") or p.get("title1") or ""
    old_b = p.get("brand", "")
    new_b = detect_brand_from_title(title, products)
    
    if new_b and old_b != new_b:
        p["brand"] = new_b
        changed_count += 1
    elif not new_b:
        p["brand"] = "DİĞER"

with open("data/products.json", "w", encoding="utf-8") as f:
    json.dump(products, f, ensure_ascii=False, indent=2)

clear_diff_cache()
print(f"✓ Başarıyla {len(products)} ürün güncellendi. {changed_count} ürünün markası düzeltildi!")
