# -*- coding: utf-8 -*-
import json

with open("data/manav_products.json", "r", encoding="utf-8") as f:
    items = json.load(f)

for it in items:
    t = it["title"]
    t = t.replace("ENGELKY", "ÇENGELKÖY")
    t = t.replace("SOAN", "SOĞAN")
    t = t.replace("ZM", "ÜZÜM")
    t = t.replace("LMON", "LİMON")
    t = t.replace("SVR BBER", "SİVRİ BİBER")
    t = t.replace("EFTAL", "ŞEFTALİ")
    t = t.replace("MEKSKA BBER", "MEKSİKA BİBERİ")
    t = t.replace("KIRKAA", "KIRKAĞAÇ")
    t = t.replace("THAL", "İTHAL")
    t = t.replace("LX", "LÜKS")
    t = t.replace("NCR", "İNCİR")
    t = t.replace("EK", "EKŞİ")
    t = t.replace("BGA", "BİGA")
    t = t.replace("EKRDEKSZ", "ÇEKİRDEKSİZ")
    t = t.replace("?LEK", "ÇİLEK")
    t = t.replace("LEK", "ÇİLEK")
    t = t.replace("HAVU", "HAVUÇ")
    t = t.replace("BBER", "BİBER")
    t = t.replace("KY", "KÖY")
    t = t.replace("GBEK", "GÖBEK")
    t = t.replace("BROKOL", "BROKOLİ")
    t = t.replace("KEREVZ", "KEREVİZ")
    t = t.replace("KRAZ", "KİRAZ")
    t = t.replace("ER", "ÇERİ")
    t = t.replace("YEL", "YEŞİL")
    t = t.replace("", "")
    it["title"] = t

with open("data/manav_products.json", "w", encoding="utf-8") as f:
    json.dump(items, f, ensure_ascii=False, indent=2)

print("Karakterler düzeltildi!")
