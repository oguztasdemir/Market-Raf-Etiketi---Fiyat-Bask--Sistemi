/**
 * Kapsamlı Aylık Performans & Gün Gün Faaliyet/Satış Raporlama Modülü
 */

let currentCalendarYear = new Date().getFullYear();
let currentCalendarMonth = new Date().getMonth() + 1; // 1-12
let selectedReportDate = new Date().toISOString().split('T')[0];
let monthlyReportCache = null;
let reportDaysSearchQuery = '';
let currentModalSubTab = 'products';

document.addEventListener('DOMContentLoaded', () => {
  // İlk yükleme
});

function initReportsPanel() {
  loadMonthlyCalendar(currentCalendarYear, currentCalendarMonth);
}

// 1. Ay Değişimi & Rapor Verisi Çekme
function navigateCalendarMonth(delta) {
  currentCalendarMonth += delta;
  if (currentCalendarMonth > 12) {
    currentCalendarMonth = 1;
    currentCalendarYear++;
  } else if (currentCalendarMonth < 1) {
    currentCalendarMonth = 12;
    currentCalendarYear--;
  }
  loadMonthlyCalendar(currentCalendarYear, currentCalendarMonth);
}

function goToCurrentMonth() {
  const now = new Date();
  currentCalendarYear = now.getFullYear();
  currentCalendarMonth = now.getMonth() + 1;
  selectedReportDate = now.toISOString().split('T')[0];
  loadMonthlyCalendar(currentCalendarYear, currentCalendarMonth);
}

async function loadMonthlyCalendar(year, month) {
  const titleEl = document.getElementById('report-cal-month-title');
  const periodTitleEl = document.getElementById('month-period-title');
  const statusBadgeEl = document.getElementById('month-status-badge');

  if (titleEl) {
    titleEl.innerText = `${year} Yükleniyor...`;
  }

  try {
    const res = await fetch(`/api/reports/calendar?year=${year}&month=${month}`);
    const data = await res.json();

    if (data.status === 'success') {
      monthlyReportCache = data;
      if (titleEl) titleEl.innerText = data.month_name_tr;
      if (periodTitleEl) periodTitleEl.innerText = data.month_period_title || `${data.month_name_tr} ${year} Ayı Performansı`;
      
      if (statusBadgeEl) {
        statusBadgeEl.innerText = data.month_status_badge || (data.is_past_month ? '🟢 Ay Tamamlandı' : '🟡 Devam Eden Ay');
        if (data.is_past_month) {
          statusBadgeEl.style.background = 'rgba(16,185,129,0.2)';
          statusBadgeEl.style.color = '#34d399';
          statusBadgeEl.style.borderColor = 'rgba(16,185,129,0.3)';
        } else {
          statusBadgeEl.style.background = 'rgba(245,158,11,0.2)';
          statusBadgeEl.style.color = '#fbbf24';
          statusBadgeEl.style.borderColor = 'rgba(245,158,11,0.3)';
        }
      }

      renderMonthlyKPICards(data.monthly_summary);
      renderMonthlyDaysTable(data.days);
    }
  } catch (e) {
    console.error('Takvim raporu yükleme hatası:', e);
  }
}

// 2. Aylık Genel Performans KPI Kartları
function renderMonthlyKPICards(summary) {
  if (!summary) return;

  const totalSalesEl = document.getElementById('cal-kpi-total-sales');
  const receiptsEl = document.getElementById('cal-kpi-receipts');
  const itemsEl = document.getElementById('cal-kpi-items');
  const avgBasketEl = document.getElementById('cal-kpi-avg-basket');
  const payBreakdownEl = document.getElementById('cal-kpi-payment-breakdown');
  const topItemEl = document.getElementById('cal-kpi-top-item');
  const priceActivityEl = document.getElementById('cal-kpi-price-activity');

  if (totalSalesEl) totalSalesEl.innerText = summary.total_sales_str || '0,00 TL';
  if (receiptsEl) receiptsEl.innerText = `${summary.receipt_count || 0} Fiş`;
  if (itemsEl) itemsEl.innerText = `${summary.sold_adet || 0} Adet`;
  if (avgBasketEl) avgBasketEl.innerText = `Ortalama Sepet: ${summary.avg_basket_str || '0,00 TL'}`;

  const teraziWeightEl = document.getElementById('cal-kpi-terazi-weight');
  if (teraziWeightEl) {
    teraziWeightEl.innerText = `${(summary.sold_kg || 0).toFixed(2)} Kg`;
  }

  if (summary.payment_breakdown && payBreakdownEl) {
    payBreakdownEl.innerText = `Nakit: ${summary.payment_breakdown.cash_str} • Kart: ${summary.payment_breakdown.card_str}`;
  }

  if (topItemEl) {
    if (summary.top_products && summary.top_products.length > 0) {
      const best = summary.top_products[0];
      const qDisp = best.quantity_str || (best.unit === 'Kg' ? `${best.quantity} Kg` : `${best.quantity} Adet`);
      topItemEl.innerText = `🏆 En Çok Satan: ${best.title} (${qDisp})`;
      topItemEl.title = `${best.title} - ${best.revenue_str}`;
    } else {
      topItemEl.innerText = 'En Çok Satan: Henüz Satış Yok';
    }
  }

  if (priceActivityEl) {
    priceActivityEl.innerText = `${summary.total_price_changes || 0} Değişim • ${summary.total_printed_barcodes || 0} Etiket`;
  }
}

// 3. Ayın Gün Gün Düzenli Tablosu
function renderMonthlyDaysTable(days) {
  const tbody = document.getElementById('monthly-days-table-body');
  const countEl = document.getElementById('monthly-days-table-count');
  if (!tbody) return;

  if (!days || days.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #64748b; padding: 30px;">Bu ay için kayıtlı faaliyet verisi bulunamadı.</td></tr>';
    if (countEl) countEl.innerText = '0 Gün';
    return;
  }

  // Arama filtrelemesi
  const query = (reportDaysSearchQuery || '').trim().toLowerCase();
  const filteredDays = days.filter(d => {
    if (!query) return true;
    const parts = d.date.split('-');
    const formattedDate = `${parts[2]}.${parts[1]}.${parts[0]}`;
    return d.date.includes(query) || formattedDate.includes(query) || d.day.toString().includes(query) || (d.day_top_item_str && d.day_top_item_str.toLowerCase().includes(query));
  });

  if (countEl) countEl.innerText = `${filteredDays.length} Gün`;

  // Günleri ters kronolojik göster (en yeni gün en üstte)
  const sortedDays = [...filteredDays].reverse();

  tbody.innerHTML = sortedDays.map(d => {
    const isSelected = (d.date === selectedReportDate);
    const hasSales = (d.sales_total > 0);
    const hasActivity = (d.price_changes_count > 0 || d.printed_barcodes_count > 0);

    const parts = d.date.split('-');
    const formattedDate = `${parts[2]}.${parts[1]}.${parts[0]}`;

    const weekdaysTr = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
    const weekdayName = weekdaysTr[d.weekday] || '';

    let rowBg = d.is_today 
      ? 'background: rgba(16,185,129,0.08);' 
      : (hasSales ? 'background: rgba(15,23,42,0.4);' : 'background: transparent;');

    return `
      <tr onclick="openDayDetailModal('${d.date}')" style="${rowBg} cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.06); transition: background 0.15s ease;" onmouseover="this.style.background='rgba(56,189,248,0.08)'" onmouseout="this.style.background='${d.is_today ? 'rgba(16,185,129,0.08)' : (hasSales ? 'rgba(15,23,42,0.4)' : 'transparent')}'">
        
        <!-- Tarih / Gün -->
        <td style="padding: 12px 12px; font-weight: 700; color: #f8fafc; white-space: nowrap;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 13px; font-weight: 800; color: ${d.is_today ? '#34d399' : '#f8fafc'};">📅 ${formattedDate}</span>
            <small style="color: #94a3b8; font-size: 11px; font-weight: 600;">${weekdayName}</small>
            ${d.is_today ? '<span style="background: #10b981; color: #ffffff; font-size: 9px; font-weight: 800; padding: 1px 5px; border-radius: 4px;">BUGÜN</span>' : ''}
          </div>
        </td>

        <!-- Günlük Ciro -->
        <td style="padding: 12px 12px; text-align: right; font-family: monospace; font-weight: 900; font-size: 14px; color: ${hasSales ? '#10b981' : '#64748b'}; white-space: nowrap;">
          ${d.sales_total_str}
        </td>

        <!-- Fiş Sayısı -->
        <td style="padding: 12px 12px; text-align: center; font-weight: 700; color: ${d.receipt_count > 0 ? '#38bdf8' : '#64748b'};">
          ${d.receipt_count > 0 ? `<span style="background: rgba(56,189,248,0.15); color: #38bdf8; padding: 3px 8px; border-radius: 4px; font-size: 11.5px;">🧾 ${d.receipt_count} Fiş</span>` : '<span style="color:#475569;">0 Fiş</span>'}
        </td>

        <!-- Satılan Ürün (Adet & Kg Ayrımı) -->
        <td style="padding: 12px 12px; text-align: center; white-space: nowrap;">
          ${(d.sold_adet > 0 || d.sold_kg > 0) ? `
            <div style="display: inline-flex; gap: 5px; align-items: center; justify-content: center;">
              ${d.sold_adet > 0 ? `<span style="background: rgba(168,85,247,0.15); color: #c084fc; padding: 2px 7px; border-radius: 4px; font-size: 11.5px; font-weight: 800;">📦 ${d.sold_adet} Adet</span>` : ''}
              ${d.sold_kg > 0 ? `<span style="background: rgba(56,189,248,0.15); color: #38bdf8; padding: 2px 7px; border-radius: 4px; font-size: 11.5px; font-weight: 800;">⚖️ ${d.sold_kg} Kg</span>` : ''}
            </div>
          ` : '<span style="color:#475569;">-</span>'}
        </td>

        <!-- Günün En Çok Satanı -->
        <td style="padding: 12px 12px; max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${d.day_top_item_str ? `<span style="color: #fbbf24; font-weight: 700; font-size: 12px;" title="${d.day_top_item_str}">🥇 ${d.day_top_item_str}</span>` : '<span style="color: #475569; font-size: 11.5px;">-</span>'}
        </td>

        <!-- Fiyat Değişiklikleri -->
        <td style="padding: 12px 12px; text-align: center;">
          ${d.price_changes_count > 0 ? `<span style="background: rgba(59,130,246,0.2); color: #60a5fa; font-weight: 800; padding: 3px 8px; border-radius: 4px; font-size: 11.5px;">✏️ ${d.price_changes_count} Fiyat</span>` : '<span style="color: #475569;">-</span>'}
        </td>

        <!-- Basılan Etiketler -->
        <td style="padding: 12px 12px; text-align: center;">
          ${d.printed_barcodes_count > 0 ? `<span style="background: rgba(245,158,11,0.2); color: #fbbf24; font-weight: 800; padding: 3px 8px; border-radius: 4px; font-size: 11.5px;">🖨️ ${d.printed_barcodes_count} Etiket</span>` : '<span style="color: #475569;">-</span>'}
        </td>

        <!-- Eylem Butonu -->
        <td style="padding: 12px 12px; text-align: right; white-space: nowrap;">
          <button class="btn-sm btn-secondary" style="padding: 4px 10px; font-size: 11px; font-weight: 700; background: rgba(56,189,248,0.1); border-color: rgba(56,189,248,0.3); color: #38bdf8;">
            🔍 Gün Detayı
          </button>
        </td>

      </tr>
    `;
  }).join('');
}

function filterReportDaysTable(query) {
  reportDaysSearchQuery = query;
  if (monthlyReportCache) {
    renderMonthlyDaysTable(monthlyReportCache.days);
  }
}

// 4. Gün Detay Modalı Aç / Kapat
async function openDayDetailModal(dateStr) {
  selectedReportDate = dateStr;
  const titleEl = document.getElementById('modal-day-title');
  const salesEl = document.getElementById('modal-day-kpi-sales');
  const receiptsEl = document.getElementById('modal-day-kpi-receipts');
  const itemsEl = document.getElementById('modal-day-kpi-items');
  const actEl = document.getElementById('modal-day-kpi-activity');

  const parts = dateStr.split('-');
  const formattedDate = `${parts[2]}.${parts[1]}.${parts[0]}`;

  if (titleEl) titleEl.innerText = `📅 ${formattedDate} Detaylı Günlük Faaliyet ve Satış Dökümü`;
  if (typeof openUniversalModal === 'function') {
    openUniversalModal('modal-day-detail-popup');
  } else {
    const modal = document.getElementById('modal-day-detail-popup');
    if (modal) modal.style.display = 'flex';
  }

  // Varsayılan sekmeyi aç
  switchModalSubTab('products');

  try {
    const res = await fetch(`/api/reports/day_detail?date=${dateStr}`);
    const data = await res.json();

    if (data.status === 'success') {
      if (salesEl) salesEl.innerText = data.total_amount_str || '0,00 TL';
      if (receiptsEl) receiptsEl.innerText = `${data.receipt_count || 0} Fiş`;
      if (itemsEl) itemsEl.innerText = `${data.sold_adet || 0} Adet`;
      const modalTeraziEl = document.getElementById('modal-day-kpi-terazi');
      if (modalTeraziEl) {
        modalTeraziEl.innerText = `${(data.sold_kg || 0).toFixed(2)} Kg`;
      }
      if (actEl) actEl.innerText = `${data.price_changes_count || 0} Değişim`;

      // 1. Çok Satanlar Tablosu
      renderModalTopProducts(data.day_top_products || []);

      // 2. Kasa Fişleri
      renderModalReceipts(data.sales_list || []);

      // 3. Fiyat Değişiklikleri
      renderModalPriceChanges(data.price_changes || []);
    }
  } catch (e) {
    console.error('Modal veri yükleme hatası:', e);
  }
}

function closeDayDetailModal() {
  if (typeof closeUniversalModal === 'function') {
    closeUniversalModal('modal-day-detail-popup');
    closeUniversalModal('modal-daily-detail-view');
  } else {
    const modal1 = document.getElementById('modal-day-detail-popup');
    if (modal1) modal1.style.display = 'none';
    const modal2 = document.getElementById('modal-daily-detail-view');
    if (modal2) modal2.style.display = 'none';
  }
}

function closeDailyDetailModal() {
  closeDayDetailModal();
}

function switchModalSubTab(tabKey) {
  const validTabs = ['products', 'receipts', 'prices'];
  if (!validTabs.includes(tabKey)) tabKey = 'products';

  validTabs.forEach(t => {
    const btn = document.getElementById(`modal-tab-btn-${t}`);
    const pane = document.getElementById(`modal-tab-pane-${t}`);
    if (btn) {
      if (t === tabKey) {
        btn.className = 'btn-primary';
        btn.style.background = '#0284c7';
        btn.style.color = '#ffffff';
        btn.style.fontWeight = '800';
      } else {
        btn.className = 'btn-secondary';
        btn.style.background = 'transparent';
        btn.style.color = '#94a3b8';
        btn.style.fontWeight = '700';
      }
    }
    if (pane) {
      pane.style.display = t === tabKey ? 'flex' : 'none';
    }
  });
}

function switchDetailSubTab(tabKey) {
  switchModalSubTab(tabKey === 'price_changes' ? 'prices' : 'products');
}

function renderCurrentDayDetailContent() {
  // Canlı arama filtresi
}

// Window Global Bağlantıları
window.initReportsPanel = initReportsPanel;
window.navigateCalendarMonth = navigateCalendarMonth;
window.goToCurrentMonth = goToCurrentMonth;
window.loadMonthlyCalendar = loadMonthlyCalendar;
window.openDayDetailModal = openDayDetailModal;
window.closeDayDetailModal = closeDayDetailModal;
window.closeDailyDetailModal = closeDailyDetailModal;
window.switchModalSubTab = switchModalSubTab;
window.switchDetailSubTab = switchDetailSubTab;
window.renderCurrentDayDetailContent = renderCurrentDayDetailContent;
window.filterReportDaysTable = filterReportDaysTable;

