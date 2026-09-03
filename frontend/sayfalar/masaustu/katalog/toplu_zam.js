// -*- coding: utf-8 -*-
/**
 * Toplu Zam Motoru ve Bugün Fiyatı Değişenler Baskı Kuyruğu Kontrolcüsü
 */
let priceChangedTodayList = [];
let lowStockList = [];

async function openBrandZamMotorModal() {
  const brandSelect = document.getElementById('batch-price-brand');
  if (brandSelect && typeof allSortedBrandsList !== 'undefined') {
    const currentVal = brandSelect.value;
    brandSelect.innerHTML = `<option value="TÜMÜ">🏢 TÜM MARKALAR (Tüm Katalog)</option>` + 
      allSortedBrandsList.map(b => `<option value="${b}">${b}</option>`).join('');
    brandSelect.value = currentVal || 'TÜMÜ';
  } else if (brandSelect && typeof allBrands !== 'undefined') {
    const currentVal = brandSelect.value;
    brandSelect.innerHTML = `<option value="TÜMÜ">🏢 TÜM MARKALAR (Tüm Katalog)</option>` + 
      allBrands.map(b => `<option value="${b}">${b}</option>`).join('');
    brandSelect.value = currentVal || 'TÜMÜ';
  }
  const modal = document.getElementById('modal-batch-price-update');
  if (modal) modal.style.display = 'flex';
}

function closeBatchPriceModal() {
  const modal = document.getElementById('modal-batch-price-update');
  if (modal) modal.style.display = 'none';
}

async function executeBatchPriceUpdate() {
  const brand = document.getElementById('batch-price-brand')?.value || 'TÜMÜ';
  const category_prefix = document.getElementById('batch-price-cat-prefix')?.value || '';
  const percent = parseFloat(document.getElementById('batch-price-percent')?.value) || 0.0;
  const flat_amount = parseFloat(document.getElementById('batch-price-flat')?.value) || 0.0;
  const round_to = parseFloat(document.getElementById('batch-price-round')?.value) || 0.0;

  if (percent === 0.0 && flat_amount === 0.0) {
    if (typeof showToast === 'function') showToast("Lütfen bir yüzde (%) veya sabit tutar (TL) artışı girin.", "warning");
    return;
  }

  const confirmMsg = `Seçilen Kriterler:\nMarka: ${brand}\nKategori: ${category_prefix || 'Tümü'}\nArtış: ${percent ? '%' + percent : ''} ${flat_amount ? '+' + flat_amount + ' TL' : ''}\n\nToplu fiyat güncellemesini uygulamak istiyor musunuz?`;
  const ok = await showCustomConfirm(confirmMsg, "⚡ Toplu Fiyat Güncelleme", "Güncelle", "Vazgeç", "⚡");
  if (!ok) return;

  const btn = document.getElementById('btn-execute-batch-price');
  if (btn) {
    btn.disabled = true;
    btn.innerText = "Güncelleniyor...";
  }

  try {
    const res = await fetch('/api/catalog/batch_price_update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand, category_prefix, percent, flat_amount, round_to, actor: 'Yönetici' })
    });
    const data = await res.json();
    if (data.status === 'success') {
      if (typeof showToast === 'function') showToast(`✅ ${data.message}`, "success");
      closeBatchPriceModal();
      if (typeof loadCatalog === 'function') {
        await loadCatalog();
      } else if (typeof loadAllProducts === 'function') {
        await loadAllProducts();
      }
      await refreshPriceChangedQueue();
    } else {
      if (typeof showToast === 'function') showToast("Hata: " + (data.message || 'Fiyatlar güncellenemedi.'), "error");
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast("Sunucu bağlantı hatası!", "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = "⚡ Fiyatları Güncelle ve Kuyruğa Al";
    }
  }
}

async function refreshPriceChangedQueue() {
  try {
    const res = await fetch('/api/catalog/price_changed_today');
    const data = await res.json();
    if (data.status === 'success') {
      priceChangedTodayList = data.products || [];
      const badge = document.getElementById('price-changed-count-badge');
      if (badge) {
        badge.innerText = priceChangedTodayList.length;
        badge.style.display = priceChangedTodayList.length > 0 ? 'inline-block' : 'none';
      }
    }
  } catch (err) {
    console.error("Fiyatı değişenler kuyruğu alınamadı:", err);
  }
}

async function printPriceChangedQueue() {
  // Kataloğumuzdaki raf etiketi güncel olmayan (fiyatı değişmiş) TÜM ürünleri bul
  const outdatedItems = (typeof allCatalogProducts !== 'undefined' && Array.isArray(allCatalogProducts))
    ? allCatalogProducts.filter(p => typeof isLabelPriceUpToDate === 'function' ? !isLabelPriceUpToDate(p) : false)
    : [];

  if (outdatedItems.length === 0) {
    if (typeof showToast === 'function') showToast("Raf etiketi güncel olmayan ürün bulunmuyor. Tüm etiketler güncel!", "info");
    return;
  }

  const count = outdatedItems.length;
  const ok = await showCustomConfirm(
    `Fiyatı değişmiş fakat raf etiketi basılmamış (güncel olmayan) toplam ${count} ürün tespit edildi.\n\nBu ${count} ürünün yeni raf etiketlerini toplu olarak yazdırma listesine alıp baskı ekranını açmak istiyor musunuz?`,
    "🖨️ Güncel Olmayan Etiketleri Bas",
    "Toplu Etiket Bas",
    "Vazgeç",
    "🖨️"
  );
  if (!ok) return;

  // Seçili ürünler listesine ata ve baskı motorunu tetikle
  if (typeof selectedBarcodes !== 'undefined') {
    selectedBarcodes.clear();
    outdatedItems.forEach(p => {
      if (p.barcode) selectedBarcodes.add(String(p.barcode));
    });
    if (typeof updateBatchActionBar === 'function') updateBatchActionBar();
    if (typeof updateBatchBarUI === 'function') updateBatchBarUI();
    if (typeof updateRowSelections === 'function') updateRowSelections();
    
    if (typeof openPrintPreviewModalBatch === 'function') {
      openPrintPreviewModalBatch();
    } else if (typeof openBatchPrintModal === 'function') {
      openBatchPrintModal();
    } else {
      if (typeof showToast === 'function') showToast(`${count} adet güncel olmayan etiket baskı listesine seçildi.`, "success");
    }
  }
}

async function refreshLowStockAlerts() {
  try {
    const res = await fetch('/api/catalog/low_stock_alerts?threshold=5');
    const data = await res.json();
    if (data.status === 'success') {
      lowStockList = data.products || [];
      const badge = document.getElementById('low-stock-count-badge');
      if (badge) {
        badge.innerText = lowStockList.length;
        badge.style.display = lowStockList.length > 0 ? 'inline-block' : 'none';
      }
    }
  } catch (err) {
    console.error("Kritik stok uyarısı alınamadı:", err);
  }
}

window.openBrandZamMotorModal = openBrandZamMotorModal;
window.closeBatchPriceModal = closeBatchPriceModal;
window.executeBatchPriceUpdate = executeBatchPriceUpdate;
window.refreshPriceChangedQueue = refreshPriceChangedQueue;
window.printPriceChangedQueue = printPriceChangedQueue;
window.refreshLowStockAlerts = refreshLowStockAlerts;

document.addEventListener('DOMContentLoaded', () => {
  refreshPriceChangedQueue();
  refreshLowStockAlerts();
});
