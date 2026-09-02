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

// 7. Kasa Fişleri Renderı & Detay Yönetimi
let currentDaySalesListCache = [];
let currentViewingReceiptObj = null;

function renderModalReceipts(salesList) {
  const container = document.getElementById('modal-day-receipts-list');
  if (!container) return;

  currentDaySalesListCache = salesList || [];

  if (!salesList || salesList.length === 0) {
    container.innerHTML = getModalEmptyState('Satış Fişi Bulunamadı', 'Bu tarihte kesilmiş kayıtlı bir kasa fişi bulunmamaktadır.');
    return;
  }

  container.innerHTML = salesList.map((s, idx) => {
    const isCard = String(s.payment_type || '').toLowerCase().includes('kart');
    const items = s.items || [];
    
    // Satış Kalemleri Önizleme Tablosu HTML
    const itemsTableHtml = items.length > 0 ? `
      <div id="rep-receipt-inline-${idx}" style="display: none; margin-top: 10px; padding-top: 10px; border-top: 1px dashed rgba(255,255,255,0.1); background: rgba(0,0,0,0.25); border-radius: 6px; padding: 8px;">
        <div style="font-size: 11px; font-weight: 800; color: #38bdf8; margin-bottom: 6px; display: flex; justify-content: space-between;">
          <span>📦 FİŞTEKİ SATIŞ KALEMLERİ (${items.length} Ürün)</span>
          <span style="color: #94a3b8; font-size: 10px;">Fiş No: ${s.receipt_no || '-'}</span>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="color: #94a3b8; border-bottom: 1px solid rgba(255,255,255,0.08); text-align: left;">
              <th style="padding: 4px 6px;">Ürün</th>
              <th style="padding: 4px 6px; text-align: center;">Miktar</th>
              <th style="padding: 4px 6px; text-align: right;">Birim Fiyat</th>
              <th style="padding: 4px 6px; text-align: right;">Tutar</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(it => `
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.04); color: #cbd5e1;">
                <td style="padding: 4px 6px; font-weight: 600;">
                  ${it.title || 'Ürün'}
                  ${it.barcode ? `<small style="color:#64748b; font-family:monospace; display:block; font-size:9.5px;">${it.barcode}</small>` : ''}
                </td>
                <td style="padding: 4px 6px; text-align: center; color: ${it.unit === 'Kg' ? '#22d3ee' : '#c084fc'}; font-weight: 700;">
                  ${it.quantity} ${it.unit || 'Ad'}
                </td>
                <td style="padding: 4px 6px; text-align: right; font-family: monospace;">
                  ${typeof it.unit_price === 'number' ? it.unit_price.toFixed(2) + ' TL' : (it.unit_price || '-')}
                </td>
                <td style="padding: 4px 6px; text-align: right; font-family: monospace; font-weight: 800; color: #34d399;">
                  ${typeof it.total_price === 'number' ? it.total_price.toFixed(2) + ' TL' : (it.total_price || '-')}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : '';

    return `
      <div style="background: rgba(15,23,42,0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px 14px; display: flex; flex-direction: column; transition: all 0.15s ease;" onmouseover="this.style.borderColor='rgba(56,189,248,0.4)'" onmouseout="this.style.borderColor='rgba(255,255,255,0.08)'">
        
        <!-- Fiş Üst Satırı -->
        <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;" onclick="toggleReceiptInlineItems(${idx})">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 20px;">🧾</span>
            <div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-weight: 800; color: #f8fafc; font-size: 13px; font-family: monospace;">#${s.receipt_no || '-'}</span>
                <span style="background: ${isCard ? 'rgba(56,189,248,0.15)' : 'rgba(16,185,129,0.15)'}; color: ${isCard ? '#38bdf8' : '#34d399'}; font-size: 10px; font-weight: 800; padding: 1px 6px; border-radius: 4px;">
                  ${isCard ? '💳 Kredi Kartı' : '💵 Nakit'}
                </span>
              </div>
              <small style="color: #94a3b8; font-size: 11px;">
                🕒 ${s.time || '-'} • 👤 ${s.cashier || 'Kasiyer'} • 📦 <strong style="color:#cbd5e1;">${items.length} Kalem Ürün</strong>
              </small>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="text-align: right;">
              <div style="font-family: monospace; font-size: 15px; font-weight: 900; color: #34d399;">
                ${s.total_amount_str || (typeof s.total_amount === 'number' ? s.total_amount.toFixed(2) + ' TL' : s.total_amount)}
              </div>
              <span id="rep-rcpt-toggle-btn-${idx}" style="color: #38bdf8; font-size: 10.5px; font-weight: 700;">
                ▼ Kalemleri İncele
              </span>
            </div>

            <!-- Detay Penceresi Aç Butonu -->
            <button onclick="event.stopPropagation(); openReportReceiptDetailModal(${idx})" class="btn-sm btn-primary" style="padding: 5px 12px; font-size: 11px; font-weight: 800; background: linear-gradient(135deg, #0284c7, #0369a1); white-space: nowrap;">
              🔍 Fiş Detayı
            </button>
          </div>
        </div>

        <!-- Açılır Kapanır Satış Kalemleri Çekmecesi -->
        ${itemsTableHtml}

      </div>
    `;
  }).join('');
}

// Fiş Kalemlerini Satır İçi Aç/Kapat
function toggleReceiptInlineItems(idx) {
  const drawer = document.getElementById(`rep-receipt-inline-${idx}`);
  const btn = document.getElementById(`rep-rcpt-toggle-btn-${idx}`);
  if (!drawer) return;

  if (drawer.style.display === 'none' || drawer.style.display === '') {
    drawer.style.display = 'block';
    if (btn) btn.innerText = '▲ Kapat';
  } else {
    drawer.style.display = 'none';
    if (btn) btn.innerText = '▼ Kalemleri İncele';
  }
}

// Kasa Satış Fişi Detay Modalı Aç
function openReportReceiptDetailModal(idx) {
  const receipt = currentDaySalesListCache[idx];
  if (!receipt) return;

  currentViewingReceiptObj = receipt;

  const noEl = document.getElementById('rep-rcpt-no');
  const dtEl = document.getElementById('rep-rcpt-datetime');
  const cashierEl = document.getElementById('rep-rcpt-cashier');
  const paymentEl = document.getElementById('rep-rcpt-payment');
  const tbodyEl = document.getElementById('rep-rcpt-items-tbody');
  const qtyEl = document.getElementById('rep-rcpt-total-qty');
  const vatEl = document.getElementById('rep-rcpt-vat');
  const grandTotalEl = document.getElementById('rep-rcpt-grand-total');
  const cashChangeBox = document.getElementById('rep-rcpt-cash-change-box');
  const receivedCashEl = document.getElementById('rep-rcpt-received-cash');
  const changeAmtEl = document.getElementById('rep-rcpt-change-amt');

  if (noEl) noEl.innerText = receipt.receipt_no || '-';
  if (dtEl) dtEl.innerText = `${receipt.date || '-'} ${receipt.time || ''}`;
  if (cashierEl) cashierEl.innerText = receipt.cashier || 'Kasiyer';
  
  const isCard = String(receipt.payment_type || '').toLowerCase().includes('kart');
  if (paymentEl) {
    paymentEl.innerText = isCard ? '💳 Kredi Kartı' : '💵 Nakit';
    paymentEl.style.color = isCard ? '#38bdf8' : '#34d399';
  }

  // Kalemler Tablosu
  const items = receipt.items || [];
  if (tbodyEl) {
    if (items.length === 0) {
      tbodyEl.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#64748b; padding:12px;">Fiş kalemi bulunamadı.</td></tr>';
    } else {
      tbodyEl.innerHTML = items.map(it => `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.04); color: #cbd5e1;">
          <td style="padding: 6px 10px; font-weight: 700; color: #f8fafc;">
            ${it.title || 'Ürün'}
            ${it.barcode ? `<small style="color:#64748b; font-family:monospace; display:block; font-size:10px;">${it.barcode}</small>` : ''}
          </td>
          <td style="padding: 6px 8px; text-align: center; font-weight: 800; color: ${it.unit === 'Kg' ? '#22d3ee' : '#c084fc'};">
            ${it.quantity} ${it.unit || 'Ad'}
          </td>
          <td style="padding: 6px 8px; text-align: right; font-family: monospace;">
            ${typeof it.unit_price === 'number' ? it.unit_price.toFixed(2) + ' TL' : (it.unit_price || '-')}
          </td>
          <td style="padding: 6px 10px; text-align: right; font-family: monospace; font-weight: 900; color: #34d399;">
            ${typeof it.total_price === 'number' ? it.total_price.toFixed(2) + ' TL' : (it.total_price || '-')}
          </td>
        </tr>
      `).join('');
    }
  }

  // Özet Bilgiler
  const totalQty = items.reduce((acc, it) => acc + Number(it.quantity || 1), 0);
  if (qtyEl) qtyEl.innerText = `${items.length} Kalem • Toplam ${totalQty.toFixed(totalQty % 1 === 0 ? 0 : 2)} Adet/Kg`;
  if (vatEl) vatEl.innerText = receipt.total_vat ? `${Number(receipt.total_vat).toFixed(2)} TL` : 'Dahil';

  const totStr = receipt.total_amount_str || (typeof receipt.total_amount === 'number' ? receipt.total_amount.toFixed(2) + ' TL' : (receipt.total_amount + ' TL'));
  if (grandTotalEl) grandTotalEl.innerText = totStr;

  // Nakit / Para Üstü
  if (!isCard && Number(receipt.received_cash) > 0 && cashChangeBox) {
    cashChangeBox.style.display = 'flex';
    if (receivedCashEl) receivedCashEl.innerText = `${Number(receipt.received_cash).toFixed(2)} TL`;
    if (changeAmtEl) changeAmtEl.innerText = `${Number(receipt.change_amount || 0).toFixed(2)} TL`;
  } else if (cashChangeBox) {
    cashChangeBox.style.display = 'none';
  }

  // Modalı Aç
  if (typeof openUniversalModal === 'function') {
    openUniversalModal('modal-report-receipt-detail');
  } else {
    const modal = document.getElementById('modal-report-receipt-detail');
    if (modal) modal.style.display = 'flex';
  }
}

function closeReportReceiptDetailModal() {
  if (typeof closeUniversalModal === 'function') {
    closeUniversalModal('modal-report-receipt-detail');
  } else {
    const modal = document.getElementById('modal-report-receipt-detail');
    if (modal) modal.style.display = 'none';
  }
}

function printCurrentReportReceipt() {
  if (!currentViewingReceiptObj) return;
  
  if (typeof printPosThermalReceipt === 'function') {
    printPosThermalReceipt(currentViewingReceiptObj);
  } else {
    window.print();
  }
}

// 8. Fiyat Değişiklikleri Renderı
function renderModalPriceChanges(priceChanges) {
  const container = document.getElementById('modal-day-prices-list');
  if (!container) return;

  if (!priceChanges || priceChanges.length === 0) {
    container.innerHTML = getModalEmptyState('Fiyat Değişikliği Bulunamadı', 'Bu tarihte gerçekleştirilmiş ürün fiyat güncellemesi bulunmamaktadır.');
    return;
  }

  container.innerHTML = priceChanges.map(pc => `
    <div style="background: rgba(15,23,42,0.6); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 16px;">✏️</span>
        <div>
          <div style="font-weight: 700; color: #f8fafc; font-size: 12.5px;">${pc.title || '-'}</div>
          <small style="color: #94a3b8; font-family: monospace; font-size: 10.5px;">Barkod: ${pc.barcode || '-'}</small>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="color: #f87171; text-decoration: line-through; font-family: monospace; font-size: 12px;">${pc.old_price || '-'}</span>
        <span style="color: #64748b;">➔</span>
        <span style="color: #34d399; font-weight: 900; font-family: monospace; font-size: 13.5px;">${pc.new_price || '-'}</span>
      </div>
    </div>
  `).join('');
}

// 7.5. Reyon & Kategori Ciro Dağılımı Renderı
function renderModalCategoryBreakdown(categories, totalAmount) {
  const container = document.getElementById('modal-day-categories-container');
  if (!container) return;

  if (!categories || categories.length === 0 || totalAmount <= 0) {
    container.innerHTML = getModalEmptyState('Reyon Satış Kaydı Yok', 'Bu tarihte kategorize edilmiş satış hareketi bulunmamaktadır.');
    return;
  }

  // Renkli Çoklu Segment Çubuğu
  const barSegmentsHtml = categories.map(cat => {
    if (cat.percentage <= 0) return '';
    return `<div style="width: ${cat.percentage}%; background: ${cat.color}; height: 100%;" title="${cat.name}: %${cat.percentage} (${cat.revenue_str})"></div>`;
  }).join('');

  // Reyon Kartları
  const cardsHtml = categories.map(cat => `
    <div style="background: rgba(15,23,42,0.7); border: 1px solid rgba(255,255,255,0.08); border-left: 4px solid ${cat.color}; border-radius: 8px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="font-size: 24px;">${cat.icon}</span>
        <div>
          <div style="font-weight: 800; color: #f8fafc; font-size: 13.5px;">${cat.category}</div>
          <small style="color: #94a3b8; font-size: 11px;">📦 Satılan Miktar: <strong style="color:#cbd5e1;">${cat.items_count} Adet/Kg</strong></small>
        </div>
      </div>
      <div style="text-align: right;">
        <div style="font-family: monospace; font-size: 15px; font-weight: 900; color: ${cat.color};">${cat.revenue_str}</div>
        <span style="background: ${cat.color}20; color: ${cat.color}; font-size: 10.5px; font-weight: 800; padding: 1px 7px; border-radius: 4px;">
          %${cat.percentage} Ciro Payı
        </span>
      </div>
    </div>
  `).join('');

  container.innerHTML = `
    <!-- Görsel Dağılım Çubuğu -->
    <div style="background: #090d16; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 14px 16px; display: flex; flex-direction: column; gap: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 11.5px; font-weight: 800; color: #38bdf8; text-transform: uppercase;">🛒 Reyon Ciro Paylaşımı Oranları</span>
        <span style="font-size: 11px; color: #94a3b8;">Toplam Ciro: <strong style="color:#34d399; font-family:monospace;">${currentLoadedDayReportData?.total_amount_str || '0,00 TL'}</strong></span>
      </div>
      <div style="height: 14px; width: 100%; background: rgba(255,255,255,0.06); border-radius: 6px; overflow: hidden; display: flex;">
        ${barSegmentsHtml}
      </div>
    </div>

    <!-- Reyon Kartları Listesi -->
    <div style="display: flex; flex-direction: column; gap: 8px;">
      ${cardsHtml}
    </div>
  `;
}

// 7.6. Kasiyer & Kasa Mutabakatı Renderı
function renderModalCashierPerformance(cashiers) {
  const container = document.getElementById('modal-day-cashiers-container');
  if (!container) return;

  if (!cashiers || cashiers.length === 0) {
    container.innerHTML = getModalEmptyState('Kasiyer Hareketi Yok', 'Bu tarihte kayıtlı kasiyer işlemi bulunmamaktadır.');
    return;
  }

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 10px;">
      ${cashiers.map(c => `
        <div style="background: rgba(15,23,42,0.75); border: 1px solid rgba(56,189,248,0.25); border-radius: 8px; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 42px; height: 42px; border-radius: 50%; background: rgba(56,189,248,0.15); border: 1px solid rgba(56,189,248,0.3); display: flex; align-items: center; justify-content: center; font-size: 20px;">
              👤
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <strong style="color: #f8fafc; font-size: 14px;">${c.cashier}</strong>
                <span style="background: rgba(16,185,129,0.15); color: #34d399; font-size: 10px; font-weight: 800; padding: 1px 6px; border-radius: 4px;">
                  %${c.percentage} Kasa Payı
                </span>
              </div>
              <small style="color: #94a3b8; font-size: 11.5px; display: block; margin-top: 2px;">
                🧾 ${c.receipt_count} Fiş • 📦 ${c.items_sold} Satılan Kalem
              </small>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 20px; text-align: right;">
            <div style="display: flex; flex-direction: column; gap: 2px; font-size: 11.5px; font-family: monospace;">
              <span style="color: #34d399;">💵 Nakit: <strong>${c.cash_str}</strong></span>
              <span style="color: #38bdf8;">💳 Kart: <strong>${c.card_str}</strong></span>
            </div>
            <div style="border-left: 1px solid rgba(255,255,255,0.1); padding-left: 16px;">
              <div style="font-size: 10px; color: #94a3b8; font-weight: 700;">KASA TOPLAMI</div>
              <div style="font-family: monospace; font-size: 16px; font-weight: 900; color: #fbbf24;">${c.total_str}</div>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// 7.7. Günlük Raporu Excel (.csv) Olarak Dışa Aktarma
function exportCurrentDayReportToExcel() {
  const data = currentLoadedDayReportData;
  if (!data) return;

  const dateStr = data.date || 'Tarih';
  let csvContent = '\uFEFF'; // Excel UTF-8 BOM

  // 1. Gün Özeti Başlığı
  csvContent += `GÜNLÜK SATIŞ VE FAALİYET RAPORU;${dateStr}\n`;
  csvContent += `Toplam Ciro;${data.total_amount_str || '0,00 TL'}\n`;
  csvContent += `Nakit Satış;${data.cash_total_str || '0,00 TL'}\n`;
  csvContent += `Kredi Kartı Satış;${data.card_total_str || '0,00 TL'}\n`;
  csvContent += `Toplam Fiş Sayısı;${data.receipt_count || 0}\n`;
  csvContent += `Satılan Ürün Miktarı;${data.sold_summary_str || ''}\n\n`;

  // 2. Çok Satan Ürünler Tablosu
  csvContent += `GÜNÜN EN ÇOK SATAN ÜRÜNLERİ\n`;
  csvContent += `Sıra;Barkod;Ürün Adı;Miktar;Birim;Toplam Tutar\n`;
  const prods = data.day_top_products || [];
  prods.forEach((p, idx) => {
    csvContent += `${idx + 1};"${p.barcode || ''}";"${(p.title || '').replace(/"/g, '""')}";${p.quantity};${p.unit || 'Adet'};${p.revenue_str || ''}\n`;
  });
  csvContent += `\n`;

  // 3. Reyon / Kategori Dağılımı
  csvContent += `REYON / KATEGORİ DAĞILIMI\n`;
  csvContent += `Reyon Adı;Satılan Miktar;Toplam Ciro;Ciro Payı (%)\n`;
  const cats = data.category_breakdown || [];
  cats.forEach(c => {
    csvContent += `"${c.category}";${c.items_count};${c.revenue_str};%${c.percentage}\n`;
  });
  csvContent += `\n`;

  // 4. Kasiyer Mutabakatı
  csvContent += `KASİYER & KASA MUTABAKATI\n`;
  csvContent += `Kasiyer;Fiş Sayısı;Satılan Kalem;Nakit;Kredi Kartı;Toplam Ciro;Pay (%)\n`;
  const cashiers = data.cashier_performance || [];
  cashiers.forEach(c => {
    csvContent += `"${c.cashier}";${c.receipt_count};${c.items_sold};${c.cash_str};${c.card_str};${c.total_str};%${c.percentage}\n`;
  });

  // İndirme Bağlantısı Tetikleme
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Gunluk_Satis_Raporu_${dateStr.replace(/-/g, '_')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

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

