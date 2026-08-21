import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open("data/products.json", "r", encoding="utf-8") as f:
    products = json.load(f)

def normalize_tr_js(s):
    if not s:
        return ""
    char_map = {
        'İ': 'i', 'I': 'i', 'ı': 'i', 'i': 'i',
        'Ş': 's', 'ş': 's',
        'Ğ': 'g', 'ğ': 'g',
        'Ü': 'u', 'ü': 'u',
        'Ö': 'o', 'ö': 'o',
        'Ç': 'c', 'ç': 'c'
    }
    s = str(s)
    for k, v in char_map.items():
        s = s.replace(k, v)
    return s.lower()

SEARCH_CATEGORY_KEYWORDS = {
  'sut', 'peynir', 'kasar', 'suzme', 'ayran', 'yogurt', 'tereyag', 'kaymak', 'labne', 'lor', 'krema',
  'cikolata', 'biskuvi', 'kek', 'gofret', 'kraker', 'cips', 'cay', 'kahve', 'seker', 'un', 'yag',
  'salca', 'makarna', 'pirinc', 'bulgur', 'su', 'soda', 'gazoz', 'kola', 'meyvesuyu', 'deterjan',
  'sabun', 'sampuan', 'ekmek', 'yumurta', 'tavuk', 'helva', 'recel', 'bal', 'findik', 'fistik', 'ceviz'
}

def isTokenMatchingWord(target_word, tok):
    if target_word == tok:
        return True
    if tok == 'sut' and target_word.startswith('sutas'):
        return False
    if target_word.startswith(tok):
        if len(tok) <= 3 and len(target_word) > 4:
            return False
        return True
    return False

def checkProductMatchesSearch(p, searchTokens, normBarcode, normTitle, normBrand):
    if len(searchTokens) == 0:
        return True

    titleWords = [w for w in re.split(r'\s+', normTitle) if w]
    brandWords = [w for w in re.split(r'\s+', normBrand) if w]
    allWords = titleWords + brandWords

    for tok in searchTokens:
        if tok in normBarcode:
            continue

        matched = False
        for w in allWords:
            if isTokenMatchingWord(w, tok):
                matched = True
                break
        if not matched:
            return False

    if len(searchTokens) > 1:
        for tok in searchTokens:
            if tok in SEARCH_CATEGORY_KEYWORDS:
                hasCategory = any(isTokenMatchingWord(w, tok) for w in titleWords)
                if not hasCategory:
                    return False

    return True

# Test "doğanay şalgam"
raw_search = "doğanay şalgam"
norm_search = normalize_tr_js(raw_search).strip()
search_tokens = [tok for tok in re.split(r'\s+', norm_search) if tok]

print(f"Arama Tokens: {search_tokens}")

matched_products = []
for p in products:
    norm_title = normalize_tr_js(p.get("title") or p.get("title1") or "")
    norm_barcode = normalize_tr_js(p.get("barcode") or "")
    norm_brand = normalize_tr_js(p.get("brand") or "")
    
    if checkProductMatchesSearch(p, search_tokens, norm_barcode, norm_title, norm_brand):
        matched_products.append(p)

print(f"\nBulunan Ürün Sayısı: {len(matched_products)}")
for p in matched_products:
    print(f"  - {p['title']} (Marka: {p['brand']})")
