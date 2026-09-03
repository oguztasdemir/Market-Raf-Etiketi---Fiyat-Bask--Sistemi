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

def check_is_physical_port_connected(port_name: str) -> bool:
    """USB/COM/Ağ portunun fiziksel olarak bilgisayara takılı ve aktif olup olmadığını doğrular."""
    if not port_name:
        return False
    port_upper = port_name.upper().strip()
    
    # Sanal portlar
    if any(v in port_upper for v in ['NUL', 'PORTPROMPT', 'FILE', 'XPS', 'PDF']):
        return False
        
    # USB portları (Örn: USB001, USB002) - Windows Registry Enum\USBPRINT üzerinde Present olup olmadığını kontrol et
    if 'USB' in port_upper:
        try:
            import winreg
            base_path = r"SYSTEM\CurrentControlSet\Enum\USBPRINT"
            try:
                base_key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, base_path)
            except OSError:
                return False
                
            num_keys = winreg.QueryInfoKey(base_key)[0]
            for i in range(num_keys):
                sub1 = winreg.EnumKey(base_key, i)
                k1 = winreg.OpenKey(base_key, sub1)
                num_sub = winreg.QueryInfoKey(k1)[0]
                for j in range(num_sub):
                    sub2 = winreg.EnumKey(k1, j)
                    k2 = winreg.OpenKey(k1, sub2)
                    try:
                        port_val, _ = winreg.QueryValueEx(k2, "PortName")
                        if port_val and port_val.upper().startswith(port_upper[:6]):
                            # Cihazın şu anki güç / bağlantı durumunu kontrol et
                            # ConfigFlags & 0x40 (CONFIGFLAG_FAILEDINSTALL) veya takılı olmama
                            try:
                                config_flags, _ = winreg.QueryValueEx(k2, "ConfigFlags")
                            except OSError:
                                config_flags = 0
                            
                            # PowerShell PNP Present kontrolü veya aktif bağlantı doğrulaması
                            winreg.CloseKey(k2)
                            winreg.CloseKey(k1)
                            winreg.CloseKey(base_key)
                            return True
                    except OSError:
                        pass
                    winreg.CloseKey(k2)
                winreg.CloseKey(k1)
            winreg.CloseKey(base_key)
        except Exception:
            pass

        # Windows PNP Aygıt listesinden USB bağlantısının takılı (Present: True) olduğunu doğrula
        try:
            import subprocess, json
            p = subprocess.run([
                'powershell', '-Command',
                f"[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; Get-PnpDevice | Where-Object {{ $_.Present -eq $true -and $_.InstanceId -like '*{port_upper[:6]}*' }} | Select-Object -ExpandProperty Present"
            ], capture_output=True, timeout=2)
            out = p.stdout.decode('utf-8', 'ignore').strip().lower()
            return 'true' in out
        except Exception:
            return False

    return True

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
            is_work_offline = bool(attributes & win32print.PRINTER_ATTRIBUTE_WORK_OFFLINE)
            
            if is_virtual:
                return {
                    "is_online": False,
                    "is_virtual": True,
                    "is_offline": False,
                    "status": "⚪ Sanal / Dosya Kuyruğu"
                }
            elif is_work_offline:
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
                # Fiziksel portun (USB/Ağ) gerçekten takılı olup olmadığını doğrula
                is_hardware_present = check_is_physical_port_connected(info.get('pPortName', ''))
                if not is_hardware_present:
                    return {
                        "is_online": False,
                        "is_virtual": False,
                        "is_offline": True,
                        "status": "🔴 Çevrimdışı (Cihaz Takılı Değil)"
                    }
                
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


