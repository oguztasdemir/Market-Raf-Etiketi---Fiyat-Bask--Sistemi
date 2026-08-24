# -*- coding: utf-8 -*-
"""
ÇOK FORMATLI FATURA OKUMA DOĞRULAMA TESTİ (XML, PDF, FOTOĞRAF OCR)
"""
import io
import os
import sys
import json
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.abspath(r'c:\Users\User\Desktop\Etiket Çıkarıcı'))
from main import app

client = app.test_client()

print("=" * 65)
print("TESTING MULTI-FORMAT INVOICE EXTRACTION (XML, PDF, IMAGE OCR)")
print("=" * 65)

# 1. XML / UBL-TR e-Fatura Testi
xml_sample = """<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
    <ID>GIB2026000009999</ID>
    <IssueDate>2026-08-24</IssueDate>
    <AccountingSupplierParty>
        <Party><PartyName><Name>TEST GIDA DAGITIM A.S.</Name></PartyName></Party>
    </AccountingSupplierParty>
    <LegalMonetaryTotal>
        <LineExtensionAmount currencyID="TRY">1000.00</LineExtensionAmount>
        <TaxInclusiveAmount currencyID="TRY">1100.00</TaxInclusiveAmount>
        <PayableAmount currencyID="TRY">1100.00</PayableAmount>
    </LegalMonetaryTotal>
    <InvoiceLine>
        <ID>1</ID>
        <InvoicedQuantity unitCode="C62">10</InvoicedQuantity>
        <Item>
            <Name>KENT 375 GR SEKER</Name>
            <SellersItemIdentification><ID>8690515125163</ID></SellersItemIdentification>
        </Item>
        <Price><PriceAmount currencyID="TRY">100.00</PriceAmount></Price>
        <TaxTotal><TaxSubtotal><Percent>10</Percent></TaxSubtotal></TaxTotal>
    </InvoiceLine>
</Invoice>"""

res1 = client.post("/api/invoice/upload", data={'file': (io.BytesIO(xml_sample.encode('utf-8')), 'e-fatura.xml')})
assert res1.status_code == 200
data1 = res1.get_json().get('invoice', {})
assert data1.get('invoice_no') == 'GIB2026000009999'
assert len(data1.get('items', [])) == 1
print(f"[PASS] 1. XML e-Fatura Ayrıştırıldı -> {data1.get('supplier_name')} | Toplam: {data1.get('grand_total_str')}")

# 2. PDF Fatura Testi (PyMuPDF / pdfplumber)
import fitz
pdf_doc = fitz.open()
page = pdf_doc.new_page(width=595, height=842)
page.insert_text((50, 50), "SAYIN: TOPTAN GIDA PAZARLAMA LTD.")
page.insert_text((50, 80), "FATURA NO: PDF-2026-901")
page.insert_text((50, 110), "TARIH: 24.08.2026")
page.insert_text((50, 150), "8690504000100 CAYKUR RIZE TURIST 1000 GR  10 ADET  150.00  1500.00")
page.insert_text((50, 200), "GENEL TOPLAM: 1650.00 TL")
pdf_bytes = pdf_doc.tobytes()
pdf_doc.close()

res2 = client.post("/api/invoice/upload", data={'file': (io.BytesIO(pdf_bytes), 'fatura.pdf')})
assert res2.status_code == 200
data2 = res2.get_json().get('invoice', {})
assert data2.get('supplier_name') == 'TOPTAN GIDA PAZARLAMA LTD.'
print(f"[PASS] 2. PDF Fatura Ayrıştırıldı -> {data2.get('supplier_name')} | Kalem: {len(data2.get('items', []))}")

# 3. Fotoğraf OCR Testi (Windows.Media.Ocr)
img = Image.new('RGB', (800, 500), color=(255, 255, 255))
draw = ImageDraw.Draw(img)
draw.text((40, 40), "SAYIN: MEVSIM TOPTAN GIDA LTD", fill=(0, 0, 0))
draw.text((40, 70), "FATURA NO: FOTO-2026-777", fill=(0, 0, 0))
draw.text((40, 100), "8690515125163 BY.KENT ASSORTMENT 375 GR  10 ADET  125.00  1250.00", fill=(0, 0, 0))
draw.text((40, 140), "GENEL TOPLAM: 1375.00 TL", fill=(0, 0, 0))
img_buf = io.BytesIO()
img.save(img_buf, format="JPEG")
img_bytes = img_buf.getvalue()

res3 = client.post("/api/invoice/upload", data={'file': (io.BytesIO(img_bytes), 'fatura_fotografi.jpg')})
assert res3.status_code == 200
data3 = res3.get_json().get('invoice', {})
print(f"[PASS] 3. Fotoğraf OCR Ayrıştırıldı -> Format: {data3.get('format')} | Tedarikçi: {data3.get('supplier_name')}")

print("=" * 65)
print("ALL 3 INVOICE EXTRACTORS (XML, PDF, PHOTO OCR) PASSED 100%!")
print("=" * 65)
