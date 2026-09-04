# -*- coding: utf-8 -*-
"""
Terazi, Şarküteri, Kasap Barkodları Ayrıştırma & Üretici Firma Eşleme
"""
import re
from backend.ayarlar import PRODUCTS_FILE, MANAV_PRODUCTS_FILE
from backend.araclar.depolama_araclari import load_json
from backend.araclar.metin_duzenleyici import parse_price_val, format_price_display


def parse_scale_barcode(barcode: str) -> dict:
    """
    20-29 serisi tüm terazi, şarküteri, manav ve kasap barkodlarını akıllıca ayrıştırır.
    Formatlar:
    1) 27 + 5 hane PLU + 5 hane Gramaj + 1 Checksum (örn: 2700001015003 -> PLU 1, 1.500 Kg)
    2) 27 + 2 hane Dept + 3 hane PLU + 5 hane Gramaj + 1 Checksum (örn: 2701001015003 -> PLU 1, 1.500 Kg)
    3) 28/29 + 5 hane PLU + 5 hane Fiyat (Kuruş) + 1 Checksum (örn: 2800050045502 -> PLU 50, 45.50 TL)
    4) 27 + 4 hane PLU + 6 hane Gramaj/Fiyat varyasyonları
    """
    raw_s = str(barcode).strip()
    clean_bc = re.sub(r'[^0-9]', '', raw_s)
    
    if len(clean_bc) < 12 or len(clean_bc) > 14:
        return None

    prefix = clean_bc[:2]
    if prefix not in ("20", "21", "22", "23", "24", "25", "26", "27", "28", "29"):
        return None

    try:
        # Olası PLU adayları:
        # Aday 1: 2:7 (5 haneli standart: 2700001 -> PLU 1)
        # Aday 2: 4:7 (Departmanlı: 2701001 -> Dept 01, PLU 1)
        # Aday 3: 2:6 (4 haneli terazi formatı)
        plu_candidates = []
        try:
            p1 = int(clean_bc[2:7].lstrip("0") or "0")
            if p1 > 0: plu_candidates.append(p1)
        except Exception:
            pass

        try:
            p2 = int(clean_bc[4:7].lstrip("0") or "0")
            if p2 > 0 and p2 not in plu_candidates: plu_candidates.append(p2)
        except Exception:
            pass

        try:
            p3 = int(clean_bc[2:6].lstrip("0") or "0")
            if p3 > 0 and p3 not in plu_candidates: plu_candidates.append(p3)
        except Exception:
            pass

        # Ürünü veritabanında ara (Önce SQLite sonra JSON)
        matched_item = None
        matched_plu = plu_candidates[0] if plu_candidates else 1

        try:
            from backend.araclar.sqlite_servisi import get_connection
            with get_connection() as conn:
                cur = conn.cursor()
                # 1. Aşama: Manav ürünlerinde PLU ara
                for cand_plu in plu_candidates:
                    cur.execute("SELECT plu, barcode, title, name, price, scale_price, unit, origin FROM manav_urunleri WHERE plu = ?;", (cand_plu,))
                    m_row = cur.fetchone()
                    if m_row:
                        matched_item = dict(m_row)
                        matched_plu = cand_plu
                        break
                
                # 2. Aşama: Manavda bulunamadıysa Genel Katalogda tam barkod veya PLU ile ara
                if not matched_item:
                    for cand_plu in plu_candidates:
                        cur.execute("SELECT barcode, title, price, price_num, unit, origin FROM urunler WHERE barcode = ? OR barcode = ?;", (str(cand_plu), f"27{cand_plu:05d}"))
                        u_row = cur.fetchone()
                        if u_row:
                            matched_item = dict(u_row)
                            matched_plu = cand_plu
                            break
        except Exception as dbe:
            pass

        # JSON fallback
        if not matched_item:
            manav_prods = load_json(MANAV_PRODUCTS_FILE, [])
            for cand_plu in plu_candidates:
                m = next((p for p in manav_prods if int(p.get("plu", -1)) == cand_plu), None)
                if m:
                    matched_item = m
                    matched_plu = cand_plu
                    break

            if not matched_item:
                all_prods = load_json(PRODUCTS_FILE, [])
                for cand_plu in plu_candidates:
                    u = next((p for p in all_prods if str(p.get("barcode", "")).strip() == str(cand_plu)), None)
                    if u:
                        matched_item = u
                        matched_plu = cand_plu
                        break

        title = matched_item.get("name") or matched_item.get("title") or f"Terazi Ürün (PLU: {matched_plu})" if matched_item else f"Terazi Ürün (PLU {matched_plu})"
        origin = matched_item.get("origin", "TÜRKİYE") if matched_item else "TÜRKİYE"
        unit_str = matched_item.get("unit", "Kg") if matched_item else "Kg"

        # Birim fiyat tespiti
        unit_price_val = 0.0
        if matched_item:
            unit_price_val = float(matched_item.get("price_num") or 0.0)
            if unit_price_val <= 0:
                unit_price_val = parse_price_val(matched_item.get("scale_price") or matched_item.get("price", "0"))

        # Sayısal veri bloğu (7:12 -> 5 hane)
        num_block = int(clean_bc[7:12]) if len(clean_bc) >= 12 else 0

        # Prefix Analizi
        # 27 veya 20-26: Genellikle Gramajlı Terazi (örn: 01500 -> 1.500 Kg)
        # 28 veya 29: Gömülü Fiyatlı (örn: 04550 -> 45.50 TL)
        if prefix in ("27", "20", "21", "22", "23", "24", "25", "26"):
            weight_kg = round(num_block / 1000.0, 3)
            # Eğer gramaj çok sıfırsa veya anormal ise 1 kg varsay
            if weight_kg <= 0:
                weight_kg = 1.0

            total_price_val = round(unit_price_val * weight_kg, 2)

            return {
                "is_scale_item": True,
                "plu": matched_plu,
                "barcode": clean_bc,
                "title": title,
                "unit": unit_str,
                "quantity": weight_kg,
                "weight_kg": weight_kg,
                "unit_price": unit_price_val,
                "unit_price_str": format_price_display(unit_price_val),
                "total_price": total_price_val,
                "total_price_str": format_price_display(total_price_val),
                "origin": origin
            }
        else:
            # 28 veya 29: Fiyat gömülü (Kuruş)
            total_price_val = round(num_block / 100.0, 2)
            if unit_price_val > 0:
                weight_kg = round(total_price_val / unit_price_val, 3)
            else:
                unit_price_val = total_price_val
                weight_kg = 1.0

            return {
                "is_scale_item": True,
                "plu": matched_plu,
                "barcode": clean_bc,
                "title": title,
                "unit": unit_str,
                "quantity": weight_kg if weight_kg > 0 else 1.0,
                "weight_kg": weight_kg if weight_kg > 0 else 1.0,
                "unit_price": unit_price_val,
                "unit_price_str": format_price_display(unit_price_val),
                "total_price": total_price_val,
                "total_price_str": format_price_display(total_price_val),
                "origin": origin
            }

    except Exception as e:
        print(f"[HATA] Terazi barkodu ayrıştırma hatası ({barcode}): {e}")

    return None

GS1_MANUFACTURER_MAP = {
    "8690504": "Ülker",
    "8690515": "Kent / Mondelez",
    "8690526": "Eti",
    "8690533": "Çaykur",
    "8690565": "Sütaş",
    "8690508": "Pınar",
    "8690637": "Torku",
    "8690530": "Doğuş Çay",
    "8690757": "Duru / Evyap",
    "8690506": "Tat Gıda",
    "8690502": "Hayat Kimya (Molfix/Bingo/Papia)",
    "8690511": "Henkel (Pril/Vernel/Persil)",
    "8690505": "Eczacıbaşı (Selpak/Solo)",
    "8690624": "Coca-Cola İçecek",
    "8690558": "PepsiCo / Frito-Lay",
    "8690574": "Erikli Su",
    "8690562": "Sırma İçecek",
    "8690555": "Kızılay Maden Suyu",
    "8690632": "Beypazarı Maden Suyu",
    "8690537": "Uludağ İçecek",
    "8690760": "Haribo Türkiye",
    "8690587": "Tadım Gıda",
    "8690553": "Peyman Kuruyemiş",
    "8690635": "Şölen Çikolata",
    "8690520": "Banvit",
    "8690700": "Şenpiliç",
    "8690710": "Beypiliç",
    "8690560": "Fiskobirlik",
    "8690550": "Koroplast",
    "8690507": "Unilever (Lipton/Knorr/Omo)",
    "8690501": "Procter & Gamble (Ariel/Fairy)",
    "8690538": "Dimes",
    "8690524": "Tamek",
    "8690568": "Nestle",
    "8690518": "Eker Süt",
    "8690595": "İçim / Ak Gıda",
    "8690516": "Komili",
    "8690528": "Yudum",
    "8690656": "Bal Küpü Şeker",
    "8690572": "Billur Tuz",
    "8690590": "Ofçay",
    "8690605": "Dr. Oetker",
    "8690580": "Knorr",
    "8690544": "Aromel / Evyap",
    "8690594": "Nivea",
    "8690512": "Reckitt Benckiser (Finish/Calgon)",
    "8690525": "Colgate Palmolive",
    "8690542": "Sensodyne / GSK",
    "8690566": "Johnson & Johnson",
    "8690638": "Lipton",
    "8690840": "Oneo / Perfetti Van Melle",
    "8690766": "Elidor",
    "8690788": "Clear",
    "8690799": "Pantene",
    "8690820": "Fairy",
    "8690830": "Ariel",
    "8690850": "Alo",
    "8690860": "Pril",
    "8690870": "Vernel",
    "8690880": "Yumoş",
    "8690890": "Domestos",
    "8690900": "Cif",
    "8690910": "Parex",
    "8690920": "Sleepy / Eruslu Sağlık",
    "8690930": "Molfix",
    "8690940": "Prima",
    "8690950": "Familia",
    "8690960": "Papia",
    "8690970": "Selpak",
    "8690980": "Solo"
}

def get_manufacturer_by_barcode_prefix(barcode: str) -> str:
    """GS1 EAN barkod önekine göre Türkiye/Global üretici firma adını tespit eder."""
    s = str(barcode or "").strip()
    if len(s) >= 7:
        p7 = s[:7]
        if p7 in GS1_MANUFACTURER_MAP:
            return GS1_MANUFACTURER_MAP[p7]
    if len(s) >= 6:
        p6 = s[:6]
        if p6 in GS1_MANUFACTURER_MAP:
            return GS1_MANUFACTURER_MAP[p6]
    return ""

