# -*- coding: utf-8 -*-
"""
SQLite Depolama ve Veritabanı Tam Entegrasyon Testi
"""
import os
import sys
import unittest

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from backend.ayarlar import (
    PRODUCTS_FILE, MANAV_PRODUCTS_FILE, CUSTOM_BARCODES_FILE,
    CASH_MOVEMENTS_FILE, CUSTOMERS_FILE, EXPENSES_FILE,
    EMPLOYEES_FILE, CASHIERS_FILE, ROLES_FILE, SETTINGS_FILE,
    TEMPLATES_FILE, DRAFT_CACHE_FILE
)
from backend.araclar.depolama_araclari import (
    load_json, save_json, get_sales_for_date, save_sales_for_date
)
from backend.yedekleme.yedekleme_servisi import (
    create_products_backup, get_backups_list
)

class TestSQLiteSystem(unittest.TestCase):

    def test_01_read_migrated_products(self):
        products = load_json(PRODUCTS_FILE)
        self.assertIsInstance(products, list)
        self.assertEqual(len(products), 4581)
        self.assertTrue(any(p.get("barcode") == "8690511104926" for p in products))

    def test_02_read_manav_and_custom_barcodes(self):
        manav = load_json(MANAV_PRODUCTS_FILE)
        self.assertIsInstance(manav, list)
        self.assertEqual(len(manav), 73)

        ozel = load_json(CUSTOM_BARCODES_FILE)
        self.assertIsInstance(ozel, list)
        self.assertEqual(len(ozel), 6)

    def test_03_read_customers_and_expenses(self):
        customers = load_json(CUSTOMERS_FILE)
        self.assertIsInstance(customers, list)
        self.assertEqual(len(customers), 25)

        expenses = load_json(EXPENSES_FILE)
        self.assertIsInstance(expenses, list)
        self.assertEqual(len(expenses), 13)

    def test_04_read_settings(self):
        settings = load_json(SETTINGS_FILE)
        self.assertIsInstance(settings, dict)
        self.assertTrue("market_name" in settings or len(settings) > 0)

    def test_05_cash_movements(self):
        kasa = load_json(CASH_MOVEMENTS_FILE)
        self.assertIsInstance(kasa, list)
        initial_count = len(kasa)

        # Yeni hareket ekle
        new_movement = {
            "id": "test_cflow_999",
            "type": "in",
            "amount": 250.0,
            "amount_str": "250,00 TL",
            "category": "Kasa Devir",
            "description": "Birim Testi Kasa Girişi",
            "cashier": "Admin",
            "date": "2026-08-28",
            "time": "12:00:00",
            "created_at": "28.08.2026 12:00:00"
        }
        kasa.append(new_movement)
        save_json(CASH_MOVEMENTS_FILE, kasa)

        reloaded = load_json(CASH_MOVEMENTS_FILE)
        self.assertEqual(len(reloaded), initial_count + 1)
        self.assertTrue(any(k.get("id") == "test_cflow_999" for k in reloaded))

        # Temizle
        reloaded = [k for k in reloaded if k.get("id") != "test_cflow_999"]
        save_json(CASH_MOVEMENTS_FILE, reloaded)
        self.assertEqual(len(load_json(CASH_MOVEMENTS_FILE)), initial_count)

    def test_06_sales_operations(self):
        test_date = "2026-08-28"
        sales = get_sales_for_date(test_date)
        
        test_sale = {
            "receipt_no": "TEST-FIS-001",
            "date": test_date,
            "time": "11:30:00",
            "timestamp": "2026-08-28T11:30:00",
            "cashier": "Kasa 1",
            "customer": "Test Müşteri",
            "payment_type": "Nakit",
            "total_amount": 100.0,
            "received_cash": 100.0,
            "change_amount": 0.0,
            "items": [{"barcode": "8690511104926", "title": "Test Ürün", "price": 100.0, "qty": 1}]
        }
        save_sales_for_date(test_date, [test_sale])
        
        fetched = get_sales_for_date(test_date)
        self.assertEqual(len(fetched), 1)
        self.assertEqual(fetched[0]["receipt_no"], "TEST-FIS-001")
        self.assertEqual(fetched[0]["total_amount"], 100.0)

    def test_07_backup_and_restore(self):
        backup_name = create_products_backup(reason="Otomasyon Test Yedegi")
        self.assertIsNotNone(backup_name)
        self.assertTrue(backup_name.endswith(".db") or backup_name.endswith(".json"))
        
        backups = get_backups_list()
        self.assertTrue(len(backups) > 0)
        self.assertEqual(backups[0]["filename"], backup_name)

if __name__ == "__main__":
    unittest.main()
