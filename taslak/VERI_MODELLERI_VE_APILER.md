# 🗄️ VERİ MODELLERİ VE API REFERANSI DOKÜMANI

Bu doküman, sistemin veri saklama yapılarını (JSON) ve backend API rotalarını tanımlar.

---

## 🗃️ 1. JSON VERİ YAPILARI (DATA SCHEMAS)

### 1. `data/urunler/urunler.json` (Ürün Kataloğu)
```json
[
  {
    "barcode": "8690504000100",
    "title": "ÇAYKUR RİZE TURİST ÇAY 1000 GR",
    "price": "195,00 TL",
    "unit": "Adet",
    "stock": 45,
    "brand": "ÇAYKUR",
    "updated_at": "23 Ağu 2026 14:20"
  }
]
```

### 2. `data/satis_ve_kasa/satislar/YYYY/MM/YYYY-MM-DD.json` (Günlük Kasa Satış Fişleri)
```json
[
  {
    "receipt_no": "FIS-20260823-1001",
    "time": "14:35:10",
    "cashier": "Yönetici (Admin)",
    "payment_type": "Nakit",
    "total_amount": 195.0,
    "received_cash": 200.0,
    "change_amount": 5.0,
    "items": [
      {
        "barcode": "8690504000100",
        "title": "ÇAYKUR RİZE TURİST ÇAY 1000 GR",
        "quantity": 1,
        "price": "195,00 TL",
        "total": "195,00 TL"
      }
    ]
  }
]
```

### 3. `data/sistem_ve_ayarlar/kasiyerler.json` (Kasiyer Kadrosu)
```json
[
  {
    "id": "kasa1",
    "name": "Ahmet Yılmaz",
    "pin": "1234",
    "role": "admin",
    "active": true,
    "created_at": "2026-08-23 10:00"
  }
]
```

### 4. `data/sistem_ve_ayarlar/ayarlar.json` (Market & Donanım Ayarları)
```json
{
  "market_name": "YARENLER MARKET",
  "branch_name": "Merkez Şube - Kasa 1",
  "phone": "0555 123 45 67",
  "pos_commission_rate": 1.85,
  "default_payment_type": "Nakit",
  "receipt_print_mode": "ask",
  "receipt_paper_width": "80mm"
}
```

---

## 🌐 2. BACKEND API ROTALARI REFERANSI

### 🔹 Hızlı Kasa (POS) Rotaları:
* **`POST /api/pos/checkout`**: Satışı tamamlar, fişi `data/satis_ve_kasa/satislar/YYYY/MM/YYYY-MM-DD.json` dosyasına yazar.
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
