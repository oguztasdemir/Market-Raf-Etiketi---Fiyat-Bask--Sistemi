<div align="center">

## 🌟 Öne Çıkan Temel Yetenekler

### ⚡ 1. Ultra Hızlı Kasa Terminali (POS)

* **Klavye & Numpad Odaklı İş Akışı:** Mouse'a dokunmadan sadece klavye (`Enter`, `Adet*Barkod`, `F1-F12`) ile saniyeler içinde sepet oluşturma ve tahsilat.
* **Akıllı Barkod Deşifre:** Standart EAN-13, EAN-8 ve terazilerden basılan **27/28 prefixli gramaj/fiyat barkodlarını** anında gram-fiyat olarak parçalama.
* **Çoklu Ödeme & Parçalı Tahsilat:** Aynı fiş içinde Nakit, Kredi Kartı ve Veresiye parçalı ödeme desteği; otomatik para üstü hesabı.
* **Askıya Alma & Çağırma:** Kasada bekleyen müşterilerin fişlerini askıya alıp sıradaki müşteriye geçebilme.

### 🏷️ 2. ZPL II Akıllı Termal Raf Etiketi & Baskı Motoru

* **Yasal Standartlara %100 Uyumlu:** Birim Fiyatı (TL/Kg - TL/Lt), Yerli Üretim Logosu, Üretim Yeri ve Değişiklik Tarihi otomatik hesaplanır.
* **Windows RAW Spooler:** Sürücü gecikmesi olmadan termal yazıcılara (Xprinter, Zebra, Argox vb.) doğrudan ham ZPL II kodu basımı.
* **Toplu Etiket Havuzu:** Fiyatı değişen ürünleri tek tıkla baskı kuyruğuna atıp seri etiket çıkarma.

### ⚖️ 3. Terazi Entegrasyonu & Manav Yönetimi

* **PLU Tuş Matrisi:** Manav, şarküteri ve kasap ürünleri için renkli, resimli hızlı seçim butonları.
* **Terazi Fiyat Senkronizasyonu:** DIGI ve Perkon barkodlu terazilere tek tıkla ağ üzerinden fiyat ve PLU yükleme.

### 📱 4. Mobil El Terminali (Kamera Barkod Okuyucu)

* **Reyon Gezerek Fiyat/Stok Kontrolü:** Kasiyer veya mağaza sorumlusu telefon/tablet kamerasıyla HTTPS üzerinden barkod okutarak reyonda anında etiket basabilir veya fiyat güncelleyebilir.
* **Sıfır Ek Cihaz Maliyeti:** Pahalı el terminalleri yerine personelin kendi akıllı telefonları tam teşekküllü el terminaline dönüşür.

### 💼 5. Ön Muhasebe, Veresiye & Raporlama

* **Veresiye Defteri (Cari):** Müşteri bazında borç/alacak takibi, limit kontrolleri ve WhatsApp ile tek tıkla hesap özeti/bilgi fişi gönderimi.
* **Kâr & Ciro Analizi:** Günlük/Aylık net kâr, satılan ürün adetleri, maliyet analizi ve yazdırılabilir X/Z Raporları.
* **7x24 Yoğunluk Haritası:** Mağazanın gün ve saat bazında müşteri trafiğini gösteren renkli ısı haritası.

---

## 🏛️ Mimari & Dosya Düzeni

```text
OYMAPOS/
│
├── main.py                               # Flask Backend & API Sunucusu
├── desktop_app.py                        # PyWebview Kiosk Masaüstü Sarmalayıcı
├── oymapos_installer.py                  # Bağımsız Kurulum & Güncelleme Sihirbazı
│
├── backend/                              # 🐍 Çekirdek Python Servisleri
│   ├── ayarlar.py                        # Dinamik Dizin ve Yapılandırma
│   ├── araclar/                          # SQLite, Excel Senkronizasyon ve Setup Servisi
│   ├── kasa/                             # POS Motoru, Askı ve Satış API'leri
│   ├── katalog/                          # Ürün Kataloğu, Tohum Veriler & Filtreler
│   ├── terazi/                           # Manav PLU ve Terazi İletişim Servisi
│   ├── musteri/                          # Cari Hesap & Veresiye Modülü
│   ├── raporlama/                        # Z Raporu, Isı Haritası ve İstatistikler
│   ├── muhasebe/                         # Gelir/Gider ve Kâr Analizi Servisi
│   └── yazdirma/                         # Windows RAW Spooler & ZPL Üretici
│
├── frontend/                             # 🌐 Arayüz Katmanı (Vanilla HTML5 / CSS3 / ES6)
│   ├── js/masaustu/                      # Modüler Kontrolörler (Kasa, Katalog, Raporlar...)
│   ├── sayfalar/masaustu/                # Jinja2 Modüler HTML Şablonları
│   └── stiller/masaustu/                 # Dark Glassmorphism Stil Sayfaları
│
├── build_tools/                          # 🛠️ Derleme & Setup Araçları
│   ├── OYMAPOS.spec                      # PyInstaller Masaüstü Derleme Şablonu
│   ├── OYMAPOS_Setup.spec                # Setup Paketi Derleme Şablonu
│   ├── oymapos_installer.py              # Bağımsız Kurulum Motoru Kaynak Kodu
│   └── logo.ico                          # Uygulama İkon Dosyası
│
└── dist/                                 # 📦 Dağıtıma Hazır Paketler
    ├── OYMAPOS_Setup.exe                 # Tek Tıkla Kurulum Sihirbazı
    ├── OYMAPOS.exe                       # Bağımsız Çalıştırılabilir Masaüstü Uygulaması
    └── 1_Eylul_Fiyatlari.xlsx            # 4.500+ Hazır Market & Manav Fiyat Şablonu
```

---

## 🚀 Hızlı Başlangıç & Kurulum

### Seçenek 1: Hazır Kurulum Sihirbazı (Önerilen)

1. `dist/OYMAPOS_Setup.exe` dosyasını çalıştırın.
2. Kurulum sihirbazı masaüstü kısayollarını, Windows Güvenlik Duvarı kurallarını ve veritabanını otomatik olarak yapılandıracaktır.

### Seçenek 2: Kaynak Koddan Geliştirici Modunda Çalıştırma

```bash
# 1. Depoyu klonlayın
git clone https://github.com/oguztasdemir/Market-Raf-Etiketi---Fiyat-Bask--Sistemi.git
cd Market-Raf-Etiketi---Fiyat-Bask--Sistemi

# 2. Bağımlılıkları yükleyin
pip install -r requirements.txt

# 3. Masaüstü uygulamasını veya Web sunucusunu başlatın
python desktop_app.py   # Native Masaüstü Kiosk Modu
# VEYA
python main.py          # Web & Mobil Ağ Modu (Port 5000 / 5001)
```

---

## 🔌 Donanım Entegrasyonları

| Donanım                         | Protokol / Bağlantı    | Desteklenen Modeller & Açıklama                                      |
| :------------------------------- | :----------------------- | :--------------------------------------------------------------------- |
| **Termal Etiket Yazıcı** | ZPL II / RAW Spooler     | Zebra, Xprinter, Argox, Godex, TSC vb. (Tüm ebatlar)                  |
| **Termal Fiş Yazıcı**   | ESC/POS (USB/LAN)        | 58mm & 80mm fiş yazıcılar, otomatik kağıt kesici ve RJ11 çekmece |
| **Barkodlu Terazi**        | TCP/IP & Seri Port       | DIGI, Bizerba, Perkon, CAS, Aclas ve uyumlu terazi modelleri           |
| **Barkod Okuyucu**         | USB / Bluetooth HID      | 1D/2D Optik Okuyucular, Kablosuz El Okuyucuları                       |
| **Mobil Kamera**           | WebRTC / BarcodeDetector | iOS Safari & Android Chrome üzerinden sıfır gecikmeli kamera okuma  |

---

## ⌨️ Kasa Klavye Kısayolları

|         Kısayol         | Fonksiyon                               |        Kısayol        | Fonksiyon                                 |
| :-----------------------: | :-------------------------------------- | :--------------------: | :---------------------------------------- |
|    **`Enter`**    | Barkod Okut / Hızlı Sepete Ekle       |    **`F7`**    | 🗄️ Para Çekmecesini Aç / 1 TL Ekle    |
|     **`F1`**     | 📱 Mobil QR / Hızlı Bağlantı        |    **`F8`**    | ⏸️ Eski Satışlar & Askıdaki Fişler  |
|     **`F2`**     | 💳 Kredi Kartı ile Tek Tuş Tahsilat   |    **`F9`**    | ↩️ Müşteri Ürün İade Modalı       |
|     **`F3`**     | 🗑️ Sepeti / Fişi İptal Et           |   **`F10`**   | 💾 Hızlı Ürün Tanımla & Kaydet       |
|     **`F4`**     | 💵 Nakit Ödeme & Para Üstü Hesabı   |   **`F11`**   | 📒 Veresiye Cari Defterine Yaz            |
| **`Alt + Enter`** | 🖥️ Tam Ekran (Fullscreen) Aç / Kapat | **`Alt + F4`** | 🚪 Güvenli Kasa Kapatma (Onay Korumalı) |

---

## 🔒 Güvenlik, Veri Gizliliği & Dayanıklılık

* **Sıfır Bulut Bağımlılığı:** İnternet bağlantınız kesilse dahi kasanız ve etiket basımınız aksamadan çalışmaya devam eder.
* **SQLite ACID Standartları:** Ani elektrik kesintilerinde veritabanı kilitlenmez, veri kaybı yaşanmaz.
* **Otomatik Yedekleme:** Her günün sonunda ve kurulum güncellemelerinde otomatik yedek arşivi oluşturulur.

---

<div align="center">
