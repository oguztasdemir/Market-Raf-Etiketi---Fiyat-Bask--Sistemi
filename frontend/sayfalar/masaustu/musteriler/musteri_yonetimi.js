// -*- coding: utf-8 -*-
/**
 * Müşteri Cari & Veresiye Defteri JavaScript Kontrolcüsü
 */
let allCustomers = [];
let activeStatementCustId = null;

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
    total += parseFloat(c.balance || 0);
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
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 30px; color: #64748b; font-weight: 700;">Kayıtlı veresiye / cari müşteri bulunamadı.</td></tr>`;
    return;
  }

  tbody.innerHTML = customers.map(c => {
    const bal = parseFloat(c.balance || 0);
    const balColor = bal > 0 ? '#ef4444' : (bal < 0 ? '#10b981' : '#94a3b8');
    const balText = bal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL';
    const limitText = c.credit_limit > 0 ? (c.credit_limit.toLocaleString('tr-TR') + ' TL') : 'Limitsiz';

    return `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">
        <td style="padding: 10px 14px; font-weight: 800; color: #f8fafc;">${c.name || '-'}</td>
        <td style="padding: 10px 14px; color: #94a3b8;">${c.phone || '-'}</td>
        <td style="padding: 10px 14px; font-weight: 900; color: ${balColor};">${balText}</td>
        <td style="padding: 10px 14px; color: #94a3b8;">${limitText}</td>
        <td style="padding: 10px 14px; font-size: 11.5px; color: #64748b;">${c.updated_at || c.created_at || '-'}</td>
        <td style="padding: 10px 14px; text-align: center;">
          <button onclick="openCustomerStatementModal('${c.id}')" style="background: rgba(56,189,248,0.15); border: 1px solid #0284c7; color: #38bdf8; padding: 4px 10px; border-radius: 6px; font-weight: 800; font-size: 11px; cursor: pointer; margin-right: 4px;">📑 Ekstre & Tahsilat</button>
          <button onclick="openEditCustomerModal('${c.id}')" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #cbd5e1; padding: 4px 8px; border-radius: 6px; font-weight: 800; font-size: 11px; cursor: pointer;">✏️ Düzenle</button>
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
    return (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q);
  });
  renderCustomerTable(filtered);
}

function openNewCustomerModal() {
  document.getElementById('cust-edit-id').value = '';
  document.getElementById('cust-edit-name').value = '';
  document.getElementById('cust-edit-phone').value = '';
  document.getElementById('cust-edit-limit').value = '';
  document.getElementById('cust-edit-notes').value = '';
  document.getElementById('modal-customer-title').innerText = 'Yeni Müşteri Tanımla';
  document.getElementById('modal-customer-edit').style.display = 'flex';
}

function openEditCustomerModal(id) {
  const cust = allCustomers.find(c => c.id === id);
  if (!cust) return;

  document.getElementById('cust-edit-id').value = cust.id;
  document.getElementById('cust-edit-name').value = cust.name || '';
  document.getElementById('cust-edit-phone').value = cust.phone || '';
  document.getElementById('cust-edit-limit').value = cust.credit_limit || '';
  document.getElementById('cust-edit-notes').value = cust.notes || '';
  document.getElementById('modal-customer-title').innerText = 'Müşteri Bilgilerini Düzenle';
  document.getElementById('modal-customer-edit').style.display = 'flex';
}

function closeCustomerModal() {
  document.getElementById('modal-customer-edit').style.display = 'none';
}

async function saveCustomerForm() {
  const id = document.getElementById('cust-edit-id').value;
  const name = document.getElementById('cust-edit-name').value.trim();
  const phone = document.getElementById('cust-edit-phone').value.trim();
  const limit = parseFloat(document.getElementById('cust-edit-limit').value) || 0.0;
  const notes = document.getElementById('cust-edit-notes').value.trim();

  if (!name) {
    alert("Lütfen müşteri adını girin.");
    return;
  }

  try {
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name, phone, credit_limit: limit, notes })
    });
    const data = await res.json();
    if (data.status === 'success') {
      closeCustomerModal();
      await loadCustomersList();
    } else {
      alert("Hata: " + (data.message || 'Müşteri kaydedilemedi.'));
    }
  } catch (err) {
    alert("Sunucu bağlantı hatası!");
  }
}

function openCustomerStatementModal(id) {
  const cust = allCustomers.find(c => c.id === id);
  if (!cust) return;

  activeStatementCustId = id;
  document.getElementById('statement-cust-name').innerText = cust.name || '-';
  document.getElementById('statement-cust-phone').innerText = cust.phone ? `Telefon: ${cust.phone}` : 'Telefon Belirtilmedi';
  
  const bal = parseFloat(cust.balance || 0);
  const balEl = document.getElementById('statement-current-balance');
  balEl.innerText = bal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL';
  balEl.style.color = bal > 0 ? '#ef4444' : (bal < 0 ? '#10b981' : '#94a3b8');

  document.getElementById('quick-payment-amount').value = '';

  const txListEl = document.getElementById('statement-transactions-list');
  const txs = cust.transactions || [];
  if (txs.length === 0) {
    txListEl.innerHTML = `<div style="text-align: center; color: #64748b; padding: 14px; font-size: 11.5px;">Henüz hesap hareketi bulunmuyor.</div>`;
  } else {
    txListEl.innerHTML = txs.map(t => {
      const isDebt = t.type === 'debt';
      const color = isDebt ? '#f87171' : '#4ade80';
      const sign = isDebt ? '+' : '-';
      return `
        <div style="background: rgba(30,41,59,0.7); border-radius: 6px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; font-size: 12px;">
          <div>
            <strong style="color: #f8fafc;">${t.description || (isDebt ? 'Veresiye Satış' : 'Tahsilat')}</strong>
            <div style="font-size: 10.5px; color: #64748b;">${t.timestamp} | ${t.actor || 'Kasiyer'} ${t.receipt_no ? `| Fiş #${t.receipt_no}` : ''}</div>
          </div>
          <div style="text-align: right;">
            <strong style="color: ${color}; font-size: 13px;">${sign}${parseFloat(t.amount || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</strong>
            <div style="font-size: 10.5px; color: #94a3b8;">Bakiye: ${parseFloat(t.new_balance || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</div>
          </div>
        </div>
      `;
    }).join('');
  }

  document.getElementById('modal-customer-statement').style.display = 'flex';
}

function closeCustomerStatementModal() {
  document.getElementById('modal-customer-statement').style.display = 'none';
  activeStatementCustId = null;
}

async function executeCustomerPayment() {
  if (!activeStatementCustId) return;
  const amt = parseFloat(document.getElementById('quick-payment-amount').value);
  if (!amt || amt <= 0) {
    alert("Lütfen geçerli bir tahsilat tutarı girin.");
    return;
  }

  try {
    const res = await fetch(`/api/customers/${activeStatementCustId}/transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'payment', amount: amt, description: 'Nakit Tahsilat' })
    });
    const data = await res.json();
    if (data.status === 'success') {
      await loadCustomersList();
      openCustomerStatementModal(activeStatementCustId);
    } else {
      alert("Hata: " + data.message);
    }
  } catch (err) {
    alert("İşlem kaydedilemedi!");
  }
}

async function executeCustomerNewDebt() {
  if (!activeStatementCustId) return;
  const amt = parseFloat(document.getElementById('quick-payment-amount').value);
  if (!amt || amt <= 0) {
    alert("Lütfen geçerli bir borç tutarı girin.");
    return;
  }

  try {
    const res = await fetch(`/api/customers/${activeStatementCustId}/transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'debt', amount: amt, description: 'Veresiye Satış Borcu' })
    });
    const data = await res.json();
    if (data.status === 'success') {
      await loadCustomersList();
      openCustomerStatementModal(activeStatementCustId);
    } else {
      alert("Hata: " + data.message);
    }
  } catch (err) {
    alert("İşlem kaydedilemedi!");
  }
}

// Sekme açıldığında yükle
document.addEventListener('DOMContentLoaded', () => {
  loadCustomersList();
});
