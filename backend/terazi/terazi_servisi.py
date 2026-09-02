# -*- coding: utf-8 -*-
"""
Manav & Barkodlu Terazi (DIGI / TERAOKA vb.) İletişim ve PLU Yönetim Servisi
"""
import os
import re
import time
import socket
import datetime
import binascii
import subprocess
import threading
from backend.ayarlar import MANAV_PRODUCTS_FILE, SCALE_SETTINGS_FILE, SCALE_TOOLS_DIR
from backend.araclar.depolama_araclari import load_json, save_json

_SCALE_MUTEX = threading.Lock()

DEFAULT_SCALE_SETTINGS = {
    "ip": "192.168.1.61",
    "port": 2061,
    "scale_model": "DIGI SM-100",
    "protocol": "DIGI_SM100_ETHERNET",
    "dept_code": 1,
    "barcode_prefix": "27",
    "timeout_sec": 2.5,
    "scales_list": [
        {
            "id": "scale_main",
            "name": "Manav Terazisi (Ana)",
            "ip": "192.168.1.61",
            "port": 2061,
            "department": "Manav",
            "model": "DIGI SM-100",
            "is_active": True
        }
    ]
}

def get_scale_settings() -> dict:
    """Terazi ayarlarını yükler veya varsayılanları döner."""
    settings = load_json(SCALE_SETTINGS_FILE, DEFAULT_SCALE_SETTINGS)
    if not isinstance(settings, dict):
        settings = DEFAULT_SCALE_SETTINGS.copy()
    for k, v in DEFAULT_SCALE_SETTINGS.items():
        if k not in settings:
            settings[k] = v
    if not settings.get("scales_list"):
        settings["scales_list"] = DEFAULT_SCALE_SETTINGS["scales_list"]
    return settings

def save_scale_settings(new_settings: dict) -> dict:
    """Terazi ayarlarını günceller."""
    current = get_scale_settings()
    current.update(new_settings)
    save_json(SCALE_SETTINGS_FILE, current)
    return current

def get_scales_pool() -> list:
    """Kayıtlı tüm terazi havuzunu döner."""
    cfg = get_scale_settings()
    return cfg.get("scales_list", DEFAULT_SCALE_SETTINGS["scales_list"])

def save_scales_pool(pool: list) -> list:
    """Terazi havuzunu günceller."""
    cfg = get_scale_settings()
    cfg["scales_list"] = pool
    save_scale_settings(cfg)
    return pool

def get_manav_products() -> list:
    """Manav ürünlerini PLU sırasına göre yükler."""
    data = load_json(MANAV_PRODUCTS_FILE, [])
    if not isinstance(data, list):
        return []

    # PLU numarasına göre sırala
    return sorted(data, key=lambda x: int(x.get("plu", 9999)))

def save_all_manav_products(products: list):
    """Manav ürün listesini kaydeder."""
    sorted_prods = sorted(products, key=lambda x: int(x.get("plu", 9999)))
    save_json(MANAV_PRODUCTS_FILE, sorted_prods)

def _decode_digi_name(block: str, plu: int, existing_map: dict = None) -> str:
    """
    DIGI SM-100 176-byte kaydından ürün adını çözer.
    Hatalı HEX veya eksikliklerde mevcut manav adını korur, asla 'ÜRÜN X' üretmez.
    """
    import binascii
    import re

    # 1. 62 - 142 isim bloğundaki HEX'i dene
    name_seg = block[62:142] if len(block) >= 142 else ""
    clean_hex = re.sub(r'[^0-9A-Fa-f]', '', name_seg)
    if clean_hex.startswith('0719'):
        clean_hex = clean_hex[4:]
    elif clean_hex.startswith('19'):
        clean_hex = clean_hex[2:]

    clean_hex = clean_hex.rstrip('0')
    if len(clean_hex) % 2 != 0:
        clean_hex = clean_hex[:-1]

    if clean_hex:
        try:
            decoded = bytes.fromhex(clean_hex).decode("cp1254", errors="ignore").strip()
            if len(decoded) >= 2:
                return decoded
        except Exception:
            pass

    # 2. 0719 veya 19 regex aramasını dene
    m_name = re.search(r'(?:0719|19)([0-9A-Fa-f]{6,})', block)
    if m_name:
        h_str = m_name.group(1).rstrip('0')
        if len(h_str) % 2 != 0:
            h_str = h_str[:-1]
        try:
            decoded = bytes.fromhex(h_str).decode("cp1254", errors="ignore").strip()
            if len(decoded) >= 2:
                return decoded
        except Exception:
            pass

    # 3. Mevcut manav kataloğundaki ismi koru
    if existing_map and plu in existing_map:
        ex_title = existing_map[plu].get("title", "")
        if ex_title and not ex_title.upper().startswith("ÜRÜN "):
            return ex_title

    return f"MNV ÜRÜN {plu}"

def fetch_prices_from_scale(ip=None) -> dict:
    """
    DIGI SM-100 terazisinin hafızasındaki (NVRAM) tüm gerçek ürünleri,
    PLU numaralarını, barkodlarını ve güncel fiyatlarını doğrudan çeker.
    """
    import binascii
    import re
    import subprocess

    cfg = get_scale_settings()
    target_ip = ip or cfg.get("ip", "192.168.1.61")
    
    tools_dir = SCALE_TOOLS_DIR
    exe_path = os.path.join(tools_dir, "digiwtcp.exe")

    if not os.path.exists(exe_path):
        return {
            "status": "error",
            "message": f"DIGI iletişim motoru ({exe_path}) bulunamadı."
        }

    try:
        f37_path = os.path.join(tools_dir, f"SM{target_ip}F37.DAT")
        # 1. Teraziden tüm hafızayı oku (RD 37) - Mutex korumalı
        with _SCALE_MUTEX:
            if os.path.exists(f37_path):
                try:
                    os.remove(f37_path)
                except Exception:
                    pass

            res = subprocess.run([exe_path, "RD", "37", target_ip], cwd=tools_dir, capture_output=True, text=True, timeout=8)
            
            if not os.path.exists(f37_path):
                return {
                    "status": "error",
                    "message": f"Terazi yanıt vermedi veya veri dosyası ({f37_path}) oluşturulamadı."
                }

            with open(f37_path, "rb") as f:
                raw = f.read().decode("ascii", errors="ignore")


        BLOCK_SIZE = 176
        total_blocks = len(raw) // BLOCK_SIZE
        products = []
        existing_list = get_manav_products()
        existing_map = {int(p["plu"]): p for p in existing_list if "plu" in p}

        for i in range(total_blocks):
            block = raw[i * BLOCK_SIZE : (i + 1) * BLOCK_SIZE]
            try:
                plu_str = block[:8]
                if not plu_str.isdigit(): continue
                plu = int(plu_str)
                if plu <= 0: continue

                price_cents = 0
                barcode = f"27{plu:05d}"

                m_price_bc = re.search(r'([0-9]{8})1105([0-9]{7})', block)
                if m_price_bc:
                    price_cents = int(m_price_bc.group(1))
                    barcode = m_price_bc.group(2)
                else:
                    m_price = re.search(r'00C0([0-9]{8})', block)
                    if m_price:
                        price_cents = int(m_price.group(1))

                name = _decode_digi_name(block, plu, existing_map)
                price_tl = f"{price_cents / 100:.2f}".replace(".", ",") + " TL"

                products.append({
                    "plu": plu,
                    "barcode": barcode,
                    "stock_code": barcode,
                    "title": name,
                    "price": price_tl,
                    "scale_price": price_tl,
                    "unit": "Kg",
                    "origin": "TÜRKİYE",
                    "sync_status": "synced"
                })
            except:
                pass

        # Tekilleştir ve sırala
        seen = set()
        unique_prods = []
        for p in sorted(products, key=lambda x: x.get("plu", 0)):
            if p.get("plu") and p["plu"] not in seen:
                seen.add(p["plu"])
                unique_prods.append(p)

        # Mevcut Adet / Demet ürünlerini teraziden gelen listeye dahil et (koru)
        adet_items = [x for x in existing_list if (x.get('unit') or '').lower() in ('adet', 'demet', 'paket', 'pk')]
        for a_it in adet_items:
            if a_it.get("plu") and a_it["plu"] not in seen:
                seen.add(a_it["plu"])
                unique_prods.append(a_it)
            elif not a_it.get("plu"):
                unique_prods.append(a_it)

        if not unique_prods:
            return {
                "status": "error",
                "message": "Teraziden geçerli ürün kaydı alınamadı."
            }

        save_all_manav_products(unique_prods)
        export_scale_files(unique_prods)

        return {
            "status": "success",
            "message": f"Teraziden {len(unique_prods)} adet güncel ürün adı ve fiyatı başarıyla çekildi!",
            "count": len(unique_prods),
            "products": unique_prods
        }

    except subprocess.TimeoutExpired:
        return {
            "status": "error",
            "message": f"Teraziye bağlanırken zaman aşımı oluştu ({target_ip}). Lütfen ağ kablosunu kontrol edin."
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Teraziden veri okuma hatası: {str(e)}"
        }

def stream_fetch_prices_from_scale(ip=None):
    """
    DIGI SM-100 terazisinden ürünleri ve fiyatları çekerken adım adım
    canlı ilerleme çubuğu, yüzde ve ürün detayları akışı (generator) üretir.
    """
    import binascii
    import re
    import subprocess

    cfg = get_scale_settings()
    target_ip = ip or cfg.get("ip", "192.168.1.61")
    target_port = int(cfg.get("port", 2061))

    # 1. Başlangıç Durumu
    yield {
        "type": "init",
        "current": 0,
        "total": 0,
        "percent": 0,
        "message": f"DIGI SM-100 ({target_ip}:{target_port}) terazisine bağlanılıyor..."
    }

    # 2. Fiziksel Bağlantı Denetimi
    conn_test = test_scale_connection(target_ip, target_port)
    if not conn_test.get("online"):
        yield {
            "type": "error",
            "message": f"Teraziye ulaşılamıyor ({target_ip}:{target_port}). Lütfen terazinin açık olduğundan ve ağ kablosunun takılı olduğundan emin olun."
        }
        return

    tools_dir = SCALE_TOOLS_DIR
    exe_path = os.path.join(tools_dir, "digiwtcp.exe")

    if not os.path.exists(exe_path):
        yield {
            "type": "error",
            "message": f"DIGI iletişim motoru ({exe_path}) bulunamadı."
        }
        return

    try:
        # Teraziden hafızayı oku - Mutex korumalı
        with _SCALE_MUTEX:
            res = subprocess.run([exe_path, "RD", "37", target_ip], cwd=tools_dir, capture_output=True, text=True, timeout=8)
            
            f37_path = os.path.join(tools_dir, f"SM{target_ip}F37.DAT")
            if not os.path.exists(f37_path):
                yield {
                    "type": "error",
                    "message": f"Terazi yanıt vermedi veya veri dosyası ({f37_path}) oluşturulamadı."
                }
                return

            with open(f37_path, "rb") as f:
                raw = f.read().decode("ascii", errors="ignore")

        BLOCK_SIZE = 176
        total_blocks = len(raw) // BLOCK_SIZE
        products = []
        existing_list = get_manav_products()
        existing_map = {int(p["plu"]): p for p in existing_list if "plu" in p}

        for i in range(total_blocks):
            block = raw[i * BLOCK_SIZE : (i + 1) * BLOCK_SIZE]
            try:
                plu_str = block[:8]
                if not plu_str.isdigit(): continue
                plu = int(plu_str)
                if plu <= 0: continue

                price_cents = 0
                barcode = f"27{plu:05d}"

                m_price_bc = re.search(r'([0-9]{8})1105([0-9]{7})', block)
                if m_price_bc:
                    price_cents = int(m_price_bc.group(1))
                    barcode = m_price_bc.group(2)
                else:
                    m_price = re.search(r'00C0([0-9]{8})', block)
                    if m_price:
                        price_cents = int(m_price.group(1))

                name = _decode_digi_name(block, plu, existing_map)
                price_tl = f"{price_cents / 100:.2f}".replace(".", ",") + " TL"

                products.append({
                    "plu": plu,
                    "barcode": barcode,
                    "stock_code": barcode,
                    "title": name,
                    "price": price_tl,
                    "scale_price": price_tl,
                    "unit": "Kg",
                    "origin": "TÜRKİYE",
                    "sync_status": "synced"
                })
            except:
                pass

        # Tekilleştir ve sırala
        seen = set()
        unique_prods = []
        for p in sorted(products, key=lambda x: x.get("plu", 0)):
            if p.get("plu") and p["plu"] not in seen:
                seen.add(p["plu"])
                unique_prods.append(p)

        # Mevcut Adet / Demet ürünlerini teraziden gelen listeye dahil et (koru)
        adet_items = [x for x in existing_list if (x.get('unit') or '').lower() in ('adet', 'demet', 'paket', 'pk')]
        for a_it in adet_items:
            if a_it.get("plu") and a_it["plu"] not in seen:
                seen.add(a_it["plu"])
                unique_prods.append(a_it)
            elif not a_it.get("plu"):
                unique_prods.append(a_it)

        total = len(unique_prods)
        if total == 0:
            yield {
                "type": "error",
                "message": "Teraziden geçerli ürün kaydı alınamadı."
            }
            return

        # Mevcut veritabanındaki ürünlerle fiyat karşılaştırması yap
        existing_prods = get_manav_products()
        existing_map = {int(x.get("plu", 0)): x for x in existing_prods if x.get("plu")}
        changed_items = []

        for p in unique_prods:
            plu_num = p["plu"]
            if plu_num in existing_map:
                old_p = existing_map[plu_num]
                old_price = old_p.get("price") or old_p.get("scale_price") or "-"
                if old_price != "-" and _parse_price_to_cents(old_price) != _parse_price_to_cents(p["price"]):
                    changed_items.append({
                        "plu": plu_num,
                        "title": p["title"],
                        "barcode": p["barcode"],
                        "old_price": old_price,
                        "new_price": p["price"]
                    })

        # Ürünleri tek tek canlı ilerleme olarak akıt
        for idx, p in enumerate(unique_prods):
            percent = round(((idx + 1) / total) * 100)
            yield {
                "type": "progress",
                "current": idx + 1,
                "total": total,
                "percent": percent,
                "plu": p["plu"],
                "title": p["title"],
                "price": p["price"],
                "item_text": f"[{p['plu']}] {p['title']} - {p['price']}"
            }
            time.sleep(0.012)

        save_all_manav_products(unique_prods)
        export_scale_files(unique_prods)

        yield {
            "type": "complete",
            "current": total,
            "total": total,
            "percent": 100,
            "count": total,
            "changed_count": len(changed_items),
            "changed_items": changed_items,
            "message": f"DIGI SM-100 terazisinden {total} adet ürün ve güncel fiyat başarıyla çekildi!"
        }

    except subprocess.TimeoutExpired:
        yield {
            "type": "error",
            "message": f"Teraziye bağlanırken zaman aşımı oluştu ({target_ip}). Lütfen ağ kablosunu kontrol edin."
        }
    except Exception as e:
        yield {
            "type": "error",
            "message": f"Teraziden veri okuma hatası: {str(e)}"
        }

def test_scale_connection(ip=None, port=None, timeout_sec=None) -> dict:
    """Teraziye TCP socket üzerinden bağlantı testi yapar."""
    cfg = get_scale_settings()
    target_ip = ip or cfg.get("ip", "192.168.1.61")
    target_port = int(port or cfg.get("port", 2061))
    timeout = timeout_sec if timeout_sec is not None else cfg.get("timeout_sec", 1.0)

    t0 = time.time()
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(timeout)
        res = s.connect_ex((target_ip, target_port))
        s.close()
        elapsed_ms = round((time.time() - t0) * 1000, 1)

        if res == 0:
            return {
                "online": True,
                "ip": target_ip,
                "port": target_port,
                "ping_ms": elapsed_ms,
                "message": f"Teraziye bağlantı başarılı ({elapsed_ms} ms)",
                "scale_model": cfg.get("scale_model")
            }
        else:
            return {
                "online": False,
                "ip": target_ip,
                "port": target_port,
                "ping_ms": None,
                "message": f"Port kapalı veya ulaşılamıyor (Hata Kodu: {res})",
                "scale_model": cfg.get("scale_model")
            }
    except Exception as e:
        return {
            "online": False,
            "ip": target_ip,
            "port": target_port,
            "ping_ms": None,
            "message": f"Bağlantı hatası: {str(e)}",
            "scale_model": cfg.get("scale_model")
        }

def _parse_price_to_cents(price_str: str) -> int:
    """Fiyat metnini (Örn: '69,95 TL') kuruş tamsayı değerine çevirir (6995)."""
    if not price_str:
        return 0
    clean = str(price_str).replace("TL", "").replace("₺", "").replace("/Kg", "").replace("/kg", "").strip()
    clean = clean.replace(".", "").replace(",", ".")
    try:
        return int(round(float(clean) * 100))
    except:
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

def send_plu_to_scale(product: dict, ip=None, port=None) -> dict:
    """
    Tek bir PLU ürününü Native DIGI Protokolüyle (Oturum Açma -> Veri -> Commit) teraziye aktarır.
    Adet/Demet ürünleri teraziden muaf tutulur.
    """
    cfg = get_scale_settings()
    target_ip = ip or cfg.get("ip", "192.168.1.61")
    target_port = int(port or cfg.get("port", 2061))

    plu = int(product.get("plu", 1))
    title = product.get("title", "")
    price = product.get("price", "0,00 TL")
    barcode = product.get("barcode", f"27{plu:05d}")
    unit = str(product.get("unit", "Kg")).strip()
    dept = int(cfg.get("dept_code", 1))

    if unit in ["Adet", "Demet", "Paket", "Pk"]:
        return {
            "status": "info",
            "message": f"PLU {plu} ({title}) Adet/Demet ürünüdür; teraziye aktarılmaz, kasada adetli işlem görür.",
            "plu": plu,
            "product": product
        }

    packets = format_teraoka_plu_packets(plu, title, price, barcode, dept)

    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(cfg.get("timeout_sec", 2.5))
        s.connect((target_ip, target_port))

        # 1. DIGI Oturum Başlatma (Session Start)
        s.sendall(bytes([0xF1]) + b'0101' + bytes([0xF2]))
        time.sleep(0.02)
        try:
            s.recv(10)
        except:
            pass

        # 2. Veri Paketleri
        for pkt in packets:
            s.sendall(pkt)
            time.sleep(0.01)

        # 3. DIGI Commit & Hafızaya Yazma (NVRAM Commit)
        commit_packets = [
            bytes([0xF1]) + b'9901' + bytes([0xF2]),
            bytes([0xF1]) + b'0103' + bytes([0xF2]),
            b'\x04', # EOT
            b'\x029901\x03\r\n',
        ]
        for cp in commit_packets:
            s.sendall(cp)
            time.sleep(0.01)

        s.close()

        # Ürünün senkron durumunu güncelle
        now_str = datetime.datetime.now().strftime("%d %b %Y %H:%M")
        products = get_manav_products()
        for p in products:
            if int(p.get("plu", 0)) == plu:
                p["scale_price"] = price
                p["sync_status"] = "synced"
                p["last_synced_at"] = now_str
                break
        save_all_manav_products(products)
        export_scale_files(products)

        return {
            "status": "success",
            "message": f"PLU {plu} ({title} - {price}) teraziye başarıyla aktarıldı ve işlendi.",
            "plu": plu,
            "product": product
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"PLU {plu} teraziye gönderilemedi: {str(e)}",
            "plu": plu
        }

def stream_all_plus_to_scale(ip=None, port=None):
    """
    Tüm manav ürünlerini DIGI SM-100 terazisine aktarırken adım adım
    canlı ilerleme, yüzde ve detaylı hata olayları (generator) üretir.
    Adet/Demet ürünleri teraziden muaf tutularak doğrudan kasada kalır.
    """
    products = get_manav_products()
    if not products:
        yield {
            "type": "error",
            "message": "Gönderilecek kayıtlı manav ürünü bulunamadı. Lütfen önce ürün ekleyin."
        }
        return

    # Adet / Demet ürünleri teraziden muaf tutulur
    kg_products = [p for p in products if p.get("unit", "Kg") not in ["Adet", "Demet", "Paket", "Pk"]]
    if not kg_products:
        yield {
            "type": "error",
            "message": "Teraziye aktarılacak tartım/Kg ürünü bulunamadı."
        }
        return

    total = len(kg_products)
    cfg = get_scale_settings()
    target_ip = ip or cfg.get("ip", "192.168.1.61")
    target_port = int(port or cfg.get("port", 2061))

    # 1. Başlangıç Durumu
    yield {
        "type": "init",
        "current": 0,
        "total": total,
        "percent": 0,
        "message": f"DIGI SM-100 ({target_ip}:{target_port}) bağlantısı kuruluyor... ({total} Tartım/Kg ürünü teraziye aktarılıyor)"
    }

    # 2. Fiziksel Bağlantı Denetimi
    conn_test = test_scale_connection(target_ip, target_port)
    if not conn_test.get("online"):
        yield {
            "type": "error",
            "message": f"Teraziye ulaşılamıyor ({target_ip}:{target_port}). Lütfen terazinin açık olduğundan, ağ kablosunun takılı olduğundan ve aynı ağda (Wi-Fi/Ethernet) bulunduğunuzdan emin olun."
        }
        return

    success_count = 0
    fail_count = 0
    changed_items = []
    now_str = datetime.datetime.now().strftime("%d %b %Y %H:%M")

    try:
        # 3. DIGI F37 Veri Dosyasını Güncelle
        tools_dir = SCALE_TOOLS_DIR
        exe_path = os.path.join(tools_dir, "digiwtcp.exe")
        f37_path = os.path.join(tools_dir, f"SM{target_ip}F37.DAT")

        if not os.path.exists(f37_path) and os.path.exists(exe_path):
            subprocess.run([exe_path, "RD", "37", target_ip], cwd=tools_dir, capture_output=True, timeout=8)

        raw = b""
        if os.path.exists(f37_path):
            with open(f37_path, "rb") as f:
                raw = f.read()

        raw_str = raw.decode("ascii", errors="ignore")
        BLOCK_SIZE = 176
        total_blocks = len(raw_str) // BLOCK_SIZE
        prod_map = {int(p.get("plu", 0)): p for p in kg_products if p.get("plu")}
        new_blocks = []

        for i in range(total_blocks):
            block = raw_str[i * BLOCK_SIZE : (i + 1) * BLOCK_SIZE]
            plu_str = block[:8]
            if plu_str.isdigit():
                plu_val = int(plu_str)
                if plu_val in prod_map:
                    p = prod_map[plu_val]
                    cents = _parse_price_to_cents(p.get("price", "0"))
                    new_price_str = f"{cents:08d}"
                    block = re.sub(r'[0-9]{8}(1105[0-9]{7})', f'{new_price_str}\\1', block, count=1)
            new_blocks.append(block)

        updated_raw = "".join(new_blocks).encode("ascii")
        if len(raw) > len(updated_raw):
            updated_raw += raw[len(updated_raw):]

        with open(f37_path, "wb") as f:
            f.write(updated_raw)

        # SENDING klasörünü de senkronize et
        sending_dir = os.path.join(tools_dir, "SENDING")
        os.makedirs(sending_dir, exist_ok=True)
        with open(os.path.join(sending_dir, "SENDPLU.DAT"), "wb") as f:
            f.write(updated_raw)
        with open(os.path.join(tools_dir, "SENDPLU.DAT"), "wb") as f:
            f.write(updated_raw)

        # 4. Sadece Tartım/Kg Ürünlerini Canlı İlerleme Olarak Akıt
        for idx, p in enumerate(kg_products):
            plu = int(p.get("plu", 1))
            title = str(p.get("title", ""))
            price = str(p.get("price", "0,00 TL"))
            barcode = p.get("barcode", f"27{plu:05d}")
            old_scale_price = p.get("scale_price") or "-"

            is_changed = False
            if old_scale_price != "-" and old_scale_price != price:
                if _parse_price_to_cents(old_scale_price) != _parse_price_to_cents(price):
                    is_changed = True
                    changed_items.append({
                        "plu": plu,
                        "title": title,
                        "barcode": barcode,
                        "old_price": old_scale_price,
                        "new_price": price
                    })

            p["scale_price"] = price
            p["sync_status"] = "synced"
            p["last_synced_at"] = now_str
            success_count += 1

            percent = round(((idx + 1) / total) * 100)
            yield {
                "type": "progress",
                "current": idx + 1,
                "total": total,
                "percent": percent,
                "plu": plu,
                "title": title,
                "price": price,
                "is_changed": is_changed,
                "old_price": old_scale_price,
                "item_text": f"[{plu}] {title} - {price}"
            }
            time.sleep(0.012)

        # 5. DIGI Motoruyla Teraziye Yaz (WR 37) - Mutex Korumalı
        with _SCALE_MUTEX:
            wr_res = subprocess.run([exe_path, "WR", "37", target_ip], cwd=tools_dir, capture_output=True, text=True, timeout=10)
        
        # Adet ürünleri de güncelle
        for p in products:
            if p.get("unit") in ["Adet", "Demet", "Paket", "Pk"]:
                p["sync_status"] = "adet_muaf"
                p["last_synced_at"] = now_str

        save_all_manav_products(products)
        export_scale_files(products)

        yield {
            "type": "complete",
            "current": total,
            "total": total,
            "percent": 100,
            "success_count": success_count,
            "fail_count": fail_count,
            "changed_count": len(changed_items),
            "changed_items": changed_items,
            "message": f"{total} Tartım ürünü DIGI SM-100 terazisine aktarıldı (Adet ürünler muaf tutuldu)."
        }
    except Exception as e:
        yield {
            "type": "error",
            "message": f"Teraziye veri aktarımı sırasında hata oluştu: {str(e)}"
        }

def send_all_plus_to_scale(ip=None, port=None) -> dict:
    """
    Tüm tartım/kg manav ürünlerini DIGI motoruyla teraziye aktarır.
    Adet/Demet ürünleri teraziden muaf tutulur.
    """
    products = get_manav_products()
    if not products:
        return {"status": "error", "message": "Gönderilecek manav ürünü bulunamadı."}

    kg_products = [p for p in products if p.get("unit", "Kg") not in ["Adet", "Demet", "Paket", "Pk"]]
    if not kg_products:
        return {"status": "error", "message": "Teraziye aktarılacak tartım/Kg ürünü bulunamadı."}

    cfg = get_scale_settings()
    target_ip = ip or cfg.get("ip", "192.168.1.61")

    tools_dir = SCALE_TOOLS_DIR
    exe_path = os.path.join(tools_dir, "digiwtcp.exe")
    f37_path = os.path.join(tools_dir, f"SM{target_ip}F37.DAT")

    try:
        with _SCALE_MUTEX:
            raw = b""
            if os.path.exists(f37_path):
                with open(f37_path, "rb") as f:
                    raw = f.read()
            elif os.path.exists(exe_path):
                subprocess.run([exe_path, "RD", "37", target_ip], cwd=tools_dir, capture_output=True, timeout=8)
                if os.path.exists(f37_path):
                    with open(f37_path, "rb") as f:
                        raw = f.read()

            raw_str = raw.decode("ascii", errors="ignore")
            BLOCK_SIZE = 176
            total_blocks = len(raw_str) // BLOCK_SIZE
            prod_map = {int(p.get("plu", 0)): p for p in kg_products if p.get("plu")}
            new_blocks = []

            for i in range(total_blocks):
                block = raw_str[i * BLOCK_SIZE : (i + 1) * BLOCK_SIZE]
                plu_str = block[:8]
                if plu_str.isdigit():
                    plu_val = int(plu_str)
                    if plu_val in prod_map:
                        p = prod_map[plu_val]
                        cents = _parse_price_to_cents(p.get("price", "0"))
                        new_price_str = f"{cents:08d}"
                        block = re.sub(r'[0-9]{8}(1105[0-9]{7})', f'{new_price_str}\\1', block, count=1)
                new_blocks.append(block)

            updated_raw = "".join(new_blocks).encode("ascii")
            if len(raw) > len(updated_raw):
                updated_raw += raw[len(updated_raw):]

            with open(f37_path, "wb") as f:
                f.write(updated_raw)

            sending_dir = os.path.join(tools_dir, "SENDING")
            os.makedirs(sending_dir, exist_ok=True)
            with open(os.path.join(sending_dir, "SENDPLU.DAT"), "wb") as f:
                f.write(updated_raw)
            with open(os.path.join(tools_dir, "SENDPLU.DAT"), "wb") as f:
                f.write(updated_raw)

            now_str = datetime.datetime.now().strftime("%d %b %Y %H:%M")
            for p in products:
                p["scale_price"] = p.get("price")
                p["sync_status"] = "synced"
                p["last_synced_at"] = now_str

            wr_res = subprocess.run([exe_path, "WR", "37", target_ip], cwd=tools_dir, capture_output=True, text=True, timeout=10)

        save_all_manav_products(products)
        export_scale_files(products)

        return {
            "status": "success",
            "message": f"Tüm fiyatlar ({len(products)} ürün) DIGI SM-100 terazisine başarıyla aktarıldı.",
            "total": len(products),
            "success_count": len(products),
            "fail_count": 0
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Toplu gönderim sırasında hata oluştu: {str(e)}"
        }

def parse_scale_data_packet(data_bytes: bytes) -> list:
    """
    DIGI / Teraoka teraziden gelen ham veri paketlerini (Binary / ASCII / TWP) ayrıştırır.
    Dönen liste: [{'plu': int, 'price': str, 'title': str, 'barcode': str}]
    """
    results = []
    if not data_bytes:
        return results

    # 1. DIGI TWP CSV Satırları kontrolü (Örn: "1,2700001,6995,DOMATES\r\n")
    try:
        text_data = data_bytes.decode('utf-8', errors='ignore')
        lines = text_data.replace('\r', '\n').split('\n')
        for line in lines:
            parts = [p.strip() for p in line.split(',') if p.strip()]
            if len(parts) >= 3 and parts[0].isdigit():
                plu_val = int(parts[0])
                cents = int(parts[2]) if parts[2].isdigit() else 0
                price_str = f"{cents / 100:.2f}".replace('.', ',') + " TL"
                name = parts[3] if len(parts) > 3 else ""
                results.append({
                    "plu": plu_val,
                    "price": price_str,
                    "title": name,
                    "barcode": parts[1] if len(parts) > 1 else f"27{plu_val:05d}"
                })
        if results:
            return results
    except Exception:
        pass

    # 2. DIGI SM-100 Binary PLU Paketleri (\x02 ... \x03)
    # Format: STX(1) + CMD(2) + DEPT(2) + PLU(6) + PRICE(8) + NAME(30) + ETX(1)
    stx = 0x02
    etx = 0x03
    i = 0
    while i < len(data_bytes):
        if data_bytes[i] == stx:
            end_idx = data_bytes.find(bytes([etx]), i + 1)
            if end_idx != -1:
                packet = data_bytes[i + 1:end_idx]
                try:
                    pkt_str = packet.decode('utf-8', errors='ignore')
                    # Fxx veya 01xx kontrolü
                    if len(pkt_str) >= 16:
                        # PLU 6 basamak, Fiyat 8 basamak
                        plu_part = pkt_str[3:9] if pkt_str.startswith('F') else pkt_str[4:10]
                        price_part = pkt_str[9:17] if pkt_str.startswith('F') else pkt_str[10:18]
                        name_part = pkt_str[17:] if pkt_str.startswith('F') else pkt_str[18:]

                        if plu_part.isdigit() and price_part.isdigit():
                            plu_val = int(plu_part)
                            cents = int(price_part)
                            price_str = f"{cents / 100:.2f}".replace('.', ',') + " TL"
                            results.append({
                                "plu": plu_val,
                                "price": price_str,
                                "title": name_part.strip(),
                                "barcode": f"27{plu_val:05d}"
                            })
                except Exception:
                    pass
                i = end_idx + 1
                continue
        i += 1

    return results

def read_prices_from_scale_hardware(ip=None, port=None) -> dict:
    """
    Doğrudan fiziksel terazinin (192.168.1.61:2061) hafızasına TCP soket sorgusu göndererek
    terazideki orijinal PLU ve fiyat kayıtlarını çeker. Asla CSV veya yerel dosyadan veri almaz.
    """
    cfg = get_scale_settings()
    target_ip = ip or cfg.get("ip", "192.168.1.61")
    target_port = int(port or cfg.get("port", 2061))
    timeout = cfg.get("timeout_sec", 3.0)

    # 1. Fiziksel Bağlantı Testi
    conn_check = test_scale_connection(target_ip, target_port)
    if not conn_check.get("online"):
        return {
            "status": "error",
            "message": f"Teraziye ulaşılamıyor ({target_ip}:{target_port}). Lütfen terazinin açık ve ağ kablosunun takılı olduğunu kontrol edin.",
            "scale_online": False,
            "items": []
        }

    raw_items = []
    received_bytes = bytearray()

    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(timeout)
        s.connect((target_ip, target_port))

        # Teraoka / DIGI PLU okuma sorgu komutları
        # 1. 0xF1 + '0100' (PLU All Read Inquiry) + 0xF2
        # 2. 0xF1 + '01' + 0xF2
        # 3. TWP Read komutları
        inquiry_packets = [
            bytes([0xF1]) + b'0100' + bytes([0xF2]),
            bytes([0xF1]) + b'01' + bytes([0xF2]),
            b'R,PLU\r\n',
            b'\x020100\x03\r\n'
        ]

        for pkt in inquiry_packets:
            try:
                s.sendall(pkt)
                time.sleep(0.05)
                # Yanıtı oku
                while True:
                    try:
                        chunk = s.recv(1024)
                        if not chunk:
                            break
                        received_bytes.extend(chunk)
                        # ACK alındıysa devamı için ACK ilet
                        if chunk == b'\x06':
                            s.sendall(b'\x06')
                        if len(chunk) < 1024:
                            break
                    except socket.timeout:
                        break
            except Exception:
                pass

        s.close()
    except Exception as e:
        return {
            "status": "error",
            "message": f"Teraziden veri okuma sırasında soket hatası: {str(e)}",
            "scale_online": True,
            "items": []
        }

    # Gelen ham veriyi ayrıştır
    if received_bytes:
        raw_items = parse_scale_data_packet(bytes(received_bytes))

    return {
        "status": "success",
        "scale_online": True,
        "raw_bytes_len": len(received_bytes),
        "items": raw_items
    }
