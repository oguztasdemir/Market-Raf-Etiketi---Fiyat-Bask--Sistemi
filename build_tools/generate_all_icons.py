# -*- coding: utf-8 -*-
"""
Tüm modüller için modern, göz alıcı ve ayırt edici profesyonel ikonlar (.ico) ve C#/.NET launcher derleyicisi.
"""
import os
import sys
import subprocess
from PIL import Image, ImageDraw, ImageFont

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ICONS_DIR = os.path.join(BASE_DIR, "build_tools", "ikonlar")
os.makedirs(ICONS_DIR, exist_ok=True)

def create_high_res_icon(filename, bg_gradient, symbol, title_sub=""):
    """256x256 modern, gölgeli, gradyanlı ve net sembollü Windows .ico üretir."""
    size = 256
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 1. Yuvarlatılmış Arka Plan (Rounded Box) ve degrade simülasyonu
    pad = 14
    rad = 48
    c1, c2 = bg_gradient # RGB tuples

    # Dikey gradyan çizimi
    for y in range(pad, size - pad):
        factor = (y - pad) / float(size - 2 * pad)
        r = int(c1[0] + factor * (c2[0] - c1[0]))
        g = int(c1[1] + factor * (c2[1] - c1[1]))
        b = int(c1[2] + factor * (c2[2] - c1[2]))
        draw.rounded_rectangle([pad, pad, size - pad, size - pad], radius=rad, fill=(r, g, b, 255))

    # Kenarlık (Glossy / Glass border)
    draw.rounded_rectangle([pad, pad, size - pad, size - pad], radius=rad, outline=(255, 255, 255, 110), width=5)
    # İç parlama çizgisi
    draw.rounded_rectangle([pad + 4, pad + 4, size - pad - 4, size - pad - 4], radius=rad - 4, outline=(255, 255, 255, 40), width=2)

    # Üst Işık (Highlight)
    highlight_h = 75
    draw.ellipse([pad + 10, pad - 20, size - pad - 10, pad + highlight_h], fill=(255, 255, 255, 35))

    # Sembol / İkon Çizimi (Font veya Şekil)
    font_paths = [
        r"C:\Windows\Fonts\seguiemj.ttf",
        r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\arial.ttf"
    ]
    font_main = None
    for fp in font_paths:
        if os.path.exists(fp):
            try:
                font_main = ImageFont.truetype(fp, 105)
                font_sub = ImageFont.truetype(fp, 26)
                break
            except Exception:
                pass

    if not font_main:
        font_main = ImageFont.load_default()
        font_sub = ImageFont.load_default()

    # Sembolü ortala
    try:
        draw.text((size // 2 + 2, 108 + 3), symbol, font=font_main, fill=(0, 0, 0, 120), anchor="mm")
        draw.text((size // 2, 108), symbol, font=font_main, fill=(255, 255, 255, 255), anchor="mm")
        
        if title_sub:
            draw.text((size // 2 + 1, 195 + 1), title_sub, font=font_sub, fill=(0, 0, 0, 160), anchor="mm")
            draw.text((size // 2, 195), title_sub, font=font_sub, fill=(255, 255, 255, 240), anchor="mm")
    except Exception:
        draw.text((60, 45), symbol, font=font_main, fill=(255, 255, 255, 255))

    out_path = os.path.join(ICONS_DIR, filename)
    img.save(out_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print(f"İkon oluşturuldu: {out_path}")
    return out_path

if __name__ == '__main__':
    icons_spec = [
        ("icon_setup.ico", ((15, 118, 110), (13, 148, 136)), "⚙️", "KURULUM"),
        ("icon_kasa.ico", ((21, 128, 61), (34, 197, 94)), "🛒", "KASA"),
        ("icon_terazi.ico", ((2, 132, 199), (56, 189, 248)), "⚖️", "TERAZİ"),
        ("icon_stok.ico", ((109, 40, 217), (139, 92, 246)), "📦", "STOK"),
        ("icon_hizli.ico", ((217, 119, 6), (245, 158, 11)), "⚡", "HIZLI ÜRÜN"),
        ("icon_main.ico", ((30, 58, 138), (37, 99, 235)), "🏷️", "ANA SİSTEM"),
    ]

    for ico_file, grad, sym, title in icons_spec:
        create_high_res_icon(ico_file, grad, sym, title)

    print("Tüm ikonlar basariyla olusturuldu.")
