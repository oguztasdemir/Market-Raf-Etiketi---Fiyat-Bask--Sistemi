// ==========================================
// PRINT PANELİ: Etiket Çıkart, Form & Canlı Önizleme
// ==========================================

let searchTimeout = null;

async function checkBackendAndDevices(isManual = false) {
  const badgeText = document.getElementById('backend-status-text');
  const printerSelect = document.getElementById('settings-printer-select');
  const sidebarPrinterName = document.getElementById('sidebar-printer-name');

  // QR Paneli Cihaz Elemanları
  const qrPrintersList = document.getElementById('qr-printers-list');
  const qrPrintersCount = document.getElementById('qr-printers-count');
  const qrUsbList = document.getElementById('qr-usb-list');
  const qrUsbStatus = document.getElementById('qr-usb-status');
  const qrNetIp = document.getElementById('qr-net-ip');
  const qrActivePrinter = document.getElementById('qr-active-printer');

  try {
    const res = await fetch(`${API_BASE}/api/devices`);
    if (!res.ok) throw new Error('API bağlantı hatası');
    const data = await res.json();

    if (data.usb_connected) {
      if (badgeText) badgeText.innerHTML = `USB: <strong>Termal Bağlı</strong>`;
    } else {
      if (badgeText) badgeText.innerHTML = `Sunucu: <strong>Aktif</strong>`;
    }

    if (data.default_printer) {
      selectedPrinter = data.default_printer;
      if (sidebarPrinterName) sidebarPrinterName.innerText = data.default_printer;
      if (qrActivePrinter) qrActivePrinter.innerText = data.default_printer;
    }

    if (printerSelect) {
      printerSelect.innerHTML = '';
      if (data.printers && data.printers.length > 0) {
        data.printers.forEach(printer => {
          const opt = document.createElement('option');
          opt.value = printer;
          opt.innerText = `🖨️ ${printer}`;
          if (printer === (selectedPrinter || data.default_printer)) opt.selected = true;
          printerSelect.appendChild(opt);
        });
      }
    }

    // QR Bağlantısı Paneli Sağ Tarafını Doldur
    if (qrPrintersList && data.printers) {
      qrPrintersList.innerHTML = '';
      if (qrPrintersCount) qrPrintersCount.innerText = `${data.printers.length} Yazıcı`;
      
      data.printers.forEach(printer => {
        const isDefault = printer === (selectedPrinter || data.default_printer);
        const item = document.createElement('div');
        item.className = 'device-item-row';
        item.innerHTML = `
          <div class="device-item-name">
            <span>${isDefault ? '⭐' : '🖨️'}</span>
            <span>${printer}</span>
          </div>
          <div class="device-item-meta">
            ${isDefault ? '<span class="badge-status-pill online">Varsayılan</span>' : '<span style="color:var(--text-muted);">Hazır</span>'}
          </div>
        `;
        qrPrintersList.appendChild(item);
      });
    }

    if (qrUsbList) {
      qrUsbList.innerHTML = '';
      const usbList = data.usb_devices || [];
      if (qrUsbStatus) {
        if (usbList.length > 0) {
          qrUsbStatus.className = 'badge-status-pill online';
          qrUsbStatus.innerText = `🟢 ${usbList.length} Aygıt Algılandı`;
        } else {
          qrUsbStatus.className = 'badge-status-pill offline';
          qrUsbStatus.innerText = `🔴 Algılanmadı`;
        }
      }

      if (usbList.length === 0) {
        qrUsbList.innerHTML = `<div class="device-item-meta" style="padding:4px 0; color:var(--text-muted);">Doğrudan algılanan USB donanımı bulunamadı (Windows yazıcı kuyruğu kullanılabilir).</div>`;
      } else {
        usbList.forEach(usb => {
          const item = document.createElement('div');
          item.className = 'device-item-row';
          item.innerHTML = `
            <div class="device-item-name">
              <span>🔌</span>
              <span>${usb.FriendlyName || 'USB Aygıtı'}</span>
            </div>
            <div class="device-item-meta">
              <span class="badge-status-pill online">Bağlı (OK)</span>
            </div>
          `;
          qrUsbList.appendChild(item);
        });
      }
    }

    if (isManual) {
      showToast("✓ Cihaz ve yazıcı listesi güncellendi.", "success");
    }

  } catch (err) {
    if (badgeText) badgeText.innerHTML = `Durum: <strong>Yerel Mod</strong>`;
    if (qrUsbStatus) {
      qrUsbStatus.className = 'badge-status-pill offline';
      qrUsbStatus.innerText = `🔴 Çevrimdışı`;
    }
  }
}


async function loadMobileQrCode() {
  try {
    const res = await fetch(`${API_BASE}/api/network/ip`);
    const data = await res.json();
    if (data.status === 'success') {
      const mobileUrl = data.mobile_url || data.mobile_https || data.mobile_http || `http://${data.ip || '127.0.0.1'}:5000/mobile`;
      const inp = document.getElementById('inp-mobile-url');
      if (inp) inp.value = mobileUrl;

      const qrNetIp = document.getElementById('qr-net-ip');
      if (qrNetIp) qrNetIp.innerText = data.ip || '127.0.0.1';

      const qrContainer = document.getElementById('mobile-qr-canvas');
      if (qrContainer) {
        qrContainer.innerHTML = '';

        // 1. Canvas oluşturarak QRCode render et
        const canvas = document.createElement('canvas');
        canvas.style.borderRadius = '8px';
        canvas.style.maxWidth = '100%';

        let generated = false;
        if (window.QRCode && typeof QRCode.toCanvas === 'function') {
          try {
            await QRCode.toCanvas(canvas, mobileUrl, {
              width: 190,
              margin: 1,
              color: { dark: '#000000', light: '#ffffff' }
            });
            qrContainer.appendChild(canvas);
            generated = true;
          } catch (qrErr) {
            console.warn("QRCode.toCanvas hatası:", qrErr);
          }
        }

        // 2. Fallback: Yedek güvenilir QR Görseli
        if (!generated) {
          const img = document.createElement('img');
          img.src = `https://api.qrserver.com/v1/create-qr-code/?size=190x190&data=${encodeURIComponent(mobileUrl)}`;
          img.alt = "Mobil QR Kodu";
          img.style.width = "190px";
          img.style.height = "190px";
          img.style.borderRadius = "8px";
          qrContainer.appendChild(img);
        }
      }
    }
  } catch (e) {
    console.error("QR oluşturma hatası:", e);
  }
}


function copyMobileUrl() {
  const inp = document.getElementById('inp-mobile-url');
  if (!inp) return;
  inp.select();
  document.execCommand('copy');
  showToast("📋 Mobil bağlantı linki kopyalandı:\n" + inp.value, "success");
}


async function testPrinterQuick() {
  const printer = selectedPrinter || "Termal Etiket Yazici";
  try {
    const res = await fetch(`${API_BASE}/api/print/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        printer: printer,
        orientation: "POR",
        width_mm: currentWidth || 76,
        height_mm: currentHeight || 40,
        x_offset: 0,
        y_offset: 0,
        copies: 1,
        data: {
          title1: "TEST BASKISI",
          title2: "TERMAL RAF ETIKETI",
          brand: "YARENLER",
          origin: "TURKIYE",
          date: document.getElementById('inp-date')?.value || "19 Agu 2026",
          barcode: "8690504114925",
          price: "99,90 TL",
          top_right_mode: "empty",
          top_right_text: ""
        }
      })
    });

    const result = await res.json();
    if (result.status === 'success') {
      showToast(`✅ '${printer}' yazıcısına test etiketi gönderildi!`, "success");
    } else {
      showToast(`❌ Test baskısı başarısız: ${result.message}`, "error");
    }
  } catch (err) {
    showToast(`❌ Bağlantı hatası: ${err.message}`, "error");
  }
}


function searchProducts(q) {
  clearTimeout(searchTimeout);
  const dropdown = document.getElementById('stock-dropdown');
  q = (q || '').trim();

  if (!q) {
    if (dropdown) dropdown.style.display = 'none';
    return;
  }

  searchTimeout = setTimeout(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/products/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      
      if (data.status === 'success' && data.products.length > 0) {
        dropdown.innerHTML = '';
        data.products.slice(0, 30).forEach(p => {
          const item = document.createElement('div');
          item.className = 'stock-item';
          const title = p.title || p.title1 || '';
          const brandInfo = p.brand ? ` | ${p.brand}` : '';
          item.innerHTML = `
            <div>
              <div class="stock-item-title">${title}</div>
              <div class="stock-item-sub">Barkod: ${p.barcode || '-'}${brandInfo}</div>
            </div>
            <div class="stock-item-price">${p.price || ''}</div>
          `;
          item.onclick = () => selectProductFromStock(p);
          dropdown.appendChild(item);
        });
        dropdown.style.display = 'block';
      } else {
        dropdown.style.display = 'none';
      }
    } catch (e) {}
  }, 120);
}


function selectProductFromStock(p) {
  const fullTitle = (p.title || p.title1 || '').trim();
  
  // Başlık tek satıra sığıyorsa (30 karaktere kadar) tek satır büyük yaz, sığmıyorsa 2 satıra böl
  if (fullTitle.length <= 30) {
    document.getElementById('inp-prod-title-1').value = fullTitle;
    document.getElementById('inp-prod-title-2').value = '';
  } else {
    // 30 karaktere en yakın kelime sınırından böl
    const words = fullTitle.split(/\s+/);
    let line1 = '';
    let line2 = '';
    for (let i = 0; i < words.length; i++) {
      const candidate = line1 ? `${line1} ${words[i]}` : words[i];
      if (candidate.length <= 30 && !line2) {
        line1 = candidate;
      } else {
        line2 = line2 ? `${line2} ${words[i]}` : words[i];
      }
    }
    document.getElementById('inp-prod-title-1').value = line1 || fullTitle;
    document.getElementById('inp-prod-title-2').value = line2;
  }
  
  const brandInp = document.getElementById('inp-brand');
  if (brandInp && (!brandInp.value || brandInp.value.trim() === '')) {
    brandInp.value = 'YARENLER';
  }
  document.getElementById('inp-barcode').value = p.barcode || '';
  
  let formattedPrice = p.price || '';
  if (formattedPrice) formattedPrice = formattedPrice.replace(/₺/g, 'TL');
  document.getElementById('inp-price').value = formattedPrice;
  
  document.getElementById('stock-dropdown').style.display = 'none';
  document.getElementById('inp-stock-search').value = '';
  updateLabel();
}


async function saveCurrentToStock() {
  const barcode = document.getElementById('inp-barcode').value.trim();
  const title1 = document.getElementById('inp-prod-title-1').value.trim();
  const title2 = document.getElementById('inp-prod-title-2').value.trim();
  const fullTitle = title2 ? `${title1} ${title2}` : title1;
  const price = document.getElementById('inp-price').value.trim();

  if (!barcode || !title1) {
    showToast("Lütfen en az Barkod ve Ürün Adı girin!", "warning");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barcode: barcode,
        title: fullTitle,
        price: price
      })
    });
    const result = await res.json();
    if (result.status === 'success') {
      showToast(`✓ "${fullTitle}" başarıyla kaydedildi.`, "success");
    }
  } catch (e) {
    showToast("Stok kaydetme hatası!", "error");
  }
}


function updateTopRightPreview(mode = currentTopRightMode, customText = "") {
  const box = document.getElementById('lbl-top-right-box');
  const titleArea = document.getElementById('lbl-title-area');
  const unitPrice = document.getElementById('inp-unit-price') ? document.getElementById('inp-unit-price').value : "250,00 ₺/Kg";

  if (!box || !titleArea) return;

  if (mode === 'empty') {
    box.style.display = 'none';
    titleArea.className = 'ml-title-area full-width';
  } else {
    box.style.display = 'flex';
    titleArea.className = 'ml-title-area';

    if (mode === 'unit_price') {
      box.innerHTML = `
        <div class="tr-unit-box">
          <span class="u-label">Birim Fiyat:</span>
          <span class="u-val">${unitPrice}</span>
        </div>
      `;
    } else if (mode === 'weight') {
      box.innerHTML = `<div class="tr-badge">${customText || 'NET: 35 GR'}</div>`;
    } else if (mode === 'code') {
      box.innerHTML = `<div class="tr-badge">${customText || 'REYON: A-04'}</div>`;
    } else if (mode === 'campaign') {
      box.innerHTML = `<div class="tr-badge-dark">${customText || 'SÜPER FİYAT'}</div>`;
    } else if (mode === 'qr') {
      box.innerHTML = `<div class="tr-qr-box" id="qr-preview-container"></div>`;
      try {
        QRCode.toCanvas(document.getElementById('qr-preview-container'), customText || 'https://market.com', { width: 32, margin: 0 });
      } catch (e) {}
    } else if (mode === 'yerli') {
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


function renderBarcode() {
  const barcodeEl = document.getElementById('inp-barcode');
  const val = barcodeEl ? barcodeEl.value.trim() || "8690504114925" : "8690504114925";
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


function updateLabel() {
  const t1 = document.getElementById('inp-prod-title-1')?.value || '';
  const t2 = document.getElementById('inp-prod-title-2')?.value || '';
  const br = document.getElementById('inp-brand')?.value || '';
  const org = document.getElementById('inp-origin')?.value || '';
  const dt = document.getElementById('inp-date')?.value || '';
  let pr = document.getElementById('inp-price')?.value || '';
  if (pr) pr = pr.replace(/₺/g, 'TL');

  const l1El = document.getElementById('lbl-title-1');
  const l2El = document.getElementById('lbl-title-2');
  const hasLine2 = t2.trim().length > 0;

  if (l1El) {
    l1El.innerText = t1.toUpperCase();
    if (!hasLine2) {
      l1El.className = 'ml-title-line1 single-line-big';
    } else {
      l1El.className = 'ml-title-line1';
    }
  }

  if (l2El) {
    if (hasLine2) {
      l2El.innerText = t2.toUpperCase();
      l2El.style.display = 'block';
    } else {
      l2El.innerText = '';
      l2El.style.display = 'none';
    }
  }

  if (document.getElementById('lbl-brand')) document.getElementById('lbl-brand').innerText = br.toUpperCase();
  if (document.getElementById('lbl-origin')) document.getElementById('lbl-origin').innerText = org.toUpperCase();
  if (document.getElementById('lbl-date')) document.getElementById('lbl-date').innerText = dt;
  if (document.getElementById('lbl-price')) document.getElementById('lbl-price').innerText = pr;

  updateTopRightPreview();
  renderBarcode();

  if (typeof scheduleDraftAutoSave === 'function') {
    scheduleDraftAutoSave();
  }
}


async function handlePrint() {
  const printer = document.getElementById('settings-printer-select') ? document.getElementById('settings-printer-select').value : "Termal Etiket Yazici";
  const orientation = document.getElementById('settings-orient-select') ? document.getElementById('settings-orient-select').value : "POR";
  const btn = document.getElementById('btn-print');
  const originalBtnHtml = btn.innerHTML;

  btn.disabled = true;
  btn.style.opacity = "0.7";
  btn.innerHTML = `<span>Yazdırılıyor...</span>`;

  const alertBox = document.getElementById('status-alert');
  if (alertBox) {
    alertBox.className = "card tip-card active-printing";
    alertBox.innerHTML = `<h3>🖨️ Yazıcıya İletiliyor...</h3><p>Etiket basılıyor...</p>`;
  }

  const tpl = templatesList.find(t => t.id === activeTemplateId) || {};
  const labelData = {
    title1: document.getElementById('inp-prod-title-1').value,
    title2: document.getElementById('inp-prod-title-2').value,
    brand: document.getElementById('inp-brand').value,
    origin: document.getElementById('inp-origin').value,
    date: document.getElementById('inp-date').value,
    unit_price: document.getElementById('inp-unit-price').value,
    barcode: document.getElementById('inp-barcode').value,
    price: document.getElementById('inp-price').value,
    top_right_mode: tpl.top_right_mode || 'empty',
    top_right_text: tpl.top_right_text || ''
  };

  const x_offset = parseInt(document.getElementById('settings-x-offset') ? document.getElementById('settings-x-offset').value : 0);
  const y_offset = parseInt(document.getElementById('settings-y-offset') ? document.getElementById('settings-y-offset').value : 0);
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
      if (typeof markFormClean === 'function') markFormClean();
      btn.innerHTML = `<span>✓ YAZDIRILDI!</span>`;
      btn.style.background = "linear-gradient(135deg, #10b981, #059669)";
      if (alertBox) {
        alertBox.className = "card tip-card success-print";
        alertBox.innerHTML = `<h3>✅ Etiket Başarıyla Basıldı!</h3><p>${result.message}</p>`;
      }
    } else {
      btn.innerHTML = `<span>⚠️ Tekrar Dene</span>`;
      if (alertBox) alertBox.innerHTML = `<h3>⚠️ Yazdırma Uyarısı</h3><p>${result.message}</p>`;
    }
  } catch (err) {
    if (alertBox) alertBox.innerHTML = `<h3>⚠️ Bağlantı Hatası</h3><p>Sunucuya ulaşılamadı.</p>`;
  } finally {
    setTimeout(() => {
      btn.disabled = false;
      btn.style.opacity = "1";
      btn.style.background = "";
      btn.innerHTML = originalBtnHtml;
    }, 2000);
  }
}

// Global takma adlar
window.updatePreviewLive = updateLabel;
