# 🧭 Proje Klasör Yapısı ve Dosya Rehberi (Architecture & File Reference)

> **Amaç:** Bu doküman, gelecekteki oturumlarda tüm proje dosyalarını gereksiz yere baştan sona tarayarak token harcamamak ve doğrudan hedeflenen dosyalara hızlıca müdahale edebilmek amacıyla hazırlanmıştır.

---

## 📁 Genel Dizin Ağacı ve Görevleri

```
📦 Etiket Çıkarıcı / Market Raf Etiketi & Fiyat Baskı Sistemi
├── 📄 main.py                          # Uygulamanın giriş noktası (Flask web/masaüstü sunucusu, webview başlatıcı)
├── 📄 PROJE_REHBERI.md                 # Bu doküman (Gelecek oturumlar için kılavuz)
├── 📁 backend/                         # Sunucu tarafı Python mimarisi (Modüler Rotalar ve Servisler)
│   ├── 📁 rotalar/                     # API endpoint ve sayfa yönlendirmeleri
│   ├── 📁 servisler/                   # Çekirdek iş mantığı, veritabanı, etiket basımı, dışa aktarım
│   ├── 📁 terazi/                      # Digi SM-100 vb. manav terazi haberleşme ve FTP servisleri
│   ├── 📁 arayuz/                      # Masaüstü pencere, menü ve webview yöneticisi
│   └── 📁 araclar/                     # Yardımcı fonksiyonlar, loglayıcılar, veri formatlayıcılar
├── 📁 frontend/                        # İstemci tarafı (Arayüz, JS motoru, Modüler CSS)
│   ├── 📁 sayfalar/                    # HTML şablonları (Masaüstü ve Mobil)
│   ├── 📁 js/                          # Vanilla JS modülleri (Sayfa ve bileşen bazlı yöneticiler)
│   ├── 📁 stiller/                     # Modüler CSS dosyaları (Paneller, Temalar, Modallar)
│   └── 📁 varliklar/                   # İkonlar, logolar, sesler ve statik kaynaklar
├── 📁 veriler/                         # SQLite veritabanı, yedekler, dışa aktarılan dosyalar
└── 📁 build_tools/                     # PyInstaller derleme scriptleri ve yapılandırmalar
```

---

## 🖥️ 1. Backend Dosya Kılavuzu (`/backend`)

### 📌 `main.py`
- **Görevi:** Uygulamanın ana başlatıcısıdır. Flask uygulamasını ayağa kaldırır, veritabanını ilklendirir, Blueprint rotalarını kaydeder ve masaüstü webview penceresini açar.

### 📂 `backend/rotalar/` (API Uç Noktaları)
- **`ana_rotalar.py`**: Temel sayfa yönlendirmeleri (`/`, `/hizli-satis`, `/katalog` vb.) ve oturum/durum kontrolleri.
- **`satis_rotalari.py`**: Kasa satış işlemleri, fiş kesme, sepet onaylama, hızlı satış API'leri (`/api/sale/...`).
- **`katalog_rotalari.py`**: Ürün ekleme, silme, güncelleme, Excel/CSV içe-dışa aktarma API'leri (`/api/catalog/...`).
- **`etiket_rotalari.py`**: Raf etiketi şablonları, özel tasarım parametreleri ve etiket baskı komutları (`/api/labels/...`).
- **`terazi_rotalari.py`**: Manav terazisi (Digi SM-100 vb.) PLU aktarımı, veri çekme ve ürün gönderme API'leri (`/api/scale/...`).
- **`ayar_rotalari.py`**: Sistem ayarları, yazıcı seçimi, tema tercihi ve yedekleme uç noktaları (`/api/settings/...`).

### 📂 `backend/servisler/` (İş Mantığı ve Veri Katmanı)
- **`veritabani_servisi.py`**: SQLite veritabanı CRUD işlemleri (Ürünler, Satışlar, Şablonlar, Fişler).
- **`etiket_baski_servisi.py`**: HTML/PDF/ZPL etiket oluşturucu ve termal yazıcıya gönderme motoru.
- **`excel_aktarim_servisi.py`**: Excel (.xlsx) ve CSV içe/dışa aktarım mantığı, ürün eşleme.
- **`fis_servisi.py`**: Termal fiş yazıcı (ESC/POS) formatlama ve fiş yazdırma mantığı.
- **`yedekleme_servisi.py`**: Veritabanı ve ayarların `.zip` / `.db` olarak otomatik veya manuel yedeklenmesi/geri yüklenmesi.

### 📂 `backend/terazi/` (Manav Terazi Entegrasyonu)
- **`terazi_servisi.py`**: Terazi yönetim ana orkestratörü; PLU sıralama, ürün eşleştirme ve hata toleransı.
- **`digi_sm100_dosya_servisi.py`**: Digi SM-100 FTP dosya formatı üretici (`.DAT` dosyaları, fiyat dönüştürme - nokta/virgül uyumu).
- **`ftp_istemcisi.py`**: Teraziye IP üzerinden FTP ile dosya yükleme/indirme mekanizması.

---

## 🎨 2. Frontend Dosya Kılavuzu (`/frontend`)

### 📂 `frontend/sayfalar/` (HTML Arayüzleri)
- **`masaustu/index.html`**: Masaüstü uygulamasının ana iskeleti, sidebar (sol menü), topbar ve panel kapsayıcıları.
- **`masaustu/hizli_satis/`**: Hızlı satış paneli, sepet, ürün arama ve alt panel eylem butonları (`kasa_eylem_butonlari.html`).
- **`masaustu/katalog/`**: Ürün listeleme, filtreleme, toplu düzenleme ve Excel aktarım modal/panelleri.
- **`masaustu/etiket_tasarim/`**: Canlı etiket önizleme, şablon seçimi, barkod/fiyat pozisyonlama arayüzü.
- **`masaustu/manav_terazi/`**: Terazi PLU listesi, tekil manav ürünü fiyat/ad güncelleme modalları.

---

### 📂 `frontend/stiller/masaustu/` (Modüler CSS Mimarisi)
> **Not:** `style.css` artık merkezi giriş noktasıdır (`@import`). Tüm paneller ayrı alt dosyalara bölünmüştür:

- **`style.css`**: Tüm alt CSS dosyalarını sırayla içe aktaran merkezi ana stil dosyası.
- **`temel/degiskenler.css`**: CSS renk paletleri, font tanımları, gölgeler, border-radius ve animasyon süreleri.
- **`temel/sidebar_ve_topbar.css`**: Sol menü çubuğu, başlık barı, sistem durum bildirimleri stilleri.
- **`temel/ortak_bilesenler.css`**: Butonlar, inputlar, kartlar, tablolar, rozetler ve genel UI elemanları.
- **`paneller/ana_sayfa.css`**: Dashboard istatistik kartları, hızlı işlem kısayolları.
- **`paneller/hizli_satis.css`**: Kasa satış ekranı, sepet grid'i ve **1.5 kat büyütülmüş kasa eylem butonları** (`Hızlı Ürün`, `Fiyat Gör`, `Ödeme Al`, `İptal`).
- **`paneller/katalog.css`**: Ürün kataloğu, arama çubukları, veri tablosu satırları.
- **`paneller/senkronizasyon.css`**: Bulut / şube senkronizasyon göstergeleri ve durum paneli.
- **`paneller/etiket_tasarim.css`**: Etiket tasarım aracı, cetveller, canlı etiket önizleme kartı.
- **`paneller/manav_terazi.css`**: Terazi PLU tablosu, terazi bağlantı durumu kartları.
- **`paneller/raporlar.css`**: Satış grafikleri, ciro kartları, filtreleme formları.
- **`paneller/qr_ve_cihazlar.css`**: QR kod tarayıcı, el terminali ve donanım eşleştirme ekranı.
- **`paneller/yedekleme.css`**: Yedek alma, geri yükleme ve yedek geçmişi tablosu.
- **`paneller/ayarlar.css`**: Yazıcı yapılandırma, sistem tercihleri ve genel ayar sekmeleri.
- **`modallar/modallar.css`**: Açılır pencereler (Modal dialogs, pop-up, onay pencereleri, manav ürün düzenleme modali).
- **`temalar/acik_tema.css`**: Açık tema renk geçişleri, kontrast düzeltmeleri ve açık tema kasa buton renkleri.

---

### 📂 `frontend/js/masaustu/` (JavaScript İş Mantığı)
- **`ana_uygulama.js`**: Sayfa/panel geçişleri, bildirim sistemi (toast), klavye kısayol yöneticisi.
- **`hizli_satis/`**:
  - `kasa_yoneticisi.js`: Sepet hesaplamaları, iskonto, barkod okuyucu tetikleyicisi, nakit/kart ödeme tamamlama.
  - `hizli_urunler.js`: Hızlı ürün grid butonları ve sepete ekleme aksiyonları.
- **`katalog/`**:
  - `katalog_paneli.js`: Ürün arama, filtreleme, fiyat güncelleme (nokta/virgül duyarlı) ve toplu işlem yöneticisi.
- **`etiket/`**:
  - `etiket_tasarim_yoneticisi.js`: Etiket parametrelerinin yönetimi, canlı render ve baskı kuyruğuna iletim.
- **`terazi/`**:
  - `manav_urun_modali.js`: Manav PLU düzenleme modali (Enter ile kaydetme, nokta/virgül fiyat uyumu, otomatik barkod gereksizliğini kaldıran yapı).
  - `terazi_yoneticisi.js`: Teraziye aktar buton aksiyonu, FTP transfer ilerleme çubuğu.
- **`ayarlar/`**:
  - `ayar_yoneticisi.js`: Yazıcı ayarları, tema değiştirici, yedekleme tetikleyicileri.

---

## ⚡ Hızlı Sorun Giderme & Hangi Dosyaya Gidilmeli?

| Sorun / Görev | Hedef Backend Dosyası | Hedef Frontend Dosyası |
| :--- | :--- | :--- |
| **Kasa eylem butonları boyutu / rengi** | - | `frontend/stiller/masaustu/paneller/hizli_satis.css` & `acik_tema.css` |
| **Manav terazisi fiyat / PLU hatası** | `backend/terazi/digi_sm100_dosya_servisi.py` | `frontend/js/masaustu/terazi/manav_urun_modali.js` |
| **Ürün fiyatı girerken nokta/virgül hatası** | `backend/terazi/terazi_rotalari.py` | `frontend/js/masaustu/katalog/katalog_paneli.js` |
| **Etiket baskı / şablon düzenleme** | `backend/servisler/etiket_baski_servisi.py` | `frontend/stiller/masaustu/paneller/etiket_tasarim.css` |
| **Açık Tema (Light Mode) renk bozukluğu** | - | `frontend/stiller/masaustu/temalar/acik_tema.css` |
| **Veritabanı / Yedekleme eklemeleri** | `backend/servisler/veritabani_servisi.py` | `frontend/js/masaustu/ayarlar/ayar_yoneticisi.js` |
| **Yazarkasa POS & Çekmece Sürücüleri** | `backend/donanim/okc_suruculeri/` | - |
| **Kasa Sesleri & Manav Görselleri** | - | `frontend/varliklar/sesler/` & `manav_resimler/` |
