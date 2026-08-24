# -*- coding: utf-8 -*-
"""
Çok Modlu Fatura Okuma Motoru:
1. UBL-TR e-Fatura / e-Arşiv XML Ayrıştırıcı
2. Vektörel / Dijital PDF Metin ve Tablo Çıkarıcı (PyMuPDF & pdfplumber)
3. Görsel / Fotoğraf Türkçe OCR Motoru (Windows.Media.Ocr & Görüntü İyileştirme)
"""
import os
import re
import sys
import tempfile
import subprocess
import datetime
from PIL import Image

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """PDF dosyasından (PyMuPDF / pdfplumber ile) metinleri ve tabloları çıkarır."""
    extracted_text = []
    
    # 1. PyMuPDF (fitz) ile ultra hızlı metin çıkarma
    try:
        import fitz
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        for page_idx in range(len(doc)):
            page = doc[page_idx]
            txt = page.get_text("text")
            if txt and txt.strip():
                extracted_text.append(txt)
        doc.close()
    except Exception as e:
        print(f"[PDF FITZ HATASI] {e}")

    # Eğer metin alındıysa dön
    if extracted_text:
        return "\n".join(extracted_text)

    # 2. pdfplumber ile alternatif okuma
    try:
        import pdfplumber
        import io
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for page in pdf.pages:
                txt = page.extract_text()
                if txt and txt.strip():
                    extracted_text.append(txt)
                # Tablolar varsa onları da satır olarak ekle
                tables = page.extract_tables()
                for table in tables:
                    for row in table:
                        row_clean = [str(c).strip() for c in row if c is not None]
                        if row_clean:
                            extracted_text.append(" ".join(row_clean))
    except Exception as e:
        print(f"[PDF PLUMBER HATASI] {e}")

    return "\n".join(extracted_text)

def extract_text_from_image_windows_ocr(image_bytes: bytes) -> str:
    """
    Fatura fotoğraflarını (JPG, PNG, WebP) Windows 10/11 yerel donanımsal 
    Türkçe OCR motoru (Windows.Media.Ocr) ile yüksek doğrulukla okur.
    """
    temp_img_path = None
    try:
        # Geçici optimize edilmiş dosya kaydet
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            temp_img_path = tmp.name
            
        # Görseli PIL ile aç ve kontrast/gri tonlama iyileştirmesi yap
        import io
        img = Image.open(io.BytesIO(image_bytes))
        # RGB'ye çevir ve gerekiyorsa boyutlandır
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Çok büyükse (örn: 4K fotoğraf) performansı artırmak için güvenli ölçeklendir
        max_dim = 2400
        if max(img.size) > max_dim:
            img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
            
        img.save(temp_img_path, format="PNG")

        ps_script = f"""
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {{ $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' }})[0]

function Await($WinRtTask, $ResultType) {{
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    $netTask.Result
}}

[Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine, Windows.Foundation.UniversalApiContract, ContentType = WindowsRuntime] | Out-Null

$fileTask = [Windows.Storage.StorageFile]::GetFileFromPathAsync('{temp_img_path}')
$file = Await $fileTask ([Windows.Storage.StorageFile])

$streamTask = $file.OpenAsync([Windows.Storage.FileAccessMode]::Read)
$stream = Await $streamTask ([Windows.Storage.Streams.IRandomAccessStream])

$decoderTask = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)
$decoder = Await $decoderTask ([Windows.Graphics.Imaging.BitmapDecoder])

$bitmapTask = $decoder.GetSoftwareBitmapAsync()
$bitmap = Await $bitmapTask ([Windows.Graphics.Imaging.SoftwareBitmap])

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if (-not $engine) {{
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new('tr-TR'))
}}
if (-not $engine) {{
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new('en-US'))
}}

if ($engine) {{
    $ocrTask = $engine.RecognizeAsync($bitmap)
    $ocrResult = Await $ocrTask ([Windows.Media.Ocr.OcrResult])
    foreach ($line in $ocrResult.Lines) {{
        Write-Output $line.Text
    }}
}}
"""
        res = subprocess.run(["powershell", "-NoProfile", "-Command", ps_script], capture_output=True, text=True, timeout=15)
        raw_out = res.stdout.strip()
        return raw_out
    except Exception as e:
        print(f"[OCR İŞLEME HATASI] {e}")
        return ""
    finally:
        if temp_img_path and os.path.exists(temp_img_path):
            try:
                os.remove(temp_img_path)
            except Exception:
                pass
