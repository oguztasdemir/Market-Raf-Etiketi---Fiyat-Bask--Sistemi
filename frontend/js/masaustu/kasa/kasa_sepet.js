// -*- coding: utf-8 -*-
/**
 * KASA SEPET & NUMPAD MOTORU (kasa_sepet.js)
 */

// -*- coding: utf-8 -*-
/**
 * =========================================================================
 * CORTEX POS - HIZLI SATIŞ KASA TERMİNALİ VE MOTORU (KASA_PANELI.JS)
 * =========================================================================
 */

// Global State
var posCart = window.posCart || (window.posCart = []);
var parkedReceipts = window.parkedReceipts || (window.parkedReceipts = []);
var activeCashier = window.activeCashier || (window.activeCashier = { id: 'kasa1', name: 'Kasa 1 (Kasiyer 1)' });
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
  loadParkedReceiptsFromStorage();
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
  clearTimeout(autocompleteDebounceTimer);
  closePosAutocompletePopup();
  const inp = getPosTargetInput();
  if (!inp) return;
  inp.value = '';
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

  // SADECE METİN / HARF ARAMALARINDA LİSTELE (Sayı / Barkod yazılırken veya okutulurken ASLA liste açma)
  const isOnlyDigits = /^\d+$/.test(queryText.replace(/[\s\.\,\*\-]/g, ''));
  if (queryText.length < 2 || isOnlyDigits) {
    closePosAutocompletePopup();
    return;
  }

  autocompleteDebounceTimer = setTimeout(async () => {
    const currentInp = document.getElementById('pos-barcode-input');
    if (!currentInp || !currentInp.value.trim()) {
      closePosAutocompletePopup();
      return;
    }
    const currentRaw = currentInp.value.trim();
    let currentQuery = currentRaw;
    if (currentRaw.includes('*')) {
      const parts = currentRaw.split('*');
      if (parts.length >= 2) currentQuery = parts.slice(1).join('*').trim();
    }
    if (/^\d+$/.test(currentQuery.replace(/[\s\.\,\*\-]/g, ''))) {
      closePosAutocompletePopup();
      return;
    }

    try {
      const res = await fetch(`/api/pos/autocomplete?q=${encodeURIComponent(queryText)}`);
      const data = await res.json();
      if (data.status === 'success' && data.results && data.results.length > 0) {
        const checkInp = document.getElementById('pos-barcode-input');
        if (!checkInp || !checkInp.value.trim()) {
          closePosAutocompletePopup();
          return;
        }
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
  clearTimeout(autocompleteDebounceTimer);
  const popup = document.getElementById('pos-autocomplete-popup');
  if (popup) popup.style.display = 'none';
  currentAutocompleteResults = [];
  activeAutocompleteIndex = -1;
}

function selectPosAutocompleteIndex(index) {
  clearTimeout(autocompleteDebounceTimer);
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
  clearTimeout(autocompleteDebounceTimer);
  closePosAutocompletePopup();
  const inp = document.getElementById('pos-barcode-input');
  if (!inp || !inp.value.trim()) return;

  const rawVal = inp.value.trim();
  inp.value = '';

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
    clearTimeout(autocompleteDebounceTimer);
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
  // Eğer personel molada veya çıkış yapmışsa kasayı koru ve PIN doğrulaması iste
  if (typeof currentEmployeeShiftState !== 'undefined' && (currentEmployeeShiftState.status === 'on_break' || currentEmployeeShiftState.status === 'off')) {
    window.pendingPosBarcodeAfterUnlock = { query, qty };
    if (typeof showToast === 'function') {
      showToast('🔒 Kasa kilitli / Personel molada. Lütfen PIN kodunuzu girerek göreve başlayın.', 'warning');
    }
    openCashierSwitchModal();
    return;
  }

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
    } else {
      triggerBarcodeNotFoundAlert(query);
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('Ürün arama hatası.', 'error');
  }
}

function addItemToPosCart(prod) {
  // Eğer personel molada veya çıkış yapmışsa kasayı koru ve PIN doğrulaması iste
  if (typeof currentEmployeeShiftState !== 'undefined' && (currentEmployeeShiftState.status === 'on_break' || currentEmployeeShiftState.status === 'off')) {
    window.pendingPosItemAfterUnlock = prod;
    if (typeof showToast === 'function') {
      showToast('🔒 Kasa kilitli / Personel molada. Lütfen PIN kodunuzu girerek göreve başlayın.', 'warning');
    }
    openCashierSwitchModal();
    return;
  }

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
    itemTitle = `1TL #${countOneLira}`;
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
          <tr class="pos-cart-row" style="border-bottom: 1px solid rgba(255,255,255,0.07); animation: fadeIn 0.15s ease;">
            <!-- 1. Ürün Adı -->
            <td class="pos-cart-title-cell" style="padding: 6px 10px; font-weight: 700; border-right: 1px solid rgba(255,255,255,0.06);">
              <span style="color: #0284c7; font-size: 10.5px; font-weight: 800; margin-right: 4px;">#${idx+1}</span>
              <span class="pos-cart-item-title">${item.title}</span>
            </td>

            <!-- 2. Miktar -->
            <td style="padding: 4px 6px; text-align: center; border-right: 1px solid rgba(255,255,255,0.06);">
              <input type="text" inputmode="decimal" id="cart-qty-${item.id}" value="${item.quantity}"
                     class="pos-cart-input-qty"
                     onfocus="setPosActiveInput(this); this.select();"
                     oninput="onPosCartQtyChange('${item.id}', this.value)"
                     onkeydown="handlePosRowInputKey(event, '${item.id}')"
                     style="width: 68px; padding: 5px 6px; border-radius: 6px; font-weight: 900; font-size: 13.5px; text-align: center; outline: none; box-sizing: border-box;">
            </td>

            <!-- 3. Birim Adı -->
            <td class="pos-cart-unit-cell" style="padding: 6px 8px; text-align: center; font-weight: 700; border-right: 1px solid rgba(255,255,255,0.06); font-size: 12px;">
              ${item.unit}
            </td>

            <!-- 4. Birim Fiyat -->
            <td style="padding: 4px 6px; text-align: right; border-right: 1px solid rgba(255,255,255,0.06);">
              <input type="text" inputmode="decimal" id="cart-price-${item.id}" value="${item.unit_price.toFixed(2)}"
                     class="pos-cart-input-price"
                     onfocus="setPosActiveInput(this); this.select();"
                     oninput="onPosCartPriceChange('${item.id}', this.value)"
                     onkeydown="handlePosRowInputKey(event, '${item.id}')"
                     style="width: 75px; padding: 5px 6px; border-radius: 6px; font-weight: 800; font-size: 13px; text-align: right; outline: none; box-sizing: border-box; font-family: monospace;">
            </td>

            <!-- 5. Ürün Tutarı -->
            <td style="padding: 6px 8px; text-align: right; font-weight: 900; font-family: monospace; font-size: 14px; color: #059669; border-right: 1px solid rgba(255,255,255,0.06);" id="row-total-${item.id}">
              ${item.total_price.toFixed(2).replace('.', ',')} TL
            </td>

            <!-- 6. Sil İşlemi -->
            <td style="padding: 4px 4px; text-align: center;">
              <button type="button" onclick="removePosCartItem('${item.id}')" 
                      class="pos-cart-delete-btn"
                      style="background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.3); color: #ef4444; width: 26px; height: 26px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 900;" title="Sil">
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

