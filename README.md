# 🏷️ Rafix Pro - Market Raf Fiyat Etiketi & Termal Baskı Sistemi

[![Python Version](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0%2B-lightgrey.svg)](https://palletsprojects.com/p/flask/)
[![ZPL II](https://img.shields.io/badge/ZPL-II%20Engine-brightgreen.svg)](https://www.zebra.com/)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)]()

**Rafix Pro**, modern süpermarketler, şarküteriler ve perakende mağazaları için geliştirilmiş; **Masaüstü Tasarım/Baskı Paneli**, **Mobil Kamera Barkod Terminali** ve **Excel Fiyat Senkronizasyonu** içeren profesyonel bir termal raf etiketi yönetim ekosistemidir.

Termal etiket yazıcıları (*Zebra, Xprinter, Argox, HPRT, Godex, Bixolon vb.*) ile doğrudan Windows RAW kuyruğu üzerinden milisaniyelik ZPL II kodlarıyla iletişim kurar.

---

## 🌟 Öne Çıkan Özellikler

### 🖥️ 1. Masaüstü Canlı Tasarım & Baskı Paneli
- **Milimetrik Kalibrasyon:** Yatay/Dikey rulo yönü, kafa genişliği (40mm-80mm), 203 DPI / 300 DPI çözünürlük, X/Y ofset ince ayarları.
- **Canlı Şablon Motoru:**
  - Korumalı market standart raf şablonu (Görsel 2 formatı).
  - Sağ üst köşe rozetleri: *Sade Birim Fiyat, Gramaj Rozeti, Reyon Kodu, Dinamik Karekod (QR), İndirim/Kampanya Rozeti*.
- **5.000+ Ürün Performansı:** Chunked DocumentFragment mimarisi ile donma/kilitlenme olmadan 60 FPS akıcı arama ve listeleme.
- **Türkçe Karakter & Sayısal Sıralama:** A-Z, Z-A ve fiyata göre hatasız sıralama.

### 📱 2. Mobil El Terminali & Kamera Barkod Okuyucu (`/mobile`)
- **Dahili Kamera Tarayıcı:** Telefon veya tablet kamerasını yüksek hızlı lazer okuyucuya dönüştürür.
- **🛒 Basım Listesi (Sepet) & Toplu Baskı:** Reyonda gezerek ürünleri sepete ekleme, adet belirleme, anında fiyat güncelleme ve tek tıkla toplu yazdırma.
- **⚡ Canlı Baskı Kontrolü:** Yazdırma esnasında kağıt sıkışması veya rulo bitmesi durumuna karşı **Durdur (Pause)**, **Devam Et (Resume)** ve **İptal Et (Purge Queue)** butonları.
- **🔒 Dahili SSL/HTTPS:** Mobil tarayıcılarda kamera erişim izinlerinin sorunsuz çalışması için otomatik yerel SSL desteği.

### 📊 3. Excel Fiyat Değişim & Senkronizasyon Motoru
- ERP/Muhasebe programından alınan Excel stok/fiyat listesini otomatik analiz eder.
- **Anlık Fark Tespiti:** *Yeni Ürünler*, *Fiyatı Değişenler*, *Fiyatı Düşenler*, *Fiyatı Artanlar* ve *Eşleşenler* olarak gruplar.
- **Baskı Listesine Aktarma:** Sadece fiyatı değişen ürünleri tek tıkla seçip doğrudan termal yazıcıya gönderme.

### 🛡️ 4. Güvenlik, Kara Liste & Geri Alma (Rollback)
- **Otomatik Yedekleme:** Her toplu güncelleme ve baskı işleminden önce `data/backups/` altına otomatik anlık görüntü kaydeder.
- **Tek Tıkla Geri Al:** Hatalı bir işlemde `↺ Geri Al` butonuyla veritabanını önceki haline anında döndürür.
- **Kara Liste (Blacklist):** Reyonda etiket basılması istenmeyen ürünleri gizler ve yazdırma kuyruğundan muaf tutar.

---

## 📁 Proje Dizin Yapısı

```text
Etiket Çıkarıcı/
├── main.py                  # Flask Sunucusu, API Uç Noktaları ve Yaşam Döngüsü
├── requirements.txt         # Python Paket Bağımlılıkları
├── README.md                # Proje Dokümantasyonu
│
├── src/                     # Çekirdek Python Servisleri
│   ├── __init__.py
│   ├── zpl_generator.py     # Milimetrik ZPL II Vektörel Kod & Grafik Motoru
│   └── printer_service.py   # Windows RAW Spooler & USB Yazıcı İletişim Servisi
│
├── templates/               # Web Arayüz Şablonları
│   ├── index.html           # Masaüstü Tasarım, Yönetim ve Baskı Paneli
│   └── mobile.html          # Mobil El Terminali & Barkod Okuma Arayüzü
│
├── static/                  # İstemci Tarafı Varlıkları
│   ├── css/
│   │   └── style.css        # Modern, Duyarlı (Responsive) Tasarım Stilleri
│   └── js/
│       └── app.js           # Canlı Önizleme, Sepet, ZPL İstemci Mantığı
│
└── data/                    # Dinamik Veritabanı ve Çalışma Alanı
    ├── products.json        # Aktif Ürün Kataloğu & Fiyat Veritabanı
    ├── black_list.json      # Kara Liste Barkod Kayıtları
    ├── settings.json        # Yazıcı & Kalibrasyon Ayarları
    ├── templates.json       # Özel Etiket Şablonları
    ├── backups/             # Otomatik Geri Yükleme Noktaları (Rollback)
    ├── sistem_exceli/       # Yüklenen ERP/Muhasebe Excel Dosyaları
    └── ssl/                 # Mobil Kamera İçin Otomatik SSL Sertifikaları
```

---

## 🚀 Hızlı Başlangıç

### 1. Gereksinimlerin Yüklenmesi
Windows PowerShell veya Komut İstemi'ni açın:

```powershell
pip install -r requirements.txt
```

### 2. Uygulamanın Başlatılması

```powershell
python main.py
```

Uygulama başladığında varsayılan tarayıcınızda otomatik olarak açılır:
- **Masaüstü Paneli:** `http://127.0.0.1:5000` (veya `https://127.0.0.1:5000`)
- **Mobil El Terminali:** `http://<BILGISAYAR_IP_ADRESI>:5000/mobile`

*(Not: Masaüstü panelindeki "Mobil Bağlantı" butonuna basarak doğrudan telefonunuzla okutabileceğiniz QR kodu görebilirsiniz.)*

---

## 🖨️ Yazıcı Kurulumu ve ZPL Yapılandırması

1. **Sürücü Modu:** Yazıcınızın Windows üzerinde yüklü olduğundan emin olun (Örn: *ZDesigner GK420t, Xprinter XP-365B vb.*).
2. **Yazıcı Seçimi:** Panel açıldığında üstteki **Yazıcı Seç** kutusundan termal yazıcınızı seçin.
3. **Kalibrasyon Ayarları:**
   - **Genişlik / Yükseklik:** Standart market raf etiketi için `40mm x 58mm` veya rulo ölçünüze göre belirleyin.
   - **Karanlık / Isı (Darkness):** Net ve silinmez baskı için `15 - 25` arası önerilir.
   - **X / Y Ofset:** Baskının etikete tam ortalanması için milimetrik kaydırma yapabilirsiniz.

---

## 🔌 Temel REST API Uç Noktaları

| Metot | Uç Nokta | Açıklama |
|---|---|---|
| `GET` | `/api/printers` | Bağlı Windows ve USB yazıcı listesini döndürür |
| `POST` | `/api/print` | Gönderilen ürün için ZPL oluşturup yazıcıya iletir |
| `POST` | `/api/print/cancel` | Aktif yazdırma kuyruğunu anında iptal eder ve temizler |
| `GET` | `/api/products` | Ürün kataloğunu ve fiyat listesini listeler |
| `POST` | `/api/products/update` | Ürün adı, fiyatı veya birimini anlık günceller |
| `POST` | `/api/excel/upload` | Yeni ERP Excel dosyasını yükler ve fark analizini başlatır |
| `GET` | `/api/excel/diff` | Son yüklenen Excel ile mevcut ürünlerin fiyat farklarını verir |
| `POST` | `/api/rollback` | Veritabanını seçilen geri yükleme noktasına döndürür |

---

## 📄 Lisans
Bu proje özel perakende otomasyon standartlarına uygun olarak geliştirilmiştir. Tüm hakları saklıdır.
