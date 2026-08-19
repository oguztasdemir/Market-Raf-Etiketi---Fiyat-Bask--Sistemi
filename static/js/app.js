// Market Raf Etiketi JavaScript Mantığı
let currentScale = 1;
let currentSize = '76x40';
let currentWidth = 76;
let currentHeight = 40;
let selectedPrinter = "Termal Etiket Yazici";
let currentTopRightMode = 'empty';

// Backend API URL
const API_BASE = (window.location.protocol === 'file:' || !window.location.port || window.location.port === '5500') 
  ? 'http://127.0.0.1:5000' 
  : '';

document.addEventListener('DOMContentLoaded', () => {
  renderBarcode();
  checkBackendAndDevices();
  updateTopRightPreview();
});

// Backend Durumunu ve Yazıcıları Sorgula
async function checkBackendAndDevices() {
  const badgeText = document.getElementById('backend-status-text');
  const printerSelect = document.getElementById('printer-select');

  try {
    const res = await fetch(`${API_BASE}/api/devices`);
    if (!res.ok) throw new Error('API bağlantı hatası');
    const data = await res.json();

    if (data.usb_connected) {
      badgeText.innerHTML = `USB: <strong>Termal Yazıcı Bağlı</strong>`;
    } else {
      badgeText.innerHTML = `Sunucu: <strong>Aktif</strong>`;
    }

    printerSelect.innerHTML = '';

    if (data.printers && data.printers.length > 0) {
      data.printers.forEach(printer => {
        const opt = document.createElement('option');
        opt.value = printer;
        opt.innerText = `🖨️ ${printer}`;
        if (printer.toLowerCase().includes('etiket') || printer.toLowerCase().includes('termal') || printer.toLowerCase().includes('pos') || printer === data.default_printer) {
          opt.selected = true;
          selectedPrinter = printer;
        }
        printerSelect.appendChild(opt);
      });
    } else {
      const opt = document.createElement('option');
      opt.value = "Termal Etiket Yazici";
      opt.innerText = "🖨️ Termal Etiket Yazici (Varsayılan)";
      opt.selected = true;
      printerSelect.appendChild(opt);
    }

  } catch (err) {
    badgeText.innerHTML = `Durum: <strong>Çevrimdışı / Yerel</strong>`;
  }
}

// Şablon Preset Değişimi
function onPresetChange(presetKey) {
  const modeSelect = document.getElementById('top-right-mode-select');
  const badge = document.getElementById('current-design-badge');
  const customField = document.getElementById('top-right-custom-field');
  const customInput = document.getElementById('inp-top-right-text');

  if (presetKey === 'default') {
    modeSelect.value = 'empty';
    badge.innerText = '🔒 Standart Raf (Başlangıç)';
    customField.style.display = 'none';
  } else if (presetKey === 'unit_price') {
    modeSelect.value = 'unit_price';
    badge.innerText = '🏷️ Sade Birim Fiyatlı';
    customField.style.display = 'none';
  } else if (presetKey === 'weight') {
    modeSelect.value = 'weight';
    badge.innerText = '⚖️ Gramaj / Miktar Rozetli';
    customField.style.display = 'block';
    document.getElementById('top-right-custom-label').innerText = 'Gramaj / Miktar Metni';
    customInput.value = 'NET: 35 GR';
  } else if (presetKey === 'code') {
    modeSelect.value = 'code';
    badge.innerText = '🔖 Reyon / Kodlu';
    customField.style.display = 'block';
    document.getElementById('top-right-custom-label').innerText = 'Reyon / Stok Kodu';
    customInput.value = 'REYON: A-04';
  } else if (presetKey === 'qr') {
    modeSelect.value = 'qr';
    badge.innerText = '📱 Karekodlu (QR)';
    customField.style.display = 'block';
    document.getElementById('top-right-custom-label').innerText = 'QR Link / Veri';
    customInput.value = 'https://market.com';
  } else if (presetKey === 'campaign') {
    modeSelect.value = 'campaign';
    badge.innerText = '⭐ Süper Fırsat';
    customField.style.display = 'block';
    document.getElementById('top-right-custom-label').innerText = 'Fırsat Rozeti Metni';
    customInput.value = 'SÜPER FİYAT';
  } else if (presetKey === 'yerli') {
    modeSelect.value = 'yerli';
    badge.innerText = '🇹🇷 Yerli Üretimli';
    customField.style.display = 'none';
  }

  currentTopRightMode = modeSelect.value;
  updateTopRightPreview();
}

// Sağ Üst Köşe Modu Değişimi
function onTopRightModeChange(mode) {
  currentTopRightMode = mode;
  const customField = document.getElementById('top-right-custom-field');
  const customInput = document.getElementById('inp-top-right-text');

  if (mode === 'empty' || mode === 'unit_price' || mode === 'yerli') {
    customField.style.display = 'none';
  } else {
    customField.style.display = 'block';
    if (mode === 'weight') {
      document.getElementById('top-right-custom-label').innerText = 'Gramaj / Miktar Metni';
      if (!customInput.value) customInput.value = 'NET: 35 GR';
    } else if (mode === 'code') {
      document.getElementById('top-right-custom-label').innerText = 'Reyon / Stok Kodu';
      if (!customInput.value) customInput.value = 'REYON: A-04';
    } else if (mode === 'qr') {
      document.getElementById('top-right-custom-label').innerText = 'QR Link / Veri';
      if (!customInput.value) customInput.value = 'https://market.com';
    } else if (mode === 'campaign') {
      document.getElementById('top-right-custom-label').innerText = 'Fırsat Rozeti Metni';
      if (!customInput.value) customInput.value = 'SÜPER FİYAT';
    }
  }

  updateTopRightPreview();
}

// Canlı Önizlemede Sağ Üst Köşeyi Güncelle
function updateTopRightPreview() {
  const box = document.getElementById('lbl-top-right-box');
  const titleArea = document.getElementById('lbl-title-area');
  const customText = document.getElementById('inp-top-right-text').value;
  const unitPrice = document.getElementById('inp-unit-price').value;

  if (currentTopRightMode === 'empty') {
    box.style.display = 'none';
    titleArea.className = 'ml-title-area full-width';
  } else {
    box.style.display = 'flex';
    titleArea.className = 'ml-title-area';

    if (currentTopRightMode === 'unit_price') {
      box.innerHTML = `
        <div class="tr-unit-box">
          <span class="u-label">Birim Fiyat:</span>
          <span class="u-val">${unitPrice}</span>
        </div>
      `;
    } else if (currentTopRightMode === 'weight') {
      box.innerHTML = `<div class="tr-badge">${customText || 'NET: 35 GR'}</div>`;
    } else if (currentTopRightMode === 'code') {
      box.innerHTML = `<div class="tr-badge">${customText || 'REYON: A-04'}</div>`;
    } else if (currentTopRightMode === 'campaign') {
      box.innerHTML = `<div class="tr-badge-dark">${customText || 'SÜPER FİYAT'}</div>`;
    } else if (currentTopRightMode === 'qr') {
      box.innerHTML = `<div class="tr-qr-box" id="qr-preview-container"></div>`;
      try {
        QRCode.toCanvas(document.getElementById('qr-preview-container'), customText || 'https://market.com', { width: 32, margin: 0 });
      } catch (e) {}
    } else if (currentTopRightMode === 'yerli') {
      box.innerHTML = `
        <svg viewBox="0 0 160 65" width="75" height="30">
          <rect x="1" y="1" width="158" height="63" rx="3" fill="none" stroke="#000" stroke-width="2.2" />
          <path d="M10 18 L22 30 L34 18 L30 14 L22 22 L14 14 Z" fill="#000" />
          <rect x="6" y="34" width="3" height="20" fill="#000" />
          <rect x="12" y="34" width="5" height="20" fill="#000" />
          <rect x="20" y="34" width="2" height="20" fill="#000" />
          <rect x="25" y="34" width="6" height="20" fill="#000" />
          <text x="42" y="28" font-family="'Inter', sans-serif" font-weight="900" font-size="18" fill="#000">YERLİ</text>
          <text x="42" y="52" font-family="'Inter', sans-serif" font-weight="900" font-size="18" fill="#000">ÜRETİM</text>
        </svg>
      `;
    }
  }
}

// Barkod Çizimi
function renderBarcode() {
  const val = document.getElementById('inp-barcode').value.trim() || "8690504114925";
  try {
    JsBarcode("#market-barcode-svg", val, {
      format: (val.length === 13 && /^\d+$/.test(val)) ? "EAN13" : "CODE128",
      lineColor: "#000",
      width: 1.15,
      height: 22,
      displayValue: true,
      fontSize: 9,
      font: "Inter",
      textMargin: 1,
      margin: 0
    });
  } catch (e) {
    try {
      JsBarcode("#market-barcode-svg", val, {
        format: "CODE128",
        lineColor: "#000",
        width: 1.15,
        height: 22,
        displayValue: true,
        fontSize: 9,
        font: "Inter",
        textMargin: 1,
        margin: 0
      });
    } catch (err) {}
  }
}

// Canlı Etiket Güncelleme
function updateLabel() {
  document.getElementById('lbl-title-1').innerText = document.getElementById('inp-prod-title-1').value.toUpperCase();
  document.getElementById('lbl-title-2').innerText = document.getElementById('inp-prod-title-2').value.toUpperCase();
  document.getElementById('lbl-brand').innerText = document.getElementById('inp-brand').value.toUpperCase();
  document.getElementById('lbl-origin').innerText = document.getElementById('inp-origin').value.toUpperCase();
  document.getElementById('lbl-date').innerText = document.getElementById('inp-date').value;
  document.getElementById('lbl-price').innerText = document.getElementById('inp-price').value;

  updateTopRightPreview();
  renderBarcode();
}

// Boyut Değiştirme
function switchSize(sizeKey, width, height) {
  currentSize = sizeKey;
  currentWidth = width;
  currentHeight = height;

  const labelEl = document.getElementById('market-shelf-label');
  const badge = document.getElementById('current-size-badge');

  document.querySelectorAll('.template-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-size') === sizeKey);
  });

  labelEl.className = `market-label size-${sizeKey}`;
  badge.innerText = `${width} x ${height} mm`;
  applyScale();
}

// Yazdırma İşlemi
async function handlePrint() {
  const printer = document.getElementById('printer-select').value || "Termal Etiket Yazici";
  const orientation = document.getElementById('orient-select').value || "POR";
  const btn = document.getElementById('btn-print');
  const originalBtnHtml = btn.innerHTML;

  btn.disabled = true;
  btn.style.opacity = "0.7";
  btn.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
    </svg>
    <span>Yazdırılıyor...</span>
  `;

  const alertBox = document.getElementById('status-alert');
  alertBox.className = "card tip-card active-printing";
  alertBox.innerHTML = `<h3>🖨️ Yazıcıya İletiliyor...</h3><p>Etiket <strong>${printer}</strong> cihazına basılıyor...</p>`;

  const labelData = {
    title1: document.getElementById('inp-prod-title-1').value,
    title2: document.getElementById('inp-prod-title-2').value,
    brand: document.getElementById('inp-brand').value,
    origin: document.getElementById('inp-origin').value,
    date: document.getElementById('inp-date').value,
    unit_price: document.getElementById('inp-unit-price').value,
    barcode: document.getElementById('inp-barcode').value,
    price: document.getElementById('inp-price').value,
    top_right_mode: currentTopRightMode,
    top_right_text: document.getElementById('inp-top-right-text').value
  };

  const x_offset = parseInt(document.getElementById('inp-x-offset').value || 0);
  const y_offset = parseInt(document.getElementById('inp-y-offset').value || 0);
  const copies = parseInt(document.getElementById('inp-copies').value || 1);

  try {
    const res = await fetch(`${API_BASE}/api/print/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        printer: printer,
        orientation: orientation,
        width_mm: currentWidth,
        height_mm: currentHeight,
        x_offset: x_offset,
        y_offset: y_offset,
        copies: copies,
        data: labelData
      })
    });
    const result = await res.json();
    
    if (result.status === 'success') {
      btn.innerHTML = `<span>✓ YAZDIRILDI!</span>`;
      btn.style.background = "linear-gradient(135deg, #10b981, #059669)";
      alertBox.className = "card tip-card success-print";
      alertBox.innerHTML = `<h3>✅ Etiket Başarıyla Basıldı!</h3><p>${result.message}</p>`;
    } else {
      btn.innerHTML = `<span>⚠️ Tekrar Dene</span>`;
      alertBox.innerHTML = `<h3>⚠️ Yazdırma Uyarısı</h3><p>${result.message}</p>`;
    }
  } catch (err) {
    alertBox.innerHTML = `<h3>⚠️ Bağlantı Hatası</h3><p>Sunucuya ulaşılamadı. Python sunucusunun çalıştığından emin olun.</p>`;
  } finally {
    setTimeout(() => {
      btn.disabled = false;
      btn.style.opacity = "1";
      btn.style.background = "";
      btn.innerHTML = originalBtnHtml;
    }, 2000);
  }
}

// Zoom
function adjustScale(factor) {
  currentScale = Math.min(Math.max(currentScale * factor, 0.5), 3.0);
  applyScale();
}

function resetScale() {
  currentScale = 1;
  applyScale();
}

function applyScale() {
  const label = document.getElementById('market-shelf-label');
  if (label) {
    label.style.transform = `scale(${currentScale})`;
  }
  document.getElementById('zoom-text').innerText = `${Math.round(currentScale * 100)}%`;
}
