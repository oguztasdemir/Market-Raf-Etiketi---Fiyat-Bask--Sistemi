# 🛒 Kasa (POS) Alt Eylem Butonları & Durum Çubuğu Çalışma Prensibi

Bu belge, Market Raf Etiketi ve Hızlı Satış (POS) sisteminde yer alan **10 adet alt eylem butonu** ve **7 sütunlu alt durum çubuğunun** mimari yapısını, klavye kısayollarını, tetiklenen fonksiyonlarını ve çalışma mantığını detaylandırmaktadır.

---

## 📑 1. 10'lu Kasa Eylem Butonları

| No | Buton Adı | Kısayol | Fonksiyon | Açılan Modal / Yapılan İşlem |
| :---: | :--- | :---: | :--- | :--- |
| **1** | **⚡ HIZLI ÜRÜN** | `Ekle/Düzenle` | `openPosQuickProductModal()` | `#modal-pos-quick-product-manage` |
| **2** | **📱 MOBİL** | `F1` | `openPosMobileQrModal()` | `#modal-pos-mobile-qr` |
| **3** | **🔍 FİYAT GÖR** | `F6` | `openPosPriceCheckModal()` | `#modal-pos-price-check` |
| **4** | **🗑️ TEMİZLE** | `F3` | `confirmClearPosCart()` | `#modal-pos-clear-confirm` (Sepet doluysa) |
| **5** | **💵 NAKİT** | `F4` | `startPosSaleCheckout('Nakit')` | `#modal-pos-payment` (Nakit seçili) |
| **6** | **💳 KART** | `F2` | `startPosSaleCheckout('Kredi Kartı')` | `#modal-pos-payment` (Kart seçili) |
| **7** | **🗄️ ÇEKMECE** | `F7` | `openCashDrawerAction()` | `/api/pos/open_drawer` API Çağrısı |
| **8** | **📜 ESKİ SATIŞ** | `F8` | `openPosRecentSalesModal()` | `#modal-parked-receipts` |
| **9** | **↩️ İADE** | `F9` | `openPosReturnModal()` | `#modal-pos-return` |
| **10**| **🎁 İKRAM** | `F10` | `applyPosGiftDiscount()` | Sepet tutarını sıfırlama (%100 indirim) |

---

## 🔍 2. Butonların Detaylı Çalışma Mantığı

### 1. ⚡ HIZLI ÜRÜN (`[Ekle/Düzenle]`)
* **Amaç:** Satış anında sisteme kayıtlı olmayan veya fiyatı güncellenmek istenen bir ürünü hızlıca tanımlamak.
* **Çalışma Şekli:**
  1. `#modal-pos-quick-product-manage` modalı tam ekran overlay (`z-index: 9999999`) olarak açılır.
  2. İmleç doğrudan `quick-prod-barcode` alanına odaklanır.
  3. Barkod okutulduğunda veya yazıldığında `/api/pos/search?q={barkod}` API'si tetiklenir:
     - Ürün varsa bilgileri form alanlarına (Ürün Adı, Alış, Satış, Birim, KDV, Stok) otomatik dolar.
     - Ürün yoksa yeni kayıt modu aktifleşir.
  4. **"Kaydet (Enter)"** dendiğinde ürün veritabanına kaydedilir ve doğrudan aktif sepete eklenir.

---

### 2. 📱 MOBİL (`[F1 Tuşu]`)
* **Amaç:** Cep telefonu veya tablet üzerinden kablosuz barkod okutma ve mobil satış terminaline bağlanma.
* **Çalışma Şekli:**
  1. `#modal-pos-mobile-qr` modalı açılır.
  2. Yerel ağ IP adresi üzerinden HTTP (`http://192.168.x.x:5000/mobile`) ve kamera izni için HTTPS QR kodları dinamik üretilir.
  3. Mobil cihaz kamerasıyla QR okutulduğunda telefon anında kablosuz el terminaline dönüşür.

---

### 3. 🔍 FİYAT GÖR (`[F6 Tuşu]`)
* **Amaç:** Sepete ekleme yapmadan ürünün raf/kasa satış fiyatını, stok durumunu ve KDV oranını büyük ekranda sorgulamak.
* **Çalışma Şekli:**
  1. `#modal-pos-price-check` modalı açılır ve arama kutusuna odaklanılır.
  2. Barkod okutulduğu anda ürünün büyük puntoyla fiyatı, birimi ve kâr marjı ekrana yansır.
  3. İstenirse `Enter` tuşuna basılarak ürün sepete de aktarılabilir.

---

### 4. 🗑️ TEMİZLE (`[F3 Tuşu]`)
* **Amaç:** Hatalı veya iptal edilen sepeti tek tuşla sıfırlamak.
* **Çalışma Şekli:**
  1. Eğer sepet zaten boşsa sağ altta *"ℹ️ Satış sepetiniz zaten boş."* bildirimi gösterilir.
  2. Eğer sepette ürün varsa `#modal-pos-clear-confirm` onay modalı açılır; onay verildiğinde sepet tamamen temizlenir.

---

### 5. 💵 NAKİT (`[F4 Tuşu]`) & 6. 💳 KART (`[F2 Tuşu]`)
* **Amaç:** Satış tahsilatını hızlıca tamamlamak veya parçalı ödeme almak.
* **Çalışma Şekli:**
  1. Sepet boşsa uyarı verilir.
  2. Sepet doluysa `#modal-pos-payment` ödeme penceresi açılır.
  3. Butona göre varsayılan ödeme türü `Nakit` veya `Kredi Kartı` olarak seçilir.
  4. Para üstü hesaplayıcı, parçalı ödeme (ör. 100 TL Nakit + Kalan Kart) ve fiş yazdırma seçenekleri sunulur.

---

### 7. 🗄️ ÇEKMECE (`[F7 Tuşu]`)
* **Amaç:** ESC/POS termal yazıcıya bağlı para çekmecesini (`RJ11 / Kick-out pulse`) anında açmak.
* **Çalışma Şekli:**
  1. Backend `/api/pos/open_drawer` rotasına istek atar.
  2. Termal yazıcıya `\x1b\x70\x00\x19\xfa` darbe sinyali gönderilerek çekmece açılır.

---

### 8. 📜 ESKİ SATIŞ (`[F8 Tuşu]`)
* **Amaç:** Beklemeye (parka) alınmış fişleri geri yüklemek veya gün içinde yapılmış son satışları incelemek.
* **Çalışma Şekli:**
  1. `#modal-parked-receipts` modalı açılır.
  2. Üstte beklemedeki fişler listelenir (tıklanınca sepete geri yüklenir).
  3. Altta günün son tamamlanan satışları listelenir (tekrar fiş çıktısı alınabilir).

---

### 9. ↩️ İADE (`[F9 Tuşu]`)
* **Amaç:** Müşteriden geri alınan ürünün tutarını sepete eksi bakiye olarak yansıtmak.
* **Çalışma Şekli:**
  1. `#modal-pos-return` modalı açılır.
  2. İade barkodu, ürün adı ve tutarı girilir.
  3. Sepete `Eksi (-)` tutarlı satır eklenerek genel toplamdan düşülür.

---

### 10. 🎁 İKRAM (`[F10 Tuşu]`)
* **Amaç:** Sepetteki ürünlere %100 promosyon/ikram indirimi uygulamak.
* **Çalışma Şekli:**
  1. Sepetteki tüm kalemlerin satış fiyatını 0,00 TL yapar ve toplamı sıfırlar.

---

## 📊 3. En Alt Durum & Bilgi Çubuğu (7 Sütunlu Grid)

Ekranın en altındaki ince durum paneli 7 eşit parçaya bölünmüştür:

1. **🏢 MERKEZ:** Şube adını ve aktif mağaza profilini gösterir.
2. **💻 KASA 1:** Terminal ve kasa istasyonu numarasını belirtir.
3. **👤 ADMİN:** Aktif kasiyeri gösterir; tıklandığında kasiyer değiştirme PIN modalı açılır.
4. **📅 CANLI TARİH:** Güncel sistem tarihini dinamik yansıtır (`GG.AA.YYYY`).
5. **⏰ CANLI SAAT:** Canlı saniye bazlı dijital saat (`SS:DD:SN`).
6. **🟢 ONLINE:** Backend sunucu ve terazi bağlantı canlılık durumunu denetler.
7. **🏠 ANA MENÜ (`ESC`):** Satış ekranından çıkıp ana kontrol merkezine döner.

---

## 🛡️ 4. Güvenlik ve Mimari Prensipler

1. **Önbellek Kırıcı (`Cache-Busting`):** Tüm JavaScript ve CSS çağrıları dinamik `?v={{ cache_bust }}` zaman damgasıyla yüklenir.
2. **Çift Katmanlı Olay Bağlantısı:** Butonlar hem HTML `onclick` niteliğiyle hem de `kasa_paneli.js` içerisindeki `initPosBottomButtons()` dinleyicileriyle güvenli bağlanmıştır.
3. **Event Bubbling İzolasyonu:** Modal açılışlarında tıklama baloncuklanmasının modalı anında kapatması engellenmiştir.
