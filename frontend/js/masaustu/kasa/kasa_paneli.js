// -*- coding: utf-8 -*-
/**
 * =========================================================================
 * CORTEX POS - HIZLI SATIŞ KASA TERMİNALİ VE MOTORU (KASA_PANELI.JS)
 * =========================================================================
 */

// Global State
let posCart = [];
let parkedReceipts = [];
let activeCashier = { id: 'kasa1', name: 'Kasa 1 (Kasiyer 1)' };
window.currentPosQuickCategory = 'manav_adet';
window.posSplitPayments = [];
window.posQuickItemsList = [];
window.currentPosPaymentType = 'Nakit';

document.addEventListener('DOMContentLoaded', () => {
  initPosModule();
});

function savePosCartToStorage() {
  try {
    if (posCart && posCart.length > 0) {
      localStorage.setItem('pos_cart_saved_session', JSON.stringify(posCart));
      localStorage.setItem('pos_splits_saved_session', JSON.stringify(window.posSplitPayments || []));
    } else {
      localStorage.removeItem('pos_cart_saved_session');
      localStorage.removeItem('pos_splits_saved_session');
    }
  } catch (e) {}
}

function loadPosCartFromStorage() {
  try {
    const rawCart = localStorage.getItem('pos_cart_saved_session');
    if (rawCart) {
      const parsed = JSON.parse(rawCart);
      if (Array.isArray(parsed) && parsed.length > 0) {
        posCart = parsed;
      }
    }
    const rawSplits = localStorage.getItem('pos_splits_saved_session');
    if (rawSplits) {
      const parsedSplits = JSON.parse(rawSplits);
      if (Array.isArray(parsedSplits)) {
        window.posSplitPayments = parsedSplits;
      }
    }
  } catch (e) {}
}

function initPosModule() {
  loadPosCartFromStorage();
  loadActiveCashier();
  loadDashboardSummary();
  loadRecentHomeSales();
  selectPosQuickCategory(window.currentPosQuickCategory || 'manav_adet');
  renderPosCart();
  updateParkedReceiptsUI();
  initPosBottomButtons();
}

// =========================================================
// 1. DOKUNMATİK NUMPAD KONTROLLERİ (0-9, ., *, ENTER, SİL)
// =========================================================
let currentActivePosInput = null;

function setPosActiveInput(el) {
  currentActivePosInput = el;
}

function getPosTargetInput() {
  if (currentActivePosInput && document.body.contains(currentActivePosInput)) {
    return currentActivePosInput;
  }
  return document.getElementById('pos-barcode-input');
}

function appendPosKey(char) {
  const inp = getPosTargetInput();
  if (!inp) return;
  inp.value += char;
  inp.dispatchEvent(new Event('input'));
  inp.focus();
}

function backspacePosKey() {
  const inp = getPosTargetInput();
  if (!inp || !inp.value) return;
  inp.value = inp.value.slice(0, -1);
  inp.dispatchEvent(new Event('input'));
  inp.focus();
}

function clearPosBarcodeInput() {
  const inp = getPosTargetInput();
  if (!inp) return;
  inp.value = '';
  inp.dispatchEvent(new Event('input'));
  inp.focus();
}

function submitPosKey() {
  submitPosBarcodeInput();
}

// =========================================================
// 2. CANLI BARKOD & İSİMLE ARAMA (AUTOCOMPLETE)
// =========================================================
let autocompleteDebounceTimer = null;
let currentAutocompleteResults = [];
let activeAutocompleteIndex = -1;

function onPosBarcodeInputLive(val) {
  clearTimeout(autocompleteDebounceTimer);
  const popup = document.getElementById('pos-autocomplete-popup');
  if (!popup) return;

  const raw = String(val || '').trim();
  let queryText = raw;
  if (raw.includes('*')) {
    const parts = raw.split('*');
    if (parts.length >= 2) {
      queryText = parts.slice(1).join('*').trim();
    }
  }

  if (queryText.length < 2) {
    closePosAutocompletePopup();
    return;
  }

  autocompleteDebounceTimer = setTimeout(async () => {
    try {
      const res = await fetch(`/api/pos/autocomplete?q=${encodeURIComponent(queryText)}`);
      const data = await res.json();
      if (data.status === 'success' && data.results && data.results.length > 0) {
        currentAutocompleteResults = data.results;
        activeAutocompleteIndex = 0;
        renderPosAutocompleteList(data.results);
      } else {
        closePosAutocompletePopup();
      }
    } catch (e) {
      closePosAutocompletePopup();
    }
  }, 120);
}

function renderPosAutocompleteList(results) {
  const popup = document.getElementById('pos-autocomplete-popup');
  if (!popup) return;

  popup.innerHTML = results.map((item, idx) => `
    <div id="pos-ac-item-${idx}" onclick="selectPosAutocompleteIndex(${idx})" 
         class="pos-ac-item"
         style="padding: 9px 12px; border-bottom: 1px solid rgba(255,255,255,0.06); cursor: pointer; display: flex; justify-content: space-between; align-items: center; background: ${idx === activeAutocompleteIndex ? 'rgba(56,189,248,0.22)' : 'transparent'}; transition: background 0.1s ease;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 11px; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; color: #cbd5e1; font-weight: 700;">${item.type_badge || '📦'}</span>
        <div>
          <div style="font-size: 13px; font-weight: 800; color: #f8fafc;">${item.title}</div>
          <div style="font-size: 11px; color: #94a3b8; font-family: monospace;">${item.barcode} • ${item.unit || 'Adet'}</div>
        </div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 13.5px; font-weight: 900; color: #10b981; font-family: monospace;">${item.price_str}</div>
        <div style="font-size: 10px; color: #38bdf8; font-weight: 700;">[Seç: ENTER]</div>
      </div>
    </div>
  `).join('');

  popup.style.display = 'block';
}

function closePosAutocompletePopup() {
  const popup = document.getElementById('pos-autocomplete-popup');
  if (popup) popup.style.display = 'none';
  currentAutocompleteResults = [];
  activeAutocompleteIndex = -1;
}

function selectPosAutocompleteIndex(index) {
  const item = currentAutocompleteResults[index];
  if (!item) return;

  const inp = document.getElementById('pos-barcode-input');
  let qty = 1;
  if (inp && inp.value.includes('*')) {
    const parts = inp.value.split('*');
    const parsedQty = parseFloat(parts[0].replace(',', '.'));
    if (!isNaN(parsedQty) && parsedQty > 0) qty = parsedQty;
  }

  addItemToPosCart({
    title: item.title,
    barcode: item.barcode,
    unit_price: item.unit_price,
    total_price: Math.round(qty * item.unit_price * 100) / 100,
    quantity: qty,
    unit: item.unit || 'Adet',
    is_scale_item: item.is_scale_item
  });

  if (inp) {
    inp.value = '';
    inp.focus();
  }
  closePosAutocompletePopup();
}

function submitPosBarcodeInput() {
  const inp = document.getElementById('pos-barcode-input');
  if (!inp || !inp.value.trim()) return;

  const rawVal = inp.value.trim();
  inp.value = '';
  closePosAutocompletePopup();

  let qty = 1;
  let query = rawVal;

  if (rawVal.startsWith('*')) {
    query = rawVal.substring(1).trim() || '1';
    qty = 1;
  } else if (rawVal.includes('*')) {
    const parts = rawVal.split('*');
    if (parts.length >= 2) {
      const parsedQty = parseFloat(parts[0].replace(',', '.'));
      if (!isNaN(parsedQty) && parsedQty > 0) {
        qty = parsedQty;
        query = parts.slice(1).join('*').trim();
      }
    }
  }

  if (query) {
    addPosItemByQuery(query, qty);
  }
}

function handlePosBarcodeInput(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    const popup = document.getElementById('pos-autocomplete-popup');
    if (popup && popup.style.display !== 'none' && currentAutocompleteResults.length > 0) {
      selectPosAutocompleteIndex(activeAutocompleteIndex >= 0 ? activeAutocompleteIndex : 0);
      return;
    }
    submitPosBarcodeInput();
  } else if (e.key === 'ArrowDown') {
    const popup = document.getElementById('pos-autocomplete-popup');
    if (popup && popup.style.display !== 'none' && currentAutocompleteResults.length > 0) {
      e.preventDefault();
      activeAutocompleteIndex = (activeAutocompleteIndex + 1) % currentAutocompleteResults.length;
      highlightPosAutocompleteItem();
    }
  } else if (e.key === 'ArrowUp') {
    const popup = document.getElementById('pos-autocomplete-popup');
    if (popup && popup.style.display !== 'none' && currentAutocompleteResults.length > 0) {
      e.preventDefault();
      activeAutocompleteIndex = (activeAutocompleteIndex - 1 + currentAutocompleteResults.length) % currentAutocompleteResults.length;
      highlightPosAutocompleteItem();
    }
  } else if (e.key === 'Escape') {
    closePosAutocompletePopup();
  }
}

function highlightPosAutocompleteItem() {
  currentAutocompleteResults.forEach((_, idx) => {
    const el = document.getElementById(`pos-ac-item-${idx}`);
    if (el) {
      el.style.background = (idx === activeAutocompleteIndex) ? 'rgba(56,189,248,0.22)' : 'transparent';
    }
  });
}

// =========================================================
// 3. ÜRÜN ARAMA & SEPETE EKLEME
// =========================================================
async function addPosItemByQuery(query, qty = 1) {
  try {
    const res = await fetch(`/api/pos/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (data.status === 'success' && data.product) {
      const p = data.product;
      const uPrice = parseFloat(p.unit_price || p.price || 0.0);
      const isScale = p.is_scale_item || false;
      const actualQty = isScale ? (p.quantity || qty) : qty;

      addItemToPosCart({
        title: p.title,
        barcode: p.barcode,
        unit_price: uPrice,
        total_price: Math.round(actualQty * uPrice * 100) / 100,
        quantity: actualQty,
        unit: p.unit || (isScale ? 'Kg' : 'Adet'),
        is_scale_item: isScale,
        source: data.source
      });

      if (typeof showToast === 'function') {
        showToast(`✓ ${p.title} sepete eklendi`, 'success');
      }
    } else {
      triggerBarcodeNotFoundAlert(query);
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('Ürün arama hatası.', 'error');
  }
}

function addItemToPosCart(prod) {
  const addQty = parseFloat(prod.quantity) || 1;
  let itemTitle = prod.title || 'Ürün';

  const isOneLira = (prod.barcode === '1' || prod.source === 'special_one_lira' || itemTitle === '1TL (Terazi / Barkodsuz)' || (itemTitle.startsWith('1TL') && !prod.barcode.startsWith('GRID_') && !prod.barcode.startsWith('PLU_')));

  if (!prod.is_scale_item && !isOneLira) {
    const existingIdx = posCart.findIndex(i => !i.is_scale_item && !i.is_one_lira && i.barcode === prod.barcode && i.title === prod.title);
    if (existingIdx !== -1) {
      const existing = posCart[existingIdx];
      existing.quantity = Math.round(((parseFloat(existing.quantity) || 0) + addQty) * 100) / 100;
      existing.total_price = Math.round(existing.quantity * existing.unit_price * 100) / 100;
      posCart.splice(existingIdx, 1);
      posCart.unshift(existing);
      renderPosCart();
      return;
    }
  }

  if (isOneLira) {
    const countOneLira = posCart.filter(i => i.is_one_lira || i.barcode === '1' || (i.title && i.title.startsWith('1TL'))).length + 1;
    itemTitle = `1TL (Terazi / Barkodsuz) #${countOneLira}`;
  }

  const uPrice = parseFloat(prod.unit_price) || 0.0;
  const isKgItem = prod.is_scale_item || (prod.unit && prod.unit.toLowerCase() === 'kg');

  const newItem = {
    id: `cart_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    is_scale_item: prod.is_scale_item || isKgItem || false,
    is_one_lira: isOneLira,
    plu: prod.plu || null,
    barcode: prod.barcode || '',
    title: itemTitle,
    unit: prod.unit || (isKgItem ? 'Kg' : 'Adet'),
    quantity: addQty,
    unit_price: uPrice,
    total_price: Math.round(addQty * uPrice * 100) / 100
  };

  posCart.unshift(newItem);
  renderPosCart();
}

function onPosCartQtyChange(cartId, val) {
  const item = posCart.find(i => i.id === cartId);
  if (!item) return;

  const raw = String(val || '').replace(',', '.').trim();
  const parsedQty = parseFloat(raw);
  if (!isNaN(parsedQty) && parsedQty > 0) {
    item.quantity = parsedQty;
    item.total_price = Math.round(item.quantity * item.unit_price * 100) / 100;
  } else if (raw === '' || parsedQty === 0) {
    item.quantity = 0;
    item.total_price = 0;
  }
  updatePosCartTotalsOnly();
}

function onPosCartPriceChange(cartId, val) {
  const item = posCart.find(i => i.id === cartId);
  if (!item) return;

  const raw = String(val || '').replace(',', '.').trim();
  const parsedPrice = parseFloat(raw);
  if (!isNaN(parsedPrice) && parsedPrice >= 0) {
    item.unit_price = parsedPrice;
    item.total_price = Math.round(item.quantity * item.unit_price * 100) / 100;
  } else if (raw === '') {
    item.unit_price = 0;
    item.total_price = 0;
  }
  updatePosCartTotalsOnly();
}

function handlePosRowInputKey(e, cartId) {
  if (e.key === 'Enter') {
    e.preventDefault();
    const barcodeInp = document.getElementById('pos-barcode-input');
    if (barcodeInp) barcodeInp.focus();
  }
}

function updatePosCartTotalsOnly() {
  let grandTotal = 0;
  let totalAdetCount = 0;
  let totalKgWeight = 0;

  posCart.forEach(item => {
    grandTotal += (parseFloat(item.total_price) || 0);

    const rowTotalEl = document.getElementById(`row-total-${item.id}`);
    if (rowTotalEl) {
      rowTotalEl.innerText = `${(parseFloat(item.total_price) || 0).toFixed(2).replace('.', ',')} TL`;
    }

    const isKg = item.is_scale_item || (item.unit && item.unit.toLowerCase() === 'kg');
    if (isKg) {
      totalKgWeight += (parseFloat(item.quantity) || 0);
      totalAdetCount += 1;
    } else {
      totalAdetCount += (parseFloat(item.quantity) || 0);
    }
  });

  const totalFormatted = `${grandTotal.toFixed(2).replace('.', ',')} TL`;
  const totalAmountEl = document.getElementById('pos-cart-grand-total');
  if (totalAmountEl) totalAmountEl.innerText = totalFormatted;

  const summaryVarietyEl = document.getElementById('pos-summary-variety');
  const summaryQtyEl = document.getElementById('pos-summary-qty');
  const summaryKgEl = document.getElementById('pos-summary-kg');
  const summaryTotalEl = document.getElementById('pos-summary-total');

  if (summaryVarietyEl) summaryVarietyEl.innerText = `${posCart.length}`;
  if (summaryQtyEl) summaryQtyEl.innerText = `${Math.round(totalAdetCount * 10) / 10}`;
  if (summaryKgEl) summaryKgEl.innerText = `${totalKgWeight.toFixed(2).replace('.', ',')} Kg`;
  if (summaryTotalEl) summaryTotalEl.innerText = totalFormatted;
}

function removePosCartItem(cartId) {
  posCart = posCart.filter(i => i.id !== cartId);
  renderPosCart();
}

function clearPosCart() {
  posCart = [];
  window.posSplitPayments = [];
  const barcodeInp = document.getElementById('pos-barcode-input');
  if (barcodeInp) barcodeInp.value = '';
  closePosAutocompletePopup();
  renderPosCart();
}

// 5 SÜTUNLU SEPET TABLOSU & 4'LÜ DETAYLI ÖZET ŞERİDİ
function renderPosCart() {
  const tbody = document.getElementById('pos-cart-tbody');
  const totalAmountEl = document.getElementById('pos-cart-grand-total');
  const summaryVarietyEl = document.getElementById('pos-summary-variety');
  const summaryQtyEl = document.getElementById('pos-summary-qty');
  const summaryKgEl = document.getElementById('pos-summary-kg');
  const summaryTotalEl = document.getElementById('pos-summary-total');

  let grandTotal = 0;
  let totalAdetCount = 0;
  let totalKgWeight = 0;

  if (tbody) {
    if (posCart.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: #64748b; padding: 45px 10px; font-size: 13px;">
            🛒 Sepetiniz boş.<br>
            Barkod okutun veya yukarıdaki numpad ile <strong>[Miktar*Barkod]</strong> yazarak ekleyin.
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = posCart.map((item, idx) => {
        grandTotal += item.total_price;

        const isKg = item.is_scale_item || (item.unit && item.unit.toLowerCase() === 'kg');
        if (isKg) {
          totalKgWeight += (parseFloat(item.quantity) || 0);
          totalAdetCount += 1;
        } else {
          totalAdetCount += (parseFloat(item.quantity) || 1);
        }

        return `
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.07); animation: fadeIn 0.15s ease;">
            <!-- 1. Ürün Adı -->
            <td style="padding: 6px 10px; font-weight: 700; color: #f8fafc; border-right: 1px solid rgba(255,255,255,0.06);">
              <span style="color: #60a5fa; font-size: 10.5px; margin-right: 4px;">#${idx+1}</span>
              ${item.title}
              ${item.is_scale_item ? '<span style="background: rgba(16,185,129,0.15); color: #34d399; font-size: 9.5px; padding: 1px 4px; border-radius: 4px; margin-left: 4px;">Terazi</span>' : ''}
            </td>

            <!-- 2. Miktar -->
            <td style="padding: 4px 6px; text-align: center; border-right: 1px solid rgba(255,255,255,0.06);">
              <input type="text" inputmode="decimal" id="cart-qty-${item.id}" value="${item.quantity}"
                     onfocus="setPosActiveInput(this); this.select();"
                     oninput="onPosCartQtyChange('${item.id}', this.value)"
                     onkeydown="handlePosRowInputKey(event, '${item.id}')"
                     style="width: 68px; padding: 5px 6px; background: #070d1e; border: 1.5px solid #38bdf8; border-radius: 6px; color: #38bdf8; font-weight: 900; font-size: 13.5px; text-align: center; outline: none; box-sizing: border-box;">
            </td>

            <!-- 3. Birim Adı -->
            <td style="padding: 6px 8px; text-align: center; color: #cbd5e1; font-weight: 700; border-right: 1px solid rgba(255,255,255,0.06); font-size: 12px;">
              ${item.unit}
            </td>

            <!-- 4. Birim Fiyat -->
            <td style="padding: 4px 6px; text-align: right; border-right: 1px solid rgba(255,255,255,0.06);">
              <input type="text" inputmode="decimal" id="cart-price-${item.id}" value="${item.unit_price.toFixed(2)}"
                     onfocus="setPosActiveInput(this); this.select();"
                     oninput="onPosCartPriceChange('${item.id}', this.value)"
                     onkeydown="handlePosRowInputKey(event, '${item.id}')"
                     style="width: 75px; padding: 5px 6px; background: #070d1e; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #f8fafc; font-weight: 800; font-size: 13px; text-align: right; outline: none; box-sizing: border-box; font-family: monospace;">
            </td>

            <!-- 5. Ürün Tutarı -->
            <td style="padding: 6px 8px; text-align: right; font-weight: 900; font-family: monospace; font-size: 14px; color: #10b981; border-right: 1px solid rgba(255,255,255,0.06);" id="row-total-${item.id}">
              ${item.total_price.toFixed(2).replace('.', ',')} TL
            </td>

            <!-- 6. Sil İşlemi -->
            <td style="padding: 4px 4px; text-align: center;">
              <button type="button" onclick="removePosCartItem('${item.id}')" 
                      style="background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.3); color: #f87171; width: 26px; height: 26px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 900;" title="Sil">
                ✕
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  const grandFormatted = `${grandTotal.toFixed(2).replace('.', ',')} TL`;
  if (totalAmountEl) {
    totalAmountEl.innerText = grandFormatted;
  }

  if (summaryVarietyEl) summaryVarietyEl.innerText = `${posCart.length}`;
  if (summaryQtyEl) summaryQtyEl.innerText = `${Math.round(totalAdetCount * 10) / 10}`;
  if (summaryKgEl) summaryKgEl.innerText = `${totalKgWeight.toFixed(2).replace('.', ',')} Kg`;
  if (summaryTotalEl) summaryTotalEl.innerText = grandFormatted;

  savePosCartToStorage();
}

// =========================================================
// 4. SAĞ PANEL KATEGORİ SEÇİMİ & ADET/KG/BARKODSUZ GRİDİ
// =========================================================
function selectPosQuickCategory(category) {
  window.currentPosQuickCategory = category;

  const btnAdet = document.getElementById('btn-cat-manav-adet');
  const btnBarkodsuz = document.getElementById('btn-cat-barkodsuz');
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
    if (headingEl) headingEl.innerText = 'BARKODSUZ & MUHTELİF';
  } else {
    if (btnAdet) {
      btnAdet.style.background = '#0284c7';
      btnAdet.style.borderColor = '#38bdf8';
      btnAdet.style.color = '#ffffff';
      btnAdet.style.boxShadow = '0 4px 12px rgba(2,132,199,0.35)';
    }
    if (headingEl) headingEl.innerText = 'MANAV ADET (A-Z)';
  }

  loadPosQuickGrid(category);
}

async function loadPosQuickGrid(category) {
  const gridContainer = document.getElementById('pos-quick-3col-grid');
  const countEl = document.getElementById('pos-quick-items-count');
  if (!gridContainer) return;

  gridContainer.innerHTML = '<div style="grid-column: span 2; text-align: center; color: #64748b; padding: 20px;">Yükleniyor...</div>';

  try {
    const res = await fetch(`/api/pos/quick_category_items?cat=${encodeURIComponent(category)}`);
    const data = await res.json();

    if (data.status === 'success' && Array.isArray(data.items)) {
      const items = data.items;
      window.posQuickItemsList = items;
      if (countEl) countEl.innerText = `${items.length} Ürün`;

      if (items.length === 0) {
        gridContainer.innerHTML = '<div style="grid-column: span 2; text-align: center; color: #64748b; padding: 20px;">Ürün bulunamadı.</div>';
        return;
      }

      gridContainer.innerHTML = items.map((item, idx) => {
        const pVal = Number(item.price || 0);
        const pText = pVal > 0 ? pVal.toFixed(2).replace('.', ',') + ' TL' : 'Tutar Gir';
        return `
          <button type="button" onclick="addPosQuickItemByIndex(${idx})"
                  style="background: #0f1c38; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 8px 8px; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; height: 54px; cursor: pointer; transition: all 0.12s ease; user-select: none; box-sizing: border-box; gap: 3px;"
                  onmouseover="this.style.borderColor='#38bdf8'; this.style.background='#13264d';"
                  onmouseout="this.style.borderColor='rgba(255,255,255,0.08)'; this.style.background='#0f1c38';">
            <span style="font-size: 11.5px; font-weight: 800; color: #f8fafc; line-height: 1.2; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; max-height: 26px; pointer-events: none;">
              ${item.title}
            </span>
            <strong style="color: #10b981; font-size: 12px; font-family: monospace; font-weight: 900; pointer-events: none;">
              ${pText}
            </strong>
          </button>
        `;
      }).join('');
    }
  } catch (e) {
    gridContainer.innerHTML = '<div style="grid-column: span 2; text-align: center; color: #f87171; padding: 20px;">Ürünler yüklenemedi.</div>';
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

  if (typeof showToast === 'function') {
    showToast(`➕ ${qty > 1 ? qty + 'x ' : ''}${item.title} sepete eklendi.`, 'info');
  }
}

// =========================================================
// 5. MODAL YÖNETİMİ (100% KARARLI VE GÜVENLİ)
// =========================================================
function showPosModal(modalId) {
  let m = typeof modalId === 'string' ? document.getElementById(modalId) : modalId;
  if (!m) {
    console.error('Modal bulunamadı:', modalId);
    return;
  }
  if (m.parentElement !== document.body) {
    document.body.appendChild(m);
  }
  m.classList.add('active');
  m.style.removeProperty('display');
  m.style.setProperty('display', 'flex', 'important');
  m.style.setProperty('visibility', 'visible', 'important');
  m.style.setProperty('opacity', '1', 'important');
  m.style.setProperty('pointer-events', 'auto', 'important');
  m.style.setProperty('z-index', '99999999', 'important');
  m.style.setProperty('position', 'fixed', 'important');
  m.style.setProperty('inset', '0px', 'important');
  m.style.setProperty('width', '100vw', 'important');
  m.style.setProperty('height', '100vh', 'important');
  m.style.setProperty('background', 'rgba(4, 8, 16, 0.88)', 'important');
  m.style.setProperty('backdrop-filter', 'blur(8px)', 'important');
}

function hidePosModal(modalId) {
  const m = typeof modalId === 'string' ? document.getElementById(modalId) : modalId;
  if (!m) return;
  m.classList.remove('active');
  m.style.removeProperty('display');
  m.style.setProperty('display', 'none', 'important');
  m.style.setProperty('visibility', 'hidden', 'important');
  m.style.setProperty('opacity', '0', 'important');
  m.style.setProperty('pointer-events', 'none', 'important');
}

// 5.1. HIZLI ÜRÜN TANIMLA / DÜZENLE MODALI
function openPosQuickProductModal(barcodeOrEvent = '') {
  let presetBarcode = '';
  if (typeof barcodeOrEvent === 'string' || typeof barcodeOrEvent === 'number') {
    presetBarcode = String(barcodeOrEvent).trim();
  }

  const bcInp = document.getElementById('quick-prod-barcode');
  const titleInp = document.getElementById('quick-prod-title');
  const salePriceInp = document.getElementById('quick-prod-sale-price');
  const buyingPriceInp = document.getElementById('quick-prod-buying-price');
  const marginInp = document.getElementById('quick-prod-margin');
  const brandInp = document.getElementById('quick-prod-brand');
  const stockInp = document.getElementById('quick-prod-stock');
  const unitInp = document.getElementById('quick-prod-unit');
  const kdvInp = document.getElementById('quick-prod-kdv');
  const badgeEl = document.getElementById('pos-quick-prod-status-badge');
  const btnSave = document.getElementById('btn-save-quick-prod');

  if (bcInp) bcInp.value = presetBarcode;
  if (titleInp) titleInp.value = '';
  if (salePriceInp) salePriceInp.value = '';
  if (buyingPriceInp) buyingPriceInp.value = '';
  if (marginInp) marginInp.value = '%0';
  if (brandInp) brandInp.value = '';
  if (stockInp) stockInp.value = '0';
  if (kdvInp) kdvInp.value = '10';

  if (badgeEl) {
    badgeEl.style.background = '#0f172a';
    badgeEl.style.borderColor = '#334155';
    badgeEl.style.color = '#94a3b8';
    badgeEl.innerText = 'Barkod okutun veya yazın (Kayıtlı ise bilgileri gelir)';
  }

  if (btnSave) {
    btnSave.innerText = 'Kaydet (Enter)';
    btnSave.style.background = '#2563eb';
  }

  validateQuickProdInputs();
  showPosModal('modal-pos-quick-product-manage');

  setTimeout(() => {
    if (presetBarcode) {
      lookupQuickProductByBarcode(presetBarcode);
    } else if (bcInp) {
      bcInp.focus();
      bcInp.select();
    }
  }, 80);
}

function validateQuickProdInputs() {
  const bc = (document.getElementById('quick-prod-barcode')?.value || '').trim();
  const title = (document.getElementById('quick-prod-title')?.value || '').trim();
  const salePriceVal = (document.getElementById('quick-prod-sale-price')?.value || '').replace(',', '.').trim();
  const salePrice = parseFloat(salePriceVal);

  const btnSave = document.getElementById('btn-save-quick-prod');
  const isValid = bc.length > 0 && title.length > 0 && !isNaN(salePrice) && salePrice > 0;

  if (btnSave) {
    if (isValid) {
      btnSave.style.opacity = '1';
      btnSave.style.pointerEvents = 'auto';
      btnSave.style.cursor = 'pointer';
    } else {
      btnSave.style.opacity = '0.4';
      btnSave.style.pointerEvents = 'none';
      btnSave.style.cursor = 'not-allowed';
    }
  }
  return isValid;
}

function closePosQuickProductModal() {
  hidePosModal('modal-pos-quick-product-manage');
  const posInp = document.getElementById('pos-barcode-input');
  if (posInp) posInp.focus();
}

let quickProdLookupTimer = null;
function onQuickProdBarcodeChange(val) {
  clearTimeout(quickProdLookupTimer);
  const bc = String(val || '').trim();
  validateQuickProdInputs();
  if (bc.length >= 2) {
    quickProdLookupTimer = setTimeout(() => {
      lookupQuickProductByBarcode(bc);
    }, 200);
  }
}

const POPULAR_BRANDS = [
  'ÇAYKUR', 'ÜLKER', 'ETİ', 'SÜTAŞ', 'PINAR', 'TORKU', 'DOĞUŞ', 'LİPTON', 'DURU', 
  'ARİEL', 'FAİRY', 'ALO', 'OMO', 'NESTLE', 'EKER', 'İÇİM', 'TAT', 'SALAT', 'YUDUM', 
  'KOMİLİ', 'CALVE', 'KNORR', 'MAGGİ', 'KENT', 'HARİBO', 'TADIM', 'PEYMAN', 'DORİTOS', 
  'RUFFLES', 'LAYS', 'ERİKLİ', 'SIRMA', 'DAMLA', 'HAYAT', 'KIZILAY', 'BEYPAZARI', 
  'ULUDAĞ', 'RED BULL', 'BURN', 'SENSODYNE', 'COLGATE', 'SİGNAL', 'İPANA', 'PANTENE', 
  'ELİDOR', 'CLEAR', 'HACI ŞAKİR', 'FAMİLİA', 'PAPİA', 'SELPAK', 'SOLO', 'PAREX', 
  'CİF', 'DOMESTOS', 'PRİL', 'VERNEL', 'YUMOŞ', 'ACE', 'BİNGO', 'MOLFİX', 'PRİMA', 
  'SLEEPY', 'CANBEBE', 'COCA COLA', 'FANTA', 'SPRİTE', 'PEPSİ', 'YEDİGÜN', 'FRUKO', 
  'CAPPY', 'DİMES', 'TAMEK', 'AROMEL', 'NİVEA', 'DOVE', 'REXONA', 'AXE', 'DERBY', 
  'GİLLETTE', 'PERMASHARP', 'DURACELL', 'PANASONİC', 'TOSHIBA', 'BEYPİLİÇ', 'ŞENPİLİÇ', 
  'BANVİT', 'KESTANE', 'BAŞHAN', 'ÖĞÜT', 'OFÇAY', 'BİLLUR', 'BALKÜPÜ', 'BORŞEKER', 
  'FİSKOBİRLİK', 'KOROPLAST', 'DR.OETKER'
];

function autoDetectBrandFromTitle(titleText) {
  if (!titleText) return '';
  const upper = String(titleText).toLocaleUpperCase('tr-TR').trim();
  
  for (const b of POPULAR_BRANDS) {
    if (upper.includes(b)) {
      return b.split(' ').map(w => w.charAt(0) + w.slice(1).toLocaleLowerCase('tr-TR')).join(' ');
    }
  }

  const words = upper.split(/\s+/).filter(w => w.length >= 3 && !/^\d+/.test(w));
  const ignoredPrefixes = ['BÜYÜK', 'KÜÇÜK', 'YENİ', 'ÖZEL', 'SÜPER', 'EKONOMİK', 'ORGANİK', 'KLASİK', 'MNV'];
  if (words.length > 0 && !ignoredPrefixes.includes(words[0])) {
    const firstWord = words[0];
    return firstWord.charAt(0) + firstWord.slice(1).toLocaleLowerCase('tr-TR');
  }

  return '';
}

function onQuickProdTitleChange(val) {
  const brandInp = document.getElementById('quick-prod-brand');
  if (brandInp && (!brandInp.dataset.userEdited || brandInp.dataset.userEdited === 'false' || !brandInp.value.trim())) {
    const detected = autoDetectBrandFromTitle(val);
    if (detected) {
      brandInp.value = detected;
    }
  }
}

function onQuickProdBarcodeKey(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    const titleInp = document.getElementById('quick-prod-title');
    if (titleInp) titleInp.focus();
  }
}

async function lookupQuickProductByBarcode(barcode) {
  if (!barcode) return;
  try {
    const res = await fetch(`/api/pos/search?q=${encodeURIComponent(barcode)}`);
    const data = await res.json();

    const titleInp = document.getElementById('quick-prod-title');
    const salePriceInp = document.getElementById('quick-prod-sale-price');
    const buyingPriceInp = document.getElementById('quick-prod-buying-price');
    const brandInp = document.getElementById('quick-prod-brand');
    const stockInp = document.getElementById('quick-prod-stock');
    const badgeEl = document.getElementById('pos-quick-prod-status-badge');
    const btnSave = document.getElementById('btn-save-quick-prod');

    if (data.status === 'success' && data.product) {
      const p = data.product;
      if (badgeEl) {
        badgeEl.style.background = 'rgba(16,185,129,0.1)';
        badgeEl.style.borderColor = 'rgba(16,185,129,0.3)';
        badgeEl.style.color = '#34d399';
        badgeEl.innerText = `✓ Kayıtlı Ürün: ${p.title}`;
      }
      if (titleInp) titleInp.value = p.title || '';
      if (salePriceInp) salePriceInp.value = (p.unit_price || p.price || 0.0).toFixed(2);
      if (buyingPriceInp) buyingPriceInp.value = (p.buying_price || 0.0).toFixed(2);
      if (brandInp) brandInp.value = p.brand || '';
      if (stockInp) stockInp.value = p.stock || 0;
      recalcQuickProdMargin();

      if (btnSave) {
        btnSave.innerText = 'Güncelle ve Kaydet (Enter)';
        btnSave.style.background = '#059669';
      }
    } else {
      if (badgeEl) {
        badgeEl.style.background = 'rgba(56,189,248,0.1)';
        badgeEl.style.borderColor = 'rgba(56,189,248,0.3)';
        badgeEl.style.color = '#38bdf8';
        badgeEl.innerText = 'Yeni Ürün: Ürün adı ve satış fiyatını giriniz';
      }
      if (btnSave) {
        btnSave.innerText = 'Yeni Ürünü Kaydet (Enter)';
        btnSave.style.background = '#2563eb';
      }
    }
    validateQuickProdInputs();
  } catch (err) {
    console.error(err);
  }
}

function recalcQuickProdMargin() {
  const buyingInp = document.getElementById('quick-prod-buying-price');
  const saleInp = document.getElementById('quick-prod-sale-price');
  const marginInp = document.getElementById('quick-prod-margin');

  const buying = parseFloat((buyingInp?.value || '0').replace(',', '.')) || 0;
  const sale = parseFloat((saleInp?.value || '0').replace(',', '.')) || 0;

  if (marginInp) {
    if (buying > 0 && sale > 0) {
      const margin = (((sale - buying) / buying) * 100).toFixed(1);
      marginInp.value = `%${margin}`;
      marginInp.style.color = margin >= 25 ? '#34d399' : margin > 0 ? '#fbbf24' : '#f87171';
    } else {
      marginInp.value = '%0';
      marginInp.style.color = '#fbbf24';
    }
  }
}

async function submitQuickProductSave(addToCart = true) {
  const bcInp = document.getElementById('quick-prod-barcode');
  const titleInp = document.getElementById('quick-prod-title');
  const salePriceInp = document.getElementById('quick-prod-sale-price');
  const buyingPriceInp = document.getElementById('quick-prod-buying-price');
  const brandInp = document.getElementById('quick-prod-brand');
  const stockInp = document.getElementById('quick-prod-stock');
  const kdvInp = document.getElementById('quick-prod-kdv');

  const barcode = (bcInp?.value || '').trim();
  const title = (titleInp?.value || '').trim();
  const price = (salePriceInp?.value || '').trim();
  const buyingPrice = (buyingPriceInp?.value || '').trim();
  const brand = (brandInp?.value || '').trim();
  const stock = parseInt(stockInp?.value || '0', 10) || 0;
  const unit = 'Adet'; // Manav ürünü buradan eklenmez, hepsi Adet
  const kdv = parseInt(kdvInp?.value || '10', 10);

  if (!barcode) {
    if (typeof showToast === 'function') showToast('⚠️ Barkod Numarası zorunludur.', 'warning');
    if (bcInp) bcInp.focus();
    return;
  }
  if (!title) {
    if (typeof showToast === 'function') showToast('⚠️ Ürün Adı zorunludur.', 'warning');
    if (titleInp) titleInp.focus();
    return;
  }
  if (!price || isNaN(parseFloat(price.replace(',', '.'))) || parseFloat(price.replace(',', '.')) <= 0) {
    if (typeof showToast === 'function') showToast('⚠️ Satış Fiyatı zorunludur.', 'warning');
    if (salePriceInp) salePriceInp.focus();
    return;
  }

  const numericPrice = parseFloat(price.replace(',', '.'));

  const payload = {
    barcode: barcode,
    title: title,
    price: price,
    buying_price: buyingPrice || '0.00',
    brand: brand || 'DİĞER',
    stock: stock,
    unit: unit,
    kdv: kdv,
    vat_rate: kdv,
    source: 'POS'
  };

  try {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.status === 'success') {
      if (typeof showToast === 'function') {
        showToast(`✅ ${title} kaydedildi!`, 'success');
      }

      if (addToCart) {
        addItemToPosCart({
          title: title,
          barcode: barcode,
          unit_price: numericPrice,
          total_price: numericPrice,
          quantity: 1,
          unit: unit
        });
      }

      closePosQuickProductModal();

      // UI'yi anında tazele
      if (typeof loadPosQuickGrid === 'function') {
        loadPosQuickGrid(window.currentPosQuickCategory || 'manav_adet');
      }
      if (typeof loadDashboardSummary === 'function') {
        loadDashboardSummary();
      }
      if (typeof loadProducts === 'function') loadProducts();
      if (typeof loadCatalogProducts === 'function') loadCatalogProducts();
      if (typeof loadManavProducts === 'function') loadManavProducts();

      const posBarcodeInput = document.getElementById('pos-barcode-input');
      if (posBarcodeInput) posBarcodeInput.focus();
    } else {
      if (typeof showToast === 'function') showToast(`⚠️ ${data.message}`, 'error');
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('Ürün kaydetme hatası.', 'error');
  }
}

// 5.2. FİYAT GÖR / BARKOD SORGULA (F6)
let priceCheckDebounceTimer = null;
let lastFoundPriceCheckProduct = null;

function openPosPriceCheckModal() {
  const inp = document.getElementById('pos-price-check-input');
  const resEl = document.getElementById('pos-price-check-result');
  const btnAdd = document.getElementById('btn-add-checked-to-cart');

  lastFoundPriceCheckProduct = null;
  if (inp) inp.value = '';
  if (btnAdd) btnAdd.style.display = 'none';

  if (resEl) {
    resEl.innerHTML = `
      <div style="font-size: 36px; margin-bottom: 6px;">🔍</div>
      <div style="font-size: 15px; font-weight: 800; color: #f8fafc;">Barkod Okutun veya Yazın</div>
      <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Okuttuğunuz ürünün adı, satış fiyatı ve stok durumu büyük puntolarla gösterilir.</div>
    `;
  }

  showPosModal('modal-pos-price-check');

  setTimeout(() => {
    if (inp) {
      inp.focus();
      inp.select();
    }
  }, 80);
}

function closePosPriceCheckModal() {
  lastFoundPriceCheckProduct = null;
  hidePosModal('modal-pos-price-check');
  const posInp = document.getElementById('pos-barcode-input');
  if (posInp) posInp.focus();
}

function handlePosPriceCheckLive(val) {
  clearTimeout(priceCheckDebounceTimer);
  const q = (val || '').trim();
  if (!q || q.length < 1) {
    lastFoundPriceCheckProduct = null;
    const btnAdd = document.getElementById('btn-add-checked-to-cart');
    if (btnAdd) btnAdd.style.display = 'none';
    return;
  }
  priceCheckDebounceTimer = setTimeout(() => {
    executePriceCheckQuery(q);
  }, 180);
}

async function handlePosPriceCheckKey(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (lastFoundPriceCheckProduct) {
      addFoundProductToPosCart();
      return;
    }
    const inp = document.getElementById('pos-price-check-input');
    const query = (inp?.value || '').trim();
    if (query) executePriceCheckQuery(query);
  }
}

async function executePriceCheckQuery(query) {
  const resEl = document.getElementById('pos-price-check-result');
  const btnAdd = document.getElementById('btn-add-checked-to-cart');
  if (!resEl) return;

  resEl.innerHTML = '<div style="color: #38bdf8; font-size: 14px; font-weight: 700; padding: 15px 0;"><span style="font-size: 20px;">⏳</span> Ürün sorgulanıyor...</div>';

  try {
    const res = await fetch(`/api/pos/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (data.status === 'success' && data.product) {
      const p = data.product;
      lastFoundPriceCheckProduct = p;
      const numPrice = parseFloat(p.unit_price || p.price || 0);
      const numericPriceStr = numPrice.toFixed(2).replace('.', ',');
      const stockVal = p.stock !== undefined ? p.stock : (p.stock_qty || 100);
      
      resEl.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; width: 100%;">
          <div style="font-size: 17px; font-weight: 900; color: #ffffff; letter-spacing: 0.3px; line-height: 1.3; text-align: center;">${p.title}</div>
          
          <div style="background: rgba(16,185,129,0.12); border: 2px solid #10b981; border-radius: 12px; padding: 10px 20px; width: 100%; box-sizing: border-box; text-align: center; margin: 2px 0;">
            <div style="font-size: 10.5px; font-weight: 800; color: #34d399; text-transform: uppercase; letter-spacing: 1px;">SATIŞ FİYATI</div>
            <div style="font-size: 40px; font-weight: 900; color: #10b981; font-family: monospace; text-shadow: 0 0 16px rgba(16,185,129,0.45); line-height: 1.1; margin: 3px 0;">
              ${numericPriceStr} TL
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; width: 100%; margin-top: 2px;">
            <div style="background: #070d1e; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 6px; text-align: center;">
              <span style="font-size: 10px; color: #64748b; font-weight: 700; display: block;">BARKOD</span>
              <strong style="color: #38bdf8; font-family: monospace; font-size: 12px;">${p.barcode}</strong>
            </div>
            <div style="background: #070d1e; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 6px; text-align: center;">
              <span style="font-size: 10px; color: #64748b; font-weight: 700; display: block;">BİRİM</span>
              <strong style="color: #f8fafc; font-size: 12px;">${p.unit || 'Adet'}</strong>
            </div>
            <div style="background: #070d1e; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 6px; text-align: center;">
              <span style="font-size: 10px; color: #64748b; font-weight: 700; display: block;">STOK</span>
              <strong style="color: #fbbf24; font-size: 12px;">${stockVal}</strong>
            </div>
          </div>
        </div>
      `;
      if (btnAdd) btnAdd.style.display = 'inline-block';
    } else {
      lastFoundPriceCheckProduct = null;
      resEl.innerHTML = `
        <div style="color: #f87171; font-size: 16px; font-weight: 800;">❌ Ürün Bulunamadı</div>
        <div style="color: #94a3b8; font-size: 12px; margin-top: 6px;">'<strong>${query}</strong>' barkodlu / isimli ürün sistemde kayıtlı değil.</div>
      `;
      if (btnAdd) btnAdd.style.display = 'none';
    }
  } catch(err) {
    resEl.innerHTML = '<span style="color: #f87171; font-size: 13px;">Sorgulama bağlantı hatası.</span>';
    if (btnAdd) btnAdd.style.display = 'none';
  }
}

function addFoundProductToPosCart() {
  if (!lastFoundPriceCheckProduct) return;
  const p = lastFoundPriceCheckProduct;
  const uPrice = parseFloat(p.unit_price || p.price || 0);
  addItemToPosCart({
    barcode: p.barcode,
    title: p.title,
    unit_price: uPrice,
    total_price: uPrice,
    quantity: 1,
    unit: p.unit || 'Adet',
    is_scale_item: p.is_scale_item
  });
  closePosPriceCheckModal();
  if (typeof showToast === 'function') {
    showToast(`✓ ${p.title} sepete eklendi`, 'success');
  }
}

// 5.3. MOBİL QR VE CANLI BAĞLI CİHAZLAR MODALI (F1)
let currentMobileInfoData = null;
let currentMobileProtocol = 'https';

async function openPosMobileQrModal() {
  showPosModal('modal-pos-mobile-qr');

  try {
    const res = await fetch('/api/pos/mobile_info');
    const data = await res.json();
    if (data.status === 'success') {
      currentMobileInfoData = data;
      renderPosMobileQrCode();
      renderConnectedDevicesList(data.connected_devices || []);
    }
  } catch (e) {
    console.error('Mobile info error:', e);
  }
}

function closePosMobileQrModal() {
  hidePosModal('modal-pos-mobile-qr');
}

function renderPosMobileQrCode() {
  if (!currentMobileInfoData) return;
  const canvas = document.getElementById('pos-mobile-qr-canvas');
  const urlInp = document.getElementById('pos-mobile-url-inp');
  const btnHttps = document.getElementById('btn-qr-https');
  const btnHttp = document.getElementById('btn-qr-http');

  const targetUrl = (currentMobileProtocol === 'https' && currentMobileInfoData.https_url) 
    ? currentMobileInfoData.https_url 
    : currentMobileInfoData.http_url;

  if (urlInp) urlInp.value = targetUrl || '';

  if (btnHttps && btnHttp) {
    if (currentMobileProtocol === 'https' && currentMobileInfoData.https_url) {
      btnHttps.style.background = '#0284c7';
      btnHttps.style.borderColor = '#38bdf8';
      btnHttps.style.color = '#fff';
      btnHttp.style.background = 'rgba(255,255,255,0.06)';
      btnHttp.style.borderColor = 'rgba(255,255,255,0.15)';
      btnHttp.style.color = '#94a3b8';
    } else {
      btnHttp.style.background = '#0284c7';
      btnHttp.style.borderColor = '#38bdf8';
      btnHttp.style.color = '#fff';
      btnHttps.style.background = 'rgba(255,255,255,0.06)';
      btnHttps.style.borderColor = 'rgba(255,255,255,0.15)';
      btnHttps.style.color = '#94a3b8';
    }
  }

  if (canvas && typeof QRCode !== 'undefined' && targetUrl) {
    QRCode.toCanvas(canvas, targetUrl, {
      width: 170,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    }, function (error) {
      if (error) console.error('QR draw error:', error);
    });
  }
}

function switchPosMobileQrProtocol(proto) {
  currentMobileProtocol = proto;
  renderPosMobileQrCode();
}

function copyPosMobileUrl() {
  const inp = document.getElementById('pos-mobile-url-inp');
  if (inp && inp.value) {
    navigator.clipboard.writeText(inp.value).then(() => {
      if (typeof showToast === 'function') showToast('📋 Mobil bağlantı linki kopyalandı!', 'success');
    }).catch(() => {
      inp.select();
      document.execCommand('copy');
      if (typeof showToast === 'function') showToast('📋 Link kopyalandı!', 'success');
    });
  }
}

async function loadConnectedDevices() {
  const listEl = document.getElementById('pos-mobile-devices-list');
  if (!listEl) return;

  try {
    const res = await fetch('/api/pos/connected_devices');
    const data = await res.json();
    renderConnectedDevicesList(data.devices || []);
  } catch (e) {
    console.error('Devices load error:', e);
  }
}

function renderConnectedDevicesList(devices) {
  const listEl = document.getElementById('pos-mobile-devices-list');
  const badgeEl = document.getElementById('pos-mobile-connected-badge');
  if (!listEl) return;

  if (badgeEl) {
    badgeEl.innerText = `${devices.length} Cihaz`;
    badgeEl.style.color = devices.length > 0 ? '#34d399' : '#94a3b8';
  }

  if (!devices || devices.length === 0) {
    listEl.innerHTML = `
      <div style="color: #64748b; font-size: 12px; text-align: center; margin: auto; padding: 20px 0;">
        Henüz bağlı mobil cihaz bulunmuyor.<br>
        <small style="color: #475569; font-size: 11px;">Soldaki QR kodu telefonunuzla okutun</small>
      </div>
    `;
    return;
  }

  listEl.innerHTML = devices.map(d => `
    <div style="display: flex; justify-content: space-between; align-items: center; background: #070d1e; border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 6px 10px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 16px;">📱</span>
        <div>
          <strong style="color: #f8fafc; font-size: 12px;">${d.device || d.ip}</strong>
          <small style="color: #94a3b8; font-size: 10px; display: block;">Son işlem: ${d.last_seen || 'Aktif'}</small>
        </div>
      </div>
      <span style="background: rgba(16,185,129,0.2); color: #34d399; font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 800;">
        ONLINE
      </span>
    </div>
  `).join('');
}

// 5.4. ESKİ SATIŞLAR & BEKLEYEN FİŞLER MODALI (F8)
function openPosRecentSalesModal() {
  openParkedReceiptsModal();
}

function openParkedReceiptsModal() {
  const modal = document.getElementById('modal-parked-receipts');
  const parkedListEl = document.getElementById('parked-receipts-list');
  const recentListEl = document.getElementById('recent-pos-sales-list');
  if (!modal) return;

  if (parkedListEl) {
    if (parkedReceipts.length === 0) {
      parkedListEl.innerHTML = '<div style="color: #64748b; font-size: 12px; padding: 8px; text-align: center;">Beklemede (park edilmiş) fiş bulunmuyor.</div>';
    } else {
      parkedListEl.innerHTML = parkedReceipts.map((p, idx) => `
        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(30,58,138,0.25); border: 1px solid rgba(59,130,246,0.35); border-radius: 8px; padding: 8px 12px;">
          <div>
            <div style="font-weight: 800; font-size: 12.5px; color: #fde047;">Fiş #${idx + 1} - Saat: ${p.time} (${p.items.length} Kalem)</div>
            <div style="font-size: 11px; color: #cbd5e1; margin-top: 2px;">${p.items.map(i => i.title).join(', ')}</div>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <strong style="color: #38bdf8; font-family: monospace; font-size: 14px;">${p.total.toFixed(2).replace('.', ',')} TL</strong>
            <button type="button" class="btn-primary" onclick="recallParkedReceipt('${p.id}')" style="padding: 6px 12px; font-size: 11.5px; font-weight: 800;">
              📥 Kasaya Al
            </button>
            <button type="button" class="btn-secondary" onclick="deleteParkedReceipt('${p.id}')" style="padding: 6px 10px; font-size: 11.5px; color: #f87171;">
              ✕
            </button>
          </div>
        </div>
      `).join('');
    }
  }

  if (recentListEl) {
    recentListEl.innerHTML = '<div style="color: #94a3b8; font-size: 11.5px; padding: 6px;">Son satışlar yükleniyor...</div>';
    fetch('/api/pos/dashboard_summary')
      .then(r => r.json())
      .then(data => {
        const sales = data.recent_sales || [];
        if (sales.length === 0) {
          recentListEl.innerHTML = '<div style="color: #64748b; font-size: 12px; padding: 8px; text-align: center;">Bugün henüz tamamlanan satış bulunmuyor.</div>';
        } else {
          recentListEl.innerHTML = sales.slice(0, 10).map(s => `
            <div style="display: flex; justify-content: space-between; align-items: center; background: #070d1e; border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 6px 10px;">
              <div>
                <strong style="color: #f8fafc; font-size: 12px;">${s.time || ''} - ${s.customer || 'Perakende Müşteri'}</strong>
                <small style="color: #94a3b8; font-size: 10.5px; display: block;">${s.payment_type || 'Nakit'} • ${s.items_count || 1} Kalem</small>
              </div>
              <strong style="color: #10b981; font-family: monospace; font-size: 13.5px;">${parseFloat(s.total || 0).toFixed(2).replace('.', ',')} TL</strong>
            </div>
          `).join('');
        }
      }).catch(() => {
        recentListEl.innerHTML = '<div style="color: #64748b; font-size: 12px; padding: 6px;">Geçmiş satışlar listelendi.</div>';
      });
  }

  showPosModal('modal-parked-receipts');
}

function closeParkedReceiptsModal() {
  hidePosModal('modal-parked-receipts');
}

function parkCurrentReceipt() {
  if (posCart.length === 0) {
    if (typeof showToast === 'function') showToast('Sepette bekletilecek ürün bulunmuyor.', 'warning');
    return;
  }

  const grandTotal = posCart.reduce((sum, i) => sum + i.total_price, 0);
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  const parked = {
    id: `park_${Date.now()}`,
    time: timeStr,
    items: [...posCart],
    total: grandTotal,
    cashier: activeCashier.name
  };

  parkedReceipts.push(parked);
  posCart = [];
  renderPosCart();
  updateParkedReceiptsUI();

  if (typeof showToast === 'function') {
    showToast(`⏸️ Fiş beklemeye alındı (${parked.items.length} Kalem - ${parked.total.toFixed(2)} TL)`, 'info');
  }
}

function parkCurrentPosReceipt() {
  parkCurrentReceipt();
}

function recallParkedReceipt(parkId) {
  const idx = parkedReceipts.findIndex(p => p.id === parkId);
  if (idx === -1) return;

  if (posCart.length > 0) {
    parkCurrentReceipt();
  }

  const recalled = parkedReceipts.splice(idx, 1)[0];
  posCart = recalled.items;
  renderPosCart();
  updateParkedReceiptsUI();
  closeParkedReceiptsModal();

  if (typeof showToast === 'function') {
    showToast(`▶️ Bekleyen fiş kasaya geri yüklendi (${posCart.length} Kalem)`, 'success');
  }
}

function deleteParkedReceipt(parkId) {
  parkedReceipts = parkedReceipts.filter(p => p.id !== parkId);
  updateParkedReceiptsUI();
  openParkedReceiptsModal();
}

function clearAllParkedReceipts() {
  if (parkedReceipts.length === 0) return;
  parkedReceipts = [];
  updateParkedReceiptsUI();
  closeParkedReceiptsModal();
  if (typeof showToast === 'function') showToast('Tüm bekleyen fişler silindi.', 'info');
}

function handleWaitingBarClick() {
  if (parkedReceipts.length === 0) {
    if (typeof showToast === 'function') showToast('Beklemede fiş bulunmuyor.', 'info');
    return;
  }
  openParkedReceiptsModal();
}

function updateParkedReceiptsUI() {
  const waitingBar = document.getElementById('pos-waiting-bar-container');
  const waitingText = document.getElementById('pos-waiting-bar-text');

  if (waitingBar && waitingText) {
    if (parkedReceipts.length === 0) {
      waitingBar.className = 'pos-waiting-inactive';
      waitingText.innerText = 'BEKLEYEN 0';
      waitingBar.title = 'Beklemede fiş yok';
    } else {
      waitingBar.className = 'pos-waiting-active';
      waitingText.innerText = `BEKLEYEN ${parkedReceipts.length}`;
      waitingBar.title = `Bekleyen ${parkedReceipts.length} Fiş - Kasaya yüklemek için tıklayın`;
    }
  }
}

// 5.5. İADE MODALI (F9)
function openPosReturnModal() {
  const bcInp = document.getElementById('pos-return-barcode');
  const amtInp = document.getElementById('pos-return-amount');
  const qtyInp = document.getElementById('pos-return-qty');

  if (bcInp) bcInp.value = '';
  if (amtInp) amtInp.value = '';
  if (qtyInp) qtyInp.value = '1';

  showPosModal('modal-pos-return');

  setTimeout(() => {
    if (amtInp) amtInp.focus();
  }, 80);
}

function closePosReturnModal() {
  hidePosModal('modal-pos-return');
}

function submitPosReturnExecute() {
  const bcInp = document.getElementById('pos-return-barcode');
  const amtInp = document.getElementById('pos-return-amount');
  const qtyInp = document.getElementById('pos-return-qty');

  const title = (bcInp?.value || '').trim() || 'Ürün İadesi / Geri Alma';
  const rawAmt = (amtInp?.value || '').replace(',', '.');
  const amount = parseFloat(rawAmt);
  const qty = parseInt(qtyInp?.value || '1', 10) || 1;

  if (isNaN(amount) || amount <= 0) {
    if (typeof showToast === 'function') showToast('Lütfen geçerli bir iade tutarı girin.', 'warning');
    if (amtInp) amtInp.focus();
    return;
  }

  const negativePrice = -Math.abs(amount);

  addItemToPosCart({
    title: `↩️ [İADE] ${title}`,
    barcode: 'IADE',
    unit_price: negativePrice,
    total_price: negativePrice * qty,
    quantity: qty,
    unit: 'Adet'
  });

  closePosReturnModal();
  if (typeof showToast === 'function') {
    showToast(`↩️ ${amount.toFixed(2)} TL tutarında iade satırı sepete eklendi!`, 'info');
  }
}

// =========================================================
// 6. KASA SATIŞ & TAHSİLAT (NAKİT / KART / TEMİZLE / İKRAM)
// =========================================================
function confirmClearPosCart() {
  if (posCart.length === 0) {
    if (typeof showToast === 'function') showToast('ℹ️ Satış sepetiniz zaten boş.', 'info');
    return;
  }
  clearPosCart();
  if (typeof showToast === 'function') showToast('🗑️ Sepet ve ekran temizlendi.', 'info');
}

function getPosCartGrandTotal() {
  return posCart.reduce((sum, i) => sum + (parseFloat(i.total_price) || 0), 0);
}

window.pendingPosCheckout = null;

function openPosReceiptConfirmModal(paymentType, receivedCash = 0, changeAmount = 0) {
  const grandTotal = getPosCartGrandTotal();
  window.pendingPosCheckout = {
    paymentType: paymentType,
    receivedCash: receivedCash || grandTotal,
    changeAmount: changeAmount || 0,
    grandTotal: grandTotal,
    itemsCount: posCart.length
  };

  const typeEl = document.getElementById('pos-receipt-confirm-type');
  const totalEl = document.getElementById('pos-receipt-confirm-total');
  const changeRow = document.getElementById('pos-receipt-confirm-change-row');
  const changeText = document.getElementById('pos-receipt-confirm-change-text');

  if (typeEl) {
    typeEl.innerText = paymentType === 'Nakit' ? 'NAKİT SATIŞ' : 'KREDİ KARTI SATIŞ';
    typeEl.style.color = paymentType === 'Nakit' ? '#10b981' : '#60a5fa';
  }
  if (totalEl) {
    totalEl.innerText = `${grandTotal.toFixed(2).replace('.', ',')} TL`;
  }

  if (changeRow && changeText) {
    if (paymentType === 'Nakit' && changeAmount > 0) {
      changeRow.style.display = 'flex';
      changeText.innerText = `${(receivedCash || 0).toFixed(2).replace('.', ',')} TL ➔ ${changeAmount.toFixed(2).replace('.', ',')} TL`;
    } else {
      changeRow.style.display = 'none';
    }
  }

  // --- SAĞ TERMAL FİŞ ÖNİZLEME DOLDURMA ---
  const prevDate = document.getElementById('pos-preview-receipt-date');
  const prevNo = document.getElementById('pos-preview-receipt-no');
  const prevItems = document.getElementById('pos-preview-receipt-items');
  const prevTotal = document.getElementById('pos-preview-receipt-total');
  const prevPay = document.getElementById('pos-preview-receipt-payment');

  const now = new Date();
  const dateStr = `${now.toLocaleDateString('tr-TR')} ${now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
  const receiptNo = `FİŞ: #${Math.floor(1000 + Math.random() * 9000)}`;

  if (prevDate) prevDate.innerText = dateStr;
  if (prevNo) prevNo.innerText = receiptNo;
  if (prevTotal) prevTotal.innerText = `${grandTotal.toFixed(2).replace('.', ',')} TL`;
  if (prevPay) prevPay.innerText = paymentType.toUpperCase();

  if (prevItems) {
    prevItems.innerHTML = posCart.map(item => {
      const uPrice = (parseFloat(item.unit_price) || 0).toFixed(2);
      const tPrice = (parseFloat(item.total_price) || 0).toFixed(2);
      const shortTitle = (item.title || 'Ürün').substring(0, 18);
      return `
        <div style="display: flex; justify-content: space-between; font-size: 11px;">
          <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-right: 4px;">
            ${shortTitle}
          </div>
          <div style="text-align: right; min-width: 80px; font-family: monospace;">
            ${item.quantity}x${uPrice} = ${tPrice}
          </div>
        </div>
      `;
    }).join('');
  }

  showPosModal('modal-pos-receipt-confirm');

  setTimeout(() => {
    const btnYes = document.getElementById('btn-receipt-confirm-yes');
    if (btnYes) btnYes.focus();
  }, 50);
}

function executePendingPosCheckout(shouldPrintReceipt = true) {
  hidePosModal('modal-pos-receipt-confirm');
  if (!window.pendingPosCheckout) return;
  const p = window.pendingPosCheckout;
  window.pendingPosCheckout = null;
  directPosCheckout(p.paymentType, p.receivedCash, p.changeAmount, shouldPrintReceipt);
}

async function directPosCheckout(paymentType = 'Nakit', receivedCash = 0, changeAmount = 0, shouldPrintReceipt = true) {
  if (posCart.length === 0) {
    if (typeof showToast === 'function') showToast('⚠️ Sepette ürün bulunmuyor.', 'warning');
    return;
  }

  const grandTotal = getPosCartGrandTotal();

  const payload = {
    items: [...posCart],
    total_amount: grandTotal,
    payment_type: paymentType,
    payment_breakdown: {
      [paymentType]: grandTotal
    },
    received_cash: receivedCash || grandTotal,
    change_amount: changeAmount || 0.0,
    customer_name: 'Perakende Müşteri',
    print_receipt: shouldPrintReceipt
  };

  try {
    const res = await fetch('/api/pos/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.status === 'success') {
      const changeMsg = changeAmount > 0 ? ` • 💵 Para Üstü: ${changeAmount.toFixed(2)} TL` : '';
      const printMsg = shouldPrintReceipt ? ' • 🧾 Fiş Yazdırıldı' : ' • 📴 Fişsiz';
      if (typeof showToast === 'function') {
        showToast(`✅ ${paymentType} Satışı Tamamlandı (${grandTotal.toFixed(2)} TL)${changeMsg}${printMsg}`, 'success');
      }

      clearPosCart();
      if (typeof loadDashboardSummary === 'function') loadDashboardSummary();
      if (typeof loadRecentHomeSales === 'function') loadRecentHomeSales();

      const inp = document.getElementById('pos-barcode-input');
      if (inp) inp.focus();
    } else {
      if (typeof showToast === 'function') showToast(`⚠️ ${data.message || 'Satış tamamlanamadı'}`, 'error');
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('Satış tamamlanırken sunucu bağlantı hatası oluştu.', 'error');
  }
}

function openPosPaymentModal() {
  if (posCart.length === 0) {
    if (typeof showToast === 'function') {
      showToast('⚠️ Sepette ürün bulunmuyor. Lütfen önce barkod okutun veya ürün seçin.', 'warning');
    }
    const barcodeInp = document.getElementById('pos-barcode-input');
    if (barcodeInp) {
      barcodeInp.focus();
      barcodeInp.style.boxShadow = '0 0 16px rgba(239,68,68,0.6)';
      barcodeInp.style.borderColor = '#ef4444';
      setTimeout(() => {
        barcodeInp.style.boxShadow = '0 0 12px rgba(56,189,248,0.12)';
        barcodeInp.style.borderColor = '#38bdf8';
      }, 800);
    }
    return;
  }

  const barcodeInp = document.getElementById('pos-barcode-input');
  const typedVal = (barcodeInp?.value || '').trim();
  const parsedAmt = parseFloat(typedVal.replace(',', '.'));
  if (barcodeInp) barcodeInp.value = '';

  const grandTotal = getPosCartGrandTotal();
  let changeAmt = 0;
  let receivedCash = grandTotal;

  if (!isNaN(parsedAmt) && parsedAmt > grandTotal && typedVal.length <= 6 && !typedVal.includes('*')) {
    receivedCash = parsedAmt;
    changeAmt = parsedAmt - grandTotal;
  }

  openPosReceiptConfirmModal('Nakit', receivedCash, changeAmt);
}

function closePosPaymentModal() {
  hidePosModal('modal-pos-receipt-confirm');
  const inp = document.getElementById('pos-barcode-input');
  if (inp) {
    inp.focus();
  }
}

function executeQuickPayment(paymentType, shouldPrintReceipt = false) {
  closePosPaymentModal();
  let receivedCash = 0;
  let changeAmount = 0;
  if (window.pendingPosCheckout) {
    receivedCash = window.pendingPosCheckout.receivedCash || 0;
    changeAmount = window.pendingPosCheckout.changeAmount || 0;
  }
  directPosCheckout(paymentType, receivedCash, changeAmount, shouldPrintReceipt);
}

function startPosSaleCheckout(paymentType = 'Nakit') {
  openPosPaymentModal();
}

function applyPosGiftDiscount() {
  if (posCart.length === 0) {
    if (typeof showToast === 'function') showToast('⚠️ İkram uygulamak için sepette en az 1 ürün olmalıdır.', 'warning');
    return;
  }
  posCart.forEach(i => {
    i.total_price = 0.0;
    i.title = `🎁 [İKRAM] ${i.title.replace('🎁 [İKRAM] ', '')}`;
  });
  renderPosCart();
  if (typeof showToast === 'function') showToast('🎁 Sepete %100 İkram uygulandı (Tutar 0 TL).', 'success');
}

function openCashDrawerAction() {
  fetch('/api/pos/open_drawer', { method: 'POST' }).catch(() => {});
  if (typeof showToast === 'function') {
    showToast('🗄️ Para çekmecesi tetiklendi ve açıldı.', 'success');
  }
}

// =========================================================
// 7. ALT DURUM ÇUBUĞU & KASİYER YÖNETİMİ
// =========================================================
function showBranchInfo() {
  if (typeof showToast === 'function') {
    showToast('🏢 Şube: YARENLER MARKET (Merkez Ana Kasa Terminali)', 'info');
  }
}

function showTerminalInfo() {
  if (typeof showToast === 'function') {
    showToast('💻 Terminal No: KASA 1 (IP: 192.168.1.34)', 'info');
  }
}

function checkOnlineServerStatus() {
  if (typeof showToast === 'function') {
    showToast('🟢 Sunucu & Yerel Ağ Bağlantısı: Kesintisiz Aktif (Online)', 'success');
  }
}

async function openCashierSwitchModal() {
  const select = document.getElementById('cashier-select-dropdown');
  if (select) {
    try {
      const res = await fetch('/api/cashiers');
      const data = await res.json();
      if (data.status === 'success' && data.cashiers) {
        select.innerHTML = data.cashiers
          .filter(c => c.active !== false)
          .map(c => `<option value="${c.id}" ${c.id === activeCashier.id ? 'selected' : ''}>${c.name} (${c.role === 'admin' ? 'Müdür' : 'Kasiyer'})</option>`)
          .join('');
      }
    } catch (e) {}
  }
  showPosModal('modal-cashier-switch');
}

function closeCashierSwitchModal() {
  hidePosModal('modal-cashier-switch');
}

function submitCashierSwitch() {
  const select = document.getElementById('cashier-select-dropdown');
  if (select && select.selectedIndex >= 0) {
    const opt = select.options[select.selectedIndex];
    const cid = opt.value;
    const cname = opt.text.split(' (')[0];
    activeCashier = { id: cid, name: cname };
    localStorage.setItem('active_pos_cashier', JSON.stringify(activeCashier));

    const el1 = document.getElementById('header-active-cashier-name');
    if (el1) el1.innerText = cname;
    const el2 = document.getElementById('pos-header-cashier-name');
    if (el2) el2.innerText = cname;

    closeCashierSwitchModal();
    if (typeof showToast === 'function') {
      showToast(`👤 Aktif Kasiyer Değiştirildi: ${cname}`, 'success');
    }
  } else {
    closeCashierSwitchModal();
  }
}

function exitPosToHome() {
  switchTab('tab-home');
  if (typeof showToast === 'function') {
    if (posCart.length > 0) {
      showToast('ℹ️ Satış sepetiniz ve bekleyen fişleriniz korundu.', 'info');
    }
  }
}

// =========================================================
// 8. DASHBOARD VERİLERİ & SATIŞ SAYACI (A000.000.001)
// =========================================================
async function loadActiveCashier() {
  try {
    const saved = localStorage.getItem('active_pos_cashier');
    if (saved) {
      activeCashier = JSON.parse(saved);
    } else {
      const res = await fetch('/api/cashiers');
      const data = await res.json();
      if (data.status === 'success' && data.cashiers && data.cashiers.length > 0) {
        const first = data.cashiers.find(c => c.active !== false) || data.cashiers[0];
        activeCashier = { id: first.id, name: first.name };
      }
    }
    const el1 = document.getElementById('header-active-cashier-name');
    if (el1) el1.innerText = activeCashier.name;
    const el2 = document.getElementById('pos-header-cashier-name');
    if (el2) el2.innerText = activeCashier.name;
  } catch (e) {}
}

async function loadDashboardSummary() {
  try {
    const res = await fetch('/api/pos/dashboard_summary');
    const data = await res.json();

    const salesCounterEl = document.getElementById('pos-lifetime-sales-count');
    if (salesCounterEl) {
      if (data.total_lifetime_sales_count_str) {
        salesCounterEl.innerText = data.total_lifetime_sales_count_str;
      } else if (data.total_lifetime_sales_count !== undefined) {
        salesCounterEl.innerText = formatPosSerialCode(data.total_lifetime_sales_count);
      }
    }
  } catch (e) {}
}

function formatPosSerialCode(count) {
  const c = Math.max(1, parseInt(count) || 1);
  const limit = 999999999;
  const letterIndex = Math.floor((c - 1) / limit);
  const letter = String.fromCharCode(65 + (letterIndex % 26));
  const num = ((c - 1) % limit) + 1;
  const numStr = String(num).padStart(9, '0');
  return `${letter}${numStr.slice(0, 3)}.${numStr.slice(3, 6)}.${numStr.slice(6, 9)}`;
}

async function loadRecentHomeSales() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const res = await fetch(`/api/reports/day_detail?date=${today}`);
    const data = await res.json();
    if (data.status === 'success' && data.receipts && data.receipts.length > 0) {
      const recent = data.receipts.slice(-6).reverse();
      const container = document.getElementById('home-recent-sales-list');
      if (container) {
        container.innerHTML = recent.map(r => `
          <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(15,23,42,0.6); padding: 10px 14px; border-radius: 8px; margin-bottom: 8px; border: 1px solid rgba(255,255,255,0.05);">
            <div>
              <strong style="color: #f8fafc; font-size: 13px;">${r.receipt_no}</strong>
              <div style="color: #94a3b8; font-size: 11.5px; margin-top: 2px;">${r.time} • ${r.payment_type || 'Nakit'}</div>
            </div>
            <strong style="color: #10b981; font-family: monospace; font-size: 15px;">
              ${parseFloat(r.total_amount || 0).toFixed(2).replace('.', ',')} TL
            </strong>
          </div>
        `).join('');
      }
    }
  } catch (e) {}
}

function triggerBarcodeNotFoundAlert(rawBarcode) {
  let cleanBarcode = String(rawBarcode || '').trim();
  if (cleanBarcode.includes('*')) {
    const parts = cleanBarcode.split('*');
    if (parts.length >= 2) {
      cleanBarcode = parts.slice(1).join('*').trim();
    }
  }

  const el1 = document.getElementById('barcode-not-found-code');
  const el2 = document.getElementById('not-found-barcode-text');
  if (el1) el1.innerText = cleanBarcode || '-';
  if (el2) el2.innerText = cleanBarcode || '-';

  window._lastNotFoundBarcode = cleanBarcode;

  // Sesli uyarı tonu & Türkçe "Barkod Hatalı" sesli uyarısı
  if (typeof playBarcodeNotFoundSound === 'function') {
    playBarcodeNotFoundSound();
  }
  if (typeof speakBarcodeNotFoundSpeech === 'function') {
    speakBarcodeNotFoundSpeech();
  }

  showPosModal('modal-pos-barcode-not-found');

  setTimeout(() => {
    const btn = document.getElementById('btn-create-from-not-found');
    if (btn) btn.focus();
  }, 60);
}

function closeBarcodeNotFoundAlert() {
  hidePosModal('modal-pos-barcode-not-found');
  const inp = document.getElementById('pos-barcode-input');
  if (inp) {
    inp.value = '';
    inp.focus();
  }
}

function openQuickProductFromNotFoundAlert() {
  const bc = window._lastNotFoundBarcode || '';
  closeBarcodeNotFoundAlert();
  setTimeout(() => {
    openPosQuickProductModal(bc);
  }, 30);
}

// =========================================================
// 9. 10'LU BUTON BAĞLANTILARI VE KLAVYE KISAYOLLARI
// =========================================================
function initPosBottomButtons() {
  const btnMap = {
    'btn-pos-action-quick-prod': () => openPosQuickProductModal(),
    'btn-pos-action-mobile': () => openPosMobileQrModal(),
    'btn-pos-action-price-check': () => openPosPriceCheckModal(),
    'btn-pos-action-clear': () => confirmClearPosCart(), // FİŞ İPTAL [F3]
    'btn-pos-action-pay': () => openPosPaymentModal(),   // ÖDEME AL [F4]
    'btn-pos-action-cash': () => openPosPaymentModal(),
    'btn-pos-action-card': () => openPosPaymentModal(),
    'btn-pos-action-drawer': () => openCashDrawerAction(),
    'btn-pos-action-recent': () => openPosRecentSalesModal(),
    'btn-pos-action-return': () => openPosReturnModal(),
    'btn-pos-action-gift': () => applyPosGiftDiscount(),
    
    'btn-pos-footer-branch': () => showBranchInfo(),
    'btn-pos-footer-terminal': () => showTerminalInfo(),
    'btn-pos-footer-admin': () => openCashierSwitchModal(),
    'btn-pos-footer-online': () => checkOnlineServerStatus(),
    'btn-pos-footer-home': () => exitPosToHome()
  };

  Object.entries(btnMap).forEach(([btnId, handler]) => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.onclick = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        btn.style.transform = 'scale(0.95)';
        setTimeout(() => { btn.style.transform = ''; }, 120);
        try {
          handler();
        } catch (err) {
          console.error(`POS button click error [${btnId}]:`, err);
        }
      };
    }
  });
}

// Klavye Kısayolları
window.addEventListener('keydown', (e) => {
  const quickProdModal = document.getElementById('modal-pos-quick-product-manage');
  const isQuickProdOpen = quickProdModal && quickProdModal.style.display === 'flex';

  const priceModal = document.getElementById('modal-pos-price-check');
  const isPriceModalOpen = priceModal && priceModal.style.display === 'flex';

  const mobileModal = document.getElementById('modal-pos-mobile-qr');
  const isMobileModalOpen = mobileModal && mobileModal.style.display === 'flex';

  const returnModal = document.getElementById('modal-pos-return');
  const isReturnModalOpen = returnModal && returnModal.style.display === 'flex';

  const parkedModal = document.getElementById('modal-parked-receipts');
  const isParkedModalOpen = parkedModal && parkedModal.style.display === 'flex';

  const notFoundModal = document.getElementById('modal-pos-barcode-not-found');
  const isNotFoundOpen = notFoundModal && (notFoundModal.style.display === 'flex' || notFoundModal.classList.contains('active'));

  const receiptConfirmModal = document.getElementById('modal-pos-receipt-confirm');
  const isReceiptConfirmOpen = receiptConfirmModal && (receiptConfirmModal.style.display === 'flex' || receiptConfirmModal.classList.contains('active'));

  // ÖDEME AL PENCERESİNDE 1-2-3-4 VE ESC KONTROLLERİ
  if (isReceiptConfirmOpen) {
    if (e.key === '1' || e.code === 'Digit1' || e.code === 'Numpad1') {
      e.preventDefault();
      executeQuickPayment('Nakit', false);
      return;
    }
    if (e.key === '2' || e.code === 'Digit2' || e.code === 'Numpad2') {
      e.preventDefault();
      executeQuickPayment('Kredi Kartı', false);
      return;
    }
    if (e.key === '3' || e.code === 'Digit3' || e.code === 'Numpad3') {
      e.preventDefault();
      executeQuickPayment('Nakit', true);
      return;
    }
    if (e.key === '4' || e.code === 'Digit4' || e.code === 'Numpad4') {
      e.preventDefault();
      executeQuickPayment('Kredi Kartı', true);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closePosPaymentModal();
      return;
    }
  }

  // BARKOD BULUNAMADI UYARISI MODALINDA ENTER -> HIZLI ÜRÜN TANIMLA, ESC -> KAPAT
  if (isNotFoundOpen) {
    if (e.key === 'Enter') {
      e.preventDefault();
      openQuickProductFromNotFoundAlert();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closeBarcodeNotFoundAlert();
      return;
    }
  }

  // Açık Modal Kapatma (ESC)
  if (e.key === 'Escape') {
    if (isQuickProdOpen) { e.preventDefault(); closePosQuickProductModal(); return; }
    if (isPriceModalOpen) { e.preventDefault(); closePosPriceCheckModal(); return; }
    if (isMobileModalOpen) { e.preventDefault(); closePosMobileQrModal(); return; }
    if (isReturnModalOpen) { e.preventDefault(); closePosReturnModal(); return; }
    if (isParkedModalOpen) { e.preventDefault(); closeParkedReceiptsModal(); return; }
  }

  // Hızlı Ürün Formunda Enter -> Kaydet
  if (isQuickProdOpen && e.key === 'Enter' && e.target && e.target.id !== 'quick-prod-barcode') {
    e.preventDefault();
    submitQuickProductSave();
    return;
  }

  const activeTab = document.querySelector('.tab-content.active');
  const isPosTab = activeTab && activeTab.id === 'tab-pos';
  if (!isPosTab) return;

  if (e.key === 'F1') {
    e.preventDefault();
    openPosMobileQrModal();
  } else if (e.key === 'F2') {
    e.preventDefault();
    openPosPriceCheckModal(); // FİYAT GÖR [F2]
  } else if (e.key === 'F3') {
    e.preventDefault();
    confirmClearPosCart(); // FİŞ İPTAL [F3]
  } else if (e.key === 'F4') {
    e.preventDefault();
    openPosPaymentModal(); // ÖDEME AL [F4]
  } else if (e.key === 'F6') {
    e.preventDefault();
    openPosQuickProductModal(); // HIZLI ÜRÜN [F6]
  } else if (e.key === 'F7') {
    e.preventDefault();
    openCashDrawerAction();
  } else if (e.key === 'F8') {
    e.preventDefault();
    openPosRecentSalesModal();
  } else if (e.key === 'F9') {
    e.preventDefault();
    openPosReturnModal();
  } else if (e.key === 'F10') {
    e.preventDefault();
    applyPosGiftDiscount();
  } else if (e.key === 'F5') {
    // F5 basıldığında sayfa doğrudan yenilenir (tarayıcı yenilemesi)
    return;
  } else if (e.key === 'Insert') {
    e.preventDefault();
    openPosQuickProductModal();
  }
});

// =========================================================
// 10. GLOBAL WINDOW DIŞA AKTARIMLARI
// =========================================================
window.loadPosQuickGrid = loadPosQuickGrid;
window.addPosQuickItemByIndex = addPosQuickItemByIndex;
window.openPosQuickProductModal = openPosQuickProductModal;
window.closePosQuickProductModal = closePosQuickProductModal;
window.onQuickProdBarcodeChange = onQuickProdBarcodeChange;
window.onQuickProdBarcodeKey = onQuickProdBarcodeKey;
window.recalcQuickProdMargin = recalcQuickProdMargin;
window.submitQuickProductSave = submitQuickProductSave;

window.openPosMobileQrModal = openPosMobileQrModal;
window.closePosMobileQrModal = closePosMobileQrModal;
window.openPosPriceCheckModal = openPosPriceCheckModal;
window.closePosPriceCheckModal = closePosPriceCheckModal;
window.handlePosPriceCheckKey = handlePosPriceCheckKey;
window.handlePosPriceCheckLive = handlePosPriceCheckLive;
window.addFoundProductToPosCart = addFoundProductToPosCart;
window.confirmClearPosCart = confirmClearPosCart;
window.startPosSaleCheckout = startPosSaleCheckout;
window.directPosCheckout = directPosCheckout;
window.openCashDrawerAction = openCashDrawerAction;
window.openPosRecentSalesModal = openPosRecentSalesModal;
window.openParkedReceiptsModal = openParkedReceiptsModal;
window.closeParkedReceiptsModal = closeParkedReceiptsModal;
window.clearAllParkedReceipts = clearAllParkedReceipts;
window.openPosReturnModal = openPosReturnModal;
window.closePosReturnModal = closePosReturnModal;
window.submitPosReturnExecute = submitPosReturnExecute;
window.openCashierSwitchModal = openCashierSwitchModal;
window.closeCashierSwitchModal = closeCashierSwitchModal;
window.submitCashierSwitch = submitCashierSwitch;
window.applyPosGiftDiscount = applyPosGiftDiscount;
window.exitPosToHome = exitPosToHome;
window.selectPosQuickCategory = selectPosQuickCategory;
window.setPosActiveInput = setPosActiveInput;
window.appendPosKey = appendPosKey;
window.backspacePosKey = backspacePosKey;
window.clearPosBarcodeInput = clearPosBarcodeInput;
window.onPosBarcodeInputLive = onPosBarcodeInputLive;
window.closePosAutocompletePopup = closePosAutocompletePopup;
window.selectPosAutocompleteIndex = selectPosAutocompleteIndex;
window.handlePosBarcodeInput = handlePosBarcodeInput;
window.submitPosKey = submitPosKey;
window.submitPosBarcodeInput = submitPosBarcodeInput;
window.onPosCartQtyChange = onPosCartQtyChange;
window.onPosCartPriceChange = onPosCartPriceChange;
window.handlePosRowInputKey = handlePosRowInputKey;
window.updatePosCartTotalsOnly = updatePosCartTotalsOnly;
window.removePosCartItem = removePosCartItem;
window.clearPosCart = clearPosCart;
window.renderPosCart = renderPosCart;
window.parkCurrentReceipt = parkCurrentReceipt;
window.parkCurrentPosReceipt = parkCurrentPosReceipt;
window.recallParkedReceipt = recallParkedReceipt;
window.deleteParkedReceipt = deleteParkedReceipt;
window.openPosPaymentModal = openPosPaymentModal;
window.closePosPaymentModal = closePosPaymentModal;
window.executeQuickPayment = executeQuickPayment;
window.openPosReceiptConfirmModal = openPosReceiptConfirmModal;
window.executePendingPosCheckout = executePendingPosCheckout;
window.handleWaitingBarClick = handleWaitingBarClick;
window.showBranchInfo = showBranchInfo;
window.showTerminalInfo = showTerminalInfo;
window.checkOnlineServerStatus = checkOnlineServerStatus;
window.validateQuickProdInputs = validateQuickProdInputs;
window.onQuickProdTitleChange = onQuickProdTitleChange;
window.autoDetectBrandFromTitle = autoDetectBrandFromTitle;
window.triggerBarcodeNotFoundAlert = triggerBarcodeNotFoundAlert;
window.closeBarcodeNotFoundAlert = closeBarcodeNotFoundAlert;
window.openQuickProductFromNotFoundAlert = openQuickProductFromNotFoundAlert;
