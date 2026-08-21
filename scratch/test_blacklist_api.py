import sys
import os
import json

sys.path.insert(0, os.getcwd())
sys.stdout.reconfigure(encoding='utf-8')

from main import app

client = app.test_client()

print("--- Toplu Kara Liste Endpoint Testi ---")
res = client.post('/api/blacklist/batch-add', json={
    "items": [{
        "barcode": "9999999999999",
        "title": "TEST ENGELLEME URUNU"
    }],
    "delete_from_catalog": False
})
print(f"Status: {res.status_code}")
print(f"Yanıt: {res.get_json()}")

# Clean up test item
res_clean = client.post('/api/blacklist/remove', json={"barcode": "9999999999999"})
print(f"Temizlik: {res_clean.get_json()}")
