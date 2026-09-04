// -*- coding: utf-8 -*-
/**
 * KASA SAĞ PANEL GRİD & BARKODSUZ ÜRÜNLER (kasa_hizli_grid.js)
 */

// =========================================================
// 4. SAĞ PANEL KATEGORİ SEÇİMİ & ADET/KG/BARKODSUZ GRİDİ
// =========================================================
window.posQuickCurrentPage = 1;
window.posQuickPageSize = 10;
window.posQuickAllItems = [];

function selectPosQuickCategory(category) {
  window.currentPosQuickCategory = category;
  window.posQuickCurrentPage = 1;

  const btnAdet = document.getElementById('btn-cat-manav-adet');
  const btnBarkodsuz = document.getElementById('btn-cat-barkodsuz');
  const btnCustomize = document.getElementById('btn-customize-barkodsuz');
  const headingEl = document.getElementById('pos-quick-cat-heading');

  [btnAdet, btnBarkodsuz].forEach(btn => {
    if (btn) {
      btn.style.background = '#0f1c38';
      btn.style.borderColor = 'rgba(255,255,255,0.12)';
      btn.style.color = '#cbd5e1';
      btn.style.boxShadow = 'none';
    }
  });

  if (category === 'barkodsuz') {
    if (btnBarkodsuz) {
      btnBarkodsuz.style.background = '#0284c7';
      btnBarkodsuz.style.borderColor = '#38bdf8';
      btnBarkodsuz.style.color = '#ffffff';
      btnBarkodsuz.style.boxShadow = '0 4px 12px rgba(2,132,199,0.35)';
    }
    if (headingEl) headingEl.innerText = 'BARKODSUZ ÜRÜNLER';
    if (btnCustomize) btnCustomize.style.display = 'block';
  } else {
    if (btnAdet) {
      btnAdet.style.background = '#0284c7';
      btnAdet.style.borderColor = '#38bdf8';
      btnAdet.style.color = '#ffffff';
      btnAdet.style.boxShadow = '0 4px 12px rgba(2,132,199,0.35)';
    }
    if (headingEl) headingEl.innerText = 'MANAV ADET';
    if (btnCustomize) btnCustomize.style.display = 'none';
  }

  loadPosQuickGrid(category);
}

async function loadPosQuickGrid(category) {
  const gridContainer = document.getElementById('pos-quick-3col-grid');
  const countEl = document.getElementById('pos-quick-items-count');
  const paginationControls = document.getElementById('pos-quick-pagination-controls');
  if (!gridContainer) return;

  gridContainer.innerHTML = '<div style="grid-column: span 2; text-align: center; color: #64748b; padding: 20px;">Yükleniyor...</div>';

  try {
    const res = await fetch(`/api/pos/quick_category_items?cat=${encodeURIComponent(category)}`);
    const data = await res.json();

    if (data.status === 'success' && Array.isArray(data.items)) {
      window.posQuickAllItems = data.items;
      if (countEl) countEl.innerText = `${data.items.length} Ürün`;

      renderCurrentPosQuickPage();
    } else {
      gridContainer.innerHTML = '<div style="grid-column: span 2; text-align: center; color: #64748b; padding: 20px;">Ürün bulunamadı.</div>';
      if (paginationControls) paginationControls.style.display = 'none';
    }
  } catch (e) {
    gridContainer.innerHTML = '<div style="grid-column: span 2; text-align: center; color: #f87171; padding: 20px;">Ürünler yüklenemedi.</div>';
    if (paginationControls) paginationControls.style.display = 'none';
  }
}

function renderCurrentPosQuickPage() {
  const gridContainer = document.getElementById('pos-quick-3col-grid');
  const paginationControls = document.getElementById('pos-quick-pagination-controls');

  if (!gridContainer) return;
  if (paginationControls) paginationControls.style.display = 'none';

  const allItems = window.posQuickAllItems || [];
  window.posQuickItemsList = allItems;

  if (allItems.length === 0) {
    gridContainer.innerHTML = '<div style="grid-column: span 2; text-align: center; color: #64748b; padding: 20px;">Ürün bulunamadı.</div>';
    return;
  }

  gridContainer.innerHTML = allItems.map((item, idx) => {
    const pVal = Number(item.price || 0);
    const pText = pVal > 0 ? pVal.toFixed(2).replace('.', ',') + ' TL' : 'Tutar Gir';
    return `
      <button type="button" onclick="addPosQuickItemByIndex(${idx})"
              class="pos-quick-item-card"
              style="border-radius: 8px; padding: 6px 8px; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; min-height: 52px; cursor: pointer; transition: all 0.12s ease; user-select: none; box-sizing: border-box; gap: 2px;">
        <span class="pos-quick-item-title" style="font-size: 11.5px; font-weight: 800; line-height: 1.2; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; max-height: 28px; pointer-events: none;">
          ${item.title}
        </span>
        <strong class="pos-quick-item-price" style="color: #10b981; font-size: 12px; font-family: monospace; font-weight: 900; pointer-events: none;">
          ${pText}
        </strong>
      </button>
    `;
  }).join('');
}

function changePosQuickPage(delta) {
  const allItems = window.posQuickAllItems || [];
  const pageSize = window.posQuickPageSize || 10;
  const totalPages = Math.ceil(allItems.length / pageSize) || 1;

  const newPage = window.posQuickCurrentPage + delta;
  if (newPage >= 1 && newPage <= totalPages) {
    window.posQuickCurrentPage = newPage;
    renderCurrentPosQuickPage();
  }
}

function addPosQuickItemByIndex(idx) {
  const item = (window.posQuickItemsList || [])[idx];
  if (!item) return;

  const cleanBarcode = item.plu ? `PLU_${item.plu}` : (item.id ? `GRID_${item.id}` : `QUICK_${item.title}`);
  
  const barcodeInp = document.getElementById('pos-barcode-input');
  let qty = 1;
  if (barcodeInp && barcodeInp.value.trim().includes('*')) {
    const parts = barcodeInp.value.trim().split('*');
    const parsedQty = parseFloat(parts[0].replace(',', '.'));
    if (!isNaN(parsedQty) && parsedQty > 0) {
      qty = parsedQty;
    }
    barcodeInp.value = '';
  }

  addItemToPosCart({
    title: item.title,
    plu: item.plu || null,
    barcode: cleanBarcode,
    unit_price: parseFloat(item.price) || 0.0,
    total_price: Math.round(qty * (parseFloat(item.price) || 0.0) * 100) / 100,
    quantity: qty,
    unit: item.unit || 'Adet',
    is_scale_item: item.is_scale_item || false
  });
}

// =========================================================
// 4.1. BARKODSUZ ÜRÜNLER SIRALAMA & ÖZELLEŞTİRME YÖNETİMİ
// =========================================================
window.barkodsuzManagerItems = [];

async function openBarkodsuzManagerModal() {
  const modal = document.getElementById('modal-barkodsuz-manager');
  if (!modal) return;

  try {
    const res = await fetch('/api/pos/barkodsuz_items');
    const data = await res.json();
    if (data.status === 'success' && Array.isArray(data.items)) {
      window.barkodsuzManagerItems = JSON.parse(JSON.stringify(data.items));
      renderBarkodsuzManagerList();
      showPosModal(modal);
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast('Barkodsuz ürünler yüklenemedi.', 'error');
  }
}

function closeBarkodsuzManagerModal() {
  hidePosModal('modal-barkodsuz-manager');
}

function renderBarkodsuzManagerList() {
  const container = document.getElementById('barkodsuz-items-sort-list');
  if (!container) return;

  const items = window.barkodsuzManagerItems || [];
  if (items.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: #64748b; padding: 20px;">Henüz barkodsuz ürün kaydı yok. Yukarıdan ekleyebilirsiniz.</div>';
    return;
  }

  container.innerHTML = items.map((item, idx) => {
    const pageNum = Math.floor(idx / 10) + 1;
    const slotInPage = (idx % 10) + 1;
    const pVal = Number(item.price || 0);
    const pText = pVal > 0 ? pVal.toFixed(2).replace('.', ',') + ' TL' : '0,00 TL';

    return `
      <div style="display: flex; align-items: center; justify-content: space-between; background: #070d1e; border: 1px solid #334155; border-radius: 8px; padding: 8px 12px; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 11px; font-weight: 800; background: #1e293b; color: #38bdf8; padding: 2px 7px; border-radius: 4px; min-width: 45px; text-align: center;">
            S${pageNum}-${slotInPage}
          </span>
          <div>
            <strong style="color: #f8fafc; font-size: 12.5px; display: block;">${item.title}</strong>
            <small style="color: #10b981; font-weight: 800; font-size: 11px;">${pText}</small>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 6px;">
          <button type="button" onclick="moveBarkodsuzItem(${idx}, -1)" ${idx === 0 ? 'disabled' : ''} style="background: #1e293b; border: 1px solid #334155; color: #cbd5e1; border-radius: 4px; padding: 3px 8px; cursor: pointer; font-size: 11px; font-weight: 800;" title="Yukarı Taşı">▲</button>
          <button type="button" onclick="moveBarkodsuzItem(${idx}, 1)" ${idx === items.length - 1 ? 'disabled' : ''} style="background: #1e293b; border: 1px solid #334155; color: #cbd5e1; border-radius: 4px; padding: 3px 8px; cursor: pointer; font-size: 11px; font-weight: 800;" title="Aşağı Taşı">▼</button>
          <button type="button" onclick="deleteBarkodsuzItemFromModal(${idx})" style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4); color: #f87171; border-radius: 4px; padding: 3px 8px; cursor: pointer; font-size: 11px;" title="Listeden Çıkar">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

function moveBarkodsuzItem(index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= window.barkodsuzManagerItems.length) return;

  const temp = window.barkodsuzManagerItems[index];
  window.barkodsuzManagerItems[index] = window.barkodsuzManagerItems[targetIndex];
  window.barkodsuzManagerItems[targetIndex] = temp;

  renderBarkodsuzManagerList();
}

function deleteBarkodsuzItemFromModal(index) {
  window.barkodsuzManagerItems.splice(index, 1);
  renderBarkodsuzManagerList();
}

async function submitAddNewBarkodsuzItem() {
  const titleInp = document.getElementById('inp-bs-new-title');
  const priceInp = document.getElementById('inp-bs-new-price');

  const title = (titleInp?.value || '').trim();
  const price = parseFloat(priceInp?.value || 0.0);

  if (!title) {
    if (typeof showToast === 'function') showToast('Lütfen ürün adını girin.', 'warning');
    return;
  }

  const newItem = {
    id: `bs_${Date.now()}`,
    title: title,
    price: price,
    price_str: (price > 0 ? price.toFixed(2).replace('.', ',') : '0,00') + ' TL',
    unit: 'Adet',
    barcode: 'BARKODSUZ',
    is_scale_item: false
  };

  window.barkodsuzManagerItems.push(newItem);
  if (titleInp) titleInp.value = '';
  if (priceInp) priceInp.value = '';

  renderBarkodsuzManagerList();
  if (typeof showToast === 'function') showToast(`'${title}' listeye eklendi. Sıralamayı Kaydet butonuna basmayı unutmayın.`, 'info');
}

async function saveBarkodsuzOrderChanges() {
  try {
    const res = await fetch('/api/pos/barkodsuz_items/save_order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: window.barkodsuzManagerItems })
    });
    const data = await res.json();

    if (data.status === 'success') {
      if (typeof showToast === 'function') showToast('✅ Barkodsuz ürünler ve sıralama başarıyla kaydedildi.', 'success');
      closeBarkodsuzManagerModal();
      if (window.currentPosQuickCategory === 'barkodsuz') {
        loadPosQuickGrid('barkodsuz');
      }
    } else {
      if (typeof showToast === 'function') showToast(`Hata: ${data.message}`, 'error');
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast(`Kayıt hatası: ${err.message}`, 'error');
  }
}

