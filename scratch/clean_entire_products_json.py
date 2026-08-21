import json
import re
from collections import Counter
import sys

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, ".")

with open("data/products.json", "r", encoding="utf-8") as f:
    products = json.load(f)

print(f"Başlangıç Ürün Sayısı: {len(products)}")

# 1. Non-brand words / generic categories / adjectives / units to NEVER use as brands
NON_BRAND_SET = {
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
    'LI', 'Lİ', 'DEN', 'DAN', 'TEN', 'TAN', 'İLE', 'VE', 'VEYA', 'YA', 'DA', 'DE',
    'BILDIRCIN', 'BONCUK', 'BUZ', 'ÇAKMAK', 'CAKMAK', 'DESENLİ', 'DOĞAL', 'BUTUN', 'BÜTÜN',
    'BALONCUK', 'COTTON', 'COOL', 'ASPLAST', 'ASTRA', 'ATİPLAST', 'CROPİX', 'ÇEVRE',
    'BESTKA', 'BELENİOR', 'BENERBİSKÜVİLİ', 'DR.', 'DRAMEX', 'DOLPHİN', 'CHUN', 'CAPO',
    'CECE', 'CEDID', 'CEDİD', 'BY.ELVAN'
}

# 2. Comprehensive Master Brand Rules with Typo & Sub-brand mapping
BRAND_RULES = [
    # ÜLKER BİZİM
    ('ÜLKER BİZİM', [
        r'\b(BIZIM|BİZİM)\s+(YAG|YAĞ|CORBA|ÇORBA|KETCAP|KETÇAP|MAYONEZ|UN|MAKARNA|BAKLIYAT|BAKLİYAT|MUTFAK|BULGUR|PIRINC|PİRİNÇ|SEHRIYE|ŞEHRİYE|HARC|HARÇ|MARGARIN|MARGARİN)\b',
        r'\b(ULKER|ÜLKER)\s+(BIZIM|BİZİM)\b',
        r'\b(BIZIM|BİZİM)\b'
    ]),

    # ÜLKER
    ('ÜLKER', [
        r'\b(ULKER|ÜLKER|ULK\b|BYULK|BAYULK|HALLEY|COKOPRENS|ÇOKOPRENS|HANIMELLER|DIDO|DİDO|ALBENI|ALBENİ|BISKREM|BİSKREM|PROBIS|PROBİS|RONDO|RONDÒ|IKLIM|İKLİM|PIKO|PİKO|COKOKREM|ÇOKOKREM|METRO|LAVIVA|LAVİVA|COCO\s*STAR|COCOSTAR|COCOSTARÇOK|DANKEK|KAT\s*KAT|KATKAT|DOKUZLU|ALTINBASAK|ALTINBAŞAK|ALTIN\s*BAŞAK|KREMALI|KREMALİ|CIZI|ÇİZİ|ÇİZİVİÇ|CARAMIO|KRISPI|KRİSPİ|TAC\s*KRAKER|TAÇ\s*KRAKER|CAFE\s*CROWN|IKRAM|İKRAM|OLALA|O\s*LALA|COKOMEL|ÇOKOMEL|CANPARE|KREMINI|KREMİNİ|ALPELLA|HAYLAYF|ASLAN\s*KRAL)\b'
    ]),

    # ETİ
    ('ETİ', [
        r'\b(ETI|ETİ|CRAX|GONG|HOSBES|HOŞBEŞ|BURCAK|BURÇAK|KARAM|BROWNI|BROWNİ|PUF|POPCORN|KOMBO|TUTKU|TOPKEK|BALIK\s*KRAKER|ADIMO|ADİMO|DURAK|PASTAMIA|PASTAMİA|CANGA|WANTED|PETIBOR|PETİBÖR|SULTANI|SULTANİ|MAXIMUS|MAXİMUS|CICIBEBE|CİCİBEBE|LIFALIF|LİFALİF|BENIMO|BENİMO|CIN\s*BISKUVI|CİN\s*BİSKÜVİ|CİN\s*PORTAKAL|CİN\s*CILEK|CİN\s*ÇİLEK)\b'
    ]),

    # ŞÖLEN
    ('ŞÖLEN', [
        r'\b(SOLEN|ŞÖLEN|BISKOLATA|BİSKOLATA|BISCOLATA|BİSCOLATA|LUPPO|OZMO|NUTYMAX|BOOMBASTIC|MILANGO|TUAL|OCTOPUS|PAPITA|PAPİTA|CHOCODANS|CHOCO\s*DAN’S|AMADA|GRETA|OCTAVIA)\b'
    ]),

    # NESTLE
    ('NESTLE', [
        r'\b(NESTLE|NESTLÉ|NESCAFE|NESCAFÉ|NESQUIK|NESQUİK|DAMAK|CRUNCH|NESFIT|NESFİT|CHOKELLA|MAGGI|MAGGİ|KIT\s*KAT|KİT\s*KAT|KITKAT|1927)\b'
    ]),

    # COCA-COLA
    ('COCA-COLA', [
        r'\b(COCA\s*COLA|COCA-COLA|COKE|C638521OCA\s*COLA|FANTA|SPRITE|SCHWEPPES|CAPPY|FUSE\s*TEA|FUSTEA|DAMLA\s*SU|DAMLA\s*MINERA|POWERADE|BURN)\b'
    ]),

    # PEPSİ
    ('PEPSİ', [
        r'\b(PEPSI|PEPSİ|FRUKO|YEDIGUN|YEDİGÜN|7UP|ROCKSTAR)\b'
    ]),

    # ALGİDA
    ('ALGİDA', [
        r'\b(ALGIDA|ALGİDA|AIGIDA|AİGİDA|MAGNUM|CORNETTO|MARAS\s*USULU|MARAŞ\s*USULÜ|TWISTER|CARTE\s*D\'OR|CARTE\s*DOR|CARTE|FRIGOLA|FRİGOLA|NOGGER|VIENNETTA|MAX\s*DONDURMA)\b'
    ]),

    # SÜTAŞ / PINAR / İÇİM / TORKU / DOĞUŞ / ÇAYKUR / LİPTON
    ('SÜTAŞ', [r'\b(SUTAS|SÜTAŞ|BUYUMIX|BÜYÜMİX|YOVITA|YOVİTA|KAF\s*KEFIR)\b']),
    ('PINAR', [r'\b(PINAR|KIDO|KİDO|AC\s*BITIR|AÇ\s*BİTİR|DOYUM)\b']),
    ('İÇİM', [r'\b(ICIM|İÇİM|İCİM|ICİM|FIT\s*SUT|FİT\s*SÜT)\b']),
    ('TORKU', [r'\b(TORKU|BANADA|MINIKI|MİNİKİ|PRATIKO|PRATİKO|NO\s*ON|FREMA|RUSEYMLI|RUŞEYMLİ)\b']),
    ('DOĞUŞ', [r'\b(DOGUS|DOĞUŞ|DOĞUS)\b']),
    ('ÇAYKUR', [r'\b(CAYKUR|ÇAYKUR|DIDI|DİDİ|RIZE\s*TURIST|RİZE\s*TURİST|TIRYAKI|TİRYAKİ|KAMELYA|ALTINBAS|ALTINBAŞ)\b']),
    ('LİPTON', [r'\b(LIPTON|LİPTON|YELLOW\s*LABEL|EARL\s*GREY)\b']),

    # CİPS / FRİTO-LAY
    ('DORİTOS', [r'\b(DORITOS|DORİTOS)\b']),
    ('LAYS', [r'\b(LAYS|LAY\'S)\b']),
    ('RUFFLES', [r'\b(RUFFLES)\b']),
    ('CHEETOS', [r'\b(CHEETOS|CHEETOSKIVIR)\b']),
    ('ÇEREZZA', [r'\b(CEREZZA|ÇEREZZA|CEREZOS)\b']),
    ('PATOS', [r'\b(PATOS)\b']),
    ('CİPSO', [r'\b(CIPSO|CİPSO)\b']),
    ('PRİNGLES', [r'\b(PRINGLES|PRİNGLES)\b']),

    # KURUYEMİŞ
    ('TADIM', [r'\b(TADIM)\b']),
    ('PEYMAN', [r'\b(PEYMAN|BAHCEDEN|BAHÇEDEN|DORLEO|CITLIYO|ÇİTLİYO|NUTZZ)\b']),

    # ŞEKERLEME & SAKIZ
    ('HARİBO', [r'\b(HARIBO|HARİBO|CHAMALLOWS)\b']),
    ('BEBETO', [r'\b(BEBETO|BEBETOMEYVE)\b']),
    ('KENT', [r'\b(KENT|JELIBON|JELİBON|TOPITOP|TOPİTOP|MISSBON|MİSSBON|OLIPS|OLİPS|TOFITA|TOFİTA|ELEGAN)\b']),
    ('VİVİDENT', [r'\b(VIVIDENT|VİVİDENT|BIG\s*BABOL|BİG\s*BABOL|BİGBABOL|CENTER\s*FRESH|BROOKLYN)\b']),
    ('MENTOS', [r'\b(MENTOS|MEMTOS)\b']),
    ('FALIM', [r'\b(FALIM)\b']),

    # SALÇA & YAĞ & MAKARNA
    ('TAT', [r'\b(TAT|TAT\s*SALCA|TAT\s*KETCAP|TAT\s*MAYONEZ)\b']),
    ('TUKAŞ', [r'\b(TUKAS|TUKAŞ)\b']),
    ('BURCU', [r'\b(BURCU)\b']),
    ('ÖNCÜ', [r'\b(ONCU|ÖNCÜ)\b']),
    ('DARDANEL', [r'\b(DARDANEL|DARDENEL)\b']),
    ('KOMİLİ', [r'\b(KOMILI|KOMİLİ)\b']),
    ('YUDUM', [r'\b(YUDUM|EGEMDEN)\b']),
    ('ORKİDE', [r'\b(ORKIDE|ORKİDE)\b']),
    ('KRİSTAL', [r'\b(KRISTAL|KRİSTAL)\b']),
    ('BİRYAĞ', [r'\b(BIRYAG|BİRYAĞ)\b']),
    ('FİLİZ', [r'\b(FILIZ|FİLİZ)\b']),
    ('BARİLLA', [r'\b(BARILLA|BARİLLA)\b']),
    ('ARBELLA', [r'\b(ARBELLA)\b']),
    ('NUH\'UN ANKARA', [r'\b(NUH\'UN\s*ANKARA|NUHUN\s*ANKARA|ANKARA\s*MAKARNA|ANKARA\s*IRMIK|ANKARA\s*İRMİK)\b']),
    ('PASTAVİLLA', [r'\b(PASTAVILLA|PASTAVİLLA)\b']),
    ('DR. OETKER', [r'\b(DR\.?\s*OETKER|DROETKER)\b']),
    ('PAKMAYA', [r'\b(PAKMAYA)\b']),
    ('KENT BORİNGER', [r'\b(KENT\s*BORINGER|KENT\s*BORİNGER|BORINGER|BORİNGER)\b']),
    ('SUPERFRESH', [r'\b(SUPERFRESH|SÜPERFRESH|SFRESH)\b']),
    ('UNO', [r'\b(UNO)\b']),
    ('DİMES', [r'\b(DIMES|DİMES)\b']),
    ('ULUDAĞ', [r'\b(ULUDAG|ULUDAĞ|FRUTTI|FRUTTİ)\b']),
    ('BEYPAZARI', [r'\b(BEYPAZARI|BEYPASARI)\b']),
    ('KIZILAY', [r'\b(KIZILAY)\b']),
    ('AVŞAR', [r'\b(AVSAR|AVŞAR|AVŞARYABAN)\b']),
    ('SIRMA', [r'\b(SIRMA)\b']),
    ('ERİKLİ', [r'\b(ERIKLI|ERİKLİ)\b']),
    ('HAYAT', [r'\b(HAYAT)\b']),
    ('FUSKA', [r'\b(FUSKA)\b']),
    ('ELMACIK', [r'\b(ELMACIK|AOCELMACIK)\b']),
    ('SAKA', [r'\b(SAKA)\b']),
    ('BUZDAĞI', [r'\b(BUZDAGI|BUZDAĞI)\b']),
    ('MUNZUR', [r'\b(MUNZUR)\b']),
    ('DOĞANAY', [r'\b(DOGANAY|DOĞANAY)\b']),

    # TEMİZLİK & HİJYEN
    ('FAİRY', [r'\b(FAIRY|FAİRY)\b']),
    ('PRİL', [r'\b(PRIL|PRİL)\b']),
    ('FİNİSH', [r'\b(FINISH|FİNİSH|CALGONIT|CALGON)\b']),
    ('BİNGO', [r'\b(BINGO|BİNGO)\b']),
    ('ALO', [r'\b(ALO)\b']),
    ('ARİEL', [r'\b(ARIEL|ARİEL)\b']),
    ('OMO', [r'\b(OMO)\b']),
    ('PERSİL', [r'\b(PERSIL|PERSİL)\b']),
    ('TURSİL', [r'\b(TURSIL|TURSİL)\b']),
    ('PERWOLL', [r'\b(PERWOLL)\b']),
    ('YUMOŞ', [r'\b(YUMOS|YUMOŞ)\b']),
    ('VİKİNG', [r'\b(VIKING|VİKİNG)\b']),
    ('PORÇÖZ', [r'\b(PORCOZ|PORÇÖZ)\b']),
    ('DOMESTOS', [r'\b(DOMESTOS|DOMESTOSBEYAZ|DOMETOS|DOMESTOR)\b']),
    ('CİF', [r'\b(CIF|CİF)\b']),
    ('ACE', [r'\b(ACE)\b']),
    ('CAMSİL', [r'\b(CAMSIL|CAMSİL|CAM\s*SIL)\b']),
    ('ASPEROX', [r'\b(ASPEROX)\b']),
    ('SELPAK', [r'\b(SELPAK)\b']),
    ('SOLO', [r'\b(SOLO)\b']),
    ('PAPİA', [r'\b(PAPIA|PAPİA)\b']),
    ('FAMİLİA', [r'\b(FAMILIA|FAMİLİA)\b']),
    ('MAYLO', [r'\b(MAYLO)\b']),
    ('SOFİA', [r'\b(SOFIA|SOFİA)\b']),
    ('PRİMA', [r'\b(PRIMA|PRİMA|PAMPERS)\b']),
    ('MOLFİX', [r'\b(MOLFIX|MOLFİX)\b']),
    ('CANBEBE', [r'\b(CANBEBE|CAN\s*BEBE)\b']),
    ('SLEEPY', [r'\b(SLEEPY)\b']),
    ('DALİN', [r'\b(DALIN|DALİN)\b']),
    ('ORKİD', [r'\b(ORKID|ORKİD)\b']),
    ('KOTEX', [r'\b(KOTEX)\b']),
    ('MOLPED', [r'\b(MOLPED)\b']),
    ('COLGATE', [r'\b(COLGATE)\b']),
    ('SİGNAL', [r'\b(SIGNAL|SİGNAL)\b']),
    ('SENSODYNE', [r'\b(SENSODYNE)\b']),
    ('İPANA', [r'\b(IPANA|İPANA)\b']),
    ('ORAL-B', [r'\b(ORAL\s*B|ORAL-B)\b']),
    ('GİLLETTE', [r'\b(GILLETTE|GİLLETTE|BLUE\s*3|BLUE\s*2|MACH\s*3)\b']),
    ('DERBY', [r'\b(DERBY)\b']),
    ('ARKO', [r'\b(ARKO)\b']),
    ('NİVEA', [r'\b(NIVEA|NİVEA)\b']),
    ('AXE', [r'\b(AXE)\b']),
    ('REXONA', [r'\b(REXONA)\b']),
    ('DOVE', [r'\b(DOVE)\b']),
    ('BLENDAX', [r'\b(BLENDAX)\b']),
    ('ELİDOR', [r'\b(ELIDOR|ELİDOR)\b']),
    ('PANTENE', [r'\b(PANTENE)\b']),
    ('HEAD & SHOULDERS', [r'\b(HEAD\s*&\s*SHOULDERS|HEAD\s*AND\s*SHOULDERS|HEAD)\b']),
    ('CLEAR', [r'\b(CLEAR|CLEARMEN)\b']),
    ('HACI ŞAKİR', [r'\b(HACI\s*SAKIR|HACI\s*ŞAKİR|HACISAKIR|HACIŞAKİR)\b']),
    ('DURU', [r'\b(DURU)\b']),
    ('DURACELL', [r'\b(DURACELL)\b']),
    ('PANASONİC', [r'\b(PANASONIC|PANASONİC)\b']),
    ('PHILIPS', [r'\b(PHILIPS|PHİLİPS)\b']),
    ('RAİD', [r'\b(RAID|RAİD)\b']),
    ('BULDAK', [r'\b(BULDAK|BULDAKDOMATESLİ)\b']),
    ('İNDOMİE', [r'\b(INDOMIE|İNDOMİE)\b']),
    ('ZÜBER', [r'\b(ZUBER|ZÜBER)\b']),
    ('CHOCEUR', [r'\b(CHOCEUR|CHOCEURFEİNE)\b']),
    ('BİLLUR', [r'\b(BILLUR|BİLLUR)\b']),
    ('BİOBLAS', [r'\b(BIOBLAS|BİOBLAS)\b']),
    ('ELSABOND', [r'\b(ELSABOND|502\s*YAPISTIRICI)\b']),
    ('DEDEOĞLU', [r'\b(DEDEOGLU|DEDEOĞLU)\b']),
    ('ÖZBEY', [r'\b(OZBEY|ÖZBEY)\b']),
    ('BAĞCI', [r'\b(BAGCI|BAĞCI)\b']),
    ('MARMARABİRLİK', [r'\b(MARMARABIRLIK|MARMARABİRLİK)\b']),
    ('KOSKA', [r'\b(KOSKA)\b']),
    ('SEYİDOĞLU', [r'\b(SEYIDOGLU|SEYİDOĞLU)\b']),
    ('BALPARMAK', [r'\b(BALPARMAK)\b']),
    ('ANAVARZA', [r'\b(ANAVARZA)\b']),
    ('NUTELLA', [r'\b(NUTELLA)\b']),
    ('BANVİT', [r'\b(BANVIT|BANVİT)\b']),
    ('ŞENPİLİÇ', [r'\b(SENPILIC|ŞENPİLİÇ)\b']),
    ('ERPİLİÇ', [r'\b(ERPILIC|ERPİLİÇ|ER\s*PILIC|ER\s*PİLİÇ)\b']),
    ('BEYPİLİÇ', [r'\b(BEYPILIC|BEYPİLİÇ)\b']),
    ('GEDİK', [r'\b(GEDIK|GEDİK)\b']),
    ('MARET', [r'\b(MARET)\b']),
    ('NAMET', [r'\b(NAMET)\b']),
    ('DANET', [r'\b(DANET)\b']),
    ('ŞAHİN', [r'\b(SAHIN|ŞAHİN)\b']),
    ('AYTAÇ', [r'\b(AYTAC|AYTAÇ)\b']),
    ('POLONEZ', [r'\b(POLONEZ)\b']),
    ('BEŞLER', [r'\b(BESLER|BEŞLER)\b']),
    ('CUMHURİYET', [r'\b(CUMHURIYET|CUMHURİYET)\b']),
    ('ALTINKILIÇ', [r'\b(ALTINKILIC|ALTINKILIÇ)\b']),
    ('EKİCİ', [r'\b(EKICI|EKİCİ)\b']),
    ('TAHSİLDAROĞLU', [r'\b(TAHSILDAROGLU|TAHSİLDAROĞLU)\b']),
    ('MURATBEY', [r'\b(MURATBEY)\b']),
    ('YÖRÜKOĞLU', [r'\b(YORUKOGLU|YÖRÜKOĞLU)\b']),
    ('SEK', [r'\b(SEK)\b']),
    ('DANONE', [r'\b(DANONE|ACTIVIA|ACTİVİA|DANINO|DANİNO)\b']),
]

COMPILED_RULES = []
for brand_name, patterns in BRAND_RULES:
    for pat in patterns:
        COMPILED_RULES.append((re.compile(pat, re.IGNORECASE), brand_name))

def clean_and_normalize_product(p):
    # 1. Başlık temizliği
    raw_title = str(p.get("title") or p.get("title1") or "").strip()
    # Başlıktaki bozuk karakterleri temizle
    clean_title = re.sub(r'[\r\n\t]+', ' ', raw_title)
    clean_title = re.sub(r'\s+', ' ', clean_title).strip()
    
    # 2. Marka Tespiti
    detected_brand = None
    is_meat = bool(re.search(r'\b(KUZU|DANA|SIGIR|SIĞIR|TAVUK|DIS|DİŞ|CIN\s*MISIR|CİN\s*MISIR)\s+ETI\b', clean_title, re.IGNORECASE))
    
    for pat, b_name in COMPILED_RULES:
        if b_name == 'ETİ' and is_meat:
            continue
        if pat.search(clean_title):
            detected_brand = b_name
            break
            
    if not detected_brand:
        # İkincil kelime kontrolü
        words = clean_title.split()
        if words:
            fw = words[0].strip().upper()
            if (not re.match(r'^[\d\.\,\'\-\s]+$', fw) and 
                len(fw) >= 3 and 
                fw not in NON_BRAND_SET and
                not fw.startswith('0') and
                not fw.startswith('477') and
                not fw.endswith('GR') and
                not fw.endswith('ML') and
                not fw.endswith('KG') and
                not fw.endswith('LT')):
                detected_brand = fw

    if not detected_brand:
        detected_brand = 'DİĞER'

    # 3. Fiyat Formatı
    raw_price = str(p.get("price", "0,00 TL")).replace('₺', 'TL').strip()
    if not raw_price.endswith('TL'):
        raw_price = f"{raw_price} TL"
    
    # 4. Barkod Kontrolü
    raw_barcode = str(p.get("barcode", "")).strip()
    
    return {
        "barcode": raw_barcode,
        "title": clean_title,
        "title1": p.get("title1") or clean_title,
        "title2": p.get("title2") or "",
        "brand": detected_brand,
        "price": raw_price,
        "stock": p.get("stock", 100),
        "origin": p.get("origin", "TÜRKİYE"),
        "unit": p.get("unit", "Adet")
    }

cleaned_products = [clean_and_normalize_product(p) for p in products]

brand_counter = Counter(p["brand"] for p in cleaned_products)
print(f"\nToplam Temizlenmiş Ürün: {len(cleaned_products)}")
print(f"Toplam Marka Sayısı: {len(brand_counter)}")

print("\n--- EN ÇOK ÜRÜNÜ OLAN İLK 35 MARKA ---")
for b, c in brand_counter.most_common(35):
    print(f"  {b}: {c} ürün")

# DİĞER dışındaki tekil/şüpheli kelimeleri kontrol et
garbage_check = [b for b in brand_counter if b in NON_BRAND_SET or re.match(r'^[\d\.\,\'\-\s]+$', b)]
print(f"\nGeçersiz Marka Kalan: {len(garbage_check)} -> {garbage_check}")
