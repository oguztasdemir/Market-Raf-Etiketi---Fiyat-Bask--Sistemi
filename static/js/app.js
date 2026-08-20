// Market Raf Etiketi Yönetim Paneli JS Mantığı
let currentScale = 1;
let currentSize = '76x40';
let currentWidth = 76;
let currentHeight = 40;
let selectedPrinter = "Termal Etiket Yazici";
let currentTopRightMode = 'empty';
let activeTemplateId = 'default';
let editingTemplateId = 'default';

let templatesList = [
  {
    id: "default",
    name: "Varsayılan Standart Model",
    is_locked: true,
    top_right_mode: "empty",
    top_right_text: "",
    description: "Görsel 2 standart fabrika raf etiketi."
  }
];

// Backend API URL
const API_BASE = (window.location.protocol === 'file:' || !window.location.port || window.location.port === '5500') 
  ? 'http://127.0.0.1:5000' 
  : '';

// --- UYGULAMA İÇİ ÖZEL DİYALOG VE ONAY SİSTEMİ (BROWSER POPUPLARI YERİNE) ---
let _appConfirmResolve = null;
let _appPromptResolve = null;

function showCustomConfirm(message, title = "Onay Gerekiyor", okText = "Onayla", cancelText = "Vazgeç", icon = "⚠️") {
  return new Promise((resolve) => {
    _appConfirmResolve = resolve;
    const modal = document.getElementById('modal-app-confirm');
    if (!modal) {
      resolve(true);
      return;
    }
    const tEl = document.getElementById('app-confirm-title-text');
    const iEl = document.getElementById('app-confirm-icon');
    const mEl = document.getElementById('app-confirm-msg');
    const okEl = document.getElementById('app-confirm-btn-ok');
    const cancelEl = document.getElementById('app-confirm-btn-cancel');

    if (tEl) tEl.innerText = title;
    if (iEl) iEl.innerText = icon;
    if (mEl) mEl.innerText = message;
    if (okEl) okEl.innerText = okText;
    if (cancelEl) cancelEl.innerText = cancelText;

    modal.style.display = 'flex';
  });
}

function _resolveAppConfirm(val) {
  const modal = document.getElementById('modal-app-confirm');
  if (modal) modal.style.display = 'none';
  if (_appConfirmResolve) {
    _appConfirmResolve(val);
    _appConfirmResolve = null;
  }
}

function showCustomPrompt(message, defaultValue = "", title = "Bilgi Girişi", okText = "Kaydet", cancelText = "İptal") {
  return new Promise((resolve) => {
    _appPromptResolve = resolve;
    const modal = document.getElementById('modal-app-prompt');
    if (!modal) {
      resolve(defaultValue);
      return;
    }
    const tEl = document.getElementById('app-prompt-title-text');
    const mEl = document.getElementById('app-prompt-msg');
    const input = document.getElementById('app-prompt-input');

    if (tEl) tEl.innerText = title;
    if (mEl) mEl.innerText = message;
    if (input) input.value = defaultValue;

    modal.style.display = 'flex';
    setTimeout(() => {
      if (input) {
        input.focus();
        input.select();
      }
    }, 50);
  });
}

function _resolveAppPrompt(val) {
  const modal = document.getElementById('modal-app-prompt');
  if (modal) modal.style.display = 'none';
  if (_appPromptResolve) {
    _appPromptResolve(val);
    _appPromptResolve = null;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initAppTheme();
  renderTemplateList();
  renderBarcode();
  checkBackendAndDevices();
  loadCurrentDate();
  loadTemplates();
  loadSettings();
  loadMobileQrCode();
  loadCatalog();
  initDraftTracking();

  // F5 Yenilemelerinde Son Aktif Sekmeyi Aç
  const hashTab = window.location.hash ? window.location.hash.replace('#', '') : null;
  const savedTab = hashTab || localStorage.getItem('active_tab') || 'tab-print';
  switchTab(savedTab);

  // Başlangıçta sunucudan veya yerelden kaydedilmemiş taslak/önbellek kontrolü
  setTimeout(() => {
    checkUnsavedDraftOnStartup();
  }, 400);

  // Enter ile Onayla / Shift+Enter ile Alt Satıra Geç
  document.addEventListener('keydown', (e) => {
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.classList.contains('editable-text') || activeEl.classList.contains('custom-text-node') || activeEl.getAttribute('contenteditable') === 'true')) {
      if (e.key === 'Enter') {
        if (e.shiftKey) {
          // Shift+Enter: Alt satıra geçmesine izin ver
          return;
        } else {
          // Tek Enter: Onayla, yeni satır açma ve odağı bırak
          e.preventDefault();
          activeEl.blur();
        }
      }
    }
  });
});

// TEMA YÖNETİMİ (Koyu / Açık Mod)
function initAppTheme() {
  const savedTheme = localStorage.getItem('app_theme') || 'dark';
  applyAppTheme(savedTheme);
}

function toggleAppTheme() {
  const isLight = document.body.classList.contains('light-theme');
  const newTheme = isLight ? 'dark' : 'light';
  applyAppTheme(newTheme);
}

function applyAppTheme(theme) {
  const isLight = (theme === 'light');
  
  if (isLight) {
    document.body.classList.add('light-theme');
  } else {
    document.body.classList.remove('light-theme');
  }

  // Yuvarlak ve hap tema butonlarını güncelle
  document.querySelectorAll('.btn-theme-circle').forEach(btn => {
    btn.innerHTML = isLight ? `<span>☀️</span>` : `<span>🌙</span>`;
    btn.title = isLight ? "Koyu Moda Geç" : "Açık Moda Geç";
  });

  document.querySelectorAll('.btn-theme-pill').forEach(btn => {
    btn.innerHTML = isLight ? `<span>☀️</span> <span>Açık Mod</span>` : `<span>🌙</span> <span>Koyu Mod</span>`;
  });

  localStorage.setItem('app_theme', theme);
}

// Güncel Tarihi İnternetten Al ve Doldur
async function loadCurrentDate() {
  try {
    const res = await fetch(`${API_BASE}/api/current-date`);
    const data = await res.json();
    if (data.status === 'success' && data.date) {
      const dateInp = document.getElementById('inp-date');
      const dateLbl = document.getElementById('lbl-date');
      const editorDateLbl = document.getElementById('editor-lbl-date');
      if (dateInp) dateInp.value = data.date;
      if (dateLbl) dateLbl.innerText = data.date;
      if (editorDateLbl) editorDateLbl.innerText = data.date;
    }
  } catch(e) {}
}

// 1. SOL SIDEBAR SEKME GEÇİŞLERİ (F5 KALICILIĞI İLE)
function switchTab(tabId) {
  if (!tabId || !document.getElementById(tabId)) {
    tabId = 'tab-print';
  }

  // Kalıcılık kaydı
  localStorage.setItem('active_tab', tabId);
  try {
    history.replaceState(null, null, '#' + tabId);
  } catch (e) {}

  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));

  const activeTabEl = document.getElementById(tabId);
  if (activeTabEl) {
    activeTabEl.classList.add('active');
  }

  // Katalog ve Güncelleme sekmeleri için tam ekran kiti
  if (tabId === 'tab-catalog' || tabId === 'tab-sync') {
    document.body.classList.add('on-catalog');
  } else {
    document.body.classList.remove('on-catalog');
  }

  const heading = document.getElementById('page-heading');
  const subheading = document.getElementById('page-subheading');
  const topbarActions = document.getElementById('topbar-actions-box');

  if (topbarActions) {
    topbarActions.style.display = (tabId === 'tab-print') ? 'flex' : 'none';
  }

  // Aktif menü butonunu belirle
  document.querySelectorAll('.nav-item').forEach(btn => {
    const attr = btn.getAttribute('onclick') || '';
    if (attr.includes(`'${tabId}'`)) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  if (tabId === 'tab-print') {
    if (heading) heading.innerText = '🏷️ Etiket Çıkart';
    if (subheading) subheading.innerText = 'Hızlı veri girişi, canlı önizleme ve doğrudan termal baskı';
  } else if (tabId === 'tab-design') {
    if (heading) heading.innerText = '🎨 Etiket Düzenle & Şablonlar';
    if (subheading) subheading.innerText = 'Özel etiket modelleri oluşturun, özelleştirin ve kaydedin';
    loadTemplates();
  } else if (tabId === 'tab-catalog') {
    loadCatalog();
  } else if (tabId === 'tab-sync') {
    if (heading) heading.innerText = '📊 Katalog Güncelleme & Fiyat Senkronizasyonu';
    if (subheading) subheading.innerText = 'Sistem Excel / CSV (.xlsx, .csv) stok listesini içe aktarın, fiyat farklarını tespit edin ve toplu etiket basın';
    loadSyncStatus();
  } else if (tabId === 'tab-backups') {
    if (heading) heading.innerText = '💾 Veritabanı & Fiyat Yedekleri';
    if (subheading) subheading.innerText = 'Tüm ürün, fiyat ve etiket ayarlarınızın güvenlik yedekleri ve geri yükleme merkezi';
    loadBackupsList();
  } else if (tabId === 'tab-qr') {
    if (heading) heading.innerText = '📱 Mobil QR Bağlantısı';
    if (subheading) subheading.innerText = 'Telefonunuzla reyonlarda gezerken ürün okutup anında etiket basın';
    loadMobileQrCode();
    checkBackendAndDevices();
  } else if (tabId === 'tab-settings') {
    if (heading) heading.innerText = '⚙️ Sistem & Donanım Ayarları';
    if (subheading) subheading.innerText = 'Yazıcı, kağıt ölçüsü, ofset kalibrasyonu ve mağaza bilgileri';
    loadSettings();
  }
}

// 2. BACKEND & YAZICI DURUMU
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

// 3. MOBİL QR KOD YÜKLEME
async function loadMobileQrCode() {
  try {
    const res = await fetch(`${API_BASE}/api/network/ip`);
    const data = await res.json();
    if (data.status === 'success') {
      const mobileUrl = data.mobile_url;
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

// 4. STOK ARAMA & OTOMATİK DOLDURMA (5000+ Ürün)
let searchTimeout = null;
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

// Arama kutusu dışına tıklandığında dropdown'ı kapat
document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('stock-dropdown');
  const searchInp = document.getElementById('inp-stock-search');
  if (dropdown && !dropdown.contains(e.target) && e.target !== searchInp) {
    dropdown.style.display = 'none';
  }
});

function selectProductFromStock(p) {
  const fullTitle = p.title || p.title1 || '';
  // Uzunsa satırlara böl
  if (fullTitle.length > 25) {
    const parts = fullTitle.split(' ');
    const mid = Math.ceil(parts.length / 2);
    document.getElementById('inp-prod-title-1').value = parts.slice(0, mid).join(' ');
    document.getElementById('inp-prod-title-2').value = parts.slice(mid).join(' ');
  } else {
    document.getElementById('inp-prod-title-1').value = fullTitle;
    document.getElementById('inp-prod-title-2').value = p.title2 || '';
  }
  
  if (p.brand) document.getElementById('inp-brand').value = p.brand;
  document.getElementById('inp-barcode').value = p.barcode || '';
  document.getElementById('inp-price').value = p.price || '';
  
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
    alert("Lütfen en az Barkod ve Ürün Adı girin!");
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
      alert(`✓ "${fullTitle}" başarıyla ürün stoğuna kaydedildi.`);
    }
  } catch (e) {
    alert("Stok kaydetme hatası!");
  }
}

// 5. ŞABLON & MODEL YÖNETİMİ
async function loadTemplates() {
  try {
    const res = await fetch(`${API_BASE}/api/templates`);
    const data = await res.json();
    if (data.status === 'success' && data.templates && data.templates.length > 0) {
      templatesList = data.templates;
    }
  } catch (e) {}
  renderTemplateList();
  applyTemplate(activeTemplateId);
}

function renderTemplateList() {
  const listEl = document.getElementById('template-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  if (!templatesList || templatesList.length === 0) {
    templatesList = [{
      id: "default",
      name: "Varsayılan Standart Model",
      is_locked: true,
      top_right_mode: "empty",
      top_right_text: "",
      description: "Görsel 2 standart fabrika raf etiketi."
    }];
  }

  templatesList.forEach(tpl => {
    const card = document.createElement('div');
    const isSelected = tpl.id === (editingTemplateId || activeTemplateId);
    const isDefault = tpl.id === activeTemplateId;
    
    card.className = `tpl-item-card ${isSelected ? 'active' : ''}`;
    card.innerHTML = `
      <div class="tpl-info" style="width:100%;">
        <div style="display:flex; align-items:center; justify-content:space-between; width:100%; margin-bottom:4px;">
          <h4 style="font-size:12.5px; font-weight:800; color:#f8fafc;">${tpl.is_locked ? '🔒 ' : '🎨 '}${tpl.name}</h4>
          ${isDefault ? '<span class="badge-default-active">⭐ Varsayılan</span>' : ''}
        </div>
        <p style="font-size:11px; color:var(--text-muted); line-height:1.3;">${tpl.description || ''}</p>
      </div>
    `;
    card.onclick = () => {
      editingTemplateId = tpl.id;
      renderTemplateList();
      openTemplateInEditor(tpl);
    };
    listEl.appendChild(card);
  });

  const currentTpl = templatesList.find(t => t.id === (editingTemplateId || activeTemplateId)) || templatesList[0];
  if (currentTpl) {
    openTemplateInEditor(currentTpl);
  }
}

function applyTemplate(tplId) {
  const tpl = templatesList.find(t => t.id === tplId) || templatesList[0];
  if (!tpl) return;

  currentTopRightMode = tpl.top_right_mode || 'empty';
  const badge = document.getElementById('current-design-badge');
  if (badge) {
    badge.innerText = `${tpl.is_locked ? '🔒 ' : '🎨 '}${tpl.name}`;
  }

  updateTopRightPreview(tpl.top_right_mode, tpl.top_right_text);
}

function setCurrentTemplateAsDefault() {
  const tplId = editingTemplateId || activeTemplateId || 'default';
  const tpl = templatesList.find(t => t.id === tplId);
  if (!tpl) return;

  activeTemplateId = tpl.id;
  applyTemplate(activeTemplateId);
  renderTemplateList();
  alert(`⭐ "${tpl.name}" baskılarda kullanılacak varsayılan model olarak ayarlandı!`);
}

let selectedCanvasElement = null;

function openTemplateInEditor(tpl) {
  editingTemplateId = tpl.id;
  const badgeName = document.getElementById('editor-preview-name');
  if (badgeName) badgeName.innerText = `${tpl.is_locked ? '🔒 ' : '🎨 '}${tpl.name}`;
  
  const defaultBtn = document.getElementById('btn-set-default');
  const renameBtn = document.getElementById('btn-rename-template');
  const deleteBtn = document.getElementById('btn-delete-template');

  if (defaultBtn) {
    if (tpl.id === activeTemplateId) {
      defaultBtn.innerText = "⭐ Varsayılan Model";
      defaultBtn.style.borderColor = "#fbbf24";
      defaultBtn.style.color = "#fbbf24";
    } else {
      defaultBtn.innerText = "⭐️ Varsayılan Yap";
      defaultBtn.style.borderColor = "var(--border-color)";
      defaultBtn.style.color = "white";
    }
  }

  // Fabrika Başlangıç Modeli Koruma Kuralı
  if (tpl.is_locked || tpl.id === 'default') {
    if (renameBtn) renameBtn.style.display = 'none';
    if (deleteBtn) deleteBtn.style.display = 'none';
  } else {
    if (renameBtn) renameBtn.style.display = 'inline-flex';
    if (deleteBtn) deleteBtn.style.display = 'inline-flex';
  }

  // Özel katmanları yükle
  renderCustomLayers(tpl.custom_layers || []);
  updateEditorPreview();
}

// -------------------------------------------------------------
// MODEL ADI DEĞİŞTİRME & SİLME & ONAYLI KAYDETME
// -------------------------------------------------------------

function openRenameModal() {
  const currentTpl = templatesList.find(t => t.id === editingTemplateId);
  if (!currentTpl || currentTpl.is_locked) {
    alert("Fabrika ayarı başlangıç modelinin adı değiştirilemez!");
    return;
  }

  const modal = document.getElementById('modal-rename-template');
  const input = document.getElementById('modal-inp-rename-name');
  if (modal && input) {
    input.value = currentTpl.name || '';
    modal.style.display = 'flex';
    setTimeout(() => input.focus(), 50);
  }
}

function closeRenameModal() {
  const modal = document.getElementById('modal-rename-template');
  if (modal) modal.style.display = 'none';
}

async function submitRenameModal() {
  const input = document.getElementById('modal-inp-rename-name');
  const newName = input ? input.value.trim() : '';

  if (!newName) {
    alert("Lütfen geçerli bir model adı girin!");
    return;
  }

  const currentTpl = templatesList.find(t => t.id === editingTemplateId);
  if (!currentTpl) return;

  currentTpl.name = newName;
  closeRenameModal();
  renderTemplateList();
  openTemplateInEditor(currentTpl);

  // Arka planda sunucuya kaydet
  try {
    await fetch(`${API_BASE}/api/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentTpl)
    });
  } catch(e) {}
}

async function deleteCurrentTemplate() {
  const currentTpl = templatesList.find(t => t.id === editingTemplateId);
  if (!currentTpl || currentTpl.is_locked || currentTpl.id === 'default') {
    alert("Fabrika başlangıç modeli silinemez!");
    return;
  }

  if (!confirm(`"${currentTpl.name}" modelini kalıcı olarak silmek istediğinize emin misiniz?`)) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/templates/${editingTemplateId}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (data.status === 'success') {
      templatesList = templatesList.filter(t => t.id !== editingTemplateId);
      editingTemplateId = 'default';
      activeTemplateId = 'default';
      await loadTemplates();
      alert("✓ Model başarıyla silindi.");
    }
  } catch(e) {
    templatesList = templatesList.filter(t => t.id !== editingTemplateId);
    editingTemplateId = 'default';
    renderTemplateList();
  }
}

// -------------------------------------------------------------
// İNTERAKTİF TUVAL (CANVAS) ÇİZİM VE ELEMAN YÖNETİMİ
// -------------------------------------------------------------

function addTextToCanvas() {
  const container = document.getElementById('editor-custom-layers');
  if (!container) return;

  const id = `el_text_${Date.now()}`;
  const el = document.createElement('div');
  el.className = 'custom-canvas-element';
  el.id = id;
  el.style.left = '30px';
  el.style.top = '40px';

  el.innerHTML = `<span class="custom-text-node" contenteditable="true" spellcheck="false">YENİ METİN</span>`;
  container.appendChild(el);

  makeDraggable(el);
  selectCanvasElement(el);
}

function addLineToCanvas() {
  const container = document.getElementById('editor-custom-layers');
  if (!container) return;

  const id = `el_line_${Date.now()}`;
  const el = document.createElement('div');
  el.className = 'custom-canvas-element';
  el.id = id;
  el.style.left = '20px';
  el.style.top = '60px';
  el.style.width = '120px';

  el.innerHTML = `<div class="custom-line-node" style="width:100%;"></div>`;
  container.appendChild(el);

  makeDraggable(el);
  selectCanvasElement(el);
}

function addBoxToCanvas() {
  const container = document.getElementById('editor-custom-layers');
  if (!container) return;

  const id = `el_box_${Date.now()}`;
  const el = document.createElement('div');
  el.className = 'custom-canvas-element';
  el.id = id;
  el.style.left = '160px';
  el.style.top = '10px';

  el.innerHTML = `<div class="custom-box-node" style="width:65px; height:28px;"></div>`;
  container.appendChild(el);

  makeDraggable(el);
  selectCanvasElement(el);
}

function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const container = document.getElementById('editor-custom-layers');
    if (!container) return;

    const id = `el_img_${Date.now()}`;
    const el = document.createElement('div');
    el.className = 'custom-canvas-element custom-image-node';
    el.id = id;
    el.style.left = '200px';
    el.style.top = '10px';
    el.style.width = '45px';

    el.innerHTML = `<img src="${e.target.result}" style="width:100%; height:auto;">`;
    container.appendChild(el);

    makeDraggable(el);
    selectCanvasElement(el);
  };
  reader.readAsDataURL(file);
  event.target.value = ''; // Reset input
}

function selectCanvasElement(el) {
  deselectAllElements();
  selectedCanvasElement = el;
  el.classList.add('element-selected');
  
  const deleteBtn = document.getElementById('btn-delete-selected-el');
  if (deleteBtn) deleteBtn.style.display = 'inline-flex';
}

function deselectAllElements() {
  selectedCanvasElement = null;
  document.querySelectorAll('.custom-canvas-element').forEach(el => {
    el.classList.remove('element-selected');
  });
  const deleteBtn = document.getElementById('btn-delete-selected-el');
  if (deleteBtn) deleteBtn.style.display = 'none';
}

function onCanvasBackgroundClick(event) {
  if (event.target.classList.contains('studio-canvas-area') || event.target.id === 'editor-shelf-label') {
    deselectAllElements();
  }
}

function deleteSelectedElement() {
  if (selectedCanvasElement) {
    selectedCanvasElement.remove();
    deselectAllElements();
  }
}

function makeDraggable(element) {
  let isDragging = false;
  let startX, startY, origLeft, origTop;

  element.addEventListener('mousedown', (e) => {
    // Eğer düzenlenebilir metin içine tıklandıysa ve zaten seçiliyse sürüklemeyi başlatma
    if (e.target.getAttribute('contenteditable') === 'true' && document.activeElement === e.target) {
      return;
    }
    
    selectCanvasElement(element);
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;

    origLeft = parseInt(element.style.left) || 0;
    origTop = parseInt(element.style.top) || 0;

    e.preventDefault();
    e.stopPropagation();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    element.style.left = `${Math.max(0, origLeft + dx)}px`;
    element.style.top = `${Math.max(0, origTop + dy)}px`;
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });
}

function renderCustomLayers(layers) {
  const container = document.getElementById('editor-custom-layers');
  if (!container) return;
  container.innerHTML = '';

  layers.forEach(l => {
    const el = document.createElement('div');
    el.className = 'custom-canvas-element';
    el.id = l.id;
    el.style.left = l.left || '10px';
    el.style.top = l.top || '10px';
    if (l.width) el.style.width = l.width;

    el.innerHTML = l.html;
    container.appendChild(el);
    makeDraggable(el);
  });
}

// Şablonu Tüm Katmanlarıyla Kaydet
async function saveTemplateFromEditor() {
  const currentTpl = templatesList.find(t => t.id === editingTemplateId) || {};
  const tplName = currentTpl.name || "Mevcut Model";

  if (!confirm(`"${tplName}" şablonu üzerindeki değişiklikleri kaydetmek istediğinize emin misiniz?`)) {
    return;
  }
  
  // Katmanları topla
  const customLayers = [];
  document.querySelectorAll('#editor-custom-layers .custom-canvas-element').forEach(el => {
    customLayers.push({
      id: el.id,
      left: el.style.left,
      top: el.style.top,
      width: el.style.width,
      html: el.innerHTML
    });
  });

  const payload = {
    id: editingTemplateId || `tpl_${Date.now()}`,
    name: currentTpl.name || "Özel Etiket Modeli",
    description: currentTpl.description || "Görsel düzenlenmiş model.",
    top_right_mode: "empty",
    top_right_text: "",
    custom_layers: customLayers,
    is_locked: currentTpl.is_locked || false
  };

  try {
    const res = await fetch(`${API_BASE}/api/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.status === 'success') {
      await loadTemplates();
      alert("✓ Etiket modeli ve görsel düzenlemeler başarıyla kaydedildi!");
    }
  } catch(e) {
    alert("Şablon kaydedildi!");
  }
}

// Editördeki Değişiklikleri Sağdaki Canlı Önizleme Etiketine Anında Yansıt
function updateEditorPreview() {
  const mode = document.getElementById('tpl-top-right-mode') ? document.getElementById('tpl-top-right-mode').value : 'empty';
  const customText = document.getElementById('inp-tpl-custom-text') ? document.getElementById('inp-tpl-custom-text').value : '';
  const tplName = document.getElementById('inp-tpl-name') ? document.getElementById('inp-tpl-name').value : '';
  const badgeName = document.getElementById('editor-preview-name');
  if (badgeName) badgeName.innerText = tplName || "Önizleme";

  const box = document.getElementById('editor-lbl-top-right-box');
  const titleArea = document.getElementById('editor-title-area');
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
          <span class="u-val">250,00 ₺/Kg</span>
        </div>
      `;
    } else if (mode === 'weight') {
      box.innerHTML = `<div class="tr-badge">${customText || 'NET: 35 GR'}</div>`;
    } else if (mode === 'code') {
      box.innerHTML = `<div class="tr-badge">${customText || 'REYON: A-04'}</div>`;
    } else if (mode === 'campaign') {
      box.innerHTML = `<div class="tr-badge-dark">${customText || 'SÜPER FİYAT'}</div>`;
    } else if (mode === 'qr') {
      box.innerHTML = `<div class="tr-qr-box" id="editor-qr-container"></div>`;
      try {
        QRCode.toCanvas(document.getElementById('editor-qr-container'), customText || 'https://market.com', { width: 32, margin: 0 });
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

  // Editör barkodunu çiz
  try {
    JsBarcode("#editor-barcode-svg", "8690504114925", {
      format: "EAN13",
      lineColor: "#000",
      width: 1.15,
      height: 22,
      displayValue: true,
      fontSize: 9,
      font: "Inter",
      textMargin: 1,
      margin: 0
    });
  } catch(e) {}
}

let editorScale = 1;
function adjustEditorScale(factor) {
  editorScale = Math.min(Math.max(editorScale * factor, 0.5), 3.0);
  applyEditorScale();
}

function resetEditorScale() {
  editorScale = 1;
  applyEditorScale();
}

function applyEditorScale() {
  const el = document.getElementById('editor-shelf-label');
  if (el) el.style.transform = `scale(${editorScale})`;
  const zoomTxt = document.getElementById('zoom-text-editor');
  if (zoomTxt) zoomTxt.innerText = `${Math.round(editorScale * 100)}%`;
}

async function saveTemplateFromEditor() {
  const name = document.getElementById('inp-tpl-name').value.trim();
  const desc = document.getElementById('inp-tpl-desc').value.trim();
  const mode = document.getElementById('tpl-top-right-mode').value;
  const customText = document.getElementById('inp-tpl-custom-text').value.trim();

  if (!name) {
    alert("Lütfen model adı girin!");
    return;
  }

  const payload = {
    id: editingTemplateId || `tpl_${Date.now()}`,
    name: name,
    description: desc,
    top_right_mode: mode,
    top_right_text: customText
  };

  try {
    const res = await fetch(`${API_BASE}/api/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.status === 'success') {
      activeTemplateId = data.template.id;
      editingTemplateId = data.template.id;
      await loadTemplates();
      showToast("✓ Etiket modeli başarıyla kaydedildi!", "success");
    }
  } catch (e) {
    showToast("❌ Şablon kaydetme hatası!", "error");
  }
}

async function deleteCurrentTemplate() {
  if (!editingTemplateId || editingTemplateId === 'default') return;
  const ok = await showCustomConfirm("Bu etiket modelini silmek istediğinize emin misiniz?", "Modeli Sil", "Evet, Sil", "Vazgeç", "🗑️");
  if (!ok) return;

  try {
    const res = await fetch(`${API_BASE}/api/templates/${editingTemplateId}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (data.status === 'success') {
      activeTemplateId = 'default';
      editingTemplateId = 'default';
      await loadTemplates();
      showToast("✓ Model silindi.", "success");
    }
  } catch (e) {}
}

// 6. CANLI ÖNİZLEME GÜNCELLEMELERİ (ANA EKRAN)
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
  const pr = document.getElementById('inp-price')?.value || '';

  if (document.getElementById('lbl-title-1')) document.getElementById('lbl-title-1').innerText = t1.toUpperCase();
  if (document.getElementById('lbl-title-2')) document.getElementById('lbl-title-2').innerText = t2.toUpperCase();
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

// 7. YAZDIRMA İŞLEMİ (MASAÜSTÜ)
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

// 8. AYARLAR YÖNETİMİ
async function loadSettings() {
  try {
    const res = await fetch(`${API_BASE}/api/settings`);
    const data = await res.json();
    if (data.status === 'success' && data.settings) {
      const s = data.settings;
      if (s.printer && document.getElementById('settings-printer-select')) {
        document.getElementById('settings-printer-select').value = s.printer;
      }
      if (s.market_name) {
        document.getElementById('settings-market-name').value = s.market_name;
        document.getElementById('inp-brand').value = s.market_name;
      }
      if (s.darkness) document.getElementById('settings-darkness').value = s.darkness;
      if (s.x_offset !== undefined) document.getElementById('settings-x-offset').value = s.x_offset;
      if (s.y_offset !== undefined) document.getElementById('settings-y-offset').value = s.y_offset;
      if (s.width_mm && s.height_mm) {
        currentWidth = s.width_mm;
        currentHeight = s.height_mm;
        document.getElementById('settings-size-select').value = `${s.width_mm}x${s.height_mm}`;
      }
    }
  } catch (e) {}
}

async function saveSettings() {
  const sizeVal = document.getElementById('settings-size-select').value.split('x');
  const payload = {
    printer: document.getElementById('settings-printer-select').value,
    orientation: document.getElementById('settings-orient-select').value,
    width_mm: parseInt(sizeVal[0]),
    height_mm: parseInt(sizeVal[1]),
    market_name: document.getElementById('settings-market-name').value.trim(),
    darkness: parseInt(document.getElementById('settings-darkness').value),
    x_offset: parseInt(document.getElementById('settings-x-offset').value),
    y_offset: parseInt(document.getElementById('settings-y-offset').value)
  };

  try {
    const res = await fetch(`${API_BASE}/api/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.status === 'success') {
      alert("✓ Sistem ayarları başarıyla kaydedildi!");
      loadSettings();
    }
  } catch (e) {
    alert("Ayarları kaydetme hatası!");
  }
}

// 9. ZOOM KONTROLLERİ (ANA EKRAN)
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

// =============================================================
// 10. ÜRÜN KATALOĞU (FİRMA / MARKA FİLTRELERİ & HIZLI BASKI)
// =============================================================

let allCatalogProducts = [];
let filteredCatalogProducts = [];
let catalogRenderedCount = 100;
let currentSortColumn = null;
let currentSortDirection = 'asc'; // 'asc' veya 'desc'
let catalogStatusFilter = 'ALL'; // 'ALL', 'OUTDATED', 'MATCHED'

function formatBarcodeDisplay(bc) {
  if (!bc) return '-';
  let str = String(bc).trim();
  if (str.endsWith(',00') || str.endsWith('.00')) {
    str = str.slice(0, -3);
  } else if (str.endsWith(',0') || str.endsWith('.0')) {
    str = str.slice(0, -2);
  }
  if (str.includes('E+') || str.includes('e+') || str.includes('E-') || str.includes('e-') || (str.includes('E') && /\d/.test(str))) {
    try {
      const num = Number(str.replace(',', '.'));
      if (!isNaN(num) && num > 0) {
        return Math.round(num).toString();
      }
    } catch(e) {}
  }
  return str;
}

function isLabelPriceUpToDate(p) {
  if (!p) return true;
  const sysVal = parsePrice(p.price);
  const labelVal = parsePrice(p.label_price || p.price);
  if (p.label_price !== undefined && p.label_price !== null && p.label_price !== "") {
    return Math.abs(sysVal - labelVal) < 0.01;
  }
  return true;
}

function setCatalogStatusFilter(filterType) {
  catalogStatusFilter = filterType;
  const pillAll = document.getElementById('pill-filter-all');
  const pillOutdated = document.getElementById('pill-filter-outdated');
  const pillMatched = document.getElementById('pill-filter-matched');

  if (pillAll) pillAll.classList.toggle('active', filterType === 'ALL');
  if (pillOutdated) pillOutdated.classList.toggle('active', filterType === 'OUTDATED');
  if (pillMatched) pillMatched.classList.toggle('active', filterType === 'MATCHED');

  onCatalogFilterChange();
}

function updateCatalogStatusCounts() {
  let total = allCatalogProducts.length;
  let outdated = 0;
  let matched = 0;

  allCatalogProducts.forEach(p => {
    if (isLabelPriceUpToDate(p)) {
      matched++;
    } else {
      outdated++;
    }
  });

  const cAll = document.getElementById('count-pill-all');
  const cOutdated = document.getElementById('count-pill-outdated');
  const cMatched = document.getElementById('count-pill-matched');

  if (cAll) cAll.innerText = total.toLocaleString('tr-TR');
  if (cOutdated) cOutdated.innerText = outdated.toLocaleString('tr-TR');
  if (cMatched) cMatched.innerText = matched.toLocaleString('tr-TR');
}

async function loadCatalog() {
  try {
    const res = await fetch(`${API_BASE}/api/products`);
    const data = await res.json();
    if (data.status === 'success' && data.products) {
      allCatalogProducts = data.products;
      populateBrandFilterOptions();
      setupCatalogScrollListener();
      updateCatalogStatusCounts();
      onCatalogFilterChange();
    }
  } catch(e) {
    console.warn("Katalog ürünleri yüklenirken hata:", e);
  }
}

function populateBrandFilterOptions() {
  const brandSelect = document.getElementById('catalog-brand-select');
  if (!brandSelect) return;

  // Marka frekanslarını topla
  const brandCounts = {};
  allCatalogProducts.forEach(p => {
    const b = (p.brand && p.brand.trim()) || 'DİĞER';
    brandCounts[b] = (brandCounts[b] || 0) + 1;
  });

  // Türkçe Alfabetik Sıralama (A'dan Z'ye)
  const sortedBrands = Object.keys(brandCounts).sort((a, b) => {
    return a.localeCompare(b, 'tr', { sensitivity: 'base' });
  });

  const uniqueBrandCount = sortedBrands.length;
  const currentVal = brandSelect.value;
  brandSelect.innerHTML = `<option value="ALL">🏢 Tüm Firmalar (${uniqueBrandCount})</option>`;

  sortedBrands.forEach(brand => {
    const opt = document.createElement('option');
    opt.value = brand;
    opt.innerText = `${brand} (${brandCounts[brand]} Ürün)`;
    brandSelect.appendChild(opt);
  });

  if (currentVal) brandSelect.value = currentVal;
}

// Türkçe karakter ve büyük/küçük harf normalizasyonu (i/ı, ş/s, ğ/g, ü/u, ö/o, ç/c)
function normalizeTurkish(str) {
  if (!str) return '';
  const charMap = {
    'İ': 'i', 'I': 'i', 'ı': 'i', 'i': 'i',
    'Ş': 's', 'ş': 's',
    'Ğ': 'g', 'ğ': 'g',
    'Ü': 'u', 'ü': 'u',
    'Ö': 'o', 'ö': 'o',
    'Ç': 'c', 'ç': 'c'
  };
  return String(str)
    .replace(/[İIıiŞşĞğÜüÖöÇç]/g, ch => charMap[ch] || ch.toLowerCase())
    .toLowerCase();
}

function getProductRelevanceScore(p, normQuery, queryTokens) {
  const normTitle = normalizeTurkish(p.title || p.title1 || '');
  const normBarcode = normalizeTurkish(p.barcode || '');
  const normBrand = normalizeTurkish(p.brand || '');
  
  let score = 0;
  if (normBarcode === normQuery) score += 1000;
  else if (normBarcode.startsWith(normQuery)) score += 500;
  else if (normBarcode.includes(normQuery)) score += 300;

  if (normTitle === normQuery) score += 800;
  else if (normTitle.startsWith(normQuery)) score += 400;
  else if (normTitle.includes(normQuery)) score += 250;

  if (queryTokens.every(tok => normTitle.includes(tok))) {
    score += 150;
    if (queryTokens.length > 0 && normTitle.startsWith(queryTokens[0])) {
      score += 50;
    }
  }

  if (normBrand && queryTokens.some(tok => normBrand.includes(tok))) {
    score += 30;
  }

  score += Math.max(0, 40 - normTitle.length);
  return score;
}

function onCatalogFilterChange() {
  const rawSearch = document.getElementById('catalog-search-inp')?.value || '';
  const normSearch = normalizeTurkish(rawSearch).trim();
  const searchTokens = normSearch ? normSearch.split(/\s+/).filter(Boolean) : [];
  const selectedBrand = document.getElementById('catalog-brand-select')?.value || 'ALL';

  updateCatalogStatusCounts();

  // 1. Filtrele
  filteredCatalogProducts = allCatalogProducts.filter(p => {
    const matchesBrand = (selectedBrand === 'ALL') || (p.brand === selectedBrand);
    if (!matchesBrand) return false;

    // Etiket Durumu Filtresi (Tümü / Güncel Değil / Güncel)
    if (catalogStatusFilter === 'OUTDATED' && isLabelPriceUpToDate(p)) return false;
    if (catalogStatusFilter === 'MATCHED' && !isLabelPriceUpToDate(p)) return false;

    if (searchTokens.length === 0) return true;
    const fullTarget = `${p.barcode || ''} ${p.title || ''} ${p.brand || ''}`;
    const normFull = normalizeTurkish(fullTarget);
    return searchTokens.every(tok => normFull.includes(tok));
  });

  // 2. Eğer sütun sıralaması aktifse sırala, değilse arama varsa alakalılık puanına göre sırala
  if (currentSortColumn) {
    applyColumnSorting();
  } else if (searchTokens.length > 0) {
    filteredCatalogProducts.sort((a, b) => {
      const scoreA = getProductRelevanceScore(a, normSearch, searchTokens);
      const scoreB = getProductRelevanceScore(b, normSearch, searchTokens);
      return scoreB - scoreA;
    });
  }

  // 3. Render sayacını sıfırla ve çiz
  catalogRenderedCount = 100;
  renderCatalogTable(true);
}

// Sütun Başlığına Tıklayarak Sıralama (A-Z ve Z-A)
function sortCatalogColumn(columnKey) {
  if (currentSortColumn === columnKey) {
    currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    currentSortColumn = columnKey;
    currentSortDirection = 'asc';
  }

  updateSortIcons();
  applyColumnSorting();
  catalogRenderedCount = 100;
  renderCatalogTable(true);
}

function applyColumnSorting() {
  const dir = currentSortDirection === 'asc' ? 1 : -1;

  filteredCatalogProducts.sort((a, b) => {
    if (currentSortColumn === 'price') {
      return (parsePrice(a.price) - parsePrice(b.price)) * dir;
    } else if (currentSortColumn === 'label_price') {
      return (parsePrice(a.label_price || a.price) - parsePrice(b.label_price || b.price)) * dir;
    } else if (currentSortColumn === 'status') {
      const aUp = isLabelPriceUpToDate(a) ? 1 : 0;
      const bUp = isLabelPriceUpToDate(b) ? 1 : 0;
      return (aUp - bUp) * dir;
    } else if (currentSortColumn === 'barcode') {
      return (a.barcode || '').localeCompare(b.barcode || '') * dir;
    } else if (currentSortColumn === 'brand') {
      return (a.brand || '').localeCompare(b.brand || '', 'tr') * dir;
    } else if (currentSortColumn === 'title') {
      return (a.title || '').localeCompare(b.title || '', 'tr') * dir;
    } else if (currentSortColumn === 'date') {
      return ((a.date || '19 Ağu 2026').localeCompare(b.date || '19 Ağu 2026', 'tr')) * dir;
    }
    return 0;
  });
}

function updateSortIcons() {
  ['brand', 'barcode', 'title', 'price', 'label_price', 'date', 'status'].forEach(col => {
    const iconEl = document.getElementById(`sort-ico-${col}`);
    if (iconEl) {
      if (currentSortColumn === col) {
        iconEl.innerText = currentSortDirection === 'asc' ? '▲' : '▼';
        iconEl.style.color = '#38bdf8';
        iconEl.style.opacity = '1';
      } else {
        iconEl.innerText = '↕';
        iconEl.style.color = '';
        iconEl.style.opacity = '0.5';
      }
    }
  });
}

function parsePrice(pStr) {
  if (!pStr) return 0;
  const clean = String(pStr).replace('TL', '').replace('tl', '').replace('₺', '').replace(',', '.').trim();
  return parseFloat(clean) || 0;
}

// Akıcı Sonsuz Kaydırma (Infinite Scroll)
function setupCatalogScrollListener() {
  const container = document.getElementById('catalog-scroll-container');
  if (!container) return;

  container.addEventListener('scroll', () => {
    if (container.scrollTop + container.clientHeight >= container.scrollHeight - 150) {
      if (catalogRenderedCount < filteredCatalogProducts.length) {
        catalogRenderedCount += 100;
        renderCatalogTable(false);
      }
    }
  });
}

// =========================================================
// KATALOG ÇOKLU SEÇİM & TOPLU YAZDIRMA SİSTEMİ (ANCHOR RANGE SELECTION)
// =========================================================
let selectedBarcodes = new Set();
let anchorIndex = -1; // İlk tıklanan referans başlangıç satırı (Anchor)
let baseSelection = new Set(); // Ctrl/Tekli seçimlerin temel kümesi

function showToast(msg, type = "info") {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.position = 'fixed';
    container.style.top = '20px';
    container.style.right = '20px';
    container.style.zIndex = '99999';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const bg = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#0284c7';
  toast.style.background = bg;
  toast.style.color = '#ffffff';
  toast.style.padding = '10px 18px';
  toast.style.borderRadius = '8px';
  toast.style.fontWeight = '700';
  toast.style.fontSize = '13px';
  toast.style.boxShadow = '0 4px 14px rgba(0,0,0,0.35)';
  toast.style.transition = 'all 0.3s ease';
  toast.style.opacity = '0';
  toast.style.transform = 'translateY(-10px)';
  toast.innerText = msg;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  }, 10);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function formatCatalogDate(p) {
  if (p.updated_at) return p.updated_at;
  if (p.date) {
    if (p.date.includes(':')) return p.date;
    return `${p.date} 15:47`;
  }
  const dateInp = document.getElementById('inp-date')?.value || '19 Ağu 2026';
  return `${dateInp} 15:47`;
}

function handleCatalogRowClick(barcode, event) {
  // Buton veya checkbox'a direkt tıklandıysa çift tetiklemeyi önle
  if (event.target.closest('button') || event.target.tagName === 'BUTTON') return;
  if (event.target.tagName === 'INPUT' && event.target.type === 'checkbox') return;

  const clickedIdx = filteredCatalogProducts.findIndex(p => p.barcode === barcode);
  if (clickedIdx === -1) return;

  if (event.shiftKey && anchorIndex !== -1) {
    // SHIFT + CLICK: İlk tıklanan çıpadan (Anchor) itibaren dinamik aralık
    // Geri veya ileri tıklandığında eski aralık otomatik iptal edilir ve [anchor, yeni] aralığı seçilir
    if (event.ctrlKey || event.metaKey) {
      selectedBarcodes = new Set(baseSelection);
    } else {
      selectedBarcodes.clear();
    }

    const start = Math.min(anchorIndex, clickedIdx);
    const end = Math.max(anchorIndex, clickedIdx);
    for (let i = start; i <= end; i++) {
      const item = filteredCatalogProducts[i];
      if (item && item.barcode) {
        selectedBarcodes.add(item.barcode);
      }
    }
  } else if (event.ctrlKey || event.metaKey) {
    // CTRL + CLICK: Tekli Ekle/Kaldır
    if (selectedBarcodes.has(barcode)) {
      selectedBarcodes.delete(barcode);
    } else {
      selectedBarcodes.add(barcode);
    }
    anchorIndex = clickedIdx;
    baseSelection = new Set(selectedBarcodes);
  } else {
    // Normal Düz Tıklama: Yeni çıpa (Anchor) belirle ve seç
    if (selectedBarcodes.size === 1 && selectedBarcodes.has(barcode)) {
      // Zaten sadece bu seçiliyse kaldır
      selectedBarcodes.clear();
      anchorIndex = -1;
      baseSelection.clear();
    } else {
      selectedBarcodes.clear();
      selectedBarcodes.add(barcode);
      anchorIndex = clickedIdx;
      baseSelection = new Set([barcode]);
    }
  }

  updateBatchActionBar();
  updateRowSelections();
}

function onRowCheckboxChange(barcode, checked, event) {
  const clickedIdx = filteredCatalogProducts.findIndex(p => p.barcode === barcode);
  if (clickedIdx === -1) return;

  if (event && event.shiftKey && anchorIndex !== -1) {
    // Shift ile kutucuk tıklandığında dinamik aralık
    selectedBarcodes.clear();
    const start = Math.min(anchorIndex, clickedIdx);
    const end = Math.max(anchorIndex, clickedIdx);
    for (let i = start; i <= end; i++) {
      const item = filteredCatalogProducts[i];
      if (item && item.barcode) {
        selectedBarcodes.add(item.barcode);
      }
    }
  } else {
    if (checked) {
      selectedBarcodes.add(barcode);
    } else {
      selectedBarcodes.delete(barcode);
    }
    anchorIndex = clickedIdx;
    baseSelection = new Set(selectedBarcodes);
  }

  updateBatchActionBar();
  updateRowSelections();
}

function toggleSelectAllCatalog(checked) {
  if (checked) {
    filteredCatalogProducts.forEach(p => {
      if (p.barcode) selectedBarcodes.add(p.barcode);
    });
    baseSelection = new Set(selectedBarcodes);
  } else {
    selectedBarcodes.clear();
    baseSelection.clear();
  }
  anchorIndex = -1;
  updateBatchActionBar();
  updateRowSelections();
}

function clearCatalogSelection() {
  selectedBarcodes.clear();
  baseSelection.clear();
  anchorIndex = -1;
  const selectAllChk = document.getElementById('catalog-select-all-chk');
  if (selectAllChk) {
    selectAllChk.checked = false;
    selectAllChk.indeterminate = false;
  }
  updateBatchActionBar();
  updateRowSelections();
}

function updateBatchActionBar() {
  const bar = document.getElementById('catalog-batch-bar');
  const countEl = document.getElementById('batch-selected-count');
  const btnPrint = document.getElementById('btn-batch-print');
  const selectAllChk = document.getElementById('catalog-select-all-chk');

  const count = selectedBarcodes.size;

  if (bar) {
    if (count > 0) {
      bar.style.display = 'flex';
      if (countEl) countEl.innerText = `${count} ürün seçildi`;
      if (btnPrint) btnPrint.innerText = `🖨️ Seçili ${count} Ürünü Toplu Yazdır`;
    } else {
      bar.style.display = 'none';
    }
  }

  if (selectAllChk) {
    if (filteredCatalogProducts.length > 0 && count >= filteredCatalogProducts.length) {
      selectAllChk.checked = true;
      selectAllChk.indeterminate = false;
    } else if (count > 0) {
      selectAllChk.checked = false;
      selectAllChk.indeterminate = true;
    } else {
      selectAllChk.checked = false;
      selectAllChk.indeterminate = false;
    }
  }
}

function updateRowSelections() {
  const tbody = document.getElementById('catalog-tbody');
  if (!tbody) return;

  const rows = tbody.querySelectorAll('tr[data-barcode]');
  rows.forEach(tr => {
    const barcode = tr.getAttribute('data-barcode');
    const chk = tr.querySelector('.catalog-row-chk');
    const isSelected = selectedBarcodes.has(barcode);

    if (isSelected) {
      tr.classList.add('selected-row');
      if (chk) chk.checked = true;
    } else {
      tr.classList.remove('selected-row');
      if (chk) chk.checked = false;
    }
  });
}

function renderCatalogTable(reset = true) {
  const tbody = document.getElementById('catalog-tbody');
  const statsBadge = document.getElementById('catalog-stats-badge');
  const pageInfo = document.getElementById('catalog-page-info');

  if (!tbody) return;

  const total = filteredCatalogProducts.length;
  if (statsBadge) statsBadge.innerText = `${total.toLocaleString('tr-TR')} Ürün`;

  const itemsToRender = filteredCatalogProducts.slice(0, catalogRenderedCount);

  if (pageInfo) {
    pageInfo.innerText = total > 0 
      ? `Toplam ${total.toLocaleString('tr-TR')} ürün listeleniyor (İlk ${itemsToRender.length.toLocaleString('tr-TR')} gösteriliyor - kaydırarak devam edin)`
      : `Eşleşen ürün bulunamadı.`;
  }

  if (reset) {
    tbody.innerHTML = '';
  }

  if (itemsToRender.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">
          🔍 Aradığınız kriterlere uygun ürün bulunamadı.
        </td>
      </tr>
    `;
    return;
  }

  const startIdx = reset ? 0 : tbody.children.length;
  const newChunk = itemsToRender.slice(startIdx);

  const fragment = document.createDocumentFragment();
  newChunk.forEach(p => {
    const tr = document.createElement('tr');
    const isSelected = selectedBarcodes.has(p.barcode);
    if (isSelected) tr.className = 'selected-row';
    tr.setAttribute('data-barcode', p.barcode);
    tr.onclick = (e) => handleCatalogRowClick(p.barcode, e);

    const displayDate = formatCatalogDate(p);
    const isUpToDate = isLabelPriceUpToDate(p);
    const labelPriceText = p.label_price || p.price;
    const labelPriceBadge = isUpToDate
      ? `<span class="badge-label-price matched">${labelPriceText}</span>`
      : `<span class="badge-label-price outdated" title="Basılan Raf Etiketi Fiyatı: ${labelPriceText}">${labelPriceText}</span>`;

    const statusBadge = isUpToDate
      ? `<span class="badge-label-status matched">✅ Güncel</span>`
      : `<button class="btn-label-status outdated" onclick="event.stopPropagation(); syncSingleProductLabelAndPrint('${p.barcode}')" title="Fiyat güncellendi ama etiket basılmadı! Tıklayarak etiketi basın ve güncelleyin">⚠️ Güncel Değil</button>`;

    tr.innerHTML = `
      <td style="text-align: center;">
        <input type="checkbox" class="catalog-row-chk" data-barcode="${p.barcode}" ${isSelected ? 'checked' : ''} onchange="onRowCheckboxChange('${p.barcode}', this.checked, event)">
      </td>
      <td><span class="badge-brand">${p.brand || 'DİĞER'}</span></td>
      <td><span class="barcode-text">${formatBarcodeDisplay(p.barcode)}</span></td>
      <td style="font-weight: 700; color: var(--text-main);">${p.title}</td>
      <td style="text-align: right;"><span class="price-text">${p.price}</span></td>
      <td style="text-align: right;">${labelPriceBadge}</td>
      <td style="text-align: center;"><span class="date-text">${displayDate}</span></td>
      <td style="text-align: center;">${statusBadge}</td>
      <td style="text-align: center;">
        <button class="btn-sm btn-primary" style="padding: 4px 10px; font-size: 11px;" onclick="event.stopPropagation(); printProductFromCatalog('${p.barcode}')" title="Bu ürünün etiketini tasarımcıya yükle ve bas">
          🏷️ Bas
        </button>
      </td>
    `;
    fragment.appendChild(tr);
  });

  tbody.appendChild(fragment);
  updateBatchActionBar();
}

async function syncSingleProductLabelAndPrint(barcode) {
  const product = allCatalogProducts.find(p => p.barcode === barcode);
  if (!product) return;

  try {
    const res = await fetch(`${API_BASE}/api/catalog/sync-label-price`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode: barcode })
    });
    const data = await res.json();
    if (data.status === 'success') {
      product.label_price = product.price;
      onCatalogFilterChange();
      showToast(`✓ '${product.title}' etiket fiyatı güncellendi. Tasarımcıya alınıyor...`, "success");
      printProductFromCatalog(barcode);
    } else {
      showToast(`Hata: ${data.message}`, "error");
    }
  } catch (e) {
    showToast(`Bağlantı hatası: ${e.message}`, "error");
  }
}

function selectProduct(p) {
  selectProductFromStock(p);
}

function printProductFromCatalog(barcode) {
  const product = allCatalogProducts.find(p => p.barcode === barcode);
  if (!product) return;

  // 1. Ana Etiket Çıkart sekmesine aktar
  selectProduct(product);
  
  // 2. Etiket Çıkart sekmesini aç
  switchTab('tab-print');
}

async function submitBatchPrint() {
  const count = selectedBarcodes.size;
  if (count === 0) {
    showToast("Lütfen önce tablodan yazdırılacak ürünleri seçin.", "warning");
    return;
  }

  const selectedProducts = allCatalogProducts.filter(p => selectedBarcodes.has(p.barcode));
  if (selectedProducts.length === 0) {
    showToast("Seçilen ürünler bulunamadı.", "error");
    return;
  }

  const copies = parseInt(document.getElementById('batch-copies-inp')?.value || '1') || 1;
  const btnPrint = document.getElementById('btn-batch-print');
  const origText = btnPrint ? btnPrint.innerText : '';

  if (btnPrint) {
    btnPrint.disabled = true;
    btnPrint.innerText = `⏳ Yazdırılıyor (${count} Ürün)...`;
  }

  try {
    const activeTpl = templatesList.find(t => t.id === activeTemplateId) || templatesList[0] || {};
    const payload = {
      products: selectedProducts,
      printer: selectedPrinter,
      orientation: "POR",
      width_mm: currentWidth,
      height_mm: currentHeight,
      x_offset: parseInt(document.getElementById('settings-x-offset')?.value || 0),
      y_offset: parseInt(document.getElementById('settings-y-offset')?.value || 0),
      dpi: 203,
      copies_per_item: copies,
      template: activeTpl
    };

    const res = await fetch(`${API_BASE}/api/print/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (result.status === 'success') {
      selectedProducts.forEach(p => {
        p.label_price = p.price;
      });
      onCatalogFilterChange();
      showToast(`✓ ${result.message}`, "success");
      clearCatalogSelection();
    } else {
      showToast(`❌ ${result.message}`, "error");
    }
  } catch (err) {
    showToast(`❌ Bağlantı hatası: ${err.message}`, "error");
  } finally {
    if (btnPrint) {
      btnPrint.disabled = false;
      btnPrint.innerText = origText;
    }
  }
}

// Klavye Kısayolları (Ctrl+A ile tümünü seç, Esc ile seçimi kaldır)
document.addEventListener('keydown', (e) => {
  const catalogTab = document.getElementById('tab-catalog');
  const syncTab = document.getElementById('tab-sync');
  
  if (catalogTab && catalogTab.classList.contains('active')) {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      toggleSelectAllCatalog(true);
    } else if (e.key === 'Escape') {
      clearCatalogSelection();
    }
  } else if (syncTab && syncTab.classList.contains('active')) {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      toggleSelectAllSync(true);
    } else if (e.key === 'Escape') {
      clearSyncSelection();
    }
  }
});

// =========================================================
// SEKME: KATALOG SENKRONİZASYON & EXCEL DİFF YÖNETİMİ
// =========================================================
let currentSyncData = null;
let activeSyncFilter = 'changed'; // 'changed', 'new', 'all', 'matched', 'blacklisted'
let syncSearchQuery = '';
let filteredSyncItems = [];
let selectedSyncBarcodes = new Set();
let syncAnchorIndex = -1;
let syncBaseSelection = new Set();

// Sürükle Bırak Olayları Kurulumu
document.addEventListener('DOMContentLoaded', () => {
  setupSyncDropzone();
});

function setupSyncDropzone() {
  const dropzone = document.getElementById('sync-dropzone');
  if (!dropzone) return;

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('drag-over');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('drag-over');
    }, false);
  });

  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files && files.length > 0) {
      handleExcelUploadFile(files[0]);
    }
  });
}

// 1. Durum ve Son Analizi Yükle
async function loadSyncStatus(isManual = false) {
  const tbody = document.getElementById('sync-tbody');
  if (tbody && !currentSyncData) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">⏳ Sistem Excel dosyası analiz ediliyor...</td></tr>`;
  }

  try {
    const res = await fetch(`${API_BASE}/api/catalog/sync-status?force=1&_=${Date.now()}`);
    const data = await res.json();

    if (data.status === 'success') {
      currentSyncData = data;
      updateSyncStatsBadges();
      renderSyncTable();
      if (isManual) showToast("✓ Sistem Excel analizi güncellendi.", "success");
    } else {
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">
              📂 Henüz yüklenmiş bir dosya yok. Yukarıdan bir <strong>.xlsx</strong> veya <strong>.csv</strong> dosyası yükleyin.
            </td>
          </tr>
        `;
      }
    }
  } catch (err) {
    console.error("Sync status error:", err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 40px; color: #ef4444;">❌ Veri yükleme hatası: ${err.message}</td></tr>`;
    }
  }
}

// 2. Dosya Seçildiğinde Yükle
function onExcelFileSelected(event) {
  const file = event.target.files[0];
  if (file) {
    handleExcelUploadFile(file);
  }
}

async function handleExcelUploadFile(file) {
  const fileNameLower = file.name.toLowerCase();
  if (!fileNameLower.endsWith('.xlsx') && !fileNameLower.endsWith('.xls') && !fileNameLower.endsWith('.csv')) {
    showToast("⚠️ Lütfen sadece .xlsx, .xls veya .csv dosyası yükleyin.", "warning");
    return;
  }

  const formData = new FormData();
  formData.append('file', file);

  const titleEl = document.getElementById('sync-upload-title');
  const origTitle = titleEl ? titleEl.innerText : "";
  if (titleEl) titleEl.innerText = "⏳ Dosya Yükleniyor & Taranıyor...";

  try {
    const res = await fetch(`${API_BASE}/api/catalog/upload-excel`, {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (data.status === 'success') {
      currentSyncData = data;
      updateSyncStatsBadges();
      
      // Varsayılan olarak 'Fiyatı Değişenler' sekmesini aç
      if (data.stats && data.stats.changed_count > 0) {
        activeSyncFilter = 'changed';
      } else if (data.stats && data.stats.new_count > 0) {
        activeSyncFilter = 'new';
      } else {
        activeSyncFilter = 'all';
      }
      
      renderSyncTable();
      showToast(`✅ '${file.name}' başarıyla yüklendi ve analiz edildi!`, "success");
    } else {
      showToast(`❌ Yükleme hatası: ${data.message}`, "error");
    }
  } catch (err) {
    showToast(`❌ Bağlantı hatası: ${err.message}`, "error");
  } finally {
    if (titleEl) titleEl.innerText = origTitle;
    const inp = document.getElementById('sync-file-input');
    if (inp) inp.value = '';
  }
}

// 3. İstatistik ve Dosya Rozetlerini Güncelle
function updateSyncStatsBadges() {
  if (!currentSyncData) return;

  const stats = currentSyncData.stats || {};
  const filename = currentSyncData.filename || "stok.xlsx";
  const updatedTime = currentSyncData.updated_at || "";

  const fnEl = document.getElementById('sync-current-filename');
  const ftEl = document.getElementById('sync-current-filetime');
  if (fnEl) fnEl.innerText = filename;
  if (ftEl) ftEl.innerText = updatedTime ? `(${updatedTime})` : '';

  // Pill sayaçları
  const pillChanged = document.getElementById('pill-count-changed');
  const pillNew = document.getElementById('pill-count-new');
  const pillMatched = document.getElementById('pill-count-matched');
  const pillBlack = document.getElementById('pill-count-blacklisted');
  const pillAll = document.getElementById('pill-count-all');
  const topBtnCount = document.getElementById('top-btn-changed-count');

  if (pillChanged) pillChanged.innerText = (stats.changed_count || 0).toLocaleString('tr-TR');
  if (pillNew) pillNew.innerText = (stats.new_count || 0).toLocaleString('tr-TR');
  if (pillMatched) pillMatched.innerText = (stats.matched_count || 0).toLocaleString('tr-TR');
  if (pillBlack) pillBlack.innerText = (stats.blacklisted_count || 0).toLocaleString('tr-TR');
  if (pillAll) pillAll.innerText = (stats.total_excel_rows || 0).toLocaleString('tr-TR');
  if (topBtnCount) topBtnCount.innerText = (stats.changed_count || 0).toLocaleString('tr-TR');
}

// 4. Filtreleme Sekmelerini Değiştir
function filterSyncTab(filterName) {
  activeSyncFilter = filterName;

  // Stat kartları aktiflik durumu
  const statCards = document.querySelectorAll('.sync-stat-card, .stat-chip');
  statCards.forEach(c => c.classList.remove('active-filter'));

  // Pill butonları aktiflik durumu
  const pillBtns = document.querySelectorAll('.sync-pill-btn');
  pillBtns.forEach(b => b.classList.remove('active'));

  const pillMap = {
    'changed': 'pill-changed',
    'new': 'pill-new',
    'all': 'pill-all',
    'matched': 'pill-matched',
    'blacklisted': 'pill-blacklisted'
  };
  const activePill = document.getElementById(pillMap[filterName] || 'pill-changed');
  if (activePill) activePill.classList.add('active');

  clearSyncSelection();
  renderSyncTable();
}

function onSyncSearchInput(val) {
  syncSearchQuery = (val || '').trim();
  renderSyncTable();
}

let syncRenderedCount = 100;

function setupSyncScrollListener() {
  const wrapper = document.querySelector('.sync-table-wrapper');
  if (!wrapper || wrapper._hasScrollListener) return;
  wrapper._hasScrollListener = true;
  wrapper.addEventListener('scroll', () => {
    if (wrapper.scrollTop + wrapper.clientHeight >= wrapper.scrollHeight - 300) {
      if (syncRenderedCount < filteredSyncItems.length) {
        syncRenderedCount += 100;
        renderSyncTable(false);
      }
    }
  });
}

// 5. Senkronizasyon Tablosunu Çiz (Yüksek Performanslı Chunk Rendering & Dinamik Sütunlar)
function updateSyncTableHeaders() {
  const thBrand = document.getElementById('sync-th-brand');
  const thCurrentTitle = document.getElementById('sync-th-current-title');
  const thCurrentPrice = document.getElementById('sync-th-current-price');
  const thExcelTitle = document.getElementById('sync-th-excel-title');
  const thExcelPrice = document.getElementById('sync-th-excel-price');

  if (activeSyncFilter === 'new') {
    if (thBrand) thBrand.style.display = '';
    if (thCurrentTitle) thCurrentTitle.style.display = 'none';
    if (thCurrentPrice) thCurrentPrice.style.display = 'none';
    if (thExcelTitle) thExcelTitle.style.width = '35%';
    if (thExcelPrice) thExcelPrice.style.width = '14%';
  } else {
    if (thBrand) thBrand.style.display = 'none';
    if (thCurrentTitle) thCurrentTitle.style.display = '';
    if (thCurrentPrice) thCurrentPrice.style.display = '';
    if (thExcelTitle) thExcelTitle.style.width = '25%';
    if (thExcelPrice) thExcelPrice.style.width = '10%';
  }
}

async function editNewProductBrand(barcode) {
  const item = (currentSyncData && currentSyncData.new_products && currentSyncData.new_products.find(p => p.barcode === barcode))
            || (filteredSyncItems && filteredSyncItems.find(p => p.barcode === barcode));
  if (!item) return;

  const currentBrand = item.brand || '';
  const newBrand = await showCustomPrompt(
    `'${item.excel_title}' ürünü için marka girin veya seçin:`,
    currentBrand || "ÜLKER",
    "🏷️ Marka Belirle"
  );
  if (newBrand === null) return;

  item.brand = (newBrand.trim().toUpperCase()) || 'DİĞER';
  item.brand_detected = item.brand !== 'DİĞER' && item.brand !== '';
  showToast(`✓ '${item.excel_title}' markası '${item.brand}' olarak ayarlandı.`, "success");
  renderSyncTable(true);
}

function renderSyncTable(reset = true) {
  const tbody = document.getElementById('sync-tbody');
  if (!tbody) return;

  updateSyncTableHeaders();
  setupSyncScrollListener();

  if (!currentSyncData) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">Sistem verisi bulunamadı.</td></tr>`;
    return;
  }

  if (reset) {
    syncRenderedCount = 100;
    // 1. Aktif filtreye göre ürün havuzunu topla
    let rawList = [];
    if (activeSyncFilter === 'suggested') {
      rawList = [
        ...(currentSyncData.changed_prices || []),
        ...(currentSyncData.new_products || [])
      ];
    } else if (activeSyncFilter === 'changed') {
      rawList = currentSyncData.changed_prices || [];
    } else if (activeSyncFilter === 'new') {
      rawList = currentSyncData.new_products || [];
    } else if (activeSyncFilter === 'matched') {
      rawList = currentSyncData.matched_products || [];
    } else if (activeSyncFilter === 'blacklisted') {
      rawList = currentSyncData.blacklisted_items || [];
    } else {
      rawList = [
        ...(currentSyncData.changed_prices || []),
        ...(currentSyncData.new_products || []),
        ...(currentSyncData.matched_products || []),
        ...(currentSyncData.blacklisted_items || [])
      ];
    }

    // 2. Arama filtresi uygula
    if (syncSearchQuery) {
      const q = normalizeTurkish(syncSearchQuery);
      const words = q.split(/\s+/).filter(Boolean);
      filteredSyncItems = rawList.filter(item => {
        const b = (item.barcode || '').toLowerCase();
        const t1 = normalizeTurkish(item.excel_title || '');
        const t2 = normalizeTurkish(item.current_title || '');
        const br = normalizeTurkish(item.brand || '');
        const combined = `${b} ${t1} ${t2} ${br}`;
        return words.every(w => combined.includes(w));
      });
    } else {
      filteredSyncItems = rawList;
    }

    tbody.innerHTML = '';
  }

  const isNewTab = activeSyncFilter === 'new';
  const totalCols = isNewTab ? 7 : 8;

  if (filteredSyncItems.length === 0) {
    let emptyMsg = "Eşleşen kayıt bulunamadı.";
    if (activeSyncFilter === 'changed') emptyMsg = "🎉 Harika! Fiyatı değişen ürün bulunmuyor, tüm raf etiketleri güncel.";
    else if (activeSyncFilter === 'new') emptyMsg = "✨ Yeni eklenen ürün bulunmuyor.";
    tbody.innerHTML = `
      <tr>
        <td colspan="${totalCols}" style="text-align: center; padding: 40px; color: var(--text-muted); font-size: 13px;">
          ${emptyMsg}
        </td>
      </tr>
    `;
    updateSyncBatchActionBar();
    return;
  }

  const startIdx = reset ? 0 : tbody.children.length;
  const itemsToRender = filteredSyncItems.slice(startIdx, syncRenderedCount);
  const fragment = document.createDocumentFragment();

  itemsToRender.forEach((item) => {
    const tr = document.createElement('tr');
    const isSelected = selectedSyncBarcodes.has(item.barcode);
    if (isSelected) tr.className = 'selected-row';
    tr.setAttribute('data-barcode', item.barcode);
    tr.onclick = (e) => handleSyncRowClick(item.barcode, e);

    // Durum rozeti
    let statusBadge = "";
    let actionBtn = "";
    const isBlack = activeSyncFilter === 'blacklisted' || item.status === 'blacklisted' || item.reason;

    if (isBlack) {
      statusBadge = `<span class="badge-sync-status blacklisted">🚫 Kara Liste</span>`;
      actionBtn = `<span style="color: var(--text-muted); font-size:11px; font-weight:600;">Engellendi</span>`;
    } else if (item.status === 'changed') {
      const isUp = (item.diff_amount || 0) > 0;
      const diffBadge = `<span class="price-diff-badge ${isUp ? 'up' : 'down'}">${isUp ? '+' : ''}${item.diff_amount} TL (${item.diff_percent}%)</span>`;
      statusBadge = `<span class="badge-sync-status changed">⚠️ Fiyat Değişti</span>${diffBadge}`;
      actionBtn = `
        <button class="btn-sm btn-secondary" style="font-size:11px; padding:4px 10px; font-weight:700;" onclick="event.stopPropagation(); syncSingleItemPriceOnly('${item.barcode}', '${item.excel_price}')" title="Bu fiyatı kataloğa aktar">
          💾 Güncelle
        </button>
      `;
    } else if (item.status === 'new') {
      statusBadge = `<span class="badge-sync-status new">✨ Yeni Ürün</span>`;
      const brandVal = (item.brand || 'DİĞER').replace(/'/g, "\\'");
      actionBtn = `
        <button class="btn-sm btn-primary" style="font-size:11px; padding:4px 10px; font-weight:700;" onclick="event.stopPropagation(); syncSingleItemNewOnly('${item.barcode}', '${item.excel_price}', '${(item.excel_title || '').replace(/'/g, "\\'")}', '${brandVal}')" title="Stoğa yeni ürün olarak ekle">
          ➕ Stoğa Ekle
        </button>
      `;
    } else {
      statusBadge = `<span class="badge-sync-status matched">✅ Uyumlu</span>`;
      actionBtn = `<span style="color: #34d399; font-size:11px; font-weight:700;">✓ Güncel</span>`;
    }

    if (isNewTab) {
      // YENİ ÜRÜNLER ÖZEL GÖRÜNÜMÜ: Marka sütunu var, Etiket Adı ve Raf Fiyatı gizli
      const hasBrand = Boolean(item.brand && item.brand !== 'DİĞER' && item.brand.trim() !== '');
      let brandCell = "";
      if (hasBrand) {
        brandCell = `
          <div style="display:flex; align-items:center; gap:5px;">
            <span style="background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid rgba(56,189,248,0.3); padding:2px 8px; border-radius:6px; font-size:11px; font-weight:800;">${item.brand}</span>
            <button class="btn-sm btn-secondary" onclick="event.stopPropagation(); editNewProductBrand('${item.barcode}')" style="padding:1px 5px; font-size:10px; opacity:0.75;" title="Markayı Düzenle">✏️</button>
          </div>
        `;
      } else {
        brandCell = `
          <button class="btn-sm" onclick="event.stopPropagation(); editNewProductBrand('${item.barcode}')" style="background:rgba(245,158,11,0.2); color:#f59e0b; border:1px solid #f59e0b; padding:3px 8px; font-size:11px; font-weight:800; border-radius:6px; cursor:pointer;" title="Marka tespit edilemedi, belirlemek için tıklayın">
            ⚠️ Marka Seçin ▾
          </button>
        `;
      }

      tr.innerHTML = `
        <td style="text-align: center;">
          <input type="checkbox" class="sync-row-chk" data-barcode="${item.barcode}" ${isSelected ? 'checked' : ''} onchange="onSyncCheckboxChange('${item.barcode}', this.checked, event)">
        </td>
        <td><span class="barcode-text">${formatBarcodeDisplay(item.barcode)}</span></td>
        <td>${brandCell}</td>
        <td style="font-weight: 700; color: var(--text-main); font-size:12.5px;">${item.excel_title || '-'}</td>
        <td style="text-align: right; font-weight: 800; color: #38bdf8;">${item.excel_price || '-'}</td>
        <td style="text-align: center;">${statusBadge}</td>
        <td style="text-align: center;">${actionBtn}</td>
      `;
    } else {
      // STANDART GÖRÜNÜM
      const currentTitleDisplay = (item.current_title && item.current_title !== '-') ? item.current_title : '-';
      const currentTitleStyle = (item.current_title && item.current_title !== '-') ? 'font-weight: 700; color: var(--text-main);' : 'color: var(--text-muted); font-style: italic;';

      tr.innerHTML = `
        <td style="text-align: center;">
          <input type="checkbox" class="sync-row-chk" data-barcode="${item.barcode}" ${isSelected ? 'checked' : ''} onchange="onSyncCheckboxChange('${item.barcode}', this.checked, event)">
        </td>
        <td><span class="barcode-text">${formatBarcodeDisplay(item.barcode)}</span></td>
        <td style="color: var(--text-muted); font-size:11.5px;">${item.excel_title || '-'}</td>
        <td style="${currentTitleStyle}">${currentTitleDisplay}</td>
        <td style="text-align: right; color: var(--text-muted);">${item.current_price || '-'}</td>
        <td style="text-align: right; font-weight: 800; color: #38bdf8;">${item.excel_price || '-'}</td>
        <td style="text-align: center;">${statusBadge}</td>
        <td style="text-align: center;">${actionBtn}</td>
      `;
    }

    fragment.appendChild(tr);
  });

  tbody.appendChild(fragment);
  updateSyncBatchActionBar();
}

// 6. Anchor-Based Çoklu Seçim & Akıllı Satır Tıklaması
function handleSyncRowClick(barcode, event) {
  if (event.target.closest('button') || event.target.tagName === 'BUTTON') return;
  if (event.target.tagName === 'INPUT' && event.target.type === 'checkbox') return;

  const isModifierPressed = (event.shiftKey || event.ctrlKey || event.metaKey);

  // 1. Hiçbir seçim yokken ve Ctrl/Shift basılı DEĞİLSE -> Ürün Detayını Aç!
  if (selectedSyncBarcodes.size === 0 && !isModifierPressed) {
    openSyncProductDetailModal(barcode);
    return;
  }

  // 2. Halihazırda seçim yapılmışsa veya Ctrl/Shift ile tıklanmışsa -> Seçim Sistemi Çalışsın!
  const clickedIdx = filteredSyncItems.findIndex(p => p.barcode === barcode);
  if (clickedIdx === -1) return;

  if (event.shiftKey && syncAnchorIndex !== -1) {
    if (event.ctrlKey || event.metaKey) {
      selectedSyncBarcodes = new Set(syncBaseSelection);
    } else {
      selectedSyncBarcodes.clear();
    }

    const start = Math.min(syncAnchorIndex, clickedIdx);
    const end = Math.max(syncAnchorIndex, clickedIdx);
    for (let i = start; i <= end; i++) {
      const item = filteredSyncItems[i];
      if (item && item.barcode) {
        selectedSyncBarcodes.add(item.barcode);
      }
    }
  } else if (event.ctrlKey || event.metaKey) {
    if (selectedSyncBarcodes.has(barcode)) {
      selectedSyncBarcodes.delete(barcode);
      if (selectedSyncBarcodes.size === 0) syncAnchorIndex = -1;
    } else {
      selectedSyncBarcodes.add(barcode);
      syncAnchorIndex = clickedIdx;
    }
    syncBaseSelection = new Set(selectedSyncBarcodes);
  } else {
    // Halihazırda en az 1 seçim varken düz tıklandığında:
    if (selectedSyncBarcodes.has(barcode)) {
      selectedSyncBarcodes.delete(barcode);
      if (selectedSyncBarcodes.size === 0) syncAnchorIndex = -1;
    } else {
      selectedSyncBarcodes.add(barcode);
      syncAnchorIndex = clickedIdx;
      syncBaseSelection = new Set(selectedSyncBarcodes);
    }
  }

  updateSyncBatchActionBar();
  updateSyncRowSelections();
}

function openSyncProductDetailModal(barcode) {
  const item = filteredSyncItems.find(p => p.barcode === barcode) || allCatalogProducts.find(p => p.barcode === barcode);
  if (!item) return;

  const modal = document.getElementById('modal-sync-product-detail');
  if (!modal) return;

  modal.style.display = 'flex';
  const hasValidCurrentTitle = item.current_title && item.current_title !== '-';
  document.getElementById('sync-detail-title').innerText = hasValidCurrentTitle ? item.current_title : (item.excel_title || item.title || "Ürün Detayı");
  document.getElementById('sync-detail-barcode').innerText = item.barcode;
  document.getElementById('sync-detail-current-price').innerText = item.current_price || item.price || "-";
  document.getElementById('sync-detail-excel-price').innerText = item.excel_price || item.price || "-";
  document.getElementById('sync-detail-excel-title').innerText = item.excel_title || "-";
  document.getElementById('sync-detail-current-title').innerText = hasValidCurrentTitle ? item.current_title : "-";
  document.getElementById('sync-detail-brand').innerText = item.brand || "DİĞER";

  let statusText = "✅ Fiyat Uyumlu";
  if (item.status === 'changed') {
    statusText = `⚠️ Fiyat Farkı: ${item.excel_price} (Eski: ${item.current_price})`;
  } else if (item.status === 'new') {
    statusText = "✨ Yeni Ürün";
  } else if (item.status === 'blacklisted') {
    statusText = "🚫 Kara Liste";
  }
  document.getElementById('sync-detail-status').innerText = statusText;

  // Buton Aksiyonları
  document.getElementById('sync-detail-btn-blacklist').onclick = async () => {
    await submitSingleBlacklist(item.barcode, item.excel_title || item.current_title);
    closeSyncProductDetailModal();
  };

  document.getElementById('sync-detail-btn-design').onclick = () => {
    closeSyncProductDetailModal();
    loadProductToDesigner(item.barcode);
  };

  document.getElementById('sync-detail-btn-print').onclick = () => {
    closeSyncProductDetailModal();
    printProductFromCatalog(item.barcode);
  };
}

function closeSyncProductDetailModal() {
  const modal = document.getElementById('modal-sync-product-detail');
  if (modal) modal.style.display = 'none';
}

function loadProductToDesigner(barcode) {
  const item = (filteredSyncItems && filteredSyncItems.find(p => p.barcode === barcode)) 
            || (allCatalogProducts && allCatalogProducts.find(p => p.barcode === barcode));
  if (!item) {
    showToast("Ürün bilgisi bulunamadı.", "error");
    return;
  }

  const fullTitle = (item.current_title && item.current_title !== '-') 
                  ? item.current_title 
                  : (item.excel_title || item.title || item.title1 || '');
  const price = item.excel_price || item.current_price || item.price || '';
  const brand = item.brand || 'YARENLER';

  selectProductFromStock({
    barcode: item.barcode,
    title: fullTitle,
    price: price,
    brand: brand,
    origin: item.origin || 'TÜRKİYE',
    date: item.date
  });

  updatePreviewLive();
  renderBarcode();
  switchTab('tab-print');
  showToast(`🎨 '${fullTitle}' etiket tasarımcısına aktarıldı.`, "info");
}

async function submitSingleBlacklist(barcode, title) {
  try {
    const res = await fetch(`${API_BASE}/api/blacklist/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode: barcode, title: title || "KARA LİSTE" })
    });
    const result = await res.json();
    if (result.status === 'success') {
      showToast("🚫 Ürün kara listeye eklendi.", "success");
      await loadSyncStatus();
    } else {
      showToast(`❌ ${result.message}`, "error");
    }
  } catch (e) {
    showToast(`❌ Bağlantı hatası: ${e.message}`, "error");
  }
}

function onSyncCheckboxChange(barcode, checked, event) {
  const clickedIdx = filteredSyncItems.findIndex(p => p.barcode === barcode);
  if (clickedIdx === -1) return;

  if (event && event.shiftKey && syncAnchorIndex !== -1) {
    selectedSyncBarcodes.clear();
    const start = Math.min(syncAnchorIndex, clickedIdx);
    const end = Math.max(syncAnchorIndex, clickedIdx);
    for (let i = start; i <= end; i++) {
      const item = filteredSyncItems[i];
      if (item && item.barcode) {
        selectedSyncBarcodes.add(item.barcode);
      }
    }
  } else {
    if (checked) {
      selectedSyncBarcodes.add(barcode);
    } else {
      selectedSyncBarcodes.delete(barcode);
    }
    syncAnchorIndex = clickedIdx;
    syncBaseSelection = new Set(selectedSyncBarcodes);
  }

  updateSyncBatchActionBar();
  updateSyncRowSelections();
}

function toggleSelectAllSync(checked) {
  if (checked) {
    filteredSyncItems.forEach(p => {
      if (p.barcode) selectedSyncBarcodes.add(p.barcode);
    });
    syncBaseSelection = new Set(selectedSyncBarcodes);
  } else {
    selectedSyncBarcodes.clear();
    syncBaseSelection.clear();
  }
  syncAnchorIndex = -1;
  updateSyncBatchActionBar();
  updateSyncRowSelections();
}

function clearSyncSelection() {
  selectedSyncBarcodes.clear();
  syncBaseSelection.clear();
  syncAnchorIndex = -1;
  const selectAllChk = document.getElementById('sync-select-all-chk');
  if (selectAllChk) {
    selectAllChk.checked = false;
    selectAllChk.indeterminate = false;
  }
  updateSyncBatchActionBar();
  updateSyncRowSelections();
}

function updateSyncBatchActionBar() {
  const bar = document.getElementById('sync-batch-bar');
  const countEl = document.getElementById('sync-batch-count');
  const selectAllChk = document.getElementById('sync-select-all-chk');
  if (!bar) return;

  const count = selectedSyncBarcodes.size;
  const total = filteredSyncItems.length;

  if (count > 0) {
    bar.style.display = 'flex';
    if (countEl) countEl.innerText = `${count.toLocaleString('tr-TR')} ürün seçildi`;
  } else {
    bar.style.display = 'none';
  }

  if (selectAllChk) {
    if (count > 0 && count === total) {
      selectAllChk.checked = true;
      selectAllChk.indeterminate = false;
    } else if (count > 0) {
      selectAllChk.checked = false;
      selectAllChk.indeterminate = true;
    } else {
      selectAllChk.checked = false;
      selectAllChk.indeterminate = false;
    }
  }
}

function updateSyncRowSelections() {
  const tbody = document.getElementById('sync-tbody');
  if (!tbody) return;

  const rows = tbody.querySelectorAll('tr[data-barcode]');
  rows.forEach(tr => {
    const barcode = tr.getAttribute('data-barcode');
    const chk = tr.querySelector('.sync-row-chk');
    const isSelected = selectedSyncBarcodes.has(barcode);

    if (isSelected) {
      tr.classList.add('selected-row');
      if (chk) chk.checked = true;
    } else {
      tr.classList.remove('selected-row');
      if (chk) chk.checked = false;
    }
  });
}

// 7. Tekli İşlemler
async function syncSingleItemPriceOnly(barcode, newPrice) {
  try {
    const res = await fetch(`${API_BASE}/api/catalog/apply-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: "update_prices",
        items: [{ barcode: barcode, new_price: newPrice }]
      })
    });
    const result = await res.json();
    if (result.status === 'success') {
      showToast("✓ Fiyat güncellendi. Ürün '⚠️ Güncel Değil' olarak işaretlendi.", "success");
      await loadCatalog();
      await loadSyncStatus();
    } else {
      showToast(`❌ Hata: ${result.message}`, "error");
    }
  } catch (e) {
    showToast(`❌ Bağlantı hatası: ${e.message}`, "error");
  }
}

async function syncSingleItemNewOnly(barcode, newPrice, excelTitle, brand) {
  try {
    const res = await fetch(`${API_BASE}/api/catalog/apply-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: "add_new_products",
        items: [{ barcode: barcode, new_price: newPrice, excel_title: excelTitle, brand: brand || 'DİĞER' }]
      })
    });
    const result = await res.json();
    if (result.status === 'success') {
      showToast("✓ Yeni ürün kataloğa eklendi. 'Ürün Kataloğu' sekmesinden etiket basabilirsiniz.", "success");
      await loadCatalog();
      await loadSyncStatus();
    } else {
      showToast(`❌ Hata: ${result.message}`, "error");
    }
  } catch (e) {
    showToast(`❌ Bağlantı hatası: ${e.message}`, "error");
  }
}

async function applyAllChangedPricesFromSync() {
  if (!currentSyncData || !currentSyncData.changed_prices || currentSyncData.changed_prices.length === 0) {
    showToast("Uygulanacak fiyat değişikliği bulunamadı.", "info");
    return;
  }

  const count = currentSyncData.changed_prices.length;
  const ok = await showCustomConfirm(
    `Stok dosyasındaki toplam ${count} adet fiyat değişikliği ürün kataloğuna uygulanacaktır.\n\nHenüz baskı alınmayan bu ürünler katalogda '⚠️ Güncel Değil' olarak işaretlenecektir. Onaylıyor musunuz?`,
    "Tüm Fiyatları Güncelle",
    "Fiyatları Güncelle",
    "Vazgeç",
    "⚡"
  );
  if (!ok) return;

  const itemsToApply = currentSyncData.changed_prices.map(item => ({
    barcode: item.barcode,
    new_price: item.excel_price,
    excel_title: item.excel_title,
    current_title: item.current_title
  }));

  try {
    const res = await fetch(`${API_BASE}/api/catalog/apply-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: "sync_all",
        items: itemsToApply
      })
    });

    const result = await res.json();
    if (result.status === 'success') {
      showToast(`✅ ${result.message}`, "success");
      await loadCatalog();
      await loadSyncStatus();
    } else {
      showToast(`❌ Hata: ${result.message}`, "error");
    }
  } catch (e) {
    showToast(`❌ Bağlantı hatası: ${e.message}`, "error");
  }
}

// --- YEDEK YÖNETİMİ & GERİ YÜKLEME SİSTEMİ (TAB-BACKUPS) ---
async function loadBackupsList(isManual = false) {
  const tbody = document.getElementById('backups-tbody');
  if (!tbody) return;

  try {
    const res = await fetch(`${API_BASE}/api/backup/list`);
    const data = await res.json();
    if (data.status === 'success' && data.backups) {
      if (data.backups.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align:center; padding:40px; color:var(--text-muted);">
              Henüz kayıtlı bir veritabanı yedeği bulunmuyor.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = '';
      data.backups.forEach(b => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="font-weight: 700; color: #38bdf8;">🕒 ${b.date}</td>
          <td style="font-weight: 600; color: var(--text-main);">${b.reason}</td>
          <td style="font-family: monospace; color: var(--text-muted); font-size: 11.5px;">${b.filename}</td>
          <td style="text-align: right; color: var(--text-muted); font-weight: 600;">${b.size}</td>
          <td style="text-align: center;">
            <button class="btn-sm btn-secondary btn-rollback" onclick="restoreBackup('${b.filename}')" title="Bu tarihteki veritabanı haline geri dön" style="padding: 4px 10px; font-size: 11px;">
              ↺ Geri Yükle
            </button>
          </td>
        `;
        tbody.appendChild(tr);
      });

      if (isManual) {
        showToast("✓ Yedek listesi güncellendi.", "info");
      }
    }
  } catch (e) {
    console.error("Yedekler yüklenemedi:", e);
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#ef4444; padding:20px;">Yedekler yüklenirken hata oluştu.</td></tr>`;
  }
}

async function createManualBackup() {
  const reason = await showCustomPrompt("Yedekleme için bir açıklama / not girin:", "Manuel Kullanıcı Yedeği", "➕ Yeni Güvenli Yedek Al");
  if (reason === null) return;

  try {
    const res = await fetch(`${API_BASE}/api/backup/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: (reason && reason.trim()) || "Manuel Kullanıcı Yedeği" })
    });
    const data = await res.json();
    if (data.status === 'success') {
      showToast(`✅ ${data.message}`, "success");
      loadBackupsList();
    } else {
      showToast(`❌ Hata: ${data.message}`, "error");
    }
  } catch (e) {
    showToast(`❌ Bağlantı hatası: ${e.message}`, "error");
  }
}

async function restoreBackup(filename) {
  if (!filename) return;
  const ok = await showCustomConfirm(
    `'${filename}' yedeğindeki veritabanı geri yüklenecektir.\n\nMevcut veritabanınız bu tarihteki haline dönecektir. Devam etmek istiyor musunuz?`,
    "Veritabanı Geri Yükleme",
    "Geri Yükle",
    "Vazgeç",
    "↺"
  );
  if (!ok) return;

  try {
    const res = await fetch(`${API_BASE}/api/backup/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: filename })
    });
    const data = await res.json();
    if (data.status === 'success') {
      showToast(`✅ ${data.message}`, "success");
      await loadCatalog();
      await loadSyncStatus();
      await loadBackupsList();
    } else {
      showToast(`❌ Hata: ${data.message}`, "error");
    }
  } catch (e) {
    showToast(`❌ Bağlantı hatası: ${e.message}`, "error");
  }
}

async function rollbackLatestBackup() {
  const ok = await showCustomConfirm(
    "Son işlemi geri alıp bir önceki güvenlik yedeğine dönmek istediğinize emin misiniz?",
    "Son İşlemi Geri Al",
    "Evet, Geri Al",
    "Vazgeç",
    "↺"
  );
  if (!ok) return;

  try {
    const res = await fetch(`${API_BASE}/api/backup/rollback-latest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.status === 'success') {
      showToast(`✅ ${data.message}`, "success");
      await loadCatalog();
      await loadSyncStatus();
      await loadBackupsList();
    } else {
      showToast(`❌ Hata: ${data.message}`, "error");
    }
  } catch (e) {
    showToast(`❌ Bağlantı hatası: ${e.message}`, "error");
  }
}

// 8. Toplu İşlemler
async function submitSyncBatchApply() {
  if (selectedSyncBarcodes.size === 0) {
    showToast("Lütfen güncellenecek ürünleri seçin.", "warning");
    return;
  }

  const itemsToApply = [];
  selectedSyncBarcodes.forEach(bc => {
    const item = filteredSyncItems.find(p => p.barcode === bc);
    if (item && item.excel_price) {
      itemsToApply.push({
        barcode: item.barcode,
        new_price: item.excel_price,
        excel_title: item.excel_title,
        current_title: item.current_title
      });
    }
  });

  if (itemsToApply.length === 0) {
    showToast("Seçili ürünlerin fiyat bilgisi bulunamadı.", "warning");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/catalog/apply-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: "sync_all",
        items: itemsToApply
      })
    });

    const result = await res.json();
    if (result.status === 'success') {
      showToast(`✅ ${result.message}`, "success");
      clearSyncSelection();
      await loadCatalog();
      await loadSyncStatus();
    } else {
      showToast(`❌ Hata: ${result.message}`, "error");
    }
  } catch (e) {
    showToast(`❌ Bağlantı hatası: ${e.message}`, "error");
  }
}

// --- YÖNETİLEN CANLI BASKI & DURDURMA / İPTAL SİSTEMİ (PC) ---
let printControllerState = {
  isActive: false,
  isPaused: false,
  items: [],
  currentIndex: 0,
  copiesPerItem: 1,
  onComplete: null
};

async function startManagedBatchPrint(productsToPrint, copiesPerItem = 1, onComplete = null) {
  if (!productsToPrint || productsToPrint.length === 0) return;

  printControllerState = {
    isActive: true,
    isPaused: false,
    items: productsToPrint,
    currentIndex: 0,
    copiesPerItem: copiesPerItem,
    onComplete: onComplete
  };

  const modal = document.getElementById('modal-print-progress');
  if (modal) modal.style.display = 'flex';

  updatePrintProgressUI(printControllerState.items[0]);

  for (let i = 0; i < printControllerState.items.length; i++) {
    if (!printControllerState.isActive) break;

    while (printControllerState.isPaused && printControllerState.isActive) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    if (!printControllerState.isActive) break;

    printControllerState.currentIndex = i;
    const currentItem = printControllerState.items[i];
    updatePrintProgressUI(currentItem);

    try {
      const payload = {
        printer: selectedPrinter || "Termal Etiket Yazici",
        products: [currentItem],
        orientation: "POR",
        width_mm: currentWidth,
        height_mm: currentHeight,
        x_offset: parseInt(document.getElementById('settings-x-offset')?.value || 0),
        y_offset: parseInt(document.getElementById('settings-y-offset')?.value || 0),
        dpi: 203,
        copies_per_item: copiesPerItem,
        template: activeTpl
      };

      await fetch(`${API_BASE}/api/print/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch(e) {
      console.warn("Baskı gönderim uyarısı:", e);
    }

    // Etiketler arası kısa bekleme (yazıcının mekanik sağlığı ve durdurma butonuna anında tepki için)
    await new Promise(resolve => setTimeout(resolve, 350));
  }

  const wasActive = printControllerState.isActive;
  const printedItems = [...printControllerState.items];

  if (modal) modal.style.display = 'none';
  printControllerState.isActive = false;
  printControllerState.isPaused = false;

  if (wasActive && printedItems.length > 0) {
    // Yazdırma tamamlandı -> Doğrulama Onay Penceresini Aç!
    openPrintCompletionVerificationModal(printedItems, onComplete);
  }
}

// --- BASKI SONRASI DOĞRULAMA & FİYAT GÜNCELLEME SİSTEMİ (PC) ---
let verifyBatchItems = [];
let verifyMarkedErrorBarcodes = new Set();
let verifyOnCompleteCallback = null;

function openPrintCompletionVerificationModal(items, onComplete = null) {
  verifyBatchItems = items || [];
  verifyMarkedErrorBarcodes.clear();
  verifyOnCompleteCallback = onComplete;

  const modal = document.getElementById('modal-print-completion-verification');
  if (!modal) return;

  renderVerifyPrintRows();
  updateVerifyActionButton();
  modal.style.display = 'flex';
}

function renderVerifyPrintRows() {
  const tbody = document.getElementById('verify-print-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  verifyBatchItems.forEach(item => {
    const tr = document.createElement('tr');
    const isError = verifyMarkedErrorBarcodes.has(item.barcode);
    if (isError) tr.style.background = 'rgba(239, 68, 68, 0.12)';

    tr.innerHTML = `
      <td style="text-align: center;">
        <input type="checkbox" ${isError ? 'checked' : ''} onchange="toggleVerifyItemError('${item.barcode}', this.checked)" style="transform: scale(1.15); cursor: pointer;">
      </td>
      <td style="font-family: monospace; color: #38bdf8;">${item.barcode}</td>
      <td style="font-weight: 600; color: var(--text-main);">${item.title || item.title1 || item.excel_title || ''}</td>
      <td style="text-align: right; font-weight: 800; color: #34d399; padding-right: 14px;">${item.price || item.excel_price || ''}</td>
    `;
    tbody.appendChild(tr);
  });
}

function toggleVerifyItemError(barcode, isChecked) {
  if (isChecked) {
    verifyMarkedErrorBarcodes.add(barcode);
  } else {
    verifyMarkedErrorBarcodes.delete(barcode);
  }
  renderVerifyPrintRows();
  updateVerifyActionButton();
}

function toggleSelectAllVerifyItems() {
  if (verifyMarkedErrorBarcodes.size === verifyBatchItems.length) {
    verifyMarkedErrorBarcodes.clear();
  } else {
    verifyBatchItems.forEach(x => verifyMarkedErrorBarcodes.add(x.barcode));
  }
  renderVerifyPrintRows();
  updateVerifyActionButton();
}

function updateVerifyActionButton() {
  const btn = document.getElementById('btn-verify-action');
  const summary = document.getElementById('verify-status-summary');
  if (!btn) return;

  const total = verifyBatchItems.length;
  const errorCount = verifyMarkedErrorBarcodes.size;
  const successCount = total - errorCount;

  if (errorCount === 0) {
    // Hiç hata yok -> Tümü Başarılı
    btn.innerHTML = `✅ Evet, Tümü Başarıyla Basıldı (Verileri Güncelle)`;
    btn.style.background = "linear-gradient(135deg, #10b981, #059669)";
    btn.style.color = "#ffffff";
    if (summary) summary.innerText = `Tüm ürünler (${total} adet) sistemde güncellenecektir.`;
  } else if (errorCount === total) {
    // Tümü Hatalı -> Hiçbiri güncellenmez
    btn.innerHTML = `❌ Hiçbiri Tamamlanmadı (Fiyatları Güncelleme)`;
    btn.style.background = "linear-gradient(135deg, #ef4444, #b91c1c)";
    btn.style.color = "#ffffff";
    if (summary) summary.innerText = `⚠️ Hiçbir ürün güncellenmeyecek, eski fiyatlar korunacaktır.`;
  } else {
    // Bazıları Hatalı -> Seçilenler Hariç Tamamlandı
    btn.innerHTML = `⚠️ Seçilenler Hariç Tamamlandı (${successCount} Ürünü Güncelle)`;
    btn.style.background = "linear-gradient(135deg, #f59e0b, #d97706)";
    btn.style.color = "#ffffff";
    if (summary) summary.innerText = `${successCount} adet ürünün raf fiyatı güncellenecek, hatalı ${errorCount} ürünün eski fiyatı korunacaktır.`;
  }
}

async function confirmPrintVerificationAction() {
  const total = verifyBatchItems.length;
  const errorCount = verifyMarkedErrorBarcodes.size;
  const successItems = verifyBatchItems.filter(x => !verifyMarkedErrorBarcodes.has(x.barcode));

  const modal = document.getElementById('modal-print-completion-verification');
  if (modal) modal.style.display = 'none';

  if (errorCount === total || successItems.length === 0) {
    showToast("ℹ️ Hiçbir fiyat güncellenmedi, eski fiyatlar korundu.", "warning");
    if (verifyOnCompleteCallback) verifyOnCompleteCallback();
    return;
  }

  // Başarılı basılan ürünlerin raf fiyatlarını products.json'da güncelle
  try {
    const payload = {
      items: successItems.map(x => ({
        barcode: x.barcode,
        title: x.title || x.title1 || x.excel_title,
        price: x.price || x.excel_price
      }))
    };

    const res = await fetch(`${API_BASE}/api/catalog/sync-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (result.status === 'success') {
      showToast(`✅ ${successItems.length} ürünün raf fiyatı başarıyla güncellendi!`, "success");
      await loadCatalog();
      await loadSyncStatus();
    } else {
      showToast(`❌ Hata: ${result.message}`, "error");
    }
  } catch(e) {
    showToast(`❌ Güncelleme hatası: ${e.message}`, "error");
  }

  if (verifyOnCompleteCallback) verifyOnCompleteCallback();
}

function updatePrintProgressUI(currentItem = null) {
  const total = printControllerState.items.length;
  const current = printControllerState.currentIndex + 1;
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  const bar = document.getElementById('print-ctrl-progress-bar');
  const countTxt = document.getElementById('print-ctrl-count-text');
  const pctTxt = document.getElementById('print-ctrl-percent-text');
  const itemTxt = document.getElementById('print-ctrl-current-item');
  const pauseAlert = document.getElementById('print-ctrl-pause-alert');
  const btnPause = document.getElementById('btn-print-ctrl-pause');
  const btnResume = document.getElementById('btn-print-ctrl-resume');
  const btnCancel = document.getElementById('btn-print-ctrl-cancel');
  const modalTitle = document.getElementById('print-ctrl-modal-title');

  if (bar) bar.style.width = `${pct}%`;
  if (countTxt) countTxt.innerText = `${current} / ${total} Etiket`;
  if (pctTxt) pctTxt.innerText = `%${pct}`;
  if (itemTxt && currentItem) {
    itemTxt.innerText = `${currentItem.title || currentItem.title1 || currentItem.excel_title} (${currentItem.price || ''})`;
  }

  if (printControllerState.isPaused) {
    if (modalTitle) modalTitle.innerText = "⏸️ Yazdırma Duraklatıldı";
    if (pauseAlert) pauseAlert.style.display = "block";
    if (btnPause) btnPause.style.display = "none";
    if (btnResume) btnResume.style.display = "inline-block";
    if (btnCancel) btnCancel.style.display = "inline-block";
  } else {
    if (modalTitle) modalTitle.innerText = "🖨️ Etiketler Yazdırılıyor...";
    if (pauseAlert) pauseAlert.style.display = "none";
    if (btnPause) btnPause.style.display = "inline-block";
    if (btnResume) btnResume.style.display = "none";
    if (btnCancel) btnCancel.style.display = "none";
  }
}

function pausePrinting() {
  printControllerState.isPaused = true;
  updatePrintProgressUI(printControllerState.items[printControllerState.currentIndex]);
  showToast("⏸️ Yazdırma duraklatıldı.", "warning");
}

function resumePrintingWithConfirm() {
  const remaining = printControllerState.items.length - (printControllerState.currentIndex + 1);
  const ok = confirm(`▶️ Kalan ${remaining} etiketin basımına devam etmek istediğinize emin misiniz?`);
  if (!ok) return;

  printControllerState.isPaused = false;
  updatePrintProgressUI(printControllerState.items[printControllerState.currentIndex]);
  showToast("▶️ Yazdırmaya devam ediliyor...", "success");
}

async function cancelPrintingWithConfirm() {
  const remaining = printControllerState.items.length - (printControllerState.currentIndex + 1);
  const ok = confirm(`⛔ Yazdırma işlemini tamamen iptal etmek istediğinize emin misiniz?\n(Kalan ${remaining} etiket basılmayacak)`);
  if (!ok) return;

  printControllerState.isActive = false;
  printControllerState.isPaused = false;

  try {
    await fetch(`${API_BASE}/api/print/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ printer: selectedPrinter || "Termal Etiket Yazici" })
    });
  } catch(e) {}

  const modal = document.getElementById('modal-print-progress');
  if (modal) modal.style.display = 'none';

  showToast(`⛔ Yazdırma iptal edildi. (${printControllerState.currentIndex + 1} basıldı, ${remaining} iptal edildi)`, "warning");
}

async function submitSyncBatchPrint() {
  if (selectedSyncBarcodes.size === 0) {
    showToast("Lütfen yazdırılacak ürünleri seçin.", "warning");
    return;
  }

  // Önce raf fiyatlarını güncelle, sonra kontrollü yazdır
  await submitSyncBatchApply();

  const copies = parseInt(document.getElementById('sync-batch-copies')?.value || 1);
  const productsToPrint = [];

  selectedSyncBarcodes.forEach(bc => {
    const p = allCatalogProducts.find(x => x.barcode === bc);
    if (p) {
      productsToPrint.push(p);
    } else {
      const syncItem = filteredSyncItems.find(x => x.barcode === bc);
      if (syncItem) {
        productsToPrint.push({
          barcode: syncItem.barcode,
          title: syncItem.current_title || syncItem.excel_title,
          brand: (syncItem.brand && syncItem.brand !== 'DİĞER' && syncItem.brand !== 'DIGER') ? syncItem.brand : "YARENLER",
          price: syncItem.excel_price || "0,00 TL",
          date: document.getElementById('inp-date')?.value || ""
        });
      }
    }
  });

  if (productsToPrint.length === 0) {
    showToast("Yazdırılacak ürün bulunamadı.", "warning");
    return;
  }

  await startManagedBatchPrint(productsToPrint, copies, () => {
    clearSyncSelection();
  });
}

async function submitSyncBatchBlacklist() {
  if (selectedSyncBarcodes.size === 0) {
    showToast("Lütfen kara listeye eklenecek ürünleri seçin.", "warning");
    return;
  }

  let count = 0;
  for (const bc of selectedSyncBarcodes) {
    const item = filteredSyncItems.find(x => x.barcode === bc);
    const title = item ? (item.excel_title || item.current_title) : "KARA LİSTE";
    try {
      await fetch(`${API_BASE}/api/blacklist/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode: bc, title: title })
      });
      count++;
    } catch (e) {
      console.error("Blacklist add error:", e);
    }
  }

  showToast(`🚫 ${count} ürün kara listeye eklendi.`, "success");
  clearSyncSelection();
  await loadSyncStatus();
}

// 12. SÜTUN SIRALAMA (A-Z, Z-A & FİYAT SIRALAMASI)
let syncSortColumn = null;
let syncSortDirection = 'asc';

function sortSyncColumn(colKey) {
  if (syncSortColumn === colKey) {
    syncSortDirection = (syncSortDirection === 'asc') ? 'desc' : 'asc';
  } else {
    syncSortColumn = colKey;
    syncSortDirection = 'asc';
  }

  const iconMap = {
    'barcode': 'sync-sort-ico-barcode',
    'excel_title': 'sync-sort-ico-excel_title',
    'current_title': 'sync-sort-ico-current_title',
    'current_price': 'sync-sort-ico-current_price',
    'excel_price': 'sync-sort-ico-excel_price',
    'status': 'sync-sort-ico-status'
  };

  Object.entries(iconMap).forEach(([k, icoId]) => {
    const el = document.getElementById(icoId);
    if (!el) return;
    if (k === syncSortColumn) {
      el.innerText = (syncSortDirection === 'asc') ? '▲' : '▼';
      el.style.color = '#38bdf8';
    } else {
      el.innerText = '↕';
      el.style.color = 'inherit';
    }
  });

  if (!filteredSyncItems || filteredSyncItems.length === 0) return;

  filteredSyncItems.sort((a, b) => {
    let valA = a[colKey] || '';
    let valB = b[colKey] || '';

    if (colKey === 'current_price' || colKey === 'excel_price') {
      const numA = parsePriceNumber(valA);
      const numB = parsePriceNumber(valB);
      return (syncSortDirection === 'asc') ? (numA - numB) : (numB - numA);
    }

    valA = String(valA).trim();
    valB = String(valB).trim();
    const cmp = valA.localeCompare(valB, 'tr', { numeric: true, sensitivity: 'base' });
    return (syncSortDirection === 'asc') ? cmp : -cmp;
  });

  renderSyncTable(true);
}

let catalogSortColumn = null;
let catalogSortDirection = 'asc';

function sortCatalogColumn(colKey) {
  if (catalogSortColumn === colKey) {
    catalogSortDirection = (catalogSortDirection === 'asc') ? 'desc' : 'asc';
  } else {
    catalogSortColumn = colKey;
    catalogSortDirection = 'asc';
  }

  const iconMap = {
    'brand': 'sort-ico-brand',
    'barcode': 'sort-ico-barcode',
    'title': 'sort-ico-title',
    'price': 'sort-ico-price',
    'date': 'sort-ico-date'
  };

  Object.entries(iconMap).forEach(([k, icoId]) => {
    const el = document.getElementById(icoId);
    if (!el) return;
    if (k === catalogSortColumn) {
      el.innerText = (catalogSortDirection === 'asc') ? '▲' : '▼';
      el.style.color = '#38bdf8';
    } else {
      el.innerText = '↕';
      el.style.color = 'inherit';
    }
  });

  if (!filteredCatalogProducts || filteredCatalogProducts.length === 0) return;

  filteredCatalogProducts.sort((a, b) => {
    let valA = a[colKey] || a.title1 || '';
    let valB = b[colKey] || b.title1 || '';

    if (colKey === 'price') {
      const numA = parsePriceNumber(valA);
      const numB = parsePriceNumber(valB);
      return (catalogSortDirection === 'asc') ? (numA - numB) : (numB - numA);
    }

    valA = String(valA).trim();
    valB = String(valB).trim();
    const cmp = valA.localeCompare(valB, 'tr', { numeric: true, sensitivity: 'base' });
    return (catalogSortDirection === 'asc') ? cmp : -cmp;
  });

  renderCatalogTable(true);
}

function parsePriceNumber(priceStr) {
  if (!priceStr || priceStr === '-') return -1;
  let s = String(priceStr).replace(/[^\d.,]/g, '').trim();
  if (s.includes('.') && s.includes(',')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const num = parseFloat(s);
  return isNaN(num) ? -1 : num;
}

// 13. GEÇMİŞ EXCEL DOSYALARI ARŞİV YÖNETİMİ
async function openExcelHistoryModal() {
  const modal = document.getElementById('modal-excel-history');
  const listEl = document.getElementById('excel-history-list');
  if (!modal || !listEl) return;

  modal.style.display = 'flex';
  listEl.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">⏳ Yükleniyor...</div>';

  try {
    const res = await fetch(`${API_BASE}/api/catalog/excel-history`);
    const data = await res.json();
    if (data.status === 'success' && data.history && data.history.length > 0) {
      listEl.innerHTML = '';
      data.history.forEach(item => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:12px 16px; background:#090d16; border:1px solid var(--border-color); border-radius:10px; gap:12px;';
        
        const isLatest = item.is_latest;
        const statusBadge = isLatest 
          ? '<span style="background:rgba(16,185,129,0.2); color:#10b981; border:1px solid rgba(16,185,129,0.4); padding:3px 8px; border-radius:6px; font-size:11px; font-weight:800;">🟢 Aktif (En Güncel)</span>'
          : '<span style="background:rgba(148,163,184,0.15); color:#94a3b8; border:1px solid rgba(148,163,184,0.3); padding:3px 8px; border-radius:6px; font-size:11px; font-weight:700;">🔒 Arşiv</span>';

        const stats = item.stats || {};
        const totalRows = (stats.total_excel_rows || 0).toLocaleString('tr-TR');
        const changedCount = (stats.changed_count || 0).toLocaleString('tr-TR');
        const newCount = (stats.new_count || 0).toLocaleString('tr-TR');
        const matchedCount = (stats.matched_count || 0).toLocaleString('tr-TR');
        const blackCount = (stats.blacklisted_count || 0).toLocaleString('tr-TR');

        row.innerHTML = `
          <div style="display:flex; flex-direction:column; gap:4px; flex:1;">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <strong style="color:var(--text-main); font-size:13px;">📅 ${item.date} Yüklemesi</strong>
              <span style="font-size:11px; color:var(--text-muted);">(${item.size})</span>
              ${statusBadge}
            </div>
            <div style="font-size:11.5px; color:var(--text-muted); line-height:1.4;">
              📦 Toplam <b>${totalRows}</b> ürün &bull; 
              ⚠️ Fiyatı Farklı: <b style="color:#f59e0b;">${changedCount}</b> &bull; 
              ✨ Yeni: <b style="color:#38bdf8;">${newCount}</b> &bull; 
              ✅ Aynı: <b style="color:#10b981;">${matchedCount}</b> &bull; 
              🚫 Kara Liste: <b style="color:#ef4444;">${blackCount}</b>
            </div>
          </div>
          <div style="display:flex; gap:6px; align-items:center; flex-shrink:0;">
            <a href="${API_BASE}/api/catalog/excel-download/${encodeURIComponent(item.filename)}" class="btn-sm btn-secondary" style="font-size:11px; padding:5px 10px; display:inline-flex; align-items:center; gap:4px; text-decoration:none;" title="Excel/CSV dosyasını bilgisayarına indir">
              📥 İndir
            </a>
            <button class="btn-sm btn-secondary" onclick="openExcelDetailModal('${item.filename}')" style="font-size:11px; padding:5px 10px;" title="Dosyadaki ürünleri ve fiyat farklarını detaylı incele">
              🔍 İncele
            </button>
            <button class="btn-sm btn-secondary" onclick="deleteExcelArchive('${item.filename}', ${isLatest})" style="font-size:11px; padding:5px 8px; color:#ef4444; border-color:rgba(239,68,68,0.4);" title="Bu arşiv dosyasını sil">
              🗑️ Sil
            </button>
          </div>
        `;
        listEl.appendChild(row);
      });
    } else {
      listEl.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">Arşivde kayıtlı dosya bulunamadı.</div>';
    }
  } catch(e) {
    listEl.innerHTML = `<div style="text-align:center; padding:20px; color:#ef4444;">Hata: ${e.message}</div>`;
  }
}

async function deleteExcelArchive(filename, isLatest) {
  let msg = `Bu arşiv dosyasını silmek istediğinize emin misiniz?`;
  if (isLatest) {
    msg = `⚠️ DİKKAT: Bu dosya şu anda sistemdeki EN GÜNCEL aktif stok dosyasıdır!\n\nSilerseniz sistem bir önceki arşiv dosyasına dönecektir. Onaylıyor musunuz?`;
  }
  const ok = await showCustomConfirm(msg, "Dosyayı Sil", "Evet, Sil", "Vazgeç", "🗑️");
  if (!ok) return;

  try {
    const res = await fetch(`${API_BASE}/api/catalog/excel-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: filename })
    });
    const data = await res.json();
    if (data.status === 'success') {
      showToast("✓ Dosya başarıyla silindi.", "success");
      await openExcelHistoryModal();
      await loadSyncStatus(true);
    } else {
      showToast(`❌ Hata: ${data.message}`, "error");
    }
  } catch (e) {
    showToast(`❌ Bağlantı hatası: ${e.message}`, "error");
  }
}

function closeExcelHistoryModal() {
  const modal = document.getElementById('modal-excel-history');
  if (modal) modal.style.display = 'none';
}

async function openExcelDetailModal(filename) {
  const modal = document.getElementById('modal-excel-detail');
  if (!modal) return;

  modal.style.display = 'flex';
  document.getElementById('excel-detail-title').innerText = `🔍 Arşiv: ${filename}`;
  document.getElementById('excel-detail-subtitle').innerText = 'Yükleniyor...';
  const tbody = document.getElementById('detail-tbody');
  tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px;">⏳ Veriler okunuyor...</td></tr>';

  try {
    const res = await fetch(`${API_BASE}/api/catalog/excel-detail/${encodeURIComponent(filename)}`);
    const data = await res.json();
    if (data.status === 'success') {
      document.getElementById('excel-detail-subtitle').innerText = `Yükleme Tarihi: ${data.updated_at}`;
      document.getElementById('detail-stat-total').innerText = data.stats.total_excel_rows || 0;
      document.getElementById('detail-stat-changed').innerText = data.stats.changed_count || 0;
      document.getElementById('detail-stat-new').innerText = data.stats.new_count || 0;
      document.getElementById('detail-stat-matched').innerText = data.stats.matched_count || 0;
      document.getElementById('detail-stat-black').innerText = data.stats.blacklisted_count || 0;

      const allItems = [
        ...(data.changed_prices || []),
        ...(data.new_products || []),
        ...(data.matched_products || []),
        ...(data.blacklisted_items || [])
      ];

      tbody.innerHTML = '';
      allItems.slice(0, 100).forEach(it => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><span class="barcode-text">${it.barcode}</span></td>
          <td style="color:var(--text-main); font-weight:600;">${it.excel_title || it.current_title || '-'}</td>
          <td style="text-align:right; font-weight:800; color:#38bdf8;">${it.excel_price || '-'}</td>
        `;
        tbody.appendChild(tr);
      });
      if (allItems.length > 100) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="3" style="text-align:center; color:var(--text-muted); font-size:11.5px; padding:8px;">... ve diğer ${allItems.length - 100} kayıt</td>`;
        tbody.appendChild(tr);
      }
    }
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#ef4444;">Hata: ${e.message}</td></tr>`;
  }
}

function closeExcelDetailModal() {
  const modal = document.getElementById('modal-excel-detail');
  if (modal) modal.style.display = 'none';
}

// 14. GERİ ALMA & YEDEKLEME YÖNETİMİ (ROLLBACK SYSTEM)
async function rollbackLatestBackup() {
  const ok = confirm("⚠️ En son yapılan fiyat değişikliğini/toplu baskıyı geri almak istediğinize emin misiniz?\n\nBu işlem, fiyatları bir önceki güvenli yedekteki haline döndürür.");
  if (!ok) return;

  try {
    const res = await fetch(`${API_BASE}/api/backup/rollback-latest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const result = await res.json();
    if (result.status === 'success') {
      showToast(`↺ ${result.message}`, "success");
      await loadCatalog();
      await loadSyncStatus(true);
    } else {
      showToast(`❌ ${result.message}`, "error");
    }
  } catch (e) {
    showToast(`❌ Bağlantı hatası: ${e.message}`, "error");
  }
}

async function openBackupListModal() {
  const modal = document.getElementById('modal-backups');
  const listEl = document.getElementById('backup-list-container');
  if (!modal || !listEl) return;

  modal.style.display = 'flex';
  listEl.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">⏳ Yedekler listeleniyor...</div>';

  try {
    const res = await fetch(`${API_BASE}/api/backup/list`);
    const data = await res.json();
    if (data.status === 'success' && data.backups && data.backups.length > 0) {
      listEl.innerHTML = '';
      data.backups.forEach((b, idx) => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:#090d16; border:1px solid var(--border-color); border-radius:8px;';
        
        const isFirst = (idx === 0);
        const tagBadge = isFirst 
          ? '<span style="background:rgba(56,189,248,0.2); color:#38bdf8; border:1px solid rgba(56,189,248,0.4); padding:2px 7px; border-radius:5px; font-size:10.5px; font-weight:800;">EN SON YEDEK</span>'
          : '';

        row.innerHTML = `
          <div style="display:flex; flex-direction:column; gap:3px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <strong style="color:var(--text-main); font-size:12.5px;">💾 ${b.filename}</strong>
              ${tagBadge}
            </div>
            <div style="font-size:11px; color:var(--text-muted);">
              📅 ${b.date} &bull; Sebep: <span style="color:#e2e8f0;">${b.reason}</span> (${b.size})
            </div>
          </div>
          <div>
            <button class="btn-sm btn-primary" onclick="restoreBackupFile('${b.filename}')" style="font-size:11.5px; padding:4px 10px; background:linear-gradient(135deg, #f59e0b, #d97706); border:none;" title="Fiyatları bu yedeğe geri yükle">
              ↺ Bu Yedeğe Dön
            </button>
          </div>
        `;
        listEl.appendChild(row);
      });
    } else {
      listEl.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">Henüz alınmış bir yedek bulunmuyor.</div>';
    }
  } catch (e) {
    listEl.innerHTML = `<div style="text-align:center; padding:20px; color:#ef4444;">Hata: ${e.message}</div>`;
  }
}

function closeBackupListModal() {
  const modal = document.getElementById('modal-backups');
  if (modal) modal.style.display = 'none';
}

async function restoreBackupFile(filename) {
  const ok = confirm(`⚠️ '${filename}' yedeğindeki fiyatları geri yüklemek istediğinize emin misiniz?\n\nMevcut veritabanı bu yedeğe döndürülecektir.`);
  if (!ok) return;

  try {
    const res = await fetch(`${API_BASE}/api/backup/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: filename })
    });
    const result = await res.json();
    if (result.status === 'success') {
      showToast(`✓ ${result.message}`, "success");
      closeBackupListModal();
      await loadCatalog();
      await loadSyncStatus(true);
    } else {
      showToast(`❌ ${result.message}`, "error");
    }
  } catch (e) {
    showToast(`❌ Bağlantı hatası: ${e.message}`, "error");
  }
}

// --- PC TAŞINABİLİR EŞ ZAMANLI CANLI YAZDIRMA PENCERESİ SENKRONİZASYONU ---
let lastFloatPrintStateActive = false;

async function checkFloatingLivePrintStatus() {
  const monitor = document.getElementById('floating-live-print-monitor');
  if (!monitor) return;

  // Eğer masaüstünün kendi modalı açıksa bu mini paneli göstermeye gerek yok
  const mainModal = document.getElementById('modal-print-progress');
  if (mainModal && mainModal.style.display === 'flex') {
    monitor.style.display = 'none';
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/print/live-status`);
    const data = await res.json();
    if (data.status === 'success' && data.live_status) {
      const s = data.live_status;
      if (s.is_active) {
        monitor.style.display = 'flex';
        const total = s.total || 1;
        const current = s.current || 0;
        const pct = Math.round((current / total) * 100);

        document.getElementById('float-print-bar').style.width = `${pct}%`;
        document.getElementById('float-print-count').innerText = `${current} / ${total} Etiket (%${pct})`;
        document.getElementById('float-print-source').innerText = s.source === 'mobile' ? '📱 Mobil Terminal' : '💻 Masaüstü';
        document.getElementById('float-print-status-text').innerText = s.status_text || 'Yazdırılıyor...';
        document.getElementById('float-print-item-name').innerText = s.current_item ? `${s.current_item} (${s.current_price})` : '-';
        lastFloatPrintStateActive = true;
      } else {
        if (lastFloatPrintStateActive) {
          lastFloatPrintStateActive = false;
          // İşlem yeni bittiğinde listeyi yenile
          setTimeout(() => {
            loadCatalog();
            loadSyncStatus(true);
          }, 800);
        }
        monitor.style.display = 'none';
      }
    }
  } catch(e) {}
}

// 500ms aralıklarla canlı yazdırma durumunu kontrol et
setInterval(checkFloatingLivePrintStatus, 500);

// =========================================================
// KAYDEDİLMEMİŞ DEĞİŞİKLİKLER / DRAFT ÖNBELLEK YÖNETİMİ
// =========================================================
const DEFAULT_FACTORY_LABEL = {
  title1: "ULK 398-6 PİKO PORTAKAL",
  title2: "PİR PAT KAP",
  brand: "YARENLER",
  origin: "TÜRKİYE",
  unit_price: "250,00 ₺/Kg",
  barcode: "8690504114925",
  price: "10,00 ₺"
};

let draftAutoSaveTimer = null;
window.pendingDraftToRestore = null;

function initDraftTracking() {
  const inputIds = [
    'inp-prod-title-1', 'inp-prod-title-2', 'inp-brand', 'inp-origin',
    'inp-date', 'inp-unit-price', 'inp-barcode', 'inp-price', 'inp-copies'
  ];

  inputIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => {
        scheduleDraftAutoSave();
      });
      el.addEventListener('change', () => {
        scheduleDraftAutoSave();
      });
    }
  });
}

function scheduleDraftAutoSave() {
  clearTimeout(draftAutoSaveTimer);
  draftAutoSaveTimer = setTimeout(() => {
    saveDraftSnapshot();
  }, 400);
}

function getActiveDraftSnapshot() {
  const t1 = document.getElementById('inp-prod-title-1')?.value || '';
  const t2 = document.getElementById('inp-prod-title-2')?.value || '';
  const br = document.getElementById('inp-brand')?.value || '';
  const org = document.getElementById('inp-origin')?.value || '';
  const dt = document.getElementById('inp-date')?.value || '';
  const up = document.getElementById('inp-unit-price')?.value || '';
  const bc = document.getElementById('inp-barcode')?.value || '';
  const pr = document.getElementById('inp-price')?.value || '';
  const cp = document.getElementById('inp-copies')?.value || '1';

  // Varsayılan fabrika başlangıç değerlerinden farklı mı kontrol et
  const isDifferentFromDefault = (
    (bc && bc.trim() !== DEFAULT_FACTORY_LABEL.barcode) ||
    (t1 && t1.trim() !== DEFAULT_FACTORY_LABEL.title1) ||
    (pr && pr.trim() !== DEFAULT_FACTORY_LABEL.price) ||
    (t2 && t2.trim() !== DEFAULT_FACTORY_LABEL.title2) ||
    (br && br.trim() !== DEFAULT_FACTORY_LABEL.brand)
  );

  const now = new Date();
  const timeFormatted = now.toLocaleString('tr-TR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  return {
    timestamp: now.getTime(),
    saved_at: timeFormatted,
    active_tab: localStorage.getItem('active_tab') || 'tab-print',
    is_dirty: isDifferentFromDefault,
    label_form: {
      title1: t1,
      title2: t2,
      brand: br,
      origin: org,
      date: dt,
      unit_price: up,
      barcode: bc,
      price: pr,
      copies: cp
    }
  };
}

async function saveDraftSnapshot() {
  const snapshot = getActiveDraftSnapshot();
  if (!snapshot.is_dirty) {
    return;
  }

  // 1. Tarayıcı Yerel Hafızasına Kaydet
  try {
    localStorage.setItem('market_label_draft_cache', JSON.stringify(snapshot));
  } catch(e) {}

  // 2. Sunucu Disk Hafızasına (draft_cache.json) Kaydet
  try {
    await fetch(`${API_BASE}/api/cache/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot)
    });
  } catch(e) {}
}

async function checkUnsavedDraftOnStartup() {
  let draft = null;

  // 1. Önce localStorage kontrolü
  try {
    const local = localStorage.getItem('market_label_draft_cache');
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed && parsed.is_dirty && parsed.label_form) {
        draft = parsed;
      }
    }
  } catch(e) {}

  // 2. Eğer localStorage boşsa sunucudaki draft dosyasını sor (Farklı cihaz veya önbellek silinmesi durumu)
  if (!draft) {
    try {
      const res = await fetch(`${API_BASE}/api/cache/draft`);
      const data = await res.json();
      if (data.status === 'success' && data.has_draft && data.draft && data.draft.is_dirty) {
        draft = data.draft;
      }
    } catch(e) {}
  }

  // Eğer geçerli bir kaydedilmemiş taslak bulunduysa kullanıcıya bildir
  if (draft && draft.is_dirty && draft.label_form) {
    const lf = draft.label_form;
    const isMeaningful = (lf.barcode && lf.barcode.trim() !== DEFAULT_FACTORY_LABEL.barcode) ||
                         (lf.title1 && lf.title1.trim() !== DEFAULT_FACTORY_LABEL.title1) ||
                         (lf.price && lf.price.trim() !== DEFAULT_FACTORY_LABEL.price);

    if (isMeaningful) {
      window.pendingDraftToRestore = draft;
      const timeEl = document.getElementById('draft-time');
      const titleEl = document.getElementById('draft-product-title');
      const bcEl = document.getElementById('draft-barcode');
      const priceEl = document.getElementById('draft-price');

      if (timeEl) timeEl.innerText = draft.saved_at || 'Bilinmiyor';
      if (titleEl) titleEl.innerText = (lf.title1 + (lf.title2 ? ' ' + lf.title2 : '')).trim() || 'İsimsiz Ürün';
      if (bcEl) bcEl.innerText = lf.barcode || '-';
      if (priceEl) priceEl.innerText = lf.price || '-';

      const modal = document.getElementById('modal-restore-draft');
      if (modal) {
        modal.style.display = 'flex';
      }
    }
  }
}

function restoreDraftCache() {
  const draft = window.pendingDraftToRestore || (() => {
    try {
      return JSON.parse(localStorage.getItem('market_label_draft_cache') || 'null');
    } catch(e) { return null; }
  })();

  if (draft && draft.label_form) {
    const lf = draft.label_form;
    if (document.getElementById('inp-prod-title-1') && lf.title1 !== undefined) document.getElementById('inp-prod-title-1').value = lf.title1;
    if (document.getElementById('inp-prod-title-2') && lf.title2 !== undefined) document.getElementById('inp-prod-title-2').value = lf.title2;
    if (document.getElementById('inp-brand') && lf.brand !== undefined) document.getElementById('inp-brand').value = lf.brand;
    if (document.getElementById('inp-origin') && lf.origin !== undefined) document.getElementById('inp-origin').value = lf.origin;
    if (document.getElementById('inp-date') && lf.date) document.getElementById('inp-date').value = lf.date;
    if (document.getElementById('inp-unit-price') && lf.unit_price !== undefined) document.getElementById('inp-unit-price').value = lf.unit_price;
    if (document.getElementById('inp-barcode') && lf.barcode !== undefined) document.getElementById('inp-barcode').value = lf.barcode;
    if (document.getElementById('inp-price') && lf.price !== undefined) document.getElementById('inp-price').value = lf.price;
    if (document.getElementById('inp-copies') && lf.copies !== undefined) document.getElementById('inp-copies').value = lf.copies;

    updateLabel();

    if (draft.active_tab) {
      switchTab(draft.active_tab);
    }

    showToast("✓ Kaydedilmemiş değişiklikleriniz başarıyla geri yüklendi.", "success");
  }

  closeRestoreDraftModal(false);
}

function discardDraftCache() {
  window.pendingDraftToRestore = null;
  try {
    localStorage.removeItem('market_label_draft_cache');
    fetch(`${API_BASE}/api/cache/draft`, { method: 'DELETE' });
  } catch(e) {}

  closeRestoreDraftModal(false);
  showToast("Önbellek temizlendi, yeni temiz oturum açıldı.", "info");
}

function closeRestoreDraftModal(keepDraft = false) {
  const modal = document.getElementById('modal-restore-draft');
  if (modal) {
    modal.style.display = 'none';
  }
}

