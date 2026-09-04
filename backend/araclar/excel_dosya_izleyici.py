# -*- coding: utf-8 -*-
"""
Ağ Bilgisi, SSL Sertifika Yönetimi, Port Temizleme ve Canlı Kod İzleyici
"""
import os
import sys
import time
import socket
import datetime
import subprocess
import threading
from backend.ayarlar import BASE_DIR, CERTS_DIR

def get_local_ip() -> str:
    """Sunucunun yerel ağ IP adresini döndürür."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

def ensure_ssl_certs(local_ip: str):
    """Kamera WebRTC desteği için yerel SSL sertifikalarını hazırlar."""
    cert_path = os.path.join(CERTS_DIR, "cert.pem")
    key_path = os.path.join(CERTS_DIR, "key.pem")

    if os.path.exists(cert_path) and os.path.exists(key_path):
        return cert_path, key_path

    try:
        from cryptography import x509
        from cryptography.x509.oid import NameOID
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        import ipaddress

        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.COUNTRY_NAME, "TR"),
            x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "Istanbul"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Market Raf Etiketi Paneli"),
            x509.NameAttribute(NameOID.COMMON_NAME, local_ip),
        ])

        now = datetime.datetime.now(datetime.timezone.utc)
        san_list = [
            x509.DNSName("localhost"),
            x509.IPAddress(ipaddress.IPv4Address("127.0.0.1")),
            x509.IPAddress(ipaddress.IPv4Address(local_ip))
        ]

        cert = x509.CertificateBuilder().subject_name(
            subject
        ).issuer_name(
            issuer
        ).add_extension(
            x509.SubjectAlternativeName(san_list), critical=False
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
    """Portta asılı kalan eski Python işlemlerini temizler."""
    try:
        cmd = f'powershell -Command "Get-NetTCPConnection -LocalPort {port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object {{ $p = Get-Process -Id $_ -ErrorAction SilentlyContinue; if ($p -and $p.Id -ne $PID -and $p.ProcessName -like \'*python*\') {{ Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }} }}"'
        subprocess.run(cmd, shell=True, capture_output=True, timeout=5)
    except Exception:
        pass

def start_code_watcher(on_change_callback=None):
    """Proje kodlarını (.py, .js, .html, .css) arka planda izler ve değişiklik olduğunda terminale anlık bildirim basar."""
    def watch_worker():
        watch_dirs = [BASE_DIR]
        valid_exts = ('.py', '.js', '.html', '.css')
        mtimes = {}

        def get_all_watched_files():
            files = []
            for d in watch_dirs:
                if os.path.exists(d):
                    for root, dirs, filenames in os.walk(d):
                        # Prune unwanted and large directories in place to save CPU and disk performance
                        dirs[:] = [dir_name for dir_name in dirs if dir_name not in ('.git', '__pycache__', 'data', 'yedekler', '.gemini', 'taslak')]
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
                            if on_change_callback:
                                on_change_callback()
                    else:
                        mtimes[fpath] = curr_mtime
                except Exception:
                    pass

    t = threading.Thread(target=watch_worker, daemon=True)
    t.start()
