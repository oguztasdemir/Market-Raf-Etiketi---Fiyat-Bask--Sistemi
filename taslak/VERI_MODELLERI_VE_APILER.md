# 🗄️ VERİ MODELLERİ VE API REFERANSI DOKÜMANI

Bu doküman, sistemin veri saklama yapılarını (JSON) ve backend API rotalarını tanımlar.

---

## 🗃️ 1. JSON VERİ YAPILARI (DATA SCHEMAS)

### 1. `data/products.json` (Ürün Kataloğu)
```json
[
  {
    "id": "12345",
    "barcode": "8690504000100",
    "title": "ÇAYKUR RİZE TURİST ÇAY 1000 GR",
    "price": "195.00 TL",
    "price_raw": 195.0,
    "unit": "Adet",
    "vat": 10,
    "stock": 45,
    "company": "ÇAYKUR",
    "updated_at": "2026-08-23 14:20:00"
  }
]
```

### 2. `data/sales/YYYY-MM-DD.json` (Günlük Kasa Satış Fişleri)
```json
[
  {
    "receipt_no": "FIS-20260823-7826",
    "date": "2026-08-23",
    "time": "12:37:06",
    "cashier": "Kasa 1 (Kasiyer 1)",
    "customer": "Perakende Müşteri",
    "payment_type": "Nakit",
    "total_amount": 240.0,
    "total_vat": 21.82,
    "received_cash": 240.0,
    "change_amount": 0.0,
    "item_count": 1,
    "items": [
      {
        "barcode": "8690000000000",
        "title": "ANANAS ADET",
        "unit": "Adet",
        "quantity": 1.0,
        "unit_price": 240.0,
        "total_price": 240.0,
        "is_scale_item": false
      }
    ]
  }
]
```

### 3. `data/daily_reports.json` (Günlük Faaliyet ve Değişim Kütüğü)
```json
{
  "2026-08-23": {
    "date_key": "2026-08-23",
    "display_date": "23 Ağu 2026, Pazar",
    "stats": {
      "total_price_changes": 4,
      "total_printed_barcodes": 166
    },
    "price_changes": [
      {
        "barcode": "8690515125163",
        "title": "BY.KENT 375 GR ŞEKER",
        "old_price": "85,00 TL",
        "new_price": "95,00 TL",
        "time": "11:15",
        "source": "PC"
      }
    ],
    "printed_items": []
  }
}
```

---

## 🌐 2. BACKEND API ROTALARI REFERANSI

### 🔹 Hızlı Kasa (POS) Rotaları:
* **`POST /api/pos/checkout`**: Satışı tamamlar, fişi `data/sales/YYYY-MM-DD.json` dosyasına yazar.
* **`GET /api/pos/price-check?barcode=...`**: Fiyat Gör ekranı için anlık ürün ve fiyat sorgular.
* **`GET /api/pos/summary`**: Günün anlık toplam ciro, fiş adedi ve son satış listesini döner.

### 🔹 Ürün & Katalog Rotaları:
* **`GET /api/products`**: Tüm ürün listesini arama, sayfalama ve filtreleme parametreleriyle döner.
* **`POST /api/products/custom-barcode`**: Özel/dahili barkod ekler ve günceller.
* **`GET /api/products/history?barcode=...`**: Ürünün geçmiş fiyat değişim ve baskı hareketlerini döner.

### 🔹 Raporlama & Analitik Rotaları:
* **`GET /api/reports/calendar?year=YYYY&month=MM`**: Ayın gün gün satış, fiş, etiket ve ciro tablosunu döner.
* **`GET /api/reports/day_detail?date=YYYY-MM-DD`**: Seçilen günün çok satanlarını, 24 saat dağılımını, reyon paylarını, kasiyer mutabakatını, fişlerini ve trend rozetlerini döner.
* **`GET /api/reports/heatmap?year=YYYY&month=MM`**: 7 Gün x 24 Saatlik yoğunluk ısı haritası (Heatmap) matrisini döner.

### 🔹 Manav & Terazi Rotaları:
* **`GET /api/scale/products`**: PLU tanımlı manav ve tartım ürünlerini döner.
* **`POST /api/scale/sync`**: Terazi ürün dosyasını günceller.
