/**
 * =========================================================================
 * 📦 MOBIL SAYIM: Reyon Stok Sayım, Miktar Güncelleme & Kataloğa İşleme
 * =========================================================================
 */

function renderStockAuditUI() {
  const listEl = document.getElementById('mob-audit-items-list');
  const countEl = document.getElementById('mob-audit-item-count');
  const totalQtyEl = document.getElementById('mob-audit-total-qty');
  const diffQtyEl = document.getElementById('mob-audit-diff-qty');

  const itemCount = mobileStockAuditSession.length;
  const totalQty = mobileStockAuditSession.reduce((acc, it) => acc + (parseFloat(it.counted_qty) || 0), 0);
  const totalDiff = mobileStockAuditSession.reduce((acc, it) => acc + ((parseFloat(it.counted_qty) || 0) - (parseFloat(it.system_stock) || 0)), 0);

  if (countEl) countEl.innerText = itemCount;
  if (totalQtyEl) totalQtyEl.innerText = totalQty;
  if (diffQtyEl) {
    diffQtyEl.innerText = (totalDiff >= 0 ? `+${totalDiff}` : totalDiff);
    diffQtyEl.style.color = totalDiff === 0 ? '#34d399' : (totalDiff > 0 ? '#38bdf8' : '#f87171');
  }

  if (!listEl) return;
  if (itemCount === 0) {
    listEl.innerHTML = `<div style="text-align: center; color: #64748b; font-size: 12px; padding: 30px 10px;">📷 Kamerayı açarak veya barkod yazarak reyon sayımına başlayın.</div>`;
    return;
  }

  listEl.innerHTML = mobileStockAuditSession.map((it, idx) => {
    const diff = (parseFloat(it.counted_qty) || 0) - (parseFloat(it.system_stock) || 0);
    const diffColor = diff === 0 ? '#10b981' : (diff > 0 ? '#38bdf8' : '#f87171');
    const diffSign = diff > 0 ? `+${diff}` : `${diff}`;

    return `
      <div style="background: rgba(15,23,42,0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 8px 10px; display: flex; justify-content: space-between; align-items: center;">
        <div style="flex: 1; min-width: 0; padding-right: 8px;">
          <strong style="color: #fff; font-size: 12px; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${it.title}</strong>
          <div style="font-size: 10.5px; color: #94a3b8; font-family: monospace; display: flex; gap: 8px; margin-top: 2px;">
            <span>🏷️ ${it.barcode}</span>
            <span>Sistem: <strong>${it.system_stock}</strong></span>
            <span style="color: ${diffColor}; font-weight: 800;">Fark: ${diffSign}</span>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <button onclick="changeAuditQty('${it.barcode}', -1)" style="background: rgba(255,255,255,0.1); border: none; color: #fff; width: 26px; height: 26px; border-radius: 6px; font-weight: 900; cursor: pointer;">-</button>
          <span style="font-size: 14px; font-weight: 900; color: #38bdf8; min-width: 28px; text-align: center;">${it.counted_qty}</span>
          <button onclick="changeAuditQty('${it.barcode}', 1)" style="background: rgba(56,189,248,0.2); border: none; color: #38bdf8; width: 26px; height: 26px; border-radius: 6px; font-weight: 900; cursor: pointer;">+</button>
          <button onclick="removeAuditItem('${it.barcode}')" style="background: transparent; border: none; color: #f87171; font-size: 12px; padding: 4px; cursor: pointer;">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

async function onStockAuditBarcodeScanned(barcode) {
  const cleanBc = String(barcode || '').trim();
  if (!cleanBc) return;

  playBeepSound();

  const existing = mobileStockAuditSession.find(x => x.barcode === cleanBc);
  if (existing) {
    existing.counted_qty += 1;
    renderStockAuditUI();
    showToast(`✓ +1 Adet eklendi (${existing.title})`, 'success');
    return;
  }

  // Ürün bilgilerini çek
  try {
    const res = await fetch(`/api/products/${cleanBc}`);
    const data = await res.json();
    let title = `Ürün (${cleanBc})`;
    let sysStock = 0;

    if (data.status === 'success' && data.product) {
      title = data.product.title || data.product.title1 || title;
      sysStock = parseFloat(data.product.stock || 0);
    }

    mobileStockAuditSession.unshift({
      barcode: cleanBc,
      title: title,
      counted_qty: 1,
      system_stock: sysStock
    });

    renderStockAuditUI();
    showToast(`✓ Sayıma eklendi: ${title}`, 'success');
  } catch (e) {
    mobileStockAuditSession.unshift({
      barcode: cleanBc,
      title: `Barkod: ${cleanBc}`,
      counted_qty: 1,
      system_stock: 0
    });
    renderStockAuditUI();
  }
}

function submitMobAuditBarcode() {
  const inp = document.getElementById('mob-audit-barcode-input');
  if (!inp || !inp.value.trim()) return;
  const bc = inp.value.trim();
  inp.value = '';
  onStockAuditBarcodeScanned(bc);
}

function startFullscreenScanner(mode) {
  if (mode === 'audit') {
    window._isCameraForPos = false;
    window._isCameraForAudit = true;
  }
  openFullscreenCamera();
}

function changeAuditQty(barcode, delta) {
  const item = mobileStockAuditSession.find(x => x.barcode === barcode);
  if (item) {
    item.counted_qty = Math.max(0, item.counted_qty + delta);
    if (item.counted_qty === 0) {
      removeAuditItem(barcode);
      return;
    }
    renderStockAuditUI();
  }
}

function removeAuditItem(barcode) {
  mobileStockAuditSession = mobileStockAuditSession.filter(x => x.barcode !== barcode);
  renderStockAuditUI();
}

function clearStockAuditSession() {
  if (mobileStockAuditSession.length === 0) return;
  const ok = confirm('Sayım listesini sıfırlamak istediğinize emin misiniz?');
  if (ok) {
    mobileStockAuditSession = [];
    renderStockAuditUI();
    showToast('Sayım listesi temizlendi.', 'info');
  }
}

async function commitStockAuditToCatalog() {
  if (mobileStockAuditSession.length === 0) {
    showToast('⚠️ Sayım listesinde ürün bulunmuyor.', 'warning');
    return;
  }

  const ok = confirm(`${mobileStockAuditSession.length} kalem ürünün sayılan miktarları ana kataloğa güncel stok olarak işlensin mi?`);
  if (!ok) return;

  try {
    let updatedCount = 0;
    for (const it of mobileStockAuditSession) {
      const res = await fetch(`/api/products/${it.barcode}`);
      const pData = await res.json();
      if (pData.status === 'success' && pData.product) {
        const p = pData.product;
        p.stock = it.counted_qty;
        await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(p)
        });
        updatedCount++;
      }
    }
    showToast(`✅ ${updatedCount} ürünün stoğu başarıyla güncellendi!`, 'success');
    mobileStockAuditSession = [];
    renderStockAuditUI();
  } catch (err) {
    console.error('Sayım kaydetme hatası:', err);
    showToast('Sayım kaydedilirken bir hata oluştu.', 'error');
  }
}

// Window Global Tanımlamaları
window.renderStockAuditUI = renderStockAuditUI;
window.onStockAuditBarcodeScanned = onStockAuditBarcodeScanned;
window.submitMobAuditBarcode = submitMobAuditBarcode;
window.startFullscreenScanner = startFullscreenScanner;
window.changeAuditQty = changeAuditQty;
window.removeAuditItem = removeAuditItem;
window.clearStockAuditSession = clearStockAuditSession;
window.commitStockAuditToCatalog = commitStockAuditToCatalog;
