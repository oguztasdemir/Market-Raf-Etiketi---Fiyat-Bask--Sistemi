// -*- coding: utf-8 -*-
/**
 * MANAV ÜRÜN TABLOSU, IZGARA & FİLTRELER (manav_terazi_paneli.js)
 */

/**
 * Manav & Barkodlu Terazi (PLU Tuş Yönetimi ve Senkronizasyon) Modülü
 */

let manavProductsData = [];
let currentManavView = 'table'; // 'grid' | 'table'
let currentManavFilter = 'kg'; // 'kg' | 'adet' | 'all' | 'diff' | 'synced'
let activeScaleSettings = null;
let currentEditingManavPlu = null;

// Modül Başlatıcı
async function initManavPanel() {
  await Promise.all([
    loadManavStatus(),
    loadManavProducts()
  ]);
}

// 1. Terazi Bağlantı ve Durum Bilgisini Getir
async function loadManavStatus() {
  const statusBadge = document.getElementById('scale-status-badge');
  const statusText = document.getElementById('scale-status-text');
  const pingText = document.getElementById('scale-ping-text');
  const poolSelect = document.getElementById('scale-pool-select');

  try {
    const res = await fetch(`${API_BASE}/api/scale/status`);
    const data = await res.json();

    if (data.status === 'success') {
      activeScaleSettings = data.settings || {};
      const conn = data.connection || {};

      if (poolSelect && Array.isArray(activeScaleSettings.scales_list)) {
        const curVal = `${activeScaleSettings.ip}:${activeScaleSettings.port}`;
        poolSelect.innerHTML = activeScaleSettings.scales_list.map(sc => {
          const val = `${sc.ip}:${sc.port}`;
          const isSel = val === curVal ? 'selected' : '';
          const icon = sc.department?.toLowerCase().includes('kasap') ? '🥩' : '🥬';
          return `<option value="${val}" ${isSel}>${icon} ${sc.name} (${sc.ip})</option>`;
        }).join('');
      }

      if (conn.online) {
        if (statusBadge) {
          statusBadge.className = 'badge-status-pill online';
          statusBadge.innerText = '🟢 Çevrimiçi';
        }
        if (statusText) statusText.innerText = 'Terazi Aktif';
        if (pingText) pingText.innerText = `${conn.ping_ms} ms`;
      } else {
        if (statusBadge) {
          statusBadge.className = 'badge-status-pill offline';
          statusBadge.innerText = '🔴 Çevrimdışı';
        }
        if (statusText) statusText.innerText = 'Bağlantı Yok';
        if (pingText) pingText.innerText = '-';
      }
    }
  } catch (err) {
    if (statusBadge) {
      statusBadge.className = 'badge-status-pill offline';
      statusBadge.innerText = '🔴 HATA';
    }
  }
}

async function onScalePoolSelectChange() {
  const poolSelect = document.getElementById('scale-pool-select');
  if (!poolSelect) return;
  const parts = poolSelect.value.split(':');
  if (parts.length === 2) {
    const ip = parts[0];
    const port = parseInt(parts[1]);
    if (typeof showToast === 'function') showToast(`🔄 ${ip} terazisine geçiliyor...`, 'info');
    await fetch(`${API_BASE}/api/scale/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, port })
    });
    await loadManavStatus();
  }
}

// 2. Bağlantıyı Test Et Butonu
async function testScaleConnectionAction() {
  if (typeof showToast === 'function') {
    showToast('Teraziye bağlantı sinyali gönderiliyor...', 'info');
  }

  try {
    const res = await fetch(`${API_BASE}/api/scale/test_connection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const data = await res.json();
    const result = data.result || {};

    if (result.online) {
      if (typeof showToast === 'function') {
        showToast(`✅ ${result.message}`, 'success');
      }
    } else {
      if (typeof showToast === 'function') {
        showToast(`⚠️ ${result.message}`, 'error');
      }
    }
    await loadManavStatus();
  } catch (err) {
    if (typeof showToast === 'function') {
      showToast(`Bağlantı hatası: ${err.message}`, 'error');
    }
  }
}

function sanitizeTitle(str) {
  if (!str) return '';
  return String(str).replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
}

// 3. Manav Ürünlerini Getir
async function loadManavProducts() {
  const gridContainer = document.getElementById('manav-plu-grid');
  const tableContainer = document.getElementById('manav-table-tbody');

  if (gridContainer) {
    gridContainer.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
        <div class="spinner" style="margin: 0 auto 12px;"></div>
        Manav ve PLU ürünleri yükleniyor...
      </div>
    `;
  }

  try {
    const res = await fetch(`${API_BASE}/api/scale/products`);
    const data = await res.json();

    if (data.status === 'success') {
      manavProductsData = (data.products || []).map(p => {
        p.title = sanitizeTitle(p.title);
        return p;
      }).sort((a, b) => (parseInt(a.plu, 10) || 0) - (parseInt(b.plu, 10) || 0));
      renderManavView();
      updateManavCounts(data.total, data.diff_count);
    }
  } catch (err) {
    if (gridContainer) {
      gridContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #ef4444; padding: 30px;">Hata: ${err.message}</div>`;
    }
  }
}

function getNextPluNumber() {
  if (!manavProductsData || manavProductsData.length === 0) return 1;
  const plus = manavProductsData.map(p => parseInt(p.plu, 10)).filter(n => !isNaN(n));
  if (plus.length === 0) return 1;
  return Math.max(...plus) + 1;
}

// Sayaçları Güncelle
function updateManavCounts(total, diff) {
  const pillAll = document.getElementById('manav-count-all');
  const pillKg = document.getElementById('manav-count-kg');
  const pillAdet = document.getElementById('manav-count-adet');
  const pillDiff = document.getElementById('manav-count-diff');
  const pillSynced = document.getElementById('manav-count-synced');

  const t = total || manavProductsData.length;
  const kgCount = manavProductsData.filter(i => (i.unit || '').toLowerCase() !== 'adet').length;
  const adetCount = manavProductsData.filter(i => (i.unit || '').toLowerCase() === 'adet').length;
  const d = diff !== undefined ? diff : manavProductsData.filter(x => x.sync_status === 'diff' || x.price !== x.scale_price).length;
  const s = t - d;

  if (pillAll) pillAll.innerText = t;
  if (pillKg) pillKg.innerText = kgCount;
  if (pillAdet) pillAdet.innerText = adetCount;
  if (pillDiff) pillDiff.innerText = d;
  if (pillSynced) pillSynced.innerText = s;
}

// Görünümü Render Et (Doğrudan Düzenlenebilir Tablo Liste - Her Zaman 1-2-3-4-5 Sıralı)
function renderManavView() {
  const searchVal = (document.getElementById('manav-search-inp')?.value || '').toLowerCase().trim();

  let filtered = manavProductsData.filter(item => {
    const unit = (item.unit || '').toLowerCase();
    const isAdet = ['adet', 'demet', 'paket', 'pk'].includes(unit);

    // Filtre
    if (currentManavFilter === 'kg') {
      if (isAdet) return false;
    } else if (currentManavFilter === 'adet') {
      if (!isAdet) return false;
    } else if (currentManavFilter === 'diff') {
      if (item.sync_status !== 'diff' && item.price === item.scale_price) return false;
    } else if (currentManavFilter === 'synced') {
      if (item.sync_status === 'diff' || item.price !== item.scale_price) return false;
    }

    // Arama
    if (searchVal) {
      const pluMatch = item.plu ? String(item.plu).includes(searchVal) : false;
      const cleanT = sanitizeTitle(item.title || '').toLowerCase();
      const titleMatch = cleanT.includes(searchVal);
      const barcodeMatch = (item.barcode || '').toLowerCase().includes(searchVal);
      if (!pluMatch && !titleMatch && !barcodeMatch) return false;
    }

    return true;
  });

  // Tartılı ürünler PLU sırasına göre, Adet ürünleri başlığa göre sıralanır
  filtered.sort((a, b) => {
    const aAdet = ['adet', 'demet', 'paket', 'pk'].includes((a.unit || '').toLowerCase());
    const bAdet = ['adet', 'demet', 'paket', 'pk'].includes((b.unit || '').toLowerCase());
    if (!aAdet && !bAdet) {
      return (parseInt(a.plu, 10) || 0) - (parseInt(b.plu, 10) || 0);
    }
    if (!aAdet && bAdet) return -1;
    if (aAdet && !bAdet) return 1;
    return (a.title || '').localeCompare(b.title || '');
  });

  renderManavTable(filtered);
}

// Manav Tablo Liste Görünümü (Satıra / Ürün Adına Tıklayınca Otomatik Düzenle Açılır)
function renderManavTable(items) {
  const tableWrapper = document.getElementById('manav-table-view-wrapper');
  const tbody = document.getElementById('manav-table-tbody');

  if (tableWrapper) tableWrapper.style.display = 'block';
  if (!tbody) return;

  if (items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">
          Kayıtlı manav veya terazi ürünü bulunamadı.
        </td>
      </tr>
    `;
    return;
  }

  let html = '';
  items.forEach(item => {
    const isAdet = ['adet', 'demet', 'paket', 'pk'].includes((item.unit || '').toLowerCase());
    const isDiff = !isAdet && (item.sync_status === 'diff' || item.price !== item.scale_price);
    const isEmpty = !(item.title || '').trim();
    
    let statusBadge = '';
    if (isEmpty) {
      statusBadge = '<span class="badge-sync-status" style="background: rgba(148,163,184,0.06); color: #64748b; border: 1px solid rgba(148,163,184,0.2); padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 11px;">📭 Boş Slot</span>';
    } else if (isAdet) {
      statusBadge = '<span class="badge-sync-status" style="background: rgba(192,132,252,0.12); color: #c084fc; border: 1px solid rgba(192,132,252,0.3); padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 11px;">📦 Adet (Muaf)</span>';
    } else if (isDiff) {
      statusBadge = '<span class="badge-sync-status changed">⚠️ Fiyat Farkı</span>';
    } else {
      statusBadge = '<span class="badge-sync-status matched">✅ Terazi Güncel</span>';
    }

    const cleanTitleText = isEmpty 
      ? '<span style="color: #475569; font-style: italic; font-weight: 400; font-size: 12.5px;">[Boş PLU Slotu - Tanımlamak için Tıklayın]</span>' 
      : sanitizeTitle(item.title);

    const pluDisplay = isAdet ? '<span style="color: #64748b; font-size: 11px; font-style: italic;">Barkodlu</span>' : (item.plu ? `[${item.plu}]` : '-');
    const pluColor = isAdet ? '#64748b' : '#38bdf8';
    const clickParam = isAdet ? `'${item.barcode}'` : (item.plu || `'${item.barcode}'`);

    const imgTag = item.image 
      ? `<img src="${item.image}" alt="" style="width: 26px; height: 26px; border-radius: 6px; object-fit: cover; vertical-align: middle; margin-right: 8px; border: 1px solid rgba(255,255,255,0.12);">`
      : `<span style="color: ${isEmpty ? '#475569' : '#38bdf8'}; margin-right: 6px;">${isEmpty ? '➕' : '✏️'}</span>`;

    html += `
      <tr onclick="openEditManavModal(${clickParam})" ondblclick="${isEmpty ? '' : `openCatalogProductDetailModal('${item.barcode || item.plu}')`}" style="cursor: pointer; transition: background 0.15s;" onmouseover="this.style.background='rgba(56,189,248,0.08)'" onmouseout="this.style.background='transparent'" title="${isEmpty ? 'Yeni Ürün Tanımlamak için Tıklayın' : 'Düzenlemek için Tıklayın, Detaylı Kart için Çift Tıklayın'}">
        <td style="font-weight: 900; color: ${pluColor}; text-align: center; font-size: 12.5px; font-family: monospace;">${pluDisplay}</td>
        <td style="font-family: monospace; color: #94a3b8; font-weight: 600;">${item.barcode || '-'}</td>
        <td style="font-weight: 800; color: #ffffff; display: flex; align-items: center;">
          ${imgTag} <span>${cleanTitleText}</span>
        </td>
        <td style="text-align: center; font-weight: 700; font-size: 12px;">
          <span style="background: ${isAdet ? 'rgba(192,132,252,0.15)' : 'rgba(56,189,248,0.15)'}; color: ${isAdet ? '#c084fc' : '#38bdf8'}; padding: 2px 7px; border-radius: 4px; opacity: ${isEmpty ? 0.3 : 1};">
            ${isAdet ? (item.unit || 'Adet') : 'Kg'}
          </span>
        </td>
        <td style="text-align: right; font-weight: 900; color: #10b981; font-size: 13.5px; font-family: monospace;">${item.price || '-'}</td>
        <td style="text-align: right; color: ${isDiff ? '#f87171' : '#94a3b8'}; font-weight: 700; font-family: monospace;">${isEmpty ? '-' : (isAdet ? '-' : (item.scale_price || '-'))}</td>
        <td style="text-align: center;">${statusBadge}</td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

// Görünüm Değiştir (Grid / Tablo)
function setManavViewMode(mode) {
  currentManavView = mode;
  const btnGrid = document.getElementById('btn-view-manav-grid');
  const btnTable = document.getElementById('btn-view-manav-table');

  if (btnGrid) btnGrid.className = mode === 'grid' ? 'btn-view-mode active' : 'btn-view-mode';
  if (btnTable) btnTable.className = mode === 'table' ? 'btn-view-mode active' : 'btn-view-mode';

  renderManavView();
}

// Filtre Değiştir
function filterManavTab(filter) {
  currentManavFilter = filter;
  ['all', 'kg', 'adet', 'diff', 'synced'].forEach(f => {
    const el = document.getElementById(`pill-manav-${f}`);
    if (el) {
      if (f === filter) el.classList.add('active');
      else el.classList.remove('active');
    }
  });
  renderManavView();
}

// 6. Tekli Fiyat Teraziye Gönder
async function sendSinglePriceToScaleAction(plu, btnElement) {
  const oldText = btnElement ? btnElement.innerHTML : null;
  if (btnElement) {
    btnElement.innerHTML = '⏳...';
    btnElement.disabled = true;
  }

  try {
    const res = await fetch(`${API_BASE}/api/scale/send_price/${plu}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();

    if (data.status === 'success') {
      if (typeof showToast === 'function') {
        showToast(`✅ ${data.message}`, 'success');
      }
      if (btnElement) {
        btnElement.innerHTML = '✅ Gönderildi';
        btnElement.style.background = '#10b981';
        btnElement.style.color = '#ffffff';
      }
      await loadManavProducts();
      await loadManavStatus();
    } else {
      if (typeof showToast === 'function') {
        showToast(`⚠️ ${data.message || 'Gönderim hatası'}`, 'error');
      }
      if (btnElement) {
        btnElement.innerHTML = '⚠️ Hata';
      }
    }
  } catch (err) {
    if (typeof showToast === 'function') {
      showToast(`Bağlantı hatası: ${err.message}`, 'error');
    }
    if (btnElement) {
      btnElement.innerHTML = '⚠️ Hata';
    }
  } finally {
    setTimeout(() => {
      if (btnElement && oldText) {
        btnElement.innerHTML = oldText;
        btnElement.disabled = false;
        btnElement.style.background = '';
        btnElement.style.color = '';
      }
    }, 2000);
  }
}

// 6.4 Terazi İşlem Onay Pop-up Modalı (Enter ve Esc Tuş Desteği)
let pendingScaleAction = null;
let scaleConfirmKeyHandler = null;

function showScaleConfirmDialog({ icon, title, subtitle, message, onConfirm }) {
  const modal = document.getElementById('modal-scale-confirm');
  const iconEl = document.getElementById('scale-confirm-icon');
  const titleEl = document.getElementById('scale-confirm-title');
  const subtitleEl = document.getElementById('scale-confirm-subtitle');
  const messageEl = document.getElementById('scale-confirm-message');
  const btnYes = document.getElementById('btn-scale-confirm-yes');
  const btnNo = document.getElementById('btn-scale-confirm-no');

  if (iconEl) iconEl.innerText = icon || '⚖️';
  if (titleEl) titleEl.innerText = title || 'Onay Gerekiyor';
  if (subtitleEl) subtitleEl.innerText = subtitle || 'Barkodlu Terazi Senkronizasyonu';
  if (messageEl) messageEl.innerText = message || 'Bu işlemi gerçekleştirmek istediğinize emin misiniz?';

  pendingScaleAction = onConfirm;

  if (modal) modal.style.display = 'flex';

  // Global tuş dinleyicisi: Enter ile onayla, Esc ile iptal et
  if (scaleConfirmKeyHandler) {
    window.removeEventListener('keydown', scaleConfirmKeyHandler);
  }

  scaleConfirmKeyHandler = function(e) {
    const confirmModal = document.getElementById('modal-scale-confirm');
    if (confirmModal && confirmModal.style.display === 'flex') {
      if (e.key === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault();
        e.stopPropagation();
        executeScaleConfirmAction();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeScaleConfirmModal();
      }
    }
  };

  window.addEventListener('keydown', scaleConfirmKeyHandler);

  if (btnYes) {
    btnYes.onclick = executeScaleConfirmAction;
    setTimeout(() => { btnYes.focus(); }, 50);
  }
  if (btnNo) {
    btnNo.onclick = closeScaleConfirmModal;
  }
}

function executeScaleConfirmAction() {
  const action = pendingScaleAction;
  closeScaleConfirmModal();
  if (typeof action === 'function') {
    action();
  }
}

function closeScaleConfirmModal() {
  const modal = document.getElementById('modal-scale-confirm');
  if (modal) modal.style.display = 'none';
  pendingScaleAction = null;
  if (scaleConfirmKeyHandler) {
    window.removeEventListener('keydown', scaleConfirmKeyHandler);
    scaleConfirmKeyHandler = null;
  }
}
