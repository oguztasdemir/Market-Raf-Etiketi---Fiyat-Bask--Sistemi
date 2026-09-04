// -*- coding: utf-8 -*-
/**
 * Z RAPORU, GÜN DETAY MODALI & HAFTALIK ISI HARİTASI (z_raporu_paneli.js)
 */

// 7.8. Aylık Takvim Raporunu Excel Olarak Dışa Aktarma
function exportMonthlyReportToExcel() {
  const table = document.getElementById('report-days-table');
  if (!table) return;

  const rows = table.querySelectorAll('tbody tr');
  if (!rows || rows.length === 0) return;

  let csvContent = '\uFEFF'; // Excel UTF-8 BOM
  csvContent += `AYLIK SATIŞ VE FAALİYET DÖKÜMÜ\n`;
  csvContent += `Tarih / Gün;Günlük Ciro;Fiş Adedi;Satılan Ürün;Günün En Çok Satanı;Fiyat Değişimi;Basılan Etiket\n`;

  rows.forEach(r => {
    const cols = r.querySelectorAll('td');
    if (cols.length >= 7) {
      const dateText = cols[0].innerText.replace(/\n/g, ' ').trim();
      const revText = cols[1].innerText.trim();
      const rcptText = cols[2].innerText.trim();
      const prodQtyText = cols[3].innerText.trim();
      const topProdText = cols[4].innerText.trim();
      const priceText = cols[5].innerText.trim();
      const labelText = cols[6].innerText.trim();
      csvContent += `"${dateText}";"${revText}";"${rcptText}";"${prodQtyText}";"${topProdText}";"${priceText}";"${labelText}"\n`;
    }
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Aylik_Satis_Raporu_${currentCalendarYear}_${String(currentCalendarMonth).padStart(2, '0')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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
  const validTabs = ['products', 'hourly', 'categories', 'cashiers', 'receipts', 'prices'];
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

// 9. Gün Sonu Özet Z Raporu Modalı Aç / Kapat & Yazdır
function openSummaryZReportModal() {
  const data = currentLoadedDayReportData;
  if (!data) return;

  const dateParts = (data.date || '').split('-');
  const formattedDate = dateParts.length === 3 ? `${dateParts[2]}.${dateParts[1]}.${dateParts[0]}` : (data.date || '-');
  const nowTime = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  const dateEl = document.getElementById('z-rep-date');
  const timeEl = document.getElementById('z-rep-time');
  const noEl = document.getElementById('z-rep-no');
  const cashEl = document.getElementById('z-rep-cash');
  const cardEl = document.getElementById('z-rep-card');
  const totalEl = document.getElementById('z-rep-total');
  const rcptEl = document.getElementById('z-rep-receipts');
  const adetEl = document.getElementById('z-rep-sold-adet');
  const kgEl = document.getElementById('z-rep-sold-kg');
  const avgBasketEl = document.getElementById('z-rep-avg-basket');
  const peakHourEl = document.getElementById('z-rep-peak-hour');
  const cashBoxEl = document.getElementById('z-rep-cash-box');

  if (dateEl) dateEl.innerText = formattedDate;
  if (timeEl) timeEl.innerText = nowTime;
  if (noEl) noEl.innerText = `Z-${(data.date || '').replace(/-/g, '')}`;
  if (cashEl) cashEl.innerText = data.cash_total_str || `${(data.cash_total || 0).toFixed(2)} TL`;
  if (cardEl) cardEl.innerText = data.card_total_str || `${(data.card_total || 0).toFixed(2)} TL`;
  if (totalEl) totalEl.innerText = data.total_amount_str || `${(data.total_amount || 0).toFixed(2)} TL`;
  if (rcptEl) rcptEl.innerText = `${data.receipt_count || 0} Fiş`;
  if (adetEl) adetEl.innerText = `${data.sold_adet || 0} Adet`;
  if (kgEl) kgEl.innerText = `${(data.sold_kg || 0).toFixed(2)} Kg`;
  
  const avgBasket = (data.receipt_count && data.receipt_count > 0) 
    ? (data.total_amount / data.receipt_count).toFixed(2) + ' TL' 
    : '0,00 TL';
  if (avgBasketEl) avgBasketEl.innerText = avgBasket;

  if (peakHourEl) {
    if (data.peak_hour && data.peak_hour.revenue > 0) {
      peakHourEl.innerText = `${data.peak_hour.hour_label} (%${data.peak_hour.percentage})`;
    } else {
      peakHourEl.innerText = '-';
    }
  }

  if (cashBoxEl) cashBoxEl.innerText = data.cash_total_str || `${(data.cash_total || 0).toFixed(2)} TL`;

  if (typeof openUniversalModal === 'function') {
    openUniversalModal('modal-summary-z-report');
  } else {
    const modal = document.getElementById('modal-summary-z-report');
    if (modal) modal.style.display = 'flex';
  }
}

function closeSummaryZReportModal() {
  if (typeof closeUniversalModal === 'function') {
    closeUniversalModal('modal-summary-z-report');
  } else {
    const modal = document.getElementById('modal-summary-z-report');
    if (modal) modal.style.display = 'none';
  }
}

function printSummaryZReportSlip() {
  const printArea = document.getElementById('z-report-printable-area');
  if (!printArea) return;

  const printWindow = window.open('', '_blank', 'width=420,height=600');
  if (printWindow) {
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Gün Sonu Z Raporu (Özet)</title>
        <style>
          body {
            font-family: 'Courier New', Courier, monospace;
            padding: 10px;
            margin: 0;
            color: #000;
            background: #fff;
            font-size: 12px;
          }
          @media print {
            body { padding: 0; margin: 0; width: 72mm; }
          }
        </style>
      </head>
      <body>
        ${printArea.outerHTML}
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        <\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  } else {
    window.print();
  }
}

// 10. Haftalık Yoğunluk Isı Haritası (Heatmap) Yönetimi
async function openWeeklyHeatmapModal() {
  const y = currentCalendarYear || new Date().getFullYear();
  const m = currentCalendarMonth || (new Date().getMonth() + 1);

  if (typeof openUniversalModal === 'function') {
    openUniversalModal('modal-weekly-heatmap');
  } else {
    const modal = document.getElementById('modal-weekly-heatmap');
    if (modal) modal.style.display = 'flex';
  }

  try {
    const res = await fetch(`/api/reports/heatmap?year=${y}&month=${m}`);
    const data = await res.json();

    if (data.status === 'success') {
      const periodBadge = document.getElementById('heatmap-period-badge');
      const busiestDayEl = document.getElementById('heatmap-kpi-busiest-day');
      const peakHourEl = document.getElementById('heatmap-kpi-peak-hour');
      const staffingNoteEl = document.getElementById('heatmap-staffing-note');

      if (periodBadge) periodBadge.innerText = `${data.month_name} ${data.year}`;
      if (busiestDayEl) {
        busiestDayEl.innerText = data.busiest_day && data.busiest_day.revenue > 0
          ? `${data.busiest_day.day_name} (${data.busiest_day.revenue_str})`
          : 'Henüz Satış Yok';
      }
      if (peakHourEl) {
        peakHourEl.innerText = data.peak_hour && data.peak_hour.revenue > 0
          ? `${data.peak_hour.hour_label} (${data.peak_hour.revenue_str})`
          : 'Henüz Satış Yok';
      }

      if (staffingNoteEl) {
        if (data.staffing_alerts && data.staffing_alerts.length > 0) {
          const topAlerts = data.staffing_alerts.map(a => `<strong style="color:#fbbf24;">${a.day_name} ${a.hour_range}</strong>`).join(', ');
          staffingNoteEl.innerHTML = `💡 <em>Önerilen Ek Kasa Saatleri: ${topAlerts}</em>`;
        } else {
          staffingNoteEl.innerHTML = `💡 <em>Haftalık yoğunluk verileri satış yapıldıkça güncellenir.</em>`;
        }
      }

      // Izgarayı Render Et
      renderHeatmapGrid(data.matrix || {});
    }
  } catch (e) {
    console.error('Isı haritası yükleme hatası:', e);
  }
}

function renderHeatmapGrid(matrix) {
  const container = document.getElementById('heatmap-grid-table-container');
  if (!container) return;

  const dayNames = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
  const dayShort = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

  // Başlık Satırı (00 - 23 Saatler)
  let headerCellsHtml = '<th style="padding: 6px 8px; text-align: left; color: #94a3b8; font-size: 11px; width: 75px;">GÜN</th>';
  for (let h = 0; h < 24; h++) {
    headerCellsHtml += `<th style="padding: 6px 2px; text-align: center; color: #94a3b8; font-family: monospace; font-size: 10px; font-weight: 700; width: 3.8%;">${String(h).padStart(2, '0')}</th>`;
  }

  // 7 Gün Satırları
  let rowsHtml = '';
  for (let d = 0; d < 7; d++) {
    const dName = dayNames[d];
    const dShort = dayShort[d];
    const isWeekend = d >= 5;

    let cellsHtml = `<td style="padding: 6px 8px; font-weight: 800; font-size: 11px; color: ${isWeekend ? '#fbbf24' : '#cbd5e1'}; white-space: nowrap;">${dShort}</td>`;

    for (let h = 0; h < 24; h++) {
      const cell = (matrix[d] && matrix[d][h]) ? matrix[d][h] : { revenue: 0, revenue_str: '0,00 TL', receipt_count: 0, intensity_score: 0, level: 0 };
      const level = cell.level || 0;
      const score = cell.intensity_score || 0;
      const revStr = cell.revenue_str || '0,00 TL';
      const rcpt = cell.receipt_count || 0;
      const hourRange = `${String(h).padStart(2, '0')}:00 - ${String((h+1)%24).padStart(2, '0')}:00`;

      let bg = '#090d16';
      let border = 'rgba(255,255,255,0.05)';
      let shadow = 'none';

      if (level === 1) {
        bg = 'rgba(56,189,248,0.25)';
        border = 'rgba(56,189,248,0.4)';
      } else if (level === 2) {
        bg = 'rgba(16,185,129,0.55)';
        border = 'rgba(16,185,129,0.75)';
      } else if (level === 3) {
        bg = 'rgba(245,158,11,0.8)';
        border = 'rgba(245,158,11,0.95)';
      } else if (level === 4) {
        bg = '#ef4444';
        border = '#f87171';
        shadow = '0 0 6px rgba(239,68,68,0.8)';
      }

      cellsHtml += `
        <td style="padding: 3px 2px; text-align: center;">
          <div 
            onmouseenter="updateHeatmapHover('${dName}', '${hourRange}', '${revStr}', ${rcpt}, ${score}, ${level})"
            onmouseleave="resetHeatmapHover()"
            style="height: 38px; width: 100%; border-radius: 5px; background: ${bg}; border: 1px solid ${border}; box-shadow: ${shadow}; cursor: pointer; transition: transform 0.12s ease, border-color 0.12s ease; display: flex; align-items: center; justify-content: center;"
            onmouseover="this.style.transform='scale(1.15)'; this.style.zIndex='10';"
            onmouseout="this.style.transform='scale(1)'; this.style.zIndex='1';"
          >
            ${level >= 3 ? `<span style="font-size: 8px; font-weight: 900; color: #000; font-family: monospace;">${rcpt}</span>` : ''}
          </div>
        </td>
      `;
    }

    rowsHtml += `<tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">${cellsHtml}</tr>`;
  }

  container.innerHTML = `
    <table style="width: 100%; border-collapse: separate; border-spacing: 2px;">
      <thead>
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.08);">${headerCellsHtml}</tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;
}

function updateHeatmapHover(dayName, hourRange, revStr, receipts, score, level) {
  const titleEl = document.getElementById('heatmap-hover-day-time');
  const detailsEl = document.getElementById('heatmap-hover-details');
  const badgeEl = document.getElementById('heatmap-hover-badge');
  const boxEl = document.getElementById('heatmap-hover-info-box');

  if (titleEl) titleEl.innerHTML = `<span style="color:#38bdf8;">${dayName}</span> • <span style="color:#fbbf24; font-family:monospace;">${hourRange}</span>`;
  if (detailsEl) detailsEl.innerHTML = `💰 Ciro: <strong style="color:#34d399;">${revStr}</strong> • 🧾 Satış: <strong style="color:#cbd5e1;">${receipts} Fiş</strong>`;

  if (badgeEl) {
    badgeEl.style.display = 'block';
    if (level === 4) {
      badgeEl.innerText = `🔥 ZİRVE (%${score})`;
      badgeEl.style.background = '#ef4444';
      badgeEl.style.color = '#fff';
    } else if (level === 3) {
      badgeEl.innerText = `YÜKSEK (%${score})`;
      badgeEl.style.background = '#f59e0b';
      badgeEl.style.color = '#000';
    } else if (level === 2) {
      badgeEl.innerText = `ORTA (%${score})`;
      badgeEl.style.background = '#10b981';
      badgeEl.style.color = '#000';
    } else if (level === 1) {
      badgeEl.innerText = `DÜŞÜK (%${score})`;
      badgeEl.style.background = '#38bdf8';
      badgeEl.style.color = '#000';
    } else {
      badgeEl.innerText = 'SATIŞ YOK';
      badgeEl.style.background = '#334155';
      badgeEl.style.color = '#94a3b8';
    }
  }

  if (boxEl) boxEl.style.borderColor = level >= 3 ? '#f59e0b' : 'rgba(56,189,248,0.4)';
}

function resetHeatmapHover() {
  const titleEl = document.getElementById('heatmap-hover-day-time');
  const detailsEl = document.getElementById('heatmap-hover-details');
  const badgeEl = document.getElementById('heatmap-hover-badge');
  const boxEl = document.getElementById('heatmap-hover-info-box');

  if (titleEl) titleEl.innerText = 'Detay için haritadan bir kutucuğa gelin';
  if (detailsEl) detailsEl.innerText = '7 Gün x 24 Saatlik dağılım';
  if (badgeEl) badgeEl.style.display = 'none';
  if (boxEl) boxEl.style.borderColor = 'rgba(255,255,255,0.12)';
}

function closeWeeklyHeatmapModal() {
  if (typeof closeUniversalModal === 'function') {
    closeUniversalModal('modal-weekly-heatmap');
  } else {
    const modal = document.getElementById('modal-weekly-heatmap');
    if (modal) modal.style.display = 'none';
  }
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
window.renderModalTopProducts = renderModalTopProducts;
window.renderModalHourlyAnalysis = renderModalHourlyAnalysis;
window.renderModalReceipts = renderModalReceipts;
window.renderModalPriceChanges = renderModalPriceChanges;
window.updateHourlyHoverCard = updateHourlyHoverCard;
window.resetHourlyHoverCard = resetHourlyHoverCard;
window.openReportReceiptDetailModal = openReportReceiptDetailModal;
window.closeReportReceiptDetailModal = closeReportReceiptDetailModal;
window.toggleReceiptInlineItems = toggleReceiptInlineItems;
window.printCurrentReportReceipt = printCurrentReportReceipt;
window.openSummaryZReportModal = openSummaryZReportModal;
window.closeSummaryZReportModal = closeSummaryZReportModal;
window.printSummaryZReportSlip = printSummaryZReportSlip;
window.renderModalCategoryBreakdown = renderModalCategoryBreakdown;
window.renderModalCashierPerformance = renderModalCashierPerformance;
window.exportCurrentDayReportToExcel = exportCurrentDayReportToExcel;
window.exportMonthlyReportToExcel = exportMonthlyReportToExcel;
window.openWeeklyHeatmapModal = openWeeklyHeatmapModal;
window.closeWeeklyHeatmapModal = closeWeeklyHeatmapModal;
window.renderHeatmapGrid = renderHeatmapGrid;
window.updateHeatmapHover = updateHeatmapHover;
window.resetHeatmapHover = resetHeatmapHover;

