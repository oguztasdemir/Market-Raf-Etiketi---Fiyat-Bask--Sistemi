# -*- coding: utf-8 -*-
"""
Veritabanı Güvenli Yedekleme, Geri Yükleme ve Rollback Servisi
Hem SQLite (.db) hem de JSON yedeklerini destekler.
"""
import os
import shutil
import datetime
from backend.ayarlar import BACKUPS_DIR, URUNLER_BACKUPS_DIR, PRODUCTS_FILE
from backend.araclar.sqlite_servisi import DB_PATH, backup_sqlite_db

def _get_target_backup_dir() -> str:
    """Ürün ve veritabanı yedekleri için hedef alt dizini döner ve varlığını garanti eder."""
    os.makedirs(URUNLER_BACKUPS_DIR, exist_ok=True)
    return URUNLER_BACKUPS_DIR

def create_products_backup(reason: str = "Otomatik Güvenlik Yedeği") -> str:
    """SQLite veritabanının ve ürünlerin zaman damgalı güvenli yedeğini data/yedekler/urunler/ altına alır."""
    target_dir = _get_target_backup_dir()
    now_str = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    
    # 1. SQLite .db Yedeği
    if os.path.exists(DB_PATH):
        db_backup_filename = f"market_db_yedek_{now_str}.db"
        db_backup_filepath = os.path.join(target_dir, db_backup_filename)
        ok = backup_sqlite_db(db_backup_filepath)
        if ok:
            meta_filepath = os.path.join(target_dir, f"{db_backup_filename}.meta")
            try:
                with open(meta_filepath, 'w', encoding='utf-8') as f:
                    f.write(f"Date: {datetime.datetime.now().strftime('%d %b %Y %H:%M:%S')}\nReason: {reason}\nType: SQLite DB\n")
            except Exception:
                pass
            _cleanup_old_backups(keep=30)
            return db_backup_filename

    # 2. JSON Fallback Yedeği
    if os.path.exists(PRODUCTS_FILE):
        try:
            backup_filename = f"urunler_yedek_{now_str}.json"
            backup_filepath = os.path.join(target_dir, backup_filename)
            shutil.copy2(PRODUCTS_FILE, backup_filepath)
            meta_filepath = os.path.join(target_dir, f"{backup_filename}.meta")
            with open(meta_filepath, 'w', encoding='utf-8') as f:
                f.write(f"Date: {datetime.datetime.now().strftime('%d %b %Y %H:%M:%S')}\nReason: {reason}\nType: JSON\n")
            _cleanup_old_backups(keep=30)
            return backup_filename
        except Exception as e:
            print(f"[YEDEK UYARISI] Yedek alınamadı: {e}")
            return None

    return None

def _cleanup_old_backups(keep: int = 30):
    """Disk şişmesini önlemek için en güncel N adet yedeği saklar, eski olanları temizler."""
    try:
        backups = get_backups_list()
        if len(backups) > keep:
            for old_b in backups[keep:]:
                delete_products_backup(old_b["filename"])
    except Exception:
        pass

def get_backups_list() -> list:
    """Kayıtlı veritabanı yedeklerinin listesini tarih sırasına göre döner."""
    search_dirs = [URUNLER_BACKUPS_DIR, BACKUPS_DIR]
    seen_filenames = set()
    backups = []

    for sdir in search_dirs:
        if not os.path.exists(sdir):
            continue
        for f in os.listdir(sdir):
            is_valid_backup = (
                (f.startswith("urunler_yedek_") or f.startswith("products_backup_") or f.startswith("market_db_yedek_")) 
                and (f.endswith(".json") or f.endswith(".db"))
                and not f.endswith(".meta")
            )
            if is_valid_backup:
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
    """Belirtilen yedeği (.db veya .json) geri yükler."""
    backup_path = _resolve_backup_file(filename)
    if not backup_path or not os.path.exists(backup_path):
        return False, "Yedek dosyası bulunamadı."
    try:
        if backup_path.endswith(".db"):
            shutil.copy2(backup_path, DB_PATH)
            return True, "SQLite veritabanı başarıyla seçilen tarihteki haline geri yüklendi."
        elif backup_path.endswith(".json"):
            shutil.copy2(backup_path, PRODUCTS_FILE)
            # JSON'dan DB'ye de aktar
            from backend.araclar.depolama_araclari import save_json, load_json
            data = load_json(PRODUCTS_FILE)
            save_json(PRODUCTS_FILE, data)
            return True, "JSON ürün yedeği başarıyla geri yüklendi ve veritabanı güncellendi."
        return False, "Bilinmeyen yedek formatı."
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
    """Tüm ürün ve DB yedek dosyalarını sistemden siler."""
    deleted_count = 0
    search_dirs = [URUNLER_BACKUPS_DIR, BACKUPS_DIR]
    for sdir in search_dirs:
        if not os.path.exists(sdir):
            continue
        for f in os.listdir(sdir):
            if (f.startswith("urunler_yedek_") or f.startswith("products_backup_") or f.startswith("market_db_yedek_")):
                try:
                    os.remove(os.path.join(sdir, f))
                    if f.endswith(".json") or f.endswith(".db"):
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
