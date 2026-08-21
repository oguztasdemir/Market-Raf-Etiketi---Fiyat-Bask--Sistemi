# -*- coding: utf-8 -*-
"""
Türkçe Karakter Tamiri, Ürün Başlığı Normalizasyonu, Barkod Temizleme, Fiyat Formatlayıcı ve Arama Skoru
"""
import re
import datetime

WORD_REPLACEMENTS = {
    'SARIYER': 'SARIYER',
    'sarıyer': 'SARIYER',
    'ETİ': 'ETİ',
    'eti': 'ETİ',
    'ÜLKER': 'ÜLKER',
    'ülker': 'ÜLKER',
    'PAREX': 'PAREX',
    'parex': 'PAREX',
    'LÜKS': 'LÜKS',
    'lüks': 'LÜKS',
    'Lüks': 'Lüks',
    'lğks': 'lüks',
    'JELİBONEĞLENCELİ': 'JELİBON EĞLENCELİ',
    'TUVALETKAĞIDI': 'TUVALET KAĞIDI',
    'TAMBUĞDAY': 'TAM BUĞDAY',
    'BAYRAMLIKBONBON': 'BAYRAMLIK BONBON',
    'RASPİBERRY': 'RASPBERRY',
    'ESKTRA': 'EKSTRA',
}

EXCEPTIONS = {
    'GRİSSİNİ', 'GRISSINI', 'GRAM', 'GRAHAM', 'GRANÜL', 'GRANUL', 'GRANÜLLÜ', 'GRANULLU', 
    'ADANA', 'ADET', 'ADETLİ', 'ADETLI', 'ADRES', 'ADIDAS', 'ADMIN', 'ADAPTOR',
    'KREMA', 'KREMALI', 'KRAKER', 'KREM', 'KREMLİ', 'KREMLI',
    'KLASİK', 'KLASIK', 'KLOZET', 'KLOR', 'KLORAK', 'KLORLU',
    'CCM', 'CCC'
}

TURKISH_WORD_DICTIONARY = {
    'BO?AZ??': 'BOĞAZİÇİ', 'BO?AZ?Ç?': 'BOĞAZİÇİ', 'BOAZ': 'BOĞAZİÇİ', 'BOĞAZİÇİ': 'BOĞAZİÇİ',
    '?ER?': 'ÇERİ', 'ER?': 'ÇERİ', 'ENGELK?Y': 'ÇENGELKÖY', 'ENGELKY': 'ÇENGELKÖY',
    '?ENGELK?Y': 'ÇENGELKÖY', 'SO?AN': 'SOĞAN', '?Z?M': 'ÜZÜM', 'ZM': 'ÜZÜM',
    'L?MON': 'LİMON', 'S?VR?': 'SİVRİ', '?EFTAL?': 'ŞEFTALİ', 'EFTAL': 'ŞEFTALİ',
    'MEKS?KA': 'MEKSİKA', 'KIRKA?A?': 'KIRKAĞAÇ', 'KIRKA?A': 'KIRKAĞAÇ',
    'L?X': 'LÜKS', '?NC?R': 'İNCİR', 'SALATAL?K': 'SALATALIK',
    'YE??L': 'YEŞİL', 'EK??': 'EKŞİ', '?EK?RDEKS?Z': 'ÇEKİRDEKSİZ',
    'DOLMA': 'DOLMA', 'G?BEK': 'GÖBEK', 'GBEK': 'GÖBEK',
    '?EKER': 'ŞEKER', 'EKER': 'ŞEKER', '?AH?N': 'ŞAHİN', '?AH?NO?LU': 'ŞAHİNOĞLU',
    '?AHBAZ': 'ŞAHBAZ', 'ERZ?NCAN': 'ERZİNCAN', 'N??ASTA': 'NİŞASTA',
    'N??ASTASI': 'NİŞASTASI', 'D?KME': 'DÖKME', '?ORBA': 'ÇORBA', 'ORBA': 'ÇORBA',
    'BROKOL?': 'BROKOLİ', 'KEREV?Z': 'KEREVİZ', 'K?RAZ': 'KİRAZ', 'B?GA': 'BİGA',
    '?AY': 'ÇAY', 'AY': 'ÇAY', 'AYKUR': 'ÇAYKUR', '?AYKUR': 'ÇAYKUR',
    '?LEN': 'ŞÖLEN', 'LEN': 'ŞÖLEN', '?KOLATA': 'ÇİKOLATA', 'IKOLATA': 'ÇİKOLATA',
    '?KOLATALI': 'ÇİKOLATALI', 'IKOLATALI': 'ÇİKOLATALI',
    '?OKONAT': 'ÇOKONAT', 'OKONAT': 'ÇOKONAT', '?OKOKREM': 'ÇOKOKREM',
    '?OKOPRENS': 'ÇOKOPRENS', '?OKOSANDV?': 'ÇOKOSANDVİÇ', '?OKOTURTA': 'ÇOKOTURTA',
    '?OKOMEL': 'ÇOKOMEL', '?ITIR': 'ÇITIR', 'ITIR': 'ÇITIR', '?LEK': 'ÇİLEK',
    'LEK': 'ÇİLEK', '?LEKL?': 'ÇİLEKLİ', 'LEKL': 'ÇİLEKLİ', '?Z?': 'ÇİZİ',
    '?Z?V??': 'ÇİZİVİÇ', '?Z?K': 'ÇİZİK', '?FTL???': 'ÇİFTLİĞİ',
    'C?FTL?K': 'ÇİFTLİK', 'S?TA?': 'SÜTAŞ', 'STA?': 'SÜTAŞ', 'SUTA?': 'SÜTAŞ',
    '??M': 'İÇİM', 'IC?M': 'İÇİM',
    'S?PERFRESH': 'SÜPERFRESH', 'SPERFRESH': 'SÜPERFRESH',
    'G?NAYDIN': 'GÜNAYDIN', 'GNAYDIN': 'GÜNAYDIN', 'B?LLUR': 'BİLLUR',
    'B?Z?M': 'BİZİM', 'PEYN?R': 'PEYNİR', 'KA?AR': 'KAŞAR', 'YO?URT': 'YOĞURT',
    'S?ZME': 'SÜZME', 'SZME': 'SÜZME', 'S?T': 'SÜT', 'ST': 'SÜT',
    'L?PTON': 'LİPTON', 'B?SCOLATA': 'BİSCOLATA', 'DOR?TOS': 'DORİTOS',
    'C?PS': 'CİPS', 'C?PSO': 'CİPSO', 'L?FAL?F': 'LİFALİF', 'NESF?T': 'NESFİT',
    'ALG?DA': 'ALGİDA', 'M?N?': 'MİNİ', 'FRUTT?': 'FRUTTİ', 'MEYVEL?M': 'MEYVELİM',
    'MEYVEL?': 'MEYVELİ', 'TR?O': 'TRİO', 'TR?OMOVE': 'TRİOMOVE', 'H?B?SKUS': 'HİBİSKUS',
    'B?RTLEN': 'BÖĞÜRTLEN', 'BOGURTLEN': 'BÖĞÜRTLEN', 'B?SK?V?': 'BİSKÜVİ',
    'B?SKUV?': 'BİSKÜVİ', 'FISTI?I': 'FISTIĞI', 'FISTII': 'FISTIĞI',
    'YA?I': 'YAĞI', 'YAI': 'YAĞI', 'TEREMYA?': 'TEREMYAĞ', 'BUZDA?I': 'BUZDAĞI',
    'ULUDA?': 'ULUDAĞ', 'PO?ET?': 'POŞETİ', 'D?D?': 'DİDİ', 'KARI?IK': 'KARIŞIK',
    'A?DA': 'AĞDA', 'P?L??': 'PİLİÇ', 'P?L?C': 'PİLİÇ', 'P?L?': 'PİLİÇ',
    'K?FTE': 'KÖFTE', 'KFTE': 'KÖFTE', 'D?NER': 'DÖNER', 'DNER': 'DÖNER',
    'B?Y?K': 'BÜYÜK', 'BYK': 'BÜYÜK', 'K???K': 'KÜÇÜK', 'KK': 'KÜÇÜK',
    'HAVU?': 'HAVUÇ', 'HAVU': 'HAVUÇ', 'ER?K': 'ERİK', 'KAPYA': 'KAPYA',
    'CEZERYE': 'CEZERYE', 'SARMA': 'SARMA', 'PATLAYAN': 'PATLAYAN',
    'MARSHMALLOW': 'MARSHMALLOW', 'MARSHMELLOW': 'MARSHMALLOW',
    'T?RK?YE': 'TÜRKİYE', 'TRK?YE': 'TÜRKİYE', 'TRKYE': 'TÜRKİYE',
    '?APANO?LU': 'ÇAPANOĞLU', 'APANO?LU': 'ÇAPANOĞLU', 'APANO': 'ÇAPANOĞLU',
    '?AHBAZ': 'ŞAHBAZ', 'S?GARA': 'SİGARA', 'SGARA': 'SİGARA',
    'MARLBORO': 'MARLBORO', 'PARLIAMENT': 'PARLIAMENT', 'PARLA?MENT': 'PARLIAMENT',
    'WINSTON': 'WINSTON', 'CAMEL': 'CAMEL', 'ROTHMANS': 'ROTHMANS',
    'CHESTERFIELD': 'CHESTERFIELD', 'MONTE': 'MONTE', 'CARLO': 'CARLO',
    'KENT': 'KENT', 'MURATTI': 'MURATTI', 'LARK': 'LARK', 'PRES?DENT': 'PRESIDENT',
    'W?NNER': 'WINNER', 'HD': 'HD', 'SL?MS': 'SLIMS', 'SL?M': 'SLIM',
    'SLENDER': 'SLENDER', 'SELENDER': 'SLENDER', 'DRANGE': 'D-RANGE',
    'D?L?M': 'DİLİM', 'D?L?ML?': 'DİLİMLİ', 'DILIM': 'DİLİM', 'DILIMLI': 'DİLİMLİ'
}

def fix_corrupted_turkish_text(text: str) -> str:
    """Excel / CSV kaynaklı bozuk Türkçe karakterleri (? ve OEM artıkları) onarır."""
    if not text or not isinstance(text, str):
        return ""
    s = str(text).strip()
    s = s.replace('\ufffd', '?')

    tokens = s.split(' ')
    cleaned_tokens = []
    for t in tokens:
        clean_t = t.strip(';:,.-_')
        lead = t[:len(t)-len(t.lstrip(';:,.-_'))]
        trail = t[len(t.rstrip(';:,.-_')):]
        upper_t = clean_t.upper()
        
        if upper_t in TURKISH_WORD_DICTIONARY:
            cleaned_tokens.append(lead + TURKISH_WORD_DICTIONARY[upper_t] + trail)
        else:
            temp = clean_t
            if temp.startswith('?'):
                temp = 'Ş' + temp[1:]
            temp = re.sub(r'([A-ZĞÜŞİÖÇa-zğüşıöç])\?([A-ZĞÜŞİÖÇa-zğüşıöç])', r'\1İ\2', temp)
            temp = re.sub(r'([A-ZĞÜŞİÖÇa-zğüşıöç])\?$', r'\1İ', temp)
            temp = temp.replace('?', '').replace('', '')
            cleaned_tokens.append(lead + temp + trail)

    res = ' '.join(cleaned_tokens)
    return re.sub(r'\s+', ' ', res).strip()

def clean_product_title(s: str) -> str:
    """Yeni eklenen ürünlerin başlıklarını otomatik normalize eder ve bozuk karakterleri düzeltir."""
    if not s or not isinstance(s, str):
        return str(s or '').strip()
    
    s = fix_corrupted_turkish_text(s)
    s = s.replace('\xa0', ' ').replace('\t', ' ').replace('\r', ' ').replace('\n', ' ')
    for k, v in WORD_REPLACEMENTS.items():
        s = s.replace(k, v)
        
    def split_unit_word(m):
        prefix = m.group(1) or ''
        num = m.group(2)
        unit = m.group(3).upper()
        word = m.group(4)
        if (unit + word).upper() in EXCEPTIONS or word.upper() in EXCEPTIONS:
            return m.group(0)
        return f"{prefix}{num} {unit} {word}"

    s = re.sub(r'(^|\s|X|x)(\d+(?:[.,]\d+)?)\s*(GR|KG|LT|ML|CL|CC)([A-ZĞÜŞİÖÇa-zğüşıöç]{2,})', split_unit_word, s, flags=re.IGNORECASE)

    def split_num_unit(m):
        prefix = m.group(1) or ''
        num = m.group(2)
        unit = m.group(3).upper()
        if unit == 'G': unit = 'GR'
        elif unit == 'L': unit = 'LT'
        return f"{prefix}{num} {unit}"

    s = re.sub(r'(^|\s|X|x)(\d+(?:[.,]\d+)?)\s*(GR|KG|LT|ML|CL|CC|G|L)\b', split_num_unit, s, flags=re.IGNORECASE)
    s = re.sub(r'([A-ZĞÜŞİÖÇa-zğüşıöç]{2,})(\d+)\b', r'\1 \2', s)
    s = re.sub(r'\s+([,\.\:\;\!\?])', r'\1', s)
    s = re.sub(r'([,])([^\s\d])', r'\1 \2', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s

def clean_barcode(val) -> str:
    """Barkodları daima temiz, sayısal ve standart formata dönüştürür (8690556205015,00 -> 8690556205015)."""
    if not val:
        return ""
    s = str(val).strip()
    
    # Sondaki ,00 veya .00 veya ,0 veya .0 temizle
    if s.endswith(',00') or s.endswith('.00'):
        s = s[:-3]
    elif s.endswith(',0') or s.endswith('.0'):
        s = s[:-2]
    elif ',' in s:
        parts = s.split(',')
        if len(parts) == 2 and parts[1].isdigit() and int(parts[1]) == 0:
            s = parts[0]
    elif '.' in s:
        parts = s.split('.')
        if len(parts) == 2 and parts[1].isdigit() and int(parts[1]) == 0:
            s = parts[0]

    # Üstel / Bilimsel gösterim kontrolü (örn. 8,69056E+12 veya 8.69056E+12)
    s_norm = s.replace(',', '.')
    if re.match(r'^[+-]?\d+(?:\.\d+)?[eE][+-]?\d+$', s_norm):
        try:
            f_val = float(s_norm)
            s = f"{int(round(f_val))}"
        except Exception:
            pass
    return s.strip()

def parse_price_val(p_str) -> float:
    """Fiyat metnini (örn. '125,50 TL') float değere çevirir."""
    if p_str is None:
        return 0.0
    s = str(p_str).replace('TL', '').replace('tl', '').replace('₺', '').replace(' ', '').strip()
    if not s:
        return 0.0

    if '.' in s and ',' in s:
        last_comma = s.rfind(',')
        last_dot = s.rfind('.')
        if last_comma > last_dot:
            s = s[:last_comma].replace('.', '').replace(',', '') + '.' + s[last_comma+1:]
        else:
            s = s[:last_dot].replace(',', '').replace('.', '') + '.' + s[last_dot+1:]
    elif s.count(',') > 1:
        last_comma = s.rfind(',')
        s = s[:last_comma].replace(',', '') + '.' + s[last_comma+1:]
    elif s.count('.') > 1:
        last_dot = s.rfind('.')
        s = s[:last_dot].replace('.', '') + '.' + s[last_dot+1:]
    elif ',' in s:
        s = s.replace(',', '.')

    try:
        return float(s)
    except Exception:
        return 0.0

def format_price_display(val) -> str:
    """Fiyat değerini standart '125,50 TL' formatına dönüştürür."""
    if val is None or val == "":
        return ""
    f = parse_price_val(val)
    if f > 0 or str(val).strip() in ['0', '0 TL', '0,00', '0,00 TL']:
        return f"{f:.2f} TL".replace('.', ',')
    s = str(val).strip().replace('.', ',')
    if not (s.endswith('TL') or s.endswith('tl')):
        s += " TL"
    return s

def normalize_header_name(s: str) -> str:
    """Excel başlıklarını standart Türkçe temiz formatına çevirir."""
    if s is None:
        return ""
    s = str(s).strip().lower()
    s = s.replace('ç', 'c').replace('ğ', 'g').replace('ı', 'i').replace('ö', 'o').replace('ş', 's').replace('ü', 'u')
    s = s.replace('?', '').replace(' ', '').replace('_', '').replace('.', '').replace('-', '')
    return s

def normalize_search_text(text: str) -> str:
    """Arama motoru için kusursuz Türkçe metin normalizasyonu."""
    if not text:
        return ""
    s = str(text).replace('İ', 'i').replace('I', 'i').replace('ı', 'i').lower()
    s = s.replace('\u0307', '')
    tr_map = str.maketrans({
        'ç': 'c', 'ğ': 'g', 'ö': 'o', 'ş': 's', 'ü': 'u', 'ı': 'i', 'i': 'i'
    })
    s = s.translate(tr_map)
    return re.sub(r'[^a-z0-9]', ' ', s).strip()

SEARCH_CATEGORY_KEYWORDS = {
    'sut', 'peynir', 'kasar', 'suzme', 'ayran', 'yogurt', 'tereyag', 'kaymak', 'labne', 'lor', 'krema',
    'cikolata', 'biskuvi', 'kek', 'gofret', 'kraker', 'cips', 'cay', 'kahve', 'seker', 'un', 'yag',
    'salca', 'makarna', 'pirinc', 'bulgur', 'su', 'soda', 'gazoz', 'kola', 'meyvesuyu', 'deterjan',
    'sabun', 'sampuan', 'ekmek', 'yumurta', 'tavuk', 'helva', 'recel', 'bal', 'findik', 'fistik', 'ceviz'
}

def is_word_match(target_word: str, token: str) -> bool:
    if not target_word or not token:
        return False
    if target_word == token:
        return True
    if token == 'sut' and target_word.startswith('sutas'):
        return False
    if target_word.startswith(token):
        return True
    if len(token) >= 3 and token in target_word:
        return True
    return False

def score_product_match(query: str, product: dict) -> float:
    """Ürün arama alaka puanı hesaplar."""
    if not query or not product:
        return 0.0
    
    q_norm = normalize_search_text(query)
    q_words = q_norm.split()
    if not q_words:
        return 0.0

    barcode = normalize_search_text(product.get('barcode', ''))
    if query.strip() == str(product.get('barcode', '')).strip():
        return 100.0
    if query.strip() in barcode:
        return 80.0

    title = normalize_search_text(product.get('title', '') or product.get('title1', ''))
    brand = normalize_search_text(product.get('brand', ''))
    
    title_words = title.split()
    brand_words = brand.split()
    all_words = title_words + brand_words

    for tok in q_words:
        if tok in barcode:
            continue
        if not any(is_word_match(w, tok) for w in all_words):
            return 0.0

    if 'sut' in q_words:
        if not any(is_word_match(w, 'sut') for w in title_words):
            return 0.0

    if q_norm == title:
        return 95.0
    if title.startswith(q_norm):
        return 85.0

    return 70.0 + (len(q_norm) / (len(title) + 1) * 10)

def get_online_or_system_date() -> str:
    """Etiket tarihi için sistem tarihini formatlar (Örn: 20 Ağu 2026)."""
    months_tr = {
        1: "Oca", 2: "Şub", 3: "Mar", 4: "Nis", 5: "May", 6: "Haz",
        7: "Tem", 8: "Ağu", 9: "Eyl", 10: "Eki", 11: "Kas", 12: "Ara"
    }
    now = datetime.datetime.now()
    return f"{now.day:02d} {months_tr.get(now.month, '')} {now.year}"

def get_online_or_system_datetime() -> str:
    """Katalog değişme ve basım tarihi için güncel tarih ve saati formatlar (Örn: 20 Ağu 2026 16:18)."""
    months_tr = {
        1: "Oca", 2: "Şub", 3: "Mar", 4: "Nis", 5: "May", 6: "Haz",
        7: "Tem", 8: "Ağu", 9: "Eyl", 10: "Eki", 11: "Kas", 12: "Ara"
    }
    now = datetime.datetime.now()
    return f"{now.day:02d} {months_tr.get(now.month, '')} {now.year} {now.strftime('%H:%M')}"
