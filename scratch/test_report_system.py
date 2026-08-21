import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, ".")

from src.services.report_service import (
    log_price_change,
    log_printed_batch,
    get_all_daily_reports_summary,
    get_daily_report_detail,
    _get_today_key
)

print("--- 1. MOBİL VE PC TEST LOGLARI EKLEME ---")
log_price_change("8690001", "SÜTAŞ SÜT 1 LT TAM YAĞLI", "38,50 TL", "42,00 TL", source="MOBILE")
log_price_change("8690002", "ÜLKER ÇOKOPRENS 10'LU", "25,00 TL", "29,50 TL", source="MOBILE")
log_price_change("8690003", "ETİ HOŞBEŞ FINDIKLI 142 GR", "22,00 TL", "26,00 TL", source="PC")

log_printed_batch([
    {"barcode": "8690001", "title": "SÜTAŞ SÜT 1 LT TAM YAĞLI", "price": "42,00 TL", "copies": 2},
    {"barcode": "8690002", "title": "ÜLKER ÇOKOPRENS 10'LU", "price": "29,50 TL", "copies": 1}
], source="MOBILE")

log_printed_batch([
    {"barcode": "8690003", "title": "ETİ HOŞBEŞ FINDIKLI 142 GR", "price": "26,00 TL", "copies": 5}
], source="PC")

print("✓ Loglar başarıyla yazıldı.")

print("\n--- 2. GÜNLÜK ÖZET RAPORU SORGULAMA ---")
summaries = get_all_daily_reports_summary()
for s in summaries:
    print(f"Tarih: {s['display_date']} ({s['date_key']})")
    print(f"  Toplam Ürün        : {s['total_catalog_products']}")
    print(f"  Mobilden Değişen   : {s['mobile_price_changes']} adet")
    print(f"  PC'den Değişen     : {s['pc_price_changes']} adet")
    print(f"  Toplam Basılan     : {s['total_printed_barcodes']} adet (Mobil: {s['mobile_printed_barcodes']}, PC: {s['pc_printed_barcodes']})")

print("\n--- 3. GÜN DETAY RAPORU SORGULAMA ---")
today_key = _get_today_key()
detail = get_daily_report_detail(today_key)
print(f"Fiyat Değişiklikleri ({len(detail.get('price_changes', []))} adet):")
for pc in detail.get('price_changes', []):
    print(f"  [{pc['time']}] [{pc['source']}] {pc['title']} ({pc['barcode']}): {pc['old_price']} -> {pc['new_price']}")

print(f"\nBasılan Etiketler ({len(detail.get('printed_items', []))} adet):")
for pi in detail.get('printed_items', []):
    print(f"  [{pi['time']}] [{pi['source']}] {pi['title']} ({pi['barcode']}): {pi['price']} x {pi['copies']} adet")
