// -*- coding: utf-8 -*-
/**
 * VERESİYE SATIŞ & TAHSİLAT KASA ENTEGRASYONU (kasa_veresiye.js)
 */

// =========================================================
// 9.5 VERESİYE SATIŞ & TAHSİLAT KASA ENTEGRASYONU
// =========================================================
let posCreditCustomerList = [];

async function openPosCreditModal(defaultTab) {
  const totalAmt = typeof calculatePosTotal === 'function' ? calculatePosTotal() : (posCart || []).reduce((s, i) => s + (parseFloat(i.total_price) || 0), 0);
  const totalEl = document.getElementById('pos-cred-sale-total-text');
  if (totalEl) {
    totalEl.innerText = totalAmt.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL';
  }

  // Müşteri listesini yükle
  try {
    const res = await fetch('/api/customers');
    const data = await res.json();
    if (data.status === 'success') {
      posCreditCustomerList = data.customers || [];
      populatePosCreditCustomerDropdowns();
    }
  } catch (e) {
    console.error("Veresiye müşterileri yüklenemedi:", e);
  }

  const modal = document.getElementById('modal-pos-credit');
  if (modal) modal.style.display = 'flex';

  // Veresiye modalı her zaman Satış (Sepeti Veresiyeye Ekle) sekmesiyle başlar
  const targetTab = defaultTab || 'sale';
  switchPosCreditSubTab(targetTab);
}

function closePosCreditModal() {
  const modal = document.getElementById('modal-pos-credit');
  if (modal) modal.style.display = 'none';
  const quickForm = document.getElementById('pos-quick-cust-form');
  if (quickForm) quickForm.style.display = 'none';
}

function switchPosCreditSubTab(tabKey) {
  const paneSale = document.getElementById('pane-pos-cred-sale');
  const panePay = document.getElementById('pane-pos-cred-payment');
  const btnSale = document.getElementById('btn-pos-cred-tab-sale');
  const btnPay = document.getElementById('btn-pos-cred-tab-payment');

  if (tabKey === 'sale') {
    if (paneSale) paneSale.style.display = 'flex';
    if (panePay) panePay.style.display = 'none';
    if (btnSale) { btnSale.style.background = '#0284c7'; btnSale.style.color = '#fff'; }
    if (btnPay) { btnPay.style.background = 'transparent'; btnPay.style.color = '#94a3b8'; }
  } else {
    if (paneSale) paneSale.style.display = 'none';
    if (panePay) panePay.style.display = 'flex';
    if (btnPay) { btnPay.style.background = '#10b981'; btnPay.style.color = '#fff'; }
    if (btnSale) { btnSale.style.background = 'transparent'; btnSale.style.color = '#94a3b8'; }
  }
}

function populatePosCreditCustomerDropdowns() {
  const selSale = document.getElementById('pos-cred-customer-select');
  const selPay = document.getElementById('pos-tahsilat-customer-select');

  const optionsHtml = '<option value="">-- Müşteri Seçiniz --</option>' + posCreditCustomerList.map(c => {
    const bal = parseFloat(c.balance || 0);
    const balStr = bal.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' TL';
    return `<option value="${c.id}" data-name="${c.name}" data-phone="${c.phone || ''}" data-balance="${bal}" data-limit="${c.credit_limit || 0}">${c.name} (${bal > 0 ? 'Borç: ' + balStr : 'Borçsuz'})</option>`;
  }).join('');

  if (selSale) selSale.innerHTML = optionsHtml;
  if (selPay) selPay.innerHTML = optionsHtml;
}

function onPosCreditCustomerChange() {
  const sel = document.getElementById('pos-cred-customer-select');
  const opt = sel?.options[sel.selectedIndex];
  const infoBox = document.getElementById('pos-cred-cust-info-box');
  const confirmBox = document.getElementById('pos-cred-confirm-box');
  const confirmText = document.getElementById('pos-cred-confirm-text');
  const submitBtn = document.getElementById('btn-pos-submit-credit-sale');

  if (!sel || !sel.value || !opt) {
    if (infoBox) infoBox.style.display = 'none';
    if (confirmText) confirmText.innerText = 'Lütfen veresiye satışı yazmak istediğiniz müşteriyi seçiniz.';
    if (submitBtn) submitBtn.disabled = true;
    return;
  }

  const custName = opt.getAttribute('data-name') || opt.text;
  const custPhone = opt.getAttribute('data-phone') || '';
  const balance = parseFloat(opt.getAttribute('data-balance') || 0);
  const limit = parseFloat(opt.getAttribute('data-limit') || 0);
  const totalAmt = typeof calculatePosTotal === 'function' ? calculatePosTotal() : (posCart || []).reduce((s, i) => s + (parseFloat(i.total_price) || 0), 0);
  const newBalance = balance + totalAmt;

  const currDebtEl = document.getElementById('pos-cred-curr-debt');
  const currLimitEl = document.getElementById('pos-cred-curr-limit');
  if (currDebtEl) currDebtEl.innerText = balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' TL';
  if (currLimitEl) currLimitEl.innerText = limit > 0 ? (limit.toLocaleString('tr-TR') + ' TL') : 'Limitsiz';
  if (infoBox) infoBox.style.display = 'flex';

  if (confirmText) {
    confirmText.innerHTML = `
      <div style="margin-bottom: 4px;">👤 <strong>${custName}</strong> ${custPhone ? `(${custPhone})` : ''}</div>
      <div style="display: flex; justify-content: space-between; font-size: 11.5px; margin-top: 4px; border-top: 1px dashed rgba(245,158,11,0.3); padding-top: 4px;">
        <span>Önceki Borç: <strong>${balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</strong></span>
        <span>+ Satış: <strong>${totalAmt.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</strong></span>
        <span style="color: #fbbf24;">= Güncel: <strong>${newBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</strong></span>
      </div>
    `;
  }
  if (submitBtn) submitBtn.disabled = (posCart && posCart.length === 0);
}

function togglePosQuickCustomerForm() {
  const form = document.getElementById('pos-quick-cust-form');
  if (form) {
    const isHidden = form.style.display === 'none' || !form.style.display;
    form.style.display = isHidden ? 'flex' : 'none';
    if (isHidden) document.getElementById('pos-quick-cust-name')?.focus();
  }
}

async function submitQuickCustomerFromPos() {
  const name = document.getElementById('pos-quick-cust-name')?.value?.trim();
  const phone = document.getElementById('pos-quick-cust-phone')?.value?.trim() || '';

  if (!name) {
    if (typeof showToast === 'function') showToast('Lütfen müşteri adı giriniz.', 'warning');
    return;
  }

  try {
    const res = await fetch('/api/customers/quick_add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, phone: phone })
    });
    const data = await res.json();
    if (data.status === 'success') {
      if (typeof showToast === 'function') showToast(`✓ "${name}" müşterisi oluşturuldu.`, 'success');
      document.getElementById('pos-quick-cust-name').value = '';
      document.getElementById('pos-quick-cust-phone').value = '';
      togglePosQuickCustomerForm();

      // Listeyi yenile ve yeni müşteriyi seç
      const custRes = await fetch('/api/customers');
      const custData = await custRes.json();
      if (custData.status === 'success') {
        posCreditCustomerList = custData.customers || [];
        populatePosCreditCustomerDropdowns();
        const sel = document.getElementById('pos-cred-customer-select');
        if (sel) {
          sel.value = data.customer_id;
          onPosCreditCustomerChange();
        }
      }
    }
  } catch (e) {
    console.error("Hızlı müşteri oluşturulamadı:", e);
  }
}

async function submitPosCreditSale() {
  const sel = document.getElementById('pos-cred-customer-select');
  const opt = sel?.options[sel.selectedIndex];
  if (!sel || !sel.value || !opt) {
    if (typeof showToast === 'function') showToast('Lütfen veresiye yazılacak müşteriyi listeden seçiniz.', 'warning');
    return;
  }

  if (!posCart || posCart.length === 0) {
    if (typeof showToast === 'function') showToast('Sepette ürün bulunmuyor.', 'warning');
    return;
  }

  const custId = sel.value;
  const custName = opt.getAttribute('data-name') || opt.text;
  const custPhone = opt.getAttribute('data-phone') || '';
  const oldBalance = parseFloat(opt.getAttribute('data-balance') || 0);
  const grandTotal = typeof calculatePosTotal === 'function' ? calculatePosTotal() : posCart.reduce((s, i) => s + (parseFloat(i.total_price) || 0), 0);
  const newBalance = oldBalance + grandTotal;

  const shouldPrint = document.getElementById('pos-cred-print-receipt-chk')?.checked;
  const shouldSendWhatsApp = document.getElementById('pos-cred-send-whatsapp-chk')?.checked;

  const wpMsgLine = shouldSendWhatsApp
    ? (custPhone ? `💬 ${custPhone} numarasına WhatsApp bilgi fişi ve PDF gönderilecektir.` : `💬 WhatsApp seçildi ancak müşterinin telefon numarası kayıtlı değil.`)
    : `💬 WhatsApp bildirimi gönderilmeyecektir.`;

  const confirmPrompt = `Sayın "${custName}" adına ${grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL tutarında veresiye satış yazılacaktır.\n\n• Önceki Borç: ${oldBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL\n• Eklenecek Tutar: +${grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL\n• GÜNCEL TOPLAM BORÇ: ${newBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL\n\n${wpMsgLine}\n\nBu veresiye satış işlemini onaylıyor musunuz?`;

  const ok = await showCustomConfirm(
    confirmPrompt,
    'Veresiye Satış Onayı',
    'Evet, Satışı Onayla',
    'Vazgeç',
    '📒'
  );

  if (!ok) return;

  const payload = {
    customer_id: custId,
    customer_name: custName,
    payment_type: "Veresiye",
    payment_breakdown: { "Veresiye": grandTotal },
    total_amount: grandTotal,
    received_cash: 0.0,
    change_amount: 0.0,
    items: posCart
  };

  try {
    const res = await fetch(`${API_BASE}/api/pos/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.status === 'success') {
      closePosCreditModal();
      if (typeof playCashSound === 'function') playCashSound();
      if (typeof showToast === 'function') showToast(`🎉 "${custName}" veresiye satışı başarıyla tamamlandı!`, 'success');

      if (shouldPrint && typeof triggerThermalReceiptPrint === 'function') {
        triggerThermalReceiptPrint(data.receipt);
      }

      // WhatsApp ile Bilgi Fişi Gönderimi
      if (shouldSendWhatsApp && custPhone) {
        const receiptNo = data.receipt?.receipt_no || `FIS-${Date.now()}`;
        const now = new Date();
        const nowStr = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        let itemsSummary = posCart.map(i => {
          const uPrice = parseFloat(i.unit_price !== undefined ? i.unit_price : (i.price || 0));
          const tPrice = parseFloat(i.total_price !== undefined ? i.total_price : (uPrice * (parseFloat(i.quantity) || 1)));
          return `• ${i.quantity}x ${i.title || i.name} (${uPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL) -> ${tPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`;
        }).join('\n');
        if (itemsSummary.length > 500) {
          itemsSummary = itemsSummary.substring(0, 480) + '...';
        }

        const text = `Sayın *${custName}*,\n\n🛒 *YARENLER MARKET - VERESİYE SATIŞ FİŞİ* 🧾\n📅 *Tarih:* ${nowStr} • *Fiş No:* ${receiptNo}\n\n🛍️ *Alınan Ürünler:*\n${itemsSummary}\n\n💵 *Satış Tutarı:* ${grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL\n📊 *Önceki Borç:* ${oldBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL\n💰 *GÜNCEL TOPLAM BORÇ:* ${newBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL\n\n📄 *Fiş PDF Belgesi Hazırlanmıştır.*\nBizi tercih ettiğiniz için teşekkür ederiz!\n🏢 *YARENLER MARKET*`;

        if (typeof sendWhatsAppUniversal === 'function') {
          sendWhatsAppUniversal(custPhone, text, receiptNo);
        }
      }

      posCart = [];
      if (typeof renderPosCart === 'function') renderPosCart();
      if (typeof updatePosSummaryCounters === 'function') updatePosSummaryCounters();
      if (typeof loadDashboardSummary === 'function') loadDashboardSummary();
      if (document.getElementById('modal-pos-x-report')?.style.display === 'flex' && typeof openPosXReportModal === 'function') {
        openPosXReportModal();
      }
    }
  } catch (e) {
    console.error("Veresiye satışı tamamlanamadı:", e);
  }
}

// Tahsilat İşlemleri
function onPosTahsilatCustomerChange() {
  const sel = document.getElementById('pos-tahsilat-customer-select');
  const opt = sel?.options[sel.selectedIndex];
  const debtTextEl = document.getElementById('pos-tahsilat-curr-debt-text');
  const amtInp = document.getElementById('pos-tahsilat-amount-inp');

  if (!sel || !sel.value || !opt) {
    if (debtTextEl) debtTextEl.innerText = '0,00 TL';
    if (amtInp) amtInp.value = '';
    updatePosTahsilatLiveCalc();
    return;
  }

  const balance = parseFloat(opt.getAttribute('data-balance') || 0);
  if (debtTextEl) debtTextEl.innerText = balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' TL';
  if (amtInp) amtInp.value = balance > 0 ? balance : '';
  updatePosTahsilatLiveCalc();
}

function setPosTahsilatAmount(amt) {
  const inp = document.getElementById('pos-tahsilat-amount-inp');
  if (inp) {
    inp.value = amt;
    updatePosTahsilatLiveCalc();
  }
}

function setPosTahsilatFullDebt() {
  const sel = document.getElementById('pos-tahsilat-customer-select');
  const opt = sel?.options[sel.selectedIndex];
  if (!opt) return;
  const balance = parseFloat(opt.getAttribute('data-balance') || 0);
  if (balance > 0) {
    const inp = document.getElementById('pos-tahsilat-amount-inp');
    if (inp) {
      inp.value = balance;
      updatePosTahsilatLiveCalc();
    }
  }
}

function updatePosTahsilatLiveCalc() {
  const sel = document.getElementById('pos-tahsilat-customer-select');
  const opt = sel?.options[sel.selectedIndex];
  const currentDebt = opt ? parseFloat(opt.getAttribute('data-balance') || 0) : 0;
  const payAmt = parseFloat(document.getElementById('pos-tahsilat-amount-inp')?.value) || 0;

  const remaining = currentDebt - payAmt;
  const resEl = document.getElementById('pos-tahsilat-calc-res');
  if (resEl) {
    resEl.innerText = `${remaining.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`;
    resEl.style.color = remaining > 0 ? '#fbbf24' : (remaining < 0 ? '#10b981' : '#34d399');
  }
}

async function submitPosTahsilat(isPdf = false) {
  const sel = document.getElementById('pos-tahsilat-customer-select');
  const opt = sel?.options[sel.selectedIndex];
  if (!sel || !sel.value || !opt) {
    if (typeof showToast === 'function') showToast('Lütfen tahsilat yapılacak müşteriyi seçiniz.', 'warning');
    return;
  }

  const custId = sel.value;
  const custName = opt.getAttribute('data-name') || opt.text;
  const custPhone = opt.getAttribute('data-phone') || '';
  const amount = parseFloat(document.getElementById('pos-tahsilat-amount-inp')?.value) || 0;
  const payMethod = document.querySelector('input[name="pos-tahsilat-method"]:checked')?.value || 'Nakit';
  const shouldSendWhatsApp = document.getElementById('pos-tahsilat-send-whatsapp-chk')?.checked;

  if (amount <= 0) {
    if (typeof showToast === 'function') showToast('Lütfen geçerli bir tahsilat tutarı giriniz.', 'warning');
    return;
  }

  try {
    const res = await fetch(`/api/customers/${custId}/transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'payment',
        amount: amount,
        payment_method: payMethod,
        description: `Hızlı Kasa ${payMethod} Tahsilat`,
        actor: 'Kasiyer'
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      closePosCreditModal();
      if (typeof playCashSound === 'function') playCashSound();
      if (typeof showToast === 'function') {
        showToast(`✓ ${custName} kişisinden ${amount.toFixed(2)} TL tahsil edildi! Kalan Borç: ${(data.new_balance || 0).toFixed(2)} TL`, 'success');
      }

      const now = new Date();
      const nowStr = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const oldBal = data.old_balance !== undefined ? data.old_balance : parseFloat(opt.getAttribute('data-balance') || 0);
      const newBal = data.new_balance !== undefined ? data.new_balance : (oldBal - amount);

      // Fiş / PDF Alma İsteği
      if (isPdf && typeof printPaymentReceiptSlip === 'function') {
        printPaymentReceiptSlip({
          custName: custName,
          custPhone: custPhone,
          amount: amount,
          payMethod: payMethod,
          txType: 'payment',
          oldBalance: oldBal,
          newBalance: newBal,
          dateStr: nowStr
        });
      }

      // WhatsApp ile Ödeme Makbuzu Gönderimi
      if (shouldSendWhatsApp && custPhone) {
        const text = `Sayın *${custName}*,\n\n🧾 *VERESİYE ÖDEME MAKBUZU* 💵\n📅 *Tarih:* ${nowStr}\n💳 *Ödeme Yöntemi:* ${payMethod}\n💵 *Tahsil Edilen:* ${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL\n📊 *Önceki Borç:* ${oldBal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL\n💰 *KALAN GÜNCEL BORÇ:* ${newBal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL\n\nÖdemeniz başarıyla hesabınıza işlenmiştir.\nBizi tercih ettiğiniz için teşekkür ederiz!\n🏢 *YARENLER MARKET*`;

        if (typeof sendWhatsAppUniversal === 'function') {
          sendWhatsAppUniversal(custPhone, text);
        }
      }

      if (typeof loadDashboardSummary === 'function') loadDashboardSummary();
    } else {
      if (typeof showToast === 'function') showToast(data.message || 'Tahsilat hatası', 'error');
    }
  } catch (e) {
    console.error("Tahsilat kaydedilemedi:", e);
  }
}

