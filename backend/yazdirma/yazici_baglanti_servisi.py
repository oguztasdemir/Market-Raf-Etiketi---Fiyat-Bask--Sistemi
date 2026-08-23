"""
Windows Termal Yazıcı İletişim & Durum Servisi
"""
import win32print

def print_raw_zpl(printer_name, zpl_code, doc_name="Market Raf Etiketi"):
    """
    Belirtilen Windows yazıcı kuyruğuna ham ZPL baytlarını UTF-8 olarak iletir.
    """
    hPrinter = win32print.OpenPrinter(printer_name)
    try:
        hJob = win32print.StartDocPrinter(hPrinter, 1, (doc_name, None, "RAW"))
        try:
            win32print.StartPagePrinter(hPrinter)
            # UTF-8 formatında ham baytları ilet
            raw_bytes = zpl_code.encode("utf-8", errors="ignore")
            win32print.WritePrinter(hPrinter, raw_bytes)
            win32print.EndPagePrinter(hPrinter)
        finally:
            win32print.EndDocPrinter(hPrinter)
    finally:
        win32print.ClosePrinter(hPrinter)

def get_printer_status(printer_name):
    """Yazıcının gerçek fiziksel çevrimiçi, sanal ve çevrimdışı durumunu kontrol eder."""
    try:
        hPrinter = win32print.OpenPrinter(printer_name)
        try:
            info = win32print.GetPrinter(hPrinter, 2)
            status = info.get('Status', 0)
            attributes = info.get('Attributes', 0)
            driver = str(info.get('pDriverName', '')).lower()
            port = str(info.get('pPortName', '')).lower()
            p_name = str(printer_name).lower()
            
            is_virtual = any(v in p_name or v in driver or v in port for v in ['pdf', 'onenote', 'xps', 'fax', 'nul:', 'portprompt', 'document'])
            is_offline = bool(attributes & win32print.PRINTER_ATTRIBUTE_WORK_OFFLINE)
            
            if is_virtual:
                return {
                    "is_online": False,
                    "is_virtual": True,
                    "is_offline": False,
                    "status": "Sanal / Dosya Kuyruğu"
                }
            elif is_offline:
                return {
                    "is_online": False,
                    "is_virtual": False,
                    "is_offline": True,
                    "status": "🔴 Çevrimdışı (Bağlı Değil)"
                }
            elif status != 0:
                return {
                    "is_online": False,
                    "is_virtual": False,
                    "is_offline": True,
                    "status": f"⚠️ Hata (Kod: {status})"
                }
            else:
                return {
                    "is_online": True,
                    "is_virtual": False,
                    "is_offline": False,
                    "status": "🟢 Hazır (Bağlı)"
                }
        finally:
            win32print.ClosePrinter(hPrinter)
    except Exception:
        return {"is_online": False, "is_virtual": False, "is_offline": True, "status": "🔴 Bağlı Değil"}

