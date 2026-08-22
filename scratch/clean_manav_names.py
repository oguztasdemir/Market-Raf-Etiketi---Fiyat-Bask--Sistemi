# -*- coding: utf-8 -*-
import csv
import json
import os

csv_path = os.path.join("data", "sistem_exceli", "stok_2026-08-20_11-38-00.csv")
out_path = os.path.join("data", "manav_products.json")

# Türkçe harf tamir tablosu
CHAR_MAP = {
    'Ý': 'İ', 'ý': 'ı',
    'Þ': 'Ş', 'þ': 'ş',
    'Ð': 'Ğ', 'ð': 'ğ',
    'Ã': 'Ç', 'ã': 'ç',
    'Õ': 'Ö', 'õ': 'ö',
    'Ü': 'Ü', 'ü': 'ü',
    'Ö': 'Ö', 'ö': 'ö',
    'Ç': 'Ç', 'ç': 'ç',
    'Ş': 'Ş', 'ş': 'ş',
    'Ğ': 'Ğ', 'ğ': 'ğ',
    'İ': 'İ', 'ı': 'ı'
}

CUSTOM_NAMES = {
    1000: "ÇERİ DOMATES",
    1001: "DOMATES",
    1002: "SALKIM DOMATES",
    1003: "PEMBE DOMATES",
    1004: "ÇENGELKÖY SALATALIK",
    1005: "PATATES",
    1006: "SOĞAN KURU",
    1007: "ÜZÜM",
    1008: "LİMON",
    1009: "SİVRİ BİBER",
    1010: "ŞEFTALİ",
    1011: "MEKSİKA BİBERİ",
    1012: "KAPYA BİBER",
    1013: "SARIMSAK",
    1014: "KARPUZ",
    1015: "KIRKAĞAÇ KAVUN",
    1016: "MUZ İTHAL",
    1017: "NEKTARİ",
    1018: "LÜKS İNCİR",
    1019: "SALATALIK",
    1021: "YEŞİL FASULYE",
    1022: "EKŞİ ELMA",
    1023: "KARPUZ",
    1024: "BİGA KAVUNU",
    1025: "KAYISI",
    1026: "ÇEKİRDEKSİZ KARPUZ",
    1027: "LÜKS ÇİLEK",
    1028: "SANTA MARIA ARMUT",
    1029: "PORTAKAL",
    1030: "PATLICAN KÖY",
    1031: "KABAK",
    1032: "HAVUÇ",
    1033: "PETEMEK DOMATES",
    1034: "DOLMA BİBER",
    1035: "KIVIRCIK",
    1036: "MAYDANOZ",
    1037: "ROKA",
    1038: "DEREOTU",
    1042: "TAZE HURMA",
    1043: "KIRMIZI LAHANA",
    1044: "GÖBEK MARUL",
    1045: "YEŞİL SOĞAN",
    1047: "AVOKADO",
    1052: "SEMİZOTU",
    1061: "NANE",
    1063: "KOKTEYL DOMATES",
    1064: "YEŞİL SOĞAN",
    1065: "KIRMIZI LAHANA",
    1070: "BROKOLİ",
    1071: "KESTANE KASTAMONU",
    1072: "ANANAS",
    1073: "KARNIBAHAR",
    1074: "KEREVİZ",
    1076: "KİRAZ"
}

items = []
seen_codes = set()

with open(csv_path, mode="r", encoding="cp1254", errors="ignore") as f:
    r = csv.reader(f, delimiter=";")
    header = next(r)
    for row in r:
        if len(row) < 7:
            continue
        code = row[0].strip()
        barcode = row[1].replace(",00", "").strip()
        title_raw = row[5].strip()
        price_raw = row[6].strip()

        if not price_raw or "BOŞ STOK" in title_raw.upper():
            continue

        if not code.isdigit():
            continue

        code_int = int(code)
        if not (1000 <= code_int <= 1076):
            continue

        if code_int in seen_codes:
            continue
        seen_codes.add(code_int)

        plu_no = code_int - 1000 if code_int > 1000 else 1000
        if plu_no == 1000:
            plu_no = 0  # PLU 0 / Çeri Domates

        title = CUSTOM_NAMES.get(code_int, title_raw.replace("MNV", "").strip().upper())
        p_clean = price_raw.replace("TL", "").replace("₺", "").strip().replace(".", ",")
        price_formatted = f"{p_clean} TL"

        # Birim
        if "ADET" in title_raw.upper():
            unit = "Adet"
        elif any(d in title for d in ["MAYDANOZ", "ROKA", "DEREOTU", "NANE"]):
            unit = "Demet"
        elif "PK" in title_raw.upper():
            unit = "Pk"
        else:
            unit = "Kg"

        items.append({
            "plu": plu_no if plu_no > 0 else 100,
            "barcode": barcode if barcode else f"27{code_int:05d}",
            "stock_code": str(code_int),
            "title": title,
            "price": price_formatted,
            "unit": unit,
            "origin": "TÜRKİYE",
            "scale_price": price_formatted,
            "sync_status": "synced",
            "last_synced_at": "20 Ağu 2026 16:00"
        })

items.sort(key=lambda x: x["plu"])

with open(out_path, mode="w", encoding="utf-8") as f:
    json.dump(items, f, ensure_ascii=False, indent=2)

print(f"Toplam {len(items)} adet sistem fiyatı kaydedildi!")
