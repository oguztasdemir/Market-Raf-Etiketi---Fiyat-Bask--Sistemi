// -*- coding: utf-8 -*-
/**
 * =========================================================================
 * YAN YANA BELGE ÖNİZLEME & AŞAMA AŞAMA FATURA DOĞRULAMA STÜDYOSU
 * =========================================================================
 */

let currentLoadedInvoice = null;
let archivedInvoiceData = [];
let activeInvoiceFilter = 'ALL';
let currentMobileUrl = '';
let currentDocZoom = 1.0;

document.addEventListener('DOMContentLoaded', () => {
  loadInvoiceArchiveHistory();
  fetchMobileServerUrl();
});

// 1. Yeni Yükleme Görünümüne Geçiş
function showNewInvoiceUploadView() {
  const uploadCard = document.getElementById('invoice-upload-card-view');
  const resultsCard = document.getElementById('invoice-results-container');
  if (uploadCard) uploadCard.style.display = 'flex';
  if (resultsCard) resultsCard.style.display = 'none';
  currentLoadedInvoice = null;
}

// 2. Dosya Seçimi veya Sürükle-Bırak Olayları
async function handleInvoiceFileSelected(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  await uploadAndParseInvoiceFile(file);
}

async function handleInvoiceDrop(event) {
  event.preventDefault();
  const dropzone = document.getElementById('invoice-dropzone-container');
  if (dropzone) {
    dropzone.style.borderColor = 'rgba(56,189,248,0.4)';
    dropzone.style.background = 'radial-gradient(circle at center, rgba(56, 189, 248, 0.05) 0%, rgba(9, 13, 22, 0.8) 100%)';
  }

  const file = event.dataTransfer?.files?.[0];
  if (!file) return;
  await uploadAndParseInvoiceFile(file);
}

// 3. Fatura Yükleme ve Backend Çözümleme
async function uploadAndParseInvoiceFile(file) {
  if (typeof showSystemToast === 'function') {
    showSystemToast(`⏳ ${file.name} ayrıştırılıyor ve şirket arşivine işleniyor...`, 'info');
  }

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/api/invoice/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (data.status === 'success' && data.invoice) {
      currentLoadedInvoice = data.invoice;
      renderInvoiceResults(data.invoice);
      if (typeof showSystemToast === 'function') {
        showSystemToast(`✓ Fatura okundu! ${data.invoice.items.length} kalem ayrıştırıldı.`, 'success');
      }
      loadInvoiceArchiveHistory();
    } else {
      if (typeof showSystemToast === 'function') {
        showSystemToast(data.message || 'Fatura ayrıştırma hatası!', 'error');
      }
    }
  } catch (err) {
    if (typeof showSystemToast === 'function') {
      showSystemToast('Fatura sunucuya yüklenirken hata oluştu.', 'error');
    }
  }
}

// 4. Demo / Örnek Fatura Yükleyici
async function loadDemoSampleInvoice() {
  try {
    const res = await fetch('/api/invoice/demo-sample');
    const data = await res.json();
    if (data.status === 'success' && data.invoice) {
      currentLoadedInvoice = data.invoice;
      renderInvoiceResults(data.invoice);
      if (typeof showSystemToast === 'function') {
        showSystemToast('✓ Örnek toptancı faturası yüklendi ve matematiksel sağlama yapıldı.', 'success');
      }
    }
  } catch (e) {
    console.error('Demo fatura yükleme hatası:', e);
  }
}

// 5. Belge Önizleme Zoom & Büyütme Araçları
function zoomInvoiceDoc(delta) {
  currentDocZoom = Math.max(0.4, Math.min(3.0, currentDocZoom + delta));
  const img = document.getElementById('inv-doc-img');
  if (img) {
    img.style.transform = `scale(${currentDocZoom})`;
  }
}

function resetInvoiceDocZoom() {
  currentDocZoom = 1.0;
  const img = document.getElementById('inv-doc-img');
  if (img) {
    img.style.transform = 'scale(1.0)';
  }
}

// 6. Fatura Sonuçlarını ve Kalem Tablosunu Ekrana Basma
function renderInvoiceResults(invoice) {
  const uploadCard = document.getElementById('invoice-upload-card-view');
  const resultsCard = document.getElementById('invoice-results-container');
  if (uploadCard) uploadCard.style.display = 'none';
  if (resultsCard) resultsCard.style.display = 'flex';

  // 6.A. ORTA BELGE ÖNİZLEMESİ
  const imgEl = document.getElementById('inv-doc-img');
  const iframeEl = document.getElementById('inv-doc-iframe');
  const fallbackEl = document.getElementById('inv-doc-fallback');
  const extLink = document.getElementById('inv-preview-external-link');
  
  resetInvoiceDocZoom();

  const fileUrl = invoice.file_url || '';
  if (extLink) extLink.href = fileUrl || '#';

  if (fileUrl && fileUrl.toLowerCase().endsWith('.pdf')) {
    if (imgEl) imgEl.style.display = 'none';
    if (fallbackEl) fallbackEl.style.display = 'none';
    if (iframeEl) {
      iframeEl.style.display = 'block';
      iframeEl.src = fileUrl;
    }
  } else if (fileUrl && (fileUrl.toLowerCase().match(/\.(jpg|jpeg|png|webp|bmp)$/))) {
    if (iframeEl) iframeEl.style.display = 'none';
    if (fallbackEl) fallbackEl.style.display = 'none';
    if (imgEl) {
      imgEl.style.display = 'block';
      imgEl.src = fileUrl;
    }
  } else {
    if (imgEl) imgEl.style.display = 'none';
    if (iframeEl) iframeEl.style.display = 'none';
    if (fallbackEl) fallbackEl.style.display = 'block';
  }

  // 6.B. AŞAMA 1: TEDARİKÇİ & FATURA BİLGİLERİ
  const supEl = document.getElementById('inv-res-supplier');
  const noEl = document.getElementById('inv-res-no');
  const dateEl = document.getElementById('inv-res-date');
  const vknEl = document.getElementById('inv-res-vkn');
  const formatBadge = document.getElementById('inv-res-format-badge');

  if (supEl) supEl.innerText = invoice.supplier_name || 'Tedarikçi Firma';
  if (noEl) noEl.innerText = invoice.invoice_no || '-';
  if (dateEl) dateEl.innerText = invoice.date || '-';
  if (vknEl) vknEl.innerText = invoice.supplier_vkn || 'Belirtilmedi';
  if (formatBadge) {
    formatBadge.innerText = invoice.format || (invoice.is_xml ? 'UBL-TR XML' : 'Görsel / OCR Belgesi');
  }

  // 6.C. AŞAMA 2: MATEMATİKSEL SAĞLAMA & GENEL TOPLAM
  const grandEl = document.getElementById('inv-res-grand-total');
  const subEl = document.getElementById('inv-res-sub-totals');
  const mathBox = document.getElementById('inv-math-validation-box');
  const mathIcon = document.getElementById('inv-math-icon');
  const mathTitle = document.getElementById('inv-math-status-title');
  const mathDesc = document.getElementById('inv-math-status-desc');

  if (grandEl) grandEl.innerText = invoice.grand_total_str || `${invoice.grand_total || 0} TL`;
  if (subEl) {
    subEl.innerText = `Ara Toplam: ${invoice.subtotal_str || (invoice.subtotal ? invoice.subtotal + ' TL' : '0 TL')} • KDV: ${invoice.tax_total_str || (invoice.tax_total ? invoice.tax_total + ' TL' : '0 TL')} • İskonto: ${invoice.discount_total_str || (invoice.discount_total ? invoice.discount_total + ' TL' : '0 TL')}`;
  }

  const val = invoice.validation || {};
  if (mathBox) {
    if (val.is_valid) {
      mathBox.style.background = 'rgba(16,185,129,0.12)';
      mathBox.style.borderColor = 'rgba(16,185,129,0.3)';
      if (mathIcon) mathIcon.innerText = '🧮';
      if (mathTitle) {
        mathTitle.style.color = '#34d399';
        mathTitle.innerText = 'Matematiksel Sağlama Başarılı (%100 Tutarlı)';
      }
      if (mathDesc) {
        mathDesc.innerText = 'Kalem toplamları fatura dip toplamı ile kuruşu kuruşuna uyuşuyor.';
      }
    } else {
      mathBox.style.background = 'rgba(239,68,68,0.12)';
      mathBox.style.borderColor = 'rgba(239,68,68,0.3)';
      if (mathIcon) mathIcon.innerText = '⚠️';
      if (mathTitle) {
        mathTitle.style.color = '#f87171';
        mathTitle.innerText = 'Matematiksel Fark Tespiti';
      }
      if (mathDesc) {
        mathDesc.innerText = val.status_text || 'Kalem toplamları ile fatura genel toplamı arasında fark var.';
      }
    }
  }

  // 6.D. AŞAMA 3: KALEM KALEM ÜRÜN TABLOSU
  const tbody = document.getElementById('invoice-items-table-body');
  const countBadge = document.getElementById('inv-items-count-badge');
  if (!tbody) return;
  tbody.innerHTML = '';

  const items = invoice.items || [];
  if (countBadge) countBadge.innerText = `${items.length} Kalem`;

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #94a3b8; padding: 20px;">Faturada ayrıştırılmış kalem bulunamadı.</td></tr>`;
    return;
  }

  items.forEach((it, idx) => {
    const isMatched = it.is_matched;
    const matchStatusHtml = isMatched
      ? `<span style="background: rgba(16,185,129,0.15); color: #34d399; border: 1px solid rgba(16,185,129,0.3); padding: 2px 6px; border-radius: 4px; font-weight: 800; font-size: 10px;">✓ Eşleşti</span>`
      : `<span style="background: rgba(245,158,11,0.15); color: #fbbf24; border: 1px solid rgba(245,158,11,0.3); padding: 2px 6px; border-radius: 4px; font-weight: 800; font-size: 10px;">+ Yeni</span>`;

    const stockChangeHtml = isMatched
      ? `<span style="color: #94a3b8;">${it.existing_stock || 0}</span> ➔ <strong style="color: #38bdf8;">${it.new_stock || 0}</strong>`
      : `<strong style="color: #34d399;">+${it.quantity} (Yeni)</strong>`;

    // Kâr Marjı Rozeti
    let marginBadge = `<span style="color: #64748b;">-</span>`;
    const cost = parseFloat(it.net_unit_cost || 0);
    const sale = parseFloat(String(it.shelf_sale_price || '0').replace('TL','').replace(',','.').trim());
    if (cost > 0 && sale > cost) {
      const margin = Math.round(((sale - cost) / sale) * 100);
      marginBadge = `<span style="background: rgba(56,189,248,0.15); color: #38bdf8; border: 1px solid rgba(56,189,248,0.3); padding: 2px 5px; border-radius: 4px; font-weight: 800; font-size: 10px;">%${margin} Kâr</span>`;
    }

    const tr = document.createElement('tr');
    tr.className = 'inv-table-row';
    tr.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)';

    tr.innerHTML = `
      <td style="padding: 7px 5px;">${matchStatusHtml}</td>
      <td style="padding: 7px 5px; font-family: monospace; color: #cbd5e1; font-weight: 700;">${it.barcode || '-'}</td>
      <td style="padding: 7px 5px; font-weight: 700; color: #f8fafc;">
        ${it.title || '-'}
        ${isMatched && it.catalog_title && it.catalog_title !== it.title ? `<div style="font-size: 10px; color: #94a3b8;">Katalog: ${it.catalog_title}</div>` : ''}
      </td>
      <td style="padding: 7px 5px; text-align: center; font-weight: 800; color: #38bdf8;">${it.quantity} ${it.unit || 'Adet'}</td>
      <td style="padding: 7px 5px; text-align: center;">${stockChangeHtml}</td>
      <td style="padding: 7px 5px; text-align: right; font-weight: 800; color: #fbbf24;">${it.net_unit_cost_str || it.net_unit_cost + ' TL'}</td>
      <td style="padding: 7px 5px; text-align: right; color: #34d399; font-weight: 800;">${it.shelf_sale_price_str || it.shelf_sale_price || '-'}</td>
      <td style="padding: 7px 5px; text-align: center;">${marginBadge}</td>
      <td style="padding: 7px 5px; text-align: right; font-weight: 800; color: #f8fafc; font-family: monospace;">${it.line_total_str || it.line_total + ' TL'}</td>
    `;
    tbody.appendChild(tr);
  });
}

// 7. Şirket Arşivini Getirme ve Sol Panelde Listeleme
async function loadInvoiceArchiveHistory() {
  try {
    const res = await fetch('/api/invoice/archived');
    const data = await res.json();

    if (data.status === 'success' && data.archives) {
      archivedInvoiceData = data.archives || [];
      renderInvoiceCompaniesLeftPanel(archivedInvoiceData);
    }
  } catch (err) {
    console.error('Arşiv yüklenirken hata:', err);
  }
}

function renderInvoiceCompaniesLeftPanel(archives) {
  const container = document.getElementById('inv-companies-scroll-list');
  const countBadge = document.getElementById('inv-total-companies-badge');
  if (!container) return;

  if (!archives || archives.length === 0) {
    container.innerHTML = `<div style="color: #64748b; font-size: 12px; text-align: center; padding: 24px;">Arşivde fatura bulunamadı.</div>`;
    if (countBadge) countBadge.innerText = '0 Şirket';
    return;
  }

  // Şirketlere göre grupla
  const companyMap = {};
  archives.forEach(item => {
    const cName = item.supplier_name || item.company_folder || 'Diğer';
    if (!companyMap[cName]) {
      companyMap[cName] = {
        name: cName,
        folder: item.company_folder,
        totalAmount: 0,
        invoices: []
      };
    }
    companyMap[cName].invoices.push(item);
    companyMap[cName].totalAmount += parseFloat(item.grand_total || 0);
  });

  const companies = Object.values(companyMap);
  
  // Şirketleri ve faturaları A-Z alfabetik olarak sırala (Türkçe locale)
  companies.forEach(c => {
    c.invoices.sort((a, b) => (a.invoice_no || a.filename || '').localeCompare(b.invoice_no || b.filename || '', 'tr', { sensitivity: 'base' }));
    
    // Son kesim tarihini bul
    let maxDate = '-';
    c.invoices.forEach(inv => {
      if (inv.date && (maxDate === '-' || inv.date > maxDate)) maxDate = inv.date;
    });
    c.latestDate = maxDate;
  });

  // Firmaları A-Z alfabetik sırala
  companies.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr', { sensitivity: 'base' }));
  window._allLoadedCompanies = companies;

  if (countBadge) countBadge.innerText = `${companies.length} Şirket (${archives.length} Fatura)`;

  // Varsayılan görünüm başlıklarını ayarla
  const mainHeader = document.getElementById('inv-companies-main-header');
  const detailHeader = document.getElementById('inv-company-detail-header');
  if (mainHeader) mainHeader.style.display = 'flex';
  if (detailHeader) detailHeader.style.display = 'none';

  container.innerHTML = companies.map((c, cIdx) => {
    const firstChar = c.name.replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ]/g, '')[0] || '🏢';
    const amountStr = c.totalAmount > 0 ? `${c.totalAmount.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} TL` : '';

    return `
      <div class="inv-company-card" onclick="selectCompanyForDetail(${cIdx})" style="background: #131b2e; border: 1px solid rgba(56,189,248,0.25); border-radius: 10px; margin-bottom: 8px; flex-shrink: 0; min-height: 60px; width: 100%; box-sizing: border-box; transition: all 0.2s ease; cursor: pointer;">
        
        <!-- Şirket Başlığı (Tıklandığında Şirket Detayına Gider) -->
        <div class="inv-company-header" style="padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; background: linear-gradient(90deg, rgba(255,255,255,0.04), transparent); user-select: none; box-sizing: border-box;">
          <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;">
            <div style="width: 36px; height: 36px; border-radius: 9px; background: linear-gradient(135deg, #0284c7, #0369a1); display: flex; align-items: center; justify-content: center; font-weight: 900; color: #fff; font-size: 15px; flex-shrink: 0; box-shadow: 0 2px 8px rgba(2,132,199,0.4);">
              ${firstChar.toUpperCase()}
            </div>
            <div style="min-width: 0; flex: 1;">
              <strong style="color: #ffffff; font-size: 13.5px; font-weight: 800; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3;">
                ${c.name}
              </strong>
              <div style="display: flex; align-items: center; gap: 8px; margin-top: 3px; font-size: 11px;">
                <span style="color: #cbd5e1;">📅 Son: <strong style="color: #38bdf8;">${c.latestDate}</strong></span>
                ${amountStr ? `<span style="color: #34d399; font-weight: 800; font-family: monospace;">• ${amountStr}</span>` : ''}
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0; margin-left: 6px;">
            <span style="font-size: 11px; background: rgba(56,189,248,0.18); color: #38bdf8; border: 1px solid rgba(56,189,248,0.4); padding: 3px 8px; border-radius: 6px; font-weight: 800; white-space: nowrap;">
              📦 ${c.invoices.length} Fatura
            </span>
            <span style="font-size: 13px; color: #38bdf8; font-weight: 900;">
              ➔
            </span>
          </div>
        </div>

      </div>
    `;
  }).join('');
}

// Şirket Seçildiğinde: Sadece o şirketin faturalarını göster
function selectCompanyForDetail(cIdx) {
  const companies = window._allLoadedCompanies || [];
  const c = companies[cIdx];
  if (!c) return;

  const mainHeader = document.getElementById('inv-companies-main-header');
  const detailHeader = document.getElementById('inv-company-detail-header');
  const container = document.getElementById('inv-companies-scroll-list');
  
  if (mainHeader) mainHeader.style.display = 'none';
  if (detailHeader) detailHeader.style.display = 'flex';

  const avatarEl = document.getElementById('inv-detail-company-avatar');
  const nameEl = document.getElementById('inv-detail-company-name');
  const statsEl = document.getElementById('inv-detail-company-stats');

  const firstChar = c.name.replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ]/g, '')[0] || '🏢';
  const amountStr = c.totalAmount > 0 ? `${c.totalAmount.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} TL` : '';

  if (avatarEl) avatarEl.innerText = firstChar.toUpperCase();
  if (nameEl) nameEl.innerText = c.name;
  if (statsEl) statsEl.innerText = `📦 ${c.invoices.length} Fatura ${amountStr ? '• Toplam: ' + amountStr : ''}`;

  if (container) {
    container.innerHTML = `
      <div style="font-size: 11px; color: #94a3b8; font-weight: 800; text-transform: uppercase; margin: 4px 2px 8px 2px;">
        📄 ${c.name} Firmasına Ait Faturalar:
      </div>
      ${c.invoices.map(inv => `
        <div class="inv-sub-invoice-item" onclick="loadArchivedInvoiceDetails('${inv.company_folder}', '${inv.filename}')" style="padding: 12px 14px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.2s ease; background: #131b2e; border: 1px solid rgba(56,189,248,0.2); margin-bottom: 6px; flex-shrink: 0; box-sizing: border-box;">
          <div style="min-width: 0; flex: 1;">
            <div style="font-size: 13px; font-weight: 800; color: #38bdf8; font-family: monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              📄 ${inv.invoice_no || inv.filename}
            </div>
            <div style="font-size: 11.5px; color: #cbd5e1; margin-top: 3px;">
              📅 ${inv.date || '-'} • <span style="color: #94a3b8;">${inv.item_count || 1} Kalem</span>
            </div>
          </div>
          <strong style="font-size: 13px; color: #34d399; font-family: monospace; flex-shrink: 0; margin-left: 10px; background: rgba(16,185,129,0.15); padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(16,185,129,0.3);">
            ${inv.grand_total_str || (inv.grand_total ? inv.grand_total + ' TL' : 'Görsel')}
          </strong>
        </div>
      `).join('')}
    `;
  }
}

// Geri Butonuna Basıldığında: Tüm firmalara geri dön
function backToAllCompaniesList() {
  const mainHeader = document.getElementById('inv-companies-main-header');
  const detailHeader = document.getElementById('inv-company-detail-header');
  if (mainHeader) mainHeader.style.display = 'flex';
  if (detailHeader) detailHeader.style.display = 'none';

  renderInvoiceCompaniesLeftPanel(archivedInvoiceData);
}

// 8. Filtreleme Fonksiyonları
function applyInvoiceFilter(filterType) {
  activeInvoiceFilter = filterType;
  
  ['all', 'month', 'xml', 'img'].forEach(id => {
    const btn = document.getElementById(`chip-filter-${id}`);
    if (btn) btn.classList.remove('active');
  });

  const activeBtn = document.getElementById(`chip-filter-${filterType.toLowerCase().replace('_', '')}`);
  if (activeBtn) activeBtn.classList.add('active');

  filterInvoiceCompaniesList(document.getElementById('inv-company-search-input')?.value || '');
}

function filterInvoiceCompaniesList(query) {
  const q = (query || '').toLowerCase().trim();
  if (!archivedInvoiceData) return;

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const filtered = archivedInvoiceData.filter(inv => {
    if (activeInvoiceFilter === 'THIS_MONTH' && !String(inv.date || '').startsWith(currentMonthStr)) {
      return false;
    }
    if (activeInvoiceFilter === 'XML' && !inv.is_xml && !String(inv.filename || '').endsWith('.xml')) {
      return false;
    }
    if (activeInvoiceFilter === 'IMG' && inv.is_xml) {
      return false;
    }

    if (q) {
      const supMatch = (inv.supplier_name || '').toLowerCase().includes(q);
      const noMatch = (inv.invoice_no || '').toLowerCase().includes(q);
      const folderMatch = (inv.company_folder || '').toLowerCase().includes(q);
      return supMatch || noMatch || folderMatch;
    }

    return true;
  });

  renderInvoiceCompaniesLeftPanel(filtered);
}

// 9. Arşivden Fatura Detayını Açma
async function loadArchivedInvoiceDetails(companyFolder, filename) {
  try {
    const res = await fetch(`/api/invoice/archived/details?folder=${encodeURIComponent(companyFolder)}&file=${encodeURIComponent(filename)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'success' && data.invoice) {
        currentLoadedInvoice = data.invoice;
        renderInvoiceResults(data.invoice);
        if (typeof showSystemToast === 'function') {
          showSystemToast(`✓ ${data.invoice.supplier_name} faturası ve orijinal belge önizlemesi açıldı.`, 'info');
        }
      }
    }
  } catch (e) {
    console.error('Arşiv fatura yükleme hatası:', e);
  }
}

// 10. Faturayı Sisteme İşleme (Stok & Muhasebe)
async function commitInvoice() {
  if (!currentLoadedInvoice) return;

  const updateStocks = document.getElementById('opt-update-stocks')?.checked !== false;
  const addExpenses = document.getElementById('opt-add-expenses')?.checked !== false;

  try {
    const res = await fetch('/api/invoice/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoice: currentLoadedInvoice,
        update_stocks: updateStocks,
        add_expenses: addExpenses
      })
    });
    const data = await res.json();

    if (data.status === 'success') {
      if (typeof showSystemToast === 'function') {
        showSystemToast('🎉 Fatura onaylandı! Stoklar artırıldı ve muhasebe giderlerine işlendi.', 'success');
      }
      loadInvoiceArchiveHistory();
    } else {
      if (typeof showSystemToast === 'function') {
        showSystemToast(data.message || 'İşleme hatası!', 'error');
      }
    }
  } catch (err) {
    console.error('Fatura işleme hatası:', err);
  }
}

// 11. Raf Etiketi Yazdırma Sırasına Gönder
function printLabelsForInvoiceItems() {
  if (!currentLoadedInvoice || !currentLoadedInvoice.items) return;
  const items = currentLoadedInvoice.items;
  if (items.length === 0) return;

  if (typeof showSystemToast === 'function') {
    showSystemToast(`${items.length} adet fatura kalemi raf etiketi basım sırasına eklendi.`, 'success');
  }
}

// 12. QR Kod ve Mobil IP Entegrasyonu
async function fetchMobileServerUrl() {
  try {
    const res = await fetch('/api/network/ip');
    const data = await res.json();
    currentMobileUrl = data.mobile_http || `http://${window.location.hostname}:5000/mobile`;
    
    const qrUrlEl = document.getElementById('inv-embedded-qr-url');
    const qrImgEl = document.getElementById('inv-embedded-qr-img');

    if (qrUrlEl) qrUrlEl.innerText = currentMobileUrl;
    if (qrImgEl) {
      qrImgEl.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(currentMobileUrl)}`;
    }
  } catch (e) {}
}

function copyMobileInvoiceUrl() {
  if (currentMobileUrl) {
    navigator.clipboard.writeText(currentMobileUrl);
    if (typeof showSystemToast === 'function') {
      showSystemToast('📋 Mobil bağlantı panoya kopyalandı.', 'success');
    }
  }
}

function copyInvoiceNumber() {
  const no = document.getElementById('inv-res-no')?.innerText;
  if (no && no !== '-') {
    navigator.clipboard.writeText(no);
    if (typeof showSystemToast === 'function') {
      showSystemToast(`📋 Fatura No kopyalandı: ${no}`, 'info');
    }
  }
}
