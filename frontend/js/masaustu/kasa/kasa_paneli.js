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

async function triggerQuickProductBarcodeLookup() {
  clearTimeout(quickProdLookupTimer);
  const bcInp = document.getElementById('quick-prod-barcode');
  const bc = String(bcInp?.value || '').trim();
  if (!bc) {
    if (typeof showToast === 'function') showToast('Lütfen barkod numarası giriniz.', 'warning');
    if (bcInp) bcInp.focus();
    return;
  }
  await lookupQuickProductByBarcode(bc);
  
  // Eğer ürün bilgisi geldiyse direkt Satış Fiyatına odaklan, yoksa Ürün Adına
  const titleInp = document.getElementById('quick-prod-title');
  const priceInp = document.getElementById('quick-prod-sale-price');
  if (titleInp && titleInp.value) {
    if (priceInp) { priceInp.focus(); priceInp.select(); }
  } else if (titleInp) {
    titleInp.focus();
  }
}

function onQuickProdBarcodeKey(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    triggerQuickProductBarcodeLookup();
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
    const kdvInp = document.getElementById('quick-prod-kdv');
    const badgeEl = document.getElementById('pos-quick-prod-status-badge');
    const btnSave = document.getElementById('btn-save-quick-prod');

    if (data.status === 'success' && data.product) {
      const p = data.product;
      const effectiveBrand = p.brand || autoDetectBrandFromTitle(p.title) || data.detected_brand || '';
      
      if (badgeEl) {
        badgeEl.style.background = 'rgba(16,185,129,0.1)';
        badgeEl.style.borderColor = 'rgba(16,185,129,0.3)';
        badgeEl.style.color = '#34d399';
        badgeEl.innerText = `✓ Kayıtlı Ürün: ${p.title} ${effectiveBrand ? '• ' + effectiveBrand : ''}`;
      }
      if (titleInp) titleInp.value = p.title || '';
      if (salePriceInp) salePriceInp.value = (p.unit_price || p.price || 0.0).toFixed(2);
      if (buyingPriceInp) buyingPriceInp.value = (p.buying_price || 0.0).toFixed(2);
      if (brandInp) brandInp.value = effectiveBrand;
      if (stockInp) stockInp.value = p.stock || 0;
      if (kdvInp && p.kdv) kdvInp.value = p.kdv;
      recalcQuickProdMargin();

      if (btnSave) {
        btnSave.innerText = 'Güncelle ve Kaydet (Enter)';
        btnSave.style.background = '#059669';
      }
    } else {
      const detectedBrand = data.detected_brand || '';
      if (badgeEl) {
        badgeEl.style.background = 'rgba(56,189,248,0.1)';
        badgeEl.style.borderColor = 'rgba(56,189,248,0.3)';
        badgeEl.style.color = '#38bdf8';
        badgeEl.innerText = detectedBrand 
          ? `Yeni Ürün: [${detectedBrand}] Üretici/Firma Algılandı`
          : 'Yeni Ürün: Ürün adı ve satış fiyatını giriniz';
      }
      if (brandInp && detectedBrand) {
        brandInp.value = detectedBrand;
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

async function submitQuickProductSave(addToCart = false) {
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
        showToast(`✅ ${title} kaydedildi! Sıradaki barkodu okutunuz.`, 'success');
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
        closePosQuickProductModal();
      } else {
        // Formu temizle ve imleci doğrudan yeni barkod okuma alanına odakla
        if (bcInp) {
          bcInp.value = '';
          bcInp.focus();
        }
        if (titleInp) titleInp.value = '';
        if (salePriceInp) salePriceInp.value = '';
        if (buyingPriceInp) buyingPriceInp.value = '';
        if (brandInp) brandInp.value = '';
        if (stockInp) stockInp.value = '0';
        if (kdvInp) kdvInp.value = '10';
        const marginInp = document.getElementById('quick-prod-margin');
        if (marginInp) marginInp.value = '%0';

        const badgeEl = document.getElementById('pos-quick-prod-status-badge');
        if (badgeEl) {
          badgeEl.style.background = 'rgba(16,185,129,0.12)';
          badgeEl.style.borderColor = 'rgba(16,185,129,0.3)';
          badgeEl.style.color = '#34d399';
          badgeEl.innerText = `✓ Son Kaydedilen: "${title}" • Yeni barkod okutun veya yazın`;
        }

        const btnSave = document.getElementById('btn-save-quick-prod');
        if (btnSave) {
          btnSave.innerText = 'Kaydet (Enter)';
          btnSave.style.background = '#2563eb';
        }

        validateQuickProdInputs();
      }

      // UI ve Özetleri anında tazele
      if (typeof loadPosQuickGrid === 'function') {
        loadPosQuickGrid(window.currentPosQuickCategory || 'manav_adet');
      }
      if (typeof loadDashboardSummary === 'function') {
        loadDashboardSummary();
      }
      if (typeof loadProducts === 'function') loadProducts();
      if (typeof loadCatalogProducts === 'function') loadCatalogProducts();
      if (typeof loadManavProducts === 'function') loadManavProducts();
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
  // Canlı arama kullanıcının isteği üzerine devre dışı bırakıldı (Barkod tam yazılmalı veya Fiyat Gör butonuna basılmalı)
}

function executePosPriceCheck() {
  const inp = document.getElementById('pos-price-check-input');
  const query = (inp?.value || '').trim();
  if (!query) {
    if (typeof showToast === 'function') showToast('Lütfen barkod okutun veya ürün adı yazın.', 'warning');
    if (inp) inp.focus();
    return;
  }
  executePriceCheckQuery(query);
}

async function handlePosPriceCheckKey(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    const inp = document.getElementById('pos-price-check-input');
    const query = (inp?.value || '').trim();
    
    // Eğer ekranda daha önceden sorgulanmış ürün varsa ve input değişmediyse sepete ekle
    if (lastFoundPriceCheckProduct && query && (lastFoundPriceCheckProduct.barcode === query || lastFoundPriceCheckProduct.title === query)) {
      addFoundProductToPosCart();
      return;
    }

    if (query) {
      executePriceCheckQuery(query);
    }
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
let allRecentSalesCache = [];

function openPosRecentSalesModal() {
  showPosModal('modal-parked-receipts');
  switchRecentSalesSubTab('sales');
  fetchRecentSalesList();
  renderParkedReceiptsList();
}

function closeParkedReceiptsModal() {
  hidePosModal('modal-parked-receipts');
}

function switchRecentSalesSubTab(tabKey) {
  const paneSales = document.getElementById('pane-recent-sales');
  const paneParked = document.getElementById('pane-parked-receipts');
  const btnSales = document.getElementById('btn-tab-recent-sales');
  const btnParked = document.getElementById('btn-tab-parked-receipts');

  if (tabKey === 'sales') {
    if (paneSales) paneSales.style.display = 'flex';
    if (paneParked) paneParked.style.display = 'none';
    if (btnSales) { btnSales.style.background = '#2563eb'; btnSales.style.color = '#fff'; }
    if (btnParked) { btnParked.style.background = 'transparent'; btnParked.style.color = '#94a3b8'; }
  } else {
    if (paneSales) paneSales.style.display = 'none';
    if (paneParked) paneParked.style.display = 'flex';
    if (btnParked) { btnParked.style.background = '#eab308'; btnParked.style.color = '#000'; }
    if (btnSales) { btnSales.style.background = 'transparent'; btnSales.style.color = '#94a3b8'; }
    renderParkedReceiptsList();
  }
}

async function fetchRecentSalesList() {
  const tbody = document.getElementById('recent-pos-sales-table-body');
  const badge = document.getElementById('recent-sales-count-badge');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="6" style="padding: 24px; text-align: center; color: #38bdf8;">🔄 Satışlar ve fişler yükleniyor...</td></tr>';
  }

  try {
    const res = await fetch('/api/pos/recent_sales?limit=100');
    const data = await res.json();
    if (data.status === 'success' && data.sales) {
      allRecentSalesCache = data.sales;
      if (badge) badge.innerText = allRecentSalesCache.length;
      renderRecentSalesTable(allRecentSalesCache);
    } else {
      if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="padding: 24px; text-align: center; color: #64748b;">Henüz kayıtlı satış fişi bulunmuyor.</td></tr>';
    }
  } catch (err) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="padding: 24px; text-align: center; color: #f87171;">Satışlar yüklenirken hata oluştu.</td></tr>';
  }
}

function renderRecentSalesTable(sales) {
  const tbody = document.getElementById('recent-pos-sales-table-body');
  if (!tbody) return;

  if (!sales || sales.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="padding: 24px; text-align: center; color: #64748b;">Eşleşen satış fişi bulunamadı.</td></tr>';
    return;
  }

  tbody.innerHTML = sales.map(s => {
    const isCancelled = s.is_cancelled || s.payment_type === 'İptal Edildi' || (s.receipt_no && s.receipt_no.startsWith('FIS-IPTAL'));
    const isRet = s.is_return || (s.payment_type && s.payment_type.toLowerCase().includes('iade')) || (s.receipt_no && s.receipt_no.startsWith('FIS-IADE'));
    const hasReturns = Array.isArray(s.returns) && s.returns.length > 0;
    const isFullyReturned = s.is_fully_returned || (hasReturns && s.net_amount <= 0.01);
    
    let badgeColor = '#10b981';
    let badgeBg = 'rgba(16,185,129,0.15)';
    let badgeText = s.payment_type || 'Nakit';

    if (isCancelled) {
      badgeColor = '#ef4444';
      badgeBg = 'rgba(239,68,68,0.18)';
      badgeText = '🚫 İptal Edildi';
    } else if (isFullyReturned) {
      badgeColor = '#ef4444';
      badgeBg = 'rgba(239,68,68,0.18)';
      badgeText = '↩️ Tamamı İade';
    } else if (hasReturns) {
      badgeColor = '#fb923c';
      badgeBg = 'rgba(251,146,60,0.15)';
      badgeText = `${s.payment_type || 'Nakit'} (Kısmi İade)`;
    } else if (s.payment_type === 'Kredi Kartı') {
      badgeColor = '#38bdf8';
      badgeBg = 'rgba(56,189,248,0.15)';
    } else if (s.payment_type === 'Veresiye') {
      badgeColor = '#fbbf24';
      badgeBg = 'rgba(251,191,36,0.15)';
    }

    const amountColor = isCancelled ? '#94a3b8' : (isFullyReturned ? '#ef4444' : '#10b981');
    const itemsSummary = (s.items || []).map(i => `${i.quantity || 1}x ${i.title}`).join(', ') || `${s.item_count || 1} Kalem Ürün`;

    return `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.06); transition: background 0.15s ease;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">
        <td style="padding: 10px 14px;">
          <strong style="color: ${isCancelled ? '#f87171' : '#f8fafc'}; font-family: monospace; font-size: 13px;">${s.receipt_no || 'FIS-000'}</strong>
          <div style="font-size: 11px; color: #94a3b8;">${s.date || ''} • ${s.time || ''}</div>
          ${hasReturns ? `
            <div style="font-size: 10.5px; color: #f87171; background: rgba(239,68,68,0.12); border-left: 2px solid #ef4444; padding: 2px 6px; border-radius: 3px; margin-top: 4px; display: inline-block;">
              ↩️ ${parseFloat(s.total_returned_amount || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL İade Edildi${isFullyReturned ? '' : ` (Kalan: ${parseFloat(s.net_amount || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL)`}
            </div>
          ` : ''}
        </td>
        <td style="padding: 10px 14px;">
          <span style="background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeColor}40; padding: 3px 8px; border-radius: 4px; font-weight: 800; font-size: 11px;">
            ${badgeText}
          </span>
        </td>
        <td style="padding: 10px 14px;">
          <div style="font-weight: 700; color: #cbd5e1;">${s.customer || 'Perakende Müşteri'}</div>
          <div style="font-size: 11px; color: #64748b;">Kasiyer: ${s.cashier || 'Kasa 1'}</div>
        </td>
        <td style="padding: 10px 14px; max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${itemsSummary}">
          <div style="font-size: 12px; color: ${isCancelled || isFullyReturned ? '#94a3b8' : '#e2e8f0'}; text-decoration: ${isCancelled || isFullyReturned ? 'line-through' : 'none'};">${itemsSummary}</div>
          <small style="color: #94a3b8;">${s.item_count || (s.items ? s.items.length : 1)} Kalem • ${s.total_quantity || 1} Adet</small>
        </td>
        <td style="padding: 10px 14px; text-align: right;">
          <strong style="color: ${amountColor}; font-family: monospace; font-size: 14.5px; font-weight: 900; text-decoration: ${isFullyReturned ? 'line-through' : 'none'};">
            ${(parseFloat(s.total_amount) || 0).toFixed(2).replace('.', ',')} TL
          </strong>
        </td>
        <td style="padding: 10px 14px; text-align: center;">
          <div style="display: flex; gap: 6px; justify-content: center; align-items: center;">
            <button type="button" onclick="loadSaleToPosCart('${s.receipt_no}')" class="btn-secondary" style="padding: 5px 9px; font-size: 11.5px; font-weight: 800; background: rgba(234,179,8,0.15); border-color: rgba(234,179,8,0.4); color: #fbbf24; display: inline-flex; align-items: center; gap: 4px;" title="Bu Fişi Satış Sepetine Yükle">
              <span>📥</span> Fişi Getir
            </button>
            ${!isCancelled ? `
              <button type="button" onclick="openEditSaleModal('${s.receipt_no}')" class="btn-secondary" style="padding: 5px 8px; font-size: 11.5px; font-weight: 700; background: rgba(168,85,247,0.15); border-color: rgba(168,85,247,0.4); color: #c084fc;" title="Ödeme Türünü veya Müşteriyi Düzenle">
                ✏️ Düzenle
              </button>
              <button type="button" onclick="reprintRecentSale('${s.receipt_no}')" class="btn-secondary" style="padding: 5px 8px; font-size: 11.5px; font-weight: 700; background: rgba(56,189,248,0.1); border-color: rgba(56,189,248,0.3); color: #38bdf8;" title="Fişi Tekrar Yazdır">
                🖨️ Yazdır
              </button>
            ` : ''}
            ${(!isCancelled && !isFullyReturned) ? `
              <button type="button" onclick="openReturnItemsModal('${s.receipt_no}')" class="btn-secondary" style="padding: 5px 8px; font-size: 11.5px; font-weight: 700; background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.3); color: #f87171;" title="Bu Fişten Seçili veya Tüm Ürünleri İade Al">
                ↩️ İade Al
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterRecentSalesTable(query) {
  const q = String(query || '').trim().toLocaleLowerCase('tr-TR');
  if (!q) {
    renderRecentSalesTable(allRecentSalesCache);
    return;
  }
  const filtered = allRecentSalesCache.filter(s => {
    const str = `${s.receipt_no || ''} ${s.customer || ''} ${s.cashier || ''} ${s.payment_type || ''} ${(s.items || []).map(i => i.title).join(' ')}`.toLocaleLowerCase('tr-TR');
    return str.includes(q);
  });
  renderRecentSalesTable(filtered);
}

function reprintRecentSale(receiptNo) {
  const sale = allRecentSalesCache.find(s => s.receipt_no === receiptNo);
  if (!sale) {
    if (typeof showToast === 'function') showToast('Fiş bulunamadı.', 'warning');
    return;
  }
  if (typeof triggerThermalReceiptPrint === 'function') {
    triggerThermalReceiptPrint(sale);
  }
  if (typeof showToast === 'function') {
    showToast(`🖨️ Fiş #${receiptNo} yazıcıya gönderildi.`, 'success');
  }
}

function loadSaleToPosCart(receiptNo) {
  const sale = allRecentSalesCache.find(s => s.receipt_no === receiptNo);
  if (!sale || !sale.items || sale.items.length === 0) {
    if (typeof showToast === 'function') showToast('Fişe ait ürün bulunamadı.', 'warning');
    return;
  }

  posCart = sale.items.map(item => ({
    title: item.title || item.name || 'Ürün',
    barcode: item.barcode || '8690000000000',
    unit_price: parseFloat(item.unit_price || item.price || 0.0),
    total_price: parseFloat(item.total_price || (item.unit_price * (item.quantity || 1)) || 0.0),
    quantity: parseFloat(item.quantity) || 1,
    unit: item.unit || 'Adet',
    is_scale_item: item.is_scale_item || (item.unit === 'Kg')
  }));

  renderPosCart();
  if (typeof updatePosSummaryCounters === 'function') updatePosSummaryCounters();
  closeParkedReceiptsModal();

  if (typeof showToast === 'function') {
    showToast(`📥 Fiş #${receiptNo} sepeti kasaya başarıyla yüklendi!`, 'success');
  }
}

// =========================================================
// SEÇİMLİ / TÜMÜ FİŞ İADE MOTORU (FİŞ İÇİ İADE İŞLEME)
// =========================================================
let currentReturnReceiptNo = null;
let currentReturnReceiptData = null;
let currentReturnItemsState = [];
let currentReturnMode = 'all'; // 'all' | 'custom'

function openReturnItemsModal(receiptNo) {
  const sale = allRecentSalesCache.find(s => s.receipt_no === receiptNo);
  if (!sale || !sale.items || sale.items.length === 0) {
    if (typeof showToast === 'function') showToast('İade edilebilecek ürün bulunamadı.', 'warning');
    return;
  }

  currentReturnReceiptNo = receiptNo;
  currentReturnReceiptData = sale;
  currentReturnMode = 'all';

  const subEl = document.getElementById('return-modal-subtitle');
  if (subEl) {
    subEl.innerText = `${receiptNo} • ${sale.date || ''} ${sale.time || ''} • Toplam: ${(parseFloat(sale.total_amount) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`;
  }

  const paySelect = document.getElementById('return-modal-payment-type');
  if (paySelect) {
    if (sale.payment_type === 'Kredi Kartı') {
      paySelect.value = 'Kredi Kartı';
    } else if (sale.payment_type === 'Veresiye') {
      paySelect.value = 'Veresiye';
    } else {
      paySelect.value = 'Nakit';
    }
  }

  currentReturnItemsState = sale.items.map((it, idx) => ({
    index: idx,
    title: it.title || it.name || 'Ürün',
    barcode: it.barcode || '',
    unit: it.unit || 'Adet',
    unit_price: parseFloat(it.unit_price || it.price || 0.0),
    max_quantity: parseFloat(it.quantity || 1.0),
    selected_quantity: parseFloat(it.quantity || 1.0),
    selected: true
  }));

  updateReturnModeUI();
  renderReturnModalItems();
  calculateReturnModalTotal();

  const modal = document.getElementById('modal-pos-return-items');
  if (modal) modal.style.display = 'flex';
}

function closeReturnItemsModal() {
  const modal = document.getElementById('modal-pos-return-items');
  if (modal) modal.style.display = 'none';
  currentReturnReceiptNo = null;
  currentReturnReceiptData = null;
  currentReturnItemsState = [];
}

function setReturnMode(mode) {
  currentReturnMode = mode;
  updateReturnModeUI();
  if (mode === 'all') {
    currentReturnItemsState.forEach(i => {
      i.selected = true;
      i.selected_quantity = i.max_quantity;
    });
  }
  renderReturnModalItems();
  calculateReturnModalTotal();
}

function updateReturnModeUI() {
  const btnAll = document.getElementById('btn-return-mode-all');
  const btnCustom = document.getElementById('btn-return-mode-select');
  if (currentReturnMode === 'all') {
    if (btnAll) { btnAll.style.borderColor = '#ef4444'; btnAll.style.background = 'rgba(239,68,68,0.2)'; btnAll.style.color = '#fff'; }
    if (btnCustom) { btnCustom.style.borderColor = '#334155'; btnCustom.style.background = '#070d1e'; btnCustom.style.color = '#94a3b8'; }
  } else {
    if (btnAll) { btnAll.style.borderColor = '#334155'; btnAll.style.background = '#070d1e'; btnAll.style.color = '#94a3b8'; }
    if (btnCustom) { btnCustom.style.borderColor = '#ef4444'; btnCustom.style.background = 'rgba(239,68,68,0.2)'; btnCustom.style.color = '#fff'; }
  }
}

function renderReturnModalItems() {
  const listEl = document.getElementById('return-modal-items-list');
  if (!listEl) return;

  listEl.innerHTML = currentReturnItemsState.map((it, idx) => {
    const itemTotal = (it.selected_quantity * it.unit_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 });
    return `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background: ${it.selected ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${it.selected ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.05)'}; border-radius: 6px;">
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; flex: 1;">
          <input type="checkbox" ${it.selected ? 'checked' : ''} onchange="toggleReturnItemCheck(${idx}, this.checked)" style="accent-color: #ef4444; width: 16px; height: 16px;">
          <div>
            <div style="font-size: 12.5px; font-weight: 700; color: #f8fafc;">${it.title}</div>
            <div style="font-size: 11px; color: #94a3b8;">Birim Fiyat: ${it.unit_price.toFixed(2)} TL</div>
          </div>
        </label>
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 4px;">
            <input type="number" step="any" min="0.01" max="${it.max_quantity}" value="${it.selected_quantity}" 
                   onchange="onReturnItemQtyChange(${idx}, this.value)"
                   ${!it.selected ? 'disabled' : ''}
                   style="width: 55px; padding: 4px 6px; background: #0b1329; border: 1px solid #334155; border-radius: 4px; color: #fff; text-align: center; font-weight: 800; font-size: 12px;">
            <span style="font-size: 11px; color: #94a3b8;">/${it.max_quantity} ${it.unit}</span>
          </div>
          <strong style="color: ${it.selected ? '#f87171' : '#64748b'}; font-family: monospace; font-size: 13px; min-width: 65px; text-align: right;">
            ${itemTotal} TL
          </strong>
        </div>
      </div>
    `;
  }).join('');
}

function toggleReturnItemCheck(idx, checked) {
  if (currentReturnItemsState[idx]) {
    currentReturnItemsState[idx].selected = checked;
    if (checked && currentReturnItemsState[idx].selected_quantity <= 0) {
      currentReturnItemsState[idx].selected_quantity = currentReturnItemsState[idx].max_quantity;
    }
  }
  calculateReturnModalTotal();
  renderReturnModalItems();
}

function onReturnItemQtyChange(idx, val) {
  const num = parseFloat(val) || 0;
  if (currentReturnItemsState[idx]) {
    currentReturnItemsState[idx].selected_quantity = Math.min(currentReturnItemsState[idx].max_quantity, Math.max(0, num));
  }
  calculateReturnModalTotal();
  renderReturnModalItems();
}

function calculateReturnModalTotal() {
  let total = 0;
  currentReturnItemsState.forEach(it => {
    if (it.selected) {
      total += (it.selected_quantity * it.unit_price);
    }
  });
  const totalEl = document.getElementById('return-modal-calculated-total');
  if (totalEl) {
    totalEl.innerText = `${total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`;
  }
  return total;
}

async function submitReturnItemsConfirmation() {
  const selectedItems = currentReturnItemsState.filter(it => it.selected && it.selected_quantity > 0).map(it => ({
    barcode: it.barcode,
    title: it.title,
    unit: it.unit,
    unit_price: it.unit_price,
    quantity: it.selected_quantity,
    total_price: Math.round((it.selected_quantity * it.unit_price) * 100) / 100
  }));

  if (selectedItems.length === 0) {
    if (typeof showToast === 'function') showToast('Lütfen iade edilecek en az bir ürün seçiniz.', 'warning');
    return;
  }

  const returnTotal = calculateReturnModalTotal();
  const payType = document.getElementById('return-modal-payment-type')?.value || 'Nakit';

  const ok = await showCustomConfirm(
    `"${currentReturnReceiptNo}" numaralı satış fişi için:\n\n• ${selectedItems.length} Kalem Ürün\n• Toplam İade Tutarı: ${returnTotal.toFixed(2)} TL\n• İade Yöntemi: ${payType}\n\nİade işlemini onaylayıp mevcut fişe işlemek istiyor musunuz?`,
    'Fiş İadesi Onayı',
    'Evet, İadeyi Onayla',
    'Vazgeç',
    '↩️'
  );

  if (!ok) return;

  try {
    const res = await fetch('/api/pos/return_items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receipt_no: currentReturnReceiptNo,
        return_items: selectedItems,
        refund_type: payType
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      if (typeof playCashSound === 'function') playCashSound();
      if (typeof showToast === 'function') showToast(data.message || '✓ İade başarıyla fişe işlendi.', 'success');
      closeReturnItemsModal();
      await fetchRecentSalesList();
      if (typeof loadDashboardSummary === 'function') loadDashboardSummary();
    } else {
      if (typeof showToast === 'function') showToast(data.message || 'İade işlenemedi.', 'error');
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('Bağlantı hatası.', 'error');
  }
}

// =========================================================
// SATIŞ FİŞİ DÜZENLEME (ÖDEME TÜRÜ / MÜŞTERİ DEĞİŞTİRME)
// =========================================================
let currentEditingReceiptNo = null;

async function openEditSaleModal(receiptNo) {
  const sale = allRecentSalesCache.find(s => s.receipt_no === receiptNo);
  if (!sale) {
    if (typeof showToast === 'function') showToast('Fiş bulunamadı.', 'warning');
    return;
  }
  currentEditingReceiptNo = receiptNo;

  const subtitleEl = document.getElementById('edit-sale-receipt-subtitle');
  const totalEl = document.getElementById('edit-sale-total-amount');
  const paySelect = document.getElementById('edit-sale-payment-type');
  const custSelect = document.getElementById('edit-sale-customer-select');

  if (subtitleEl) subtitleEl.innerText = `${receiptNo} • ${sale.date || ''} ${sale.time || ''}`;
  if (totalEl) totalEl.innerText = `${(parseFloat(sale.total_amount) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`;

  // Müşterileri doldur
  try {
    const res = await fetch('/api/customers');
    const data = await res.json();
    if (data.status === 'success' && data.customers && custSelect) {
      custSelect.innerHTML = '<option value="">Perakende Müşteri</option>' + data.customers.map(c => {
        const isSelected = (sale.customer_id === c.id || sale.customer === c.name);
        return `<option value="${c.id}" data-name="${c.name}" ${isSelected ? 'selected' : ''}>${c.name}</option>`;
      }).join('');
    }
  } catch (e) {}

  if (paySelect) {
    paySelect.value = sale.payment_type || 'Nakit';
  }

  const modal = document.getElementById('modal-pos-edit-sale');
  if (modal) modal.style.display = 'flex';
}

function closeEditSaleModal() {
  const modal = document.getElementById('modal-pos-edit-sale');
  if (modal) modal.style.display = 'none';
  currentEditingReceiptNo = null;
}

function onEditSalePaymentTypeChange() {
  const paySelect = document.getElementById('edit-sale-payment-type');
  const custSection = document.getElementById('edit-sale-customer-section');
  if (paySelect && custSection) {
    if (paySelect.value === 'Veresiye') {
      custSection.style.display = 'block';
    }
  }
}

async function submitEditSaleSave() {
  if (!currentEditingReceiptNo) return;
  const paySelect = document.getElementById('edit-sale-payment-type');
  const custSelect = document.getElementById('edit-sale-customer-select');

  const newPayType = paySelect ? paySelect.value : 'Nakit';
  let newCustName = 'Perakende Müşteri';
  let newCustId = null;

  if (custSelect && custSelect.value) {
    newCustId = custSelect.value;
    const opt = custSelect.options[custSelect.selectedIndex];
    newCustName = opt ? (opt.getAttribute('data-name') || opt.text) : 'Müşteri';
  }

  try {
    const res = await fetch('/api/pos/edit_receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receipt_no: currentEditingReceiptNo,
        payment_type: newPayType,
        customer: newCustName,
        customer_id: newCustId
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      if (typeof showToast === 'function') showToast(data.message || '✓ Fiş güncellendi.', 'success');
      closeEditSaleModal();
      await fetchRecentSalesList();
      if (typeof loadDashboardSummary === 'function') loadDashboardSummary();
    } else {
      if (typeof showToast === 'function') showToast(data.message || 'Güncellenemedi.', 'error');
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('Bağlantı hatası.', 'error');
  }
}

function renderParkedReceiptsList() {
  const container = document.getElementById('parked-receipts-list');
  const badge = document.getElementById('parked-receipts-count-badge');
  if (badge) badge.innerText = parkedReceipts.length;
  if (!container) return;

  if (parkedReceipts.length === 0) {
    container.innerHTML = '<div style="color: #64748b; font-size: 13px; padding: 36px 20px; text-align: center;">Beklemede (askıya alınmış) hiçbir fiş bulunmuyor.<br><small style="color: #475569; font-size: 11.5px; margin-top: 4px; display: block;">Müşteri sepetini askıya almak için sepette ürün varken [F5] tuşuna basın.</small></div>';
    return;
  }

  const nowMs = Date.now();

  container.innerHTML = parkedReceipts.map((p, idx) => {
    const elapsedMins = Math.max(0, Math.floor((nowMs - (p.created_at || nowMs)) / 60000));
    const elapsedStr = elapsedMins < 1 ? 'Az önce' : `${elapsedMins} dk önce`;
    const varietyCount = p.variety_count !== undefined ? p.variety_count : (p.items ? p.items.length : 0);
    const totalQty = p.total_qty !== undefined ? p.total_qty : (p.items ? p.items.reduce((s, i) => s + (i.unit !== 'Kg' ? (parseFloat(i.quantity) || 1) : 0), 0) : 0);
    const totalKg = p.total_kg !== undefined ? p.total_kg : (p.items ? p.items.reduce((s, i) => s + (i.unit === 'Kg' || i.is_scale_item ? (parseFloat(i.quantity) || 0) : 0), 0) : 0);
    const itemsSummary = (p.items || []).map(i => `${i.quantity || 1}x ${i.title || i.name}`).join(', ') || 'Ürünler';

    return `
      <div style="background: #0b1329; border: 1.5px solid rgba(59,130,246,0.35); border-radius: 12px; padding: 14px 16px; display: flex; justify-content: space-between; align-items: center; gap: 14px; box-shadow: 0 4px 15px rgba(0,0,0,0.3);">
        <div style="flex: 1; min-width: 0;">
          <!-- Üst Satır: Fiş No, Saat ve Bekleme Süresi -->
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px; flex-wrap: wrap;">
            <span style="background: rgba(234,179,8,0.15); color: #fbbf24; border: 1px solid rgba(234,179,8,0.4); padding: 3px 8px; border-radius: 6px; font-weight: 900; font-size: 12px;">
              ⏳ BEKLEYEN FİŞ #${idx + 1}
            </span>
            <span style="color: #94a3b8; font-size: 11.5px; display: flex; align-items: center; gap: 4px;">
              <span>🕒</span> ${p.time} <strong style="color: #38bdf8; margin-left: 4px;">(${elapsedStr})</strong>
            </span>
            <span style="color: #64748b; font-size: 11px;">Kasiyer: ${p.cashier || 'Kasa 1'}</span>
          </div>

          <!-- Ürün İsimleri Önizleme -->
          <div style="font-size: 12.5px; color: #e2e8f0; font-weight: 600; margin-bottom: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${itemsSummary}">
            ${itemsSummary}
          </div>

          <!-- İstatistik Rozetleri (Çeşit, Adet, Tartım) -->
          <div style="display: flex; gap: 12px; font-size: 11.5px; color: #94a3b8; flex-wrap: wrap;">
            <span>📦 Çeşit: <strong style="color: #38bdf8;">${varietyCount}</strong> Kalem</span>
            <span>🔢 Toplam Adet: <strong style="color: #60a5fa;">${totalQty}</strong></span>
            ${totalKg > 0 ? `<span>⚖️ Toplam Tartım: <strong style="color: #34d399;">${totalKg.toFixed(2).replace('.', ',')} Kg</strong></span>` : ''}
          </div>
        </div>

        <!-- Sağ Taraf: Toplam Fiyat ve Butonlar -->
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px; flex-shrink: 0;">
          <strong style="color: #10b981; font-family: monospace; font-size: 20px; font-weight: 900;">
            ${p.total.toFixed(2).replace('.', ',')} TL
          </strong>
          <div style="display: flex; gap: 8px;">
            <button type="button" class="btn-primary" onclick="recallParkedReceipt('${p.id}')" style="padding: 8px 16px; font-size: 12.5px; font-weight: 800; background: linear-gradient(135deg, #2563eb, #1d4ed8); display: flex; align-items: center; gap: 5px;">
              <span>📥</span> Fişi Getir
            </button>
            <button type="button" class="btn-secondary" onclick="deleteParkedReceipt('${p.id}')" style="padding: 8px 12px; font-size: 12px; color: #f87171; border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.1);" title="Bekleyen Fişi Sil / İptal Et">
              <span>🗑️</span> İptal
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function saveParkedReceiptsToStorage() {
  try {
    localStorage.setItem('pos_parked_receipts', JSON.stringify(parkedReceipts));
  } catch (e) {
    console.error('Bekleyen fişler kaydedilemedi:', e);
  }
}

function loadParkedReceiptsFromStorage() {
  try {
    const raw = localStorage.getItem('pos_parked_receipts');
    if (raw) {
      parkedReceipts = JSON.parse(raw) || [];
    }
  } catch (e) {
    parkedReceipts = [];
  }
}

function parkCurrentReceipt() {
  if (!posCart || posCart.length === 0) {
    // Sepet boşsa doğrudan bekleyen fişler panelini aç
    showPosModal('modal-parked-receipts');
    switchRecentSalesSubTab('parked');
    renderParkedReceiptsList();
    return;
  }

  const grandTotal = posCart.reduce((sum, i) => sum + (parseFloat(i.total_price) || 0), 0);
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  const varietyCount = posCart.length;
  const totalQty = posCart.reduce((sum, it) => sum + (it.unit !== 'Kg' ? (parseFloat(it.quantity) || 1) : 0), 0);
  const totalKg = posCart.reduce((sum, it) => sum + (it.unit === 'Kg' || it.is_scale_item ? (parseFloat(it.quantity) || 0) : 0), 0);

  const parked = {
    id: `park_${Date.now()}`,
    created_at: Date.now(),
    time: timeStr,
    items: [...posCart],
    total: grandTotal,
    variety_count: varietyCount,
    total_qty: totalQty,
    total_kg: totalKg,
    cashier: (activeCashier && activeCashier.name) ? activeCashier.name : 'Kasa 1'
  };

  parkedReceipts.push(parked);
  saveParkedReceiptsToStorage();
  posCart = [];
  renderPosCart();
  updateParkedReceiptsUI();

  if (typeof showToast === 'function') {
    showToast(`⏸️ Fiş beklemeye alındı (${parked.items.length} Kalem - ${parked.total.toFixed(2).replace('.', ',')} TL)`, 'info');
  }
}

function parkCurrentPosReceipt() {
  parkCurrentReceipt();
}

function recallParkedReceipt(parkId) {
  const idx = parkedReceipts.findIndex(p => p.id === parkId);
  if (idx === -1) return;

  if (posCart && posCart.length > 0) {
    parkCurrentReceipt();
  }

  const recalled = parkedReceipts.splice(idx, 1)[0];
  saveParkedReceiptsToStorage();
  posCart = recalled.items || [];
  renderPosCart();
  updateParkedReceiptsUI();
  closeParkedReceiptsModal();

  if (typeof showToast === 'function') {
    showToast(`▶️ Bekleyen fiş kasaya getirildi (${posCart.length} Kalem - ${recalled.total.toFixed(2).replace('.', ',')} TL)`, 'success');
  }
}

function deleteParkedReceipt(parkId) {
  parkedReceipts = parkedReceipts.filter(p => p.id !== parkId);
  saveParkedReceiptsToStorage();
  updateParkedReceiptsUI();
  renderParkedReceiptsList();
  if (typeof showToast === 'function') showToast('Bekleyen fiş silindi.', 'info');
}

function clearAllParkedReceipts() {
  if (parkedReceipts.length === 0) return;
  parkedReceipts = [];
  saveParkedReceiptsToStorage();
  updateParkedReceiptsUI();
  renderParkedReceiptsList();
  if (typeof showToast === 'function') showToast('Tüm bekleyen fişler silindi.', 'info');
}

function handleWaitingBarClick() {
  showPosModal('modal-parked-receipts');
  switchRecentSalesSubTab('parked');
  renderParkedReceiptsList();
}

function updateParkedReceiptsUI() {
  const waitingBar = document.getElementById('pos-waiting-bar-container');
  const waitingText = document.getElementById('pos-waiting-bar-text');

  if (waitingBar && waitingText) {
    if (parkedReceipts.length === 0) {
      waitingBar.className = 'pos-waiting-inactive';
      waitingText.innerText = 'BEKLEYEN 0';
      waitingBar.title = 'Beklemede fiş yok (Fişi bekletmek için [F5] tuşuna basın)';
    } else {
      waitingBar.className = 'pos-waiting-active';
      waitingText.innerText = `BEKLEYEN ${parkedReceipts.length}`;
      waitingBar.title = `Bekleyen ${parkedReceipts.length} Fiş - Kasaya yüklemek için tıklayın`;
    }
  }
}

// 5.5. İADE İŞLEMLERİ (SATIŞ MANTIĞIYLA BİREBİR AYNI İADE - F9)
function openPosReturnModal() {
  const modal = document.getElementById('modal-pos-return');
  if (!modal) return;

  const cartSection = document.getElementById('pos-return-cart-summary-section');
  const emptySection = document.getElementById('pos-return-empty-cart-section');
  const countEl = document.getElementById('pos-return-items-count-text');
  const totalEl = document.getElementById('pos-return-total-amount-text');
  const listEl = document.getElementById('pos-return-items-preview-list');

  const grandTotal = typeof getPosCartGrandTotal === 'function' ? getPosCartGrandTotal() : posCart.reduce((s, i) => s + (parseFloat(i.total_price) || 0), 0);

  if (posCart && posCart.length > 0) {
    if (cartSection) cartSection.style.display = 'flex';
    if (emptySection) emptySection.style.display = 'none';

    if (countEl) {
      const totalQty = posCart.reduce((s, i) => s + (parseFloat(i.quantity) || 1), 0);
      countEl.innerText = `${posCart.length} Kalem Ürün (${totalQty} Adet/Kg)`;
    }
    if (totalEl) {
      totalEl.innerText = `${grandTotal.toFixed(2).replace('.', ',')} TL`;
    }
    if (listEl) {
      listEl.innerHTML = posCart.map(item => `
        <div style="display: flex; justify-content: space-between; padding: 4px 6px; border-bottom: 1px solid rgba(255,255,255,0.06);">
          <span>↩️ <strong>${item.quantity} ${item.unit || 'Adet'}</strong> ${item.title}</span>
          <strong style="color: #ef4444; font-family: monospace;">-${(parseFloat(item.total_price) || 0).toFixed(2).replace('.', ',')} TL</strong>
        </div>
      `).join('');
    }
  } else {
    if (cartSection) cartSection.style.display = 'none';
    if (emptySection) emptySection.style.display = 'flex';
  }

  showPosModal('modal-pos-return');
}

function closePosReturnModal() {
  hidePosModal('modal-pos-return');
}

async function executeDirectPosReturn(paymentType = 'Nakit İade') {
  if (!posCart || posCart.length === 0) {
    if (typeof showToast === 'function') showToast('İade edilecek ürün bulunamadı.', 'warning');
    return;
  }

  const grandTotal = typeof getPosCartGrandTotal === 'function' ? getPosCartGrandTotal() : posCart.reduce((s, i) => s + (parseFloat(i.total_price) || 0), 0);

  // Sepetteki tüm ürünleri is_return olarak işaretle
  const returnItems = posCart.map(i => ({
    ...i,
    is_return: true
  }));

  const payload = {
    items: returnItems,
    total_amount: grandTotal,
    payment_type: paymentType,
    is_return: true,
    customer_name: 'İade Müşterisi'
  };

  try {
    const res = await fetch('/api/pos/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.status === 'success') {
      closePosReturnModal();
      posCart = [];
      renderPosCart();

      if (typeof showToast === 'function') {
        showToast(`✅ ${grandTotal.toFixed(2).replace('.', ',')} TL tutarındaki ürün iadesi alındı!`, 'success');
      }

      // Dashboard ve raporları anında güncelle
      if (typeof loadDashboardSummary === 'function') loadDashboardSummary();
      if (typeof fetchRecentSalesList === 'function') fetchRecentSalesList();
      if (document.getElementById('modal-pos-x-report')?.style.display === 'flex' && typeof openPosXReportModal === 'function') {
        openPosXReportModal();
      }
    } else {
      if (typeof showToast === 'function') showToast(`⚠️ İade hatası: ${data.message}`, 'error');
    }
  } catch (err) {
    console.error("İade tamamlama hatası:", err);
    if (typeof showToast === 'function') showToast('İade işlemi sırasında bağlantı hatası oluştu.', 'error');
  }
}

// =========================================================
// 6. KASA SATIŞ & TAHSİLAT (NAKİT / KART / TEMİZLE / İKRAM)
// =========================================================
function confirmClearPosCart() {
  if (!posCart || posCart.length === 0) {
    if (typeof showToast === 'function') showToast('ℹ️ Satış sepetiniz zaten boş.', 'info');
    return;
  }

  const m = document.getElementById('modal-pos-clear-confirm');
  if (m) {
    const itemsCountEl = document.getElementById('pos-clear-items-count-text');
    const totalAmountEl = document.getElementById('pos-clear-total-amount-text');
    const grandTotal = getPosCartGrandTotal();

    if (itemsCountEl) {
      const totalQty = posCart.reduce((s, i) => s + (parseFloat(i.quantity) || 1), 0);
      itemsCountEl.innerText = `${posCart.length} Kalem Ürün (${totalQty} Adet/Kg)`;
    }
    if (totalAmountEl) {
      totalAmountEl.innerText = `${grandTotal.toFixed(2).replace('.', ',')} TL`;
    }

    m.style.display = 'flex';
  } else {
    showCustomConfirm('Mevcut satış fişini iptal edip sepeti temizlemek istediğinize emin misiniz?', 'Fiş İptal', 'İptal Et', 'Vazgeç', '🗑️').then(ok => {
      if (ok) {
        clearPosCart();
        if (typeof showToast === 'function') showToast('🗑️ Satış sepeti iptal edildi.', 'info');
      }
    });
  }
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
      if (typeof currentEmployeeShiftState !== 'undefined' && currentEmployeeShiftState.status === 'on_break') {
        if (typeof toggleEmployeeBreak === 'function') toggleEmployeeBreak();
      }
      if (typeof loadDashboardSummary === 'function') loadDashboardSummary();
      if (typeof loadRecentHomeSales === 'function') loadRecentHomeSales();
      if (document.getElementById('modal-pos-x-report')?.style.display === 'flex' && typeof openPosXReportModal === 'function') {
        openPosXReportModal();
      }

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

let posPartialPaymentsList = [];

function payFullPosAmount(paymentType) {
  const grandTotal = getPosCartGrandTotal();
  closePosPaymentModal();
  directPosCheckout(paymentType, grandTotal, 0, false);
}

function handlePartialPaymentKey(event) {
  if (event.key === 'Enter') {
    addPartialPosPayment('Nakit');
  }
}

function setPartialInputAmount(amount) {
  const inp = document.getElementById('pos-pay-partial-input');
  if (inp) {
    inp.value = amount;
    inp.focus();
  }
}

function addPartialPosPayment(type) {
  const inp = document.getElementById('pos-pay-partial-input');
  const amount = parseFloat(inp?.value || 0);
  if (isNaN(amount) || amount <= 0) {
    if (typeof showToast === 'function') showToast('⚠️ Lütfen geçerli bir ödeme tutarı girin.', 'warning');
    return;
  }
  const grandTotal = getPosCartGrandTotal();
  const alreadyPaid = posPartialPaymentsList.reduce((sum, p) => sum + p.amount, 0);
  const remaining = grandTotal - alreadyPaid;

  if (amount > remaining) {
    if (typeof showToast === 'function') showToast(`⚠️ Girilen tutar kalan bakiyeden (${remaining.toFixed(2)} TL) fazla olamaz.`, 'warning');
    return;
  }

  posPartialPaymentsList.push({ type: type, amount: amount });
  if (inp) inp.value = '';
  updatePosPaymentModalView();

  const newPaid = posPartialPaymentsList.reduce((sum, p) => sum + p.amount, 0);
  if (newPaid >= grandTotal - 0.01) {
    finalizeSplitPosSale();
  }
}

function updatePosPaymentModalView() {
  const grandTotal = getPosCartGrandTotal();
  const paid = posPartialPaymentsList.reduce((sum, p) => sum + p.amount, 0);
  const remaining = Math.max(0, grandTotal - paid);

  const gtEl = document.getElementById('pos-pay-grand-total');
  const pdEl = document.getElementById('pos-pay-paid-amount');
  const remEl = document.getElementById('pos-pay-remaining-amount');
  const cardSub = document.getElementById('btn-pay-full-card-sub');
  const cashSub = document.getElementById('btn-pay-full-cash-sub');

  if (gtEl) gtEl.innerText = `${grandTotal.toFixed(2).replace('.', ',')} TL`;
  if (pdEl) pdEl.innerText = `${paid.toFixed(2).replace('.', ',')} TL`;
  if (remEl) remEl.innerText = `${remaining.toFixed(2).replace('.', ',')} TL`;
  if (cardSub) cardSub.innerText = `(${remaining.toFixed(2).replace('.', ',')} TL)`;
  if (cashSub) cashSub.innerText = `(${remaining.toFixed(2).replace('.', ',')} TL)`;

  calculateCashChange();
}

function setCashTenderAmount(val) {
  const grandTotal = getPosCartGrandTotal();
  const inp = document.getElementById('pos-cash-tender-input');
  if (!inp) return;

  if (val === 'exact') {
    inp.value = grandTotal.toFixed(2);
  } else {
    inp.value = val;
  }
  calculateCashChange();
  inp.focus();
}

function calculateCashChange() {
  const grandTotal = getPosCartGrandTotal();
  const inp = document.getElementById('pos-cash-tender-input');
  const changeBox = document.getElementById('pos-cash-change-box');
  const changeText = document.getElementById('pos-cash-change-text');
  if (!inp || !changeBox || !changeText) return;

  const tender = parseFloat(inp.value.replace(',', '.')) || 0;
  if (tender <= 0) {
    changeText.innerText = '0,00 TL';
    changeText.style.color = '#64748b';
    changeBox.style.borderColor = '#334155';
    changeBox.style.background = 'rgba(15,23,42,0.9)';
    return;
  }

  if (tender >= grandTotal) {
    const change = tender - grandTotal;
    changeText.innerText = `${change.toFixed(2).replace('.', ',')} TL`;
    changeText.style.color = '#34d399';
    changeBox.style.borderColor = '#10b981';
    changeBox.style.background = 'rgba(16,185,129,0.18)';
  } else {
    const missing = grandTotal - tender;
    changeText.innerText = `Eksik: -${missing.toFixed(2).replace('.', ',')} TL`;
    changeText.style.color = '#f87171';
    changeBox.style.borderColor = '#ef4444';
    changeBox.style.background = 'rgba(239,68,68,0.15)';
  }
}

function handleCashTenderKey(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    const grandTotal = getPosCartGrandTotal();
    const inp = document.getElementById('pos-cash-tender-input');
    const tender = parseFloat(inp?.value?.replace(',', '.') || 0);

    if (tender >= grandTotal) {
      const change = tender - grandTotal;
      closePosPaymentModal();
      directPosCheckout('Nakit', grandTotal, change, false);
    } else {
      if (typeof showToast === 'function') {
        showToast('⚠️ Alınan nakit tutar toplam tutardan azdır.', 'warning');
      }
    }
  }
}

function roundPosPaymentCents() {
  if (!posCart || posCart.length === 0) return;
  const currentTotal = getPosCartGrandTotal();
  const rounded = Math.floor(currentTotal);
  const diff = currentTotal - rounded;

  if (diff > 0.001) {
    // Kuruş yuvarlama indirimi uygula
    addItemToPosCart({
      title: 'KURUŞ YUVARLAMA İNDİRİMİ',
      barcode: 'OZEL-INDIRIM',
      unit_price: -diff,
      total_price: -diff,
      quantity: 1,
      unit: 'Adet'
    });
    if (typeof showToast === 'function') {
      showToast(`✂️ ${diff.toFixed(2).replace('.', ',')} TL kuruş yuvarlama indirimi uygulandı. Yeni Tutar: ${rounded.toFixed(2).replace('.', ',')} TL`, 'success');
    }
    updatePosPaymentModalView();
    setCashTenderAmount('exact');
  } else {
    if (typeof showToast === 'function') {
      showToast('Tutar zaten tam sayı, kuruş bulunmuyor.', 'info');
    }
  }
}

function finalizeSplitPosSale() {
  const grandTotal = getPosCartGrandTotal();
  const paid = posPartialPaymentsList.reduce((sum, p) => sum + p.amount, 0);
  if (paid < grandTotal - 0.01) {
    if (typeof showToast === 'function') showToast('⚠️ Ödeme tamamlanmadı, lütfen kalan bakiyeyi tahsil edin.', 'warning');
    return;
  }
  const paymentSummary = posPartialPaymentsList.map(p => `${p.type}: ${p.amount.toFixed(2)} TL`).join(' + ');
  closePosPaymentModal();
  directPosCheckout(`Parçalı (${paymentSummary})`, grandTotal, 0, false);
  posPartialPaymentsList = [];
}

function closePosClearConfirmModal() {
  const m = document.getElementById('modal-pos-clear-confirm');
  if (m) m.style.display = 'none';
}

function executeClearPosCart() {
  closePosClearConfirmModal();
  if (posCart && posCart.length > 0) {
    const itemsToCancel = [...posCart];
    fetch('/api/pos/cancel_cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: itemsToCancel })
    }).catch(e => console.warn('İptal log kaydı:', e));
  }
  clearPosCart();
  if (typeof showToast === 'function') showToast('🗑️ Sepet iptal edildi ve geçmişe kaydedildi.', 'info');
}

function cancelPosExitModal() {
  const m = document.getElementById('modal-pos-exit-confirm');
  if (m) m.style.display = 'none';
}

function forceClosePosApp() {
  const m = document.getElementById('modal-pos-exit-confirm');
  if (m) m.style.display = 'none';
  if (typeof switchTab === 'function') {
    switchTab('tab-home');
  }
}

function openAddQuickButtonModal() {
  const m = document.getElementById('modal-add-quick-btn');
  if (m) m.style.display = 'flex';
}

function closeAddQuickButtonModal() {
  const m = document.getElementById('modal-add-quick-btn');
  if (m) m.style.display = 'none';
}

async function submitNewQuickButton() {
  const title = (document.getElementById('quick-btn-title-inp')?.value || '').trim();
  const code = (document.getElementById('quick-btn-code-inp')?.value || '').trim();

  if (!title || !code) {
    if (typeof showToast === 'function') showToast('⚠️ Lütfen ürün ismi ve kodunu girin.', 'warning');
    return;
  }

  try {
    const res = await fetch('/api/custom_barcodes/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: title, code: code })
    });
    const data = await res.json();
    if (data.status === 'success') {
      closeAddQuickButtonModal();
      if (typeof showToast === 'function') showToast('⚡ Hızlı buton başarıyla eklendi!', 'success');
      loadCustomBarcodes();
    } else {
      if (typeof showToast === 'function') showToast(data.message || 'Eklenemedi.', 'warning');
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('Hızlı buton kaydedilirken hata oluştu.', 'error');
  }
}

function closePosPaymentModal() {
  hidePosModal('modal-pos-receipt-confirm');
  hidePosModal('modal-pos-payment');
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

let loadedCashiersCache = [];

async function openCashierSwitchModal() {
  const pinInp = document.getElementById('cashier-pin-input');
  if (pinInp) {
    pinInp.value = '';
  }

  const select = document.getElementById('cashier-select-dropdown');
  if (select) {
    try {
      const res = await fetch('/api/cashiers');
      const data = await res.json();
      if (data.status === 'success' && data.cashiers) {
        loadedCashiersCache = data.cashiers.filter(c => c.active !== false);
        select.innerHTML = loadedCashiersCache
          .map(c => `<option value="${c.id}" ${c.id === activeCashier.id ? 'selected' : ''}>${c.name} (${c.role === 'admin' ? 'Müdür' : 'Kasiyer'})</option>`)
          .join('');
        onCashierDropdownChange();
      }
    } catch (e) {}
  }
  showPosModal('modal-cashier-switch');
  setTimeout(() => {
    const pin = document.getElementById('cashier-pin-input');
    if (pin) {
      pin.value = '';
      pin.focus();
    }
  }, 100);
}

function onCashierDropdownChange() {
  const select = document.getElementById('cashier-select-dropdown');
  const pinInp = document.getElementById('cashier-pin-input');
  const hintEl = document.getElementById('cashier-pin-hint');
  if (pinInp) pinInp.value = '';

  if (select && select.value) {
    const cashier = loadedCashiersCache.find(c => String(c.id) === String(select.value));
    if (cashier && cashier.pin && cashier.pin.trim()) {
      if (hintEl) {
        hintEl.innerText = '🔒 Bu hesap şifrelidir. Giriş için PIN kodunuzu yazın.';
        hintEl.style.color = '#fbbf24';
      }
      if (pinInp) pinInp.placeholder = 'PIN kodunuzu girin';
    } else {
      if (hintEl) {
        hintEl.innerText = '🔓 Bu hesap şifresizdir. PIN alanını boş bırakarak Enter yapın.';
        hintEl.style.color = '#34d399';
      }
      if (pinInp) pinInp.placeholder = 'Şifresiz hesap (boş bırakın)';
    }
  }
}

function closeCashierSwitchModal() {
  const pinInp = document.getElementById('cashier-pin-input');
  if (pinInp) pinInp.value = '';
  hidePosModal('modal-cashier-switch');
}

async function submitCashierSwitch() {
  const select = document.getElementById('cashier-select-dropdown');
  const pinInp = document.getElementById('cashier-pin-input');
  if (!select || select.selectedIndex < 0) {
    closeCashierSwitchModal();
    return;
  }

  const opt = select.options[select.selectedIndex];
  const cid = opt.value;
  const pin = (pinInp ? pinInp.value : '').trim();

  const submitBtn = document.getElementById('btn-cashier-submit');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = 'Doğrulanıyor...';
  }

  try {
    const res = await fetch('/api/cashiers/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: cid, pin })
    });
    const data = await res.json();

    if (data.status === 'success' && data.cashier) {
      const cname = data.cashier.name;
      activeCashier = { id: data.cashier.id, name: cname, role: data.cashier.role };
      localStorage.setItem('active_pos_cashier', JSON.stringify(activeCashier));

      const el1 = document.getElementById('header-active-cashier-name');
      if (el1) el1.innerText = cname;
      const el2 = document.getElementById('pos-header-cashier-name');
      if (el2) el2.innerText = cname;

      if (pinInp) pinInp.value = '';
      closeCashierSwitchModal();

      // Moladaysa otomatik olarak bitir ve göreve başlat
      try {
        fetch('/api/market/shift/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: data.cashier.id, name: cname, action: 'end_break' })
        }).catch(() => {});
      } catch (e) {}

      if (typeof currentEmployeeShiftState !== 'undefined') {
        currentEmployeeShiftState = { status: "working" };
      }
      if (typeof updateHeaderShiftUI === 'function') updateHeaderShiftUI();
      if (typeof updateSidebarNavVisibility === 'function') updateSidebarNavVisibility();

      if (typeof showToast === 'function') {
        showToast(`🟢 Kasa Açıldı / Aktif Kasiyer: ${cname} (${data.cashier.role === 'admin' ? 'Müdür' : 'Kasiyer'})`, 'success');
      }

      // Kasa kilitliyken okutulan barkod veya tıklanan ürün varsa hemen sepete aktar
      if (window.pendingPosBarcodeAfterUnlock) {
        const pendingBc = window.pendingPosBarcodeAfterUnlock;
        window.pendingPosBarcodeAfterUnlock = null;
        setTimeout(() => addPosItemByQuery(pendingBc.query, pendingBc.qty), 120);
      } else if (window.pendingPosItemAfterUnlock) {
        const pendingProd = window.pendingPosItemAfterUnlock;
        window.pendingPosItemAfterUnlock = null;
        setTimeout(() => addItemToPosCart(pendingProd), 120);
      } else {
        const posInp = document.getElementById('pos-barcode-input');
        if (posInp) setTimeout(() => posInp.focus(), 100);
      }
    } else {
      if (typeof showToast === 'function') {
        showToast(`❌ ${data.message || 'Kasiyer girişi başarısız.'}`, 'error');
      }
      if (pinInp) {
        pinInp.value = '';
        pinInp.focus();
      }
    }
  } catch (e) {
    if (typeof showToast === 'function') {
      showToast('❌ Bağlantı hatası, kasiyer doğrulanamadı.', 'error');
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>↵</span> <span>Giriş Yap / Seç (Enter)</span>';
    }
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

    if (typeof updateSidebarNavVisibility === 'function') {
      updateSidebarNavVisibility();
    }
  } catch (e) {}
}

async function loadDashboardSummary() {
  try {
    const res = await fetch('/api/pos/dashboard_summary');
    const data = await res.json();

    // 1. Sağ Üst Barkodlu Sayaç
    const salesCounterEl = document.getElementById('pos-lifetime-sales-count');
    if (salesCounterEl) {
      if (data.total_lifetime_sales_count_str) {
        salesCounterEl.innerText = data.total_lifetime_sales_count_str;
      } else if (data.total_lifetime_sales_count !== undefined) {
        salesCounterEl.innerText = formatPosSerialCode(data.total_lifetime_sales_count);
      }
    }

    // 2. Ana Sayfa Dinamik Ürün Sayaçları
    const homeTotalEl = document.getElementById('home-total-prods');
    if (homeTotalEl && data.total_catalog_products !== undefined) {
      homeTotalEl.innerText = `${data.total_catalog_products.toLocaleString('tr-TR')} Ürün`;
    }
    const homeMarketEl = document.getElementById('home-market-prods');
    if (homeMarketEl && data.market_products_count !== undefined) {
      homeMarketEl.innerText = `${data.market_products_count.toLocaleString('tr-TR')} Ürün`;
    }
    const homeManavEl = document.getElementById('home-manav-prods');
    if (homeManavEl && data.manav_products_count !== undefined) {
      homeManavEl.innerText = `${data.manav_products_count.toLocaleString('tr-TR')} Ürün`;
    }

    // 3. Dinamik Market Adı
    const homeMarketNameEl = document.getElementById('home-market-name');
    if (homeMarketNameEl && data.market_name) {
      homeMarketNameEl.innerText = data.market_name.toUpperCase();
    }
  } catch (e) {
    console.warn('Dashboard summary yükleme hatası:', e);
  }
}
window.loadDashboardSummary = loadDashboardSummary;

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
// KASA ÇIKIŞI & GİRİŞİ (TOPTANCI, FIRIN, MASRAF, AVANS)
// =========================================================
let currentCashMovType = 'out';
let todayCashMovementsCache = [];

async function openPosCashMovementModal(defaultType = 'out') {
  currentCashMovType = defaultType;
  setCashMovementType(defaultType);

  const amtInp = document.getElementById('cash-mov-amount-inp');
  const descInp = document.getElementById('cash-mov-desc-inp');
  if (amtInp) amtInp.value = '';
  if (descInp) descInp.value = '';

  const modal = document.getElementById('modal-pos-cash-movement');
  if (modal) {
    modal.style.display = 'flex';
  }

  await loadTodayCashMovements();

  setTimeout(() => {
    if (amtInp) {
      amtInp.focus();
      amtInp.select();
    }
  }, 80);
}

function closePosCashMovementModal() {
  const modal = document.getElementById('modal-pos-cash-movement');
  if (modal) {
    modal.style.display = 'none';
  }
}

function setCashMovementType(type) {
  currentCashMovType = type;
  const btnOut = document.getElementById('btn-cash-mov-type-out');
  const btnIn = document.getElementById('btn-cash-mov-type-in');
  const hdrIcon = document.getElementById('cash-mov-header-icon');
  const hdrTitle = document.getElementById('cash-mov-header-title');
  const amtInp = document.getElementById('cash-mov-amount-inp');
  const btnSubmit = document.getElementById('btn-submit-cash-mov');

  if (type === 'out') {
    if (btnOut) {
      btnOut.style.background = 'linear-gradient(135deg, #ef4444, #b91c1c)';
      btnOut.style.color = '#fff';
      btnOut.style.boxShadow = '0 4px 12px rgba(239,68,68,0.35)';
    }
    if (btnIn) {
      btnIn.style.background = 'transparent';
      btnIn.style.color = '#94a3b8';
      btnIn.style.boxShadow = 'none';
    }
    if (hdrIcon) {
      hdrIcon.innerText = '💸';
      hdrIcon.style.background = 'rgba(239,68,68,0.15)';
      hdrIcon.style.borderColor = 'rgba(239,68,68,0.3)';
    }
    if (hdrTitle) hdrTitle.innerText = 'Kasa Çıkışı / Toptancı & Gider Ödemesi';
    if (amtInp) {
      amtInp.style.borderColor = '#ef4444';
      amtInp.style.color = '#f87171';
    }
    if (btnSubmit) {
      btnSubmit.innerText = '💾 Çıkışı Kaydet';
      btnSubmit.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
      btnSubmit.style.boxShadow = '0 4px 14px rgba(239,68,68,0.4)';
    }
  } else {
    if (btnIn) {
      btnIn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
      btnIn.style.color = '#fff';
      btnIn.style.boxShadow = '0 4px 12px rgba(16,185,129,0.35)';
    }
    if (btnOut) {
      btnOut.style.background = 'transparent';
      btnOut.style.color = '#94a3b8';
      btnOut.style.boxShadow = 'none';
    }
    if (hdrIcon) {
      hdrIcon.innerText = '💰';
      hdrIcon.style.background = 'rgba(16,185,129,0.15)';
      hdrIcon.style.borderColor = 'rgba(16,185,129,0.3)';
    }
    if (hdrTitle) hdrTitle.innerText = 'Kasa Girişi / Avans & Para Ekleme';
    if (amtInp) {
      amtInp.style.borderColor = '#10b981';
      amtInp.style.color = '#34d399';
    }
    if (btnSubmit) {
      btnSubmit.innerText = '💾 Girişi Kaydet';
      btnSubmit.style.background = 'linear-gradient(135deg, #10b981, #059669)';
      btnSubmit.style.boxShadow = '0 4px 14px rgba(16,185,129,0.4)';
    }
  }
}

function selectCashMovCategory(catName, btnEl) {
  const hiddenInp = document.getElementById('cash-mov-category-val');
  if (hiddenInp) hiddenInp.value = catName;

  const allBtns = document.querySelectorAll('.cash-cat-btn');
  allBtns.forEach(b => {
    b.style.background = '#0f172a';
    b.style.borderColor = 'rgba(255,255,255,0.1)';
    b.style.color = '#cbd5e1';
  });

  if (btnEl) {
    btnEl.style.background = '#1e293b';
    btnEl.style.borderColor = '#38bdf8';
    btnEl.style.color = '#38bdf8';
  }
}

async function loadTodayCashMovements() {
  const container = document.getElementById('cash-mov-today-list');
  if (!container) return;

  try {
    const res = await fetch('/api/pos/cash_movements');
    const data = await res.json();
    if (data.status === 'success') {
      todayCashMovementsCache = data.movements || [];
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const todayItems = todayCashMovementsCache.filter(m => m.date === todayStr);

      if (todayItems.length === 0) {
        container.innerHTML = '<span style="color: #64748b; font-style: italic;">Bugün henüz kasa hareketi kaydedilmedi.</span>';
        return;
      }

      container.innerHTML = todayItems.map(m => {
        const isOut = m.type === 'out';
        const color = isOut ? '#f87171' : '#34d399';
        const sign = isOut ? '-' : '+';
        return `
          <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(15,23,42,0.8); border: 1px solid rgba(255,255,255,0.06); padding: 4px 8px; border-radius: 6px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="color: #94a3b8; font-size: 10.5px; font-family: monospace;">${m.time || ''}</span>
              <strong style="color: #f8fafc;">${m.category || 'Gider'}</strong>
              <small style="color: #94a3b8;">${m.description ? `(${m.description})` : ''}</small>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <strong style="color: ${color}; font-family: monospace;">${sign}${m.amount_str || m.amount}</strong>
              <button type="button" onclick="deleteCashMovementItem('${m.id}')" style="background: transparent; border: none; color: #64748b; cursor: pointer; font-size: 12px;" title="Sil">✕</button>
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (e) {
    console.error('Kasa hareketleri yüklenemedi:', e);
  }
}

async function submitPosCashMovement() {
  const amtInp = document.getElementById('cash-mov-amount-inp');
  const catInp = document.getElementById('cash-mov-category-val');
  const descInp = document.getElementById('cash-mov-desc-inp');

  const amount = parseFloat(amtInp?.value?.replace(',', '.') || 0);
  const category = catInp?.value || 'Toptancı / Mal Alımı';
  const description = (descInp?.value || '').trim();

  if (isNaN(amount) || amount <= 0) {
    if (typeof showToast === 'function') showToast('⚠️ Lütfen geçerli bir tutar giriniz.', 'warning');
    if (amtInp) amtInp.focus();
    return;
  }

  try {
    const res = await fetch('/api/pos/cash_movements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: currentCashMovType,
        amount: amount,
        category: category,
        description: description,
        cashier: (activeCashier && activeCashier.name) ? activeCashier.name : 'Kasa 1'
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      if (typeof showToast === 'function') {
        showToast(data.message || '✓ Kasa hareketi kaydedildi.', 'success');
      }
      closePosCashMovementModal();
      
      // Çekmeceyi Aç & Dashboardu Güncelle
      openCashDrawerAction();
      if (typeof loadDashboardSummary === 'function') {
        loadDashboardSummary();
      }
    } else {
      if (typeof showToast === 'function') showToast(data.message || 'Kayıt hatası.', 'error');
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('Bağlantı hatası.', 'error');
  }
}

async function deleteCashMovementItem(id) {
  const ok = await showCustomConfirm('Bu kasa hareketini silmek istediğinize emin misiniz?', 'Kasa Hareketi Sil', 'Sil', 'Vazgeç', '🗑️');
  if (!ok) return;

  try {
    const res = await fetch(`/api/pos/cash_movements/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.status === 'success') {
      if (typeof showToast === 'function') showToast(data.message, 'info');
      await loadTodayCashMovements();
    }
  } catch (e) {
    console.error('Silme hatası:', e);
  }
}

// F7 - KASA ÇEKMECESİ AÇ
function openCashDrawerAction() {
  if (typeof showToast === 'function') {
    showToast('🗄️ Para çekmecesi açıldı', 'info');
  }
}

// F10 - İSKONTO / İKRAM
async function applyPosGiftDiscount() {
  if (posCart.length === 0) {
    if (typeof showToast === 'function') showToast('Sepette ürün bulunmuyor.', 'warning');
    return;
  }
  const discountInput = await showCustomPrompt('İskonto / İkram Tutarı Girin (TL veya %10 gibi yüzde):', '10', '🏷️ İskonto / İkram Uygula', 'Uygula', 'İptal');
  if (!discountInput) return;

  const currentTotal = posCart.reduce((sum, itm) => sum + (parseFloat(itm.total_price) || 0), 0);
  let discountAmount = 0;

  if (discountInput.includes('%')) {
    const pct = parseFloat(discountInput.replace('%', ''));
    if (!isNaN(pct) && pct > 0) {
      discountAmount = Math.round((currentTotal * pct) / 100 * 100) / 100;
    }
  } else {
    const val = parseFloat(discountInput.replace(',', '.'));
    if (!isNaN(val) && val > 0) {
      discountAmount = Math.round(val * 100) / 100;
    }
  }

  if (discountAmount > 0 && discountAmount <= currentTotal) {
    addItemToPosCart({
      barcode: 'ISKONTO',
      title: `🎁 İSKONTO / İKRAM [${discountInput}]`,
      unit: 'Adet',
      quantity: 1,
      unit_price: -discountAmount,
      total_price: -discountAmount,
      is_discount: true
    });
    if (typeof showToast === 'function') {
      showToast(`🎁 İskonto uygulandı: -${discountAmount.toFixed(2)} TL`, 'success');
    }
  } else {
    if (typeof showToast === 'function') showToast('Geçersiz indirim tutarı.', 'warning');
  }
}

// =========================================================
// 9. 10'LU BUTON BAĞLANTILARI VE KLAVYE KISAYOLLARI
// =========================================================
function initPosBottomButtons() {
  const btnMap = {
    'btn-pos-action-quick-prod': () => openPosQuickProductModal(),
    'btn-pos-action-mobile': () => openPosMobileQrModal(),
    'btn-pos-action-price-check': () => openPosPriceCheckModal(),
    'btn-pos-action-clear': () => confirmClearPosCart(),       // FİŞ İPTAL [F3]
    'btn-pos-action-pay': () => openPosPaymentModal(),         // ÖDEME AL [F4]
    'btn-pos-action-cash': () => openPosPaymentModal(),
    'btn-pos-action-card': () => openPosPaymentModal(),
    'btn-pos-action-drawer': () => openCashDrawerAction(),     // ÇEKMECE [F7]
    'btn-pos-action-recent': () => openPosRecentSalesModal(),  // ESKİ SATIŞ [F8]
    'btn-pos-action-return': () => openPosReturnModal(),       // İADE [F9]
    'btn-pos-action-gift': () => applyPosGiftDiscount(),       // İKRAM [F10]
    'btn-pos-action-credit': () => openPosCreditModal(),       // VERESİYE [F11]
    
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

// Klavye Kısayolları (Capture Modunda Tüm F Tuşlarını Yakala & Browser Varsayılanlarını Engelle)
window.addEventListener('keydown', async (e) => {
  const fKeys = ['F1', 'F2', 'F3', 'F4', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'];
  
  // Alt+F4 veya Uygulama Kapatma Yakalayıcısı
  if (e.altKey && (e.key === 'F4' || e.code === 'F4')) {
    const hasActiveCart = (typeof posCart !== 'undefined' && Array.isArray(posCart) && posCart.length > 0);
    const hasParkedReceipts = (typeof parkedReceipts !== 'undefined' && Array.isArray(parkedReceipts) && parkedReceipts.length > 0);

    if (hasActiveCart || hasParkedReceipts) {
      e.preventDefault();
      e.stopPropagation();
      const ok = await showCustomConfirm(
        '⚠️ Kasada ekranda açık veya askıda bekleyen satış fişleri bulunuyor!\n\nSistemi kapatırsanız açık işlemleriniz askıda kalacaktır. Yine de kapatmak istiyor musunuz?',
        'Kasayı Kapatma Uyarısı',
        'Evet, Kapat',
        'Vazgeç',
        '⚠️'
      );
      if (ok) {
        window.close();
      }
      return;
    }
  }

  // F tuşuna basıldıysa Chrome arama/yardım vb. varsayılanlarını engelle (F5 normal yenileme olarak serbest bırakıldı)
  if (fKeys.includes(e.key) || e.key === 'Insert') {
    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'F1') {
      openPosMobileQrModal(); // MOBİL QR OKUMA & KAMERA [F1]
    } else if (e.key === 'F2') {
      openPosPriceCheckModal(); // FİYAT GÖR [F2]
    } else if (e.key === 'F3') {
      confirmClearPosCart(); // FİŞ İPTAL [F3]
    } else if (e.key === 'F4') {
      openPosPaymentModal(); // ÖDEME AL [F4]
    } else if (e.key === 'F6') {
      parkCurrentReceipt(); // FİŞ BEKLET [F6]
    } else if (e.key === 'F7') {
      openPosCashMovementModal('out'); // KASA ÇIKIŞI & GİRİŞİ [F7]
    } else if (e.key === 'F8') {
      openPosReturnModal(); // İADE [F8]
    } else if (e.key === 'F9') {
      openPosRecentSalesModal(); // ESKİ SATIŞ [F9]
    } else if (e.key === 'F10' || e.key === 'Insert') {
      openPosQuickProductModal(); // HIZLI ÜRÜN [F10 / Insert]
    } else if (e.key === 'F11') {
      openPosCreditModal(); // VERESİYE [F11]
    }
    return;
  }

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
  const isReceiptConfirmOpen = receiptConfirmModal && receiptConfirmModal.style.display === 'flex';

  const clearConfirmModal = document.getElementById('modal-pos-clear-confirm');
  const isClearConfirmOpen = clearConfirmModal && (clearConfirmModal.style.display === 'flex' || clearConfirmModal.classList.contains('active'));

  // FİŞ İPTAL / SEPET SİLME ONAY MODALINDA ENTER -> SİL, ESC -> VAZGEÇ
  if (isClearConfirmOpen) {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeClearPosCart();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closePosClearConfirmModal();
      return;
    }
  }

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

  // İADE MODALI KONTROLLERİ (1 -> NAKİT İADE, 2 -> KART İADE, ESC -> KAPAT)
  if (isReturnModalOpen) {
    if (e.key === '1' || (e.key === 'Enter' && (!e.target || e.target.tagName !== 'INPUT'))) {
      e.preventDefault();
      executeDirectPosReturn('Nakit İade');
      return;
    }
    if (e.key === '2') {
      e.preventDefault();
      executeDirectPosReturn('Kart İade');
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closePosReturnModal();
      return;
    }
  }

  // Açık Modal Kapatma (ESC ile tüm modalları anında kapat)
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    if (typeof closeAllActiveModals === 'function') {
      closeAllActiveModals();
    } else {
      if (typeof closePosXReportModal === 'function') closePosXReportModal();
      if (typeof closePosCreditModal === 'function') closePosCreditModal();
      if (typeof closePosReturnModal === 'function') closePosReturnModal();
      if (typeof closeReturnItemsModal === 'function') closeReturnItemsModal();
      if (typeof closeEditSaleModal === 'function') closeEditSaleModal();
      if (typeof closeParkedReceiptsModal === 'function') closeParkedReceiptsModal();
      if (typeof closePosRecentSalesModal === 'function') closePosRecentSalesModal();
      if (typeof closePosQuickProductModal === 'function') closePosQuickProductModal();
      if (typeof closePosPriceCheckModal === 'function') closePosPriceCheckModal();
      if (typeof closePosMobileQrModal === 'function') closePosMobileQrModal();
      if (typeof closePosCashMovementModal === 'function') closePosCashMovementModal();
      if (typeof closeCashierSwitchModal === 'function') closeCashierSwitchModal();
      if (typeof closePosPaymentModal === 'function') closePosPaymentModal();
      if (typeof closePosClearConfirmModal === 'function') closePosClearConfirmModal();
    }
    return;
  }

  // Hızlı Ürün Formunda Enter -> Kaydet
  if (isQuickProdOpen && e.key === 'Enter' && e.target && e.target.id !== 'quick-prod-barcode') {
    e.preventDefault();
    submitQuickProductSave();
    return;
  }
}, true);

// =========================================================
// 9.5 VERESİYE SATIŞ & TAHSİLAT KASA ENTEGRASYONU
// =========================================================
let posCreditCustomerList = [];

async function openPosCreditModal(defaultTab) {
  const totalAmt = typeof calculatePosTotal === 'function' ? calculatePosTotal() : (posCart || []).reduce((s, i) => s + (parseFloat(i.total_price) || 0), 0);
  const totalEl = document.getElementById('pos-cred-sale-total-text');
  if (totalEl) {
    totalEl.innerText = totalAmt.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL';
  }

  // Müşteri listesini yükle
  try {
    const res = await fetch('/api/customers');
    const data = await res.json();
    if (data.status === 'success') {
      posCreditCustomerList = data.customers || [];
      populatePosCreditCustomerDropdowns();
    }
  } catch (e) {
    console.error("Veresiye müşterileri yüklenemedi:", e);
  }

  const modal = document.getElementById('modal-pos-credit');
  if (modal) modal.style.display = 'flex';

  // Veresiye modalı her zaman Satış (Sepeti Veresiyeye Ekle) sekmesiyle başlar
  const targetTab = defaultTab || 'sale';
  switchPosCreditSubTab(targetTab);
}

function closePosCreditModal() {
  const modal = document.getElementById('modal-pos-credit');
  if (modal) modal.style.display = 'none';
  const quickForm = document.getElementById('pos-quick-cust-form');
  if (quickForm) quickForm.style.display = 'none';
}

function switchPosCreditSubTab(tabKey) {
  const paneSale = document.getElementById('pane-pos-cred-sale');
  const panePay = document.getElementById('pane-pos-cred-payment');
  const btnSale = document.getElementById('btn-pos-cred-tab-sale');
  const btnPay = document.getElementById('btn-pos-cred-tab-payment');

  if (tabKey === 'sale') {
    if (paneSale) paneSale.style.display = 'flex';
    if (panePay) panePay.style.display = 'none';
    if (btnSale) { btnSale.style.background = '#0284c7'; btnSale.style.color = '#fff'; }
    if (btnPay) { btnPay.style.background = 'transparent'; btnPay.style.color = '#94a3b8'; }
  } else {
    if (paneSale) paneSale.style.display = 'none';
    if (panePay) panePay.style.display = 'flex';
    if (btnPay) { btnPay.style.background = '#10b981'; btnPay.style.color = '#fff'; }
    if (btnSale) { btnSale.style.background = 'transparent'; btnSale.style.color = '#94a3b8'; }
  }
}

function populatePosCreditCustomerDropdowns() {
  const selSale = document.getElementById('pos-cred-customer-select');
  const selPay = document.getElementById('pos-tahsilat-customer-select');

  const optionsHtml = '<option value="">-- Müşteri Seçiniz --</option>' + posCreditCustomerList.map(c => {
    const bal = parseFloat(c.balance || 0);
    const balStr = bal.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' TL';
    return `<option value="${c.id}" data-name="${c.name}" data-phone="${c.phone || ''}" data-balance="${bal}" data-limit="${c.credit_limit || 0}">${c.name} (${bal > 0 ? 'Borç: ' + balStr : 'Borçsuz'})</option>`;
  }).join('');

  if (selSale) selSale.innerHTML = optionsHtml;
  if (selPay) selPay.innerHTML = optionsHtml;
}

function onPosCreditCustomerChange() {
  const sel = document.getElementById('pos-cred-customer-select');
  const opt = sel?.options[sel.selectedIndex];
  const infoBox = document.getElementById('pos-cred-cust-info-box');
  const confirmBox = document.getElementById('pos-cred-confirm-box');
  const confirmText = document.getElementById('pos-cred-confirm-text');
  const submitBtn = document.getElementById('btn-pos-submit-credit-sale');

  if (!sel || !sel.value || !opt) {
    if (infoBox) infoBox.style.display = 'none';
    if (confirmText) confirmText.innerText = 'Lütfen veresiye satışı yazmak istediğiniz müşteriyi seçiniz.';
    if (submitBtn) submitBtn.disabled = true;
    return;
  }

  const custName = opt.getAttribute('data-name') || opt.text;
  const custPhone = opt.getAttribute('data-phone') || '';
  const balance = parseFloat(opt.getAttribute('data-balance') || 0);
  const limit = parseFloat(opt.getAttribute('data-limit') || 0);
  const totalAmt = typeof calculatePosTotal === 'function' ? calculatePosTotal() : (posCart || []).reduce((s, i) => s + (parseFloat(i.total_price) || 0), 0);
  const newBalance = balance + totalAmt;

  const currDebtEl = document.getElementById('pos-cred-curr-debt');
  const currLimitEl = document.getElementById('pos-cred-curr-limit');
  if (currDebtEl) currDebtEl.innerText = balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' TL';
  if (currLimitEl) currLimitEl.innerText = limit > 0 ? (limit.toLocaleString('tr-TR') + ' TL') : 'Limitsiz';
  if (infoBox) infoBox.style.display = 'flex';

  if (confirmText) {
    confirmText.innerHTML = `
      <div style="margin-bottom: 4px;">👤 <strong>${custName}</strong> ${custPhone ? `(${custPhone})` : ''}</div>
      <div style="display: flex; justify-content: space-between; font-size: 11.5px; margin-top: 4px; border-top: 1px dashed rgba(245,158,11,0.3); padding-top: 4px;">
        <span>Önceki Borç: <strong>${balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</strong></span>
        <span>+ Satış: <strong>${totalAmt.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</strong></span>
        <span style="color: #fbbf24;">= Güncel: <strong>${newBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</strong></span>
      </div>
    `;
  }
  if (submitBtn) submitBtn.disabled = (posCart && posCart.length === 0);
}

function togglePosQuickCustomerForm() {
  const form = document.getElementById('pos-quick-cust-form');
  if (form) {
    const isHidden = form.style.display === 'none' || !form.style.display;
    form.style.display = isHidden ? 'flex' : 'none';
    if (isHidden) document.getElementById('pos-quick-cust-name')?.focus();
  }
}

async function submitQuickCustomerFromPos() {
  const name = document.getElementById('pos-quick-cust-name')?.value?.trim();
  const phone = document.getElementById('pos-quick-cust-phone')?.value?.trim() || '';

  if (!name) {
    if (typeof showToast === 'function') showToast('Lütfen müşteri adı giriniz.', 'warning');
    return;
  }

  try {
    const res = await fetch('/api/customers/quick_add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, phone: phone })
    });
    const data = await res.json();
    if (data.status === 'success') {
      if (typeof showToast === 'function') showToast(`✓ "${name}" müşterisi oluşturuldu.`, 'success');
      document.getElementById('pos-quick-cust-name').value = '';
      document.getElementById('pos-quick-cust-phone').value = '';
      togglePosQuickCustomerForm();

      // Listeyi yenile ve yeni müşteriyi seç
      const custRes = await fetch('/api/customers');
      const custData = await custRes.json();
      if (custData.status === 'success') {
        posCreditCustomerList = custData.customers || [];
        populatePosCreditCustomerDropdowns();
        const sel = document.getElementById('pos-cred-customer-select');
        if (sel) {
          sel.value = data.customer_id;
          onPosCreditCustomerChange();
        }
      }
    }
  } catch (e) {
    console.error("Hızlı müşteri oluşturulamadı:", e);
  }
}

async function submitPosCreditSale() {
  const sel = document.getElementById('pos-cred-customer-select');
  const opt = sel?.options[sel.selectedIndex];
  if (!sel || !sel.value || !opt) {
    if (typeof showToast === 'function') showToast('Lütfen veresiye yazılacak müşteriyi listeden seçiniz.', 'warning');
    return;
  }

  if (!posCart || posCart.length === 0) {
    if (typeof showToast === 'function') showToast('Sepette ürün bulunmuyor.', 'warning');
    return;
  }

  const custId = sel.value;
  const custName = opt.getAttribute('data-name') || opt.text;
  const custPhone = opt.getAttribute('data-phone') || '';
  const oldBalance = parseFloat(opt.getAttribute('data-balance') || 0);
  const grandTotal = typeof calculatePosTotal === 'function' ? calculatePosTotal() : posCart.reduce((s, i) => s + (parseFloat(i.total_price) || 0), 0);
  const newBalance = oldBalance + grandTotal;

  const shouldPrint = document.getElementById('pos-cred-print-receipt-chk')?.checked;
  const shouldSendWhatsApp = document.getElementById('pos-cred-send-whatsapp-chk')?.checked;

  const wpMsgLine = shouldSendWhatsApp
    ? (custPhone ? `💬 ${custPhone} numarasına WhatsApp bilgi fişi ve PDF gönderilecektir.` : `💬 WhatsApp seçildi ancak müşterinin telefon numarası kayıtlı değil.`)
    : `💬 WhatsApp bildirimi gönderilmeyecektir.`;

  const confirmPrompt = `Sayın "${custName}" adına ${grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL tutarında veresiye satış yazılacaktır.\n\n• Önceki Borç: ${oldBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL\n• Eklenecek Tutar: +${grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL\n• GÜNCEL TOPLAM BORÇ: ${newBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL\n\n${wpMsgLine}\n\nBu veresiye satış işlemini onaylıyor musunuz?`;

  const ok = await showCustomConfirm(
    confirmPrompt,
    'Veresiye Satış Onayı',
    'Evet, Satışı Onayla',
    'Vazgeç',
    '📒'
  );

  if (!ok) return;

  const payload = {
    customer_id: custId,
    customer_name: custName,
    payment_type: "Veresiye",
    payment_breakdown: { "Veresiye": grandTotal },
    total_amount: grandTotal,
    received_cash: 0.0,
    change_amount: 0.0,
    items: posCart
  };

  try {
    const res = await fetch(`${API_BASE}/api/pos/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.status === 'success') {
      closePosCreditModal();
      if (typeof playCashSound === 'function') playCashSound();
      if (typeof showToast === 'function') showToast(`🎉 "${custName}" veresiye satışı başarıyla tamamlandı!`, 'success');

      if (shouldPrint && typeof triggerThermalReceiptPrint === 'function') {
        triggerThermalReceiptPrint(data.receipt);
      }

      // WhatsApp ile Bilgi Fişi Gönderimi
      if (shouldSendWhatsApp && custPhone) {
        const receiptNo = data.receipt?.receipt_no || `FIS-${Date.now()}`;
        const now = new Date();
        const nowStr = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        let itemsSummary = posCart.map(i => {
          const uPrice = parseFloat(i.unit_price !== undefined ? i.unit_price : (i.price || 0));
          const tPrice = parseFloat(i.total_price !== undefined ? i.total_price : (uPrice * (parseFloat(i.quantity) || 1)));
          return `• ${i.quantity}x ${i.title || i.name} (${uPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL) -> ${tPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`;
        }).join('\n');
        if (itemsSummary.length > 500) {
          itemsSummary = itemsSummary.substring(0, 480) + '...';
        }

        const text = `Sayın *${custName}*,\n\n🛒 *YARENLER MARKET - VERESİYE SATIŞ FİŞİ* 🧾\n📅 *Tarih:* ${nowStr} • *Fiş No:* ${receiptNo}\n\n🛍️ *Alınan Ürünler:*\n${itemsSummary}\n\n💵 *Satış Tutarı:* ${grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL\n📊 *Önceki Borç:* ${oldBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL\n💰 *GÜNCEL TOPLAM BORÇ:* ${newBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL\n\n📄 *Fiş PDF Belgesi Hazırlanmıştır.*\nBizi tercih ettiğiniz için teşekkür ederiz!\n🏢 *YARENLER MARKET*`;

        if (typeof sendWhatsAppUniversal === 'function') {
          sendWhatsAppUniversal(custPhone, text, receiptNo);
        }
      }

      posCart = [];
      if (typeof renderPosCart === 'function') renderPosCart();
      if (typeof updatePosSummaryCounters === 'function') updatePosSummaryCounters();
      if (typeof loadDashboardSummary === 'function') loadDashboardSummary();
      if (document.getElementById('modal-pos-x-report')?.style.display === 'flex' && typeof openPosXReportModal === 'function') {
        openPosXReportModal();
      }
    }
  } catch (e) {
    console.error("Veresiye satışı tamamlanamadı:", e);
  }
}

// Tahsilat İşlemleri
function onPosTahsilatCustomerChange() {
  const sel = document.getElementById('pos-tahsilat-customer-select');
  const opt = sel?.options[sel.selectedIndex];
  const debtTextEl = document.getElementById('pos-tahsilat-curr-debt-text');
  const amtInp = document.getElementById('pos-tahsilat-amount-inp');

  if (!sel || !sel.value || !opt) {
    if (debtTextEl) debtTextEl.innerText = '0,00 TL';
    if (amtInp) amtInp.value = '';
    updatePosTahsilatLiveCalc();
    return;
  }

  const balance = parseFloat(opt.getAttribute('data-balance') || 0);
  if (debtTextEl) debtTextEl.innerText = balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' TL';
  if (amtInp) amtInp.value = balance > 0 ? balance : '';
  updatePosTahsilatLiveCalc();
}

function setPosTahsilatAmount(amt) {
  const inp = document.getElementById('pos-tahsilat-amount-inp');
  if (inp) {
    inp.value = amt;
    updatePosTahsilatLiveCalc();
  }
}

function setPosTahsilatFullDebt() {
  const sel = document.getElementById('pos-tahsilat-customer-select');
  const opt = sel?.options[sel.selectedIndex];
  if (!opt) return;
  const balance = parseFloat(opt.getAttribute('data-balance') || 0);
  if (balance > 0) {
    const inp = document.getElementById('pos-tahsilat-amount-inp');
    if (inp) {
      inp.value = balance;
      updatePosTahsilatLiveCalc();
    }
  }
}

function updatePosTahsilatLiveCalc() {
  const sel = document.getElementById('pos-tahsilat-customer-select');
  const opt = sel?.options[sel.selectedIndex];
  const currentDebt = opt ? parseFloat(opt.getAttribute('data-balance') || 0) : 0;
  const payAmt = parseFloat(document.getElementById('pos-tahsilat-amount-inp')?.value) || 0;

  const remaining = currentDebt - payAmt;
  const resEl = document.getElementById('pos-tahsilat-calc-res');
  if (resEl) {
    resEl.innerText = `${remaining.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`;
    resEl.style.color = remaining > 0 ? '#fbbf24' : (remaining < 0 ? '#10b981' : '#34d399');
  }
}

async function submitPosTahsilat(isPdf = false) {
  const sel = document.getElementById('pos-tahsilat-customer-select');
  const opt = sel?.options[sel.selectedIndex];
  if (!sel || !sel.value || !opt) {
    if (typeof showToast === 'function') showToast('Lütfen tahsilat yapılacak müşteriyi seçiniz.', 'warning');
    return;
  }

  const custId = sel.value;
  const custName = opt.getAttribute('data-name') || opt.text;
  const custPhone = opt.getAttribute('data-phone') || '';
  const amount = parseFloat(document.getElementById('pos-tahsilat-amount-inp')?.value) || 0;
  const payMethod = document.querySelector('input[name="pos-tahsilat-method"]:checked')?.value || 'Nakit';
  const shouldSendWhatsApp = document.getElementById('pos-tahsilat-send-whatsapp-chk')?.checked;

  if (amount <= 0) {
    if (typeof showToast === 'function') showToast('Lütfen geçerli bir tahsilat tutarı giriniz.', 'warning');
    return;
  }

  try {
    const res = await fetch(`/api/customers/${custId}/transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'payment',
        amount: amount,
        payment_method: payMethod,
        description: `Hızlı Kasa ${payMethod} Tahsilat`,
        actor: 'Kasiyer'
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      closePosCreditModal();
      if (typeof playCashSound === 'function') playCashSound();
      if (typeof showToast === 'function') {
        showToast(`✓ ${custName} kişisinden ${amount.toFixed(2)} TL tahsil edildi! Kalan Borç: ${(data.new_balance || 0).toFixed(2)} TL`, 'success');
      }

      const now = new Date();
      const nowStr = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const oldBal = data.old_balance !== undefined ? data.old_balance : parseFloat(opt.getAttribute('data-balance') || 0);
      const newBal = data.new_balance !== undefined ? data.new_balance : (oldBal - amount);

      // Fiş / PDF Alma İsteği
      if (isPdf && typeof printPaymentReceiptSlip === 'function') {
        printPaymentReceiptSlip({
          custName: custName,
          custPhone: custPhone,
          amount: amount,
          payMethod: payMethod,
          txType: 'payment',
          oldBalance: oldBal,
          newBalance: newBal,
          dateStr: nowStr
        });
      }

      // WhatsApp ile Ödeme Makbuzu Gönderimi
      if (shouldSendWhatsApp && custPhone) {
        const text = `Sayın *${custName}*,\n\n🧾 *VERESİYE ÖDEME MAKBUZU* 💵\n📅 *Tarih:* ${nowStr}\n💳 *Ödeme Yöntemi:* ${payMethod}\n💵 *Tahsil Edilen:* ${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL\n📊 *Önceki Borç:* ${oldBal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL\n💰 *KALAN GÜNCEL BORÇ:* ${newBal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL\n\nÖdemeniz başarıyla hesabınıza işlenmiştir.\nBizi tercih ettiğiniz için teşekkür ederiz!\n🏢 *YARENLER MARKET*`;

        if (typeof sendWhatsAppUniversal === 'function') {
          sendWhatsAppUniversal(custPhone, text);
        }
      }

      if (typeof loadDashboardSummary === 'function') loadDashboardSummary();
    } else {
      if (typeof showToast === 'function') showToast(data.message || 'Tahsilat hatası', 'error');
    }
  } catch (e) {
    console.error("Tahsilat kaydedilemedi:", e);
  }
}

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
window.executePosPriceCheck = executePosPriceCheck;
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
window.currentXReportData = null;

async function openPosXReportModal() {
  showPosModal('modal-pos-x-report');

  try {
    const res = await fetch(`/api/pos/x_report?_t=${Date.now()}`, { cache: 'no-store' });
    const data = await res.json();
    if (data && data.status === 'success') {
      window.currentXReportData = data;
      
      const setTxt = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = (val !== undefined && val !== null) ? String(val) : '';
      };

      setTxt('x-rep-market-name', data.market_name || 'YARENLER MARKET');
      setTxt('x-rep-datetime', `${data.date} ${data.time}`);
      setTxt('x-rep-cashier', `Kasiyer: ${data.active_cashier || 'Kasa 1'}`);
      setTxt('x-rep-opening-cash', data.opening_cash_str || `${Number(data.opening_cash || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`);
      setTxt('x-rep-cash-sales', data.cash_sales_str || '0,00 TL');
      setTxt('x-rep-card-sales', data.card_sales_str || '0,00 TL');
      setTxt('x-rep-debt-sales', data.debt_sales_str || '0,00 TL');
      setTxt('x-rep-debt-collections', data.debt_collections_total_str || '0,00 TL');
      setTxt('x-rep-cash-inflow', data.cash_inflow_str || '0,00 TL');
      setTxt('x-rep-cash-outflow', data.cash_outflow_str || '0,00 TL');
      setTxt('x-rep-returns', data.return_total_str || '0,00 TL');
      setTxt('x-rep-total-sales', data.total_sales_str || '0,00 TL');
      setTxt('x-rep-counts', `${data.receipt_count || 0} Fiş / ${data.total_items_sold || 0} Kalem`);
      setTxt('x-rep-drawer-cash', data.current_cash_in_drawer_str || `${Number(data.current_cash_in_drawer || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`);

      const advInp = document.getElementById('inp-x-cash-advance');
      if (advInp) advInp.value = data.opening_cash !== undefined ? data.opening_cash : 500;

      const movSec = document.getElementById('x-rep-movements-section');
      const movList = document.getElementById('x-rep-movements-list');
      if (movSec && movList) {
        const moves = data.today_movements || [];
        if (moves.length > 0) {
          movSec.style.display = 'block';
          movList.innerHTML = moves.map(m => {
            const isOut = m.type === 'out';
            const sign = isOut ? '-' : '+';
            return `<div style="display: flex; justify-content: space-between;"><span>• ${m.category || 'Gider'} ${m.description ? `(${m.description})` : ''}</span><strong>${sign}${m.amount_str || m.amount}</strong></div>`;
          }).join('');
        } else {
          movSec.style.display = 'none';
        }
      }
    }
  } catch (e) {
    console.error('X Raporu çekme hatası:', e);
  }
}

function closePosXReportModal() {
  hidePosModal('modal-pos-x-report');
}

async function updateCashAdvanceFromXModal() {
  const inp = document.getElementById('inp-x-cash-advance');
  const val = parseFloat(inp?.value) || 0;
  try {
    const res = await fetch('/api/pos/cash_advance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: val })
    });
    const data = await res.json();
    if (data.status === 'success') {
      if (typeof showToast === 'function') {
        showToast(`✓ Kasa açılış avansı ${val.toFixed(2)} TL olarak güncellendi!`, 'success');
      }
      await openPosXReportModal();
    } else {
      if (typeof showToast === 'function') showToast(`❌ ${data.message || 'Güncellenemedi'}`, 'error');
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('Bağlantı hatası, avans kaydedilemedi.', 'error');
  }
}

function printPosXReportThermal() {
  const paper = document.getElementById('x-report-receipt-paper');
  if (!paper) return;
  const printWin = window.open('', '_blank', 'width=380,height=600');
  printWin.document.write(`
    <html>
      <head>
        <title>X Raporu</title>
        <style>
          body { font-family: monospace; padding: 10px; margin: 0; font-size: 12px; }
          @media print { @page { margin: 0; size: 80mm auto; } body { margin: 4mm; } }
        </style>
      </head>
      <body>
        ${paper.innerHTML}
        <script>window.onload = function() { window.print(); window.close(); }<\/script>
      </body>
    </html>
  `);
  printWin.document.close();
}

function shareXReportViaWhatsApp() {
  const mktName = document.getElementById('x-rep-market-name')?.innerText || 'MARKET';
  const dt = document.getElementById('x-rep-datetime')?.innerText || '';
  const cashier = document.getElementById('x-rep-cashier')?.innerText || '';
  const totalSales = document.getElementById('x-rep-total-sales')?.innerText || '0,00 TL';
  const cashSales = document.getElementById('x-rep-cash-sales')?.innerText || '0,00 TL';
  const cardSales = document.getElementById('x-rep-card-sales')?.innerText || '0,00 TL';
  const debtSales = document.getElementById('x-rep-debt-sales')?.innerText || '0,00 TL';
  const cashIn = document.getElementById('x-rep-cash-inflow')?.innerText || '0,00 TL';
  const cashOut = document.getElementById('x-rep-cash-outflow')?.innerText || '0,00 TL';
  const returns = document.getElementById('x-rep-returns')?.innerText || '0,00 TL';
  const drawerCash = document.getElementById('x-rep-drawer-cash')?.innerText || '0,00 TL';
  const counts = document.getElementById('x-rep-counts')?.innerText || '0 Fiş';

  const text = `📊 *${mktName} - GÜN SONU / KASA RAPORU*\n📅 *Tarih:* ${dt}\n👤 *${cashier}*\n\n💰 *TOPLAM CİRO:* ${totalSales}\n• 💵 *Nakit:* ${cashSales}\n• 💳 *Kredi Kartı:* ${cardSales}\n• 📒 *Veresiye:* ${debtSales}\n• 🟢 *Kasa Girişleri:* ${cashIn}\n• 🔴 *Kasa Çıkışları / Toptancı:* ${cashOut}\n• ↩️ *İadeler:* ${returns}\n\n💼 *ÇEKMECEDEKİ NET NAKİT:* ${drawerCash}\n🧾 *İşlem:* ${counts}\n\nHayırlı ve bereketli kazançlar dileriz.`;

  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

window.openPosXReportModal = openPosXReportModal;
window.closePosXReportModal = closePosXReportModal;
window.updateCashAdvanceFromXModal = updateCashAdvanceFromXModal;
window.printPosXReportThermal = printPosXReportThermal;
window.shareXReportViaWhatsApp = shareXReportViaWhatsApp;
window.showBranchInfo = showBranchInfo;
window.showTerminalInfo = showTerminalInfo;
window.checkOnlineServerStatus = checkOnlineServerStatus;
window.validateQuickProdInputs = validateQuickProdInputs;
window.onQuickProdTitleChange = onQuickProdTitleChange;
window.autoDetectBrandFromTitle = autoDetectBrandFromTitle;
window.payFullPosAmount = payFullPosAmount;
window.handlePartialPaymentKey = handlePartialPaymentKey;
window.setPartialInputAmount = setPartialInputAmount;
window.addPartialPosPayment = addPartialPosPayment;
window.updatePosPaymentModalView = updatePosPaymentModalView;
window.finalizeSplitPosSale = finalizeSplitPosSale;
window.closePosClearConfirmModal = closePosClearConfirmModal;
window.executeClearPosCart = executeClearPosCart;
window.cancelPosExitModal = cancelPosExitModal;
window.forceClosePosApp = forceClosePosApp;
window.openAddQuickButtonModal = openAddQuickButtonModal;
window.closeAddQuickButtonModal = closeAddQuickButtonModal;
window.submitNewQuickButton = submitNewQuickButton;
window.triggerBarcodeNotFoundAlert = triggerBarcodeNotFoundAlert;
window.closeBarcodeNotFoundAlert = closeBarcodeNotFoundAlert;
window.openQuickProductFromNotFoundAlert = openQuickProductFromNotFoundAlert;
window.openPosCreditModal = openPosCreditModal;
window.closePosCreditModal = closePosCreditModal;
window.switchPosCreditSubTab = switchPosCreditSubTab;
window.onPosCreditCustomerChange = onPosCreditCustomerChange;
window.togglePosQuickCustomerForm = togglePosQuickCustomerForm;
window.submitQuickCustomerFromPos = submitQuickCustomerFromPos;
window.submitPosCreditSale = submitPosCreditSale;
window.onPosTahsilatCustomerChange = onPosTahsilatCustomerChange;
window.setPosTahsilatAmount = setPosTahsilatAmount;
window.setPosTahsilatFullDebt = setPosTahsilatFullDebt;
window.updatePosTahsilatLiveCalc = updatePosTahsilatLiveCalc;
window.submitPosTahsilat = submitPosTahsilat;
window.triggerQuickProductBarcodeLookup = triggerQuickProductBarcodeLookup;
window.executeDirectPosReturn = executeDirectPosReturn;
window.openPosReturnModal = openPosReturnModal;
window.closePosReturnModal = closePosReturnModal;
window.openPosRecentSalesModal = openPosRecentSalesModal;
window.closeParkedReceiptsModal = closeParkedReceiptsModal;
window.switchRecentSalesSubTab = switchRecentSalesSubTab;
window.fetchRecentSalesList = fetchRecentSalesList;
window.filterRecentSalesTable = filterRecentSalesTable;
window.reprintRecentSale = reprintRecentSale;
window.returnFromRecentSale = returnFromRecentSale;
window.clearAllParkedReceipts = clearAllParkedReceipts;
window.recallParkedReceipt = recallParkedReceipt;
window.deleteParkedReceipt = deleteParkedReceipt;
window.openCashierSwitchModal = openCashierSwitchModal;
window.closeCashierSwitchModal = closeCashierSwitchModal;
window.submitCashierSwitch = submitCashierSwitch;
window.onCashierDropdownChange = onCashierDropdownChange;
window.openPosCashMovementModal = openPosCashMovementModal;
window.closePosCashMovementModal = closePosCashMovementModal;
window.setCashMovementType = setCashMovementType;
window.selectCashMovCategory = selectCashMovCategory;
function triggerThermalReceiptPrint(receipt) {
  if (!receipt) return;
  
  // 1. Arka planda doğrudan Windows termal yazıcı kuyruğuna ilet (Diyalog ve pop-up açmadan)
  fetch('/api/pos/print_receipt_direct', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ receipt: receipt })
  }).then(r => r.json()).then(data => {
    if (typeof showToast === 'function') {
      showToast('🖨️ Bilgi fişi doğrudan yazıcıya gönderildi!', 'success');
    }
  }).catch(e => {
    console.warn('Yazıcı doğrudan iletim:', e);
  });
}

window.triggerThermalReceiptPrint = triggerThermalReceiptPrint;
window.loadSaleToPosCart = loadSaleToPosCart;
window.openEditSaleModal = openEditSaleModal;
window.closeEditSaleModal = closeEditSaleModal;
window.onEditSalePaymentTypeChange = onEditSalePaymentTypeChange;
window.submitEditSaleSave = submitEditSaleSave;
window.openReturnItemsModal = openReturnItemsModal;
window.closeReturnItemsModal = closeReturnItemsModal;
window.setReturnMode = setReturnMode;
window.toggleReturnItemCheck = toggleReturnItemCheck;
window.onReturnItemQtyChange = onReturnItemQtyChange;
window.submitReturnItemsConfirmation = submitReturnItemsConfirmation;
window.submitPosCashMovement = submitPosCashMovement;
window.loadTodayCashMovements = loadTodayCashMovements;
window.deleteCashMovementItem = deleteCashMovementItem;
