import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

def normalize_tr(text):
    if not text:
        return ""
    s = str(text).lower()
    tr_map = str.maketrans('çğıöşüi', 'cgiosui')
    s = s.translate(tr_map)
    return re.sub(r'[^a-z0-9]', ' ', s).strip()

def is_word_match(target_word, token):
    if target_word == token:
        return True
    # 'sut' araması 'sutas' ile eşleşmemeli!
    if token == 'sut' and target_word.startswith('sutas'):
        return False
    if target_word.startswith(token):
        # Kök/ek kontrolü: eğer token kısa ise (3 harf gibi) ve hedef kelime farklı bir kök ise eşleşmemeli
        if len(token) <= 3 and len(target_word) > 4:
            return False
        return True
    return False

def matches_product(query, product):
    q_norm = normalize_tr(query)
    q_tokens = q_norm.split()
    if not q_tokens:
        return True

    barcode = normalize_tr(product.get('barcode', ''))
    title = normalize_tr(product.get('title', '') or product.get('title1', ''))
    brand = normalize_tr(product.get('brand', ''))
    
    title_words = title.split()
    brand_words = brand.split()
    
    # Her arama kelimesi için:
    # 1. Ya barkod içinde geçmeli
    # 2. Ya da başlıktaki veya markadaki bir kelimeyle tam/kök eşleşmeli
    for tok in q_tokens:
        if tok in barcode:
            continue
            
        matched = False
        for w in title_words + brand_words:
            if is_word_match(w, tok):
                matched = True
                break
        if not matched:
            return False
            
    # Eğer çoklu kelime aranıyorsa (örn: 'sutas sut')
    # Eğer aramadaki kelimelerden biri ürün adında açıkça geçmiyorsa ele
    if len(q_tokens) > 1:
        for tok in q_tokens:
            if tok in barcode:
                continue
            # Bu token başlık veya markadaki bir kelimeyle eşleşiyor mu?
            if not any(is_word_match(w, tok) for w in title_words + brand_words):
                return False
                
        # Eğer sorguda spesifik bir ürün cinsi (süt, peynir, ayran, kaşar, yoğurt, yağ, salça vb.) aranıyorsa
        # bu cins başlıkta kesinlikle bulunmalıdır!
        CATEGORY_KEYWORDS = {'sut', 'peynir', 'kasar', 'suzme', 'ayran', 'yogurt', 'tereyag', 'kaymak', 'labne', 'lor', 'krema', 'cikolata', 'biskuvi', 'kek', 'gofret', 'kraker', 'cips', 'cay', 'kahve', 'seker', 'un', 'yag', 'salca', 'makarna', 'pirinc', 'bulgur', 'su', 'soda', 'gazoz', 'kola', 'meyvesuyu', 'deterjan', 'sabun', 'sampuan'}
        
        category_tokens = [tok for tok in q_tokens if tok in CATEGORY_KEYWORDS]
        for c_tok in category_tokens:
            # Başlıktaki kelimelerden en az biri bu kategori kelimesiyle tam/kök eşleşmeli
            has_cat = any(is_word_match(w, c_tok) for w in title_words)
            if not has_cat:
                return False
                
    return True

# Test cases
sample_products = [
    {"title": "SÜTAŞ TAM YAĞLI SÜT 1 LT", "brand": "SÜTAŞ", "barcode": "8690001"},
    {"title": "SÜTAŞ YARIM YAĞLI SÜT 200 ML", "brand": "SÜTAŞ", "barcode": "8690002"},
    {"title": "SÜTAŞ KAŞAR PEYNİRİ 400 GR", "brand": "SÜTAŞ", "barcode": "8690003"},
    {"title": "SÜTAŞ SÜZME PEYNİR 500 GR", "brand": "SÜTAŞ", "barcode": "8690004"},
    {"title": "SÜTAŞ AYRAN 200 ML", "brand": "SÜTAŞ", "barcode": "8690005"},
    {"title": "PINAR SÜT 1 LT", "brand": "PINAR", "barcode": "8690006"},
    {"title": "İÇİM SÜT 1 LT", "brand": "İÇİM", "barcode": "8690007"},
]

print("Arama: 'sütaş süt'")
for p in sample_products:
    m = matches_product("sütaş süt", p)
    print(f"  [{'✓ EŞLEŞTİ' if m else '✗ ELENDİ'}] {p['title']} ({p['brand']})")

print("\nArama: 'sütaş peynir'")
for p in sample_products:
    m = matches_product("sütaş peynir", p)
    print(f"  [{'✓ EŞLEŞTİ' if m else '✗ ELENDİ'}] {p['title']} ({p['brand']})")
