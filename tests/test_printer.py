import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.printer_service import print_raw_zpl
from src.zpl_generator import generate_market_shelf_zpl

if __name__ == "__main__":
    printer = "Termal Etiket Yazici"
    test_data = {
        "title1": "ULK 398-6 PIKO PORTAKAL",
        "title2": "PIR PAT KAP",
        "brand": "YARENLER",
        "origin": "TURKIYE",
        "date": "19 Agu 2026",
        "unit_price": "250.00 TL/Kg",
        "barcode": "8690504114925",
        "price": "10,00 TL"
    }

    print(f"Test ZPL gonderiliyor -> {printer}...")
    zpl = generate_market_shelf_zpl(test_data, orientation="POR")
    try:
        print_raw_zpl(printer, zpl, doc_name="ZPL Test")
        print("[BASARILI] Test baskisi basariyla gonderildi!")
    except Exception as e:
        print(f"[HATA] Hata: {e}")
