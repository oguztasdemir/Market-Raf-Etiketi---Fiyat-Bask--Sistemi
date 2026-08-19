# 📋 Termal Market Raf Etiketi Düzeltme ve İyileştirme Görev Planı (task.md)

Bu belge, **Görsel 1'deki hatalı/kaymış çıktının**, **Görsel 2'deki standart market raf etiketine** %100 birebir dönüştürülmesi için gereken tüm teknik adımları, donanım kalibrasyonlarını, ZPL parametrelerini ve uygulama planını içerir.

---

## 🔍 1. Detaylı Kök Neden Analizi (Görsel 1 vs Görsel 2)

| Alan / Özellik | Görsel 1 (Mevcut Hatalı Çıktı) | Görsel 2 (Olması Gereken Raf Etiketi) | Kök Neden ve Çözüm |
| :--- | :--- | :--- | :--- |
| **1. Yönlendirme (Orientation)** | İçerik dikey şeride sıkışmış, 90° dönük ve taşmış vaziyette. | Yatay dikdörtgen alanına tam oturan 3 katmanlı simetrik düzen. | ZPL'deki `^A0R` ve `^PW` (Print Width) koordinat eksenlerinin kağıt besleme yönüyle çakışması. |
| **2. Karakter Kodlama & TL Simgesi** | `ÜLK 398-6` yerine `JLK 398-£`, `₺` yerine `£` veya bozuk karakter. | Kusursuz Türkçe karakterler (`ÜLK 398-6 PİKO PORTAKAL`) ve net `₺` / `TL` simgesi. | `latin1` dönüşümü ve ZPL `^CI28` (UTF-8) eksikliği. Termal yazıcı fontlarında `₺` sembolü için özel vektör/grafik çizimi. |
| **3. Yerli Üretim Logosu** | Sadece metin kutusu (`[ YERLI URETIM ]`). | Resmi çift çerçeveli el sıkışma piktogramı + YERLİ ÜRETİM yazısı + Birim Fiyat. | ZPL `^GF` (Graphics Field) bitmap veya net vektörel geometrik piktogram eklenmeli. |
| **4. Barkod Bloğu & İnsan Okur Rakamlar** | Barkod boydan boya uzamış, çizgiler orantısız. | Standart EAN-13 barkod (`^BE`), çizgiler dikey, altında 13 haneli rakamlar ortalı. | Barkod modülü genişliği (`^BY2`) ve yükseklik (`^BE,50,Y,N`) kalibrasyonu. |
| **5. "Satış Fiyatı" Dikey Ayracı** | Basit kutu içine kaymış. | Barkod ile Fiyat arasında iki dikey çizgi içinde ortalanmış "Satış \n Fiyatı" yazısı. | Alt gridin 3 sütunlu ayrılması (Sol: Barkod %35, Orta: Satış Fiyatı %15, Sağ: Fiyat %50). |
| **6. Devasa Satış Fiyatı** | 10,00 TL dar alana sıkışmış. | Devasa kalın rakamlar ("10,00") ve sağında orantılı "₺" simgesi. | Ölçekli ZPL bitmap/vektör font (`^A0N,90,75`) kullanımı. |
| **7. Kağıt Sensörü & Durma Noktası (Gap/Feed)** | Etiket yırtma noktasından kayabiliyor. | Her baskıda tam etiket sınırında durma (Tear-off pozisyonu). | ZPL `^MNY` (Gap/Web sensing) ve `^MTT` (Tear-off) komutlarının eklenmesi. |
| **8. Koyu Yazım & Kontrast (Darkness)** | Termal kafada siliklik veya çizgi kaybı riski. | Net, simetrik, doygun siyah çizgiler. | `~SD20` - `~SD25` (Set Darkness) kontrast komutunun eklenmesi. |

---

## 🎯 2. Hedef Etiket Anatomisi (Görsel 2)

Etiket yatay olarak 3 ana banda ve hassas alt sütunlara ayrılmıştır:

```
+-----------------------------------------------------------------------------------+
|  [ÜST BÖLÜM]                                                                      |
|  ÜLK 398-6 PİKO PORTAKAL                          +-----------------------------+ |
|  PİR PAT KAP                                      | [🤝] YERLİ ÜRETİM           | |
|                                                   | Birim Fiyat - Kg/Lt/Ad      | |
|                                                   |                    250,00 ₺ | |
|                                                   +-----------------------------+ |
+-----------------------------------------------------------------------------------+
|  [ORTA BÖLÜM]                                                                     |
|  YARENLER               Üretim Yeri: TÜRKİYE                                      |
|  (Marka / Firma)        Fiyatlarımıza Kdv Dahildir.                               |
|                         Fiyat Değiştirme Tarihi: 14 May 2025                      |
+-----------------------------------------------------------------------------------+
|  [ALT BÖLÜM]                                                                      |
|  +------------------+  +---------+  +-------------------------------------------+ |
|  | |||||||||||||||| |  |  Satış  |  |                                           | |
|  | 8690504114925    |  |  Fiyatı |  |            10,00 ₺                        | |
|  +------------------+  +---------+  +-------------------------------------------+ |
+-----------------------------------------------------------------------------------+
```

---

## 🛠️ 3. Kapsamlı Görev ve Uygulama Listesi

### Adım 1: ZPL Motorunun Yeniden Kodlanması (`src/zpl_generator.py`)
- [ ] **UTF-8 & Kod Sayfası**: `^CI28` entegrasyonu ile tüm Türkçe harflerin (`Ç, Ğ, İ, Ö, Ş, Ü, ç, ğ, ı, ö, ş, ü`) ve para biriminin sorunsuz basılması.
- [ ] **Gerçek Yerli Üretim Logosu**: Resmi el sıkışma / barkod piktogramı ve çift çerçeveli kutu için ZPL vektör/GF grafik yapısı.
- [ ] **Yönlendirme & Kalibrasyon Modları**:
  - `0° Normal (Yatay Baskı)` modu: Rulo genişliğine tam oturan standart çıktı.
  - `90° Rotated (Dikey Besleme)` modu: Dikey rulolar için 90 derece döndürülmüş tam kalibre çıktı.
- [ ] **3 Katmanlı Grid ve Koordinat Sistemi**:
  - Üst: 2 satır kalın başlık (Sol) + Yerli Üretim ve Birim Fiyat (Sağ)
  - Orta: Firma Adı (Sol) + 3 Satırlık Yasal Blok (Sağ)
  - Alt: Standart EAN-13 Barkod (`^BE`) + Dikey "Satış Fiyatı" Kutusu + Devasa Satış Fiyatı (`10,00 ₺`)
- [ ] **Donanım & Baskı Kalitesi Komutları**:
  - `^MNY` (Gap/Boşluk sensörü ile tam sınırda durma)
  - `~SD22` (Net ve koyu termal baskı kontrastı)
  - `^MMT` (Tear-off yırtma modu)

### Adım 2: Yazıcı İletişim Servisi (`src/printer_service.py`)
- [ ] UTF-8 raw byte iletimi ve Windows spooler yapılandırması.
- [ ] Hata yakalama ve yazıcı durum geri bildirimi.

### Adım 3: Web Paneli & Canlı Önizleme Arayüzü (`index.html`, `app.js`, `style.css`)
- [ ] **Birebir Canlı Önizleme**: Görsel 2'deki sarı raf etiketi formatı, fontları ve çizgi oranlarıyla %100 eşleşen canlı CSS önizlemesi.
- [ ] **Canlı Kalibrasyon Kontrolleri**:
  - Etiket boyutu seçici (60x30mm, 60x40mm, 76x40mm, 85x45mm vb.)
  - Yazıcı yönü seçici (0° Düz, 90° Döndürülmüş)
  - X / Y Ofset ve Kontrast ayar kaydırıcıları.
- [ ] **Hızlı Alan Doldurma**: Tarih otomatik bugünün tarihi ("19 Ağu 2026"), barkod EAN-13 kontrolü.

### Adım 4: Doğrulama ve Test
- [ ] Üretilen ZPL kodunun simülasyon çıktısı ile Görsel 2'nin piksel piksel karşılaştırılması.
- [ ] Fiziksel termal yazıcıda deneme baskısı.

---

## 🚀 4. Uygulama Planı
1. `src/zpl_generator.py` dosyasını yeni motor ile güncelleme.
2. `src/printer_service.py` ve `main.py` dosyalarını güncelleme.
3. `templates/index.html`, `static/css/style.css`, `static/js/app.js` dosyalarını güncelleme.
4. Çıktı doğrulaması yapma.
