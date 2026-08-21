import json
import re
from collections import Counter
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open("data/products.json", "r", encoding="utf-8") as f:
    products = json.load(f)

print(f"Toplam Ürün: {len(products)}")

# 1. Non-brand words / generic product descriptors to NEVER use as brand names
NON_BRAND_WORDS = {
    '0.0', '0.5', '1', '2', '3', '4', '5', '6', '10', '12', '24', '30', '50', '50\'Lİ', '502',
    'AMPUL', 'ANANAS', 'ARPACIK', 'ATOM', 'BARDAK', 'POŞET', 'TABAK', 'PİL', 'DEFTER', 'KALEM',
    'PİRİNÇ', 'MERCİMEK', 'KÖFTE', 'TAVUK', 'ET', 'MEYVE', 'SEBZE', 'SU', 'SÜT', 'EKMEK',
    'SİGARA', 'CİPS', 'SODA', 'ÇAY', 'KAHVE', 'OYUNCAK', 'KİBRİT', 'ÇAKMAK', 'YUMURTA',
    'MAKARNA', 'BULGUR', 'UN', 'ŞEKER', 'TUZ', 'YAĞ', 'SIVI', 'TOZ', 'DETERJAN', 'SABUN',
    'ŞAMPUAN', 'KREM', 'PEÇETE', 'MENDİL', 'HAVLU', 'BEZ', 'ISLAK', 'DIŞ', 'DİŞ', 'MACUN',
    'FIRÇA', 'ÇORAP', 'KOLONYA', 'SİRKE', 'SALÇA', 'SOS', 'TURŞU', 'ZEYTİN', 'PEYNİR',
    'YOĞURT', 'AYRAN', 'TEREYAĞ', 'MARGARİN', 'BİSKÜVİ', 'GOFRET', 'ÇİKOLATA', 'KEK',
    'KRAKER', 'ŞEKERLEME', 'SAKIZ', 'LOKUM', 'HELVA', 'REÇEL', 'BAL', 'FINDIK', 'FISTIK',
    'CEVİZ', 'BADEM', 'ÇEKİRDEK', 'LEBLEBİ', 'MISIR', 'İTHAL', 'YERLİ', 'ÖZEL', 'EXTRA',
    'LÜKS', 'MINI', 'MAXI', 'MEGA', 'SUPER', 'JUMBO', 'EKONOMİK', 'PROMOSYON', 'HEDİYELİ',
    'DUBAİ', 'BÜTÜN', 'YARIM', 'DİLİM', 'DİLİMLİ', 'SÜZME', 'TAM', 'YAĞLI', 'YARIMYAĞLI',
    'LIGHT', 'LİGHT', 'ZERO', 'DIET', 'DİYET', 'KLASİK', 'ORİJİNAL', 'SADE', 'KAKAOLU',
    'FINDIKLI', 'FISTIKLI', 'SÜTLÜ', 'BİTTER', 'BEYAZ', 'MEYVELİ', 'ÇİLEKLİ', 'MUZLU',
    'PORTAKALLI', 'LİMONLU', 'VİŞNELİ', 'ŞEFTALİLİ', 'KAYISILI', 'ELMALI', 'ORMAN',
    'YABAN', 'MERSİNİ', 'BÖĞÜRTLENLİ', 'AHUDUDULU', 'KARAMELLİ', 'VANİLYALI', 'HİNDİSTAN',
    'CEVİZLİ', 'ANTEP', 'FISTIĞI', 'BADEMLİ', 'SUSAMLI', 'ÇÖREK', 'OTLU', 'HAŞHAŞLI',
    'PEYNİRLİ', 'ACILI', 'BAHARATLI', 'SOĞANLI', 'DOMATESLİ', 'KETÇAPLI', 'BARBEKÜ',
    'HARDALLI', 'YOĞURTLU', 'TAVUKLU', 'ETLİ', 'DÖNERLİ', 'SUCUKLU', 'SALAMLI', 'SOSİSLİ',
    'KAVURMALI', 'PASTIRMALI', 'TON', 'BALIKLI', 'HAMSİLİ', 'SOMONLU', 'LİMON', 'PORTAKAL',
    'MANDALİNA', 'GREYFURT', 'ELMA', 'ARMUT', 'MUZ', 'ÇİLEK', 'KİRAZ', 'VİŞNE', 'ŞEFTALİ',
    'KAYISI', 'ERİK', 'ÜZÜM', 'İNCİR', 'NAR', 'KARPUZ', 'KAVUN', 'KİVİ', 'AVOKADO', 'MANGO',
    'PAPAYA', 'ANANAS', 'HİNDİSTAN CEVİZİ', 'HURMA', 'BÖĞÜRTLEN', 'AHUDUDU', 'YABAN MERSİNİ',
    'FRENK ÜZÜMÜ', 'KUŞ ÜZÜMÜ', 'ÇAM FISTIĞI', 'KABAK ÇEKİRDEĞİ', 'AYÇEKİRDEĞİ', 'PATATES',
    'SOĞAN', 'SARIMSAK', 'DOMATES', 'BİBER', 'PATLICAN', 'KABAK', 'SALATALIK', 'HAVUÇ',
    'TURP', 'PANCAR', 'KEREVİZ', 'PIRASA', 'ISPANAK', 'MARUL', 'KIVIRCIK', 'ROKA', 'MAYDANOZ',
    'DEREOTU', 'NANE', 'FESLEĞEN', 'KEKİK', 'BİBERİYE', 'DEFNE', 'LAVANTA', 'ADAÇAYI',
    'IHLAMUR', 'PAPATYA', 'REZENE', 'ANASON', 'KİMYON', 'KARABİBER', 'PUL BİBER', 'KIRMIZI BİBER',
    'KÖRİ', 'ZENCEFİL', 'ZERDEÇAL', 'TARÇIN', 'KARANFİL', 'YENİBAHAR', 'KAKULE', 'MAHLEP',
    'ÇÖREKOTU', 'SUSAM', 'HAŞHAŞ', 'HARDAL', 'KİŞNİŞ', 'SUMAK', 'İSOT', 'KİMYON', 'TUZ',
    'KAYA TUZU', 'DENİZ TUZU', 'HİMALAYA TUZU', 'İYOTLU TUZ', 'İYOTSUZ TUZ', 'ŞEKER',
    'TOZ ŞEKER', 'KÜP ŞEKER', 'ESMER ŞEKER', 'PUDR ŞEKERİ', 'VANİLYA', 'KABARTMA TOZU',
    'KARBONAT', 'MAYA', 'YAŞ MAYA', 'KURU MAYA', 'INSTANT MAYA', 'NİŞASTA', 'MISIR NİŞASTASI',
    'BUĞDAY NİŞASTASI', 'PİRİNÇ UNU', 'GALETA UNU', 'İRMİK', 'BULGUR', 'PİLAVLIK BULGUR',
    'KÖFTELİK BULGUR', 'KISIRLIK BULGUR', 'SİYEZ BULGURU', 'FİRİK BULGURU', 'PİRİNÇ',
    'BALDO PİRİNÇ', 'OSMANCIK PİRİNÇ', 'YASEMİN PİRİNÇ', 'BASMATİ PİRİNÇ', 'KIRIK PİRİNÇ',
    'MERCİMEK', 'KIRMIZI MERCİMEK', 'YEŞİL MERCİMEK', 'SARI MERCİMEK', 'NOHUT', 'KASAP',
    'FASULYE', 'KURU FASULYE', 'BARBUNYA', 'BÖRÜLCE', 'BAKLA', 'BEZELYE', 'MISIR', 'KOLİ',
    'PAKET', 'ADET', 'KUTU', 'ŞİŞE', 'KAVANOZ', 'TENEKE', 'POŞETLİ', 'DÖKME', 'GRAM',
    'KİLOGRAM', 'LİTRE', 'MİLİLİTRE', 'GR', 'KG', 'LT', 'ML', 'CL', 'CC', 'AD', 'PK',
    'KL', 'KT', 'TN', 'KV', 'ŞŞ', 'PŞ', 'DK', 'LİK', 'LIK', 'LÜK', 'LUK', 'LU', 'LÜ',
    'LI', 'Lİ', 'DEN', 'DAN', 'TEN', 'TAN', 'İLE', 'VE', 'VEYA', 'YA', 'DA', 'DE'
}

print(f"Tanımlanan geçersiz marka kelimesi: {len(NON_BRAND_WORDS)}")
