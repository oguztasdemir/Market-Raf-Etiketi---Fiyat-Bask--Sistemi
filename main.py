"""
Termal Market Raf Etiketi Yazıcı Sunucusu (Ana Başlatıcı)
Masaüstü Panel + Mobil Barkod Terminali + Şablon Tasarımcısı
"""
import os
import sys
import json
import time
import signal
import socket
import logging
import webbrowser
import subprocess
import shutil
from flask import Flask, jsonify, request, send_from_directory, render_template, send_file

# Gereksiz GET/POST 200 HTTP loglarını sustur (Sadece Hatalar ve Özel Mesajlar)
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

import math
import datetime
import re
import csv
import openpyxl

# Modüler kaynakları içeri aktar
from src.zpl_generator import generate_market_shelf_zpl, clean_tr, get_online_or_system_date, MONTHS_TR
from src.printer_service import (
    get_connected_usb_devices,
    get_windows_printers,
    print_raw_zpl,
    purge_printer_queue
)

# Mutlak dizin yolları
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
STATIC_DIR = os.path.join(BASE_DIR, "static")
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

SISTEM_EXCELI_DIR = os.path.join(DATA_DIR, "sistem_exceli")
os.makedirs(SISTEM_EXCELI_DIR, exist_ok=True)

BACKUPS_DIR = os.path.join(DATA_DIR, "backups")
os.makedirs(BACKUPS_DIR, exist_ok=True)

PRODUCTS_FILE = os.path.join(DATA_DIR, "products.json")
BLACKLIST_FILE = os.path.join(DATA_DIR, "black_list.json")
TEMPLATES_FILE = os.path.join(DATA_DIR, "templates.json")
SETTINGS_FILE = os.path.join(DATA_DIR, "settings.json")
DRAFT_CACHE_FILE = os.path.join(DATA_DIR, "draft_cache.json")

def create_products_backup(reason: str = "Otomatik Güncelleme Öncesi") -> str:
    """products.json dosyasının zaman damgalı güvenli yedeğini alır."""
    if not os.path.exists(PRODUCTS_FILE):
        return ""
    now_str = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    filename = f"products_backup_{now_str}.json"
    dest = os.path.join(BACKUPS_DIR, filename)
    try:
        shutil.copy2(PRODUCTS_FILE, dest)
        meta = {
            "filename": filename,
            "created_at": datetime.datetime.now().strftime("%d %b %Y %H:%M:%S"),
            "reason": reason,
            "size": os.path.getsize(dest)
        }
        save_json(dest + ".meta", meta)
        return filename
    except Exception as e:
        print(f"Yedekleme hatası: {e}")
        return ""

# Flask uygulaması
app = Flask(
    __name__,
    template_folder=TEMPLATES_DIR,
    static_folder=STATIC_DIR,
    static_url_path="/static"
)

def get_local_ip():
    """Bilgisayarın yerel ağ IP adresini (192.168.x.x vb.) tespit eder."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

# --- JSON Yardımcıları ---
def load_json(filepath, default_data):
    if os.path.exists(filepath):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return default_data
    return default_data

def save_json(filepath, data):
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"[HATA] JSON kaydetme başarısız: {e}")
        return False

def load_settings():
    return load_json(SETTINGS_FILE, {})

def save_settings(data):
    return save_json(SETTINGS_FILE, data)


@app.after_request
def add_cors_headers(response):
    """CORS desteği: Mobil ve tarayıcı kaynaklarına tam izin verir."""
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS, DELETE"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response

@app.route("/api/print/send", methods=["OPTIONS"])
@app.route("/api/print/batch", methods=["OPTIONS"])
@app.route("/api/devices", methods=["OPTIONS"])
@app.route("/api/preview/zpl", methods=["OPTIONS"])
@app.route("/api/products", methods=["OPTIONS"])
@app.route("/api/templates", methods=["OPTIONS"])
@app.route("/api/settings", methods=["OPTIONS"])
@app.route("/api/cache/draft", methods=["OPTIONS"])
@app.route("/api/catalog/upload-excel", methods=["OPTIONS"])
@app.route("/api/catalog/sync-status", methods=["OPTIONS"])
@app.route("/api/catalog/apply-sync", methods=["OPTIONS"])
@app.route("/api/blacklist", methods=["OPTIONS"])
@app.route("/api/blacklist/add", methods=["OPTIONS"])
def handle_options():
    return "", 200

# --- Web Sayfaları ---
@app.route("/")
@app.route("/index.html")
def index():
    """Ana Masaüstü Yönetim ve Tasarım Paneli."""
    return send_from_directory(TEMPLATES_DIR, "index.html")

@app.route("/mobile")
@app.route("/mobile.html")
def mobile():
    """Mobil Kamera Barkod Okuma ve Hızlı Yazdırma Terminali."""
    return send_from_directory(TEMPLATES_DIR, "mobile.html")

# --- API Endpointleri ---

@app.route("/api/network/ip", methods=["GET"])
def api_network_ip():
    """Mobil cihazların bağlanabilmesi için yerel ağ adresini döner."""
    ip = get_local_ip()
    port = 5000
    mobile_url = f"http://{ip}:{port}/mobile"
    return jsonify({
        "status": "success",
        "ip": ip,
        "port": port,
        "mobile_url": mobile_url
    })

@app.route("/api/current-date", methods=["GET"])
def api_current_date():
    """İnternetten güncel tarihi döner."""
    from src.zpl_generator import get_online_or_system_date
    current_d = get_online_or_system_date()
    return jsonify({"status": "success", "date": current_d})

@app.route("/api/devices", methods=["GET"])
def api_devices():
    """Bağlı USB donanımını ve yazıcı kuyruklarını listeler."""
    usb_devices = get_connected_usb_devices()
    printers = get_windows_printers()
    settings = load_json(SETTINGS_FILE, {})
    default_p = settings.get("printer") or (printers[0] if printers else "Termal Etiket Yazici")
    return jsonify({
        "status": "success",
        "usb_connected": len(usb_devices) > 0,
        "usb_devices": usb_devices,
        "printers": printers,
        "default_printer": default_p
    })

# --- Ürün & Stok API (Sade: Barkod, Ürün Adı, Fiyat) ---
@app.route("/api/products", methods=["GET"])
def api_products_get_all():
    """Tüm kayıtlı ürünleri listeler."""
    products = load_json(PRODUCTS_FILE, [])
    return jsonify({"status": "success", "products": products})

@app.route("/api/blacklist", methods=["GET"])
def api_blacklist_get_all():
    """Kara listedeki (katalog dışı / manav / silinmiş) ürünleri listeler."""
    blacklist = load_json(BLACKLIST_FILE, [])
    return jsonify({"status": "success", "blacklist": blacklist, "count": len(blacklist)})

@app.route("/api/blacklist/add", methods=["POST"])
def api_blacklist_add():
    """Yeni bir ürünü kara listeye ekler."""
    data = request.json or {}
    barcode = str(data.get("barcode") or "").strip()
    title = str(data.get("title") or "").strip()
    if not barcode:
        return jsonify({"status": "error", "message": "Barkod zorunludur."}), 400

    blacklist = load_json(BLACKLIST_FILE, [])
    for b in blacklist:
        if str(b.get("barcode")).strip() == barcode:
            return jsonify({"status": "success", "message": "Ürün zaten kara listede.", "blacklist": blacklist})

    blacklist.append({"barcode": barcode, "title": title})
    save_json(BLACKLIST_FILE, blacklist)
    return jsonify({"status": "success", "message": f"{barcode} kara listeye eklendi.", "blacklist": blacklist})

# --- KATALOG SENKRONİZASYON & EXCEL DİFF FONKSİYONLARI ---

WORD_REPLACEMENTS = {
    'LĞKS': 'LÜKS',
    'Lğks': 'Lüks',
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

def parse_price_val(p_str) -> float:
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
    if val is None or val == "":
        return ""
    f = parse_price_val(val)
    if f > 0 or str(val).strip() in ['0', '0 TL', '0,00', '0,00 TL']:
        return f"{f:.2f} TL".replace('.', ',')
    s = str(val).strip().replace('.', ',')
    if not (s.endswith('TL') or s.endswith('tl')):
        s += " TL"
    return s

def normalize_header_name(s) -> str:
    if s is None:
        return ""
    s = str(s).strip().lower()
    tr_map = str.maketrans("çğıöşüiı", "cgiosuii")
    s = s.translate(tr_map)
    s = re.sub(r'[^a-z0-9]', '', s)
    return s

def detect_stock_column_indices(headers: list) -> tuple:
    stok_idx, barkod_idx, title_idx, price_idx = None, None, None, None
    for i, h in enumerate(headers):
        nh = normalize_header_name(h)
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

    if stok_idx is None:
        stok_idx = 0
    if barkod_idx is None:
        barkod_idx = 1 if len(headers) > 1 else 0
    if title_idx is None:
        title_idx = 5 if len(headers) > 5 else (2 if len(headers) > 2 else 0)
    if price_idx is None:
        price_idx = 6 if len(headers) > 6 else (3 if len(headers) > 3 else 0)

    return stok_idx, barkod_idx, title_idx, price_idx

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
    if 'E+' in s.upper() or 'E-' in s.upper() or ('E' in s.upper() and any(c.isdigit() for c in s)):
        try:
            f_val = float(s.replace(',', '.'))
            s = f"{int(round(f_val))}"
        except Exception:
            pass
    return s.strip()

KNOWN_BRANDS_LIST = [
    'ÜLKER', 'ETİ', 'SÜTAŞ', 'PINAR', 'TORKU', 'DOĞUŞ', 'ÇAYKUR', 'LİPTON', 'COCA COLA', 'PEPSI',
    'DİDİ', 'FRUKO', 'YEDİGÜN', 'NESTLE', 'DANONE', 'EKER', 'İÇİM', 'SEK', 'TAT', 'TAMEK', 'CALVE',
    'KNORR', 'BİZİM', 'YUDUM', 'KOMİLİ', 'KRİSTAL', 'ÖNCÜ', 'BURCU', 'DARDANEL', 'ŞAHİN', 'NAMET',
    'BAŞYAZICI', 'ÇAPANOĞLU', 'POLONEZ', 'CUMHURİYET', 'TADIM', 'PEYMAN', 'LAYS', 'DORITOS', 'RUFFLES',
    'ÇEREZZA', 'CİPSO', 'PATOS', 'HARIBO', 'BEBETO', 'JELİBON', 'FALIM', 'VİVİDENT', 'FIRST', 'MENTOS',
    'OLIPS', 'KENT', 'ŞÖLEN', 'BİSCOLATA', 'ELİDOR', 'PANTENE', 'HEAD&SHOULDERS', 'CLEAR', 'BLENDAX',
    'İPEK', 'HACISAKİR', 'DALİN', 'DOVE', 'PALMOLIVE', 'DURU', 'NIVEA', 'ARKO', 'COLGATE', 'SIGNAL',
    'IPANA', 'SENSODYNE', 'ORAL-B', 'FAIRY', 'PRIL', 'DOMESTOS', 'CIF', 'ACE', 'BREF', 'MR.MUSCLE',
    'PERSIL', 'ARIEL', 'OMO', 'ALO', 'TURSIL', 'BİNGO', 'YUMOŞ', 'VERNEL', 'PERWOLL', 'SLEEPY',
    'PRIMA', 'CANBEBE', 'MOLFİX', 'ORKİD', 'KOTEX', 'MOLPED', 'SELPAK', 'SOLO', 'FAMILIA', 'PAPIA',
    'MAYLO', 'TENO', 'BEYPAZARI', 'KINIK', 'KIZILAY', 'SARIKIZ', 'SIRMA', 'FREŞA', 'ULUDAĞ', 'DAMLA',
    'HAYAT', 'ERİKLİ', 'BOĞAZİÇİ', 'EYÜP SABRİ TUNCER', 'PEREJA', 'SELİN', 'MARLBORO', 'PARLIAMENT',
    'WINSTON', 'CAMEL', 'ROTHMANS', 'CHESTERFIELD', 'MONTE CARLO', 'MURATTI', 'LARK', 'PRESIDENT',
    'WINNER', 'HD', 'SUPERFRESH', 'SÜPERFRESH', 'GÜNAYDIN', 'BİLLUR', 'DR.OETKER', 'PAŞABAHÇE',
    'LAV', 'PAREX', 'VILEDA', 'KOROPLAST', 'DURACELL', 'PANASONIC', 'PHILIPS', 'BIC', 'TOBLERONE',
    'MILKA', 'NUTELLA', 'FERRERO', 'KINDER', 'RAFFAELLO', 'SNICKERS', 'TWIX', 'BOUNTY', 'MARS',
    'M&M', 'SKITTLES', 'PRINGLES', 'MAGNUM', 'CORNETTO', 'CORNY', 'NESCAFE', 'JACOBS',
    'MEHMET EFENDİ', 'KAHVEDÜNYASI', 'OFÇAY', 'DOĞADAN', 'BALPARMAK', 'ANAVARZA', 'KOSKA',
    'SEYİDOĞLU', 'SEYYİDOĞLU', 'HAZAR', 'ŞAHBAZ', 'ALBİ', 'ALBENİ', 'ÇOKONAT', 'HALLEY', 'HANIMELLER',
    'RONDO', 'BİSKREM', 'CANPASTA', 'BURÇAK', 'TUTKU', 'BENİMO', 'CRAX', 'POPCORN', 'GONG', 'FORM',
    'LİFALİF', 'KOMBO', 'CİCİBEBE', 'CİCİ BEBE', 'PETİBÖR', 'FİTPO', 'KROKAN', 'LUPPO', 'OZMO', 'BOOMBASTIC'
]

def detect_brand_from_title(title: str, existing_products: list = None) -> str:
    """Ürün başlığından markayı otomatik olarak tespit eder."""
    if not title or not isinstance(title, str):
        return None
    
    clean_t = clean_product_title(title).upper()

    # Manav veya tartılı ürün kontrolü
    if clean_t.startswith('MNV ') or clean_t.startswith('MANAV '):
        return 'MANAV'
    
    # Tütün / Sigara grubu
    if clean_t.startswith('SİGARA ') or clean_t.startswith('SGARA '):
        for tb in ['MARLBORO', 'PARLIAMENT', 'WINSTON', 'CAMEL', 'ROTHMANS', 'CHESTERFIELD', 'MONTE CARLO', 'MURATTI', 'LARK', 'PRESIDENT', 'WINNER', 'HD', 'KENT']:
            if tb in clean_t:
                return tb
        return 'TÜTÜN'

    # Veritabanındaki bilinen tüm markaları dinamik topla
    all_brands = set(KNOWN_BRANDS_LIST)
    if existing_products:
        for p in existing_products:
            b = (p.get('brand') or '').strip().upper()
            if b and b not in ['DİĞER', 'DIGER', '-', 'YARENLER', 'TURKİYE', 'TÜRKİYE']:
                all_brands.add(b)

    # Uzunluklarına göre sırala (Örn. 'EYÜP SABRİ TUNCER' önce, 'EYÜP' sonra eşleşsin)
    sorted_brands = sorted(list(all_brands), key=lambda x: len(x), reverse=True)

    for b in sorted_brands:
        if len(b) <= 3:
            pattern = r'\b' + re.escape(b) + r'\b'
            if re.search(pattern, clean_t):
                return b
        else:
            if b in clean_t:
                return b

    return None

def read_stock_rows_from_file(file_path: str) -> list:
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
        any(k in nh for k in ['stok', 'barkod', 'cins', 'fiyat', 'urun', 'price', 'code'])
        for nh in first_nh
    )

    data_rows = raw_rows[1:] if has_header else raw_rows

    parsed = []
    for r in data_rows:
        raw_stok = str(r[stok_idx] if stok_idx < len(r) and r[stok_idx] is not None else '').strip()
        raw_barkod = str(r[barkod_idx] if barkod_idx < len(r) and r[barkod_idx] is not None else '').strip()
        title = str(r[title_idx] if title_idx < len(r) and r[title_idx] is not None else '').strip()
        price_raw = r[price_idx] if price_idx < len(r) else None

        stok_kodu = clean_barcode(raw_stok)
        barkod = clean_barcode(raw_barkod)

        is_sci = ('E+' in raw_barkod.upper() or 'E-' in raw_barkod.upper() or 'E+' in raw_stok.upper())

        parsed.append({
            'stok_kodu': stok_kodu,
            'barkod': barkod,
            'raw_code': raw_barkod or raw_stok,
            'is_scientific': is_sci,
            'title': title,
            'price_raw': price_raw
        })

    return parsed

def get_latest_excel_path() -> str:
    """data/sistem_exceli klasöründeki en güncel excel/csv dosyasını bulur."""
    if not os.path.exists(SISTEM_EXCELI_DIR):
        return ""
    valid_exts = ('.xlsx', '.xls', '.csv')
    files = [
        os.path.join(SISTEM_EXCELI_DIR, f)
        for f in os.listdir(SISTEM_EXCELI_DIR)
        if f.lower().endswith(valid_exts) and not f.startswith('~$')
    ]
    if not files:
        return ""
    files.sort(key=os.path.getmtime, reverse=True)
    return files[0]

_DIFF_CACHE = {}

def analyze_excel_diff(excel_path: str) -> dict:
    """Excel veya CSV tablosunu products.json ve black_list.json ile karşılaştırır."""
    if not excel_path or not os.path.exists(excel_path):
        return {"status": "error", "message": "Excel/CSV dosyası bulunamadı."}

    mtime = os.path.getmtime(excel_path)
    prod_mtime = os.path.getmtime(PRODUCTS_FILE) if os.path.exists(PRODUCTS_FILE) else 0
    black_mtime = os.path.getmtime(BLACKLIST_FILE) if os.path.exists(BLACKLIST_FILE) else 0
    cache_key = (excel_path, mtime, prod_mtime, black_mtime)

    if cache_key in _DIFF_CACHE:
        return _DIFF_CACHE[cache_key]

    products = load_json(PRODUCTS_FILE, [])
    blacklist = load_json(BLACKLIST_FILE, [])

    prod_map = {str(p.get('barcode', '')).strip(): p for p in products if p.get('barcode')}
    black_map = {str(b.get('barcode', '')).strip(): b for b in blacklist if b.get('barcode')}

    # Başlık üzerinden akıllı eşleme haritaları (Barkod bozulmuş veya bilimsel gösterim ise)
    def normalize_for_title_matching(s):
        if not s: return ''
        s = clean_product_title(s).upper()
        tr_map = str.maketrans('ÇĞİÖŞÜI', 'CGIOSUI')
        s = s.translate(tr_map)
        return re.sub(r'[^A-Z0-9]', '', s)

    prod_title_map = {}
    for p in products:
        t = p.get('title') or p.get('title1') or ''
        nt = normalize_for_title_matching(t)
        if nt and nt not in prod_title_map:
            prod_title_map[nt] = p

    black_title_map = {}
    for b in blacklist:
        t = b.get('title') or ''
        nt = normalize_for_title_matching(t)
        if nt and nt not in black_title_map:
            black_title_map[nt] = b

    try:
        raw_items = read_stock_rows_from_file(excel_path)
    except Exception as e:
        return {"status": "error", "message": f"Dosya açılamadı: {str(e)}"}

    changed_prices = []
    new_products = []
    matched_products = []
    blacklisted_items = []
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

        # 1. Kara Liste Kontrolü (Barkod -> Stok Kodu -> Başlık)
        matched_black = None
        if barkod and barkod in black_map:
            matched_black = black_map[barkod]
        elif stok_kodu and stok_kodu in black_map:
            matched_black = black_map[stok_kodu]
        elif norm_title and norm_title in black_title_map:
            matched_black = black_title_map[norm_title]

        if matched_black:
            resolved_code = clean_barcode(matched_black.get('barcode')) or lookup_code
            blacklisted_items.append({
                "barcode": resolved_code,
                "excel_title": excel_title_val,
                "current_title": matched_black.get("title", title),
                "current_price": "-",
                "excel_price": price_str,
                "reason": matched_black.get("reason", "Kara Liste")
            })
            continue

        # 2. Mevcut Ürün Kontrolü & Fiyat Farkı (Barkod -> Stok Kodu -> Başlık)
        matched_prod = None
        if barkod and barkod in prod_map:
            matched_prod = prod_map[barkod]
        elif stok_kodu and stok_kodu in prod_map:
            matched_prod = prod_map[stok_kodu]
        elif norm_title and norm_title in prod_title_map:
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
            # 3. Yeni Ürün (Bizim sistemimizde henüz mevcut değil)
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
            "matched_count": len(matched_products),
            "blacklisted_count": len(blacklisted_items)
        },
        "changed_prices": changed_prices,
        "new_products": new_products,
        "matched_products": matched_products,
        "blacklisted_items": blacklisted_items
    }

    _DIFF_CACHE[cache_key] = result
    return result

@app.route("/api/catalog/sync-status", methods=["GET"])
def api_catalog_sync_status():
    """En güncel sistem excel/csv dosyasının analiz durumunu döner."""
    force = request.args.get("force")
    if force:
        _DIFF_CACHE.clear()
    latest_excel = get_latest_excel_path()
    if not latest_excel:
        return jsonify({
            "status": "empty",
            "message": "Henüz yüklenmiş bir sistem dosyası bulunamadı."
        })
    res = analyze_excel_diff(latest_excel)
    return jsonify(res)

@app.route("/api/catalog/excel-history", methods=["GET"])
def api_catalog_excel_history():
    """data/sistem_exceli/ içindeki tüm geçmiş Excel ve CSV dosyalarının listesini ve özet istatistiklerini döner."""
    if not os.path.exists(SISTEM_EXCELI_DIR):
        return jsonify({"status": "success", "history": []})

    valid_exts = ('.xlsx', '.xls', '.csv')
    files = [os.path.join(SISTEM_EXCELI_DIR, f) for f in os.listdir(SISTEM_EXCELI_DIR) if f.lower().endswith(valid_exts)]
    files.sort(key=os.path.getmtime, reverse=True)

    history = []
    latest_path = files[0] if files else None

    for idx, fpath in enumerate(files):
        fname = os.path.basename(fpath)
        mtime_dt = datetime.datetime.fromtimestamp(os.path.getmtime(fpath))
        fsize = os.path.getsize(fpath)
        size_str = f"{round(fsize / 1024, 1)} KB" if fsize < 1024*1024 else f"{round(fsize / (1024*1024), 2)} MB"

        diff_res = analyze_excel_diff(fpath)
        stats = diff_res.get("stats", {}) if isinstance(diff_res, dict) else {}

        history.append({
            "filename": fname,
            "date": mtime_dt.strftime("%d %b %Y %H:%M"),
            "size": size_str,
            "is_latest": (idx == 0),
            "stats": {
                "total_excel_rows": stats.get("total_excel_rows", 0),
                "changed_count": stats.get("changed_count", 0),
                "new_count": stats.get("new_count", 0),
                "matched_count": stats.get("matched_count", 0),
                "blacklisted_count": stats.get("blacklisted_count", 0)
            }
        })

    return jsonify({"status": "success", "history": history})

@app.route("/api/catalog/excel-detail/<filename>", methods=["GET"])
def api_catalog_excel_detail(filename):
    """Geçmişe ait belirli bir Excel/CSV dosyasının salt okunur (readonly) detay analizini döner."""
    safe_filename = os.path.basename(filename)
    target_path = os.path.join(SISTEM_EXCELI_DIR, safe_filename)

    if not os.path.exists(target_path):
        return jsonify({"status": "error", "message": "Arşiv dosyası bulunamadı."}), 404

    latest_excel = get_latest_excel_path()
    is_latest = (target_path == latest_excel)

    diff_result = analyze_excel_diff(target_path)
    if isinstance(diff_result, dict):
        diff_result["is_readonly"] = not is_latest

    return jsonify(diff_result)

@app.route("/api/catalog/excel-delete", methods=["POST"])
def api_catalog_excel_delete():
    """Geçmiş sistem excel/csv dosyasını siler."""
    data = request.get_json() or {}
    filename = os.path.basename(data.get("filename", ""))
    if not filename:
        return jsonify({"status": "error", "message": "Dosya adı belirtilmedi."}), 400

    target_path = os.path.join(SISTEM_EXCELI_DIR, filename)
    if not os.path.exists(target_path):
        return jsonify({"status": "error", "message": "Silinecek dosya bulunamadı."}), 404

    try:
        os.remove(target_path)
        _DIFF_CACHE.clear()
        return jsonify({"status": "success", "message": f"'{filename}' başarıyla silindi."})
    except Exception as e:
        return jsonify({"status": "error", "message": f"Dosya silinirken hata: {str(e)}"}), 500

@app.route("/api/catalog/excel-download/<filename>", methods=["GET"])
def api_catalog_excel_download(filename):
    """Arşivdeki Excel veya CSV dosyasını indirir."""
    safe_filename = os.path.basename(filename)
    target_path = os.path.join(SISTEM_EXCELI_DIR, safe_filename)

    if not os.path.exists(target_path):
        return jsonify({"status": "error", "message": "İndirilecek dosya bulunamadı."}), 404

    return send_file(target_path, as_attachment=True, download_name=safe_filename)

@app.route("/api/catalog/upload-excel", methods=["POST"])
def api_catalog_upload_excel():
    """Yeni bir Excel/CSV dosyası yükler, data/sistem_exceli/ altına kaydeder ve diff analizi yapar."""
    if 'file' not in request.files:
        return jsonify({"status": "error", "message": "Yüklenecek dosya seçilmedi."}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"status": "error", "message": "Dosya adı geçersiz."}), 400

    orig_name = file.filename
    ext = os.path.splitext(orig_name)[1].lower()
    if ext not in ['.xlsx', '.xls', '.csv']:
        return jsonify({"status": "error", "message": "Lütfen sadece .xlsx, .xls veya .csv dosyası yükleyin."}), 400

    now_str = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    safe_filename = f"stok_{now_str}{ext}"
    target_path = os.path.join(SISTEM_EXCELI_DIR, safe_filename)

    try:
        file.save(target_path)
    except Exception as e:
        return jsonify({"status": "error", "message": f"Dosya kaydedilemedi: {str(e)}"}), 500

    diff_result = analyze_excel_diff(target_path)
    return jsonify(diff_result)

@app.route("/api/catalog/apply-sync", methods=["POST"])
def api_catalog_apply_sync():
    """Seçilen fiyat değişikliklerini ve/veya yeni ürünleri products.json'a uygular."""
    req_data = request.json or {}
    action = req_data.get("action", "update_prices") # "update_prices", "add_new_products", "sync_all"
    items = req_data.get("items", [])

    if not items:
        return jsonify({"status": "error", "message": "Güncellenecek ürün listesi boş."}), 400

    products = load_json(PRODUCTS_FILE, [])
    prod_map = {str(p.get('barcode', '')).strip(): p for p in products if p.get('barcode')}

    now_date = get_online_or_system_date()
    now_full = datetime.datetime.now()
    now_time_str = f"{now_date} {now_full.strftime('%H:%M')}"

    updated_count = 0
    added_count = 0

    for item in items:
        barcode = str(item.get('barcode', '')).strip()
        if not barcode:
            continue
        
        new_price = item.get('new_price') or item.get('excel_price')
        if not new_price:
            continue
        formatted_price = format_price_display(new_price)

        if barcode in prod_map:
            # Fiyat Güncelle (Mevcut Başlığı ve Düzenlemeleri Koru!)
            p = prod_map[barcode]
            # Eğer etiket fiyatı önceden ayarlanmamışsa, eski fiyatı etiket fiyatı olarak muhafaza et
            if 'label_price' not in p or not p['label_price']:
                p['label_price'] = p.get('price', formatted_price)
            p['price'] = formatted_price
            p['date'] = now_date
            p['updated_at'] = now_time_str
            updated_count += 1
        else:
            # Yeni Ürün Ekle
            raw_title = item.get('excel_title') or item.get('current_title') or "YENİ ÜRÜN"
            clean_title = clean_product_title(raw_title)
            new_prod = {
                "barcode": barcode,
                "title": clean_title,
                "title1": clean_title,
                "title2": "",
                "brand": item.get('brand') if (item.get('brand') and item.get('brand') not in ['DİĞER', 'DIGER']) else "YARENLER",
                "origin": "TÜRKİYE",
                "price": formatted_price,
                "label_price": "",
                "date": now_date,
                "updated_at": now_time_str
            }
            products.append(new_prod)
            prod_map[barcode] = new_prod
            added_count += 1

    # 1. Değişiklik öncesi otomatik yedek al
    backup_name = create_products_backup(reason=f"Fiyat Senkronizasyonu & Baskı Öncesi ({len(items)} Ürün)")

    save_json(PRODUCTS_FILE, products)
    _DIFF_CACHE.clear()

    return jsonify({
        "status": "success",
        "message": f"Senkronizasyon tamamlandı: {updated_count} ürünün fiyatı güncellendi, {added_count} yeni ürün stoğa eklendi.",
        "updated_count": updated_count,
        "added_count": added_count,
        "backup_name": backup_name
    })

def mark_products_as_printed(barcodes):
    """Baskısı alınan ürünlerin etiket fiyatını (label_price) güncel sistem fiyatıyla eşitler."""
    if not barcodes:
        return
    try:
        products = load_json(PRODUCTS_FILE, [])
        prod_map = {str(p.get('barcode', '')).strip(): p for p in products if p.get('barcode')}
        now_time_str = datetime.datetime.now().strftime("%d %b %Y %H:%M")
        changed = False
        for bc in barcodes:
            b_str = str(bc).strip()
            if b_str in prod_map:
                p = prod_map[b_str]
                p['label_price'] = p.get('price', '')
                p['last_printed_at'] = now_time_str
                changed = True
        if changed:
            save_json(PRODUCTS_FILE, products)
            _DIFF_CACHE.clear()
    except Exception as e:
        print(f"[UYARI] mark_products_as_printed hatası: {e}")

@app.route("/api/catalog/sync-label-price", methods=["POST"])
def api_catalog_sync_label_price():
    """Belirtilen ürünlerin etiket fiyatını güncel sistem fiyatı ile eşitler."""
    payload = request.json or {}
    barcodes = payload.get("barcodes")
    if not barcodes:
        bc = payload.get("barcode")
        barcodes = [bc] if bc else []
    if not barcodes:
        return jsonify({"status": "error", "message": "Barkod belirtilmedi."}), 400
    mark_products_as_printed(barcodes)
    return jsonify({"status": "success", "message": f"{len(barcodes)} ürünün etiket fiyatı güncellendi."})

# --- YEDEKLEME & GERİ YÜKLEME (ROLLBACK) ENDPOINTLERİ ---

@app.route("/api/backup/create", methods=["POST"])
def api_backup_create():
    """Kullanıcı isteğiyle anlık güvenli veritabanı yedeği oluşturur."""
    payload = request.json or {}
    reason = payload.get("reason") or "Manuel Kullanıcı Yedeği"
    fname = create_products_backup(reason=reason)
    if fname:
        return jsonify({
            "status": "success",
            "message": f"'{fname}' yedeği başarıyla oluşturuldu.",
            "filename": fname
        })
    return jsonify({"status": "error", "message": "Yedek oluşturulamadı."}), 500

@app.route("/api/backup/list", methods=["GET"])
def api_backup_list():
    """Tüm ürün veritabanı yedeklerini listeler."""
    if not os.path.exists(BACKUPS_DIR):
        return jsonify({"status": "success", "backups": []})

    files = [f for f in os.listdir(BACKUPS_DIR) if f.endswith('.json') and not f.endswith('.meta')]
    files.sort(key=lambda x: os.path.getmtime(os.path.join(BACKUPS_DIR, x)), reverse=True)

    backups = []
    for f in files:
        fpath = os.path.join(BACKUPS_DIR, f)
        meta_path = fpath + ".meta"
        meta = load_json(meta_path, {})
        mtime = datetime.datetime.fromtimestamp(os.path.getmtime(fpath)).strftime("%d %b %Y %H:%M:%S")

        backups.append({
            "filename": f,
            "date": meta.get("created_at") or mtime,
            "reason": meta.get("reason") or "Manuel/Otomatik Yedek",
            "size": f"{round(os.path.getsize(fpath)/1024, 1)} KB"
        })

    return jsonify({"status": "success", "backups": backups})

@app.route("/api/backup/restore", methods=["POST"])
def api_backup_restore():
    """Seçilen bir yedeği products.json olarak geri yükler."""
    req_data = request.json or {}
    filename = req_data.get("filename", "")
    if not filename:
        return jsonify({"status": "error", "message": "Geri yüklenecek yedek belirtilmedi."}), 400

    target_path = os.path.join(BACKUPS_DIR, os.path.basename(filename))
    if not os.path.exists(target_path):
        return jsonify({"status": "error", "message": "Yedek dosyası bulunamadı."}), 404

    # Geri yüklemeden önce mevcut hali de güvenlik için yedekle
    create_products_backup(reason="Geri Yükleme Öncesi Güvenlik Yedeği")

    try:
        shutil.copy2(target_path, PRODUCTS_FILE)
        _DIFF_CACHE.clear()
        return jsonify({
            "status": "success",
            "message": f"Veritabanı başarıyla '{filename}' yedeğindeki haline geri döndürüldü."
        })
    except Exception as e:
        return jsonify({"status": "error", "message": f"Geri yükleme başarısız: {str(e)}"}), 500

@app.route("/api/backup/rollback-latest", methods=["POST"])
def api_backup_rollback_latest():
    """En son alınan yedeğe tek tıkla anında geri döner."""
    if not os.path.exists(BACKUPS_DIR):
        return jsonify({"status": "error", "message": "Henüz kayıtlı bir yedek bulunmuyor."}), 404

    files = [f for f in os.listdir(BACKUPS_DIR) if f.endswith('.json') and not f.endswith('.meta')]
    if not files:
        return jsonify({"status": "error", "message": "Geri dönülecek yedek bulunamadı."}), 404

    files.sort(key=lambda x: os.path.getmtime(os.path.join(BACKUPS_DIR, x)), reverse=True)
    latest_backup = files[0]
    target_path = os.path.join(BACKUPS_DIR, latest_backup)

    try:
        shutil.copy2(target_path, PRODUCTS_FILE)
        _DIFF_CACHE.clear()
        return jsonify({
            "status": "success",
            "message": f"Son işlem geri alındı! Fiyatlar '{latest_backup}' yedeğindeki önceki haline döndürüldü."
        })
    except Exception as e:
        return jsonify({"status": "error", "message": f"Geri alma hatası: {str(e)}"}), 500

def normalize_search_text(text: str) -> str:
    """Türkçe karakterleri ve büyük/küçük harf farklarını arama için normalize eder."""
    if not text:
        return ""
    text = str(text)
    char_map = {
        'İ': 'i', 'I': 'i', 'ı': 'i', 'i': 'i',
        'Ş': 's', 'ş': 's',
        'Ğ': 'g', 'ğ': 'g',
        'Ü': 'u', 'ü': 'u',
        'Ö': 'o', 'ö': 'o',
        'Ç': 'c', 'ç': 'c',
    }
    return "".join(char_map.get(ch, ch.lower()) for ch in text)

def score_product_match(p: dict, query_tokens: list, norm_query: str) -> int:
    """Arama eşleşme kalitesine göre alakalılık (relevance) puanı üretir."""
    norm_title = normalize_search_text(p.get("title") or p.get("title1") or "")
    norm_barcode = normalize_search_text(p.get("barcode", ""))
    norm_brand = normalize_search_text(p.get("brand", ""))
    
    score = 0
    # 1. Tam barkod eşleşmesi
    if norm_barcode == norm_query:
        score += 1000
    elif norm_barcode.startswith(norm_query):
        score += 500
    elif norm_query in norm_barcode:
        score += 300

    # 2. Tam başlık eşleşmesi veya başlangıcı
    if norm_title == norm_query:
        score += 800
    elif norm_title.startswith(norm_query):
        score += 400
    elif norm_query in norm_title:
        score += 250

    # 3. Bütün kelimeler başlıkta mı?
    if all(tok in norm_title for tok in query_tokens):
        score += 150
        # Başlık ilk aranan kelime ile başlıyorsa ekstra puan
        if query_tokens and norm_title.startswith(query_tokens[0]):
            score += 50
    
    # 4. Marka eşleşmesi
    if norm_brand and any(tok in norm_brand for tok in query_tokens):
        score += 30
        
    # 5. Başlık uzunluğuna göre ufak optimizasyon (daha kısa ve direkt başlıklar öne)
    score += max(0, 40 - len(norm_title))
    return score

@app.route("/api/products/search", methods=["GET"])
def api_products_search():
    """Barkod veya ürün adına göre akıllı stok araması yapar (Türkçe harf & çoklu kelime duyarsız)."""
    q = request.args.get("q", "").strip()
    products = load_json(PRODUCTS_FILE, [])
    if not q:
        return jsonify({"status": "success", "products": products})
    
    norm_q = normalize_search_text(q)
    tokens = [t for t in norm_q.split() if t]
    
    if not tokens:
        return jsonify({"status": "success", "products": products})

    matched_products = []
    for p in products:
        norm_full = normalize_search_text(
            f"{p.get('barcode', '')} {p.get('title', '')} {p.get('title1', '')} {p.get('title2', '')} {p.get('brand', '')}"
        )
        if all(tok in norm_full for tok in tokens):
            score = score_product_match(p, tokens, norm_q)
            matched_products.append((score, p))

    # Puana göre çoktan aza sırala
    matched_products.sort(key=lambda x: x[0], reverse=True)
    results = [p for _, p in matched_products]

    return jsonify({"status": "success", "products": results})

@app.route("/api/products/<barcode>", methods=["GET"])
def api_product_get(barcode):
    """Barkod ile tek bir ürünün stok bilgisini getirir."""
    products = load_json(PRODUCTS_FILE, [])
    barcode = barcode.strip()
    for p in products:
        if str(p.get("barcode")) == barcode:
            return jsonify({"status": "success", "product": p})
    return jsonify({"status": "error", "message": "Ürün stokta bulunamadı."}), 404

@app.route("/api/products", methods=["POST"])
def api_product_save():
    """Yeni ürün ekler veya mevcut ürünü günceller (Barkod - Ürün Adı - Fiyat)."""
    data = request.json or {}
    barcode = str(data.get("barcode", "")).strip()
    title = str(data.get("title") or data.get("title1", "")).strip()
    price = str(data.get("price", "")).strip()
    brand = str(data.get("brand", "")).strip() or "YARENLER"

    if not barcode or not title:
        return jsonify({"status": "error", "message": "Barkod ve Ürün Adı zorunludur."}), 400
    
    now = datetime.datetime.now()
    month_name = MONTHS_TR.get(now.month, 'Ağu')
    date_only = f"{now.day} {month_name} {now.year}"
    date_time = f"{now.day} {month_name} {now.year} {now.strftime('%H:%M')}"

    new_item = {
        "barcode": barcode,
        "title": title,
        "price": price,
        "brand": brand,
        "date": date_only,
        "updated_at": date_time
    }

    products = load_json(PRODUCTS_FILE, [])
    found = False
    for i, p in enumerate(products):
        if str(p.get("barcode")) == barcode:
            # Mevcut diğer alanları koru
            p.update(new_item)
            new_item = p
            products[i] = p
            found = True
            break
    if not found:
        products.append(new_item)
    
    save_json(PRODUCTS_FILE, products)
    print(f"[STOK GÜNCELLENDİ] Barkod: {barcode} | Ürün: {title} | Fiyat: {price} | Zaman: {date_time}")
    return jsonify({"status": "success", "product": new_item, "message": "Ürün stoğa kaydedildi."})

# --- Şablon (Template) API ---
@app.route("/api/templates", methods=["GET"])
def api_templates_get():
    """Tüm etiket şablonlarını listeler."""
    templates = load_json(TEMPLATES_FILE, [])
    return jsonify({"status": "success", "templates": templates})

@app.route("/api/templates", methods=["POST"])
def api_template_save():
    """Yeni etiket modeli kaydeder veya günceller."""
    tpl = request.json or {}
    tpl_id = tpl.get("id") or f"tpl_{int(time.time())}"
    tpl["id"] = tpl_id
    
    templates = load_json(TEMPLATES_FILE, [])
    
    # Kilitli fabrika şablonunu koru
    if tpl_id == "default":
        tpl["is_locked"] = True
    else:
        tpl["is_locked"] = False
        
    found = False
    for i, t in enumerate(templates):
        if t.get("id") == tpl_id:
            templates[i] = tpl
            found = True
            break
    if not found:
        templates.append(tpl)
        
    save_json(TEMPLATES_FILE, templates)
    print(f"[ŞABLON KAYDEDİLDİ] Model Adı: {tpl.get('name')}")
    return jsonify({"status": "success", "template": tpl, "message": "Şablon kaydedildi."})

@app.route("/api/templates/<template_id>", methods=["DELETE"])
def api_template_delete(template_id):
    """Şablon siler (Fabrika başlangıç şablonu silinemez)."""
    if template_id == "default":
        return jsonify({"status": "error", "message": "Başlangıç fabrika şablonu silinemez!"}), 403
    
    templates = load_json(TEMPLATES_FILE, [])
    new_list = [t for t in templates if t.get("id") != template_id]
    save_json(TEMPLATES_FILE, new_list)
    print(f"[ŞABLON SİLİNDİ] ID: {template_id}")
    return jsonify({"status": "success", "message": "Şablon silindi."})

# --- Ayarlar API ---
@app.route("/api/settings", methods=["GET"])
def api_settings_get():
    """Sistem ayarlarını döner."""
    settings = load_settings()
    return jsonify({"status": "success", "settings": settings})

@app.route("/api/settings", methods=["POST"])
def api_settings_save():
    """Sistem ayarlarını günceller."""
    settings = request.json or {}
    save_settings(settings)
    print("[AYARLAR] Sistem ayarları başarıyla güncellendi.")
    return jsonify({"status": "success", "message": "Ayarlar kaydedildi."})

# --- Taslak & Önbellek API (Sunucu Yeniden Başlatılsa Bile Korunur) ---
@app.route("/api/cache/draft", methods=["GET"])
def api_cache_draft_get():
    """Önceki oturumdan kalan kaydedilmemiş önbellek/taslak verilerini döner."""
    draft = load_json(DRAFT_CACHE_FILE, None)
    if draft and isinstance(draft, dict) and draft.get("is_dirty"):
        return jsonify({"status": "success", "has_draft": True, "draft": draft})
    return jsonify({"status": "empty", "has_draft": False, "draft": None})

@app.route("/api/cache/draft", methods=["POST"])
def api_cache_draft_save():
    """Form ve oturum önbelleğini anlık olarak kaydeder."""
    data = request.json or {}
    save_json(DRAFT_CACHE_FILE, data)
    return jsonify({"status": "success", "message": "Taslak önbelleğe kaydedildi."})

@app.route("/api/cache/draft", methods=["DELETE"])
def api_cache_draft_clear():
    """Önbellek taslak dosyasını temizler."""
    if os.path.exists(DRAFT_CACHE_FILE):
        try:
            os.remove(DRAFT_CACHE_FILE)
        except Exception:
            pass
    return jsonify({"status": "success", "message": "Taslak önbelleği temizlendi."})


# --- Yazdırma & Önizleme API ---
@app.route("/api/preview/zpl", methods=["POST"])
def api_preview_zpl():
    """Önizleme ve hata ayıklama için ZPL kodunu döndürür."""
    payload = request.json or {}
    data = payload.get("data", {})
    orientation = payload.get("orientation", "POR")
    width_mm = float(payload.get("width_mm") or 76)
    height_mm = float(payload.get("height_mm") or 40)
    x_offset = int(payload.get("x_offset") or 0)
    y_offset = int(payload.get("y_offset") or 0)
    dpi = int(payload.get("dpi") or 203)

    zpl_command = generate_market_shelf_zpl(
        data,
        orientation=orientation,
        x_offset=x_offset,
        y_offset=y_offset,
        width_mm=width_mm,
        height_mm=height_mm,
        dpi=dpi
    )
    return jsonify({"status": "success", "zpl": zpl_command})

@app.route("/api/print/send", methods=["POST"])
def api_print_send():
    """Etiket verilerini alır, ZPL üretir ve doğrudan yazıcıya gönderir."""
    payload = request.json or {}
    data = payload.get("data", {})
    selected_printer = payload.get("printer") or "Termal Etiket Yazici"
    orientation = payload.get("orientation", "POR")
    width_mm = float(payload.get("width_mm") or 76)
    height_mm = float(payload.get("height_mm") or 40)
    x_offset = int(payload.get("x_offset") or 0)
    y_offset = int(payload.get("y_offset") or 0)
    dpi = int(payload.get("dpi") or 203)
    copies = int(payload.get("copies") or 1)

    u_title = clean_tr(data.get('title1', ''))
    u_price = clean_tr(data.get('price', ''))
    client_ip = request.remote_addr
    print(f"\n[BASKI TALEBİ] Yazıcı: {selected_printer} | Yön: {orientation} | Boyut: {width_mm}x{height_mm}mm | Adet: {copies} | Kaynak: {client_ip}")
    print(f"-> Ürün: {u_title} | Fiyat: {u_price}")

    # ZPL kodunu üret
    zpl_command = generate_market_shelf_zpl(
        data,
        orientation=orientation,
        x_offset=x_offset,
        y_offset=y_offset,
        width_mm=width_mm,
        height_mm=height_mm,
        dpi=dpi,
        copies=copies
    )

    # Yazıcıya gönder
    try:
        print_raw_zpl(selected_printer, zpl_command, doc_name="Market Raf Etiketi")
        print(f"[BAŞARILI] {len(zpl_command)} bayt yazıcıya iletildi. {copies} adet etiket basıldı!")
        u_barcode = str(data.get('barcode', '')).strip()
        if u_barcode:
            mark_products_as_printed([u_barcode])
        return jsonify({
            "status": "success",
            "message": f"'{selected_printer}' yazıcısına iletildi! {copies} adet etiket basıldı.",
            "zpl": zpl_command
        })
    except Exception as e:
        print(f"[HATA] Yazdırma başarısız: {e}")
        return jsonify({
            "status": "error",
            "message": f"Yazdırma hatası: {str(e)}",
            "zpl": zpl_command
        }), 500

# Canlı Yazdırma Durumu (PC ve Mobil Arasında Eş Zamanlı Senkronizasyon İçin)
global_live_print_status = {
    "is_active": False,
    "source": "none",
    "total": 0,
    "current": 0,
    "current_item": "",
    "current_price": "",
    "status_text": "Hazır",
    "is_paused": False,
    "last_updated": 0
}

def validate_barcode_checksum(barcode: str) -> bool:
    """EAN-13, EAN-8 ve UPC-A barkodlarının Modulo-10 sağlama (checksum) basamağını matematiksel olarak doğrular."""
    if not barcode or not isinstance(barcode, str):
        return False
    b = barcode.strip()
    # EAN-13
    if len(b) == 13 and b.isdigit():
        s = sum(int(b[i]) * (1 if i % 2 == 0 else 3) for i in range(12))
        check = (10 - (s % 10)) % 10
        return check == int(b[12])
    # EAN-8
    elif len(b) == 8 and b.isdigit():
        s = sum(int(b[i]) * (3 if i % 2 == 0 else 1) for i in range(7))
        check = (10 - (s % 10)) % 10
        return check == int(b[7])
    # UPC-A
    elif len(b) == 12 and b.isdigit():
        s = sum(int(b[i]) * (3 if i % 2 == 0 else 1) for i in range(11))
        check = (10 - (s % 10)) % 10
        return check == int(b[11])
    # Code-128 / Code-39 / Alfa-sayısal barkodlar
    elif len(b) >= 3 and b.replace("-", "").replace(".", "").isalnum():
        return True
    return False

@app.route("/api/scanner/decode-frame", methods=["POST"])
def api_scanner_decode_frame():
    """Mobil kameradan gelen canlı kareyi PyZBar ve OpenCV ile yüksek hassasiyette ve sağlama kontrolüyle çözer."""
    payload = request.json or {}
    image_b64 = payload.get("image")
    if not image_b64:
        return jsonify({"status": "not_found"}), 200

    if "," in image_b64:
        image_b64 = image_b64.split(",", 1)[1]

    try:
        import base64
        import cv2
        import numpy as np
        import pyzbar.pyzbar as pyzbar

        img_bytes = base64.b64decode(image_b64)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return jsonify({"status": "not_found"}), 200

        def check_pyzbar(image_mat):
            try:
                barcodes = pyzbar.decode(image_mat)
                for bc in barcodes:
                    if bc.data:
                        raw = bc.data.decode("utf-8", errors="ignore").strip()
                        if validate_barcode_checksum(raw):
                            return raw
            except Exception:
                pass
            return None

        # 1. Aşama: Orijinal renkli görüntü
        res = check_pyzbar(img)
        if res:
            return jsonify({"status": "success", "barcode": res})

        # 2. Aşama: Gri tonlama + CLAHE (Işık parlamaları ve gölgeleri filtreler)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        res = check_pyzbar(gray)
        if res:
            return jsonify({"status": "success", "barcode": res})

        clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
        clahe_img = clahe.apply(gray)
        res = check_pyzbar(clahe_img)
        if res:
            return jsonify({"status": "success", "barcode": res})

        # 3. Aşama: Keskinleştirme (Unsharp Mask - Bulanık barkodları netleştirir)
        gaussian = cv2.GaussianBlur(gray, (0, 0), 2.0)
        unsharp = cv2.addWeighted(gray, 1.5, gaussian, -0.5, 0)
        res = check_pyzbar(unsharp)
        if res:
            return jsonify({"status": "success", "barcode": res})

        # 4. Aşama: Otsu ve Adaptif Eşikleme
        _, thresh_otsu = cv2.threshold(clahe_img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        res = check_pyzbar(thresh_otsu)
        if res:
            return jsonify({"status": "success", "barcode": res})

        adaptive = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 13, 2)
        res = check_pyzbar(adaptive)
        if res:
            return jsonify({"status": "success", "barcode": res})

        # 5. Aşama: OpenCV BarcodeDetector
        detector = cv2.barcode.BarcodeDetector()
        opencv_res = detector.detectAndDecode(gray)
        if opencv_res:
            decoded_info = opencv_res[0]
            candidate = None
            if isinstance(decoded_info, (list, tuple)) and len(decoded_info) > 0 and decoded_info[0]:
                candidate = str(decoded_info[0]).strip()
            elif isinstance(decoded_info, str) and decoded_info.strip():
                candidate = decoded_info.strip()
            
            if candidate and validate_barcode_checksum(candidate):
                return jsonify({"status": "success", "barcode": candidate})

        return jsonify({"status": "not_found"}), 200
    except Exception as e:
        return jsonify({"status": "not_found"}), 200


@app.route("/api/print/live-status", methods=["GET", "POST"])
def api_print_live_status():
    """Masaüstü ve Mobil arasında canlı yazdırma durumunu senkronize eder."""
    global global_live_print_status
    if request.method == "POST":
        data = request.json or {}
        global_live_print_status.update(data)
        global_live_print_status["last_updated"] = time.time()
        return jsonify({"status": "success", "live_status": global_live_print_status})
    else:
        # 10 saniyeden eski ise otomatik sıfırla
        if time.time() - global_live_print_status.get("last_updated", 0) > 10 and not global_live_print_status.get("is_active"):
            global_live_print_status["is_active"] = False
        return jsonify({"status": "success", "live_status": global_live_print_status})

@app.route("/api/print/batch", methods=["POST"])
def api_print_batch():
    """Toplu ürün etiketlerini tek bir ZPL işi olarak yazıcıya iletir."""
    global global_live_print_status
    payload = request.json or {}
    products = payload.get("products", [])
    
    settings = load_settings()
    selected_printer = payload.get("printer") or settings.get("printer") or "Termal Etiket Yazici"
    
    orientation = payload.get("orientation", "POR")
    width_mm = float(payload.get("width_mm") or 76)
    height_mm = float(payload.get("height_mm") or 40)
    x_offset = int(payload.get("x_offset") or 0)
    y_offset = int(payload.get("y_offset") or 0)
    dpi = int(payload.get("dpi") or 203)
    copies_per_item = max(1, int(payload.get("copies_per_item") or 1))
    template_raw = payload.get("template")
    template = template_raw if isinstance(template_raw, dict) else {}
    source = payload.get("source") or "mobile"

    if not products:
        return jsonify({"status": "error", "message": "Yazdırılacak ürün bulunamadı."}), 400

    # Canlı Durumu Güncelle
    first_p = products[0]
    global_live_print_status.update({
        "is_active": True,
        "source": source,
        "total": len(products) * copies_per_item,
        "current": len(products) * copies_per_item,
        "current_item": str(first_p.get("title") or first_p.get("title1") or "Etiket"),
        "current_price": str(first_p.get("price") or ""),
        "status_text": "Yazdırılıyor...",
        "is_paused": False,
        "last_updated": time.time()
    })

    zpl_list = []
    for p in products:
        full_title = str(p.get("title") or p.get("title1") or "").strip()
        parts = full_title.split()
        if len(full_title) > 25 and len(parts) > 1:
            mid = math.ceil(len(parts) / 2)
            t1 = " ".join(parts[:mid])
            t2 = " ".join(parts[mid:])
        else:
            t1 = full_title
            t2 = str(p.get("title2") or "").strip()

        # Etikette SADECE tarih yer alacak (saat etikete basılmaz)
        raw_date = str(p.get("date") or get_online_or_system_date()).strip()
        date_parts = raw_date.split()
        if len(date_parts) >= 4 and ":" in date_parts[-1]:
            label_date = " ".join(date_parts[:3])
        else:
            label_date = raw_date

        p_brand = str(p.get("brand") or "").strip()
        if not p_brand or p_brand.upper() in ["DİĞER", "DIGER", "DİGER"]:
            p_brand = "YARENLER"

        data = {
            "title1": t1,
            "title2": t2,
            "brand": p_brand,
            "origin": str(p.get("origin") or "TÜRKİYE"),
            "date": label_date,
            "unit_price": str(p.get("unit_price") or ""),
            "barcode": str(p.get("barcode") or ""),
            "price": str(p.get("price") or ""),
            "top_right_mode": template.get("top_right_mode", "empty"),
            "top_right_text": template.get("top_right_text", ""),
            "custom_fields": template.get("custom_fields", [])
        }

        zpl = generate_market_shelf_zpl(
            data,
            orientation=orientation,
            x_offset=x_offset,
            y_offset=y_offset,
            width_mm=width_mm,
            height_mm=height_mm,
            dpi=dpi,
            copies=copies_per_item
        )
        zpl_list.append(zpl)

    combined_zpl = "\n".join(zpl_list)
    total_labels = len(products) * copies_per_item
    print(f"\n[TOPLU BASKI] ({source}) {len(products)} Ürün x {copies_per_item} Adet = {total_labels} Etiket -> Yazıcı: {selected_printer}")

    try:
        print_raw_zpl(selected_printer, combined_zpl, f"Toplu Etiket ({len(products)} Kalem)")
        printed_barcodes = [str(p.get("barcode", "")).strip() for p in products if p.get("barcode")]
        if printed_barcodes:
            mark_products_as_printed(printed_barcodes)
        return jsonify({
            "status": "success",
            "item_count": len(products),
            "total_labels": total_labels,
            "message": f"{len(products)} ürün ({total_labels} adet etiket) başarıyla yazıcıya gönderildi!"
        })
    except Exception as e:
        print(f"[YAZDIRMA HATASI] {e}")
        return jsonify({"status": "error", "message": f"Yazdırma hatası: {str(e)}"}), 500

@app.route("/api/print/cancel", methods=["POST"])
def api_print_cancel():
    """Yazıcı kuyruğunu temizler ve aktif yazdırma işini iptal eder."""
    global global_live_print_status
    payload = request.json or {}
    settings = load_settings()
    selected_printer = payload.get("printer") or settings.get("printer") or "Termal Etiket Yazici"
    purged = purge_printer_queue(selected_printer)

    global_live_print_status.update({
        "is_active": False,
        "status_text": "İptal Edildi",
        "last_updated": time.time()
    })

    return jsonify({
        "status": "success",
        "purged": purged,
        "message": f"'{selected_printer}' yazıcı kuyruğu temizlendi ve baskı iptal edildi."
    })

def ensure_ssl_certs(local_ip="192.168.1.34"):
    """Mobil tarayıcıların canlı WebRTC kamera erişimi için SSL sertifikası üretir."""
    cert_dir = os.path.join(DATA_DIR, "ssl")
    os.makedirs(cert_dir, exist_ok=True)
    cert_path = os.path.join(cert_dir, "cert.pem")
    key_path = os.path.join(cert_dir, "key.pem")

    if os.path.exists(cert_path) and os.path.exists(key_path):
        return cert_path, key_path

    try:
        from cryptography import x509
        from cryptography.x509.oid import NameOID
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.hazmat.primitives import serialization
        import datetime

        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.COUNTRY_NAME, "TR"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Market Raf Terminali"),
            x509.NameAttribute(NameOID.COMMON_NAME, local_ip),
        ])
        now = datetime.datetime.now(datetime.timezone.utc)
        cert = x509.CertificateBuilder().subject_name(
            subject
        ).issuer_name(
            issuer
        ).public_key(
            key.public_key()
        ).serial_number(
            x509.random_serial_number()
        ).not_valid_before(
            now - datetime.timedelta(days=1)
        ).not_valid_after(
            now + datetime.timedelta(days=3650)
        ).sign(key, hashes.SHA256())

        with open(key_path, "wb") as f:
            f.write(key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.TraditionalOpenSSL,
                encryption_algorithm=serialization.NoEncryption()
            ))
        with open(cert_path, "wb") as f:
            f.write(cert.public_bytes(serialization.Encoding.PEM))
        return cert_path, key_path
    except Exception as e:
        print(f"[SSL UYARISI] SSL sertifikası üretilemedi: {e}")
        return None, None

def free_port(port=5000):
    """Portta asılı kalan eski işlemleri temizler."""
    try:
        cmd = f'powershell -Command "Get-NetTCPConnection -LocalPort {port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object {{ if ($_ -ne $PID) {{ Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }} }}"'
        subprocess.run(cmd, shell=True, capture_output=True)
    except Exception:
        pass

def start_code_watcher():
    """Proje kodlarını (.py, .js, .html, .css) arka planda izler ve değişiklik olduğunda terminale anlık bildirim basar."""
    import threading

    def watch_worker():
        watch_dirs = [
            BASE_DIR,
            os.path.join(BASE_DIR, 'src'),
            os.path.join(BASE_DIR, 'static', 'js'),
            os.path.join(BASE_DIR, 'static', 'css'),
            os.path.join(BASE_DIR, 'templates')
        ]
        valid_exts = ('.py', '.js', '.html', '.css')
        mtimes = {}

        def get_all_watched_files():
            files = []
            for d in watch_dirs:
                if os.path.exists(d):
                    for root, _, filenames in os.walk(d):
                        for f in filenames:
                            if f.lower().endswith(valid_exts):
                                files.append(os.path.join(root, f))
            return files

        for fpath in get_all_watched_files():
            try:
                mtimes[fpath] = os.path.getmtime(fpath)
            except Exception:
                pass

        while True:
            time.sleep(1.0)
            current_files = get_all_watched_files()
            for fpath in current_files:
                try:
                    curr_mtime = os.path.getmtime(fpath)
                    if fpath in mtimes:
                        if curr_mtime != mtimes[fpath]:
                            mtimes[fpath] = curr_mtime
                            fname = os.path.relpath(fpath, BASE_DIR)
                            now_time = datetime.datetime.now().strftime("%H:%M:%S")
                            print("\n" + "=" * 65)
                            print(f"🔄 [KOD GÜNCELLENDİ] '{fname}' dosyasında değişiklik algılandı!")
                            print(f"[*] Değişiklik Zamanı : {now_time}")
                            print(f"[*] Sistem ve Önbellek Otomatik Yenilendi.")
                            print("=" * 65 + "\n")
                            _DIFF_CACHE.clear()
                    else:
                        mtimes[fpath] = curr_mtime
                except Exception:
                    pass

    t = threading.Thread(target=watch_worker, daemon=True)
    t.start()

def run_server(host="0.0.0.0", port=5000):
    free_port(port)
    free_port(port + 1)
    time.sleep(0.5)

    def ignore_sigint(sig, frame):
        pass
    signal.signal(signal.SIGINT, ignore_sigint)

    local_ip = get_local_ip()
    cert_path, key_path = ensure_ssl_certs(local_ip)

    url = f"http://127.0.0.1:{port}"
    mobile_http = f"http://{local_ip}:{port}/mobile"
    mobile_https = f"https://{local_ip}:{port + 1}/mobile" if cert_path else None

    # Kod izleyicisini başlat (Terminalde anlık değişiklik bildirimi basar)
    start_code_watcher()

    print("=" * 70)
    print("[BASLATILDI] Market Raf Etiketi Paneli & Canlı Mobil Terminal")
    print(f"[*] Masaustu Panel       : {url}")
    print(f"[*] Mobil HTTP (Normal)  : {mobile_http}")
    if mobile_https:
        print(f"[*] Mobil HTTPS (Kamera) : {mobile_https}")
    print("[*] Canlı Kod İzleyici   : Devrede (Değişikliklerde bildirim verir)")
    print("=" * 70)

    try:
        webbrowser.open(url)
    except Exception:
        pass

    if cert_path and key_path:
        from werkzeug.serving import make_server
        import threading

        # HTTP sunucusu (Port 5000)
        http_srv = make_server(host, port, app)
        # HTTPS sunucusu (Port 5001 - Canlı Kamera WebRTC Desteği İçin)
        https_srv = make_server(host, port + 1, app, ssl_context=(cert_path, key_path))

        t_http = threading.Thread(target=http_srv.serve_forever, daemon=True)
        t_http.start()
        print(f"[HTTPS SUNUCUSU AKTİF] Port {port + 1} üzerinde SSL canlı kamera servisi devrede.")
        https_srv.serve_forever()
    else:
        app.run(host=host, port=port, debug=False, use_reloader=False)

if __name__ == "__main__":
    run_server("0.0.0.0", 5000)
