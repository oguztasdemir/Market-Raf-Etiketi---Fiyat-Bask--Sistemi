# -*- coding: utf-8 -*-
"""
JSON Dosya Okuma ve Güvenli Kaydetme Yardımcıları
"""
import os
import json
import tempfile
import shutil
import threading
import time

_STORAGE_LOCK = threading.RLock()
_JSON_CACHE = {}

def load_json(file_path: str, default=None):
    """JSON dosyasını güvenle ve önbellekten mtime kontrolüyle okur, hata durumunda default değeri döner."""
    if not file_path:
        return default if default is not None else []
    
    with _STORAGE_LOCK:
        if not os.path.exists(file_path):
            return default if default is not None else []
        try:
            mtime = os.path.getmtime(file_path)
            cached = _JSON_CACHE.get(file_path)
            if cached is not None and cached.get('mtime') == mtime:
                # Derin kopya ile dön ki çağıran yer veriyi modifiye ederse cache bozulmasın
                return json.loads(cached.get('raw'))

            with open(file_path, 'r', encoding='utf-8') as f:
                raw_str = f.read()
                data = json.loads(raw_str)
                _JSON_CACHE[file_path] = {'mtime': mtime, 'raw': raw_str}
                return data
        except Exception as e:
            print(f"[UYARI] JSON okuma hatası ({file_path}): {e}")
            return default if default is not None else []

def save_json(file_path: str, data) -> bool:
    """Thread-safe ve Atomic (güvenli) JSON yazma işlemi gerçekleştirir."""
    if not file_path:
        return False
    with _STORAGE_LOCK:
        try:
            dir_name = os.path.dirname(file_path)
            if dir_name:
                os.makedirs(dir_name, exist_ok=True)
            raw_str = json.dumps(data, ensure_ascii=False, indent=2)
            temp_fd, temp_path = tempfile.mkstemp(dir=dir_name if dir_name else None, prefix="tmp_save_", text=True)
            with os.fdopen(temp_fd, 'w', encoding='utf-8') as f:
                f.write(raw_str)
            shutil.move(temp_path, file_path)
            # Önbelleği güncelle
            try:
                _JSON_CACHE[file_path] = {'mtime': os.path.getmtime(file_path), 'raw': raw_str}
            except Exception:
                pass
            return True
        except Exception as e:
            print(f"[HATA] JSON kaydetme hatası ({file_path}): {e}")
            return False

def get_sales_filepath(date_str: str) -> str:
    """
    Satış dosyası için Yıl/Ay hiyerarşik yolunu döner (Örn: data/satis_ve_kasa/satislar/2026/08/2026-08-23.json).
    """
    from backend.ayarlar import SALES_DIR
    parts = date_str.split('-')
    if len(parts) >= 2:
        year = parts[0]
        month = parts[1]
        target_dir = os.path.join(SALES_DIR, year, month)
        os.makedirs(target_dir, exist_ok=True)
        return os.path.join(target_dir, f"{date_str}.json")
    return os.path.join(SALES_DIR, f"{date_str}.json")

def get_sales_for_date(date_str: str) -> list:
    """
    Belirtilen günün satış fişlerini okur (hem hiyerarşik hem de geriye dönük düz yapıyı destekler).
    """
    from backend.ayarlar import SALES_DIR
    h_path = get_sales_filepath(date_str)
    if os.path.exists(h_path):
        return load_json(h_path, [])
    flat_path = os.path.join(SALES_DIR, f"{date_str}.json")
    if os.path.exists(flat_path):
        return load_json(flat_path, [])
    return []

def save_sales_for_date(date_str: str, data: list) -> bool:
    """
    Belirtilen günün satış fişlerini Yıl/Ay klasör yapısına kaydeder.
    """
    path = get_sales_filepath(date_str)
    return save_json(path, data)

def list_all_sales_files() -> list:
    """
    Tüm Yıl/Ay alt klasörlerindeki satış JSON dosyalarını tam yol listesi olarak döner.
    """
    from backend.ayarlar import SALES_DIR
    files = []
    if not os.path.exists(SALES_DIR):
        return files
    for root, _, filenames in os.walk(SALES_DIR):
        for f in filenames:
            if f.endswith('.json'):
                files.append(os.path.join(root, f))
    files.sort(reverse=True)
    return files

