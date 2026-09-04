// -*- coding: utf-8 -*-
/**
 * EVRENSEL YARDIMCILAR, WHATSAPP & MODAL KISAYOLLARI (cekirdek_yardimcilar.js)
 */

function formatPhoneNumberString(val) {
  if (!val) return '';
  let str = String(val).trim();
  let digits = str.replace(/\D/g, '');
  if (!digits) return str;

  // Başka ülke kodu (+49, +1, vb.) ile girildiyse
  if (str.startsWith('+') && !digits.startsWith('90')) {
    if (digits.length <= 3) return `+${digits}`;
    if (digits.length <= 6) return `+${digits.slice(0, 2)} ${digits.slice(2)}`;
    if (digits.length <= 9) return `+${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
    return `+${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 12)}`.trim();
  }

  // Türkiye (+90) Formatı
  if (digits.startsWith('90')) {
    digits = digits.substring(2);
  } else if (digits.startsWith('0')) {
    digits = digits.substring(1);
  }

  digits = digits.substring(0, 10);

  if (digits.length === 0) return '+90 ';
  if (digits.length <= 3) return `+90 ${digits}`;
  if (digits.length <= 6) return `+90 ${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `+90 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`;
}

function formatPhoneInput(input) {
  if (!input) return;
  const val = input.value;
  if (!val) return;
  input.value = formatPhoneNumberString(val);
}

function cleanPhoneForWhatsApp(phone) {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('0')) digits = digits.substring(1);
  if (!digits.startsWith('90') && digits.length === 10) digits = '90' + digits;
  return digits;
}

function sendWhatsAppUniversal(phone, text, receiptNo = '') {
  const cleanPhone = cleanPhoneForWhatsApp(phone);
  if (!cleanPhone || cleanPhone.length < 10) {
    if (typeof showToast === 'function') {
      showToast('⚠️ Müşterinin geçerli bir WhatsApp telefon numarası bulunamadı.', 'warning');
    }
    return false;
  }

  // 1. Send message to background queue
  fetch('/api/whatsapp/send_automated', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: cleanPhone,
      text: text,
      receipt_no: receiptNo
    })
  })
  .then(r => r.json())
  .then(data => {
    if (data.status === 'success' && data.is_bot_active) {
      if (typeof showToast === 'function') {
        showToast('💬 WhatsApp mesajı arka planda otomatik olarak gönderiliyor.', 'success');
      }
    } else {
      // Fallback to manual WhatsApp Web tab
      try {
        const webUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
        window.open(webUrl, '_blank');
      } catch (err) {}
      if (typeof showToast === 'function') {
        showToast('💬 Tarayıcı yönlendirmesi ile WhatsApp mesajı hazırlandı.', 'success');
      }
    }
  })
  .catch(e => {
    console.warn('Bot connection warning:', e);
    // Fallback to manual WhatsApp Web tab on network error
    try {
      const webUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
      window.open(webUrl, '_blank');
    } catch (err) {}
  });

  return true;
}

function printPaymentReceiptSlip({
  custName,
  custPhone = '',
  amount = 0,
  payMethod = 'Nakit',
  txType = 'payment',
  oldBalance = 0,
  newBalance = 0,
  dateStr = new Date().toLocaleString('tr-TR'),
  receiptNo = `MAK-${Date.now()}`
}) {
  const printWin = window.open('', '_blank', 'width=380,height=580');
  if (!printWin) return;

  const isDebt = txType === 'debt';
  const title = isDebt ? 'BORÇ EKLEME MAKBUZU' : 'VERESİYE ÖDEME MAKBUZU';

  printWin.document.write(`
    <!DOCTYPE html>
    <html lang="tr">
      <head>
        <meta charset="UTF-8">
        <title>${title} - ${custName}</title>
        <style>
          body { font-family: 'Courier New', Courier, monospace; padding: 12px; margin: 0; font-size: 12px; color: #000; }
          @media print { @page { margin: 0; size: 80mm auto; } body { margin: 2mm; } }
          .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
          .title { font-size: 15px; font-weight: 900; }
          .row { display: flex; justify-content: space-between; margin: 4px 0; }
          .totals { border-top: 1px dashed #000; border-bottom: 2px dashed #000; padding: 6px 0; margin-top: 6px; }
          .bold { font-weight: bold; }
          .footer { text-align: center; margin-top: 10px; font-size: 10.5px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">YARENLER SÜPERMARKET</div>
          <div style="font-size: 11px;">Merkez Şube</div>
          <div style="font-size: 12px; font-weight: bold; margin-top: 4px;">*** ${title} ***</div>
          <div style="font-size: 10.5px; margin-top: 4px;">Tarih: ${dateStr}</div>
          <div style="font-size: 10.5px;">Makbuz No: ${receiptNo}</div>
        </div>

        <div style="margin-bottom: 8px;">
          <div class="row"><span class="bold">Müşteri Adı:</span> <span>${custName}</span></div>
          ${custPhone ? `<div class="row"><span>Telefon:</span> <span>${custPhone}</span></div>` : ''}
          <div class="row"><span>Ödeme Yöntemi:</span> <span>${payMethod}</span></div>
        </div>

        <div class="totals">
          <div class="row bold" style="font-size: 14px;">
            <span>${isDebt ? 'EKLENEN TUTAR:' : 'TAHSİL EDİLEN:'}</span>
            <span>${parseFloat(amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</span>
          </div>
          <div class="row" style="font-size: 11px; margin-top: 4px;">
            <span>Önceki Bakiye:</span>
            <span>${parseFloat(oldBalance).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</span>
          </div>
          <div class="row bold" style="font-size: 13px; margin-top: 4px; border-top: 1px dashed #000; padding-top: 4px;">
            <span>KALAN GÜNCEL BORÇ:</span>
            <span>${parseFloat(newBalance).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</span>
          </div>
        </div>

        <div class="footer">
          <p style="margin: 4px 0; font-weight: bold;">Ödemeniz için teşekkür ederiz!</p>
          <p style="margin: 2px 0; font-size: 9px;">Bilgi amaçlı düzenlenmiştir.</p>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 250);
          };
        <\/script>
      </body>
    </html>
  `);
  printWin.document.close();
}

window.formatPhoneNumberString = formatPhoneNumberString;
window.formatPhoneInput = formatPhoneInput;
window.cleanPhoneForWhatsApp = cleanPhoneForWhatsApp;
window.sendWhatsAppUniversal = sendWhatsAppUniversal;
window.printPaymentReceiptSlip = printPaymentReceiptSlip;

window.addEventListener('keydown', (e) => {
  const confirmModal = document.getElementById('modal-app-confirm');
  if (confirmModal && confirmModal.style.display === 'flex') {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      _resolveAppConfirm(true);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      _resolveAppConfirm(false);
      return;
    }
  }

  const promptModal = document.getElementById('modal-app-prompt');
  if (promptModal && promptModal.style.display === 'flex') {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      const input = document.getElementById('app-prompt-input');
      _resolveAppPrompt(input ? input.value : '');
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      _resolveAppPrompt(null);
      return;
    }
  }

  if (e.key === 'Escape') {
    const confirmModal = document.getElementById('modal-app-confirm');
    const promptModal = document.getElementById('modal-app-prompt');
    if ((confirmModal && confirmModal.style.display === 'flex') || (promptModal && promptModal.style.display === 'flex')) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    closeAllActiveModals();
  }
});

// EVRENSEL MODAL KAPATICI (ESC İLE TÜM AÇIK MODALLARI ANINDA KAPAT VE BARKODA ODAKLAN)
function closeAllActiveModals() {
  if (typeof closePosXReportModal === 'function') closePosXReportModal();
  if (typeof closePosCreditModal === 'function') closePosCreditModal();
  if (typeof closeReturnItemsModal === 'function') closeReturnItemsModal();
  if (typeof closePosReturnModal === 'function') closePosReturnModal();
  if (typeof closeEditSaleModal === 'function') closeEditSaleModal();
  if (typeof closeParkedReceiptsModal === 'function') closeParkedReceiptsModal();
  if (typeof closePosRecentSalesModal === 'function') closePosRecentSalesModal();
  if (typeof closePosQuickProductModal === 'function') closePosQuickProductModal();
  if (typeof closeAddQuickButtonModal === 'function') closeAddQuickButtonModal();
  if (typeof closePosPriceCheckModal === 'function') closePosPriceCheckModal();
  if (typeof closePosCashMovementModal === 'function') closePosCashMovementModal();
  if (typeof closeCashierSwitchModal === 'function') closeCashierSwitchModal();
  if (typeof closePosMobileQrModal === 'function') closePosMobileQrModal();
  if (typeof closePosPaymentModal === 'function') closePosPaymentModal();
  if (typeof closePosClearConfirmModal === 'function') closePosClearConfirmModal();
  if (typeof closeCatalogProductDetailModal === 'function') closeCatalogProductDetailModal();
  if (typeof closePosAutocompletePopup === 'function') closePosAutocompletePopup();

  document.querySelectorAll('.universal-modal-overlay, .modal-backdrop, .modal-overlay, [id^="modal-pos-"], [id^="modal-parked"]').forEach(m => {
    if (m.id !== 'modal-app-confirm' && m.id !== 'modal-app-prompt') {
      if (m.style.display && m.style.display !== 'none') {
        m.style.display = 'none';
      }
      m.classList.remove('active');
    }
  });

  const barInp = document.getElementById('pos-barcode-input');
  if (barInp) {
    setTimeout(() => { try { barInp.focus(); barInp.select(); } catch(err){} }, 30);
  }
}
window.closeAllActiveModals = closeAllActiveModals;

// ==========================================
// TAM EKRAN (FULLSCREEN) YÖNETİMİ (ALT + ENTER / F11)
// ==========================================
function toggleFullScreenMode() {
  // 1. PyWebview Masaüstü Pencere API'si (pywebview.api.toggle_fullscreen)
  if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.toggle_fullscreen === 'function') {
    window.pywebview.api.toggle_fullscreen().catch(err => {
      console.log('Pywebview fullscreen geçiş hatası:', err);
    });
    return;
  }

  // 2. Standart HTML5 Fullscreen API Fallback (Tarayıcı ortamı)
  if (!document.fullscreenElement) {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else if (document.documentElement.webkitRequestFullscreen) {
      document.documentElement.webkitRequestFullscreen();
    } else if (document.documentElement.msRequestFullscreen) {
      document.documentElement.msRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  }
}
window.toggleFullScreenMode = toggleFullScreenMode;

// ALT + ENTER veya F11 ile Tam Ekran Aç / Kapat
window.addEventListener('keydown', (e) => {
  if ((e.altKey && e.key === 'Enter') || e.key === 'F11') {
    e.preventDefault();
    toggleFullScreenMode();
  }
}, true);

// ==========================================
// AKILLI KAYDIRMA ALANI KLAVYE DESTEĞİ (AŞAĞI / YUKARI OK TUŞLARI)
// ==========================================
let _lastClickedScrollContainer = null;

// Tıklanan kaydırılabilir alanı veya scrollbarı hatırla
window.addEventListener('mousedown', (e) => {
  let target = e.target;
  while (target && target !== document.body) {
    if (target.id === 'pos-quick-3col-grid' || 
        target.id === 'batch-price-items-container' || 
        target.classList?.contains('pos-cart-table-wrapper') || 
        target.classList?.contains('catalog-table-wrapper') ||
        (target.scrollHeight > target.clientHeight && target.clientHeight > 100)) {
      _lastClickedScrollContainer = target;
      break;
    }
    target = target.parentElement;
  }
}, true);

// Klavyede Aşağı (ArrowDown) / Yukarı (ArrowUp) tuşlarına basıldığında seçili alanda aşağı in
window.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'PageDown' && e.key !== 'PageUp') return;

  // Eğer kullanıcı bir metin kutusunda (input/textarea) yazıyorsa engelleme
  const activeEl = document.activeElement;
  const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
  
  // Eğer input içinde değilse veya doğrudan scroll alanına odaklanıldıysa
  if (!isTyping || activeEl.id === 'pos-quick-3col-grid' || activeEl.id === 'batch-price-items-container') {
    const container = _lastClickedScrollContainer || 
                      document.getElementById('pos-quick-3col-grid') || 
                      document.getElementById('batch-price-items-container');
    
    if (container && (container.scrollHeight > container.clientHeight)) {
      e.preventDefault();
      const scrollStep = (e.key === 'PageDown' || e.key === 'PageUp') ? 220 : 75;
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        container.scrollBy({ top: scrollStep, behavior: 'smooth' });
      } else {
        container.scrollBy({ top: -scrollStep, behavior: 'smooth' });
      }
    }
  }
}, false);

// ==========================================
// UYGULAMA GÜVENLİ KAPATMA (ALT + F4 & API)
// ==========================================
function exitDesktopApp() {
  if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.close_app === 'function') {
    window.pywebview.api.close_app();
  } else {
    window.close();
  }
}
window.exitDesktopApp = exitDesktopApp;
