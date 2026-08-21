# -*- coding: utf-8 -*-
"""
Termal Baskı Gönderme, Toplu Yazdırma, Canlı Durum, Ağ & Ayarlar API Rotaları
"""
import io
import time
import math
import base64
import datetime
from flask import Blueprint, jsonify, request
from src.config import PRODUCTS_FILE, DRAFT_CACHE_FILE, SETTINGS_FILE
from src.utils.storage import load_json, save_json
from src.utils.text_cleaner import clean_barcode, get_online_or_system_date
from src.utils.watcher import get_local_ip
from src.services.print_service import (
    get_installed_printers, generate_tspl_command, send_raw_to_printer,
    mark_products_as_printed, purge_printer_queue, validate_barcode_checksum
)
from src.zpl_generator import generate_market_shelf_zpl
from src.printer_service import print_raw_zpl, get_printer_status
from src.services.excel_service import clear_diff_cache
from src.services.report_service import log_printed_batch

print_bp = Blueprint('print_bp', __name__)

global_live_print_status = {
    "is_active": False,
    "source": "desktop",
    "total": 0,
    "current": 0,
    "current_item": "",
    "current_price": "",
    "status_text": "Hazır",
    "is_paused": False,
    "last_updated": time.time()
}

@print_bp.route("/api/network/ip", methods=["GET"])
def api_network_ip():
    """Mobil cihazların bağlanabilmesi için yerel ağ IP'sini döner."""
    ip = get_local_ip()
    port = request.host.split(':')[-1] if ':' in request.host else '5000'
    mobile_http = f"http://{ip}:{port}/mobile"
    mobile_https = f"https://{ip}:5001/mobile"
    return jsonify({
        "status": "success",
        "ip": ip,
        "port": port,
        "http_url": f"http://{ip}:{port}",
        "mobile_url": mobile_http,
        "mobile_http": mobile_http,
        "mobile_https": mobile_https
    })

@print_bp.route("/api/current-date", methods=["GET"])
def api_current_date():
    """Sistem tarihini etiket formatında döner."""
    return jsonify({
        "status": "success",
        "date": get_online_or_system_date(),
        "timestamp": time.time()
    })

@print_bp.route("/api/devices", methods=["GET"])
def api_devices():
    """Bağlı yazıcıları ve durumlarını döner."""
    printers = get_installed_printers()
    settings = load_json(SETTINGS_FILE, {})
    default_printer = settings.get("printer") or (printers[0] if printers else "Termal Etiket Yazici")
    
    printer_details = []
    for p in printers:
        st = get_printer_status(p) if hasattr(p, '__str__') else {"is_online": True, "status": "Hazır"}
        printer_details.append({
            "name": p,
            "is_default": (p == default_printer),
            "status": st.get("status", "Hazır"),
            "is_online": st.get("is_online", True)
        })

    return jsonify({
        "status": "success",
        "printers": printers,
        "printer_details": printer_details,
        "selected_printer": default_printer
    })

@print_bp.route("/api/settings", methods=["GET", "POST"])
def api_settings():
    """Sistem ayarlarını okur veya günceller."""
    if request.method == "POST":
        data = request.json or {}
        save_json(SETTINGS_FILE, data)
        return jsonify({"status": "success", "message": "Ayarlar kaydedildi."})
    else:
        settings = load_json(SETTINGS_FILE, {
            "printer": "Termal Etiket Yazici",
            "dpi": 203,
            "width_mm": 76,
            "height_mm": 40,
            "x_offset": 0,
            "y_offset": 0,
            "orientation": "POR",
            "theme": "dark"
        })
        return jsonify({"status": "success", "settings": settings})

@print_bp.route("/api/preview/zpl", methods=["POST"])
def api_preview_zpl():
    """Önizleme ve hata ayıklama için ZPL kodunu döndürür."""
    data = request.json or {}
    label_data = data.get("data", {})
    dpi = int(data.get("dpi", 203))
    width_mm = float(data.get("width_mm", 76))
    height_mm = float(data.get("height_mm", 40))
    orientation = data.get("orientation", "POR")
    x_off = int(data.get("x_offset", 0))
    y_off = int(data.get("y_offset", 0))

    zpl_code = generate_market_shelf_zpl(
        label_data,
        orientation=orientation,
        x_offset=x_off,
        y_offset=y_off,
        width_mm=width_mm,
        height_mm=height_mm,
        dpi=dpi,
        copies=1
    )
    return jsonify({
        "status": "success",
        "zpl": zpl_code
    })

@print_bp.route("/api/printers", methods=["GET"])
def api_get_printers():
    """Yazıcı listesini döner."""
    printers = get_installed_printers()
    return jsonify({"status": "success", "printers": printers})

@print_bp.route("/api/print/send", methods=["POST"])
def api_print_send():
    """Tekil etiket baskısını yazıcıya gönderir (ZPL ve TSPL fallback)."""
    data = request.json or {}
    printer = data.get("printer", "Termal Etiket Yazici")
    width_mm = float(data.get("width_mm", 76))
    height_mm = float(data.get("height_mm", 40))
    x_off = int(data.get("x_offset", 0))
    y_off = int(data.get("y_offset", 0))
    copies = int(data.get("copies", 1))
    dpi = int(data.get("dpi", 203))
    label_data = data.get("data", {})

    zpl_code = generate_market_shelf_zpl(
        label_data,
        orientation=data.get("orientation", "POR"),
        x_offset=x_off,
        y_offset=y_off,
        width_mm=width_mm,
        height_mm=height_mm,
        dpi=dpi,
        copies=copies
    )

    try:
        print_raw_zpl(printer, zpl_code, f"Etiket: {label_data.get('title1', 'Urun')}")
        bc = label_data.get('barcode')
        if bc:
            mark_products_as_printed([bc])
        log_printed_batch([{
            "barcode": bc,
            "title": label_data.get('title1') or label_data.get('title') or "Tekli Etiket",
            "price": label_data.get('price', ''),
            "copies": copies
        }], source=data.get("source", "PC"))
        return jsonify({"status": "success", "message": f"'{printer}' yazıcısına {copies} adet baskı gönderildi."})
    except Exception as e:
        raw_cmd = generate_tspl_command(label_data, int(width_mm), int(height_mm), x_off, y_off, copies)
        send_raw_to_printer(printer, raw_cmd)
        bc = label_data.get('barcode')
        if bc:
            mark_products_as_printed([bc])
        log_printed_batch([{
            "barcode": bc,
            "title": label_data.get('title1') or label_data.get('title') or "Tekli Etiket",
            "price": label_data.get('price', ''),
            "copies": copies
        }], source=data.get("source", "PC"))
        return jsonify({"status": "success", "message": f"'{printer}' yazıcısına gönderildi."})

@print_bp.route("/api/print/live-status", methods=["GET", "POST"])
def api_print_live_status():
    """Masaüstü ve Mobil arasında canlı yazdırma durumunu senkronize eder."""
    global global_live_print_status
    if request.method == "POST":
        data = request.json or {}
        global_live_print_status.update(data)
        global_live_print_status["last_updated"] = time.time()
        return jsonify({"status": "success", "live_status": global_live_print_status})
    else:
        if time.time() - global_live_print_status.get("last_updated", 0) > 10 and not global_live_print_status.get("is_active"):
            global_live_print_status["is_active"] = False
        return jsonify({"status": "success", "live_status": global_live_print_status})

@print_bp.route("/api/print/batch", methods=["POST"])
def api_print_batch():
    """Toplu ürün etiketlerini tek bir ZPL/TSPL işi olarak yazıcıya iletir."""
    global global_live_print_status
    payload = request.json or {}
    products = payload.get("products", [])
    printer = payload.get("printer", "Termal Etiket Yazici")
    
    orientation = payload.get("orientation", "POR")
    width_mm = float(payload.get("width_mm") or 76)
    height_mm = float(payload.get("height_mm") or 40)
    x_offset = int(payload.get("x_offset") or 0)
    y_offset = int(payload.get("y_offset") or 0)
    dpi = int(payload.get("dpi") or 203)
    copies_per_item = max(1, int(payload.get("copies_per_item") or payload.get("copies") or 1))
    template_raw = payload.get("template") or {}
    source = payload.get("source") or "desktop"

    if not products:
        return jsonify({"status": "error", "message": "Yazdırılacak ürün bulunamadı."}), 400

    first_p = products[0]
    global_live_print_status.update({
        "is_active": True,
        "source": source,
        "total": len(products) * copies_per_item,
        "current": len(products) * copies_per_item,
        "current_item": str(first_p.get("title") or first_p.get("title1") or "Etiket"),
        "current_price": str(first_p.get("price") or ""),
        "status_text": "Yazdırılıyor...",
        "is_paused": False,
        "last_updated": time.time()
    })

    zpl_list = []
    for p in products:
        full_title = str(p.get("title") or p.get("title1") or "").strip()
        parts = full_title.split()
        if len(full_title) > 25 and len(parts) > 1:
            mid = math.ceil(len(parts) / 2)
            t1 = " ".join(parts[:mid])
            t2 = " ".join(parts[mid:])
        else:
            t1 = full_title
            t2 = str(p.get("title2") or "").strip()

        raw_date = str(p.get("date") or get_online_or_system_date()).strip()
        
        data = {
            "title1": t1,
            "title2": t2,
            "brand": "YARENLER",
            "origin": str(p.get("origin") or "TÜRKİYE"),
            "date": raw_date,
            "unit_price": str(p.get("unit_price") or ""),
            "barcode": str(p.get("barcode") or ""),
            "price": str(p.get("price") or ""),
            "top_right_mode": template_raw.get("top_right_mode", "empty"),
            "top_right_text": template_raw.get("top_right_text", ""),
            "custom_fields": template_raw.get("custom_fields", [])
        }

        zpl = generate_market_shelf_zpl(
            data,
            orientation=orientation,
            x_offset=x_offset,
            y_offset=y_offset,
            width_mm=width_mm,
            height_mm=height_mm,
            dpi=dpi,
            copies=copies_per_item
        )
        zpl_list.append(zpl)

    combined_zpl = "\n".join(zpl_list)
    total_labels = len(products) * copies_per_item

    try:
        print_raw_zpl(printer, combined_zpl, f"Toplu Etiket ({len(products)} Kalem)")
        printed_barcodes = [str(p.get("barcode", "")).strip() for p in products if p.get("barcode")]
        if printed_barcodes:
            mark_products_as_printed(printed_barcodes)
        
        log_printed_batch([{
            "barcode": p.get("barcode"),
            "title": p.get("title") or p.get("title1"),
            "price": p.get("price"),
            "copies": copies_per_item
        } for p in products], source="MOBILE" if "mob" in source.lower() else "PC")

        global_live_print_status.update({
            "is_active": False,
            "status_text": "Tamamlandı",
            "last_updated": time.time()
        })
        return jsonify({
            "status": "success",
            "item_count": len(products),
            "total_labels": total_labels,
            "message": f"{len(products)} ürün ({total_labels} adet etiket) başarıyla '{printer}' yazıcısına gönderildi!"
        })
    except Exception as e:
        for p in products:
            raw_cmd = generate_tspl_command(p, int(width_mm), int(height_mm), x_offset, y_offset, copies_per_item)
            send_raw_to_printer(printer, raw_cmd)
        printed_barcodes = [str(p.get("barcode", "")).strip() for p in products if p.get("barcode")]
        if printed_barcodes:
            mark_products_as_printed(printed_barcodes)
        global_live_print_status.update({
            "is_active": False,
            "status_text": "Tamamlandı",
            "last_updated": time.time()
        })
        return jsonify({
            "status": "success",
            "item_count": len(products),
            "total_labels": total_labels,
            "message": f"{len(products)} ürün başarıyla yazıcıya gönderildi."
        })

@print_bp.route("/api/print/cancel", methods=["POST"])
def api_print_cancel():
    """Yazıcı kuyruğunu temizler ve aktif yazdırma işini iptal eder."""
    global global_live_print_status
    payload = request.json or {}
    settings = load_json(SETTINGS_FILE, {})
    selected_printer = payload.get("printer") or settings.get("printer") or "Termal Etiket Yazici"
    purge_printer_queue(selected_printer)

    global_live_print_status.update({
        "is_active": False,
        "status_text": "İptal Edildi",
        "last_updated": time.time()
    })
    return jsonify({"status": "success", "message": "Yazdırma kuyruğu temizlendi."})

@print_bp.route("/api/scanner/decode-frame", methods=["POST"])
def api_scanner_decode_frame():
    """Kamera karesinden gelişmiş barkod çözümü yapar (OpenCV / Pyzbar)."""
    try:
        data = request.json or {}
        image_data = data.get("image")
        if not image_data:
            return jsonify({"status": "not_found"}), 200

        if "," in image_data:
            image_data = image_data.split(",")[1]

        raw_bytes = base64.b64decode(image_data)
        import numpy as np
        import cv2

        nparr = np.frombuffer(raw_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return jsonify({"status": "not_found"}), 200

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        detector = cv2.barcode.BarcodeDetector()
        opencv_res = detector.detectAndDecode(gray)
        if opencv_res and opencv_res[0]:
            candidate = str(opencv_res[0]).strip()
            if candidate and validate_barcode_checksum(candidate):
                return jsonify({"status": "success", "barcode": candidate})

        return jsonify({"status": "not_found"}), 200
    except Exception:
        return jsonify({"status": "not_found"}), 200

@print_bp.route("/api/cache/draft", methods=["GET", "POST", "DELETE"])
def api_cache_draft():
    """Form taslak önbelleğini okur, günceller veya sıfırlar."""
    if request.method == "POST":
        data = request.json or {}
        save_json(DRAFT_CACHE_FILE, data)
        return jsonify({"status": "success"})
    elif request.method == "DELETE":
        save_json(DRAFT_CACHE_FILE, {})
        return jsonify({"status": "success"})
    else:
        data = load_json(DRAFT_CACHE_FILE, {})
        return jsonify({"status": "success", "draft": data})
