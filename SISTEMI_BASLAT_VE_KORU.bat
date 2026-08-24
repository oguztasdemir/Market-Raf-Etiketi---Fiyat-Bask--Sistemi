@echo off
chcp 65001 >nul
title Market Raf Etiketi, POS ve Barkod Sistemi (Otomatik Koruma)

echo ======================================================================
echo   MARKET RAF ETIKETI, POS VE BARKOD SISTEMI - KORUMA MOTORU (WATCHDOG)
echo ======================================================================
echo [*] Sistem başlatılıyor ve çökme/kapanma koruması devrede...
echo [*] Uygulama beklenmedik şekilde kapansa dahi 2 saniye içinde otomatik yeniden başlar.
echo ======================================================================

:LOOP
python main.py
echo.
echo [UYARI] Sistem kapandı veya yeniden başlatılıyor (%date% %time%)...
echo [BİLGİ] 2 saniye içinde sistem yeniden açılıyor...
timeout /t 2 /nobreak >nul
goto LOOP
