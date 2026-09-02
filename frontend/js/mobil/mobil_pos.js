/**
 * =========================================================================
 * 🛒 MOBIL POS: Satış, Sepet, Miktar ve Tahsilat Motoru
 * =========================================================================
 */

function loadMobilePosCart() {
  try {
    const raw = localStorage.getItem('mob_pos_cart');
    if (raw) mobilePosCart = JSON.parse(raw) || [];
  } catch(e) {
    mobilePosCart = [];
  }
}

function saveMobilePosCart() {
  try {
    localStorage.setItem('mob_pos_cart', JSON.stringify(mobilePosCart));
  } catch(e) {}
  updateMobilePosUI();
}

function updateMobilePosUI() {
  const badge = document.getElementById('badge-mob-cart-count');
  if (badge) {
    badge.innerText = mobilePosCart.length;
    badge.style.display = mobilePosCart.length > 0 ? 'inline-block' : 'none';
  }
}

function renderMobilePosCart() {
  const container = document.getElementById('mob-pos-cart-container');
  const grandTotalEl = document.getElementById('mob-pos-grand-total');
  const itemCountEl = document.getElementById('mob-pos-item-count');
  const qtyCountEl = document.getElementById('mob-pos-qty-count');

  if (!container) return;

  let grandTotal = 0;
  let totalQty = 0;

  if (mobilePosCart.length === 0) {
    container.innerHTML = `
      <div style="background: rgba(15,23,42,0.6); border: 1.5px dashed rgba(255,255,255,0.15); border-radius: 12px; padding: 35px 15px; text-align: center; color: #64748b; font-size: 13px;">
        <div style="font-size: 32px; margin-bottom: 6px;">🛒</div>
        <strong style="color:#94a3b8;">Mobil Sepetiniz Boş</strong><br>
        Kamera ile seri barkod okutun veya yukarıdan barkod arayın.
      </div>
    `;
  } else {
    container.innerHTML = mobilePosCart.map((item, idx) => {
      grandTotal += (parseFloat(item.total_price) || 0);
      totalQty += (parseFloat(item.quantity) || 1);

      return `
        <div style="background: #0f1c38; border: 1.5px solid rgba(56,189,248,0.25); border-radius: 10px; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
          <div style="flex: 1; min-width: 0;">
            <div style="font-size: 13.5px; font-weight: 800; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${item.title}
            </div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">
              <span style="color:#38bdf8; font-family:monospace;">${item.barcode}</span> • Birim: <strong>${(parseFloat(item.unit_price)||0).toFixed(2).replace('.', ',')} TL</strong>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 6px;">
            <button onclick="changeMobCartQty(${idx}, -1)" style="width: 28px; height: 28px; background: #1e293b; border: 1px solid #475569; color: #fff; border-radius: 6px; font-weight: 900; font-size: 15px; cursor: pointer;">-</button>
            <span style="font-family: monospace; font-weight: 900; font-size: 14px; color: #fbbf24; min-width: 22px; text-align: center;">${item.quantity}</span>
            <button onclick="changeMobCartQty(${idx}, 1)" style="width: 28px; height: 28px; background: #1e293b; border: 1px solid #475569; color: #fff; border-radius: 6px; font-weight: 900; font-size: 15px; cursor: pointer;">+</button>
          </div>

          <div style="text-align: right; min-width: 70px;">
            <div style="font-family: monospace; font-weight: 900; font-size: 14.5px; color: #10b981;">
              ${(parseFloat(item.total_price)||0).toFixed(2).replace('.', ',')} TL
            </div>
            <button onclick="removeMobCartItem(${idx})" style="background: transparent; border: none; color: #f87171; font-size: 11px; cursor: pointer; padding: 2px; margin-top: 2px;">🗑️ Sil</button>
          </div>
        </div>
      `;
    }).join('');
  }

  if (grandTotalEl) grandTotalEl.innerText = `${grandTotal.toFixed(2).replace('.', ',')} TL`;
  if (itemCountEl) itemCountEl.innerText = `${mobilePosCart.length}`;
  if (qtyCountEl) qtyCountEl.innerText = `${Math.round(totalQty * 10) / 10}`;

  saveMobilePosCart();
}

function changeMobCartQty(idx, delta) {
  if (!mobilePosCart[idx]) return;
  mobilePosCart[idx].quantity = (parseFloat(mobilePosCart[idx].quantity) || 1) + delta;
  if (mobilePosCart[idx].quantity <= 0) {
    mobilePosCart.splice(idx, 1);
  } else {
    mobilePosCart[idx].total_price = Math.round(mobilePosCart[idx].quantity * mobilePosCart[idx].unit_price * 100) / 100;
  }
  renderMobilePosCart();
}

function removeMobCartItem(idx) {
  mobilePosCart.splice(idx, 1);
  renderMobilePosCart();
}

function clearMobilePosCart() {
  if (mobilePosCart.length === 0) return;
  if (confirm('🛒 Sepetteki tüm ürünler silinsin mi?')) {
    mobilePosCart = [];
    renderMobilePosCart();
    showToast('Sepet temizlendi.', 'info');
  }
}

async function submitMobilePosBarcode(rawQuery) {
  const query = (rawQuery || '').trim();
  if (!query) return;

  const inp = document.getElementById('inp-mob-pos-barcode');
  if (inp) inp.value = '';

  let qty = 1;
  let cleanQuery = query;

  if (query.includes('*')) {
    const parts = query.split('*');
    if (parts.length >= 2) {
      const pQty = parseFloat(parts[0].replace(',', '.'));
      if (!isNaN(pQty) && pQty > 0) {
        qty = pQty;
        cleanQuery = parts.slice(1).join('*').trim();
      }
    }
  }

  try {
    const res = await fetch(`/api/pos/search?q=${encodeURIComponent(cleanQuery)}`);
    const data = await res.json();

    if (data.status === 'success' && data.product) {
      const p = data.product;
      const uPrice = parseFloat(p.unit_price || p.price || 0.0);
      const isScale = p.is_scale_item || false;
      const actualQty = isScale ? (p.quantity || qty) : qty;

      const existingIdx = mobilePosCart.findIndex(i => i.barcode === p.barcode && i.title === p.title);
      if (existingIdx !== -1) {
        mobilePosCart[existingIdx].quantity += actualQty;
        mobilePosCart[existingIdx].total_price = Math.round(mobilePosCart[existingIdx].quantity * mobilePosCart[existingIdx].unit_price * 100) / 100;
      } else {
        mobilePosCart.unshift({
          title: p.title,
          barcode: p.barcode,
          unit_price: uPrice,
          total_price: Math.round(actualQty * uPrice * 100) / 100,
          quantity: actualQty,
          unit: p.unit || (isScale ? 'Kg' : 'Adet'),
          is_scale_item: isScale
        });
      }

      playBeepSound();
      if (navigator.vibrate) navigator.vibrate([60]);
      showToast(`✓ ${p.title} sepete eklendi!`, 'success');
      renderMobilePosCart();
    } else {
      showToast(`⚠️ "${cleanQuery}" sistemde bulunamadı.`, 'warning');
      if (typeof openMobileQuickProductModal === 'function') {
        openMobileQuickProductModal(cleanQuery);
      }
    }
  } catch(e) {
    showToast('Arama bağlantı hatası.', 'error');
  }
}

function openFullscreenCameraForPos() {
  window._isCameraForPos = true;
  window._isCameraForAudit = false;
  openFullscreenCamera();
}

async function checkoutMobilePosSale(paymentType = 'Nakit') {
  if (mobilePosCart.length === 0) {
    showToast('⚠️ Sepetiniz boş! Lütfen önce ürün ekleyin.', 'warning');
    return;
  }

  const grandTotal = mobilePosCart.reduce((s, i) => s + (parseFloat(i.total_price) || 0), 0);

  const ok = confirm(`💳 ${paymentType.toUpperCase()} TAHSİLATI\n\nToplam Tutar: ${grandTotal.toFixed(2).replace('.', ',')} TL\n\nSatış tamamlansın mı?`);
  if (!ok) return;

  const payload = {
    items: [...mobilePosCart],
    total_amount: grandTotal,
    payment_type: paymentType,
    payment_breakdown: {
      [paymentType]: grandTotal
    },
    received_cash: grandTotal,
    change_amount: 0.0,
    customer_name: 'Mobil Reyon Satışı',
    print_receipt: true
  };

  try {
    const res = await fetch('/api/pos/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.status === 'success') {
      playBeepSound();
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      showToast(`✅ ${paymentType} satışı başarıyla tamamlandı! (${grandTotal.toFixed(2)} TL)`, 'success');
      mobilePosCart = [];
      renderMobilePosCart();
    } else {
      showToast(`❌ ${data.message || 'Satış tamamlanamadı'}`, 'error');
    }
  } catch(e) {
    showToast('❌ Sunucu bağlantı hatası oluştu.', 'error');
  }
}

// Window Global Tanımlamaları
window.loadMobilePosCart = loadMobilePosCart;
window.saveMobilePosCart = saveMobilePosCart;
window.updateMobilePosUI = updateMobilePosUI;
window.renderMobilePosCart = renderMobilePosCart;
window.changeMobCartQty = changeMobCartQty;
window.removeMobCartItem = removeMobCartItem;
window.clearMobilePosCart = clearMobilePosCart;
window.submitMobilePosBarcode = submitMobilePosBarcode;
window.openFullscreenCameraForPos = openFullscreenCameraForPos;
window.checkoutMobilePosSale = checkoutMobilePosSale;
