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
from flask import Flask, jsonify, request, send_from_directory, render_template

# Gereksiz GET/POST 200 HTTP loglarını sustur (Sadece Hatalar ve Özel Mesajlar)
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

import math
import datetime
import re
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

def clean_product_title(s: str) -> str:
    """Yeni eklenen ürünlerin başlıklarını otomatik normalize eder."""
    if not s or not isinstance(s, str):
        return str(s or '').strip()
    
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

def get_latest_excel_path() -> str:
    """data/sistem_exceli klasöründeki en güncel excel dosyasını bulur."""
    if not os.path.exists(SISTEM_EXCELI_DIR):
        return ""
    files = [
        os.path.join(SISTEM_EXCELI_DIR, f)
        for f in os.listdir(SISTEM_EXCELI_DIR)
        if f.endswith('.xlsx') and not f.startswith('~$')
    ]
    if not files:
        root_excel = os.path.join(BASE_DIR, "Başlıksız e-tablo (1).xlsx")
        if os.path.exists(root_excel):
            return root_excel
        return ""
    files.sort(key=os.path.getmtime, reverse=True)
    return files[0]

_DIFF_CACHE = {}

def analyze_excel_diff(excel_path: str) -> dict:
    """Excel tablosunu products.json ve black_list.json ile karşılaştırır (Önbellekli ve Yüksek Hızlı)."""
    if not excel_path or not os.path.exists(excel_path):
        return {"status": "error", "message": "Excel dosyası bulunamadı."}

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

    try:
        wb = openpyxl.load_workbook(excel_path, data_only=True)
        sheet = wb.active
    except Exception as e:
        return {"status": "error", "message": f"Excel açılamadı: {str(e)}"}

    changed_prices = []
    new_products = []
    matched_products = []
    blacklisted_items = []
    seen_barcodes = set()

    for r in range(2, sheet.max_row + 1):
        stok_kodu = str(sheet.cell(row=r, column=1).value or '').strip()
        barkod = str(sheet.cell(row=r, column=2).value or '').strip()
        if barkod.endswith('.0'):
            barkod = barkod[:-2]
        if stok_kodu.endswith('.0'):
            stok_kodu = stok_kodu[:-2]

        title = str(sheet.cell(row=r, column=6).value or '').strip()
        price_raw = sheet.cell(row=r, column=7).value
        price_str = format_price_display(price_raw)
        
        lookup_code = barkod or stok_kodu
        if lookup_code.endswith('.0'):
            lookup_code = lookup_code[:-2]

        if not lookup_code or lookup_code in seen_barcodes:
            continue
        seen_barcodes.add(lookup_code)

        # 1. Kara Liste Kontrolü (Manav / Dummy vs.)
        if lookup_code in black_map:
            blacklisted_items.append({
                "barcode": lookup_code,
                "excel_title": title,
                "current_title": black_map[lookup_code].get("title", title),
                "current_price": "-",
                "excel_price": price_str,
                "reason": black_map[lookup_code].get("reason", "Kara Liste")
            })
            continue

        # 2. Mevcut Ürün Kontrolü & Fiyat Farkı
        if lookup_code in prod_map:
            p = prod_map[lookup_code]
            cur_price_val = parse_price_val(p.get('price'))
            excel_price_val = parse_price_val(price_str)

            if abs(cur_price_val - excel_price_val) > 0.01 and excel_price_val > 0:
                diff = excel_price_val - cur_price_val
                changed_prices.append({
                    "barcode": lookup_code,
                    "excel_title": title,
                    "current_title": p.get('title') or p.get('title1') or title,
                    "current_price": p.get('price') or "-",
                    "excel_price": price_str,
                    "diff_amount": round(diff, 2),
                    "diff_percent": round((diff / cur_price_val * 100), 1) if cur_price_val > 0 else 0,
                    "brand": p.get('brand', 'DİĞER'),
                    "status": "changed"
                })
            else:
                matched_products.append({
                    "barcode": lookup_code,
                    "excel_title": title,
                    "current_title": p.get('title') or p.get('title1') or title,
                    "current_price": p.get('price') or "-",
                    "excel_price": price_str,
                    "brand": p.get('brand', 'DİĞER'),
                    "status": "matched"
                })
        else:
            # 3. Yeni Ürün
            if price_str and price_str != "0,00 TL":
                cleaned_title = clean_product_title(title)
                new_products.append({
                    "barcode": lookup_code,
                    "excel_title": title,
                    "current_title": cleaned_title,
                    "current_price": "-",
                    "excel_price": price_str,
                    "brand": "DİĞER",
                    "status": "new"
                })

    filename = os.path.basename(excel_path)
    file_mtime = datetime.datetime.fromtimestamp(os.path.getmtime(excel_path)).strftime("%d %b %Y %H:%M")

    result = {
        "status": "success",
        "filename": filename,
        "updated_at": file_mtime,
        "stats": {
            "total_excel_rows": len(seen_barcodes),
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
    """En güncel sistem excel dosyasının analiz durumunu döner."""
    latest_excel = get_latest_excel_path()
    if not latest_excel:
        return jsonify({
            "status": "empty",
            "message": "Henüz yüklenmiş bir sistem excel dosyası bulunamadı."
        })
    res = analyze_excel_diff(latest_excel)
    return jsonify(res)

@app.route("/api/catalog/excel-history", methods=["GET"])
def api_catalog_excel_history():
    """data/sistem_exceli/ içindeki tüm geçmiş Excel dosyalarının listesini döner."""
    if not os.path.exists(SISTEM_EXCELI_DIR):
        return jsonify({"status": "success", "history": []})

    files = [os.path.join(SISTEM_EXCELI_DIR, f) for f in os.listdir(SISTEM_EXCELI_DIR) if f.endswith('.xlsx') or f.endswith('.xls')]
    files.sort(key=os.path.getmtime, reverse=True)

    history = []
    latest_path = files[0] if files else None

    for idx, fpath in enumerate(files):
        fname = os.path.basename(fpath)
        mtime_dt = datetime.datetime.fromtimestamp(os.path.getmtime(fpath))
        fsize = os.path.getsize(fpath)
        size_str = f"{round(fsize / 1024, 1)} KB" if fsize < 1024*1024 else f"{round(fsize / (1024*1024), 2)} MB"

        history.append({
            "filename": fname,
            "date": mtime_dt.strftime("%d %b %Y %H:%M"),
            "size": size_str,
            "is_latest": (idx == 0)
        })

    return jsonify({"status": "success", "history": history})

@app.route("/api/catalog/excel-detail/<filename>", methods=["GET"])
def api_catalog_excel_detail(filename):
    """Geçmişe ait belirli bir Excel dosyasının salt okunur (readonly) detay analizini döner."""
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

@app.route("/api/catalog/upload-excel", methods=["POST"])
def api_catalog_upload_excel():
    """Yeni bir Excel dosyası yükler, data/sistem_exceli/ altına kaydeder ve diff analizi yapar."""
    if 'file' not in request.files:
        return jsonify({"status": "error", "message": "Yüklenecek dosya seçilmedi."}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"status": "error", "message": "Dosya adı geçersiz."}), 400

    now_str = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    safe_filename = f"stok_{now_str}.xlsx"
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
                "brand": item.get('brand') or "DİĞER",
                "origin": "TÜRKİYE",
                "price": formatted_price,
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

# --- YEDEKLEME & GERİ YÜKLEME (ROLLBACK) ENDPOINTLERİ ---

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

        data = {
            "title1": t1,
            "title2": t2,
            "brand": str(p.get("brand") or "YARENLER"),
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

    print("=" * 70)
    print("[BASLATILDI] Market Raf Etiketi Paneli & Canlı Mobil Terminal")
    print(f"[*] Masaustu Panel       : {url}")
    print(f"[*] Mobil HTTP (Normal)  : {mobile_http}")
    if mobile_https:
        print(f"[*] Mobil HTTPS (Kamera) : {mobile_https}")
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
