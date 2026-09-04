// -*- coding: utf-8 -*-
/**
 * AYLIK PERFORMANS & FAALİYET TAKVİMİ (raporlar_paneli.js)
 */

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

    const rowClass = d.is_today ? 'report-row-today' : (hasSales ? 'report-row-active' : 'report-row-idle');

    return `
      <tr class="report-day-row ${rowClass}" onclick="openDayDetailModal('${d.date}')" style="cursor: pointer; transition: background 0.15s ease;">
        
        <!-- Tarih / Gün -->
        <td class="report-date-cell" style="padding: 12px 12px; font-weight: 700; white-space: nowrap;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="report-date-text" style="font-size: 13px; font-weight: 800; color: ${d.is_today ? '#059669' : ''};">📅 ${formattedDate}</span>
            <small class="report-weekday-text" style="font-size: 11px; font-weight: 600;">${weekdayName}</small>
            ${d.is_today ? '<span style="background: #10b981; color: #ffffff; font-size: 9px; font-weight: 800; padding: 1px 5px; border-radius: 4px;">BUGÜN</span>' : ''}
          </div>
        </td>

        <!-- Günlük Ciro -->
        <td style="padding: 12px 12px; text-align: right; font-family: monospace; font-weight: 900; font-size: 14px; color: ${hasSales ? '#059669' : '#64748b'}; white-space: nowrap;">
          ${d.sales_total_str}
        </td>

        <!-- Fiş Sayısı -->
        <td style="padding: 12px 12px; text-align: center; font-weight: 700;">
          ${d.receipt_count > 0 ? `<span style="background: rgba(2,132,199,0.12); color: #0284c7; padding: 3px 8px; border-radius: 4px; font-size: 11.5px; font-weight: 800;">🧾 ${d.receipt_count} Fiş</span>` : '<span style="color:#64748b;">0 Fiş</span>'}
        </td>

        <!-- Satılan Ürün (Adet & Kg Ayrımı) -->
        <td style="padding: 12px 12px; text-align: center; white-space: nowrap;">
          ${(d.sold_adet > 0 || d.sold_kg > 0) ? `
            <div style="display: inline-flex; gap: 5px; align-items: center; justify-content: center;">
              ${d.sold_adet > 0 ? `<span style="background: rgba(168,85,247,0.12); color: #9333ea; padding: 2px 7px; border-radius: 4px; font-size: 11.5px; font-weight: 800;">📦 ${d.sold_adet} Adet</span>` : ''}
              ${d.sold_kg > 0 ? `<span style="background: rgba(2,132,199,0.12); color: #0284c7; padding: 2px 7px; border-radius: 4px; font-size: 11.5px; font-weight: 800;">⚖️ ${d.sold_kg} Kg</span>` : ''}
            </div>
          ` : '<span style="color:#64748b;">-</span>'}
        </td>

        <!-- Günün En Çok Satanı -->
        <td style="padding: 12px 12px; max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${d.day_top_item_str ? `<span style="color: #d97706; font-weight: 700; font-size: 12px;" title="${d.day_top_item_str}">🥇 ${d.day_top_item_str}</span>` : '<span style="color: #64748b; font-size: 11.5px;">-</span>'}
        </td>

        <!-- Fiyat Değişiklikleri -->
        <td style="padding: 12px 12px; text-align: center;">
          ${d.price_changes_count > 0 ? `<span style="background: rgba(59,130,246,0.12); color: #2563eb; font-weight: 800; padding: 3px 8px; border-radius: 4px; font-size: 11.5px;">✏️ ${d.price_changes_count} Fiyat</span>` : '<span style="color: #64748b;">-</span>'}
        </td>

        <!-- Basılan Etiketler -->
        <td style="padding: 12px 12px; text-align: center;">
          ${d.printed_barcodes_count > 0 ? `<span style="background: rgba(245,158,11,0.15); color: #d97706; font-weight: 800; padding: 3px 8px; border-radius: 4px; font-size: 11.5px;">🖨️ ${d.printed_barcodes_count} Etiket</span>` : '<span style="color: #64748b;">-</span>'}
        </td>

        <!-- Eylem Butonu -->
        <td style="padding: 12px 12px; text-align: right; white-space: nowrap;">
          <button class="btn-sm btn-secondary" style="padding: 4px 10px; font-size: 11px; font-weight: 700;">
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
let currentLoadedDayReportData = null;

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
      currentLoadedDayReportData = data;

      if (salesEl) salesEl.innerText = data.total_amount_str || '0,00 TL';
      if (receiptsEl) receiptsEl.innerText = `${data.receipt_count || 0} Fiş`;
      if (itemsEl) itemsEl.innerText = `${data.sold_adet || 0} Adet`;
      const modalTeraziEl = document.getElementById('modal-day-kpi-terazi');
      if (modalTeraziEl) {
        modalTeraziEl.innerText = `${(data.sold_kg || 0).toFixed(2)} Kg`;
      }
      if (actEl) actEl.innerText = `${data.price_changes_count || 0} Değişim`;

      // 0. Akıllı Trend Rozetleri (Dün & Geçen Hafta Kıyaslaması)
      const trendContainer = document.getElementById('modal-day-trend-container');
      if (trendContainer) {
        let trendHtml = '';
        if (data.yesterday_comparison) {
          const yc = data.yesterday_comparison;
          const bg = yc.is_positive ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)';
          const color = yc.is_positive ? '#34d399' : '#f87171';
          const icon = yc.is_positive ? '↗' : '↘';
          const sign = yc.diff_percent >= 0 ? '+' : '';
          trendHtml += `
            <span style="background: ${bg}; color: ${color}; border: 1px solid ${color}40; font-size: 10.5px; font-weight: 800; padding: 2px 7px; border-radius: 4px;" title="Dünkü Ciro: ${yc.total_str} (${sign}${yc.diff_amount_str})">
              Düne Göre: ${sign}%${yc.diff_percent} ${icon}
            </span>
          `;
        }
        if (data.last_week_comparison) {
          const lwc = data.last_week_comparison;
          const bg = lwc.is_positive ? 'rgba(56,189,248,0.15)' : 'rgba(245,158,11,0.15)';
          const color = lwc.is_positive ? '#38bdf8' : '#fbbf24';
          const icon = lwc.is_positive ? '↗' : '↘';
          const sign = lwc.diff_percent >= 0 ? '+' : '';
          trendHtml += `
            <span style="background: ${bg}; color: ${color}; border: 1px solid ${color}40; font-size: 10.5px; font-weight: 800; padding: 2px 7px; border-radius: 4px;" title="Geçen Hafta Aynı Gün: ${lwc.total_str} (${sign}${lwc.diff_amount_str})">
              Geçen Haftaya Göre: ${sign}%${lwc.diff_percent} ${icon}
            </span>
          `;
        }
        trendContainer.innerHTML = trendHtml;
      }

      // 1. Çok Satanlar Tablosu
      renderModalTopProducts(data.day_top_products || []);

      // 2. Saatlik Satış & Ciro Dağılımı ve Bar Grafiği
      renderModalHourlyAnalysis(data.hourly_breakdown || [], data.peak_hour, data.total_amount || 0);

      // 3. Reyon & Kategori Ciro Dağılımı
      renderModalCategoryBreakdown(data.category_breakdown || [], data.total_amount || 0);

      // 4. Kasiyer & Kasa Mutabakatı
      renderModalCashierPerformance(data.cashier_performance || []);

      // 5. Kasa Fişleri
      renderModalReceipts(data.sales_list || []);

      // 6. Fiyat Değişiklikleri
      renderModalPriceChanges(data.price_changes || []);
    }
  } catch (e) {
    console.error('Modal veri yükleme hatası:', e);
  }
}

// Boş Durum Şablonu (Sabit Yükseklik Koruyucu)
function getModalEmptyState(title, subtitle) {
  return `
    <div style="flex: 1; min-height: 280px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: #94a3b8; padding: 40px 20px;">
      <span style="font-size: 42px; display: block; margin-bottom: 12px; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.5));">📭</span>
      <h4 style="margin: 0; color: #f8fafc; font-size: 15px; font-weight: 800;">${title || 'Bu Gün İçin Kayıtlı Veri Yok'}</h4>
      <p style="margin: 6px 0 0 0; color: #64748b; font-size: 12px; max-width: 360px;">${subtitle || 'Seçilen tarihe ait satış, fiş veya faaliyet kaydı bulunmamaktadır.'}</p>
    </div>
  `;
}

// 5. Çok Satanlar Tablosu Renderı
function renderModalTopProducts(products) {
  const tbody = document.getElementById('modal-day-top-products-tbody');
  const pane = document.getElementById('modal-tab-pane-products');
  if (!tbody || !pane) return;

  if (!products || products.length === 0) {
    pane.innerHTML = getModalEmptyState('Günün En Çok Satanı Bulunamadı', 'Bu tarihte kasadan henüz ürün satışı yapılmamıştır.');
    return;
  }

  // Tablo yapısını koru
  pane.innerHTML = `
    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
      <thead>
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); color: #94a3b8; font-size: 11px; text-transform: uppercase;">
          <th style="padding: 6px 8px; width: 45px; text-align: center;">Sıra</th>
          <th style="padding: 6px 8px;">Ürün Adı</th>
          <th style="padding: 6px 8px; text-align: center;">Miktar</th>
          <th style="padding: 6px 8px; text-align: right;">Toplam Tutar</th>
        </tr>
      </thead>
      <tbody id="modal-day-top-products-tbody"></tbody>
    </table>
  `;

  const newTbody = document.getElementById('modal-day-top-products-tbody');
  newTbody.innerHTML = products.map((p, idx) => `
    <tr style="border-bottom: 1px solid rgba(255,255,255,0.06); transition: background 0.12s;" onmouseover="this.style.background='rgba(56,189,248,0.06)'" onmouseout="this.style.background='transparent'">
      <td style="padding: 8px 10px; text-align: center; color: #94a3b8; font-weight: 800; font-size: 11px;">
        ${idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : (idx + 1)}
      </td>
      <td style="padding: 8px 10px; font-weight: 700; color: #f8fafc;">
        ${p.title}
        ${p.barcode ? `<small style="color:#64748b; font-family: monospace; display: block; font-size: 10px;">${p.barcode}</small>` : ''}
      </td>
      <td style="padding: 8px 10px; text-align: center; font-weight: 800; color: ${p.unit === 'Kg' ? '#22d3ee' : '#c084fc'};">
        ${p.quantity_str || p.quantity}
      </td>
      <td style="padding: 8px 10px; text-align: right; font-family: monospace; font-weight: 900; color: #34d399;">
        ${p.revenue_str}
      </td>
    </tr>
  `).join('');
}

// 6. 24 Saatlik Satış & Ciro Dağılımı ve Bar Grafiği Renderı
function renderModalHourlyAnalysis(hourlyBreakdown, peakHour, totalAmount) {
  // 1. En Yoğun Saat Bannerı
  const bannerEl = document.getElementById('modal-day-peak-hour-banner');
  const peakLabelEl = document.getElementById('modal-peak-hour-label');
  const peakSubEl = document.getElementById('modal-peak-hour-sub');
  const peakShareEl = document.getElementById('modal-peak-hour-share');
  const hoverCardEl = document.getElementById('modal-hourly-hover-card');

  if (peakHour && peakHour.revenue > 0) {
    if (bannerEl) bannerEl.style.display = 'flex';
    if (peakLabelEl) peakLabelEl.innerText = `${peakHour.hour_label} Aralığı`;
    if (peakSubEl) peakSubEl.innerText = `Toplam Ciro: ${peakHour.revenue_str} • Fiş / Satış: ${peakHour.receipt_count} Adet • Ürün: ${peakHour.items_sold}`;
    if (peakShareEl) peakShareEl.innerText = `%${peakHour.percentage} Ciro Payı`;
  } else {
    if (bannerEl) bannerEl.style.display = 'none';
  }

  // 2. 24 Saatlik Bar Dağılım Grafiği (00:00 - 23:00 Tam Gün)
  const chartContainer = document.getElementById('modal-hourly-bars-container');
  if (chartContainer) {
    // 24 saatin tamamı (0-23)
    const all24Hours = (hourlyBreakdown && hourlyBreakdown.length === 24)
      ? hourlyBreakdown
      : Array.from({ length: 24 }, (_, i) => {
          const hStart = `${String(i).padStart(2, '0')}:00`;
          const hEnd = `${String((i + 1) % 24).padStart(2, '0')}:00`;
          const found = hourlyBreakdown ? hourlyBreakdown.find(h => h.hour_num === i || h.hour === hStart) : null;
          return found || {
            hour: hStart,
            hour_num: i,
            hour_label: `${hStart} - ${hEnd}`,
            revenue: 0,
            revenue_str: '0,00 TL',
            receipt_count: 0,
            items_sold: 0,
            sold_adet: 0,
            sold_kg: 0,
            percentage: 0,
            is_peak: false
          };
        });

    const maxSalesCount = Math.max(...all24Hours.map(h => h.receipt_count), 1);
    const maxRev = Math.max(...all24Hours.map(h => h.revenue), 1);

    chartContainer.innerHTML = all24Hours.map(h => {
      // Bar yüksekliği satış sayısına göre (ve ciroya göre)
      const hasSales = (h.receipt_count > 0 || h.revenue > 0);
      const heightPercent = hasSales 
        ? Math.max((h.receipt_count / maxSalesCount) * 88, 14) 
        : 6;
      const isPeak = h.is_peak;

      let barBg = isPeak 
        ? 'linear-gradient(to top, #f59e0b, #fbbf24)' 
        : (hasSales ? 'linear-gradient(to top, #0284c7, #38bdf8)' : 'rgba(255,255,255,0.06)');

      let borderStyle = isPeak 
        ? '1px solid #f59e0b; box-shadow: 0 0 12px rgba(245,158,11,0.6);' 
        : (hasSales ? '1px solid rgba(56,189,248,0.4);' : '1px solid rgba(255,255,255,0.04);');

      const tooltipText = `🕒 Saat: ${h.hour_label}\n🧾 Fiş / Satış Sayısı: ${h.receipt_count} Fiş\n💰 Toplam Satış Tutarı: ${h.revenue_str}\n📦 Satılan Ürün: ${h.items_sold}\n📊 Günlük Ciro Payı: %${h.percentage}`;

      return `
        <div class="hourly-bar-col" 
             style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; cursor: pointer;"
             title="${tooltipText}"
             onmouseenter="updateHourlyHoverCard('${h.hour_label}', '${h.receipt_count}', '${h.revenue_str}', '${h.items_sold}', '${h.percentage}')"
             onmouseleave="resetHourlyHoverCard()">
          
          <!-- Bar Çubuğu -->
          <div style="width: 80%; max-width: 20px; height: ${heightPercent}%; background: ${barBg}; border-radius: 3px 3px 0 0; ${borderStyle} transition: all 0.2s ease;" onmouseover="this.style.transform='scaleY(1.06)'; this.style.filter='brightness(1.25)'" onmouseout="this.style.transform='scaleY(1)'; this.style.filter='none'"></div>
          
          <!-- Saat Etiketi (2 haneli: 00, 01 ... 23) -->
          <span style="font-size: 9px; font-weight: ${isPeak ? '900' : (hasSales ? '700' : '500')}; color: ${isPeak ? '#fbbf24' : (hasSales ? '#38bdf8' : '#475569')}; margin-top: 4px; font-family: monospace;">
            ${String(h.hour_num).padStart(2, '0')}
          </span>
        </div>
      `;
    }).join('');
  }

  // 3. Saatlik Detay Tablosu
  const tbody = document.getElementById('modal-day-hourly-tbody');
  if (tbody) {
    const activeHours = hourlyBreakdown ? hourlyBreakdown.filter(h => h.receipt_count > 0 || h.revenue > 0) : [];

    if (!activeHours || activeHours.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 22px;">Bu gün için saatlik satış hareketi bulunamadı.</td></tr>';
      return;
    }

    const maxRev = Math.max(...activeHours.map(h => h.revenue), 1);

    tbody.innerHTML = activeHours.map(h => {
      const isPeak = h.is_peak;
      const barWidth = Math.max((h.revenue / maxRev) * 100, 6);
      const rowBg = isPeak ? 'background: rgba(245,158,11,0.08);' : 'background: transparent;';

      return `
        <tr style="${rowBg} border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.12s;" onmouseover="this.style.background='rgba(56,189,248,0.06)'" onmouseout="this.style.background='${isPeak ? 'rgba(245,158,11,0.08)' : 'transparent'}'">
          
          <!-- Saat Aralığı -->
          <td style="padding: 7px 10px; font-weight: 700; color: #f8fafc; font-family: monospace; white-space: nowrap;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span>🕒 ${h.hour_label}</span>
              ${isPeak ? '<span style="background: #f59e0b; color: #000; font-size: 9px; font-weight: 900; padding: 1px 5px; border-radius: 3px;">🔥 EN YOĞUN</span>' : ''}
            </div>
          </td>

          <!-- Ciro -->
          <td style="padding: 7px 10px; text-align: right; font-family: monospace; font-weight: 900; color: ${isPeak ? '#fbbf24' : '#10b981'}; white-space: nowrap;">
            ${h.revenue_str}
          </td>

          <!-- Fiş Sayısı -->
          <td style="padding: 7px 10px; text-align: center; font-weight: 800; color: #38bdf8;">
            ${h.receipt_count} Fiş
          </td>

          <!-- Satılan Ürün -->
          <td style="padding: 7px 10px; text-align: center; color: #cbd5e1; font-weight: 700;">
            ${(h.sold_adet > 0 || h.sold_kg > 0) ? `
              <span style="font-size: 11px;">
                ${h.sold_adet > 0 ? `${h.sold_adet} Ad` : ''}
                ${h.sold_kg > 0 ? ` • ${h.sold_kg} Kg` : ''}
              </span>
            ` : '-'}
          </td>

          <!-- Günlük Pay -->
          <td style="padding: 7px 10px; text-align: right; font-weight: 800; color: ${isPeak ? '#fbbf24' : '#38bdf8'};">
            %${h.percentage}
          </td>

          <!-- Yoğunluk Barı -->
          <td style="padding: 7px 10px;">
            <div style="width: 100%; height: 7px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden;">
              <div style="width: ${barWidth}%; height: 100%; background: ${isPeak ? '#f59e0b' : '#38bdf8'}; border-radius: 4px;"></div>
            </div>
          </td>

        </tr>
      `;
    }).join('');
  }
}

// Saatlik Hover Kartını Canlı Güncelle
function updateHourlyHoverCard(hourLabel, receipts, revenue, items, share) {
  const hoverCardEl = document.getElementById('modal-hourly-hover-card');
  if (hoverCardEl) {
    if (Number(receipts) > 0 || String(revenue) !== '0,00 TL') {
      hoverCardEl.innerHTML = `🕒 <strong style="color:#fff;">${hourLabel}</strong> ➔ <span style="color:#38bdf8;">${receipts} Fiş</span> • <span style="color:#34d399;">${revenue}</span> • <span style="color:#fbbf24;">%${share} Pay</span>`;
      hoverCardEl.style.background = 'rgba(56,189,248,0.15)';
      hoverCardEl.style.borderColor = 'rgba(56,189,248,0.4)';
    } else {
      hoverCardEl.innerHTML = `🕒 <strong style="color:#fff;">${hourLabel}</strong> ➔ <span style="color:#64748b;">Satış Yok (0 Fiş • 0,00 TL)</span>`;
      hoverCardEl.style.background = 'rgba(255,255,255,0.06)';
      hoverCardEl.style.borderColor = 'rgba(255,255,255,0.1)';
    }
  }
}

function resetHourlyHoverCard() {
  const hoverCardEl = document.getElementById('modal-hourly-hover-card');
  if (hoverCardEl) {
    hoverCardEl.innerHTML = 'Detay için bir saatin üzerine gelin';
    hoverCardEl.style.background = 'rgba(255,255,255,0.06)';
    hoverCardEl.style.borderColor = 'rgba(255,255,255,0.1)';
  }
}

