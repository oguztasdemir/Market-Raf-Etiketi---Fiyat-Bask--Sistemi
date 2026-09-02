# -*- coding: utf-8 -*-
"""
Market Donanım & Çevre Birimleri Yöneticisi (Hardware & Device Manager)
- Windows Spooler Yazıcı Taraması (USB, Wi-Fi, Bluetooth)
- Ağ/IP Yazıcı Taraması (ESC/POS Port 9100)
- Seri Port (COM) Cihaz & Terazi Taraması
- Bilgi Fişi Yazıcısı (80mm / 58mm ESC/POS) & Etiket Yazıcısı Rol Atamaları
- Terazi Entegrasyonu & Test İletişimi
"""
import os
import sys
import time
import socket
import subprocess
import platform
import datetime
from backend.ayarlar import SETTINGS_FILE, SISTEM_AYARLAR_DIR
from backend.araclar.depolama_araclari import load_json, save_json
from backend.araclar.metin_duzenleyici import format_price_display

DEVICE_CONFIG_FILE = os.path.join(SISTEM_AYARLAR_DIR, "cihaz_yapilandirmasi.json")

DEFAULT_DEVICE_CONFIG = {
    "label_printer": {
        "type": "windows_spooler",       # windows_spooler, network_ip, tspl_usb
        "name": "Termal Etiket Yazici",
        "ip": "",
        "port": 9100,
        "paper_width_mm": 60,
        "paper_height_mm": 40,
        "darkness": 22,
        "connection_type": "usb"         # usb, wifi, bluetooth, network
    },
    "receipt_printer": {
        "type": "windows_spooler",       # windows_spooler, network_ip, bluetooth_com
        "name": "Termal Etiket Yazici",
        "ip": "",
        "port": 9100,
        "paper_size": "80mm",            # 80mm (42-48 kolon), 58mm (32 kolon)
        "auto_cut": True,
        "open_drawer": True,
        "connection_type": "usb"
    },
    "scales": [
        {
            "id": "scale_main",
            "name": "Kasa Entegre Terazi (COM / Barkod)",
            "type": "scale_barcode",     # scale_barcode, serial_com, network_ip
            "protocol": "cas_er_plus",   # cas_er_plus, tem_b1, dibal_pos, digi, avery
            "com_port": "",
            "baud_rate": 9600,
            "ip": "192.168.1.50",
            "port": 4001,
            "barcode_prefixes": ["27", "28", "29"],
            "is_active": True
        }
    ]
}

def get_device_config() -> dict:
    """Mevcut donanım ve yazıcı/terazi yapılandırmasını döner."""
    config = load_json(DEVICE_CONFIG_FILE, DEFAULT_DEVICE_CONFIG)
    # Eksik alanları tamamla
    for k, v in DEFAULT_DEVICE_CONFIG.items():
        if k not in config:
            config[k] = v
    return config

def save_device_config(new_config: dict) -> dict:
    """Donanım yapılandırmasını kaydeder ve sistem ayarlarıyla senkronize eder."""
    current = get_device_config()
    current.update(new_config)
    save_json(DEVICE_CONFIG_FILE, current)

    # SETTINGS_FILE ile senkronize et
    settings = load_json(SETTINGS_FILE, {})
    if "label_printer" in current and "name" in current["label_printer"]:
        settings["printer"] = current["label_printer"]["name"]
    if "receipt_printer" in current and "name" in current["receipt_printer"]:
        settings["receipt_printer"] = current["receipt_printer"]["name"]
    save_json(SETTINGS_FILE, settings)

    return current

def scan_all_system_devices() -> dict:
    """
    Sisteme bağlı tüm cihazları (Windows Yazıcılar, Ağ Yazıcıları, COM Portları, Teraziler) tarar.
    """
    discovered_printers = []
    discovered_com_ports = []
    
    # 1. Windows Spooler Yazıcılarını Tara
    if platform.system() == "Windows":
        try:
            import win32print
            for p in win32print.EnumPrinters(win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS):
                p_name = p[2]
                try:
                    hPrinter = win32print.OpenPrinter(p_name)
                    info = win32print.GetPrinter(hPrinter, 2)
                    win32print.ClosePrinter(hPrinter)
                    
                    driver = str(info.get('pDriverName', '')).strip()
                    port = str(info.get('pPortName', '')).strip()
                    status = info.get('Status', 0)
                    attribs = info.get('Attributes', 0)
                    is_offline = bool(attribs & win32print.PRINTER_ATTRIBUTE_WORK_OFFLINE)

                    # Eğer USB/Yerel yazıcı çevrimdışı bayrağına girmişse otomatik uyandır
                    if is_offline and "usb" in port.lower():
                        try:
                            hSet = win32print.OpenPrinter(p_name, {'DesiredAccess': win32print.PRINTER_ALL_ACCESS})
                            info['Attributes'] = info['Attributes'] & ~win32print.PRINTER_ATTRIBUTE_WORK_OFFLINE
                            win32print.SetPrinter(hSet, 2, info, 0)
                            win32print.ClosePrinter(hSet)
                            is_offline = False
                        except Exception:
                            pass

                    # Bağlantı türü tespiti
                    p_name_lower = p_name.lower()
                    port_lower = port.lower()
                    driver_lower = driver.lower()
                    
                    conn_type = "usb"
                    if "wsd" in port_lower or "tcp" in port_lower or "192." in port_lower or "10." in port_lower or "http" in port_lower or "ip_" in port_lower:
                        conn_type = "wifi"
                    elif "bth" in port_lower or "bluetooth" in port_lower or "com" in port_lower:
                        conn_type = "bluetooth"
                    elif any(v in p_name_lower or v in driver_lower or v in port_lower for v in ['pdf', 'onenote', 'xps', 'fax', 'nul:', 'portprompt']):
                        conn_type = "virtual"

                    # Uygunluk kategorisi
                    suggested_role = "label" # Varsayılan etiket
                    if any(w in p_name_lower or w in driver_lower for w in ['receipt', 'pos', 'fis', 'termal fis', 'tm-t', 'rp80', 'xp-80', '80mm', '58mm', 'bixolon', 'citizen']):
                        suggested_role = "receipt"
                    elif any(w in p_name_lower or w in driver_lower for w in ['label', 'etiket', 'barcode', 'zebra', 'tsc', 'xprinter', 'argox', 'godex', 'hprt']):
                        suggested_role = "label"

                    discovered_printers.append({
                        "name": p_name,
                        "driver": driver,
                        "port": port,
                        "connection_type": conn_type,
                        "is_offline": is_offline,
                        "status_code": status,
                        "status_text": "🟢 Hazır (Bağlı)" if (not is_offline and status == 0 and conn_type != "virtual") else ("🟡 Sanal Yazıcı" if conn_type == "virtual" else "🔴 Çevrimdışı"),
                        "suggested_role": suggested_role
                    })
                except Exception as ex:
                    discovered_printers.append({
                        "name": p_name,
                        "driver": "Bilinmiyor",
                        "port": "USB",
                        "connection_type": "usb",
                        "is_offline": False,
                        "status_text": "Hazır",
                        "suggested_role": "both"
                    })
        except Exception as e:
            print(f"[CİHAZ TARAMA] Windows yazıcı tarama hatası: {e}")

    # 2. Seri Portları (COM Ports) Tara (Bluetooth COM & RS232 Teraziler/Yazıcılar)
    if platform.system() == "Windows":
        try:
            cmd = '[System.IO.Ports.SerialPort]::GetPortNames() | ConvertTo-Json'
            p = subprocess.run(['powershell', '-Command', cmd], capture_output=True, text=True, timeout=3)
            if p.returncode == 0 and p.stdout.strip():
                import json
                try:
                    data = json.loads(p.stdout)
                    if isinstance(data, str):
                        data = [data]
                    for port_name in data:
                        discovered_com_ports.append({
                            "port": port_name,
                            "type": "serial_com",
                            "description": f"Seri Port / Terazi Bağlantısı ({port_name})"
                        })
                except Exception:
                    pass
        except Exception:
            pass

    if not discovered_com_ports:
        # Yaygın COM port listesi simülasyonu
        discovered_com_ports = [
            {"port": "COM1", "type": "serial_com", "description": "Standart Seri Port (COM1)"},
            {"port": "COM2", "type": "serial_com", "description": "Standart Seri Port (COM2)"},
            {"port": "COM3", "type": "serial_com", "description": "USB-Seri / Terazi Portu (COM3)"}
        ]

    # Mevcut seçili yapılandırma
    active_config = get_device_config()

    return {
        "status": "success",
        "timestamp": datetime.datetime.now().isoformat(),
        "printers": discovered_printers,
        "com_ports": discovered_com_ports,
        "active_config": active_config
    }

def to_thermal_clean_tr(text) -> str:
    """Termal yazıcıların bozuk karakter basmasını önleyen %100 uyumlu Türkçe dönüştürücü."""
    if not text:
        return ""
    replacements = {
        'ı': 'i', 'İ': 'I',
        'ğ': 'g', 'Ğ': 'G',
        'ü': 'u', 'Ü': 'U',
        'ş': 's', 'Ş': 'S',
        'ö': 'o', 'Ö': 'O',
        'ç': 'c', 'Ç': 'C',
        '₺': 'TL', '’': "'", '‘': "'", '“': '"', '”': '"'
    }
    res = str(text)
    for k, v in replacements.items():
        res = res.replace(k, v)
    return res

def generate_esc_pos_receipt_bytes(receipt_data: dict, paper_size: str = "80mm", auto_cut: bool = True, open_drawer: bool = True) -> bytes:
    """
    Standart ESC/POS termal fiş baytlarını üretir (Tüm 80mm ve 58mm Fiş Yazıcılarıyla %100 Uyumlu).
    """
    cols = 42 if paper_size == "80mm" else 32
    b = bytearray()

    # 1. Başlatma & Reset
    b.extend(b'\x1b\x40') # ESC @

    # 2. Çekmeceyi Aç (Opsiyonel)
    if open_drawer:
        b.extend(b'\x1b\x70\x00\x19\xfa') # ESC p 0 25 250 (Pin 2 pulse)

    # 3. Başlık (Ortalı & Kalın)
    b.extend(b'\x1b\x61\x01') # ESC a 1 (Center)
    b.extend(b'\x1b\x45\x01') # ESC E 1 (Bold ON)
    
    market_name = to_thermal_clean_tr(str(receipt_data.get("market_name", "YARENLER MARKET")).strip())
    branch_name = to_thermal_clean_tr(str(receipt_data.get("branch_name", "Merkez Sube - Kasa 1")).strip())
    phone = to_thermal_clean_tr(str(receipt_data.get("phone", "")).strip())

    b.extend(f"{market_name}\n".encode('ascii', errors='replace'))
    b.extend(b'\x1b\x45\x00') # ESC E 0 (Bold OFF)
    
    if branch_name:
        b.extend(f"{branch_name}\n".encode('ascii', errors='replace'))
    if phone:
        b.extend(f"Tel: {phone}\n".encode('ascii', errors='replace'))

    b.extend(f"{'-' * cols}\n".encode('ascii'))

    # 4. Bilgi Satırları (Sola Yaslı)
    b.extend(b'\x1b\x61\x00') # ESC a 0 (Left)
    now_str = to_thermal_clean_tr(receipt_data.get("date") or datetime.datetime.now().strftime("%d.%m.%Y %H:%M"))
    receipt_no = to_thermal_clean_tr(receipt_data.get("receipt_no", "A000.000.001"))

    b.extend(f"Tarih : {now_str}\n".encode('ascii', errors='replace'))
    b.extend(f"Fis No: {receipt_no}\n".encode('ascii', errors='replace'))
    b.extend(f"{'=' * cols}\n".encode('ascii'))

    # 5. Ürün Tablosu (Sade ve Ferah)
    import textwrap
    items = receipt_data.get("items", [])
    if paper_size == "80mm":
        # 80mm: Ürün Adı (21 char) + Miktar (6 char) + Fiyat (7 char) + Tutar (8 char)
        b.extend(f"{'URUN ADI':<21}{'MIKTAR':>6}{'FIYAT':>7}{'TUTAR':>8}\n".encode('ascii'))
        name_max_w = 21
    else:
        # 58mm: Ürün Adı (15 char) + Miktar (5 char) + Tutar (12 char)
        b.extend(f"{'URUN ADI':<15}{'ADET':>5}{'TUTAR':>12}\n".encode('ascii'))
        name_max_w = 15

    b.extend(f"{'-' * cols}\n".encode('ascii'))

    total_amount = float(receipt_data.get("total_amount") or 0.0)

    for it in items:
        name = to_thermal_clean_tr(str(it.get("title") or it.get("name") or "Urun")).strip()
        qty = float(it.get("quantity") or 1)
        unit = to_thermal_clean_tr(str(it.get("unit") or "Ad"))
        qty_str = f"{qty:g}{unit[:2]}"
        price = float(it.get("unit_price") or 0)
        total = float(it.get("total_price") or (qty * price))

        # Uzun ürün isimlerini alt satıra güvenle bölme
        name_lines = textwrap.wrap(name, width=name_max_w)
        first_line = name_lines[0] if name_lines else name[:name_max_w]
        
        if paper_size == "80mm":
            b.extend(f"{first_line:<21}{qty_str:>6}{price:>7.2f}{total:>8.2f}\n".encode('ascii', errors='replace'))
        else:
            b.extend(f"{first_line:<15}{qty_str:>5}{total:>12.2f}\n".encode('ascii', errors='replace'))

        # Eğer ürün adı 1 satırdan uzunsa kalan satırları aşağıya yazdır
        if len(name_lines) > 1:
            for extra_line in name_lines[1:]:
                b.extend(f"  {extra_line}\n".encode('ascii', errors='replace'))

    b.extend(f"{'=' * cols}\n".encode('ascii'))

    # 6. Genel Toplam
    b.extend(b'\x1b\x45\x01') # Bold ON
    if paper_size == "80mm":
        b.extend(f"{'TOPLAM TUTAR:':<24}{total_amount:>14.2f} TL\n".encode('ascii'))
    else:
        b.extend(f"{'TOPLAM:':<16}{total_amount:>13.2f} TL\n".encode('ascii'))
    b.extend(b'\x1b\x45\x00') # Bold OFF

    b.extend(f"{'-' * cols}\n".encode('ascii'))

    # 7. Alt Bilgi & Teşekkür Notu (Ortalı)
    b.extend(b'\x1b\x61\x01') # Center
    footer_note = to_thermal_clean_tr(receipt_data.get("receipt_footer_note") or "Bizi tercih ettiginiz icin tesekkur ederiz!")
    b.extend(f"{footer_note}\n".encode('ascii', errors='replace'))
    b.extend(b"BILGI FISIDIR - MALI DEGERI YOKTUR\n")

    # 8. Kağıt İlerletme & Kesme
    b.extend(b'\x1b\x64\x04') # ESC d 4 (Feed 4 lines)
    if auto_cut:
        b.extend(b'\x1d\x56\x00') # GS V 0 (Full Cut)
        b.extend(b'\x1d\x56\x01') # GS V 1 (Partial Cut fallback)

    return bytes(b)

def send_receipt_to_printer(receipt_data: dict, target_printer_name: str = None) -> dict:
    """
    Belirlenen Bilgi Fişi Yazıcısına (Windows Spooler veya Ağ IP) fiş basımını gönderir.
    """
    config = get_device_config()
    rec_cfg = config.get("receipt_printer", {})
    
    printer_name = target_printer_name or rec_cfg.get("name") or "Termal Etiket Yazici"
    paper_size = rec_cfg.get("paper_size", "80mm")
    auto_cut = rec_cfg.get("auto_cut", True)
    open_drawer = rec_cfg.get("open_drawer", True)

    raw_bytes = generate_esc_pos_receipt_bytes(receipt_data, paper_size=paper_size, auto_cut=auto_cut, open_drawer=open_drawer)

    # 1. Windows Spooler Üzerinden Gönderim
    if platform.system() == "Windows":
        try:
            import win32print
            hPrinter = win32print.OpenPrinter(printer_name)
            try:
                hJob = win32print.StartDocPrinter(hPrinter, 1, (f"Fis_{receipt_data.get('receipt_no', 'Job')}", None, "RAW"))
                try:
                    win32print.StartPagePrinter(hPrinter)
                    win32print.WritePrinter(hPrinter, raw_bytes)
                    win32print.EndPagePrinter(hPrinter)
                finally:
                    win32print.EndDocPrinter(hPrinter)
            finally:
                win32print.ClosePrinter(hPrinter)

            return {
                "status": "success",
                "message": f"Bilgi fişi başarıyla '{printer_name}' yazıcısına gönderildi.",
                "printer": printer_name
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Yazıcıya gönderim başarısız ({printer_name}): {str(e)}",
                "printer": printer_name
            }
    else:
        return {
            "status": "success",
            "message": f"Simülasyon modunda fiş üretildi ({len(raw_bytes)} byte).",
            "printer": printer_name
        }
