// -*- coding: utf-8 -*-
/**
 * =========================================================================
 * MARKET BİLGİLERİ, KASİYERLER & GELİR / GİDER MUHASEBE PANELİ (MUHASEBE_PANELI.JS)
 * =========================================================================
 */

let currentAccountingYear = new Date().getFullYear();
let currentAccountingMonth = new Date().getMonth() + 1;
let currentAccountingData = null;

// 1. Muhasebe Genel Bakış Yükleyici
async function loadAccountingOverview(year, month) {
  if (year) currentAccountingYear = year;
  if (month) currentAccountingMonth = month;

  try {
    const res = await fetch(`/api/accounting/overview?year=${currentAccountingYear}&month=${currentAccountingMonth}`);
    const data = await res.json();

    if (data.status === 'success') {
      currentAccountingData = data;
      renderAccountingKPIs(data);
      renderAccountingCategories(data.category_breakdown || [], data.total_expenses);
      renderAccountingExpensesTable(data.expenses || []);
    }
  } catch (e) {
    console.error('Muhasebe verileri yükleme hatası:', e);
  }
}

// 2. Finansal KPI Kartları Renderı
function renderAccountingKPIs(data) {
  const badge = document.getElementById('acc-period-badge');
  const incEl = document.getElementById('acc-kpi-income');
  const incSubEl = document.getElementById('acc-kpi-income-sub');
  const expEl = document.getElementById('acc-kpi-expense');
  const profEl = document.getElementById('acc-kpi-profit');
  const profMargEl = document.getElementById('acc-kpi-profit-margin');

  if (badge) badge.innerText = `${data.month_name} ${data.year}`;
  if (incEl) incEl.innerText = data.total_sales_income_str || '0,00 TL';
  if (incSubEl) incSubEl.innerHTML = `💵 Nakit: <strong>${data.cash_income_str}</strong> • 💳 Kart: <strong>${data.card_income_str}</strong> (${data.total_receipts} Fiş)`;
  if (expEl) expEl.innerText = data.total_expenses_str || '0,00 TL';

  if (profEl) {
    profEl.innerText = data.net_profit_str || '0,00 TL';
    profEl.style.color = data.is_profit ? '#34d399' : '#f87171';
  }

  if (profMargEl) {
    profMargEl.innerHTML = data.is_profit
      ? `📈 <strong style="color:#34d399;">+%${data.profit_margin}</strong> Net Kâr Oranı`
      : `📉 <strong style="color:#f87171;">%${data.profit_margin}</strong> Gider Fazlası`;
  }
}

// 3. Kategori Dağılım Çubuğu ve Kartları
function renderAccountingCategories(categories, totalExpenses) {
  const barEl = document.getElementById('acc-category-progressbar');
  const gridEl = document.getElementById('acc-category-cards-grid');
  const countEl = document.getElementById('acc-expense-count-text');

  if (countEl) {
    const expCount = currentAccountingData?.expenses?.length || 0;
    countEl.innerText = expCount;
  }

  if (!barEl || !gridEl) return;

  if (!categories || categories.length === 0 || totalExpenses <= 0) {
    barEl.innerHTML = `<div style="width: 100%; height: 100%; background: rgba(255,255,255,0.06); text-align: center; font-size: 10px; color: #64748b; line-height: 12px;">Henüz kayıtlı gider yok</div>`;
    gridEl.innerHTML = `<div style="grid-column: 1 / -1; padding: 10px; color: #94a3b8; font-size: 11.5px; text-align: center;">Bu ay için henüz gider kalemi girilmemiştir.</div>`;
    return;
  }

  // Renkli Çoklu Dağılım Çubuğu
  barEl.innerHTML = categories.map(cat => {
    if (cat.percentage <= 0) return '';
    return `<div style="width: ${cat.percentage}%; background: ${cat.color}; height: 100%;" title="${cat.category}: %${cat.percentage} (${cat.total_str})"></div>`;
  }).join('');

  // Kategori Kartları
  gridEl.innerHTML = categories.map(cat => `
    <div style="background: rgba(15,23,42,0.7); border: 1px solid rgba(255,255,255,0.06); border-left: 3px solid ${cat.color}; border-radius: 6px; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 16px;">${cat.icon}</span>
        <div>
          <div style="font-weight: 700; color: #f8fafc; font-size: 11.5px;">${cat.category}</div>
          <small style="color: #94a3b8; font-size: 10px;">%${cat.percentage} Gider Payı</small>
        </div>
      </div>
      <div style="font-family: monospace; font-size: 12.5px; font-weight: 800; color: ${cat.color};">${cat.total_str}</div>
    </div>
  `).join('');
}

// 4. Gelir & Gider Tablosu Renderı
function renderAccountingExpensesTable(expenses) {
  const tbody = document.getElementById('acc-expenses-table-body');
  const countBadge = document.getElementById('acc-table-count-badge');
  if (!tbody) return;

  if (countBadge) countBadge.innerText = `${expenses.length} Gider Kaydı`;

  if (!expenses || expenses.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 30px; color: #94a3b8;">
          <div style="font-size: 28px; margin-bottom: 6px;">💸</div>
          <strong>Bu aya ait kayıtlı gider bulunamadı.</strong>
          <p style="font-size: 11px; margin-top: 4px; color: #64748b;">Sağ üstteki "➕ Yeni Gider Ekle" butonuna basarak dükkan kirası veya personel maaşı ekleyebilirsiniz.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = expenses.map(exp => `
    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.15s ease;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
      <td style="padding: 10px 12px; font-family: monospace; font-size: 11.5px; color: #cbd5e1;">
        <strong>${exp.date || '-'}</strong> <small style="color:#64748b;">${exp.time || ''}</small>
      </td>
      <td style="padding: 10px 12px;">
        <span style="background: ${exp.color}15; color: ${exp.color}; border: 1px solid ${exp.color}30; font-size: 10.5px; font-weight: 800; padding: 2px 7px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px;">
          ${exp.icon || '💸'} ${exp.category}
        </span>
      </td>
      <td style="padding: 10px 12px;">
        <div style="font-weight: 700; color: #f8fafc; font-size: 12.5px;">${exp.title}</div>
        ${exp.notes ? `<small style="color:#94a3b8; font-size:10.5px;">📝 ${exp.notes}</small>` : ''}
      </td>
      <td style="padding: 10px 12px; color: #cbd5e1; font-size: 11.5px;">
        ${exp.recipient || '-'}
      </td>
      <td style="padding: 10px 12px; text-align: center;">
        <span style="background: rgba(255,255,255,0.06); color: #94a3b8; font-size: 11px; padding: 2px 6px; border-radius: 4px;">
          ${exp.payment_method || 'Nakit'}
        </span>
      </td>
      <td style="padding: 10px 12px; text-align: right; font-family: monospace; font-size: 13.5px; font-weight: 900; color: #f87171;">
        -${exp.amount_str || '0,00 TL'}
      </td>
      <td style="padding: 10px 12px; text-align: right;">
        <button type="button" onclick="deleteAccountingExpense('${exp.id}', '${exp.title}')" class="btn-secondary" style="padding: 3px 8px; font-size: 11px; color: #f87171;" title="Gideri Sil">
          🗑️ Sil
        </button>
      </td>
    </tr>
  `).join('');
}

// 5. Ay Değiştirme ve Kontroller
function navigateAccountingMonth(dir) {
  currentAccountingMonth += dir;
  if (currentAccountingMonth > 12) {
    currentAccountingMonth = 1;
    currentAccountingYear += 1;
  } else if (currentAccountingMonth < 1) {
    currentAccountingMonth = 12;
    currentAccountingYear -= 1;
  }
  loadAccountingOverview();
}

function goToCurrentAccountingMonth() {
  currentAccountingYear = new Date().getFullYear();
  currentAccountingMonth = new Date().getMonth() + 1;
  loadAccountingOverview();
}

// 6. Sekme Geçişi (Giderler / Dağılım / Kategoriler)
function switchAccountingSubTab(tabKey) {
  const btnExpenses = document.getElementById('acc-subtab-btn-expenses');
  const btnBreakdown = document.getElementById('acc-subtab-btn-breakdown');
  const btnCategories = document.getElementById('acc-subtab-btn-categories');
  
  const paneExpenses = document.getElementById('acc-subpane-expenses');
  const paneBreakdown = document.getElementById('acc-subpane-breakdown');
  const paneCategories = document.getElementById('acc-subpane-categories');

  [btnExpenses, btnBreakdown, btnCategories].forEach(b => {
    if (b) {
      b.className = 'btn-secondary';
      b.style.background = 'transparent';
      b.style.color = '#94a3b8';
    }
  });

  if (paneExpenses) paneExpenses.style.display = 'none';
  if (paneBreakdown) paneBreakdown.style.display = 'none';
  if (paneCategories) paneCategories.style.display = 'none';

  if (tabKey === 'breakdown') {
    if (btnBreakdown) {
      btnBreakdown.className = 'btn-primary';
      btnBreakdown.style.background = '#0284c7';
      btnBreakdown.style.color = '#fff';
    }
    if (paneBreakdown) paneBreakdown.style.display = 'flex';
  } else if (tabKey === 'categories') {
    if (btnCategories) {
      btnCategories.className = 'btn-primary';
      btnCategories.style.background = '#0284c7';
      btnCategories.style.color = '#fff';
    }
    if (paneCategories) paneCategories.style.display = 'flex';
    renderCustomCategoriesList();
  } else {
    if (btnExpenses) {
      btnExpenses.className = 'btn-primary';
      btnExpenses.style.background = '#0284c7';
      btnExpenses.style.color = '#fff';
    }
    if (paneExpenses) paneExpenses.style.display = 'flex';
  }
}

// Kategoriye Göre Gider Filtreleme
function filterAccountingByCategory(category) {
  if (!currentAccountingData || !currentAccountingData.expenses) return;
  const filtered = category === 'all' 
    ? currentAccountingData.expenses 
    : currentAccountingData.expenses.filter(e => e.category === category);
  renderAccountingExpensesTable(filtered);
}

// Özel Gider Kategorilerini Render Et
function renderCustomCategoriesList() {
  const container = document.getElementById('acc-custom-categories-list');
  if (!container || !currentAccountingData) return;
  const categories = currentAccountingData.all_categories || [];

  container.innerHTML = categories.map(cat => `
    <div style="background: rgba(15,23,42,0.8); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 18px;">${cat.icon || '🏷️'}</span>
        <div>
          <strong style="color: #f8fafc; font-size: 12.5px;">${cat.name}</strong>
          <small style="display: block; color: #94a3b8; font-size: 10px;">Kod: ${cat.code}</small>
        </div>
      </div>
      <span style="font-size: 11px; background: rgba(56,189,248,0.15); color: #38bdf8; padding: 2px 6px; border-radius: 4px;">Aktif</span>
    </div>
  `).join('');

  // Filtreleme dropdown'ını güncelle
  const filterSelect = document.getElementById('acc-filter-category');
  if (filterSelect) {
    filterSelect.innerHTML = '<option value="all">Tüm Kategoriler</option>' + categories.map(c => `
      <option value="${c.name}">${c.icon || ''} ${c.name}</option>
    `).join('');
  }
}

function addNewCustomExpenseCategory() {
  const icon = document.getElementById('inp-new-category-icon')?.value?.trim() || '🏷️';
  const name = document.getElementById('inp-new-category-name')?.value?.trim() || '';
  if (!name) {
    if (typeof showToast === 'function') showToast('Lütfen bir kategori adı giriniz.', 'error');
    return;
  }
  if (typeof showToast === 'function') showToast(`✓ "${name}" kategorisi başarıyla eklendi!`, 'success');
  if (document.getElementById('inp-new-category-name')) document.getElementById('inp-new-category-name').value = '';
  if (document.getElementById('inp-new-category-icon')) document.getElementById('inp-new-category-icon').value = '';
  loadAccountingOverview();
}

// 7. Yeni Gider Modalı Açma / Kapama & Kayıt
function openNewExpenseModal() {
  const dateInp = document.getElementById('modal-exp-date');
  if (dateInp) {
    dateInp.value = new Date().toISOString().split('T')[0];
  }
  if (typeof openUniversalModal === 'function') {
    openUniversalModal('modal-new-expense');
  } else {
    const m = document.getElementById('modal-new-expense');
    if (m) m.style.display = 'flex';
  }
}

function closeNewExpenseModal() {
  if (typeof closeUniversalModal === 'function') {
    closeUniversalModal('modal-new-expense');
  } else {
    const m = document.getElementById('modal-new-expense');
    if (m) m.style.display = 'none';
  }
}

async function submitSaveExpenseForm(e) {
  if (e) e.preventDefault();

  const category = document.getElementById('modal-exp-category')?.value || 'Vergi, Muhasebe & Diğer';
  const amount = parseFloat(document.getElementById('modal-exp-amount')?.value) || 0;
  const title = document.getElementById('modal-exp-title')?.value?.trim() || '';
  const payment_method = document.getElementById('modal-exp-payment-method')?.value || 'Kasa Nakit';
  const recipient = document.getElementById('modal-exp-recipient')?.value?.trim() || '';
  const date = document.getElementById('modal-exp-date')?.value || '';
  const notes = document.getElementById('modal-exp-notes')?.value?.trim() || '';

  if (!title || amount <= 0) {
    if (typeof showToast === 'function') showToast('Lütfen geçerli bir gider açıklaması ve tutarı giriniz.', 'error');
    return;
  }

  try {
    const res = await fetch('/api/accounting/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, amount, title, payment_method, recipient, date, notes })
    });
    const data = await res.json();
    if (data.status === 'success') {
      if (typeof showToast === 'function') showToast('✓ Gider kaydı başarıyla eklendi!', 'success');
      closeNewExpenseModal();
      document.getElementById('form-new-expense')?.reset();
      loadAccountingOverview();
    } else {
      if (typeof showToast === 'function') showToast(data.message || 'Gider kaydedilemedi.', 'error');
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast('Gider kaydetme hatası!', 'error');
  }
}

async function deleteAccountingExpense(expId, expTitle) {
  const ok = await showCustomConfirm(`"${expTitle}" başlıklı gider kaydını silmek istediğinize emin misiniz?`, 'Gider Kaydı Sil', 'Sil', 'Vazgeç', '🗑️');
  if (!ok) return;

  try {
    const res = await fetch('/api/accounting/expenses/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: expId })
    });
    const data = await res.json();
    if (data.status === 'success') {
      if (typeof showToast === 'function') showToast('Gider kaydı silindi.', 'info');
      loadAccountingOverview();
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast('Silme hatası!', 'error');
  }
}

// 8. Canlı Arama Filtresi
function filterAccountingTable(query) {
  const q = (query || '').toLowerCase().trim();
  const rows = document.querySelectorAll('#acc-expenses-table-body tr');
  rows.forEach(r => {
    const text = r.innerText.toLowerCase();
    r.style.display = (!q || text.includes(q)) ? '' : 'none';
  });
}

// 9. Excel (.csv) İndirme
function exportAccountingToExcel() {
  const data = currentAccountingData;
  if (!data) return;

  let csv = '\uFEFF';
  csv += `MARKET VE MUHASEBE GELİR / GİDER RAPORU;${data.month_name} ${data.year}\n`;
  csv += `Toplam Satış Geliri;${data.total_sales_income_str}\n`;
  csv += `Nakit Gelir;${data.cash_income_str}\n`;
  csv += `Kredi Kartı Geliri;${data.card_income_str}\n`;
  csv += `Toplam Giderler;${data.total_expenses_str}\n`;
  csv += `Net Kâr;${data.net_profit_str}\n\n`;

  csv += `GİDER HAREKETLERİ LİSTESİ\n`;
  csv += `Tarih;Kategori;Başlık;Kurum/Kişi;Ödeme Türü;Tutar;Notlar\n`;

  const expenses = data.expenses || [];
  expenses.forEach(e => {
    csv += `"${e.date || ''}";"${e.category || ''}";"${(e.title || '').replace(/"/g, '""')}";"${e.recipient || ''}";"${e.payment_method || ''}";${e.amount};"${(e.notes || '').replace(/"/g, '""')}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Muhasebe_Gelir_Gider_${data.year}_${String(data.month).padStart(2, '0')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 10. Market & Kasiyer Bilgileri Senkronizasyonu
async function loadAccountingMarketInfo() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    if (data.status === 'success' && data.settings) {
      const s = data.settings;
      if (document.getElementById('acc-market-name')) document.getElementById('acc-market-name').value = s.market_name || '';
      if (document.getElementById('acc-branch-name')) document.getElementById('acc-branch-name').value = s.branch_name || '';
      if (document.getElementById('acc-phone')) document.getElementById('acc-phone').value = s.phone || '';
      if (document.getElementById('acc-pos-commission')) document.getElementById('acc-pos-commission').value = s.pos_commission_rate !== undefined ? s.pos_commission_rate : 1.85;
      if (document.getElementById('acc-tax-office')) document.getElementById('acc-tax-office').value = s.tax_office || '';
      if (document.getElementById('acc-tax-no')) document.getElementById('acc-tax-no').value = s.tax_no || '';
      if (document.getElementById('acc-receipt-footer')) document.getElementById('acc-receipt-footer').value = s.receipt_footer_note || '';
    }
  } catch (e) {}

  // Kasiyerleri doldur
  loadAccountingCashiers();
}

async function saveAccountingMarketInfo() {
  const payload = {
    market_name: document.getElementById('acc-market-name')?.value?.trim() || 'YARENLER MARKET',
    branch_name: document.getElementById('acc-branch-name')?.value?.trim() || 'Merkez Şube',
    phone: document.getElementById('acc-phone')?.value?.trim() || '',
    pos_commission_rate: parseFloat(document.getElementById('acc-pos-commission')?.value) || 1.85,
    tax_office: document.getElementById('acc-tax-office')?.value?.trim() || '',
    tax_no: document.getElementById('acc-tax-no')?.value?.trim() || '',
    receipt_footer_note: document.getElementById('acc-receipt-footer')?.value?.trim() || ''
  };

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.status === 'success') {
      if (typeof showToast === 'function') showToast('✓ Market bilgileri başarıyla güncellendi!', 'success');
      loadAccountingMarketInfo();
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('Kayıt hatası!', 'error');
  }
}

async function loadAccountingCashiers() {
  const tbody = document.getElementById('acc-cashiers-table-body');
  const badge = document.getElementById('acc-cashier-badge');
  if (!tbody) return;

  try {
    const res = await fetch('/api/cashiers');
    const data = await res.json();
    if (data.status === 'success' && data.cashiers) {
      const list = data.cashiers;
      if (badge) badge.innerText = `${list.length} Kasiyer`;

      if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 12px; color: #94a3b8;">Kayıtlı kasiyer yok.</td></tr>`;
        return;
      }

      tbody.innerHTML = list.map(c => {
        const isActive = c.active !== false;
        const roleLabel = c.role === 'admin' ? '👑 Müdür' : (c.role === 'supervisor' ? '⭐ Kasa Şefi' : '👤 Kasiyer');
        return `
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
            <td style="padding: 8px 10px; font-weight: 700; color: #f8fafc;">
              <span style="margin-right: 4px;">${c.role === 'admin' ? '👑' : '👤'}</span>
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
              <button type="button" onclick="toggleAccountingCashierActive('${c.id}')" class="btn-secondary" style="padding: 3px 8px; font-size: 10.5px; margin-right: 4px;" title="Durum Değiştir">
                ${isActive ? 'Durdur' : 'Aktif Et'}
              </button>
              <button type="button" onclick="deleteAccountingCashier('${c.id}', '${c.name}')" class="btn-secondary" style="padding: 3px 8px; font-size: 10.5px; color: #f87171;" title="Sil">
                🗑️
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }
  } catch (e) {}
}

async function submitAddNewAccountingCashier() {
  const nameInp = document.getElementById('acc-new-cashier-name');
  const idInp = document.getElementById('acc-new-cashier-id');
  const pinInp = document.getElementById('acc-new-cashier-pin');
  const roleInp = document.getElementById('acc-new-cashier-role');

  const name = nameInp?.value?.trim() || '';
  const id = idInp?.value?.trim() || '';
  const pin = pinInp?.value?.trim() || '';
  const role = roleInp?.value || 'cashier';

  if (!name) {
    if (typeof showToast === 'function') showToast('Lütfen kasiyer adını giriniz.', 'error');
    return;
  }

  try {
    const res = await fetch('/api/cashiers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, id, pin, role, active: true })
    });
    const data = await res.json();
    if (data.status === 'success') {
      if (typeof showToast === 'function') showToast(`✓ ${name} başarıyla eklendi!`, 'success');
      if (nameInp) nameInp.value = '';
      if (idInp) idInp.value = '';
      if (pinInp) pinInp.value = '';
      loadAccountingCashiers();
    }
  } catch (e) {}
}

async function deleteAccountingCashier(cid, cname) {
  const ok = await showCustomConfirm(`${cname} isimli kasiyeri silmek istediğinize emin misiniz?`, 'Kasiyer Sil', 'Sil', 'Vazgeç', '🗑️');
  if (!ok) return;

  try {
    const res = await fetch('/api/cashiers/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: cid })
    });
    const data = await res.json();
    if (data.status === 'success') {
      loadAccountingCashiers();
    }
  } catch (e) {}
}

async function toggleAccountingCashierActive(cid) {
  try {
    const res = await fetch('/api/cashiers/toggle-active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: cid })
    });
    const data = await res.json();
    if (data.status === 'success') {
      loadAccountingCashiers();
    }
  } catch (e) {}
}

// Window Global Bağlantıları
window.loadAccountingOverview = loadAccountingOverview;
window.navigateAccountingMonth = navigateAccountingMonth;
window.goToCurrentAccountingMonth = goToCurrentAccountingMonth;
window.switchAccountingSubTab = switchAccountingSubTab;
window.openNewExpenseModal = openNewExpenseModal;
window.closeNewExpenseModal = closeNewExpenseModal;
window.submitSaveExpenseForm = submitSaveExpenseForm;
window.deleteAccountingExpense = deleteAccountingExpense;
window.filterAccountingTable = filterAccountingTable;
window.exportAccountingToExcel = exportAccountingToExcel;
window.loadAccountingMarketInfo = loadAccountingMarketInfo;
window.saveAccountingMarketInfo = saveAccountingMarketInfo;
window.loadAccountingCashiers = loadAccountingCashiers;
window.submitAddNewAccountingCashier = submitAddNewAccountingCashier;
window.deleteAccountingCashier = deleteAccountingCashier;
window.toggleAccountingCashierActive = toggleAccountingCashierActive;
