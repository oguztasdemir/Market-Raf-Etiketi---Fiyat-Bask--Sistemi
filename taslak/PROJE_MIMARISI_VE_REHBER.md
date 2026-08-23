# 🏪 MARKET RAF ETİKETİ, HIZLI KASA (POS) VE YÖNETİM SİSTEMİ
## Kapsamlı Proje Mimarisi, Kullanıcı Rehberi ve Sistem Taslağı

> **Bu belge; projenin tüm klasör yapısını, modüllerini, veri akışını, kullanıcı senaryolarını ve geliştirme kurallarını eksiksiz olarak kayıt altına almak amacıyla oluşturulmuştur.**

---

## 📁 1. TAM KLASÖR VE DOSYA HİYERARŞİSİ

```text
c:\Users\User\Desktop\Etiket Çıkarıcı\
│
├── main.py                               # Flask ana uygulama sunucusu ve rota başlatıcı
│
├── backend/                              # Sunucu tarafı Python servis ve rotaları
│   ├── app.py                            # Flask Blueprint kayıtları ve sunucu konfigürasyonu
│   ├── cekirdek/                         # Veri yükleme, JSON I/O, formatlama yardımcıları
│   │   └── utils.py
│   ├── hizli_satis/                      # POS Hızlı Kasa Satış Servisi ve Rotaları
│   │   ├── pos_servisi.py                # Sepet hesaplama, fiş kesme, nakit/kart tahsilat
│   │   └── pos_rotalari.py               # /api/pos/* uç noktaları
│   ├── katalog/                          # Ürün Kataloğu, Fiyat ve Özel Barkod Servisleri
│   │   ├── urun_servisi.py               # Ürün CRUD, barkod arama, özel barkod tanımlama
│   │   ├── urun_rotalari.py              # /api/products, /api/custom-barcodes
│   │   └── etiket_servisi.py             # Etiket şablonlama ve baskı hazırlığı
│   ├── manav_terazi/                     # Terazi & PLU Ürün Servisi
│   │   ├── manav_servisi.py              # 27/28 terazi barkod çözücü, PLU eşleme
│   │   └── manav_rotalari.py             # /api/scale/* uç noktaları
│   ├── raporlama/                        # Detaylı Analitik, Z Raporu ve Heatmap Servisi
│   │   ├── raporlama_servisi.py          # 24 saat dağılımı, reyon/kasiyer dökümü, heatmap
│   │   └── rapor_rotalari.py             # /api/reports/* rotaları
│   ├── senkronizasyon/                   # Mobil Cihaz Senkronizasyon & QR Rotaları
│   │   └── sync_rotalari.py              # /api/mobile/*, /api/sync/*
│   └── yedekleme/                        # Veritabanı ve JSON Yedekleme Servisi
│       └── yedek_servisi.py              # Otomatik ve manuel yedek alma
│
├── frontend/                             # İstemci tarafı HTML, CSS, JS bileşenleri
│   ├── sayfalar/                         # Jinja2 HTML Şablonları
│   │   ├── index.html                    # Ana giriş sayfası
│   │   ├── masaustu/
│   │   │   ├── index.html                # Masaüstü ana yönetim paneli (Modüler Include'lar)
│   │   │   ├── hizli_satis/              # POS Kasa HTML sekmeleri ve modalları
│   │   │   │   ├── hizli_satis_sekmesi.html
│   │   │   │   └── modallar/             # Barkod bulunamadı, eski satışlar, fiş onayı
│   │   │   ├── katalog/                  # Ürün Kataloğu HTML sekmesi ve modalları
│   │   │   │   ├── katalog_sekmesi.html
│   │   │   │   └── modallar/             # Ürün detayı, geçmiş faaliyetler, özel barkod
│   │   │   ├── manav_terazi/             # Manav & Terazi HTML sekmesi ve modalları
│   │   │   ├── raporlama/                # Raporlar HTML sekmesi ve modalları
│   │   │   │   ├── raporlar_sekmesi.html # Aylık takvim tablosu & KPI'lar
│   │   │   │   └── modallar/
│   │   │   │       ├── gun_detay_modali.html        # 6 Sekmeli sabit 650px Gün Detayı
│   │   │   │       ├── fis_detay_modali.html        # Termal fiş inceleme ve tekrar yazdırma
│   │   │   │       ├── ozet_z_raporu_modali.html    # Gün Sonu Özet Z Raporu (Yazdırılabilir)
│   │   │   │       └── haftalik_isi_haritasi_modali.html # 7x24 Saatlik Isı Haritası (Heatmap)
│   │   │   ├── tasarim/                  # Etiket Tasarım Sekmesi
│   │   │   ├── yazdirma/                 # Toplu Baskı Sekmesi & Modalı
│   │   │   ├── yedekleme/                # Yedekler Sekmesi
│   │   │   └── ortak_modallar/           # Onay, prompt, çıkış diyalogları
│   │   └── mobil/                        # Mobil Barkod Okuyucu Arayüzü
│   │
│   ├── js/                               # Modüler Javascript Dosyaları
│   │   └── masaustu/
│   │       ├── app.js                    # Sekme geçişleri ve genel sayfa yöneticisi
│   │       ├── cekirdek/cekirdek_sistem.js # Modal açma/kapama, bildirim (toast) altyapısı
│   │       ├── kasa/kasa_paneli.js       # POS Kasa satışı, F1-F12 tuşları, sepet, ödeme
│   │       ├── katalog/katalog_paneli.js # Ürün tablosu, Shift/Ctrl çoklu seçim, arama
│   │       ├── raporlama/raporlar_paneli.js # Rapor takvimi, 24 saat barı, Z raporu, Heatmap
│   │       ├── terazi/manav_terazi_paneli.js # Terazi ürünleri ve PLU senkronizasyonu
│   │       ├── tasarim/etiket_tasarim_paneli.js # Canlı etiket önizleme ve düzenleme
│   │       ├── yazdirma/yazdirma_paneli.js # Barkod ve raf etiketi baskı motoru
│   │       └── senkronizasyon/sync_panel.js # Mobil eşleşme ve veri transferi
│   │
│   └── statik/                           # CSS stilleri, logolar, sesler ve yazı tipleri
│       ├── css/masaustu/style.css        # Premium Dark Tema Stilleri (Glassmorphism)
│       └── sesler/                       # Barkod okuma ve hata ses efektleri
│
├── data/                                 # Canlı Veri Dosyaları (JSON Tabanlı Veritabanı)
│   ├── products.json                     # 4.800+ Güncel Ürün Kataloğu
│   ├── custom_barcodes.json              # Tanımlanan Özel / Ek Barkodlar
│   ├── scale_products.json               # Manav & Terazi PLU Ürün Listesi
│   ├── daily_reports.json                # Fiyat değişiklikleri ve baskı geçmişi kütüğü
│   ├── sales/                            # Günlük Satış Fişleri Havuzu
│   │   ├── 2026-08-22.json
│   │   └── 2026-08-23.json               # Fiş kalemleri, tutar, KDV, ödeme tipi
│   └── backups/                          # Otomatik ve Manuel Alınan Yedekler
│
└── taslak/                               # Sistem Taslağı, Rehberler ve Dokümantasyon
    ├── PROJE_MIMARISI_VE_REHBER.md       # Bu Ana Mimari Belgesi
    ├── KISAYOLLAR_VE_IS_AKISLARI.md      # Kısayollar ve Adım Adım İşlemler
    └── VERI_MODELLERI_VE_APILER.md       # JSON Şemaları ve API Referansı
```

---

## ⚙️ 2. MODÜLLER VE KULLANICI NELER YAPIYOR?

### 1. 🛒 Hızlı Kasa (POS) ve Satış Modülü
* **Kullanıcı Ne Yapıyor:**
  * Barkod okutarak veya ürün adı/PLU aratarak hızlıca sepete ürün ekler.
  * Terazi barkodlarını (`27xxxxx` veya `28xxxxx`) okutarak gramajı ve tutarı anında sepete yansıtır.
  * **Hızlı Para Tuşları:** `F1` (Nakit), `F2` (Kredi Kartı), `F3` (İptal/Temizle), `F4` (Fiyat Gör), `F5` (Miktar Çarpımı), `F7` (1 TL/2 TL Ekle), `F8` (Bekleyen/Eski Satışlar), `F9` (İade/Geri Alma).
  * Satış anında termal fiş çıktısı yazdırır, nakit ödemelerde para üstünü otomatik hesaplar.
  * Askıya alma (Park Fiş) ile müşteriyi beklemeye alıp sonraki müşteriye geçebilir.

### 2. 📋 Ürün Kataloğu, Etiket & Özel Barkod Modülü
* **Kullanıcı Ne Yapıyor:**
  * Binlerce ürünü anında arar, filtreler.
  * **Shift ve Ctrl ile Çoklu Seçim:** Sol kutucuklar olmadan satırlara `Shift` veya `Ctrl` ile tıklayarak toplu ürün seçer.
  * **Ürün Detay & Faaliyet Geçmişi:** Ürün adına tıklandığında ürünün fiyat geçmişi, en son ne zaman etiket basıldığı ve kaç kez satıldığı kütükten dökülür.
  * **Özel Barkod Tanımlama:** Barkodsuz veya alternatif barkodlu ürünlere özel barkod atar.
  * Seçilen ürünleri tek tıkla **Toplu Etiket Yazdırma** sırasına gönderir.

### 3. ⚖️ Manav & Terazi PLU Yönetimi
* **Kullanıcı Ne Yapıyor:**
  * Kilo ile satılan yaş meyve-sebze ürünlerini PLU kodları (1-99) ile listeler.
  * Teraziden çıkan barkod formatını ayarlar ve fiyat değişikliklerini teraziye aktarır.

### 4. 📊 Detaylı Raporlama ve Analitik Modülü
* **Kullanıcı Ne Yapıyor:**
  * **Aylık Takvim:** Ayın her gününün cirosunu, fiş adedini, satılan ürün miktarını ve en çok satanını inceler.
  * **Gün Detayı (Sabit 650px Modal):**
    1. 🏆 **Günün En Çok Satanları:** Adet ve Kg bazlı en çok ciro getiren ürünler.
    2. 📊 **24 Saatlik Satış Dağılımı:** `00:00` - `23:00` arası bar grafiği, fareyle üzerine gelince anlık ciro/fiş detayı ve 🔥 Zirve Saat tespiti.
    3. 🛒 **Reyon Ciro Dağılımı:** Manav (%32), Temel Gıda (%48), İçecek (%15), Temizlik (%5) renkli segment çubuğu ve ciro dökümü.
    4. 👥 **Kasiyer Mutabakatı:** Kasiyerlerin kestiği fiş adedi, Nakit ve Kart tahsilatları, kasa ciro payları.
    5. 🧾 **Kasa Satış Fişleri:** Kesilen tüm fişlerin kalem kalem dökümü, satır içi çekmece ve fiş detay modalı ile tekrar yazdırma.
    6. ✏️ **Fiyat Değişiklikleri:** O gün değişen eski/yeni fiyatlar.
  * **📈 Trend Rozetleri:** `Düne Göre: +%14,2 ↗` ve `Geçen Haftaya Göre: +%8,0 ↗` kıyaslama rozetleri.
  * **📜 Gün Sonu Özet Z Raporu:** Tek tıkla açılan ve termal fiş yazıcısından basılabilen kompakt gün sonu kasa kapanış özeti.
  * **🔥 Haftalık Yoğunluk Isı Haritası (Heatmap):** 7 Gün x 24 Saatlik yoğunluk matrisi ve akıllı personel takviye önerileri.
  * **📥 Excel (.csv) İndirme:** Hem günün tüm detaylarını hem de ayın tüm günlerini tek tıkla Excel tablosu olarak indirme.

### 5. 💼 Market Bilgileri, Kasiyerler & Gelir / Gider Muhasebesi Modülü
* **Kullanıcı Ne Yapıyor:**
  * **💰 Finansal Genel Bakış:** Aylık Kasa Satış Cirosu (Nakit & Kredi Kartı), Toplam Giderler ve Net Kâr tutarı ile kâr marjını anlık takip eder.
  * **💸 Gider Yönetimi:** Dükkan Kirası, Personel Maaşı & Avans, Elektrik/Su/Faturalar, Toptancı / Mal Alımı, Temizlik & Sarf Malzeme ve Vergiler gibi gider kalemlerini girer, düzenler ve siler.
  * **📊 Gelir / Gider Kütüğü & Excel:** Tüm finansal hareketleri filtreler ve tek tıkla Excel (.csv) formatında indirir.
  * **🏪 Market & Kasiyer Kadrosu:** Market ticari ünvanı, şube adı, telefon, vergi dairesi/no, POS komisyon oranı ve kasiyer ekleme/düzenleme işlemlerini tek panelden yürütür.

### 6. ⚙️ Donanım & Etiket Yazıcı Ayarları Modülü
* **Kullanıcı Ne Yapıyor:**
  * Termal etiket yazıcı seçimi, etiket ölçüleri (60x40, 76x40, 85x45), besleme yönü ve X/Y ofset kalibrasyonunu ayarlar.

### 7. 📱 Mobil Senkronizasyon & Yedekleme
* **Kullanıcı Ne Yapıyor:**
  * Akıllı telefonla ekrandaki QR kodu okutup reyon aralarında mobil barkod okuyucu olarak kullanır.
  * Reyonda yapılan fiyat değişiklikleri anında ana bilgisayarla çift yönlü eşitlenir.
  * Tek tıkla tüm ürün ve satış veritabanını `.zip` olarak yedekler.

---

## 🔒 3. KRİTİK GELİŞTİRME VE MİMARİ KURALLAR

1. **Sabit Modal Yükseklikleri & Boş Durum Koruması:**
   * Modal pencereleri (`gun_detay_modali.html` vb.) kesinlikle `height: 650px;` sabit yapıda kalmalıdır. Veri olmadığında pencere daralmaz; ortalanmış **"📭 Bu Gün İçin Kayıtlı Veri Yok"** şablonu görüntülenir.
2. **Karaliste & Manav Ayrımı:**
   * `is_utility_helper_item()` kontrolü ile 1 TL, 2 TL gibi yardımcı pos kalemleri katalog ve toplu etiket listelerinden hariç tutulur.
   * Manav/terazi ürünleri kilo (`Kg`) birimi ve PLU kodu ile doğru kategorize edilir.
3. **Modüler Dosya Yapısı:**
   * HTML şablonları `frontend/sayfalar/masaustu/` altındaki ilgili modül klasörlerinde `{% include %}` mantığıyla parçalanmış olarak tutulur.
   * Javascript dosyaları `frontend/js/masaustu/` altında modüler olarak ayrılmıştır ve fonksiyonlar `window` nesnesine bağlanarak global çağrılabilir.
4. **Önbellek Kırma (Cache-Busting):**
   * JS veya HTML'de değişiklik yapıldığında script etiketlerinin versiyon sorgusu (`?v=YYYYMMDD_HHMM`) artırılır.
