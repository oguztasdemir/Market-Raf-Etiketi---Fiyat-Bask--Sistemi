"""
Termal Etiket Kod ve Grafik Üretim Motoru (ZPL II)
Görsel 2'deki orijinal market raf etiketi ile %100 birebir kalibrasyonlu ZPL motoru.
"""

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

def generate_market_shelf_zpl(data, orientation="POR", x_offset=0, y_offset=0, width_mm=76, height_mm=40, dpi=203, copies=1):
    """
    Görsel 2'deki market raf etiketine %100 uyan ZPL kodunu üretir.
    
    Yönlendirme (Orientation):
    - 'POR' (Varsayılan): 90 Derece Yatay Baskı. Dar rulo şeridinden çıkarken etiket yatay ve boydan boya okunur.
    - 'PON': 0 Derece Düz Baskı. Geniş rulo için.
    """
    dpmm = 8 if dpi == 203 else 12
    qty = max(1, int(copies))
    
    # width_mm = 76mm (Yatay boy), height_mm = 40mm (Dikey en)
    w_dots = int(width_mm * dpmm) # ~608 dot
    h_dots = int(height_mm * dpmm) # ~320 dot

    t1 = clean_tr(data.get('title1', 'ULK 398-6 PIKO PORTAKAL')).strip().upper()
    t2 = clean_tr(data.get('title2', 'PIR PAT KAP')).strip().upper()
    brand = clean_tr(data.get('brand', 'YARENLER')).strip().upper()
    origin = clean_tr(data.get('origin', 'TURKIYE')).strip().upper()
    date = clean_tr(data.get('date', '14 May 2025')).strip()
    unit_price = clean_tr(data.get('unit_price', '250.00 TL/Kg')).strip()
    barcode = str(data.get('barcode', '8690504114925')).strip()
    price = str(data.get('price', '10,00 TL')).replace('₺', 'TL').strip()
    show_yerli = data.get('show_yerli', True)

    # Hassas Kalibrasyon Ofsetleri:
    # Y ekseni (Sol-Sağ): +100 dot (~1.25 cm)
    # X ekseni (Aşağı-Yukarı): +25 dot (~3 mm yukarı)
    oy = int(y_offset) + 100
    ox = int(x_offset) + 25

    if orientation in ["POR", "90", "YATAY", "horizontal"]:
        # =========================================================================
        # 90 DERECE YATAY BASKI MODU (Görsel 2 Raf Etiketi - Termal Rulo Uyumlu)
        # Kafa Genişliği (X Ekseni): h_dots (~320 dots)
        # Kağıt Akış Boyu (Y Ekseni): w_dots + oy (~768 dots)
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
            # 1. BÖLÜM (ÜST KATMAN): Ürün Başlıkları (Sol) & Yerli Üretim (Sağ)
            # -------------------------------------------------------------
            f"^FO{ox + 270},{oy + 20}^A0R,28,24^FD{t1}^FS",
            f"^FO{ox + 238},{oy + 20}^A0R,24,20^FD{t2}^FS",
        ]

        if show_yerli:
            # Sağ Üst: Çift Çerçeveli Yerli Üretim Kutusu
            box_x = ox + 225
            box_y = oy + w_dots - 185
            zpl.extend([
                f"^FO{box_x},{box_y}^GB85,175,2^FS",
                # Piktogram Çizgileri
                f"^FO{box_x + 50},{box_y + 8}^GB26,26,2^FS",
                f"^FO{box_x + 53},{box_y + 11}^A0R,14,12^FD[YERLI]^FS",
                f"^FO{box_x + 25},{box_y + 11}^A0R,14,12^FD[URETIM]^FS",
                # Birim Fiyat
                f"^FO{box_x + 55},{box_y + 70}^A0R,14,12^FDBirim Fiyat - Kg/Lt/Ad^FS",
                f"^FO{box_x + 25},{box_y + 80}^A0R,18,16^FD{unit_price}^FS",
            ])

        # 1. AYRAÇ ÇİZGİSİ (Yatay Boydan Boya)
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

        # 2. AYRAÇ ÇİZGİSİ (Yatay Boydan Boya)
        zpl.append(f"^FO{ox + 110},{oy + 10}^GB2,{w_dots - 20},2^FS")

        # -------------------------------------------------------------
        # 3. BÖLÜM (ALT KATMAN): EAN-13 Barkod | Satış Fiyatı | BÜYÜK FİYAT
        # -------------------------------------------------------------
        # EAN-13 Barkod (Sol Alt)
        if len(barcode) == 13 and barcode.isdigit():
            zpl.append(f"^FO{ox + 25},{oy + 20}^BER,60,Y,N^FD{barcode}^FS")
        else:
            zpl.append(f"^FO{ox + 25},{oy + 20}^BY2^BCR,60,Y,N,N^FD{barcode}^FS")

        # Satış Fiyatı Dikey Ayracı (Orta Alt)
        div_y = oy + int(w_dots * 0.39)
        zpl.extend([
            f"^FO{ox + 15},{div_y}^GB85,60,2^FS",
            f"^FO{ox + 50},{div_y + 10}^A0R,17,15^FDSatis^FS",
            f"^FO{ox + 20},{div_y + 10}^A0R,17,15^FDFiyati^FS",
        ])

        # DEV SATIŞ FİYATI (Sağ Alt - 10,00 TL)
        price_y = oy + int(w_dots * 0.50)
        zpl.append(f"^FO{ox + 8},{price_y}^A0R,94,76^FD{price}^FS")

        # Baskı Adedi
        if qty > 1:
            zpl.append(f"^PQ{qty},0,1,Y")

        zpl.append("^XZ\r\n")
        return "\r\n".join(zpl)

    else:
        # =========================================================================
        # 0 DERECE DÜZ BASKI MODU (Geniş Ağızlı Besleme)
        # =========================================================================
        zpl = [
            "^XA",
            "^CI28",
            "~SD22",
            "^MNY",
            "^MMT",
            f"^PW{w_dots}",
            f"^LL{h_dots}",
            "^LH0,0",
            
            f"^FO{ox + 20},{oy + 15}^A0N,28,24^FD{t1}^FS",
            f"^FO{ox + 20},{oy + 48}^A0N,24,20^FD{t2}^FS",
        ]

        if show_yerli:
            box_x = ox + w_dots - 215
            zpl.extend([
                f"^FO{box_x},{oy + 8}^GB200,{int(h_dots * 0.29)},2^FS",
                f"^FO{box_x + 8},{oy + 15}^GB24,24,2^FS",
                f"^FO{box_x + 36},{oy + 14}^A0N,15,13^FD[YERLI URETIM]^FS",
                f"^FO{box_x + 10},{oy + 44}^A0N,13,11^FDBirim: {unit_price}^FS",
            ])

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
