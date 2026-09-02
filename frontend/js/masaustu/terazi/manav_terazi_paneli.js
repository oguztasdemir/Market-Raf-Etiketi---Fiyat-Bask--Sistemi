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

    html += `
      <tr onclick="openEditManavModal(${clickParam})" ondblclick="${isEmpty ? '' : `openCatalogProductDetailModal('${item.barcode || item.plu}')`}" style="cursor: pointer; transition: background 0.15s;" onmouseover="this.style.background='rgba(56,189,248,0.08)'" onmouseout="this.style.background='transparent'" title="${isEmpty ? 'Yeni Ürün Tanımlamak için Tıklayın' : 'Düzenlemek için Tıklayın, Detaylı Kart için Çift Tıklayın'}">
        <td style="font-weight: 900; color: ${pluColor}; text-align: center; font-size: 12.5px; font-family: monospace;">${pluDisplay}</td>
        <td style="font-family: monospace; color: #94a3b8; font-weight: 600;">${item.barcode || '-'}</td>
        <td style="font-weight: 800; color: #ffffff;">
          <span style="color: ${isEmpty ? '#475569' : '#38bdf8'}; margin-right: 6px;">${isEmpty ? '➕' : '✏️'}</span> ${cleanTitleText}
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

// 6.5 Teraziden Güncel Ürün ve Fiyatları Çek (Canlı Progress Bar ile)
async function fetchPricesFromScaleAction(forceDirect = false) {
  if (!forceDirect) {
    showScaleConfirmDialog({
      icon: '📥',
      title: 'Teraziden Veri Al',
      subtitle: 'DIGI SM-100 Barkodlu Terazi',
      message: 'Terazideki güncel ürünleri ve fiyatları sisteme çekmek istediğinize emin misiniz?',
      onConfirm: () => fetchPricesFromScaleAction(true)
    });
    return;
  }

  const modal = document.getElementById('modal-scale-progress');
  const activeView = document.getElementById('scale-progress-active-view');
  const successView = document.getElementById('scale-progress-success-view');
  const errorView = document.getElementById('scale-progress-error-view');
  
  const titleEl = document.getElementById('scale-progress-title');
  const subtitleEl = document.getElementById('scale-progress-subtitle');
  const countEl = document.getElementById('scale-progress-count');
  const totalEl = document.getElementById('scale-progress-total');
  const percentEl = document.getElementById('scale-progress-percent');
  const barFill = document.getElementById('scale-progress-bar-fill');
  const itemEl = document.getElementById('scale-progress-current-item');
  
  const btnCloseX = document.getElementById('btn-close-scale-progress-x');
  const btnClose = document.getElementById('btn-scale-progress-close');
  const btnRetry = document.getElementById('btn-scale-progress-retry');

  // Başlıkları "Veri Çekme" moduna ayarla
  if (titleEl) titleEl.innerText = 'DIGI SM-100 Terazisinden Veri Çekme';
  if (subtitleEl) subtitleEl.innerText = '192.168.1.61:2061 • PLU Tuşları, Ürün İsimleri & Fiyatlar Okunuyor...';

  // Detay tablosunu gizle
  const detailsContainer = document.getElementById('scale-details-table-container');
  const detailsIcon = document.getElementById('scale-details-toggle-icon');
  if (detailsContainer) detailsContainer.style.display = 'none';
  if (detailsIcon) detailsIcon.innerText = '▼';

  if (modal) modal.style.display = 'flex';
  if (activeView) activeView.style.display = 'block';
  if (successView) successView.style.display = 'none';
  if (errorView) errorView.style.display = 'none';

  if (countEl) countEl.innerText = '0';
  if (totalEl) totalEl.innerText = '...';
  if (percentEl) percentEl.innerText = '0%';
  if (barFill) barFill.style.width = '0%';
  if (itemEl) itemEl.innerText = 'DIGI SM-100 terazisine bağlanılıyor...';

  if (btnCloseX) btnCloseX.style.display = 'none';
  if (btnClose) btnClose.style.display = 'none';
  if (btnRetry) btnRetry.style.display = 'none';

  if (scaleEventSource) {
    try { scaleEventSource.close(); } catch(e) {}
  }

  try {
    scaleEventSource = new EventSource(`${API_BASE}/api/scale/fetch_prices_stream`);

    scaleEventSource.onmessage = function(event) {
      try {
        const data = JSON.parse(event.data);

        // A) Başlangıç
        if (data.type === 'init') {
          if (itemEl) itemEl.innerText = data.message;
        }
        // B) Canlı İlerleme
        else if (data.type === 'progress') {
          if (countEl) countEl.innerText = data.current;
          if (totalEl) totalEl.innerText = data.total;
          if (percentEl) percentEl.innerText = `${data.percent}%`;
          if (barFill) barFill.style.width = `${data.percent}%`;
          if (itemEl) itemEl.innerText = data.item_text || `${data.title} (${data.price})`;
        }
        // C) Tamamlandı
        else if (data.type === 'complete') {
          if (scaleEventSource) {
            scaleEventSource.close();
            scaleEventSource = null;
          }

          if (percentEl) percentEl.innerText = '100%';
          if (barFill) barFill.style.width = '100%';

          setTimeout(() => {
            if (activeView) activeView.style.display = 'none';
            if (successView) successView.style.display = 'block';
            
            const successMsgEl = document.getElementById('scale-progress-success-msg');
            if (successMsgEl) successMsgEl.innerText = data.message;

            const summaryTotal = document.getElementById('scale-summary-total');
            const summaryChanged = document.getElementById('scale-summary-changed');
            const badgeCount = document.getElementById('scale-details-badge-count');
            const tbody = document.getElementById('scale-details-tbody');

            const changedCount = (data.changed_items && data.changed_items.length !== undefined) ? data.changed_items.length : (data.changed_count || 0);
            const changedItems = data.changed_items || [];

            if (summaryTotal) summaryTotal.innerText = `${data.count || data.total} Ürün`;
            if (summaryChanged) summaryChanged.innerText = `${changedCount} Ürün`;
            if (badgeCount) badgeCount.innerText = changedCount;

            // Değişen ürünler tablosunu doldur
            if (tbody) {
              if (changedItems.length > 0) {
                tbody.innerHTML = changedItems.map(item => `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 7px 10px; font-weight: 700; color: #f8fafc;">
                      <span style="color: #38bdf8; font-family: monospace; font-size: 11px;">[${item.plu}]</span> ${item.title}
                    </td>
                    <td style="padding: 7px 10px; text-align: right; color: #94a3b8; font-size: 11.5px; text-decoration: line-through;">
                      ${item.old_price}
                    </td>
                    <td style="padding: 7px 10px; text-align: right; font-weight: 800; color: #10b981; font-size: 12.5px;">
                      ${item.new_price}
                    </td>
                  </tr>
                `).join('');
              } else {
                tbody.innerHTML = `
                  <tr>
                    <td colspan="3" style="padding: 14px; text-align: center; color: #64748b; font-size: 12px;">
                      ✨ Tüm ürünlerin fiyatları terazi ile birebir aynı (Hiçbir fiyat farkı tespit edilmedi).
                    </td>
                  </tr>
                `;
              }
            }

            if (btnCloseX) btnCloseX.style.display = 'inline-flex';
            if (btnClose) btnClose.style.display = 'inline-block';

            if (typeof showToast === 'function') {
              showToast(`✅ ${data.message}`, 'success');
            }

            loadManavProducts();
            loadManavStatus();
          }, 300);
        }
        // D) Hata
        else if (data.type === 'error') {
          if (scaleEventSource) {
            scaleEventSource.close();
            scaleEventSource = null;
          }

          if (activeView) activeView.style.display = 'none';
          if (errorView) errorView.style.display = 'block';

          const errorMsgEl = document.getElementById('scale-progress-error-msg');
          if (errorMsgEl) errorMsgEl.innerText = data.message;

          if (btnCloseX) btnCloseX.style.display = 'inline-flex';
          if (btnClose) btnClose.style.display = 'inline-block';
          if (btnRetry) {
            btnRetry.style.display = 'inline-block';
            btnRetry.onclick = fetchPricesFromScaleAction;
          }

          if (typeof showToast === 'function') {
            showToast(`⚠️ Terazi okuma hatası!`, 'error');
          }
        }
      } catch (err) {
        console.error('SSE JSON parse hatası:', err);
      }
    };

    scaleEventSource.onerror = function(err) {
      if (scaleEventSource) {
        scaleEventSource.close();
        scaleEventSource = null;
      }
      if (activeView && activeView.style.display !== 'none') {
        if (activeView) activeView.style.display = 'none';
        if (errorView) errorView.style.display = 'block';

        const errorMsgEl = document.getElementById('scale-progress-error-msg');
        if (errorMsgEl) {
          errorMsgEl.innerText = 'Terazi veya sunucu bağlantısı koptu. Lütfen yerel ağınızı kontrol edin.';
        }

        if (btnCloseX) btnCloseX.style.display = 'inline-flex';
        if (btnClose) btnClose.style.display = 'inline-block';
        if (btnRetry) {
          btnRetry.style.display = 'inline-block';
          btnRetry.onclick = fetchPricesFromScaleAction;
        }
      }
    };

  } catch (ex) {
    if (activeView) activeView.style.display = 'none';
    if (errorView) errorView.style.display = 'block';

    const errorMsgEl = document.getElementById('scale-progress-error-msg');
    if (errorMsgEl) errorMsgEl.innerText = `Bağlantı başlatılamadı: ${ex.message}`;

    if (btnCloseX) btnCloseX.style.display = 'inline-flex';
    if (btnClose) btnClose.style.display = 'inline-block';
  }
}
let scaleEventSource = null;

function closeScaleProgressModal() {
  const modal = document.getElementById('modal-scale-progress');
  if (modal) modal.style.display = 'none';
  if (scaleEventSource) {
    try { scaleEventSource.close(); } catch(e) {}
    scaleEventSource = null;
  }
}

function toggleScaleDetailsTable() {
  const container = document.getElementById('scale-details-table-container');
  const icon = document.getElementById('scale-details-toggle-icon');
  if (!container) return;
  if (container.style.display === 'none' || container.style.display === '') {
    container.style.display = 'block';
    if (icon) icon.innerText = '▲';
  } else {
    container.style.display = 'none';
    if (icon) icon.innerText = '▼';
  }
}

async function sendAllPricesToScaleAction(forceDirect = false) {
  const count = manavProductsData.length;
  if (count === 0) {
    if (typeof showToast === 'function') {
      showToast('Gönderilecek manav ürünü bulunamadı.', 'warning');
    }
    return;
  }

  if (!forceDirect) {
    showScaleConfirmDialog({
      icon: '🚀',
      title: 'Teraziye Veri Gönder',
      subtitle: 'DIGI SM-100 Barkodlu Terazi',
      message: `Tanımlı ${count} adet manav ürününü ve güncel fiyatları teraziye aktarmak istediğinize emin misiniz?`,
      onConfirm: () => sendAllPricesToScaleAction(true)
    });
    return;
  }

  // 1. Modalı Aç ve Başlangıç Durumuna Getir
  const modal = document.getElementById('modal-scale-progress');
  const activeView = document.getElementById('scale-progress-active-view');
  const successView = document.getElementById('scale-progress-success-view');
  const errorView = document.getElementById('scale-progress-error-view');
  
  const titleEl = document.getElementById('scale-progress-title');
  const subtitleEl = document.getElementById('scale-progress-subtitle');
  const countEl = document.getElementById('scale-progress-count');
  const totalEl = document.getElementById('scale-progress-total');
  const percentEl = document.getElementById('scale-progress-percent');
  const barFill = document.getElementById('scale-progress-bar-fill');
  const itemEl = document.getElementById('scale-progress-current-item');
  
  const btnCloseX = document.getElementById('btn-close-scale-progress-x');
  const btnClose = document.getElementById('btn-scale-progress-close');
  const btnRetry = document.getElementById('btn-scale-progress-retry');

  if (titleEl) titleEl.innerText = 'DIGI SM-100 Terazisine Veri Aktarımı';
  if (subtitleEl) subtitleEl.innerText = '192.168.1.61:2061 • Tüm PLU Tuşları, Ürün İsimleri & Fiyatlar Senkronize Ediliyor...';

  // Detay tablosunu başlangıçta kapalı tut
  const detailsContainer = document.getElementById('scale-details-table-container');
  const detailsIcon = document.getElementById('scale-details-toggle-icon');
  if (detailsContainer) detailsContainer.style.display = 'none';
  if (detailsIcon) detailsIcon.innerText = '▼';

  if (modal) modal.style.display = 'flex';
  if (activeView) activeView.style.display = 'block';
  if (successView) successView.style.display = 'none';
  if (errorView) errorView.style.display = 'none';

  if (countEl) countEl.innerText = '0';
  if (totalEl) totalEl.innerText = count;
  if (percentEl) percentEl.innerText = '0%';
  if (barFill) barFill.style.width = '0%';
  if (itemEl) itemEl.innerText = 'DIGI SM-100 bağlantısı başlatılıyor...';

  if (btnCloseX) btnCloseX.style.display = 'none';
  if (btnClose) btnClose.style.display = 'none';
  if (btnRetry) btnRetry.style.display = 'none';

  // 2. Canlı SSE (Server-Sent Events) Akışını Başlat
  if (scaleEventSource) {
    try { scaleEventSource.close(); } catch(e) {}
  }

  try {
    scaleEventSource = new EventSource(`${API_BASE}/api/scale/send_all_stream`);

    scaleEventSource.onmessage = function(event) {
      try {
        const data = JSON.parse(event.data);

        // A) Başlangıç Durumu
        if (data.type === 'init') {
          if (totalEl) totalEl.innerText = data.total;
          if (itemEl) itemEl.innerText = data.message;
        }

        // B) İlerleme Adımı (Process Bar & Yüzdelik)
        else if (data.type === 'progress') {
          if (countEl) countEl.innerText = data.current;
          if (totalEl) totalEl.innerText = data.total;
          if (percentEl) percentEl.innerText = `${data.percent}%`;
          if (barFill) barFill.style.width = `${data.percent}%`;
          if (itemEl) itemEl.innerText = data.item_text || `${data.title} (${data.price})`;
        }

        // C) Başarıyla Tamamlandı
        else if (data.type === 'complete') {
          if (scaleEventSource) {
            scaleEventSource.close();
            scaleEventSource = null;
          }

          if (percentEl) percentEl.innerText = '100%';
          if (barFill) barFill.style.width = '100%';

          setTimeout(() => {
            if (activeView) activeView.style.display = 'none';
            if (successView) successView.style.display = 'block';
            
            const successMsgEl = document.getElementById('scale-progress-success-msg');
            if (successMsgEl) successMsgEl.innerText = data.message;

            // Özet sayıları doldur
            const summaryTotal = document.getElementById('scale-summary-total');
            const summaryChanged = document.getElementById('scale-summary-changed');
            const badgeCount = document.getElementById('scale-details-badge-count');
            const tbody = document.getElementById('scale-details-tbody');

            const changedCount = data.changed_count || 0;
            const changedItems = data.changed_items || [];

            if (summaryTotal) summaryTotal.innerText = data.total || data.success_count || count;
            if (summaryChanged) summaryChanged.innerText = changedCount;
            if (badgeCount) badgeCount.innerText = changedCount;

            // Değişen ürünler tablosunu doldur
            if (tbody) {
              if (changedItems.length > 0) {
                tbody.innerHTML = changedItems.map(item => `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 7px 10px; font-weight: 700; color: #f8fafc;">
                      <span style="color: #38bdf8; font-family: monospace; font-size: 11px;">[${item.plu}]</span> ${item.title}
                    </td>
                    <td style="padding: 7px 10px; text-align: right; color: #94a3b8; font-size: 11.5px; text-decoration: line-through;">
                      ${item.old_price}
                    </td>
                    <td style="padding: 7px 10px; text-align: right; font-weight: 800; color: #10b981; font-size: 12.5px;">
                      ${item.new_price}
                    </td>
                  </tr>
                `).join('');
              } else {
                tbody.innerHTML = `
                  <tr>
                    <td colspan="3" style="padding: 14px; text-align: center; color: #64748b; font-size: 12px;">
                      Bu aktarımda fiyatı değişen ürün bulunmadı, mevcut fiyatlar teraziye teyit edildi.
                    </td>
                  </tr>
                `;
              }
            }

            if (btnCloseX) btnCloseX.style.display = 'inline-flex';
            if (btnClose) btnClose.style.display = 'inline-block';
            
            if (typeof showToast === 'function') {
              showToast(`✅ ${data.message}`, 'success');
            }

            loadManavProducts();
            loadManavStatus();
          }, 300);
        }

        // D) Hata Oluştu (İnternet/Ağ/Soket/Timeout Sorunları)
        else if (data.type === 'error') {
          if (scaleEventSource) {
            scaleEventSource.close();
            scaleEventSource = null;
          }

          if (activeView) activeView.style.display = 'none';
          if (errorView) errorView.style.display = 'block';

          const errorMsgEl = document.getElementById('scale-progress-error-msg');
          if (errorMsgEl) errorMsgEl.innerText = data.message;

          if (btnCloseX) btnCloseX.style.display = 'inline-flex';
          if (btnClose) btnClose.style.display = 'inline-block';
          if (btnRetry) btnRetry.style.display = 'inline-block';

          if (typeof showToast === 'function') {
            showToast(`⚠️ Terazi aktarım hatası!`, 'error');
          }
        }
      } catch (err) {
        console.error('SSE JSON parse hatası:', err);
      }
    };

    scaleEventSource.onerror = function(err) {
      if (scaleEventSource) {
        scaleEventSource.close();
        scaleEventSource = null;
      }

      // Eğer hala aktif görünümdeyse hata göster
      if (activeView && activeView.style.display !== 'none') {
        if (activeView) activeView.style.display = 'none';
        if (errorView) errorView.style.display = 'block';

        const errorMsgEl = document.getElementById('scale-progress-error-msg');
        if (errorMsgEl) {
          errorMsgEl.innerText = 'Sunucu veya ağ bağlantısı koptu. Lütfen yerel ağınızı ve terazi bağlantısını kontrol edin.';
        }

        if (btnCloseX) btnCloseX.style.display = 'inline-flex';
        if (btnClose) btnClose.style.display = 'inline-block';
        if (btnRetry) btnRetry.style.display = 'inline-block';
      }
    };

  } catch (ex) {
    if (activeView) activeView.style.display = 'none';
    if (errorView) errorView.style.display = 'block';

    const errorMsgEl = document.getElementById('scale-progress-error-msg');
    if (errorMsgEl) errorMsgEl.innerText = `Bağlantı başlatılamadı: ${ex.message}`;

    if (btnCloseX) btnCloseX.style.display = 'inline-flex';
    if (btnClose) btnClose.style.display = 'inline-block';
    if (btnRetry) btnRetry.style.display = 'inline-block';
  }
}

// 9. Hızlı Etiket Basımı (Doğrudan Yazıcıya 1 Adet Raf Etiketi Basar)
async function printManavLabelQuick(barcode, title, price) {
  if (typeof showToast === 'function') {
    showToast(`🖨️ "${title}" için raf etiketi basılıyor...`, 'info');
  }

  try {
    const res = await fetch(`${API_BASE}/api/print/custom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barcode: barcode,
        title: title,
        title1: title,
        title2: '',
        price: price,
        unit_price: `${price} / Kg`,
        origin: 'TÜRKİYE',
        brand: 'YERLİ MANAV',
        copies: 1
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      if (typeof showToast === 'function') {
        showToast(`✅ "${title}" etiketi başarıyla yazdırıldı.`, 'success');
      }
    } else {
      if (typeof showToast === 'function') {
        showToast(`⚠️ Yazdırma hatası: ${data.message}`, 'error');
      }
    }
  } catch (err) {
    if (typeof showToast === 'function') {
      showToast(`Yazıcı bağlantı hatası: ${err.message}`, 'error');
    }
  }
}

// 10. Yeni / Düzenle Modal Yönetimi
function onManavUnitChange() {
  const unitVal = (document.getElementById('inp-manav-unit')?.value || 'Kg').toLowerCase();
  const isAdet = ['adet', 'demet', 'paket', 'pk'].includes(unitVal);
  const pluGroup = document.getElementById('group-manav-plu');
  const pluInp = document.getElementById('inp-manav-plu');
  const pluLbl = document.getElementById('lbl-manav-plu');
  const barcodeInp = document.getElementById('inp-manav-barcode');

  if (isAdet) {
    if (pluGroup) pluGroup.style.display = 'none';
    if (pluInp) {
      pluInp.value = '';
      pluInp.required = false;
    }
    if (barcodeInp && !barcodeInp.value) {
      generateBarcodeForManavModal();
    }
  } else {
    if (pluGroup) pluGroup.style.display = 'block';
    if (pluInp) {
      if (!pluInp.value) pluInp.value = getNextPluNumber();
      pluInp.required = true;
    }
  }
}

async function generateBarcodeForManavModal() {
  try {
    const res = await fetch(`${API_BASE}/api/catalog/generate_internal_barcode`);
    const data = await res.json();
    if (data.status === 'success' && data.barcode) {
      const bcInp = document.getElementById('inp-manav-barcode');
      if (bcInp) bcInp.value = data.barcode;
      if (typeof showToast === 'function') showToast(`⚡ Otomatik barkod atandı: ${data.barcode}`, 'info');
    }
  } catch (e) {
    // Fallback rastgele 270 serisi
    const rand = Math.floor(1000 + Math.random() * 9000);
    const bcInp = document.getElementById('inp-manav-barcode');
    if (bcInp) bcInp.value = `270${rand}`;
  }
}

function openAddManavModal() {
  const modal = document.getElementById('modal-manav-product');
  if (!modal) return;

  currentEditingManavPlu = null;
  document.getElementById('manav-modal-title').innerText = '🥬 Yeni Manav Ürünü Ekle';
  document.getElementById('inp-manav-plu').value = getNextPluNumber();
  document.getElementById('inp-manav-plu').readOnly = false;
  document.getElementById('inp-manav-title').value = '';
  document.getElementById('inp-manav-price').value = '';
  document.getElementById('inp-manav-barcode').value = '';
  
  const unitSelect = document.getElementById('inp-manav-unit');
  if (unitSelect) {
    unitSelect.value = currentManavFilter === 'adet' ? 'Adet' : 'Kg';
  }
  
  document.getElementById('inp-manav-origin').value = 'TÜRKİYE';
  const kdvInp = document.getElementById('inp-manav-kdv');
  if (kdvInp) kdvInp.value = '1';

  const deleteBtn = document.getElementById('btn-manav-delete');
  const detailBtn = document.getElementById('btn-manav-open-full-detail');
  if (deleteBtn) deleteBtn.style.display = 'none';
  if (detailBtn) detailBtn.style.display = 'none';

  onManavUnitChange();
  modal.style.display = 'flex';
}

function openEditManavModal(identifier) {
  let item = null;
  if (typeof identifier === 'number' || (!isNaN(parseInt(identifier, 10)) && String(identifier).length <= 4)) {
    const targetPlu = parseInt(identifier, 10);
    item = (manavProductsData || []).find(x => x.plu && parseInt(x.plu, 10) === targetPlu);
  }
  if (!item) {
    const targetBc = String(identifier).trim();
    item = (manavProductsData || []).find(x => String(x.barcode || '').trim() === targetBc);
  }

  if (!item) {
    if (typeof showToast === 'function') showToast(`Ürün bulunamadı.`, 'warning');
    return;
  }

  currentEditingManavPlu = item.plu || item.barcode;
  const modal = document.getElementById('modal-manav-product');
  if (!modal) {
    if (typeof showToast === 'function') showToast('Manav düzenleme penceresi yüklenemedi.', 'error');
    return;
  }

  const isAdet = ['adet', 'demet', 'paket', 'pk'].includes((item.unit || '').toLowerCase());

  document.getElementById('manav-modal-title').innerText = isAdet ? `✏️ ${item.title || 'Adet Ürünü'} Düzenle` : `✏️ PLU ${item.plu} Düzenle`;
  document.getElementById('inp-manav-plu').value = item.plu || '';
  document.getElementById('inp-manav-plu').readOnly = !isAdet;
  document.getElementById('inp-manav-title').value = item.title || '';
  document.getElementById('inp-manav-price').value = item.price || '';
  document.getElementById('inp-manav-barcode').value = item.barcode || '';
  document.getElementById('inp-manav-unit').value = item.unit || 'Kg';
  document.getElementById('inp-manav-origin').value = item.origin || 'TÜRKİYE';
  const kdvInp = document.getElementById('inp-manav-kdv');
  if (kdvInp) kdvInp.value = String(item.kdv !== undefined ? item.kdv : '1');

  // Toggle buttons visibility based on occupied slot
  const isEmpty = !(item.title || '').trim();
  const deleteBtn = document.getElementById('btn-manav-delete');
  const detailBtn = document.getElementById('btn-manav-open-full-detail');
  if (deleteBtn) deleteBtn.style.display = isEmpty ? 'none' : 'inline-block';
  if (detailBtn) detailBtn.style.display = isEmpty ? 'none' : 'inline-block';

  onManavUnitChange();
  modal.style.display = 'flex';
}

function openFullCatalogDetailFromManavModal() {
  if (!currentEditingManavPlu) return;
  const item = (manavProductsData || []).find(x => (x.plu && String(x.plu) === String(currentEditingManavPlu)) || (x.barcode && String(x.barcode) === String(currentEditingManavPlu)));
  if (!item) return;

  closeManavModal();
  const bc = item.barcode || `2701${String(item.plu || '').padStart(3, '0')}`;
  if (typeof openCatalogProductDetailModal === 'function') {
    openCatalogProductDetailModal(bc);
  }
}

function closeManavModal() {
  const modal = document.getElementById('modal-manav-product');
  if (modal) modal.style.display = 'none';
  currentEditingManavPlu = null;
}

function deleteManavProductFromModal() {
  if (!currentEditingManavPlu) return;
  
  showScaleConfirmDialog({
    icon: '🗑️',
    title: 'Ürün Silme Onayı',
    subtitle: 'Manav Ürününü Sil',
    message: `Bu ürünü manav listesinden silmek istediğinize emin misiniz?`,
    onConfirm: async () => {
      try {
        const res = await fetch(`${API_BASE}/api/scale/products/${currentEditingManavPlu}`, {
          method: 'DELETE'
        });
        const data = await res.json();
        if (data.status === 'success') {
          closeManavModal();
          if (typeof showToast === 'function') showToast(`🗑️ Ürün silindi.`, 'success');
          loadManavProducts();
        } else {
          if (typeof showToast === 'function') showToast(`Hata: ${data.message}`, 'error');
        }
      } catch (err) {
        if (typeof showToast === 'function') showToast(`Bağlantı hatası: ${err.message}`, 'error');
      }
    }
  });
}

async function submitManavProductModal() {
  const unit = document.getElementById('inp-manav-unit')?.value || 'Kg';
  const isAdet = ['adet', 'demet', 'paket', 'pk'].includes(unit.toLowerCase());
  const plu = isAdet ? null : document.getElementById('inp-manav-plu')?.value;
  let title = document.getElementById('inp-manav-title')?.value;
  const price = document.getElementById('inp-manav-price')?.value;
  let barcode = document.getElementById('inp-manav-barcode')?.value;
  const origin = document.getElementById('inp-manav-origin')?.value || 'TÜRKİYE';
  const kdv = parseInt(document.getElementById('inp-manav-kdv')?.value || '1', 10);

  if (!title || !price) {
    if (typeof showToast === 'function') {
      showToast('Lütfen Ürün Adı ve Fiyat alanlarını doldurun.', 'warning');
    }
    return;
  }

  if (!isAdet && !plu) {
    if (typeof showToast === 'function') {
      showToast('Tartılı (Kg) ürünler için PLU Tuş Numarası zorunludur.', 'warning');
    }
    return;
  }

  // Meyve & Sebze / Manav ürünlerinde standart 'MNV ' ön eki ekle
  let cleanTitle = String(title || '').trim().toUpperCase();
  if (!cleanTitle.startsWith('MNV ')) {
    cleanTitle = `MNV ${cleanTitle}`;
  }
  title = cleanTitle;

  try {
    const res = await fetch(`${API_BASE}/api/scale/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plu, title, price, barcode, unit, origin, kdv })
    });
    const data = await res.json();

    if (data.status === 'success') {
      if (typeof showToast === 'function') {
        showToast(`✅ ${data.message}`, 'success');
      }
      closeManavModal();
      await loadManavProducts();
    } else {
      if (typeof showToast === 'function') {
        showToast(`⚠️ ${data.message}`, 'error');
      }
    }
  } catch (err) {
    if (typeof showToast === 'function') {
      showToast(`Kayıt hatası: ${err.message}`, 'error');
    }
  }
}

async function deleteManavProductAction(plu) {
  const item = manavProductsData.find(x => intVal(x.plu) === intVal(plu));
  const title = item ? item.title : `PLU ${plu}`;

  const ok = await appConfirm(
    'Manav Ürününü Sil',
    `"${title}" (PLU ${plu}) ürününü manav listesinden silmek istediğinize emin misiniz?`,
    '🗑️ Evet, Sil'
  );
  if (!ok) return;

  try {
    const res = await fetch(`${API_BASE}/api/scale/products/${plu}`, {
      method: 'DELETE'
    });
    const data = await res.json();

    if (data.status === 'success') {
      if (typeof showToast === 'function') {
        showToast(`✅ ${data.message}`, 'success');
      }
      await loadManavProducts();
    } else {
      if (typeof showToast === 'function') {
        showToast(`⚠️ ${data.message}`, 'error');
      }
    }
  } catch (err) {
    if (typeof showToast === 'function') {
      showToast(`Silme hatası: ${err.message}`, 'error');
    }
  }
}

// 11. Terazi Ayarları Modalı
function openScaleSettingsModal() {
  const modal = document.getElementById('modal-scale-settings');
  if (!modal) return;

  if (activeScaleSettings) {
    document.getElementById('inp-scale-ip').value = activeScaleSettings.ip || '192.168.1.61';
    document.getElementById('inp-scale-port').value = activeScaleSettings.port || 2061;
    document.getElementById('inp-scale-dept').value = activeScaleSettings.dept_code || 1;
    document.getElementById('inp-scale-model').value = activeScaleSettings.scale_model || '';
  }

  modal.style.display = 'flex';
}

function closeScaleSettingsModal() {
  const modal = document.getElementById('modal-scale-settings');
  if (modal) modal.style.display = 'none';
}

async function submitScaleSettingsModal() {
  const ip = document.getElementById('inp-scale-ip')?.value.trim();
  const port = parseInt(document.getElementById('inp-scale-port')?.value || 2061);
  const dept_code = parseInt(document.getElementById('inp-scale-dept')?.value || 1);
  const scale_model = document.getElementById('inp-scale-model')?.value.trim();

  try {
    const res = await fetch(`${API_BASE}/api/scale/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, port, dept_code, scale_model })
    });
    const data = await res.json();

    if (data.status === 'success') {
      if (typeof showToast === 'function') {
        showToast('✅ Terazi ayarları kaydedildi.', 'success');
      }
      closeScaleSettingsModal();
      await loadManavStatus();
    }
  } catch (err) {
    if (typeof showToast === 'function') {
      showToast(`Hata: ${err.message}`, 'error');
    }
  }
}

function getNextPluNumber() {
  if (manavProductsData.length === 0) return 1;
  const maxPlu = Math.max(...manavProductsData.map(x => intVal(x.plu) || 0));
  return maxPlu + 1;
}

function intVal(v) {
  const n = parseInt(v);
  return isNaN(n) ? 0 : n;
}

// Global olarak pencereye bağla
window.initManavPanel = initManavPanel;
window.loadManavStatus = loadManavStatus;
window.loadManavProducts = loadManavProducts;
window.renderManavView = renderManavView;
window.setManavViewMode = setManavViewMode;
window.filterManavTab = filterManavTab;
window.testScaleConnectionAction = testScaleConnectionAction;
window.sendSinglePriceToScaleAction = sendSinglePriceToScaleAction;
window.sendAllPricesToScaleAction = sendAllPricesToScaleAction;
window.fetchPricesFromScaleAction = fetchPricesFromScaleAction;
window.showScaleConfirmDialog = showScaleConfirmDialog;
window.closeScaleConfirmModal = closeScaleConfirmModal;
window.printManavLabelQuick = printManavLabelQuick;
window.openAddManavModal = openAddManavModal;
window.openEditManavModal = openEditManavModal;
window.closeManavModal = closeManavModal;
window.submitManavProductModal = submitManavProductModal;
window.deleteManavProductAction = deleteManavProductAction;
window.openScaleSettingsModal = openScaleSettingsModal;
window.closeScaleSettingsModal = closeScaleSettingsModal;
window.submitScaleSettingsModal = submitScaleSettingsModal;
window.openFullCatalogDetailFromManavModal = openFullCatalogDetailFromManavModal;
window.deleteManavProductFromModal = deleteManavProductFromModal;
window.onScalePoolSelectChange = onScalePoolSelectChange;
