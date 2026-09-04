// -*- coding: utf-8 -*-
/**
 * MANAV ÜRÜN MODALI & PLU DÜZENLEME (manav_urun_modali.js)
 */

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

  setTimeout(() => {
    const priceInp = document.getElementById('inp-manav-price');
    const titleInp = document.getElementById('inp-manav-title');
    if (isEmpty && titleInp) {
      titleInp.focus();
      titleInp.select();
    } else if (priceInp) {
      priceInp.focus();
      priceInp.select();
    }
  }, 50);
}

// Modal içi Enter tuşuna basıldığında otomatik kaydetme dinleyicisi
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('modal-manav-product');
  if (modal) {
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
        const target = e.target;
        if (target && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          submitManavProductModal();
        }
      }
    });

    const priceInp = document.getElementById('inp-manav-price');
    if (priceInp) {
      priceInp.addEventListener('blur', () => {
        if (priceInp.value && typeof formatPriceInput === 'function') {
          priceInp.value = formatPriceInput(priceInp.value);
        }
      });
    }

    const pluInp = document.getElementById('inp-manav-plu');
    if (pluInp) {
      pluInp.addEventListener('input', () => {
        const val = pluInp.value.trim();
        const bcInp = document.getElementById('inp-manav-barcode');
        if (val && bcInp) {
          const pInt = parseInt(val, 10);
          if (!isNaN(pInt)) {
            bcInp.value = `27${String(pInt).padStart(5, '0')}`;
          }
        }
      });
    }
  }
});

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
  let rawPrice = document.getElementById('inp-manav-price')?.value;
  let barcode = document.getElementById('inp-manav-barcode')?.value;
  const origin = document.getElementById('inp-manav-origin')?.value || 'TÜRKİYE';
  const kdv = parseInt(document.getElementById('inp-manav-kdv')?.value || '1', 10);

  if (!title || !rawPrice) {
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

  const price = typeof formatPriceInput === 'function' ? formatPriceInput(rawPrice) : rawPrice;

  // Meyve & Sebze / Manav ürünlerinde standart 'MNV ' ön eki ekle
  let cleanTitle = String(title || '').trim().toUpperCase();
  if (!cleanTitle.startsWith('MNV ')) {
    cleanTitle = `MNV ${cleanTitle}`;
  }
  title = cleanTitle;

  if (!isAdet && plu) {
    const pInt = parseInt(plu, 10);
    if (!isNaN(pInt)) {
      barcode = `27${String(pInt).padStart(5, '0')}`;
    }
  }

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
