"""
ZPL Üretim ve Görsel Doğrulama Testi (0 Derece ve 90 Derece)
"""
import os
import urllib.request
from src.zpl_generator import generate_market_shelf_zpl

def test_render():
    data = {
        "title1": "ULK 398-6 PİKO PORTAKAL",
        "title2": "PİR PAT KAP",
        "brand": "YARENLER",
        "origin": "TÜRKİYE",
        "date": "14 May 2025",
        "unit_price": "250,00 TL/Kg",
        "barcode": "8690504114925",
        "price": "10,00 TL",
        "show_yerli": True
    }

    # 1. 0 Derece Düz Mod (76x40 mm -> 3x1.57 inch)
    zpl_pon = generate_market_shelf_zpl(data, orientation="PON", width_mm=76, height_mm=40)
    try:
        url = "http://api.labelary.com/v1/printers/8dpmm/labels/3x1.57/0/"
        req = urllib.request.Request(url, data=zpl_pon.encode('utf-8'), headers={'Accept': 'image/png'})
        with urllib.request.urlopen(req, timeout=5) as response:
            with open("test_render_pon.png", "wb") as f:
                f.write(response.read())
        print("[BAŞARILI] 0 Derece Düz Mod PNG oluşturuldu: test_render_pon.png")
    except Exception as e:
        print("0 Derece Hata:", e)

    # 2. 90 Derece Yatay Mod (1.57x3 inch)
    zpl_por = generate_market_shelf_zpl(data, orientation="POR", width_mm=76, height_mm=40)
    try:
        url = "http://api.labelary.com/v1/printers/8dpmm/labels/1.57x3.2/0/"
        req = urllib.request.Request(url, data=zpl_por.encode('utf-8'), headers={'Accept': 'image/png'})
        with urllib.request.urlopen(req, timeout=5) as response:
            with open("test_render_por.png", "wb") as f:
                f.write(response.read())
        print("[BAŞARILI] 90 Derece Yatay Mod PNG oluşturuldu: test_render_por.png")
    except Exception as e:
        print("90 Derece Hata:", e)

if __name__ == "__main__":
    test_render()
