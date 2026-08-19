"""
Termal Etiket Kod ve Grafik Üretim Motoru (ZPL II)
Görsel 2'deki orijinal market raf etiketi ile %100 birebir kalibrasyonlu ZPL motoru.
"""
import textwrap

def clean_tr(text):
    """Termal yazıcı fontları için Türkçe karakter uyumluluğu ve temizleme."""
    if not text:
        return ""
    replacements = {
        'ı': 'i', 'İ': 'I',
        'ğ': 'g', 'Ğ': 'G',
        'ü': 'u', 'Ü': 'U',
        'ş': 's', 'Ş': 'S',
        'ö': 'o', 'Ö': 'O',
        'ç': 'c', 'Ç': 'C',
    }
    res = str(text)
    for k, v in replacements.items():
        res = res.replace(k, v)
    return res

def split_title_lines(title1, title2="", max_chars_per_line=30):
    """
    Ürün başlığını güvenli karakter sınırına göre 1 veya 2 satıra böler.
    Taşmaları önler.
    """
    t1 = clean_tr(title1).strip().upper()
    t2 = clean_tr(title2).strip().upper()
    
    if t2:
        full_text = f"{t1} {t2}".strip()
    else:
        full_text = t1

    lines = textwrap.wrap(full_text, width=max_chars_per_line)
    
    line1 = lines[0] if len(lines) > 0 else ""
    line2 = lines[1] if len(lines) > 1 else ""
    
    # 2 satırdan fazlaysa 2. satıra ekle ve max 32 karaktere kırp
    if len(lines) > 2:
        line2 = (line2 + " " + " ".join(lines[2:])).strip()
    
    if len(line1) > 34:
        line1 = line1[:34]
    if len(line2) > 34:
        line2 = line2[:34]
        
    return line1, line2

def generate_market_shelf_zpl(data, orientation="POR", x_offset=0, y_offset=0, width_mm=76, height_mm=40, dpi=203, copies=1):
    """
    Görsel 2 raf etiketi ZPL motoru.
    - Sağ üstteki Yerli Üretim kaldırıldı.
    - Ürün adı tüm üst genişliği kullanır (otomatik 2. satıra sarma).
    - 0.2mm yukarı kalibrasyon uygulandı.
    """
    dpmm = 8 if dpi == 203 else 12
    qty = max(1, int(copies))
    
    w_dots = int(width_mm * dpmm) # ~608 dot
    h_dots = int(height_mm * dpmm) # ~320 dot

    # Başlıkları akıllı satır kaydırma ile hazırla
    raw_t1 = data.get('title1', 'ULK 398-6 PIKO PORTAKAL')
    raw_t2 = data.get('title2', 'PIR PAT KAP')
    t1, t2 = split_title_lines(raw_t1, raw_t2, max_chars_per_line=30)

    brand = clean_tr(data.get('brand', 'YARENLER')).strip().upper()
    origin = clean_tr(data.get('origin', 'TURKIYE')).strip().upper()
    date = clean_tr(data.get('date', '14 May 2025')).strip()
    barcode = str(data.get('barcode', '8690504114925')).strip()
    price = str(data.get('price', '10,00 TL')).replace('₺', 'TL').strip()

    # Kalibrasyon Ofsetleri:
    # Sol-Sağ: +100 dot
    # Yukarı: +28 dot (önceki +25 + 0.2mm ekstra)
    oy = int(y_offset) + 100
    ox = int(x_offset) + 28

    if orientation in ["POR", "90", "YATAY", "horizontal"]:
        # =========================================================================
        # 90 DERECE YATAY BASKI MODU (Tam Genişlik Başlık)
        # =========================================================================
        pw = h_dots + ox + 30
        ll = w_dots + oy + 40
        
        zpl = [
            "^XA",
            "^CI28",                # UTF-8 Kod Sayfası
            "~SD22",                # Koyu net termal kontrast
            "^MNY",                 # Ara boşluk (Gap) algılama sensörü
            "^MMT",                 # Tear-off yırtma modu
            f"^PW{pw}",             # Kafa genişliği
            f"^LL{ll}",             # Kağıt uzunluğu
            "^LH0,0",
            
            # -------------------------------------------------------------
            # 1. BÖLÜM (ÜST KATMAN): Tam Genişlik Ürün Başlıkları
            # -------------------------------------------------------------
        ]

        if t2:
            # 2 Satırlı Başlık Düzeni
            zpl.extend([
                f"^FO{ox + 272},{oy + 20}^A0R,28,24^FD{t1}^FS",
                f"^FO{ox + 240},{oy + 20}^A0R,25,21^FD{t2}^FS",
            ])
        else:
            # Tek Satırlı Başlık Düzeni (Daha Büyük ve Ortalı)
            zpl.append(f"^FO{ox + 255},{oy + 20}^A0R,32,28^FD{t1}^FS")

        # 1. AYRAÇ ÇİZGİSİ (Tüm Etiket Boyunca)
        zpl.append(f"^FO{ox + 215},{oy + 10}^GB2,{w_dots - 20},2^FS")

        # -------------------------------------------------------------
        # 2. BÖLÜM (ORTA KATMAN): Marka (Sol) & 3 Satır Yasal Bilgi (Sağ)
        # -------------------------------------------------------------
        zpl.append(f"^FO{ox + 155},{oy + 20}^A0R,34,28^FD{brand}^FS")

        mid_y = oy + int(w_dots * 0.35)
        zpl.extend([
            f"^FO{ox + 175},{mid_y}^A0R,16,14^FDUretim Yeri: {origin}^FS",
            f"^FO{ox + 148},{mid_y}^A0R,15,13^FDFiyatlarimiza Kdv Dahildir.^FS",
            f"^FO{ox + 122},{mid_y}^A0R,15,13^FDFiyat Degistirme Tarihi: {date}^FS",
        ])

        # 2. AYRAÇ ÇİZGİSİ (Tüm Etiket Boyunca)
        zpl.append(f"^FO{ox + 110},{oy + 10}^GB2,{w_dots - 20},2^FS")

        # -------------------------------------------------------------
        # 3. BÖLÜM (ALT KATMAN): EAN-13 Barkod | Satış Fiyatı | BÜYÜK FİYAT
        # -------------------------------------------------------------
        if len(barcode) == 13 and barcode.isdigit():
            zpl.append(f"^FO{ox + 25},{oy + 20}^BER,60,Y,N^FD{barcode}^FS")
        else:
            zpl.append(f"^FO{ox + 25},{oy + 20}^BY2^BCR,60,Y,N,N^FD{barcode}^FS")

        div_y = oy + int(w_dots * 0.39)
        zpl.extend([
            f"^FO{ox + 15},{div_y}^GB85,60,2^FS",
            f"^FO{ox + 50},{div_y + 10}^A0R,17,15^FDSatis^FS",
            f"^FO{ox + 20},{div_y + 10}^A0R,17,15^FDFiyati^FS",
        ])

        price_y = oy + int(w_dots * 0.50)
        zpl.append(f"^FO{ox + 8},{price_y}^A0R,94,76^FD{price}^FS")

        if qty > 1:
            zpl.append(f"^PQ{qty},0,1,Y")

        zpl.append("^XZ\r\n")
        return "\r\n".join(zpl)

    else:
        # 0 DERECE DÜZ MOD
        zpl = [
            "^XA",
            "^CI28",
            "~SD22",
            "^MNY",
            "^MMT",
            f"^PW{w_dots}",
            f"^LL{h_dots}",
            "^LH0,0",
        ]

        if t2:
            zpl.extend([
                f"^FO{ox + 20},{oy + 15}^A0N,28,24^FD{t1}^FS",
                f"^FO{ox + 20},{oy + 48}^A0N,24,20^FD{t2}^FS",
            ])
        else:
            zpl.append(f"^FO{ox + 20},{oy + 25}^A0N,32,28^FD{t1}^FS")

        line1_y = oy + int(h_dots * 0.32)
        zpl.append(f"^FO{ox + 10},{line1_y}^GB{w_dots - 20},2,2^FS")

        zpl.append(f"^FO{ox + 20},{line1_y + 15}^A0N,32,28^FD{brand}^FS")

        legal_x = ox + int(w_dots * 0.36)
        zpl.extend([
            f"^FO{legal_x},{line1_y + 10}^A0N,16,14^FDUretim Yeri: {origin}^FS",
            f"^FO{legal_x},{line1_y + 30}^A0N,15,13^FDFiyatlarimiza Kdv Dahildir.^FS",
            f"^FO{legal_x},{line1_y + 50}^A0N,15,13^FDFiyat Degistirme Tarihi: {date}^FS",
        ])

        line2_y = oy + int(h_dots * 0.62)
        zpl.append(f"^FO{ox + 10},{line2_y}^GB{w_dots - 20},2,2^FS")

        if len(barcode) == 13 and barcode.isdigit():
            zpl.append(f"^FO{ox + 35},{line2_y + 15}^BEN,52,Y,N^FD{barcode}^FS")
        else:
            zpl.append(f"^FO{ox + 35},{line2_y + 15}^BY2^BCN,52,Y,N,N^FD{barcode}^FS")

        div_x = ox + int(w_dots * 0.42)
        zpl.extend([
            f"^FO{div_x},{line2_y + 10}^GB65,{int(h_dots * 0.32)},2^FS",
            f"^FO{div_x + 8},{line2_y + 20}^A0N,16,14^FDSatis^FS",
            f"^FO{div_x + 8},{line2_y + 45}^A0N,16,14^FDFiyati^FS",
        ])

        price_x = ox + int(w_dots * 0.55)
        zpl.append(f"^FO{price_x},{line2_y + 16}^A0N,92,74^FD{price}^FS")

        if qty > 1:
            zpl.append(f"^PQ{qty},0,1,Y")

        zpl.append("^XZ\r\n")
        return "\r\n".join(zpl)
