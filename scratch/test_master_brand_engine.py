import json
import re
from collections import Counter
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open("data/products.json", "r", encoding="utf-8") as f:
    products = json.load(f)

# Master Brand Rules Hierarchy (Order matters: more specific rules first)
MASTER_BRAND_PATTERNS = [
    # 1. ÜLKER BİZİM (Specific composite brand requested by user)
    (r'\b(BIZIM|BİZİM)\s+(YAG|YAĞ|CORBA|ÇORBA|KETCAP|KETÇAP|MAYONEZ|UN|MAKARNA|BAKLIYAT|BAKLİYAT|MUTFAK|BULGUR|PIRINC|PİRİNÇ|SEHRIYE|ŞEHRİYE|HARC|HARÇ|MARGARIN|MARGARİN)\b', 'ÜLKER BİZİM'),
    (r'\b(ULKER|ÜLKER|BIZIM|BİZİM)\s+MUTFAK\b', 'ÜLKER BİZİM'),
    (r'\b(BIZIM|BİZİM)\b', 'ÜLKER BİZİM'),  # Bizim standalone products belong to Ülker Bizim

    # 2. ÜLKER (Main brand & sub-brands)
    (r'\b(ULKER|ÜLKER|ULK\b|BYULK|BAYULK|HALLEY|COKOPRENS|ÇOKOPRENS|HANIMELLER|DIDO|DİDO|ALBENI|ALBENİ|BISKREM|BİSKREM|PROBIS|PROBİS|RONDO|RONDÒ|IKLIM|İKLİM|PIKO|PİKO|COKOKREM|ÇOKOKREM|METRO|LAVIVA|LAVİVA|COCO\s*STAR|DANKEK|KAT\s*KAT|DOKUZLU|ALTINBASAK|ALTINBAŞAK|KREMALI|KREMALİ|CIZI|ÇİZİ|CARAMIO|KRISPI|KRİSPİ|TAC\s*KRAKER|TAÇ\s*KRAKER|CAFE\s*CROWN|ONE\s*O\s*ONE|ONEO|COCOSTAR|YUPPY|CANPARE|BENIMO|BENİMO|KREMINI|KREMİNİ|OLALA|O\s*LALA|DOKUZLU|NAPOLITEN|NAPOLİTEN|ÇOKOMEL|COKOMEL)\b', 'ÜLKER'),

    # 3. ETİ (Main brand & sub-brands with negative exclusions for real meat/corn)
    (r'\b(ETI|ETİ|CRAX|GONG|HOSBES|HOŞBEŞ|BURCAK|BURÇAK|KARAM|BROWNI|BROWNİ|PUF|POPCORN|KOMBO|TUTKU|TOPKEK|BALIK\s*KRAKER|ADIMO|ADİMO|DURAK|PASTAMIA|PASTAMİA|CANGA|WANTED|PETIBOR|PETİBÖR|SULTANI|SULTANİ|MAXIMUS|MAXİMUS|CIN\s*BISKUVI|CİN\s*BİSKÜVİ|CİN\s*PORTAKAL|CİN\s*CILEK|CİN\s*ÇİLEK|ETİ\s*CİN|ETİ\s*PUF|ETİ\s*FORM|ETİ\s*GONG|ETİ\s*CRAX|ETİ\s*BURÇAK|ETİ\s*KARAM|ETİ\s*BROWNİ|ETİ\s*TUTKU|ETİ\s*MAXİ|ETİ\s*CANGA|ETİ\s*DURAK)\b', 'ETİ'),

    # 4. ŞÖLEN
    (r'\b(SOLEN|ŞÖLEN|BISKOLATA|BİSKOLATA|LUPPO|OZMO|NUTYMAX|BOOMBASTIC|MILANGO|TUAL|OCTOPUS|PAPITA|PAPİTA|CHOCODANS|CHOCDAN)\b', 'ŞÖLEN'),

    # 5. NESTLE
    (r'\b(NESTLE|NESTLÉ|NESCAFE|NESCAFÉ|NESQUIK|NESQUİK|DAMAK|CRUNCH|NESFIT|NESFİT|CHOKELLA|MAGGI|MAGGİ|KIT\s*KAT|KİT\s*KAT|1927)\b', 'NESTLE'),

    # 6. TORKU
    (r'\b(TORKU|BANADA|MINIKI|MİNİKİ|PRATIKO|PRATİKO|NO\s*ON|FREMA|TAM\s*RUSEYMLI|TAM\s*RUŞEYMLİ)\b', 'TORKU'),

    # 7. SÜTAŞ
    (r'\b(SUTAS|SÜTAŞ|BUYUMIX|BÜYÜMİX|YOVITA|YOVİTA)\b', 'SÜTAŞ'),

    # 8. PINAR
    (r'\b(PINAR|KIDO|KİDO|AC\s*BITIR|AÇ\s*BİTİR|DOYUM)\b', 'PINAR'),

    # 9. İÇİM
    (r'\b(ICIM|İÇİM|İCİM|ICİM)\b', 'İÇİM'),

    # 10. DOĞUŞ
    (r'\b(DOGUS|DOĞUŞ)\b', 'DOĞUŞ'),

    # 11. ÇAYKUR
    (r'\b(CAYKUR|ÇAYKUR|DIDI|DİDİ|RIZE\s*TURIST|RİZE\s*TURİST|TIRYAKI|TİRYAKİ|KAMELYA|ALTINBAS|ALTINBAŞ)\b', 'ÇAYKUR'),

    # 12. LİPTON
    (r'\b(LIPTON|LİPTON|YELLOW\s*LABEL|EARL\s*GREY)\b', 'LİPTON'),

    # 13. ALGİDA
    (r'\b(ALGIDA|ALGİDA|AIGIDA|AİGİDA|MAGNUM|CORNETTO|MARAS\s*USULU|MARAŞ\s*USULÜ|TWISTER|CARTE\s*D\'OR|FRIGOLA|FRİGOLA|NOGGER|VIENNETTA|VIENETTA|MAX\s*DONDURMA)\b', 'ALGİDA'),

    # 14. GOLF
    (r'\b(GOLF|ROKO|BRAVO)\b', 'GOLF'),

    # 15. COCA-COLA
    (r'\b(COCA\s*COLA|COCA-COLA|COKE|FANTA|SPRITE|SCHWEPPES|CAPPY|FUSE\s*TEA|FUSTEA|BURN|MONSTER\s*ENERGY|POWERADE|DAMLA\s*SU|DAMLA\s*MINERA)\b', 'COCA-COLA'),

    # 16. PEPSİ
    (r'\b(PEPSI|PEPSİ|YEDIGUN|YEDİGÜN|FRUKO|ROCKSTAR)\b', 'PEPSİ'),

    # 17. DORİTOS / LAYS / RUFFLES / CHEETOS / ÇEREZZA (Frito-Lay)
    (r'\b(DORITOS|DORİTOS)\b', 'DORİTOS'),
    (r'\b(LAYS|LAY\'S)\b', 'LAYS'),
    (r'\b(RUFFLES)\b', 'RUFFLES'),
    (r'\b(CHEETOS)\b', 'CHEETOS'),
    (r'\b(CEREZZA|ÇEREZZA)\b', 'ÇEREZZA'),
    (r'\b(PATOS)\b', 'PATOS'),
    (r'\b(CIPSO|CİPSO)\b', 'CİPSO'),
    (r'\b(PRINGLES|PRİNGLES)\b', 'PRİNGLES'),

    # 18. TADIM / PEYMAN
    (r'\b(TADIM)\b', 'TADIM'),
    (r'\b(PEYMAN|DORLEO|CITLIYO|ÇİTLİYO|BAHCEDEN|BAHÇEDEN)\b', 'PEYMAN'),

    # 19. HARİBO / BEBETO / JELİBON
    (r'\b(HARIBO|HARİBO|CHAMALLOWS|STAMIX)\b', 'HARİBO'),
    (r'\b(BEBETO|BEBETOMEYVE)\b', 'BEBETO'),
    (r'\b(JELIBON|JELİBON|TOPITOP|TOPİTOP|MISSBON|MİSSBON|OLIPS|OLİPS|TOFITA|TOFİTA)\b', 'KENT'),

    # 20. VİVİDENT / MENTOS / FALIM
    (r'\b(VIVIDENT|VİVİDENT|BIG\s*BABOL|BİGBABOL|CENTER\s*FRESH|BROOKLYN)\b', 'VİVİDENT'),
    (r'\b(MENTOS|MEMTOS)\b', 'MENTOS'),
    (r'\b(FALIM)\b', 'FALIM'),

    # 21. SEYİDOĞLU / KOSKA / BALPARMAK / ANAVARZA
    (r'\b(SEYIDOGLU|SEYİDOĞLU)\b', 'SEYİDOĞLU'),
    (r'\b(KOSKA)\b', 'KOSKA'),
    (r'\b(BALPARMAK)\b', 'BALPARMAK'),
    (r'\b(ANAVARZA)\b', 'ANAVARZA'),
    (r'\b(NUTELLA)\b', 'NUTELLA'),

    # 22. UNO
    (r'\b(UNO)\b', 'UNO'),

    # 23. TAT / TUKAŞ / BURCU / ÖNCÜ
    (r'\b(TAT|TAT\s*KETCAP|TAT\s*MAYONEZ|TAT\s*SALCA)\b', 'TAT'),
    (r'\b(TUKAS|TUKAŞ)\b', 'TUKAŞ'),
    (r'\b(BURCU)\b', 'BURCU'),
    (r'\b(ONCU|ÖNCÜ)\b', 'ÖNCÜ'),
    (r'\b(DARDANEL)\b', 'DARDANEL'),

    # 24. KOMİLİ / YUDUM / ORKİDE / KRİSTAL / BİRYAĞ
    (r'\b(KOMILI|KOMİLİ)\b', 'KOMİLİ'),
    (r'\b(YUDUM)\b', 'YUDUM'),
    (r'\b(ORKIDE|ORKİDE)\b', 'ORKİDE'),
    (r'\b(KRISTAL|KRİSTAL)\b', 'KRİSTAL'),
    (r'\b(BIRYAG|BİRYAĞ)\b', 'BİRYAĞ'),

    # 25. MAKARNA (FİLİZ / BARİLLA / ARBELLA / NUH'UN ANKARA / PASTAVİLLA)
    (r'\b(FILIZ|FİLİZ)\b', 'FİLİZ'),
    (r'\b(BARILLA|BARİLLA)\b', 'BARİLLA'),
    (r'\b(ARBELLA)\b', 'ARBELLA'),
    (r'\b(NUH\'UN\s*ANKARA|NUHUN\s*ANKARA|ANKARA\s*MAKARNA)\b', 'NUH\'UN ANKARA'),
    (r'\b(PASTAVILLA|PASTAVİLLA)\b', 'PASTAVİLLA'),

    # 26. DR. OETKER / PAKMAYA / KENT BORİNGER
    (r'\b(DR\.?\s*OETKER|DROETKER)\b', 'DR. OETKER'),
    (r'\b(PAKMAYA)\b', 'PAKMAYA'),
    (r'\b(KENT\s*BORINGER|KENT\s*BORİNGER)\b', 'KENT BORİNGER'),

    # 27. BAKLİYAT (DURU / REİS / YAYLA)
    (r'\b(DURU\s+BULGUR|DURU\s+BAKLIYAT|DURU\s+PIRINC|DURU\s+MERCIMEK)\b', 'DURU BAKLİYAT'),
    (r'\b(REIS|REİS)\b', 'REİS'),
    (r'\b(YAYLA)\b', 'YAYLA'),
    (r'\b(SOKE|SÖKE)\b', 'SÖKE'),
    (r'\b(SINANGIL|SİNANGİL)\b', 'SİNANGİL'),

    # 28. DONDURULMUŞ (SUPERFRESH / FEAST)
    (r'\b(SUPERFRESH|SÜPERFRESH|SFRESH)\b', 'SUPERFRESH'),
    (r'\b(FEAST)\b', 'FEAST'),

    # 29. ET & TAVUK (BANVİT / ŞENPİLİÇ / ERPİLİÇ / BEYPİLİÇ / GEDİK / MARET / NAMET / DANET / ŞAHİN / AYTAÇ / POLONEZ / BEŞLER / CUMHURİYET)
    (r'\b(BANVIT|BANVİT)\b', 'BANVİT'),
    (r'\b(SENPILIC|ŞENPİLİÇ)\b', 'ŞENPİLİÇ'),
    (r'\b(ERPILIC|ERPİLİÇ)\b', 'ERPİLİÇ'),
    (r'\b(BEYPILIC|BEYPİLİÇ)\b', 'BEYPİLİÇ'),
    (r'\b(GEDIK|GEDİK)\b', 'GEDİK'),
    (r'\b(MARET)\b', 'MARET'),
    (r'\b(NAMET)\b', 'NAMET'),
    (r'\b(DANET)\b', 'DANET'),
    (r'\b(SAHIN|ŞAHİN)\b', 'ŞAHİN'),
    (r'\b(AYTAC|AYTAÇ)\b', 'AYTAÇ'),
    (r'\b(POLONEZ)\b', 'POLONEZ'),
    (r'\b(BESLER|BEŞLER)\b', 'BEŞLER'),
    (r'\b(CUMHURIYET|CUMHURİYET)\b', 'CUMHURİYET'),

    # 30. SÜT & PEYNİR (ALTINKILIÇ / EKİCİ / TAHSİLDAROĞLU / MURATBEY / CİHAN / YÖRÜKOĞLU / SEK / DANONE)
    (r'\b(ALTINKILIC|ALTINKILIÇ)\b', 'ALTINKILIÇ'),
    (r'\b(EKICI|EKİCİ)\b', 'EKİCİ'),
    (r'\b(TAHSILDAROGLU|TAHSİLDAROĞLU)\b', 'TAHSİLDAROĞLU'),
    (r'\b(MURATBEY)\b', 'MURATBEY'),
    (r'\b(YORUKOGLU|YÖRÜKOĞLU)\b', 'YÖRÜKOĞLU'),
    (r'\b(SEK)\b', 'SEK'),
    (r'\b(DANONE|ACTİVİA|ACTIVIA|DANINO|DANİNO)\b', 'DANONE'),

    # 31. SU & MADEN SUYU (BEYPAZARI / KIZILAY / AVŞAR / KINIK / SARIKIZ / SIRMA / ERİKLİ / HAYAT / FUSKA / ELMACIK / SAKA / BUZDAĞI / MUNZUR / CEYSU / HAMİDİYE / ABANT / ULUDAĞ)
    (r'\b(BEYPAZARI|BEYPASARI)\b', 'BEYPAZARI'),
    (r'\b(KIZILAY)\b', 'KIZILAY'),
    (r'\b(AVSAR|AVŞAR|AVŞARYABAN)\b', 'AVŞAR'),
    (r'\b(KINIK)\b', 'KINIK'),
    (r'\b(SARIKIZ)\b', 'SARIKIZ'),
    (r'\b(SIRMA)\b', 'SIRMA'),
    (r'\b(ERIKLI|ERİKLİ)\b', 'ERİKLİ'),
    (r'\b(HAYAT\s*SU|HAYAT)\b', 'HAYAT'),
    (r'\b(FUSKA)\b', 'FUSKA'),
    (r'\b(ELMACIK|AOCELMACIK)\b', 'ELMACIK'),
    (r'\b(SAKA\s*SU|SAKA)\b', 'SAKA'),
    (r'\b(BUZDAGI|BUZDAĞI)\b', 'BUZDAĞI'),
    (r'\b(MUNZUR)\b', 'MUNZUR'),
    (r'\b(CEYSU)\b', 'CEYSU'),
    (r'\b(HAMIDIYE|HAMİDİYE)\b', 'HAMİDİYE'),
    (r'\b(ABANT\s*SU|ABANT)\b', 'ABANT'),
    (r'\b(ULUDAG|ULUDAĞ)\b', 'ULUDAĞ'),

    # 32. TEMİZLİK & DETERJAN (FAİRY / PRİL / FİNİSH / BİNGO / ALO / ARİEL / OMO / PERSİL / TURSİL / PERWOLL / YUMOŞ / VİKİNG / PORÇÖZ / DOMESTOS / CİF / ACE / ASPEROX / MARC / ERNET)
    (r'\b(FAIRY|FAİRY)\b', 'FAİRY'),
    (r'\b(PRIL|PRİL)\b', 'PRİL'),
    (r'\b(FINISH|FİNİSH|CALGON)\b', 'FİNİSH'),
    (r'\b(BINGO|BİNGO)\b', 'BİNGO'),
    (r'\b(ALO)\b', 'ALO'),
    (r'\b(ARIEL|ARİEL)\b', 'ARİEL'),
    (r'\b(OMO)\b', 'OMO'),
    (r'\b(PERSIL|PERSİL)\b', 'PERSİL'),
    (r'\b(TURSIL|TURSİL)\b', 'TURSİL'),
    (r'\b(PERWOLL)\b', 'PERWOLL'),
    (r'\b(YUMOS|YUMOŞ)\b', 'YUMOŞ'),
    (r'\b(VIKING|VİKİNG)\b', 'VİKİNG'),
    (r'\b(PORCOZ|PORÇÖZ)\b', 'PORÇÖZ'),
    (r'\b(DOMESTOS)\b', 'DOMESTOS'),
    (r'\b(CIF|CİF)\b', 'CİF'),
    (r'\b(ACE)\b', 'ACE'),
    (r'\b(ASPEROX)\b', 'ASPEROX'),
    (r'\b(MARC)\b', 'MARC'),
    (r'\b(ERNET)\b', 'ERNET'),
    (r'\b(KOROPLAST)\b', 'KOROPLAST'),
    (r'\b(PAREX)\b', 'PAREX'),
    (r'\b(VILEDA|VİLEDA)\b', 'VİLEDA'),
    (r'\b(COOK)\b', 'COOK'),

    # 33. KAĞIT & HİJYEN (SELPAK / SOLO / PAPİA / FAMİLİA / MAYLO / SOFİA / KOMİLİ KONFOR / MÜJDE)
    (r'\b(SELPAK)\b', 'SELPAK'),
    (r'\b(SOLO)\b', 'SOLO'),
    (r'\b(PAPIA|PAPİA)\b', 'PAPİA'),
    (r'\b(FAMILIA|FAMİLİA)\b', 'FAMİLİA'),
    (r'\b(MAYLO)\b', 'MAYLO'),
    (r'\b(SOFIA|SOFİA)\b', 'SOFİA'),
    (r'\b(MUJDE|MÜJDE)\b', 'MÜJDE'),

    # 34. BEBEK & KADIN HİJYEN (PRİMA / MOLFİX / CANBEBE / SLEEPY / BABY TURCO / DALİN / UNİ BABY / ORKİD / KOTEX / MOLPED)
    (r'\b(PRIMA|PRİMA)\b', 'PRİMA'),
    (r'\b(MOLFIX|MOLFİX)\b', 'MOLFİX'),
    (r'\b(CANBEBE)\b', 'CANBEBE'),
    (r'\b(SLEEPY)\b', 'SLEEPY'),
    (r'\b(BABY\s*TURCO|BABYTURCO)\b', 'BABY TURCO'),
    (r'\b(DALIN|DALİN)\b', 'DALİN'),
    (r'\b(UNI\s*BABY|UNIBABY|UNI|UNİ)\b', 'UNİ BABY'),
    (r'\b(ORKID|ORKİD)\b', 'ORKİD'),
    (r'\b(KOTEX)\b', 'KOTEX'),
    (r'\b(MOLPED)\b', 'MOLPED'),

    # 35. AĞIZ & DİŞ (COLGATE / SİGNAL / SENSODYNE / PARODONTAX / İPANA / ORAL-B / LİSTERİNE / DİFAŞ / BANAT)
    (r'\b(COLGATE)\b', 'COLGATE'),
    (r'\b(SIGNAL|SİGNAL)\b', 'SİGNAL'),
    (r'\b(SENSODYNE)\b', 'SENSODYNE'),
    (r'\b(PARODONTAX)\b', 'PARODONTAX'),
    (r'\b(IPANA|İPANA)\b', 'İPANA'),
    (r'\b(ORAL\s*B|ORAL-B)\b', 'ORAL-B'),
    (r'\b(LISTERINE|LİSTERİNE)\b', 'LİSTERİNE'),
    (r'\b(DIFAS|DİFAŞ)\b', 'DİFAŞ'),
    (r'\b(BANAT)\b', 'BANAT'),

    # 36. KİŞİSEL BAKIM & ŞAMPUAN (GİLLETTE / DERBY / PERMA SHARP / BIC / ARKO / NİVEA / AXE / REXONA / DOVE / BRUT / BLENDAX / ELİDOR / PANTENE / HEAD & SHOULDERS / CLEAR / GLİSS / ELSEVE / BİOBLAS / BİOXCİN / HOBBY / İPEK / DURU / HACI ŞAKİR / DALAN / FONEX / NEVATON / AGİSS)
    (r'\b(GILLETTE|GİLLETTE|BLUE\s*3|BLUE\s*2|MACH\s*3|FUSION)\b', 'GİLLETTE'),
    (r'\b(DERBY)\b', 'DERBY'),
    (r'\b(PERMA\s*SHARP|PERMASHARP)\b', 'PERMA SHARP'),
    (r'\b(BIC|BİC)\b', 'BIC'),
    (r'\b(ARKO|ARKO\s*MEN|ARKO\s*NEM)\b', 'ARKO'),
    (r'\b(NIVEA|NİVEA|NIVEA\s*MEN)\b', 'NİVEA'),
    (r'\b(AXE)\b', 'AXE'),
    (r'\b(REXONA)\b', 'REXONA'),
    (r'\b(DOVE)\b', 'DOVE'),
    (r'\b(BRUT)\b', 'BRUT'),
    (r'\b(BLENDAX)\b', 'BLENDAX'),
    (r'\b(ELIDOR|ELİDOR)\b', 'ELİDOR'),
    (r'\b(PANTENE)\b', 'PANTENE'),
    (r'\b(HEAD\s*&\s*SHOULDERS|HEAD\s*AND\s*SHOULDERS|HEAD)\b', 'HEAD & SHOULDERS'),
    (r'\b(CLEAR)\b', 'CLEAR'),
    (r'\b(GLISS|GLİSS)\b', 'GLİSS'),
    (r'\b(ELSEVE)\b', 'ELSEVE'),
    (r'\b(BIOBLAS|BİOBLAS)\b', 'BİOBLAS'),
    (r'\b(BIOXCIN|BİOXCİN)\b', 'BİOXCİN'),
    (r'\b(HOBBY)\b', 'HOBBY'),
    (r'\b(IPEK|İPEK)\b', 'İPEK'),
    (r'\b(HACI\s*SAKIR|HACI\s*ŞAKİR|HACISAKIR|HACIŞAKİR)\b', 'HACI ŞAKİR'),
    (r'\b(DALAN)\b', 'DALAN'),
    (r'\b(DURU|DURU\s*SABUN|DURU\s*SAMPUAN)\b', 'DURU'),
    (r'\b(FONEX)\b', 'FONEX'),
    (r'\b(NEVATON)\b', 'NEVATON'),
    (r'\b(AGISS|AGİSS)\b', 'AGİSS'),

    # 37. KAHVE / SICAK İÇECEK
    (r'\b(KAHVE\s*DUNYASI|KAHVE\s*DÜNYASI)\b', 'KAHVE DÜNYASI'),
    (r'\b(MEHMET\s*EFENDI|MEHMET\s*EFENDİ|KURUKAHVECI|KURUKAHVECİ)\b', 'MEHMET EFENDİ'),
    (r'\b(JACOBS|MONARCH)\b', 'JACOBS'),
    (r'\b(STARBUCKS)\b', 'STARBUCKS'),
    (r'\b(TCHIBO)\b', 'TCHIBO'),

    # 38. PİL & AYDINLATMA & KIRTASİYE
    (r'\b(DURACELL)\b', 'DURACELL'),
    (r'\b(PANASONIC|PANASONİC)\b', 'PANASONİC'),
    (r'\b(VARTA)\b', 'VARTA'),
    (r'\b(TOSHIBA|TOSHİBA)\b', 'TOSHİBA'),
    (r'\b(GP|GP\s*BATTERY)\b', 'GP'),
    (r'\b(PHILIPS|PHİLİPS)\b', 'PHILIPS'),
    (r'\b(FABER\s*CASTELL|FABER-CASTELL)\b', 'FABER-CASTELL'),
    (r'\b(ADEL)\b', 'ADEL'),
    (r'\b(GIPTA)\b', 'GIPTA'),
    (r'\b(PRITT|PRİTT)\b', 'PRİTT'),
    (r'\b(UHU)\b', 'UHU'),
    (r'\b(404)\b', '404'),
    (r'\b(BALLY)\b', 'BALLY'),
    (r'\b(PAPILLON|PAPİLİON)\b', 'PAPİLİON'),
    (r'\b(RAID|RAİD)\b', 'RAİD'),
    (r'\b(OFF)\b', 'OFF'),
    (r'\b(DETAN)\b', 'DETAN'),
    (r'\b(SINKOF|SİNKOF)\b', 'SİNKOF'),
    (r'\b(ELSABOND|502\s*YAPISTIRICI)\b', 'ELSABOND'),
    (r'\b(VIPER)\b', 'VIPER'),
    (r'\b(WHISKAS|WHİSKAS)\b', 'WHİSKAS'),
    (r'\b(FELIX|FELİX)\b', 'FELİX'),
    (r'\b(PEDIGREE|PEDİGREE)\b', 'PEDİGREE'),
    (r'\b(BULDAK)\b', 'BULDAK'),
    (r'\b(INDOMIE|İNDOMİE)\b', 'İNDOMİE'),
    (r'\b(ZUBER|ZÜBER)\b', 'ZÜBER'),
]

# Compiled Regex List
COMPILED_RULES = [(re.compile(pat, re.IGNORECASE), brand) for pat, brand in MASTER_BRAND_PATTERNS]

def detect_master_brand(title, barcode=""):
    raw_title = (title or "").strip()
    clean_t = raw_title.upper().replace('İ', 'I').replace('Ğ', 'G').replace('Ü', 'U').replace('Ş', 'S').replace('Ö', 'O').replace('Ç', 'C')
    
    # Negative exclusion check for ETİ (e.g. kuzu eti, dana eti, sığır eti, diş eti)
    is_meat_or_gum = bool(re.search(r'\b(KUZU|DANA|SIGIR|SIĞIR|TAVUK|DIS|DİŞ|CIN\s*MISIR|CİN\s*MISIR)\s+ETI\b', raw_title, re.IGNORECASE))
    
    for pat, brand in COMPILED_RULES:
        if brand == 'ETİ' and is_meat_or_gum:
            continue
        if pat.search(raw_title) or pat.search(clean_t):
            return brand

    # Known secondary cleanup: If the first word looks like a genuine brand (uppercase, not in blacklisted generic nouns)
    words = raw_title.split()
    if words:
        first_word = words[0].strip().upper()
        # Filter out numbers, floats, symbols, short noise, and generic nouns
        from test_clean_master_brands import NON_BRAND_WORDS
        if (not re.match(r'^[\d\.\,\'\-\s]+$', first_word) and 
            len(first_word) >= 3 and 
            first_word not in NON_BRAND_WORDS and
            not first_word.startswith('0') and
            not first_word.startswith('477') and
            not first_word.endswith('GR') and
            not first_word.endswith('ML') and
            not first_word.endswith('KG') and
            not first_word.endswith('LT')):
            return first_word

    return 'DİĞER'

# Run on all products
classified = []
new_brand_counts = Counter()

for p in products:
    title = p.get("title", "")
    barcode = p.get("barcode", "")
    new_b = detect_master_brand(title, barcode)
    classified.append((barcode, title, new_b))
    new_brand_counts[new_b] += 1

print(f"\n--- YENİ MASTER MARKA DAĞILIMI (TOP 40) ---")
for b, c in new_brand_counts.most_common(40):
    print(f"{b}: {c} ürün")

print(f"\nToplam Master Marka Sayısı: {len(new_brand_counts)} (Eski: 856 idi!)")

# Check for any garbage brands
garbage_found = [b for b in new_brand_counts if re.match(r'^[\d\.\,\'\-\s]+$', b) or len(b) <= 2]
print(f"\nKalan Çöp / Rakam Marka Sayısı: {len(garbage_found)} -> {garbage_found}")
