// -*- coding: utf-8 -*-
/**
 * KASA SATIŞ, ÖDEME VE FİŞ YAZDIRMA (kasa_odeme.js)
 */

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
  const counterVal = document.getElementById('pos-lifetime-sales-count')?.innerText?.trim() || 'A000.000.001';
  const receiptNo = `FİŞ: ${counterVal}`;

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

function executeDirectPayment(shouldPrintReceipt = false) {
  if (!posCart || posCart.length === 0) {
    if (typeof showToast === 'function') {
      showToast('⚠️ Sepette ürün bulunmuyor. Lütfen önce barkod okutun.', 'warning');
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

  // Barkod kutusunda girilmiş nakit para varsa para üstünü hesapla
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

  directPosCheckout('Nakit', receivedCash, changeAmt, shouldPrintReceipt);
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
      if (typeof playPosSound === 'function') playPosSound('success');
      const changeMsg = changeAmount > 0 ? ` • 💵 Para Üstü: ${changeAmount.toFixed(2)} TL` : '';
      if (typeof showToast === 'function') {
        showToast(`✅ ${paymentType} Satışı Tamamlandı (${grandTotal.toFixed(2)} TL)${changeMsg}`, 'success');
      }

      // Bilgi fişi istendiğinde: Sunucu arka planda yazıcıya 1 adet doğrudan iletir (Tarayıcı onay/diyalog ekranı açılmaz)
      if (shouldPrintReceipt) {
        const pStatus = data.receipt_print_status;
        // Eğer sunucu tarafında henüz yazdırılmadıysa doğrudan API ile ilet
        if (!pStatus || pStatus.status !== 'success') {
          triggerThermalReceiptPrint(data.receipt || payload);
        }
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

function printLocalClientSaleReceipt(receiptData, paymentType, grandTotal, receivedCash, changeAmount) {
  const items = receiptData.items || [];
  const recNo = receiptData.receipt_no || `FİŞ-${Date.now().toString().slice(-6)}`;
  const dateStr = receiptData.date || new Date().toLocaleString('tr-TR');

  let itemsHtml = items.map(it => {
    const qty = it.quantity || 1;
    const unit = it.unit || 'Ad';
    const price = (it.unit_price || it.price || 0).toFixed(2);
    const tot = (it.total_price || (qty * price)).toFixed(2);
    return `
      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px;">
        <span style="font-weight: 700; font-size: 13px; color: #000; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 190px;">${it.title}</span>
        <span style="font-weight: 700; font-size: 13px; color: #000;">${tot} TL</span>
      </div>
      <div style="font-size: 11px; color: #333; margin-bottom: 5px;">
        ${qty} ${unit} x ${price} TL
      </div>
    `;
  }).join('');

  const receiptHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Bilgi Fişi - ${recNo}</title>
        <style>
          @page { margin: 0; size: auto; }
          * { box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
            font-size: 12px; 
            width: 68mm; 
            margin: 0 auto; 
            padding: 8px 10px 8px 6px; 
            color: #000; 
            background: #fff;
            -webkit-print-color-adjust: exact;
          }
          .center { text-align: center; }
          .bold { font-weight: 800; }
          .divider { border-top: 1.5px dashed #000; margin: 6px 0; }
          .row { display: flex; justify-content: space-between; align-items: center; margin: 3px 0; padding-right: 4px; }
        </style>
      </head>
      <body>
        <div class="center bold" style="font-size: 16px; letter-spacing: 0.5px;">YARENLER MARKET</div>
        <div class="center" style="font-size: 11px; font-weight: 600;">BİLGİ VE SATIŞ FİŞİ</div>
        <div class="center" style="font-size: 11px; margin-top: 3px;">Tarih: ${dateStr}</div>
        <div class="center" style="font-size: 11px;">Fiş No: ${recNo}</div>
        <div class="divider"></div>
        ${itemsHtml}
        <div class="divider"></div>
        <div class="row bold" style="font-size: 15px; padding: 4px 0;">
          <span>TOPLAM TUTAR:</span>
          <span>${grandTotal.toFixed(2)} TL</span>
        </div>
        ${changeAmount > 0 ? `<div class="row bold" style="font-size: 13px; color: #000;"><span>Para Üstü:</span><span>${changeAmount.toFixed(2)} TL</span></div>` : ''}
        <div class="divider"></div>
        <div class="center bold" style="font-size: 12px; margin-top: 6px;">TEŞEKKÜR EDER, İYİ GÜNLER DİLERİZ!</div>
        <div class="center" style="font-size: 10px; margin-top: 3px; color: #333;">MALİ DEĞERİ YOKTUR • BİLGİ AMAÇLIDIR</div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }, 100);
          };
        <\/script>
      </body>
    </html>
  `;

  // Görünmez tünel iframe ile arka planda doğrudan yazdır
  let printFrame = document.getElementById('hidden-pos-print-frame');
  if (printFrame) {
    try { printFrame.remove(); } catch(e) {}
  }
  
  printFrame = document.createElement('iframe');
  printFrame.id = 'hidden-pos-print-frame';
  printFrame.style.position = 'fixed';
  printFrame.style.left = '-9999px';
  printFrame.style.top = '-9999px';
  printFrame.style.width = '100px';
  printFrame.style.height = '100px';
  printFrame.style.border = 'none';
  document.body.appendChild(printFrame);

  const frameDoc = printFrame.contentWindow.document;
  frameDoc.open();
  frameDoc.write(receiptHtml);
  frameDoc.close();

  // Iframe render edildiğinde yazdır
  setTimeout(() => {
    try {
      printFrame.contentWindow.focus();
      printFrame.contentWindow.print();
    } catch (e) {
      console.warn("Otomatik fiş basım hatası:", e);
    }
  }, 250);
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

  // Fiş onay pop-up modalını beklemeden doğrudan satışı ve otomatik fişi bas
  directPosCheckout('Nakit', receivedCash, changeAmt, true);
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

