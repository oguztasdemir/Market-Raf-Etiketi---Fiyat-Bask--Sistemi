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

document.addEventListener('DOMContentLoaded', () => {
  renderTemplateList();
  renderBarcode();
  checkBackendAndDevices();
  loadCurrentDate();
  loadTemplates();
  loadSettings();
  loadMobileQrCode();

  // F5 Yenilemelerinde Son Aktif Sekmeyi Aç
  const hashTab = window.location.hash ? window.location.hash.replace('#', '') : null;
  const savedTab = hashTab || localStorage.getItem('active_tab') || 'tab-print';
  switchTab(savedTab);
});

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

  const buttons = document.querySelectorAll('.nav-item');
  const heading = document.getElementById('page-heading');
  const subheading = document.getElementById('page-subheading');

  if (tabId === 'tab-print') {
    if (buttons[0]) buttons[0].classList.add('active');
    if (heading) heading.innerText = '🏷️ Etiket Çıkart';
    if (subheading) subheading.innerText = 'Hızlı veri girişi, canlı önizleme ve doğrudan termal baskı';
  } else if (tabId === 'tab-design') {
    if (buttons[1]) buttons[1].classList.add('active');
    if (heading) heading.innerText = '🎨 Etiket Düzenle & Şablonlar';
    if (subheading) subheading.innerText = 'Özel etiket modelleri oluşturun, özelleştirin ve kaydedin';
    loadTemplates();
  } else if (tabId === 'tab-qr') {
    if (buttons[2]) buttons[2].classList.add('active');
    if (heading) heading.innerText = '📱 Mobil QR Bağlantısı';
    if (subheading) subheading.innerText = 'Telefonunuzla reyonlarda gezerken ürün okutup anında etiket basın';
    loadMobileQrCode();
  } else if (tabId === 'tab-settings') {
    if (buttons[3]) buttons[3].classList.add('active');
    if (heading) heading.innerText = '⚙️ Sistem & Donanım Ayarları';
    if (subheading) subheading.innerText = 'Yazıcı, kağıt ölçüsü, ofset kalibrasyonu ve mağaza bilgileri';
    loadSettings();
  }
}

// 2. BACKEND & YAZICI DURUMU
async function checkBackendAndDevices() {
  const badgeText = document.getElementById('backend-status-text');
  const printerSelect = document.getElementById('settings-printer-select');
  const sidebarPrinterName = document.getElementById('sidebar-printer-name');

  try {
    const res = await fetch(`${API_BASE}/api/devices`);
    if (!res.ok) throw new Error('API bağlantı hatası');
    const data = await res.json();

    if (data.usb_connected) {
      badgeText.innerHTML = `USB: <strong>Termal Bağlı</strong>`;
    } else {
      badgeText.innerHTML = `Sunucu: <strong>Aktif</strong>`;
    }

    if (data.default_printer && sidebarPrinterName) {
      sidebarPrinterName.innerText = data.default_printer;
    }

    if (printerSelect) {
      printerSelect.innerHTML = '';
      if (data.printers && data.printers.length > 0) {
        data.printers.forEach(printer => {
          const opt = document.createElement('option');
          opt.value = printer;
          opt.innerText = `🖨️ ${printer}`;
          if (printer === data.default_printer) opt.selected = true;
          printerSelect.appendChild(opt);
        });
      }
    }
  } catch (err) {
    badgeText.innerHTML = `Durum: <strong>Yerel Mod</strong>`;
  }
}

// 3. MOBİL QR KOD YÜKLEME
async function loadMobileQrCode() {
  try {
    const res = await fetch(`${API_BASE}/api/network/ip`);
    const data = await res.json();
    if (data.status === 'success') {
      const mobileUrl = data.mobile_url;
      document.getElementById('inp-mobile-url').value = mobileUrl;
      
      const qrContainer = document.getElementById('mobile-qr-canvas');
      qrContainer.innerHTML = '';
      QRCode.toCanvas(qrContainer, mobileUrl, {
        width: 180,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' }
      });
    }
  } catch (e) {
    console.error("QR oluşturma hatası:", e);
  }
}

function copyMobileUrl() {
  const inp = document.getElementById('inp-mobile-url');
  inp.select();
  document.execCommand('copy');
  alert("Mobil bağlantı linki kopyalandı:\n" + inp.value);
}

// 4. STOK ARAMA & OTOMATİK DOLDURMA (5000+ Ürün)
let searchTimeout = null;
function searchProducts(q) {
  clearTimeout(searchTimeout);
  const dropdown = document.getElementById('stock-dropdown');
  q = q.trim();

  if (!q) {
    dropdown.style.display = 'none';
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
          item.innerHTML = `
            <div>
              <div class="stock-item-title">${title}</div>
              <div class="stock-item-sub">Barkod: ${p.barcode}</div>
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
  }, 200);
}

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

function openTemplateInEditor(tpl) {
  editingTemplateId = tpl.id;
  document.getElementById('txt-editing-tpl-title').innerText = `🎨 Model Düzenle: ${tpl.name}`;
  document.getElementById('inp-tpl-name').value = tpl.name;
  document.getElementById('inp-tpl-desc').value = tpl.description || '';
  document.getElementById('tpl-top-right-mode').value = tpl.top_right_mode || 'empty';
  
  const lockedBadge = document.getElementById('badge-tpl-locked');
  const deleteBtn = document.getElementById('btn-delete-template');
  const defaultBtn = document.getElementById('btn-set-default');
  
  if (tpl.is_locked) {
    lockedBadge.style.display = 'inline-block';
    deleteBtn.style.display = 'none';
  } else {
    lockedBadge.style.display = 'none';
    deleteBtn.style.display = 'inline-block';
  }

  if (defaultBtn) {
    if (tpl.id === activeTemplateId) {
      defaultBtn.innerText = "⭐ Bu Model Şu An Varsayılan";
      defaultBtn.style.borderColor = "#fbbf24";
      defaultBtn.style.color = "#fbbf24";
    } else {
      defaultBtn.innerText = "⭐️ Bu Modeli Varsayılan Yap";
      defaultBtn.style.borderColor = "var(--border-color)";
      defaultBtn.style.color = "white";
    }
  }

  onEditorTopRightChange(tpl.top_right_mode || 'empty');
  document.getElementById('inp-tpl-custom-text').value = tpl.top_right_text || '';
  updateEditorPreview();
}

// Uygulama İçi Yeni Model Modalı
function createNewTemplate() {
  const modal = document.getElementById('modal-new-template');
  const input = document.getElementById('modal-inp-tpl-name');
  if (modal && input) {
    input.value = '';
    modal.style.display = 'flex';
    setTimeout(() => input.focus(), 50);
  }
}

function closeNewModelModal() {
  const modal = document.getElementById('modal-new-template');
  if (modal) modal.style.display = 'none';
}

async function submitNewModelModal() {
  const input = document.getElementById('modal-inp-tpl-name');
  const modelName = input ? input.value.trim() : '';

  if (!modelName) {
    alert("Lütfen model adı girin!");
    return;
  }

  const newId = `tpl_${Date.now()}`;
  const newTpl = {
    id: newId,
    name: modelName,
    description: "Özel mağaza etiket modeli.",
    top_right_mode: "unit_price",
    top_right_text: "",
    is_locked: false
  };

  try {
    const res = await fetch(`${API_BASE}/api/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTpl)
    });
    const data = await res.json();
    if (data.status === 'success') {
      closeNewModelModal();
      editingTemplateId = newId;
      await loadTemplates();
      openTemplateInEditor(data.template || newTpl);
    }
  } catch(e) {
    alert("Model oluşturulurken hata oluştu!");
  }
}

function onEditorTopRightChange(mode) {
  const customField = document.getElementById('tpl-custom-field');
  const label = document.getElementById('tpl-custom-label');
  const inp = document.getElementById('inp-tpl-custom-text');

  if (mode === 'empty' || mode === 'unit_price' || mode === 'yerli') {
    customField.style.display = 'none';
  } else {
    customField.style.display = 'block';
    if (mode === 'weight') {
      label.innerText = "Gramaj / Miktar Metni";
      if (!inp.value) inp.value = "NET: 35 GR";
    } else if (mode === 'code') {
      label.innerText = "Reyon / Stok Kodu";
      if (!inp.value) inp.value = "REYON: A-04";
    } else if (mode === 'qr') {
      label.innerText = "Karekod Link / Verisi";
      if (!inp.value) inp.value = "https://market.com";
    } else if (mode === 'campaign') {
      label.innerText = "Kampanya Rozeti Metni";
      if (!inp.value) inp.value = "SÜPER FİYAT";
    }
  }
  updateEditorPreview();
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
      alert("✓ Etiket modeli başarıyla kaydedildi!");
    }
  } catch (e) {
    alert("Şablon kaydetme hatası!");
  }
}

async function deleteCurrentTemplate() {
  if (!editingTemplateId || editingTemplateId === 'default') return;
  if (!confirm("Bu etiket modelini silmek istediğinize emin misiniz?")) return;

  try {
    const res = await fetch(`${API_BASE}/api/templates/${editingTemplateId}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (data.status === 'success') {
      activeTemplateId = 'default';
      editingTemplateId = 'default';
      await loadTemplates();
      alert("✓ Model silindi.");
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
  document.getElementById('lbl-title-1').innerText = document.getElementById('inp-prod-title-1').value.toUpperCase();
  document.getElementById('lbl-title-2').innerText = document.getElementById('inp-prod-title-2').value.toUpperCase();
  document.getElementById('lbl-brand').innerText = document.getElementById('inp-brand').value.toUpperCase();
  document.getElementById('lbl-origin').innerText = document.getElementById('inp-origin').value.toUpperCase();
  document.getElementById('lbl-date').innerText = document.getElementById('inp-date').value;
  document.getElementById('lbl-price').innerText = document.getElementById('inp-price').value;

  updateTopRightPreview();
  renderBarcode();
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
