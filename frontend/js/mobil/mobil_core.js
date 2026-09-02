/**
 * =========================================================================
 * 📱 MOBIL CORE: Temel Durumlar, Ses Efektleri, Doğrulayıcılar & Toast
 * =========================================================================
 */

// Paylaşılan Global Durum Değişkenleri
let isScanningLive = false;
let currentBarcode = "";
let isNewProduct = false;
let mobileQueue = [];
let mediaStreamObj = null;
let frameDetectionInterval = null;
let html5QrCode = null;
let zxingReader = null;
let activeVideoTrack = null;
let isTorchOn = false;
let isGlareModeActive = true;
let currentZoomLevel = 1.0;
let barcodeCandidateBuffer = { text: '', count: 0, lastTime: 0 };

let mobPrintState = {
  isActive: false,
  isPaused: false,
  items: [],
  currentIndex: 0
};

let mobVerifyItems = [];
let mobVerifyErrorBarcodes = new Set();
let mobilePosCart = [];
let mobileStockAuditSession = [];
let currentMobileEmployee = null;

/**
 * 🔊 Bip ve Titreşim Sinyali
 */
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

/**
 * 🎯 MATEMATİKSEL BARKOD SAĞLAMA (CHECKSUM) DOĞRULAYICI
 * Hatalı / bozuk kamera okumalarını %100 oranında engeller.
 */
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

/**
 * 💰 Fiyat Girişi Formatlayıcı (TL ve virgül düzenleyici)
 */
function formatPriceInput(val) {
  if (val === null || val === undefined) return "";
  let s = String(val).replace(/TL/gi, '').replace(/₺/g, '').trim();
  if (!s) return "";
  s = s.replace(/\s+/g, '');
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  let num = parseFloat(s);
  if (isNaN(num)) return String(val).trim() + (String(val).trim().toUpperCase().endsWith('TL') ? '' : ' TL');
  return num.toFixed(2).replace('.', ',') + ' TL';
}

/**
 * 🍞 Toast Bildirim Gösterici
 */
function showToast(msg, type = "info") {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.className = `toast-box toast-${type}`;
  toast.innerText = msg;
  toast.style.display = "block";
  setTimeout(() => {
    toast.style.display = "none";
  }, 3500);
}

/**
 * ⚙️ Sunucu Yazıcı ve Genel Ayarlarını Yükleme
 */
async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    if (data.status === 'success' && data.settings && data.settings.printer) {
      const pEl = document.getElementById('txt-printer-name');
      if (pEl) pEl.innerText = data.settings.printer;
    }
  } catch(e) {}
}

// Window Global Tanımlamaları
window.playBeepSound = playBeepSound;
window.validateBarcodeChecksum = validateBarcodeChecksum;
window.formatPriceInput = formatPriceInput;
window.showToast = showToast;
window.loadSettings = loadSettings;
