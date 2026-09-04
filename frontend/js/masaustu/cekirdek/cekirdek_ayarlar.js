// -*- coding: utf-8 -*-
/**
 * SİSTEM AYARLARI & KASİYER YÖNETİMİ (cekirdek_ayarlar.js)
 */

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

