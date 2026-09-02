// ==========================================
// CORE MODÜLÜ: Global Durum, API, Toast, Tema & Dialoglar
// ==========================================

// Market Raf Etiketi Yönetim Paneli JS Mantığı
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
    setTimeout(() => {
      if (okEl) okEl.focus();
    }, 40);
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

  // Ayarlar sekmesindeki tema kartı butonlarını güncelle
  const darkBtn = document.getElementById('btn-theme-opt-dark');
  const lightBtn = document.getElementById('btn-theme-opt-light');
  const themeBadge = document.getElementById('current-theme-badge');

  if (darkBtn && lightBtn) {
    if (isLight) {
      darkBtn.style.border = '2px solid transparent';
      darkBtn.style.background = '#0f172a';
      lightBtn.style.border = '2px solid #0284c7';
      lightBtn.style.background = '#ffffff';
      lightBtn.style.boxShadow = '0 4px 14px rgba(2,132,199,0.25)';
      darkBtn.style.boxShadow = 'none';
    } else {
      darkBtn.style.border = '2px solid #0284c7';
      darkBtn.style.background = '#070c18';
      darkBtn.style.boxShadow = '0 4px 14px rgba(2,132,199,0.25)';
      lightBtn.style.border = '2px solid transparent';
      lightBtn.style.background = '#f8fafc';
      lightBtn.style.boxShadow = 'none';
    }
  }

  if (themeBadge) {
    themeBadge.innerText = isLight ? 'Aktif Tema: Açık ☀️' : 'Aktif Tema: Koyu 🌙';
    themeBadge.style.color = isLight ? '#0284c7' : '#38bdf8';
  }

  localStorage.setItem('app_theme', theme);
}

function selectAppThemeFromSettings(theme) {
  applyAppTheme(theme);
  if (typeof showToast === 'function') {
    showToast(theme === 'light' ? '☀️ Açık Tema aktif edildi.' : '🌙 Koyu Tema aktif edildi.', 'info');
  }
}
window.selectAppThemeFromSettings = selectAppThemeFromSettings;


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
  startLiveClock();
}

function startLiveClock() {
  function updateClock() {
    const now = new Date();
    const dStr = now.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const tStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const posDateEl = document.getElementById('pos-footer-date');
    const posTimeEl = document.getElementById('pos-footer-time');

    if (posDateEl) posDateEl.innerText = dStr;
    if (posTimeEl) posTimeEl.innerText = tStr;
  }
  updateClock();
  if (!window._liveClockInterval) {
    window._liveClockInterval = setInterval(updateClock, 1000);
  }
}
window.startLiveClock = startLiveClock;


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

  // RBAC Yetki Kontrolü: Giriş yapan kasiyer/çalışan yetkili mi?
  const tabPermMap = {
    'tab-pos': 'perm_pos',
    'tab-catalog': 'perm_catalog_view',
    'tab-manav': 'perm_manav_plu',
    'tab-reports': 'perm_reports',
    'tab-design': 'perm_print_labels',
    'tab-customers': 'perm_customers',
    'tab-accounting': 'perm_accounting',
    'tab-market': 'perm_settings',
    'tab-settings': 'perm_settings',
    'tab-backups': 'perm_settings'
  };

  if (tabPermMap[tabId] && typeof hasPermission === 'function' && !hasPermission(tabPermMap[tabId])) {
    if (typeof showToast === 'function') {
      showToast('⛔ Bu sekmeye erişim yetkiniz bulunmamaktadır. Lütfen yöneticinizle iletişime geçin.', 'warning');
    }
    return;
  }

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
    document.body.classList.remove('catalog-fullscreen');
    try { if (typeof renderPosCart === 'function') renderPosCart(); } catch(e){ console.error(e); }
    try { if (typeof selectPosQuickCategory === 'function') selectPosQuickCategory(window.currentPosQuickCategory || 'manav_adet'); } catch(e){ console.error(e); }
    try { if (typeof initPosBottomButtons === 'function') initPosBottomButtons(); } catch(e){ console.error(e); }
    const inp = document.getElementById('pos-barcode-input');
    if (inp) setTimeout(() => { try { inp.focus(); } catch(e){} }, 150);
  } else if (tabId === 'tab-catalog') {
    document.body.classList.remove('pos-fullscreen');
    document.body.classList.add('catalog-fullscreen');
  } else {
    document.body.classList.remove('pos-fullscreen');
    document.body.classList.remove('catalog-fullscreen');
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
    if (typeof checkDesignStudioPrintersStatus === 'function') checkDesignStudioPrintersStatus();
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
    if (heading) heading.innerText = '⚙️ Termal Etiket Donanım & Kalibrasyon Ayarları';
    if (subheading) subheading.innerText = 'Yazıcı seçimi, kağıt ölçüsü, ofset kalibrasyonu ve baskı kontrastı';
    loadMarketSettings();
  } else if (tabId === 'tab-market') {
    if (heading) heading.innerText = '🏢 Market Profili, Çalışanlar & İzin Matrisi (RBAC)';
    if (subheading) subheading.innerText = 'Şube ve mağaza kimliği, personel kadrosu ve admin yetkilendirme yönetimi';
    if (typeof loadMarketPanel === 'function') loadMarketPanel();
  } else if (tabId === 'tab-accounting' || tabId === 'tab-market-accounting') {
    if (heading) heading.innerText = '💼 Market Gelir / Gider Muhasebesi';
    if (subheading) subheading.innerText = 'Dükkan kirası, personel maaşları, faturalar, toptancı ödemeleri ve net kâr analizi';
    if (typeof loadAccountingOverview === 'function') loadAccountingOverview();
  } else if (tabId === 'tab-invoice') {
    if (heading) heading.innerText = '🧾 Akıllı Fatura Okuma, Sağlama & Ürün Eşleştirme';
    if (subheading) subheading.innerText = 'Toptancı faturalarını okuyun, iskonto ve KDV dahil net maliyetleri çıkarın, stokları otomatik güncelleyin';
    if (typeof loadInvoiceArchiveHistory === 'function') loadInvoiceArchiveHistory();
  } else if (tabId === 'tab-customers') {
    if (heading) heading.innerText = '📒 Müşteri Cari & Veresiye Defteri';
    if (subheading) subheading.innerText = 'Müşteri hesap kartları, veresiye alışveriş hareketleri ve tahsilat takibi';
    if (typeof loadCustomersList === 'function') loadCustomersList();
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
      top: 20px;
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

// ==========================================
// MARKET AYARLARI, POS & KASİYER YÖNETİMİ
// ==========================================

async function loadMarketSettings() {
  try {
    const res = await fetch(`${API_BASE}/api/settings`);
    const data = await res.json();
    if (data.status === 'success' && data.settings) {
      const s = data.settings;
      
      // Market Bilgileri
      if (document.getElementById('settings-market-name') && s.market_name) document.getElementById('settings-market-name').value = s.market_name;
      if (document.getElementById('inp-brand') && s.market_name) document.getElementById('inp-brand').value = s.market_name;
      if (document.getElementById('settings-branch-name') && s.branch_name) document.getElementById('settings-branch-name').value = s.branch_name;
      if (document.getElementById('settings-phone') && s.phone) document.getElementById('settings-phone').value = s.phone;
      if (document.getElementById('settings-address') && s.address) document.getElementById('settings-address').value = s.address;
      if (document.getElementById('settings-tax-office') && s.tax_office) document.getElementById('settings-tax-office').value = s.tax_office;
      if (document.getElementById('settings-tax-no') && s.tax_no) document.getElementById('settings-tax-no').value = s.tax_no;
      if (document.getElementById('settings-receipt-footer-note') && s.receipt_footer_note) document.getElementById('settings-receipt-footer-note').value = s.receipt_footer_note;

      // POS & Komisyon Ayarları
      if (document.getElementById('settings-pos-commission-rate') && s.pos_commission_rate !== undefined) {
        document.getElementById('settings-pos-commission-rate').value = s.pos_commission_rate;
      }
      if (document.getElementById('settings-pos-commission-mode') && s.pos_commission_mode) {
        document.getElementById('settings-pos-commission-mode').value = s.pos_commission_mode;
      }
      if (document.getElementById('settings-default-payment-type') && s.default_payment_type) {
        document.getElementById('settings-default-payment-type').value = s.default_payment_type;
      }
      if (document.getElementById('settings-receipt-print-mode') && s.receipt_print_mode) {
        document.getElementById('settings-receipt-print-mode').value = s.receipt_print_mode;
      }
      if (document.getElementById('settings-receipt-paper-width') && s.receipt_paper_width) {
        document.getElementById('settings-receipt-paper-width').value = s.receipt_paper_width;
      }

      // Termal Donanım Ayarları
      if (document.getElementById('settings-printer-select') && s.printer) document.getElementById('settings-printer-select').value = s.printer;
      if (document.getElementById('settings-darkness') && s.darkness) document.getElementById('settings-darkness').value = s.darkness;
      if (document.getElementById('settings-x-offset') && s.x_offset !== undefined) document.getElementById('settings-x-offset').value = s.x_offset;
      if (document.getElementById('settings-y-offset') && s.y_offset !== undefined) document.getElementById('settings-y-offset').value = s.y_offset;
      if (document.getElementById('settings-orient-select') && s.orientation) document.getElementById('settings-orient-select').value = s.orientation;
      if (s.width_mm && s.height_mm && document.getElementById('settings-size-select')) {
        currentWidth = s.width_mm;
        currentHeight = s.height_mm;
        document.getElementById('settings-size-select').value = `${s.width_mm}x${s.height_mm}`;
      }
    }
  } catch (e) {
    console.error('Ayarlar yükleme hatası:', e);
  }

  // Kasiyer listesini de yükle
  loadCashiersList();
}

async function saveMarketSettings() {
  const sizeVal = (document.getElementById('settings-size-select')?.value || '60x40').split('x');
  
  const payload = {
    // Market Bilgileri
    market_name: document.getElementById('settings-market-name')?.value?.trim() || 'YARENLER MARKET',
    branch_name: document.getElementById('settings-branch-name')?.value?.trim() || 'Merkez Şube',
    phone: document.getElementById('settings-phone')?.value?.trim() || '',
    address: document.getElementById('settings-address')?.value?.trim() || '',
    tax_office: document.getElementById('settings-tax-office')?.value?.trim() || '',
    tax_no: document.getElementById('settings-tax-no')?.value?.trim() || '',
    receipt_footer_note: document.getElementById('settings-receipt-footer-note')?.value?.trim() || '',

    // POS & Komisyon
    pos_commission_rate: parseFloat(document.getElementById('settings-pos-commission-rate')?.value) || 1.85,
    pos_commission_mode: document.getElementById('settings-pos-commission-mode')?.value || 'included',
    default_payment_type: document.getElementById('settings-default-payment-type')?.value || 'Nakit',
    receipt_print_mode: document.getElementById('settings-receipt-print-mode')?.value || 'ask',
    receipt_paper_width: document.getElementById('settings-receipt-paper-width')?.value || '80mm',

    // Donanım & Kalibrasyon
    printer: document.getElementById('settings-printer-select')?.value || 'Termal Etiket Yazici',
    orientation: document.getElementById('settings-orient-select')?.value || 'POR',
    width_mm: parseInt(sizeVal[0]) || 60,
    height_mm: parseInt(sizeVal[1]) || 40,
    darkness: parseInt(document.getElementById('settings-darkness')?.value) || 22,
    x_offset: parseInt(document.getElementById('settings-x-offset')?.value) || 0,
    y_offset: parseInt(document.getElementById('settings-y-offset')?.value) || 0
  };

  try {
    const res = await fetch(`${API_BASE}/api/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.status === 'success') {
      showToast("✓ Market, POS ve Sistem ayarları başarıyla kaydedildi!", "success");
      loadMarketSettings();
    }
  } catch (e) {
    showToast("Ayarları kaydetme hatası!", "error");
  }
}

// 👥 KASİYER YÖNETİMİ
async function loadCashiersList() {
  const tbody = document.getElementById('settings-cashiers-table-body');
  const badge = document.getElementById('cashier-count-badge');
  if (!tbody) return;

  try {
    const res = await fetch(`${API_BASE}/api/cashiers`);
    const data = await res.json();
    if (data.status === 'success' && data.cashiers) {
      const list = data.cashiers;
      if (badge) badge.innerText = `${list.length} Kasiyer`;

      if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 14px; color: #94a3b8;">Kayıtlı kasiyer bulunamadı.</td></tr>`;
        return;
      }

      tbody.innerHTML = list.map(c => {
        const isActive = c.active !== false;
        const roleLabel = c.role === 'admin' ? '👑 Müdür' : (c.role === 'supervisor' ? '⭐ Kasa Şefi' : '👤 Kasiyer');
        return `
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
            <td style="padding: 8px 10px; font-weight: 700; color: #f8fafc;">
              <span style="margin-right: 6px;">${c.role === 'admin' ? '👑' : '👤'}</span>
              ${c.name}
            </td>
            <td style="padding: 8px 10px; font-family: monospace; color: #38bdf8;">${c.id}</td>
            <td style="padding: 8px 10px; font-size: 11px; color: #cbd5e1;">${roleLabel}</td>
            <td style="padding: 8px 10px; text-align: center;">
              <span style="background: ${isActive ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}; color: ${isActive ? '#34d399' : '#f87171'}; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px;">
                ${isActive ? '🟢 Aktif' : '⚪ Pasif'}
              </span>
            </td>
            <td style="padding: 8px 10px; text-align: right; white-space: nowrap;">
              <button type="button" onclick="toggleCashierActive('${c.id}')" class="btn-secondary" style="padding: 3px 8px; font-size: 10.5px; margin-right: 4px;" title="Aktif/Pasif Yap">
                ${isActive ? 'Durdur' : 'Aktif Et'}
              </button>
              <button type="button" onclick="deleteCashier('${c.id}', '${c.name}')" class="btn-secondary" style="padding: 3px 8px; font-size: 10.5px; color: #f87171;" title="Sil">
                🗑️
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }
  } catch (e) {
    console.error('Kasiyer listesi yüklenemedi:', e);
  }
}

async function submitAddNewCashier() {
  const nameInp = document.getElementById('new-cashier-name');
  const idInp = document.getElementById('new-cashier-id');
  const pinInp = document.getElementById('new-cashier-pin');
  const roleInp = document.getElementById('new-cashier-role');

  const name = nameInp ? nameInp.value.trim() : '';
  const id = idInp ? idInp.value.trim() : '';
  const pin = pinInp ? pinInp.value.trim() : '';
  const role = roleInp ? roleInp.value : 'cashier';

  if (!name) {
    showToast('Lütfen kasiyer adını giriniz.', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/cashiers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, id, pin, role, active: true })
    });
    const data = await res.json();
    if (data.status === 'success') {
      showToast(`✓ ${name} başarıyla kasiyer kadrosuna eklendi!`, 'success');
      if (nameInp) nameInp.value = '';
      if (idInp) idInp.value = '';
      if (pinInp) pinInp.value = '';
      loadCashiersList();
    } else {
      showToast(data.message || 'Kasiyer eklenemedi.', 'error');
    }
  } catch (e) {
    showToast('Kasiyer ekleme hatası!', 'error');
  }
}

async function deleteCashier(cid, cname) {
  const ok = await showCustomConfirm(`${cname} isimli kasiyeri sistemden silmek istediğinize emin misiniz?`, 'Kasiyer Sil', 'Sil', 'Vazgeç', '🗑️');
  if (!ok) return;

  try {
    const res = await fetch(`${API_BASE}/api/cashiers/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: cid })
    });
    const data = await res.json();
    if (data.status === 'success') {
      showToast('Kasiyer sistemden silindi.', 'info');
      loadCashiersList();
    }
  } catch (e) {
    showToast('Kasiyer silinirken hata oluştu!', 'error');
  }
}

async function toggleCashierActive(cid) {
  try {
    const res = await fetch(`${API_BASE}/api/cashiers/toggle-active`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: cid })
    });
    const data = await res.json();
    if (data.status === 'success') {
      showToast('Kasiyer durumu güncellendi.', 'success');
      loadCashiersList();
    }
  } catch (e) {
    showToast('Durum güncellenemedi.', 'error');
  }
}

function loadSettings() {
  loadMarketSettings();
}

function saveSettings() {
  saveMarketSettings();
}

// Window Global Bağlantıları
window.loadMarketSettings = loadMarketSettings;
window.saveMarketSettings = saveMarketSettings;
window.loadCashiersList = loadCashiersList;
window.submitAddNewCashier = submitAddNewCashier;
window.deleteCashier = deleteCashier;
window.toggleCashierActive = toggleCashierActive;
window.loadSettings = loadSettings;
window.saveSettings = saveSettings;

// ==========================================
// SOL SIDEBAR DARALTMA / GİZLEME MANTIĞI
// ==========================================

function toggleSidebarCollapse() {
  const sidebar = document.getElementById('app-sidebar');
  const icon = document.getElementById('sidebar-toggle-icon');
  const bottomIcon = document.getElementById('sidebar-bottom-toggle-icon');
  if (!sidebar) return;

  const isCollapsed = sidebar.classList.toggle('collapsed');
  if (icon) icon.innerText = isCollapsed ? '▶' : '◀';
  if (bottomIcon) bottomIcon.innerText = isCollapsed ? '▶' : '◀';

  localStorage.setItem('sidebar_collapsed', isCollapsed ? '1' : '0');
}

function initSidebarState() {
  const isCollapsed = localStorage.getItem('sidebar_collapsed') === '1';
  const sidebar = document.getElementById('app-sidebar');
  const icon = document.getElementById('sidebar-toggle-icon');
  const bottomIcon = document.getElementById('sidebar-bottom-toggle-icon');
  if (sidebar && isCollapsed) {
    sidebar.classList.add('collapsed');
    if (icon) icon.innerText = '▶';
    if (bottomIcon) bottomIcon.innerText = '▶';
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
  if (!m) {
    console.error('Modal bulunamadı:', modalId);
    return;
  }
  if (m.parentElement !== document.body) {
    document.body.appendChild(m);
  }
  m.classList.add('active');
  m.style.removeProperty('display');
  m.style.setProperty('display', 'flex', 'important');
  m.style.setProperty('visibility', 'visible', 'important');
  m.style.setProperty('opacity', '1', 'important');
  m.style.setProperty('pointer-events', 'auto', 'important');
  m.style.setProperty('z-index', '99999999', 'important');
  m.style.setProperty('position', 'fixed', 'important');
  m.style.setProperty('inset', '0px', 'important');
  m.style.setProperty('width', '100vw', 'important');
  m.style.setProperty('height', '100vh', 'important');
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

function triggerBarcodeNotFoundAlert(rawBarcode) {
  let cleanBarcode = String(rawBarcode || '').trim();
  if (cleanBarcode.includes('*')) {
    const parts = cleanBarcode.split('*');
    if (parts.length >= 2) {
      cleanBarcode = parts.slice(1).join('*').trim();
    }
  }

  _lastNotFoundBarcode = cleanBarcode || '';

  // 1. Çift bip uyarı tonu çal ve Türkçe sesli söyle
  playBarcodeNotFoundSound();
  speakBarcodeNotFoundSpeech();

  // 2. Ekrana Görsel Uyarı Modalı Aç
  const modal = document.getElementById('modal-pos-barcode-not-found');
  const codeEl = document.getElementById('barcode-not-found-code');
  if (codeEl) codeEl.innerText = cleanBarcode || '-';

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

function openSetupWizardModal() {
  const sName = document.getElementById('settings-market-name')?.value || '';
  const sBranch = document.getElementById('settings-branch-name')?.value || 'Merkez Şube';
  const sPhone = document.getElementById('settings-phone')?.value || '';
  const sAddr = document.getElementById('settings-address')?.value || '';
  const sTaxOff = document.getElementById('settings-tax-office')?.value || '';
  const sTaxNo = document.getElementById('settings-tax-no')?.value || '';
  const sWidth = document.getElementById('settings-receipt-paper-width')?.value || '80mm';

  if (document.getElementById('wiz-market-name')) document.getElementById('wiz-market-name').value = sName;
  if (document.getElementById('wiz-branch-name')) document.getElementById('wiz-branch-name').value = sBranch;
  if (document.getElementById('wiz-phone')) document.getElementById('wiz-phone').value = sPhone;
  if (document.getElementById('wiz-address')) document.getElementById('wiz-address').value = sAddr;
  if (document.getElementById('wiz-tax-office')) document.getElementById('wiz-tax-office').value = sTaxOff;
  if (document.getElementById('wiz-tax-no')) document.getElementById('wiz-tax-no').value = sTaxNo;
  if (document.getElementById('wiz-paper-width')) document.getElementById('wiz-paper-width').value = sWidth;

  const modal = document.getElementById('modal-setup-wizard');
  if (modal) modal.style.display = 'flex';
}

function closeSetupWizardModal() {
  const modal = document.getElementById('modal-setup-wizard');
  if (modal) modal.style.display = 'none';
}

async function submitSetupWizard() {
  const marketName = document.getElementById('wiz-market-name')?.value?.trim();
  const branchName = document.getElementById('wiz-branch-name')?.value?.trim() || 'Merkez Şube';
  const phone = document.getElementById('wiz-phone')?.value?.trim() || '';
  const address = document.getElementById('wiz-address')?.value?.trim() || '';
  const taxOffice = document.getElementById('wiz-tax-office')?.value?.trim() || '';
  const taxNo = document.getElementById('wiz-tax-no')?.value?.trim() || '';
  const paperWidth = document.getElementById('wiz-paper-width')?.value || '80mm';
  const cashAdvance = parseFloat(document.getElementById('wiz-cash-advance')?.value) || 500.0;
  const footerNote = document.getElementById('wiz-footer-note')?.value?.trim() || 'Bizi tercih ettiğiniz için teşekkür ederiz. İyi günler dileriz!';

  if (!marketName) {
    if (typeof showToast === 'function') showToast('Lütfen market / ticari ünvan adını giriniz.', 'error');
    return;
  }

  const payload = {
    market_name: marketName,
    branch_name: branchName,
    phone: phone,
    address: address,
    tax_office: taxOffice,
    tax_no: taxNo,
    receipt_paper_width: paperWidth,
    daily_cash_advance: cashAdvance,
    receipt_footer_note: footerNote
  };

  try {
    const res = await fetch(`${API_BASE}/api/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.status === 'success') {
      closeSetupWizardModal();
      if (typeof showToast === 'function') showToast(`🎉 "${marketName}" için mağaza kurulumu başarıyla tamamlandı!`, 'success');
      loadMarketSettings();
      if (typeof loadDashboardSummary === 'function') loadDashboardSummary();
      if (typeof loadReceiptDesignSettings === 'function') loadReceiptDesignSettings();
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('Kurulum kaydedilirken hata oluştu.', 'error');
  }
}

function updateSidebarNavVisibility() {
  const navButtons = document.querySelectorAll('.sidebar-nav .nav-item');
  if (!navButtons || navButtons.length === 0) return;

  const currentCashier = (typeof activeCashier !== 'undefined' && activeCashier) ? activeCashier : { id: 'admin', role: 'admin' };
  
  // Varsayılan olarak veya 'admin' / 'SOLO' / 'kasa1' ise veya yetki listesi henüz yüklenmemişse TÜM MENÜYÜ AÇIK TUT
  const isSoloOrAdmin = (!activeCashier || 
                         activeCashier.role === 'admin' || 
                         activeCashier.id === 'admin' || 
                         activeCashier.id === 'kasa1' || 
                         (typeof currentOperatingMode !== 'undefined' && currentOperatingMode === 'SOLO'));

  if (isSoloOrAdmin) {
    navButtons.forEach(btn => {
      btn.style.display = 'flex';
    });
    return;
  }

  // Çalışanın efektif izinlerini bul
  let currentPermissions = [];
  if (typeof marketEmployeesList !== 'undefined' && marketEmployeesList && currentCashier.id) {
    const emp = marketEmployeesList.find(e => String(e.id) === String(currentCashier.id));
    if (emp && emp.effective_permissions) {
      currentPermissions = emp.effective_permissions;
    }
  }

  let activeTabStillVisible = true;

  navButtons.forEach(btn => {
    const perm = btn.getAttribute('data-perm');

    // Admin veya izinsiz genel sekmeler (none) her zaman açık
    if (!perm || perm === 'none') {
      btn.style.display = 'flex';
      return;
    }

    // Yetki kontrolü
    const isGranted = currentPermissions.includes(perm);
    if (isGranted) {
      btn.style.display = 'flex';
    } else {
      btn.style.display = 'none';
      if (btn.classList.contains('active')) {
        activeTabStillVisible = false;
      }
    }
  });

  // Eğer çalışanın o an bulunduğu sekme yetkisizse otomatik olarak yetkili olduğu ilk sekmeye (örn: POS) yönlendir
  if (!activeTabStillVisible) {
    if (currentPermissions.includes('perm_pos')) {
      switchTab('tab-pos');
    } else if (currentPermissions.includes('perm_catalog_view')) {
      switchTab('tab-catalog');
    } else {
      switchTab('tab-home');
    }
  }
}

window.updateSidebarNavVisibility = updateSidebarNavVisibility;
window.openSetupWizardModal = openSetupWizardModal;
window.closeSetupWizardModal = closeSetupWizardModal;
window.submitSetupWizard = submitSetupWizard;
window.openUniversalModal = openUniversalModal;
window.closeUniversalModal = closeUniversalModal;
window.playBarcodeNotFoundSound = playBarcodeNotFoundSound;
window.speakBarcodeNotFoundSpeech = speakBarcodeNotFoundSpeech;
window.triggerBarcodeNotFoundAlert = triggerBarcodeNotFoundAlert;
window.closeBarcodeNotFoundAlert = closeBarcodeNotFoundAlert;
window.openQuickProductFromNotFoundAlert = openQuickProductFromNotFoundAlert;

window.toggleSidebarCollapse = toggleSidebarCollapse;
window.initSidebarState = initSidebarState;
window.formatBarcodeDisplay = formatBarcodeDisplay;
window.showCustomConfirm = showCustomConfirm;
window.showAppConfirm = showCustomConfirm;
window.showCustomPrompt = showCustomPrompt;
window.showAppPrompt = showCustomPrompt;
window._resolveAppConfirm = _resolveAppConfirm;
window._resolveAppPrompt = _resolveAppPrompt;

function formatPhoneNumberString(val) {
  if (!val) return '';
  let str = String(val).trim();
  let digits = str.replace(/\D/g, '');
  if (!digits) return str;

  // Başka ülke kodu (+49, +1, vb.) ile girildiyse
  if (str.startsWith('+') && !digits.startsWith('90')) {
    if (digits.length <= 3) return `+${digits}`;
    if (digits.length <= 6) return `+${digits.slice(0, 2)} ${digits.slice(2)}`;
    if (digits.length <= 9) return `+${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
    return `+${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 12)}`.trim();
  }

  // Türkiye (+90) Formatı
  if (digits.startsWith('90')) {
    digits = digits.substring(2);
  } else if (digits.startsWith('0')) {
    digits = digits.substring(1);
  }

  digits = digits.substring(0, 10);

  if (digits.length === 0) return '+90 ';
  if (digits.length <= 3) return `+90 ${digits}`;
  if (digits.length <= 6) return `+90 ${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `+90 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`;
}

function formatPhoneInput(input) {
  if (!input) return;
  const val = input.value;
  if (!val) return;
  input.value = formatPhoneNumberString(val);
}

function cleanPhoneForWhatsApp(phone) {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('0')) digits = digits.substring(1);
  if (!digits.startsWith('90') && digits.length === 10) digits = '90' + digits;
  return digits;
}

function sendWhatsAppUniversal(phone, text, receiptNo = '') {
  const cleanPhone = cleanPhoneForWhatsApp(phone);
  if (!cleanPhone || cleanPhone.length < 10) {
    if (typeof showToast === 'function') {
      showToast('⚠️ Müşterinin geçerli bir WhatsApp telefon numarası bulunamadı.', 'warning');
    }
    return false;
  }

  // 1. Send message to background queue
  fetch('/api/whatsapp/send_automated', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: cleanPhone,
      text: text,
      receipt_no: receiptNo
    })
  })
  .then(r => r.json())
  .then(data => {
    if (data.status === 'success' && data.is_bot_active) {
      if (typeof showToast === 'function') {
        showToast('💬 WhatsApp mesajı arka planda otomatik olarak gönderiliyor.', 'success');
      }
    } else {
      // Fallback to manual WhatsApp Web tab
      try {
        const webUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
        window.open(webUrl, '_blank');
      } catch (err) {}
      if (typeof showToast === 'function') {
        showToast('💬 Tarayıcı yönlendirmesi ile WhatsApp mesajı hazırlandı.', 'success');
      }
    }
  })
  .catch(e => {
    console.warn('Bot connection warning:', e);
    // Fallback to manual WhatsApp Web tab on network error
    try {
      const webUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
      window.open(webUrl, '_blank');
    } catch (err) {}
  });

  return true;
}

function printPaymentReceiptSlip({
  custName,
  custPhone = '',
  amount = 0,
  payMethod = 'Nakit',
  txType = 'payment',
  oldBalance = 0,
  newBalance = 0,
  dateStr = new Date().toLocaleString('tr-TR'),
  receiptNo = `MAK-${Date.now()}`
}) {
  const printWin = window.open('', '_blank', 'width=380,height=580');
  if (!printWin) return;

  const isDebt = txType === 'debt';
  const title = isDebt ? 'BORÇ EKLEME MAKBUZU' : 'VERESİYE ÖDEME MAKBUZU';

  printWin.document.write(`
    <!DOCTYPE html>
    <html lang="tr">
      <head>
        <meta charset="UTF-8">
        <title>${title} - ${custName}</title>
        <style>
          body { font-family: 'Courier New', Courier, monospace; padding: 12px; margin: 0; font-size: 12px; color: #000; }
          @media print { @page { margin: 0; size: 80mm auto; } body { margin: 2mm; } }
          .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
          .title { font-size: 15px; font-weight: 900; }
          .row { display: flex; justify-content: space-between; margin: 4px 0; }
          .totals { border-top: 1px dashed #000; border-bottom: 2px dashed #000; padding: 6px 0; margin-top: 6px; }
          .bold { font-weight: bold; }
          .footer { text-align: center; margin-top: 10px; font-size: 10.5px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">YARENLER SÜPERMARKET</div>
          <div style="font-size: 11px;">Merkez Şube</div>
          <div style="font-size: 12px; font-weight: bold; margin-top: 4px;">*** ${title} ***</div>
          <div style="font-size: 10.5px; margin-top: 4px;">Tarih: ${dateStr}</div>
          <div style="font-size: 10.5px;">Makbuz No: ${receiptNo}</div>
        </div>

        <div style="margin-bottom: 8px;">
          <div class="row"><span class="bold">Müşteri Adı:</span> <span>${custName}</span></div>
          ${custPhone ? `<div class="row"><span>Telefon:</span> <span>${custPhone}</span></div>` : ''}
          <div class="row"><span>Ödeme Yöntemi:</span> <span>${payMethod}</span></div>
        </div>

        <div class="totals">
          <div class="row bold" style="font-size: 14px;">
            <span>${isDebt ? 'EKLENEN TUTAR:' : 'TAHSİL EDİLEN:'}</span>
            <span>${parseFloat(amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</span>
          </div>
          <div class="row" style="font-size: 11px; margin-top: 4px;">
            <span>Önceki Bakiye:</span>
            <span>${parseFloat(oldBalance).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</span>
          </div>
          <div class="row bold" style="font-size: 13px; margin-top: 4px; border-top: 1px dashed #000; padding-top: 4px;">
            <span>KALAN GÜNCEL BORÇ:</span>
            <span>${parseFloat(newBalance).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</span>
          </div>
        </div>

        <div class="footer">
          <p style="margin: 4px 0; font-weight: bold;">Ödemeniz için teşekkür ederiz!</p>
          <p style="margin: 2px 0; font-size: 9px;">Bilgi amaçlı düzenlenmiştir.</p>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 250);
          };
        <\/script>
      </body>
    </html>
  `);
  printWin.document.close();
}

window.formatPhoneNumberString = formatPhoneNumberString;
window.formatPhoneInput = formatPhoneInput;
window.cleanPhoneForWhatsApp = cleanPhoneForWhatsApp;
window.sendWhatsAppUniversal = sendWhatsAppUniversal;
window.printPaymentReceiptSlip = printPaymentReceiptSlip;

window.addEventListener('keydown', (e) => {
  const confirmModal = document.getElementById('modal-app-confirm');
  if (confirmModal && confirmModal.style.display === 'flex') {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      _resolveAppConfirm(true);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      _resolveAppConfirm(false);
      return;
    }
  }

  const promptModal = document.getElementById('modal-app-prompt');
  if (promptModal && promptModal.style.display === 'flex') {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      const input = document.getElementById('app-prompt-input');
      _resolveAppPrompt(input ? input.value : '');
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      _resolveAppPrompt(null);
      return;
    }
  }

  if (e.key === 'Escape') {
    const confirmModal = document.getElementById('modal-app-confirm');
    const promptModal = document.getElementById('modal-app-prompt');
    if ((confirmModal && confirmModal.style.display === 'flex') || (promptModal && promptModal.style.display === 'flex')) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    closeAllActiveModals();
  }
});

// EVRENSEL MODAL KAPATICI (ESC İLE TÜM AÇIK MODALLARI ANINDA KAPAT VE BARKODA ODAKLAN)
function closeAllActiveModals() {
  if (typeof closePosXReportModal === 'function') closePosXReportModal();
  if (typeof closePosCreditModal === 'function') closePosCreditModal();
  if (typeof closeReturnItemsModal === 'function') closeReturnItemsModal();
  if (typeof closePosReturnModal === 'function') closePosReturnModal();
  if (typeof closeEditSaleModal === 'function') closeEditSaleModal();
  if (typeof closeParkedReceiptsModal === 'function') closeParkedReceiptsModal();
  if (typeof closePosRecentSalesModal === 'function') closePosRecentSalesModal();
  if (typeof closePosQuickProductModal === 'function') closePosQuickProductModal();
  if (typeof closeAddQuickButtonModal === 'function') closeAddQuickButtonModal();
  if (typeof closePosPriceCheckModal === 'function') closePosPriceCheckModal();
  if (typeof closePosCashMovementModal === 'function') closePosCashMovementModal();
  if (typeof closeCashierSwitchModal === 'function') closeCashierSwitchModal();
  if (typeof closePosMobileQrModal === 'function') closePosMobileQrModal();
  if (typeof closePosPaymentModal === 'function') closePosPaymentModal();
  if (typeof closePosClearConfirmModal === 'function') closePosClearConfirmModal();
  if (typeof closeCatalogProductDetailModal === 'function') closeCatalogProductDetailModal();
  if (typeof closePosAutocompletePopup === 'function') closePosAutocompletePopup();

  document.querySelectorAll('.universal-modal-overlay, .modal-backdrop, .modal-overlay, [id^="modal-pos-"], [id^="modal-parked"]').forEach(m => {
    if (m.id !== 'modal-app-confirm' && m.id !== 'modal-app-prompt') {
      if (m.style.display && m.style.display !== 'none') {
        m.style.display = 'none';
      }
      m.classList.remove('active');
    }
  });

  const barInp = document.getElementById('pos-barcode-input');
  if (barInp) {
    setTimeout(() => { try { barInp.focus(); barInp.select(); } catch(err){} }, 30);
  }
}
window.closeAllActiveModals = closeAllActiveModals;

// ==========================================
// TAM EKRAN (FULLSCREEN) YÖNETİMİ (ALT + ENTER / F11)
// ==========================================
function toggleFullScreenMode() {
  // 1. PyWebview Masaüstü Pencere API'si (pywebview.api.toggle_fullscreen)
  if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.toggle_fullscreen === 'function') {
    window.pywebview.api.toggle_fullscreen().catch(err => {
      console.log('Pywebview fullscreen geçiş hatası:', err);
    });
    return;
  }

  // 2. Standart HTML5 Fullscreen API Fallback (Tarayıcı ortamı)
  if (!document.fullscreenElement) {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else if (document.documentElement.webkitRequestFullscreen) {
      document.documentElement.webkitRequestFullscreen();
    } else if (document.documentElement.msRequestFullscreen) {
      document.documentElement.msRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  }
}
window.toggleFullScreenMode = toggleFullScreenMode;

// ALT + ENTER veya F11 ile Tam Ekran Aç / Kapat
window.addEventListener('keydown', (e) => {
  if ((e.altKey && e.key === 'Enter') || e.key === 'F11') {
    e.preventDefault();
    toggleFullScreenMode();
  }
}, true);
// ==========================================
// UYGULAMA GÜVENLİ KAPATMA (ALT + F4 & API)
// ==========================================
function exitDesktopApp() {
  if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.close_app === 'function') {
    window.pywebview.api.close_app();
  } else {
    window.close();
  }
}
window.exitDesktopApp = exitDesktopApp;
