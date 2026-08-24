# -*- coding: utf-8 -*-
"""
Veritabanı Güvenli Yedekleme, Geri Yükleme ve Rollback Servisi (Sistematik Katalog Alt Klasörü)
"""
import os
import shutil
import datetime
from backend.ayarlar import BACKUPS_DIR, URUNLER_BACKUPS_DIR, PRODUCTS_FILE

def _get_target_backup_dir() -> str:
    """Ürün yedekleri için hedef alt dizini döner ve varlığını garanti eder."""
    os.makedirs(URUNLER_BACKUPS_DIR, exist_ok=True)
    return URUNLER_BACKUPS_DIR

def create_products_backup(reason: str = "Otomatik Güvenlik Yedeği") -> str:
    """Mevcut urunler.json dosyasının zaman damgalı güvenli yedeğini data/yedekler/katalog/ altına alır."""
    if not os.path.exists(PRODUCTS_FILE):
        return None
    try:
        target_dir = _get_target_backup_dir()
        now_str = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        backup_filename = f"urunler_yedek_{now_str}.json"
        backup_filepath = os.path.join(target_dir, backup_filename)
        shutil.copy2(PRODUCTS_FILE, backup_filepath)
        
        meta_filepath = os.path.join(target_dir, f"{backup_filename}.meta")
        with open(meta_filepath, 'w', encoding='utf-8') as f:
            f.write(f"Date: {datetime.datetime.now().strftime('%d %b %Y %H:%M:%S')}\nReason: {reason}\n")
            
        return backup_filename
    except Exception as e:
        print(f"[YEDEK UYARISI] Yedek alınamadı: {e}")
        return None

def get_backups_list() -> list:
    """Kayıtlı ürün veritabanı yedeklerinin listesini tarih sırasına göre döner."""
    search_dirs = [URUNLER_BACKUPS_DIR, BACKUPS_DIR]
    seen_filenames = set()
    backups = []

    for sdir in search_dirs:
        if not os.path.exists(sdir):
            continue
        for f in os.listdir(sdir):
            if (f.startswith("urunler_yedek_") or f.startswith("products_backup_")) and f.endswith(".json") and not f.endswith(".meta"):
                if f in seen_filenames:
                    continue
                seen_filenames.add(f)
                fpath = os.path.join(sdir, f)
                meta_path = os.path.join(sdir, f"{f}.meta")
                reason = "Otomatik Güvenlik Yedeği"
                if os.path.exists(meta_path):
                    try:
                        with open(meta_path, 'r', encoding='utf-8') as mf:
                            for line in mf:
                                if line.startswith("Reason:"):
                                    reason = line.replace("Reason:", "").strip()
                    except Exception:
                        pass
                mtime = os.path.getmtime(fpath)
                dt_str = datetime.datetime.fromtimestamp(mtime).strftime("%d %b %Y %H:%M:%S")
                size_kb = f"{os.path.getsize(fpath) / 1024:.1f} KB"
                backups.append({
                    "filename": f,
                    "date": dt_str,
                    "reason": reason,
                    "size": size_kb,
                    "timestamp": mtime
                })

    backups.sort(key=lambda x: x['timestamp'], reverse=True)
    return backups

def _resolve_backup_file(filename: str):
    """Verilen dosya adının tam yolunu urunler veya ana yedek dizininde bulur."""
    safe_name = os.path.basename(filename)
    p1 = os.path.join(URUNLER_BACKUPS_DIR, safe_name)
    if os.path.exists(p1):
        return p1
    p2 = os.path.join(BACKUPS_DIR, safe_name)
    if os.path.exists(p2):
        return p2
    return None

def restore_products_backup(filename: str):
    """Belirtilen yedeği urunler.json olarak geri yükler."""
    backup_path = _resolve_backup_file(filename)
    if not backup_path or not os.path.exists(backup_path):
        return False, "Yedek dosyası bulunamadı."
    try:
        shutil.copy2(backup_path, PRODUCTS_FILE)
        return True, "Veritabanı başarıyla seçilen tarihteki haline geri yüklendi."
    except Exception as e:
        return False, f"Geri yükleme hatası: {str(e)}"

def delete_products_backup(filename: str):
    """Belirtilen yedek dosyasını ve varsa .meta dosyasını sistemden siler."""
    backup_path = _resolve_backup_file(filename)
    if not backup_path or not os.path.exists(backup_path):
        return False, "Yedek dosyası bulunamadı."

    meta_path = f"{backup_path}.meta"
    safe_name = os.path.basename(filename)

    try:
        os.remove(backup_path)
        if os.path.exists(meta_path):
            os.remove(meta_path)
        return True, f"'{safe_name}' yedeği başarıyla silindi."
    except Exception as e:
        return False, f"Yedek silinirken hata oluştu: {str(e)}"

def delete_all_products_backups():
    """Tüm ürün yedek dosyalarını ve meta verilerini sistemden siler."""
    deleted_count = 0
    search_dirs = [URUNLER_BACKUPS_DIR, BACKUPS_DIR]
    for sdir in search_dirs:
        if not os.path.exists(sdir):
            continue
        for f in os.listdir(sdir):
            if f.startswith("urunler_yedek_") or f.startswith("products_backup_"):
                try:
                    os.remove(os.path.join(sdir, f))
                    if f.endswith(".json"):
                        deleted_count += 1
                except Exception:
                    pass
    return True, f"Toplam {deleted_count} adet yedek dosyası başarıyla silindi.", deleted_count

def rollback_latest_backup():
    """En son alınan otomatik güvenlik yedeğine geri döner."""
    backups = get_backups_list()
    if not backups:
        return False, "Geri dönülecek herhangi bir yedek bulunamadı."
    latest_backup = backups[0]["filename"]
    return restore_products_backup(latest_backup)

