// -*- coding: utf-8 -*-
/**
 * ETİKET EDİTÖRÜ MODALLARI & ŞABLON CRUD MOTORU (etiket_tasarim_editoru.js)
 */

function createNewTemplate() {
  openNewModelModal();
}

function openNewModelModal() {
  const inp = document.getElementById('modal-inp-tpl-name');
  if (inp) inp.value = '';
  if (typeof openUniversalModal === 'function') {
    openUniversalModal('modal-new-template');
  } else {
    const modal = document.getElementById('modal-new-template');
    if (modal) modal.style.display = 'flex';
  }
  if (inp) setTimeout(() => inp.focus(), 80);
}

function closeNewModelModal() {
  if (typeof closeUniversalModal === 'function') {
    closeUniversalModal('modal-new-template');
  } else {
    const modal = document.getElementById('modal-new-template');
    if (modal) modal.style.display = 'none';
  }
}

async function submitNewModelModal() {
  const inp = document.getElementById('modal-inp-tpl-name');
  const name = inp ? inp.value.trim() : '';
  if (!name) {
    if (typeof showToast === 'function') showToast('Lütfen bir model adı girin.', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/templates/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        name: name,
        description: `Özel oluşturulan ${name} etiketi.`
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      if (typeof showToast === 'function') showToast(`✨ "${name}" modeli başarıyla oluşturuldu.`, 'success');
      closeNewModelModal();
      await loadTemplates();
      if (data.template && data.template.id) {
        selectAndEditTemplate(data.template.id);
      }
    } else {
      if (typeof showToast === 'function') showToast(`⚠️ ${data.message || 'Model oluşturulamadı'}`, 'error');
    }
  } catch (e) {
    closeNewModelModal();
    if (typeof showToast === 'function') showToast('Model oluşturulamadı.', 'error');
  }
}

async function duplicateCurrentTemplate() {
  const tplId = editingTemplateId || 'default';
  await duplicateTemplateById(tplId);
}

async function duplicateTemplateById(sourceTplId) {
  const sourceTpl = templatesList.find(t => t.id === sourceTplId);
  const srcName = sourceTpl ? sourceTpl.name : 'Model';
  
  try {
    const res = await fetch(`${API_BASE}/api/templates/${sourceTplId}/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${srcName} (Kopya)`
      })
    });
    const data = await res.json();
    if (data.status === 'success' && data.template) {
      if (typeof showToast === 'function') {
        showToast(`📋 "${data.template.name}" tasarımı kopyalandı ve düzenlemeye hazır!`, 'success');
      }
      await loadTemplates();
      selectAndEditTemplate(data.template.id);
    } else {
      if (typeof showToast === 'function') {
        showToast(`⚠️ ${data.message || 'Kopyalama işlemi başarısız.'}`, 'error');
      }
    }
  } catch (e) {
    if (typeof showToast === 'function') {
      showToast('Tasarım kopyalanırken bir hata oluştu.', 'error');
    }
  }
}

// =========================================================
// BİLGİ FİŞİ TASARIM STÜDYOSU (2. PANEL)
// =========================================================

function switchDesignStudioTab(tabKey) {
  const btnLabel = document.getElementById('btn-subtab-design-label');
  const btnReceipt = document.getElementById('btn-subtab-design-receipt');
  const paneLabel = document.getElementById('pane-design-label');
  const paneReceipt = document.getElementById('pane-design-receipt');

  if (tabKey === 'receipt') {
    if (btnReceipt) {
      btnReceipt.className = 'btn-primary';
      btnReceipt.style.background = '#0284c7';
      btnReceipt.style.color = '#fff';
    }
    if (btnLabel) {
      btnLabel.className = 'btn-secondary';
      btnLabel.style.background = 'transparent';
      btnLabel.style.color = '#94a3b8';
    }
    if (paneReceipt) paneReceipt.style.display = 'grid';
    if (paneLabel) paneLabel.style.display = 'none';
    loadReceiptDesignSettings();
  } else {
    if (btnLabel) {
      btnLabel.className = 'btn-primary';
      btnLabel.style.background = '#0284c7';
      btnLabel.style.color = '#fff';
    }
    if (btnReceipt) {
      btnReceipt.className = 'btn-secondary';
      btnReceipt.style.background = 'transparent';
      btnReceipt.style.color = '#94a3b8';
    }
    if (paneLabel) paneLabel.style.display = 'grid';
    if (paneReceipt) paneReceipt.style.display = 'none';
    updateEditorPreview();
  }
}

async function loadReceiptDesignSettings() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    if (data.status === 'success' && data.settings) {
      const s = data.settings;
      if (document.getElementById('rec-design-paper-width')) document.getElementById('rec-design-paper-width').value = s.receipt_paper_width || '80mm';
      if (document.getElementById('rec-design-market-name')) document.getElementById('rec-design-market-name').value = s.market_name || '';
      if (document.getElementById('rec-design-branch')) document.getElementById('rec-design-branch').value = s.branch_name || 'Merkez Şube';
      if (document.getElementById('rec-design-phone')) document.getElementById('rec-design-phone').value = s.phone || '';
      if (document.getElementById('rec-design-address')) document.getElementById('rec-design-address').value = s.address || '';
      if (document.getElementById('rec-design-tax-office')) document.getElementById('rec-design-tax-office').value = s.tax_office || '';
      if (document.getElementById('rec-design-tax-no')) document.getElementById('rec-design-tax-no').value = s.tax_no || '';
      if (document.getElementById('rec-design-footer-note')) document.getElementById('rec-design-footer-note').value = s.receipt_footer_note || 'Bizi tercih ettiğiniz için teşekkür ederiz. İyi günler dileriz!';
      if (document.getElementById('rec-design-vat-mode')) document.getElementById('rec-design-vat-mode').value = s.receipt_vat_mode || 'INCLUSIVE';
      if (document.getElementById('rec-design-show-item-vat')) document.getElementById('rec-design-show-item-vat').checked = s.receipt_show_item_vat !== false;
      if (document.getElementById('rec-design-show-kdv')) document.getElementById('rec-design-show-kdv').checked = s.receipt_show_kdv !== false;
      if (document.getElementById('rec-design-show-qr')) document.getElementById('rec-design-show-qr').checked = s.receipt_show_qr !== false;
      updateReceiptPreviewLive();
    }
  } catch (e) {}
}

function updateReceiptPreviewLive() {
  const paperWidth = document.getElementById('rec-design-paper-width')?.value || '80mm';
  const marketName = document.getElementById('rec-design-market-name')?.value?.trim() || 'YARENLER MARKET';
  const branch = document.getElementById('rec-design-branch')?.value?.trim() || 'Merkez Şube';
  const phone = document.getElementById('rec-design-phone')?.value?.trim() || '';
  const address = document.getElementById('rec-design-address')?.value?.trim() || '';
  const taxOffice = document.getElementById('rec-design-tax-office')?.value?.trim() || '';
  const taxNo = document.getElementById('rec-design-tax-no')?.value?.trim() || '';
  const footerNote = document.getElementById('rec-design-footer-note')?.value?.trim() || 'Bizi tercih ettiğiniz için teşekkür ederiz!';
  const vatMode = document.getElementById('rec-design-vat-mode')?.value || 'INCLUSIVE';
  const showItemVat = document.getElementById('rec-design-show-item-vat')?.checked !== false;
  const showKdv = document.getElementById('rec-design-show-kdv')?.checked !== false;
  const showQr = document.getElementById('rec-design-show-qr')?.checked !== false;

  const paperEl = document.getElementById('receipt-live-paper');
  const badgeEl = document.getElementById('rec-preview-paper-badge');
  if (paperEl) {
    paperEl.style.width = paperWidth === '58mm' ? '260px' : '340px';
    paperEl.style.fontSize = paperWidth === '58mm' ? '10px' : '11.5px';
  }
  if (badgeEl) badgeEl.innerText = `${paperWidth} Termal Kağıt`;

  const mNameEl = document.getElementById('rec-prev-market-name');
  if (mNameEl) mNameEl.innerText = marketName.toUpperCase();

  const brEl = document.getElementById('rec-prev-branch');
  if (brEl) brEl.innerText = branch;

  const adEl = document.getElementById('rec-prev-address');
  if (adEl) {
    adEl.innerText = address;
    adEl.style.display = address ? 'block' : 'none';
  }

  const phEl = document.getElementById('rec-prev-phone');
  if (phEl) {
    phEl.innerText = phone ? `Tel: ${phone}` : '';
    phEl.style.display = phone ? 'block' : 'none';
  }

  const txEl = document.getElementById('rec-prev-tax');
  if (txEl) {
    const taxText = (taxOffice || taxNo) ? `V.D: ${taxOffice || '-'} • V.No: ${taxNo || '-'}` : '';
    txEl.innerText = taxText;
    txEl.style.display = taxText ? 'block' : 'none';
  }

  const fnEl = document.getElementById('rec-prev-footer-note');
  if (fnEl) fnEl.innerText = footerNote;

  const qrEl = document.getElementById('rec-prev-qr-area');
  if (qrEl) qrEl.style.display = showQr ? 'block' : 'none';

  // 1. Örnek Ürün Kalemleri
  const sampleItems = [
    { title: "ÜLKER PİKO PORTAKAL 18G", qty: "2 Ad", unit_price: 10.00, total: 20.00 },
    { title: "SÜTAŞ SÜT 1 LT TAM YAĞLI", qty: "1 Ad", unit_price: 36.50, total: 36.50 },
    { title: "YERLİ DOMATES SALÇALIK (PLU 1)", qty: "1.450 Kg", unit_price: 30.00, total: 43.50 }
  ];

  const tbody = document.getElementById('rec-prev-items-tbody');
  if (tbody) {
    tbody.innerHTML = sampleItems.map(it => `
      <tr style="border-bottom: 1px solid rgba(0,0,0,0.06);">
        <td style="padding: 3px 0; word-break: break-word; font-weight: 600;">${it.title}</td>
        <td style="text-align: center; padding: 3px 0; font-family: monospace;">${it.qty}</td>
        <td style="text-align: right; padding: 3px 0; color: #475569; font-family: monospace;">${it.unit_price.toFixed(2).replace('.', ',')}</td>
        <td style="text-align: right; font-weight: 800; padding: 3px 0; font-family: monospace;">${it.total.toFixed(2).replace('.', ',')}</td>
      </tr>
    `).join('');
  }

  // 2. Toplam Hesaplamaları (KDV ve Ödeme Türü Kaldırılmış Sade Bilgi Fişi)
  const totalVal = document.getElementById('rec-prev-total-val');
  if (totalVal) totalVal.innerText = "100,00 TL";
}

async function saveReceiptDesignSettings() {
  const payload = {
    receipt_paper_width: document.getElementById('rec-design-paper-width')?.value || '80mm',
    market_name: document.getElementById('rec-design-market-name')?.value?.trim() || 'YARENLER MARKET',
    branch_name: document.getElementById('rec-design-branch')?.value?.trim() || 'Merkez Şube',
    phone: document.getElementById('rec-design-phone')?.value?.trim() || '',
    address: document.getElementById('rec-design-address')?.value?.trim() || '',
    tax_office: document.getElementById('rec-design-tax-office')?.value?.trim() || '',
    tax_no: document.getElementById('rec-design-tax-no')?.value?.trim() || '',
    receipt_footer_note: document.getElementById('rec-design-footer-note')?.value?.trim() || '',
    receipt_vat_mode: document.getElementById('rec-design-vat-mode')?.value || 'INCLUSIVE',
    receipt_show_item_vat: document.getElementById('rec-design-show-item-vat')?.checked !== false,
    receipt_show_kdv: document.getElementById('rec-design-show-kdv')?.checked !== false,
    receipt_show_qr: document.getElementById('rec-design-show-qr')?.checked !== false
  };

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.status === 'success') {
      if (typeof showToast === 'function') showToast('✓ Bilgi fişi KDV ve şablon ayarları başarıyla kaydedildi!', 'success');
    } else {
      if (typeof showToast === 'function') showToast(`❌ Hata: ${data.message}`, 'error');
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast('Fiş ayarları kaydedilemedi.', 'error');
  }
}

async function printReceiptDesignTest() {
  const paper = document.getElementById('receipt-live-paper');
  if (!paper) return;
  
  const selectedPrinter = document.getElementById('studio-receipt-printer-select')?.value || 'Termal Etiket Yazici';
  if (typeof showToast === 'function') showToast(`🧾 '${selectedPrinter}' yazıcısına test bilgi fişi gönderiliyor...`, 'info');

  try {
    const res = await fetch(`${API_BASE}/api/devices/test_receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        printer_name: selectedPrinter
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      if (typeof showToast === 'function') showToast(`✓ ${data.message}`, 'success');
      return;
    } else {
      if (typeof showToast === 'function') showToast(`⚠️ ${data.message || 'Yazıcı yanıt vermedi'}`, 'warning');
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('Yazıcıya ulaşılamadı.', 'error');
  }

  // Fallback: Tarayıcı baskı penceresi
  const paperWidth = document.getElementById('rec-design-paper-width')?.value || '80mm';
  const printWin = window.open('', '_blank', 'width=380,height=600');
  printWin.document.write(`
    <html>
      <head>
        <title>Bilgi Fişi Test Baskısı</title>
        <style>
          body { font-family: monospace; padding: 10px; margin: 0; font-size: 11px; }
          @media print { @page { margin: 0; size: ${paperWidth === '58mm' ? '58mm' : '80mm'} auto; } body { margin: 3mm; } }
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

function populateStudioPrintersDropdown(discoveredPrinters, selectedLabel, selectedReceipt) {
  const lblSelect = document.getElementById('studio-active-printer-select');
  const recSelect = document.getElementById('studio-receipt-printer-select');

  let printers = [];
  if (Array.isArray(discoveredPrinters)) {
    printers = discoveredPrinters;
  }

  if (printers.length === 0) {
    printers = [{ name: 'Termal Etiket Yazici', port: 'USB001', status_text: '🟢 Hazır' }];
  }

  const generateOptions = (currentSelected) => {
    return printers.map(p => {
      const pName = typeof p === 'string' ? p : p.name;
      const port = (typeof p === 'object' && p.port) ? ` [${p.port}]` : '';
      const isSel = (pName === currentSelected);
      const isReady = (typeof p === 'object' && p.status_text && p.status_text.includes('Hazır'));
      const dot = isReady ? '🟢' : '🟡';
      return `<option value="${pName}" ${isSel ? 'selected' : ''}>${dot} ${pName}${port}</option>`;
    }).join('');
  };

  if (lblSelect) {
    lblSelect.innerHTML = generateOptions(selectedLabel);
  }
  if (recSelect) {
    recSelect.innerHTML = generateOptions(selectedReceipt);
  }
}

async function onStudioPrinterSelected(printerName) {
  if (!printerName) return;

  try {
    await fetch(`${API_BASE}/api/devices/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label_printer: { name: printerName, connection_type: 'usb' }
      })
    });
    await checkDesignStudioPrintersStatus();
    if (typeof showToast === 'function') {
      showToast(`🖨️ Etiket yazıcısı '${printerName}' olarak ayarlandı!`, 'success');
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('Yazıcı seçimi kaydedilemedi.', 'error');
  }
}

async function onStudioReceiptPrinterSelected(printerName) {
  if (!printerName) return;
  const receiptDot = document.getElementById('receipt-printer-dot');
  const receiptText = document.getElementById('receipt-printer-status-text');

  try {
    const res = await fetch(`${API_BASE}/api/devices/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receipt_printer: { name: printerName, connection_type: 'usb' }
      })
    });
    const data = await res.json();
    if (receiptDot) receiptDot.innerText = '🟢';
    if (receiptText) {
      receiptText.innerText = `'${printerName}' seçildi ve hazır`;
      receiptText.style.color = '#34d399';
    }
    if (typeof showToast === 'function') {
      showToast(`🧾 Bilgi fişi yazıcısı '${printerName}' olarak ayarlandı!`, 'success');
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('Fiş yazıcısı seçimi kaydedilemedi.', 'error');
  }
}

function onStudioLabelSizeChange(sizeClass) {
  const canvas = document.getElementById('editor-shelf-label');
  if (!canvas) return;

  // Eski boyut sınıflarını temizle
  canvas.classList.remove('size-60x40', 'size-40x20', 'size-80x40', 'size-100x50', 'size-76x40');
  canvas.classList.add(sizeClass);

  if (typeof showToast === 'function') {
    const sizeName = sizeClass.replace('size-', '').replace('x', ' × ') + ' mm';
    showToast(`📐 Etiket ebadı ${sizeName} olarak güncellendi.`, 'info');
  }
}

function onStudioPriceSizeChange(val) {
  const lbl = document.getElementById('studio-price-size-val');
  const priceEl = document.getElementById('editor-lbl-price');
  if (lbl) lbl.innerText = `${val}px`;
  if (priceEl) priceEl.style.fontSize = `${val}px`;
}

function onStudioTitleSizeChange(val) {
  const lbl = document.getElementById('studio-title-size-val');
  const t1 = document.getElementById('editor-lbl-title-1');
  const t2 = document.getElementById('editor-lbl-title-2');
  if (lbl) lbl.innerText = `${val}px`;
  if (t1) t1.style.fontSize = `${val}px`;
  if (t2) t2.style.fontSize = `${Math.max(9, val - 2)}px`;
}

function toggleStudioElement(elemType, isVisible) {
  if (elemType === 'barcode') {
    const el = document.querySelector('.ml-barcode-col');
    if (el) el.style.display = isVisible ? 'flex' : 'none';
  } else if (elemType === 'unit-price') {
    const el = document.querySelector('.ml-divider-col');
    if (el) el.style.display = isVisible ? 'flex' : 'none';
  } else if (elemType === 'origin') {
    const el = document.getElementById('editor-lbl-origin');
    if (el && el.parentElement) el.parentElement.style.display = isVisible ? 'block' : 'none';
  } else if (elemType === 'date') {
    const el = document.getElementById('editor-lbl-date');
    if (el && el.parentElement) el.parentElement.style.display = isVisible ? 'block' : 'none';
  }
}

function onStudioTopRightChange(mode) {
  const box = document.getElementById('editor-lbl-top-right-box');
  if (!box) return;

  if (mode === 'empty') {
    box.style.display = 'none';
    box.innerHTML = '';
  } else if (mode === 'discount') {
    box.style.display = 'flex';
    box.innerHTML = '<div style="background:#ef4444; color:#fff; font-weight:900; padding:2px 6px; border-radius:4px; font-size:10.5px; box-shadow: 0 2px 6px rgba(239,68,68,0.4);">🔥 İNDİRİM</div>';
  } else if (mode === 'custom_text') {
    box.style.display = 'flex';
    box.innerHTML = '<div style="background:#0284c7; color:#fff; font-weight:800; padding:2px 6px; border-radius:4px; font-size:10px;">SÜPER FİYAT</div>';
  } else if (mode === 'qr') {
    box.style.display = 'flex';
    box.innerHTML = '<div style="background:#fff; color:#000; padding:2px 4px; border-radius:4px; font-size:11px; font-weight:bold;">📱 QR</div>';
  }
}

async function checkDesignStudioPrintersStatus() {
  try {
    const [devRes, setRes] = await Promise.all([
      fetch(`${API_BASE}/api/devices`),
      fetch(`${API_BASE}/api/settings`)
    ]);
    const devData = await devRes.json();
    const setData = await setRes.json();

    const installedPrinters = (devData.status === 'success' && (devData.printer_details || devData.printers)) ? (devData.printer_details || devData.printers) : [];
    const settings = (setData.status === 'success' && setData.settings) ? setData.settings : {};

    // 1. Termal Etiket Yazıcısı (Label Printer)
    const labelPrinterName = settings.printer || devData.selected_printer || (installedPrinters.length > 0 ? (installedPrinters[0].name || installedPrinters[0]) : 'Termal Etiket Yazici');
    const receiptPrinterName = settings.receipt_printer || devData.selected_receipt_printer || 'Termal Etiket Yazici';

    // Seçili yazıcının gerçek durumunu bul
    const activeLabelObj = (devData.printer_details || []).find(p => p.name === labelPrinterName);
    const isLabelOnline = activeLabelObj ? (activeLabelObj.is_online && !activeLabelObj.is_offline) : false;

    const labelDot = document.getElementById('label-printer-dot');
    const labelText = document.getElementById('label-printer-status-text');
    const labelBtn = document.getElementById('btn-studio-test-print');

    if (labelDot) labelDot.innerText = isLabelOnline ? '🟢' : '🔴';
    if (labelText) {
      if (isLabelOnline) {
        labelText.innerText = 'Bağlı / Hazır';
        labelText.style.color = '#34d399';
      } else {
        labelText.innerText = 'Çevrimdışı (Cihaz Takılı Değil)';
        labelText.style.color = '#f87171';
      }
    }
    if (labelBtn) {
      labelBtn.disabled = !isLabelOnline;
      labelBtn.style.opacity = isLabelOnline ? '1' : '0.6';
      labelBtn.title = isLabelOnline ? `'${labelPrinterName}' yazıcısına test etiketi gönder` : `'${labelPrinterName}' bağlı değil`;
    }

    const activeRecObj = (devData.printer_details || []).find(p => p.name === receiptPrinterName);
    const isRecOnline = activeRecObj ? (activeRecObj.is_online && !activeRecObj.is_offline) : false;

    const receiptDot = document.getElementById('receipt-printer-dot');
    const receiptText = document.getElementById('receipt-printer-status-text');
    if (receiptDot) receiptDot.innerText = isRecOnline ? '🟢' : '🔴';
    if (receiptText) {
      if (isRecOnline) {
        receiptText.innerText = 'Bağlı / Hazır';
        receiptText.style.color = '#34d399';
      } else {
        receiptText.innerText = 'Çevrimdışı (Cihaz Takılı Değil)';
        receiptText.style.color = '#f87171';
      }
    }

  } catch (err) {
    console.error("Yazıcı durumu kontrol edilirken hata:", err);
  }
}

async function printStudioTestLabel() {
  const btn = document.getElementById('btn-studio-test-print');
  if (btn) {
    btn.disabled = true;
    btn.innerText = 'Basılıyor...';
  }

  const sampleData = {
    barcode: "8690504033288",
    title1: document.getElementById('editor-lbl-title-1')?.innerText || "ULK 398-6 PIKO PORTAKAL",
    title2: document.getElementById('editor-lbl-title-2')?.innerText || "PIR PAT KAP",
    brand: document.getElementById('editor-lbl-brand')?.innerText || "ULKER",
    price: "25,00 TL",
    origin: document.getElementById('editor-lbl-origin')?.innerText || "TURKIYE",
    date: document.getElementById('editor-lbl-date')?.innerText || new Date().toLocaleDateString('tr-TR')
  };

  try {
    const setRes = await fetch(`${API_BASE}/api/settings`);
    const setData = await setRes.json();
    const settings = setData.settings || {};
    const printer = settings.printer || "Termal Etiket Yazici";

    const res = await fetch(`${API_BASE}/api/print/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        printer: printer,
        width_mm: settings.width_mm || 76,
        height_mm: settings.height_mm || 40,
        x_offset: settings.x_offset || 0,
        y_offset: settings.y_offset || 0,
        copies: 1,
        dpi: 203,
        data: sampleData,
        source: 'Studio Test'
      })
    });

    const data = await res.json();
    if (data.status === 'success') {
      if (typeof showToast === 'function') {
        showToast(`🖨️ Test etiketi '${printer}' etiket yazıcısına başarıyla gönderildi!`, 'success');
      }
    } else {
      if (typeof showToast === 'function') {
        showToast(`❌ Test baskısı gönderilemedi: ${data.message || 'Hata'}`, 'error');
      }
    }
  } catch (err) {
    if (typeof showToast === 'function') {
      showToast('❌ Yazıcıya ulaşılamadı. Lütfen kablo ve sürücü bağlantısını kontrol edin.', 'error');
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>🖨️</span> <span>Test Etiketi Bas</span>';
    }
  }
}

// Window Global Bağlantıları
window.createNewTemplate = createNewTemplate;
window.openNewModelModal = openNewModelModal;
window.closeNewModelModal = closeNewModelModal;
window.submitNewModelModal = submitNewModelModal;
window.adjustEditorScale = adjustEditorScale;
window.resetEditorScale = resetEditorScale;
window.applyEditorScale = applyEditorScale;
window.switchDesignStudioTab = switchDesignStudioTab;
window.loadReceiptDesignSettings = loadReceiptDesignSettings;
window.updateReceiptPreviewLive = updateReceiptPreviewLive;
window.saveReceiptDesignSettings = saveReceiptDesignSettings;
window.printReceiptDesignTest = printReceiptDesignTest;
window.checkDesignStudioPrintersStatus = checkDesignStudioPrintersStatus;
window.printStudioTestLabel = printStudioTestLabel;
window.populateStudioPrintersDropdown = populateStudioPrintersDropdown;
window.onStudioPrinterSelected = onStudioPrinterSelected;
window.onStudioReceiptPrinterSelected = onStudioReceiptPrinterSelected;
window.selectAndEditTemplate = selectAndEditTemplate;
window.returnToModelSelection = returnToModelSelection;
window.onStudioLabelSizeChange = onStudioLabelSizeChange;
window.onStudioPriceSizeChange = onStudioPriceSizeChange;
window.onStudioTitleSizeChange = onStudioTitleSizeChange;
window.toggleStudioElement = toggleStudioElement;
window.onStudioTopRightChange = onStudioTopRightChange;
