import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('data/products.json', 'r', encoding='utf-8') as f:
    products = json.load(f)

# Master Brand Rules with Precompiled Patterns
RAW_BRAND_RULES = [
    # Gıda / Şekerleme / İçecek
    ('ŞÖLEN', ['ŞÖLEN', 'SOLEN', 'LUPPO', 'OZMO', 'BOOMBASTIC', 'BİSCOLATA', 'BISCOLATA', 'PAPİTA', 'PAPITA', 'MILANGO', 'NUTYMAX', 'GRETA', 'OCTAVIA', 'WISH', 'AMADA', 'CHOCO DAN’S'], []),
    ('NESTLE', ['NESTLE', 'NESCAFE', 'NESQUIK', 'NESGUIK', 'KITKAT', 'CRUNCH', 'DAMAK', 'NESFIT', 'NESFİT', 'LION BAR', 'CHOKELLA', 'COKO KRONCH'], []),
    ('ALGİDA', ['ALGİDA', 'ALGIDA', 'MAGNUM', 'CORNETTO', 'NOGGER', 'MAX DONDURMA', 'TWISTER', 'CARTE D\'OR', 'MARAŞ USULÜ', 'BOOM BOOM', 'CALIPPO', 'FRUTTARE'], []),
    ('TORKU', ['TORKU', 'BANADA', 'FREMA', 'NO ON', 'MINIKI', 'RUŞEYMLİ'], []),
    ('DOĞUŞ', ['DOĞUŞ', 'DOGUS', 'DOĞUŞ ÇAY', 'DOĞUŞ FORM', 'DOGUS CAY'], []),
    ('ÇAYKUR', ['ÇAYKUR', 'CAYKUR', 'DİDİ', 'DIDI', 'TİRYAKİ', 'RİZE TURİST', 'KAMELYA', 'ALTINBAŞ', 'ÇAYÇİÇEĞİ'], []),
    ('LİPTON', ['LİPTON', 'LIPTON', 'ICE TEA', 'İCE TEA', 'YELLOW LABEL', 'DOĞU KARADENİZ'], []),
    ('DOĞADAN', ['DOĞADAN', 'DOGADAN', 'BÜYÜLÜ BOHÇA', 'GİZLİ BAHÇE'], []),
    ('OFÇAY', ['OFÇAY', 'OFCAY', 'ŞERANE', 'HAZİNE'], []),
    ('SÜTAŞ', ['SÜTAŞ', 'SUTAS', 'BÜYÜMİX', 'KAF KEFİR'], []),
    ('PINAR', ['PINAR', 'KİDO', 'AÇ BİTİR'], ['PINARBAŞI']),
    ('İÇİM', ['İÇİM', 'ICIM', 'FIT SÜT'], []),
    ('EKER', ['EKER AYRAN', 'EKER SÜT', 'EKER YOĞURT', 'EKER KEFİR', 'EKER TATLI', 'EKER DONDURMA', 'EKER KAZANDİBİ', 'EKER PROFİTEROL'], ['DR. OETKER', 'DR OETKER', 'ŞEKER', 'SEKER']),
    ('SEK', ['SEK SÜT', 'SEK AYRAN', 'SEK YOĞURT', 'SEK TEREYAĞ', 'SEK KAZANDİBİ', 'SEK QUARK', 'SEK GÜNLÜK'], []),
    ('DANONE', ['DANONE', 'DANİNO', 'DANINO', 'DOKİDO', 'ACTİVİA', 'ACTIVIA'], []),
    ('SÜPERFRESH', ['SÜPERFRESH', 'SUPERFRESH'], []),
    ('DİMES', ['DİMES', 'DIMES', 'DİMES COOL', 'SIKMA PORTAKAL', 'DİMES MİX'], []),
    ('CAPPY', ['CAPPY'], []),
    ('COCA-COLA', ['COCA-COLA', 'COCA COLA', 'COKE', 'FANTA', 'SPRITE', 'SCHWEPPES', 'FUSE TEA', 'DAMLA SU', 'DAMLA MİNERA'], []),
    ('PEPSİ', ['PEPSİ', 'PEPSI', 'FRUKO', 'YEDİGÜN', 'YEDIGUN', '7UP', 'LIPTON ICE TEA', 'TROPICANA'], []),
    ('RED BULL', ['RED BULL', 'REDBULL'], []),
    ('MONSTER', ['MONSTER ENERGY', 'MONSTER'], []),
    ('BEYPAZARI', ['BEYPAZARI'], []),
    ('KIZILAY', ['KIZILAY'], []),
    ('KINIK', ['KINIK'], []),
    ('SARIKIZ', ['SARIKIZ'], []),
    ('AVŞAR', ['AVŞAR', 'AVSAR'], []),
    ('FREŞA', ['FREŞA', 'FRESA'], []),
    ('ULUDAĞ', ['ULUDAĞ', 'ULUDAG', 'FRUTTİ', 'FRUTTI'], []),
    ('SIRMA', ['SIRMA', 'SIRMAGRUP'], []),
    ('ERİKLİ', ['ERİKLİ', 'ERIKLI'], []),
    ('BUZDAĞI', ['BUZDAĞI', 'BUZDAGI'], []),
    ('HAYAT', ['HAYAT SU', 'HAYAT'], []),
    ('İNİŞDİBİ', ['İNİŞDİBİ', 'INISDIBI'], []),
    ('ÖZKAYNAK', ['ÖZKAYNAK', 'OZKAYNAK'], []),
    ('KAHVE DÜNYASI', ['KAHVE DÜNYASI', 'KAHVE DUNYASI', 'NELLO', 'TAMBOL'], []),
    ('MEHMET EFENDİ', ['MEHMET EFENDİ', 'MEHMET EFENDI', 'KURUKAHVECİ'], []),
    ('JACOBS', ['JACOBS', 'MONARCH'], []),
    ('TCHIBO', ['TCHIBO'], []),
    ('DORİTOS', ['DORİTOS', 'DORITOS'], []),
    ('LAYS', ['LAYS', 'LAY\'S'], []),
    ('RUFFLES', ['RUFFLES'], []),
    ('CHEETOS', ['CHEETOS'], []),
    ('PATOS', ['PATOS'], []),
    ('CİPSO', ['CİPSO', 'CIPSO'], []),
    ('ÇEREZZA', ['ÇEREZZA', 'CEREZZA'], []),
    ('PRİNGLES', ['PRİNGLES', 'PRINGLES'], []),
    ('MASTER', ['MASTER POTATO', 'MASTER FARM', 'MASTER NUT'], []),
    ('TADIM', ['TADIM'], []),
    ('PEYMAN', ['PEYMAN', 'BAHÇEDEN', 'ÇİTLEYİK', 'NUTZZ'], []),
    ('AYPOP', ['AYPOP', 'AY-POP'], []),
    ('HARİBO', ['HARİBO', 'HARIBO', 'CHAMALLOWS', 'GOLD BÄREN'], []),
    ('BEBETO', ['BEBETO'], []),
    ('JELİBON', ['JELİBON', 'JELIBON'], []),
    ('VİVİDENT', ['VİVİDENT', 'VIVIDENT'], []),
    ('FALIM', ['FALIM'], []),
    ('FİRST', ['FİRST', 'FIRST SAKIZ', 'FIRST 60'], []),
    ('MENTOS', ['MENTOS'], []),
    ('DR.OETKER', ['DR.OETKER', 'DR. OETKER', 'DR OETKER', 'OETKER'], []),
    ('KENT BORİNGER', ['KENT BORİNGER', 'KENT BORINGER', 'BORİNGER', 'BORINGER'], []),
    ('BİZİM', ['BİZİM', 'BIZIM', 'BİZİM YAĞ', 'BİZİM MUTFAK', 'BİZİM ÇORBA'], []),
    ('KNORR', ['KNORR'], []),
    ('CALVE', ['CALVE'], []),
    ('HEINZ', ['HEINZ'], []),
    ('TAT', ['TAT SALÇA', 'TAT KETÇAP', 'TAT MAYONEZ', 'TAT GARNİTÜR', 'TAT TURŞU', 'TAT MISIR', 'TAT BEZELYE', 'TAT FASULYE', 'TAT BARBUNYA', 'TAT NOHUT', 'TAT DOMATES', 'TAT SOS'], []),
    ('TAMEK', ['TAMEK'], []),
    ('BURCU', ['BURCU'], []),
    ('ÖNCÜ', ['ÖNCÜ', 'ONCU'], []),
    ('TUKAŞ', ['TUKAŞ', 'TUKAS'], []),
    ('KOMİLİ', ['KOMİLİ', 'KOMILI'], []),
    ('YUDUM', ['YUDUM', 'EGEMDEN', 'KIZARTMA USTASI'], []),
    ('KRİSTAL', ['KRİSTAL YAĞ', 'KRISTAL YAG', 'KRİSTAL ZEYTİNYAĞI'], []),
    ('ORUÇOĞLU', ['ORUÇOĞLU', 'ORUCOGLU'], []),
    ('KOSKA', ['KOSKA'], []),
    ('SEYİDOĞLU', ['SEYİDOĞLU', 'SEYIDOGLU', 'SEYİDOGLU', 'SEYYİDOĞLU'], []),
    ('BALPARMAK', ['BALPARMAK'], []),
    ('ANAVARZA', ['ANAVARZA'], []),
    ('BİLLUR', ['BİLLUR', 'BILLUR'], []),
    ('SALINA', ['SALİNA', 'SALINA'], []),
    ('BAĞDAT', ['BAĞDAT', 'BAGDAT'], []),
    ('ARİFOĞLU', ['ARİFOĞLU', 'ARIFOGLU'], []),
    ('KOROPLAST', ['KOROPLAST'], []),
    ('COOK', ['COOK STREÇ', 'COOK PİŞİRME', 'COOK BUZDOLABI'], []),
    ('PAREX', ['PAREX'], []),
    ('VİLEDA', ['VİLEDA', 'VILEDA'], []),
    ('FAIRY', ['FAIRY'], []),
    ('PRIL', ['PRIL', 'PRİL'], []),
    ('FINISH', ['FINISH', 'CALGONIT'], []),
    ('CALGON', ['CALGON'], []),
    ('DOMESTOS', ['DOMESTOS'], []),
    ('CIF', ['CIF', 'CİF'], []),
    ('ACE', ['ACE ÇAMAŞIR'], []),
    ('PORÇÖZ', ['PORÇÖZ', 'PORCOZ', 'PORCÖZ'], []),
    ('CAMSİL', ['CAMSİL', 'CAMSIL'], []),
    ('MR.MUSCLE', ['MR.MUSCLE', 'MR MUSCLE', 'MR. MUSCLE'], []),
    ('BİNGO', ['BİNGO', 'BINGO'], []),
    ('ARIEL', ['ARIEL', 'ARİEL'], []),
    ('OMO', ['OMO'], []),
    ('PERSIL', ['PERSIL', 'PERSİL'], []),
    ('PERWOLL', ['PERWOLL'], []),
    ('TURSİL', ['TURSİL', 'TURSIL'], []),
    ('ALO', ['ALO DETERJAN', 'ALO'], []),
    ('YUMOŞ', ['YUMOŞ', 'YUMOS'], []),
    ('VERNEL', ['VERNEL'], []),
    ('SELPAK', ['SELPAK'], []),
    ('SOLO', ['SOLO'], []),
    ('PAPİA', ['PAPİA', 'PAPIA'], []),
    ('FAMİLİA', ['FAMİLİA', 'FAMILIA'], []),
    ('MAYLO', ['MAYLO'], []),
    ('TENO', ['TENO'], []),
    ('SOFIA', ['SOFIA', 'SOFİA'], []),
    ('SLEEPY', ['SLEEPY'], []),
    ('MOLFİX', ['MOLFİX', 'MOLFIX'], []),
    ('PRİMA', ['PRİMA', 'PRIMA', 'PAMPERS'], []),
    ('CANBEBE', ['CANBEBE'], []),
    ('ORKİD', ['ORKİD', 'ORKID', 'ALWAYS'], []),
    ('KOTEX', ['KOTEX'], []),
    ('MOLPED', ['MOLPED'], []),
    ('NİVEA', ['NİVEA', 'NIVEA'], []),
    ('DOVE', ['DOVE'], []),
    ('DURU', ['DURU SABUN', 'DURU DUŞ', 'DURU ŞAMPUAN', 'DURU'], []),
    ('PALMOLİVE', ['PALMOLİVE', 'PALMOLIVE'], []),
    ('HACI ŞAKİR', ['HACI ŞAKİR', 'HACISAKIR', 'HACI SAKIR'], []),
    ('ARKO', ['ARKO', 'ARKO MEN', 'ARKO NEM'], []),
    ('ELİDOR', ['ELİDOR', 'ELIDOR', 'SUNSILK'], []),
    ('PANTENE', ['PANTENE'], []),
    ('HEAD&SHOULDERS', ['HEAD&SHOULDERS', 'HEAD & SHOULDERS', 'HEAD AND SHOULDERS', 'HEAD&SHOULD.'], []),
    ('CLEAR', ['CLEAR ŞAMPUAN', 'CLEAR MEN', 'CLEAR'], []),
    ('BLENDAX', ['BLENDAX'], []),
    ('İPEK', ['İPEK ŞAMPUAN', 'IPEK SAMPUAN', 'İPEK'], []),
    ('GLISS', ['GLISS', 'GLİSS'], []),
    ('SYOSS', ['SYOSS'], []),
    ('BIOBLAS', ['BIOBLAS', 'BİOBLAS'], []),
    ('BİOXCİN', ['BİOXCİN', 'BIOXCIN'], []),
    ('DALİN', ['DALİN', 'DALIN'], []),
    ('COLGATE', ['COLGATE'], []),
    ('SENSODYNE', ['SENSODYNE', 'SENSODAYN'], []),
    ('ORAL-B', ['ORAL-B', 'ORAL B', 'ORALB'], []),
    ('İPANA', ['İPANA', 'IPANA'], []),
    ('SIGNAL', ['SİGNAL', 'SIGNAL'], []),
    ('PARODONTAX', ['PARODONTAX'], []),
    ('LİSTERİNE', ['LİSTERİNE', 'LISTERINE'], []),
    ('GİLLETTE', ['GİLLETTE', 'GILLETTE', 'GİLETTE', 'GILETTE', 'VENUS', 'BLUE 3', 'BLUE II', 'MACH 3', 'FUSION'], []),
    ('DERBY', ['DERBY'], []),
    ('BİC', ['BİC', 'BIC'], []),
    ('DURACELL', ['DURACELL'], []),
    ('PANASONİC', ['PANASONİC', 'PANASONIC'], []),
    ('ENERGIZER', ['ENERGIZER', 'ENERGİZER'], []),
    ('PHILIPS', ['PHILIPS'], []),
    ('VARTA', ['VARTA'], []),
    ('DUREX', ['DUREX'], []),
    ('OKEY', ['OKEY PRESERVATİF', 'OKEY'], []),
    ('RAİD', ['RAİD', 'RAID'], []),
    ('BOĞAZİÇİ', ['BOĞAZİÇİ KOLONYA', 'BOGAZICI KOLONYA', 'BOĞAZİÇİ', 'BOGAZICI'], []),
    ('EYÜP SABRİ TUNCER', ['EYÜP SABRİ TUNCER', 'EYUP SABRI TUNCER', 'EST 1923'], []),
    ('PEREJA', ['PEREJA'], []),
    ('SELİN', ['SELİN KOLONYA', 'SELIN KOLONYA', 'SELİN', 'SELIN'], []),
    ('FİLİZ', ['FİLİZ MAKARNA', 'FİLİZ M.', 'FILIZ'], []),
    ('BARİLLA', ['BARİLLA', 'BARILLA'], []),
    ('NUDO', ['NUDO'], []),
    ('İNDOMİE', ['İNDOMİE', 'INDOMIE', 'INDOMİE', 'INDOMIES', 'İNDOMİES'], []),
    ('BEŞLER', ['BEŞLER', 'BESLER'], []),
    ('ŞAHİN', ['ŞAHİN SUCUK', 'SAHIN SUCUK', 'ŞAHİN', 'SAHIN'], []),
    ('NAMET', ['NAMET', 'MARET'], []),
    ('POLONEZ', ['POLONEZ'], []),
    ('CUMHURİYET', ['CUMHURİYET SUCUK', 'CUMHURIYET SUCUK', 'CUMHURİYET'], []),
    ('COŞKUN', ['COŞKUN SUCUK', 'COSKUN SUCUK', 'COŞKUN', 'COSKUN'], []),
    ('APİKOĞLU', ['APİKOĞLU', 'APIKOGLU'], []),
    ('ÇAPANOĞLU', ['ÇAPANOĞLU', 'CAPANOGLU'], []),
    ('BAŞYAZICI', ['BAŞYAZICI', 'BASYAZICI'], []),
    ('ERŞAN', ['ERŞAN', 'ERSAN'], []),
    ('ŞAHBAZ', ['ŞAHBAZ', 'SAHBAZ'], []),
    ('DANET', ['DANET'], []),
    ('ŞENPİLİÇ', ['ŞENPİLİÇ', 'SENPILIC'], []),
    ('BEYPİLİÇ', ['BEYPİLİÇ', 'BEYPILIC'], []),
    ('KORPİLİÇ', ['KORPİLİÇ', 'KORPILIC', 'KOR PİLİÇ'], []),
    ('BANVİT', ['BANVİT', 'BANVIT'], []),
    ('LEZİTA', ['LEZİTA', 'LEZITA'], []),
    ('ER PİLİÇ', ['ER PİLİÇ', 'ERPİLİÇ', 'ER PILIC'], []),
    ('DARDANEL', ['DARDANEL'], []),
    ('UNO', ['UNO EKMEK', 'UNO TOST', 'UNO SANDVİÇ', 'UNO KRUVASAN', 'UNO'], []),
    ('DEDEOĞLU', ['DEDEOĞLU', 'DEDEOGLU'], []),
    ('GÜNAYDIN', ['GÜNAYDIN', 'GUNAYDIN'], []),
    ('BAĞCI', ['BAĞCI', 'BAGCI'], []),
    ('MARMARABİRLİK', ['MARMARABİRLİK', 'MARMARABIRLIK'], []),
    ('FORA', ['FORA ZEYTİN', 'FORA'], []),
    ('CEM', ['CEM ZEYTİN'], []),
    ('ÖZBEY', ['ÖZBEY', 'OZBEY'], []),
    ('PAŞABAHÇE', ['PAŞABAHÇE', 'PASABAHCE'], []),
    ('LAV', ['LAV CAM', 'LAV BARDAK', 'LAV KASE'], []),
    ('GÜRALLAR', ['GÜRALLAR', 'GURAL'], []),
    ('FELİX', ['FELİX', 'FELIX'], []),
    ('WHİSKAS', ['WHİSKAS', 'WHISKAS'], []),
    ('PEDİGREE', ['PEDİGREE', 'PEDIGREE'], []),
    ('GOURMET', ['GOURMET GOLD', 'GOURMET PERLE', 'GOURMET'], []),
    ('FRISKIES', ['FRISKIES', 'FRİSKİES'], []),
    ('PRO PLAN', ['PRO PLAN', 'PROPLAN'], []),
    ('REFLEX', ['REFLEX'], []),
    ('MİS', ['MİS SÜT', 'MIS SUT', 'MİS'], []),
    ('VATAN', ['VATAN CİN MISIR', 'VATAN'], []),
    ('SEBİL', ['SEBİL CİN MISIR', 'SEBİL', 'SEBIL'], []),
    ('CHOCEUR', ['CHOCEUR'], []),
    ('MILKA', ['MİLKA', 'MILKA'], []),
    ('TOBLERONE', ['TOBLERONE'], []),
    ('NUTELLA', ['NUTELLA'], []),
    ('KİNDER', ['KİNDER', 'KINDER', 'KINDER BUENO', 'KINDER JOY', 'KINDER SURPRISE'], []),
    ('FERRERO', ['FERRERO', 'ROCHER', 'RAFFAELLO'], []),
    ('SNICKERS', ['SNICKERS'], []),
    ('TWIX', ['TWIX'], []),
    ('BOUNTY', ['BOUNTY'], []),
    ('MARS', ['MARS ÇİKOLATA'], []),
    ('M&M', ['M&M', 'M&M\'S', 'M AND M'], []),
    ('SKITTLES', ['SKITTLES'], []),
    ('ZÜBER', ['ZÜBER', 'ZUBER'], []),
    ('FİTPO', ['FİTPO', 'FITPO'], []),
    ('KROKAN', ['KROKAN'], []),
    ('TADELLE', ['TADELLE'], []),
    ('SARELLE', ['SARELLE'], []),
    ('GOL', ['GOL GOFRET', 'GOL'], []),
    ('COSBY', ['COSBY'], []),
    ('PAPİLİON', ['PAPİLİON', 'PAPILION'], []),
    ('DEEP FRESH', ['DEEP FRESH', 'DEEPFRESH'], []),
    ('UNİ', ['UNİ BABY', 'UNI BABY', 'UNİ', 'UNI'], []),
    ('ACTİVEX', ['ACTİVEX', 'ACTIVEX'], []),
    ('TOFFİFEE', ['TOFFİFEE', 'TOFFIFEE'], []),
    ('MERCI', ['MERCI'], []),
    ('GODİVA', ['GODİVA', 'GODIVA'], []),
    ('RITTER SPORT', ['RITTER SPORT', 'RİTTER SPORT'], []),
    ('HOT WHEELS', ['HOT WHEELS', 'HOTWHEELS'], []),
    ('MARLBORO', ['MARLBORO', 'TOUCH', 'EDGE'], []),
    ('PARLIAMENT', ['PARLIAMENT', 'PARLIAMENT NIGHT', 'AQUA BLUE', 'MIDNIGHT BLUE'], []),
    ('WINSTON', ['WINSTON', 'WINSTON SLENDER', 'WINSTON DARK', 'WINSTON XSENCE'], []),
    ('CAMEL', ['CAMEL', 'CAMEL YELLOW', 'CAMEL DEEP', 'CAMEL SLENDER'], []),
    ('ROTHMANS', ['ROTHMANS'], []),
    ('CHESTERFIELD', ['CHESTERFIELD'], []),
    ('MONTE CARLO', ['MONTE CARLO', 'MONTECARLO'], []),
    ('MURATTI', ['MURATTI', 'ROSSO'], []),
    ('LARK', ['LARK'], []),
    ('KENT', ['KENT SWITCH', 'KENT BLUE', 'KENT WHITE', 'KENT D-RANGE', 'KENT SLIMS', 'KENT SLENDER', 'KENT DRANGE', 'KENT SAKIZ', 'KENT ŞEKER'], ['KENT BORİNGER', 'KENT BORINGER']),
    ('PRESIDENT', ['PRESIDENT', 'PRESİDENT'], []),
    ('WINNER', ['WINNER', 'WİNNER'], []),
    ('HD', ['HD SİGARA', 'HD SLIMS', 'HD BLUE', 'HD RED'], []),
    ('VICEROY', ['VICEROY'], []),
    ('WEST', ['WEST SİGARA', 'WEST NAVY', 'WEST GREY', 'WEST GR', 'WEST RED', 'WEST'], []),
    ('ESSE', ['ESSE BLACK', 'ESSE SİGARA', 'ESSE'], []),
    ('POLO', ['POLO SİGARA', 'POLO SLIMS'], []),
    ('RAISON', ['RAISON'], []),
    ('MEDİCİNE', ['MEDİCİNE', 'MEDICINE'], []),
    ('TOROS', ['TOROS 2005', 'TOROS'], []),
    ('SAMSUN', ['SAMSUN 216', 'SAMSUN'], []),
    ('MALTEPE', ['MALTEPE'], []),
    ('TEKEL 2000', ['TEKEL 2000', 'TEKEL 2001', 'TEKEL'], []),
    ('ÜLKER', ['ÜLKER', 'ULKER', 'ALBENİ', 'ALBENI', 'ÇOKONAT', 'COKONAT', 'HALLEY', 'HANIMELLER', 'RONDO', 'BİSKREM', 'BISKREM', 'CANPASTA', 'ÇİZİ', 'CIZI', 'ÇİZİVİÇ', 'İKRAM', 'IKRAM', 'DANKEK', 'DİDO', 'DIDO', 'PROBİS', 'PROBIS', 'OLALA', 'ALPELLA', 'ONEP', 'ÇOKOMEL', 'ÇOKOKREM', 'ÇOKOPRENS', 'HAYLAYF', 'ALTINBAŞAK', 'TAÇ KRAKER', 'ASLAN KRAL KEK'], ['ETİ', 'ŞÖLEN']),
    ('ETİ', ['ETİ', 'ETI', 'CRAX', 'BENİMO', 'BENIMO', 'BURÇAK', 'BURCAK', 'TUTKU', 'GONG', 'HOŞBEŞ', 'HOSBES', 'KOMBO', 'CİCİBEBE', 'CICI BEBE', 'CİCİ BEBE', 'KARAM', 'WANTED', 'MAXIMUS', 'DUDOMI', 'TOPKEK', 'AŞK ALEVİ', 'POPS MEKSİKA', 'LİFALİF', 'LIFALIF'], ['DİŞ ETİ', 'DIS ETI', 'KUZU ETİ', 'SIĞIR ETİ', 'TAVUK ETİ', 'HİNDİ ETİ', 'DANA ETİ', 'CİN MISIR', 'CIN MISIR', 'BEŞLER', 'FELİX', 'ORAL B', 'SENSODYNE', 'VATAN', 'SEBİL', 'DOĞUŞ', 'ŞÖLEN', 'MAYLO', 'BEZELYELİ KUZU']),
]

# Compile patterns
COMPILED_RULES = []
for brand_name, kw_list, ex_list in RAW_BRAND_RULES:
    # Sort keywords by length desc
    kw_sorted = sorted(kw_list, key=lambda x: len(x), reverse=True)
    # Build regex
    kw_pattern = re.compile(r'(?:^|[\s\-_.,/])(?:' + '|'.join(re.escape(k) for k in kw_sorted) + r')(?:$|[\s\-_.,/])', re.I)
    ex_compiled = [re.compile(r'(?:^|[\s\-_.,/])' + re.escape(e) + r'(?:$|[\s\-_.,/])', re.I) for e in ex_list]
    COMPILED_RULES.append((brand_name, kw_pattern, ex_compiled))

def clean_title_prefix(t):
    # Strip generic category prefixes
    t_clean = re.sub(r'^(?:C[İI]PS|S[İI]GARA|SODA|CAY|ÇAY|SU|OYUNCAK|KAHVE|S[ÜU]T|PEYN[İI]R|SEKER|ŞEKER)\s+', '', t, flags=re.I).strip()
    return t_clean

def get_product_brand(title, curr_brand):
    t_str = str(title or '').strip()
    t_clean = clean_title_prefix(t_str)
    
    # Check compiled rules
    for brand_name, kw_pat, ex_list in COMPILED_RULES:
        if any(ex_p.search(t_str) for ex_p in ex_list):
            continue
        if kw_pat.search(t_clean) or kw_pat.search(t_str):
            return brand_name
            
    # Check if first word of title looks like a brand (e.g. 'BABYTOS ...')
    first_word = t_clean.split()[0].upper() if t_clean else ''
    if len(first_word) >= 3 and first_word not in ['TÜM', 'HER', 'YENİ', 'ÖZEL', 'MİNİ', 'KÜÇÜK', 'BÜYÜK', '100', '200', '500', '1KG', '2KG', '1LT', '5LT']:
        # If current brand is already clean and specific, keep it
        if curr_brand and curr_brand not in ['DİĞER', 'DIGER', 'YARENLER', 'CİPS', 'SİGARA', 'ÇAY', 'SU', 'SODA', 'OYUNCAK', 'KAHVE', 'TURKİYE', 'TÜRKİYE', 'ET']:
            return curr_brand
        return first_word
        
    if curr_brand and curr_brand not in ['DİĞER', 'DIGER', 'YARENLER', 'CİPS', 'SİGARA', 'ÇAY', 'SU', 'SODA', 'OYUNCAK', 'KAHVE', 'TURKİYE', 'TÜRKİYE', 'ET']:
        return curr_brand

    return 'DİĞER'

# Run on all products
updated_products = []
changes_log = []

for p in products:
    curr_b = p.get('brand', 'DİĞER')
    new_b = get_product_brand(p.get('title', ''), curr_b)
    if new_b != curr_b:
        changes_log.append((p.get('title'), curr_b, new_b))
    p['brand'] = new_b
    updated_products.append(p)

print(f"Toplam Güncellenen/Düzeltilen Marka Sayısı: {len(changes_log)}")
print("\n--- ÖRNEK YAPILAN DÜZELTMELER ---")
for t, old_b, new_b in changes_log[:30]:
    print(f"Ürün: '{t}'\n  Eski: [{old_b}]  ➔  Yeni Doğru Marka: [{new_b}]\n")

# Save updated products.json
with open('data/products.json', 'w', encoding='utf-8') as f:
    json.dump(updated_products, f, ensure_ascii=False, indent=2)

print("✓ data/products.json başarıyla güncellendi!")
