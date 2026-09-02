/**
 * =========================================================================
 * 🔐 MOBIL YETKI: Personel Girişi, PIN Numpad, Yetkiler ve Sekme Geçişi
 * =========================================================================
 */

let selectedEmpForPin = null;
let mobPinBuffer = "";
let mobileEmployeesCache = [];

const ROLE_DEFAULT_PERMS = {
  admin: ['pos_sale', 'view_catalog', 'print_labels', 'edit_prices', 'view_reports', 'kasap_module', 'manav_scale'],
  kasiyer: ['pos_sale', 'view_catalog', 'print_labels', 'print_receipts'],
  manav: ['view_catalog', 'print_labels', 'manav_scale'],
  kasap: ['view_catalog', 'print_labels', 'kasap_module'],
  raf_sorumlusu: ['view_catalog', 'print_labels', 'edit_prices']
};

/**
 * 🚀 Mobil Personel Giriş ve Yetkilendirme Başlatıcı
 */
async function initMobileEmployeeAuth() {
  // 0. İşletme Modu Kontrolü (Tek Kişilik Bakkal / SOLO Modu İse Şifresiz Doğrudan Aç)
  try {
    const modeRes = await fetch('/api/market/operating-mode');
    const modeData = await modeRes.json();
    if (modeData.status === 'success' && modeData.operating_mode === 'SOLO') {
      const soloAdmin = {
        id: 'admin',
        name: 'Yönetici (Patron)',
        role_id: 'admin',
        role_name: 'İşletme Sahibi (Tam Yetkili)',
        effective_permissions: ['pos_sale', 'view_catalog', 'print_labels', 'edit_prices', 'view_reports', 'kasap_module', 'manav_scale']
      };
      currentMobileEmployee = soloAdmin;
      applyMobileEmployeePermissions(soloAdmin);
      switchMobileTab('scan');
      return;
    }
  } catch (e) {
    console.warn("Operating mode check error:", e);
  }

  // 1. URL parametresinde kişisel auth_token var mı? (QR Okutma ile Otomatik Bağlantı)
  const urlParams = new URLSearchParams(window.location.search);
  const urlToken = urlParams.get('auth_token') || urlParams.get('token');

  if (urlToken) {
    try {
      const res = await fetch(`/api/market/employees/by-token?token=${encodeURIComponent(urlToken)}`);
      const data = await res.json();
      if (data.status === 'success' && data.employee) {
        completeMobileAuth(data.employee);
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      } else {
        showToast(`⚠️ ${data.message || 'QR Bağlantı Anahtarı Geçersiz!'}`, 'error');
      }
    } catch (e) {
      console.error("Token ile giriş hatası:", e);
    }
  }

  // 2. Hafızadaki mevcut aktif personel kontrolü
  try {
    const stored = localStorage.getItem('mobile_active_employee');
    if (stored) {
      const emp = JSON.parse(stored);
      if (emp && emp.id) {
        currentMobileEmployee = emp;
        applyMobileEmployeePermissions(emp);
        switchMobileTab('scan');
        return;
      }
    }
  } catch (e) {}

  // 3. Giriş yapılmamışsa modalı aç
  openMobileAuthModal();
}

async function openMobileAuthModal() {
  const modal = document.getElementById('modal-mobile-auth');
  if (modal) modal.style.display = 'flex';
  mobAuthBackToSelect();
  await loadMobileEmployeesForAuth();
}

function closeMobileAuthModal() {
  const modal = document.getElementById('modal-mobile-auth');
  if (modal) modal.style.display = 'none';
}

async function loadMobileEmployeesForAuth() {
  const container = document.getElementById('mob-auth-employees-list');
  if (!container) return;

  container.innerHTML = '<div style="text-align: center; padding: 20px; color: #64748b; font-size: 12px;">Çalışanlar yükleniyor...</div>';

  try {
    const res = await fetch('/api/market/employees');
    const data = await res.json();
    if (data.status === 'success' && Array.isArray(data.employees)) {
      mobileEmployeesCache = data.employees.filter(e => e.active !== false);
      renderMobileEmployeesList(mobileEmployeesCache);
    } else {
      container.innerHTML = '<div style="text-align:center; color:#f87171; font-size:12px;">Personel listesi alınamadı.</div>';
    }
  } catch (e) {
    container.innerHTML = '<div style="text-align:center; color:#f87171; font-size:12px;">Sunucuya bağlanılamadı.</div>';
  }
}

function renderMobileEmployeesList(employees) {
  const container = document.getElementById('mob-auth-employees-list');
  if (!container) return;

  if (employees.length === 0) {
    container.innerHTML = '<div style="text-align:center; color:#64748b; font-size:12px;">Aktif personel bulunamadı.</div>';
    return;
  }

  container.innerHTML = employees.map(emp => {
    const hasPin = Boolean(emp.pin && String(emp.pin).trim() !== "");
    return `
      <div class="mob-emp-row" onclick="selectMobileEmpForLogin('${emp.id}')">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 38px; height: 38px; border-radius: 10px; background: rgba(56,189,248,0.15); border: 1px solid rgba(56,189,248,0.3); display: flex; align-items: center; justify-content: center; font-size: 18px;">
            👤
          </div>
          <div>
            <strong style="color: #f8fafc; font-size: 13.5px; display: block;">${emp.name}</strong>
            <span style="color: #38bdf8; font-size: 11px; font-weight: 700;">${emp.role_name || 'Personel'}</span>
          </div>
        </div>
        <div>
          ${hasPin 
            ? '<span style="background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.4); color: #fbbf24; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 6px;">🔒 PIN</span>' 
            : '<span style="background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.4); color: #34d399; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 6px;">🔓 Giriş</span>'}
        </div>
      </div>
    `;
  }).join('');
}

function selectMobileEmpForLogin(empId) {
  const emp = mobileEmployeesCache.find(e => String(e.id) === String(empId));
  if (!emp) return;

  const hasPin = Boolean(emp.pin && String(emp.pin).trim() !== "");
  if (hasPin) {
    selectedEmpForPin = emp;
    mobPinBuffer = "";
    const stepSelect = document.getElementById('mob-auth-select-step');
    const stepPin = document.getElementById('mob-auth-pin-step');
    const nameEl = document.getElementById('mob-pin-selected-name');
    const roleEl = document.getElementById('mob-pin-selected-role');
    const pinInp = document.getElementById('mob-auth-pin-input');

    if (nameEl) nameEl.innerText = emp.name;
    if (roleEl) roleEl.innerText = emp.role_name || 'Personel';
    if (pinInp) pinInp.value = "";

    if (stepSelect) stepSelect.style.display = 'none';
    if (stepPin) stepPin.style.display = 'flex';
  } else {
    completeMobileAuth(emp);
  }
}

function mobAuthBackToSelect() {
  selectedEmpForPin = null;
  mobPinBuffer = "";
  const stepSelect = document.getElementById('mob-auth-select-step');
  const stepPin = document.getElementById('mob-auth-pin-step');
  if (stepSelect) stepSelect.style.display = 'flex';
  if (stepPin) stepPin.style.display = 'none';
}

function mobAuthNumpadPress(digit) {
  if (mobPinBuffer.length >= 6) return;
  mobPinBuffer += digit;
  const pinInp = document.getElementById('mob-auth-pin-input');
  if (pinInp) pinInp.value = mobPinBuffer;

  if (selectedEmpForPin && mobPinBuffer.length === String(selectedEmpForPin.pin || '').length) {
    mobAuthVerifyPin();
  }
}

function mobAuthNumpadBackspace() {
  mobPinBuffer = mobPinBuffer.slice(0, -1);
  const pinInp = document.getElementById('mob-auth-pin-input');
  if (pinInp) pinInp.value = mobPinBuffer;
}

function mobAuthNumpadClear() {
  mobPinBuffer = "";
  const pinInp = document.getElementById('mob-auth-pin-input');
  if (pinInp) pinInp.value = "";
}

function mobAuthVerifyPin() {
  if (!selectedEmpForPin) return;
  const expectedPin = String(selectedEmpForPin.pin || '').trim();
  if (mobPinBuffer === expectedPin) {
    completeMobileAuth(selectedEmpForPin);
  } else {
    playBeepSound();
    showToast("❌ Hatalı PIN Kodu! Lütfen tekrar deneyin.", "error");
    mobAuthNumpadClear();
  }
}

function completeMobileAuth(emp) {
  currentMobileEmployee = emp;
  try {
    localStorage.setItem('mobile_active_employee', JSON.stringify(emp));
  } catch (e) {}

  closeMobileAuthModal();
  applyMobileEmployeePermissions(emp);
  switchMobileTab('scan');
  playBeepSound();
  showToast(`✅ Hoş geldiniz, ${emp.name}!`, "success");
}

function logoutMobileEmployee() {
  currentMobileEmployee = null;
  try {
    localStorage.removeItem('mobile_active_employee');
  } catch (e) {}
  showToast("🚪 Çıkış yapıldı.", "info");
  openMobileAuthModal();
}

function getMobileEmployeePermissions(emp) {
  if (!emp) return [];
  if (emp.role_id === 'admin') return ROLE_DEFAULT_PERMS.admin;
  if (Array.isArray(emp.permissions) && emp.permissions.length > 0) return emp.permissions;
  if (Array.isArray(emp.custom_permissions) && emp.custom_permissions.length > 0) return emp.custom_permissions;
  return ROLE_DEFAULT_PERMS[emp.role_id] || ['view_catalog', 'print_labels'];
}

function hasMobilePermissionForTab(tabId) {
  if (!currentMobileEmployee) return true;
  const perms = getMobileEmployeePermissions(currentMobileEmployee);
  if (currentMobileEmployee.role_id === 'admin') return true;

  if (tabId === 'pos') return perms.includes('pos_sale');
  if (tabId === 'scan') return perms.includes('view_catalog') || perms.includes('print_labels');
  if (tabId === 'queue') return perms.includes('print_labels');
  return true;
}

function applyMobileEmployeePermissions(emp) {
  if (!emp) return;
  const perms = getMobileEmployeePermissions(emp);

  const headerUserEl = document.getElementById('mob-header-user-name');
  if (headerUserEl) headerUserEl.innerText = emp.name;

  const hubWelcomeEl = document.getElementById('mob-hub-welcome-emp');
  if (hubWelcomeEl) hubWelcomeEl.innerText = `👤 ${emp.name} (${emp.role_name || 'Personel'})`;

  const btnPos = document.getElementById('tab-btn-pos');
  const btnScan = document.getElementById('tab-btn-scan');
  const btnQueue = document.getElementById('tab-btn-queue');

  if (btnPos) btnPos.style.display = perms.includes('pos_sale') || emp.role_id === 'admin' ? 'flex' : 'none';
  if (btnScan) btnScan.style.display = perms.includes('view_catalog') || emp.role_id === 'admin' ? 'flex' : 'none';
  if (btnQueue) btnQueue.style.display = perms.includes('print_labels') || emp.role_id === 'admin' ? 'flex' : 'none';

  const cardPos = document.getElementById('mob-card-pos');
  const cardScan = document.getElementById('mob-card-scan');

  if (cardPos) cardPos.style.display = perms.includes('pos_sale') || emp.role_id === 'admin' ? 'flex' : 'none';
  if (cardScan) cardScan.style.display = perms.includes('view_catalog') || emp.role_id === 'admin' ? 'flex' : 'none';
}

/**
 * =========================================================================
 * 🔄 MOBIL SEKME VE MOD GEÇİŞ YÖNETİCİSİ (Tekilleştirilmiş & Optimize)
 * =========================================================================
 */
function switchMobileTab(tabId) {
  const cleanId = String(tabId).replace('tab-', '').replace('section-', '');
  
  if (!hasMobilePermissionForTab(cleanId)) {
    showToast('⚠️ Bu bölüme erişim yetkiniz bulunmuyor.', 'warning');
    return;
  }

  // Tüm tab panellerini yönet
  const panes = [
    { key: 'hub', el: document.getElementById('tab-hub') },
    { key: 'scan', el: document.getElementById('section-scan') || document.getElementById('tab-scan') },
    { key: 'pos', el: document.getElementById('section-pos') || document.getElementById('tab-pos') },
    { key: 'queue', el: document.getElementById('section-queue') || document.getElementById('tab-queue') },
    { key: 'stock-audit', el: document.getElementById('mob-tab-stock-audit') }
  ];

  panes.forEach(p => {
    if (p.el) {
      if (p.key === cleanId) {
        p.el.style.display = (cleanId === 'scan' || cleanId === 'pos' || cleanId === 'queue') ? 'block' : 'flex';
        p.el.classList.add('active');
      } else {
        p.el.style.display = 'none';
        p.el.classList.remove('active');
      }
    }
  });

  // Alt menü butonlarını güncelle
  const btnKeys = ['hub', 'scan', 'pos', 'queue', 'stock-audit'];
  btnKeys.forEach(k => {
    const btn = document.getElementById(`tab-btn-${k}`);
    if (btn) {
      if (k === cleanId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  });

  // Kamera ve flag yönetimleri
  if (cleanId === 'pos') {
    window._isCameraForPos = false;
    window._isCameraForAudit = false;
    closeFullscreenCamera();
    if (typeof renderMobilePosCart === 'function') renderMobilePosCart();
    if (typeof updateMobilePosUI === 'function') updateMobilePosUI();
  } else if (cleanId === 'queue') {
    window._isCameraForPos = false;
    window._isCameraForAudit = false;
    closeFullscreenCamera();
    if (typeof renderQueueList === 'function') renderQueueList();
    if (typeof updateQueueUI === 'function') updateQueueUI();
  } else if (cleanId === 'stock-audit') {
    window._isCameraForPos = false;
    window._isCameraForAudit = false;
    closeFullscreenCamera();
    if (typeof renderStockAuditUI === 'function') renderStockAuditUI();
  } else if (cleanId === 'scan') {
    window._isCameraForPos = false;
    window._isCameraForAudit = false;
  } else {
    window._isCameraForPos = false;
    window._isCameraForAudit = false;
    closeFullscreenCamera();
  }
}

// Window Global Tanımlamaları
window.initMobileEmployeeAuth = initMobileEmployeeAuth;
window.openMobileAuthModal = openMobileAuthModal;
window.closeMobileAuthModal = closeMobileAuthModal;
window.loadMobileEmployeesForAuth = loadMobileEmployeesForAuth;
window.renderMobileEmployeesList = renderMobileEmployeesList;
window.selectMobileEmpForLogin = selectMobileEmpForLogin;
window.mobAuthBackToSelect = mobAuthBackToSelect;
window.mobAuthNumpadPress = mobAuthNumpadPress;
window.mobAuthNumpadBackspace = mobAuthNumpadBackspace;
window.mobAuthNumpadClear = mobAuthNumpadClear;
window.mobAuthVerifyPin = mobAuthVerifyPin;
window.completeMobileAuth = completeMobileAuth;
window.logoutMobileEmployee = logoutMobileEmployee;
window.getMobileEmployeePermissions = getMobileEmployeePermissions;
window.hasMobilePermissionForTab = hasMobilePermissionForTab;
window.applyMobileEmployeePermissions = applyMobileEmployeePermissions;
window.switchMobileTab = switchMobileTab;
