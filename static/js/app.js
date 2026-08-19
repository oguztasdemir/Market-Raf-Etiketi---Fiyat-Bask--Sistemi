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
  } else if (tabId === 'tab-catalog') {
    if (buttons[2]) buttons[2].classList.add('active');
    if (heading) heading.innerText = '📦 Ürün Kataloğu & Firma Listesi';
    if (subheading) subheading.innerText = 'Kayıtlı tüm market ürünlerini inceleyin, firmalara göre filtreleyin ve anında etiket basın';
    loadCatalog();
  } else if (tabId === 'tab-qr') {
    if (buttons[3]) buttons[3].classList.add('active');
    if (heading) heading.innerText = '📱 Mobil QR Bağlantısı';
    if (subheading) subheading.innerText = 'Telefonunuzla reyonlarda gezerken ürün okutup anında etiket basın';
    loadMobileQrCode();
  } else if (tabId === 'tab-settings') {
    if (buttons[4]) buttons[4].classList.add('active');
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

// =============================================================
// 10. ÜRÜN KATALOĞU (FİRMA / MARKA FİLTRELERİ & HIZLI BASKI)
// =============================================================

let allCatalogProducts = [];
let filteredCatalogProducts = [];
let catalogRenderedCount = 100;
let currentSortColumn = null;
let currentSortDirection = 'asc'; // 'asc' veya 'desc'

async function loadCatalog() {
  try {
    const res = await fetch(`${API_BASE}/api/products`);
    const data = await res.json();
    if (data.status === 'success' && data.products) {
      allCatalogProducts = data.products;
      populateBrandFilterOptions();
      setupCatalogScrollListener();
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
    const b = p.brand || 'DİĞER';
    brandCounts[b] = (brandCounts[b] || 0) + 1;
  });

  const sortedBrands = Object.keys(brandCounts).sort((a, b) => {
    return brandCounts[b] - brandCounts[a];
  });

  const currentVal = brandSelect.value;
  brandSelect.innerHTML = `<option value="ALL">🏢 Tüm Firmalar (${allCatalogProducts.length.toLocaleString('tr-TR')})</option>`;

  sortedBrands.forEach(brand => {
    const opt = document.createElement('option');
    opt.value = brand;
    opt.innerText = `${brand} (${brandCounts[brand]} Ürün)`;
    brandSelect.appendChild(opt);
  });

  if (currentVal) brandSelect.value = currentVal;
}

function onCatalogFilterChange() {
  const searchTxt = (document.getElementById('catalog-search-inp')?.value || '').toLowerCase().trim();
  const selectedBrand = document.getElementById('catalog-brand-select')?.value || 'ALL';

  // 1. Filtrele
  filteredCatalogProducts = allCatalogProducts.filter(p => {
    const matchesBrand = (selectedBrand === 'ALL') || (p.brand === selectedBrand);
    if (!matchesBrand) return false;

    if (!searchTxt) return true;
    const barcodeMatch = (p.barcode || '').includes(searchTxt);
    const titleMatch = (p.title || '').toLowerCase().includes(searchTxt);
    const brandMatch = (p.brand || '').toLowerCase().includes(searchTxt);
    return barcodeMatch || titleMatch || brandMatch;
  });

  // 2. Eğer sütun sıralaması aktifse sırala
  if (currentSortColumn) {
    applyColumnSorting();
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
  ['brand', 'barcode', 'title', 'price', 'date'].forEach(col => {
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
        <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">
          🔍 Aradığınız kriterlere uygun ürün bulunamadı.
        </td>
      </tr>
    `;
    return;
  }

  const startIdx = reset ? 0 : tbody.children.length;
  const newChunk = itemsToRender.slice(startIdx);

  const currentDateText = document.getElementById('inp-date')?.value || '19 Ağu 2026';

  const fragment = document.createDocumentFragment();
  newChunk.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="badge-brand">${p.brand || 'DİĞER'}</span></td>
      <td><span class="barcode-text">${p.barcode}</span></td>
      <td style="font-weight: 600; color: #f8fafc;">${p.title}</td>
      <td style="text-align: right;"><span class="price-text">${p.price}</span></td>
      <td style="text-align: center;"><span class="date-text">${p.date || currentDateText}</span></td>
      <td style="text-align: center;">
        <button class="btn-sm btn-primary" style="padding: 4px 10px; font-size: 11px;" onclick="printProductFromCatalog('${p.barcode}')" title="Bu ürünün etiketini yazdır">
          🏷️ Bas
        </button>
      </td>
    `;
    fragment.appendChild(tr);
  });

  tbody.appendChild(fragment);
}

function printProductFromCatalog(barcode) {
  const product = allCatalogProducts.find(p => p.barcode === barcode);
  if (!product) return;

  // 1. Ana Etiket Çıkart sekmesine aktar
  selectProduct(product);
  
  // 2. Etiket Çıkart sekmesini aç
  switchTab('tab-print');
}
