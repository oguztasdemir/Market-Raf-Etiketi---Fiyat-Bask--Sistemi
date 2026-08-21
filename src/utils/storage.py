# -*- coding: utf-8 -*-
"""
JSON Dosya Okuma ve Güvenli Kaydetme Yardımcıları
"""
import os
import json
import tempfile
import shutil

def load_json(file_path: str, default=None):
    """JSON dosyasını güvenle okur, hata durumunda default değeri döner."""
    if not os.path.exists(file_path):
        return default if default is not None else []
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"[UYARI] JSON okuma hatası ({file_path}): {e}")
        return default if default is not None else []

def save_json(file_path: str, data) -> bool:
    """Atomic (güvenli) JSON yazma işlemi gerçekleştirir."""
    try:
        dir_name = os.path.dirname(file_path)
        os.makedirs(dir_name, exist_ok=True)
        temp_fd, temp_path = tempfile.mkstemp(dir=dir_name, prefix="tmp_save_", text=True)
        with os.fdopen(temp_fd, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        shutil.move(temp_path, file_path)
        return True
    except Exception as e:
        print(f"[HATA] JSON kaydetme hatası ({file_path}): {e}")
        return False
