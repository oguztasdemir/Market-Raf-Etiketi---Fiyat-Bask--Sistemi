# -*- coding: utf-8 -*-
"""
Termal Etiket Yazıcı Servisi (TSPL, ESC/POS, Windows GDI, Yazıcı Kuyruğu & Barkod Doğrulama)
"""
import platform
from backend.ayarlar import PRODUCTS_FILE
from backend.araclar.depolama_araclari import load_json, save_json
from backend.araclar.metin_duzenleyici import clean_barcode, format_price_display

def get_installed_printers() -> list:
    """İşletim sisteminde yüklü yazıcıların listesini döner."""
    printers = []
    if platform.system() == "Windows":
        try:
            import win32print
            for p in win32print.EnumPrinters(win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS):
                printers.append(p[2])
        except Exception:
            pass
    if not printers:
        printers = ["Termal Etiket Yazici", "Xprinter XP-365B", "Zebra ZD220", "Argox OS-214plus"]
    return printers

def generate_tspl_command(data: dict, width_mm=76, height_mm=40, x_offset=0, y_offset=0, copies=1) -> bytes:
    """TSPL-II yazıcı komutunu üretir."""
    lines = []
    lines.append(f"SIZE {width_mm} mm, {height_mm} mm")
    lines.append("GAP 2 mm, 0 mm")
    lines.append("DIRECTION 1")
    lines.append("CLS")

    from backend.yazdirma.zpl_etiket_kodlayici import clean_tr

    title1 = clean_tr((data.get('title1') or data.get('title') or '').strip().upper())
    title2 = clean_tr((data.get('title2') or '').strip().upper())
    from backend.araclar.depolama_araclari import load_json
    from backend.ayarlar import SETTINGS_FILE
    settings = load_json(SETTINGS_FILE, {})
    default_market = str(settings.get("market_name", "MARKET")).strip().upper()
    brand = clean_tr((data.get('brand') or default_market).strip().upper())
    origin = clean_tr((data.get('origin') or 'TURKIYE').strip().upper())
    date_str = clean_tr((data.get('date') or '').strip())
    barcode = clean_barcode(data.get('barcode'))
    price = clean_tr(format_price_display(data.get('price')))

    lines.append(f'TEXT {10 + x_offset},{8 + y_offset},"3",0,1,1,"{title1[:35]}"')
    if title2:
        lines.append(f'TEXT {10 + x_offset},{28 + y_offset},"2",0,1,1,"{title2[:40]}"')

    lines.append(f'BOX {10 + x_offset},{48 + y_offset},{130 + x_offset},{70 + y_offset},2')
    lines.append(f'TEXT {14 + x_offset},{52 + y_offset},"1",0,1,1,"URETICI: {brand[:12]}"')

    lines.append(f'BOX {140 + x_offset},{48 + y_offset},{270 + x_offset},{70 + y_offset},2')
    lines.append(f'TEXT {144 + x_offset},{52 + y_offset},"1",0,1,1,"URETIM: {origin[:10]}"')

    lines.append(f'BOX {280 + x_offset},{48 + y_offset},{420 + x_offset},{70 + y_offset},2')
    lines.append(f'TEXT {284 + x_offset},{52 + y_offset},"1",0,1,1,"DEG: {date_str}"')

    if barcode and barcode.isdigit() and len(barcode) == 13:
        lines.append(f'BARCODE {10 + x_offset},{85 + y_offset},"EAN13",45,1,0,2,2,"{barcode}"')
    elif barcode:
        lines.append(f'BARCODE {10 + x_offset},{85 + y_offset},"128",45,1,0,2,2,"{barcode}"')

    lines.append(f'TEXT {260 + x_offset},{82 + y_offset},"4",0,2,2,"{price}"')
    lines.append(f"PRINT {copies}")

    cmd_str = "\n".join(lines) + "\n"
    return cmd_str.encode('ascii', errors='replace')

def send_raw_to_printer(printer_name: str, raw_data: bytes) -> bool:
    """Windows Spooler üzerinden yazıcıya ham veri (RAW byte) gönderir."""
    if platform.system() != "Windows":
        return False
    try:
        import win32print
        hPrinter = win32print.OpenPrinter(printer_name)
        try:
            hJob = win32print.StartDocPrinter(hPrinter, 1, ("Etiket_Baski_Job", None, "RAW"))
            try:
                win32print.StartPagePrinter(hPrinter)
                win32print.WritePrinter(hPrinter, raw_data)
                win32print.EndPagePrinter(hPrinter)
            finally:
                win32print.EndDocPrinter(hPrinter)
        finally:
            win32print.ClosePrinter(hPrinter)
        return True
    except Exception as e:
        print(f"[YAZICI HATASI] RAW gönderim başarısız: {e}")
        return False

def purge_printer_queue(printer_name: str) -> bool:
    """Yazıcı kuyruğundaki bekleyen tüm yazdırma işlerini temizler/iptal eder."""
    if platform.system() != "Windows":
        return True
    try:
        import win32print
        hPrinter = win32print.OpenPrinter(printer_name, {"DesiredAccess": win32print.PRINTER_ALL_ACCESS})
        try:
            win32print.SetPrinter(hPrinter, 0, None, win32print.PRINTER_CONTROL_PURGE)
        finally:
            win32print.ClosePrinter(hPrinter)
        return True
    except Exception as e:
        print(f"[YAZICI KUYRUĞU] Temizleme hatası: {e}")
        return False

def validate_barcode_checksum(barcode_str: str) -> bool:
    """EAN-13 veya EAN-8 sağlama toplamını (checksum) doğrular."""
    s = str(barcode_str).strip()
    if not s.isdigit():
        return False
    if len(s) == 13:
        digits = [int(c) for c in s]
        checksum = (10 - (sum(digits[i] * (1 if i % 2 == 0 else 3) for i in range(12)) % 10)) % 10
        return digits[12] == checksum
    elif len(s) == 8:
        digits = [int(c) for c in s]
        checksum = (10 - (sum(digits[i] * (3 if i % 2 == 0 else 1) for i in range(7)) % 10)) % 10
        return digits[7] == checksum
    elif len(s) >= 4:
        return True
    return False

def mark_products_as_printed(barcodes):
    """Baskısı alınan ürünlerin etiket fiyatını güncel fiyatıyla eşitler."""
    if not barcodes:
        return
    try:
        products = load_json(PRODUCTS_FILE, [])
        prod_map = {clean_barcode(p.get('barcode')): p for p in products if p.get('barcode')}
        import datetime
        now_time_str = datetime.datetime.now().strftime("%d %b %Y %H:%M")
        
        updated = False
        for bc in barcodes:
            clean_bc = clean_barcode(bc)
            if clean_bc in prod_map:
                prod_map[clean_bc]["label_price"] = prod_map[clean_bc].get("price")
                prod_map[clean_bc]["last_printed_at"] = now_time_str
                updated = True

        if updated:
            save_json(PRODUCTS_FILE, products)
    except Exception as e:
        print(f"[UYARI] Baskı sonrası etiket fiyatı eşitlenemedi: {e}")
