# 📄 Fatura Okuma, Akıllı Çözümleme ve Stok-Maliyet Entegrasyonu Planı

Bu belge; kullanıcının PC ve mobilden fatura (PDF, XML/UBL-TR, Görsel) yükleyip okutabileceği, fatura detaylarını (tedarikçi, kalemler, KDV, iskonto, birim maliyet) otomatik ayrıştırarak mevcut ürün kataloğuyla eşleştireceği, yeni ürünleri tespit edip stok ve fiyat güncelleyebileceği **"Fatura Okuma & Giriş Sistemi"** mimarisini adım adım planlar.

---

## 🎯 1. Proje Hedefleri ve Kullanıcı Senaryoları

1. **Çok Kanallı Fatura Yükleme (PC & Mobil):**
   * **PC:** e-Fatura / e-Arşiv PDF yükleme, UBL-TR e-Fatura XML yükleme (%100 hatasız parsing), taranmış fatura görseli yükleme (PNG/JPG).
   * **Mobil:** Kameradan fatura fotoğrafı çekme veya galeri faturası seçme.
2. **Kapsamlı Fatura Ayrıştırma (Parser):**
   * **Fatura Başlığı:** Tedarikçi/Toptancı Adı, Vergi No, Fatura No, Tarih, Ara Toplam, İskonto Toplamı, KDV Toplamı, Genel Toplam.
   * **Fatura Kalemleri:** Barkod, Ürün Adı, Miktar (Adet/Koli/Kg), Birim Alış Fiyatı (KDV Hariç), KDV Oranı (%1, %10, %20), İskonto (%), İskonto Dahil KDV Dahil **Net Birim Maliyet**.
3. **Akıllı Ürün Eşleştirme Motoru:**
   * **Eşleşen Ürünler:** Barkod veya ürün adından katalogdaki ürünle anında eşleşir.
     * Stok Güncelleme: `Mevcut Stok (15) + Fatura Miktarı (24) = 39 Adet`.
     * Maliyet / Fiyat Kontrolü: Eski Alış vs. Yeni Alış kıyaslaması ve kâr marjı uyarısı.
   * **Bulunamayan / Yeni Ürünler:** "⚠️ Bu Ürün Katalogda Bulunamadı" uyarısı; tek tıkla **"Kataloğa Yeni Ürün Olarak Ekle"** veya **"Mevcut Ürünle Eşle"**.
4. **Tek Tıkla Otomatik Entegrasyonlar:**
   * **Stokları Güncelle:** Faturadaki tüm ürünlerin stoklarını anında artırır.
   * **Muhasebeye İşle:** Fatura tutarını otomatik olarak `Muhasebe -> Toptancı / Mal Alımı` gideri olarak kaydeder.
   * **Etiket Baskısına Gönder:** Fiyatı değişen veya yeni gelen ürünleri tek tıkla **Toplu Raf Etiketi Baskı** sırasına atar.
   * **Fatura Arşivi:** Fatura `data/invoices/` altında arşivlenir ve geçmişe dönük incelenebilir.

---

## 🏗️ 2. Mimari ve Dosya Değişiklikleri

### Backend Mimarisi
* **`backend/fatura/fatura_servisi.py` [YENİ]:**
  * `parse_invoice_file(file_path, file_type)`: XML/UBL, PDF ve OCR/Görsel çözümleme motoru.
  * `match_invoice_items_with_catalog(items)`: Fatura kalemlerini `data/products.json` ile eşleştirir; bulunanları, yeni ürünleri, stok değişimlerini ve maliyet farklarını hesaplar.
  * `commit_invoice_to_system(invoice_data, options)`: Stokları günceller, muhasebeye gider ekler, etiket sırası oluşturur ve faturayı arşivler.
  * `get_saved_invoices()`: Arşivlenmiş faturaların listesini döner.
* **`backend/fatura/fatura_rotalari.py` [YENİ]:**
  * `POST /api/invoice/upload`: Fatura dosyası yükleme ve anlık çözümleme.
  * `POST /api/invoice/commit`: Faturayı onaylayıp stok/fiyat/muhasebeye işleme.
  * `GET /api/invoice/history`: Geçmiş faturalar ve detayları.
* **`backend/ayarlar.py`:**
  * `INVOICES_DIR = os.path.join(DATA_DIR, 'invoices')`
* **`main.py`:**
  * `invoice_bp` blueprint'inin sisteme kaydedilmesi.

### Frontend Mimarisi
* **Sol Menü (`frontend/sayfalar/masaustu/bilesenler/yan_menu.html`):**
  * **"🧾 Fatura Okuma"** (`tab-invoice`) butonu eklenmesi.
* **Fatura Sekmesi (`frontend/sayfalar/masaustu/fatura/fatura_sekmesi.html` [YENİ]):**
  * **Yükleme Alanı:** Sürükle-bırak fatura yükleme (PDF, XML, Görsel) + Örnek Fatura yükleme butonu.
  * **Fatura Özet Başlık Kartı:** Tedarikçi Adı, Fatura No, Tarih, Kalem Sayısı, İskonto, Toplam Tutar.
  * **Ayrıştırılmış Kalemler Tablosu:**
    * Durum (✅ Eşleşti / ⚠️ Yeni Ürün),
    * Barkod & Ürün Adı,
    * Gelen Miktar & Mevcut Stok & Yeni Stok,
    * Liste Fiyatı, İskonto (%), KDV (%), **Net Birim Alış**, Mevcut Raf Satış Fiyatı,
    * Tahmini Kâr Marjı (%),
    * İşlemler (Yeni Ürün Oluştur / Eşle).
  * **Alt İşlem Butonları:** `📥 Stokları Güncelle & Onayla`, `🏷️ Etiket Sırasına Ekle`, `📊 Muhasebeye Gider Olarak İşle`.
  * **Geçmiş Faturalar Arşivi Tablosu.**
* **Modallar (`frontend/sayfalar/masaustu/fatura/modallar/` [YENİ]):**
  * `fatura_manuel_esleme_modali.html`: Bulunamayan ürünü mevcut ürünle aratarak eşleştirme.
* **Javascript Kontrolörü (`frontend/js/masaustu/fatura/fatura_paneli.js` [YENİ]):**
  * Fatura dosya yükleme, canlı ayrıştırma, tablo renderı, stok onaylama, etiket aktarımı ve filtreleme.
