# -*- coding: utf-8 -*-
"""
Gerçek Fatura Görseli Üretme ve OCR ile Okuma Testi
"""
import io
import os
import sys
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.abspath(r'c:\Users\User\Desktop\Etiket Çıkarıcı'))
from backend.fatura.ocr_ve_pdf_ayristirici import extract_text_from_image_windows_ocr, extract_text_from_pdf
from backend.fatura.fatura_servisi import parse_text_or_ocr_invoice

# 1. Test Faturası Görseli Oluştur (Sanki kamerayla çekilmiş gibi)
img = Image.new('RGB', (900, 600), color=(255, 255, 255))
d = ImageDraw.Draw(img)

# Metinleri çiz
d.text((50, 40), "SAYIN: ANADOLU GIDA TOPTAN LTD. STI.", fill=(0, 0, 0))
d.text((50, 70), "VKN: 1234567890", fill=(0, 0, 0))
d.text((50, 100), "FATURA NO: GIB2026888999", fill=(0, 0, 0))
d.text((50, 130), "TARIH: 24.08.2026", fill=(0, 0, 0))

d.text((50, 180), "--------------------------------------------------------", fill=(0, 0, 0))
d.text((50, 210), "8690515125163 KENT ASSORTMENT 375GR   10 ADET  125.00  1250.00", fill=(0, 0, 0))
d.text((50, 240), "8690504000100 CAYKUR RIZE TURIST 1KG   20 ADET  150.00  3000.00", fill=(0, 0, 0))
d.text((50, 280), "--------------------------------------------------------", fill=(0, 0, 0))
d.text((50, 320), "ARA TOPLAM: 4250.00 TL", fill=(0, 0, 0))
d.text((50, 350), "KDV TOPLAM: 425.00 TL", fill=(0, 0, 0))
d.text((50, 380), "GENEL TOPLAM: 4675.00 TL", fill=(0, 0, 0))

buf = io.BytesIO()
img.save(buf, format="PNG")
img_bytes = buf.getvalue()

print("1. Görsel OCR Motoruna Gönderiliyor...")
ocr_text = extract_text_from_image_windows_ocr(img_bytes)
print("--- OCR TARAFINDAN OKUNAN METİN ---")
print(ocr_text)
print("----------------------------------")

parsed = parse_text_or_ocr_invoice(ocr_text)
print(f"[PASS] OCR Fatura Ayrıştırıldı:")
print(f"       Tedarikçi: {parsed.get('supplier_name')}")
print(f"       Fatura No: {parsed.get('invoice_no')}")
print(f"       Toplam: {parsed.get('grand_total_str')}")
print(f"       Kalem Sayısı: {len(parsed.get('items', []))}")
for itm in parsed.get('items', []):
    print(f"       -> {itm.get('barcode')} | {itm.get('title')} | Miktar: {itm.get('quantity')} | Birim: {itm.get('list_price_str')} | Toplam: {itm.get('line_total_str')}")
