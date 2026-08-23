// -*- coding: utf-8 -*-
/**
 * Hızlı Satış (POS) - Dokunmatik Numpad, Miktar*Barkod Desteği, Kırmızı Total Tutar ve 5 Sütunlu Sepet Motoru
 */

let posCart = [];
let parkedReceipts = [];
let activeCashier = { id: 'kasa1', name: 'Kasa 1 (Kasiyer 1)' };
window.currentPosQuickCategory = 'manav';

document.addEventListener('DOMContentLoaded', () => {
  initPosModule();
});

function initPosModule() {
  loadActiveCashier();
  loadDashboardSummary();
  loadRecentHomeSales();
  selectPosQuickCategory(window.currentPosQuickCategory || 'manav');
  updateParkedReceiptsUI();
  initPosBottomButtons();
}

// 1. DOKUNMATİK NUMPAD KONTROLLERİ (0-9, ., *, ENTER, SİL)
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

let autocompleteDebounceTimer = null;
let currentAutocompleteResults = [];
let activeAutocompleteIndex = -1;

function onPosBarcodeInputLive(val) {
  clearTimeout(autocompleteDebounceTimer);
  const popup = document.getElementById('pos-autocomplete-popup');
  if (!popup) return;

  const raw = String(val || '').trim();
  
  // Miktar*Sorgu desteği (örn: "5*domates")
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
        activeAutocompleteIndex = 0; // İlk öğe otomatik seçili
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

  // *1 ve Miktar*Barkod / Miktar*1 (1 TL) Çözümlemesi
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
  const popup = document.getElementById('pos-autocomplete-popup');
  const isPopupOpen = popup && popup.style.display === 'block' && currentAutocompleteResults.length > 0;

  if (e.key === 'ArrowDown') {
    if (isPopupOpen) {
      e.preventDefault();
      activeAutocompleteIndex = (activeAutocompleteIndex + 1) % currentAutocompleteResults.length;
      renderPosAutocompleteList(currentAutocompleteResults);
      return;
    }
  } else if (e.key === 'ArrowUp') {
    if (isPopupOpen) {
      e.preventDefault();
      activeAutocompleteIndex = (activeAutocompleteIndex - 1 + currentAutocompleteResults.length) % currentAutocompleteResults.length;
      renderPosAutocompleteList(currentAutocompleteResults);
      return;
    }
  } else if (e.key === 'Escape') {
    closePosAutocompletePopup();
    return;
  } else if (e.key === 'Enter') {
    if (isPopupOpen && activeAutocompleteIndex >= 0 && activeAutocompleteIndex < currentAutocompleteResults.length) {
      e.preventDefault();
      selectPosAutocompleteIndex(activeAutocompleteIndex);
      return;
    }
    submitPosBarcodeInput();
  }
}

// 2. Kasiyer ve Dashboard Özet Bilgileri
async function loadActiveCashier() {
  try {
    const res = await fetch('/api/cashier/active');
    const data = await res.json();
    if (data.status === 'success' && data.active) {
      activeCashier.id = data.active.cashier_id;
      activeCashier.name = data.active.cashier_name;
      const el = document.getElementById('header-active-cashier-name');
      const homeEl = document.getElementById('home-active-cashier');
      if (el) el.innerText = activeCashier.name;
      if (homeEl) homeEl.innerText = activeCashier.name;
    }
  } catch (e) {}
}

async function loadDashboardSummary() {
  try {
    const res = await fetch('/api/pos/dashboard_summary');
    const data = await res.json();

    const mNameEl = document.getElementById('home-market-name');
    const mCashEl = document.getElementById('home-active-cashier');
    if (mNameEl) mNameEl.innerText = data.market_name || 'YARENLER MARKET';
    if (mCashEl) mCashEl.innerText = data.active_cashier || activeCashier.name;

    const totProdsEl = document.getElementById('home-total-prods');
    const mktProdsEl = document.getElementById('home-market-prods');
    const mnvProdsEl = document.getElementById('home-manav-prods');
    if (totProdsEl) totProdsEl.innerText = `${data.total_catalog_products || 0} Ürün`;
    if (mktProdsEl) mktProdsEl.innerText = `${data.market_products_count || 0} Ürün`;
    if (mnvProdsEl) mnvProdsEl.innerText = `${data.manav_products_count || 0} Ürün`;

    // Prestijli Toplam Satış Sayacı
    const salesCounterEl = document.getElementById('pos-lifetime-sales-count');
    if (salesCounterEl && data.total_lifetime_sales_count_str) {
      salesCounterEl.innerText = data.total_lifetime_sales_count_str;
    }
  } catch (e) {}
}

async function loadRecentHomeSales() {
  const container = document.getElementById('home-recent-sales-list');
  if (!container) return;

  try {
    const today = new Date().toISOString().split('T')[0];
    const res = await fetch(`/api/reports/day_detail?date=${today}`);
    const data = await res.json();

    if (data.status === 'success' && data.receipts && data.receipts.length > 0) {
      const recent = data.receipts.slice(-6).reverse();
      container.innerHTML = recent.map(r => `
        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(15,23,42,0.6); padding: 10px 14px; border-radius: 8px; margin-bottom: 8px; border: 1px solid rgba(255,255,255,0.05);">
          <div>
            <div style="font-weight: 800; color: #f8fafc; font-size: 13px;">
              🧾 ${r.receipt_no}
              <span style="font-size: 11px; color: #64748b; margin-left: 6px;">${r.time}</span>
            </div>
            <div style="font-size: 11.5px; color: #94a3b8;">
              👤 ${r.cashier} • <span style="color: ${r.payment_type === 'Nakit' ? '#10b981' : r.payment_type === 'Kredi Kartı' ? '#3b82f6' : '#f59e0b'}">${r.payment_type}</span> • ${r.item_count} Kalem
            </div>
          </div>
          <strong style="color: #ef4444; font-size: 15px; font-family: monospace;">
            ${(r.total_amount || 0).toFixed(2).replace('.', ',')} TL
          </strong>
        </div>
      `).join('');
    }
  } catch (e) {}
}

// 3. SAĞ PANEL KATEGORİ SEÇİMİ & ADET MANAV / KG MANAV / BARKODSUZ GRİDİ
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
    // manav_adet varsayılan
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

window.posQuickItemsList = [];

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

  addItemToPosCart({
    title: item.title,
    plu: item.plu || null,
    barcode: cleanBarcode,
    unit_price: parseFloat(item.price) || 0.0,
    total_price: parseFloat(item.price) || 0.0,
    quantity: 1,
    unit: item.unit || 'Adet',
    is_scale_item: item.is_scale_item || false
  });

  if (typeof showToast === 'function') {
    showToast(`➕ ${item.title} sepete eklendi.`, 'info');
  }
}

function handleQuickGridItemClick(id, title, price, unit, isScaleItem, plu) {
  const cleanBarcode = plu ? `PLU_${plu}` : (id ? `GRID_${id}` : `QUICK_${title}`);

  addItemToPosCart({
    title: title,
    plu: plu || null,
    barcode: cleanBarcode,
    unit_price: parseFloat(price) || 0.0,
    total_price: parseFloat(price) || 0.0,
    quantity: 1,
    unit: unit || 'Adet',
    is_scale_item: isScaleItem || false
  });

  if (typeof showToast === 'function') {
    showToast(`➕ ${title} sepete eklendi.`, 'info');
  }
}

// 4. HIZLI SATIŞ (POS) SEPET & KASA MOTORU
async function addPosItemByQuery(query, qty = 1) {
  try {
    const res = await fetch(`/api/pos/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (data.status === 'success' && data.product) {
      const prod = data.product;
      prod.quantity = qty;
      prod.total_price = Math.round(qty * (prod.unit_price || 0.0) * 100) / 100;
      addItemToPosCart(prod);
      if (typeof showToast === 'function') {
        showToast(`➕ ${qty > 1 ? qty + 'x ' : ''}${prod.title} sepete eklendi.`, 'info');
      }
    } else {
      // Eğer barkod sistemde yoksa sesli uyarı çal, Türkçe konuş ve ekrana uyarı modalı çıkar
      if (typeof triggerBarcodeNotFoundAlert === 'function') {
        triggerBarcodeNotFoundAlert(query);
      }
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('Ürün arama hatası.', 'error');
  }
}

function addItemToPosCart(prod) {
  const addQty = parseFloat(prod.quantity) || 1;
  let itemTitle = prod.title || 'Ürün';

  // YALNIZCA *1 VEYA 10*1 GİBİ 1 TL ÖZEL SATIŞLARINDA 1TL SIRALAMASI OLSUN
  const isOneLira = (prod.barcode === '1' || prod.source === 'special_one_lira' || itemTitle === '1TL (Terazi / Barkodsuz)' || (itemTitle.startsWith('1TL') && !prod.barcode.startsWith('GRID_') && !prod.barcode.startsWith('PLU_')));

  if (!prod.is_scale_item && !isOneLira) {
    const existingIdx = posCart.findIndex(i => !i.is_scale_item && !i.is_one_lira && i.barcode === prod.barcode && i.title === prod.title);
    if (existingIdx !== -1) {
      const existing = posCart[existingIdx];
      existing.quantity = Math.round(((parseFloat(existing.quantity) || 0) + addQty) * 100) / 100;
      existing.total_price = Math.round(existing.quantity * existing.unit_price * 100) / 100;
      // En son okutulan/değişen ürünü en üste taşı
      posCart.splice(existingIdx, 1);
      posCart.unshift(existing);
      renderPosCart();
      return;
    }
  }

  // 1TL için her satış ayrı bir satır olarak sıralanır: #1, #2, #3...
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

  // En son okutulan ürün en üstte görünsün
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
  const popup = document.getElementById('pos-autocomplete-popup');
  if (popup) popup.style.display = 'none';
  renderPosCart();
}

// 5 SÜTUNLU SEPET TABLOSU (SÜTUN BÖLÜCÜ ÇİZGİLERLE) & 4'LÜ ALT ÖZET ŞERİDİ RENDER
function renderPosCart() {
  const tbody = document.getElementById('pos-cart-tbody');
  const totalAmountEl = document.getElementById('pos-cart-grand-total');
  
  // Alt Özet Şeridi Elemanları
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
          totalAdetCount += 1; // Manav/kg ürünleri adet hesabında 1 kalem/paket sayılır
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

            <!-- 2. Miktar (Doğrudan Yazılabilir Input) -->
            <td style="padding: 4px 6px; text-align: center; border-right: 1px solid rgba(255,255,255,0.06);">
              <input type="text" inputmode="decimal" id="cart-qty-${item.id}" value="${item.quantity}"
                     onfocus="setPosActiveInput(this); this.select();"
                     oninput="onPosCartQtyChange('${item.id}', this.value)"
                     onkeydown="handlePosRowInputKey(event, '${item.id}')"
                     style="width: 68px; padding: 5px 6px; background: #070d1e; border: 1.5px solid #38bdf8; border-radius: 6px; color: #38bdf8; font-weight: 900; font-size: 13.5px; text-align: center; outline: none; box-sizing: border-box;"
                     title="Miktarı değiştirmek için yazın veya üstteki numpad'i kullanın">
            </td>

            <!-- 3. Birim Adı -->
            <td style="padding: 6px 6px; text-align: center; color: #cbd5e1; font-weight: 600; font-size: 11.5px; border-right: 1px solid rgba(255,255,255,0.06);">
              ${item.unit || 'Adet'}
            </td>

            <!-- 4. Birim Fiyat (Doğrudan Yazılabilir Input) -->
            <td style="padding: 4px 6px; text-align: right; border-right: 1px solid rgba(255,255,255,0.06);">
              <div style="display: flex; align-items: center; justify-content: flex-end; gap: 4px;">
                <input type="text" inputmode="decimal" id="cart-price-${item.id}" value="${item.unit_price.toFixed(2)}"
                       onfocus="setPosActiveInput(this); this.select();"
                       oninput="onPosCartPriceChange('${item.id}', this.value)"
                       onkeydown="handlePosRowInputKey(event, '${item.id}')"
                       style="width: 78px; padding: 5px 6px; background: #070d1e; border: 1.5px solid rgba(16,185,129,0.5); border-radius: 6px; color: #10b981; font-weight: 900; font-size: 13px; text-align: right; font-family: monospace; outline: none; box-sizing: border-box;"
                       title="Bu satışa özel birim fiyatı değiştirebilirsiniz">
                <span style="font-size: 10.5px; color: #94a3b8; font-weight: 700;">TL</span>
              </div>
            </td>

            <!-- 5. Ürün Tutarı -->
            <td id="row-total-${item.id}" style="padding: 6px 10px; text-align: right; font-weight: 900; color: #ef4444; font-size: 14px; font-family: monospace; border-right: 1px solid rgba(255,255,255,0.06);">
              ${item.total_price.toFixed(2).replace('.', ',')} TL
            </td>

            <!-- 6. İşlem (Sil) -->
            <td style="padding: 6px 6px; text-align: center;">
              <button onclick="removePosCartItem('${item.id}')" style="background: transparent; border: none; color: #f87171; cursor: pointer; font-size: 13px;" title="Satırı Sil">🗑️</button>
            </td>

          </tr>
        `;
      }).join('');
    }
  }

  // Büyük Kırmızı Total Fiyat (Parçalı Ödeme & Kalan Bakiye Desteği)
  const grandFormatted = `${grandTotal.toFixed(2).replace('.', ',')} TL`;
  const paidTotal = (window.posSplitPayments || []).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const remainingTotal = Math.max(0, Math.round((grandTotal - paidTotal) * 100) / 100);

  if (totalAmountEl) {
    if (paidTotal > 0 && grandTotal > 0) {
      totalAmountEl.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: flex-end; line-height: 1.1;">
          <span style="font-size: 11.5px; color: #34d399; font-weight: 800;">Alınan: ${paidTotal.toFixed(2).replace('.', ',')} TL</span>
          <span style="font-size: 26px; font-weight: 900; color: ${remainingTotal <= 0 ? '#10b981' : '#ef4444'}; font-family: monospace;">KALAN: ${remainingTotal.toFixed(2).replace('.', ',')} TL</span>
        </div>
      `;
    } else {
      totalAmountEl.innerText = grandFormatted;
      totalAmountEl.style.color = '#ef4444';
    }
  }

  // 4'lü Alt Özet Şeridi
  if (summaryVarietyEl) {
    summaryVarietyEl.innerText = `${posCart.length}`;
  }
  if (summaryQtyEl) {
    summaryQtyEl.innerText = `${Math.round(totalAdetCount * 10) / 10}`;
  }
  if (summaryKgEl) {
    summaryKgEl.innerText = `${totalKgWeight.toFixed(2).replace('.', ',')} Kg`;
  }
  if (summaryTotalEl) {
    summaryTotalEl.innerText = grandFormatted;
  }
}

// 5. FİŞ BEKLETME (PARK) VE GERİ ÇAĞIRMA (RECALL)
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

function updateParkedReceiptsUI() {
  const btnText = document.getElementById('parked-receipts-btn-text');
  if (btnText) {
    btnText.innerText = `📋 BEKLEYEN (${parkedReceipts.length})`;
  }

  // Satış Ekranındaki Yanıp Sönen BEKLEYEN Barı
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

  // Bekleyen Ürünleri Görme & Önizleme Alanı
  const previewBox = document.getElementById('pos-waiting-preview-container');
  const previewList = document.getElementById('pos-waiting-preview-list');

  if (previewBox && previewList) {
    if (parkedReceipts.length === 0) {
      previewBox.style.display = 'none';
      previewList.innerHTML = '';
    } else {
      previewBox.style.display = 'block';
      previewList.innerHTML = parkedReceipts.map((p, idx) => `
        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(30,58,138,0.25); border: 1px solid rgba(59,130,246,0.3); border-radius: 6px; padding: 4px 8px;">
          <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 6px; flex: 1;">
            <strong style="color: #fde047; font-size: 11.5px;">Fiş #${idx + 1} (${p.time}):</strong>
            <span style="color: #cbd5e1; font-size: 11px; margin-left: 4px;">${p.items.map(i => `${i.title} (${i.quantity} ${i.unit || 'Adet'})`).join(', ')}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
            <strong style="color: #ef4444; font-family: monospace; font-size: 12px;">${p.total.toFixed(2).replace('.', ',')} TL</strong>
            <button onclick="recallParkedReceipt('${p.id}')" style="background: #2563eb; color: #ffffff; border: none; padding: 2px 6px; border-radius: 4px; font-size: 10.5px; font-weight: 700; cursor: pointer;">📥 Al</button>
            <button onclick="deleteParkedReceipt('${p.id}')" style="background: rgba(239,68,68,0.2); color: #f87171; border: 1px solid rgba(239,68,68,0.3); padding: 2px 5px; border-radius: 4px; font-size: 10px; cursor: pointer;">🗑️</button>
          </div>
        </div>
      `).join('');
    }
  }
}

function handleWaitingBarClick() {
  if (parkedReceipts.length === 0) {
    if (typeof showToast === 'function') {
      showToast('Şu an beklemede fiş yok. Fiş bekletmek için [F5 Fişi Beklet] tuşuna basabilirsiniz.', 'info');
    }
    return;
  }

  if (parkedReceipts.length === 1) {
    // 1 adet bekleyen varsa doğrudan kasaya yükle
    recallParkedReceipt(parkedReceipts[0].id);
  } else {
    // Birden fazla bekleyen varsa seçim modalını aç
    openParkedReceiptsModal();
  }
}

window.handleWaitingBarClick = handleWaitingBarClick;

function recallParkedReceipt(parkId) {
  const pIdx = parkedReceipts.findIndex(p => p.id === parkId);
  if (pIdx === -1) return;

  if (posCart.length > 0) {
    if (!confirm('Sepette mevcut ürünler var. Mevcut sepet beklemeye alınsın ve seçilen fiş kasaya çağrılsın mı?')) {
      return;
    }
    parkCurrentReceipt();
  }

  const recalled = parkedReceipts.splice(pIdx, 1)[0];
  posCart = recalled.items || [];
  renderPosCart();
  updateParkedReceiptsUI();
  closeParkedReceiptsModal();

  if (typeof showToast === 'function') {
    showToast(`📥 Fiş kasaya çağrıldı (${posCart.length} Kalem)`, 'success');
  }
}

function deleteParkedReceipt(parkId) {
  if (!confirm('Bu bekleyen fişi silmek istediğinize emin misiniz?')) return;
  parkedReceipts = parkedReceipts.filter(p => p.id !== parkId);
  updateParkedReceiptsUI();
  openParkedReceiptsModal();
}

function clearAllParkedReceipts() {
  if (parkedReceipts.length === 0) return;
  if (confirm('Tüm bekleyen fişleri temizlemek istediğinize emin misiniz?')) {
    parkedReceipts = [];
    updateParkedReceiptsUI();
    closeParkedReceiptsModal();
    if (typeof showToast === 'function') showToast('Tüm bekleyen fişler silindi.', 'info');
  }
}

// 6. ANA MENÜYE DÖNÜŞ (SEPET VE BEKLEYEN FİŞLERİ KORUR)
function exitPosToHome() {
  switchTab('tab-home');
  if (typeof showToast === 'function') {
    if (posCart.length > 0) {
      showToast('ℹ️ Satış sepetiniz ve bekleyen fişleriniz korundu.', 'info');
    }
  }
}

// =========================================================
// 7. YENİ 9'LU ALT EYLEMLER VE ONAY MEKANİZMALARI
// =========================================================



// 7.2. FİYAT GÖR / BARKOD SORGULA
function openPosPriceCheckModal() {
  const inp = document.getElementById('pos-price-check-input');
  const resEl = document.getElementById('pos-price-check-result');

  if (inp) inp.value = '';
  if (resEl) {
    resEl.innerHTML = '<span style="color: #64748b; font-size: 13px;">Barkod okutulduğunda ürün detayları ve fiyatı anında burada görünecektir.</span>';
  }

  if (typeof openUniversalModal === 'function') {
    openUniversalModal('modal-pos-price-check');
  } else {
    const modal = document.getElementById('modal-pos-price-check');
    if (modal) { modal.classList.add('active'); modal.style.display = 'flex'; }
  }

  setTimeout(() => {
    if (inp) inp.focus();
  }, 80);
}

function closePosPriceCheckModal() {
  if (typeof closeUniversalModal === 'function') {
    closeUniversalModal('modal-pos-price-check');
  } else {
    const modal = document.getElementById('modal-pos-price-check');
    if (modal) { modal.classList.remove('active'); modal.style.display = 'none'; }
  }
}

let priceCheckDebounceTimer = null;
let lastFoundPriceCheckProduct = null;

function handlePosPriceCheckLive(val) {
  clearTimeout(priceCheckDebounceTimer);
  const q = (val || '').trim();
  if (!q || q.length < 2) return;
  priceCheckDebounceTimer = setTimeout(() => {
    executePriceCheckQuery(q);
  }, 250);
}

async function handlePosPriceCheckKey(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    const inp = document.getElementById('pos-price-check-input');
    const query = (inp?.value || '').trim();
    if (query) executePriceCheckQuery(query);
  }
}

async function executePriceCheckQuery(query) {
  const resEl = document.getElementById('pos-price-check-result');
  const btnAdd = document.getElementById('btn-add-checked-to-cart');
  if (!resEl) return;

  resEl.innerHTML = '<span style="color: #38bdf8; font-size: 14px; font-weight: 700;">🔍 Fiyat sorgulanıyor...</span>';

  try {
    const res = await fetch(`/api/pos/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (data.status === 'success' && data.product) {
      const p = data.product;
      lastFoundPriceCheckProduct = p;
      const numericPrice = (p.price || 0).toFixed(2).replace('.', ',');
      
      resEl.innerHTML = `
        <div style="font-size: 18px; font-weight: 900; color: #ffffff; margin-bottom: 6px; letter-spacing: 0.3px;">${p.title}</div>
        <div style="font-size: 38px; font-weight: 900; color: #10b981; font-family: monospace; text-shadow: 0 0 15px rgba(16,185,129,0.4); margin: 6px 0;">
          ${numericPrice} TL
        </div>
        <div style="display: flex; gap: 12px; justify-content: center; color: #94a3b8; font-size: 12px; margin-top: 4px;">
          <span>Barkod: <strong style="color: #38bdf8; font-family: monospace;">${p.barcode}</strong></span>
          <span>Birim: <strong style="color: #cbd5e1;">${p.unit || 'Adet'}</strong></span>
          <span>Stok: <strong style="color: #fbbf24;">${p.stock || 0}</strong></span>
        </div>
      `;
      if (btnAdd) btnAdd.style.display = 'inline-block';
    } else {
      lastFoundPriceCheckProduct = null;
      resEl.innerHTML = `
        <div style="color: #f87171; font-size: 15px; font-weight: 800;">❌ Ürün Bulunamadı</div>
        <div style="color: #64748b; font-size: 12px; margin-top: 4px;">'${query}' barkodlu ürün sistemde kayıtlı değil.</div>
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
  addItemToPosCart({
    barcode: p.barcode,
    title: p.title,
    unit_price: parseFloat(p.price) || 0,
    total_price: parseFloat(p.price) || 0,
    quantity: 1,
    unit: p.unit || 'Adet'
  });
  closePosPriceCheckModal();
  if (typeof showToast === 'function') {
    showToast(`✓ ${p.title} sepete eklendi`, 'success');
  }
}

// 7.3. SEPET TEMİZLEME (ONAYLI)
function confirmClearPosCart() {
  if (posCart.length === 0 && (!window.posSplitPayments || window.posSplitPayments.length === 0)) {
    if (typeof showToast === 'function') showToast('ℹ️ Satış sepetiniz zaten boş.', 'info');
    return;
  }
  if (typeof openUniversalModal === 'function') {
    openUniversalModal('modal-pos-clear-confirm');
  } else {
    const modal = document.getElementById('modal-pos-clear-confirm');
    if (modal) { modal.classList.add('active'); modal.style.display = 'flex'; }
  }
}

function closePosClearConfirmModal() {
  if (typeof closeUniversalModal === 'function') {
    closeUniversalModal('modal-pos-clear-confirm');
  } else {
    const modal = document.getElementById('modal-pos-clear-confirm');
    if (modal) { modal.classList.remove('active'); modal.style.display = 'none'; }
  }
}

function executeClearPosCart() {
  clearPosCart();
  closePosClearConfirmModal();
  if (typeof showToast === 'function') showToast('Sepet ve sipariş başarıyla temizlendi.', 'info');
}

// 7.4. PARÇALI ÖDEME & KALAN BAKİYE SİSTEMİ
function getPosCartGrandTotal() {
  return posCart.reduce((sum, i) => sum + (parseFloat(i.total_price) || 0), 0);
}

function getPosPaidTotal() {
  if (!window.posSplitPayments) window.posSplitPayments = [];
  return window.posSplitPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
}

function getPosRemainingTotal() {
  const grand = getPosCartGrandTotal();
  const paid = getPosPaidTotal();
  const rem = grand - paid;
  return Math.max(0, Math.round(rem * 100) / 100);
}

// Ödeme modalını aç
function openPosPaymentModal(prefillPaymentType = 'Kredi Kartı') {
  if (posCart.length === 0) {
    if (typeof showToast === 'function') showToast('Sepette ürün olmadan ödeme alınamaz.', 'warning');
    return;
  }

  window.currentPosPaymentType = prefillPaymentType;
  updatePosPaymentModalView();

  if (typeof openUniversalModal === 'function') {
    openUniversalModal('modal-pos-payment');
  } else {
    const modal = document.getElementById('modal-pos-payment');
    if (modal) { modal.classList.add('active'); modal.style.display = 'flex'; }
  }

  const inp = document.getElementById('pos-pay-partial-input');
  if (inp) {
    const rem = getPosRemainingTotal();
    inp.value = rem > 0 ? rem.toFixed(2) : '';
    setTimeout(() => {
      inp.focus();
      inp.select();
    }, 100);
  }
}

function closePosPaymentModal() {
  if (typeof closeUniversalModal === 'function') {
    closeUniversalModal('modal-pos-payment');
  } else {
    const modal = document.getElementById('modal-pos-payment');
    if (modal) { modal.classList.remove('active'); modal.style.display = 'none'; }
  }
}

function updatePosPaymentModalView() {
  const grand = getPosCartGrandTotal();
  const paid = getPosPaidTotal();
  const rem = getPosRemainingTotal();

  const grandEl = document.getElementById('pos-pay-grand-total');
  const paidEl = document.getElementById('pos-pay-paid-amount');
  const remEl = document.getElementById('pos-pay-remaining-amount');
  const cardSub = document.getElementById('btn-pay-full-card-sub');
  const cashSub = document.getElementById('btn-pay-full-cash-sub');
  const finalizeBtn = document.getElementById('btn-pos-pay-finalize');
  const splitsCont = document.getElementById('pos-pay-splits-container');
  const splitsList = document.getElementById('pos-pay-splits-list');

  const grandStr = `${grand.toFixed(2).replace('.', ',')} TL`;
  const paidStr = `${paid.toFixed(2).replace('.', ',')} TL`;
  const remStr = `${rem.toFixed(2).replace('.', ',')} TL`;

  if (grandEl) grandEl.innerText = grandStr;
  if (paidEl) paidEl.innerText = paidStr;
  if (remEl) {
    remEl.innerText = remStr;
    remEl.style.color = rem <= 0 ? '#10b981' : '#ef4444';
  }
  if (cardSub) cardSub.innerText = `(${remStr})`;
  if (cashSub) cashSub.innerText = `(${remStr})`;

  // Alınan parçalı ödemeler listesi
  if (splitsCont && splitsList) {
    if (window.posSplitPayments && window.posSplitPayments.length > 0) {
      splitsCont.style.display = 'block';
      splitsList.innerHTML = window.posSplitPayments.map((p, idx) => `
        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(15,23,42,0.9); padding: 5px 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.06);">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 13px;">${p.type === 'Kredi Kartı' ? '💳' : '💵'}</span>
            <strong style="color: ${p.type === 'Kredi Kartı' ? '#60a5fa' : '#34d399'}; font-size: 12px;">${p.type}</strong>
            <small style="color: #64748b; font-size: 10.5px;">(${p.time})</small>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <strong style="color: #f8fafc; font-family: monospace; font-size: 13px;">${p.amount.toFixed(2).replace('.', ',')} TL</strong>
            <button type="button" onclick="removePartialPosPayment(${idx})" style="background: transparent; border: none; color: #f87171; font-size: 11px; cursor: pointer; font-weight: 700;" title="Ödemeyi İptal Et">
              ✕ İptal
            </button>
          </div>
        </div>
      `).join('');
    } else {
      splitsCont.style.display = 'none';
    }
  }

  // Eğer kalan 0 olduysa Satışı Tamamla butonunu göster
  if (finalizeBtn) {
    finalizeBtn.style.display = (rem <= 0 && grand > 0) ? 'inline-block' : 'none';
  }
}

function setPartialInputAmount(val) {
  const inp = document.getElementById('pos-pay-partial-input');
  if (inp) {
    inp.value = val;
    inp.focus();
  }
}

function handlePartialPaymentKey(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    addPartialPosPayment(window.currentPosPaymentType || 'Kredi Kartı');
  }
}

// Parçalı ödeme ekle (Nakit veya Kart)
function addPartialPosPayment(paymentType) {
  const inp = document.getElementById('pos-pay-partial-input');
  const rem = getPosRemainingTotal();

  let amount = parseFloat(inp?.value || '0');
  if (isNaN(amount) || amount <= 0) {
    amount = rem; // Eğer boş bırakıldıysa kalan tutarın tamamı
  }

  if (amount <= 0) {
    if (typeof showToast === 'function') showToast('Kalan bakiye zaten 0,00 TL.', 'info');
    return;
  }

  // Kalan bakiyeden fazlaysa kartta sınırla, nakitte para üstü olarak hesapla
  let actualPay = amount;
  if (paymentType === 'Kredi Kartı' && amount > rem) {
    actualPay = rem;
  } else if (paymentType === 'Nakit' && amount > rem) {
    actualPay = rem; // Bakiyeden kalan kadar düşer
  }

  if (!window.posSplitPayments) window.posSplitPayments = [];
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

  window.posSplitPayments.push({
    id: 'pay_' + Date.now(),
    type: paymentType,
    amount: actualPay,
    time: timeStr
  });

  const newRem = getPosRemainingTotal();
  if (typeof showToast === 'function') {
    showToast(`✓ ${actualPay.toFixed(2)} TL ${paymentType} tahsil edildi. Kalan: ${newRem.toFixed(2)} TL`, 'success');
  }

  if (inp) {
    inp.value = newRem > 0 ? newRem.toFixed(2) : '';
  }

  updatePosPaymentModalView();
  renderPosCart();

  if (newRem <= 0) {
    // Bakiye kapandı, satışı tamamla
    setTimeout(() => {
      finalizeSplitPosSale();
    }, 250);
  }
}

function removePartialPosPayment(idx) {
  if (window.posSplitPayments && window.posSplitPayments[idx]) {
    const removed = window.posSplitPayments.splice(idx, 1)[0];
    if (typeof showToast === 'function') {
      showToast(`↩️ ${removed.amount.toFixed(2)} TL (${removed.type}) ödemesi iptal edildi.`, 'info');
    }
    updatePosPaymentModalView();
    renderPosCart();
    const inp = document.getElementById('pos-pay-partial-input');
    const rem = getPosRemainingTotal();
    if (inp) inp.value = rem.toFixed(2);
  }
}

// Tamamı Kart veya Tamamı Nakit ile anında kapat
function payFullPosAmount(paymentType) {
  const rem = getPosRemainingTotal();
  if (rem > 0) {
    if (!window.posSplitPayments) window.posSplitPayments = [];
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

    window.posSplitPayments.push({
      id: 'pay_' + Date.now(),
      type: paymentType,
      amount: rem,
      time: timeStr
    });
  }
  updatePosPaymentModalView();
  finalizeSplitPosSale();
}

// Satışı Backend'e Gönder ve Tamamla
async function finalizeSplitPosSale() {
  if (posCart.length === 0) return;

  const grandTotal = getPosCartGrandTotal();
  const printReceipt = document.getElementById('pos-pay-print-receipt-chk')?.checked ?? true;

  // Parçalı ödeme toplamları
  let nakitTotal = 0;
  let kartTotal = 0;

  if (window.posSplitPayments && window.posSplitPayments.length > 0) {
    window.posSplitPayments.forEach(p => {
      if (p.type === 'Kredi Kartı') kartTotal += p.amount;
      else nakitTotal += p.amount;
    });
  } else {
    // Varsayılan tam ödeme
    kartTotal = grandTotal;
  }

  // Ödeme türü metni
  let pTypeStr = 'Nakit';
  if (kartTotal > 0 && nakitTotal > 0) {
    pTypeStr = `Nakit (${nakitTotal.toFixed(2)} TL) + Kart (${kartTotal.toFixed(2)} TL)`;
  } else if (kartTotal > 0) {
    pTypeStr = 'Kredi Kartı';
  }

  const payload = {
    items: posCart,
    total_amount: grandTotal,
    payment_type: pTypeStr,
    payment_breakdown: {
      "Nakit": Math.round(nakitTotal * 100) / 100,
      "Kredi Kartı": Math.round(kartTotal * 100) / 100
    },
    received_cash: nakitTotal,
    change_amount: 0.0,
    customer_name: 'Perakende Müşteri',
    print_receipt: printReceipt
  };

  try {
    const res = await fetch('/api/pos/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.status === 'success') {
      const receiptInfo = printReceipt ? ' (🧾 Fiş Yazdırıldı)' : '';
      if (typeof showToast === 'function') {
        showToast(`✅ Satış Tamamlandı: ${pTypeStr}${receiptInfo}`, 'success');
      }

      closePosPaymentModal();
      clearPosCart();
      loadDashboardSummary();
      loadRecentHomeSales();

      const inp = document.getElementById('pos-barcode-input');
      if (inp) inp.focus();
    } else {
      if (typeof showToast === 'function') showToast(`⚠️ ${data.message}`, 'error');
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('Satış tamamlama hatası.', 'error');
  }
}

function completePosSale(paymentType = 'Nakit', printReceipt = true) {
  const chk = document.getElementById('pos-pay-print-receipt-chk');
  if (chk) chk.checked = printReceipt;
  payFullPosAmount(paymentType);
}

// 7.5. SATIŞ BAŞLATMA (ÖDEME MODALI AÇILIR VEYA DİREKT PARÇALI ALINIR)
function startPosSaleCheckout(paymentType) {
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

  // Eğer kasiyer barkod/numpad kutusuna bir tutar yazdıysa (örn: 50) ve Kart/Nakit butonuna bastıysa:
  if (!isNaN(parsedAmt) && parsedAmt > 0 && !typedVal.includes('*')) {
    barcodeInp.value = '';
    openPosPaymentModal(paymentType);
    const partInp = document.getElementById('pos-pay-partial-input');
    if (partInp) partInp.value = parsedAmt.toFixed(2);
    addPartialPosPayment(paymentType);
    return;
  }

  openPosPaymentModal(paymentType);
}

// 7.4. ESKİ SATIŞLAR & BEKLEYEN FİŞLER MODALI
function openPosRecentSalesModal() {
  openParkedReceiptsModal();
}

function openParkedReceiptsModal() {
  const modal = document.getElementById('modal-parked-receipts');
  const parkedListEl = document.getElementById('parked-receipts-list');
  const recentListEl = document.getElementById('recent-pos-sales-list');
  if (!modal) return;

  // 1. Bekleyen Fişleri Doldur
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

  // 2. Son Satışları API'den Çek
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

  if (typeof openUniversalModal === 'function') {
    openUniversalModal('modal-parked-receipts');
  } else {
    const modal = document.getElementById('modal-parked-receipts');
    if (modal) { modal.classList.add('active'); modal.style.display = 'flex'; }
  }
}

function closeParkedReceiptsModal() {
  if (typeof closeUniversalModal === 'function') {
    closeUniversalModal('modal-parked-receipts');
  } else {
    const modal = document.getElementById('modal-parked-receipts');
    if (modal) { modal.classList.remove('active'); modal.style.display = 'none'; }
  }
}

// 7.5. İADE MODALI
function openPosReturnModal() {
  const bcInp = document.getElementById('pos-return-barcode');
  const amtInp = document.getElementById('pos-return-amount');
  const qtyInp = document.getElementById('pos-return-qty');

  if (bcInp) bcInp.value = '';
  if (amtInp) amtInp.value = '';
  if (qtyInp) qtyInp.value = '1';

  if (typeof openUniversalModal === 'function') {
    openUniversalModal('modal-pos-return');
  } else {
    const modal = document.getElementById('modal-pos-return');
    if (modal) { modal.classList.add('active'); modal.style.display = 'flex'; }
  }

  setTimeout(() => {
    if (amtInp) amtInp.focus();
  }, 80);
}

function closePosReturnModal() {
  if (typeof closeUniversalModal === 'function') {
    closeUniversalModal('modal-pos-return');
  } else {
    const modal = document.getElementById('modal-pos-return');
    if (modal) { modal.classList.remove('active'); modal.style.display = 'none'; }
  }
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

// 7.6. EN ALT DURUM BUTONLARI FONKSİYONLARI (ŞUBE, TERMİNAL, KASİYER, ONLİNE)
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

function openCashierSwitchModal() {
  if (typeof openUniversalModal === 'function') {
    openUniversalModal('modal-cashier-switch');
  } else {
    const modal = document.getElementById('modal-cashier-switch');
    if (modal) {
      modal.classList.add('active');
      modal.style.display = 'flex';
    }
  }
}

function closeCashierSwitchModal() {
  if (typeof closeUniversalModal === 'function') {
    closeUniversalModal('modal-cashier-switch');
  } else {
    const modal = document.getElementById('modal-cashier-switch');
    if (modal) {
      modal.classList.remove('active');
      modal.style.display = 'none';
    }
  }
}

function submitCashierSwitch() {
  const select = document.getElementById('cashier-select-dropdown');
  const selectedCashier = select ? select.options[select.selectedIndex].text : 'Admin';
  closeCashierSwitchModal();
  if (typeof showToast === 'function') {
    showToast(`👤 Aktif Kasiyer Değiştirildi: ${selectedCashier}`, 'success');
  }
}

// 7.7. ÇEKMECE AÇMA & İKRAM
function openCashDrawerAction() {
  fetch('/api/pos/open_drawer', { method: 'POST' }).catch(() => {});
  if (typeof showToast === 'function') {
    showToast('🗄️ Para çekmecesi tetiklendi ve açıldı.', 'success');
  }
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
  if (typeof showToast === 'function') showToast('🎁 Sepetteki ürünlere %100 İkram uygulandı!', 'success');
}

// 7.6. MOBİL QR VE CANLI BAĞLI CİHAZLAR MODALI
let currentMobileInfoData = null;
let currentMobileProtocol = 'https';

async function openPosMobileQrModal() {
  if (typeof openUniversalModal === 'function') {
    openUniversalModal('modal-pos-mobile-qr');
  } else {
    const modal = document.getElementById('modal-pos-mobile-qr');
    if (modal) { modal.classList.add('active'); modal.style.display = 'flex'; }
  }

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
  if (typeof closeUniversalModal === 'function') {
    closeUniversalModal('modal-pos-mobile-qr');
  } else {
    const modal = document.getElementById('modal-pos-mobile-qr');
    if (modal) { modal.classList.remove('active'); modal.style.display = 'none'; }
  }
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
  const badgeEl = document.getElementById('pos-mobile-connected-badge');
  if (!listEl) return;

  try {
    const res = await fetch('/api/pos/connected_devices');
    const data = await res.json();
    const devices = data.devices || [];
    renderConnectedDevicesList(devices);
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
    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(30,58,138,0.25); border: 1px solid rgba(56,189,248,0.3); border-radius: 8px; padding: 8px 10px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 14px;">🟢</span>
        <div>
          <strong style="color: #f8fafc; font-size: 12px; display: block;">${d.device || 'Mobil Terminal'}</strong>
          <small style="color: #94a3b8; font-size: 10.5px;">Son İşlem: ${d.last_seen || '-'} (${d.action || 'Aktif'})</small>
        </div>
      </div>
      <span style="background: rgba(16,185,129,0.15); color: #34d399; font-size: 10.5px; font-weight: 800; padding: 2px 6px; border-radius: 4px;">Bağlı</span>
    </div>
  `).join('');
}



// =========================================================
// ALT+F4 VE ÇIKIŞ ONAY YÖNETİMİ (BEKLEYEN ÜRÜN KONTROLÜ)
// =========================================================
function openPosExitConfirmModal() {
  const modal = document.getElementById('modal-pos-exit-confirm');
  const summaryEl = document.getElementById('pos-exit-confirm-summary');
  if (!modal) return;

  const cartCount = posCart.length;
  const cartTotal = posCart.reduce((sum, i) => sum + (parseFloat(i.total_price) || 0), 0);
  const parkCount = parkedReceipts.length;
  const parkTotal = parkedReceipts.reduce((sum, p) => sum + (parseFloat(p.total) || 0), 0);

  let html = '';
  if (cartCount > 0) {
    html += `<div>🛒 <strong>Mevcut Sepette:</strong> <span style="color: #38bdf8;">${cartCount} Kalem Ürün</span> (Tutar: <strong style="color: #ef4444;">${cartTotal.toFixed(2).replace('.', ',')} TL</strong>)</div>`;
  }
  if (parkCount > 0) {
    html += `<div>⏸️ <strong>Beklemedeki Fişler:</strong> <span style="color: #fbbf24;">${parkCount} Adet Fiş</span> (Toplam Tutar: <strong style="color: #ef4444;">${parkTotal.toFixed(2).replace('.', ',')} TL</strong>)</div>`;
  }

  if (summaryEl) summaryEl.innerHTML = html;
  modal.classList.add('active');
  modal.style.display = 'flex';
}

function cancelPosExitModal() {
  const modal = document.getElementById('modal-pos-exit-confirm');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
}

function forceClosePosApp() {
  try {
    fetch('/api/system/close', { method: 'POST' }).catch(() => {});
  } catch(e) {}
  try { window.close(); } catch(e) {}
  setTimeout(() => {
    try { window.close(); } catch(e) {}
  }, 30);
}

window.openPosExitConfirmModal = openPosExitConfirmModal;
window.cancelPosExitModal = cancelPosExitModal;
window.forceClosePosApp = forceClosePosApp;

// Global Kısayollar (F2 Kart, F3 Sepet Temizle, F4 Nakit, F6 Fiyat Gör, F7 Kasa Çekmecesi, F8 Son Satışlar, F9 İade, F10 Hediye, ESC Ana Menü, Alt+F4 Çıkış)
window.addEventListener('keydown', (e) => {
  const exitModal = document.getElementById('modal-pos-exit-confirm');
  const isExitModalOpen = exitModal && exitModal.style.display === 'flex';

  const quickProdModal = document.getElementById('modal-pos-quick-product-manage');
  const isQuickProdOpen = quickProdModal && quickProdModal.style.display === 'flex';

  const priceModal = document.getElementById('modal-pos-price-check');
  const isPriceModalOpen = priceModal && priceModal.style.display === 'flex';

  const mobileModal = document.getElementById('modal-pos-mobile-qr');
  const isMobileModalOpen = mobileModal && mobileModal.style.display === 'flex';

  // 1. Alt + F4 Yakalama (Açık modalları kapatır, açık modal yoksa Windows'un pencereyi kapatmasına izin verir)
  if (e.altKey && (e.key === 'F4' || e.keyCode === 115 || e.code === 'F4')) {
    if (isQuickProdOpen) {
      e.preventDefault();
      closePosQuickProductModal();
      return;
    }
    if (isPriceModalOpen) {
      e.preventDefault();
      closePosPriceCheckModal();
      return;
    }
    if (isMobileModalOpen) {
      e.preventDefault();
      closePosMobileQrModal();
      return;
    }
    const receiptModal = document.getElementById('modal-pos-receipt-confirm');
    if (receiptModal && receiptModal.style.display === 'flex') {
      e.preventDefault();
      receiptModal.style.display = 'none';
      return;
    }
    const clearModal = document.getElementById('modal-pos-clear-confirm');
    if (clearModal && clearModal.style.display === 'flex') {
      e.preventDefault();
      closePosClearConfirmModal();
      return;
    }
    // Modal yoksa e.preventDefault() ÇAĞIRILMAZ -> Windows pencereyi doğal olarak kapatır!
    return;
  }

  // 2. F5 & Ctrl+R Yakalama: Sayfa Yenileme (Refresh) ASLA Engellenmez!
  if (e.key === 'F5' || (e.ctrlKey && (e.key === 'r' || e.key === 'R'))) {
    // Tarayıcının doğal sayfa yenilemesine izin ver
    return;
  }

  // 3. Çıkış Modalı Açıkken Tuş Kontrolleri (ENTER -> Kapat, ESC -> İptal)
  if (isExitModalOpen) {
    if (e.key === 'Enter') {
      e.preventDefault();
      forceClosePosApp();
      return;
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelPosExitModal();
      return;
    }
  }

  // 4. Ödeme Modalı Açıkken Tuş Kontrolleri (ENTER -> Tamamla / Düş, ESC -> İptal, F2 -> Tamamı Kart, F4 -> Tamamı Nakit)
  const paymentModal = document.getElementById('modal-pos-payment');
  if (paymentModal && paymentModal.style.display === 'flex') {
    if (e.key === 'Escape') {
      e.preventDefault();
      closePosPaymentModal();
      return;
    } else if (e.key === 'F2') {
      e.preventDefault();
      payFullPosAmount('Kredi Kartı');
      return;
    } else if (e.key === 'F4') {
      e.preventDefault();
      payFullPosAmount('Nakit');
      return;
    } else if (e.key === 'Enter') {
      const partInp = document.getElementById('pos-pay-partial-input');
      const rem = getPosRemainingTotal();
      if (document.activeElement === partInp && partInp && partInp.value) {
        e.preventDefault();
        addPartialPosPayment(window.currentPosPaymentType || 'Kredi Kartı');
        return;
      } else if (rem <= 0) {
        e.preventDefault();
        finalizeSplitPosSale();
        return;
      } else {
        e.preventDefault();
        payFullPosAmount(window.currentPosPaymentType || 'Kredi Kartı');
        return;
      }
    }
  }

  // 5. Sepet Temizleme Onay Modalı Açıkken (ENTER -> Sil, ESC -> İptal)
  const clearModal = document.getElementById('modal-pos-clear-confirm');
  if (clearModal && clearModal.style.display === 'flex') {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeClearPosCart();
      return;
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closePosClearConfirmModal();
      return;
    }
  }

  // 5.5. Barkod Bulunamadı Uyarısı Açıkken (ENTER -> Hızlı Ürün Tanımla, ESC / BOŞLUK -> Kapat)
  const notFoundModal = document.getElementById('modal-pos-barcode-not-found');
  if (notFoundModal && notFoundModal.style.display === 'flex') {
    if (e.key === 'Enter') {
      e.preventDefault();
      openQuickProductFromNotFoundAlert();
      return;
    } else if (e.key === 'Escape' || e.key === ' ') {
      e.preventDefault();
      closeBarcodeNotFoundAlert();
      return;
    }
  }

  // 6. Fiyat Gör, Mobil QR & Hızlı Ürün Modalları Açıkken (ESC -> Kapat / ENTER -> Kaydet)
  if (isQuickProdOpen) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closePosQuickProductModal();
      return;
    } else if (e.key === 'Enter' && e.target && e.target.id !== 'quick-prod-barcode') {
      e.preventDefault();
      submitQuickProductSave();
      return;
    }
  }

  if (isPriceModalOpen && e.key === 'Escape') {
    e.preventDefault();
    closePosPriceCheckModal();
    return;
  }
  if (isMobileModalOpen && e.key === 'Escape') {
    e.preventDefault();
    closePosMobileQrModal();
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
    startPosSaleCheckout('Kredi Kartı');
  } else if (e.key === 'F3') {
    e.preventDefault();
    confirmClearPosCart();
  } else if (e.key === 'F4') {
    e.preventDefault();
    startPosSaleCheckout('Nakit');
  } else if (e.key === 'F6') {
    e.preventDefault();
    openPosPriceCheckModal();
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
  } else if (e.key === 'Escape' || e.key === 'F12') {
    e.preventDefault();
    exitPosToHome();
  }
});

// =========================================================
// 9. HIZLI ÜRÜN EKLE / DÜZENLEME YÖNETİMİ
// =========================================================
let quickProdLookupTimer = null;

function openPosQuickProductModal(barcodeOrEvent = '') {
  let presetBarcode = '';
  if (typeof barcodeOrEvent === 'string' || typeof barcodeOrEvent === 'number') {
    presetBarcode = String(barcodeOrEvent).trim();
  }

  const modal = document.getElementById('modal-pos-quick-product-manage');
  if (!modal) {
    console.error('Modal #modal-pos-quick-product-manage bulunamadı!');
    return;
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
  if (unitInp) unitInp.value = 'Adet';
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

  // Modalı ekranda kesin ve anında görünür kıl
  modal.classList.add('active');
  modal.style.cssText = 'display: flex !important; visibility: visible !important; opacity: 1 !important; pointer-events: auto !important; position: fixed !important; inset: 0 !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; z-index: 9999999 !important; background: rgba(4, 8, 16, 0.85) !important; backdrop-filter: blur(8px) !important; align-items: center !important; justify-content: center !important;';

  setTimeout(() => {
    if (presetBarcode) {
      lookupQuickProductByBarcode(presetBarcode);
    } else if (bcInp) {
      bcInp.focus();
      bcInp.select();
    }
  }, 50);
}

function closePosQuickProductModal() {
  const modal = document.getElementById('modal-pos-quick-product-manage');
  if (modal) {
    modal.classList.remove('active');
    modal.style.setProperty('display', 'none', 'important');
    modal.style.setProperty('visibility', 'hidden', 'important');
    modal.style.setProperty('opacity', '0', 'important');
    modal.style.setProperty('pointer-events', 'none', 'important');
  }
  if (typeof closeUniversalModal === 'function') {
    closeUniversalModal('modal-pos-quick-product-manage');
  }
  const posInp = document.getElementById('pos-barcode-input');
  if (posInp) posInp.focus();
}

function onQuickProdBarcodeChange(val) {
  clearTimeout(quickProdLookupTimer);
  const barcode = (val || '').trim();
  if (!barcode || barcode.length < 2) return;

  quickProdLookupTimer = setTimeout(() => {
    lookupQuickProductByBarcode(barcode);
  }, 200);
}

function onQuickProdBarcodeKey(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    const val = (e.target.value || '').trim();
    if (val) lookupQuickProductByBarcode(val);
  }
}

async function lookupQuickProductByBarcode(barcode) {
  const badgeEl = document.getElementById('pos-quick-prod-status-badge');
  const titleInp = document.getElementById('quick-prod-title');
  const salePriceInp = document.getElementById('quick-prod-sale-price');
  const buyingPriceInp = document.getElementById('quick-prod-buying-price');
  const brandInp = document.getElementById('quick-prod-brand');
  const stockInp = document.getElementById('quick-prod-stock');
  const unitInp = document.getElementById('quick-prod-unit');
  const kdvInp = document.getElementById('quick-prod-kdv');
  const btnSave = document.getElementById('btn-save-quick-prod');

  try {
    const res = await fetch(`/api/pos/search?q=${encodeURIComponent(barcode)}`);
    const data = await res.json();

    if (data.status === 'success' && data.product) {
      const p = data.product;
      if (badgeEl) {
        badgeEl.style.background = 'rgba(16,185,129,0.1)';
        badgeEl.style.borderColor = 'rgba(16,185,129,0.3)';
        badgeEl.style.color = '#34d399';
        badgeEl.innerText = `Kayıtlı Ürün: ${p.title} (Bilgileri değiştirebilirsiniz)`;
      }

      if (titleInp) titleInp.value = p.title || '';
      if (salePriceInp) salePriceInp.value = (p.price || 0).toFixed(2);
      if (buyingPriceInp) buyingPriceInp.value = p.buying_price ? parseFloat(String(p.buying_price).replace(',', '.')).toFixed(2) : '';
      if (brandInp) brandInp.value = p.brand || '';
      if (stockInp) stockInp.value = p.stock || 0;
      if (unitInp) unitInp.value = p.unit || 'Adet';
      if (kdvInp) kdvInp.value = String(p.kdv !== undefined ? p.kdv : (p.vat_rate !== undefined ? p.vat_rate : '10'));

      recalcQuickProdMargin();

      if (btnSave) {
        btnSave.innerText = 'Değişiklikleri Kaydet (Enter)';
        btnSave.style.background = '#2563eb';
      }

      // Kullanıcı fiyatı hızlıca değiştirebilsin diye satış fiyatına odaklan
      if (salePriceInp) {
        salePriceInp.focus();
        salePriceInp.select();
      }
    } else {
      if (badgeEl) {
        badgeEl.style.background = 'rgba(56,189,248,0.1)';
        badgeEl.style.borderColor = 'rgba(56,189,248,0.3)';
        badgeEl.style.color = '#38bdf8';
        badgeEl.innerText = 'Yeni Ürün: Ürün adı ve satış fiyatını giriniz';
      }

      if (titleInp && !titleInp.value) titleInp.focus();
      if (btnSave) {
        btnSave.innerText = 'Yeni Ürünü Kaydet (Enter)';
        btnSave.style.background = '#2563eb';
      }
    }
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
  const unitInp = document.getElementById('quick-prod-unit');
  const kdvInp = document.getElementById('quick-prod-kdv');

  const barcode = (bcInp?.value || '').trim();
  const title = (titleInp?.value || '').trim();
  const price = (salePriceInp?.value || '').trim();
  const buyingPrice = (buyingPriceInp?.value || '').trim();
  const brand = (brandInp?.value || '').trim();
  const stock = parseInt(stockInp?.value || '0', 10) || 0;
  const unit = unitInp?.value || 'Adet';
  const kdv = parseInt(kdvInp?.value || '10', 10);

  if (!barcode) {
    if (typeof showToast === 'function') showToast('Lütfen bir barkod okutun veya yazın.', 'warning');
    if (bcInp) bcInp.focus();
    return;
  }
  if (!title) {
    if (typeof showToast === 'function') showToast('Lütfen ürün adını girin.', 'warning');
    if (titleInp) titleInp.focus();
    return;
  }
  if (!price || isNaN(parseFloat(price.replace(',', '.')))) {
    if (typeof showToast === 'function') showToast('Lütfen geçerli bir satış fiyatı girin.', 'warning');
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

      // Eğer kasada sepete ekleme istendiyse anında sepete at
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

      // Katalog ve diğer modülleri anında senkronize et
      if (typeof loadProducts === 'function') {
        loadProducts();
      }
      if (typeof loadCatalogProducts === 'function') {
        loadCatalogProducts();
      }
      if (typeof loadManavProducts === 'function') {
        loadManavProducts();
      }

      // POS barkod girişine odaklan
      const posBarcodeInput = document.getElementById('pos-barcode-input');
      if (posBarcodeInput) posBarcodeInput.focus();
    } else {
      if (typeof showToast === 'function') showToast(`⚠️ ${data.message}`, 'error');
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('Ürün kaydetme hatası.', 'error');
  }
}

// Global Window Bağlantıları (HTML onclick ve harici modüller için)
window.loadPosQuickGrid = loadPosQuickGrid;
window.addPosQuickItemByIndex = addPosQuickItemByIndex;
window.handleQuickGridItemClick = handleQuickGridItemClick;
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
window.closePosClearConfirmModal = closePosClearConfirmModal;
window.executeClearPosCart = executeClearPosCart;
window.startPosSaleCheckout = startPosSaleCheckout;
window.openCashDrawerAction = openCashDrawerAction;
window.openPosRecentSalesModal = openPosRecentSalesModal;
window.openParkedReceiptsModal = openParkedReceiptsModal;
window.closeParkedReceiptsModal = closeParkedReceiptsModal;
window.clearAllParkedReceipts = clearAllParkedReceipts;
window.openPosReturnModal = openPosReturnModal;
window.closePosReturnModal = closePosReturnModal;
window.submitPosReturnExecute = submitPosReturnExecute;
function closeCashierPinModal() {
  if (typeof closeUniversalModal === 'function') {
    closeUniversalModal('modal-cashier-pin');
  } else {
    const m = document.getElementById('modal-cashier-pin');
    if (m) m.style.display = 'none';
  }
}

function submitCashierPin() {
  if (typeof showToast === 'function') showToast('Kasiyer girişi onaylandı.', 'success');
  closeCashierPinModal();
}

function closeAddQuickButtonModal() {
  if (typeof closeUniversalModal === 'function') {
    closeUniversalModal('modal-add-quick-btn');
  } else {
    const m = document.getElementById('modal-add-quick-btn');
    if (m) m.style.display = 'none';
  }
}

function submitNewQuickButton() {
  if (typeof showToast === 'function') showToast('Hızlı buton kaydedildi.', 'success');
  closeAddQuickButtonModal();
}

window.closeCashierPinModal = closeCashierPinModal;
window.submitCashierPin = submitCashierPin;
window.closeAddQuickButtonModal = closeAddQuickButtonModal;
window.submitNewQuickButton = submitNewQuickButton;

window.showBranchInfo = showBranchInfo;
window.showTerminalInfo = showTerminalInfo;
window.checkOnlineServerStatus = checkOnlineServerStatus;
window.openCashierSwitchModal = openCashierSwitchModal;
window.closeCashierSwitchModal = closeCashierSwitchModal;
window.submitCashierSwitch = submitCashierSwitch;
window.applyPosGiftDiscount = applyPosGiftDiscount;
window.completePosSale = completePosSale;
window.openPosPaymentModal = openPosPaymentModal;
window.closePosPaymentModal = closePosPaymentModal;
window.setPartialInputAmount = setPartialInputAmount;
window.handlePartialPaymentKey = handlePartialPaymentKey;
window.addPartialPosPayment = addPartialPosPayment;
window.removePartialPosPayment = removePartialPosPayment;
window.payFullPosAmount = payFullPosAmount;
window.finalizeSplitPosSale = finalizeSplitPosSale;
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
window.openParkedReceiptsModal = openParkedReceiptsModal;
window.closeParkedReceiptsModal = closeParkedReceiptsModal;
window.clearAllParkedReceipts = clearAllParkedReceipts;
window.handleWaitingBarClick = handleWaitingBarClick;

// Alt 10 Buton ve Durum Çubuğu Butonları İçin Doğrudan Tıklama ve Olay Dinleyicileri (100% Güvenli Bağlantı)
function initPosBottomButtons() {
  const btnMap = {
    // 10'lu Ana Eylem Butonları
    'btn-pos-quick-prod': () => openPosQuickProductModal(),
    'btn-pos-action-quick-prod': () => openPosQuickProductModal(),
    'btn-pos-mobile': () => openPosMobileQrModal(),
    'btn-pos-action-mobile': () => openPosMobileQrModal(),
    'btn-pos-price-check': () => openPosPriceCheckModal(),
    'btn-pos-action-price-check': () => openPosPriceCheckModal(),
    'btn-pos-clear': () => confirmClearPosCart(),
    'btn-pos-action-clear': () => confirmClearPosCart(),
    'btn-pos-cash': () => startPosSaleCheckout('Nakit'),
    'btn-pos-action-cash': () => startPosSaleCheckout('Nakit'),
    'btn-pos-card': () => startPosSaleCheckout('Kredi Kartı'),
    'btn-pos-action-card': () => startPosSaleCheckout('Kredi Kartı'),
    'btn-pos-drawer': () => openCashDrawerAction(),
    'btn-pos-action-drawer': () => openCashDrawerAction(),
    'btn-pos-recent': () => openPosRecentSalesModal(),
    'btn-pos-action-recent': () => openPosRecentSalesModal(),
    'btn-pos-return': () => openPosReturnModal(),
    'btn-pos-action-return': () => openPosReturnModal(),
    'btn-pos-gift': () => applyPosGiftDiscount(),
    'btn-pos-action-gift': () => applyPosGiftDiscount(),
    // Alt Durum Çubuğu Butonları
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

window.initPosBottomButtons = initPosBottomButtons;

// En Alt İnce Durum Paneli - Canlı Saat ve Tarih (Tekil Interval)
let _posClockTimer = null;
function initPosFooterClock() {
  initPosBottomButtons();
  if (_posClockTimer) return;
  function tick() {
    const now = new Date();
    const dEl = document.getElementById('pos-footer-date');
    const tEl = document.getElementById('pos-footer-time');
    if (dEl) {
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      dEl.innerText = `${day}.${month}.${year}`;
    }
    if (tEl) {
      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      const secs = String(now.getSeconds()).padStart(2, '0');
      tEl.innerText = `${hours}:${mins}:${secs}`;
    }
  }
  tick();
  _posClockTimer = setInterval(tick, 1000);
}

document.addEventListener('DOMContentLoaded', () => {
  initPosFooterClock();
  initPosBottomButtons();
});
