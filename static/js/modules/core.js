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
    tabId = 'tab-catalog';
  }

  // Kalıcılık kaydı
  localStorage.setItem('active_tab', tabId);
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

  if (tabId === 'tab-catalog') {
    if (heading) heading.innerText = '📦 Ürün Kataloğu & Hızlı Baskı';
    if (subheading) subheading.innerText = 'Kayıtlı ürünler, raf fiyatları ve doğrudan termal etiket baskı yönetimi';
    loadCatalog();
  } else if (tabId === 'tab-design') {
    if (heading) heading.innerText = '🎨 Etiket Düzenle & Şablonlar';
    if (subheading) subheading.innerText = 'Özel etiket modelleri oluşturun, özelleştirin ve kaydedin';
    loadTemplates();
  } else if (tabId === 'tab-catalog') {
    loadCatalog();
  } else if (tabId === 'tab-sync') {
    if (heading) heading.innerText = '📊 Katalog Güncelleme & Fiyat Senkronizasyonu';
    if (subheading) subheading.innerText = 'Sistem Excel / CSV (.xlsx, .csv) stok listesini içe aktarın, fiyat farklarını tespit edin ve toplu etiket basın';
  } else if (tabId === 'tab-reports') {
    if (heading) heading.innerText = '📈 Günlük Faaliyet & Fiyat Değişiklik Raporları';
    if (subheading) subheading.innerText = 'Mobil ve PC üzerinden yapılan fiyat güncellemeleri ve basılan barkodların günlük arşivi';
    loadDailyReportsSummary();
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


function showToast(msg, type = "info") {
  // Kullanıcı isteği: Sağ üstte bildirim kutusu çıkmasın
  console.log(`[Bildirim - ${type.toUpperCase()}]:`, msg);
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

// Sayfa script ilk çalıştığında da tetikle (hızlı render)
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initSidebarState();
}

window.toggleSidebarCollapse = toggleSidebarCollapse;
window.initSidebarState = initSidebarState;

