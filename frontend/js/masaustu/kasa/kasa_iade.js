// -*- coding: utf-8 -*-
/**
 * KASA FİŞ İADE & SATIŞ DÜZENLEME MOTORU (kasa_iade.js)
 */

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

