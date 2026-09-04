// -*- coding: utf-8 -*-
/**
 * TERAZİ CANLI SENKRONİZASYON & İLERLEME MOTORU (terazi_aktarim_paneli.js)
 */

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

