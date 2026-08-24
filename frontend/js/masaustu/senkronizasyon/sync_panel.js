// ==========================================
// SYNC PANELİ: Katalog Güncelleme, Tablo & Filtreler
// ==========================================

let currentSyncData = null;
let filteredSyncItems = [];
let activeSyncFilter = "changed";
let selectedSyncBarcodes = new Set();
let syncAnchorIndex = -1;
let syncBaseSelection = new Set();
let syncSearchQuery = "";
let syncRenderedCount = 100;
let syncSortColumn = null;
let syncSortDirection = "asc";


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
      const savedSyncFilter = localStorage.getItem('active_sync_filter');
      if (savedSyncFilter) {
        activeSyncFilter = savedSyncFilter;
      }
      updateSyncStatsBadges();
      filterSyncTab(activeSyncFilter, false);
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
  const pillAll = document.getElementById('pill-count-all');
  const topBtnCount = document.getElementById('top-btn-changed-count');

  if (pillChanged) pillChanged.innerText = (stats.changed_count || 0).toLocaleString('tr-TR');
  if (pillNew) pillNew.innerText = (stats.new_count || 0).toLocaleString('tr-TR');
  if (pillMatched) pillMatched.innerText = (stats.matched_count || 0).toLocaleString('tr-TR');
  if (pillAll) pillAll.innerText = (stats.total_excel_rows || 0).toLocaleString('tr-TR');
  
  updateSyncApplyButtonLabel();
}


function updateSyncApplyButtonLabel() {
  const btn = document.getElementById('btn-sync-apply-all-top');
  if (!btn || !currentSyncData) return;

  const stats = currentSyncData.stats || {};
  const changed = stats.changed_count || 0;
  const newCount = stats.new_count || 0;
  const total = changed + newCount;

  if (activeSyncFilter === 'new') {
    btn.innerHTML = `➕ Yeni Ürünleri Stoğa Ekle (<span id="top-btn-changed-count">${newCount.toLocaleString('tr-TR')}</span>)`;
    btn.title = "Stok dosyasındaki tüm yeni ürünleri kataloğa ekler";
  } else if (activeSyncFilter === 'changed') {
    btn.innerHTML = `⚡ Fiyatları Kataloğa Güncelle (<span id="top-btn-changed-count">${changed.toLocaleString('tr-TR')}</span>)`;
    btn.title = "Stok dosyasındaki tüm fiyat değişikliklerini kataloğa uygular";
  } else {
    btn.innerHTML = `⚡ Tüm Değişiklikleri Kataloğa Aktar (<span id="top-btn-changed-count">${total.toLocaleString('tr-TR')}</span>)`;
    btn.title = "Hem fiyat değişikliklerini uygular hem de yeni ürünleri kataloğa ekler";
  }

  btn.style.cursor = 'pointer';
  btn.style.pointerEvents = 'auto';
  btn.onclick = function(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    applyAllChangedPricesFromSync();
  };
}


function filterSyncTab(filterName, updateStorage = true) {
  activeSyncFilter = filterName;
  if (updateStorage) {
    localStorage.setItem('active_sync_filter', filterName);
  }

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
    'matched': 'pill-matched'
  };
  const activePill = document.getElementById(pillMap[filterName] || 'pill-changed');
  if (activePill) activePill.classList.add('active');

  updateSyncApplyButtonLabel();
  clearSyncSelection();
  renderSyncTable();
}


function onSyncSearchInput(val) {
  syncSearchQuery = (val || '').trim();
  renderSyncTable();
}


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
    } else {
      rawList = [
        ...(currentSyncData.changed_prices || []),
        ...(currentSyncData.new_products || []),
        ...(currentSyncData.matched_products || [])
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

    // 3. Sıralama filtresini uygula (A-Z, Fiyat, Barkod vb.)
    applySyncSorting();

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

    if (item.status === 'changed') {
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
        <td class="td-select-col" onclick="handleSyncSelectSquareClick('${item.barcode}', event)" title="Bu ürünü seç / kaldır">
          <div class="custom-select-square ${isSelected ? 'active-checked' : ''}">${isSelected ? '✓' : ''}</div>
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
        <td class="td-select-col" onclick="handleSyncSelectSquareClick('${item.barcode}', event)" title="Bu ürünü seç / kaldır">
          <div class="custom-select-square ${isSelected ? 'active-checked' : ''}">${isSelected ? '✓' : ''}</div>
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


function handleSyncSelectSquareClick(barcode, event) {
  if (event) event.stopPropagation();
  const isSelected = selectedSyncBarcodes.has(barcode);
  onSyncCheckboxChange(barcode, !isSelected, event);
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

  const selectAllBox = document.getElementById('sync-select-all-box');
  if (selectAllBox) {
    if (count > 0 && count === total) {
      selectAllBox.className = 'custom-select-square active-checked';
      selectAllBox.innerText = '✓';
    } else if (count > 0) {
      selectAllBox.className = 'custom-select-square indeterminate-checked';
      selectAllBox.innerText = '—';
    } else {
      selectAllBox.className = 'custom-select-square';
      selectAllBox.innerText = '';
    }
  }
}


function toggleSelectAllSyncCustom(event) {
  if (event) event.stopPropagation();
  const allSelected = (filteredSyncItems.length > 0 && selectedSyncBarcodes.size >= filteredSyncItems.length);
  toggleSelectAllSync(!allSelected);
}


function updateSyncRowSelections() {
  const tbody = document.getElementById('sync-tbody');
  if (!tbody) return;

  const rows = tbody.querySelectorAll('tr[data-barcode]');
  rows.forEach(tr => {
    const barcode = tr.getAttribute('data-barcode');
    const box = tr.querySelector('.custom-select-square');
    const isSelected = selectedSyncBarcodes.has(barcode);

    if (isSelected) {
      tr.classList.add('selected-row');
      if (box) {
        box.classList.add('active-checked');
        box.innerText = '✓';
      }
    } else {
      tr.classList.remove('selected-row');
      if (box) {
        box.classList.remove('active-checked');
        box.innerText = '';
      }
    }
  });
}


function sortSyncColumn(colKey) {
  if (syncSortColumn === colKey) {
    syncSortDirection = (syncSortDirection === 'asc') ? 'desc' : 'asc';
  } else {
    syncSortColumn = colKey;
    syncSortDirection = 'asc';
  }

  updateSyncSortIcons();
  renderSyncTable(true);
}


function applySyncSorting() {
  if (!syncSortColumn || !filteredSyncItems || filteredSyncItems.length === 0) return;

  const dir = (syncSortDirection === 'asc') ? 1 : -1;

  filteredSyncItems.sort((a, b) => {
    // 1. Fiyat Sıralaması
    if (syncSortColumn === 'current_price') {
      const numA = parsePriceNumber(a.current_price || a.excel_price);
      const numB = parsePriceNumber(b.current_price || b.excel_price);
      return (numA - numB) * dir;
    }
    if (syncSortColumn === 'excel_price') {
      const numA = parsePriceNumber(a.excel_price || a.current_price);
      const numB = parsePriceNumber(b.excel_price || b.current_price);
      return (numA - numB) * dir;
    }

    // 2. Ürün Adı Sıralaması (A-Z / Z-A) - Türkçe Karakter Uyumlu
    if (syncSortColumn === 'excel_title' || syncSortColumn === 'current_title' || syncSortColumn === 'title') {
      let titleA = (syncSortColumn === 'current_title') 
        ? (a.current_title || a.excel_title || '') 
        : (a.excel_title || a.current_title || '');
      let titleB = (syncSortColumn === 'current_title') 
        ? (b.current_title || b.excel_title || '') 
        : (b.excel_title || b.current_title || '');

      titleA = String(titleA).trim();
      titleB = String(titleB).trim();
      return titleA.localeCompare(titleB, 'tr', { numeric: true, sensitivity: 'base' }) * dir;
    }

    // 3. Marka Sıralaması
    if (syncSortColumn === 'brand') {
      const brandA = String(a.brand || 'DİĞER').trim();
      const brandB = String(b.brand || 'DİĞER').trim();
      return brandA.localeCompare(brandB, 'tr', { sensitivity: 'base' }) * dir;
    }

    // 4. Barkod Sıralaması
    if (syncSortColumn === 'barcode') {
      const barA = String(a.barcode || '').trim();
      const barB = String(b.barcode || '').trim();
      return barA.localeCompare(barB, 'tr', { numeric: true }) * dir;
    }

    // 5. Durum Sıralaması
    if (syncSortColumn === 'status') {
      const stA = String(a.status || '').trim();
      const stB = String(b.status || '').trim();
      return stA.localeCompare(stB, 'tr') * dir;
    }

    // 6. Genel Alan Sıralaması
    const valA = String(a[syncSortColumn] || '').trim();
    const valB = String(b[syncSortColumn] || '').trim();
    return valA.localeCompare(valB, 'tr', { numeric: true, sensitivity: 'base' }) * dir;
  });
}


function updateSyncSortIcons() {
  const iconMap = {
    'barcode': 'sync-sort-ico-barcode',
    'brand': 'sync-sort-ico-brand',
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

function onSyncQuickSortChange(val) {
  if (!val) {
    syncSortColumn = null;
    syncSortDirection = 'asc';
  } else if (val === 'title_asc') {
    syncSortColumn = 'excel_title';
    syncSortDirection = 'asc';
  } else if (val === 'title_desc') {
    syncSortColumn = 'excel_title';
    syncSortDirection = 'desc';
  } else if (val === 'brand_asc') {
    syncSortColumn = 'brand';
    syncSortDirection = 'asc';
  } else if (val === 'price_asc') {
    syncSortColumn = 'excel_price';
    syncSortDirection = 'asc';
  } else if (val === 'price_desc') {
    syncSortColumn = 'excel_price';
    syncSortDirection = 'desc';
  } else if (val === 'barcode_asc') {
    syncSortColumn = 'barcode';
    syncSortDirection = 'asc';
  }

  updateSyncSortIcons();
  renderSyncTable(true);
}

window.sortSyncColumn = sortSyncColumn;
window.applySyncSorting = applySyncSorting;
window.onSyncQuickSortChange = onSyncQuickSortChange;

