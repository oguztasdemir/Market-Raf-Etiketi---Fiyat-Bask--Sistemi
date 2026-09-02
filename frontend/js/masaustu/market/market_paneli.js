/**
 * =========================================================
 * MARKET YÖNETİMİ, ÇALIŞANLAR, ÇALIŞMA ALANLARI (RBAC) & PERFORMANS RAPORLARI
 * =========================================================
 */

let marketProfileData = {};
let marketEmployeesList = [];
let marketRolesList = [];
let permissionsCatalog = [];
let currentOperatingMode = 'SOLO';
let currentEditingEmpId = null;
let currentEditingRoleId = null;
let currentPermEmp = null;
let currentPermWorkingSet = new Set();
let currentRoleWorkingPerms = new Set();
let currentEmployeeShiftState = { status: "working" };
let employeeShiftStates = {};

/**
 * Market Panelini Başlatır
 */
async function loadMarketPanel() {
  await Promise.all([
    loadMarketOperatingMode(),
    loadMarketProfile(),
    loadMarketRoles(),
    loadMarketEmployees(),
    loadMarketEmployeeReports()
  ]);
}

/**
 * Alt Sekme Değiştirici (Çalışanlar / Roller & Reyonlar / Raporlar)
 */
function switchMarketSubTab(subTab) {
  const btnTeam = document.getElementById('mkt-subtab-btn-team');
  const btnRoles = document.getElementById('mkt-subtab-btn-roles');
  const btnReports = document.getElementById('mkt-subtab-btn-reports');
  
  const paneTeam = document.getElementById('mkt-subpane-team');
  const paneRoles = document.getElementById('mkt-subpane-roles');
  const paneReports = document.getElementById('mkt-subpane-reports');

  // Buton stillerini sıfırla
  [btnTeam, btnRoles, btnReports].forEach(b => {
    if (b) {
      b.className = 'btn-secondary';
      b.style.background = 'transparent';
      b.style.color = '#94a3b8';
    }
  });

  // Panelleri gizle
  if (paneTeam) paneTeam.style.display = 'none';
  if (paneRoles) paneRoles.style.display = 'none';
  if (paneReports) paneReports.style.display = 'none';

  if (subTab === 'team') {
    if (btnTeam) { btnTeam.className = 'btn-primary'; btnTeam.style.background = '#0284c7'; btnTeam.style.color = '#fff'; }
    if (paneTeam) paneTeam.style.display = 'flex';
  } else if (subTab === 'roles') {
    if (btnRoles) { btnRoles.className = 'btn-primary'; btnRoles.style.background = '#a855f7'; btnRoles.style.color = '#fff'; }
    if (paneRoles) paneRoles.style.display = 'flex';
    renderMarketRoles();
  } else {
    if (btnReports) { btnReports.className = 'btn-primary'; btnReports.style.background = '#0284c7'; btnReports.style.color = '#fff'; }
    if (paneReports) paneReports.style.display = 'flex';
    loadMarketEmployeeReports();
  }
}

async function loadMarketOperatingMode() {
  try {
    const res = await fetch('/api/market/operating-mode');
    const data = await res.json();
    if (data.status === 'success' && data.operating_mode) {
      currentOperatingMode = data.operating_mode;
      renderMarketOperatingModeUI(currentOperatingMode);
    }
  } catch (err) {
    console.error("Çalışma modu alınamadı:", err);
  }
}

function renderMarketOperatingModeUI(mode) {
  currentOperatingMode = 'STRICT_RBAC';
  const btnTeam = document.getElementById('mkt-subtab-btn-team');
  const btnAddEmp = document.getElementById('btn-mkt-add-employee');

  if (btnTeam) btnTeam.style.display = 'flex';
  if (btnAddEmp) btnAddEmp.style.display = 'flex';
}

async function setMarketOperatingMode(newMode) {
  try {
    const res = await fetch('/api/market/operating-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operating_mode: newMode })
    });
    const data = await res.json();
    if (data.status === 'success') {
      renderMarketOperatingModeUI(newMode);
      if (typeof showToast === 'function') {
        showToast(`✓ ${data.message}`, "success");
      }
    } else {
      if (typeof showToast === 'function') showToast(`❌ ${data.message}`, "error");
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast("Bağlantı hatası oluştu.", "error");
  }
}

/**
 * 1. Market Profil Bilgilerini Getirir & Kaydeder
 */
async function loadMarketProfile() {
  try {
    const res = await fetch('/api/market/profile');
    const data = await res.json();
    if (data.status === 'success' && data.profile) {
      marketProfileData = data.profile;
      if (data.profile.operating_mode) {
        currentOperatingMode = data.profile.operating_mode;
        renderMarketOperatingModeUI(currentOperatingMode);
      }
      
      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
      };

      setVal('mkt-inp-name', marketProfileData.market_name);
      setVal('mkt-inp-branch', marketProfileData.branch);
      setVal('mkt-inp-authorized', marketProfileData.authorized_person);
      setVal('mkt-inp-phone', marketProfileData.phone);
      setVal('mkt-inp-tax-office', marketProfileData.tax_office);
      setVal('mkt-inp-tax-no', marketProfileData.tax_number);
      setVal('mkt-inp-address', marketProfileData.address);
      setVal('mkt-inp-footer-note', marketProfileData.receipt_footer_note);
    }
  } catch (err) {
    console.error("Market profili yüklenirken hata:", err);
  }
}

async function saveMarketProfile() {
  const getVal = (id) => document.getElementById(id)?.value?.trim() || '';

  const payload = {
    market_name: getVal('mkt-inp-name'),
    branch: getVal('mkt-inp-branch'),
    authorized_person: getVal('mkt-inp-authorized'),
    phone: getVal('mkt-inp-phone'),
    tax_office: getVal('mkt-inp-tax-office'),
    tax_number: getVal('mkt-inp-tax-no'),
    address: getVal('mkt-inp-address'),
    receipt_footer_note: getVal('mkt-inp-footer-note')
  };

  try {
    const res = await fetch('/api/market/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.status === 'success') {
      if (typeof showToast === 'function') showToast("✅ Market profil bilgileri kaydedildi.", "success");
    } else {
      if (typeof showToast === 'function') showToast(`❌ ${data.message || 'Hata oluştu'}`, "error");
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast("❌ Sunucu bağlantı hatası.", "error");
  }
}

/**
 * 2. Çalışma Alanları (Roller & Reyonlar)
 */
async function loadMarketRoles() {
  try {
    const res = await fetch('/api/market/roles');
    const data = await res.json();
    if (data.status === 'success' && data.roles) {
      marketRolesList = data.roles;
      if (data.permissions_catalog) permissionsCatalog = data.permissions_catalog;
      renderMarketRoles();
      populateRoleDropdown();
    }
  } catch (err) {
    console.error("Roller yüklenirken hata:", err);
  }
}

function renderMarketRoles() {
  // 1. Özet Liste (Market Sekmesindeki Kart)
  const container = document.getElementById('market-roles-container');
  if (container) {
    if (marketRolesList.length === 0) {
      container.innerHTML = `<div style="color: var(--text-muted); font-size: 12px; padding: 10px;">Rol tanımı bulunamadı.</div>`;
    } else {
      container.innerHTML = marketRolesList.map(r => {
        const permCount = r.permissions ? r.permissions.length : 0;
        const isActive = r.is_active !== false;
        return `
          <div style="background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); border-left: 3px solid ${r.color || '#38bdf8'}; border-radius: 6px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 18px;">${r.icon || '💼'}</span>
              <div>
                <strong style="color: ${isActive ? 'var(--text-main)' : 'var(--text-muted)'}; font-size: 12.5px; display: block;">${r.name} ${!isActive ? '<small style="color:#ef4444; font-weight:normal;">(Pasif)</small>' : ''}</strong>
                <small style="color: var(--text-muted); font-size: 11px;">${r.description || ''}</small>
              </div>
            </div>
            <span style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); color: ${r.color || '#38bdf8'}; font-size: 10.5px; font-weight: 700; padding: 2px 7px; border-radius: 4px;">
              ${permCount} Yetki
            </span>
          </div>
        `;
      }).join('');
    }
  }

  // 2. Tam Yönetim Grid (Çalışma Alanları & Reyonlar Sekmesi)
  const fullGrid = document.getElementById('market-full-roles-grid');
  if (fullGrid) {
    fullGrid.innerHTML = marketRolesList.map(r => {
      const permCount = r.permissions ? r.permissions.length : 0;
      const isActive = r.is_active !== false;
      const assignedEmpsCount = marketEmployeesList.filter(e => e.role_id === r.id).length;
      const isSystemRole = (r.id === 'admin' || r.id === 'kasiyer');

      return `
        <div style="background: #0f172a; border: 1.5px solid ${isActive ? (r.color || '#334155') : '#1e293b'}; border-radius: 12px; padding: 16px; box-shadow: 0 8px 20px rgba(0,0,0,0.5); display: flex; flex-direction: column; gap: 12px; opacity: ${isActive ? '1' : '0.65'};">
          
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 26px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 4px 8px;">${r.icon || '💼'}</span>
              <div>
                <strong style="color: #f8fafc; font-size: 15px; display: block;">${r.name}</strong>
                <span style="font-size: 11px; color: ${r.color || '#38bdf8'}; font-weight: 700;">${assignedEmpsCount} Atanmış Çalışan</span>
              </div>
            </div>
            
            <!-- Reyon Açık/Kapalı Switch -->
            <button type="button" onclick="toggleRoleActiveStatus('${r.id}')" style="padding: 4px 9px; font-size: 11px; font-weight: 800; border-radius: 6px; cursor: pointer; border: none; ${
              isActive 
                ? 'background: rgba(16,185,129,0.2); border: 1px solid rgba(16,185,129,0.4); color: #34d399;' 
                : 'background: rgba(239,68,68,0.2); border: 1px solid rgba(239,68,68,0.4); color: #f87171;'
            }">
              ${isActive ? '✓ Reyon Aktif' : '✕ Reyon Kapalı'}
            </button>
          </div>

          <p style="color: #94a3b8; font-size: 11.5px; margin: 0; line-height: 1.4; min-height: 32px;">
            ${r.description || 'Bu çalışma alanına özel açıklama tanımlanmamış.'}
          </p>

          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 10px; margin-top: auto;">
            <span style="font-size: 11.5px; font-weight: 800; color: #cbd5e1; font-family: monospace;">
              🔒 ${permCount} Standart İzin
            </span>
            <div style="display: flex; gap: 6px;">
              <button type="button" onclick="openEditRoleModal('${r.id}')" style="padding: 5px 12px; font-size: 11.5px; font-weight: 700; background: #1e293b; border: 1px solid #475569; color: #38bdf8; border-radius: 6px; cursor: pointer;">
                ✏️ Yetkileri Düzenle
              </button>
              ${!isSystemRole ? `
                <button type="button" onclick="deleteCustomRole('${r.id}')" style="padding: 5px 9px; font-size: 11.5px; font-weight: 700; background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #f87171; border-radius: 6px; cursor: pointer;" title="Çalışma Alanını Sil">
                  🗑️
                </button>
              ` : ''}
            </div>
          </div>

        </div>
      `;
    }).join('');
  }
}

function populateRoleDropdown() {
  const select = document.getElementById('emp-form-role');
  if (!select) return;

  select.innerHTML = marketRolesList
    .filter(r => r.is_active !== false)
    .map(r => `
      <option value="${r.id}">${r.icon || ''} ${r.name}</option>
    `).join('');
}

/**
 * 2.1. Yeni Rol / Reyon Ekleme & Düzenleme Modalı
 */
function openAddRoleModal() {
  currentEditingRoleId = null;
  const titleEl = document.getElementById('modal-role-form-title');
  if (titleEl) titleEl.innerText = "Yeni Çalışma Alanı / Reyon Ekle";

  document.getElementById('role-form-id').value = '';
  document.getElementById('role-form-name').value = '';
  document.getElementById('role-form-icon').value = '🥩';
  document.getElementById('role-form-color').value = '#f87171';
  document.getElementById('role-form-desc').value = '';

  currentRoleWorkingPerms = new Set(["perm_pos", "perm_catalog_view"]);
  renderRoleFormPermissions();

  const modal = document.getElementById('modal-role-form');
  if (modal) modal.style.display = 'flex';
}

function openEditRoleModal(roleId) {
  const role = marketRolesList.find(r => r.id === roleId);
  if (!role) return;

  currentEditingRoleId = role.id;
  const titleEl = document.getElementById('modal-role-form-title');
  if (titleEl) titleEl.innerText = `${role.name} - Çalışma Alanını Düzenle`;

  document.getElementById('role-form-id').value = role.id;
  document.getElementById('role-form-name').value = role.name || '';
  document.getElementById('role-form-icon').value = role.icon || '💼';
  document.getElementById('role-form-color').value = role.color || '#38bdf8';
  document.getElementById('role-form-desc').value = role.description || '';

  currentRoleWorkingPerms = new Set(role.permissions || []);
  renderRoleFormPermissions();

  const modal = document.getElementById('modal-role-form');
  if (modal) modal.style.display = 'flex';
}

function closeRoleFormModal() {
  const modal = document.getElementById('modal-role-form');
  if (modal) modal.style.display = 'none';
  currentEditingRoleId = null;
}

function renderRoleFormPermissions() {
  const tbody = document.getElementById('role-form-perms-table-body');
  const fallbackContainer = document.getElementById('role-form-perms-container');

  if (tbody) {
    if (!permissionsCatalog || permissionsCatalog.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: #64748b;">İzin kataloğu yüklenemedi.</td></tr>`;
      return;
    }

    tbody.innerHTML = permissionsCatalog.map(p => {
      const isChecked = currentRoleWorkingPerms.has(p.key);
      return `
        <tr style="border-bottom: 1px solid var(--border-color); background: ${isChecked ? 'rgba(255,255,255,0.01)' : 'transparent'}; cursor: pointer; transition: background 0.15s ease;" onclick="toggleRolePermCheckbox('${p.key}')">
          <td style="text-align: center; padding: 10px 14px;">
            <input type="checkbox" ${isChecked ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer; accent-color: #3b82f6;" onclick="event.stopPropagation(); toggleRolePermCheckbox('${p.key}')">
          </td>
          <td style="padding: 10px 14px;">
            <strong style="color: ${isChecked ? 'var(--text-main)' : 'var(--text-muted)'}; font-size: 12.5px; display: flex; align-items: center; gap: 6px;">
              <span>${p.icon || '🔑'}</span>
              <span>${p.title}</span>
            </strong>
          </td>
          <td style="padding: 10px 14px; color: var(--text-muted); font-size: 11.5px;">
            ${p.description || '-'}
          </td>
          <td style="padding: 10px 14px;">
            <span style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); color: var(--text-main); font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px;">
              ${p.category || 'Genel'}
            </span>
          </td>
        </tr>
      `;
    }).join('');
    return;
  }

  if (fallbackContainer) {
    fallbackContainer.innerHTML = permissionsCatalog.map(p => {
      const isChecked = currentRoleWorkingPerms.has(p.key);
      return `
        <label style="display: flex; align-items: center; gap: 8px; background: ${isChecked ? 'rgba(56,189,248,0.1)' : '#0f172a'}; border: 1px solid ${isChecked ? '#38bdf8' : '#1e293b'}; padding: 6px 8px; border-radius: 6px; cursor: pointer;">
          <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleRolePermCheckbox('${p.key}')" style="cursor: pointer;">
          <div>
            <span style="color: #f8fafc; font-size: 11.5px; font-weight: 700; display: block;">${p.title}</span>
            <small style="color: #94a3b8; font-size: 10px;">${p.category}</small>
          </div>
        </label>
      `;
    }).join('');
  }
}

function selectAllRolePerms(selectBool) {
  if (selectBool) {
    permissionsCatalog.forEach(p => currentRoleWorkingPerms.add(p.key));
  } else {
    currentRoleWorkingPerms.clear();
  }
  renderRoleFormPermissions();
}

function toggleRolePermCheckbox(key) {
  if (currentRoleWorkingPerms.has(key)) {
    currentRoleWorkingPerms.delete(key);
  } else {
    currentRoleWorkingPerms.add(key);
  }
  renderRoleFormPermissions();
}

async function submitRoleForm() {
  const name = document.getElementById('role-form-name')?.value?.trim();
  if (!name) {
    if (typeof showToast === 'function') showToast("Lütfen çalışma alanı / rol adını girin.", "warning");
    return;
  }

  const payload = {
    id: document.getElementById('role-form-id')?.value?.trim() || name.toLowerCase().replace(/\s+/g, '_'),
    name: name,
    icon: document.getElementById('role-form-icon')?.value?.trim() || '💼',
    color: document.getElementById('role-form-color')?.value || '#38bdf8',
    description: document.getElementById('role-form-desc')?.value?.trim() || '',
    permissions: Array.from(currentRoleWorkingPerms)
  };

  try {
    const res = await fetch('/api/market/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.status === 'success') {
      closeRoleFormModal();
      if (typeof showToast === 'function') showToast(`✅ ${data.message}`, "success");
      await loadMarketRoles();
      await loadMarketEmployees();
    } else {
      if (typeof showToast === 'function') showToast(`❌ ${data.message || 'Hata oluştu'}`, "error");
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast("❌ Sunucu hatası.", "error");
  }
}

async function toggleRoleActiveStatus(roleId) {
  try {
    const res = await fetch('/api/market/roles/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: roleId })
    });
    const data = await res.json();
    if (data.status === 'success') {
      if (typeof showToast === 'function') showToast(`✅ ${data.message}`, "info");
      await loadMarketRoles();
    }
  } catch (e) {}
}

async function deleteCustomRole(roleId) {
  if (typeof showCustomConfirm === 'function') {
    const ok = await showCustomConfirm(
      "Bu çalışma alanını / reyonu silmek istediğinize emin misiniz? Bu role bağlı çalışanlar varsayılan 'Kasiyer' rolüne aktarılacaktır.",
      "Reyon / Rolü Sil",
      "Evet, Sil",
      "Vazgeç"
    );
    if (!ok) return;
  }

  try {
    const res = await fetch(`/api/market/roles/${roleId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.status === 'success') {
      if (typeof showToast === 'function') showToast(`🗑️ ${data.message}`, "info");
      await loadMarketRoles();
      await loadMarketEmployees();
    } else {
      if (typeof showToast === 'function') showToast(`❌ ${data.message || 'Silinemedi'}`, "error");
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast("❌ Sunucu hatası.", "error");
  }
}

let employeePerformanceMap = {};

/**
 * 3. Çalışanlar & Personel Kadrosu
 */
async function loadMarketEmployees() {
  try {
    const res = await fetch('/api/market/employees');
    const data = await res.json();
    if (data.status === 'success' && data.employees) {
      marketEmployeesList = data.employees;
      if (data.roles) marketRolesList = data.roles;
      if (data.permissions_catalog) permissionsCatalog = data.permissions_catalog;
      renderMarketEmployees();
      
      // Menü yetki görünürlüğünü güncelle
      if (typeof updateSidebarNavVisibility === 'function') {
        updateSidebarNavVisibility();
      }
    }
  } catch (err) {
    console.error("Çalışanlar yüklenirken hata:", err);
  }
}

let currentEmployeeSearchQuery = '';

function filterMarketEmployeesList() {
  const inp = document.getElementById('mkt-employee-search-inp');
  currentEmployeeSearchQuery = (inp?.value || '').trim().toLowerCase();
  renderMarketEmployees();
}

function renderMarketEmployees() {
  const container = document.getElementById('market-employees-cards-container');
  const countBadge = document.getElementById('market-employees-count-badge');
  if (countBadge) countBadge.innerText = `${marketEmployeesList.length} Çalışan`;

  // İstatistik Sayaçlarını Hesapla ve Güncelle
  const totalCount = marketEmployeesList.length;
  let activeShiftCount = 0;
  let onBreakCount = 0;
  let customPermCount = 0;

  marketEmployeesList.forEach(emp => {
    if (emp.custom_permissions !== null && emp.custom_permissions !== undefined) {
      customPermCount++;
    }
    const shift = employeeShiftStates[emp.id] || {};
    if (shift.status === 'on_break') {
      onBreakCount++;
    } else if (shift.status === 'active' || emp.active !== false) {
      activeShiftCount++;
    }
  });

  const elStatTotal = document.getElementById('market-stat-total');
  const elStatActive = document.getElementById('market-stat-active');
  const elStatBreak = document.getElementById('market-stat-break');
  const elStatCustom = document.getElementById('market-stat-custom');

  if (elStatTotal) elStatTotal.innerText = `👥 ${totalCount} Personel`;
  if (elStatActive) elStatActive.innerText = `🟢 ${activeShiftCount} Görevde`;
  if (elStatBreak) elStatBreak.innerText = `☕ ${onBreakCount} Molada`;
  if (elStatCustom) elStatCustom.innerText = `⭐ ${customPermCount} Özel İzinli`;

  if (!container) return;

  // İsimle Canlı Filtreleme
  let list = marketEmployeesList;
  if (currentEmployeeSearchQuery) {
    list = list.filter(emp => {
      const name = (emp.name || '').toLowerCase();
      const role = (emp.role_name || '').toLowerCase();
      const phone = (emp.phone || '').toLowerCase();
      const id = (emp.id || '').toLowerCase();
      return name.includes(currentEmployeeSearchQuery) || role.includes(currentEmployeeSearchQuery) || phone.includes(currentEmployeeSearchQuery) || id.includes(currentEmployeeSearchQuery);
    });
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; background: #090e1a; border: 1px dashed rgba(255,255,255,0.1); border-radius: 10px; color: #64748b;">
        <span style="font-size: 32px; display: block; margin-bottom: 8px;">👤</span>
        <p style="margin: 0; font-weight: 700; font-size: 13px; color: #94a3b8;">"${currentEmployeeSearchQuery}" aramasına uygun personel bulunamadı.</p>
        <small style="color: #64748b; font-size: 11px;">"Yeni Çalışan Tanımla" butonu ile kadroya çalışan ekleyebilirsiniz.</small>
      </div>
    `;
    return;
  }

  const permissionNameMap = {
    "pos_sale": "🛒 Kasa Satış",
    "view_catalog": "📦 Katalog",
    "edit_prices": "💰 Fiyat Değişimi",
    "print_labels": "🏷️ Etiket Basımı",
    "print_receipts": "🧾 Bilgi Fişi",
    "view_reports": "📊 Raporlar",
    "x_report": "💵 X Raporu",
    "manage_employees": "👥 Kadro Yönetimi",
    "manage_roles": "🥩 Reyon Yönetimi",
    "kasap_module": "🥩 Kasap & Şarküteri",
    "unlu_mamul_module": "🥖 Fırın & Unlu Mamül",
    "manav_scale": "⚖️ Manav & Terazi",
    "accounting_access": "📈 Muhasebe",
    "customer_ledger": "📒 Cari & Veresiye"
  };

  container.innerHTML = list.map(emp => {
    const roleObj = marketRolesList.find(r => r.id === emp.role_id) || { name: emp.role_name || 'Kasiyer', color: '#38bdf8', icon: '👤' };
    const hasCustomPerms = emp.custom_permissions !== null && emp.custom_permissions !== undefined;
    const effectivePerms = emp.effective_permissions || [];
    const hasPin = Boolean(emp.pin && emp.pin.trim());
    const shift = employeeShiftStates[emp.id] || { status: (emp.active !== false ? 'active' : 'logged_out') };
    const perf = employeePerformanceMap[emp.id] || {};

    let statusHtml = `<span style="background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.4); color: #34d399; font-size: 11px; font-weight: 800; padding: 4px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;">🟢 Görevde</span>`;
    if (shift.status === 'on_break') {
      statusHtml = `<span style="background: rgba(245,158,11,0.18); border: 1px solid rgba(245,158,11,0.45); color: #fbbf24; font-size: 11px; font-weight: 800; padding: 4px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;">☕ Molada</span>`;
    } else if (emp.active === false || shift.status === 'logged_out') {
      statusHtml = `<span style="background: rgba(100,116,139,0.15); border: 1px solid rgba(100,116,139,0.3); color: #94a3b8; font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;">⚪ Çıkış Yaptı</span>`;
    }

    // İlk 3 ana yetkiyi çip olarak göster
    const permChipsHtml = effectivePerms.slice(0, 3).map(pKey => {
      const pLabel = permissionNameMap[pKey] || pKey;
      return `<span style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #cbd5e1; font-size: 10.5px; font-weight: 700; padding: 2px 6px; border-radius: 4px;">${pLabel}</span>`;
    }).join(' ');

    const extraPermCount = effectivePerms.length > 3 ? `+${effectivePerms.length - 3}` : '';

    const turnoverFormatted = (perf.total_turnover || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return `
      <div class="market-employee-card-row" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 14px 20px; display: grid; grid-template-columns: 240px 160px 1.4fr 260px; gap: 14px; align-items: center; transition: all 0.2s ease;">
        
        <!-- 1. SÜTUN: Personel Kimlik & Avatar -->
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;">
            ${roleObj.icon || '👤'}
          </div>
          <div style="overflow: hidden;">
            <div style="font-size: 13.5px; font-weight: 700; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${emp.name}
            </div>
            <div style="display: flex; align-items: center; gap: 6px; margin-top: 2px; font-size: 11px; color: var(--text-muted);">
              <span style="font-family: monospace; background: rgba(255,255,255,0.03); padding: 1px 5px; border-radius: 3px;">ID: ${emp.id}</span>
              ${emp.phone ? `<span>📞 ${emp.phone}</span>` : ''}
            </div>
          </div>
        </div>

        <!-- 2. SÜTUN: Reyon / Çalışma Alanı & PIN Güvenliği -->
        <div style="display: flex; flex-direction: column; gap: 5px;">
          <span style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); color: var(--text-main); font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 5px; width: fit-content;">
            <span>${roleObj.icon || '💼'}</span>
            <span>${roleObj.name}</span>
          </span>
          <div>
            ${hasPin 
              ? `<span style="color: #fbbf24; font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; gap: 3px;">🔒 PIN Korumalı</span>` 
              : `<span style="color: #34d399; font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; gap: 3px;">🔓 Şifresiz Kasa</span>`
            }
          </div>
        </div>

        <!-- 3. SÜTUN: Canlı Performans & Yetki Özeti -->
        <div style="display: flex; flex-direction: column; gap: 6px; background: rgba(255,255,255,0.01); padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color);">
          <!-- Performans Sayaçları -->
          <div style="display: flex; align-items: center; gap: 10px; font-size: 11px; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 4px; color: #34d399; font-weight: 700; font-family: monospace;">
              <span>Ciro:</span> ₺${turnoverFormatted}
            </div>
            <div style="color: rgba(255,255,255,0.1);">|</div>
            <div style="display: flex; align-items: center; gap: 4px; color: var(--text-main); font-weight: 600;">
              <span>${perf.sales_count || 0} Satış</span>
            </div>
          </div>

          <!-- Yetki Çipleri -->
          <div style="display: flex; flex-wrap: wrap; gap: 4px; align-items: center; margin-top: 2px;">
            ${hasCustomPerms 
              ? `<span style="background: rgba(168,85,247,0.1); border: 1px solid rgba(168,85,247,0.2); color: #c084fc; font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 3px;">⭐ Özel</span>` 
              : ''
            }
            ${permChipsHtml}
            ${extraPermCount ? `<span style="font-size: 10px; color: var(--text-muted); font-weight: 700;">${extraPermCount} diğer</span>` : ''}
          </div>
        </div>

        <!-- 4. SÜTUN: Canlı Durum & İşlem Butonları -->
        <div style="display: flex; flex-direction: column; gap: 8px; align-items: flex-end;">
          <div>
            ${statusHtml}
          </div>
          <div style="display: flex; gap: 5px; flex-wrap: wrap; justify-content: flex-end;">
            <button type="button" class="btn-primary" onclick="openEmployeeReportDetailModal('${emp.id}')" style="padding: 5px 10px; font-size: 11px; font-weight: 600; background: #10b981; border: none; color: #ffffff; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 4px;" title="Performans & Mola Detayları">
              <span>📊</span> Detay
            </button>
            <button type="button" class="btn-secondary" onclick="openEmployeeQrModal('${emp.id}')" style="padding: 5px 10px; font-size: 11px; font-weight: 600; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); color: var(--text-main); border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 4px;" title="Mobil QR">
              <span>📱</span> QR
            </button>
            <button type="button" class="btn-secondary" onclick="openEmployeePermissionsModal('${emp.id}')" style="padding: 5px 10px; font-size: 11px; font-weight: 600; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); color: var(--text-main); border-radius: 4px; cursor: pointer;" title="İzin Matrisi">
              🔑 Yetki
            </button>
            <button type="button" class="btn-secondary" onclick="openEditEmployeeModal('${emp.id}')" style="padding: 5px 8px; font-size: 11px; font-weight: 600; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); color: var(--text-main); border-radius: 4px; cursor: pointer;" title="Bilgileri Düzenle">
              ✏️
            </button>
            ${emp.id !== 'admin' ? `
              <button type="button" class="btn-secondary" onclick="deleteEmployee('${emp.id}')" style="padding: 5px 8px; font-size: 11px; font-weight: 600; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); color: #f87171; border-radius: 4px; cursor: pointer;" title="Çalışanı Sil">
                🗑️
              </button>
            ` : ''}
          </div>
        </div>

      </div>
    `;
  }).join('');
}

/**
 * 4. Çalışan Ekleme / Düzenleme
 */
function openAddEmployeeModal() {
  currentEditingEmpId = null;
  const titleEl = document.getElementById('modal-employee-form-title');
  if (titleEl) titleEl.innerText = "Yeni Çalışan Ekle";

  document.getElementById('emp-form-id').value = '';
  document.getElementById('emp-form-name').value = '';
  document.getElementById('emp-form-pin').value = '';
  document.getElementById('emp-form-phone').value = '';
  document.getElementById('emp-form-active').checked = true;
  populateRoleDropdown();

  const modal = document.getElementById('modal-employee-form');
  if (modal) modal.style.display = 'flex';
}

function openEditEmployeeModal(empId) {
  const emp = marketEmployeesList.find(e => String(e.id) === String(empId));
  if (!emp) return;

  currentEditingEmpId = emp.id;
  const titleEl = document.getElementById('modal-employee-form-title');
  if (titleEl) titleEl.innerText = `${emp.name} - Bilgileri Düzenle`;

  document.getElementById('emp-form-id').value = emp.id;
  document.getElementById('emp-form-name').value = emp.name || '';
  document.getElementById('emp-form-pin').value = emp.pin || '';
  document.getElementById('emp-form-phone').value = emp.phone || '';
  document.getElementById('emp-form-active').checked = emp.active !== false;

  populateRoleDropdown();
  const select = document.getElementById('emp-form-role');
  if (select && emp.role_id) select.value = emp.role_id;

  const modal = document.getElementById('modal-employee-form');
  if (modal) modal.style.display = 'flex';
}

function closeEmployeeFormModal() {
  const modal = document.getElementById('modal-employee-form');
  if (modal) modal.style.display = 'none';
}

async function submitEmployeeForm() {
  const name = document.getElementById('emp-form-name')?.value?.trim();
  if (!name) {
    if (typeof showToast === 'function') showToast("Lütfen çalışan adını girin.", "warning");
    return;
  }

  const payload = {
    id: document.getElementById('emp-form-id')?.value?.trim() || name.toLowerCase().replace(/\s+/g, '_'),
    name: name,
    role_id: document.getElementById('emp-form-role')?.value || 'kasiyer',
    pin: document.getElementById('emp-form-pin')?.value?.trim() || '',
    phone: document.getElementById('emp-form-phone')?.value?.trim() || '',
    active: document.getElementById('emp-form-active')?.checked ?? true
  };

  try {
    const res = await fetch('/api/market/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.status === 'success') {
      closeEmployeeFormModal();
      if (typeof showToast === 'function') showToast(`✅ ${data.message}`, "success");
      await loadMarketEmployees();
    } else {
      if (typeof showToast === 'function') showToast(`❌ ${data.message || 'Hata oluştu'}`, "error");
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast("❌ Sunucu hatası.", "error");
  }
}

async function deleteEmployee(empId) {
  const emp = marketEmployeesList.find(e => String(e.id) === String(empId));
  if (!emp) return;

  const confirmMsg = `"${emp.name}" çalışan kaydını silmek istediğinize emin misiniz?`;
  
  if (typeof showCustomConfirm === 'function') {
    const ok = await showCustomConfirm(confirmMsg, "Çalışanı Sil", "Sil", "İptal");
    if (!ok) return;
  }

  try {
    const res = await fetch('/api/market/employees/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: empId })
    });
    const data = await res.json();
    if (data.status === 'success') {
      if (typeof showToast === 'function') showToast(`✅ ${emp.name} silindi.`, "success");
      await loadMarketEmployees();
    } else {
      if (typeof showToast === 'function') showToast(`❌ ${data.message || 'Silinemedi'}`, "error");
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast("❌ Sunucu hatası.", "error");
  }
}

/**
 * 5. İzin / Yetki Matrisi Modalı (13 Yetki)
 */
function openEmployeePermissionsModal(empId) {
  const emp = marketEmployeesList.find(e => String(e.id) === String(empId));
  if (!emp) return;

  currentPermEmp = emp;
  const nameEl = document.getElementById('perm-modal-emp-name');
  const roleEl = document.getElementById('perm-modal-emp-role');
  if (nameEl) nameEl.innerText = emp.name;
  if (roleEl) roleEl.innerText = `Çalışma Alanı: ${emp.role_name || 'Kasiyer'}`;

  const effective = emp.effective_permissions || [];
  currentPermWorkingSet = new Set(effective);

  renderPermissionSwitches();

  const modal = document.getElementById('modal-employee-permissions');
  if (modal) modal.style.display = 'flex';
}

function closeEmployeePermissionsModal() {
  const modal = document.getElementById('modal-employee-permissions');
  if (modal) modal.style.display = 'none';
  currentPermEmp = null;
}

function renderPermissionSwitches() {
  const container = document.getElementById('perm-switches-container');
  if (!container) return;

  container.innerHTML = permissionsCatalog.map(p => {
    const isGranted = currentPermWorkingSet.has(p.key);
    return `
      <div onclick="togglePermSwitch('${p.key}')" style="background: ${isGranted ? 'rgba(56,189,248,0.1)' : '#070d1e'}; border: 1.5px solid ${isGranted ? '#38bdf8' : '#1e293b'}; border-radius: 8px; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.15s ease;">
        <div style="flex: 1; padding-right: 8px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 11px; background: rgba(255,255,255,0.06); padding: 1px 5px; border-radius: 4px; color: #94a3b8; font-weight: 700;">${p.category}</span>
            <strong style="color: ${isGranted ? '#f8fafc' : '#94a3b8'}; font-size: 12.5px;">${p.title}</strong>
          </div>
          <small style="color: #64748b; font-size: 11px; display: block; margin-top: 2px;">${p.desc}</small>
        </div>
        <div>
          <span style="font-size: 14px; font-weight: 900; color: ${isGranted ? '#34d399' : '#475569'}; background: ${isGranted ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.04)'}; border: 1px solid ${isGranted ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.1)'}; padding: 3px 8px; border-radius: 6px;">
            ${isGranted ? '✓ AÇIK' : '✕ KAPALI'}
          </span>
        </div>
      </div>
    `;
  }).join('');
}

function togglePermSwitch(permKey) {
  if (currentPermWorkingSet.has(permKey)) {
    currentPermWorkingSet.delete(permKey);
  } else {
    currentPermWorkingSet.add(permKey);
  }
  renderPermissionSwitches();
}

function resetPermissionsToRoleDefault() {
  if (!currentPermEmp) return;
  const role = marketRolesList.find(r => r.id === currentPermEmp.role_id);
  if (role && role.permissions) {
    currentPermWorkingSet = new Set(role.permissions);
  } else {
    currentPermWorkingSet = new Set(["perm_pos", "perm_catalog_view"]);
  }
  renderPermissionSwitches();
  if (typeof showToast === 'function') showToast("🔄 İzinler rolün varsayılan şablonuna sıfırlandı.", "info");
}

async function saveCurrentEmployeePermissions() {
  if (!currentPermEmp) return;

  const permissionsList = Array.from(currentPermWorkingSet);

  try {
    const res = await fetch('/api/market/employees/permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: currentPermEmp.id,
        permissions: permissionsList
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      closeEmployeePermissionsModal();
      if (typeof showToast === 'function') showToast(`✅ ${currentPermEmp.name} izinleri güncellendi.`, "success");
      await loadMarketEmployees();
    } else {
      if (typeof showToast === 'function') showToast(`❌ ${data.message || 'Güncellenemedi'}`, "error");
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast("❌ Sunucu hatası.", "error");
  }
}

/**
 * 6. ÇALIŞAN PERFORMANS & VARDİYA RAPORLARI
 */
async function loadMarketEmployeeReports() {
  try {
    const res = await fetch('/api/market/employee-reports');
    const data = await res.json();
    if (data.status === 'success') {
      const reports = data.reports || [];
      reports.forEach(r => {
        employeePerformanceMap[r.id] = r;
      });
      renderMarketEmployeeReports(reports, data.recent_logs || []);
      renderMarketEmployees();
    }
  } catch (err) {
    console.error("Çalışan raporları yüklenirken hata:", err);
  }
}

function renderMarketEmployeeReports(reports, logs) {
  const tbody = document.getElementById('market-reports-tbody');
  const countBadge = document.getElementById('market-reports-count-badge');
  const logsTbody = document.getElementById('market-logs-tbody');

  if (countBadge) countBadge.innerText = `${reports.length} Personel`;

  if (tbody) {
    if (reports.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 30px; color: #64748b;">Raporlanacak çalışan verisi bulunamadı.</td></tr>`;
    } else {
      tbody.innerHTML = reports.map(r => {
        const isWorking = r.status === 'working';
        const isOnBreak = r.status === 'on_break';
        const statusBadge = isWorking 
          ? `<span style="background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.4); color: #34d399; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 6px;">🟢 Vardiyada</span>`
          : (isOnBreak 
              ? `<span style="background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.4); color: #fbbf24; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 6px;">☕ Molada</span>`
              : `<span style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #94a3b8; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 6px;">⚪ Çıkış Yaptı</span>`
            );

        const breakStr = `${r.break_count || 0} Kez (${r.total_break_minutes || 0} Dk)`;

        return `
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.15s ease;">
            <td style="padding: 10px;">
              <strong style="color: #f8fafc; font-size: 13px;">${r.name}</strong>
              <small style="color: #94a3b8; font-size: 11px; display: block;">${r.role_name}</small>
            </td>
            <td style="padding: 10px;">${statusBadge}</td>
            <td style="padding: 10px; text-align: center;">
              <span style="background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3); color: #fbbf24; font-size: 11.5px; font-weight: 800; padding: 3px 8px; border-radius: 6px; font-family: monospace;">
                ${breakStr}
              </span>
            </td>
            <td style="padding: 10px; text-align: right;">
              <strong style="color: #34d399; font-size: 13.5px; font-family: monospace;">
                ${Number(r.total_sales_turnover || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
              </strong>
            </td>
            <td style="padding: 10px; text-align: center;">
              <span style="color: #38bdf8; font-size: 12.5px; font-weight: 800; font-family: monospace;">
                ${r.total_sales_count || 0} Fiş
              </span>
            </td>
            <td style="padding: 10px; text-align: right;">
              <span style="color: #cbd5e1; font-size: 12px; font-family: monospace;">
                ${Number(r.avg_basket || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
              </span>
            </td>
            <td style="padding: 10px; text-align: center;">
              <span style="background: rgba(192,132,252,0.15); border: 1px solid rgba(192,132,252,0.3); color: #c084fc; font-size: 11.5px; font-weight: 800; padding: 2px 7px; border-radius: 4px; font-family: monospace;">
                ${r.total_labels_printed || 0} Adet
              </span>
            </td>
            <td style="padding: 10px; text-align: right;">
              <button type="button" onclick="openEmployeeReportDetailModal('${r.id}')" style="padding: 5px 12px; font-size: 11.5px; font-weight: 800; background: rgba(56,189,248,0.15); border: 1px solid rgba(56,189,248,0.4); color: #38bdf8; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="Detaylı Mola, Vardiya ve Satış Kayıtları">
                <span>🔍</span>
                <span>Detay</span>
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  if (logsTbody) {
    if (logs.length === 0) {
      logsTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 25px; color: #64748b;">Henüz kayıtlı vardiya/mola hareketi bulunmuyor.</td></tr>`;
    } else {
      logsTbody.innerHTML = logs.map(l => `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
          <td style="padding: 8px 10px; color: #94a3b8; font-family: monospace;">${l.time}</td>
          <td style="padding: 8px 10px;"><strong style="color: #f8fafc;">${l.employee_name}</strong></td>
          <td style="padding: 8px 10px;">
            <span style="font-weight: 800; font-size: 11px; padding: 2px 7px; border-radius: 4px; ${
              l.action.includes('Mola') ? 'background: rgba(245,158,11,0.15); color: #fbbf24;' :
              l.action.includes('Çıkış') ? 'background: rgba(239,68,68,0.15); color: #f87171;' :
              'background: rgba(16,185,129,0.15); color: #34d399;'
            }">${l.action}</span>
          </td>
          <td style="padding: 8px 10px; color: #cbd5e1;">${l.details || ''}</td>
        </tr>
      `).join('');
    }
  }
}

/**
 * 6.1. ÇALIŞAN DETAYLI FAALİYET & MOLA MODALI
 */
async function openEmployeeReportDetailModal(empId) {
  try {
    const res = await fetch(`/api/market/employee-detail-logs?id=${encodeURIComponent(empId)}`);
    const data = await res.json();
    if (data.status === 'success' && data.employee) {
      const emp = data.employee;
      const logs = data.logs || [];

      // Başlık
      const nameEl = document.getElementById('emp-detail-modal-name');
      const roleEl = document.getElementById('emp-detail-modal-role');
      if (nameEl) nameEl.innerText = emp.name;
      if (roleEl) roleEl.innerText = `Görevi: ${emp.role_name || 'Kasiyer'}`;

      // İlgili personelin rapor verisini bul
      const reportsRes = await fetch('/api/market/employee-reports');
      const reportsData = await reportsRes.json();
      const empReport = (reportsData.reports || []).find(r => String(r.id) === String(empId)) || {};

      // KPI Kartlarını Doldur
      const turnoverEl = document.getElementById('emp-detail-kpi-turnover');
      const salesEl = document.getElementById('emp-detail-kpi-sales');
      if (turnoverEl) turnoverEl.innerText = `${Number(empReport.total_sales_turnover || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`;
      if (salesEl) salesEl.innerText = `${empReport.total_sales_count || 0} Fiş`;

      // Log Çizelgesini Doldur
      const logsTbody = document.getElementById('emp-detail-modal-logs-tbody');
      if (logsTbody) {
        if (logs.length === 0) {
          logsTbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 20px; color: #64748b;">Bu personele ait vardiya/mola hareketi bulunamadı.</td></tr>`;
        } else {
          logsTbody.innerHTML = logs.map(l => `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
              <td style="padding: 7px 10px; color: #94a3b8; font-family: monospace;">${l.time}</td>
              <td style="padding: 7px 10px;">
                <span style="font-weight: 800; font-size: 11px; padding: 2px 7px; border-radius: 4px; ${
                  l.action.includes('Mola') ? 'background: rgba(245,158,11,0.15); color: #fbbf24;' :
                  l.action.includes('Çıkış') ? 'background: rgba(239,68,68,0.15); color: #f87171;' :
                  'background: rgba(16,185,129,0.15); color: #34d399;'
                }">${l.action}</span>
              </td>
              <td style="padding: 7px 10px; color: #cbd5e1;">${l.details || '-'}</td>
            </tr>
          `).join('');
        }
      }

      const modal = document.getElementById('modal-employee-report-detail');
      if (modal) modal.style.display = 'flex';
    }
  } catch (err) {
    console.error("Personel detay raporu yüklenirken hata:", err);
    if (typeof showToast === 'function') showToast("Detay raporu yüklenemedi.", "error");
  }
}

function closeEmployeeReportDetailModal() {
  const modal = document.getElementById('modal-employee-report-detail');
  if (modal) modal.style.display = 'none';
}

/**
 * 7. ANLIK MOLA & GÜVENLİ ÇIKIŞ AKSİYONLARI (HEADER & DASHBOARD ENTEGRASYONU)
 */
async function toggleEmployeeBreak() {
  const currentEmp = (typeof activeCashier !== 'undefined' && activeCashier) ? activeCashier : { id: 'admin', name: 'Yönetici' };
  const nextAction = (currentEmployeeShiftState.status === 'on_break') ? 'end_break' : 'start_break';

  try {
    const res = await fetch('/api/market/shift/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: currentEmp.id,
        name: currentEmp.name,
        action: nextAction
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      currentEmployeeShiftState = data.current_state || { status: nextAction === 'start_break' ? 'on_break' : 'working' };
      updateHeaderShiftUI();
      if (typeof showToast === 'function') showToast(`☕ ${data.message}`, "info");
      loadMarketEmployeeReports();
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast("Mola durumu güncellenemedi.", "error");
  }
}

async function safeEmployeeLogout() {
  const currentEmp = (typeof activeCashier !== 'undefined' && activeCashier) ? activeCashier : { id: 'admin', name: 'Yönetici' };

  if (typeof showCustomConfirm === 'function') {
    const ok = await showCustomConfirm(
      `"${currentEmp.name}" hesabından güvenli çıkış yapmak istiyor musunuz? Vardiyanız tamamlanacaktır.`,
      "Güvenli Çıkış",
      "Çıkış Yap",
      "Vazgeç"
    );
    if (!ok) return;
  }

  try {
    await fetch('/api/market/shift/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: currentEmp.id,
        name: currentEmp.name,
        action: 'logout'
      })
    });
  } catch (e) {}

  currentEmployeeShiftState = { status: "off" };
  updateHeaderShiftUI();
  if (typeof showToast === 'function') showToast("🔒 Güvenli çıkış yapıldı. Yeni personel girişi bekleniyor...", "success");
  
  // Kasiyer giriş modalını aç
  if (typeof openCashierSwitchModal === 'function') {
    openCashierSwitchModal();
  }
}

function updateHeaderShiftUI() {
  const badge = document.getElementById('header-employee-status-badge');
  const btnBreak = document.getElementById('btn-header-break-toggle');
  const iconBreak = document.getElementById('header-break-icon');
  const textBreak = document.getElementById('header-break-text');

  if (currentEmployeeShiftState.status === 'on_break') {
    if (badge) {
      badge.innerText = '☕ Molada / İzninde';
      badge.style.background = 'rgba(245,158,11,0.2)';
      badge.style.borderColor = 'rgba(245,158,11,0.5)';
      badge.style.color = '#fbbf24';
    }
    if (iconBreak) iconBreak.innerText = '▶️';
    if (textBreak) textBreak.innerText = 'Göreve Dön';
    if (btnBreak) {
      btnBreak.style.background = 'rgba(16,185,129,0.2)';
      btnBreak.style.borderColor = 'rgba(16,185,129,0.5)';
      btnBreak.style.color = '#34d399';
    }
  } else {
    if (badge) {
      badge.innerText = '🟢 Görevde';
      badge.style.background = 'rgba(16,185,129,0.15)';
      badge.style.borderColor = 'rgba(16,185,129,0.4)';
      badge.style.color = '#34d399';
    }
    if (iconBreak) iconBreak.innerText = '☕';
    if (textBreak) textBreak.innerText = 'Molaya Çık';
    if (btnBreak) {
      btnBreak.style.background = 'rgba(245,158,11,0.15)';
      btnBreak.style.borderColor = 'rgba(245,158,11,0.4)';
      btnBreak.style.color = '#fbbf24';
    }
  }
}

/**
 * 8. RBAC İzin Kontrolcüsü (Çalışan Özel İzin Override Desteğiyle)
 */
function hasPermission(permKey) {
  // 1. Tek Kişi Bakkal Modu veya Güven Modu aktifse direkt izin ver
  if (currentOperatingMode === 'SOLO' || currentOperatingMode === 'FULL_TRUST') {
    return true;
  }

  // 2. Yönetici (Admin) ise direkt izin ver
  if (typeof activeCashier !== 'undefined' && activeCashier && (activeCashier.role === 'admin' || activeCashier.id === 'admin')) {
    return true;
  }
  if (!activeCashier || !activeCashier.id) return true;

  const emp = marketEmployeesList.find(e => String(e.id) === String(activeCashier.id));
  if (!emp) return true;

  if (emp.role_id === 'admin') return true;
  if (emp.effective_permissions && Array.isArray(emp.effective_permissions)) {
    return emp.effective_permissions.includes(permKey);
  }
  return true;
}

let currentQrEmpId = null;
let currentQrInfo = null;

async function openEmployeeQrModal(empId) {
  currentQrEmpId = empId;
  const modal = document.getElementById('modal-employee-qr-connect');
  if (!modal) return;

  try {
    const res = await fetch(`/api/market/employees/qr-info?id=${encodeURIComponent(empId)}`);
    const data = await res.json();
    if (data.status === 'success') {
      currentQrInfo = data;
      const emp = data.employee;

      const titleEl = document.getElementById('emp-qr-modal-title');
      const roleEl = document.getElementById('emp-qr-modal-role');
      const qrImg = document.getElementById('emp-qr-code-img');
      const linkInp = document.getElementById('emp-qr-link-inp');

      if (titleEl) titleEl.innerText = `${emp.name} - Mobil Bağlantı QR`;
      if (roleEl) roleEl.innerText = `Görevi: ${emp.role_name || 'Personel'} (PIN: ${emp.pin ? 'Korumalı' : 'Şifresiz'})`;
      if (linkInp) linkInp.value = data.mobile_url;

      if (qrImg) {
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=4&data=${encodeURIComponent(data.mobile_url)}`;
      }

      modal.style.display = 'flex';
    } else {
      if (typeof showToast === 'function') showToast(`❌ ${data.message}`, "error");
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast("QR bilgileri alınamadı.", "error");
  }
}

function closeEmployeeQrModal() {
  const modal = document.getElementById('modal-employee-qr-connect');
  if (modal) modal.style.display = 'none';
  currentQrEmpId = null;
  currentQrInfo = null;
}

function copyEmployeeQrLink() {
  const inp = document.getElementById('emp-qr-link-inp');
  if (inp && inp.value) {
    navigator.clipboard.writeText(inp.value);
    if (typeof showToast === 'function') showToast("📋 Mobil bağlantı linki panoya kopyalandı.", "info");
  }
}

async function regenerateCurrentEmployeeQr() {
  if (!currentQrEmpId) return;

  const ok = confirm("⚠️ DİKKAT: Bu personelin eski QR kodunu iptal edip YENİ bir güvenlik QR kodu üretmek istiyor musunuz?\n\n(Eski QR kod anında geçersiz kılınacaktır)");
  if (!ok) return;

  try {
    const res = await fetch('/api/market/employees/regenerate-qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: currentQrEmpId })
    });
    const data = await res.json();
    if (data.status === 'success') {
      const qrImg = document.getElementById('emp-qr-code-img');
      const linkInp = document.getElementById('emp-qr-link-inp');

      if (linkInp) linkInp.value = data.mobile_url;
      if (qrImg) {
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=4&data=${encodeURIComponent(data.mobile_url)}`;
      }

      if (typeof showToast === 'function') showToast("✅ Eski QR iptal edildi, YENİ güvenli QR üretildi!", "success");
      await loadMarketEmployees();
    } else {
      if (typeof showToast === 'function') showToast(`❌ ${data.message}`, "error");
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast("QR kodu yenilenemedi.", "error");
  }
}

async function printEmployeeBadge() {
  if (!currentQrInfo || !currentQrInfo.employee) return;
  const emp = currentQrInfo.employee;
  if (typeof showToast === 'function') {
    showToast(`🖨️ '${emp.name}' için yaka kartı / QR yazdırılıyor...`, "info");
  }
}

// Window Global Exportları
window.loadMarketPanel = loadMarketPanel;
window.switchMarketSubTab = switchMarketSubTab;
window.loadMarketProfile = loadMarketProfile;
window.saveMarketProfile = saveMarketProfile;
window.loadMarketRoles = loadMarketRoles;
window.loadMarketEmployees = loadMarketEmployees;
window.openAddEmployeeModal = openAddEmployeeModal;
window.openEditEmployeeModal = openEditEmployeeModal;
window.closeEmployeeFormModal = closeEmployeeFormModal;
window.submitEmployeeForm = submitEmployeeForm;
window.deleteEmployee = deleteEmployee;
window.openAddRoleModal = openAddRoleModal;
window.openEditRoleModal = openEditRoleModal;
window.closeRoleFormModal = closeRoleFormModal;
window.submitRoleForm = submitRoleForm;
window.toggleRoleActiveStatus = toggleRoleActiveStatus;
window.deleteCustomRole = deleteCustomRole;
window.toggleRolePermCheckbox = toggleRolePermCheckbox;
window.openEmployeePermissionsModal = openEmployeePermissionsModal;
window.closeEmployeePermissionsModal = closeEmployeePermissionsModal;
window.renderPermissionSwitches = renderPermissionSwitches;
window.togglePermSwitch = togglePermSwitch;
window.resetPermissionsToRoleDefault = resetPermissionsToRoleDefault;
window.saveCurrentEmployeePermissions = saveCurrentEmployeePermissions;
window.loadMarketEmployeeReports = loadMarketEmployeeReports;
window.openEmployeeReportDetailModal = openEmployeeReportDetailModal;
window.closeEmployeeReportDetailModal = closeEmployeeReportDetailModal;
window.toggleEmployeeBreak = toggleEmployeeBreak;
window.safeEmployeeLogout = safeEmployeeLogout;
window.updateHeaderShiftUI = updateHeaderShiftUI;
window.filterMarketEmployeesList = filterMarketEmployeesList;
window.selectAllRolePerms = selectAllRolePerms;
window.hasPermission = hasPermission;

window.openEmployeeQrModal = openEmployeeQrModal;
window.closeEmployeeQrModal = closeEmployeeQrModal;
window.copyEmployeeQrLink = copyEmployeeQrLink;
window.regenerateCurrentEmployeeQr = regenerateCurrentEmployeeQr;
window.printEmployeeBadge = printEmployeeBadge;
window.setMarketOperatingMode = setMarketOperatingMode;
window.loadMarketOperatingMode = loadMarketOperatingMode;
