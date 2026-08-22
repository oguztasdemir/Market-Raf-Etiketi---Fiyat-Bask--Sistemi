# -*- coding: utf-8 -*-
import csv
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.utils.text_cleaner import fix_corrupted_turkish_text

csv_path = os.path.join("data", "sistem_exceli", "stok_2026-08-20_11-38-00.csv")
out_path = os.path.join("data", "manav_products.json")

real_manav_list = []
seen_plus = set()

with open(csv_path, mode='r', encoding='cp1254', errors='ignore') as f:
    r = csv.reader(f, delimiter=';')
    header = next(r)

    for row in r:
        if len(row) < 7:
            continue
        code = row[0].strip()
        barcode = row[1].replace(',00', '').strip()
        title_raw = row[5].strip()
        price_raw = row[6].strip()

        if not price_raw or 'BOŞ STOK' in title_raw.upper() or 'BOS STOK' in title_raw.upper():
            continue

        is_mnv = title_raw.startswith('MNV') or (code.isdigit() and 1001 <= int(code) <= 1076)
        if not is_mnv:
            continue

        # Fiyat formatı (Örn: 69.95 TL -> 69,95 TL)
        p_clean = price_raw.replace('TL', '').replace('₺', '').strip().replace('.', ',')
        price_formatted = f"{p_clean} TL"

        # PLU tuş numarası: 1001 -> 1, 1002 -> 2 vb.
        if code.isdigit() and 1000 < int(code) < 1100:
            plu_no = int(code) - 1000
        elif code.isdigit():
            plu_no = int(code)
        else:
            plu_no = len(real_manav_list) + 1

        if plu_no in seen_plus:
            continue
        seen_plus.add(plu_no)

        # Başlığı onar
        fixed_title = fix_corrupted_turkish_text(title_raw)
        clean_title = fixed_title.replace('MNV', '').replace('KG', '').replace('KĞ', '').strip()
        if clean_title.startswith('.'):
            clean_title = clean_title[1:].strip()
        clean_title = clean_title.upper()

        # Birim
        if 'ADET' in fixed_title.upper():
            unit = 'Adet'
        elif any(d in fixed_title.upper() for d in ['MAYDONOZ', 'MAYDANOZ', 'ROKA', 'DERE OTU', 'NANE']):
            unit = 'Demet'
        elif 'PK' in fixed_title.upper():
            unit = 'Pk'
        else:
            unit = 'Kg'

        real_manav_list.append({
            "plu": plu_no,
            "barcode": barcode if barcode else f"27{plu_no:05d}",
            "stock_code": code,
            "title": clean_title,
            "price": price_formatted,
            "unit": unit,
            "origin": "TÜRKİYE",
            "scale_price": price_formatted,
            "sync_status": "synced",
            "last_synced_at": "20 Ağu 2026 16:00"
        })

real_manav_list.sort(key=lambda x: x["plu"])

with open(out_path, mode="w", encoding="utf-8") as f:
    json.dump(real_manav_list, f, ensure_ascii=False, indent=2)

print(f"Toplam {len(real_manav_list)} adet GERÇEK manav ürünü onarıldı ve kaydedildi.")
