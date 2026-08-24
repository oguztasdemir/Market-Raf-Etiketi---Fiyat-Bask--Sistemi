import os
import sys
import json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from main import app

def test_fatura_system():
    print("============================================================")
    print("FATURA OKUMA VE MATEMATİKSEL SAĞLAMA SİSTEMİ DOĞRULAMA TESTİ")
    print("============================================================")

    client = app.test_client()

    # 1. Demo Sample Fatura API Testi
    resp = client.get("/api/invoice/demo-sample")
    assert resp.status_code == 200
    res = json.loads(resp.data.decode('utf-8'))
    assert res.get("status") == "success"
    inv = res.get("invoice", {})
    assert len(inv.get("items", [])) > 0
    assert "validation" in inv
    val = inv["validation"]
    print(f"[PASS] 1. Demo Fatura Yüklendi -> {inv.get('supplier_name')} | {inv.get('grand_total_str')}")
    print(f"       Sağlama Durumu: {val.get('status_text')}")
    print(f"       Hesaplanan: {val.get('calculated_grand_total_str')} vs Fatura: {val.get('header_grand_total_str')}")

    # 2. XML / UBL-TR Fatura Ayrıştırma Testi
    sample_ubl_xml = """<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
    <cbc:ID>GIB2026000004589</cbc:ID>
    <cbc:IssueDate>2026-08-23</cbc:IssueDate>
    <cac:AccountingSupplierParty>
        <cac:Party>
            <cac:PartyName>
                <cbc:Name>ÖZ ANADOLU TOPTAN GIDA DAĞITIM A.Ş.</cbc:Name>
            </cac:PartyName>
            <cac:PartyIdentification>
                <cbc:ID>9876543210</cbc:ID>
            </cac:PartyIdentification>
        </cac:Party>
    </cac:AccountingSupplierParty>
    <cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="TRY">2500.00</cbc:LineExtensionAmount>
        <cbc:TaxExclusiveAmount currencyID="TRY">2500.00</cbc:TaxExclusiveAmount>
        <cbc:TaxInclusiveAmount currencyID="TRY">2750.00</cbc:TaxInclusiveAmount>
        <cbc:PayableAmount currencyID="TRY">2750.00</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>
    <cac:InvoiceLine>
        <cbc:ID>1</cbc:ID>
        <cbc:InvoicedQuantity unitCode="C62">20</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="TRY">2500.00</cbc:LineExtensionAmount>
        <cac:Item>
            <cbc:Name>BY.KENT 375 GR ASSORTMENT KAR.ŞEKER</cbc:Name>
            <cac:SellersItemIdentification>
                <cbc:ID>8690515125163</cbc:ID>
            </cac:SellersItemIdentification>
        </cac:Item>
        <cac:Price>
            <cbc:PriceAmount currencyID="TRY">125.00</cbc:PriceAmount>
        </cac:Price>
        <cac:TaxTotal>
            <cac:TaxSubtotal>
                <cbc:Percent>10</cbc:Percent>
            </cac:TaxSubtotal>
        </cac:TaxTotal>
    </cac:InvoiceLine>
</Invoice>
"""

    resp2 = client.post("/api/invoice/upload", json={"content": sample_ubl_xml, "filename": "fatura.xml"})
    assert resp2.status_code == 200
    res2 = json.loads(resp2.data.decode('utf-8'))
    assert res2.get("status") == "success"
    inv2 = res2.get("invoice", {})
    assert inv2.get("supplier_name") == "ÖZ ANADOLU TOPTAN GIDA DAĞITIM A.Ş."
    assert inv2.get("invoice_no") == "GIB2026000004589"
    assert len(inv2.get("items", [])) == 1
    item1 = inv2["items"][0]
    assert item1.get("matched") is True
    print(f"[PASS] 2. XML/UBL-TR Çözümleme ve Katalog Eşleme -> {item1.get('title')}")
    print(f"       Mevcut Stok: {item1.get('current_stock')} -> Yeni Stok: {item1.get('new_stock')}")

    # 3. Fatura Onaylama ve Stok & Muhasebe İşleme Testi
    resp3 = client.post("/api/invoice/commit", json={
        "invoice": inv2,
        "options": {"update_stocks": True, "add_to_expenses": True}
    })
    assert resp3.status_code == 200
    res3 = json.loads(resp3.data.decode('utf-8'))
    assert res3.get("status") == "success"
    print(f"[PASS] 3. Fatura Onaylandı & Stoklara ve Muhasebe Giderlerine Eklendi -> {res3.get('message')}")

    print("============================================================")
    print("TÜM FATURA OKUMA VE SAĞLAMA TESTLERİ BAŞARIYLA GEÇTİ!")
    print("============================================================")

if __name__ == "__main__":
    test_fatura_system()
