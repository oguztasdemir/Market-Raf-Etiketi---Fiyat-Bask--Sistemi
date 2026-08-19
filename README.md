# 🏷️ Market Raf Fiyat Etiketi Paneli & Termal Baskı Sistemi

Bu proje, termal etiket yazıcıları (Zebra, Xprinter, Argox, HPRT, vb.) üzerinden **standart market raf fiyat etiketleri (Görsel 2 formatı)** tasarlamak, canlı önizlemek ve doğrudan USB/Windows RAW yazdırma kuyruğuna yüksek kalitede ZPL II kodu göndermek için geliştirilmiştir.

---

## 📁 Proje Klasör Yapısı

```
Etiket Çıkarıcı/
├── .gitignore               # Git tarafından yok sayılan dosyalar
├── README.md                # Proje dokümantasyonu ve kullanım kılavuzu
├── requirements.txt         # Python bağımlılıkları (Flask, pywin32)
├── start.bat                # Tek tıkla uygulamayı başlatan script
├── main.py                  # Flask Sunucu & REST API giriş noktası
│
├── docs/                    # Proje analiz ve görev dokümanları
│   └── task.md              # Kalibrasyon ve iyileştirme planı
│
├── src/                     # Çekirdek Python Servisleri
│   ├── __init__.py
│   ├── zpl_generator.py     # ZPL II Kod & Grafik Üretim Motoru (Piksel Kalibre)
│   └── printer_service.py   # Windows RAW & USB Yazıcı İletişim Servisi
│
├── static/                  # Web Paneli Statik Varlıkları
│   ├── css/
│   │   └── style.css        # Panel ve Raf Etiketi CSS Stilleri
│   └── js/
│       └── app.js           # Canlı Tasarım, Önizleme ve Yazdırma JS Mantığı
│
├── templates/               # Web Paneli Şablonları
│   └── index.html           # Ana Etiket Tasarım & Canlı Baskı Arayüzü
│
└── tests/                   # Test ve Doğrulama Scriptleri
    ├── __init__.py
    ├── test_printer.py      # Yazıcı Donanım Bağlantı Testi
    └── test_zpl_render.py   # ZPL Simülasyonu & Çıktı Doğrulama Testi
```

---

## 🚀 Hızlı Başlangıç

### 1. Gereksinimleri Yükleyin
```bash
pip install -r requirements.txt
```

### 2. Uygulamayı Başlatın
- **Windows için:** `start.bat` dosyasına çift tıklayın veya:
```bash
python main.py
```
- Tarayıcınızda otomatik açılacaktır: `http://127.0.0.1:5000`

---

## ✨ Özellikler

- **🔒 Korumalı Başlangıç Tasarımı:** Market standartlarındaki raf etiketi şablonu silinemez şekilde kilitlidir.
- **🎨 Etiket Tasarımı & Şablonlar:** Sağ üst köşeye Sade Birim Fiyat, Gramaj Rozeti, Reyon Kodu, Karekod (QR) veya Kampanya rozeti ekleyebilme.
- **📐 Milimetrik Kalibrasyon:** Yatay/Dikey rulo yönü seçimi, kafa genişliği ve X/Y ofset ince ayarları.
- **⚡ Canlı Önizleme:** EAN-13 barkod, para birimi ve metinlerin anlık önizlemesi.
- **🖨️ Donanımsal Adet Desteği:** Tek tıkla çoklu kopya (`^PQ`) basabilme.
