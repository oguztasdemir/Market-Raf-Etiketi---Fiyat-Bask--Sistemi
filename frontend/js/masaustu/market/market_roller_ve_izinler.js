// -*- coding: utf-8 -*-
/**
 * MARKET ROLLERİ, İZİNLER, VARDİYA & QR YÖNETİMİ (market_roller_ve_izinler.js)
 */


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
