# ⚡ CORTEX POS - Gelişmiş Market Kasa, Terazi, Raf Etiketi & Fatura Yönetim Sistemi

[![Python Version](https://img.shields.io/badge/Python-3.10%2B-3776AB.svg?logo=python&logoColor=white)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0%2B-000000.svg?logo=flask&logoColor=white)](https://palletsprojects.com/p/flask/)
[![ZPL II](https://img.shields.io/badge/ZPL--II-Engine-22c55e.svg)](https://www.zebra.com/)
[![DIGI SM-100](https://img.shields.io/badge/DIGI-SM--100%20Scale-0284c7.svg)]()
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Web%20%7C%20Mobile-f59e0b.svg)]()
[![License](https://img.shields.io/badge/License-Proprietary-ef4444.svg)]()

**CORTEX POS**, modern perakende marketler, süpermarketler, şarküteriler ve manavlar için geliştirilmiş; **Hızlı Kasa (POS) Satışı**, **ZPL II Termal Raf Etiketi Baskısı**, **DIGI SM-100 Ağ Terazi Entegrasyonu**, **Akıllı Fatura Okuma (OCR / UBL-TR XML)**, **Gelir / Gider Muhasebesi**, **Müşteri Veresiye Defteri**, **İş Zekası & Isı Haritası (Heatmap)** ve **Mobil El Terminali** içeren tam donanımlı, sıfır harici veritabanı bağımlılıklı perakende otomasyon sistemidir.

> 📖 **Sistemin tüm teknik ve işlevsel yeteneklerinin ayrıntılı listesi için [YETKINLIKLER.md](file:///c:/Users/User/Desktop/Etiket%20%C3%87%C4%B1kar%C4%B1c%C4%B1/YETKINLIKLER.md) dokümanını inceleyebilirsiniz.**

---

## 🌟 Öne Çıkan Temel Özellikler

* ⚡ **Milisaniyelik Hızlı Kasa (POS):** Optik barkod okuma, terazi barkodu (27/28 prefix) çözme, hızlı butonlar, çoklu miktar çarpımı (`F5`), nakit/kredi kartı/veresiye tahsilat ve para üstü hesaplama.
* 🏷️ **ZPL II Canlı Raf Etiketi Tasarımı & Baskısı:** WYSIWYG görsel etiket tasarımcısı, yasal mevzuata uygun birim fiyat (TL/Kg) hesaplama, yerli üretim logosu, kuruş vurgulu fiyatlar ve Windows RAW Spooler ile toplu baskı kuyruğu.
* ⚖️ **DIGI SM-100 Canlı Terazi Senkronizasyonu:** Ağ üzerinden çift yönlü canlı fiyat gönderme ve alma, PLU yönetimi, `PLU.CSV/DAT` dışa aktarma.
* 🧾 **Akıllı Fatura Okuma (OCR, PDF & UBL-TR XML):** e-Fatura XML ve kağıt fatura fotoğraflarını tarayarak stokları otomatik artırma, matematiksel sağlama yapma ve firmalara göre görsel arşivleme.
* 👥 **Müşteri Cari & Veresiye Defteri:** Kasadan doğrudan müşteriye veresiye satış, tahsilat girişi, bakiye takibi ve detaylı hesap ekstresi.
* 📊 **İş Analitiği, Z Raporu & Isı Haritası (Heatmap):** Aylık interaktif takvim, 24 saatlik satış analizi ve zirve saat tespiti, reyon ve kasiyer mutabakatı, yazdırılabilir Z raporu ve 7x24 haftalık yoğunluk ısı haritası.
* 💼 **Ön Muhasebe & Kârlılık Takibi:** Aylık ciro, gider kalemleri (Kira, Fatura, Personel, Toptancı vb.), POS komisyon hesabı ve anlık Net Kâr / Kâr Marjı analizi.
* 📱 **Mobil El Terminali & Kablosuz Barkod Okuyucu:** Akıllı telefon veya tabletten yerel ağ ve HTTPS kamera ile reyon aralarında anında barkod okuma ve fiyat güncelleme.
* 🛡️ **Kategorik Yedekleme & Çökme Koruması:** Ürün, fatura ve sistem verilerini tek tıkla kategorik yedekleme/geri yükleme ve global hata izolasyonu ile kesintisiz çalışma.

---

## 🏛️ Modüler Sistem Mimarisi

```text
Etiket Çıkarıcı/
│
├── main.py                               # Flask Ana Sunucusu & Modül Blueprint Tescilleri
├── requirements.txt                      # Python Paket Bağımlılıkları
├── README.md                             # Ana Tanıtım ve Kurulum Dokümantasyonu
├── YETKINLIKLER.md                       # Detaylı Sistem Yetkinlikleri Kataloğu
├── SISTEMI_BASLAT_VE_KORU.bat            # Otomatik Başlatma ve Çökme Koruma Betiği
│
├── backend/                              # 🐍 PYTHON / FLASK BACKEND MODÜLLERİ
│   ├── ayarlar.py                        # Sabit Dosya ve 6 Çekirdek Dizin Yolları
│   ├── araclar/                          # Excel izleyici, SSL sertifikaları, Port yöneticisi
│   ├── kasa/                             # Hızlı Satış (POS), Kasiyerler & Sepet Motoru
│   ├── katalog/                          # Ürün Kataloğu, Faaliyet Geçmişi, Toplu Zam & Özel Barkod
│   ├── terazi/                           # Manav, DIGI SM-100 Ağ Protokolü & PLU Motoru
│   ├── musteri/                          # Müşteri Cari & Veresiye Defteri Servisi
│   ├── raporlama/                        # Aylık Raporlar, Gün Detayı, Z Raporu & Isı Haritası
│   ├── muhasebe/                         # Gelir/Gider, Kasa Cirosu & Net Kâr Servisi
│   ├── fatura/                           # Akıllı Fatura Okuma, UBL-TR XML, OCR & Matematiksel Denetim
│   ├── tasarim/                          # Canlı Etiket Tasarımı, Şablonlar & ZPL Kodlayıcı
│   ├── yazdirma/                         # Windows RAW Spooler & Termal Yazıcı Kalibrasyonu
│   └── yedekleme/                        # Kategorik Yedekleme ve Geri Yükleme Servisi
│
├── frontend/                             # 🌐 İSTEMCİ ARAYÜZÜ (HTML / CSS / JS)
│   ├── js/                               # Modüler Javascript Kontrolörleri
│   │   ├── app.js                        # Bootstrap & Sekme Yaşam Döngüsü
│   │   ├── masaustu/                     # Modül JS Dosyaları (Kasa, Katalog, Rapor, Fatura...)
│   │   └── mobil/                        # Mobil Barkod Tarayıcı JS
│   │
│   ├── sayfalar/                         # Jinja2 HTML Şablonları & Sök-Çıkar Modallar
│   │   ├── masaustu/                     # Masaüstü Yönetim Paneli ve 16+ Modüler Modal
│   │   └── mobil/                        # Mobil El Terminali Sayfaları
│   │
│   └── stiller/                          # CSS Tema & Tasarım Sistemleri
│       ├── style.css                     # Masaüstü Dark Glassmorphism Tasarımı
│       └── mobile.css                    # Mobil Terminal Tasarımı
│
├── data/                                 # 💾 KALICI VERİTABANI (6 ÇEKİRDEK DİZİN)
│   ├── urunler/                          # Ürün Kataloğu, Manav PLU, Özel Barkodlar & Faaliyetler
│   ├── satis_ve_kasa/                    # Yıl/Ay Hiyerarşik Satış Fişleri, Günlük Raporlar & Hızlı Butonlar
│   ├── faturalar/                        # 29+ Şirket Klasöründe Fatura Görselleri & Verileri
│   ├── sistem_ve_ayarlar/                # Mağaza Ayarları, Kasiyerler, Giderler, Müşteriler, Terazi, SSL
│   ├── sablonlar/                        # ZPL Termal Etiket Şablonları & Canlı Taslak Önbelleği
│   └── yedekler/                         # Kategorize Edilmiş (.zip / .json) Sistem Yedekleri
│
└── taslak/                               # 📚 SİSTEM BİLGİ BANKASI & KILAVUZLAR
    ├── PROJE_MIMARISI_VE_REHBER.md       # Detaylı Mimari & Geliştirme Kuralları
    ├── KISAYOLLAR_VE_IS_AKISLARI.md      # Kasa ve Klavye Kısayolları Kılavuzu
    ├── KASA_ALT_BUTONLARI_CALISMA_PRENSIBI.md # 10'lu Kasa Butonu ve Durum Çubuğu Kılavuzu
    ├── VERI_MODELLERI_VE_APILER.md       # Veri Şemaları ve API Uç Noktaları
    └── FATURA_OKUMA_SISTEMI_PLANI.md     # Fatura Okuma ve OCR Kılavuzu
```

---

## 🚀 Hızlı Başlangıç

### 1. Gereksinimler
* **İşletim Sistemi:** Windows 10 / 11 veya Windows Server
* **Python:** Python 3.10 veya üzeri
* **Yazıcı:** ZPL II uyumlu Termal Etiket Yazıcı ve/veya ESC/POS Termal Fiş Yazıcı

### 2. Kurulum
Terminal veya PowerShell üzerinden proje klasöründe bağımlılıkları yükleyin:
```bash
pip install -r requirements.txt
```

### 3. Sistemi Başlatma
Sistemi doğrudan Python ile veya koruma betiğiyle başlatabilirsiniz:
```bash
python main.py
```
veya 7/24 kesintisiz otomatik kurtarma için:
```bash
SISTEMI_BASLAT_VE_KORU.bat
```

### 4. Erişim Adresleri
* **Masaüstü Yönetim Paneli:** `http://127.0.0.1:5000` (Otomatik pencere olarak açılır)
* **Yerel Ağ / Diğer Bilgisayarlar:** `http://[YEREL_IP]:5000`
* **Mobil El Terminali (HTTP):** `http://[YEREL_IP]:5000/mobile`
* **Mobil Canlı Kamera Tarayıcı (HTTPS):** `https://[YEREL_IP]:5001/mobile`

---

## 🔌 Donanım Entegrasyonları

| Donanım | Standart / Protokol | Açıklama |
| :--- | :--- | :--- |
| **Etiket Yazıcı** | ZPL II (Zebra, Argox, Xprinter vb.) | Windows RAW Spooler üzerinden ham ZPL etiket basımı. |
| **Fiş Yazıcı** | ESC/POS (58mm / 80mm) | Satış fişleri ve Z raporu dökümü; RJ11 çekmece tetikleme. |
| **Elektronik Terazi** | DIGI SM-100 / SM-500 | TCP/IP ağ üzerinden çift yönlü canlı fiyat aktarımı. |
| **Barkod Okuyucu** | 1D / 2D USB & Kablosuz Okuyucular | Klavye emülasyonu ile anında sepete ürün aktarımı. |
| **Mobil Kamera** | HTML5 BarcodeDetector / ZXing | Telefon kamerası ile reyon içi kablosuz tarama. |

---

## ⌨️ Hızlı Kasa Klavye Kısayolları

| Tuş | İşlem | Tuş | İşlem |
| :---: | :--- | :---: | :--- |
| **`Enter`** | Barkod Okut / Sepete Ekle | **`F6`** | 🔍 Fiyat Gör Modalı |
| **`F1`** | 📱 Mobil QR / Hızlı Menü | **`F7`** | 🗄️ Para Çekmecesini Aç / 1 TL Ekle |
| **`F2`** | 💳 Kredi Kartı ile Ödeme Al | **`F8`** | ⏸️ Askıdaki Fişler & Eski Satışlar |
| **`F3`** | 🗑️ Sepeti Temizle (İptal) | **`F9`** | ↩️ Ürün İade Girişi |
| **`F4`** | 💵 Nakit Satış & Para Üstü | **`F10`** | 🎁 İkram / %100 Promosyon |
| **`F5`** | ✖️ Miktar Çarpımı (`Adet*Barkod`) | **`Esc`** | Pencereleri Kapat / İptal |

---

## 📚 Dokümantasyon ve Rehberler

* 📖 **[Tüm Sistem Yetkinlikleri (YETKINLIKLER.md)](file:///c:/Users/User/Desktop/Etiket%20%C3%87%C4%B1kar%C4%B1c%C4%B1/YETKINLIKLER.md):** 13 ana başlıkta uygulamanın tüm fonksiyonel ve teknik yetkinlikleri.
* 🏗️ **[Proje Mimarisi ve Geliştirici Rehberi (PROJE_MIMARISI_VE_REHBER.md)](file:///c:/Users/User/Desktop/Etiket%20%C3%87%C4%B1kar%C4%B1c%C4%B1/taslak/PROJE_MIMARISI_VE_REHBER.md):** Veri akışı, klasör hiyerarşisi ve geliştirme kuralları.
* ⌨️ **[Kısayollar ve İş Akışları (KISAYOLLAR_VE_IS_AKISLARI.md)](file:///c:/Users/User/Desktop/Etiket%20%C3%87%C4%B1kar%C4%B1c%C4%B1/taslak/KISAYOLLAR_VE_IS_AKISLARI.md):** Kasa adımları ve hızlı kullanım rehberi.
* 🛒 **[Kasa Alt Butonları Çalışma Prensibi (KASA_ALT_BUTONLARI_CALISMA_PRENSIBI.md)](file:///c:/Users/User/Desktop/Etiket%20%C3%87%C4%B1kar%C4%B1c%C4%B1/taslak/KASA_ALT_BUTONLARI_CALISMA_PRENSIBI.md):** 10'lu eylem butonu ve 7 sütunlu alt durum çubuğunun detayları.
