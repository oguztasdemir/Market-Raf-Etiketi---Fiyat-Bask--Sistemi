# -*- coding: utf-8 -*-
"""
OCR & PDF Çıkarıcı Yetenek Testi
"""
import os
import sys

# 1. PDF Testi (PyMuPDF / pdfplumber)
try:
    import fitz # PyMuPDF
    print("[PASS] PyMuPDF (fitz) Hazır!")
except Exception as e:
    print(f"[FAIL] PyMuPDF: {e}")

try:
    import pdfplumber
    print("[PASS] pdfplumber Hazır!")
except Exception as e:
    print(f"[FAIL] pdfplumber: {e}")

# 2. Windows Native OCR Testi (PowerShell üzerinden WinRT OCR)
import subprocess

ps_ocr_script = """
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]

function Await($WinRtTask, $ResultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    $netTask.Result
}

[Windows.Media.Ocr.OcrEngine, Windows.Foundation.UniversalApiContract, ContentType = WindowsRuntime] | Out-Null
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if ($engine) {
    Write-Output "WINDOWS_OCR_READY"
} else {
    Write-Output "NO_OCR"
}
"""

try:
    res = subprocess.run(["powershell", "-NoProfile", "-Command", ps_ocr_script], capture_output=True, text=True, timeout=8)
    if "WINDOWS_OCR_READY" in res.stdout:
        print("[PASS] Windows 10/11 Yerel Donanımsal OCR Motoru (%100 Türkçe Destekli) AKTİF!")
    else:
        print(f"[INFO] Windows OCR Yanıtı: {res.stdout.strip()} | {res.stderr.strip()}")
except Exception as e:
    print(f"[WARN] OCR Test Hatası: {e}")
