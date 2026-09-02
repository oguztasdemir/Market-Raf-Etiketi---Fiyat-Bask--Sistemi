/**
 * =========================================================================
 * 📋 MOBIL KUYRUK & BASKI: Basım Listesi, Toplu Yazdırma ve Doğrulama
 * =========================================================================
 */

function loadQueueFromStorage() {
  try {
    const saved = localStorage.getItem('mobile_label_queue');
    if (saved) mobileQueue = JSON.parse(saved);
  } catch(e) {
    mobileQueue = [];
  }
}

function saveQueueToStorage() {
  try {
    localStorage.setItem('mobile_label_queue', JSON.stringify(mobileQueue));
  } catch(e) {}
  updateQueueUI();
}

function updateQueueUI() {
  const count = mobileQueue.length;
  const badge = document.getElementById('badge-queue-count');
  const btnPrintText = document.getElementById('btn-batch-print-text');
  if (badge) badge.innerText = count;
  if (btnPrintText) btnPrintText.innerText = `Toplu Yazdır (${count} Etiket)`;
}

function renderQueueList() {
  const container = document.getElementById('queue-items-list');
  const emptyState = document.getElementById('queue-empty-state');
  const countLabel = document.getElementById('queue-total-count');

  if (countLabel) countLabel.innerText = `${mobileQueue.length} ürün`;

  if (!container) return;

  if (mobileQueue.length === 0) {
    if (emptyState) emptyState.style.display = 'flex';
    container.innerHTML = '';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  container.innerHTML = '';

  mobileQueue.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = 'queue-card';
    card.innerHTML = `
      <div class="queue-card-top">
        <span class="queue-card-title">${item.title}</span>
        <button class="btn-remove-item" onclick="removeItemFromQueue(${idx})">🗑️ Kaldır</button>
      </div>
      <div class="queue-card-bottom">
        <span class="queue-barcode">#${item.barcode}</span>
        <input type="text" class="queue-price-inp" value="${item.price}" onchange="updateQueueItemPrice(${idx}, this.value)">
      </div>
    `;
    container.appendChild(card);
  });
}

function updateQueueItemPrice(idx, newPrice) {
  if (mobileQueue[idx]) {
    mobileQueue[idx].price = formatPriceInput(newPrice);
    saveQueueToStorage();
    showToast("Fiyat güncellendi", "success");
  }
}

function removeItemFromQueue(idx) {
  const item = mobileQueue[idx];
  const name = item ? item.title : "bu ürünü";
  
  const ok = confirm(`⚠️ "${name}" ürününü basım listesinden çıkarmak istediğinize emin misiniz?`);
  if (!ok) return;

  mobileQueue.splice(idx, 1);
  saveQueueToStorage();
  renderQueueList();
  showToast("Ürün listeden çıkarıldı.", "success");
}

function clearQueueWithConfirm() {
  if (mobileQueue.length === 0) return;
  const ok = confirm("⚠️ Basım listesindeki TÜM ürünleri temizlemek istediğinize emin misiniz?");
  if (!ok) return;

  mobileQueue = [];
  saveQueueToStorage();
  renderQueueList();
  showToast("Basım listesi temizlendi.", "success");
}

// =========================================================================
// 🖨️ MOBIL CANLI YAZDIRMA & İLERLEME & DURDURMA / İPTAL
// =========================================================================
function updateMobilePrintProgressUI(currentItem = null) {
  const total = mobPrintState.items.length;
  const current = mobPrintState.currentIndex + 1;
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  const barEl = document.getElementById('mob-print-bar');
  const countEl = document.getElementById('mob-print-count');
  const pctEl = document.getElementById('mob-print-percent');
  const itemEl = document.getElementById('mob-print-item');
  const titleEl = document.getElementById('mob-print-title');
  const alertEl = document.getElementById('mob-pause-alert');
  const btnPause = document.getElementById('btn-mob-pause');
  const btnResume = document.getElementById('btn-mob-resume');
  const btnCancel = document.getElementById('btn-mob-cancel');

  if (barEl) barEl.style.width = `${pct}%`;
  if (countEl) countEl.innerText = `${current} / ${total} Etiket`;
  if (pctEl) pctEl.innerText = `%${pct}`;
  if (currentItem && itemEl) {
    itemEl.innerText = `${currentItem.title} (${currentItem.price})`;
  }

  if (mobPrintState.isPaused) {
    if (titleEl) titleEl.innerText = "⏸️ Yazdırma Duraklatıldı";
    if (alertEl) alertEl.style.display = "block";
    if (btnPause) btnPause.style.display = "none";
    if (btnResume) btnResume.style.display = "block";
    if (btnCancel) btnCancel.style.display = "block";
  } else {
    if (titleEl) titleEl.innerText = "🖨️ Yazdırılıyor...";
    if (alertEl) alertEl.style.display = "none";
    if (btnPause) btnPause.style.display = "block";
    if (btnResume) btnResume.style.display = "none";
    if (btnCancel) btnCancel.style.display = "none";
  }
}

function pauseMobilePrinting() {
  mobPrintState.isPaused = true;
  updateMobilePrintProgressUI(mobPrintState.items[mobPrintState.currentIndex]);
  showToast("⏸️ Yazdırma duraklatıldı.", "warning");
}

function resumeMobilePrintingWithConfirm() {
  const remaining = mobPrintState.items.length - (mobPrintState.currentIndex + 1);
  const ok = confirm(`▶️ Kalan ${remaining} etiketin basımına devam etmek istediğinize emin misiniz?`);
  if (!ok) return;

  mobPrintState.isPaused = false;
  updateMobilePrintProgressUI(mobPrintState.items[mobPrintState.currentIndex]);
  showToast("▶️ Devam ediliyor...", "success");
}

async function cancelMobilePrintingWithConfirm() {
  const remaining = mobPrintState.items.length - (mobPrintState.currentIndex + 1);
  const ok = confirm(`⛔ Yazdırma işlemini tamamen iptal etmek istediğinize emin misiniz?\n(Kalan ${remaining} etiket basılmayacak)`);
  if (!ok) return;

  mobPrintState.isActive = false;
  mobPrintState.isPaused = false;

  try {
    await fetch('/api/print/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ printer: document.getElementById('txt-printer-name')?.innerText || "Termal Etiket Yazici" })
    });
  } catch(e) {}

  const modal = document.getElementById('modal-mobile-print-progress');
  if (modal) modal.style.display = 'none';
  showToast(`⛔ Yazdırma iptal edildi. (${mobPrintState.currentIndex + 1} basıldı, ${remaining} iptal edildi)`, "warning");
}

async function submitQueueBatchPrint() {
  if (mobileQueue.length === 0) {
    showToast("Basım listesi boş. Önce ürün okutun.", "error");
    return;
  }

  mobPrintState = {
    isActive: true,
    isPaused: false,
    items: [...mobileQueue],
    currentIndex: 0
  };

  const modal = document.getElementById('modal-mobile-print-progress');
  if (modal) modal.style.display = 'flex';
  updateMobilePrintProgressUI(mobPrintState.items[0]);

  for (let i = 0; i < mobPrintState.items.length; i++) {
    if (!mobPrintState.isActive) break;

    while (mobPrintState.isPaused && mobPrintState.isActive) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    if (!mobPrintState.isActive) break;

    mobPrintState.currentIndex = i;
    const currentItem = mobPrintState.items[i];
    updateMobilePrintProgressUI(currentItem);

    // PC ile eş zamanlı canlı durum güncellemesi gönder
    try {
      fetch('/api/print/live-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_active: true,
          source: "mobile",
          total: mobPrintState.items.length,
          current: i + 1,
          current_item: currentItem.title,
          current_price: currentItem.price,
          status_text: "Yazdırılıyor..."
        })
      });
    } catch(e) {}

    const payload = {
      source: "mobile",
      printer: document.getElementById('txt-printer-name')?.innerText || "Termal Etiket Yazici",
      products: [{
        barcode: currentItem.barcode,
        title: currentItem.title,
        brand: (currentItem.brand && currentItem.brand !== 'DİĞER' && currentItem.brand !== 'DIGER') ? currentItem.brand : "YARENLER",
        price: currentItem.price,
        date: currentItem.date || ""
      }],
      orientation: "POR",
      width_mm: 76,
      height_mm: 40,
      x_offset: 0,
      y_offset: 0,
      dpi: 203,
      copies_per_item: 1
    };

    try {
      await fetch('/api/print/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch(e) {}

    await new Promise(resolve => setTimeout(resolve, 350));
  }

  const wasActive = mobPrintState.isActive;
  const printedQueue = [...mobPrintState.items];

  if (modal) modal.style.display = 'none';
  mobPrintState.isActive = false;
  mobPrintState.isPaused = false;

  // Canlı durumu kapat
  try {
    fetch('/api/print/live-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: false, status_text: "Tamamlandı" })
    });
  } catch(e) {}

  if (wasActive && printedQueue.length > 0) {
    openMobPrintVerificationModal(printedQueue);
  }
}

// =========================================================================
// 🔍 MOBIL DOĞRULAMA MOTORU
// =========================================================================
function openMobPrintVerificationModal(items) {
  mobVerifyItems = items || [];
  mobVerifyErrorBarcodes.clear();

  const modal = document.getElementById('modal-mob-print-verification');
  if (!modal) return;

  renderMobVerifyList();
  updateMobVerifyButton();
  modal.style.display = 'flex';
}

function renderMobVerifyList() {
  const container = document.getElementById('mob-verify-list');
  if (!container) return;
  container.innerHTML = '';

  mobVerifyItems.forEach(item => {
    const isError = mobVerifyErrorBarcodes.has(item.barcode);
    const card = document.createElement('div');
    card.style.background = isError ? 'rgba(239, 68, 68, 0.15)' : '#090d16';
    card.style.border = isError ? '1px solid #ef4444' : '1px solid var(--border, rgba(255,255,255,0.1))';
    card.style.borderRadius = '8px';
    card.style.padding = '8px 10px';
    card.style.display = 'flex';
    card.style.alignItems = 'center';
    card.style.gap = '8px';

    card.innerHTML = `
      <input type="checkbox" ${isError ? 'checked' : ''} onchange="toggleMobVerifyItem('${item.barcode}', this.checked)" style="transform: scale(1.2); cursor: pointer;">
      <div style="flex: 1; overflow: hidden;">
        <div style="font-size: 12px; font-weight: 700; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.title}</div>
        <div style="font-size: 10.5px; color: var(--text-muted, #94a3b8); font-family: monospace;">#${item.barcode}</div>
      </div>
      <div style="font-size: 12.5px; font-weight: 900; color: #34d399;">${item.price}</div>
    `;
    container.appendChild(card);
  });
}

function toggleMobVerifyItem(barcode, isChecked) {
  if (isChecked) {
    mobVerifyErrorBarcodes.add(barcode);
  } else {
    mobVerifyErrorBarcodes.delete(barcode);
  }
  renderMobVerifyList();
  updateMobVerifyButton();
}

function toggleSelectAllMobVerify() {
  if (mobVerifyErrorBarcodes.size === mobVerifyItems.length) {
    mobVerifyErrorBarcodes.clear();
  } else {
    mobVerifyItems.forEach(x => mobVerifyErrorBarcodes.add(x.barcode));
  }
  renderMobVerifyList();
  updateMobVerifyButton();
}

function updateMobVerifyButton() {
  const btn = document.getElementById('btn-mob-verify-action');
  const summary = document.getElementById('mob-verify-summary');
  if (!btn) return;

  const total = mobVerifyItems.length;
  const errorCount = mobVerifyErrorBarcodes.size;
  const successCount = total - errorCount;

  if (errorCount === 0) {
    btn.innerHTML = `✅ Evet, Tümü Başarıyla Basıldı (Verileri Güncelle)`;
    btn.style.background = "linear-gradient(135deg, #10b981, #059669)";
    if (summary) summary.innerText = `Tüm ürünler (${total} adet) güncellenecektir.`;
  } else if (errorCount === total) {
    btn.innerHTML = `❌ Hiçbiri Tamamlanmadı (Fiyatları Güncelleme)`;
    btn.style.background = "linear-gradient(135deg, #ef4444, #b91c1c)";
    if (summary) summary.innerText = `⚠️ Hiçbir ürün güncellenmeyecek, eski fiyatlar korunacaktır.`;
  } else {
    btn.innerHTML = `⚠️ Seçilenler Hariç Tamamlandı (${successCount} Ürünü Güncelle)`;
    btn.style.background = "linear-gradient(135deg, #f59e0b, #d97706)";
    if (summary) summary.innerText = `${successCount} ürün güncellenecek, hatalı ${errorCount} ürünün eski fiyatı korunacaktır.`;
  }
}

async function confirmMobPrintVerification() {
  const total = mobVerifyItems.length;
  const errorCount = mobVerifyErrorBarcodes.size;
  const successItems = mobVerifyItems.filter(x => !mobVerifyErrorBarcodes.has(x.barcode));

  const modal = document.getElementById('modal-mob-print-verification');
  if (modal) modal.style.display = 'none';

  if (errorCount === total || successItems.length === 0) {
    showToast("ℹ️ Hiçbir fiyat güncellenmedi, eski fiyatlar korundu.", "warning");
    return;
  }

  try {
    const payload = {
      source: "MOBILE",
      items: successItems.map(x => ({
        barcode: x.barcode,
        title: x.title,
        price: x.price
      }))
    };

    const res = await fetch('/api/catalog/sync-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (result.status === 'success') {
      showToast(`✅ ${successItems.length} ürünün raf fiyatı güncellendi!`, "success");
      mobileQueue = [];
      saveQueueToStorage();
      renderQueueList();
      if (typeof switchMobileTab === 'function') {
        setTimeout(() => switchMobileTab('scan'), 1000);
      }
    } else {
      showToast(`❌ Hata: ${result.message}`, "error");
    }
  } catch(e) {
    showToast(`❌ Güncelleme hatası: ${e.message}`, "error");
  }
}

// Window Global Tanımlamaları
window.loadQueueFromStorage = loadQueueFromStorage;
window.saveQueueToStorage = saveQueueToStorage;
window.updateQueueUI = updateQueueUI;
window.renderQueueList = renderQueueList;
window.updateQueueItemPrice = updateQueueItemPrice;
window.removeItemFromQueue = removeItemFromQueue;
window.clearQueueWithConfirm = clearQueueWithConfirm;
window.submitQueueBatchPrint = submitQueueBatchPrint;
window.updateMobilePrintProgressUI = updateMobilePrintProgressUI;
window.pauseMobilePrinting = pauseMobilePrinting;
window.resumeMobilePrintingWithConfirm = resumeMobilePrintingWithConfirm;
window.cancelMobilePrintingWithConfirm = cancelMobilePrintingWithConfirm;
window.openMobPrintVerificationModal = openMobPrintVerificationModal;
window.renderMobVerifyList = renderMobVerifyList;
window.toggleMobVerifyItem = toggleMobVerifyItem;
window.toggleSelectAllMobVerify = toggleSelectAllMobVerify;
window.updateMobVerifyButton = updateMobVerifyButton;
window.confirmMobPrintVerification = confirmMobPrintVerification;
