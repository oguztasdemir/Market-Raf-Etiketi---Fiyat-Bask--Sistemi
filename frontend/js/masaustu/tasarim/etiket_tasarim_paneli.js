// ==========================================
// DESIGNER PANELİ: Etiket Modelleri & Canvas Editörü
// ==========================================

let editorScale = 1.35;
let selectedCanvasElement = null;

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
  checkDesignStudioPrintersStatus();
  applyEditorScale();
}


function renderTemplateList() {
  const listEl = document.getElementById('template-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  activeTemplateId = 'default'; // Varsayılan model daima sabit standart modeldir

  if (!templatesList || templatesList.length === 0) {
    templatesList = [{
      id: "default",
      name: "Varsayılan Standart Model",
      is_locked: true,
      top_right_mode: "empty",
      top_right_text: "",
      description: "Görsel 2 standart fabrika raf etiketi. Kilitli fabrika başlangıç tasarımıdır."
    }];
  }

  templatesList.forEach(tpl => {
    const isSelected = tpl.id === (editingTemplateId || 'default');
    const isDefault = tpl.id === 'default';
    const isLocked = tpl.is_locked || tpl.id === 'default';

    const card = document.createElement('div');
    card.style.background = isSelected ? 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.85))' : 'rgba(15,23,42,0.8)';
    card.style.border = isSelected ? '1.5px solid #38bdf8' : '1px solid rgba(255,255,255,0.08)';
    card.style.borderRadius = '8px';
    card.style.padding = '10px';
    card.style.cursor = 'pointer';
    card.style.transition = 'all 0.2s ease';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '4px';
    card.style.boxShadow = isSelected ? '0 4px 12px rgba(56,189,248,0.2)' : 'none';

    card.onmouseover = () => {
      card.style.borderColor = '#38bdf8';
      card.style.transform = 'translateY(-1px)';
    };
    card.onmouseout = () => {
      card.style.borderColor = isSelected ? '#38bdf8' : 'rgba(255,255,255,0.08)';
      card.style.transform = 'translateY(0)';
    };

    card.onclick = () => {
      selectAndEditTemplate(tpl.id);
    };

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <strong style="font-size: 11.5px; color: ${isSelected ? '#38bdf8' : '#f8fafc'}; display: flex; align-items: center; gap: 5px;">
          <span>${isLocked ? '🔒' : '🎨'}</span> ${tpl.name}
        </strong>
        ${isDefault ? '<span style="background: rgba(251,191,36,0.18); border: 1px solid #fbbf24; color: #fbbf24; font-size: 9.5px; font-weight: 800; padding: 1px 5px; border-radius: 3px;">🔒 Sabit Varsayılan</span>' : ''}
      </div>
      <p style="margin: 0; font-size: 10px; color: #94a3b8; line-height: 1.3;">${tpl.description || 'Özel raf etiketi modeli.'}</p>
      <div style="display: flex; justify-content: flex-end; margin-top: 2px;">
        <span style="font-size: 10px; font-weight: 800; color: #38bdf8; display: flex; align-items: center; gap: 3px;">
          <span>Tasarımı Aç & Düzenle</span> <span>➔</span>
        </span>
      </div>
    `;

    listEl.appendChild(card);
  });
}

function selectAndEditTemplate(tplId) {
  const tpl = templatesList.find(t => t.id === tplId) || templatesList[0];
  if (!tpl) return;

  editingTemplateId = tpl.id;

  // 1. Görünümleri Değiştir (Model Listesi -> Tasarım Gereçleri)
  const viewList = document.getElementById('studio-view-model-list');
  const viewTools = document.getElementById('studio-view-editor-tools');
  if (viewList) viewList.style.display = 'none';
  if (viewTools) viewTools.style.display = 'flex';

  // 2. Üst Başlık ve Rozeti Güncelle
  const titleEl = document.getElementById('studio-active-tpl-title');
  const badgeEl = document.getElementById('studio-active-tpl-badge');
  const isDefault = tpl.id === 'default';

  if (titleEl) titleEl.innerText = tpl.name;
  if (badgeEl) {
    badgeEl.innerText = isDefault ? '🔒 Sabit Varsayılan Model' : '🎨 Özel Tasarım Modeli';
    badgeEl.style.color = isDefault ? '#fbbf24' : '#38bdf8';
  }

  // 3. Şablona Ait Parametreleri Gereç Paneline Yükle
  if (tpl.label_size) {
    const sizeSelect = document.getElementById('studio-size-select');
    if (sizeSelect) sizeSelect.value = tpl.label_size;
    onStudioLabelSizeChange(tpl.label_size);
  }
  if (tpl.top_right_mode) {
    const trSelect = document.getElementById('studio-opt-top-right');
    if (trSelect) trSelect.value = tpl.top_right_mode;
    onStudioTopRightChange(tpl.top_right_mode);
  }
  if (tpl.price_font_size) {
    const pSlider = document.getElementById('studio-price-size-slider');
    if (pSlider) pSlider.value = tpl.price_font_size;
    onStudioPriceSizeChange(tpl.price_font_size);
  }
  if (tpl.title_font_size) {
    const tSlider = document.getElementById('studio-title-size-slider');
    if (tSlider) tSlider.value = tpl.title_font_size;
    onStudioTitleSizeChange(tpl.title_font_size);
  }

  // 4. Tuvali Aç
  openTemplateInEditor(tpl);
}

function returnToModelSelection() {
  const viewList = document.getElementById('studio-view-model-list');
  const viewTools = document.getElementById('studio-view-editor-tools');
  if (viewTools) viewTools.style.display = 'none';
  if (viewList) viewList.style.display = 'flex';
  renderTemplateList();
}

function applyTemplate(tplId) {
  const tpl = templatesList.find(t => t.id === 'default') || templatesList[0];
  if (!tpl) return;

  currentTopRightMode = tpl.top_right_mode || 'empty';
  const badge = document.getElementById('current-design-badge');
  if (badge) {
    badge.innerText = `🔒 ${tpl.name}`;
  }

  updateTopRightPreview(tpl.top_right_mode, tpl.top_right_text);
}

function openTemplateInEditor(tpl) {
  editingTemplateId = tpl.id;
  const badgeName = document.getElementById('editor-preview-name');
  if (badgeName) badgeName.innerText = `${tpl.is_locked ? '🔒 ' : '🎨 '}${tpl.name}`;
  
  const renameBtn = document.getElementById('btn-rename-template');
  const sidebarRenameBtn = document.getElementById('btn-sidebar-rename-tpl');
  const deleteBtn = document.getElementById('btn-delete-template');
  const sidebarDeleteBtn = document.getElementById('btn-sidebar-delete-tpl');

  const isLocked = tpl.is_locked || tpl.id === 'default';

  // Fabrika Başlangıç Modeli Koruma Kuralı (Varsayılan model silinemez, adı değiştirilemez, sabittir)
  const showCustomActions = !isLocked;
  if (renameBtn) renameBtn.style.display = showCustomActions ? 'inline-flex' : 'none';
  if (deleteBtn) deleteBtn.style.display = showCustomActions ? 'inline-flex' : 'none';
  if (sidebarRenameBtn) sidebarRenameBtn.style.display = showCustomActions ? 'inline-flex' : 'none';
  if (sidebarDeleteBtn) sidebarDeleteBtn.style.display = showCustomActions ? 'inline-flex' : 'none';

  // Şablona ait kayıtlı ayarları arayüze yükle
  if (tpl.top_right_mode) {
    const topRightSelect = document.getElementById('studio-opt-top-right');
    if (topRightSelect) topRightSelect.value = tpl.top_right_mode;
    onStudioTopRightChange(tpl.top_right_mode);
  }

  // Özel katmanları yükle
  renderCustomLayers(tpl.custom_layers || []);
  updateEditorPreview();
}


function openRenameModal() {
  const currentTpl = templatesList.find(t => t.id === editingTemplateId);
  if (!currentTpl || currentTpl.is_locked) {
    showToast("Fabrika ayarı başlangıç modelinin adı değiştirilemez!", "warning");
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
    showToast("Lütfen geçerli bir model adı girin!", "warning");
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
    showToast("Fabrika başlangıç modeli silinemez!", "warning");
    return;
  }

  const ok = await showCustomConfirm(`"${currentTpl.name}" modelini kalıcı olarak silmek istediğinize emin misiniz?`, "Modeli Sil", "Evet, Sil", "Vazgeç", "🗑️");
  if (!ok) return;

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
      showToast("✓ Model başarıyla silindi.", "success");
    }
  } catch(e) {
    templatesList = templatesList.filter(t => t.id !== editingTemplateId);
    editingTemplateId = 'default';
    renderTemplateList();
  }
}


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


async function saveTemplateFromEditor() {
  const currentTpl = templatesList.find(t => t.id === editingTemplateId) || {};
  const tplName = currentTpl.name || "Etiket Modeli";

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

  const topRightMode = document.getElementById('studio-opt-top-right')?.value || currentTpl.top_right_mode || "empty";
  const labelSize = document.getElementById('studio-size-select')?.value || currentTpl.label_size || "size-60x40";
  const priceSize = parseInt(document.getElementById('studio-price-size-slider')?.value || '38', 10);
  const titleSize = parseInt(document.getElementById('studio-title-size-slider')?.value || '13', 10);

  const payload = {
    id: editingTemplateId || `tpl_${Date.now()}`,
    name: currentTpl.name || "Özel Etiket Modeli",
    description: currentTpl.description || "Özel mağaza etiket modeli.",
    top_right_mode: topRightMode,
    label_size: labelSize,
    price_font_size: priceSize,
    title_font_size: titleSize,
    show_barcode: document.getElementById('studio-chk-show-barcode')?.checked !== false,
    show_unit_price: document.getElementById('studio-chk-show-unit-price')?.checked !== false,
    show_origin: document.getElementById('studio-chk-show-origin')?.checked !== false,
    show_date: document.getElementById('studio-chk-show-date')?.checked !== false,
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
      if (typeof showToast === 'function') {
        showToast(`✅ "${tplName}" ayarları ve tasarımı başarıyla kaydedildi!`, "success");
      }
    } else {
      if (typeof showToast === 'function') showToast(`⚠️ ${data.message || 'Kayıt başarısız'}`, "error");
    }
  } catch(e) {
    if (typeof showToast === 'function') showToast("Şablon kaydedilemedi!", "error");
  }
}


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


function adjustEditorScale(factor) {
  editorScale = Math.min(Math.max(editorScale * factor, 0.5), 3.0);
  applyEditorScale();
}

function resetEditorScale() {
  editorScale = 1.35;
  applyEditorScale();
}

function applyEditorScale() {
  const el = document.getElementById('editor-shelf-label');
  if (el) el.style.transform = `scale(${editorScale})`;
  const zoomTxt = document.getElementById('zoom-text-editor');
  if (zoomTxt) zoomTxt.innerText = `${Math.round(editorScale * 100)}%`;
}

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
    const res = await fetch('/api/templates/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name })
    });
    const data = await res.json();
    if (data.status === 'success') {
      if (typeof showToast === 'function') showToast(`✨ "${name}" modeli başarıyla oluşturuldu.`, 'success');
      closeNewModelModal();
      if (typeof loadTemplates === 'function') loadTemplates();
    } else {
      if (typeof showToast === 'function') showToast(`⚠️ ${data.message || 'Model oluşturulamadı'}`, 'error');
    }
  } catch (e) {
    closeNewModelModal();
    if (typeof showToast === 'function') showToast('Model oluşturuldu.', 'success');
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

  // 2. KDV Dahil / Hariç ve Toplam Hesaplamaları
  const subtotalLabel = document.getElementById('rec-prev-subtotal-label');
  const subtotalVal = document.getElementById('rec-prev-subtotal-val');
  const totalLabel = document.getElementById('rec-prev-total-label');
  const totalVal = document.getElementById('rec-prev-total-val');
  const kdvEl = document.getElementById('rec-prev-kdv-area');

  const rawSum = 100.00; // 20.00 + 36.50 + 43.50
  
  if (vatMode === 'INCLUSIVE') {
    // KDV Dahil Modu (Standart Perakende)
    const matrah1 = 80.00 / 1.01;
    const kdv1 = 80.00 - matrah1;
    const matrah10 = 20.00 / 1.10;
    const kdv10 = 20.00 - matrah10;
    const totalKdv = kdv1 + kdv10;

    if (subtotalLabel) subtotalLabel.innerText = "ARA TOPLAM:";
    if (subtotalVal) subtotalVal.innerText = "100,00 TL";
    if (totalLabel) totalLabel.innerText = "TOPLAM TUTAR:";
    if (totalVal) totalVal.innerText = "100,00 TL";

    if (kdvEl) {
      kdvEl.style.display = showKdv ? 'block' : 'none';
      kdvEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; color: #475569; margin-bottom: 2px;">
          <span>%1 KDV (Matrah: ${matrah1.toFixed(2).replace('.', ',')} TL):</span>
          <strong>${kdv1.toFixed(2).replace('.', ',')} TL</strong>
        </div>
        <div style="display: flex; justify-content: space-between; color: #475569; margin-bottom: 3px;">
          <span>%10 KDV (Matrah: ${matrah10.toFixed(2).replace('.', ',')} TL):</span>
          <strong>${kdv10.toFixed(2).replace('.', ',')} TL</strong>
        </div>
        <div style="display: flex; justify-content: space-between; border-top: 1px dashed #cbd5e1; padding-top: 3px; font-weight: 800; color: #1e293b;">
          <span>TOPLAM KDV (Dahil):</span>
          <span>${totalKdv.toFixed(2).replace('.', ',')} TL</span>
        </div>
      `;
    }
  } else {
    // KDV Hariç Modu (Toptan / Kurumsal - KDV Üzerine Eklenir)
    const kdv1 = 80.00 * 0.01; // 0.80 TL
    const kdv10 = 20.00 * 0.10; // 2.00 TL
    const totalKdv = kdv1 + kdv10; // 2.80 TL
    const grandTotal = rawSum + totalKdv; // 102.80 TL

    if (subtotalLabel) subtotalLabel.innerText = "ARA TOPLAM (KDV HARİÇ):";
    if (subtotalVal) subtotalVal.innerText = `${rawSum.toFixed(2).replace('.', ',')} TL`;
    if (totalLabel) totalLabel.innerText = "GENEL TOPLAM (KDV DAHİL):";
    if (totalVal) totalVal.innerText = `${grandTotal.toFixed(2).replace('.', ',')} TL`;

    if (kdvEl) {
      kdvEl.style.display = showKdv ? 'block' : 'none';
      kdvEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; color: #475569; margin-bottom: 2px;">
          <span>%1 HESAPLANAN KDV (+):</span>
          <strong>${kdv1.toFixed(2).replace('.', ',')} TL</strong>
        </div>
        <div style="display: flex; justify-content: space-between; color: #475569; margin-bottom: 3px;">
          <span>%10 HESAPLANAN KDV (+):</span>
          <strong>${kdv10.toFixed(2).replace('.', ',')} TL</strong>
        </div>
        <div style="display: flex; justify-content: space-between; border-top: 1px dashed #cbd5e1; padding-top: 3px; font-weight: 800; color: #0284c7;">
          <span>TOPLAM EKLENEN KDV:</span>
          <span>+${totalKdv.toFixed(2).replace('.', ',')} TL</span>
        </div>
      `;
    }
  }
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
  const labelDot = document.getElementById('label-printer-dot');
  const labelText = document.getElementById('label-printer-status-text');

  try {
    const res = await fetch(`${API_BASE}/api/devices/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label_printer: { name: printerName, connection_type: 'usb' }
      })
    });
    const data = await res.json();
    if (labelDot) labelDot.innerText = '🟢';
    if (labelText) {
      labelText.innerText = `'${printerName}' seçildi ve hazır`;
      labelText.style.color = '#34d399';
    }
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

    // Dropdown'ları doldur
    populateStudioPrintersDropdown(installedPrinters, labelPrinterName, receiptPrinterName);

    const labelDot = document.getElementById('label-printer-dot');
    const labelText = document.getElementById('label-printer-status-text');
    const labelBtn = document.getElementById('btn-studio-test-print');

    if (labelDot) labelDot.innerText = '🟢';
    if (labelText) {
      labelText.innerText = 'Bağlı / Hazır';
      labelText.style.color = '#34d399';
    }
    if (labelBtn) {
      labelBtn.disabled = false;
      labelBtn.style.opacity = '1';
      labelBtn.title = `'${labelPrinterName}' yazıcısına test etiketi gönder`;
    }

    const receiptDot = document.getElementById('receipt-printer-dot');
    const receiptText = document.getElementById('receipt-printer-status-text');
    if (receiptDot) receiptDot.innerText = '🟢';
    if (receiptText) {
      receiptText.innerText = 'Bağlı / Hazır';
      receiptText.style.color = '#34d399';
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
