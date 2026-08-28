# -*- coding: utf-8 -*-
"""
Excel ve CSV Stok Dosyalarını Okuma, Fark Analizi ve Arşiv Servisi
"""
import os
import re
import csv
import datetime
import openpyxl
from backend.ayarlar import SISTEM_EXCELI_DIR, PRODUCTS_FILE
from backend.araclar.depolama_araclari import load_json
from backend.araclar.metin_duzenleyici import (
    clean_product_title, clean_barcode, parse_price_val, 
    format_price_display, normalize_header_name
)
from backend.araclar.marka_tespit_edici import detect_brand_from_title

_DIFF_CACHE = {}

def clear_diff_cache():
    """Analiz önbelleğini temizler."""
    _DIFF_CACHE.clear()

def detect_stock_column_indices(headers: list):
    """Excel veya CSV dosyasındaki sütun indekslerini tespit eder."""
    stok_idx = None
    barkod_idx = None
    title_idx = None
    price_idx = None

    for i, h in enumerate(headers):
        if not h:
            continue
        nh = normalize_header_name(str(h))
        if not nh:
            continue
        if barkod_idx is None and nh in ['barkod', 'barcode', 'barkodu', 'ean', 'gtin']:
            barkod_idx = i
        elif stok_idx is None and (nh in ['stokkodu', 'stokkod', 'urunkodu', 'itemcode', 'stockcode'] or nh == 'kod'):
            stok_idx = i
        elif title_idx is None and any(nh.startswith(k) or nh == k for k in ['malincinsi', 'urunadi', 'stokadi', 'aciklama', 'tanim', 'title', 'productname', 'urun']):
            title_idx = i
        elif price_idx is None and any(k in nh for k in ['satisfiyat', 'fiyat', 'price', 'tutar']):
            price_idx = i

    if stok_idx is None: stok_idx = 0
    if barkod_idx is None: barkod_idx = 1 if len(headers) > 1 else 0
    if title_idx is None: title_idx = 5 if len(headers) > 5 else (2 if len(headers) > 2 else 0)
    if price_idx is None: price_idx = 6 if len(headers) > 6 else (3 if len(headers) > 3 else 0)

    return stok_idx, barkod_idx, title_idx, price_idx

def read_stock_rows_from_file(file_path: str) -> list:
    """Excel veya CSV dosyasından satırları okur ve standart sözlük listesine çevirir."""
    ext = os.path.splitext(file_path)[1].lower()
    raw_rows = []

    if ext in ['.xlsx', '.xls']:
        wb = openpyxl.load_workbook(file_path, data_only=True)
        sheet = wb.active
        for row in sheet.iter_rows(values_only=True):
            if any(cell is not None and str(cell).strip() != '' for cell in row):
                raw_rows.append(list(row))
    elif ext == '.csv':
        encodings = ['utf-8-sig', 'utf-8', 'cp1254', 'windows-1254', 'iso-8859-9', 'latin-1']
        content = None
        for enc in encodings:
            try:
                with open(file_path, 'r', encoding=enc) as f:
                    content = f.read()
                    break
            except (UnicodeDecodeError, LookupError):
                continue
        if content is None:
            raise ValueError("CSV dosyası okunamadı (karakter kodlaması desteklenmiyor).")

        sample_lines = [line for line in content.splitlines() if line.strip()][:10]
        if not sample_lines:
            return []

        semicolons = sum(line.count(';') for line in sample_lines)
        commas = sum(line.count(',') for line in sample_lines)
        tabs = sum(line.count('\t') for line in sample_lines)
        pipes = sum(line.count('|') for line in sample_lines)

        counts = [(';', semicolons), (',', commas), ('\t', tabs), ('|', pipes)]
        counts.sort(key=lambda x: x[1], reverse=True)
        delimiter = counts[0][0] if counts[0][1] > 0 else ';'

        reader = csv.reader(content.splitlines(), delimiter=delimiter)
        for row in reader:
            if any(cell and str(cell).strip() != '' for cell in row):
                raw_rows.append(row)
    else:
        raise ValueError(f"Desteklenmeyen dosya türü: {ext}")

    if not raw_rows:
        return []

    header_row = raw_rows[0]
    stok_idx, barkod_idx, title_idx, price_idx = detect_stock_column_indices(header_row)

    first_nh = [normalize_header_name(c) for c in header_row if c]
    has_header = any(
        any(k in cell for k in ['stok', 'barkod', 'fiyat', 'malin', 'urun', 'price', 'code'])
        for cell in first_nh
    )
    start_row = 1 if has_header else 0

    items = []
    for r in raw_rows[start_row:]:
        raw_stok = str(r[stok_idx] if stok_idx < len(r) and r[stok_idx] is not None else '').strip()
        raw_barkod = str(r[barkod_idx] if barkod_idx < len(r) and r[barkod_idx] is not None else '').strip()
        title = str(r[title_idx] if title_idx < len(r) and r[title_idx] is not None else '').strip()
        price_raw = r[price_idx] if price_idx < len(r) else None

        stok_kodu = clean_barcode(raw_stok)
        barkod = clean_barcode(raw_barkod)

        if not stok_kodu and not barkod and not title:
            continue

        raw_code = raw_barkod or raw_stok
        is_sci = ('E+' in raw_barkod.upper() or 'E-' in raw_barkod.upper() or 'E+' in raw_stok.upper())

        items.append({
            'stok_kodu': stok_kodu,
            'barkod': barkod,
            'raw_code': raw_code,
            'is_scientific': is_sci,
            'title': title,
            'price_raw': price_raw
        })

    return items

def analyze_excel_diff(excel_path: str) -> dict:
    """Excel veya CSV tablosunu products.json ve black_list.json ile karşılaştırır."""
    if not excel_path or not os.path.exists(excel_path):
        return {"status": "error", "message": "Excel/CSV dosyası bulunamadı."}

    mtime = os.path.getmtime(excel_path)
    cache_key = (excel_path, mtime)

    if cache_key in _DIFF_CACHE:
        return _DIFF_CACHE[cache_key]

    products = load_json(PRODUCTS_FILE, [])
    prod_map = {clean_barcode(p.get('barcode', '')): p for p in products if p.get('barcode')}

    def normalize_for_title_matching(s):
        if not s: return ''
        s = clean_product_title(s).upper()
        tr_map = str.maketrans('ÇĞİÖŞÜI', 'CGIOSUI')
        s = s.translate(tr_map)
        return re.sub(r'[^A-Z0-9]', '', s)

    # Barkodsuz ürünler için başlık eşleme haritası
    prod_title_map = {}
    for p in products:
        t = p.get('title') or p.get('title1') or ''
        nt = normalize_for_title_matching(t)
        if nt and nt not in prod_title_map and not p.get('barcode'):
            prod_title_map[nt] = p

    try:
        raw_items = read_stock_rows_from_file(excel_path)
    except Exception as e:
        return {"status": "error", "message": f"Dosya açılamadı: {str(e)}"}

    changed_prices = []
    new_products = []
    matched_products = []
    seen_keys = set()

    for item in raw_items:
        stok_kodu = item['stok_kodu']
        barkod = item['barkod']
        title = item['title']
        price_raw = item['price_raw']
        price_str = format_price_display(price_raw)
        
        lookup_code = barkod or stok_kodu
        clean_title = clean_product_title(title)
        excel_title_val = clean_title or title
        norm_title = normalize_for_title_matching(title)

        is_scientific = item.get('is_scientific') or ('E+' in str(item.get('raw_code', '')).upper())
        item_key = (lookup_code, norm_title) if (is_scientific and not barkod) else (lookup_code or norm_title)

        if not item_key or item_key in seen_keys:
            continue
        seen_keys.add(item_key)

        # 1. Mevcut Ürün Kontrolü & Fiyat Farkı (Barkod -> Stok Kodu -> Barkodsuz Başlık)
        matched_prod = None
        if barkod and barkod in prod_map:
            matched_prod = prod_map[barkod]
        elif stok_kodu and stok_kodu in prod_map:
            matched_prod = prod_map[stok_kodu]
        elif (not barkod and not stok_kodu) and norm_title and norm_title in prod_title_map:
            matched_prod = prod_title_map[norm_title]

        if matched_prod:
            resolved_code = clean_barcode(matched_prod.get('barcode')) or lookup_code
            cur_price_val = parse_price_val(matched_prod.get('price'))
            excel_price_val = parse_price_val(price_str)

            if abs(cur_price_val - excel_price_val) > 0.01 and excel_price_val > 0:
                diff = excel_price_val - cur_price_val
                changed_prices.append({
                    "barcode": resolved_code,
                    "excel_title": excel_title_val,
                    "current_title": matched_prod.get('title') or matched_prod.get('title1') or title,
                    "current_price": matched_prod.get('price') or "-",
                    "excel_price": price_str,
                    "diff_amount": round(diff, 2),
                    "diff_percent": round((diff / cur_price_val * 100), 1) if cur_price_val > 0 else 0,
                    "brand": matched_prod.get('brand') if (matched_prod.get('brand') and matched_prod.get('brand') not in ['DİĞER', 'DIGER']) else 'YARENLER',
                    "status": "changed"
                })
            else:
                matched_products.append({
                    "barcode": resolved_code,
                    "excel_title": excel_title_val,
                    "current_title": matched_prod.get('title') or matched_prod.get('title1') or title,
                    "current_price": matched_prod.get('price') or "-",
                    "excel_price": price_str,
                    "brand": matched_prod.get('brand') if (matched_prod.get('brand') and matched_prod.get('brand') not in ['DİĞER', 'DIGER']) else 'YARENLER',
                    "status": "matched"
                })
        else:
            # 2. Yeni Ürün (Bizim sistemimizde henüz mevcut değil)
            if price_str and price_str != "0,00 TL":
                det_brand = detect_brand_from_title(excel_title_val, products)
                new_products.append({
                    "barcode": clean_barcode(lookup_code),
                    "excel_title": excel_title_val,
                    "current_title": "-",
                    "current_price": "-",
                    "excel_price": price_str,
                    "brand": det_brand or "",
                    "brand_detected": bool(det_brand),
                    "status": "new"
                })

    # Markası tespit edilemeyen yeni ürünler en üstte listelenir (kullanıcıya sormak için)
    new_products.sort(key=lambda x: (1 if x.get('brand_detected') else 0, x.get('excel_title', '')))

    filename = os.path.basename(excel_path)
    file_mtime = datetime.datetime.fromtimestamp(os.path.getmtime(excel_path)).strftime("%d %b %Y %H:%M")

    result = {
        "status": "success",
        "filename": filename,
        "updated_at": file_mtime,
        "stats": {
            "total_excel_rows": len(seen_keys),
            "changed_count": len(changed_prices),
            "new_count": len(new_products),
            "matched_count": len(matched_products)
        },
        "changed_prices": changed_prices,
        "new_products": new_products,
        "matched_products": matched_products
    }

    _DIFF_CACHE[cache_key] = result
    return result

def get_latest_excel_path():
    """sistem_exceli dizinindeki en son yüklenen Excel/CSV dosyasını döner."""
    if not os.path.exists(SISTEM_EXCELI_DIR):
        return None
    files = [
        os.path.join(SISTEM_EXCELI_DIR, f)
        for f in os.listdir(SISTEM_EXCELI_DIR)
        if f.lower().endswith(('.xlsx', '.xls', '.csv'))
    ]
    if not files:
        return None
    files.sort(key=os.path.getmtime, reverse=True)
    return files[0]
