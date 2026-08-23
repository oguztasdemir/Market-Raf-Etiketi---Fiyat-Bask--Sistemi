// ==========================================
// CORE MODÜLÜ: Global Durum, API, Toast, Tema & Dialoglar
// ==========================================

// Market Raf Etiketi Yönetim Paneli JS Mantığı
let currentScale = 1;
let currentSize = '76x40';
let currentWidth = 76;
let currentHeight = 40;
let selectedPrinter = "Termal Etiket Yazici";
let currentTopRightMode = 'empty';
let activeTemplateId = 'default';
let editingTemplateId = 'default';

let templatesList = [
  {
    id: "default",
    name: "Varsayılan Standart Model",
    is_locked: true,
    top_right_mode: "empty",
    top_right_text: "",
    description: "Görsel 2 standart fabrika raf etiketi."
  }
];

// Backend API URL
const API_BASE = (window.location.protocol === 'file:' || !window.location.port || window.location.port === '5500') 
  ? 'http://127.0.0.1:5000' 
  : '';

let _appConfirmResolve = null;
let _appPromptResolve = null;

function selectSize(sizeStr) {
  currentSize = sizeStr || '76x40';
  if (sizeStr && sizeStr.includes('x')) {
    const parts = sizeStr.split('x');
    currentWidth = parseInt(parts[0], 10) || 76;
    currentHeight = parseInt(parts[1], 10) || 40;
  }
  const sizeSelect = document.getElementById('settings-size-select');
  if (sizeSelect) sizeSelect.value = currentSize;
}

// --- UYGULAMA İÇİ ÖZEL DİYALOG VE ONAY SİSTEMİ (BROWSER POPUPLARI YERİNE) ---


function showCustomConfirm(message, title = "Onay Gerekiyor", okText = "Onayla", cancelText = "Vazgeç", icon = "⚠️") {
  return new Promise((resolve) => {
    _appConfirmResolve = resolve;
    const modal = document.getElementById('modal-app-confirm');
    if (!modal) {
      resolve(true);
      return;
    }
    const tEl = document.getElementById('app-confirm-title-text');
    const iEl = document.getElementById('app-confirm-icon');
    const mEl = document.getElementById('app-confirm-msg');
    const okEl = document.getElementById('app-confirm-btn-ok');
    const cancelEl = document.getElementById('app-confirm-btn-cancel');

    if (tEl) tEl.innerText = title;
    if (iEl) iEl.innerText = icon;
    if (mEl) mEl.innerText = message;
    if (okEl) okEl.innerText = okText;
    if (cancelEl) cancelEl.innerText = cancelText;

    modal.style.display = 'flex';
  });
}


function _resolveAppConfirm(val) {
  const modal = document.getElementById('modal-app-confirm');
  if (modal) modal.style.display = 'none';
  if (_appConfirmResolve) {
    _appConfirmResolve(val);
    _appConfirmResolve = null;
  }
}


function showCustomPrompt(message, defaultValue = "", title = "Bilgi Girişi", okText = "Kaydet", cancelText = "İptal") {
  return new Promise((resolve) => {
    _appPromptResolve = resolve;
    const modal = document.getElementById('modal-app-prompt');
    if (!modal) {
      resolve(defaultValue);
      return;
    }
    const tEl = document.getElementById('app-prompt-title-text');
    const mEl = document.getElementById('app-prompt-msg');
    const input = document.getElementById('app-prompt-input');

    if (tEl) tEl.innerText = title;
    if (mEl) mEl.innerText = message;
    if (input) input.value = defaultValue;

    modal.style.display = 'flex';
    setTimeout(() => {
      if (input) {
        input.focus();
        input.select();
      }
    }, 50);
  });
}


function _resolveAppPrompt(val) {
  const modal = document.getElementById('modal-app-prompt');
  if (modal) modal.style.display = 'none';
  if (_appPromptResolve) {
    _appPromptResolve(val);
    _appPromptResolve = null;
  }
}


function initAppTheme() {
  const savedTheme = localStorage.getItem('app_theme') || 'dark';
  applyAppTheme(savedTheme);
}


function toggleAppTheme() {
  const isLight = document.body.classList.contains('light-theme');
  const newTheme = isLight ? 'dark' : 'light';
  applyAppTheme(newTheme);
}


function applyAppTheme(theme) {
  const isLight = (theme === 'light');
  
  if (isLight) {
    document.body.classList.add('light-theme');
  } else {
    document.body.classList.remove('light-theme');
  }

  // Yuvarlak ve hap tema butonlarını güncelle
  document.querySelectorAll('.btn-theme-circle').forEach(btn => {
    btn.innerHTML = isLight ? `<span>☀️</span>` : `<span>🌙</span>`;
    btn.title = isLight ? "Koyu Moda Geç" : "Açık Moda Geç";
  });

  document.querySelectorAll('.btn-theme-pill').forEach(btn => {
    btn.innerHTML = isLight ? `<span>☀️</span> <span>Açık Mod</span>` : `<span>🌙</span> <span>Koyu Mod</span>`;
  });

  localStorage.setItem('app_theme', theme);
}


async function loadCurrentDate() {
  try {
    const res = await fetch(`${API_BASE}/api/current-date`);
    const data = await res.json();
    if (data.status === 'success' && data.date) {
      const dateInp = document.getElementById('inp-date');
      const dateLbl = document.getElementById('lbl-date');
      const editorDateLbl = document.getElementById('editor-lbl-date');
      if (dateInp) dateInp.value = data.date;
      if (dateLbl) dateLbl.innerText = data.date;
      if (editorDateLbl) editorDateLbl.innerText = data.date;
    }
  } catch(e) {}
}


function switchTab(tabId) {
  if (!tabId || !document.getElementById(tabId) || tabId === 'tab-print') {
    tabId = 'tab-home';
  }

  // F5 ve sekme kalıcılığı (Hem sessionStorage hem URL hash)
  sessionStorage.setItem('active_tab', tabId);
  try {
    history.replaceState(null, null, '#' + tabId);
  } catch (e) {}

  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));

  const activeTabEl = document.getElementById(tabId);
  if (activeTabEl) {
    activeTabEl.classList.add('active');
  }

  // Katalog ve Güncelleme sekmeleri için tam ekran kiti
  if (tabId === 'tab-catalog' || tabId === 'tab-sync' || tabId === 'tab-manav') {
    document.body.classList.add('on-catalog');
  } else {
    document.body.classList.remove('on-catalog');
  }

  const heading = document.getElementById('page-heading');
  const subheading = document.getElementById('page-subheading');

  // Aktif menü butonunu belirle
  document.querySelectorAll('.nav-item').forEach(btn => {
    const attr = btn.getAttribute('onclick') || '';
    if (attr.includes(`'${tabId}'`)) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  if (tabId === 'tab-pos') {
    document.body.classList.add('pos-fullscreen');
    document.body.classList.remove('on-catalog');
    if (typeof renderPosCart === 'function') renderPosCart();
    if (typeof selectPosQuickCategory === 'function') selectPosQuickCategory(window.currentPosQuickCategory || 'manav_adet');
    if (typeof initPosBottomButtons === 'function') initPosBottomButtons();
    const inp = document.getElementById('pos-barcode-input');
    if (inp) setTimeout(() => inp.focus(), 150);
  } else {
    document.body.classList.remove('pos-fullscreen');
  }

  if (tabId === 'tab-home') {
    if (heading) heading.innerText = '🏠 Ana Sayfa & Mağaza Yönetim Merkezi';
    if (subheading) subheading.innerText = 'Canlı satış performansı, kayıtlı ürün özetleri ve donanım durumu';
    if (typeof loadDashboardSummary === 'function') loadDashboardSummary();
  } else if (tabId === 'tab-pos') {
    if (heading) heading.innerText = '🛒 Hızlı Satış & Barkodlu Kasa (POS)';
    if (subheading) subheading.innerText = 'Barkod okutma, terazi entegrasyonu, hızlı tuşlar ve anlık kasa satışı';
  } else if (tabId === 'tab-catalog') {
    if (heading) heading.innerText = '📦 Ürün Kataloğu & Hızlı Baskı';
    if (subheading) subheading.innerText = 'Kayıtlı ürünler, raf fiyatları ve doğrudan termal etiket baskı yönetimi';
    loadCatalog();
  } else if (tabId === 'tab-design') {
    if (heading) heading.innerText = '🎨 Etiket Düzenle & Şablonlar';
    if (subheading) subheading.innerText = 'Özel etiket modelleri oluşturun, özelleştirin ve kaydedin';
    loadTemplates();
  } else if (tabId === 'tab-reports') {
    if (heading) heading.innerText = '📈 Aylık Takvim & Günlük Satış Raporları';
    if (subheading) subheading.innerText = 'Ay ay ciro grafikleri, kasa fişleri, ödeme dağılımı ve günlük detaylar';
    if (typeof initReportsPanel === 'function') initReportsPanel();
  } else if (tabId === 'tab-manav') {
    if (heading) heading.innerText = '🥬 Manav & Barkodlu Terazi Yönetimi';
    if (subheading) subheading.innerText = 'PLU tuşlarına göre ürün yönetimi, teraziye fiyat gönderme ve senkronizasyon';
    initManavPanel();
  } else if (tabId === 'tab-backups') {
    if (heading) heading.innerText = '💾 Veritabanı & Fiyat Yedekleri';
    if (subheading) subheading.innerText = 'Tüm ürün, fiyat ve etiket ayarlarınızın güvenlik yedekleri ve geri yükleme merkezi';
    loadBackupsList();
  } else if (tabId === 'tab-qr') {
    if (heading) heading.innerText = '📱 Mobil QR Bağlantısı';
    if (subheading) subheading.innerText = 'Telefonunuzla reyonlarda gezerken ürün okutup anında etiket basın';
    loadMobileQrCode();
    checkBackendAndDevices();
  } else if (tabId === 'tab-settings') {
    if (heading) heading.innerText = '⚙️ Sistem & Donanım Ayarları';
    if (subheading) subheading.innerText = 'Yazıcı, kağıt ölçüsü, ofset kalibrasyonu ve mağaza bilgileri';
    loadSettings();
  }
}


let _toastTimer = null;
function showToast(msg, type = "info") {
  console.log(`[Bildirim - ${type.toUpperCase()}]:`, msg);

  let container = document.getElementById('global-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'global-toast-container';
    container.style.cssText = `
      position: fixed;
      bottom: 60px;
      right: 24px;
      z-index: 9999999;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
      max-width: 380px;
    `;
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const bgMap = {
    'success': 'linear-gradient(135deg, #059669, #047857)',
    'error': 'linear-gradient(135deg, #dc2626, #b91c1c)',
    'warning': 'linear-gradient(135deg, #d97706, #b45309)',
    'info': 'linear-gradient(135deg, #2563eb, #1d4ed8)'
  };
  const iconMap = {
    'success': '✅',
    'error': '❌',
    'warning': '⚠️',
    'info': 'ℹ️'
  };

  toast.style.cssText = `
    background: ${bgMap[type] || bgMap.info};
    color: #ffffff;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 700;
    box-shadow: 0 10px 25px rgba(0,0,0,0.5), 0 0 1px rgba(255,255,255,0.4) inset;
    display: flex;
    align-items: center;
    gap: 10px;
    animation: toastSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    pointer-events: auto;
    cursor: pointer;
    transition: opacity 0.25s, transform 0.25s;
    user-select: none;
  `;

  const cleanMsg = msg.replace(/^[✅❌⚠️ℹ️📋⚡🗑️💵💳🗄️📜↩️🎁🟢🏢💻👤]\s*/u, '');
  const prefixIcon = msg.match(/^[✅❌⚠️ℹ️📋⚡🗑️💵💳🗄️📜↩️🎁🟢🏢💻👤]/u) ? '' : `${iconMap[type] || 'ℹ️'} `;
  toast.innerHTML = `<span style="font-size: 16px;">${prefixIcon}</span><span>${msg}</span>`;

  toast.onclick = () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 250);
  };

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}


function normalizeTurkish(str) {
  if (!str) return '';
  const charMap = {
    'İ': 'i', 'I': 'i', 'ı': 'i', 'i': 'i',
    'Ş': 's', 'ş': 's',
    'Ğ': 'g', 'ğ': 'g',
    'Ü': 'u', 'ü': 'u',
    'Ö': 'o', 'ö': 'o',
    'Ç': 'c', 'ç': 'c'
  };
  return String(str)
    .replace(/[İIıiŞşĞğÜüÖöÇç]/g, ch => charMap[ch] || ch.toLowerCase())
    .toLowerCase();
}


function formatBarcodeDisplay(bc) {
  if (!bc) return '-';
  let str = String(bc).trim();
  if (str.endsWith(',00') || str.endsWith('.00')) {
    str = str.slice(0, -3);
  } else if (str.endsWith(',0') || str.endsWith('.0')) {
    str = str.slice(0, -2);
  }
  if (str.includes('E+') || str.includes('e+') || str.includes('E-') || str.includes('e-') || (str.includes('E') && /\d/.test(str))) {
    try {
      const num = Number(str.replace(',', '.'));
      if (!isNaN(num) && num > 0) {
        return Math.round(num).toString();
      }
    } catch(e) {}
  }
  return str;
}


function adjustScale(factor) {
  currentScale = Math.min(Math.max(currentScale * factor, 0.5), 3.0);
  applyScale();
}


function resetScale() {
  currentScale = 1;
  applyScale();
}


function applyScale() {
  const label = document.getElementById('market-shelf-label');
  if (label) {
    label.style.transform = `scale(${currentScale})`;
  }
  document.getElementById('zoom-text').innerText = `${Math.round(currentScale * 100)}%`;
}


async function loadSettings() {
  try {
    const res = await fetch(`${API_BASE}/api/settings`);
    const data = await res.json();
    if (data.status === 'success' && data.settings) {
      const s = data.settings;
      if (s.printer && document.getElementById('settings-printer-select')) {
        document.getElementById('settings-printer-select').value = s.printer;
      }
      if (s.market_name) {
        document.getElementById('settings-market-name').value = s.market_name;
        document.getElementById('inp-brand').value = s.market_name;
      }
      if (s.darkness) document.getElementById('settings-darkness').value = s.darkness;
      if (s.x_offset !== undefined) document.getElementById('settings-x-offset').value = s.x_offset;
      if (s.y_offset !== undefined) document.getElementById('settings-y-offset').value = s.y_offset;
      if (s.width_mm && s.height_mm) {
        currentWidth = s.width_mm;
        currentHeight = s.height_mm;
        document.getElementById('settings-size-select').value = `${s.width_mm}x${s.height_mm}`;
      }
    }
  } catch (e) {}
}


async function saveSettings() {
  const sizeVal = document.getElementById('settings-size-select').value.split('x');
  const payload = {
    printer: document.getElementById('settings-printer-select').value,
    orientation: document.getElementById('settings-orient-select').value,
    width_mm: parseInt(sizeVal[0]),
    height_mm: parseInt(sizeVal[1]),
    market_name: document.getElementById('settings-market-name').value.trim(),
    darkness: parseInt(document.getElementById('settings-darkness').value),
    x_offset: parseInt(document.getElementById('settings-x-offset').value),
    y_offset: parseInt(document.getElementById('settings-y-offset').value)
  };

  try {
    const res = await fetch(`${API_BASE}/api/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.status === 'success') {
      showToast("✓ Sistem ayarları başarıyla kaydedildi!", "success");
      loadSettings();
    }
  } catch (e) {
    showToast("Ayarları kaydetme hatası!", "error");
  }
}

// ==========================================
// SOL SIDEBAR DARALTMA / GİZLEME MANTIĞI
// ==========================================

function toggleSidebarCollapse() {
  const sidebar = document.getElementById('app-sidebar');
  const icon = document.getElementById('sidebar-toggle-icon');
  if (!sidebar) return;

  const isCollapsed = sidebar.classList.toggle('collapsed');
  if (icon) icon.innerText = isCollapsed ? '▶' : '◀';

  localStorage.setItem('sidebar_collapsed', isCollapsed ? '1' : '0');
}

function initSidebarState() {
  const isCollapsed = localStorage.getItem('sidebar_collapsed') === '1';
  const sidebar = document.getElementById('app-sidebar');
  const icon = document.getElementById('sidebar-toggle-icon');
  if (sidebar && isCollapsed) {
    sidebar.classList.add('collapsed');
    if (icon) icon.innerText = '▶';
  }
}

// Sayfa yüklendiğinde sidebar durumunu uygula
document.addEventListener('DOMContentLoaded', () => {
  initSidebarState();
});

// ==========================================
// BARKOD BULUNAMADI SESLİ & GÖRSEL UYARI SİSTEMİ
// ==========================================
let _barcodeNotFoundAudioCtx = null;
let _barcodeNotFoundTimer = null;
let _lastNotFoundBarcode = '';

function playBarcodeNotFoundSound() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!_barcodeNotFoundAudioCtx) {
      _barcodeNotFoundAudioCtx = new AudioContextClass();
    }
    if (_barcodeNotFoundAudioCtx.state === 'suspended') {
      _barcodeNotFoundAudioCtx.resume();
    }

    const now = _barcodeNotFoundAudioCtx.currentTime;

    // 1. Ton (800Hz)
    const osc1 = _barcodeNotFoundAudioCtx.createOscillator();
    const gain1 = _barcodeNotFoundAudioCtx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(800, now);
    osc1.frequency.exponentialRampToValueAtTime(350, now + 0.12);
    gain1.gain.setValueAtTime(0.35, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
    osc1.connect(gain1);
    gain1.connect(_barcodeNotFoundAudioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.12);

    // 2. Ton (500Hz)
    const osc2 = _barcodeNotFoundAudioCtx.createOscillator();
    const gain2 = _barcodeNotFoundAudioCtx.createGain();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(500, now + 0.15);
    osc2.frequency.exponentialRampToValueAtTime(200, now + 0.32);
    gain2.gain.setValueAtTime(0.4, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.32);
    osc2.connect(gain2);
    gain2.connect(_barcodeNotFoundAudioCtx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.32);
  } catch (e) {
    console.warn('Audio warning tone error:', e);
  }
}

function speakBarcodeNotFoundSpeech() {
  try {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance('Barkod hatalı');
    msg.lang = 'tr-TR';
    msg.rate = 1.15;
    msg.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const trVoice = voices.find(v => v.lang && (v.lang.startsWith('tr') || v.lang.includes('TR')));
    if (trVoice) {
      msg.voice = trVoice;
    }

    window.speechSynthesis.speak(msg);
  } catch (e) {
    console.warn('SpeechSynthesis error:', e);
  }
}

function openUniversalModal(modalId) {
  const m = typeof modalId === 'string' ? document.getElementById(modalId) : modalId;
  if (!m) return;
  m.classList.add('active');
  m.style.removeProperty('display');
  m.style.setProperty('display', 'flex', 'important');
  m.style.setProperty('visibility', 'visible', 'important');
  m.style.setProperty('opacity', '1', 'important');
  m.style.setProperty('pointer-events', 'auto', 'important');
  m.style.setProperty('z-index', '999999', 'important');

  // Arka plana doğrudan tıklayınca kapatma desteği (mousedown ile güvenli)
  if (!m._hasBackdropClickListener) {
    m.addEventListener('mousedown', (e) => {
      if (e.target === m) {
        closeUniversalModal(m);
      }
    });
    m._hasBackdropClickListener = true;
  }
}

function closeUniversalModal(modalId) {
  const m = typeof modalId === 'string' ? document.getElementById(modalId) : modalId;
  if (!m) return;
  m.classList.remove('active');
  m.style.removeProperty('display');
  m.style.setProperty('display', 'none', 'important');
  m.style.setProperty('visibility', 'hidden', 'important');
  m.style.setProperty('opacity', '0', 'important');
  m.style.setProperty('pointer-events', 'none', 'important');
}

function triggerBarcodeNotFoundAlert(barcode) {
  _lastNotFoundBarcode = barcode || '';

  // 1. Çift bip uyarı tonu çal ve Türkçe sesli söyle
  playBarcodeNotFoundSound();
  speakBarcodeNotFoundSpeech();

  // 2. Ekrana Görsel Uyarı Modalı Aç
  const modal = document.getElementById('modal-pos-barcode-not-found');
  const codeEl = document.getElementById('barcode-not-found-code');
  if (codeEl) codeEl.innerText = barcode || 'Tanımsız';

  if (modal) {
    openUniversalModal(modal);
  }

  // 3. 5 saniye sonra otomatik kapat (kullanıcı kapatmazsa)
  if (_barcodeNotFoundTimer) clearTimeout(_barcodeNotFoundTimer);
  _barcodeNotFoundTimer = setTimeout(() => {
    closeBarcodeNotFoundAlert();
  }, 5000);
}

function closeBarcodeNotFoundAlert() {
  if (_barcodeNotFoundTimer) {
    clearTimeout(_barcodeNotFoundTimer);
    _barcodeNotFoundTimer = null;
  }
  closeUniversalModal('modal-pos-barcode-not-found');
  const barcodeInp = document.getElementById('pos-barcode-input');
  if (barcodeInp) {
    barcodeInp.value = '';
    barcodeInp.focus();
  }
}

function openQuickProductFromNotFoundAlert() {
  const barcodeToRegister = _lastNotFoundBarcode;
  closeBarcodeNotFoundAlert();
  if (typeof openPosQuickProductModal === 'function') {
    openPosQuickProductModal(barcodeToRegister);
  }
}

window.openUniversalModal = openUniversalModal;
window.closeUniversalModal = closeUniversalModal;
window.playBarcodeNotFoundSound = playBarcodeNotFoundSound;
window.speakBarcodeNotFoundSpeech = speakBarcodeNotFoundSpeech;
window.triggerBarcodeNotFoundAlert = triggerBarcodeNotFoundAlert;
window.closeBarcodeNotFoundAlert = closeBarcodeNotFoundAlert;
window.openQuickProductFromNotFoundAlert = openQuickProductFromNotFoundAlert;

window.toggleSidebarCollapse = toggleSidebarCollapse;
window.initSidebarState = initSidebarState;


