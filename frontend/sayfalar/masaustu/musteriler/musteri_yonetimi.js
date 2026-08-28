// -*- coding: utf-8 -*-
/**
 * Müşteri Cari, Veresiye Defteri & Tam Sayfa Ekstre JavaScript Kontrolcüsü
 */
let allCustomers = [];
let activeCustomerDetailData = null;
let activeCustomerDetailId = null;

async function loadCustomersList() {
  try {
    const res = await fetch('/api/customers');
    const data = await res.json();
    if (data.status === 'success') {
      allCustomers = data.customers || [];
      renderCustomerTable(allCustomers);
      calculateTotalCreditBalance();
    }
  } catch (err) {
    console.error("Müşteriler yüklenemedi:", err);
  }
}

function calculateTotalCreditBalance() {
  let total = 0.0;
  allCustomers.forEach(c => {
    const b = parseFloat(c.balance || 0);
    if (b > 0) total += b;
  });
  const el = document.getElementById('total-credit-balance-badge');
  if (el) {
    el.innerText = total.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL';
  }
}

function renderCustomerTable(customers) {
  const tbody = document.getElementById('customer-table-body');
  if (!tbody) return;

  if (!customers || customers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 30px; color: #64748b; font-weight: 700;">Kayıtlı veresiye / cari müşteri bulunamadı.</td></tr>`;
    return;
  }

  tbody.innerHTML = customers.map(c => {
    const bal = parseFloat(c.balance || 0);
    const balColor = bal > 0 ? '#ef4444' : (bal < 0 ? '#10b981' : '#94a3b8');
    const balText = bal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL';
    const limitText = c.credit_limit > 0 ? (c.credit_limit.toLocaleString('tr-TR') + ' TL') : 'Limitsiz';
    const txCount = (c.transactions || []).length;
    const formattedPhone = c.phone ? (typeof formatPhoneNumberString === 'function' ? formatPhoneNumberString(c.phone) : c.phone) : '-';

    return `
      <tr onclick="openCustomerDetailView('${c.id}')" style="border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer; transition: background 0.15s ease;" onmouseover="this.style.background='rgba(56,189,248,0.06)'" onmouseout="this.style.background='transparent'">
        <td style="padding: 11px 14px; font-weight: 800; color: #f8fafc;">
          <span style="color: #38bdf8; margin-right: 6px;">👤</span>
          ${c.name || '-'}
        </td>
        <td style="padding: 11px 14px; color: #38bdf8; font-family: monospace; font-weight: 700;">${formattedPhone}</td>
        <td style="padding: 11px 14px; font-weight: 900; font-family: monospace; color: ${balColor}; font-size: 13.5px;">${balText}</td>
        <td style="padding: 11px 14px; color: #94a3b8;">${limitText}</td>
        <td style="padding: 11px 14px; color: #cbd5e1; font-weight: 700;">${txCount} İşlem</td>
        <td style="padding: 11px 14px; font-size: 11.5px; color: #64748b;">${c.updated_at || c.created_at || '-'}</td>
        <td style="padding: 11px 14px; text-align: center; white-space: nowrap;" onclick="event.stopPropagation()">
          <button onclick="sendCustomerWhatsAppStatement('${c.id}')" style="background: rgba(37,211,102,0.15); border: 1px solid rgba(37,211,102,0.4); color: #25D366; padding: 5px 10px; border-radius: 6px; font-weight: 800; font-size: 11.5px; cursor: pointer; margin-right: 4px;" title="Müşteriye WhatsApp'tan Borç Ekstresi Gönder">
            💬 WhatsApp
          </button>
          <button onclick="openCustomerDetailView('${c.id}')" style="background: rgba(56,189,248,0.15); border: 1px solid #0284c7; color: #38bdf8; padding: 5px 12px; border-radius: 6px; font-weight: 800; font-size: 11.5px; cursor: pointer; margin-right: 4px;">
            📑 Detay & Ekstre
          </button>
          <button onclick="openEditCustomerModal('${c.id}')" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #cbd5e1; padding: 5px 8px; border-radius: 6px; font-weight: 800; font-size: 11px; cursor: pointer; margin-right: 4px;" title="Müşteriyi Düzenle">
            ✏️
          </button>
          <button onclick="deleteCustomerAccount('${c.id}')" style="background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.3); color: #ef4444; padding: 5px 9px; border-radius: 6px; font-weight: 800; font-size: 11.5px; cursor: pointer;" title="Müşteri Hesabını Sil">
            🗑️
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function onCustomerSearchInput(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) {
    renderCustomerTable(allCustomers);
    return;
  }
  const filtered = allCustomers.filter(c => {
    const rawP = (c.phone || '').toLowerCase();
    const cleanP = rawP.replace(/\D/g, '');
    const cleanQ = q.replace(/\D/g, '');
    return (c.name || '').toLowerCase().includes(q) || rawP.includes(q) || (cleanQ && cleanP.includes(cleanQ));
  });
  renderCustomerTable(filtered);
}

// =========================================================
// TAM SAYFA MÜŞTERİ DETAY & HESAP EKSTRESİ
// =========================================================

async function openCustomerDetailView(custId) {
  activeCustomerDetailId = custId;
  
  try {
    const res = await fetch(`/api/customers/${custId}`);
    const data = await res.json();
    if (data.status === 'success' && data.customer) {
      activeCustomerDetailData = data;
      renderCustomerDetailView(data.customer, data.summary);

      const listView = document.getElementById('customer-list-view');
      const detailView = document.getElementById('customer-detail-view');
      if (listView) listView.style.display = 'none';
      if (detailView) detailView.style.display = 'flex';
    }
  } catch (e) {
    console.error('Müşteri detayı yüklenemedi:', e);
  }
}

function closeCustomerDetailView() {
  const listView = document.getElementById('customer-list-view');
  const detailView = document.getElementById('customer-detail-view');
  if (listView) listView.style.display = 'flex';
  if (detailView) detailView.style.display = 'none';
  loadCustomersList();
}

function renderCustomerDetailView(customer, summary) {
  // Başlık Bilgileri
  const nameEl = document.getElementById('cust-det-name');
  const phoneEl = document.getElementById('cust-det-phone-badge');
  const notesEl = document.getElementById('cust-det-notes');

  const formattedPhone = customer.phone ? (typeof formatPhoneNumberString === 'function' ? formatPhoneNumberString(customer.phone) : customer.phone) : null;

  if (nameEl) nameEl.innerText = customer.name || 'Müşteri';
  if (phoneEl) phoneEl.innerText = formattedPhone ? `📞 ${formattedPhone}` : 'Telefon Yok';
  if (notesEl) notesEl.innerText = customer.notes ? `📝 ${customer.notes}` : 'Kayıtlı not bulunmuyor.';

  // 4 KPI Kartı
  const kpiDebt = document.getElementById('cust-kpi-total-debt');
  const kpiPaid = document.getElementById('cust-kpi-total-paid');
  const kpiBal = document.getElementById('cust-kpi-balance');
  const kpiLim = document.getElementById('cust-kpi-limit');

  if (kpiDebt) kpiDebt.innerText = (summary?.total_debt || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' TL';
  if (kpiPaid) kpiPaid.innerText = (summary?.total_paid || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' TL';
  
  const balance = summary?.balance || 0;
  if (kpiBal) {
    kpiBal.innerText = balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' TL';
    kpiBal.style.color = balance > 0 ? '#ef4444' : (balance < 0 ? '#10b981' : '#fbbf24');
  }

  if (kpiLim) {
    const limit = customer.credit_limit || 0;
    kpiLim.innerText = limit > 0 ? (limit.toLocaleString('tr-TR') + ' TL') : 'Limitsiz';
  }

  // İşlemler Tablosu
  const txTbody = document.getElementById('cust-detail-transactions-tbody');
  const txCountBadge = document.getElementById('cust-det-tx-count-badge');
  const txs = customer.transactions || [];

  if (txCountBadge) txCountBadge.innerText = `${txs.length} Hareket`;
  if (!txTbody) return;

  if (txs.length === 0) {
    txTbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 30px; color: #64748b;">
          Henüz kayıtlı bir veresiye alışveriş veya tahsilat hareketi bulunmuyor.
        </td>
      </tr>
    `;
    return;
  }

  txTbody.innerHTML = txs.map(tx => {
    const isDebt = tx.type === 'debt';
    const typeLabel = isDebt 
      ? '<span style="background: rgba(239,68,68,0.15); color: #f87171; padding: 2px 8px; border-radius: 4px; font-weight: 800;">🛍️ Veresiye Satış</span>'
      : `<span style="background: rgba(16,185,129,0.15); color: #34d399; padding: 2px 8px; border-radius: 4px; font-weight: 800;">💵 ${tx.payment_method || 'Nakit'} Tahsilat</span>`;
    
    const amtColor = isDebt ? '#ef4444' : '#34d399';
    const amtSign = isDebt ? '+' : '-';
    const amtText = `${amtSign}${parseFloat(tx.amount || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`;
    const newBalText = `${parseFloat(tx.new_balance || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`;

    // Alınan ürün kalemleri dökümü
    let itemsHtml = '';
    if (tx.items && tx.items.length > 0) {
      itemsHtml = `
        <div style="font-size: 11px; color: #cbd5e1; line-height: 1.4;">
          ${tx.items.map(i => `<span style="display: inline-block; background: rgba(255,255,255,0.05); padding: 1px 6px; border-radius: 3px; margin: 1px 2px;">• <strong>${i.title}</strong> (${i.quantity} ${i.unit || 'Adet'}) = ${i.total_price_str || (i.total_price + ' TL')}</span>`).join(' ')}
        </div>
      `;
    } else {
      itemsHtml = `<span style="color: #64748b; font-style: italic;">${tx.description || '-'}</span>`;
    }

    return `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: top;">
        <td style="padding: 9px 12px; font-family: monospace; color: #94a3b8; white-space: nowrap;">${tx.timestamp || '-'}</td>
        <td style="padding: 9px 12px; white-space: nowrap;">${typeLabel}</td>
        <td style="padding: 9px 12px; font-family: monospace; color: #38bdf8; font-weight: 700; white-space: nowrap;">${tx.receipt_no || '-'}</td>
        <td style="padding: 9px 12px;">${itemsHtml}</td>
        <td style="padding: 9px 12px; text-align: right; font-weight: 900; font-family: monospace; color: ${amtColor}; font-size: 12.5px; white-space: nowrap;">${amtText}</td>
        <td style="padding: 9px 12px; text-align: right; font-weight: 800; font-family: monospace; color: #fbbf24; white-space: nowrap;">${newBalText}</td>
        <td style="padding: 9px 12px; text-align: center; color: #94a3b8; font-size: 11px;">${tx.actor || 'Kasa 1'}</td>
      </tr>
    `;
  }).join('');
}

// =========================================================
// MÜŞTERİ TAHSİLAT / BORÇ MODALI İŞLEMLERİ
// =========================================================

function openCustomerPaymentDialog() {
  if (!activeCustomerDetailData?.customer) return;
  const cust = activeCustomerDetailData.customer;
  const balance = parseFloat(cust.balance || 0);

  document.getElementById('cust-pay-type').value = 'payment';
  document.getElementById('modal-cust-pay-title').innerText = `💵 Veresiye Tahsilatı Al: ${cust.name}`;
  document.getElementById('cust-pay-current-debt-text').innerText = `${balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`;
  document.getElementById('cust-pay-amount').value = balance > 0 ? balance : '';
  document.getElementById('cust-pay-desc').value = 'Veresiye Tahsilat';
  
  updateCustomerPayPreview();
  document.getElementById('modal-customer-payment-dialog').style.display = 'flex';
  setTimeout(() => document.getElementById('cust-pay-amount')?.focus(), 100);
}

function openCustomerManualDebtDialog() {
  if (!activeCustomerDetailData?.customer) return;
  const cust = activeCustomerDetailData.customer;
  const balance = parseFloat(cust.balance || 0);

  document.getElementById('cust-pay-type').value = 'debt';
  document.getElementById('modal-cust-pay-title').innerText = `➕ Manuel Borç Ekle: ${cust.name}`;
  document.getElementById('cust-pay-current-debt-text').innerText = `${balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`;
  document.getElementById('cust-pay-amount').value = '';
  document.getElementById('cust-pay-desc').value = 'Manuel Borç Kaydı';

  updateCustomerPayPreview();
  document.getElementById('modal-customer-payment-dialog').style.display = 'flex';
  setTimeout(() => document.getElementById('cust-pay-amount')?.focus(), 100);
}

function closeCustomerPaymentDialog() {
  document.getElementById('modal-customer-payment-dialog').style.display = 'none';
}

function setCustPayAmount(val) {
  document.getElementById('cust-pay-amount').value = val;
  updateCustomerPayPreview();
}

function setCustPayFullDebt() {
  const currentDebt = parseFloat(activeCustomerDetailData?.customer?.balance || 0);
  if (currentDebt > 0) {
    document.getElementById('cust-pay-amount').value = currentDebt;
    updateCustomerPayPreview();
  }
}

function updateCustomerPayPreview() {
  const currentDebt = parseFloat(activeCustomerDetailData?.customer?.balance || 0);
  const inputAmt = parseFloat(document.getElementById('cust-pay-amount')?.value) || 0;
  const isDebt = document.getElementById('cust-pay-type')?.value === 'debt';

  const newBalance = isDebt ? (currentDebt + inputAmt) : (currentDebt - inputAmt);
  const resEl = document.getElementById('cust-pay-live-calc-res');
  if (resEl) {
    resEl.innerText = `${newBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`;
    resEl.style.color = newBalance > 0 ? '#fbbf24' : (newBalance < 0 ? '#10b981' : '#34d399');
  }
}

async function submitCustomerPaymentDialog(isPdf = false) {
  if (!activeCustomerDetailId) return;
  const txType = document.getElementById('cust-pay-type')?.value || 'payment';
  const amount = parseFloat(document.getElementById('cust-pay-amount')?.value) || 0;
  const paymentMethod = document.getElementById('cust-pay-method')?.value || 'Nakit';
  const description = document.getElementById('cust-pay-desc')?.value?.trim() || (txType === 'debt' ? 'Manuel Borç' : 'Tahsilat');

  if (amount <= 0) {
    if (typeof showToast === 'function') showToast('Lütfen geçerli bir tutar giriniz.', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/customers/${activeCustomerDetailId}/transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: txType,
        amount: amount,
        payment_method: paymentMethod,
        description: description,
        actor: 'Kasa 1'
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      closeCustomerPaymentDialog();
      if (typeof showToast === 'function') showToast(`✓ ${data.message}`, 'success');

      const cust = activeCustomerDetailData?.customer;
      const now = new Date();
      const nowStr = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const oldBal = data.old_balance !== undefined ? data.old_balance : parseFloat(cust?.balance || 0);
      const newBal = data.new_balance !== undefined ? data.new_balance : (txType === 'debt' ? oldBal + amount : oldBal - amount);

      // Fiş / PDF Alma İsteği
      if (isPdf && cust && typeof printPaymentReceiptSlip === 'function') {
        printPaymentReceiptSlip({
          custName: cust.name,
          custPhone: cust.phone || '',
          amount: amount,
          payMethod: paymentMethod,
          txType: txType,
          oldBalance: oldBal,
          newBalance: newBal,
          dateStr: nowStr
        });
      }

      // WhatsApp Ödeme Makbuzu Gönderimi
      const shouldSendWhatsApp = document.getElementById('cust-pay-send-whatsapp-chk')?.checked;
      if (shouldSendWhatsApp && cust?.phone) {
        let titleText = txType === 'debt' ? '➕ *VERESİYE BORÇ EKLEME MAKBUZU*' : '🧾 *VERESİYE ÖDEME MAKBUZU* 💵';
        let amountText = txType === 'debt' ? `🔴 *Eklenen Borç:* ${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL` : `💵 *Tahsil Edilen:* ${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL (${paymentMethod})`;

        const text = `Sayın *${cust.name}*,\n\n${titleText}\n📅 *Tarih:* ${nowStr}\n${amountText}\n📊 *Önceki Bakiye:* ${oldBal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL\n💰 *GÜNCEL KALAN BORÇ:* ${newBal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL\n\n${txType === 'debt' ? 'İyi günler dileriz.' : 'Ödemeniz için teşekkür ederiz, iyi günler dileriz!'}\n🏢 *YARENLER MARKET*`;

        if (typeof sendWhatsAppUniversal === 'function') {
          sendWhatsAppUniversal(cust.phone, text);
        }
      }

      openCustomerDetailView(activeCustomerDetailId);
    } else {
      if (typeof showToast === 'function') showToast(data.message || 'Hata oluştu', 'error');
    }
  } catch (e) {
    console.error('İşlem hatası:', e);
  }
}

// Termal Ekstre Yazdırma
function printCustomerStatementThermal() {
  if (!activeCustomerDetailData?.customer) return;
  const cust = activeCustomerDetailData.customer;
  const summary = activeCustomerDetailData.summary;
  const txs = cust.transactions || [];

  const printWin = window.open('', '_blank', 'width=380,height=600');
  printWin.document.write(`
    <html>
      <head>
        <title>Müşteri Hesap Ekstresi - ${cust.name}</title>
        <style>
          body { font-family: monospace; padding: 10px; margin: 0; font-size: 11px; }
          @media print { @page { margin: 0; size: 80mm auto; } body { margin: 3mm; } }
        </style>
      </head>
      <body>
        <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
          <strong style="font-size: 14px;">MÜŞTERİ HESAP EKSTRESİ</strong>
          <div style="font-size: 12px; font-weight: bold; margin-top: 2px;">${cust.name}</div>
          <div style="font-size: 10px;">${cust.phone || ''}</div>
          <div style="font-size: 9px; color: #555;">Tarih: ${new Date().toLocaleString('tr-TR')}</div>
        </div>

        <div style="margin-bottom: 6px; font-size: 11px;">
          <div>TOPLAM ALIŞVERİŞ: <strong>${(summary?.total_debt || 0).toFixed(2)} TL</strong></div>
          <div>TOPLAM TAHSİLAT : <strong>${(summary?.total_paid || 0).toFixed(2)} TL</strong></div>
          <div style="border-top: 1px solid #000; margin-top: 4px; padding-top: 4px; font-size: 13px; font-weight: 900;">
            KALAN BAKİYE: ${(summary?.balance || 0).toFixed(2)} TL
          </div>
        </div>

        <div style="border-top: 1px dashed #000; padding-top: 6px;">
          <div style="font-weight: bold; font-size: 10px; margin-bottom: 4px;">SON HAREKETLER:</div>
          ${txs.slice(0, 10).map(t => `
            <div style="border-bottom: 1px dotted #ccc; padding: 3px 0; font-size: 9.5px;">
              <div>${t.timestamp} - <strong>${t.type === 'debt' ? 'BORÇ' : 'ÖDEME'}</strong>: ${t.amount} TL</div>
              <div style="color: #444;">${(t.items || []).map(i => i.title).join(', ') || t.description || ''}</div>
              <div style="text-align: right; font-weight: bold;">Kalan: ${t.new_balance} TL</div>
            </div>
          `).join('')}
        </div>

        <script>window.onload = function() { window.print(); window.close(); }<\/script>
      </body>
    </html>
  `);
  printWin.document.close();
}

// =========================================================
// MÜŞTERİ OLUŞTURMA / DÜZENLEME MODALI
// =========================================================

function openNewCustomerModal() {
  document.getElementById('cust-edit-id').value = '';
  document.getElementById('cust-edit-name').value = '';
  document.getElementById('cust-edit-phone').value = '';
  document.getElementById('cust-edit-limit').value = '';
  document.getElementById('cust-edit-notes').value = '';
  document.getElementById('modal-customer-title').innerText = 'Yeni Müşteri Tanımla';
  document.getElementById('modal-customer-edit').style.display = 'flex';
  setTimeout(() => document.getElementById('cust-edit-name')?.focus(), 100);
}

function openEditCustomerModal(id) {
  const cust = allCustomers.find(c => c.id === id);
  if (!cust) return;

  document.getElementById('cust-edit-id').value = cust.id;
  document.getElementById('cust-edit-name').value = cust.name || '';
  document.getElementById('cust-edit-phone').value = cust.phone ? (typeof formatPhoneNumberString === 'function' ? formatPhoneNumberString(cust.phone) : cust.phone) : '';
  document.getElementById('cust-edit-limit').value = cust.credit_limit || '';
  document.getElementById('cust-edit-notes').value = cust.notes || '';
  document.getElementById('modal-customer-title').innerText = 'Müşteri Bilgilerini Düzenle';
  document.getElementById('modal-customer-edit').style.display = 'flex';
}

function closeCustomerModal() {
  document.getElementById('modal-customer-edit').style.display = 'none';
}

async function saveCustomerForm() {
  const id = document.getElementById('cust-edit-id')?.value;
  const name = document.getElementById('cust-edit-name')?.value.trim();
  const phone = document.getElementById('cust-edit-phone')?.value.trim();
  const limit = parseFloat(document.getElementById('cust-edit-limit')?.value) || 0;
  const notes = document.getElementById('cust-edit-notes')?.value.trim();

  if (!name) {
    if (typeof showToast === 'function') showToast("Lütfen müşteri adını girin.", "warning");
    return;
  }

  try {
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: id || undefined,
        name: name,
        phone: phone,
        credit_limit: limit,
        notes: notes
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      if (typeof showToast === 'function') showToast("✓ Müşteri başarıyla kaydedildi.", "success");
      closeCustomerModal();
      loadCustomersList();
      if (activeCustomerDetailId && activeCustomerDetailId === id) {
        openCustomerDetailView(id);
      }
    }
  } catch (err) {
    console.error("Müşteri kaydedilemedi:", err);
  }
}

function formatPhoneForWhatsApp(phone) {
  if (!phone) return '';
  let clean = phone.replace(/[^0-9]/g, '');
  if (clean.startsWith('0')) clean = clean.substring(1);
  if (!clean.startsWith('90') && clean.length === 10) clean = '90' + clean;
  return clean;
}

function sendCustomerWhatsAppStatement(custId) {
  const cust = allCustomers.find(c => String(c.id) === String(custId)) || (String(activeCustomerDetailData?.customer?.id) === String(custId) ? activeCustomerDetailData.customer : null);
  if (!cust) {
    if (typeof showToast === 'function') showToast('Müşteri bulunamadı.', 'error');
    return;
  }

  const phone = formatPhoneForWhatsApp(cust.phone);
  if (!phone || phone.length < 10) {
    if (typeof showToast === 'function') {
      showToast(`⚠️ "${cust.name}" için kayıtlı geçerli bir telefon numarası bulunamadı. Lütfen düzenleyerek telefon ekleyin.`, 'warning');
    }
    return;
  }

  const balance = parseFloat(cust.balance || 0);
  const balStr = balance.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL';
  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;

  let statusMsg = '';
  if (balance > 0) {
    statusMsg = `💰 *Kalan Borç Bakiyeniz:* ${balStr}`;
  } else if (balance < 0) {
    statusMsg = `🟢 *Alacaklı Bakiyeniz:* ${balStr.replace('-', '')}`;
  } else {
    statusMsg = `✅ *Hesabınız Kapanmıştır (Borcunuz Bulunmuyor).*`;
  }

  const hostIp = window.location.hostname || '127.0.0.1';
  const text = `Sayın *${cust.name}*,\n\n📊 *MARKET VERESİYE HESAP BİLDİRİMİ*\n📅 *Tarih:* ${dateStr}\n${statusMsg}\n\nDetaylı hesap dökümünüz veya ödeme bilgisi için bizimle iletişime geçebilirsiniz.\nİyi günler dileriz.\n🏢 *YARENLER MARKET*`;

  if (typeof sendWhatsAppUniversal === 'function') {
    sendWhatsAppUniversal(cust.phone, text);
  } else {
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  }
}

function sendActiveCustomerWhatsAppStatement() {
  if (activeCustomerDetailId) {
    sendCustomerWhatsAppStatement(activeCustomerDetailId);
  }
}

async function deleteCustomerAccount(custId) {
  if (!custId) return;
  const cust = allCustomers.find(c => String(c.id) === String(custId)) || (String(activeCustomerDetailData?.customer?.id) === String(custId) ? activeCustomerDetailData.customer : null);
  if (!cust) return;

  const bal = parseFloat(cust.balance || 0);
  let confirmMsg = `"${cust.name}" isimli müşteri cari kartını ve tüm işlem geçmişini kalıcı olarak silmek istediğinize emin misiniz?`;
  if (bal > 0) {
    const balFormatted = bal.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' TL';
    confirmMsg = `⚠️ DİKKAT: "${cust.name}" müşterisinin ${balFormatted} AÇIK BORCU bulunmaktadır!\n\nBu müşteriyi ve borç bakiyesini sistemden tamamen silmek istediğinize emin misiniz?`;
  }

  const ok = typeof showCustomConfirm === 'function'
    ? await showCustomConfirm(confirmMsg, "Müşteri Kaydını Sil", "Evet, Müşteriyi Sil", "Vazgeç", "🗑️")
    : confirm(confirmMsg);

  if (!ok) return;

  try {
    const res = await fetch(`/api/customers/${custId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.status === 'success') {
      if (typeof showToast === 'function') showToast(`✓ "${cust.name}" başarıyla silindi.`, "success");
      if (activeCustomerDetailId && String(activeCustomerDetailId) === String(custId)) {
        closeCustomerDetailView();
      } else {
        loadCustomersList();
      }
    } else {
      if (typeof showToast === 'function') showToast(data.message || 'Silme işlemi gerçekleştirilemedi.', "error");
    }
  } catch (err) {
    console.error("Müşteri silinirken hata:", err);
    if (typeof showToast === 'function') showToast("Müşteri silinemedi.", "error");
  }
}

// Global Window Exports
window.loadCustomersList = loadCustomersList;
window.renderCustomerTable = renderCustomerTable;
window.onCustomerSearchInput = onCustomerSearchInput;
window.openCustomerDetailView = openCustomerDetailView;
window.closeCustomerDetailView = closeCustomerDetailView;
window.openCustomerPaymentDialog = openCustomerPaymentDialog;
window.openCustomerManualDebtDialog = openCustomerManualDebtDialog;
window.closeCustomerPaymentDialog = closeCustomerPaymentDialog;
window.setCustPayAmount = setCustPayAmount;
window.setCustPayFullDebt = setCustPayFullDebt;
window.updateCustomerPayPreview = updateCustomerPayPreview;
window.submitCustomerPaymentDialog = submitCustomerPaymentDialog;
window.printCustomerStatementThermal = printCustomerStatementThermal;
window.sendCustomerWhatsAppStatement = sendCustomerWhatsAppStatement;
window.sendActiveCustomerWhatsAppStatement = sendActiveCustomerWhatsAppStatement;
window.openNewCustomerModal = openNewCustomerModal;
window.openEditCustomerModal = openEditCustomerModal;
window.closeCustomerModal = closeCustomerModal;
window.saveCustomerForm = saveCustomerForm;
window.deleteCustomerAccount = deleteCustomerAccount;

// Sayfa veya sekme yüklendiğinde müşterileri otomatik çek
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadCustomersList);
} else {
  loadCustomersList();
}
