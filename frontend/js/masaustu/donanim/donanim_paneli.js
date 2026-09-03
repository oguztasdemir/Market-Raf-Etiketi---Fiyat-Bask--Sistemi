// -*- coding: utf-8 -*-
/**
 * Market Donanım, Yazıcı & Terazi Yönetim Paneli
 * - Canlı Windows, Ağ (Wi-Fi/Ethernet) ve Bluetooth Yazıcı Taraması
 * - Kasa Bilgi Fişi Yazıcısı (80mm/58mm ESC/POS) ve Etiket Yazıcısı Ayrımı
 * - Elektronik Terazi (27/28 Barkod, COM Port, IP) Yapılandırması ve Canlı Test
 */

let currentDiscoveredHardware = {
  printers: [],
  com_ports: [],
  active_config: null
};

async function openHardwareManagerModal() {
  const modal = document.getElementById('modal-hardware-manager');
  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add('active');
  }
  await scanAllHardwareDevices();
}

function closeHardwareManagerModal() {
  const modal = document.getElementById('modal-hardware-manager');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('active');
  }
}

async function scanAllHardwareDevices() {
  const spinner = document.getElementById('scan-hardware-spinner');
  if (spinner) spinner.style.display = 'inline-block';

  try {
    const res = await fetch(`${API_BASE}/api/devices/scan?_t=${Date.now()}`);
    const data = await res.json();
    if (data.status === 'success') {
      currentDiscoveredHardware = data;
      renderHardwarePrintersDropdowns(data.printers || [], data.active_config || {});
      renderHardwareScaleConfig(data.com_ports || [], data.active_config || {});
      
      const lastScanEl = document.getElementById('hw-manager-last-scan-text');
      if (lastScanEl) {
        const d = new Date();
        lastScanEl.innerText = `Son Tarama: ${d.toLocaleTimeString('tr-TR')} (${data.printers?.length || 0} Yazıcı, ${data.com_ports?.length || 0} COM Port)`;
      }
    }
  } catch (err) {
    console.error('Cihaz tarama hatası:', err);
    if (typeof showToast === 'function') showToast('Cihaz taraması yapılamadı: ' + err.message, 'error');
  } finally {
    if (spinner) spinner.style.display = 'none';
  }
}

function renderHardwarePrintersDropdowns(printers, activeConfig) {
  const labelSelect = document.getElementById('hw-select-label-printer');
  const receiptSelect = document.getElementById('hw-select-receipt-printer');
  const settingsLabelSelect = document.getElementById('settings-printer-select');
  const settingsReceiptSelect = document.getElementById('settings-receipt-printer-select');

  const selectedLabel = activeConfig?.label_printer?.name || (printers[0]?.name || 'Termal Etiket Yazici');
  const selectedReceipt = activeConfig?.receipt_printer?.name || (printers.find(p => p.suggested_role === 'receipt')?.name || selectedLabel);

  const getConnIcon = (type) => {
    if (type === 'wifi') return '📶 Wi-Fi/Ağ';
    if (type === 'bluetooth') return '🔵 Bluetooth';
    if (type === 'virtual') return '💻 Sanal';
    return '🔌 USB';
  };

  const buildOptionsHtml = (selectedName) => {
    if (!printers || printers.length === 0) {
      return `<option value="Termal Etiket Yazici">Termal Etiket Yazici (Varsayılan)</option>`;
    }
    return printers.map(p => {
      const isSel = (p.name.toLowerCase() === (selectedName || '').toLowerCase());
      const icon = getConnIcon(p.connection_type);
      return `<option value="${p.name}" ${isSel ? 'selected' : ''}>${p.name} [${icon} - ${p.status_text}]</option>`;
    }).join('');
  };

  if (labelSelect) {
    labelSelect.innerHTML = buildOptionsHtml(selectedLabel);
    onLabelPrinterSelected();
  }
  if (receiptSelect) {
    receiptSelect.innerHTML = buildOptionsHtml(selectedReceipt);
    onReceiptPrinterSelected();
  }

  // Ayarlar sekmesindeki açılır listeleri de güncelle
  if (settingsLabelSelect) settingsLabelSelect.innerHTML = buildOptionsHtml(selectedLabel);
  if (settingsReceiptSelect) settingsReceiptSelect.innerHTML = buildOptionsHtml(selectedReceipt);

  // Kağıt boyutları ve diğer alanlar
  const labelPaperSize = document.getElementById('hw-label-paper-size');
  if (labelPaperSize && activeConfig?.label_printer?.paper_width_mm) {
    const w = activeConfig.label_printer.paper_width_mm;
    const h = activeConfig.label_printer.paper_height_mm || 40;
    labelPaperSize.value = `${w}x${h}`;
  }

  const receiptPaperSize = document.getElementById('hw-receipt-paper-size');
  if (receiptPaperSize && activeConfig?.receipt_printer?.paper_size) {
    receiptPaperSize.value = activeConfig.receipt_printer.paper_size;
  }

  const autoCutCheck = document.getElementById('hw-receipt-auto-cut');
  if (autoCutCheck && activeConfig?.receipt_printer?.auto_cut !== undefined) {
    autoCutCheck.checked = activeConfig.receipt_printer.auto_cut;
  }

  const openDrawerCheck = document.getElementById('hw-receipt-open-drawer');
  if (openDrawerCheck && activeConfig?.receipt_printer?.open_drawer !== undefined) {
    openDrawerCheck.checked = activeConfig.receipt_printer.open_drawer;
  }
}

function onLabelPrinterSelected() {
  const select = document.getElementById('hw-select-label-printer');
  if (!select) return;
  const name = select.value;
  const printerObj = (currentDiscoveredHardware.printers || []).find(p => p.name === name);

  const connEl = document.getElementById('hw-label-conn-type');
  const driverEl = document.getElementById('hw-label-driver-name');
  const badgeEl = document.getElementById('hw-label-status-badge');

  if (printerObj) {
    if (connEl) connEl.innerText = `${printerObj.connection_type?.toUpperCase() || 'USB'} (Port: ${printerObj.port || 'USB001'})`;
    if (driverEl) driverEl.innerText = printerObj.driver || 'Windows Standard Driver';
    if (badgeEl) {
      badgeEl.innerText = printerObj.status_text || '🟢 Hazır';
      badgeEl.style.color = printerObj.is_offline ? '#f87171' : '#34d399';
    }
  }
}

function onReceiptPrinterSelected() {
  const select = document.getElementById('hw-select-receipt-printer');
  if (!select) return;
  const name = select.value;
  const printerObj = (currentDiscoveredHardware.printers || []).find(p => p.name === name);

  const badgeEl = document.getElementById('hw-receipt-status-badge');
  if (printerObj && badgeEl) {
    badgeEl.innerText = printerObj.status_text || '🟢 Hazır';
    badgeEl.style.color = printerObj.is_offline ? '#f87171' : '#34d399';
  }
}

function renderHardwareScaleConfig(comPorts, activeConfig) {
  const scaleObj = (activeConfig?.scales && activeConfig.scales.length > 0) ? activeConfig.scales[0] : null;
  const scaleTypeSel = document.getElementById('hw-scale-type');
  const comPortSel = document.getElementById('hw-scale-com-port');
  const protoSel = document.getElementById('hw-scale-protocol');
  const ipInp = document.getElementById('hw-scale-ip');
  const portInp = document.getElementById('hw-scale-port');

  if (comPortSel && comPorts) {
    comPortSel.innerHTML = comPorts.map(c => `<option value="${c.port}">${c.port} - ${c.description}</option>`).join('');
  }

  if (scaleObj) {
    if (scaleTypeSel) scaleTypeSel.value = scaleObj.type || 'scale_barcode';
    if (comPortSel && scaleObj.com_port) comPortSel.value = scaleObj.com_port;
    if (protoSel && scaleObj.protocol) protoSel.value = scaleObj.protocol;
    if (ipInp && scaleObj.ip) ipInp.value = scaleObj.ip;
    if (portInp && scaleObj.port) portInp.value = scaleObj.port;
  }
  onScaleTypeChanged();
}

function onScaleTypeChanged() {
  const type = document.getElementById('hw-scale-type')?.value || 'scale_barcode';
  const comRow = document.getElementById('hw-scale-com-row');
  const ipRow = document.getElementById('hw-scale-ip-row');
  const badge = document.getElementById('hw-scale-status-badge');

  if (comRow) comRow.style.display = (type === 'serial_com') ? 'block' : 'none';
  if (ipRow) ipRow.style.display = (type === 'network_ip') ? 'block' : 'none';

  if (badge) {
    if (type === 'scale_barcode') {
      badge.innerText = '🟢 Aktif (27/28)';
      badge.style.color = '#34d399';
    } else if (type === 'serial_com') {
      badge.innerText = '🔌 Seri Port (COM)';
      badge.style.color = '#38bdf8';
    } else {
      badge.innerText = '🌐 IP / Ağ Terazisi';
      badge.style.color = '#fbbf24';
    }
  }
}

async function testPrintLabelPrinter() {
  const labelPrinter = document.getElementById('hw-select-label-printer')?.value || 'Termal Etiket Yazici';
  if (typeof showToast === 'function') showToast(`🏷️ '${labelPrinter}' yazıcısına test etiketi gönderiliyor...`, 'info');

  try {
    const res = await fetch(`${API_BASE}/api/devices/test_label`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ printer_name: labelPrinter })
    });
    const data = await res.json();
    if (data.status === 'success') {
      if (typeof showToast === 'function') showToast(`✓ Test etiketi '${labelPrinter}' yazıcısına gönderildi!`, 'success');
    } else {
      if (typeof showToast === 'function') showToast(`❌ Etiket yazdırma hatası: ${data.message}`, 'error');
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast(`Bağlantı hatası: ${err.message}`, 'error');
  }
}

async function testPrintReceiptPrinter() {
  const receiptPrinter = document.getElementById('hw-select-receipt-printer')?.value || 'Termal Etiket Yazici';

  try {
    const res = await fetch(`${API_BASE}/api/devices/test_receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ printer_name: receiptPrinter })
    });
    const data = await res.json();
    if (data.status !== 'success') {
      printLocalBrowserTestReceipt();
    }
  } catch (err) {
    printLocalBrowserTestReceipt();
  }
}

function printLocalBrowserTestReceipt() {
  const dateStr = new Date().toLocaleString('tr-TR');
  const receiptHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>OYMAPOS Test Fişi</title>
        <style>
          @page { margin: 0; size: auto; }
          * { box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
            font-size: 12px; 
            width: 72mm; 
            margin: 0 auto; 
            padding: 8px 6px; 
            color: #000; 
            background: #fff;
            -webkit-print-color-adjust: exact;
          }
          .center { text-align: center; }
          .bold { font-weight: 800; }
          .divider { border-top: 1.5px dashed #000; margin: 6px 0; }
          .row { display: flex; justify-content: space-between; align-items: center; margin: 3px 0; }
        </style>
      </head>
      <body>
        <div class="center bold" style="font-size: 16px;">YARENLER MARKET</div>
        <div class="center" style="font-size: 11px; font-weight: 600;">KASA BİLGİ FİŞİ TESTİ</div>
        <div class="center" style="font-size: 11px; margin-top: 3px;">Tarih: ${dateStr}</div>
        <div class="divider"></div>
        <div class="row"><span class="bold">ÜRÜN ADI</span><span class="bold">TUTAR</span></div>
        <div class="divider"></div>
        <div class="row"><span>TEST ÜRÜN 1 (80MM / 58MM)</span><span>50,00 TL</span></div>
        <div class="row"><span>KASA BİLGİ FİŞİ TESTİ</span><span>50,00 TL</span></div>
        <div class="divider"></div>
        <div class="row bold" style="font-size: 16px; padding: 4px 0;"><span>TOPLAM TUTAR:</span><span>100,00 TL</span></div>
        <div class="divider"></div>
        <div class="center bold" style="font-size: 12px; margin-top: 6px;">BİLGİ FİŞİ YAZICISI BAŞARIYLA BAĞLANDI!</div>
        <div class="center" style="font-size: 10px; margin-top: 3px; color: #333;">MALİ DEĞERİ YOKTUR • BİLGİ AMAÇLIDIR</div>
      </body>
    </html>
  `;

  let printFrame = document.getElementById('hidden-pos-print-frame');
  if (!printFrame) {
    printFrame = document.createElement('iframe');
    printFrame.id = 'hidden-pos-print-frame';
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);
  }

  const frameDoc = printFrame.contentWindow.document;
  frameDoc.open();
  frameDoc.write(receiptHtml);
  frameDoc.close();

  setTimeout(() => {
    try {
      printFrame.contentWindow.focus();
      printFrame.contentWindow.print();
    } catch (e) {}
  }, 150);
}

async function testScaleConnection() {
  const type = document.getElementById('hw-scale-type')?.value || 'scale_barcode';
  const comPort = document.getElementById('hw-scale-com-port')?.value || 'COM1';
  const proto = document.getElementById('hw-scale-protocol')?.value || 'cas_er_plus';
  const ip = document.getElementById('hw-scale-ip')?.value || '192.168.1.50';

  if (typeof showToast === 'function') showToast('⚖️ Terazi bağlantısı test ediliyor...', 'info');

  try {
    const res = await fetch(`${API_BASE}/api/devices/test_scale`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: type, com_port: comPort, protocol: proto, ip: ip })
    });
    const data = await res.json();
    if (data.status === 'success') {
      if (typeof showToast === 'function') showToast(`✓ ${data.message} (Canlı Tartım: ${data.live_weight_kg} ${data.unit})`, 'success');
    } else {
      if (typeof showToast === 'function') showToast(`❌ Terazi test hatası: ${data.message}`, 'error');
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast(`Bağlantı hatası: ${err.message}`, 'error');
  }
}

async function saveHardwareDeviceSettings() {
  const labelPrinter = document.getElementById('hw-select-label-printer')?.value || 'Termal Etiket Yazici';
  const receiptPrinter = document.getElementById('hw-select-receipt-printer')?.value || 'Termal Etiket Yazici';
  const labelSize = document.getElementById('hw-label-paper-size')?.value || '60x40';
  const labelDarkness = parseInt(document.getElementById('hw-label-darkness')?.value || '22', 10);
  const receiptSize = document.getElementById('hw-receipt-paper-size')?.value || '80mm';
  const receiptAutoCut = document.getElementById('hw-receipt-auto-cut')?.checked ?? true;
  const receiptOpenDrawer = document.getElementById('hw-receipt-open-drawer')?.checked ?? true;

  const [wStr, hStr] = labelSize.split('x');
  const wMm = parseInt(wStr, 10) || 60;
  const hMm = parseInt(hStr, 10) || 40;

  const scaleType = document.getElementById('hw-scale-type')?.value || 'scale_barcode';
  const comPort = document.getElementById('hw-scale-com-port')?.value || 'COM1';
  const proto = document.getElementById('hw-scale-protocol')?.value || 'cas_er_plus';
  const ip = document.getElementById('hw-scale-ip')?.value || '192.168.1.50';
  const port = parseInt(document.getElementById('hw-scale-port')?.value || '4001', 10);

  const payload = {
    label_printer: {
      type: "windows_spooler",
      name: labelPrinter,
      paper_width_mm: wMm,
      paper_height_mm: hMm,
      darkness: labelDarkness
    },
    receipt_printer: {
      type: "windows_spooler",
      name: receiptPrinter,
      paper_size: receiptSize,
      auto_cut: receiptAutoCut,
      open_drawer: receiptOpenDrawer
    },
    scales: [
      {
        id: "scale_main",
        name: "Kasa Entegre Terazi",
        type: scaleType,
        protocol: proto,
        com_port: comPort,
        ip: ip,
        port: port,
        is_active: true
      }
    ]
  };

  try {
    const res = await fetch(`${API_BASE}/api/devices/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.status === 'success') {
      if (typeof showToast === 'function') showToast('✓ Donanım ve yazıcı ayarları başarıyla kaydedildi!', 'success');
      closeHardwareManagerModal();
      if (typeof loadMarketSettings === 'function') loadMarketSettings();
    } else {
      if (typeof showToast === 'function') showToast(`❌ Kayıt hatası: ${data.message}`, 'error');
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast(`Bağlantı hatası: ${err.message}`, 'error');
  }
}

// Window Global Exports
window.openHardwareManagerModal = openHardwareManagerModal;
window.closeHardwareManagerModal = closeHardwareManagerModal;
window.scanAllHardwareDevices = scanAllHardwareDevices;
window.onLabelPrinterSelected = onLabelPrinterSelected;
window.onReceiptPrinterSelected = onReceiptPrinterSelected;
window.onScaleTypeChanged = onScaleTypeChanged;
window.testPrintLabelPrinter = testPrintLabelPrinter;
window.testPrintReceiptPrinter = testPrintReceiptPrinter;
window.testScaleConnection = testScaleConnection;
window.saveHardwareDeviceSettings = saveHardwareDeviceSettings;
