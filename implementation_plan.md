# Hızlı Satış (POS) Alt Eylem Panelleri & Hızlı Ürün Ekleme Onarım Planı

Kasa satış ekranının altındaki 10'lu eylem butonlarının (⚡ Hızlı Ürün, 📱 Mobil QR, 🔍 Fiyat Gör, 🗑️ Temizle, 💵 Nakit, 💳 Kart, 🗄️ Çekmece Aç, 📜 Eski Satış, ↩️ İade, 🎁 İkram) ve modallarının masaüstü GUI ve web üzerinde %100 sorunsuz, takılmasız ve anında çalışmasını sağlama planıdır.

---

## 1. Tespit Edilen Kök Nedenler (Root Causes)

1. **CSS `.modal-backdrop` Ezilme ve Görünürlük Çakışması:**
   - `static/css/style.css` dosyasında `.modal-backdrop` sınıfı `display: none;` olarak tanımlı olduğundan, JS üzerinden `modal.style.display = 'flex'` atandığında bazı tarayıcılarda ve pywebview motorunda CSS öncelik çatışması yaşanmaktadır.
   - Modallara hem CSS sınıfı (`.active`) hem de inline `display: flex !important;` desteği eklenmelidir.

2. **Global Event & Window Scope Bağlantıları:**
   - `templates/index.html` içerisindeki butonlar `onclick="openPosQuickProductModal()"` gibi doğrudan inline çağrılar yapmaktadır.
   - `pos_panel.js` içerisindeki tüm bu metotlar hem dosya başında hem de sonunda `window` nesnesine açıkça ve hata korumalı (try/catch ve fallback ile) bağlanmalıdır.

3. **Autofocus ve Etkileşim Kilitlenmeleri:**
   - Hızlı ürün penceresi açıldığında barkod girişine odaklanma (`focus`) işlemi gecikmeli veya engelli kalabiliyordu.
   - `setTimeout` ile DOM render tamamlandıktan hemen sonra input seçimi ve barkod sorgulama tetiklenecektir.

---

## 2. Yapılacak Değişiklikler ve İyileştirmeler

### 1. `static/css/style.css` (Modal Görünürlük & Katman Düzeni)
- `.modal-backdrop.active` ve `.modal-backdrop[style*="display: flex"]` kuralları güncellenecek, `z-index: 999999 !important` ve `opacity: 1 !important` ile görünürlük garanti altına alınacak.

### 2. `static/js/modules/pos_panel.js` (Eylem Fonksiyonları & Pencere Yönetimi)
- **⚡ Hızlı Ürün Ekle/Düzenle (`openPosQuickProductModal`):** Modal açıldığında inputları temizleyecek, barkod alanına autofocus verecek ve barkod yazıldığında anlık arama yapacak.
- **📱 Mobil QR (`openPosMobileQrModal`):** Hem `QRCode.js` hem de yerel canvas/fallback motoruyla QR kodunu anında oluşturacak.
- **🔍 Fiyat Gör (`openPosPriceCheckModal`):** Barkod okutulduğunda büyük dijital fiyat kartını gösterecek.
- **🗑️ Temizle (`confirmClearPosCart`):** Onay penceresiyle sepeti sıfırlayacak.
- **💵 Nakit & 💳 Kart Satış (`startPosSaleCheckout`):** Fiş yazdırma sorusunu açıp satışı tamamlayacak.
- **🗄️ Çekmece Aç (`openCashDrawerAction`):** Çekmece açma sinyali ve bildirimi verecek.
- **📜 Eski Satışlar (`openPosRecentSalesModal`):** Günlük geçmiş satış ve bekleyen fiş listesini açacak.
- **↩️ İade (`openPosReturnModal`):** Negatif tutarlı iade satırını sepete ekleyecek.
- **🎁 İkram (`applyPosGiftDiscount`):** Sepeti %100 indirimle sıfırlayacak.
- **🏠 Ana Menü (`exitPosToHome`):** Sepeti koruyarak ana yönetim ekranına dönecek.

### 3. `templates/index.html` (Modal DOM Yapısı & Buton Olayları)
- Alt panel butonlarının `onclick` ve klavye kısayol dinleyicileri (`F1-F10`, `ESC`, `ALT+F4`) optimize edilecek.
- Modalların DOM'daki yerleşimi `<body>` etiketinin en altına taşınarak overflow kırpılmaları engellenecek.

---

## 3. Doğrulama ve Test Adımları

1. **⚡ Hızlı Ürün Butonu:** Tıklandığında ve `Enter` ile yeni ürün veya mevcut ürün düzenleme penceresinin açılıp kapandığı doğrulanacak.
2. **📱 Mobil & 🔍 Fiyat Gör:** Butonlara tıklandığında ilgili modalların anında ekrana geldiği test edilecek.
3. **Klavye Kısayolları:** `F1` (Mobil), `F3` (Temizle), `F4` (Nakit), `F5` (Kart), `F6` (Fiyat Gör), `ALT+F4` (Pencere Kapat) tuşlarının eksiksiz çalıştığı doğrulanacak.
4. **Masaüstü GUI:** `python main_gui.py` ile bağımsız masaüstü penceresi açılarak test edilecek.
