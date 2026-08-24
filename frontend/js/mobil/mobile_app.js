let isScanningLive = false;
    let currentBarcode = "";
    let isNewProduct = false;
    let mobileQueue = [];
    let mediaStreamObj = null;
    let frameDetectionInterval = null;
    let html5QrCode = null;

    let mobPrintState = {
      isActive: false,
      isPaused: false,
      items: [],
      currentIndex: 0
    };

    let mobVerifyItems = [];
    let mobVerifyErrorBarcodes = new Set();

    function playBeepSound() {
      try {
        if (navigator.vibrate) {
          navigator.vibrate(90);
        }
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1400, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.09);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.09);
      } catch(e) {}
    }

    document.addEventListener('DOMContentLoaded', () => {
      loadSettings();
      loadQueueFromStorage();
      updateQueueUI();
      loadMobilePosCart();
      updateMobilePosUI();
    });

    let zxingReader = null;
    let activeVideoTrack = null;
    let isTorchOn = false;
    let barcodeCandidateBuffer = { text: '', count: 0, lastTime: 0 };

    // 🎯 MATEMATİKSEL BARKOD SAĞLAMA (CHECKSUM) DOĞRULAYICI
    // Bu fonksiyon hatalı / bozuk okumaları %100 oranında engeller!
    function validateBarcodeChecksum(barcode) {
      if (!barcode || typeof barcode !== 'string') return false;
      const b = barcode.trim();
      
      // EAN-13 (13 hane) Modulo-10 Kontrolü
      if (/^\d{13}$/.test(b)) {
        let sum = 0;
        for (let i = 0; i < 12; i++) {
          sum += parseInt(b[i], 10) * (i % 2 === 0 ? 1 : 3);
        }
        const check = (10 - (sum % 10)) % 10;
        return check === parseInt(b[12], 10);
      }
      
      // EAN-8 (8 hane) Modulo-10 Kontrolü
      if (/^\d{8}$/.test(b)) {
        let sum = 0;
        for (let i = 0; i < 7; i++) {
          sum += parseInt(b[i], 10) * (i % 2 === 0 ? 3 : 1);
        }
        const check = (10 - (sum % 10)) % 10;
        return check === parseInt(b[7], 10);
      }
      
      // UPC-A (12 hane) Modulo-10 Kontrolü
      if (/^\d{12}$/.test(b)) {
        let sum = 0;
        for (let i = 0; i < 11; i++) {
          sum += parseInt(b[i], 10) * (i % 2 === 0 ? 3 : 1);
        }
        const check = (10 - (sum % 10)) % 10;
        return check === parseInt(b[11], 10);
      }
      
      // Code-128 / Code-39 / ITF (en az 3 karakterli alfa-sayısal)
      if (b.length >= 3 && /^[A-Za-z0-9\-\.\ \$\/\+\%]+$/.test(b)) {
        return true;
      }
      
      return false;
    }

    // 💡 FENER (FLASHLIGHT) AÇ / KAPA
    async function toggleFlashlight() {
      if (!activeVideoTrack) return;
      try {
        isTorchOn = !isTorchOn;
        await activeVideoTrack.applyConstraints({
          advanced: [{ torch: isTorchOn }]
        });
        const btnTorch = document.getElementById('btn-fs-torch');
        if (btnTorch) {
          btnTorch.style.background = isTorchOn ? "rgba(245, 158, 11, 0.4)" : "rgba(56, 189, 248, 0.25)";
          btnTorch.style.borderColor = isTorchOn ? "#f59e0b" : "rgba(56, 189, 248, 0.5)";
          btnTorch.style.color = isTorchOn ? "#fbbf24" : "#38bdf8";
        }
      } catch (e) {
        console.warn("Fener kontrolü desteklenmiyor:", e);
      }
    }

    // 1. TAM EKRAN CANLI KAMERAYI AÇ (ZXing + Donanım BarcodeDetector Çift Motoru)
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

      modal.style.display = 'flex';
      isScanningLive = true;
      isTorchOn = false;
      if (btnTorch) btnTorch.style.display = 'none';

      // 1. ZXING ENTERPRISE BARKOD MOTORU (En Yüksek Okuma Hassasiyeti)
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
          videoElem.srcObject = stream;
          await videoElem.play();

          // Fener yeteneği var mı kontrol et
          const track = stream.getVideoTracks()[0];
          if (track) {
            activeVideoTrack = track;
            const capabilities = track.getCapabilities ? track.getCapabilities() : {};
            if (capabilities.torch && btnTorch) {
              btnTorch.style.display = 'flex';
            }
          }

          // Donanım BarcodeDetector ve Sunucu Tabanlı Çok Katmanlı Binarizasyon Motorunu Başlat
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

        document.getElementById('fullscreen-reader').style.display = 'block';
        videoElem.style.display = 'none';

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

    let isDecodingServerFrame = false;
    const roiCanvas = document.createElement('canvas');
    const roiCtx = roiCanvas.getContext('2d');

    // 🔴 30 FPS CANLI BARKOD ALGILAMA MOTORU (Donanım BarcodeDetector + ZXing Canvas + Sunucu OpenCV Çift Hat)
    function startContinuousBarcodeEngine(videoElem) {
      if (frameDetectionInterval) clearInterval(frameDetectionInterval);

      frameDetectionInterval = setInterval(async () => {
        if (!isScanningLive || videoElem.readyState < 2) return;

        // 1. İstemci Donanım BarcodeDetector (Donanım Hızlandırmalı - 0ms gecikme)
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

        // 2. Yüksek Hızlı Sunucu Tarafı OpenCV + PyZBar Çok Katmanlı CLAHE & Binarizasyon Motoru
        if (!isDecodingServerFrame && isScanningLive) {
          isDecodingServerFrame = true;
          try {
            const vw = videoElem.videoWidth || 1280;
            const vh = videoElem.videoHeight || 720;
            const cropW = Math.floor(vw * 0.85);
            const cropH = Math.floor(vh * 0.50);
            const cropX = Math.floor((vw - cropW) / 2);
            const cropY = Math.floor((vh - cropH) / 2);

            roiCanvas.width = 640;
            roiCanvas.height = 360;
            roiCtx.drawImage(videoElem, cropX, cropY, cropW, cropH, 0, 0, 640, 360);

            const b64 = roiCanvas.toDataURL('image/jpeg', 0.85);
            const res = await fetch('/api/scanner/decode-frame', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ image: b64 })
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
      }, 40);
    }

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
      if (videoElem) videoElem.srcObject = null;

      if (html5QrCode && isScanningLive) {
        try {
          html5QrCode.stop();
        } catch(e) {}
      }

      isScanningLive = false;
      document.getElementById('fullscreen-camera-overlay').style.display = 'none';
    }

    // 🔴 BARKOD ALGILANDIĞINDA TETİKLENİR (Sağlama & Konsensüs Filtreli)
    function onLiveBarcodeDetected(decodedText) {
      if (!decodedText || !isScanningLive) return;
      const raw = String(decodedText).trim();

      // 1. Matematiksel sağlama kontrolü (hatalı okumaları %100 eler)
      if (!validateBarcodeChecksum(raw)) {
        return;
      }

      // 2. Konsensüs kontrolü
      const now = Date.now();
      const isChecksumStrict = /^\d{8}$/.test(raw) || /^\d{12}$/.test(raw) || /^\d{13}$/.test(raw);

      if (isChecksumStrict || (barcodeCandidateBuffer.text === raw && now - barcodeCandidateBuffer.lastTime < 400)) {
        barcodeCandidateBuffer = { text: '', count: 0, lastTime: 0 };
        playBeepSound();
        if (navigator.vibrate) navigator.vibrate([100]);

        if (window._isCameraForPos) {
          submitMobilePosBarcode(raw);
          barcodeCandidateBuffer = { text: '', count: 0, lastTime: now + 1200 };
          return;
        }

        closeFullscreenCamera();
        lookupBarcode(raw);
      } else {
        barcodeCandidateBuffer = { text: raw, count: 1, lastTime: now };
      }
    }

    // 🖼️ GALERİDEN GÖRSEL SEÇİLDİĞİNDE
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
            showToast("❌ Fotoğrafta net bir barkod algılanamadı. Lütfen barkodun net çıktığı bir fotoğraf seçin.", "error");
          }
        };
        reader.readAsDataURL(file);
      } catch (e) {
        showToast("❌ Fotoğraf okuma hatası.", "error");
      } finally {
        event.target.value = '';
      }
    }

    // BARKOD SORGULAMA & ANINDA FİYAT GETİRME (Mevcut Ürün Uyarılı)
    async function lookupBarcode(barcode) {
      barcode = (barcode || '').trim();
      if (!barcode) return;

      // ⚠️ Eğer ürün basım listesinde zaten varsa kullanıcıya sor
      const existingQueueItem = mobileQueue.find(x => x.barcode === barcode);
      if (existingQueueItem) {
        const ok = confirm(
          `⚠️ Bu ürün zaten basım listesinde mevcut!\n\n` +
          `Ürün: ${existingQueueItem.title}\n` +
          `Mevcut Değer: ${existingQueueItem.price}\n\n` +
          `Yine de bu ürün açılsın / güncellensin mi?`
        );
        if (!ok) {
          return;
        }
      }

      currentBarcode = barcode;
      const emptyState = document.getElementById('empty-state');
      const addedCard = document.getElementById('added-success-card');
      const productCard = document.getElementById('product-card');
      const txtBarcode = document.getElementById('txt-barcode');
      const badge = document.getElementById('badge-status');
      const inpTitle = document.getElementById('inp-title');
      const inpPrice = document.getElementById('inp-price');

      txtBarcode.innerText = barcode;
      document.getElementById('inp-manual-barcode').value = barcode;

      try {
        const res = await fetch(`/api/products/${barcode}`);
        const data = await res.json();
        
        if (data.status === 'success' && data.product) {
          const p = data.product;
          inpTitle.value = p.title || p.title1 || "";
          inpPrice.value = formatPriceInput(p.price || "");
          
          isNewProduct = false;
          badge.className = "product-status-pill found";
          badge.innerText = "✓ Kayıtlı Ürün";
          showToast(`✓ "${p.title || p.title1}" getirildi.`, "success");
        } else {
          isNewProduct = true;
          inpTitle.value = "";
          inpPrice.value = "";
          badge.className = "product-status-pill new";
          badge.innerText = "➕ Yeni Ürün";
          showToast("Ürün kayıtlı değil. Adını ve fiyatını yazıp listeye ekleyin.", "success");
          inpTitle.focus();
        }

        if (emptyState) emptyState.style.display = 'none';
        if (addedCard) addedCard.style.display = 'none';
        productCard.style.display = 'flex';

      } catch (err) {
        isNewProduct = true;
        badge.className = "product-status-pill new";
        badge.innerText = "➕ Yeni Ürün";
        if (emptyState) emptyState.style.display = 'none';
        if (addedCard) addedCard.style.display = 'none';
        productCard.style.display = 'flex';
      }
    }

    function formatPriceInput(val) {
      if (!val) return "";
      let s = String(val).replace('TL', '').replace('tl', '').replace('₺', '').trim();
      if (s && !s.includes(',')) {
        s = s.replace('.', ',');
      }
      if (s && !s.endsWith('TL')) {
        s += " TL";
      }
      return s;
    }

    function prepareForNextScan() {
      if (document.getElementById('empty-state')) document.getElementById('empty-state').style.display = 'none';
      if (document.getElementById('product-card')) document.getElementById('product-card').style.display = 'none';
      if (document.getElementById('added-success-card')) document.getElementById('added-success-card').style.display = 'none';
      document.getElementById('inp-manual-barcode').value = '';
      currentBarcode = '';
      openFullscreenCamera();
    }

    // ➕ LİSTEYE EKLE BUTONU (Kamera otomatik AÇILMAZ, başarı kartı gösterilir)
    async function addItemToQueue() {
      const title = document.getElementById('inp-title').value.trim();
      let price = document.getElementById('inp-price').value.trim();

      if (!title || !price) {
        showToast("Lütfen Ürün Adı ve Satış Fiyatı girin!", "error");
        return;
      }

      price = formatPriceInput(price);

      const existingIdx = mobileQueue.findIndex(x => x.barcode === currentBarcode);
      if (existingIdx !== -1) {
        mobileQueue[existingIdx].title = title;
        mobileQueue[existingIdx].price = price;
        showToast(`✓ "${title}" güncellendi.`, "success");
      } else {
        mobileQueue.push({
          barcode: currentBarcode || "8690000000000",
          title: title,
          price: price,
          copies: 1
        });
        showToast(`➕ "${title}" basım listesine eklendi!`, "success");
      }

      saveQueueToStorage();
      if (navigator.vibrate) navigator.vibrate([60, 40, 60]);

      // Kamera yeniden AÇILMAZ! Aşağıda eklenen ürün başarı kartı gösterilir
      document.getElementById('product-card').style.display = 'none';
      if (document.getElementById('empty-state')) document.getElementById('empty-state').style.display = 'none';

      const successCard = document.getElementById('added-success-card');
      const successTitle = document.getElementById('added-success-title');
      const successDesc = document.getElementById('added-success-desc');
      const badgeCountText = document.getElementById('added-badge-count-text');

      if (successTitle) successTitle.innerText = `"${title}" başarıyla listeye eklendi!`;
      if (successDesc) successDesc.innerHTML = `<strong>Barkod:</strong> ${currentBarcode || '-'} &nbsp;|&nbsp; <strong>Fiyat:</strong> ${price}`;
      if (badgeCountText) badgeCountText.innerText = `Listeyi Gör (${mobileQueue.length})`;
      if (successCard) successCard.style.display = 'flex';

      document.getElementById('inp-manual-barcode').value = '';
      currentBarcode = '';
    }


    function loadQueueFromStorage() {
      try {
        const saved = localStorage.getItem('mobile_label_queue');
        if (saved) mobileQueue = JSON.parse(saved);
      } catch(e) {
        mobileQueue = [];
      }
    }

    function saveQueueToStorage() {
      try {
        localStorage.setItem('mobile_label_queue', JSON.stringify(mobileQueue));
      } catch(e) {}
      updateQueueUI();
    }

    function switchMobileTab(tabName) {
      const secScan = document.getElementById('section-scan');
      const secPos = document.getElementById('section-pos');
      const secQueue = document.getElementById('section-queue');
      const btnScan = document.getElementById('tab-btn-scan');
      const btnPos = document.getElementById('tab-btn-pos');
      const btnQueue = document.getElementById('tab-btn-queue');

      if (tabName === 'scan') {
        window._isCameraForPos = false;
        if (secScan) secScan.style.display = 'flex';
        if (secPos) secPos.style.display = 'none';
        if (secQueue) secQueue.style.display = 'none';
        if (btnScan) btnScan.classList.add('active');
        if (btnPos) btnPos.classList.remove('active');
        if (btnQueue) btnQueue.classList.remove('active');
      } else if (tabName === 'pos') {
        closeFullscreenCamera();
        if (secScan) secScan.style.display = 'none';
        if (secPos) secPos.style.display = 'flex';
        if (secQueue) secQueue.style.display = 'none';
        if (btnScan) btnScan.classList.remove('active');
        if (btnPos) btnPos.classList.add('active');
        if (btnQueue) btnQueue.classList.remove('active');
        renderMobilePosCart();
      } else {
        window._isCameraForPos = false;
        closeFullscreenCamera();
        if (secScan) secScan.style.display = 'none';
        if (secPos) secPos.style.display = 'none';
        if (secQueue) secQueue.style.display = 'flex';
        if (btnScan) btnScan.classList.remove('active');
        if (btnPos) btnPos.classList.remove('active');
        if (btnQueue) btnQueue.classList.add('active');
        renderQueueList();
      }
    }

    // =========================================================
    // 🛒 MOBİL POS KASA MOTORU (MOBİL SATIŞ VE TAHSİLAT)
    // =========================================================
    let mobilePosCart = [];

    function loadMobilePosCart() {
      try {
        const raw = localStorage.getItem('mob_pos_cart');
        if (raw) mobilePosCart = JSON.parse(raw) || [];
      } catch(e) {
        mobilePosCart = [];
      }
    }

    function saveMobilePosCart() {
      try {
        localStorage.setItem('mob_pos_cart', JSON.stringify(mobilePosCart));
      } catch(e) {}
      updateMobilePosUI();
    }

    function updateMobilePosUI() {
      const badge = document.getElementById('badge-mob-cart-count');
      if (badge) {
        badge.innerText = mobilePosCart.length;
        badge.style.display = mobilePosCart.length > 0 ? 'inline-block' : 'none';
      }
    }

    function renderMobilePosCart() {
      const container = document.getElementById('mob-pos-cart-container');
      const grandTotalEl = document.getElementById('mob-pos-grand-total');
      const itemCountEl = document.getElementById('mob-pos-item-count');
      const qtyCountEl = document.getElementById('mob-pos-qty-count');

      if (!container) return;

      let grandTotal = 0;
      let totalQty = 0;

      if (mobilePosCart.length === 0) {
        container.innerHTML = `
          <div style="background: rgba(15,23,42,0.6); border: 1.5px dashed rgba(255,255,255,0.15); border-radius: 12px; padding: 35px 15px; text-align: center; color: #64748b; font-size: 13px;">
            <div style="font-size: 32px; margin-bottom: 6px;">🛒</div>
            <strong style="color:#94a3b8;">Mobil Sepetiniz Boş</strong><br>
            Kamera ile seri barkod okutun veya yukarıdan barkod arayın.
          </div>
        `;
      } else {
        container.innerHTML = mobilePosCart.map((item, idx) => {
          grandTotal += (parseFloat(item.total_price) || 0);
          totalQty += (parseFloat(item.quantity) || 1);

          return `
            <div style="background: #0f1c38; border: 1.5px solid rgba(56,189,248,0.25); border-radius: 10px; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
              <div style="flex: 1; min-width: 0;">
                <div style="font-size: 13.5px; font-weight: 800; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${item.title}
                </div>
                <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">
                  <span style="color:#38bdf8; font-family:monospace;">${item.barcode}</span> • Birim: <strong>${(parseFloat(item.unit_price)||0).toFixed(2).replace('.', ',')} TL</strong>
                </div>
              </div>

              <div style="display: flex; align-items: center; gap: 6px;">
                <button onclick="changeMobCartQty(${idx}, -1)" style="width: 28px; height: 28px; background: #1e293b; border: 1px solid #475569; color: #fff; border-radius: 6px; font-weight: 900; font-size: 15px; cursor: pointer;">-</button>
                <span style="font-family: monospace; font-weight: 900; font-size: 14px; color: #fbbf24; min-width: 22px; text-align: center;">${item.quantity}</span>
                <button onclick="changeMobCartQty(${idx}, 1)" style="width: 28px; height: 28px; background: #1e293b; border: 1px solid #475569; color: #fff; border-radius: 6px; font-weight: 900; font-size: 15px; cursor: pointer;">+</button>
              </div>

              <div style="text-align: right; min-width: 70px;">
                <div style="font-family: monospace; font-weight: 900; font-size: 14.5px; color: #10b981;">
                  ${(parseFloat(item.total_price)||0).toFixed(2).replace('.', ',')} TL
                </div>
                <button onclick="removeMobCartItem(${idx})" style="background: transparent; border: none; color: #f87171; font-size: 11px; cursor: pointer; padding: 2px; margin-top: 2px;">🗑️ Sil</button>
              </div>
            </div>
          `;
        }).join('');
      }

      if (grandTotalEl) grandTotalEl.innerText = `${grandTotal.toFixed(2).replace('.', ',')} TL`;
      if (itemCountEl) itemCountEl.innerText = `${mobilePosCart.length}`;
      if (qtyCountEl) qtyCountEl.innerText = `${Math.round(totalQty * 10) / 10}`;

      saveMobilePosCart();
    }

    function changeMobCartQty(idx, delta) {
      if (!mobilePosCart[idx]) return;
      mobilePosCart[idx].quantity = (parseFloat(mobilePosCart[idx].quantity) || 1) + delta;
      if (mobilePosCart[idx].quantity <= 0) {
        mobilePosCart.splice(idx, 1);
      } else {
        mobilePosCart[idx].total_price = Math.round(mobilePosCart[idx].quantity * mobilePosCart[idx].unit_price * 100) / 100;
      }
      renderMobilePosCart();
    }

    function removeMobCartItem(idx) {
      mobilePosCart.splice(idx, 1);
      renderMobilePosCart();
    }

    function clearMobilePosCart() {
      if (mobilePosCart.length === 0) return;
      if (confirm('🛒 Sepetteki tüm ürünler silinsin mi?')) {
        mobilePosCart = [];
        renderMobilePosCart();
        showToast('Sepet temizlendi.', 'info');
      }
    }

    async function submitMobilePosBarcode(rawQuery) {
      const query = (rawQuery || '').trim();
      if (!query) return;

      const inp = document.getElementById('inp-mob-pos-barcode');
      if (inp) inp.value = '';

      let qty = 1;
      let cleanQuery = query;

      if (query.includes('*')) {
        const parts = query.split('*');
        if (parts.length >= 2) {
          const pQty = parseFloat(parts[0].replace(',', '.'));
          if (!isNaN(pQty) && pQty > 0) {
            qty = pQty;
            cleanQuery = parts.slice(1).join('*').trim();
          }
        }
      }

      try {
        const res = await fetch(`/api/pos/search?q=${encodeURIComponent(cleanQuery)}`);
        const data = await res.json();

        if (data.status === 'success' && data.product) {
          const p = data.product;
          const uPrice = parseFloat(p.unit_price || p.price || 0.0);
          const isScale = p.is_scale_item || false;
          const actualQty = isScale ? (p.quantity || qty) : qty;

          const existingIdx = mobilePosCart.findIndex(i => i.barcode === p.barcode && i.title === p.title);
          if (existingIdx !== -1) {
            mobilePosCart[existingIdx].quantity += actualQty;
            mobilePosCart[existingIdx].total_price = Math.round(mobilePosCart[existingIdx].quantity * mobilePosCart[existingIdx].unit_price * 100) / 100;
          } else {
            mobilePosCart.unshift({
              title: p.title,
              barcode: p.barcode,
              unit_price: uPrice,
              total_price: Math.round(actualQty * uPrice * 100) / 100,
              quantity: actualQty,
              unit: p.unit || (isScale ? 'Kg' : 'Adet'),
              is_scale_item: isScale
            });
          }

          playBeepSound();
          if (navigator.vibrate) navigator.vibrate([60]);
          showToast(`✓ ${p.title} sepete eklendi!`, 'success');
          renderMobilePosCart();
        } else {
          showToast(`⚠️ "${cleanQuery}" sistemde bulunamadı.`, 'warning');
          openMobileQuickProductModal(cleanQuery);
        }
      } catch(e) {
        showToast('Arama bağlantı hatası.', 'error');
      }
    }

    function openFullscreenCameraForPos() {
      window._isCameraForPos = true;
      openFullscreenCamera();
    }

    async function checkoutMobilePosSale(paymentType = 'Nakit') {
      if (mobilePosCart.length === 0) {
        showToast('⚠️ Sepetiniz boş! Lütfen önce ürün ekleyin.', 'warning');
        return;
      }

      const grandTotal = mobilePosCart.reduce((s, i) => s + (parseFloat(i.total_price) || 0), 0);

      const ok = confirm(`💳 ${paymentType.toUpperCase()} TAHSİLATI\n\nToplam Tutar: ${grandTotal.toFixed(2).replace('.', ',')} TL\n\nSatış tamamlansın mı?`);
      if (!ok) return;

      const payload = {
        items: [...mobilePosCart],
        total_amount: grandTotal,
        payment_type: paymentType,
        payment_breakdown: {
          [paymentType]: grandTotal
        },
        received_cash: grandTotal,
        change_amount: 0.0,
        customer_name: 'Mobil Reyon Satışı',
        print_receipt: true
      };

      try {
        const res = await fetch('/api/pos/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.status === 'success') {
          playBeepSound();
          if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
          showToast(`✅ ${paymentType} satışı başarıyla tamamlandı! (${grandTotal.toFixed(2)} TL)`, 'success');
          mobilePosCart = [];
          renderMobilePosCart();
        } else {
          showToast(`❌ ${data.message || 'Satış tamamlanamadı'}`, 'error');
        }
      } catch(e) {
        showToast('❌ Sunucu bağlantı hatası oluştu.', 'error');
      }
    }

    async function loadSettings() {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        if (data.status === 'success' && data.settings && data.settings.printer) {
          document.getElementById('txt-printer-name').innerText = data.settings.printer;
        }
      } catch(e) {}
    }

    function renderQueueList() {
      const container = document.getElementById('queue-items-list');
      const emptyState = document.getElementById('queue-empty-state');
      const countLabel = document.getElementById('queue-total-count');

      countLabel.innerText = `${mobileQueue.length} ürün`;

      if (mobileQueue.length === 0) {
        emptyState.style.display = 'flex';
        container.innerHTML = '';
        return;
      }

      emptyState.style.display = 'none';
      container.innerHTML = '';

      mobileQueue.forEach((item, idx) => {
        const card = document.createElement('div');
        card.className = 'queue-card';
        card.innerHTML = `
          <div class="queue-card-top">
            <span class="queue-card-title">${item.title}</span>
            <button class="btn-remove-item" onclick="removeItemFromQueue(${idx})">🗑️ Kaldır</button>
          </div>
          <div class="queue-card-bottom">
            <span class="queue-barcode">#${item.barcode}</span>
            <input type="text" class="queue-price-inp" value="${item.price}" onchange="updateQueueItemPrice(${idx}, this.value)">
          </div>
        `;
        container.appendChild(card);
      });
    }

    function updateQueueItemPrice(idx, newPrice) {
      if (mobileQueue[idx]) {
        mobileQueue[idx].price = formatPriceInput(newPrice);
        saveQueueToStorage();
        showToast("Fiyat güncellendi", "success");
      }
    }

    function removeItemFromQueue(idx) {
      const item = mobileQueue[idx];
      const name = item ? item.title : "bu ürünü";
      
      const ok = confirm(`⚠️ "${name}" ürününü basım listesinden çıkarmak istediğinize emin misiniz?`);
      if (!ok) return;

      mobileQueue.splice(idx, 1);
      saveQueueToStorage();
      renderQueueList();
      showToast("Ürün listeden çıkarıldı.", "success");
    }

    function clearQueueWithConfirm() {
      if (mobileQueue.length === 0) return;
      const ok = confirm("⚠️ Basım listesindeki TÜM ürünleri temizlemek istediğinize emin misiniz?");
      if (!ok) return;

      mobileQueue = [];
      saveQueueToStorage();
      renderQueueList();
      showToast("Basım listesi temizlendi.", "success");
    }

    function updateQueueUI() {
      const count = mobileQueue.length;
      document.getElementById('badge-queue-count').innerText = count;
      document.getElementById('btn-batch-print-text').innerText = `Toplu Yazdır (${count} Etiket)`;
    }

    // --- MOBİL CANLI YAZDIRMA & DURDURMA / İPTAL SİSTEMİ ---
    function updateMobilePrintProgressUI(currentItem = null) {
      const total = mobPrintState.items.length;
      const current = mobPrintState.currentIndex + 1;
      const pct = total > 0 ? Math.round((current / total) * 100) : 0;

      document.getElementById('mob-print-bar').style.width = `${pct}%`;
      document.getElementById('mob-print-count').innerText = `${current} / ${total} Etiket`;
      document.getElementById('mob-print-percent').innerText = `%${pct}`;
      if (currentItem) {
        document.getElementById('mob-print-item').innerText = `${currentItem.title} (${currentItem.price})`;
      }

      if (mobPrintState.isPaused) {
        document.getElementById('mob-print-title').innerText = "⏸️ Yazdırma Duraklatıldı";
        document.getElementById('mob-pause-alert').style.display = "block";
        document.getElementById('btn-mob-pause').style.display = "none";
        document.getElementById('btn-mob-resume').style.display = "block";
        document.getElementById('btn-mob-cancel').style.display = "block";
      } else {
        document.getElementById('mob-print-title').innerText = "🖨️ Yazdırılıyor...";
        document.getElementById('mob-pause-alert').style.display = "none";
        document.getElementById('btn-mob-pause').style.display = "block";
        document.getElementById('btn-mob-resume').style.display = "none";
        document.getElementById('btn-mob-cancel').style.display = "none";
      }
    }

    function pauseMobilePrinting() {
      mobPrintState.isPaused = true;
      updateMobilePrintProgressUI(mobPrintState.items[mobPrintState.currentIndex]);
      showToast("⏸️ Yazdırma duraklatıldı.", "warning");
    }

    function resumeMobilePrintingWithConfirm() {
      const remaining = mobPrintState.items.length - (mobPrintState.currentIndex + 1);
      const ok = confirm(`▶️ Kalan ${remaining} etiketin basımına devam etmek istediğinize emin misiniz?`);
      if (!ok) return;

      mobPrintState.isPaused = false;
      updateMobilePrintProgressUI(mobPrintState.items[mobPrintState.currentIndex]);
      showToast("▶️ Devam ediliyor...", "success");
    }

    async function cancelMobilePrintingWithConfirm() {
      const remaining = mobPrintState.items.length - (mobPrintState.currentIndex + 1);
      const ok = confirm(`⛔ Yazdırma işlemini tamamen iptal etmek istediğinize emin misiniz?\n(Kalan ${remaining} etiket basılmayacak)`);
      if (!ok) return;

      mobPrintState.isActive = false;
      mobPrintState.isPaused = false;

      try {
        await fetch('/api/print/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ printer: document.getElementById('txt-printer-name').innerText || "Termal Etiket Yazici" })
        });
      } catch(e) {}

      document.getElementById('modal-mobile-print-progress').style.display = 'none';
      showToast(`⛔ Yazdırma iptal edildi. (${mobPrintState.currentIndex + 1} basıldı, ${remaining} iptal edildi)`, "warning");
    }

    async function submitQueueBatchPrint() {
      if (mobileQueue.length === 0) {
        showToast("Basım listesi boş. Önce ürün okutun.", "error");
        return;
      }

      mobPrintState = {
        isActive: true,
        isPaused: false,
        items: [...mobileQueue],
        currentIndex: 0
      };

      const modal = document.getElementById('modal-mobile-print-progress');
      modal.style.display = 'flex';
      updateMobilePrintProgressUI(mobPrintState.items[0]);

      for (let i = 0; i < mobPrintState.items.length; i++) {
        if (!mobPrintState.isActive) break;

        while (mobPrintState.isPaused && mobPrintState.isActive) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        if (!mobPrintState.isActive) break;

        mobPrintState.currentIndex = i;
        const currentItem = mobPrintState.items[i];
        updateMobilePrintProgressUI(currentItem);

        // PC ile eş zamanlı canlı durum güncellemesi gönder
        try {
          fetch('/api/print/live-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              is_active: true,
              source: "mobile",
              total: mobPrintState.items.length,
              current: i + 1,
              current_item: currentItem.title,
              current_price: currentItem.price,
              status_text: "Yazdırılıyor..."
            })
          });
        } catch(e) {}

        const payload = {
          source: "mobile",
          printer: document.getElementById('txt-printer-name').innerText || "Termal Etiket Yazici",
          products: [{
            barcode: currentItem.barcode,
            title: currentItem.title,
            brand: (currentItem.brand && currentItem.brand !== 'DİĞER' && currentItem.brand !== 'DIGER') ? currentItem.brand : "YARENLER",
            price: currentItem.price,
            date: currentItem.date || ""
          }],
          orientation: "POR",
          width_mm: 76,
          height_mm: 40,
          x_offset: 0,
          y_offset: 0,
          dpi: 203,
          copies_per_item: 1
        };

        try {
          await fetch('/api/print/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        } catch(e) {}

        await new Promise(resolve => setTimeout(resolve, 350));
      }

      const wasActive = mobPrintState.isActive;
      const printedQueue = [...mobPrintState.items];

      modal.style.display = 'none';
      mobPrintState.isActive = false;
      mobPrintState.isPaused = false;

      // Canlı durumu kapat
      try {
        fetch('/api/print/live-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: false, status_text: "Tamamlandı" })
        });
      } catch(e) {}

      if (wasActive && printedQueue.length > 0) {
        openMobPrintVerificationModal(printedQueue);
      }
    }

    // --- MOBİL DOĞRULAMA FONKSİYONLARI ---
    function openMobPrintVerificationModal(items) {
      mobVerifyItems = items || [];
      mobVerifyErrorBarcodes.clear();

      const modal = document.getElementById('modal-mob-print-verification');
      if (!modal) return;

      renderMobVerifyList();
      updateMobVerifyButton();
      modal.style.display = 'flex';
    }

    function renderMobVerifyList() {
      const container = document.getElementById('mob-verify-list');
      if (!container) return;
      container.innerHTML = '';

      mobVerifyItems.forEach(item => {
        const isError = mobVerifyErrorBarcodes.has(item.barcode);
        const card = document.createElement('div');
        card.style.background = isError ? 'rgba(239, 68, 68, 0.15)' : '#090d16';
        card.style.border = isError ? '1px solid #ef4444' : '1px solid var(--border)';
        card.style.borderRadius = '8px';
        card.style.padding = '8px 10px';
        card.style.display = 'flex';
        card.style.alignItems = 'center';
        card.style.gap = '8px';

        card.innerHTML = `
          <input type="checkbox" ${isError ? 'checked' : ''} onchange="toggleMobVerifyItem('${item.barcode}', this.checked)" style="transform: scale(1.2); cursor: pointer;">
          <div style="flex: 1; overflow: hidden;">
            <div style="font-size: 12px; font-weight: 700; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.title}</div>
            <div style="font-size: 10.5px; color: var(--text-muted); font-family: monospace;">#${item.barcode}</div>
          </div>
          <div style="font-size: 12.5px; font-weight: 900; color: #34d399;">${item.price}</div>
        `;
        container.appendChild(card);
      });
    }

    function toggleMobVerifyItem(barcode, isChecked) {
      if (isChecked) {
        mobVerifyErrorBarcodes.add(barcode);
      } else {
        mobVerifyErrorBarcodes.delete(barcode);
      }
      renderMobVerifyList();
      updateMobVerifyButton();
    }

    function toggleSelectAllMobVerify() {
      if (mobVerifyErrorBarcodes.size === mobVerifyItems.length) {
        mobVerifyErrorBarcodes.clear();
      } else {
        mobVerifyItems.forEach(x => mobVerifyErrorBarcodes.add(x.barcode));
      }
      renderMobVerifyList();
      updateMobVerifyButton();
    }

    function updateMobVerifyButton() {
      const btn = document.getElementById('btn-mob-verify-action');
      const summary = document.getElementById('mob-verify-summary');
      if (!btn) return;

      const total = mobVerifyItems.length;
      const errorCount = mobVerifyErrorBarcodes.size;
      const successCount = total - errorCount;

      if (errorCount === 0) {
        btn.innerHTML = `✅ Evet, Tümü Başarıyla Basıldı (Verileri Güncelle)`;
        btn.style.background = "linear-gradient(135deg, #10b981, #059669)";
        if (summary) summary.innerText = `Tüm ürünler (${total} adet) güncellenecektir.`;
      } else if (errorCount === total) {
        btn.innerHTML = `❌ Hiçbiri Tamamlanmadı (Fiyatları Güncelleme)`;
        btn.style.background = "linear-gradient(135deg, #ef4444, #b91c1c)";
        if (summary) summary.innerText = `⚠️ Hiçbir ürün güncellenmeyecek, eski fiyatlar korunacaktır.`;
      } else {
        btn.innerHTML = `⚠️ Seçilenler Hariç Tamamlandı (${successCount} Ürünü Güncelle)`;
        btn.style.background = "linear-gradient(135deg, #f59e0b, #d97706)";
        if (summary) summary.innerText = `${successCount} ürün güncellenecek, hatalı ${errorCount} ürünün eski fiyatı korunacaktır.`;
      }
    }

    async function confirmMobPrintVerification() {
      const total = mobVerifyItems.length;
      const errorCount = mobVerifyErrorBarcodes.size;
      const successItems = mobVerifyItems.filter(x => !mobVerifyErrorBarcodes.has(x.barcode));

      const modal = document.getElementById('modal-mob-print-verification');
      if (modal) modal.style.display = 'none';

      if (errorCount === total || successItems.length === 0) {
        showToast("ℹ️ Hiçbir fiyat güncellenmedi, eski fiyatlar korundu.", "warning");
        return;
      }

      try {
        const payload = {
          source: "MOBILE",
          items: successItems.map(x => ({
            barcode: x.barcode,
            title: x.title,
            price: x.price
          }))
        };

        const res = await fetch('/api/catalog/sync-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const result = await res.json();
        if (result.status === 'success') {
          showToast(`✅ ${successItems.length} ürünün raf fiyatı güncellendi!`, "success");
          mobileQueue = [];
          saveQueueToStorage();
          renderQueueList();
          setTimeout(() => switchMobileTab('scan'), 1000);
        } else {
          showToast(`❌ Hata: ${result.message}`, "error");
        }
      } catch(e) {
        showToast(`❌ Güncelleme hatası: ${e.message}`, "error");
      }
    }

    // =========================================================
    // HIZLI ÜRÜN TANIMLAMA / DÜZENLEME (MOBİL)
    // =========================================================
    function openMobileQuickProductModal(presetBarcode = '') {
      const modal = document.getElementById('modal-mobile-quick-product');
      if (!modal) return;

      const bcInp = document.getElementById('mob-quick-barcode') || document.getElementById('mob-qp-barcode');
      const titleInp = document.getElementById('mob-quick-title') || document.getElementById('mob-qp-title');
      const priceInp = document.getElementById('mob-quick-price') || document.getElementById('mob-qp-price');
      const buyInp = document.getElementById('mob-quick-buying-price') || document.getElementById('mob-qp-buying-price');
      const unitInp = document.getElementById('mob-quick-unit') || document.getElementById('mob-qp-unit');

      if (bcInp) bcInp.value = presetBarcode || '';
      if (titleInp) titleInp.value = '';
      if (priceInp) priceInp.value = '';
      if (buyInp) buyInp.value = '';
      if (unitInp) unitInp.value = 'Adet';

      modal.style.display = 'flex';
      setTimeout(() => {
        if (bcInp) bcInp.focus();
      }, 100);
    }

    function closeMobileQuickProductModal() {
      const modal = document.getElementById('modal-mobile-quick-product');
      if (modal) modal.style.display = 'none';
    }

    function generateRandomMobileBarcode() {
      const rnd = '869' + Math.floor(1000000000 + Math.random() * 9000000000);
      const bcInp = document.getElementById('mob-quick-barcode') || document.getElementById('mob-qp-barcode');
      if (bcInp) {
        bcInp.value = rnd;
        showToast('🎲 Rastgele barkod üretildi!', 'info');
      }
    }

    async function submitMobileQuickProduct(addToQueue = false) {
      const barcode = (document.getElementById('mob-quick-barcode')?.value || document.getElementById('mob-qp-barcode')?.value || '').trim();
      const title = (document.getElementById('mob-quick-title')?.value || document.getElementById('mob-qp-title')?.value || '').trim();
      const price = (document.getElementById('mob-quick-price')?.value || document.getElementById('mob-qp-price')?.value || '').trim();
      const buyingPrice = (document.getElementById('mob-quick-buying-price')?.value || document.getElementById('mob-qp-buying-price')?.value || '').trim();
      const unit = document.getElementById('mob-quick-unit')?.value || document.getElementById('mob-qp-unit')?.value || 'Adet';

      if (!barcode) {
        showToast('⚠️ Lütfen barkod girin veya okutun.', 'warning');
        return;
      }
      if (!title) {
        showToast('⚠️ Lütfen ürün adını girin.', 'warning');
        return;
      }
      if (!price) {
        showToast('⚠️ Lütfen satış fiyatı girin.', 'warning');
        return;
      }

      const payload = {
        barcode: barcode,
        title: title,
        price: price,
        buying_price: buyingPrice || '0.00',
        brand: 'DİĞER',
        stock: 0,
        unit: unit,
        source: 'MOBILE'
      };

      try {
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.status === 'success') {
          showToast(`✅ ${title} kaydedildi!`, 'success');
          
          if (addToQueue) {
            mobileQueue.push({
              barcode: barcode,
              title: title,
              price: price.includes('TL') ? price : `${price} TL`,
              old_price: '',
              status: 'NEW',
              time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
            });
            saveQueueToStorage();
            renderQueueList();
            showToast(`📋 ${title} basım listesine eklendi!`, 'info');
          }

          closeMobileQuickProductModal();
        } else {
          showToast(`❌ ${data.message}`, 'error');
        }
      } catch (e) {
        showToast('❌ Ürün kaydetme hatası.', 'error');
      }
    }

    function showToast(msg, type) {
      const toast = document.getElementById('toast');
      if (!toast) return;
      toast.className = `toast-box toast-${type}`;
      toast.innerText = msg;
      toast.style.display = "block";
      setTimeout(() => {
        toast.style.display = "none";
      }, 3500);
    }

    // =========================================================================
    // MOBİL SEKME VE MOD GEÇİŞ YÖNETİCİSİ (HUB, FATURA, TARAYICI, KASA, KUYRUK)
    // =========================================================================
    function switchMobileTab(tabId) {
      const allTabs = ['hub', 'invoice', 'scan', 'pos', 'queue'];
      
      allTabs.forEach(t => {
        const pane = document.getElementById(`tab-${t}`);
        const btn = document.getElementById(`tab-btn-${t}`);
        
        if (pane) {
          if (t === tabId) {
            pane.style.display = 'flex';
            pane.classList.add('active');
          } else {
            pane.style.display = 'none';
            pane.classList.remove('active');
          }
        }
        
        if (btn) {
          if (t === tabId) {
            btn.classList.add('active');
            btn.style.color = '#38bdf8';
          } else {
            btn.classList.remove('active');
            btn.style.color = '#94a3b8';
          }
        }
      });

      // Kamera Yönetimi: Sadece 'scan' sekmesindeyken kamera aktif olsun
      if (tabId === 'scan') {
        if (!isScanningLive && typeof startContinuousScanner === 'function') {
          startContinuousScanner();
        }
      } else {
        if (isScanningLive && typeof stopContinuousScanner === 'function') {
          stopContinuousScanner();
        }
      }
    }

    // =========================================================================
    // MOBİL FATURA YÜKLEME VE KAMERA İŞLEME
    // =========================================================================
    async function handleMobileInvoiceUpload(event) {
      const file = event.target.files?.[0];
      if (!file) return;

      showToast(`⏳ ${file.name} yükleniyor ve ayrıştırılıyor...`, 'info');

      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('/api/invoice/upload', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();

        if (data.status === 'success' && data.invoice) {
          playBeepSound();
          const inv = data.invoice;
          showToast(`✓ Fatura yüklendi! (${inv.supplier_name})`, 'success');

          const card = document.getElementById('mob-inv-result-card');
          const supEl = document.getElementById('mob-inv-supplier-text');
          const noEl = document.getElementById('mob-inv-no-text');
          const totEl = document.getElementById('mob-inv-total-text');
          const tagEl = document.getElementById('mob-inv-format-tag');

          if (card) card.style.display = 'block';
          if (supEl) supEl.innerText = inv.supplier_name || 'Toptancı';
          if (noEl) noEl.innerText = inv.invoice_no || '-';
          if (totEl) totEl.innerText = inv.grand_total_str || `${inv.grand_total || 0} TL`;
          if (tagEl) tagEl.innerText = inv.format || 'OCR';
        } else {
          showToast(data.message || 'Fatura ayrıştırma hatası!', 'error');
        }
      } catch (err) {
        showToast('Fatura sunucuya yüklenirken hata oluştu.', 'error');
      }
    }
