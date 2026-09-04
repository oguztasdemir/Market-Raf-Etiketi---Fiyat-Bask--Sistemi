# -*- coding: utf-8 -*-
"""
DIGI SM-100 Dosya Üretimi, Binary Paket ve DAT/CSV Servisi
"""
import os
from backend.ayarlar import MANAV_PRODUCTS_FILE, SCALE_SETTINGS_FILE, SCALE_TOOLS_DIR
from backend.araclar.depolama_araclari import load_json, save_json

def get_manav_products() -> list:
    return load_json(MANAV_PRODUCTS_FILE, [])


def _parse_price_to_cents(price_str: str) -> int:
    """Fiyat metnini (Örn: '47.95', '47,95 TL') kuruş tamsayı değerine çevirir (4795)."""
    if not price_str:
        return 0
    clean = str(price_str).replace("TL", "").replace("tl", "").replace("₺", "").replace("/Kg", "").replace("/kg", "").replace("/KG", "").replace("/Kg", "").strip().replace(" ", "")
    if not clean:
        return 0
    if '.' in clean and ',' in clean:
        last_comma = clean.rfind(',')
        last_dot = clean.rfind('.')
        if last_comma > last_dot:
            clean = clean[:last_comma].replace('.', '').replace(',', '') + '.' + clean[last_comma+1:]
        else:
            clean = clean[:last_dot].replace(',', '').replace('.', '') + '.' + clean[last_dot+1:]
    elif ',' in clean:
        clean = clean.replace(',', '.')
    try:
        return int(round(float(clean) * 100))
    except Exception:
        return 0

def format_teraoka_plu_packets(plu: int, title: str, price_str: str, barcode: str, dept: int = 1) -> list:
    """
    Teraoka / DIGI (SM-100 / SM-300 / SM-500 / SM-5100) teraziler için
    tam uyumlu Türkçe (CP1254) çoklu ethernet PLU güncelleme paketleri üretir.
    """
    cents = _parse_price_to_cents(price_str)
    price_val_str = f"{cents / 100:.2f}"
    # Türkçe CP1254 uyumlu temiz ürün adı (Maks 30 karakter)
    clean_name = str(title).strip()[:30]
    
    if not barcode:
        barcode = f"27{plu:05d}"

    packets = []

    # 1. DIGI TWP CSV Standart Formatları (CRLF)
    packets.append(f"{plu},{barcode},{cents},{clean_name}\r\n".encode("cp1254", errors="ignore"))
    packets.append(f"{plu},{cents},{clean_name}\r\n".encode("cp1254", errors="ignore"))
    packets.append(f"{plu},{price_val_str},{clean_name}\r\n".encode("cp1254", errors="ignore"))

    # 2. DIGI SM-100 / SM-5100 Binary PLU Formatı (STX + 01 + 01 + PLU6 + CENTS8 + NAME30 + ETX)
    packets.append(f"\x020101{plu:06d}{cents:08d}{clean_name:<30}\x03".encode("cp1254", errors="ignore"))
    packets.append(f"\x020101{plu:06d}{cents:08d}{clean_name}\x03\r\n".encode("cp1254", errors="ignore"))

    # 3. DIGI F-Frame Formatı (STX + F + DEPT + PLU6 + CENTS8 + NAME + ETX + CRLF)
    packets.append(f"\x02F{dept:02d}{plu:06d}{cents:08d}{clean_name}\x03\r\n".encode("cp1254", errors="ignore"))
    packets.append(f"\x02F00{plu:06d}{cents:08d}{clean_name}\x03\r\n".encode("cp1254", errors="ignore"))

    # 4. Teraoka 0xF1 / 0xF2 Çerçeveli Paketler
    packets.append(bytes([0xF1]) + f"0101{plu:06d}{cents:08d}{clean_name:<30}".encode("cp1254", errors="ignore") + bytes([0xF2]))
    packets.append(bytes([0xF1]) + f"{plu},{barcode},{cents},{clean_name}\r\n".encode("cp1254", errors="ignore") + bytes([0xF2]))

    # 5. Eğer PLU < 1000 ise, yaygın 1000+PLU (1001, 1002...) eşdeğerini de kapsa
    if plu < 1000:
        alt_plu = 1000 + plu
        packets.append(f"{alt_plu},{barcode},{cents},{clean_name}\r\n".encode("cp1254", errors="ignore"))
        packets.append(f"\x020101{alt_plu:06d}{cents:08d}{clean_name:<30}\x03".encode("cp1254", errors="ignore"))
        packets.append(f"\x02F{dept:02d}{alt_plu:06d}{cents:08d}{clean_name}\x03\r\n".encode("cp1254", errors="ignore"))
        packets.append(bytes([0xF1]) + f"0101{alt_plu:06d}{cents:08d}{clean_name:<30}".encode("cp1254", errors="ignore") + bytes([0xF2]))

    return packets

def export_scale_files(products: list = None) -> dict:
    """
    Tüm manav ürünlerini standart DIGI / Teraoka uyumlu dışa aktarım dosyalarına yazar.
    (PLU.CSV, PLU.TXT, PLU.DAT)
    """
    from backend.ayarlar import SCALE_EXPORT_DIR
    if products is None:
        products = get_manav_products()

    os.makedirs(SCALE_EXPORT_DIR, exist_ok=True)

    csv_path = os.path.join(SCALE_EXPORT_DIR, "PLU.CSV")
    txt_path = os.path.join(SCALE_EXPORT_DIR, "PLU.TXT")
    dat_path = os.path.join(SCALE_EXPORT_DIR, "PLU.DAT")

    try:
        # 1. DIGI TWP CSV Dosyası: PLU,BARCODE,PRICE_CENTS,NAME,UNIT,DEPT
        with open(csv_path, mode="w", encoding="cp1254", errors="ignore") as f:
            f.write("PLU,BARCODE,PRICE,NAME,UNIT,DEPT\n")
            for p in products:
                plu = int(p.get("plu", 1))
                title = str(p.get("title", "")).strip()[:30]
                cents = _parse_price_to_cents(p.get("price", "0"))
                bc = p.get("barcode") or f"27{plu:05d}"
                unit = p.get("unit", "Kg")
                f.write(f"{plu},{bc},{cents},{title},{unit},1\n")

        # 2. DIGI SM-100 Text Export: PLU | FİYAT | İSİM | BARKOD
        with open(txt_path, mode="w", encoding="cp1254", errors="ignore") as f:
            for p in products:
                plu = int(p.get("plu", 1))
                title = str(p.get("title", "")).strip()[:30]
                price = str(p.get("price", "0,00 TL"))
                bc = p.get("barcode") or f"27{plu:05d}"
                f.write(f"PLU:{plu:04d} | BARKOD:{bc} | FIYAT:{price:<10} | URUN:{title}\n")

        # 3. DIGI SM-100 Standart DAT Dosyası
        dat_content = generate_digi_sm100_dat(products)
        with open(dat_path, mode="wb") as f:
            f.write(dat_content)

        return {"status": "success", "count": len(products), "dir": SCALE_EXPORT_DIR}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def generate_digi_sm100_dat(products: list) -> bytes:
    """
    Manav ürünleri listesinden resmi DIGI SM-100/SM-300 uyumlu 176-byte sabit kayıtlı
    SENDPLU.DAT / F37 ikili veri içeriğini üretir.
    """
    blocks = []
    tr_map = {'Ç': 'C', 'Ğ': 'G', 'İ': 'I', 'I': 'I', 'Ö': 'O', 'Ş': 'S', 'Ü': 'U'}
    
    for p in products:
        try:
            plu = int(p.get("plu", 1))
        except:
            plu = 1
            
        cents = _parse_price_to_cents(p.get("price", "0"))
        title = str(p.get("title", "")).strip().upper()
        for k, v in tr_map.items():
            title = title.replace(k, v)
            
        name_bytes = title.encode('ascii', errors='ignore')[:36]
        name_hex = ('19' + name_bytes.hex().upper()).ljust(80, '0')
        
        plu_f = f"{plu:08d}"
        flags_f = "00587C004DA0"
        price_f = f"0C00{cents:06d}"
        barcode_f = f"11052701{plu:03d}0000000100000000000007"
        
        rec = (plu_f + flags_f + price_f + barcode_f + name_hex).ljust(176, '0')[:176]
        blocks.append(rec)
        
    return "".join(blocks).encode('ascii')

