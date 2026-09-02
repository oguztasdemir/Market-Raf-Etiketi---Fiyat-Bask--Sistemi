# -*- coding: utf-8 -*-
import os
import unittest
import sqlite3
import pandas as pd
import io
import json
import shutil

# Ensure workspace paths
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.araclar.sqlite_servisi import DB_PATH
from backend.ayarlar import PRODUCTS_FILE, MANAV_PRODUCTS_FILE, SETTINGS_FILE, MARKET_PROFILE_FILE
from backend.araclar.setup_servisi import execute_setup, export_prices_to_excel, MARKER_FILE

class TestSetupFlow(unittest.TestCase):
    def setUp(self):
        # Back up active files
        self.backups = {}
        for path in [DB_PATH, PRODUCTS_FILE, MANAV_PRODUCTS_FILE, SETTINGS_FILE, MARKET_PROFILE_FILE, MARKER_FILE]:
            if os.path.exists(path):
                backup_path = path + ".bak_test"
                shutil.copy2(path, backup_path)
                self.backups[path] = backup_path

    def tearDown(self):
        import gc
        gc.collect()
        # Restore backups
        for path, backup_path in self.backups.items():
            if os.path.exists(backup_path):
                try:
                    if os.path.exists(path):
                        if os.path.isdir(path):
                            shutil.rmtree(path, ignore_errors=True)
                        else:
                            os.remove(path)
                    shutil.copy2(backup_path, path)
                    os.remove(backup_path)
                except Exception:
                    pass
                
        # Clean up any leftover test marker files
        if os.path.exists(MARKER_FILE) and MARKER_FILE not in self.backups:
            try:
                os.remove(MARKER_FILE)
            except Exception:
                pass

    def test_setup_execution_without_excel(self):
        """Test first-time setup initialization with empty prices (no Excel uploaded)."""
        market_info = {
            "market_name": "TEST BILGISAYAR MARKETI",
            "branch_name": "Kasa-2 Şubesi",
            "phone": "0212 999 88 77",
            "address": "İstanbul, Kadıköy",
            "tax_office": "Kadıköy",
            "tax_no": "1234567890",
            "receipt_paper_width": "58mm",
            "daily_cash_advance": "750",
            "receipt_footer_note": "Test Teşekkür Notu"
        }
        
        success, msg = execute_setup(market_info, excel_file_bytes=None)
        self.assertTrue(success)
        self.assertEqual(msg, "Kurulum başarıyla tamamlandı!")
        
        # Verify marker file exists
        self.assertTrue(os.path.exists(MARKER_FILE))
        
        conn = sqlite3.connect(DB_PATH)
        try:
            cursor = conn.cursor()
            
            # Verify product count
            cursor.execute("SELECT COUNT(*) FROM urunler")
            count = cursor.fetchone()[0]
            self.assertGreater(count, 4000)
            
            # Verify all product prices are empty / zero
            cursor.execute("SELECT COUNT(*) FROM urunler WHERE price_num > 0 OR price != ''")
            non_zero_count = cursor.fetchone()[0]
            self.assertEqual(non_zero_count, 0)
            
            # Verify settings
            cursor.execute("SELECT name, role_id FROM calisanlar WHERE id = 'kasa1'")
            cashier = cursor.fetchone()
            self.assertEqual(cashier[0], "Kasa 1 (Kasiyer)")
            self.assertEqual(cashier[1], "admin")
        finally:
            conn.close()

    def test_setup_execution_with_excel_migration(self):
        """Test first-time setup initialization importing prices from an Excel sheet."""
        # Create a mock Excel workbook bytes
        mock_data = {
            "Barkod": ["8690511104926", "8690511104841", "InvalidBarcode"],
            "Ürün Adı": ["ABC ELDE 600 GR YIKAMA LAVANTA TAZELIGI", "ABC ELDE 600 GR YIKAMA SODA ETKILI", "Non Existent"],
            "KDV (%)": [10.0, 10.0, 20.0],
            "Alış Fiyatı (TL)": [30.00, 32.50, 5.00],
            "Satış Fiyatı (TL)": [45.50, 48.00, 10.00]
        }
        df = pd.DataFrame(mock_data)
        excel_io = io.BytesIO()
        with pd.ExcelWriter(excel_io, engine='openpyxl') as writer:
            df.to_excel(writer, index=False)
        excel_bytes = excel_io.getvalue()
        
        market_info = {
            "market_name": "MIGRATED MARKET",
            "branch_name": "Merkez"
        }
        
        success, msg = execute_setup(market_info, excel_file_bytes=excel_bytes)
        self.assertTrue(success)
        
        # Verify database connection
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Verify matched products have correct updated prices in SQLite
        cursor.execute("SELECT buy_price, price_num, price, vat FROM urunler WHERE barcode = '8690511104926'")
        row1 = cursor.fetchone()
        self.assertEqual(row1[0], 30.00)
        self.assertEqual(row1[1], 45.50)
        self.assertEqual(row1[2], "45,50 TL")
        self.assertEqual(row1[3], 10.0)
        
        cursor.execute("SELECT buy_price, price_num, price, vat FROM urunler WHERE barcode = '8690511104841'")
        row2 = cursor.fetchone()
        self.assertEqual(row2[0], 32.50)
        self.assertEqual(row2[1], 48.00)
        self.assertEqual(row2[2], "48,00 TL")
        self.assertEqual(row2[3], 10.0)
        
        # Verify unmatched products remain zero
        cursor.execute("SELECT COUNT(*) FROM urunler WHERE barcode NOT IN ('8690511104926', '8690511104841') AND price_num > 0")
        unmatched_non_zero = cursor.fetchone()[0]
        self.assertEqual(unmatched_non_zero, 0)
        
        conn.close()

if __name__ == '__main__':
    unittest.main()
