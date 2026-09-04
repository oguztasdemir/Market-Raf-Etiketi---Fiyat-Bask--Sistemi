// -*- coding: utf-8 -*-
/**
 * KATALOG TOPLU MARKA & ÖZEL BARKOD YÖNETİMİ (katalog_ozel_islemler.js)
 */

// ==========================================
// TOPLU MARKA / FİRMA DEĞİŞTİRME FONKSİYONLARI
// ==========================================

function openBatchBrandModal() {
  if (selectedBarcodes.size === 0) {
    showToast("Lütfen önce tablodan ürün seçin.", "warning");
    return;
  }

  const badgeEl = document.getElementById('batch-brand-selected-badge');
  if (badgeEl) badgeEl.innerText = `${selectedBarcodes.size} Ürün Seçildi`;
  
  const inp = document.getElementById('batch-new-brand-inp');
  if (inp) inp.value = "";

  const modal = document.getElementById('modal-catalog-batch-brand');
  if (modal) modal.style.display = 'flex';
}

function closeBatchBrandModal() {
  const modal = document.getElementById('modal-catalog-batch-brand');
  if (modal) modal.style.display = 'none';
}

async function submitBatchBrandUpdate() {
  const newBrand = document.getElementById('batch-new-brand-inp')?.value.trim().toUpperCase();
  if (!newBrand) {
    showToast("Lütfen yeni bir marka / firma adı girin.", "warning");
    return;
  }

  const barcodes = Array.from(selectedBarcodes);
  try {
    const res = await fetch(`${API_BASE}/api/catalog/batch-brand-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barcodes: barcodes,
        brand: newBrand
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      allCatalogProducts.forEach(p => {
        if (selectedBarcodes.has(p.barcode)) {
          p.brand = newBrand;
        }
      });
      buildBrandDropdownOptions();
      onCatalogFilterChange();
      closeBatchBrandModal();
      showToast(`✓ ${data.message}`, "success");
    } else {
      showToast(`Hata: ${data.message}`, "error");
    }
  } catch (err) {
    showToast(`Bağlantı hatası: ${err.message}`, "error");
  }
}



function toggleSelectAllCatalog(checked) {
  if (checked) {
    filteredCatalogProducts.forEach(p => {
      if (p.barcode) selectedBarcodes.add(p.barcode);
    });
    baseSelection = new Set(selectedBarcodes);
  } else {
    selectedBarcodes.clear();
    baseSelection.clear();
  }
  anchorIndex = -1;
  updateBatchActionBar();
  updateRowSelections();
}


function clearCatalogSelection() {
  selectedBarcodes.clear();
  baseSelection.clear();
  anchorIndex = -1;
  const selectAllChk = document.getElementById('catalog-select-all-chk');
  if (selectAllChk) {
    selectAllChk.checked = false;
    selectAllChk.indeterminate = false;
  }
  updateBatchActionBar();
  updateRowSelections();
}


function updateBatchActionBar() {
  const bar = document.getElementById('catalog-batch-bar');
  const countEl = document.getElementById('batch-selected-count');
  const btnPrint = document.getElementById('btn-batch-print');
  const selectAllChk = document.getElementById('catalog-select-all-chk');

  const count = selectedBarcodes.size;

  if (bar) {
    if (count > 0) {
      bar.style.display = 'flex';
      if (countEl) countEl.innerText = `${count} ürün seçildi`;
      if (btnPrint) btnPrint.innerText = `🖨️ Seçili ${count} Ürünü Toplu Yazdır`;
    } else {
      bar.style.display = 'none';
    }
  }

  const selectAllBox = document.getElementById('catalog-select-all-box');
  if (selectAllBox) {
    if (filteredCatalogProducts.length > 0 && count >= filteredCatalogProducts.length) {
      selectAllBox.className = 'custom-select-square active-checked';
      selectAllBox.innerText = '✓';
    } else if (count > 0) {
      selectAllBox.className = 'custom-select-square indeterminate-checked';
      selectAllBox.innerText = '—';
    } else {
      selectAllBox.className = 'custom-select-square';
      selectAllBox.innerText = '';
    }
  }
}


function toggleSelectAllCatalogCustom(event) {
  if (event) event.stopPropagation();
  const allSelected = (filteredCatalogProducts.length > 0 && selectedBarcodes.size >= filteredCatalogProducts.length);
  toggleSelectAllCatalog(!allSelected);
}


function updateRowSelections() {
  const tbody = document.getElementById('catalog-tbody');
  if (!tbody) return;

  const rows = tbody.querySelectorAll('tr[data-barcode]');
  rows.forEach(tr => {
    const barcode = String(tr.getAttribute('data-barcode') || '').trim();
    const isSelected = selectedBarcodes.has(barcode);

    if (isSelected) {
      tr.classList.add('selected-row');
      tr.style.backgroundColor = 'rgba(2, 132, 199, 0.28)';
      tr.style.outline = '1.5px solid #38bdf8';
    } else {
      tr.classList.remove('selected-row');
      tr.style.backgroundColor = '';
      tr.style.outline = '';
    }
  });
}


function renderCatalogTable(reset = true) {
  const tbody = document.getElementById('catalog-tbody');
  const statsBadge = document.getElementById('catalog-stats-badge');
  const pageInfo = document.getElementById('catalog-page-info');

  if (!tbody) return;

  const total = filteredCatalogProducts.length;
  if (statsBadge) statsBadge.innerText = `${total.toLocaleString('tr-TR')} Ürün`;

  const itemsToRender = filteredCatalogProducts.slice(0, catalogRenderedCount);

  if (pageInfo) {
    pageInfo.innerText = total > 0 
      ? `Toplam ${total.toLocaleString('tr-TR')} ürün listeleniyor (İlk ${itemsToRender.length.toLocaleString('tr-TR')} gösteriliyor - kaydırarak devam edin)`
      : `Eşleşen ürün bulunamadı.`;
  }

  if (reset) {
    tbody.innerHTML = '';
  }

  if (itemsToRender.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align: center; padding: 40px; color: var(--text-muted);">
          🔍 Aradığınız kriterlere uygun ürün bulunamadı.
        </td>
      </tr>
    `;
    return;
  }

  const startIdx = reset ? 0 : tbody.children.length;
  const newChunk = itemsToRender.slice(startIdx);

  const fragment = document.createDocumentFragment();
  newChunk.forEach(p => {
    const tr = document.createElement('tr');
    const isSelected = selectedBarcodes.has(p.barcode);
    if (isSelected) tr.className = 'selected-row';
    tr.setAttribute('data-barcode', p.barcode);
    tr.style.cursor = 'pointer';
    tr.onclick = (e) => handleCatalogRowClick(p.barcode, e);
    tr.ondblclick = () => openCatalogProductDetailModal(p.barcode);

    const displayDate = formatCatalogDate(p);
    const isExempt = p.no_label === true;
    const isUpToDate = isLabelPriceUpToDate(p);
    const labelPriceText = p.label_price || p.price;
    
    let labelPriceBadge = '';
    let statusBadge = '';
    
    if (isExempt) {
      labelPriceBadge = `<span class="badge-label-price exempt" style="color:#64748b; font-size:10.5px; font-weight:600;" title="Etiket basımı pasif">- (Muaf)</span>`;
      statusBadge = `<button class="btn-label-status exempt" onclick="event.stopPropagation(); toggleSingleProductLabelExempt('${p.barcode}')" style="background: rgba(148,163,184,0.12); color:#94a3b8; border:1px solid rgba(148,163,184,0.3); font-size:10.5px; padding:2px 7px; border-radius:4px; font-weight:700; cursor:pointer;" title="Bu ürün etiket basımından muaftır (Tıklayarak muafiyeti kaldırabilirsiniz)">🚫 Muaf</button>`;
    } else if (isUpToDate) {
      labelPriceBadge = `<span class="badge-label-price matched">${labelPriceText}</span>`;
      statusBadge = `<span class="badge-label-status matched">✅ Güncel</span>`;
    } else {
      labelPriceBadge = `<span class="badge-label-price outdated" title="Basılan Raf Etiketi Fiyatı: ${labelPriceText}">${labelPriceText}</span>`;
      statusBadge = `<button class="btn-label-status outdated" onclick="event.stopPropagation(); syncSingleProductLabelAndPrint('${p.barcode}')" title="Fiyat güncellendi ama etiket basılmadı! Tıklayarak etiketi basın ve güncelleyin">⚠️ Güncel Değil</button>`;
    }

    // Geliş Fiyatı & Kâr Marjı Hesabı
    const buyingNum = parseFloat(String(p.buying_price || '0').replace(',', '.')) || 0;
    const saleNum = parseFloat(String(p.price || '0').replace(',', '.')) || 0;
    let marginText = '-';
    let marginColor = '#64748b';
    if (buyingNum > 0 && saleNum > 0) {
      const marginVal = (((saleNum - buyingNum) / buyingNum) * 100).toFixed(1);
      marginText = `%${marginVal}`;
      marginColor = marginVal >= 25 ? '#10b981' : marginVal > 0 ? '#f59e0b' : '#ef4444';
    }

    const stockVal = p.stock !== undefined ? p.stock : 0;
    const stockNum = parseInt(stockVal, 10) || 0;
    const stockColor = stockNum > 0 ? '#38bdf8' : '#64748b';
    const buyingPriceDisp = buyingNum > 0 ? (p.buying_price + ' TL') : '-';

    const isSpecial = p.is_special === true || p.special_category === true;
    const specialStar = isSpecial 
      ? `<span title="⭐ Özel Kategori Ürünü (Kaldırmak için tıkla)" style="cursor:pointer; color:#fbbf24; font-size:12px; margin-left:4px;" onclick="event.stopPropagation(); toggleSingleProductSpecialCategory('${p.barcode}')">⭐</span>` 
      : `<span title="Özel Kategoriye Ekle" style="cursor:pointer; color:#475569; font-size:11px; margin-left:4px; opacity:0.35;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.35" onclick="event.stopPropagation(); toggleSingleProductSpecialCategory('${p.barcode}')">☆</span>`;

    const customBarcodeVal = (p.custom_barcode || p.ozel_barkod || '').toString().trim();
    const customBarcodeBadge = customBarcodeVal 
      ? `<span class="badge-custom-barcode" style="background: rgba(168,85,247,0.15); color: #d8b4fe; border: 1px solid rgba(168,85,247,0.35); font-family: monospace; font-size: 10.5px; font-weight: 800; padding: 2px 6px; border-radius: 4px;" title="Özel Kısayol Barkodu: ${customBarcodeVal}">${customBarcodeVal}</span>` 
      : `<span style="color: #475569; font-size: 11px;">-</span>`;

    tr.innerHTML = `
      <td>
        <div style="display:flex; align-items:center; gap:2px;">
          <span class="badge-brand" style="max-width: 70px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block; font-size: 10.5px; padding: 2px 6px;">${p.brand || 'DİĞER'}</span>
          ${specialStar}
        </div>
      </td>
      <td><span class="barcode-text" style="font-size: 11px;">${p.barcode || ''}</span></td>
      <td style="text-align: center;">${customBarcodeBadge}</td>
      <td class="catalog-item-title-cell" style="font-weight: 700; font-size: 11.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="Detayı Görüntüle ve Düzenle: ${p.title}"><span class="catalog-item-title-link">${p.title}</span></td>
      <td style="text-align: center; font-weight: 800; font-family: monospace; font-size: 11.5px; color: ${stockColor};">${stockNum}</td>
      <td style="text-align: right; font-weight: 600; font-family: monospace; font-size: 11px;" class="date-text">${buyingPriceDisp}</td>
      <td style="text-align: right;"><span class="price-text" style="font-size: 12.5px;">${p.price}</span></td>
      <td style="text-align: center;"><span style="color: ${marginColor}; font-weight: 800; font-size: 10.5px; background: rgba(148,163,184,0.12); padding: 1px 5px; border-radius: 4px;">${marginText}</span></td>
      <td style="text-align: right;">${labelPriceBadge}</td>
      <td style="text-align: center;"><span class="date-text" style="font-size: 11px;">${displayDate}</span></td>
      <td style="text-align: center;">${statusBadge}</td>
    `;
    fragment.appendChild(tr);
  });

  tbody.appendChild(fragment);
  updateBatchActionBar();
}


async function syncSingleProductLabelAndPrint(barcode) {
  const product = allCatalogProducts.find(p => p.barcode === barcode);
  if (!product) return;

  try {
    const res = await fetch(`${API_BASE}/api/catalog/sync-label-price`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode: barcode })
    });
    const data = await res.json();
    if (data.status === 'success') {
      product.label_price = product.price;
      onCatalogFilterChange();
      showToast(`✓ '${product.title}' etiket fiyatı güncellendi. Tasarımcıya alınıyor...`, "success");
      printProductFromCatalog(barcode);
    } else {
      showToast(`Hata: ${data.message}`, "error");
    }
  } catch (e) {
    showToast(`Bağlantı hatası: ${e.message}`, "error");
  }
}

async function printProductFromCatalog(barcode) {
  const product = allCatalogProducts.find(p => p.barcode === barcode);
  if (!product) return;

  if (typeof showToast === 'function') {
    showToast(`🖨️ "${product.title}" için 1 adet etiket basılıyor...`, 'info');
  }

  try {
    const res = await fetch(`${API_BASE}/api/print/custom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barcode: product.barcode,
        title: product.title,
        title1: product.title1 || product.title,
        title2: product.title2 || '',
        price: product.price,
        brand: product.brand || '',
        origin: product.origin || 'TÜRKİYE',
        copies: 1
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      if (typeof showToast === 'function') {
        showToast(`✅ "${product.title}" etiketi başarıyla yazdırıldı.`, 'success');
      }
    } else {
      if (typeof showToast === 'function') {
        showToast(`⚠️ Yazdırma hatası: ${data.message}`, 'error');
      }
    }
  } catch (err) {
    if (typeof showToast === 'function') {
      showToast(`Yazıcı bağlantı hatası: ${err.message}`, 'error');
    }
  }
}


async function submitBatchPrint() {
  const count = selectedBarcodes.size;
  if (count === 0) {
    showToast("Lütfen önce tablodan yazdırılacak ürünleri seçin.", "warning");
    return;
  }

  const selectedProducts = allCatalogProducts.filter(p => selectedBarcodes.has(p.barcode));
  if (selectedProducts.length === 0) {
    showToast("Seçilen ürünler bulunamadı.", "error");
    return;
  }

  const copies = parseInt(document.getElementById('batch-copies-inp')?.value || '1') || 1;
  const btnPrint = document.getElementById('btn-batch-print');
  const origText = btnPrint ? btnPrint.innerText : '';

  if (btnPrint) {
    btnPrint.disabled = true;
    btnPrint.innerText = `⏳ Yazdırılıyor (${count} Ürün)...`;
  }

  try {
    const activeTpl = templatesList.find(t => t.id === activeTemplateId) || templatesList[0] || {};
    const payload = {
      products: selectedProducts,
      printer: selectedPrinter,
      orientation: "POR",
      width_mm: currentWidth,
      height_mm: currentHeight,
      x_offset: parseInt(document.getElementById('settings-x-offset')?.value || 0),
      y_offset: parseInt(document.getElementById('settings-y-offset')?.value || 0),
      dpi: 203,
      copies_per_item: copies,
      template: activeTpl
    };

    const res = await fetch(`${API_BASE}/api/print/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (result.status === 'success') {
      selectedProducts.forEach(p => {
        p.label_price = p.price;
      });
      onCatalogFilterChange();
      showToast(`✓ ${result.message}`, "success");
      clearCatalogSelection();
    } else {
      showToast(`❌ ${result.message}`, "error");
    }
  } catch (err) {
    showToast(`❌ Bağlantı hatası: ${err.message}`, "error");
  } finally {
    if (btnPrint) {
      btnPrint.disabled = false;
      btnPrint.innerText = origText;
    }
  }
}

// =========================================================
// 8. ÖZEL BARKOD YÖNETİMİ (MAKSİMUM 6 ADET)
// =========================================================
let cachedCustomBarcodes = [];

async function loadCustomBarcodes() {
  try {
    const res = await fetch(`${API_BASE}/api/custom_barcodes`);
    const data = await res.json();
    if (data.status === 'success') {
      cachedCustomBarcodes = data.custom_barcodes || [];
    }
  } catch (e) {
    console.error('Özel barkodlar yüklenemedi:', e);
  }
}

async function openCustomBarcodesManageModal() {
  const modal = document.getElementById('modal-custom-barcodes-manage');
  if (!modal) return;

  await loadCustomBarcodes();
  renderCustomBarcodesManageList();

  modal.classList.add('active');
  modal.style.display = 'flex';
}

function closeCustomBarcodesManageModal() {
  const modal = document.getElementById('modal-custom-barcodes-manage');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
}

function renderCustomBarcodesManageList() {
  const listContainer = document.getElementById('custom-barcodes-manage-list');
  const countBadge = document.getElementById('custom-barcodes-count-badge');
  const addFormBox = document.getElementById('custom-barcodes-add-form');
  if (!listContainer) return;

  const count = cachedCustomBarcodes.length;
  if (countBadge) {
    countBadge.innerText = `${count} / 6 Dolu`;
    countBadge.style.color = count >= 6 ? '#f87171' : '#38bdf8';
  }

  if (addFormBox) {
    addFormBox.style.display = count >= 6 ? 'none' : 'block';
  }

  if (count === 0) {
    listContainer.innerHTML = '<div style="text-align: center; color: #64748b; padding: 16px;">Henüz tanımlı özel barkod yok. Aşağıdan yeni bir tane ekleyebilirsiniz.</div>';
    return;
  }

  listContainer.innerHTML = cachedCustomBarcodes.map((item, idx) => `
    <div style="background: #0f172a; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
      <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
        <span style="background: rgba(99,102,241,0.2); color: #818cf8; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 6px;">#${idx + 1}</span>
        <div style="flex: 1;">
          <input type="text" id="cb-name-${item.id}" value="${item.name || ''}" placeholder="Barkod Adı (Örn: REYON-A)" style="width: 100%; padding: 6px 8px; background: #070d1e; border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; color: #f8fafc; font-weight: 700; font-size: 12.5px; box-sizing: border-box; margin-bottom: 4px;">
          <input type="text" id="cb-code-${item.id}" value="${item.code || ''}" placeholder="Barkod Kodu (Örn: OZEL01)" style="width: 100%; padding: 6px 8px; background: #070d1e; border: 1px solid rgba(99,102,241,0.3); border-radius: 6px; color: #38bdf8; font-family: monospace; font-weight: 800; font-size: 12px; box-sizing: border-box;">
        </div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <button type="button" onclick="saveCustomBarcodeRow('${item.id}')" style="padding: 6px 12px; font-size: 11.5px; font-weight: 800; background: linear-gradient(135deg, #10b981, #059669); color: #ffffff; border: none; border-radius: 6px; cursor: pointer;" title="Değişiklikleri Kaydet">
          💾 Kaydet
        </button>
        <button type="button" onclick="deleteCustomBarcodeItem('${item.id}')" style="padding: 6px 12px; font-size: 11.5px; font-weight: 800; background: rgba(239,68,68,0.15); color: #f87171; border: 1px solid rgba(239,68,68,0.3); border-radius: 6px; cursor: pointer;" title="Sil">
          🗑️ Sil
        </button>
      </div>
    </div>
  `).join('');
}

async function saveCustomBarcodeRow(id) {
  const nameInp = document.getElementById(`cb-name-${id}`);
  const codeInp = document.getElementById(`cb-code-${id}`);
  if (!nameInp || !codeInp) return;

  const name = nameInp.value.trim();
  const code = codeInp.value.trim();
  if (!name || !code) {
    if (typeof showToast === 'function') showToast('Özel barkod adı ve kodu boş olamaz.', 'warning');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/custom_barcodes/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name, code })
    });
    const data = await res.json();
    if (data.status === 'success') {
      if (typeof showToast === 'function') showToast(data.message, 'success');
      cachedCustomBarcodes = data.custom_barcodes || [];
      renderCustomBarcodesManageList();
    } else {
      if (typeof showToast === 'function') showToast(data.message || 'Kayıt hatası.', 'error');
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('Kayıt başarısız.', 'error');
  }
}

async function submitAddNewCustomBarcode() {
  const nameInp = document.getElementById('new-cb-name');
  const codeInp = document.getElementById('new-cb-code');
  if (!nameInp || !codeInp) return;

  const name = nameInp.value.trim();
  const code = codeInp.value.trim();
  if (!name || !code) {
    if (typeof showToast === 'function') showToast('Lütfen yeni özel barkod adı ve kodunu girin.', 'warning');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/custom_barcodes/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, code })
    });
    const data = await res.json();
    if (data.status === 'success') {
      if (typeof showToast === 'function') showToast(data.message, 'success');
      nameInp.value = '';
      codeInp.value = '';
      cachedCustomBarcodes = data.custom_barcodes || [];
      renderCustomBarcodesManageList();
    } else {
      if (typeof showToast === 'function') showToast(data.message || 'Kayıt hatası.', 'error');
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('Ekleme başarısız.', 'error');
  }
}

async function deleteCustomBarcodeItem(id) {
  const ok = await showCustomConfirm('Bu özel barkodu silmek istediğinize emin misiniz?', 'Özel Barkod Sil', 'Sil', 'Vazgeç', '🗑️');
  if (!ok) return;

  try {
    const res = await fetch(`${API_BASE}/api/custom_barcodes/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    const data = await res.json();
    if (data.status === 'success') {
      if (typeof showToast === 'function') showToast(data.message, 'info');
      cachedCustomBarcodes = data.custom_barcodes || [];
      renderCustomBarcodesManageList();
    } else {
      if (typeof showToast === 'function') showToast(data.message || 'Silme hatası.', 'error');
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('Silme başarısız.', 'error');
  }
}

async function toggleCustomBarcodeDropdown(targetInputId) {
  const dropdown = document.getElementById(`custom-barcode-dropdown-${targetInputId}`);
  if (!dropdown) return;

  if (dropdown.style.display === 'block') {
    dropdown.style.display = 'none';
    return;
  }

  // Özel barkodları tazele
  await loadCustomBarcodes();

  if (cachedCustomBarcodes.length === 0) {
    dropdown.innerHTML = `
      <div style="padding: 10px; text-align: center; font-size: 11.5px; color: #94a3b8;">
        Tanımlı özel barkod bulunamadı.<br>
        <button type="button" onclick="openCustomBarcodesManageModal()" style="margin-top: 6px; padding: 4px 10px; font-size: 11px; background: #6366f1; color: #fff; border: none; border-radius: 4px; cursor: pointer;">➕ Yeni Oluştur (Maks 6)</button>
      </div>
    `;
  } else {
    dropdown.innerHTML = `
      <div style="padding: 4px; display: flex; flex-direction: column; gap: 4px;">
        <div style="font-size: 10px; font-weight: 800; color: #94a3b8; padding: 2px 4px; text-transform: uppercase;">🏷️ Tanımlı Özel Kodlar:</div>
        ${cachedCustomBarcodes.map(cb => `
          <button type="button" onclick="selectCustomBarcodeForTarget('${targetInputId}', '${cb.code}')" style="display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; background: #1e293b; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #f8fafc; font-size: 12px; cursor: pointer; text-align: left; width: 100%;">
            <strong style="color: #cbd5e1;">${cb.name}</strong>
            <span style="color: #38bdf8; font-family: monospace; font-weight: 800;">${cb.code}</span>
          </button>
        `).join('')}
        <div style="border-top: 1px solid rgba(255,255,255,0.08); margin-top: 4px; padding-top: 4px;">
          <button type="button" onclick="openCustomBarcodesManageModal()" style="padding: 5px 8px; font-size: 11px; font-weight: 700; background: transparent; color: #818cf8; border: 1px dashed rgba(99,102,241,0.4); border-radius: 6px; cursor: pointer; width: 100%; text-align: center;">
            ⚙️ Özel Barkodları Yönet / Düzenle (Maks 6)
          </button>
        </div>
      </div>
    `;
  }

  dropdown.style.display = 'block';

  // Dışarı tıklanınca kapat
  function onDocClick(e) {
    if (!dropdown.contains(e.target) && !e.target.closest(`[onclick*="toggleCustomBarcodeDropdown('${targetInputId}')"]`)) {
      dropdown.style.display = 'none';
      document.removeEventListener('click', onDocClick);
    }
  }
  setTimeout(() => document.addEventListener('click', onDocClick), 50);
}

function selectCustomBarcodeForTarget(targetInputId, code) {
  const inp = document.getElementById(targetInputId);
  const dropdown = document.getElementById(`custom-barcode-dropdown-${targetInputId}`);
  if (dropdown) dropdown.style.display = 'none';

  if (inp) {
    inp.value = code;
    inp.dispatchEvent(new Event('input'));
    inp.focus();
  }
  if (typeof showToast === 'function') {
    showToast(`🏷️ Özel barkod uygulandı: ${code}`, 'success');
  }
}

// Global Window Dışa Aktarımları
window.resetCatalogFilters = resetCatalogFilters;
window.toggleQuickEditDropdown = toggleQuickEditDropdown;
window.setQuickActionFilter = setQuickActionFilter;
window.openCatalogProductDetailModal = openCatalogProductDetailModal;
window.closeCatalogProductDetailModal = closeCatalogProductDetailModal;
window.copyDetailBarcode = copyDetailBarcode;
window.printFromDetailModal = printFromDetailModal;
window.submitCatalogProductDetail = submitCatalogProductDetail;
window.openQuickPriceEdit = openQuickPriceEdit;
window.openQuickTitleEdit = openQuickTitleEdit;
window.openQuickBrandEdit = openQuickBrandEdit;
window.openBatchPriceModal = openBatchPriceModal;
window.closeBatchPriceModal = closeBatchPriceModal;
window.removeBatchPriceTargetItem = removeBatchPriceTargetItem;
window.onBatchPriceCommonInput = onBatchPriceCommonInput;
window.applyCommonPriceToPreview = applyCommonPriceToPreview;
window.submitBatchPriceUpdate = submitBatchPriceUpdate;
window.openBatchBrandModal = openBatchBrandModal;
window.closeBatchBrandModal = closeBatchBrandModal;
window.submitBatchBrandUpdate = submitBatchBrandUpdate;
window.handleCatalogRowClick = handleCatalogRowClick;
window.onRowCheckboxChange = onRowCheckboxChange;
window.handleCatalogSelectSquareClick = handleCatalogSelectSquareClick;
window.toggleSelectAllCatalog = toggleSelectAllCatalog;
window.sortCatalog = sortCatalogColumn;
window.sortCatalogColumn = sortCatalogColumn;
window.toggleBrandDropdown = toggleBrandDropdown;
window.onBrandSearchInput = onBrandSearchInput;
window.clearBrandSearch = clearBrandSearch;
window.selectBrandFromDropdown = selectBrandFromDropdown;
window.onCatalogFilterChange = onCatalogFilterChange;
window.syncSingleProductLabelAndPrint = syncSingleProductLabelAndPrint;
window.printProductFromCatalog = printProductFromCatalog;
window.submitBatchPrint = submitBatchPrint;

