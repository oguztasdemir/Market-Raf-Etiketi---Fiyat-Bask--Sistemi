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
├── data/                                 # 💾 KALICI VERİTABANI (6 DERLİ TOPLU ÇEKİRDEK KLASÖR)
│   ├── urunler/                          # 📦 Ürün Kataloğu & Manav Veritabanı
│   │   ├── urunler.json                  # Ana market ürün kataloğu (4.800+ Ürün)
│   │   ├── manav_urunleri.json           # Manav ve terazi PLU ürünleri
│   │   ├── ozel_barkodlar.json           # Tanımlı özel / dahili barkodlar
│   │   └── urun_faaliyetleri.json        # Fiyat ve etiket hareket geçmişi
│   │
│   ├── satis_ve_kasa/                    # 🛒 Kasa Satışları, Fişler & Faaliyet Raporları
│   │   ├── satislar/                     # Yıl / Ay Hiyerarşik Satış Fişleri (YYYY/MM/YYYY-MM-DD.json)
│   │   │   └── 2026/
│   │   │       └── 08/
│   │   │           └── 2026-08-23.json
│   │   ├── gunluk_raporlar.json          # Günlük ciro, fiş adedi ve faaliyet kütüğü
│   │   └── hizli_butonlar.json           # Kasa ekranındaki hızlı butonlar
│   │
│   ├── faturalar/                        # 🧾 Şirket Şirket Gruplanmış Fatura & Görsel Arşivi (29 Şirket, 214+ Belge)
│   │   ├── Ada_Mumessillik_Gida/         # Fatura görselleri (.jpeg / .png / .pdf)
│   │   ├── Akgun_Gida/
│   │   ├── Dogu_Grup_Gida/
│   │   ├── OZ_ANADOLU_TOPTAN_GIDA_DAGITIM/
│   │   └── portal_ici_faturalar/
│   │
│   ├── sistem_ve_ayarlar/                # ⚙️ Mağaza Profili, Kasiyerler, Giderler, Terazi, Excel, SSL
│   │   ├── ayarlar.json                  # Market adı, POS komisyonu ve kalibrasyon
│   │   ├── kasiyerler.json               # Kasiyer personeli ve PIN kodları
│   │   ├── giderler.json                 # Dükkan kirası, personel maaşı ve faturalar
│   │   ├── terazi_ayarlari.json          # DIGI SM-100 terazi yapılandırması
│   │   ├── musteriler.json               # Kayıtlı cari/veresiye müşteriler
│   │   ├── terazi_aktarim/               # Teraziye gönderilen aktarım dosyaları (PLU.CSV/DAT/TXT)
│   │   ├── sistem_exceli/                # Yüklenen ERP/Muhasebe Excel tabloları
│   │   └── sertifikalar/                 # Mobil HTTPS SSL sertifikaları (cert.pem, key.pem)
│   │
│   ├── sablonlar/                        # 🎨 Etiket Tasarım Şablonları & Taslak Önbelleği
│   │   ├── sablonlar.json                # Termal etiket ZPL şablonları
│   │   └── taslak_onbellegi.json         # Tasarımcı canlı çalışma önbelleği
│   │
│   └── yedekler/                         # 💾 Kategorize Edilmiş Sistem Yedekleri
│       ├── urunler/                      # Ürün kataloğu yedekleri (urunler_yedek_*.json + .meta)
│       ├── faturalar/                    # Fatura görsel ve veri arşiv zip yedekleri (faturalar_yedek_*.zip)
│       └── sistem/                       # Sistem dönüm noktası ve geçiş yedekleri (.json)
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

### 6. 🧾 Akıllı Fatura Okuma, Matematiksel Sağlama & Şirket Arşivi Modülü
* **Kullanıcı Ne Yapıyor:**
  * **📥 Çoklu Format Girişi:** PC'den veya mobilden e-Fatura XML (UBL-TR), e-Arşiv PDF veya kamera/tarayıcı fotoğraflarını yükler.
  * **📁 Şirket Alt Klasör Ayrımı & Tarih İsimlendirme:** Yüklenen fatura görselleri/dosyaları `data/invoices/<ŞİRKET_ADI>/<YYYY-MM-DD>_<FATURA_NO>.<ext>` şeklinde otomatik şirket alt klasörlerine arşivlenir.
  * **📷 Kağıt Kusuru & Gölge Önleme:** Buruşmuş kağıt, parlama ve gölgeleri filtreleyen OCR ön işlemesi ile metinleri ve sayıları net ayrıştırır.
  * **🧮 Matematiksel Çapraz Sağlama:** Kalemlerin tek tek toplamları ile faturanın genel toplamını kuruşu kuruşuna denetler, uyuşmazlık ve yuvarlama farklarını anında yakalar.
  * **📦 Akıllı Katalog Eşleştirme:** Faturadaki ürünleri barkod ve ada göre mevcut stoklarla eşleştirir. `Mevcut Stok ➔ Yeni Stok` hesabı yapar; bulunamayan yeni ürünler için tek tıkla yeni kart açar.
  * **🖼️ Fatura Görselini Önizleme:** Şirket filtreli arşiv tablosundan tek tıkla orijinal fatura belgesini veya fotoğrafını tam ekran görüntüler.
  * **✅ Otomatik Entegrasyon:** Onaylandığında ürün stoklarını artırır, faturayı muhasebeye toptancı gideri olarak yazar ve etiket basımı için sıraya atar.

### 7. ⚙️ Donanım & Etiket Yazıcı Ayarları Modülü
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
