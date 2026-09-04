// -*- coding: utf-8 -*-
/**
 * KASA KLAVYE KISAYOLLARI & GLOBAL DIŞA AKTARIMLAR (kasa_kisayollar.js)
 */

// =========================================================
// 9. 10'LU BUTON BAĞLANTILARI VE KLAVYE KISAYOLLARI
// =========================================================
function initPosBottomButtons() {
  const btnMap = {
    'btn-pos-action-quick-prod': () => openPosQuickProductModal(),
    'btn-pos-action-mobile': () => openPosMobileQrModal(),
    'btn-pos-action-price-check': () => openPosPriceCheckModal(),
    'btn-pos-action-clear': () => confirmClearPosCart(),       // FİŞ İPTAL [F3]
    'btn-pos-action-pay': () => openPosPaymentModal(),         // ÖDEME AL [F4]
    'btn-pos-action-cash': () => openPosPaymentModal(),
    'btn-pos-action-card': () => openPosPaymentModal(),
    'btn-pos-action-drawer': () => openCashDrawerAction(),     // ÇEKMECE [F7]
    'btn-pos-action-recent': () => openPosRecentSalesModal(),  // ESKİ SATIŞ [F8]
    'btn-pos-action-return': () => openPosReturnModal(),       // İADE [F9]
    'btn-pos-action-gift': () => applyPosGiftDiscount(),       // İKRAM [F10]
    'btn-pos-action-credit': () => openPosCreditModal(),       // VERESİYE [F11]
    
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

// Klavye Kısayolları (Capture Modunda Tüm F Tuşlarını Yakala & Browser Varsayılanlarını Engelle)
window.addEventListener('keydown', async (e) => {
  const fKeys = ['F1', 'F2', 'F3', 'F4', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'];
  
  // Alt+F4 veya Uygulama Kapatma Yakalayıcısı
  if (e.altKey && (e.key === 'F4' || e.code === 'F4')) {
    const hasActiveCart = (typeof posCart !== 'undefined' && Array.isArray(posCart) && posCart.length > 0);
    const hasParkedReceipts = (typeof parkedReceipts !== 'undefined' && Array.isArray(parkedReceipts) && parkedReceipts.length > 0);

    if (hasActiveCart || hasParkedReceipts) {
      e.preventDefault();
      e.stopPropagation();
      const ok = await showCustomConfirm(
        '⚠️ Kasada ekranda açık veya askıda bekleyen satış fişleri bulunuyor!\n\nSistemi kapatırsanız açık işlemleriniz askıda kalacaktır. Yine de kapatmak istiyor musunuz?',
        'Kasayı Kapatma Uyarısı',
        'Evet, Kapat',
        'Vazgeç',
        '⚠️'
      );
      if (ok) {
        if (typeof exitDesktopApp === 'function') {
          exitDesktopApp();
        } else {
          window.close();
        }
      }
      return;
    } else {
      // Sepet boşsa doğrudan kapat
      if (typeof exitDesktopApp === 'function') {
        exitDesktopApp();
      }
    }
  }

  // F tuşuna basıldıysa Chrome arama/yardım vb. varsayılanlarını engelle (F5 normal yenileme olarak serbest bırakıldı)
  if (fKeys.includes(e.key) || e.key === 'Insert') {
    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'F1') {
      openPosMobileQrModal(); // MOBİL QR OKUMA & KAMERA [F1]
    } else if (e.key === 'F2') {
      openPosPriceCheckModal(); // FİYAT GÖR [F2]
    } else if (e.key === 'F3') {
      confirmClearPosCart(); // FİŞ İPTAL [F3]
    } else if (e.key === 'F4') {
      executeDirectPayment(false); // ÖDEME AL (FİŞSİZ) [F4]
    } else if (e.key === 'F6') {
      parkCurrentReceipt(); // FİŞ BEKLET [F6]
    } else if (e.key === 'F7') {
      openPosCashMovementModal('out'); // KASA ÇIKIŞI & GİRİŞİ [F7]
    } else if (e.key === 'F8') {
      openPosReturnModal(); // İADE [F8]
    } else if (e.key === 'F9') {
      openPosRecentSalesModal(); // ESKİ SATIŞ [F9]
    } else if (e.key === 'F10' || e.key === 'Insert') {
      openPosQuickProductModal(); // HIZLI ÜRÜN [F10 / Insert]
    } else if (e.key === 'F11') {
      openPosCreditModal(); // VERESİYE [F11]
    } else if (e.key === 'F12') {
      executeDirectPayment(true); // ÖDEME AL & YAZDIR [F12]
    }

    return;
  }

  const quickProdModal = document.getElementById('modal-pos-quick-product-manage');
  const isQuickProdOpen = quickProdModal && quickProdModal.style.display === 'flex';

  const priceModal = document.getElementById('modal-pos-price-check');
  const isPriceModalOpen = priceModal && priceModal.style.display === 'flex';

  const mobileModal = document.getElementById('modal-pos-mobile-qr');
  const isMobileModalOpen = mobileModal && mobileModal.style.display === 'flex';

  const returnModal = document.getElementById('modal-pos-return');
  const isReturnModalOpen = returnModal && returnModal.style.display === 'flex';

  const parkedModal = document.getElementById('modal-parked-receipts');
  const isParkedModalOpen = parkedModal && parkedModal.style.display === 'flex';

  const notFoundModal = document.getElementById('modal-pos-barcode-not-found');
  const isNotFoundOpen = notFoundModal && (notFoundModal.style.display === 'flex' || notFoundModal.classList.contains('active'));

  const receiptConfirmModal = document.getElementById('modal-pos-receipt-confirm');
  const isReceiptConfirmOpen = receiptConfirmModal && receiptConfirmModal.style.display === 'flex';

  const clearConfirmModal = document.getElementById('modal-pos-clear-confirm');
  const isClearConfirmOpen = clearConfirmModal && (clearConfirmModal.style.display === 'flex' || clearConfirmModal.classList.contains('active'));

  // FİŞ İPTAL / SEPET SİLME ONAY MODALINDA ENTER -> SİL, ESC -> VAZGEÇ
  if (isClearConfirmOpen) {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeClearPosCart();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closePosClearConfirmModal();
      return;
    }
  }

  // ÖDEME AL PENCERESİNDE 1-2-3-4 VE ESC KONTROLLERİ
  if (isReceiptConfirmOpen) {
    if (e.key === '1' || e.code === 'Digit1' || e.code === 'Numpad1') {
      e.preventDefault();
      executeQuickPayment('Nakit', false);
      return;
    }
    if (e.key === '2' || e.code === 'Digit2' || e.code === 'Numpad2') {
      e.preventDefault();
      executeQuickPayment('Kredi Kartı', false);
      return;
    }
    if (e.key === '3' || e.code === 'Digit3' || e.code === 'Numpad3') {
      e.preventDefault();
      executeQuickPayment('Nakit', true);
      return;
    }
    if (e.key === '4' || e.code === 'Digit4' || e.code === 'Numpad4') {
      e.preventDefault();
      executeQuickPayment('Kredi Kartı', true);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closePosPaymentModal();
      return;
    }
  }

  // BARKOD BULUNAMADI UYARISI MODALINDA ENTER -> HIZLI ÜRÜN TANIMLA, ESC -> KAPAT
  if (isNotFoundOpen) {
    if (e.key === 'Enter') {
      e.preventDefault();
      openQuickProductFromNotFoundAlert();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closeBarcodeNotFoundAlert();
      return;
    }
  }

  // İADE MODALI KONTROLLERİ (1 -> NAKİT İADE, 2 -> KART İADE, ESC -> KAPAT)
  if (isReturnModalOpen) {
    if (e.key === '1' || (e.key === 'Enter' && (!e.target || e.target.tagName !== 'INPUT'))) {
      e.preventDefault();
      executeDirectPosReturn('Nakit İade');
      return;
    }
    if (e.key === '2') {
      e.preventDefault();
      executeDirectPosReturn('Kart İade');
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closePosReturnModal();
      return;
    }
  }

  // Açık Modal Kapatma (ESC ile tüm modalları anında kapat)
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    if (typeof closeAllActiveModals === 'function') {
      closeAllActiveModals();
    } else {
      if (typeof closePosXReportModal === 'function') closePosXReportModal();
      if (typeof closePosCreditModal === 'function') closePosCreditModal();
      if (typeof closePosReturnModal === 'function') closePosReturnModal();
      if (typeof closeReturnItemsModal === 'function') closeReturnItemsModal();
      if (typeof closeEditSaleModal === 'function') closeEditSaleModal();
      if (typeof closeParkedReceiptsModal === 'function') closeParkedReceiptsModal();
      if (typeof closePosRecentSalesModal === 'function') closePosRecentSalesModal();
      if (typeof closePosQuickProductModal === 'function') closePosQuickProductModal();
      if (typeof closePosPriceCheckModal === 'function') closePosPriceCheckModal();
      if (typeof closePosMobileQrModal === 'function') closePosMobileQrModal();
      if (typeof closePosCashMovementModal === 'function') closePosCashMovementModal();
      if (typeof closeCashierSwitchModal === 'function') closeCashierSwitchModal();
      if (typeof closePosPaymentModal === 'function') closePosPaymentModal();
      if (typeof closePosClearConfirmModal === 'function') closePosClearConfirmModal();
    }
    return;
  }

  // Hızlı Ürün Formunda Enter -> Kaydet
  if (isQuickProdOpen && e.key === 'Enter' && e.target && e.target.id !== 'quick-prod-barcode') {
    e.preventDefault();
    submitQuickProductSave();
    return;
  }
}, true);



// =========================================================
// 10. GLOBAL WINDOW DIŞA AKTARIMLARI
// =========================================================
window.loadPosQuickGrid = loadPosQuickGrid;
window.addPosQuickItemByIndex = addPosQuickItemByIndex;
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
window.executePosPriceCheck = executePosPriceCheck;
window.addFoundProductToPosCart = addFoundProductToPosCart;
window.confirmClearPosCart = confirmClearPosCart;
window.startPosSaleCheckout = startPosSaleCheckout;
window.directPosCheckout = directPosCheckout;
window.openCashDrawerAction = openCashDrawerAction;
window.openPosRecentSalesModal = openPosRecentSalesModal;
window.openParkedReceiptsModal = openParkedReceiptsModal;
window.closeParkedReceiptsModal = closeParkedReceiptsModal;
window.clearAllParkedReceipts = clearAllParkedReceipts;
window.openPosReturnModal = openPosReturnModal;
window.closePosReturnModal = closePosReturnModal;
window.submitPosReturnExecute = submitPosReturnExecute;
window.openCashierSwitchModal = openCashierSwitchModal;
window.closeCashierSwitchModal = closeCashierSwitchModal;
window.submitCashierSwitch = submitCashierSwitch;
window.applyPosGiftDiscount = applyPosGiftDiscount;
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
window.openPosPaymentModal = openPosPaymentModal;
window.closePosPaymentModal = closePosPaymentModal;
window.executeQuickPayment = executeQuickPayment;
window.openPosReceiptConfirmModal = openPosReceiptConfirmModal;
window.executePendingPosCheckout = executePendingPosCheckout;
window.handleWaitingBarClick = handleWaitingBarClick;
window.currentXReportData = null;

async function openPosXReportModal() {
  showPosModal('modal-pos-x-report');

  try {
    const res = await fetch(`/api/pos/x_report?_t=${Date.now()}`, { cache: 'no-store' });
    const data = await res.json();
    if (data && data.status === 'success') {
      window.currentXReportData = data;
      
      const setTxt = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = (val !== undefined && val !== null) ? String(val) : '';
      };

      setTxt('x-rep-market-name', data.market_name || 'YARENLER MARKET');
      setTxt('x-rep-datetime', `${data.date} ${data.time}`);
      setTxt('x-rep-cashier', `Kasiyer: ${data.active_cashier || 'Kasa 1'}`);
      setTxt('x-rep-opening-cash', data.opening_cash_str || `${Number(data.opening_cash || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`);
      setTxt('x-rep-cash-sales', data.cash_sales_str || '0,00 TL');
      setTxt('x-rep-card-sales', data.card_sales_str || '0,00 TL');
      setTxt('x-rep-debt-sales', data.debt_sales_str || '0,00 TL');
      setTxt('x-rep-debt-collections', data.debt_collections_total_str || '0,00 TL');
      setTxt('x-rep-cash-inflow', data.cash_inflow_str || '0,00 TL');
      setTxt('x-rep-cash-outflow', data.cash_outflow_str || '0,00 TL');
      setTxt('x-rep-returns', data.return_total_str || '0,00 TL');
      setTxt('x-rep-total-sales', data.total_sales_str || '0,00 TL');
      setTxt('x-rep-counts', `${data.receipt_count || 0} Fiş / ${data.total_items_sold || 0} Kalem`);
      setTxt('x-rep-drawer-cash', data.current_cash_in_drawer_str || `${Number(data.current_cash_in_drawer || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`);

      const advInp = document.getElementById('inp-x-cash-advance');
      if (advInp) advInp.value = data.opening_cash !== undefined ? data.opening_cash : 500;

      const movSec = document.getElementById('x-rep-movements-section');
      const movList = document.getElementById('x-rep-movements-list');
      if (movSec && movList) {
        const moves = data.today_movements || [];
        if (moves.length > 0) {
          movSec.style.display = 'block';
          movList.innerHTML = moves.map(m => {
            const isOut = m.type === 'out';
            const sign = isOut ? '-' : '+';
            return `<div style="display: flex; justify-content: space-between;"><span>• ${m.category || 'Gider'} ${m.description ? `(${m.description})` : ''}</span><strong>${sign}${m.amount_str || m.amount}</strong></div>`;
          }).join('');
        } else {
          movSec.style.display = 'none';
        }
      }
    }
  } catch (e) {
    console.error('X Raporu çekme hatası:', e);
  }
}

function closePosXReportModal() {
  hidePosModal('modal-pos-x-report');
}

async function updateCashAdvanceFromXModal() {
  const inp = document.getElementById('inp-x-cash-advance');
  const val = parseFloat(inp?.value) || 0;
  try {
    const res = await fetch('/api/pos/cash_advance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: val })
    });
    const data = await res.json();
    if (data.status === 'success') {
      if (typeof showToast === 'function') {
        showToast(`✓ Kasa açılış avansı ${val.toFixed(2)} TL olarak güncellendi!`, 'success');
      }
      await openPosXReportModal();
    } else {
      if (typeof showToast === 'function') showToast(`❌ ${data.message || 'Güncellenemedi'}`, 'error');
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('Bağlantı hatası, avans kaydedilemedi.', 'error');
  }
}

function printPosXReportThermal() {
  const paper = document.getElementById('x-report-receipt-paper');
  if (!paper) return;
  const printWin = window.open('', '_blank', 'width=380,height=600');
  printWin.document.write(`
    <html>
      <head>
        <title>X Raporu</title>
        <style>
          body { font-family: monospace; padding: 10px; margin: 0; font-size: 12px; }
          @media print { @page { margin: 0; size: 80mm auto; } body { margin: 4mm; } }
        </style>
      </head>
      <body>
        ${paper.innerHTML}
        <script>window.onload = function() { window.print(); window.close(); }<\/script>
      </body>
    </html>
  `);
  printWin.document.close();
}

function shareXReportViaWhatsApp() {
  const mktName = document.getElementById('x-rep-market-name')?.innerText || 'MARKET';
  const dt = document.getElementById('x-rep-datetime')?.innerText || '';
  const cashier = document.getElementById('x-rep-cashier')?.innerText || '';
  const totalSales = document.getElementById('x-rep-total-sales')?.innerText || '0,00 TL';
  const cashSales = document.getElementById('x-rep-cash-sales')?.innerText || '0,00 TL';
  const cardSales = document.getElementById('x-rep-card-sales')?.innerText || '0,00 TL';
  const debtSales = document.getElementById('x-rep-debt-sales')?.innerText || '0,00 TL';
  const cashIn = document.getElementById('x-rep-cash-inflow')?.innerText || '0,00 TL';
  const cashOut = document.getElementById('x-rep-cash-outflow')?.innerText || '0,00 TL';
  const returns = document.getElementById('x-rep-returns')?.innerText || '0,00 TL';
  const drawerCash = document.getElementById('x-rep-drawer-cash')?.innerText || '0,00 TL';
  const counts = document.getElementById('x-rep-counts')?.innerText || '0 Fiş';

  const text = `📊 *${mktName} - GÜN SONU / KASA RAPORU*\n📅 *Tarih:* ${dt}\n👤 *${cashier}*\n\n💰 *TOPLAM CİRO:* ${totalSales}\n• 💵 *Nakit:* ${cashSales}\n• 💳 *Kredi Kartı:* ${cardSales}\n• 📒 *Veresiye:* ${debtSales}\n• 🟢 *Kasa Girişleri:* ${cashIn}\n• 🔴 *Kasa Çıkışları / Toptancı:* ${cashOut}\n• ↩️ *İadeler:* ${returns}\n\n💼 *ÇEKMECEDEKİ NET NAKİT:* ${drawerCash}\n🧾 *İşlem:* ${counts}\n\nHayırlı ve bereketli kazançlar dileriz.`;

  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

window.openPosXReportModal = openPosXReportModal;
window.closePosXReportModal = closePosXReportModal;
window.updateCashAdvanceFromXModal = updateCashAdvanceFromXModal;
window.printPosXReportThermal = printPosXReportThermal;
window.shareXReportViaWhatsApp = shareXReportViaWhatsApp;
window.showBranchInfo = showBranchInfo;
window.showTerminalInfo = showTerminalInfo;
window.checkOnlineServerStatus = checkOnlineServerStatus;
window.validateQuickProdInputs = validateQuickProdInputs;
window.onQuickProdTitleChange = onQuickProdTitleChange;
window.autoDetectBrandFromTitle = autoDetectBrandFromTitle;
window.payFullPosAmount = payFullPosAmount;
window.handlePartialPaymentKey = handlePartialPaymentKey;
window.setPartialInputAmount = setPartialInputAmount;
window.addPartialPosPayment = addPartialPosPayment;
window.updatePosPaymentModalView = updatePosPaymentModalView;
window.finalizeSplitPosSale = finalizeSplitPosSale;
window.closePosClearConfirmModal = closePosClearConfirmModal;
window.executeClearPosCart = executeClearPosCart;
window.cancelPosExitModal = cancelPosExitModal;
window.forceClosePosApp = forceClosePosApp;
window.openAddQuickButtonModal = openAddQuickButtonModal;
window.closeAddQuickButtonModal = closeAddQuickButtonModal;
window.submitNewQuickButton = submitNewQuickButton;
window.triggerBarcodeNotFoundAlert = triggerBarcodeNotFoundAlert;
window.closeBarcodeNotFoundAlert = closeBarcodeNotFoundAlert;
window.openQuickProductFromNotFoundAlert = openQuickProductFromNotFoundAlert;
window.openPosCreditModal = openPosCreditModal;
window.closePosCreditModal = closePosCreditModal;
window.switchPosCreditSubTab = switchPosCreditSubTab;
window.onPosCreditCustomerChange = onPosCreditCustomerChange;
window.togglePosQuickCustomerForm = togglePosQuickCustomerForm;
window.submitQuickCustomerFromPos = submitQuickCustomerFromPos;
window.submitPosCreditSale = submitPosCreditSale;
window.onPosTahsilatCustomerChange = onPosTahsilatCustomerChange;
window.setPosTahsilatAmount = setPosTahsilatAmount;
window.setPosTahsilatFullDebt = setPosTahsilatFullDebt;
window.updatePosTahsilatLiveCalc = updatePosTahsilatLiveCalc;
window.submitPosTahsilat = submitPosTahsilat;
window.triggerQuickProductBarcodeLookup = triggerQuickProductBarcodeLookup;
window.executeDirectPosReturn = executeDirectPosReturn;
window.openPosReturnModal = openPosReturnModal;
window.closePosReturnModal = closePosReturnModal;
window.openPosRecentSalesModal = openPosRecentSalesModal;
window.closeParkedReceiptsModal = closeParkedReceiptsModal;
window.switchRecentSalesSubTab = switchRecentSalesSubTab;
window.fetchRecentSalesList = fetchRecentSalesList;
window.filterRecentSalesTable = filterRecentSalesTable;
window.reprintRecentSale = reprintRecentSale;
window.returnFromRecentSale = returnFromRecentSale;
window.clearAllParkedReceipts = clearAllParkedReceipts;
window.recallParkedReceipt = recallParkedReceipt;
window.deleteParkedReceipt = deleteParkedReceipt;
window.openCashierSwitchModal = openCashierSwitchModal;
window.closeCashierSwitchModal = closeCashierSwitchModal;
window.submitCashierSwitch = submitCashierSwitch;
window.onCashierDropdownChange = onCashierDropdownChange;
window.openPosCashMovementModal = openPosCashMovementModal;
window.closePosCashMovementModal = closePosCashMovementModal;
window.setCashMovementType = setCashMovementType;
window.selectCashMovCategory = selectCashMovCategory;
function triggerThermalReceiptPrint(receipt) {
  if (!receipt) return;
  
  // 1. Arka planda doğrudan Windows termal yazıcı kuyruğuna ilet (Diyalog ve pop-up açmadan)
  fetch('/api/pos/print_receipt_direct', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ receipt: receipt })
  }).then(r => r.json()).then(data => {
    if (typeof showToast === 'function') {
      showToast('🖨️ Bilgi fişi doğrudan yazıcıya gönderildi!', 'success');
    }
  }).catch(e => {
    console.warn('Yazıcı doğrudan iletim:', e);
  });
}

window.triggerThermalReceiptPrint = triggerThermalReceiptPrint;
window.loadSaleToPosCart = loadSaleToPosCart;
window.openEditSaleModal = openEditSaleModal;
window.closeEditSaleModal = closeEditSaleModal;
window.onEditSalePaymentTypeChange = onEditSalePaymentTypeChange;
window.submitEditSaleSave = submitEditSaleSave;
window.openReturnItemsModal = openReturnItemsModal;
window.closeReturnItemsModal = closeReturnItemsModal;
window.setReturnMode = setReturnMode;
window.toggleReturnItemCheck = toggleReturnItemCheck;
window.onReturnItemQtyChange = onReturnItemQtyChange;
window.submitReturnItemsConfirmation = submitReturnItemsConfirmation;
window.submitPosCashMovement = submitPosCashMovement;
window.loadTodayCashMovements = loadTodayCashMovements;
window.deleteCashMovementItem = deleteCashMovementItem;
window.changePosQuickPage = changePosQuickPage;
window.openBarkodsuzManagerModal = openBarkodsuzManagerModal;
window.closeBarkodsuzManagerModal = closeBarkodsuzManagerModal;
window.moveBarkodsuzItem = moveBarkodsuzItem;
window.deleteBarkodsuzItemFromModal = deleteBarkodsuzItemFromModal;
window.submitAddNewBarkodsuzItem = submitAddNewBarkodsuzItem;
window.saveBarkodsuzOrderChanges = saveBarkodsuzOrderChanges;
