// -*- coding: utf-8 -*-
/**
 * ETİKET ŞABLON LİSTESİ & CANVASI (etiket_tasarim_paneli.js)
 */

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
  
  const currentTpl = templatesList.find(t => t.id === (editingTemplateId || 'default')) || templatesList[0];
  if (currentTpl) {
    openTemplateInEditor(currentTpl);
  } else {
    updateEditorPreview();
  }
  
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
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.06);">
        <button type="button" onclick="event.stopPropagation(); duplicateTemplateById('${tpl.id}')" style="background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); color: #34d399; font-size: 9.5px; font-weight: 700; padding: 2px 7px; border-radius: 4px; cursor: pointer;" title="Bu Modeli Kopyala & Yeni Tasarım Yap">
          📋 Kopyala
        </button>
        <span style="font-size: 10px; font-weight: 800; color: #38bdf8; display: flex; align-items: center; gap: 3px;">
          <span>Aç & Düzenle</span> <span>➔</span>
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
      if (data.template && data.template.id) {
        editingTemplateId = data.template.id;
      }
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

