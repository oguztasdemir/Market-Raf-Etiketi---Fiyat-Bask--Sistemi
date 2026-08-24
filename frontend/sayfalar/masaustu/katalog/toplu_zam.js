// -*- coding: utf-8 -*-
/**
 * Toplu Zam Motoru ve Bugün Fiyatı Değişenler Baskı Kuyruğu Kontrolcüsü
 */
let priceChangedTodayList = [];
let lowStockList = [];

async function openBatchPriceModal() {
  const brandSelect = document.getElementById('batch-price-brand');
  if (brandSelect && typeof allBrands !== 'undefined') {
    // 266 markayı doldur
    const currentVal = brandSelect.value;
    brandSelect.innerHTML = `<option value="TÜMÜ">🏢 TÜM MARKALAR (Tüm Katalog)</option>` + 
      allBrands.map(b => `<option value="${b}">${b}</option>`).join('');
    brandSelect.value = currentVal || 'TÜMÜ';
  }
  document.getElementById('modal-batch-price-update').style.display = 'flex';
}

function closeBatchPriceModal() {
  document.getElementById('modal-batch-price-update').style.display = 'none';
}

async function executeBatchPriceUpdate() {
  const brand = document.getElementById('batch-price-brand').value;
  const category_prefix = document.getElementById('batch-price-cat-prefix').value;
  const percent = parseFloat(document.getElementById('batch-price-percent').value) || 0.0;
  const flat_amount = parseFloat(document.getElementById('batch-price-flat').value) || 0.0;
  const round_to = parseFloat(document.getElementById('batch-price-round').value) || 0.0;

  if (percent === 0.0 && flat_amount === 0.0) {
    alert("Lütfen bir yüzde (%) veya sabit tutar (TL) artışı girin.");
    return;
  }

  const confirmMsg = `Seçilen Kriterler:\nMarka: ${brand}\nKategori: ${category_prefix}\nArtış: ${percent ? '%' + percent : ''} ${flat_amount ? '+' + flat_amount + ' TL' : ''}\n\nToplu fiyat güncellemesini uygulamak istiyor musunuz?`;
  if (!confirm(confirmMsg)) return;

  const btn = document.getElementById('btn-execute-batch-price');
  btn.disabled = true;
  btn.innerText = "Güncelleniyor...";

  try {
    const res = await fetch('/api/catalog/batch_price_update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand, category_prefix, percent, flat_amount, round_to, actor: 'Yönetici' })
    });
    const data = await res.json();
    if (data.status === 'success') {
      alert(`✅ Başarılı!\n${data.message}`);
      closeBatchPriceModal();
      if (typeof loadAllProducts === 'function') {
        await loadAllProducts();
      }
      await refreshPriceChangedQueue();
    } else {
      alert("Hata: " + (data.message || 'Fiyatlar güncellenemedi.'));
    }
  } catch (err) {
    alert("Sunucu bağlantı hatası!");
  } finally {
    btn.disabled = false;
    btn.innerText = "⚡ Fiyatları Güncelle ve Kuyruğa Al";
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

function printPriceChangedQueue() {
  if (!priceChangedTodayList || priceChangedTodayList.length === 0) {
    alert("Bugün fiyatı değişen ürün bulunmuyor.");
    return;
  }
  const count = priceChangedTodayList.length;
  if (!confirm(`Bugün fiyatı değişen toplam ${count} ürünün raf etiketini toplu olarak yazdırmak istiyor musunuz?`)) {
    return;
  }

  // Seçili ürünler listesine ata ve baskı motorunu tetikle
  if (typeof selectedBarcodes !== 'undefined' && typeof updateBatchBarUI === 'function') {
    selectedBarcodes.clear();
    priceChangedTodayList.forEach(p => {
      if (p.barcode) selectedBarcodes.add(String(p.barcode));
    });
    updateBatchBarUI();
    if (typeof openPrintPreviewModalBatch === 'function') {
      openPrintPreviewModalBatch();
    } else {
      alert(`${count} adet etiket baskı listesine seçildi.`);
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

document.addEventListener('DOMContentLoaded', () => {
  refreshPriceChangedQueue();
  refreshLowStockAlerts();
});
