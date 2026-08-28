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
  // Açılışta ve her 30 saniyede bir Ödeal'daki tüm yeni faturaları arka planda otomatik çek
  setTimeout(() => fetchInvoicesFromOdealDirect(true), 300);
  setInterval(() => fetchInvoicesFromOdealDirect(true), 30000);
});

// 1. Yeni Yükleme Görünümüne Geçiş
function showNewInvoiceUploadView() {
  const uploadCard = document.getElementById('invoice-upload-card-view');
  const resultsCard = document.getElementById('invoice-results-container');
  if (uploadCard) {
    uploadCard.style.setProperty('display', 'flex', 'important');
    uploadCard.style.width = '100%';
    uploadCard.style.height = '100%';
  }
  if (resultsCard) {
    resultsCard.style.setProperty('display', 'none', 'important');
  }
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
        showSystemToast('✓ Örnek toptancı faturası yüklendi ve arşive işlendi.', 'success');
      }
      loadInvoiceArchiveHistory();
    }
  } catch (e) {
    console.error('Demo fatura yükleme hatası:', e);
  }
}

// 5. Belge Önizleme Zoom & Büyütme Araçları
function zoomInvoiceDoc(delta) {
  currentDocZoom = Math.max(0.6, Math.min(2.5, currentDocZoom + delta));
  const img = document.getElementById('inv-doc-img');
  const iframe = document.getElementById('inv-doc-iframe');
  if (img) img.style.transform = `scale(${currentDocZoom})`;
  if (iframe) iframe.style.transform = `scale(${currentDocZoom})`;
}

function resetInvoiceDocZoom() {
  currentDocZoom = 1.0;
  const img = document.getElementById('inv-doc-img');
  const iframe = document.getElementById('inv-doc-iframe');
  if (img) img.style.transform = 'scale(1.0)';
  if (iframe) iframe.style.transform = 'scale(1.0)';
}

function setInvoiceStudioViewMode(mode) {
  const grid = document.getElementById('invoice-studio-grid');
  const paneDoc = document.getElementById('inv-pane-document');
  const paneTable = document.getElementById('inv-pane-table');
  const btnSplit = document.getElementById('btn-view-split');
  const btnDoc = document.getElementById('btn-view-doc');
  const btnTable = document.getElementById('btn-view-table');

  if (!grid || !paneDoc || !paneTable) return;

  const resetBtn = (btn) => {
    if (btn) {
      btn.style.background = 'transparent';
      btn.style.color = '#94a3b8';
      btn.style.fontWeight = '700';
    }
  };
  const activeBtn = (btn) => {
    if (btn) {
      btn.style.background = '#0284c7';
      btn.style.color = '#fff';
      btn.style.fontWeight = '800';
    }
  };

  resetBtn(btnSplit);
  resetBtn(btnDoc);
  resetBtn(btnTable);

  if (mode === 'doc_only') {
    grid.style.gridTemplateColumns = '1fr';
    paneDoc.style.display = 'flex';
    paneDoc.style.width = '100%';
    paneTable.style.display = 'none';
    activeBtn(btnDoc);
  } else if (mode === 'table_only') {
    grid.style.gridTemplateColumns = '1fr';
    paneDoc.style.display = 'none';
    paneTable.style.display = 'flex';
    paneTable.style.width = '100%';
    activeBtn(btnTable);
  } else {
    // split mode
    grid.style.gridTemplateColumns = '1.1fr 1fr';
    paneDoc.style.display = 'flex';
    paneTable.style.display = 'flex';
    paneDoc.style.width = '100%';
    paneTable.style.width = '100%';
    activeBtn(btnSplit);
  }
}

// 6. Fatura Sonuçlarını ve Kalem Tablosunu Ekrana Basma
function renderInvoiceResults(invoice) {
  const uploadCard = document.getElementById('invoice-upload-card-view');
  const resultsCard = document.getElementById('invoice-results-container');
  if (uploadCard) {
    uploadCard.style.setProperty('display', 'none', 'important');
  }
  if (resultsCard) {
    resultsCard.style.setProperty('display', 'flex', 'important');
    resultsCard.style.width = '100%';
    resultsCard.style.height = '100%';
    resultsCard.style.flex = '1';
  }

  // 6.A. ORTA BELGE ÖNİZLEMESİ
  const imgEl = document.getElementById('inv-doc-img');
  const iframeEl = document.getElementById('inv-doc-iframe');
  const fallbackEl = document.getElementById('inv-doc-fallback');
  const extLink = document.getElementById('inv-preview-external-link');
  
  resetInvoiceDocZoom();

  const fileUrl = invoice.file_url || '';
  if (extLink) extLink.href = fileUrl || '#';

  if (invoice.official_html && iframeEl) {
    if (imgEl) imgEl.style.display = 'none';
    if (fallbackEl) fallbackEl.style.display = 'none';
    iframeEl.style.display = 'block';
    iframeEl.srcdoc = invoice.official_html;
  } else if (fileUrl && fileUrl.toLowerCase().endsWith('.pdf')) {
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
  if (noEl) noEl.innerText = (invoice.invoice_no && invoice.invoice_no !== 'undefined') ? invoice.invoice_no : (invoice.inv_no || '-');
  if (dateEl) dateEl.innerText = invoice.date || '-';
  if (vknEl) vknEl.innerText = invoice.supplier_vkn || '52345033274';
  if (formatBadge) {
    formatBadge.innerText = invoice.format || (invoice.is_xml ? 'UBL-TR XML' : 'Ödeal e-Fatura XML');
  }

  // 6.C. AŞAMA 2: MATEMATİKSEL SAĞLAMA & GENEL TOPLAM
  const grandEl = document.getElementById('inv-res-grand-total');
  const subEl = document.getElementById('inv-res-sub-totals');
  const mathBox = document.getElementById('inv-math-validation-box');
  const mathIcon = document.getElementById('inv-math-icon');
  const mathTitle = document.getElementById('inv-math-status-title');
  const mathDesc = document.getElementById('inv-math-status-desc');

  if (grandEl) grandEl.innerText = invoice.grand_total_str || `${invoice.grand_total || 0} TL`;
  
  const val = invoice.validation || {};
  
  // KDV Kırılımı Metni
  let vatBreakdownStr = '';
  if (val.vat_breakdown) {
    const parts = Object.entries(val.vat_breakdown).map(([rate, v]) => `%${rate} KDV: ${v.tax_str || v.tax + ' TL'}`);
    if (parts.length > 0) vatBreakdownStr = ` • [ ${parts.join(' | ')} ]`;
  }

  if (subEl) {
    subEl.innerText = `Ara Toplam: ${invoice.subtotal_str || (invoice.subtotal ? invoice.subtotal + ' TL' : '0 TL')} • KDV: ${invoice.tax_total_str || (invoice.tax_total ? invoice.tax_total + ' TL' : '0 TL')}${vatBreakdownStr} • İskonto: ${invoice.discount_total_str || (invoice.discount_total ? invoice.discount_total + ' TL' : '0 TL')}`;
  }

  if (mathBox) {
    if (val.is_duplicate) {
      mathBox.style.background = 'rgba(239,68,68,0.18)';
      mathBox.style.borderColor = 'rgba(239,68,68,0.45)';
      if (mathIcon) mathIcon.innerText = '⚠️';
      if (mathTitle) {
        mathTitle.style.color = '#f87171';
        mathTitle.innerText = 'Mükerrer Fatura Kaydı!';
      }
      if (mathDesc) {
        mathDesc.innerText = val.duplicate_message || 'Bu fatura daha önce sisteme kaydedilmiş.';
      }
    } else if (val.is_valid) {
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
  const zamItems = items.filter(it => it.price_change_status === 'ZAM' || (it.price_change_label && it.price_change_label.includes('Zam')));

  // Fatura başlığındaki Zam Butonu Container Kontrolü
  let zamBtnEl = document.getElementById('btn-inv-print-zam-labels');
  const actionContainer = document.getElementById('inv-header-actions-area') || countBadge?.parentElement;
  
  if (zamItems.length > 0) {
    if (!zamBtnEl && actionContainer) {
      zamBtnEl = document.createElement('button');
      zamBtnEl.id = 'btn-inv-print-zam-labels';
      zamBtnEl.type = 'button';
      zamBtnEl.onclick = pushInvoicePriceIncreaseToLabelQueue;
      zamBtnEl.style.cssText = 'background: linear-gradient(135deg, #d97706, #b45309); color: #fff; border: 1px solid #f59e0b; border-radius: 6px; padding: 5px 11px; font-size: 11px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 2px 8px rgba(217,119,6,0.35); margin-left: 8px;';
      actionContainer.appendChild(zamBtnEl);
    }
    if (zamBtnEl) {
      zamBtnEl.style.display = 'inline-flex';
      zamBtnEl.innerHTML = `🏷️ Zamlı Ürünlerin Etiketini Bas (${zamItems.length})`;
    }
  } else if (zamBtnEl) {
    zamBtnEl.style.display = 'none';
  }

  if (countBadge) countBadge.innerText = `${items.length} Kalem`;

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #94a3b8; padding: 20px;">Faturada ayrıştırılmış kalem bulunamadı.</td></tr>`;
    return;
  }

  items.forEach((it, idx) => {
    const isMatched = it.matched || it.is_matched;
    const matchType = it.match_type || '';
    
    let matchStatusHtml = '';
    if (matchType === 'SUPPLIER_MEMORY') {
      matchStatusHtml = `<span style="background: rgba(168,85,247,0.15); color: #c084fc; border: 1px solid rgba(168,85,247,0.3); padding: 2px 6px; border-radius: 4px; font-weight: 800; font-size: 10px;">🧠 Hafızadan</span>`;
    } else if (isMatched) {
      matchStatusHtml = `<span style="background: rgba(16,185,129,0.15); color: #34d399; border: 1px solid rgba(16,185,129,0.3); padding: 2px 6px; border-radius: 4px; font-weight: 800; font-size: 10px;">✓ Eşleşti</span>`;
    } else {
      matchStatusHtml = `<span style="background: rgba(245,158,11,0.15); color: #fbbf24; border: 1px solid rgba(245,158,11,0.3); padding: 2px 6px; border-radius: 4px; font-weight: 800; font-size: 10px;">+ Yeni</span>`;
    }

    const mult = it.pack_multiplier || 1;
    const totalAdd = it.total_stock_to_add || it.quantity;
    const stockChangeHtml = isMatched
      ? `<span style="color: #94a3b8;">${it.current_stock || it.existing_stock || 0}</span> ➔ <strong style="color: #38bdf8;">${it.new_stock || 0}</strong>`
      : `<strong style="color: #34d399;">+${totalAdd} Adet (Yeni)</strong>`;

    // Zam / Fiyat Değişim Rozeti
    let priceBadge = '';
    if (it.price_change_label) {
      priceBadge = `<span style="display: inline-block; margin-top: 3px; font-size: 10px; font-weight: 800; padding: 1px 5px; border-radius: 3px; color: ${it.price_change_color || '#38bdf8'}; background: rgba(255,255,255,0.06); border: 1px solid ${it.price_change_color || '#38bdf8'}33;">${it.price_change_label}</span>`;
    }

    // Kâr Marjı Rozeti
    let marginBadge = `<span style="color: #64748b;">-</span>`;
    const cost = parseFloat(it.unit_cost_single || it.net_unit_cost || 0);
    const sale = parseFloat(String(it.current_sale_price || it.shelf_sale_price || '0').replace('TL','').replace(',','.').trim());
    if (cost > 0 && sale > cost) {
      const margin = Math.round(((sale - cost) / sale) * 100);
      marginBadge = `<span style="background: rgba(56,189,248,0.15); color: #38bdf8; border: 1px solid rgba(56,189,248,0.3); padding: 2px 5px; border-radius: 4px; font-weight: 800; font-size: 10px;">%${margin} Kâr</span>`;
    }

    const tr = document.createElement('tr');
    tr.className = 'inv-table-row';
    tr.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)';

    tr.innerHTML = `
      <td style="padding: 7px 5px;">${matchStatusHtml}</td>
      <td style="padding: 7px 5px; font-family: monospace; color: #cbd5e1; font-weight: 700;">${it.catalog_barcode || it.barcode || '-'}</td>
      <td style="padding: 7px 5px; font-weight: 700; color: #f8fafc;">
        ${it.title || '-'}
        ${isMatched && it.catalog_title && it.catalog_title !== it.title ? `<div style="font-size: 10px; color: #94a3b8;">Katalog: ${it.catalog_title}</div>` : ''}
        ${priceBadge}
      </td>
      <td style="padding: 7px 5px; text-align: center; font-weight: 800; color: #38bdf8;">
        ${it.quantity} ${it.unit || 'Adet'}
        ${mult > 1 ? `<div style="font-size: 9px; color: #a855f7; font-weight: 700;">(x${mult} Koli İçi)</div>` : ''}
      </td>
      <td style="padding: 7px 5px; text-align: center;">${stockChangeHtml}</td>
      <td style="padding: 7px 5px; text-align: right; font-weight: 800; color: #fbbf24;">
        ${it.unit_cost_single_str || it.net_unit_cost_str || it.net_unit_cost + ' TL'}
        ${mult > 1 ? `<div style="font-size: 9px; color: #94a3b8;">(Koli: ${it.net_unit_cost_str})</div>` : ''}
      </td>
      <td style="padding: 7px 5px; text-align: right; color: #34d399; font-weight: 800;">${it.current_sale_price_str || it.shelf_sale_price_str || it.shelf_sale_price || '-'}</td>
      <td style="padding: 7px 5px; text-align: center;">${marginBadge}</td>
      <td style="padding: 7px 5px; text-align: right; font-weight: 800; color: #f8fafc; font-family: monospace;">${it.line_total_str || it.line_total + ' TL'}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Zam Gelen Ürünleri Raf Etiketi Basım Kuyruğuna Ekle
function pushInvoicePriceIncreaseToLabelQueue() {
  if (!currentLoadedInvoice || !currentLoadedInvoice.items) return;
  
  const zamItems = currentLoadedInvoice.items.filter(it => it.price_change_status === 'ZAM' || (it.price_change_label && it.price_change_label.includes('Zam')));
  if (zamItems.length === 0) {
    if (typeof showToast === 'function') showToast('Bu faturada zamlanan ürün bulunmuyor.', 'info');
    return;
  }

  let addedCount = 0;
  zamItems.forEach(it => {
    const prod = {
      id: it.catalog_id || `prod-inv-${Date.now()}-${Math.random()}`,
      barcode: it.catalog_barcode || it.barcode || '8690000000000',
      title: it.catalog_title || it.title,
      price: it.current_sale_price_str || it.shelf_sale_price_str || it.net_unit_cost_str,
      buying_price: it.unit_cost_single_str || it.net_unit_cost_str,
      origin: 'TR',
      unit: it.unit || 'Adet',
      company: currentLoadedInvoice.supplier_name || 'Toptancı'
    };

    if (typeof addProductToBatchQueue === 'function') {
      addProductToBatchQueue(prod, 1);
      addedCount++;
    } else if (window.batchQueue && Array.isArray(window.batchQueue)) {
      window.batchQueue.push(prod);
      addedCount++;
    }
  });

  if (typeof showToast === 'function') {
    showToast(`🏷️ ${zamItems.length} adet zamlı ürün raf etiketi kuyruğuna eklendi!`, 'success');
  } else if (typeof notifyInvoiceToast === 'function') {
    notifyInvoiceToast(`🏷️ ${zamItems.length} adet zamlı ürün raf etiketi kuyruğuna eklendi!`, 'success');
  }
}

// 7. Şirket Arşivini Getirme ve Sol Panelde Listeleme
async function loadInvoiceArchiveHistory() {
  try {
    const res = await fetch('/api/invoice/archived');
    const data = await res.json();

    if (data.status === 'success' && data.archives) {
      archivedInvoiceData = data.archives || [];
      renderInvoiceCompaniesLeftPanel(archivedInvoiceData);
      
      // Eğer ekranda açık fatura yoksa en güncel faturayı otomatik aç
      if (!currentLoadedInvoice && archivedInvoiceData.length > 0) {
        currentLoadedInvoice = archivedInvoiceData[0];
        renderInvoiceResults(currentLoadedInvoice);
      }
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
  
  // Şirketleri ve faturaları günümüzden geçmişe doğru sırala (En yeni tarih en üstte)
  companies.forEach(c => {
    c.invoices.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    
    // Son kesim tarihini bul
    let maxDate = '-';
    c.invoices.forEach(inv => {
      if (inv.date && (maxDate === '-' || inv.date > maxDate)) maxDate = inv.date;
    });
    c.latestDate = maxDate;
  });

  // Firmaları en son gelen faturaya göre günümüzden geçmişe sırala
  companies.sort((a, b) => (b.latestDate || '').localeCompare(a.latestDate || ''));
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
      <div class="inv-company-card" onclick="selectCompanyForDetail(${cIdx})" style="background: linear-gradient(145deg, #111b33 0%, #0d1527 100%); border: 1px solid rgba(56,189,248,0.22); border-radius: 10px; margin-bottom: 7px; flex-shrink: 0; width: 100%; box-sizing: border-box; transition: all 0.2s ease; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.25);">
        
        <div class="inv-company-header" style="padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px; user-select: none; box-sizing: border-box;">
          
          <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;">
            <div style="width: 38px; height: 38px; border-radius: 9px; background: linear-gradient(135deg, #0284c7, #0369a1); display: flex; align-items: center; justify-content: center; font-weight: 900; color: #fff; font-size: 15px; flex-shrink: 0; box-shadow: 0 2px 8px rgba(2,132,199,0.35);">
              ${firstChar.toUpperCase()}
            </div>
            
            <div style="min-width: 0; flex: 1;">
              <div style="color: #f8fafc; font-size: 12.5px; font-weight: 800; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word;" title="${c.name}">
                ${c.name}
              </div>
              <div style="display: flex; align-items: center; gap: 6px; margin-top: 3px; font-size: 11px; flex-wrap: wrap;">
                <span style="color: #94a3b8;">Son: <strong style="color: #38bdf8;">${c.latestDate}</strong></span>
                ${amountStr ? `<span style="color: #34d399; font-weight: 800; font-family: monospace;">• ${amountStr}</span>` : ''}
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
            <span style="font-size: 10.5px; background: rgba(56,189,248,0.15); color: #38bdf8; border: 1px solid rgba(56,189,248,0.35); padding: 3px 7px; border-radius: 6px; font-weight: 800; white-space: nowrap;">
              ${c.invoices.length} Fatura
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
      ${c.invoices.map((inv, iIdx) => `
        <div class="inv-sub-invoice-item" onclick="openInvoiceDirectly(${cIdx}, ${iIdx})" style="padding: 12px 14px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.2s ease; background: #131b2e; border: 1px solid rgba(56,189,248,0.2); margin-bottom: 6px; flex-shrink: 0; box-sizing: border-box;">
          <div style="min-width: 0; flex: 1;">
            <div style="font-size: 13px; font-weight: 800; color: #38bdf8; font-family: monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              📄 ${inv.invoice_no || inv.saved_file_name || inv.filename || 'Fatura'}
            </div>
            <div style="font-size: 11.5px; color: #cbd5e1; margin-top: 3px;">
              📅 ${inv.date || '-'} • <span style="color: #94a3b8;">${inv.item_count || (inv.items ? inv.items.length : 1)} Kalem</span>
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

// Faturayı Doğrudan Hafızadan Aç
function openInvoiceDirectly(cIdx, iIdx) {
  const companies = window._allLoadedCompanies || [];
  const inv = companies[cIdx]?.invoices?.[iIdx];
  if (inv && inv.items && inv.items.length > 0 && inv.official_html) {
    currentLoadedInvoice = inv;
    renderInvoiceResults(inv);
    setInvoiceStudioViewMode('split');
  } else if (inv) {
    const file = inv.saved_file_name || inv.filename || `${inv.date}_${inv.invoice_no}.json`;
    loadArchivedInvoiceDetails(inv.company_folder, file);
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

  let activeId = 'all';
  if (filterType === 'THIS_MONTH') activeId = 'month';
  else if (filterType === 'XML') activeId = 'xml';
  else if (filterType === 'IMG') activeId = 'img';

  const activeBtn = document.getElementById(`chip-filter-${activeId}`);
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
    const isXml = inv.is_xml || String(inv.format || '').includes('XML') || String(inv.format || '').includes('e-Fatura') || String(inv.saved_file_name || '').endsWith('.xml');
    if (activeInvoiceFilter === 'XML' && !isXml) {
      return false;
    }
    if (activeInvoiceFilter === 'IMG' && isXml) {
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
    const data = await res.json();

    if (data.status === 'success' && data.invoice) {
      currentLoadedInvoice = data.invoice;
      renderInvoiceResults(data.invoice);
      setInvoiceStudioViewMode('split');
    } else {
      if (typeof showSystemToast === 'function') {
        showSystemToast('Fatura belgesi okunamadı.', 'error');
      }
    }
  } catch (err) {
    console.error('Fatura detay hatası:', err);
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

// =========================================================
// 13. ÖDEAL e-FATURA CANLI API ENTEGRASYONU (OTOMATİK VE KADEMELİ)
// =========================================================
async function fetchInvoicesFromOdealDirect(isSilent = false) {
  const btnSidebar = document.getElementById('btn-fetch-odeal-invoices');
  const btnCard = document.getElementById('btn-fetch-odeal-card');
  const statusText = document.getElementById('odeal-live-sync-status-text');
  
  const origSidebarHtml = btnSidebar ? btnSidebar.innerHTML : '';
  const origCardHtml = btnCard ? btnCard.innerHTML : '';
  
  if (!isSilent) {
    if (btnSidebar) {
      btnSidebar.disabled = true;
      btnSidebar.innerHTML = `⏳ Çekiliyor...`;
    }
    if (btnCard) {
      btnCard.disabled = true;
      btnCard.innerHTML = `⏳ Çekiliyor...`;
    }
    if (typeof showSystemToast === 'function') {
      showSystemToast('⚡ Ödeal portalından faturalar sorgulanıyor...', 'info');
    }
  }

  try {
    const res = await fetch('/api/invoice/odeal/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const data = await res.json();

    const nowTimeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    if (data.status === 'success') {
      const invCount = data.invoices_count || (data.invoices ? data.invoices.length : 0);
      if (statusText) {
        statusText.innerHTML = `🟢 Senkronize Edildi (${invCount} Fatura) • ${nowTimeStr}`;
      }
      
      // Arşiv listesini hemen sunucudan çek ve sol paneli güncelle
      const resArch = await fetch('/api/invoice/archived');
      const dataArch = await resArch.json();
      if (dataArch.status === 'success' && dataArch.archives) {
        archivedInvoiceData = dataArch.archives || [];
        renderInvoiceCompaniesLeftPanel(archivedInvoiceData);
      }

      // Eğer ekranda açık fatura yoksa en güncel faturayı otomatik aç
      if (!currentLoadedInvoice && archivedInvoiceData.length > 0) {
        currentLoadedInvoice = archivedInvoiceData[0];
        renderInvoiceResults(currentLoadedInvoice);
      }
      
      if (!isSilent && typeof showSystemToast === 'function') {
        const compCount = dataArch.companies ? dataArch.companies.length : 0;
        showSystemToast(`⚡ Ödeal API ile ${invCount} fatura başarıyla çekildi (${compCount} şirket listelendi)!`, 'success');
      }
    } else if (data.status === 'warning') {
      if (statusText) {
        statusText.innerHTML = `🟠 Servis Bağlantısı Bekleniyor`;
      }
      if (!isSilent && typeof showSystemToast === 'function') {
        showSystemToast(data.message, 'warning');
      }
    } else {
      if (statusText) {
        statusText.innerHTML = `ℹ️ Son Kontrol: ${nowTimeStr}`;
      }
      if (!isSilent && typeof showSystemToast === 'function') {
        showSystemToast(data.message || 'Yeni fatura bulunamadı.', 'info');
      }
    }
  } catch (err) {
    console.error('Ödeal API hatası:', err);
    if (!isSilent && typeof showSystemToast === 'function') {
      showSystemToast('Ödeal sunucusuna bağlanırken hata oluştu.', 'error');
    }
  } finally {
    if (btnSidebar) {
      btnSidebar.disabled = false;
      btnSidebar.innerHTML = origSidebarHtml;
    }
    if (btnCard) {
      btnCard.disabled = false;
      btnCard.innerHTML = origCardHtml;
    }
  }
}

async function openOdealApiConfigModal() {
  const m = document.getElementById('modal-odeal-api-config');
  if (m) m.style.display = 'flex';

  try {
    const res = await fetch('/api/invoice/odeal/config');
    const data = await res.json();
    if (data.status === 'success' && data.config) {
      const c = data.config;
      const keyEl = document.getElementById('odeal-cfg-key');
      const vknEl = document.getElementById('odeal-cfg-vkn');
      const urlEl = document.getElementById('odeal-cfg-url');
      const userEl = document.getElementById('odeal-cfg-user');
      const passEl = document.getElementById('odeal-cfg-pass');

      if (keyEl && c.api_key !== undefined) keyEl.value = c.api_key || '';
      if (vknEl && c.vkn !== undefined) vknEl.value = c.vkn || '52345033274';
      if (urlEl && c.portal_url !== undefined) urlEl.value = c.portal_url || 'https://fatura.odeal.com';
      if (userEl && c.api_username !== undefined) userEl.value = c.api_username || '';
      if (passEl && c.api_password !== undefined) passEl.value = c.api_password || '';
    }
  } catch (e) {
    console.error('Ödeal config okunamadı:', e);
  }
}

function closeOdealApiConfigModal() {
  const m = document.getElementById('modal-odeal-api-config');
  if (m) m.style.display = 'none';
}

function notifyInvoiceToast(msg, type = 'info') {
  if (typeof showToast === 'function') {
    showToast(msg, type);
  } else if (typeof showSystemToast === 'function') {
    showSystemToast(msg, type);
  }
}

async function testOdealApiConnection() {
  const btn = document.getElementById('btn-test-odeal-conn');
  const resultBox = document.getElementById('odeal-test-result-box');
  const key = document.getElementById('odeal-cfg-key')?.value || '';
  const user = document.getElementById('odeal-cfg-user')?.value || '';
  const pass = document.getElementById('odeal-cfg-pass')?.value || '';
  const url = document.getElementById('odeal-cfg-url')?.value || '';
  const vkn = document.getElementById('odeal-cfg-vkn')?.value || '';

  const origBtnText = btn ? btn.innerHTML : '🔌 Bağlantıyı Test Et';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '⏳ Test Ediliyor...';
  }

  if (resultBox) {
    resultBox.style.display = 'block';
    resultBox.style.background = 'rgba(56,189,248,0.12)';
    resultBox.style.border = '1px solid rgba(56,189,248,0.35)';
    resultBox.style.color = '#38bdf8';
    resultBox.innerHTML = '⏳ Ödeal sunucusuna bağlanılıyor, kimlik bilgileri doğrulanıyor...';
  }

  notifyInvoiceToast('🔌 Ödeal API bağlantısı test ediliyor...', 'info');

  try {
    const res = await fetch('/api/invoice/odeal/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: key, api_username: user, api_password: pass, portal_url: url, vkn: vkn })
    });
    const data = await res.json();

    if (data.status === 'success') {
      if (resultBox) {
        resultBox.style.display = 'block';
        resultBox.style.background = 'rgba(16,185,129,0.15)';
        resultBox.style.border = '1px solid rgba(16,185,129,0.4)';
        resultBox.style.color = '#34d399';
        resultBox.innerHTML = `✅ <strong>Bağlantı Başarılı!</strong><br>${data.message}`;
      }
      notifyInvoiceToast(`✅ ${data.message}`, 'success');
    } else if (data.status === 'warning') {
      if (resultBox) {
        resultBox.style.display = 'block';
        resultBox.style.background = 'rgba(245,158,11,0.15)';
        resultBox.style.border = '1px solid rgba(245,158,11,0.4)';
        resultBox.style.color = '#fbbf24';
        resultBox.innerHTML = `⚠️ <strong>Sunucu Yanıtı:</strong><br>${data.message}`;
      }
      notifyInvoiceToast(`⚠️ ${data.message}`, 'warning');
    } else {
      if (resultBox) {
        resultBox.style.display = 'block';
        resultBox.style.background = 'rgba(239,68,68,0.15)';
        resultBox.style.border = '1px solid rgba(239,68,68,0.4)';
        resultBox.style.color = '#f87171';
        resultBox.innerHTML = `❌ <strong>Bağlantı Hatası:</strong><br>${data.message}`;
      }
      notifyInvoiceToast(`❌ ${data.message}`, 'error');
    }
  } catch (e) {
    if (resultBox) {
      resultBox.style.display = 'block';
      resultBox.style.background = 'rgba(239,68,68,0.15)';
      resultBox.style.border = '1px solid rgba(239,68,68,0.4)';
      resultBox.style.color = '#f87171';
      resultBox.innerHTML = `❌ <strong>Sunucuya Erişilemedi:</strong> ${e.message || 'Ağ hatası'}`;
    }
    notifyInvoiceToast('Bağlantı testi sırasında hata oluştu.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origBtnText;
    }
  }
}

async function saveOdealApiConfigFromModal() {
  const key = document.getElementById('odeal-cfg-key')?.value || '';
  const url = document.getElementById('odeal-cfg-url')?.value || '';
  const user = document.getElementById('odeal-cfg-user')?.value || '';
  const pass = document.getElementById('odeal-cfg-pass')?.value || '';
  const vkn = document.getElementById('odeal-cfg-vkn')?.value || '';

  try {
    const res = await fetch('/api/invoice/odeal/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: key, portal_url: url, api_username: user, api_password: pass, vkn: vkn })
    });
    const data = await res.json();
    if (data.status === 'success') {
      notifyInvoiceToast('✅ Ödeal API Key ve ayarları başarıyla kaydedildi.', 'success');
      closeOdealApiConfigModal();
      // Kayıttan sonra faturaları otomatik çekmeyi tetikle
      fetchInvoicesFromOdealDirect(false);
    }
  } catch (e) {
    notifyInvoiceToast('Ayarlar kaydedilemedi.', 'error');
  }
}

function printOfficialInvoicePreview() {
  const iframe = document.getElementById('inv-doc-iframe');
  if (iframe && iframe.contentWindow) {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  } else if (currentLoadedInvoice && currentLoadedInvoice.file_url) {
    window.open(currentLoadedInvoice.file_url, '_blank');
  }
}

// Window Exports
window.fetchInvoicesFromOdealDirect = fetchInvoicesFromOdealDirect;
window.openOdealApiConfigModal = openOdealApiConfigModal;
window.closeOdealApiConfigModal = closeOdealApiConfigModal;
window.testOdealApiConnection = testOdealApiConnection;
window.saveOdealApiConfigFromModal = saveOdealApiConfigFromModal;
window.printOfficialInvoicePreview = printOfficialInvoicePreview;
window.setInvoiceStudioViewMode = setInvoiceStudioViewMode;
window.openInvoiceDirectly = openInvoiceDirectly;
window.selectCompanyForDetail = selectCompanyForDetail;
window.backToAllCompaniesList = backToAllCompaniesList;




