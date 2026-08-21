"""
Windows ve USB Termal Yazıcı İletişim Servisi
"""
import subprocess
import win32print

def get_connected_usb_devices():
    """Windows PnP ve USB aygıtlarını sorgular."""
    devices = []
    try:
        cmd = 'powershell -NoProfile -Command "Get-PnpDevice -PresentOnly | Where-Object { ($_.InstanceId -like \'*USBPRINT*\') -or ($_.InstanceId -like \'*0C0C*\' -and $_.Class -eq \'USB\') -or ($_.Class -eq \'Printer\') } | Select-Object FriendlyName, InstanceId, Status, Class | ConvertTo-Json"'
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, encoding='utf-8', errors='ignore')
        if result.stdout and result.stdout.strip():
            import json
            try:
                data = json.loads(result.stdout)
                if isinstance(data, dict):
                    data = [data]
                if isinstance(data, list):
                    for d in data:
                        fname = str(d.get('FriendlyName') or '').strip()
                        iid = str(d.get('InstanceId') or '')
                        if 'PNP0C0C' in iid or 'Kapama' in fname or 'ACPI' in iid:
                            continue
                        if not fname or len(fname) < 2 or fname.startswith('t\t') or fname == '_____':
                            if 'USBPRINT' in iid:
                                fname = "Termal Etiket Yazıcı (USBPRINT Portu)"
                            elif '0C0C' in iid:
                                fname = "USB Termal Aygıt (VID:0C0C)"
                            else:
                                fname = "USB Yazıcı Donanımı"
                        d['FriendlyName'] = fname
                        devices.append(d)
            except Exception:
                pass
    except Exception:
        pass
    return devices

def get_windows_printers():
    """Sistemde kurulu Windows yazıcı kuyruklarını listeler."""
    printers = []
    try:
        for p in win32print.EnumPrinters(win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS):
            printers.append(p[2])
    except Exception:
        pass
    return printers

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
    """Yazıcının çevrimiçi/hata durumunu kontrol eder."""
    try:
        hPrinter = win32print.OpenPrinter(printer_name)
        try:
            info = win32print.GetPrinter(hPrinter, 2)
            status = info.get('Status', 0)
            is_online = (status == 0)
            return {"is_online": is_online, "status": "Hazır" if is_online else f"Durum Kodu: {status}"}
        finally:
            win32print.ClosePrinter(hPrinter)
    except Exception:
        return {"is_online": True, "status": "Hazır"}

