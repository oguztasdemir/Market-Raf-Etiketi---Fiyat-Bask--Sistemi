// ==========================================
// SYNC ACTIONS: Senkronizasyon İşlemleri, Detay & Toplu Güncelleme
// ==========================================

async function syncSingleItemPriceOnly(barcode, newPrice) {
  const item = (filteredSyncItems && filteredSyncItems.find(p => p.barcode === barcode))
            || (currentSyncData && currentSyncData.changed_prices && currentSyncData.changed_prices.find(p => p.barcode === barcode));
  const excelTitle = item ? (item.excel_title || item.title || '') : '';
  const currentTitle = item ? (item.current_title || '') : '';

  await executeSyncApply("update_prices", [{
    barcode: barcode,
    new_price: newPrice,
    excel_title: excelTitle,
    current_title: currentTitle
  }]);
}


async function syncSingleItemNewOnly(barcode, newPrice, excelTitle, brand) {
  await executeSyncApply("add_new_products", [{
    barcode: barcode,
    new_price: newPrice,
    excel_title: excelTitle,
    brand: brand || 'DİĞER'
  }]);
}


let isSyncApplyCancelled = false;

function openSyncProgressModal(totalCount = 0) {
  isSyncApplyCancelled = false;
  const modal = document.getElementById('modal-sync-progress');
  const fillEl = document.getElementById('sync-progress-fill');
  const countEl = document.getElementById('sync-progress-count');
  const percentEl = document.getElementById('sync-progress-percent');
  const itemEl = document.getElementById('sync-progress-current-item');
  const titleEl = document.getElementById('sync-progress-title');
  const subEl = document.getElementById('sync-progress-sub');
  const iconEl = document.getElementById('sync-progress-icon');
  const btnCancel = document.getElementById('sync-progress-btn-cancel');
  const btnDone = document.getElementById('sync-progress-btn-done');

  if (modal) {
    if (fillEl) fillEl.style.width = '0%';
    if (countEl) countEl.innerText = `0 / ${totalCount.toLocaleString('tr-TR')} Ürün Aktarılıyor`;
    if (percentEl) percentEl.innerText = '0%';
    if (itemEl) itemEl.innerText = 'Veri aktarımı başlatılıyor...';
    if (titleEl) titleEl.innerText = '⚡ Kataloğa Veri Aktarılıyor';
    if (subEl) subEl.innerText = 'Lütfen işlem tamamlanana kadar bekleyiniz...';
    if (iconEl) iconEl.innerText = '⚡';
    if (btnCancel) {
      btnCancel.style.display = 'inline-flex';
      btnCancel.innerText = '🛑 Durdur / İptal Et';
    }
    if (btnDone) btnDone.style.display = 'none';
    modal.style.display = 'flex';
  }
}


function cancelSyncApply() {
  isSyncApplyCancelled = true;
  const subEl = document.getElementById('sync-progress-sub');
  const titleEl = document.getElementById('sync-progress-title');
  const iconEl = document.getElementById('sync-progress-icon');
  const btnCancel = document.getElementById('sync-progress-btn-cancel');
  const btnDone = document.getElementById('sync-progress-btn-done');

  if (titleEl) titleEl.innerText = '🛑 İşlem Durduruldu';
  if (subEl) subEl.innerText = 'Kullanıcı tarafından aktarım durduruldu.';
  if (iconEl) iconEl.innerText = '⚠️';
  if (btnCancel) btnCancel.style.display = 'none';
  if (btnDone) {
    btnDone.style.display = 'inline-flex';
    btnDone.innerText = 'Kapat';
  }
  showToast("🛑 Veri aktarımı durduruldu.", "warning");
}


function closeSyncProgressModal() {
  const modal = document.getElementById('modal-sync-progress');
  if (modal) modal.style.display = 'none';
  loadCatalog();
  loadSyncStatus(true);
}


async function applyAllChangedPricesFromSync() {
  if (!currentSyncData) {
    showToast("Sistem verisi bulunamadı. Lütfen önce Excel/CSV dosyası yükleyin.", "warning");
    return;
  }

  const changedList = currentSyncData.changed_prices || [];
  const newList = currentSyncData.new_products || [];

  if (activeSyncFilter === 'new') {
    // Sadece Yeni Ürünleri Ekle
    if (newList.length === 0) {
      showToast("Eklenecek yeni ürün bulunamadı.", "info");
      return;
    }
    openSyncProgressModal(newList.length);

    const itemsToAdd = newList.map(item => ({
      barcode: item.barcode,
      new_price: item.excel_price,
      excel_title: item.excel_title,
      brand: item.brand || 'DİĞER'
    }));

    await executeSyncApply("add_new_products", itemsToAdd);

  } else if (activeSyncFilter === 'changed') {
    // Sadece Fiyat Değişikliklerini Uygula
    if (changedList.length === 0) {
      showToast("Uygulanacak fiyat değişikliği bulunamadı.", "info");
      return;
    }
    openSyncProgressModal(changedList.length);

    const itemsToApply = changedList.map(item => ({
      barcode: item.barcode,
      new_price: item.excel_price,
      excel_title: item.excel_title,
      current_title: item.current_title
    }));

    await executeSyncApply("update_prices", itemsToApply);

  } else {
    // Tüm Değişiklikler: Hem Fiyatları Güncelle Hem Yeni Ürünleri Ekle
    const totalCount = changedList.length + newList.length;
    if (totalCount === 0) {
      showToast("Uygulanacak fiyat değişikliği veya yeni ürün bulunamadı.", "info");
      return;
    }
    openSyncProgressModal(totalCount);

    const allItems = [
      ...changedList.map(item => ({
        barcode: item.barcode,
        new_price: item.excel_price,
        excel_title: item.excel_title,
        current_title: item.current_title
      })),
      ...newList.map(item => ({
        barcode: item.barcode,
        new_price: item.excel_price,
        excel_title: item.excel_title,
        brand: item.brand || 'DİĞER'
      }))
    ];

    await executeSyncApply("sync_all", allItems);
  }
}


async function executeSyncApply(action, items) {
  if (!items || items.length === 0) {
    const modal = document.getElementById('modal-sync-progress');
    if (modal) modal.style.display = 'none';
    showToast("Aktarılacak veri bulunamadı.", "info");
    return;
  }

  const fillEl = document.getElementById('sync-progress-fill');
  const countEl = document.getElementById('sync-progress-count');
  const percentEl = document.getElementById('sync-progress-percent');
  const itemEl = document.getElementById('sync-progress-current-item');
  const titleEl = document.getElementById('sync-progress-title');
  const subEl = document.getElementById('sync-progress-sub');
  const iconEl = document.getElementById('sync-progress-icon');
  const btnCancel = document.getElementById('sync-progress-btn-cancel');
  const btnDone = document.getElementById('sync-progress-btn-done');

  const total = items.length;
  openSyncProgressModal(total);

  const chunkSize = 25; // 25'erli paketlerle canlı ilerle
  let processed = 0;

  try {
    for (let i = 0; i < items.length; i += chunkSize) {
      if (isSyncApplyCancelled) {
        break;
      }

      const chunk = items.slice(i, i + chunkSize);
      const currentItem = chunk[0];
      if (itemEl && currentItem) {
        itemEl.innerText = `${currentItem.barcode || ''} - ${currentItem.excel_title || currentItem.current_title || ''}`;
      }

      const res = await fetch(`${API_BASE}/api/catalog/apply-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: action,
          items: chunk
        })
      });
      const result = await res.json();
      if (result.status !== 'success') {
        throw new Error(result.message || 'Aktarım hatası');
      }

      if (result.latest_sync_data && result.latest_sync_data.status === 'success') {
        currentSyncData = result.latest_sync_data;
        updateSyncStatsBadges();
        renderSyncTable(true);
      }

      processed = Math.min(i + chunk.length, total);
      const percent = Math.round((processed / total) * 100);

      if (fillEl) fillEl.style.width = `${percent}%`;
      if (countEl) countEl.innerText = `${processed.toLocaleString('tr-TR')} / ${total.toLocaleString('tr-TR')} Ürün Aktarıldı`;
      if (percentEl) percentEl.innerText = `${percent}%`;

      // Canlı ilerleme kontrolü ve akıcı görsel adım
      await new Promise(r => setTimeout(r, 25));
    }

    if (!isSyncApplyCancelled) {
      if (fillEl) fillEl.style.width = '100%';
      if (countEl) countEl.innerText = `${total.toLocaleString('tr-TR')} / ${total.toLocaleString('tr-TR')} Ürün Aktarıldı`;
      if (percentEl) percentEl.innerText = '100%';
      if (titleEl) titleEl.innerText = '✅ Aktarım Başarıyla Tamamlandı!';
      if (subEl) subEl.innerText = `Toplam ${total} adet ürün kataloğa kaydedildi.`;
      if (iconEl) iconEl.innerText = '🎉';
      if (itemEl) itemEl.innerText = 'Katalog veritabanı başarıyla güncellendi.';

      if (btnCancel) btnCancel.style.display = 'none';
      if (btnDone) {
        btnDone.style.display = 'inline-flex';
        btnDone.innerText = '✓ Tamam';
      }

      showToast(`✅ Toplam ${total} adet veri kataloğa başarıyla aktarıldı!`, "success");
    }

  } catch (e) {
    if (titleEl) titleEl.innerText = '❌ Aktarım Sırasında Hata Oluştu';
    if (subEl) subEl.innerText = e.message;
    if (btnCancel) btnCancel.style.display = 'none';
    if (btnDone) {
      btnDone.style.display = 'inline-flex';
      btnDone.innerText = 'Kapat';
    }
    showToast(`❌ Hata: ${e.message}`, "error");
  }
}


async function submitSyncBatchApply() {
  if (selectedSyncBarcodes.size === 0) {
    showToast("Lütfen güncellenecek ürünleri seçin.", "warning");
    return;
  }

  const itemsToApply = [];
  selectedSyncBarcodes.forEach(bc => {
    const item = filteredSyncItems.find(p => p.barcode === bc);
    if (item && item.excel_price) {
      itemsToApply.push({
        barcode: item.barcode,
        new_price: item.excel_price,
        excel_title: item.excel_title,
        current_title: item.current_title,
        brand: item.brand || 'DİĞER'
      });
    }
  });

  if (itemsToApply.length === 0) {
    showToast("Seçili ürünlerin fiyat bilgisi bulunamadı.", "warning");
    return;
  }

  clearSyncSelection();
  await executeSyncApply("sync_all", itemsToApply);
}


async function submitSyncBatchPrint() {
  if (selectedSyncBarcodes.size === 0) {
    showToast("Lütfen yazdırılacak ürünleri seçin.", "warning");
    return;
  }

  // Önce raf fiyatlarını güncelle, sonra kontrollü yazdır
  await submitSyncBatchApply();

  const copies = parseInt(document.getElementById('sync-batch-copies')?.value || 1);
  const productsToPrint = [];

  selectedSyncBarcodes.forEach(bc => {
    const p = allCatalogProducts.find(x => x.barcode === bc);
    if (p) {
      productsToPrint.push(p);
    } else {
      const syncItem = filteredSyncItems.find(x => x.barcode === bc);
      if (syncItem) {
        productsToPrint.push({
          barcode: syncItem.barcode,
          title: syncItem.current_title || syncItem.excel_title,
          brand: (syncItem.brand && syncItem.brand !== 'DİĞER' && syncItem.brand !== 'DIGER') ? syncItem.brand : "YARENLER",
          price: syncItem.excel_price || "0,00 TL",
          date: document.getElementById('inp-date')?.value || ""
        });
      }
    }
  });

  if (productsToPrint.length === 0) {
    showToast("Yazdırılacak ürün bulunamadı.", "warning");
    return;
  }

  await startManagedBatchPrint(productsToPrint, copies, () => {
    clearSyncSelection();
  });
}


async function submitSyncBatchBlacklist() {
  if (selectedSyncBarcodes.size === 0) {
    showToast("Lütfen kara listeye eklenecek ürünleri seçin.", "warning");
    return;
  }

  let count = 0;
  for (const bc of selectedSyncBarcodes) {
    const item = filteredSyncItems.find(x => x.barcode === bc);
    const title = item ? (item.excel_title || item.current_title) : "KARA LİSTE";
    try {
      await fetch(`${API_BASE}/api/blacklist/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode: bc, title: title })
      });
      count++;
    } catch (e) {
      console.error("Blacklist add error:", e);
    }
  }

  showToast(`🚫 ${count} ürün kara listeye eklendi.`, "success");
  clearSyncSelection();
  await loadSyncStatus();
}


function openSyncProductDetailModal(barcode) {
  const item = filteredSyncItems.find(p => p.barcode === barcode) || allCatalogProducts.find(p => p.barcode === barcode);
  if (!item) return;

  const modal = document.getElementById('modal-sync-product-detail');
  if (!modal) return;

  modal.style.display = 'flex';
  const hasValidCurrentTitle = item.current_title && item.current_title !== '-';
  document.getElementById('sync-detail-title').innerText = hasValidCurrentTitle ? item.current_title : (item.excel_title || item.title || "Ürün Detayı");
  document.getElementById('sync-detail-barcode').innerText = item.barcode;
  document.getElementById('sync-detail-current-price').innerText = item.current_price || item.price || "-";
  document.getElementById('sync-detail-excel-price').innerText = item.excel_price || item.price || "-";
  document.getElementById('sync-detail-excel-title').innerText = item.excel_title || "-";
  document.getElementById('sync-detail-current-title').innerText = hasValidCurrentTitle ? item.current_title : "-";
  document.getElementById('sync-detail-brand').innerText = item.brand || "DİĞER";

  let statusText = "✅ Fiyat Uyumlu";
  if (item.status === 'changed') {
    statusText = `⚠️ Fiyat Farkı: ${item.excel_price} (Eski: ${item.current_price})`;
  } else if (item.status === 'new') {
    statusText = "✨ Yeni Ürün";
  } else if (item.status === 'blacklisted') {
    statusText = "🚫 Kara Liste";
  }
  document.getElementById('sync-detail-status').innerText = statusText;

  // Buton Aksiyonları
  document.getElementById('sync-detail-btn-blacklist').onclick = async () => {
    await submitSingleBlacklist(item.barcode, item.excel_title || item.current_title);
    closeSyncProductDetailModal();
  };

  document.getElementById('sync-detail-btn-design').onclick = () => {
    closeSyncProductDetailModal();
    loadProductToDesigner(item.barcode);
  };

  document.getElementById('sync-detail-btn-print').onclick = () => {
    closeSyncProductDetailModal();
    printProductFromCatalog(item.barcode);
  };
}


function closeSyncProductDetailModal() {
  const modal = document.getElementById('modal-sync-product-detail');
  if (modal) modal.style.display = 'none';
}


function loadProductToDesigner(barcode) {
  const item = (filteredSyncItems && filteredSyncItems.find(p => p.barcode === barcode)) 
            || (allCatalogProducts && allCatalogProducts.find(p => p.barcode === barcode));
  if (!item) {
    showToast("Ürün bilgisi bulunamadı.", "error");
    return;
  }

  const fullTitle = (item.current_title && item.current_title !== '-') 
                  ? item.current_title 
                  : (item.excel_title || item.title || item.title1 || '');
  const price = item.excel_price || item.current_price || item.price || '';
  const brand = item.brand || 'YARENLER';

  selectProductFromStock({
    barcode: item.barcode,
    title: fullTitle,
    price: price,
    brand: brand,
    origin: item.origin || 'TÜRKİYE',
    date: item.date
  });

  if (typeof updatePreviewLive === 'function') updatePreviewLive();
  if (typeof renderBarcode === 'function') renderBarcode();
  switchTab('tab-design');
  showToast(`🎨 '${fullTitle}' etiket tasarım stüdyosuna aktarıldı.`, "info");
}


async function submitSingleBlacklist(barcode, title) {
  try {
    const res = await fetch(`${API_BASE}/api/blacklist/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode: barcode, title: title || "KARA LİSTE" })
    });
    const result = await res.json();
    if (result.status === 'success') {
      showToast("🚫 Ürün kara listeye eklendi.", "success");
      await loadSyncStatus();
    } else {
      showToast(`❌ ${result.message}`, "error");
    }
  } catch (e) {
    showToast(`❌ Bağlantı hatası: ${e.message}`, "error");
  }
}

// Window Global İhracı
window.applyAllChangedPricesFromSync = applyAllChangedPricesFromSync;
window.executeSyncApply = executeSyncApply;
window.cancelSyncApply = cancelSyncApply;
window.closeSyncProgressModal = closeSyncProgressModal;
window.submitSyncBatchApply = submitSyncBatchApply;
window.submitSyncBatchPrint = submitSyncBatchPrint;
window.submitSyncBatchBlacklist = submitSyncBatchBlacklist;
window.openSyncProductDetailModal = openSyncProductDetailModal;
window.closeSyncProductDetailModal = closeSyncProductDetailModal;
window.loadProductToDesigner = loadProductToDesigner;
window.submitSingleBlacklist = submitSingleBlacklist;
window.syncSingleItemPriceOnly = syncSingleItemPriceOnly;
window.syncSingleItemNewOnly = syncSingleItemNewOnly;
