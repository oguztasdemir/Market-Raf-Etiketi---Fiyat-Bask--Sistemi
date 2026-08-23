// ==========================================
// DESIGNER PANELİ: Etiket Modelleri & Canvas Editörü
// ==========================================

let editorScale = 1;
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
  showToast(`⭐ "${tpl.name}" varsayılan model olarak ayarlandı!`, "success");
}


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
  const ok = await showCustomConfirm(`"${tplName}" şablonu üzerindeki değişiklikleri kaydetmek istediğinize emin misiniz?`, "Şablonu Kaydet", "Evet, Kaydet", "Vazgeç", "💾");
  if (!ok) return;
  
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
      showToast("✓ Etiket modeli ve görsel düzenlemeler başarıyla kaydedildi!", "success");
    }
  } catch(e) {
    showToast("Şablon kaydedilemedi!", "error");
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
  editorScale = 1;
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

// Window Global Bağlantıları
window.createNewTemplate = createNewTemplate;
window.openNewModelModal = openNewModelModal;
window.closeNewModelModal = closeNewModelModal;
window.submitNewModelModal = submitNewModelModal;
window.adjustEditorScale = adjustEditorScale;
window.resetEditorScale = resetEditorScale;
window.applyEditorScale = applyEditorScale;
