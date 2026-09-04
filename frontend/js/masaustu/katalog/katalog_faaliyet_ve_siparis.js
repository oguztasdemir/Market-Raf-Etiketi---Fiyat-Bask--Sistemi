// -*- coding: utf-8 -*-
/**
 * KATALOG FAALİYET GEÇMİŞİ & TOPTANCI SİPARİŞİ (katalog_faaliyet_ve_siparis.js)
 */

// ==========================================
// ÜRÜN GEÇMİŞ FAALİYETLERİ & İŞLEM GÜNLÜĞÜ (TIMELINE)
// ==========================================

let currentActivityBarcode = null;
let currentActivitiesList = [];
let currentActivityFilter = 'all';

function openDetailProductActivityHistory() {
  if (currentDetailProduct && currentDetailProduct.barcode) {
    openProductActivityHistory(currentDetailProduct.barcode);
  } else {
    showToast("Ürün bilgisi bulunamadı.", "warning");
  }
}

async function openProductActivityHistory(barcode) {
  const cleanBc = String(barcode || '').trim();
  const prod = allCatalogProducts.find(p => String(p.barcode || '').trim() === cleanBc);
  currentActivityBarcode = cleanBc;

  const modal = document.getElementById('modal-product-activity-history');
  if (!modal) return;

  // Başlık ve Ürün Özet Bilgileri
  const titleEl = document.getElementById('act-history-product-title');
  if (titleEl) titleEl.innerText = prod ? (prod.title || prod.title1 || cleanBc) : cleanBc;

  const bcEl = document.getElementById('act-history-barcode');
  if (bcEl) bcEl.innerText = cleanBc;

  const priceEl = document.getElementById('act-history-price');
  if (priceEl) priceEl.innerText = prod ? (prod.price || '-') : '-';

  const labelEl = document.getElementById('act-history-label-price');
  if (labelEl) labelEl.innerText = prod ? (prod.label_price || '-') : '-';

  const stockEl = document.getElementById('act-history-stock');
  if (stockEl) stockEl.innerText = prod ? (prod.stock !== undefined ? prod.stock : '0') : '0';

  modal.style.display = 'flex';
  modal.classList.add('active');

  currentActivityFilter = 'price';
  document.querySelectorAll('#modal-product-activity-history .btn-status-pill').forEach(btn => btn.classList.remove('active'));
  const priceTab = document.getElementById('act-tab-price');
  if (priceTab) priceTab.classList.add('active');

  // Aktivite kayıtlarını yükle
  await loadProductActivities(cleanBc);
}

function closeProductActivityHistoryModal() {
  const modal = document.getElementById('modal-product-activity-history');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('active');
  }
  currentActivityBarcode = null;
}

async function loadProductActivities(barcode) {
  const container = document.getElementById('act-history-timeline-container');
  if (!container) return;

  container.innerHTML = '<div style="text-align:center; padding: 30px; color: #94a3b8;"><span style="font-size:24px; animation: spin 1s infinite linear; display:inline-block;">🔄</span><p style="margin-top:8px;">Faaliyet geçmişi yükleniyor...</p></div>';

  try {
    const res = await fetch(`${API_BASE}/api/products/${encodeURIComponent(barcode)}/activities`);
    const data = await res.json();
    if (data.status === 'success') {
      currentActivitiesList = data.activities || [];
      updateActivityFilterCounts();
      renderActivityTimeline();
    } else {
      container.innerHTML = `<div style="text-align:center; padding: 20px; color: #f87171;">Hata: ${data.message}</div>`;
    }
  } catch (err) {
    container.innerHTML = `<div style="text-align:center; padding: 20px; color: #f87171;">Bağlantı hatası: ${err.message}</div>`;
  }
}

function updateActivityFilterCounts() {
  const counts = { price: 0, sale: 0, stock: 0 };
  currentActivitiesList.forEach(a => {
    if (a.type === 'print' || a.type === 'price') counts.price++;
    else if (a.type === 'sale' || a.type === 'daily_sale') counts.sale++;
    else counts.stock++;
  });

  const cPrice = document.getElementById('act-count-price');
  if (cPrice) cPrice.innerText = counts.price;
  const cSale = document.getElementById('act-count-sale');
  if (cSale) cSale.innerText = counts.sale;
  const cStock = document.getElementById('act-count-stock');
  if (cStock) cStock.innerText = counts.stock;
}

function filterActivityTimeline(type) {
  currentActivityFilter = type || 'price';
  document.querySelectorAll('#modal-product-activity-history .btn-status-pill').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`act-tab-${currentActivityFilter}`);
  if (activeBtn) activeBtn.classList.add('active');
  renderActivityTimeline();
}

function renderActivityTimeline() {
  const container = document.getElementById('act-history-timeline-container');
  if (!container) return;

  const filtered = currentActivitiesList.filter(a => {
    if (currentActivityFilter === 'price') return a.type === 'print' || a.type === 'price';
    if (currentActivityFilter === 'sale') return a.type === 'sale' || a.type === 'daily_sale';
    return a.type !== 'print' && a.type !== 'price' && a.type !== 'sale' && a.type !== 'daily_sale';
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: #64748b;">
        <span style="font-size: 32px; display: block; margin-bottom: 8px;">📭</span>
        <p style="margin: 0; font-weight: 700; font-size: 13.5px; color: #94a3b8;">Bu kategoride henüz kayıtlı işlem bulunamadı.</p>
        <small style="color: #64748b; font-size: 11.5px;">Fiyat değişiklikleri, basılan etiketler ve gün gün satış özetleri burada listelenir.</small>
      </div>
    `;
    return;
  }

  const iconMap = {
    print: { icon: '🖨️', color: '#38bdf8', bg: 'rgba(56,189,248,0.15)', border: 'rgba(56,189,248,0.3)', badge: 'ETİKET BASIMI' },
    price: { icon: '💰', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.3)', badge: 'FİYAT DEĞİŞİMİ' },
    sale: { icon: '📅', color: '#34d399', bg: 'rgba(52,211,153,0.15)', border: 'rgba(52,211,153,0.3)', badge: 'GÜNLÜK SATIŞ' },
    daily_sale: { icon: '📅', color: '#34d399', bg: 'rgba(52,211,153,0.15)', border: 'rgba(52,211,153,0.3)', badge: 'GÜNLÜK SATIŞ' },
    stock: { icon: '📦', color: '#a855f7', bg: 'rgba(168,85,247,0.15)', border: 'rgba(168,85,247,0.3)', badge: 'STOK HAREKETİ' },
    info: { icon: '📝', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)', border: 'rgba(148,163,184,0.3)', badge: 'İŞLEM NOTU' }
  };

  let html = '';
  filtered.forEach(item => {
    const style = iconMap[item.type] || iconMap.info;
    const actorName = item.actor || 'Sistem / Kasiyer';
    html += `
      <div style="background: #111827; border: 1.5px solid ${style.border}; border-left: 4px solid ${style.color}; border-radius: 10px; padding: 12px 16px; display: flex; flex-direction: column; gap: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px;">${style.icon}</span>
            <strong style="color: #f8fafc; font-size: 13.5px; font-weight: 800;">${item.title || 'Faaliyet'}</strong>
            <span style="background: ${style.bg}; color: ${style.color}; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 4px; border: 1px solid ${style.border};">${style.badge}</span>
          </div>
          <span style="color: #94a3b8; font-size: 11.5px; font-family: monospace; font-weight: 700;">${item.timestamp || '-'}</span>
        </div>
        ${item.details ? `<div style="color: #cbd5e1; font-size: 12.5px; font-weight: 600; padding-left: 24px; line-height: 1.4;">${item.details}</div>` : ''}
        ${actorName ? `
          <div style="color: #64748b; font-size: 11.5px; padding-left: 24px; display: flex; align-items: center; gap: 6px;">
            <span>👤 İşlem Yapan:</span>
            <span style="background: rgba(56,189,248,0.12); border: 1px solid rgba(56,189,248,0.3); color: #38bdf8; font-weight: 800; padding: 2px 7px; border-radius: 4px; font-size: 11px;">
              ${actorName}
            </span>
          </div>
        ` : ''}
      </div>
    `;
  });

  container.innerHTML = html;
}

async function submitProductManualActivityNote() {
  if (!currentActivityBarcode) return;
  const noteInp = document.getElementById('act-history-new-note');
  const note = noteInp ? noteInp.value.trim() : '';
  if (!note) {
    showToast("Lütfen bir not metni girin.", "warning");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/products/${encodeURIComponent(currentActivityBarcode)}/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'info',
        title: 'Özel Kullanıcı Notu',
        details: note,
        actor: 'Yönetici'
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      noteInp.value = '';
      showToast("✓ Not faaliyete eklendi.", "success");
      await loadProductActivities(currentActivityBarcode);
    }
  } catch (err) {
    showToast("Not kaydedilemedi: " + err.message, "error");
  }
}

async function deleteCatalogProductFromDetail() {
  if (!currentDetailProduct) return;
  const barcode = currentDetailProduct.barcode;
  const title = currentDetailProduct.title || 'Bu ürün';
  
  const confirmed = confirm(`⚠️ "${title}" (${barcode}) ürününü katalogdan tamamen silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz!`);
  if (!confirmed) return;

  try {
    const res = await fetch(`${API_BASE}/api/products/${encodeURIComponent(barcode)}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (data.status === 'success') {
      showToast(`🗑️ "${title}" katalogdan silindi.`, "success");
      closeCatalogProductDetailModal();
      await loadCatalog();
    } else {
      showToast(`❌ Silme işlemi başarısız: ${data.message}`, "error");
    }
  } catch (err) {
    showToast(`❌ Silme hatası: ${err.message}`, "error");
  }
}

window.deleteCatalogProductFromDetail = deleteCatalogProductFromDetail;
window.loadCatalog = loadCatalog;
window.handleCatalogRowClick = handleCatalogRowClick;
window.openCatalogProductDetailModal = openCatalogProductDetailModal;
window.closeCatalogProductDetailModal = closeCatalogProductDetailModal;
window.submitCatalogProductDetail = submitCatalogProductDetail;
window.clearCatalogSelection = clearCatalogSelection;
window.updateBatchActionBar = updateBatchActionBar;
window.updateRowSelections = updateRowSelections;
window.toggleSelectAllCatalogCustom = toggleSelectAllCatalogCustom;
window.toggleBrandDropdown = toggleBrandDropdown;
window.onBrandSearchInput = onBrandSearchInput;
window.clearBrandSearch = clearBrandSearch;
window.selectBrandOption = selectBrandOption;
window.resetCatalogFilters = resetCatalogFilters;
window.setCatalogStatusFilter = setCatalogStatusFilter;
window.onCatalogFilterChange = onCatalogFilterChange;
window.sortCatalogColumn = sortCatalogColumn;
window.printFromDetailModal = printFromDetailModal;
window.copyDetailBarcode = copyDetailBarcode;
window.pinCurrentDetailToQuickButtons = pinCurrentDetailToQuickButtons;

window.openProductActivityHistory = openProductActivityHistory;
window.openDetailProductActivityHistory = openDetailProductActivityHistory;
window.closeProductActivityHistoryModal = closeProductActivityHistoryModal;
window.filterActivityTimeline = filterActivityTimeline;
window.submitProductManualActivityNote = submitProductManualActivityNote;
window.loadProductActivities = loadProductActivities;

window.renderDetailBarcodesList = renderDetailBarcodesList;
window.addBarcodeToCurrentDetailProduct = addBarcodeToCurrentDetailProduct;
window.removeBarcodeFromCurrentDetailProduct = removeBarcodeFromCurrentDetailProduct;
window.loadCustomBarcodes = loadCustomBarcodes;
window.openCustomBarcodesManageModal = openCustomBarcodesManageModal;
window.closeCustomBarcodesManageModal = closeCustomBarcodesManageModal;
window.renderCustomBarcodesManageList = renderCustomBarcodesManageList;
window.saveCustomBarcodeRow = saveCustomBarcodeRow;
window.submitAddNewCustomBarcode = submitAddNewCustomBarcode;
window.deleteCustomBarcodeItem = deleteCustomBarcodeItem;
window.toggleDetailQuickBtnFields = toggleDetailQuickBtnFields;
window.onDetailNoLabelToggle = onDetailNoLabelToggle;

async function toggleSingleProductLabelExempt(barcode) {
  const prod = allCatalogProducts.find(p => p.barcode === barcode);
  if (!prod) return;
  const newStatus = !prod.no_label;
  
  try {
    const res = await fetch(`${API_BASE}/api/catalog/batch-label-exempt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barcodes: [barcode],
        exempt: newStatus
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      prod.no_label = newStatus;
      if (newStatus) {
        prod.label_price = prod.price;
      }
      onCatalogFilterChange();
      showToast(newStatus ? `✓ '${prod.title}' etiket muafiyetine alındı.` : `✓ '${prod.title}' etiket muafiyeti kaldırıldı.`, "success");
    } else {
      showToast(`Hata: ${data.message}`, "error");
    }
  } catch (err) {
    showToast(`Bağlantı hatası: ${err.message}`, "error");
  }
}

async function submitBatchLabelExemptToggle() {
  if (selectedBarcodes.size === 0) {
    showToast("Lütfen önce tablodan ürün seçin.", "warning");
    return;
  }

  const selectedList = allCatalogProducts.filter(p => selectedBarcodes.has(p.barcode));
  if (selectedList.length === 0) return;

  const hasUnexempt = selectedList.some(p => !p.no_label);
  const targetExempt = hasUnexempt;

  const actionText = targetExempt ? "Etiket Muaf Yapılsın" : "Muafiyet Kaldırılsın";
  const confirmed = await showCustomConfirm(
    `Seçili ${selectedList.length} ürün için etiket basım muafiyeti ayarlanacak:\n\nDurum: ${targetExempt ? "🚫 ETİKET MUAF (Basılmayacak)" : "🖨️ ETİKET AKTİF (Basılacak)"}`,
    `🚫 Toplu Etiket Muafiyeti (${selectedList.length} Ürün)`,
    actionText,
    "İptal"
  );
  if (!confirmed) return;

  const barcodes = selectedList.map(p => p.barcode);

  try {
    const res = await fetch(`${API_BASE}/api/catalog/batch-label-exempt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barcodes: barcodes,
        exempt: targetExempt
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      selectedList.forEach(p => {
        p.no_label = targetExempt;
        if (targetExempt) {
          p.label_price = p.price;
        }
      });
      onCatalogFilterChange();
      showToast(`✓ ${selectedList.length} ürün ${targetExempt ? 'etiket muafiyetine alındı' : 'etiket basımına açıldı'}.`, "success");
    } else {
      showToast(`Hata: ${data.message}`, "error");
    }
  } catch (err) {
    showToast(`Bağlantı hatası: ${err.message}`, "error");
  }
}

window.toggleSingleProductLabelExempt = toggleSingleProductLabelExempt;
window.submitBatchLabelExemptToggle = submitBatchLabelExemptToggle;

function updateDetailSpecialCatButtonUI(isSpecial) {
  const btn = document.getElementById('btn-detail-toggle-special-cat');
  if (!btn) return;
  if (isSpecial) {
    btn.style.background = 'rgba(168,85,247,0.22)';
    btn.style.border = '1.5px solid #a855f7';
    btn.style.color = '#d8b4fe';
    btn.innerHTML = `<span>⭐</span> Özel Kategoride Ekli (Çıkar)`;
  } else {
    btn.style.background = '#1e293b';
    btn.style.border = '1.5px solid #475569';
    btn.style.color = '#cbd5e1';
    btn.innerHTML = `<span>➕</span> Özel Kategoriye Ekle`;
  }
}

async function toggleDetailProductSpecialCategory() {
  if (!currentDetailProduct) return;
  openSpecialCategoryPickerModal();
}

async function openSpecialCategoryPickerModal() {
  if (!currentDetailProduct) return;
  const modal = document.getElementById('modal-special-cat-picker');
  if (!modal) return;

  const titleEl = document.getElementById('special-picker-prod-title');
  if (titleEl) {
    titleEl.innerText = `Ürün: ${currentDetailProduct.title || currentDetailProduct.title1 || currentDetailProduct.barcode}`;
  }

  // Tanımlı Özel Barkodları Yükle ve Listele
  await loadCustomBarcodes();
  const customSection = document.getElementById('special-picker-custom-barcodes-section');
  const customList = document.getElementById('special-picker-custom-list');

  if (cachedCustomBarcodes && cachedCustomBarcodes.length > 0) {
    if (customSection) customSection.style.display = 'block';
    if (customList) {
      customList.innerHTML = cachedCustomBarcodes.map(cb => `
        <button type="button" onclick="assignProductToSpecialCategory('${cb.code}', '${cb.code}', '${cb.name}')" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #1e293b; border: 1px solid rgba(168,85,247,0.3); border-radius: 8px; color: #f8fafc; cursor: pointer; text-align: left; transition: all 0.15s;" onmouseover="this.style.borderColor='#a855f7'; this.style.background='rgba(168,85,247,0.12)';" onmouseout="this.style.borderColor='rgba(168,85,247,0.3)'; this.style.background='#1e293b';">
          <div>
            <strong style="color: #d8b4fe; font-size: 12px;">🏷️ ${cb.name}</strong>
            <div style="color: #94a3b8; font-size: 10px;">Özel Kısayol Grubu</div>
          </div>
          <span style="color: #38bdf8; font-family: monospace; font-size: 11px; font-weight: 800; background: #0f172a; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.06);">${cb.code}</span>
        </button>
      `).join('');
    }
  } else {
    if (customSection) customSection.style.display = 'none';
  }

  modal.style.display = 'flex';
}

function closeSpecialCategoryPickerModal() {
  const modal = document.getElementById('modal-special-cat-picker');
  if (modal) modal.style.display = 'none';
}

async function assignProductToSpecialCategory(categoryKey, categoryCode, categoryName = '') {
  if (!currentDetailProduct) return;
  const barcode = currentDetailProduct.barcode;
  const title = currentDetailProduct.title || currentDetailProduct.title1 || barcode;

  try {
    const res = await fetch(`${API_BASE}/api/catalog/batch-special-category`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barcodes: [barcode],
        is_special: true,
        category: categoryKey,
        custom_barcode: categoryCode,
        custom_barcode_name: categoryName || categoryKey
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      currentDetailProduct.is_special = true;
      currentDetailProduct.special_category = true;
      currentDetailProduct.custom_barcode = categoryCode;
      currentDetailProduct.custom_barcode_name = categoryName || categoryKey;

      const isSpecialInp = document.getElementById('cat-detail-inp-is-special');
      if (isSpecialInp) isSpecialInp.value = 'true';
      updateDetailSpecialCatButtonUI(true);

      closeSpecialCategoryPickerModal();
      onCatalogFilterChange();
      showToast(`✓ '${title}' başarıyla '${categoryName || categoryKey.toUpperCase()}' kategorisine eklendi.`, "success");
    } else {
      showToast(`Hata: ${data.message}`, "error");
    }
  } catch (err) {
    showToast(`Bağlantı hatası: ${err.message}`, "error");
  }
}

async function removeProductFromSpecialCategory() {
  if (!currentDetailProduct) return;
  const barcode = currentDetailProduct.barcode;
  const title = currentDetailProduct.title || currentDetailProduct.title1 || barcode;

  try {
    const res = await fetch(`${API_BASE}/api/catalog/batch-special-category`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barcodes: [barcode],
        is_special: false
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      currentDetailProduct.is_special = false;
      currentDetailProduct.special_category = false;
      currentDetailProduct.custom_barcode = null;
      currentDetailProduct.custom_barcode_name = null;

      const isSpecialInp = document.getElementById('cat-detail-inp-is-special');
      if (isSpecialInp) isSpecialInp.value = 'false';
      updateDetailSpecialCatButtonUI(false);

      closeSpecialCategoryPickerModal();
      onCatalogFilterChange();
      showToast(`✓ '${title}' Özel Kategoriden çıkarıldı.`, "info");
    } else {
      showToast(`Hata: ${data.message}`, "error");
    }
  } catch (err) {
    showToast(`Bağlantı hatası: ${err.message}`, "error");
  }
}

async function submitCreateAndAssignSpecialCategory() {
  if (!currentDetailProduct) return;
  const nameInp = document.getElementById('special-picker-new-name');
  const codeInp = document.getElementById('special-picker-new-code');
  const name = (nameInp?.value || '').trim();
  const code = (codeInp?.value || '').trim().toUpperCase();

  if (!name || !code) {
    showToast("Lütfen yeni kategori adı ve kodunu girin.", "warning");
    return;
  }

  try {
    // 1. Önce Yeni Özel Barkodu Kaydet
    const saveRes = await fetch(`${API_BASE}/api/custom_barcodes/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, code })
    });
    const saveData = await saveRes.json();
    if (saveData.status !== 'success') {
      showToast(saveData.message || "Özel barkod oluşturulamadı.", "error");
      return;
    }

    // 2. Ürünü bu yeni alana ata
    await assignProductToSpecialCategory(code, code, name);
    if (nameInp) nameInp.value = '';
    if (codeInp) codeInp.value = '';
  } catch (err) {
    showToast("İşlem başarısız: " + err.message, "error");
  }
}

async function toggleSingleProductSpecialCategory(barcode) {
  const prod = allCatalogProducts.find(p => p.barcode === barcode);
  if (!prod) return;
  const newVal = !(prod.is_special === true || prod.special_category === true);

  try {
    const res = await fetch(`${API_BASE}/api/catalog/batch-special-category`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barcodes: [barcode],
        is_special: newVal
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      prod.is_special = newVal;
      prod.special_category = newVal;
      onCatalogFilterChange();
      showToast(newVal ? `✓ '${prod.title}' Özel Kategoriye eklendi.` : `✓ '${prod.title}' Özel Kategoriden çıkarıldı.`, "success");
    } else {
      showToast(`Hata: ${data.message}`, "error");
    }
  } catch (err) {
    showToast(`Bağlantı hatası: ${err.message}`, "error");
  }
}

function sendSupplierWhatsAppOrder() {
  let targetItems = [];
  if (selectedBarcodes && selectedBarcodes.size > 0) {
    targetItems = allCatalogProducts.filter(p => selectedBarcodes.has(p.barcode));
  } else if (catalogStatusFilter === 'LOW_STOCK' && filteredCatalogProducts.length > 0) {
    targetItems = filteredCatalogProducts;
  } else {
    targetItems = allCatalogProducts.filter(p => (parseFloat(p.stock || 0) <= 5));
  }

  if (!targetItems || targetItems.length === 0) {
    if (typeof showToast === 'function') {
      showToast('⚠️ Sipariş listesine eklenecek azalan veya seçili ürün bulunamadı.', 'warning');
    }
    return;
  }

  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;

  let lines = targetItems.slice(0, 30).map((p, idx) => {
    const stock = parseFloat(p.stock || 0);
    return `${idx + 1}. *${p.title}* (Mevcut: ${stock}) ➔ Sipariş: _____ Koli/Adet`;
  }).join('\n');

  if (targetItems.length > 30) {
    lines += `\n... ve ${targetItems.length - 30} kalem daha ürün bulunmaktadır.`;
  }

  const text = `📋 *TOPTANCI SİPARİŞ LİSTESİ / EKSİK ÜRÜNLER*\n🏢 *MARKET SİPARİŞ FORMU*\n📅 *Tarih:* ${dateStr}\n\n${lines}\n\nLütfen siparişlerin teslimat gününü teyit ediniz.\nİyi çalışmalar dileriz.`;

  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

// ==========================================
// KATALOG & MANAV TÜM ÜRÜNLER EXCEL DIŞA AKTAR
// ==========================================
function exportCatalogFullExcel() {
  if (typeof showToast === 'function') {
    showToast('Tüm Market ve Manav ürünleri Excel formatında hazırlanıyor...', 'info');
  }
  
  // Doğrudan indirme bağlantısını tetikle
  const downloadUrl = '/api/katalog/export_excel';
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = 'OYMAPOS_Urun_ve_Fiyat_Katalogu.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

window.exportCatalogFullExcel = exportCatalogFullExcel;
window.updateDetailSpecialCatButtonUI = updateDetailSpecialCatButtonUI;
window.toggleDetailProductSpecialCategory = toggleDetailProductSpecialCategory;
window.toggleSingleProductSpecialCategory = toggleSingleProductSpecialCategory;
window.sendSupplierWhatsAppOrder = sendSupplierWhatsAppOrder;
window.generateInternalBarcodeForDetail = generateInternalBarcodeForDetail;






