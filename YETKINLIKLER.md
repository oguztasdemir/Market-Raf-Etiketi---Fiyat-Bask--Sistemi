# ⚡ CORTEX POS - Sistem Yetkinlikleri ve Özellikler Kataloğu

> **Bu doküman, CORTEX POS Market Raf Etiketi, Hızlı Kasa (POS), Terazi, Fatura ve Muhasebe Yönetim Sistemi'nin sahip olduğu tüm yetkinlikleri, teknik kabiliyetleri, işlevsel modüllerini ve donanım entegrasyonlarını en ince ayrıntısına kadar listelemektedir.**

---

## 📑 İÇİNDEKİLER

1. [Sistem Mimarisi ve Genel Bakış](#1-sistem-mimarisi-ve-genel-bakış)
2. [Hızlı Kasa (POS) & Satış Terminali Yetkinlikleri](#2-hızlı-kasa-pos--satış-terminali-yetkinlikleri)
3. [Akıllı Terazi & Manav (DIGI SM-100 PLU) Yetkinlikleri](#3-akıllı-terazi--manav-digi-sm-100-plu-yetkinlikleri)
4. [Ürün Kataloğu & Dinamik Fiyatlandırma Yetkinlikleri](#4-ürün-kataloğu--dinamik-fiyatlandırma-yetkinlikleri)
5. [Termal Raf Etiketi Tasarım & ZPL II Baskı Motoru](#5-termal-raf-etiketi-tasarım--zpl-ii-baskı-motoru)
6. [Müşteri Cari & Veresiye Yönetim Defteri](#6-müşteri-cari--veresiye-yönetim-defteri)
7. [Akıllı Fatura Okuma (OCR/PDF/XML) & Matematiksel Sağlama](#7-akıllı-fatura-okuma-ocrpdfxml--matematiksel-sağlama)
8. [Detaylı Raporlama, Z Raporu & Haftalık Isı Haritası (Heatmap)](#8-detaylı-raporlama-z-raporu--haftalık-ısı-haritası-heatmap)
9. [Market Gelir / Gider Muhasebesi & Net Kâr Analizi](#9-market-gelir--gider-muhasebesi--net-kâr-analizi)
10. [Mobil El Terminali & Kablosuz Barkod Okuyucu](#10-mobil-el-terminali--kablosuz-barkod-okuyucu)
11. [Kategorik Yedekleme & Sistem Güvenliği](#11-kategorik-yedekleme--sistem-güvenliği)
12. [Donanım & Çevre Birimleri Destek Matrisi](#12-donanım--çevre-birimleri-destek-matrisi)
13. [Klavye Kısayolları ve Hızlı Aksiyon Haritası](#13-klavye-kısayolları-ve-hızlı-aksiyon-haritası)

---

## 1. 🏗️ Sistem Mimarisi ve Genel Bakış

* **Hibrit Çalışma Modeli:** Tek bir `main.py` başlatıcısı ile hem modern bağımsız **Masaüstü Webview Uygulaması** hem de yerel ağdaki cihazlara açık **HTTP/HTTPS Flask Sunucusu** aynı anda çalışır.
* **Sıfır Dış Veritabanı Bağımlılığı (JSON Tabanlı Yüksek Performans):** Karmaşık SQL kurulumlarına ihtiyaç duymadan, optimize edilmiş indeksli JSON yapılarıyla 5.000+ ürün, yüzlerce fatura ve binlerce satış fişini anlık olarak işler.
* **Gelişmiş İstisna İzolasyonu & Çökme Koruması:** Web/API hataları global hata yakalayıcılarla izole edilir, sunucunun çökmesi engellenir ve otomatik kurtarma mekanizması (`SISTEMI_BASLAT_VE_KORU.bat`) ile 7/24 kesintisiz hizmet verir.
* **Çoklu Cihaz ve IP Tanıma:** Sisteme bağlanan her cihazı yerel IP üzerinden tanır (örn. Ana Bilgisayar, Kasa Terminali, DIGI Terazi, Mobil Terminal) ve cihaz bazlı işlem kütüğü tutar.

---

## 2. 🛒 Hızlı Kasa (POS) & Satış Terminali Yetkinlikleri

CORTEX POS, market ortamında saniyeler içinde satış yapmayı mümkün kılan ergonomik bir kasa altyapısına sahiptir:

### 🎯 Barkod & Ürün Giriş Kabiliyetleri
* **Yüksek Hızlı Optik Barkod Okuma:** EAN-13, EAN-8, Code-128, QR ve dahili barkodları donanım gecikmesi olmadan sepete ekler.
* **Akıllı Terazi Barkodu Ayrıştırıcı (27 / 28 Prefix Motoru):** 
  * `27XXXXX` veya `28XXXXX` ile başlayan terazi etiketlerini milisaniyeler içinde çözer.
  * Barkod içerisindeki PLU kodunu, ürün ağırlığını (Kg/Gr) veya tutarını otomatik hesaplayıp sepete hatasız yansıtır.
* **Miktar Çarpımı ile Hızlı Giriş (`F5`):** 
  * `5*8690504011234` veya `F5 -> Miktar -> Barkod` yöntemiyle tek seferde çoklu adet/kilo satışı.
* **Fiyat Gör Modalı (`F6` / `F4`):** Sepete ürün atmadan, müşteriye büyük ekranda satış fiyatını, birimini ve reyon bilgisini gösterme.
* **Hızlı Butonlar Gridi:** Barkodsuz ekmek, su, poşet, manav veya sık satılan ürünler için tek tıkla sepete eklenen görsel grid panel.
* **Hızlı 1 TL / 2 TL Bozuk Para & Poşet Ekleme:** Kasada bozuk para tamamlama ve poşet ücretini tek tuşla ekleme.
* **Sistemde Olmayan Ürünü Anında Kaydetme:** Okutulan barkod katalogda yoksa, kasadan ayrılmadan ürün adı, alış ve satış fiyatı girilerek anında kaydedilir ve sepete eklenir.

### 💳 Ödeme, Tahsilat & Para Üstü
* **Nakit Satış (`F4` / `F1`):** Tek tuşla nakit satış başlatma; verilen para miktarını girince para üstünü büyük puntolarla gösterme ve hızlı banknot butonları (50₺, 100₺, 200₺ vb.).
* **Kredi Kartı / POS Satışı (`F2`):** Banka POS cihazları üzerinden komisyonsuz veya komisyon kayıtlı tek tıkla kartlı tahsilat.
* **Parçalı / Çoklu Ödeme:** Bir faturanın/sepetin bir kısmını nakit, kalanını kredi kartı ile tahsil edebilme.
* **Veresiye / Müşteriye Yazma:** Sepet tutarını doğrudan seçilen cari müşterinin borç hanesine aktarma.
* **İkram / Promosyon Uygulama (`F10`):** Sepetteki ürünlere tek tıkla %100 indirim/ikram uygulayarak toplamı sıfırlama.
* **Ürün İade Modülü (`F9`):** İade alınan ürünü tutarı negatif olarak sepete ekleyerek toplamdan düşme ve kasa bakiyesini dengeleme.

### 🗂️ Fiş, Park & Kasa Yönetimi
* **Park Fiş (Satış Askıya Alma):** Kasada cüzdanını unutan veya ek ürün almaya giden müşterinin sepetini askıya alıp bir sonraki müşteriye geçebilme; istenildiğinde askıdaki fişi tek tıkla geri çağırma.
* **Eski Satışlar Arşivi (`F8`):** Gün içinde tamamlanmış geçmiş satışları, kalem detaylarını ve ödeme yöntemlerini inceleme.
* **Termal Fiş Çıktısı & ESC/POS Desteği:** Satış tamamlandığında 58mm / 80mm termal fiş yazıcıdan otomatik kurumsal fiş basımı.
* **Para Çekmecesi Açma (`F7`):** Termal yazıcı RJ11 portuna darbe sinyali (`\x1b\x70...`) göndererek kasayı fiziksel olarak açma.
* **Kasiyer Girişi & PIN Doğrulama:** Çoklu kasiyer desteği; vardiya değişiminde PIN kodu ile güvenli kasiyer değiştirme.

---

## 3. ⚖️ Akıllı Terazi & Manav (DIGI SM-100 PLU) Yetkinlikleri

Yaş sebze, meyve, kuruyemiş ve şarküteri reyonları için endüstriyel terazi entegrasyonu:

* **PLU (Price Look-Up) Yönetimi:** 1 ile 999 arasındaki tüm manav ve şarküteri ürünlerini PLU kodu, dara, birim fiyat ve KDV oranlarıyla listeleme ve yönetme.
* **Çift Yönlü Ağ İletişimi (DIGI SM-100):**
  * **Toplu Fiyat Gönderme (Stream):** Katalogdaki veya manav listesindeki güncel fiyatları tek tıkla canlı ağ üzerinden teraziye aktarma.
  * **Tekli PLU Fiyat Gönderme:** Değişen tek bir ürünün fiyatını teraziye anında gönderme.
  * **Teraziden Canlı Fiyat Çekme:** Terazi üzerinde yapılan manuel fiyat değişikliklerini sisteme geri okuma.
* **Terazi Aktarım Dosyaları:** DIGI terazileri için standart `PLU.CSV`, `PLU.DAT` ve `PLU.TXT` formatlarında dışa aktarma (Export) ve içe aktarma (Import).
* **Canlı Bağlantı Takibi:** Terazinin IP adresine ping/soket testi atarak çevrimiçi/çevrimdışı durumunu anlık izleme.

---

## 4. 📋 Ürün Kataloğu & Dinamik Fiyatlandırma Yetkinlikleri

* **4.800+ Ürünlük Hafif Veritabanı:** Binlerce ürünü milisaniyelik gecikmelerle anında arama ve filtreleme.
* **Shift ve Ctrl ile Çoklu Seçim:** Klasik onay kutularına gerek kalmadan, satırlara `Shift` veya `Ctrl` ile tıklayarak toplu ürün seçebilme.
* **Toplu Zam / Fiyat Güncelleme Motoru:**
  * Seçili ürünlere veya belirli reyonlara **Yüzdesel (%)** veya **Sabit Tutar (TL)** bazında toplu fiyat artışı/indirimi uygulama.
  * **Akıllı Yuvarlama:** Fiyatları `.00`, `.50` veya `.90` kuruş kurallarına göre otomatik yuvarlama.
* **Ürün Faaliyet Kütüğü (Audit Trail):**
  * Bir ürünün geçmişteki tüm fiyat değişimlerini tarih, eski fiyat, yeni fiyat ve işlemi yapan kullanıcı bazında saklama.
  * En son ne zaman raf etiketi basıldığını ve toplam satış hacmini görme.
* **Özel / Dahili Barkod Üretici:** Barkodu olmayan açık ürünler, kırtasiye veya özel reyon ürünleri için sistem içinde benzersiz özel barkod oluşturma.
* **Excel ERP / Muhasebe Senkronizasyonu:**
  * Toptancı veya harici muhasebe programlarından gelen `.xlsx` dosyalarını yükleme.
  * Fiyatı değişen ürünleri otomatik tespit etme (Diff Analizi) ve onay sonrası kataloğu güncelleme.

---

## 5. 🎨 Termal Raf Etiketi Tasarım & ZPL II Baskı Motoru

Market raflarının profesyonel ve yasal standartlara uygun etiketlenmesi:

* **ZPL II (Zebra Programming Language) Yerel Motoru:** Üçüncü parti sürücülere veya PDF ara katmanlarına ihtiyaç duymadan doğrudan yazıcının anakartına ham ZPL komutları gönderir (Yüksek baskı hızı).
* **Görsel Etiket Tasarımcısı (WYSIWYG):**
  * Etiket üzerindeki metin boyutlarını, satır aralıklarını, fiyat punto büyüklüğünü ve barkod genişliğini canlı önizleme ile ayarlama.
  * Taslak önbelleği sayesinde yapılan düzenlemeleri kaybolmadan saklama.
* **Zengin Etiket Şablonları & Boyut Seçenekleri:**
  * Standart Raf Etiketi (60x40 mm, 76x40 mm, 85x45 mm, 40x20 mm vb.).
  * İndirimli / Kampanyalı Etiket şablonları (Üstü çizili eski fiyat, büyük indirimli fiyat).
  * Manav / Şarküteri Etiketi.
* **Yasal Raf Etiketi Standartları:**
  * Ürün Adı ve Gramajı.
  * Satış Fiyatı (Kuruş kısmı belirgin büyük punto).
  * Birim Fiyatı (TL/Kg, TL/Lt hesabı).
  * Üretim Yeri & "Yerli Üretim" logosu.
  * Fiyat Değişiklik Tarihi ve KDV oranı.
* **Yazıcı Donanım Kalibrasyonu:**
  * Windows RAW Spooler entegrasyonu (USB, Ağ veya Sanal Yazıcılar).
  * X/Y milimetrik ofset kaydırma ve koyuluk (Darkness / Density) ayarı.
* **Toplu Baskı Kuyruğu:** Seçilen onlarca ürünü tek tıkla baskı kuyruğuna atıp seri olarak basma.

---

## 6. 👥 Müşteri Cari & Veresiye Yönetim Defteri

Veresiye çalışan mahalle marketleri ve toptan müşteriler için tam kapsamlı cari defteri:

* **Cari Müşteri Kartları:** Müşteri adı soyadı, telefon numarası, adres, maksimum kredi/veresiye limiti ve özel notlar.
* **Kasadan Doğrudan Veresiye Satış:** Satış anında müşteriyi seçerek sepeti borç bakiyesine ekleme.
* **Tahsilat & Ödeme Kaydı:** Müşteriden nakit veya kartla alınan ara ödemeleri kaydetme, bakiyeden anında düşme.
* **Hesap Ekstresi & Geçmiş Alışverişler:** Müşterinin hangi tarihte hangi ürünleri aldığını ve yaptığı ödemeleri kalem kalem döküm alma.
* **Limit Aşım Koruması:** Tanımlanan veresiye limitini aşan müşterilerde kasiyeri uyarma.

---

## 7. 🧾 Akıllı Fatura Okuma (OCR/PDF/XML) & Matematiksel Sağlama

Gelen toptancı faturalarını hatasız bir şekilde sisteme işleyen yapay zeka ve OCR destekli akıllı motor:

* **Üçlü Format Desteği:**
  1. **e-Fatura / e-Arşiv XML (UBL-TR Standart):** Fatura kalemlerini sıfır hata ile doğrudan dijital olarak ayrıştırır.
  2. **e-Arşiv PDF:** PDF faturalarındaki tabloları ve sayısal verileri otomatik metne döker.
  3. **Kağıt Fatura Görselleri (Kamera / Tarayıcı OCR):** Fotoğrafı çekilen kağıt faturaları işler.
* **Görüntü İyileştirme & Kusur Önleme:**
  * Buruşuk kağıtları, gölgeleri ve kamera parlamalarını filtreleyerek metinlerin doğru okunmasını sağlar.
* **Kuruşu Kuruşuna Matematiksel Çapraz Denetim:**
  * `Kalem Tutarları Toplamı` == `Ara Toplam`
  * `KDV Matrahları Dağılımı (%1, %10, %20)` == `Hesaplanan KDV`
  * `Genel Toplam` == `Ara Toplam + KDV - İskontolar`
  * Olası OCR okuma hatalarını ve yuvarlama farklarını kırmızı uyarılarla anında yakalar.
* **Akıllı Katalog Eşleştirme Motoru:**
  * Faturadaki ürünleri barkod ve ürün adı benzerlik algoritmalarıyla mevcut katalogla eşleştirir.
  * Stok durumunu `Mevcut Stok ➔ Yeni Stok` olarak günceller.
  * Sistemde hiç olmayan yeni ürünler için tek tıkla yeni ürün kartı oluşturur.
* **Şirket Bazlı Otomatik Arşivleme:**
  * Yüklenen faturaları `data/faturalar/<FİRMA_ADI>/<TARİH>_<FATURA_NO>` hiyerarşisinde şirket klasörlerine arşivler (29+ Şirket, 214+ Belge).
  * Arşivden orijinal fatura görselini tam ekran önizleme.
* **Otomatik Muhasebe & Etiket Entegrasyonu:**
  * Onaylanan fatura tutarını muhasebe modülüne otomatik "Toptancı / Mal Alımı" gideri olarak işler.
  * Alış fiyatı değişen ürünlerin raf etiketlerini otomatik baskı sırasına ekler.

---

## 8. 📊 Detaylı Raporlama, Z Raporu & Haftalık Isı Haritası (Heatmap)

Yöneticilerin mağaza performansını en üst düzeyde analiz etmesini sağlayan analitik araçlar:

* **İnteraktif Aylık Satış Takvimi:**
  * Ayın her günü için toplam ciro, fiş adedi, satılan toplam adet/kg ve günün en çok satan ürününü kartlar halinde gösterme.
  * **Trend Rozetleri:** `Düne Göre: +%14,2 ↗` ve `Geçen Haftaya Göre: +%8,0 ↗` anlık kıyaslama.
* **6 Sekmeli Zengin Gün Detayı Modalı (Sabit 650px):**
  1. 🏆 **Günün En Çok Satanları:** Ciro ve miktar bazında sıralı ilk 10 ürün.
  2. 📊 **24 Saatlik Satış Dağılımı:** Saat saat ciro çubuk grafiği ve 🔥 **Zirve Saat** tespiti.
  3. 🛒 **Reyon Ciro Dağılımı:** Temel Gıda, Manav, Şarküteri, Temizlik, İçecek vb. renkli segment dağılımı.
  4. 👥 **Kasiyer Mutabakatı:** Kasiyerlerin kestiği fiş sayısı, nakit/kart payları ve toplam ciroları.
  5. 🧾 **Kasa Satış Fişleri:** O gün kesilen tüm fişlerin kalem kalem dökümü, müşteri detayları ve tekrar fiş yazdırma.
  6. ✏️ **Fiyat Değişiklikleri:** O gün içinde değiştirilen eski/yeni fiyat kütüğü.
* **Gün Sonu Özet Z Raporu:**
  * Gün sonu kasa kapanışında tek tıkla açılan; Nakit, Kredi Kartı, Veresiye, KDV oranları dökümünü içeren termal formatlı yazdırılabilir resmi Z raporu.
* **🔥 Haftalık Yoğunluk Isı Haritası (Heatmap):**
  * 7 Gün x 24 Saatlik matris üzerinde mağazanın en yoğun olduğu gün ve saatleri renklendirerek gösterir.
  * Kasa yoğunluğuna göre akıllı personel vardiya ve takviye önerisi sunar.
* **Excel (.csv) Rapor İndirme:** Günlük veya aylık tüm satış verilerini tek tıkla Excel formatında dışa aktarma.

---

## 9. 💼 Market Gelir / Gider Muhasebesi & Net Kâr Analizi

Marketin finansal sağlığını takip eden sade ve güçlü ön muhasebe:

* **Finansal KPI Genel Bakış:**
  * **Aylık Toplam Ciro** (Nakit vs. Kredi Kartı dağılımı).
  * **Toplam Giderler** (Kira, Fatura, Personel vb.).
  * **Net Kâr** ve **Kâr Marjı (%)** anlık hesaplama.
* **Kategorize Edilmiş Gider Yönetimi:**
  * Dükkan Kirası, Personel Maaşı & Avans, Elektrik / Su / Doğalgaz Faturaları, Toptancı / Mal Alımı, Temizlik & Sarf Malzeme, Vergiler ve Diğer Giderler.
  * Tarih, tutar, ödeme türü ve açıklama ile gider kaydetme, düzenleme ve silme.
* **POS Komisyon Oranı Hesaplayıcı:** Banka POS komisyon oranını (%X) tanımlayarak net banka tahsilatını hesaplama.
* **Market Kimliği & Kasiyer Kadrosu:**
  * Mağaza ticari ünvanı, şube adı, vergi dairesi/no ve telefon bilgilerini yönetme.
  * Kasiyer personeli tanımlama, PIN belirleme ve yetkilendirme.

---

## 10. 📱 Mobil El Terminali & Kablosuz Barkod Okuyucu

Pahalı el terminallerine gerek kalmadan akıllı telefonları tam donanımlı el terminaline dönüştürür:

* **Mobil Web Arayüzü (`/mobile`):** Telefon ve tabletler için optimize edilmiş dokunmatik modern arayüz.
* **Canlı Kamera ile Barkod Okuma (HTTPS / SSL):** Otomatik üretilen SSL sertifikası sayesinde mobil kamera ile reyon aralarında anında barkod tarama.
* **🛡️ HDR Parlama Önleme (Specular Glare Suppression):**
  * Parlayan jelatin, metalik folyo veya plastik ambalajlardaki ışık yansımalarını CLAHE ve Blackhat morfolojisi ile filtreler; ışık parlamasını bastırıp siyah çubukları netleştirir.
* **🥚 Yuvarlak ve Eğri Yüzey Düzleştirme (Cylindrical De-warping):**
  * Sürpriz yumurta çikolata, silindirik içecek kutusu, şişe, kavanoz ve top sakız gibi kavisli ambalajlardaki bükülmüş barkodları silindirik projeksiyon ters dönüşümü (`x' = R * arcsin(x / R)`) ve yatay genleşme ile düzlemsel hale getirerek anında çözer.
* **🔍 Donanım & Yazılımsal Zoom Desteği (1.0x - 3.0x):**
  * Kamerayı parlayan veya yuvarlak ambalaja 20-30 cm uzaktan tutup zoom yaparak parlamayı %90 oranında yok etme ve bükük barkodu düz netleme alanında tutma imkanı.
* **⚡ PyZBar + OpenCV Hibrit Çözücü:** İstemci tarafı donanım BarcodeDetector ve sunucu tarafı çok katmanlı adaptif eşikleme motoruyla 35 ms altında anlık algılama.
* **Reyondan Anlık Fiyat Gör & Fiyat Güncelle:** Reyonda gezerken ürünün fiyatını kontrol etme, gerekirse telefondan yeni fiyat girerek ana kasayla eşitleme.
* **Dinamik QR Kod Bağlantısı:** Masaüstü ekrandaki QR kodu telefonla okutarak saniyeler içinde şifresiz eşleşme.

---

## 11. 💾 Kategorik Yedekleme & Sistem Güvenliği

Veri kaybını önleyen çok katmanlı yedekleme altyapısı:

* **Kategorize Edilmiş Yedekleme Dizinleri:**
  * 📦 **Ürün Kataloğu Yedekleri:** `urunler_yedek_*.json` + meta verileri.
  * 🧾 **Fatura ve Görsel Arşiv Yedekleri:** `faturalar_yedek_*.zip`.
  * ⚙️ **Sistem & Ayar Yedekleri:** Satışlar, kasiyerler ve yapılandırma yedekleri.
* **Tek Tıkla Manuel & Otomatik Yedekleme:** Tek tuşla tüm sistemin veya seçilen modülün yedeğini alma.
* **Yedekten Geri Yükleme (Restore):** İstenilen tarihli yedeğe sistem ayarlarını bozmadan tek tıkla geri dönebilme.
* **Bağlantı Noktası Otomatik Boşaltma (`free_port`):** Sunucu yeniden başladığında 5000/5001 portlarını otomatik temizleyerek çakışmaları önler.

---

## 12. 🔌 Donanım & Çevre Birimleri Destek Matrisi

| Donanım Türü | Desteklenen Standartlar / Modeller | Bağlantı Arayüzü | İşlev |
| :--- | :--- | :--- | :--- |
| **Barkod Okuyucu** | 1D / 2D Optik Okuyucular, Kablosuz El Terminalleri | USB (HID / Klavye Emülasyonu), Bluetooth | Hızlı satışta anında ürün bulma |
| **Mobil Kamera** | iOS Safari / Android Chrome (HTML5 BarcodeDetector / ZXing) | Yerel Wi-Fi (HTTPS SSL) | Reyon içi kablosuz barkod okuma |
| **Etiket Yazıcı** | Zebra, Argox, Xprinter, Godex, TSC, HPRT vb. (ZPL II Destekli) | USB, Ağ (Ethernet/Wi-Fi), Windows RAW Spooler | Milisaniyelik doğrudan ZPL termal raf etiketi basımı |
| **Fiş Yazıcı** | 58mm / 80mm ESC/POS Termal Fiş Yazıcıları | USB, Seri (COM), Ağ (TCP 9100) | Satış fişi ve Gün Sonu Z Raporu basımı |
| **Para Çekmecesi** | Standart 12V / 24V RJ11 Para Çekmeceleri | Fiş Yazıcı RJ11 Çıkışı | Satışta veya `F7` ile otomatik açılma |
| **Elektronik Terazi**| DIGI SM-100, SM-500 ve uyumlu PLU Terazileri | Ethernet TCP/IP, FTP, Seri Port | Canlı fiyat senkronizasyonu ve 27/28 barkod çözme |

---

## 13. ⌨️ Klavye Kısayolları ve Hızlı Aksiyon Haritası

### Kasa (POS) Ekranı Kısayolları
| Tuş | Eylem Adı | Açıklama |
| :---: | :--- | :--- |
| **`Enter`** | **Barkod Okut / Ekle** | Barkod kutusundaki değeri sepete ekler. |
| **`F1`** | **📱 Mobil QR / Nakit** | Mobil bağlantı penceresini açar veya hızlı nakit satışı başlatır. |
| **`F2`** | **💳 Kredi Kartı** | Satışı kredi kartı ödemesi olarak başlatır. |
| **`F3`** | **🗑️ Sepeti Temizle** | Onay ile mevcut sepeti tamamen sıfırlar. |
| **`F4`** | **💵 Nakit Ödeme** | Nakit ödeme ve para üstü hesaplama modalını açar. |
| **`F5`** | **✖️ Miktar Çarpımı** | `[Miktar] * [Barkod]` formatında hızlı çoklu adet satışı açar. |
| **`F6`** | **🔍 Fiyat Gör** | Sepete eklemeden ürünün raf fiyatını büyük ekranda sorgular. |
| **`F7`** | **🗄️ Çekmece Aç / 1 TL** | Para çekmecesini açar veya bozuk para ekler. |
| **`F8`** | **⏸️ Askı / Eski Fişler** | Bekleyen fişleri ve günün eski satışlarını listeler. |
| **`F9`** | **↩️ Ürün İade** | Müşteriden iade alınan ürünü negatif tutarla sepete ekler. |
| **`F10`** | **🎁 İkram / İndirim** | Sepetteki ürünlere %100 ikram indirimi uygular. |
| **`Esc`** | **Kapat / İptal** | Açık olan modalları kapatır veya barkod alanına döner. |
| **`Space`** | **Barkoda Odaklan** | İmleci doğrudan barkod giriş kutusuna kilitler. |

### Katalog ve Liste Kısayolları
| Kısayol | Eylem |
| :--- | :--- |
| **`Shift + Tık`** | İlk tıklanan ürün ile son tıklanan ürün arasındaki tüm satırları toplu seçer. |
| **`Ctrl + Tık`** | Tıklanan ürünleri tek tek seçime ekler veya seçimden çıkarır. |

---

## 🎯 Özet: CORTEX POS Ne İşe Yarar?

CORTEX POS, bir perakende marketin veya bakkalın ihtiyaç duyabileceği tüm operasyonları tek bir noktada toplar:
1. **Kasada satışı hızlandırır:** Barkod, terazi ve hızlı butonlarla müşteriyi saniyeler içinde uğurlar.
2. **Raf etiketlerini otomatikleştirir:** Değişen fiyatları ZPL motoruyla anında termal yazıcıdan çıkartır.
3. **Teraziyle konuşur:** DIGI SM-100 terazisine ağdan tek tıkla güncel fiyatları gönderir.
4. **Faturaları otomatik işler:** Toptancı faturalarını OCR ve XML ile okuyup stoğu ve muhasebeyi günceller.
5. **Kâr ve zararı gösterir:** Ciro, gider ve net kârı kuruşu kuruşuna raporlar; Z raporu ve yoğunluk ısı haritası üretir.
6. **Cepten yönetilir:** Mobil terminal ile reyon aralarında fiyat kontrolü ve etiket sırası oluşturma imkanı tanır.
