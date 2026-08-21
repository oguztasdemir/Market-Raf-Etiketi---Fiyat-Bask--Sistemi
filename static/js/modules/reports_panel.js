/**
 * Günlük Faaliyet, Fiyat Değişiklikleri ve Baskı Raporlama Modülü
 */

let dailyReportsData = [];
let currentDayDetail = null;
let currentDetailTab = 'price_changes'; // 'price_changes' | 'printed_items'

async function openDailyReportsModal() {
  const modal = document.getElementById('modal-daily-reports');
  if (!modal) return;
  modal.style.display = 'flex';
  await loadDailyReportsSummary();
}

function closeDailyReportsModal() {
  const modal = document.getElementById('modal-daily-reports');
  if (modal) modal.style.display = 'none';
}

async function loadDailyReportsSummary() {
  const container = document.getElementById('daily-reports-list');
  if (!container) return;

  container.innerHTML = `
    <div style="text-align: center; padding: 40px; color: var(--text-muted);">
      <div class="spinner" style="margin: 0 auto 12px;"></div>
      Raporlar yükleniyor...
    </div>
  `;

  try {
    const res = await fetch(`${API_BASE}/api/reports/daily`);
    const data = await res.json();
    if (data.status === 'success') {
      dailyReportsData = data.reports || [];
      renderDailyReportsList(dailyReportsData);
    } else {
      container.innerHTML = `<div style="text-align: center; color: #ef4444; padding: 30px;">Hata: ${data.message}</div>`;
    }
  } catch (err) {
    container.innerHTML = `<div style="text-align: center; color: #ef4444; padding: 30px;">Bağlantı hatası: ${err.message}</div>`;
  }
}

function renderDailyReportsList(reports) {
  const container = document.getElementById('daily-reports-list');
  if (!container) return;

  if (reports.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-muted); background: #090d16; border-radius: 10px; border: 1px solid var(--border-color);">
        <span style="font-size: 32px; display: block; margin-bottom: 8px;">📊</span>
        <strong>Henüz kaydedilmiş bir faaliyet raporu bulunmuyor.</strong>
        <p style="font-size: 12px; margin-top: 4px;">Bugün yapılan fiyat değişiklikleri ve baskılar otomatik olarak burada gün gün listelenecektir.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  reports.forEach((r, idx) => {
    const card = document.createElement('div');
    card.className = 'daily-report-card';
    card.style.cssText = `
      background: #0d1322;
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
      transition: transform 0.15s ease, border-color 0.15s ease;
    `;

    const isToday = idx === 0;
    const todayBadge = isToday 
      ? '<span style="background: rgba(16,185,129,0.2); color: #34d399; border: 1px solid rgba(16,185,129,0.4); padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; margin-left: 8px;">BUGÜN</span>' 
      : '';

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.07); padding-bottom: 12px; margin-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="font-size: 20px;">📅</span>
          <strong style="font-size: 15px; color: #ffffff;">${r.display_date}</strong>
          ${todayBadge}
        </div>
        <button class="btn-sm btn-primary" onclick="openDailyDetailModal('${r.date_key}')" style="padding: 6px 14px; font-weight: 700; font-size: 12px;">
          🔍 Günün Detaylarını Gör (${r.price_changes_count + r.printed_items_count} İşlem)
        </button>
      </div>

      <!-- 4 Temel Metrik Kutucuğu -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px;">
        <div style="background: #090d16; border: 1px solid var(--border-color); border-radius: 8px; padding: 10px; text-align: center;">
          <div style="font-size: 11px; color: var(--text-muted); font-weight: 700;">📦 TOPLAM ÜRÜN</div>
          <div style="font-size: 18px; font-weight: 900; color: #38bdf8; margin-top: 2px;">${r.total_catalog_products.toLocaleString('tr-TR')}</div>
        </div>

        <div style="background: #090d16; border: 1px solid var(--border-color); border-radius: 8px; padding: 10px; text-align: center;">
          <div style="font-size: 11px; color: var(--text-muted); font-weight: 700;">📱 MOBİLDEN FİYAT DEĞİŞİMİ</div>
          <div style="font-size: 18px; font-weight: 900; color: #a78bfa; margin-top: 2px;">${r.mobile_price_changes} Adet</div>
        </div>

        <div style="background: #090d16; border: 1px solid var(--border-color); border-radius: 8px; padding: 10px; text-align: center;">
          <div style="font-size: 11px; color: var(--text-muted); font-weight: 700;">💻 PC'DEN FİYAT DEĞİŞİMİ</div>
          <div style="font-size: 18px; font-weight: 900; color: #60a5fa; margin-top: 2px;">${r.pc_price_changes} Adet</div>
        </div>

        <div style="background: #090d16; border: 1px solid var(--border-color); border-radius: 8px; padding: 10px; text-align: center;">
          <div style="font-size: 11px; color: var(--text-muted); font-weight: 700;">🖨️ BASILAN BARKOD/ETİKET</div>
          <div style="font-size: 18px; font-weight: 900; color: #34d399; margin-top: 2px;">${r.total_printed_barcodes} Adet</div>
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
  if (bodyEl) bodyEl.innerHTML = '<div class="spinner" style="margin:40px auto;"></div>';

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
          <td style="padding: 8px 10px; font-family: monospace; color: #94a3b8;">${item.time}</td>
          <td style="padding: 8px 10px;">${srcBadge}</td>
          <td style="padding: 8px 10px; font-family: monospace; color: #38bdf8;">${item.barcode}</td>
          <td style="padding: 8px 10px; font-weight: 700; color: #ffffff;">${item.title}</td>
          <td style="padding: 8px 10px; color: #ef4444; text-decoration: line-through; text-align: right;">${item.old_price}</td>
          <td style="padding: 8px 10px; color: #34d399; font-weight: 900; text-align: right;">${item.new_price}</td>
        </tr>
      `;
    });

    bodyEl.innerHTML = `
      <table style="width: 100%; border-collapse: collapse; font-size: 12.5px;">
        <thead>
          <tr style="background: #090d16; color: var(--text-muted); text-align: left; position: sticky; top: 0; z-index: 2;">
            <th style="padding: 8px 10px; width: 70px;">Saat</th>
            <th style="padding: 8px 10px; width: 90px;">Kaynak</th>
            <th style="padding: 8px 10px; width: 120px;">Barkod</th>
            <th style="padding: 8px 10px;">Ürün Adı</th>
            <th style="padding: 8px 10px; text-align: right; width: 100px;">Eski Fiyat</th>
            <th style="padding: 8px 10px; text-align: right; width: 110px;">Yeni Fiyat</th>
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
          <td style="padding: 8px 10px; font-family: monospace; color: #94a3b8;">${item.time}</td>
          <td style="padding: 8px 10px;">${srcBadge}</td>
          <td style="padding: 8px 10px; font-family: monospace; color: #38bdf8;">${item.barcode || '-'}</td>
          <td style="padding: 8px 10px; font-weight: 700; color: #ffffff;">${item.title}</td>
          <td style="padding: 8px 10px; color: #34d399; font-weight: 900; text-align: right;">${item.price || '-'}</td>
          <td style="padding: 8px 10px; text-align: center; font-weight: 800; color: #38bdf8;">${item.copies || 1} Adet</td>
        </tr>
      `;
    });

    bodyEl.innerHTML = `
      <table style="width: 100%; border-collapse: collapse; font-size: 12.5px;">
        <thead>
          <tr style="background: #090d16; color: var(--text-muted); text-align: left; position: sticky; top: 0; z-index: 2;">
            <th style="padding: 8px 10px; width: 70px;">Saat</th>
            <th style="padding: 8px 10px; width: 90px;">Kaynak</th>
            <th style="padding: 8px 10px; width: 120px;">Barkod</th>
            <th style="padding: 8px 10px;">Ürün Adı</th>
            <th style="padding: 8px 10px; text-align: right; width: 110px;">Basılan Fiyat</th>
            <th style="padding: 8px 10px; text-align: center; width: 90px;">Baskı Adedi</th>
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
window.openDailyDetailModal = openDailyDetailModal;
window.closeDailyDetailModal = closeDailyDetailModal;
window.switchDetailSubTab = switchDetailSubTab;
window.renderCurrentDayDetailContent = renderCurrentDayDetailContent;
