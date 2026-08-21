# -*- coding: utf-8 -*-
"""
Günlük Faaliyet, Fiyat Değişiklikleri ve Baskı Raporlama Servisi
"""
import os
import datetime
from src.config import DATA_DIR, PRODUCTS_FILE
from src.utils.storage import load_json, save_json
from src.utils.text_cleaner import get_online_or_system_date

REPORTS_FILE = os.path.join(DATA_DIR, "daily_reports.json")

def _get_today_key() -> str:
    """Günlük rapor için gün anahtarını döner (Örn: 2026-08-20)."""
    return datetime.datetime.now().strftime("%Y-%m-%d")

def _get_now_time_str() -> str:
    """Anlık saat bilgisini döner (Örn: 16:25)."""
    return datetime.datetime.now().strftime("%H:%M")

def _get_display_date_str() -> str:
    """Türkçe gün metnini döner (Örn: 20 Ağu 2026)."""
    return get_online_or_system_date()

def _ensure_reports_structure() -> dict:
    """Rapor dosyasını yükler ve yapısını doğrular."""
    if not os.path.exists(REPORTS_FILE):
        save_json(REPORTS_FILE, {})
        return {}
    data = load_json(REPORTS_FILE, {})
    if not isinstance(data, dict):
        data = {}
    return data

def log_price_change(barcode: str, title: str, old_price: str, new_price: str, source: str = "PC"):
    """
    Fiyat değişikliğini günlük rapora işler.
    source: 'PC' veya 'MOBILE'
    """
    if not barcode or not new_price or old_price == new_price:
        return

    reports = _ensure_reports_structure()
    day_key = _get_today_key()
    
    if day_key not in reports:
        products = load_json(PRODUCTS_FILE, [])
        reports[day_key] = {
            "date_key": day_key,
            "display_date": _get_display_date_str(),
            "total_catalog_products": len(products),
            "stats": {
                "mobile_price_changes": 0,
                "pc_price_changes": 0,
                "total_printed_barcodes": 0,
                "mobile_printed_barcodes": 0,
                "pc_printed_barcodes": 0
            },
            "price_changes": [],
            "printed_items": []
        }

    day_report = reports[day_key]
    
    # İstatistik artır
    src_clean = "MOBILE" if "MOB" in source.upper() else "PC"
    if src_clean == "MOBILE":
        day_report["stats"]["mobile_price_changes"] = day_report["stats"].get("mobile_price_changes", 0) + 1
    else:
        day_report["stats"]["pc_price_changes"] = day_report["stats"].get("pc_price_changes", 0) + 1

    # Detay kaydı ekle
    day_report["price_changes"].insert(0, {
        "time": _get_now_time_str(),
        "barcode": barcode,
        "title": title or "Bilinmeyen Ürün",
        "old_price": old_price or "0,00 TL",
        "new_price": new_price,
        "source": src_clean
    })

    save_json(REPORTS_FILE, reports)

def log_printed_batch(items: list, source: str = "PC"):
    """
    Basılan barkod/etiket grubunu günlük rapora işler.
    items: [{'barcode', 'title', 'price', 'copies'}]
    source: 'PC' veya 'MOBILE'
    """
    if not items or not isinstance(items, list):
        return

    reports = _ensure_reports_structure()
    day_key = _get_today_key()

    if day_key not in reports:
        products = load_json(PRODUCTS_FILE, [])
        reports[day_key] = {
            "date_key": day_key,
            "display_date": _get_display_date_str(),
            "total_catalog_products": len(products),
            "stats": {
                "mobile_price_changes": 0,
                "pc_price_changes": 0,
                "total_printed_barcodes": 0,
                "mobile_printed_barcodes": 0,
                "pc_printed_barcodes": 0
            },
            "price_changes": [],
            "printed_items": []
        }

    day_report = reports[day_key]
    src_clean = "MOBILE" if "MOB" in source.upper() else "PC"
    now_time = _get_now_time_str()

    for it in items:
        bc = it.get("barcode", "")
        t = it.get("title", "") or it.get("title1", "") or "Etiket"
        p = it.get("price", "0,00 TL")
        copies = int(it.get("copies", 1) or 1)

        day_report["stats"]["total_printed_barcodes"] = day_report["stats"].get("total_printed_barcodes", 0) + copies
        if src_clean == "MOBILE":
            day_report["stats"]["mobile_printed_barcodes"] = day_report["stats"].get("mobile_printed_barcodes", 0) + copies
        else:
            day_report["stats"]["pc_printed_barcodes"] = day_report["stats"].get("pc_printed_barcodes", 0) + copies

        day_report["printed_items"].insert(0, {
            "time": now_time,
            "barcode": bc,
            "title": t,
            "price": p,
            "copies": copies,
            "source": src_clean
        })

    # Toplam ürün sayısını da tazele
    products = load_json(PRODUCTS_FILE, [])
    day_report["total_catalog_products"] = len(products)

    save_json(REPORTS_FILE, reports)

def get_all_daily_reports_summary() -> list:
    """
    Tüm günlerin özet metriklerini tarihe göre azalan sırada döner.
    """
    reports = _ensure_reports_structure()
    products = load_json(PRODUCTS_FILE, [])
    curr_total = len(products)
    
    summary_list = []
    for day_key in sorted(reports.keys(), reverse=True):
        r = reports[day_key]
        stats = r.get("stats", {})
        summary_list.append({
            "date_key": day_key,
            "display_date": r.get("display_date", day_key),
            "total_catalog_products": r.get("total_catalog_products", curr_total),
            "mobile_price_changes": stats.get("mobile_price_changes", 0),
            "pc_price_changes": stats.get("pc_price_changes", 0),
            "total_price_changes": stats.get("mobile_price_changes", 0) + stats.get("pc_price_changes", 0),
            "total_printed_barcodes": stats.get("total_printed_barcodes", 0),
            "mobile_printed_barcodes": stats.get("mobile_printed_barcodes", 0),
            "pc_printed_barcodes": stats.get("pc_printed_barcodes", 0),
            "price_changes_count": len(r.get("price_changes", [])),
            "printed_items_count": len(r.get("printed_items", []))
        })
    return summary_list

def get_daily_report_detail(day_key: str) -> dict:
    """
    Belirli bir günün tüm detay kayıtlarını (fiyat değişimleri & basılanlar) döner.
    """
    reports = _ensure_reports_structure()
    if day_key in reports:
        return reports[day_key]
    return {}
