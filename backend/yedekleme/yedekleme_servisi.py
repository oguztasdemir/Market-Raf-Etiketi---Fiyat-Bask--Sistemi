# -*- coding: utf-8 -*-
"""
Veritabanı Güvenli Yedekleme, Geri Yükleme ve Rollback Servisi
"""
import os
import shutil
import datetime
from backend.ayarlar import BACKUPS_DIR, PRODUCTS_FILE
from backend.araclar.depolama_araclari import load_json, save_json

def create_products_backup(reason: str = "Otomatik Güvenlik Yedeği") -> str:
    """Mevcut products.json dosyasının zaman damgalı güvenli yedeğini alır."""
    if not os.path.exists(PRODUCTS_FILE):
        return None
    try:
        now_str = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        backup_filename = f"products_backup_{now_str}.json"
        backup_filepath = os.path.join(BACKUPS_DIR, backup_filename)
        shutil.copy2(PRODUCTS_FILE, backup_filepath)
        
        meta_filepath = os.path.join(BACKUPS_DIR, f"{backup_filename}.meta")
        with open(meta_filepath, 'w', encoding='utf-8') as f:
            f.write(f"Date: {datetime.datetime.now().strftime('%d %b %Y %H:%M:%S')}\nReason: {reason}\n")
            
        return backup_filename
    except Exception as e:
        print(f"[YEDEK UYARISI] Yedek alınamadı: {e}")
        return None

def get_backups_list() -> list:
    """Kayıtlı veritabanı yedeklerinin listesini tarih sırasına göre döner."""
    if not os.path.exists(BACKUPS_DIR):
        return []
    backups = []
    for f in os.listdir(BACKUPS_DIR):
        if f.startswith("products_backup_") and f.endswith(".json") and not f.endswith(".meta"):
            fpath = os.path.join(BACKUPS_DIR, f)
            meta_path = os.path.join(BACKUPS_DIR, f"{f}.meta")
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

def restore_products_backup(filename: str):
    """Belirtilen yedeği products.json olarak geri yükler."""
    backup_path = os.path.join(BACKUPS_DIR, os.path.basename(filename))
    if not os.path.exists(backup_path):
        return False, "Yedek dosyası bulunamadı."
    try:
        shutil.copy2(backup_path, PRODUCTS_FILE)
        return True, "Veritabanı başarıyla seçilen tarihteki haline geri yüklendi."
    except Exception as e:
        return False, f"Geri yükleme hatası: {str(e)}"

def delete_products_backup(filename: str):
    """Belirtilen yedek dosyasını ve varsa .meta dosyasını sistemden siler."""
    safe_name = os.path.basename(filename)
    backup_path = os.path.join(BACKUPS_DIR, safe_name)
    meta_path = os.path.join(BACKUPS_DIR, f"{safe_name}.meta")

    if not os.path.exists(backup_path):
        return False, "Yedek dosyası bulunamadı."

    try:
        os.remove(backup_path)
        if os.path.exists(meta_path):
            os.remove(meta_path)
        return True, f"'{safe_name}' yedeği başarıyla silindi."
    except Exception as e:
        return False, f"Yedek silinirken hata oluştu: {str(e)}"

def delete_all_products_backups():
    """Tüm yedek dosyalarını ve meta verilerini sistemden siler."""
    if not os.path.exists(BACKUPS_DIR):
        return True, "Silinecek herhangi bir yedek bulunmuyor.", 0

    deleted_count = 0
    for f in os.listdir(BACKUPS_DIR):
        if f.startswith("products_backup_"):
            try:
                os.remove(os.path.join(BACKUPS_DIR, f))
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
