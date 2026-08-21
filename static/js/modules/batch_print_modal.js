// ==========================================
// BATCH PRINT MODAL & DOĞRULAMA KONTROLÜ
// ==========================================

let activeBatchPrintJob = null;
let printControllerState = null;
let verifyOnCompleteCallback = null;
let verifyBatchItems = [];
let verifyMarkedErrorBarcodes = new Set();
let lastFloatPrintStateActive = false;
let printVerificationState = {
  products: [],
  failedBarcodes: new Set(),
  totalCount: 0
};


async function startManagedBatchPrint(productsToPrint, copiesPerItem = 1, onComplete = null) {
  if (!productsToPrint || productsToPrint.length === 0) return;

  const currentActiveTpl = (typeof templatesList !== 'undefined' && templatesList.find(t => t.id === activeTemplateId)) || (typeof templatesList !== 'undefined' && templatesList[0]) || {};

  printControllerState = {
    isActive: true,
    isPaused: false,
    items: productsToPrint,
    currentIndex: 0,
    copiesPerItem: copiesPerItem,
    onComplete: onComplete
  };

  const modal = document.getElementById('modal-print-progress');
  if (modal) modal.style.display = 'flex';

  updatePrintProgressUI(printControllerState.items[0]);

  for (let i = 0; i < printControllerState.items.length; i++) {
    if (!printControllerState.isActive) break;

    while (printControllerState.isPaused && printControllerState.isActive) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    if (!printControllerState.isActive) break;

    printControllerState.currentIndex = i;
    const currentItem = printControllerState.items[i];
    updatePrintProgressUI(currentItem);

    try {
      const payload = {
        printer: selectedPrinter || "Termal Etiket Yazici",
        products: [currentItem],
        orientation: "POR",
        width_mm: currentWidth,
        height_mm: currentHeight,
        x_offset: parseInt(document.getElementById('settings-x-offset')?.value || 0),
        y_offset: parseInt(document.getElementById('settings-y-offset')?.value || 0),
        dpi: 203,
        copies_per_item: copiesPerItem,
        template: currentActiveTpl
      };

      await fetch(`${API_BASE}/api/print/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch(e) {
      console.warn("Baskı gönderim uyarısı:", e);
    }

    // Etiketler arası kısa bekleme (yazıcının mekanik sağlığı ve durdurma butonuna anında tepki için)
    await new Promise(resolve => setTimeout(resolve, 350));
  }

  const wasActive = printControllerState.isActive;
  const printedItems = [...printControllerState.items];

  if (modal) modal.style.display = 'none';
  printControllerState.isActive = false;
  printControllerState.isPaused = false;

  if (wasActive && printedItems.length > 0) {
    // Yazdırma tamamlandı -> Doğrulama Onay Penceresini Aç!
    openPrintCompletionVerificationModal(printedItems, onComplete);
  }
}


function openPrintCompletionVerificationModal(items, onComplete = null) {
  verifyBatchItems = items || [];
  verifyMarkedErrorBarcodes.clear();
  verifyOnCompleteCallback = onComplete;

  const modal = document.getElementById('modal-print-completion-verification');
  if (!modal) return;

  renderVerifyPrintRows();
  updateVerifyActionButton();
  modal.style.display = 'flex';
}


function renderVerifyPrintRows() {
  const tbody = document.getElementById('verify-print-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  verifyBatchItems.forEach(item => {
    const tr = document.createElement('tr');
    const isError = verifyMarkedErrorBarcodes.has(item.barcode);
    if (isError) tr.style.background = 'rgba(239, 68, 68, 0.12)';

    tr.innerHTML = `
      <td style="text-align: center;">
        <input type="checkbox" ${isError ? 'checked' : ''} onchange="toggleVerifyItemError('${item.barcode}', this.checked)" style="transform: scale(1.15); cursor: pointer;">
      </td>
      <td style="font-family: monospace; color: #38bdf8;">${item.barcode}</td>
      <td style="font-weight: 600; color: var(--text-main);">${item.title || item.title1 || item.excel_title || ''}</td>
      <td style="text-align: right; font-weight: 800; color: #34d399; padding-right: 14px;">${item.price || item.excel_price || ''}</td>
    `;
    tbody.appendChild(tr);
  });
}


function toggleVerifyItemError(barcode, isChecked) {
  if (isChecked) {
    verifyMarkedErrorBarcodes.add(barcode);
  } else {
    verifyMarkedErrorBarcodes.delete(barcode);
  }
  renderVerifyPrintRows();
  updateVerifyActionButton();
}


function toggleSelectAllVerifyItems() {
  if (verifyMarkedErrorBarcodes.size === verifyBatchItems.length) {
    verifyMarkedErrorBarcodes.clear();
  } else {
    verifyBatchItems.forEach(x => verifyMarkedErrorBarcodes.add(x.barcode));
  }
  renderVerifyPrintRows();
  updateVerifyActionButton();
}


function updateVerifyActionButton() {
  const btn = document.getElementById('btn-verify-action');
  const summary = document.getElementById('verify-status-summary');
  if (!btn) return;

  const total = verifyBatchItems.length;
  const errorCount = verifyMarkedErrorBarcodes.size;
  const successCount = total - errorCount;

  if (errorCount === 0) {
    // Hiç hata yok -> Tümü Başarılı
    btn.innerHTML = `✅ Evet, Tümü Başarıyla Basıldı (Verileri Güncelle)`;
    btn.style.background = "linear-gradient(135deg, #10b981, #059669)";
    btn.style.color = "#ffffff";
    if (summary) summary.innerText = `Tüm ürünler (${total} adet) sistemde güncellenecektir.`;
  } else if (errorCount === total) {
    // Tümü Hatalı -> Hiçbiri güncellenmez
    btn.innerHTML = `❌ Hiçbiri Tamamlanmadı (Fiyatları Güncelleme)`;
    btn.style.background = "linear-gradient(135deg, #ef4444, #b91c1c)";
    btn.style.color = "#ffffff";
    if (summary) summary.innerText = `⚠️ Hiçbir ürün güncellenmeyecek, eski fiyatlar korunacaktır.`;
  } else {
    // Bazıları Hatalı -> Seçilenler Hariç Tamamlandı
    btn.innerHTML = `⚠️ Seçilenler Hariç Tamamlandı (${successCount} Ürünü Güncelle)`;
    btn.style.background = "linear-gradient(135deg, #f59e0b, #d97706)";
    btn.style.color = "#ffffff";
    if (summary) summary.innerText = `${successCount} adet ürünün raf fiyatı güncellenecek, hatalı ${errorCount} ürünün eski fiyatı korunacaktır.`;
  }
}


async function confirmPrintVerificationAction() {
  const total = verifyBatchItems.length;
  const errorCount = verifyMarkedErrorBarcodes.size;
  const successItems = verifyBatchItems.filter(x => !verifyMarkedErrorBarcodes.has(x.barcode));

  const modal = document.getElementById('modal-print-completion-verification');
  if (modal) modal.style.display = 'none';

  if (errorCount === total || successItems.length === 0) {
    showToast("ℹ️ Hiçbir fiyat güncellenmedi, eski fiyatlar korundu.", "warning");
    if (verifyOnCompleteCallback) verifyOnCompleteCallback();
    return;
  }

  // Başarılı basılan ürünlerin raf fiyatlarını products.json'da güncelle
  try {
    const payload = {
      source: "PC",
      items: successItems.map(x => ({
        barcode: x.barcode,
        title: x.title || x.title1 || x.excel_title,
        price: x.price || x.excel_price
      }))
    };

    const res = await fetch(`${API_BASE}/api/catalog/sync-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (result.status === 'success') {
      showToast(`✅ ${successItems.length} ürünün raf fiyatı başarıyla güncellendi!`, "success");
      await loadCatalog();
      await loadSyncStatus();
    } else {
      showToast(`❌ Hata: ${result.message}`, "error");
    }
  } catch(e) {
    showToast(`❌ Güncelleme hatası: ${e.message}`, "error");
  }

  if (verifyOnCompleteCallback) verifyOnCompleteCallback();
}


function updatePrintProgressUI(currentItem = null) {
  const total = printControllerState.items.length;
  const current = printControllerState.currentIndex + 1;
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  const bar = document.getElementById('print-ctrl-progress-bar');
  const countTxt = document.getElementById('print-ctrl-count-text');
  const pctTxt = document.getElementById('print-ctrl-percent-text');
  const itemTxt = document.getElementById('print-ctrl-current-item');
  const pauseAlert = document.getElementById('print-ctrl-pause-alert');
  const btnPause = document.getElementById('btn-print-ctrl-pause');
  const btnResume = document.getElementById('btn-print-ctrl-resume');
  const btnCancel = document.getElementById('btn-print-ctrl-cancel');
  const modalTitle = document.getElementById('print-ctrl-modal-title');

  if (bar) bar.style.width = `${pct}%`;
  if (countTxt) countTxt.innerText = `${current} / ${total} Etiket`;
  if (pctTxt) pctTxt.innerText = `%${pct}`;
  if (itemTxt && currentItem) {
    itemTxt.innerText = `${currentItem.title || currentItem.title1 || currentItem.excel_title} (${currentItem.price || ''})`;
  }

  if (printControllerState.isPaused) {
    if (modalTitle) modalTitle.innerText = "⏸️ Yazdırma Duraklatıldı";
    if (pauseAlert) pauseAlert.style.display = "block";
    if (btnPause) btnPause.style.display = "none";
    if (btnResume) btnResume.style.display = "inline-block";
    if (btnCancel) btnCancel.style.display = "inline-block";
  } else {
    if (modalTitle) modalTitle.innerText = "🖨️ Etiketler Yazdırılıyor...";
    if (pauseAlert) pauseAlert.style.display = "none";
    if (btnPause) btnPause.style.display = "inline-block";
    if (btnResume) btnResume.style.display = "none";
    if (btnCancel) btnCancel.style.display = "none";
  }
}


function pausePrinting() {
  printControllerState.isPaused = true;
  updatePrintProgressUI(printControllerState.items[printControllerState.currentIndex]);
  showToast("⏸️ Yazdırma duraklatıldı.", "warning");
}


async function resumePrintingWithConfirm() {
  const remaining = printControllerState.items.length - (printControllerState.currentIndex + 1);
  const ok = await showCustomConfirm(`Kalan ${remaining} etiketin basımına devam etmek istiyor musunuz?`, "Baskıya Devam Et", "Devam Et", "Vazgeç", "▶️");
  if (!ok) return;

  printControllerState.isPaused = false;
  updatePrintProgressUI(printControllerState.items[printControllerState.currentIndex]);
  showToast("▶️ Yazdırmaya devam ediliyor...", "success");
}


async function cancelPrintingWithConfirm() {
  const remaining = printControllerState.items.length - (printControllerState.currentIndex + 1);
  const ok = await showCustomConfirm(`Yazdırma işlemini tamamen iptal etmek istediğinize emin misiniz?\n(Kalan ${remaining} etiket basılmayacak)`, "Baskıyı İptal Et", "Evet, İptal Et", "Vazgeç", "⛔");
  if (!ok) return;

  printControllerState.isActive = false;
  printControllerState.isPaused = false;

  try {
    await fetch(`${API_BASE}/api/print/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ printer: selectedPrinter || "Termal Etiket Yazici" })
    });
  } catch(e) {}

  const modal = document.getElementById('modal-print-progress');
  if (modal) modal.style.display = 'none';

  showToast(`⛔ Yazdırma iptal edildi. (${printControllerState.currentIndex + 1} basıldı, ${remaining} iptal edildi)`, "warning");
}


async function checkFloatingLivePrintStatus() {
  const monitor = document.getElementById('floating-live-print-monitor');
  if (!monitor) return;

  // Eğer masaüstünün kendi modalı açıksa bu mini paneli göstermeye gerek yok
  const mainModal = document.getElementById('modal-print-progress');
  if (mainModal && mainModal.style.display === 'flex') {
    monitor.style.display = 'none';
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/print/live-status`);
    const data = await res.json();
    if (data.status === 'success' && data.live_status) {
      const s = data.live_status;
      if (s.is_active) {
        monitor.style.display = 'flex';
        const total = s.total || 1;
        const current = s.current || 0;
        const pct = Math.round((current / total) * 100);

        document.getElementById('float-print-bar').style.width = `${pct}%`;
        document.getElementById('float-print-count').innerText = `${current} / ${total} Etiket (%${pct})`;
        document.getElementById('float-print-source').innerText = s.source === 'mobile' ? '📱 Mobil Terminal' : '💻 Masaüstü';
        document.getElementById('float-print-status-text').innerText = s.status_text || 'Yazdırılıyor...';
        document.getElementById('float-print-item-name').innerText = s.current_item ? `${s.current_item} (${s.current_price})` : '-';
        lastFloatPrintStateActive = true;
      } else {
        if (lastFloatPrintStateActive) {
          lastFloatPrintStateActive = false;
          // İşlem yeni bittiğinde listeyi yenile
          setTimeout(() => {
            loadCatalog();
            loadSyncStatus(true);
          }, 800);
        }
        monitor.style.display = 'none';
      }
    }
  } catch(e) {}
}
