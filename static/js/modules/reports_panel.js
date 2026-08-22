/**
 * Günlük Faaliyet, Fiyat Değişiklikleri ve Baskı Raporlama Modülü
 */

let dailyReportsData = [];
let filteredReportsData = [];
let currentDayDetail = null;
let currentDetailTab = 'price_changes'; // 'price_changes' | 'printed_items'

// Geriye dönük uyumluluk için (Herhangi bir yerden çağrılırsa direkt sekmeye yönlendirir)
function openDailyReportsModal() {
  if (typeof switchTab === 'function') {
    switchTab('tab-reports');
  }
}

function closeDailyReportsModal() {
  // Geriye dönük no-op
}

async function loadDailyReportsSummary(showToastFeedback = false) {
  const container = document.getElementById('daily-reports-list');
  const kpiContainer = document.getElementById('reports-kpi-summary');
  
  if (container) {
    container.innerHTML = `
      <div style="text-align: center; padding: 50px 20px; color: var(--text-muted);">
        <div class="spinner" style="margin: 0 auto 14px;"></div>
        <div style="font-size: 13px; font-weight: 600;">Faaliyet raporları yükleniyor...</div>
      </div>
    `;
  }

  try {
    const res = await fetch(`${API_BASE}/api/reports/daily`);
    const data = await res.json();
    if (data.status === 'success') {
      dailyReportsData = data.reports || [];
      filteredReportsData = [...dailyReportsData];
      
      const searchInp = document.getElementById('reports-search-inp');
      if (searchInp && searchInp.value.trim()) {
        onDailyReportsSearchInput(searchInp.value);
      } else {
        renderDailyReportsKPIs(dailyReportsData);
        renderDailyReportsList(dailyReportsData);
      }

      if (showToastFeedback && typeof showToast === 'function') {
        showToast('Raporlar başarıyla güncellendi.', 'success');
      }
    } else {
      if (container) {
        container.innerHTML = `<div style="text-align: center; color: #ef4444; padding: 30px;">Hata: ${data.message}</div>`;
      }
    }
  } catch (err) {
    if (container) {
      container.innerHTML = `<div style="text-align: center; color: #ef4444; padding: 30px;">Bağlantı hatası: ${err.message}</div>`;
    }
  }
}

function renderDailyReportsKPIs(reports) {
  const kpiContainer = document.getElementById('reports-kpi-summary');
  if (!kpiContainer) return;

  let totalDays = reports.length;
  let totalMobileChanges = 0;
  let totalPcChanges = 0;
  let totalPrinted = 0;

  reports.forEach(r => {
    totalMobileChanges += (r.mobile_price_changes || 0);
    totalPcChanges += (r.pc_price_changes || 0);
    totalPrinted += (r.total_printed_barcodes || 0);
  });

  kpiContainer.innerHTML = `
    <div class="report-kpi-card" style="border-top: 3px solid #38bdf8;">
      <div class="kpi-icon">📅</div>
      <div class="kpi-content">
        <span class="kpi-label">KAYITLI GÜN SAYISI</span>
        <strong class="kpi-value text-accent">${totalDays} Gün</strong>
      </div>
    </div>

    <div class="report-kpi-card" style="border-top: 3px solid #a78bfa;">
      <div class="kpi-icon">📱</div>
      <div class="kpi-content">
        <span class="kpi-label">TOPLAM MOBİL DEĞİŞİKLİK</span>
        <strong class="kpi-value" style="color: #c4b5fd;">${totalMobileChanges.toLocaleString('tr-TR')} Adet</strong>
      </div>
    </div>

    <div class="report-kpi-card" style="border-top: 3px solid #60a5fa;">
      <div class="kpi-icon">💻</div>
      <div class="kpi-content">
        <span class="kpi-label">TOPLAM PC DEĞİŞİKLİK</span>
        <strong class="kpi-value" style="color: #93c5fd;">${totalPcChanges.toLocaleString('tr-TR')} Adet</strong>
      </div>
    </div>

    <div class="report-kpi-card" style="border-top: 3px solid #34d399;">
      <div class="kpi-icon">🖨️</div>
      <div class="kpi-content">
        <span class="kpi-label">TOPLAM BASILAN BARKOD</span>
        <strong class="kpi-value" style="color: #34d399;">${totalPrinted.toLocaleString('tr-TR')} Adet</strong>
      </div>
    </div>
  `;
}

function onDailyReportsSearchInput(query) {
  const q = (query || '').toLowerCase().trim();
  if (!q) {
    filteredReportsData = [...dailyReportsData];
  } else {
    filteredReportsData = dailyReportsData.filter(r => {
      return (r.display_date || '').toLowerCase().includes(q) ||
             (r.date_key || '').toLowerCase().includes(q);
    });
  }
  renderDailyReportsList(filteredReportsData);
}

function renderDailyReportsList(reports) {
  const container = document.getElementById('daily-reports-list');
  if (!container) return;

  if (!reports || reports.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 50px 20px; color: var(--text-muted); background: #090d16; border-radius: 12px; border: 1px solid var(--border-color); margin-top: 6px;">
        <span style="font-size: 38px; display: block; margin-bottom: 10px;">📊</span>
        <strong style="font-size: 15px; color: var(--text-main);">Kayıtlı Faaliyet Raporu Bulunamadı</strong>
        <p style="font-size: 12.5px; margin-top: 6px; color: var(--text-muted);">
          Mobil ve PC üzerinden yapılan fiyat değişiklikleri ve basılan etiketler otomatik olarak burada gün gün arşivlenir.
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  reports.forEach((r, idx) => {
    const card = document.createElement('div');
    card.className = 'daily-report-card';

    const isToday = idx === 0;
    const todayBadge = isToday 
      ? '<span class="today-badge">BUGÜN</span>' 
      : '';

    const totalActions = (r.price_changes_count || 0) + (r.printed_items_count || 0);

    card.innerHTML = `
      <div class="report-card-header">
        <div class="report-card-title-group">
          <span class="report-cal-icon">📅</span>
          <strong class="report-date-text">${r.display_date}</strong>
          <span class="report-date-key">${r.date_key}</span>
          ${todayBadge}
        </div>
        <button class="btn-sm btn-primary" onclick="openDailyDetailModal('${r.date_key}')" style="padding: 7px 16px; font-weight: 700; font-size: 12px; display: inline-flex; align-items: center; gap: 6px;">
          <span>🔍</span> Günün Detaylarını Gör (${totalActions} İşlem)
        </button>
      </div>

      <!-- 4 Temel Metrik Kutucuğu -->
      <div class="report-metrics-grid">
        <div class="metric-box">
          <div class="metric-label">📦 TOPLAM KATALOG</div>
          <div class="metric-val" style="color: #38bdf8;">${(r.total_catalog_products || 0).toLocaleString('tr-TR')}</div>
          <small class="metric-sub">Kayıtlı Ürün</small>
        </div>

        <div class="metric-box">
          <div class="metric-label">📱 MOBİL FİYAT DEĞİŞİMİ</div>
          <div class="metric-val" style="color: #c4b5fd;">${(r.mobile_price_changes || 0).toLocaleString('tr-TR')} Adet</div>
          <small class="metric-sub">Reyondan Güncelleme</small>
        </div>

        <div class="metric-box">
          <div class="metric-label">💻 PC FİYAT DEĞİŞİMİ</div>
          <div class="metric-val" style="color: #93c5fd;">${(r.pc_price_changes || 0).toLocaleString('tr-TR')} Adet</div>
          <small class="metric-sub">Sistem / Excel</small>
        </div>

        <div class="metric-box">
          <div class="metric-label">🖨️ BASILAN BARKOD/ETİKET</div>
          <div class="metric-val" style="color: #34d399;">${(r.total_printed_barcodes || 0).toLocaleString('tr-TR')} Adet</div>
          <small class="metric-sub">Termal Çıktı</small>
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

// --- GÜN DETAY MODALI ---
async function openDailyDetailModal(dayKey) {
  const modal = document.getElementById('modal-daily-detail-view');
  if (!modal) return;
  modal.style.display = 'flex';

  const titleEl = document.getElementById('daily-detail-modal-title');
  const bodyEl = document.getElementById('daily-detail-modal-content');

  if (titleEl) titleEl.innerText = `Günün İşlem Detayları (${dayKey})`;
  if (bodyEl) bodyEl.innerHTML = '<div class="spinner" style="margin:50px auto;"></div>';

  try {
    const res = await fetch(`${API_BASE}/api/reports/daily/${dayKey}`);
    const data = await res.json();
    if (data.status === 'success') {
      currentDayDetail = data.detail;
      if (titleEl) titleEl.innerText = `📅 ${currentDayDetail.display_date} Faaliyet Raporu`;
      renderCurrentDayDetailContent();
    } else {
      if (bodyEl) bodyEl.innerHTML = `<div style="color:#ef4444; text-align:center; padding:30px;">Hata: ${data.message}</div>`;
    }
  } catch (err) {
    if (bodyEl) bodyEl.innerHTML = `<div style="color:#ef4444; text-align:center; padding:30px;">Bağlantı hatası: ${err.message}</div>`;
  }
}

function closeDailyDetailModal() {
  const modal = document.getElementById('modal-daily-detail-view');
  if (modal) modal.style.display = 'none';
  currentDayDetail = null;
}

function switchDetailSubTab(tabName) {
  currentDetailTab = tabName;
  const btnPrices = document.getElementById('btn-detail-tab-prices');
  const btnPrints = document.getElementById('btn-detail-tab-prints');

  if (btnPrices) btnPrices.className = tabName === 'price_changes' ? 'btn-sm btn-primary' : 'btn-sm btn-secondary';
  if (btnPrints) btnPrints.className = tabName === 'printed_items' ? 'btn-sm btn-primary' : 'btn-sm btn-secondary';

  renderCurrentDayDetailContent();
}

function renderCurrentDayDetailContent() {
  const bodyEl = document.getElementById('daily-detail-modal-content');
  if (!bodyEl || !currentDayDetail) return;

  const filterText = (document.getElementById('inp-detail-search')?.value || '').toLowerCase().trim();

  if (currentDetailTab === 'price_changes') {
    const list = (currentDayDetail.price_changes || []).filter(x => {
      if (!filterText) return true;
      return (x.title || '').toLowerCase().includes(filterText) || 
             (x.barcode || '').toLowerCase().includes(filterText) ||
             (x.source || '').toLowerCase().includes(filterText);
    });

    if (list.length === 0) {
      bodyEl.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--text-muted);">
          💰 Bu tarihte kaydedilmiş bir fiyat değişikliği bulunmuyor.
        </div>
      `;
      return;
    }

    let rowsHtml = '';
    list.forEach(item => {
      const srcBadge = item.source === 'MOBILE' 
        ? '<span style="background: rgba(167, 139, 250, 0.2); color: #c4b5fd; border: 1px solid rgba(167, 139, 250, 0.4); padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 800;">📱 MOBİL</span>'
        : '<span style="background: rgba(96, 165, 250, 0.2); color: #93c5fd; border: 1px solid rgba(96, 165, 250, 0.4); padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 800;">💻 PC</span>';

      rowsHtml += `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
          <td style="padding: 9px 12px; font-family: monospace; color: #94a3b8;">${item.time}</td>
          <td style="padding: 9px 12px;">${srcBadge}</td>
          <td style="padding: 9px 12px; font-family: monospace; color: #38bdf8; font-weight: 700;">${item.barcode}</td>
          <td style="padding: 9px 12px; font-weight: 700; color: #ffffff;">${item.title}</td>
          <td style="padding: 9px 12px; color: #ef4444; text-decoration: line-through; text-align: right; font-weight: 600;">${item.old_price}</td>
          <td style="padding: 9px 12px; color: #34d399; font-weight: 900; text-align: right;">${item.new_price}</td>
        </tr>
      `;
    });

    bodyEl.innerHTML = `
      <table style="width: 100%; border-collapse: collapse; font-size: 12.5px;">
        <thead>
          <tr style="background: #090d16; color: var(--text-muted); text-align: left; position: sticky; top: 0; z-index: 2;">
            <th style="padding: 9px 12px; width: 70px;">Saat</th>
            <th style="padding: 9px 12px; width: 90px;">Kaynak</th>
            <th style="padding: 9px 12px; width: 130px;">Barkod</th>
            <th style="padding: 9px 12px;">Ürün Adı</th>
            <th style="padding: 9px 12px; text-align: right; width: 100px;">Eski Fiyat</th>
            <th style="padding: 9px 12px; text-align: right; width: 110px;">Yeni Fiyat</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;
  } else {
    // BASILAN ETİKETLER
    const list = (currentDayDetail.printed_items || []).filter(x => {
      if (!filterText) return true;
      return (x.title || '').toLowerCase().includes(filterText) || 
             (x.barcode || '').toLowerCase().includes(filterText) ||
             (x.source || '').toLowerCase().includes(filterText);
    });

    if (list.length === 0) {
      bodyEl.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--text-muted);">
          🖨️ Bu tarihte yazdırılmış bir etiket kaydı bulunmuyor.
        </div>
      `;
      return;
    }

    let rowsHtml = '';
    list.forEach(item => {
      const srcBadge = item.source === 'MOBILE' 
        ? '<span style="background: rgba(167, 139, 250, 0.2); color: #c4b5fd; border: 1px solid rgba(167, 139, 250, 0.4); padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 800;">📱 MOBİL</span>'
        : '<span style="background: rgba(96, 165, 250, 0.2); color: #93c5fd; border: 1px solid rgba(96, 165, 250, 0.4); padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 800;">💻 PC</span>';

      rowsHtml += `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
          <td style="padding: 9px 12px; font-family: monospace; color: #94a3b8;">${item.time}</td>
          <td style="padding: 9px 12px;">${srcBadge}</td>
          <td style="padding: 9px 12px; font-family: monospace; color: #38bdf8; font-weight: 700;">${item.barcode || '-'}</td>
          <td style="padding: 9px 12px; font-weight: 700; color: #ffffff;">${item.title}</td>
          <td style="padding: 9px 12px; color: #34d399; font-weight: 900; text-align: right;">${item.price || '-'}</td>
          <td style="padding: 9px 12px; text-align: center; font-weight: 800; color: #38bdf8;">${item.copies || 1} Adet</td>
        </tr>
      `;
    });

    bodyEl.innerHTML = `
      <table style="width: 100%; border-collapse: collapse; font-size: 12.5px;">
        <thead>
          <tr style="background: #090d16; color: var(--text-muted); text-align: left; position: sticky; top: 0; z-index: 2;">
            <th style="padding: 9px 12px; width: 70px;">Saat</th>
            <th style="padding: 9px 12px; width: 90px;">Kaynak</th>
            <th style="padding: 9px 12px; width: 130px;">Barkod</th>
            <th style="padding: 9px 12px;">Ürün Adı</th>
            <th style="padding: 9px 12px; text-align: right; width: 110px;">Basılan Fiyat</th>
            <th style="padding: 9px 12px; text-align: center; width: 90px;">Baskı Adedi</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;
  }
}

// Global olarak pencereye bağla
window.openDailyReportsModal = openDailyReportsModal;
window.closeDailyReportsModal = closeDailyReportsModal;
window.loadDailyReportsSummary = loadDailyReportsSummary;
window.onDailyReportsSearchInput = onDailyReportsSearchInput;
window.openDailyDetailModal = openDailyDetailModal;
window.closeDailyDetailModal = closeDailyDetailModal;
window.switchDetailSubTab = switchDetailSubTab;
window.renderCurrentDayDetailContent = renderCurrentDayDetailContent;
