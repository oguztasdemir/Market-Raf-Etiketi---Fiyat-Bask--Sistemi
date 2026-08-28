import textwrap
import datetime

MONTHS_TR = {
    1: 'Oca', 2: 'Sub', 3: 'Mar', 4: 'Nis', 5: 'May', 6: 'Haz',
    7: 'Tem', 8: 'Agu', 9: 'Eyl', 10: 'Eki', 11: 'Kas', 12: 'Ara'
}

def get_online_or_system_date():
    """Türkiye yerel saati ile güncel tarihi döner."""
    now = datetime.datetime.now()
    return f"{now.day} {MONTHS_TR.get(now.month, '')} {now.year}"

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
    """Ürün başlığını güvenli karakter sınırına göre 1 veya 2 satıra böler."""
    t1 = clean_tr(title1).strip().upper()
    t2 = clean_tr(title2).strip().upper()
    
    if t2:
        return t1[:34], t2[:34]
    
    if len(t1) <= max_chars_per_line:
        return t1, ""
        
    lines = textwrap.wrap(t1, width=max_chars_per_line)
    line1 = lines[0] if len(lines) > 0 else ""
    line2 = " ".join(lines[1:]) if len(lines) > 1 else ""
    return line1[:34], line2[:34]

def generate_market_shelf_zpl(data, orientation="POR", x_offset=0, y_offset=0, width_mm=76, height_mm=40, dpi=203, copies=1):
    """
    Özelleştirilebilir Market Raf Etiketi ZPL Motoru.
    
    data['top_right_mode'] seçenekleri:
    - 'empty'       : Sağ üst boş, tam genişlik başlık (Varsayılan)
    - 'unit_price'  : Sade Birim Fiyat Kutusu (Birim Fiyat: 250,00 TL/Kg)
    - 'weight'      : Gramaj / Miktar Rozeti ([ NET: 35 GR ])
    - 'code'        : Reyon / Ürün Kodu ([ REYON: A-04 ])
    - 'qr'          : Karekod (QR Kod)
    - 'campaign'    : Siyah Zemin Fırsat / Kampanya Rozeti
    - 'yerli'       : Resmi Yerli Üretim Logosu
    """
    dpmm = 8 if dpi == 203 else 12
    qty = max(1, int(copies))
    
    w_dots = int(width_mm * dpmm) # ~608 dot
    h_dots = int(height_mm * dpmm) # ~320 dot

    top_right_mode = data.get('top_right_mode', 'empty')
    top_right_text = clean_tr(data.get('top_right_text', '')).strip()

    # Eğer sağ üst doluysa başlık karakter limitini ayarla
    max_title_chars = 22 if top_right_mode != 'empty' else 30
    raw_t1 = data.get('title1', 'ULK 398-6 PIKO PORTAKAL')
    raw_t2 = data.get('title2', 'PIR PAT KAP')
    t1, t2 = split_title_lines(raw_t1, raw_t2, max_chars_per_line=max_title_chars)

    from backend.araclar.depolama_araclari import load_json
    from backend.ayarlar import SETTINGS_FILE
    settings = load_json(SETTINGS_FILE, {})
    default_market_brand = str(settings.get("market_name", "MARKET")).strip().upper()

    brand = clean_tr(data.get('brand') or default_market_brand).strip().upper()
    if not brand or brand in ['DIGER', 'DİĞER', 'DİGER']:
        brand = default_market_brand
    origin = clean_tr(data.get('origin', 'TURKIYE')).strip().upper()
    
    # Tarih belirleme
    custom_date = data.get('date')
    if custom_date and str(custom_date).strip():
        date = clean_tr(custom_date).strip()
    else:
        date = get_online_or_system_date()
        
    unit_price = clean_tr(data.get('unit_price', '250.00 TL/Kg')).strip()
    barcode = str(data.get('barcode', '8690504114925')).strip()
    price = str(data.get('price', '10,00 TL')).replace('₺', 'TL').strip()

    # Kalibrasyon Ofsetleri
    oy = int(y_offset) + 100
    ox = int(x_offset) + 28

    if orientation in ["POR", "90", "YATAY", "horizontal"]:
        # =========================================================================
        # 90 DERECE YATAY BASKI MODU (Termal Rulo Uyumlu)
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
        ]

        # -------------------------------------------------------------
        # 1. BÖLÜM (ÜST KATMAN): Başlıklar & Özelleştirilebilir Sağ Üst
        # -------------------------------------------------------------
        if t2:
            zpl.extend([
                f"^FO{ox + 272},{oy + 20}^A0R,28,24^FD{t1}^FS",
                f"^FO{ox + 240},{oy + 20}^A0R,25,21^FD{t2}^FS",
            ])
        else:
            zpl.append(f"^FO{ox + 252},{oy + 20}^A0R,38,34^FD{t1}^FS")

        # Sağ Üst Köşe Özelleştirmeleri
        if top_right_mode == 'unit_price':
            # Sade Birim Fiyat Kutusu
            box_x = ox + 230
            box_y = oy + w_dots - 175
            val = top_right_text or unit_price
            zpl.extend([
                f"^FO{box_x},{box_y}^GB75,165,2^FS",
                f"^FO{box_x + 48},{box_y + 10}^A0R,15,13^FDBirim Fiyat:^FS",
                f"^FO{box_x + 18},{box_y + 15}^A0R,20,18^FD{val}^FS",
            ])

        elif top_right_mode == 'weight':
            # Gramaj / Miktar Rozeti
            box_x = ox + 235
            box_y = oy + w_dots - 155
            val = top_right_text or "NET: 35 GR"
            zpl.extend([
                f"^FO{box_x},{box_y}^GB65,145,2^FS",
                f"^FO{box_x + 20},{box_y + 15}^A0R,24,20^FD{val}^FS",
            ])

        elif top_right_mode == 'code':
            # Reyon / Ürün Kodu
            box_x = ox + 235
            box_y = oy + w_dots - 155
            val = top_right_text or "REYON: A-04"
            zpl.extend([
                f"^FO{box_x},{box_y}^GB65,145,2^FS",
                f"^FO{box_x + 20},{box_y + 15}^A0R,22,18^FD{val}^FS",
            ])

        elif top_right_mode == 'qr':
            # QR Kod
            qr_data = top_right_text or barcode or "https://market.com"
            box_x = ox + 230
            box_y = oy + w_dots - 100
            zpl.append(f"^FO{box_x},{box_y}^BQN,2,3^FDQA,{qr_data}^FS")

        elif top_right_mode == 'campaign':
            # Kampanya Rozeti (Siyah Zemin)
            box_x = ox + 235
            box_y = oy + w_dots - 165
            val = top_right_text or "SUPER FIYAT"
            zpl.extend([
                f"^FO{box_x},{box_y}^GB65,155,65^FS",
                f"^FO{box_x + 18},{box_y + 12}^A0R,24,20^FR^FD{val}^FS",
            ])

        elif top_right_mode == 'yerli':
            # Resmi Yerli Üretim Logosu
            box_x = ox + 225
            box_y = oy + w_dots - 185
            zpl.extend([
                f"^FO{box_x},{box_y}^GB85,175,2^FS",
                f"^FO{box_x + 50},{box_y + 8}^GB26,26,2^FS",
                f"^FO{box_x + 53},{box_y + 11}^A0R,14,12^FD[YERLI]^FS",
                f"^FO{box_x + 25},{box_y + 11}^A0R,14,12^FD[URETIM]^FS",
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
        if len(barcode) == 13 and barcode.isdigit():
            zpl.append(f"^FO{ox + 25},{oy + 20}^BER,60,Y,N^FD{barcode}^FS")
        else:
            zpl.append(f"^FO{ox + 25},{oy + 20}^BY2^BCR,60,Y,N,N^FD{barcode}^FS")

        # Satış Fiyatı Dikey Ayracı
        div_y = oy + int(w_dots * 0.39)
        zpl.extend([
            f"^FO{ox + 15},{div_y}^GB85,60,2^FS",
            f"^FO{ox + 50},{div_y + 10}^A0R,17,15^FDSatis^FS",
            f"^FO{ox + 20},{div_y + 10}^A0R,17,15^FDFiyati^FS",
        ])

        # DEV SATIŞ FİYATI (Sağ Alt - 10,00 TL)
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
            zpl.append(f"^FO{ox + 20},{oy + 22}^A0N,38,34^FD{t1}^FS")

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
