// -*- coding: utf-8 -*-
/**
 * GÜNLÜK FİŞ DETAYLARI & RAPOR EXPORT (rapor_fis_detay.js)
 */

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

