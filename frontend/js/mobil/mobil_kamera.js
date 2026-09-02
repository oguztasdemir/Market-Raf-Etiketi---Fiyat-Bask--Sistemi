/**
 * =========================================================================
 * 📷 MOBIL KAMERA: ZXing, Donanım BarcodeDetector, Fener, Zoom ve Tarayıcı
 * =========================================================================
 */

let isDecodingServerFrame = false;
const roiCanvas = document.createElement('canvas');
const roiCtx = roiCanvas.getContext('2d');

/**
 * 🛡️ Parlama & Yuvarlak Yüzey Filtresi Aç / Kapa
 */
function toggleGlareMode() {
  isGlareModeActive = !isGlareModeActive;
  const btn = document.getElementById('btn-fs-glare');
  const txt = document.getElementById('txt-fs-glare');
  if (btn && txt) {
    if (isGlareModeActive) {
      btn.classList.add('active');
      txt.textContent = 'Parlama & Eğri: AÇIK';
    } else {
      btn.classList.remove('active');
      txt.textContent = 'Parlama & Eğri: KAPALI';
    }
  }
}

/**
 * 🔍 Kamera Zoom Kontrolü (Donanım Seviyesi + Fallback)
 */
async function setCameraZoom(zoomVal) {
  currentZoomLevel = zoomVal;
  
  // UI Butonlarını Güncelle
  document.querySelectorAll('.fs-btn-zoom').forEach(b => b.classList.remove('active'));
  const activeBtnId = zoomVal === 1.0 ? 'btn-zoom-1x' : (zoomVal === 1.5 ? 'btn-zoom-15x' : (zoomVal === 2.0 ? 'btn-zoom-2x' : 'btn-zoom-3x'));
  const activeBtn = document.getElementById(activeBtnId);
  if (activeBtn) activeBtn.classList.add('active');

  const videoElem = document.getElementById('fullscreen-video');

  // 1. Donanım Seviyesi Optik/Dijital Zoom
  if (activeVideoTrack && typeof activeVideoTrack.applyConstraints === 'function') {
    try {
      const caps = activeVideoTrack.getCapabilities ? activeVideoTrack.getCapabilities() : {};
      if (caps.zoom) {
        const minZ = caps.zoom.min || 1.0;
        const maxZ = caps.zoom.max || 5.0;
        const targetZ = Math.min(Math.max(zoomVal, minZ), maxZ);
        await activeVideoTrack.applyConstraints({
          advanced: [{ zoom: targetZ }]
        });
        if (videoElem) videoElem.style.transform = "none";
        return;
      }
    } catch (e) {
      console.warn("Donanım zoom kısıtlaması uygulanamadı, yazılımsal zoom kullanılıyor:", e);
    }
  }

  // 2. Yazılımsal Dijital Zoom (CSS Scale Fallback)
  if (videoElem) {
    videoElem.style.transform = zoomVal > 1.0 ? `scale(${zoomVal})` : "none";
    videoElem.style.transformOrigin = "center center";
  }
}

/**
 * 💡 Fener (Flashlight) Aç / Kapa
 */
async function toggleFlashlight() {
  if (!activeVideoTrack) return;
  try {
    isTorchOn = !isTorchOn;
    await activeVideoTrack.applyConstraints({
      advanced: [{ torch: isTorchOn }]
    });
    const btnTorch = document.getElementById('btn-fs-torch');
    if (btnTorch) {
      if (isTorchOn) {
        btnTorch.classList.add('active');
        btnTorch.style.background = "rgba(245, 158, 11, 0.4)";
        btnTorch.style.borderColor = "#f59e0b";
        btnTorch.style.color = "#fbbf24";
      } else {
        btnTorch.classList.remove('active');
        btnTorch.style.background = "rgba(30, 41, 59, 0.8)";
        btnTorch.style.borderColor = "rgba(255, 255, 255, 0.2)";
        btnTorch.style.color = "#e2e8f0";
      }
    }
  } catch (e) {
    console.warn("Fener kontrolü desteklenmiyor:", e);
  }
}

/**
 * 📷 Tam Ekran Canlı Kamerayı Aç
 */
async function openFullscreenCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (location.protocol === 'http:') {
      const ok = confirm("🔒 Canlı video kamera için Apple/Chrome güvenlik kuralı gereği HTTPS bağlantısı gereklidir.\n\nHTTPS canlı kamera sayfasına geçmek istiyor musunuz?");
      if (ok) {
        location.href = `https://${location.hostname}:5001/mobile`;
      }
      return;
    }
  }

  const modal = document.getElementById('fullscreen-camera-overlay');
  const videoElem = document.getElementById('fullscreen-video');
  const btnTorch = document.getElementById('btn-fs-torch');

  if (modal) modal.style.display = 'flex';
  isScanningLive = true;
  isTorchOn = false;
  if (btnTorch) btnTorch.style.display = 'none';
  setCameraZoom(1.0);

  // 1. ZXING ENTERPRISE BARKOD MOTORU
  try {
    if (typeof ZXing !== 'undefined') {
      if (!zxingReader) {
        const hints = new Map();
        const formats = [
          ZXing.BarcodeFormat.EAN_13,
          ZXing.BarcodeFormat.EAN_8,
          ZXing.BarcodeFormat.CODE_128,
          ZXing.BarcodeFormat.CODE_39,
          ZXing.BarcodeFormat.UPC_A,
          ZXing.BarcodeFormat.UPC_E,
          ZXing.BarcodeFormat.ITF,
          ZXing.BarcodeFormat.QR_CODE
        ];
        hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, formats);
        hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
        zxingReader = new ZXing.BrowserMultiFormatReader(hints, 30);
      }

      const videoInputDevices = await zxingReader.listVideoInputDevices().catch(() => []);
      let selectedDeviceId = undefined;
      if (videoInputDevices && videoInputDevices.length > 0) {
        const backCam = videoInputDevices.find(d => 
          d.label.toLowerCase().includes('back') || 
          d.label.toLowerCase().includes('arka') || 
          d.label.toLowerCase().includes('rear') ||
          d.label.toLowerCase().includes('environment')
        ) || videoInputDevices[videoInputDevices.length - 1];
        selectedDeviceId = backCam.deviceId;
      }

      // HD ve Sürekli Odak Kısıtlamaları
      const constraints = {
        video: selectedDeviceId ? {
          deviceId: { exact: selectedDeviceId },
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          focusMode: { ideal: "continuous" }
        } : {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          focusMode: { ideal: "continuous" }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints).catch(() => {
        return navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      });

      mediaStreamObj = stream;
      if (videoElem) {
        videoElem.srcObject = stream;
        await videoElem.play();
      }

      // Fener yeteneği var mı kontrol et
      const track = stream.getVideoTracks()[0];
      if (track) {
        activeVideoTrack = track;
        const capabilities = track.getCapabilities ? track.getCapabilities() : {};
        if (capabilities.torch && btnTorch) {
          btnTorch.style.display = 'flex';
        }
      }

      // Donanım BarcodeDetector ve Sunucu Hibrit Çözücüyü Başlat
      startContinuousBarcodeEngine(videoElem);
      return;
    }
  } catch (err) {
    console.warn("ZXing başlatma hatası, fallback deneniyor:", err);
  }

  // 2. FALLBACK: Html5Qrcode Fullscreen
  try {
    if (!html5QrCode) {
      html5QrCode = new Html5Qrcode("fullscreen-reader", {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.QR_CODE
        ],
        verbose: false
      });
    }

    const fsReader = document.getElementById('fullscreen-reader');
    if (fsReader) fsReader.style.display = 'block';
    if (videoElem) videoElem.style.display = 'none';

    await html5QrCode.start(
      { facingMode: "environment" },
      { fps: 30, qrbox: { width: 300, height: 180 } },
      onLiveBarcodeDetected,
      () => {}
    );
    isScanningLive = true;

  } catch (err) {
    console.error("Kamera açılamadı:", err);
    closeFullscreenCamera();
    
    if (location.protocol === 'http:') {
      const ok = confirm("🔒 Canlı video kamera için Apple/Chrome güvenlik kuralı gereği HTTPS bağlantısı gereklidir.\n\nHTTPS canlı kamera sayfasına geçmek istiyor musunuz?");
      if (ok) {
        location.href = `https://${location.hostname}:5001/mobile`;
      }
    } else {
      showToast("⚠️ Kamera izni verilmedi. Lütfen tarayıcı ayarlarından kamera iznini onaylayın.", "error");
    }
  }
}

/**
 * 🔴 30 FPS Canlı Barkod Algılama Motoru
 */
function startContinuousBarcodeEngine(videoElem) {
  if (frameDetectionInterval) clearInterval(frameDetectionInterval);
  if (!videoElem) return;

  frameDetectionInterval = setInterval(async () => {
    if (!isScanningLive || videoElem.readyState < 2) return;

    // 1. İstemci Donanım BarcodeDetector (0ms gecikme)
    if ('BarcodeDetector' in window) {
      try {
        const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code', 'itf'] });
        const barcodes = await detector.detect(videoElem);
        if (barcodes && barcodes.length > 0 && barcodes[0].rawValue && isScanningLive) {
          const raw = barcodes[0].rawValue.trim();
          if (validateBarcodeChecksum(raw)) {
            onLiveBarcodeDetected(raw);
            return;
          }
        }
      } catch(e) {}
    }

    // 2. OpenCV + PyZBar Hibrit Çözücü
    if (!isDecodingServerFrame && isScanningLive) {
      isDecodingServerFrame = true;
      try {
        const vw = videoElem.videoWidth || 1280;
        const vh = videoElem.videoHeight || 720;
        
        const zoomRatio = currentZoomLevel > 1.0 ? currentZoomLevel : 1.0;
        const baseCropW = Math.floor(vw * 0.85);
        const baseCropH = Math.floor(vh * 0.55);
        const cropW = Math.floor(baseCropW / zoomRatio);
        const cropH = Math.floor(baseCropH / zoomRatio);
        const cropX = Math.floor((vw - cropW) / 2);
        const cropY = Math.floor((vh - cropH) / 2);

        roiCanvas.width = 640;
        roiCanvas.height = 360;
        roiCtx.drawImage(videoElem, cropX, cropY, cropW, cropH, 0, 0, 640, 360);

        if (isGlareModeActive) {
          const imgData = roiCtx.getImageData(0, 0, 640, 360);
          const d = imgData.data;
          for (let i = 0; i < d.length; i += 4) {
            const lum = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
            if (lum > 225) {
              d[i] = 190;
              d[i+1] = 190;
              d[i+2] = 190;
            } else if (lum < 110) {
              d[i] = Math.max(0, d[i] - 30);
              d[i+1] = Math.max(0, d[i+1] - 30);
              d[i+2] = Math.max(0, d[i+2] - 30);
            }
          }
          roiCtx.putImageData(imgData, 0, 0);
        }

        const b64 = roiCanvas.toDataURL('image/jpeg', 0.85);
        const res = await fetch('/api/scanner/decode-frame', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: b64, glare_mode: isGlareModeActive })
        });
        const data = await res.json();
        if (data.status === 'success' && data.barcode && isScanningLive) {
          const raw = data.barcode.trim();
          if (validateBarcodeChecksum(raw)) {
            onLiveBarcodeDetected(raw);
          }
        }
      } catch(e) {
      } finally {
        isDecodingServerFrame = false;
      }
    }
  }, 35);
}

/**
 * 🛑 Kamerayı Güvenli Şekilde Kapat
 */
function closeFullscreenCamera() {
  if (frameDetectionInterval) {
    clearInterval(frameDetectionInterval);
    frameDetectionInterval = null;
  }

  if (zxingReader) {
    try {
      zxingReader.reset();
    } catch(e) {}
  }

  if (mediaStreamObj) {
    mediaStreamObj.getTracks().forEach(track => track.stop());
    mediaStreamObj = null;
  }

  activeVideoTrack = null;
  isTorchOn = false;

  const videoElem = document.getElementById('fullscreen-video');
  if (videoElem) {
    videoElem.srcObject = null;
    videoElem.style.transform = "none";
  }

  if (html5QrCode && isScanningLive) {
    try {
      html5QrCode.stop();
    } catch(e) {}
  }

  isScanningLive = false;
  const overlay = document.getElementById('fullscreen-camera-overlay');
  if (overlay) overlay.style.display = 'none';
}

/**
 * 🔴 Barkod Algılandığında Tetiklenen Olay (Konsensüs & Yönlendirme)
 */
function onLiveBarcodeDetected(decodedText) {
  if (!decodedText || !isScanningLive) return;
  const raw = String(decodedText).trim();

  if (!validateBarcodeChecksum(raw)) {
    return;
  }

  const now = Date.now();
  const isChecksumStrict = /^\d{8}$/.test(raw) || /^\d{12}$/.test(raw) || /^\d{13}$/.test(raw);

  if (isChecksumStrict || (barcodeCandidateBuffer.text === raw && now - barcodeCandidateBuffer.lastTime < 400)) {
    barcodeCandidateBuffer = { text: '', count: 0, lastTime: 0 };
    playBeepSound();
    if (navigator.vibrate) navigator.vibrate([100]);

    // POS sekmesinden kamera çağrıldıysa
    if (window._isCameraForPos) {
      submitMobilePosBarcode(raw);
      barcodeCandidateBuffer = { text: '', count: 0, lastTime: now + 1200 };
      return;
    }

    // Stok sayım modundan çağrıldıysa
    if (window._isCameraForAudit) {
      if (typeof onStockAuditBarcodeScanned === 'function') {
        onStockAuditBarcodeScanned(raw);
      }
      barcodeCandidateBuffer = { text: '', count: 0, lastTime: now + 800 };
      return;
    }

    closeFullscreenCamera();
    lookupBarcode(raw);
  } else {
    barcodeCandidateBuffer = { text: raw, count: 1, lastTime: now };
  }
}

/**
 * 🖼️ Galeriden Seçilen Görselden Barkod Çözme
 */
async function handleGalleryImage(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  showToast("⏳ Fotoğraftaki barkod taranıyor...", "success");

  if ('BarcodeDetector' in window) {
    try {
      const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code'] });
      const bitmap = await createImageBitmap(file);
      const barcodes = await detector.detect(bitmap);
      if (barcodes && barcodes.length > 0) {
        const raw = barcodes[0].rawValue.trim();
        if (validateBarcodeChecksum(raw)) {
          playBeepSound();
          if (navigator.vibrate) navigator.vibrate([80]);
          event.target.value = '';
          lookupBarcode(raw);
          return;
        }
      }
    } catch (e) {}
  }

  try {
    if (!html5QrCode) html5QrCode = new Html5Qrcode("fullscreen-reader");
    const decodedText = await html5QrCode.scanFile(file, true);
    const raw = (decodedText || '').trim();
    if (validateBarcodeChecksum(raw)) {
      playBeepSound();
      if (navigator.vibrate) navigator.vibrate([80]);
      lookupBarcode(raw);
      return;
    }
  } catch (err) {}

  // Fallback: Sunucu tarafı CLAHE & OpenCV ile fotoğraftan tara
  try {
    const reader = new FileReader();
    reader.onload = async () => {
      const b64 = reader.result;
      const res = await fetch('/api/scanner/decode-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: b64 })
      });
      const data = await res.json();
      if (data.status === 'success' && data.barcode && validateBarcodeChecksum(data.barcode)) {
        playBeepSound();
        if (navigator.vibrate) navigator.vibrate([80]);
        lookupBarcode(data.barcode);
      } else {
        showToast("❌ Fotoğrafta net bir barkod algılanamadı. Lütfen net bir fotoğraf seçin.", "error");
      }
    };
    reader.readAsDataURL(file);
  } catch (e) {
    showToast("❌ Fotoğraf okuma hatası.", "error");
  } finally {
    event.target.value = '';
  }
}

// Window Global Tanımlamaları
window.toggleGlareMode = toggleGlareMode;
window.setCameraZoom = setCameraZoom;
window.toggleFlashlight = toggleFlashlight;
window.openFullscreenCamera = openFullscreenCamera;
window.closeFullscreenCamera = closeFullscreenCamera;
window.startContinuousBarcodeEngine = startContinuousBarcodeEngine;
window.onLiveBarcodeDetected = onLiveBarcodeDetected;
window.handleGalleryImage = handleGalleryImage;
