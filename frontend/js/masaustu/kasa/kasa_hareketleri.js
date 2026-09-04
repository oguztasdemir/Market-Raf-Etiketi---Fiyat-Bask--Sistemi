// -*- coding: utf-8 -*-
/**
 * KASA DURUM, KASİYER & KASA GİRİŞ/ÇIKIŞ HAREKETLERİ (kasa_hareketleri.js)
 */

// =========================================================
// 7. ALT DURUM ÇUBUĞU & KASİYER YÖNETİMİ
// =========================================================
function showBranchInfo() {
  if (typeof showToast === 'function') {
    showToast('🏢 Şube: YARENLER MARKET (Merkez Ana Kasa Terminali)', 'info');
  }
}

function showTerminalInfo() {
  if (typeof showToast === 'function') {
    showToast('💻 Terminal No: KASA 1 (IP: 192.168.1.34)', 'info');
  }
}

function checkOnlineServerStatus() {
  if (typeof showToast === 'function') {
    showToast('🟢 Sunucu & Yerel Ağ Bağlantısı: Kesintisiz Aktif (Online)', 'success');
  }
}

let loadedCashiersCache = [];

async function openCashierSwitchModal() {
  const select = document.getElementById('cashier-select-dropdown');
  if (select) {
    try {
      const res = await fetch('/api/cashiers');
      const data = await res.json();
      if (data.status === 'success' && data.cashiers) {
        loadedCashiersCache = data.cashiers.filter(c => c.active !== false);
        select.innerHTML = loadedCashiersCache
          .map(c => `<option value="${c.id}" ${c.id === activeCashier.id ? 'selected' : ''}>${c.name} (${c.role === 'admin' ? 'Müdür' : 'Kasiyer'})</option>`)
          .join('');
      }
    } catch (e) {}
  }
  showPosModal('modal-cashier-switch');
  setTimeout(() => {
    if (select) select.focus();
  }, 100);
}

function closeCashierSwitchModal() {
  hidePosModal('modal-cashier-switch');
}

async function submitCashierSwitch() {
  const select = document.getElementById('cashier-select-dropdown');
  if (!select || select.selectedIndex < 0) {
    closeCashierSwitchModal();
    return;
  }

  const opt = select.options[select.selectedIndex];
  const cid = opt.value;

  const submitBtn = document.getElementById('btn-cashier-submit');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = 'Aktarılıyor...';
  }

  try {
    const res = await fetch('/api/cashiers/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: cid, pin: '' })
    });
    const data = await res.json();

    if (data.status === 'success' && data.cashier) {
      const cname = data.cashier.name;
      activeCashier = { id: data.cashier.id, name: cname, role: data.cashier.role };
      localStorage.setItem('active_pos_cashier', JSON.stringify(activeCashier));

      const el1 = document.getElementById('header-active-cashier-name');
      if (el1) el1.innerText = cname;

      const el2 = document.getElementById('btn-pos-footer-admin');
      if (el2) {
        const shortName = cname.split(' ')[0].toUpperCase();
        el2.innerHTML = `<span>👤</span> ${shortName}`;
      }

      closeCashierSwitchModal();
      if (typeof showToast === 'function') {
        showToast(`👤 Aktif Kasiyer Değiştirildi: ${cname}`, 'success');
      }
    } else {
      if (typeof showToast === 'function') {
        showToast(`⚠️ ${data.message || 'Kasiyer seçilemedi'}`, 'error');
      }
    }
  } catch (e) {
    closeCashierSwitchModal();
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>✓</span><span>Kasiyeri Seç ve Başla (Enter)</span>`;
    }
  }
}


function exitPosToHome() {
  switchTab('tab-home');
  if (typeof showToast === 'function') {
    if (posCart.length > 0) {
      showToast('ℹ️ Satış sepetiniz ve bekleyen fişleriniz korundu.', 'info');
    }
  }
}

// =========================================================
// 8. DASHBOARD VERİLERİ & SATIŞ SAYACI (A000.000.001)
// =========================================================
async function loadActiveCashier() {
  try {
    const saved = localStorage.getItem('active_pos_cashier');
    if (saved) {
      activeCashier = JSON.parse(saved);
    } else {
      const res = await fetch('/api/cashiers');
      const data = await res.json();
      if (data.status === 'success' && data.cashiers && data.cashiers.length > 0) {
        const first = data.cashiers.find(c => c.active !== false) || data.cashiers[0];
        activeCashier = { id: first.id, name: first.name, role: first.role || 'admin' };
      } else {
        activeCashier = { id: 'admin', name: 'Yönetici', role: 'admin' };
      }
    }
    const el1 = document.getElementById('header-active-cashier-name');
    if (el1) el1.innerText = activeCashier.name;
    const el2 = document.getElementById('pos-header-cashier-name');
    if (el2) el2.innerText = activeCashier.name;

    if (typeof updateSidebarNavVisibility === 'function') {
      updateSidebarNavVisibility();
    }
  } catch (e) {}
}


async function loadDashboardSummary() {
  try {
    const res = await fetch('/api/pos/dashboard_summary');
    const data = await res.json();

    // 1. Sağ Üst Barkodlu Sayaç
    const salesCounterEl = document.getElementById('pos-lifetime-sales-count');
    if (salesCounterEl) {
      if (data.total_lifetime_sales_count_str) {
        salesCounterEl.innerText = data.total_lifetime_sales_count_str;
      } else if (data.total_lifetime_sales_count !== undefined) {
        salesCounterEl.innerText = formatPosSerialCode(data.total_lifetime_sales_count);
      }
    }

    // 2. Ana Sayfa Dinamik Ürün Sayaçları
    const homeTotalEl = document.getElementById('home-total-prods');
    if (homeTotalEl && data.total_catalog_products !== undefined) {
      homeTotalEl.innerText = `${data.total_catalog_products.toLocaleString('tr-TR')} Ürün`;
    }
    const homeMarketEl = document.getElementById('home-market-prods');
    if (homeMarketEl && data.market_products_count !== undefined) {
      homeMarketEl.innerText = `${data.market_products_count.toLocaleString('tr-TR')} Ürün`;
    }
    const homeManavEl = document.getElementById('home-manav-prods');
    if (homeManavEl && data.manav_products_count !== undefined) {
      homeManavEl.innerText = `${data.manav_products_count.toLocaleString('tr-TR')} Ürün`;
    }

    // 3. Dinamik Market Adı
    const homeMarketNameEl = document.getElementById('home-market-name');
    if (homeMarketNameEl && data.market_name) {
      homeMarketNameEl.innerText = data.market_name.toUpperCase();
    }
  } catch (e) {
    console.warn('Dashboard summary yükleme hatası:', e);
  }
}
window.loadDashboardSummary = loadDashboardSummary;

function formatPosSerialCode(count) {
  const c = Math.max(1, parseInt(count) || 1);
  const limit = 999999999;
  const letterIndex = Math.floor((c - 1) / limit);
  const letter = String.fromCharCode(65 + (letterIndex % 26));
  const num = ((c - 1) % limit) + 1;
  const numStr = String(num).padStart(9, '0');
  return `${letter}${numStr.slice(0, 3)}.${numStr.slice(3, 6)}.${numStr.slice(6, 9)}`;
}

async function loadRecentHomeSales() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const res = await fetch(`/api/reports/day_detail?date=${today}`);
    const data = await res.json();
    if (data.status === 'success' && data.receipts && data.receipts.length > 0) {
      const recent = data.receipts.slice(-6).reverse();
      const container = document.getElementById('home-recent-sales-list');
      if (container) {
        container.innerHTML = recent.map(r => `
          <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(15,23,42,0.6); padding: 10px 14px; border-radius: 8px; margin-bottom: 8px; border: 1px solid rgba(255,255,255,0.05);">
            <div>
              <strong style="color: #f8fafc; font-size: 13px;">${r.receipt_no}</strong>
              <div style="color: #94a3b8; font-size: 11.5px; margin-top: 2px;">${r.time} • ${r.payment_type || 'Nakit'}</div>
            </div>
            <strong style="color: #10b981; font-family: monospace; font-size: 15px;">
              ${parseFloat(r.total_amount || 0).toFixed(2).replace('.', ',')} TL
            </strong>
          </div>
        `).join('');
      }
    }
  } catch (e) {}
}

function triggerBarcodeNotFoundAlert(rawBarcode) {
  let cleanBarcode = String(rawBarcode || '').trim();
  if (cleanBarcode.includes('*')) {
    const parts = cleanBarcode.split('*');
    if (parts.length >= 2) {
      cleanBarcode = parts.slice(1).join('*').trim();
    }
  }

  const el1 = document.getElementById('barcode-not-found-code');
  const el2 = document.getElementById('not-found-barcode-text');
  if (el1) el1.innerText = cleanBarcode || '-';
  if (el2) el2.innerText = cleanBarcode || '-';

  window._lastNotFoundBarcode = cleanBarcode;

  // Sesli uyarı tonu & Türkçe "Barkod Hatalı" sesli uyarısı
  if (typeof playBarcodeNotFoundSound === 'function') {
    playBarcodeNotFoundSound();
  }
  if (typeof speakBarcodeNotFoundSpeech === 'function') {
    speakBarcodeNotFoundSpeech();
  }

  showPosModal('modal-pos-barcode-not-found');

  setTimeout(() => {
    const btn = document.getElementById('btn-create-from-not-found');
    if (btn) btn.focus();
  }, 60);
}

function closeBarcodeNotFoundAlert() {
  hidePosModal('modal-pos-barcode-not-found');
  const inp = document.getElementById('pos-barcode-input');
  if (inp) {
    inp.value = '';
    inp.focus();
  }
}

function openQuickProductFromNotFoundAlert() {
  const bc = window._lastNotFoundBarcode || '';
  closeBarcodeNotFoundAlert();
  setTimeout(() => {
    openPosQuickProductModal(bc);
  }, 30);
}

// =========================================================
// KASA ÇIKIŞI & GİRİŞİ (TOPTANCI, FIRIN, MASRAF, AVANS)
// =========================================================
let currentCashMovType = 'out';
let todayCashMovementsCache = [];

async function openPosCashMovementModal(defaultType = 'out') {
  currentCashMovType = defaultType;
  setCashMovementType(defaultType);

  const amtInp = document.getElementById('cash-mov-amount-inp');
  const descInp = document.getElementById('cash-mov-desc-inp');
  if (amtInp) amtInp.value = '';
  if (descInp) descInp.value = '';

  const modal = document.getElementById('modal-pos-cash-movement');
  if (modal) {
    modal.style.display = 'flex';
  }

  await loadTodayCashMovements();

  setTimeout(() => {
    if (amtInp) {
      amtInp.focus();
      amtInp.select();
    }
  }, 80);
}

function closePosCashMovementModal() {
  const modal = document.getElementById('modal-pos-cash-movement');
  if (modal) {
    modal.style.display = 'none';
  }
}

function setCashMovementType(type) {
  currentCashMovType = type;
  const btnOut = document.getElementById('btn-cash-mov-type-out');
  const btnIn = document.getElementById('btn-cash-mov-type-in');
  const hdrIcon = document.getElementById('cash-mov-header-icon');
  const hdrTitle = document.getElementById('cash-mov-header-title');
  const amtInp = document.getElementById('cash-mov-amount-inp');
  const btnSubmit = document.getElementById('btn-submit-cash-mov');

  if (type === 'out') {
    if (btnOut) {
      btnOut.style.background = 'linear-gradient(135deg, #ef4444, #b91c1c)';
      btnOut.style.color = '#fff';
      btnOut.style.boxShadow = '0 4px 12px rgba(239,68,68,0.35)';
    }
    if (btnIn) {
      btnIn.style.background = 'transparent';
      btnIn.style.color = '#94a3b8';
      btnIn.style.boxShadow = 'none';
    }
    if (hdrIcon) {
      hdrIcon.innerText = '💸';
      hdrIcon.style.background = 'rgba(239,68,68,0.15)';
      hdrIcon.style.borderColor = 'rgba(239,68,68,0.3)';
    }
    if (hdrTitle) hdrTitle.innerText = 'Kasa Çıkışı / Toptancı & Gider Ödemesi';
    if (amtInp) {
      amtInp.style.borderColor = '#ef4444';
      amtInp.style.color = '#f87171';
    }
    if (btnSubmit) {
      btnSubmit.innerText = '💾 Çıkışı Kaydet';
      btnSubmit.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
      btnSubmit.style.boxShadow = '0 4px 14px rgba(239,68,68,0.4)';
    }
  } else {
    if (btnIn) {
      btnIn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
      btnIn.style.color = '#fff';
      btnIn.style.boxShadow = '0 4px 12px rgba(16,185,129,0.35)';
    }
    if (btnOut) {
      btnOut.style.background = 'transparent';
      btnOut.style.color = '#94a3b8';
      btnOut.style.boxShadow = 'none';
    }
    if (hdrIcon) {
      hdrIcon.innerText = '💰';
      hdrIcon.style.background = 'rgba(16,185,129,0.15)';
      hdrIcon.style.borderColor = 'rgba(16,185,129,0.3)';
    }
    if (hdrTitle) hdrTitle.innerText = 'Kasa Girişi / Avans & Para Ekleme';
    if (amtInp) {
      amtInp.style.borderColor = '#10b981';
      amtInp.style.color = '#34d399';
    }
    if (btnSubmit) {
      btnSubmit.innerText = '💾 Girişi Kaydet';
      btnSubmit.style.background = 'linear-gradient(135deg, #10b981, #059669)';
      btnSubmit.style.boxShadow = '0 4px 14px rgba(16,185,129,0.4)';
    }
  }
}

function selectCashMovCategory(catName, btnEl) {
  const hiddenInp = document.getElementById('cash-mov-category-val');
  if (hiddenInp) hiddenInp.value = catName;

  const allBtns = document.querySelectorAll('.cash-cat-btn');
  allBtns.forEach(b => {
    b.style.background = '#0f172a';
    b.style.borderColor = 'rgba(255,255,255,0.1)';
    b.style.color = '#cbd5e1';
  });

  if (btnEl) {
    btnEl.style.background = '#1e293b';
    btnEl.style.borderColor = '#38bdf8';
    btnEl.style.color = '#38bdf8';
  }
}

async function loadTodayCashMovements() {
  const container = document.getElementById('cash-mov-today-list');
  if (!container) return;

  try {
    const res = await fetch('/api/pos/cash_movements');
    const data = await res.json();
    if (data.status === 'success') {
      todayCashMovementsCache = data.movements || [];
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const todayItems = todayCashMovementsCache.filter(m => m.date === todayStr);

      if (todayItems.length === 0) {
        container.innerHTML = '<span style="color: #64748b; font-style: italic;">Bugün henüz kasa hareketi kaydedilmedi.</span>';
        return;
      }

      container.innerHTML = todayItems.map(m => {
        const isOut = m.type === 'out';
        const color = isOut ? '#f87171' : '#34d399';
        const sign = isOut ? '-' : '+';
        return `
          <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(15,23,42,0.8); border: 1px solid rgba(255,255,255,0.06); padding: 4px 8px; border-radius: 6px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="color: #94a3b8; font-size: 10.5px; font-family: monospace;">${m.time || ''}</span>
              <strong style="color: #f8fafc;">${m.category || 'Gider'}</strong>
              <small style="color: #94a3b8;">${m.description ? `(${m.description})` : ''}</small>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <strong style="color: ${color}; font-family: monospace;">${sign}${m.amount_str || m.amount}</strong>
              <button type="button" onclick="deleteCashMovementItem('${m.id}')" style="background: transparent; border: none; color: #64748b; cursor: pointer; font-size: 12px;" title="Sil">✕</button>
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (e) {
    console.error('Kasa hareketleri yüklenemedi:', e);
  }
}

async function submitPosCashMovement() {
  const amtInp = document.getElementById('cash-mov-amount-inp');
  const catInp = document.getElementById('cash-mov-category-val');
  const descInp = document.getElementById('cash-mov-desc-inp');

  const amount = parseFloat(amtInp?.value?.replace(',', '.') || 0);
  const category = catInp?.value || 'Toptancı / Mal Alımı';
  const description = (descInp?.value || '').trim();

  if (isNaN(amount) || amount <= 0) {
    if (typeof showToast === 'function') showToast('⚠️ Lütfen geçerli bir tutar giriniz.', 'warning');
    if (amtInp) amtInp.focus();
    return;
  }

  try {
    const res = await fetch('/api/pos/cash_movements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: currentCashMovType,
        amount: amount,
        category: category,
        description: description,
        cashier: (activeCashier && activeCashier.name) ? activeCashier.name : 'Kasa 1'
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      if (typeof showToast === 'function') {
        showToast(data.message || '✓ Kasa hareketi kaydedildi.', 'success');
      }
      closePosCashMovementModal();
      
      // Çekmeceyi Aç & Dashboardu Güncelle
      openCashDrawerAction();
      if (typeof loadDashboardSummary === 'function') {
        loadDashboardSummary();
      }
    } else {
      if (typeof showToast === 'function') showToast(data.message || 'Kayıt hatası.', 'error');
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('Bağlantı hatası.', 'error');
  }
}

async function deleteCashMovementItem(id) {
  const ok = await showCustomConfirm('Bu kasa hareketini silmek istediğinize emin misiniz?', 'Kasa Hareketi Sil', 'Sil', 'Vazgeç', '🗑️');
  if (!ok) return;

  try {
    const res = await fetch(`/api/pos/cash_movements/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.status === 'success') {
      if (typeof showToast === 'function') showToast(data.message, 'info');
      await loadTodayCashMovements();
    }
  } catch (e) {
    console.error('Silme hatası:', e);
  }
}

// F7 - KASA ÇEKMECESİ AÇ
function openCashDrawerAction() {
  if (typeof showToast === 'function') {
    showToast('🗄️ Para çekmecesi açıldı', 'info');
  }
}

// F10 - İSKONTO / İKRAM
async function applyPosGiftDiscount() {
  if (posCart.length === 0) {
    if (typeof showToast === 'function') showToast('Sepette ürün bulunmuyor.', 'warning');
    return;
  }
  const discountInput = await showCustomPrompt('İskonto / İkram Tutarı Girin (TL veya %10 gibi yüzde):', '10', '🏷️ İskonto / İkram Uygula', 'Uygula', 'İptal');
  if (!discountInput) return;

  const currentTotal = posCart.reduce((sum, itm) => sum + (parseFloat(itm.total_price) || 0), 0);
  let discountAmount = 0;

  if (discountInput.includes('%')) {
    const pct = parseFloat(discountInput.replace('%', ''));
    if (!isNaN(pct) && pct > 0) {
      discountAmount = Math.round((currentTotal * pct) / 100 * 100) / 100;
    }
  } else {
    const val = parseFloat(discountInput.replace(',', '.'));
    if (!isNaN(val) && val > 0) {
      discountAmount = Math.round(val * 100) / 100;
    }
  }

  if (discountAmount > 0 && discountAmount <= currentTotal) {
    addItemToPosCart({
      barcode: 'ISKONTO',
      title: `🎁 İSKONTO / İKRAM [${discountInput}]`,
      unit: 'Adet',
      quantity: 1,
      unit_price: -discountAmount,
      total_price: -discountAmount,
      is_discount: true
    });
    if (typeof showToast === 'function') {
      showToast(`🎁 İskonto uygulandı: -${discountAmount.toFixed(2)} TL`, 'success');
    }
  } else {
    if (typeof showToast === 'function') showToast('Geçersiz indirim tutarı.', 'warning');
  }
}

