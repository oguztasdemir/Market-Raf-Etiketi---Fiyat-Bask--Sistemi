import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, ".")

from src.utils.text_cleaner import clean_barcode, clean_product_title, format_price_display, get_online_or_system_datetime
from src.utils.brand_detector import detect_brand_from_title
from src.services.backup_service import create_products_backup

def normalize_tr_upper(text: str) -> str:
    if not text:
        return ""
    mapping = {
        'i': 'İ', 'ı': 'I', 'ç': 'Ç', 'ş': 'Ş', 'ğ': 'Ğ', 'ü': 'Ü', 'ö': 'Ö',
        'İ': 'İ', 'I': 'I', 'Ç': 'Ç', 'Ş': 'Ş', 'Ğ': 'Ğ', 'Ü': 'Ü', 'Ö': 'Ö'
    }
    chars = []
    for c in text:
        chars.append(mapping.get(c, c.upper()))
    res = "".join(chars)
    return res.replace("İ", "İ").replace("i̇", "İ")

# Marka yazım hataları düzeltme tablosu
BRAND_CORRECTIONS = {
    "İÇİNM": "İÇİM",
    "İÇİÇ": "İÇİM",
    "KOMİL": "KOMİLİ",
    "SÜTA": "SÜTAŞ",
    "ULUDAİMEYVELİM": "ULUDAĞ",
    "ORBÇÇAYBAMBU": "ORBİT",
    "GÜNÇÇAYDIN": "GÜNAYDIN",
    "S.OGÜÇLÜU": "GÜÇLÜ",
    "ERİLKL": "ERİKLİ",
    "CEVRE": "ÇEVRE",
    "TRİOMOVE": "TRIO",
    "ÜRÜN": "DİĞER",
    "MELİDA": "DİĞER",
    "BİZBİZE": "DİĞER",
    "SEVEN": "DİĞER",
    "LOL": "DİĞER",
    "PEK": "DİĞER",
    "JELIDO": "DİĞER",
    "LAPİDEN": "DİĞER"
}

# Başlık içi genel yazım hataları ve OCR bozulmaları
TITLE_REPLACEMENTS = [
    (r'\b&\b', ' VE '),
    (r'\bVE\s+VE\b', 'VE'),
    (r'\s*[\+]\s*', ' + '),
    (r'\s*[\/]\s*', ' / '),
    (r'\bPöTİ\b', 'PÖTİ'),
    (r'\bpöti\b', 'PÖTİ'),
    (r'\bmısırlı\b', 'MISIRLI'),
    (r'\bNESFiT\b', 'NESFİT'),
    (r'\bnesfit\b', 'NESFİT'),
    (r'\bYÜKSük\b', 'YÜKSÜK'),
    (r'\byüksük\b', 'YÜKSÜK'),
    (r'\bkıraz saplı\b', 'KİRAZ SAPLI'),
    (r'\bKIRAZ SAPLI\b', 'KİRAZ SAPLI'),
    (r'\bGg\b', 'GR'),
    (r'\bGr\b', 'GR'),
    (r'\bgr\b', 'GR'),
    (r'\bKg\b', 'KG'),
    (r'\bkg\b', 'KG'),
    (r'\bLt\b', 'LT'),
    (r'\blt\b', 'LT'),
    (r'\bMl\b', 'ML'),
    (r'\bml\b', 'ML'),
    (r'\bLIMON\b', 'LİMON'),
    (r'\bCILEK\b', 'ÇİLEK'),
    (r'\bKETCAP\b', 'KETÇAP'),
    (r'\bKOLİSİ\b', 'KOLİ'),
    (r'\bADEDİ\b', 'ADET'),
    (r'\bADETİ\b', 'ADET'),
    (r'\s{2,}', ' ')
]

def clean_single_title(title: str) -> str:
    t = normalize_tr_upper(title)
    for pattern, rep in TITLE_REPLACEMENTS:
        t = re.sub(pattern, rep, t, flags=re.IGNORECASE)
    # Çift boşlukları ve baştaki/sondaki gereksiz karakterleri temizle
    t = re.sub(r'[\*\#\$\@\^\&\{\}\[\]\<\>\=\_\~]', '', t)
    t = re.sub(r'\s{2,}', ' ', t).strip()
    return t

# Veritabanını yükle
products = json.load(open('data/products.json', encoding='utf-8'))
now_dt = get_online_or_system_datetime()

# Yedek al
create_products_backup("Veritabanı Tüm Ürünler Detaylı Temizlik Öncesi")

cleaned_count = 0
title_changed = 0
brand_changed = 0

for p in products:
    bc = clean_barcode(p.get('barcode', ''))
    raw_title = p.get('title') or p.get('title1') or ''
    clean_t = clean_single_title(raw_title)
    
    if clean_t != raw_title:
        title_changed += 1

    # Marka tespiti ve düzeltmesi
    old_b = p.get('brand', '').strip().upper()
    detected_b = detect_brand_from_title(clean_t)
    
    new_b = BRAND_CORRECTIONS.get(old_b, old_b)
    if detected_b != 'DİĞER' and (new_b in ['DİĞER', 'YARENLER', ''] or new_b in BRAND_CORRECTIONS):
        new_b = detected_b
    elif not new_b:
        new_b = detected_b

    if new_b != old_b:
        brand_changed += 1

    pr = format_price_display(p.get('price', '0,00 TL'))
    lbl_pr = format_price_display(p.get('label_price') or pr)

    p['barcode'] = bc
    p['title'] = clean_t
    p['title1'] = clean_t
    p['title2'] = ""
    p['brand'] = new_b
    p['origin'] = "TÜRKİYE"
    p['price'] = pr
    p['label_price'] = lbl_pr
    p['date'] = p.get('date') or now_dt
    p['updated_at'] = p.get('updated_at') or now_dt

    cleaned_count += 1

# Kaydet
with open('data/products.json', 'w', encoding='utf-8') as f:
    json.dump(products, f, ensure_ascii=False, indent=2)

print(f"✓ Toplam {cleaned_count} ürün baştan sona temizlendi ve standardize edildi.")
print(f"  - Başlığı düzeltilen/normalize edilen: {title_changed} ürün")
print(f"  - Markası düzeltilen/güncellenen     : {brand_changed} ürün")
