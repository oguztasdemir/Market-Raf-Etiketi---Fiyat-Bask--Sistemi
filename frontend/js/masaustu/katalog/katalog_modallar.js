// -*- coding: utf-8 -*-
/**
 * KATALOG ÜRÜN DETAY & DÜZENLEME MODALI (katalog_modallar.js)
 */

// ==========================================
// ÜRÜN DETAY & DÜZENLEME MODALI FONKSİYONLARI
// ==========================================

function updateDetailModalStatusUI(prod, currentInputPrice = null) {
  const isNoLabel = document.getElementById('cat-detail-check-no-label')?.checked ?? (prod.no_label === true);
  const labelPrice = isNoLabel ? (prod.price || '0,00 TL') : (prod.label_price || prod.price || '0,00 TL');
  const sysPrice = currentInputPrice !== null ? currentInputPrice : (prod.price || '');
  const isUpToDate = isNoLabel || (isLabelPriceUpToDate(prod) && (!currentInputPrice || parsePrice(currentInputPrice) === parsePrice(labelPrice)));
  
  const labelValEl = document.getElementById('cat-detail-label-price-val');
  if (labelValEl) {
    labelValEl.innerText = isNoLabel ? 'Muaf (Etiketsiz)' : labelPrice;
    labelValEl.style.color = isNoLabel ? '#94a3b8' : (isUpToDate ? '#34d399' : '#fbbf24');
  }

  const diffPill = document.getElementById('cat-detail-diff-pill');
  if (diffPill) {
    if (isNoLabel) {
      diffPill.innerHTML = '<span style="color:#94a3b8; background: rgba(148,163,184,0.15); padding: 2px 6px; border-radius: 4px;">🚫 Etiket Muaf</span>';
    } else if (isUpToDate) {
      diffPill.innerHTML = '<span style="color:#34d399;">Fiyat Eşit ✓</span>';
    } else {
      diffPill.innerHTML = '<span style="color:#ef4444; background: rgba(239,68,68,0.15); padding: 2px 6px; border-radius: 4px;">Fark Var ⚠️</span>';
    }
  }

  const statusEl = document.getElementById('cat-detail-status-text');
  if (statusEl) {
    if (isNoLabel) {
      statusEl.innerHTML = '<span style="color:#94a3b8;">🚫 Etiket Basımından Muaf (Dondurma vb.)</span>';
    } else {
      statusEl.innerHTML = isUpToDate 
        ? '<span style="color:#34d399;">✅ Güncel (Etiket Basılmış)</span>' 
        : '<span style="color:#fbbf24;">⚠️ Güncel Değil (Etiket Basılmadı - Yazdır Butonuna Basın)</span>';
    }
  }
}

function onDetailNoLabelToggle() {
  if (currentDetailProduct) {
    updateDetailModalStatusUI(currentDetailProduct);
  }
}

function onDetailPriceInputChange() {
  if (!currentDetailProduct) return;
  const rawPrice = document.getElementById('cat-detail-inp-price')?.value || '';
  updateDetailModalStatusUI(currentDetailProduct, rawPrice);
}

function toggleDetailQuickBtnFields() {
  const chk = document.getElementById('cat-detail-check-quick-btn');
  const fields = document.getElementById('cat-detail-quick-btn-fields');
  if (fields) {
    fields.style.display = (chk && chk.checked) ? 'grid' : 'none';
  }
}

async function checkProductQuickButtonStatus(prod) {
  const chk = document.getElementById('cat-detail-check-quick-btn');
  const codeInp = document.getElementById('cat-detail-inp-quick-code');
  const colorSel = document.getElementById('cat-detail-select-quick-color');
  const iconSel = document.getElementById('cat-detail-select-quick-icon');

  const bcs = prod.barcodes || [prod.barcode];
  let isQuick = false;
  let quickObj = null;

  try {
    const res = await fetch(`${API_BASE}/api/pos/quick_buttons`);
    const data = await res.json();
    if (data.status === 'success' && Array.isArray(data.buttons)) {
      quickObj = data.buttons.find(b => bcs.includes(b.code) || b.code === prod.barcode || b.title === prod.title);
      if (quickObj) isQuick = true;
    }
  } catch (e) {}

  if (chk) chk.checked = isQuick;
  if (codeInp) {
    codeInp.value = quickObj ? quickObj.code : (prod.barcode || (prod.title || 'URUN').split(' ')[0].toUpperCase());
  }
  if (colorSel && quickObj && quickObj.color) colorSel.value = quickObj.color;
  if (iconSel && quickObj && quickObj.icon) iconSel.value = quickObj.icon;
  toggleDetailQuickBtnFields();
}

function openCatalogProductDetailModal(barcode) {
  const cleanBc = String(barcode || '').trim();
  let prod = allCatalogProducts.find(p => String(p.barcode || '').trim() === cleanBc);
  if (!prod && cleanBc) {
    const noZeros = cleanBc.replace(/^0+/, '');
    prod = allCatalogProducts.find(p => {
      const pBc = String(p.barcode || '').trim().replace(/^0+/, '');
      const cBc = String(p.custom_barcode || '').trim().replace(/^0+/, '');
      return (pBc && pBc === noZeros) || (cBc && cBc === noZeros);
    });
  }
  if (!prod && filteredCatalogProducts && filteredCatalogProducts.length > 0) {
    prod = filteredCatalogProducts.find(p => String(p.barcode || '').trim() === cleanBc);
  }
  if (!prod && typeof manavProductsData !== 'undefined' && Array.isArray(manavProductsData)) {
    const mItem = manavProductsData.find(m => String(m.barcode || '').trim() === cleanBc || String(m.plu || '').trim() === cleanBc);
    if (mItem) {
      prod = {
        barcode: mItem.barcode || `2700${String(mItem.plu).padStart(3, '0')}`,
        barcodes: [mItem.barcode || `2700${String(mItem.plu).padStart(3, '0')}`],
        title: mItem.title,
        title1: mItem.title,
        brand: 'MANAV',
        firma: 'MANAV',
        price: (mItem.price || '0,00 TL').includes('TL') ? mItem.price : `${mItem.price} TL`,
        label_price: (mItem.price || '0,00 TL').includes('TL') ? mItem.price : `${mItem.price} TL`,
        unit: mItem.unit || 'Kg',
        kdv: mItem.kdv !== undefined ? mItem.kdv : 1,
        origin: mItem.origin || 'TÜRKİYE',
        is_scale_item: (mItem.unit || '').toLowerCase() !== 'adet',
        plu: mItem.plu,
        stock: mItem.stock || 100
      };
    }
  }

  if (!prod) {
    console.warn("Ürün bulunamadı:", barcode);
    if (typeof showToast === 'function') showToast("Ürün bilgisi bulunamadı: " + barcode, "warning");
    return;
  }
  currentDetailProduct = prod;

  const badgeEl = document.getElementById('cat-detail-barcode-badge');
  if (badgeEl) badgeEl.innerText = prod.barcode || '';
  
  const bcInp = document.getElementById('cat-detail-inp-barcode');
  if (bcInp) bcInp.value = prod.barcode || '';

  // Çoklu Barkod Listesi
  if (!prod.barcodes || !Array.isArray(prod.barcodes)) {
    prod.barcodes = prod.barcode ? [prod.barcode] : [];
  }
  if (prod.alternate_barcodes && Array.isArray(prod.alternate_barcodes)) {
    prod.alternate_barcodes.forEach(b => {
      if (b && !prod.barcodes.includes(b)) prod.barcodes.push(b);
    });
  }
  renderDetailBarcodesList();

  const newBcInp = document.getElementById('cat-detail-inp-new-barcode');
  if (newBcInp) newBcInp.value = '';

  const titleInp = document.getElementById('cat-detail-inp-title');
  if (titleInp) titleInp.value = prod.title || prod.title1 || '';

  const brandInp = document.getElementById('cat-detail-inp-brand');
  if (brandInp) brandInp.value = prod.brand || 'DİĞER';

  const priceInp = document.getElementById('cat-detail-inp-price');
  if (priceInp) priceInp.value = prod.price || '';

  const originInp = document.getElementById('cat-detail-inp-origin');
  if (originInp) originInp.value = prod.origin || 'TÜRKİYE';

  const stockInp = document.getElementById('cat-detail-inp-stock');
  if (stockInp) stockInp.value = prod.stock !== undefined ? prod.stock : 0;

  const kdvInp = document.getElementById('cat-detail-inp-kdv');
  if (kdvInp) kdvInp.value = String(prod.kdv !== undefined ? prod.kdv : (prod.vat_rate !== undefined ? prod.vat_rate : '10'));

  const noLabelChk = document.getElementById('cat-detail-check-no-label');
  if (noLabelChk) noLabelChk.checked = prod.no_label === true;

  const isSpecial = prod.is_special === true || prod.special_category === true;
  const isSpecialInp = document.getElementById('cat-detail-inp-is-special');
  if (isSpecialInp) isSpecialInp.value = isSpecial ? 'true' : 'false';
  updateDetailSpecialCatButtonUI(isSpecial);

  if (typeof updateDetailModalStatusUI === 'function') {
    updateDetailModalStatusUI(prod);
  }

  const modal = document.getElementById('modal-catalog-product-detail');
  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add('active');
  }
}

function renderDetailBarcodesList() {
  const container = document.getElementById('cat-detail-barcodes-chips-container');
  const countBadge = document.getElementById('cat-detail-barcodes-count-badge');
  if (!container || !currentDetailProduct) return;

  const bcs = currentDetailProduct.barcodes || [currentDetailProduct.barcode];
  if (countBadge) countBadge.innerText = `${bcs.length} Kayıtlı Barkod`;

  if (bcs.length === 0) {
    container.innerHTML = `<span style="color: #64748b; font-size: 11px;">Kayıtlı barkod bulunamadı.</span>`;
    return;
  }

  container.innerHTML = bcs.map((bc, idx) => {
    const isPrimary = (idx === 0 || bc === currentDetailProduct.barcode);
    return `
      <span style="background: ${isPrimary ? 'rgba(56,189,248,0.18)' : 'rgba(168,85,247,0.18)'}; border: 1px solid ${isPrimary ? '#38bdf8' : '#a855f7'}; color: ${isPrimary ? '#38bdf8' : '#d8b4fe'}; font-weight: 800; font-family: monospace; padding: 4px 8px; border-radius: 6px; font-size: 11.5px; display: inline-flex; align-items: center; gap: 6px;">
        <span>${isPrimary ? '👑 ' + bc + ' (Ana)' : '🏷️ ' + bc}</span>
        ${!isPrimary ? `
          <button type="button" onclick="removeBarcodeFromCurrentDetailProduct('${bc}')" style="background: transparent; border: none; color: #f87171; font-weight: 900; font-size: 12px; cursor: pointer; padding: 0 2px; margin-left: 2px;" title="Bu barkodu kaldır">✕</button>
        ` : ''}
      </span>
    `;
  }).join('');
}

async function addBarcodeToCurrentDetailProduct() {
  if (!currentDetailProduct) return;
  const inp = document.getElementById('cat-detail-inp-new-barcode');
  const newBc = (inp?.value || '').trim();
  if (!newBc) {
    if (typeof showToast === 'function') showToast('Lütfen eklenecek barkodu yazın veya okutun.', 'warning');
    return;
  }

  if (!currentDetailProduct.barcodes) {
    currentDetailProduct.barcodes = [currentDetailProduct.barcode];
  }

  if (currentDetailProduct.barcodes.includes(newBc)) {
    if (typeof showToast === 'function') showToast('Bu barkod zaten ürüne kayıtlı.', 'info');
    if (inp) inp.value = '';
    return;
  }

  currentDetailProduct.barcodes.push(newBc);
  currentDetailProduct.alternate_barcodes = currentDetailProduct.barcodes;
  renderDetailBarcodesList();
  if (inp) {
    inp.value = '';
    inp.focus();
  }

  try {
    const res = await fetch(`${API_BASE}/api/products/add_barcode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barcode: currentDetailProduct.barcode,
        new_barcode: newBc
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      if (typeof showToast === 'function') showToast(`✓ Barkod eklendi: ${newBc}`, 'success');
      onCatalogFilterChange();
    }
  } catch (e) {}
}

async function generateInternalBarcodeForDetail() {
  try {
    const res = await fetch(`${API_BASE}/api/catalog/generate_internal_barcode`);
    const data = await res.json();
    if (data.status === 'success' && data.barcode) {
      const inp = document.getElementById('cat-detail-inp-new-barcode');
      if (inp) {
        inp.value = data.barcode;
        inp.focus();
      }
      if (typeof showToast === 'function') {
        showToast(`⚡ Yeni Mağaza İçi Barkod Üretildi: ${data.barcode}`, 'success');
      }
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('Barkod üretilemedi.', 'error');
  }
}

async function removeBarcodeFromCurrentDetailProduct(bc) {
  if (!currentDetailProduct || !bc) return;
  
  if (bc === currentDetailProduct.barcode) {
    if (typeof showToast === 'function') showToast('Ana barkod doğrudan silinemez.', 'warning');
    return;
  }

  currentDetailProduct.barcodes = (currentDetailProduct.barcodes || []).filter(b => b !== bc);
  currentDetailProduct.alternate_barcodes = currentDetailProduct.barcodes;
  renderDetailBarcodesList();

  try {
    const res = await fetch(`${API_BASE}/api/products/remove_barcode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barcode: currentDetailProduct.barcode,
        remove_barcode: bc
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      if (typeof showToast === 'function') showToast(`✓ Barkod silindi: ${bc}`, 'info');
      onCatalogFilterChange();
    }
  } catch (e) {}
}

function closeCatalogProductDetailModal() {
  const modal = document.getElementById('modal-catalog-product-detail');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('active');
  }
  currentDetailProduct = null;
}

function copyDetailBarcode() {
  const bc = document.getElementById('cat-detail-inp-barcode')?.value;
  if (bc) {
    navigator.clipboard.writeText(bc);
    showToast(`📋 Barkod kopyalandı: ${bc}`, "info");
  }
}

async function pinCurrentDetailToQuickButtons() {
  if (!currentDetailProduct) return;
  const title = currentDetailProduct.title || currentDetailProduct.title1 || 'Ürün';
  const barcode = currentDetailProduct.barcode || '';
  const price = parsePrice(currentDetailProduct.price || 0);

  if (typeof addCatalogProductToQuickButtons === 'function') {
    await addCatalogProductToQuickButtons(title, barcode, price);
  } else {
    showToast('Hızlı buton servisi hazır değil.', 'warning');
  }
}

async function printFromDetailModal() {
  if (!currentDetailProduct) return;
  const prod = currentDetailProduct;
  const printer = selectedPrinter || (document.getElementById('settings-printer-select') ? document.getElementById('settings-printer-select').value : "Termal Etiket Yazici");

  showToast(`🖨️ '${prod.title}' yazıcıya gönderiliyor...`, "info");

  try {
    const res = await fetch(`${API_BASE}/api/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        printer: printer,
        copies: 1,
        data: {
          title1: prod.title || prod.title1 || '',
          title2: prod.title2 || '',
          brand: prod.brand || 'YARENLER',
          origin: prod.origin || 'TÜRKİYE',
          date: prod.date || getSystemFormattedDate(),
          unit_price: prod.unit_price || '',
          barcode: prod.barcode || '',
          price: prod.price || '0,00 TL',
          top_right_mode: 'empty',
          top_right_text: ''
        }
      })
    });

    const data = await res.json();
    if (data.status === 'success') {
      prod.label_price = prod.price;
      updateDetailModalStatusUI(prod);
      onCatalogFilterChange();
      showToast(`✅ '${prod.title}' başarıyla yazdırıldı!`, "success");
    } else {
      showToast(`❌ Yazdırma başarısız: ${data.message}`, "error");
    }
  } catch (err) {
    showToast(`❌ Yazdırma hatası: ${err.message}`, "error");
  }
}

// ---------------------------------------------------------
// Toplu Fiyat ve Marka Güncelleme İşlemleri
// ---------------------------------------------------------

async function submitCatalogProductDetail() {
  if (!currentDetailProduct) return;
  
  const barcode = document.getElementById('cat-detail-inp-barcode')?.value.trim();
  const oldBarcode = currentDetailProduct.barcode;
  const title = document.getElementById('cat-detail-inp-title')?.value.trim().toUpperCase();
  const brand = document.getElementById('cat-detail-inp-brand')?.value.trim().toUpperCase() || 'DİĞER';
  const rawPrice = document.getElementById('cat-detail-inp-price')?.value.trim();
  const origin = document.getElementById('cat-detail-inp-origin')?.value.trim().toUpperCase() || 'TÜRKİYE';
  const stock = parseInt(document.getElementById('cat-detail-inp-stock')?.value || '0', 10) || 0;
  const kdv = parseInt(document.getElementById('cat-detail-inp-kdv')?.value || '10', 10);
  const barcodes = [barcode];

  if (!barcode || !title || !rawPrice) {
    showToast("Lütfen tüm alanları eksiksiz doldurun.", "warning");
    return;
  }

  const price = formatPriceInput(rawPrice);
  const noLabel = document.getElementById('cat-detail-check-no-label')?.checked ?? false;
  const isSpecial = document.getElementById('cat-detail-inp-is-special')?.value === 'true';

  try {
    const res = await fetch(`${API_BASE}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barcode: barcode,
        old_barcode: oldBarcode,
        barcodes: barcodes,
        alternate_barcodes: barcodes,
        title: title,
        brand: brand,
        price: price,
        origin: origin,
        stock: stock,
        kdv: kdv,
        vat_rate: kdv,
        no_label: noLabel,
        is_special: isSpecial,
        source: 'PC'
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      currentDetailProduct.barcode = barcode;
      currentDetailProduct.title = title;
      currentDetailProduct.title1 = title;
      currentDetailProduct.barcodes = barcodes;
      currentDetailProduct.alternate_barcodes = barcodes;
      currentDetailProduct.brand = brand;
      currentDetailProduct.price = price;
      currentDetailProduct.origin = origin;
      currentDetailProduct.stock = stock;
      currentDetailProduct.kdv = kdv;
      currentDetailProduct.no_label = noLabel;
      currentDetailProduct.is_special = isSpecial;
      currentDetailProduct.special_category = isSpecial;
      if (noLabel) {
        currentDetailProduct.label_price = price;
      }

      // Hızlı Buton API Senkronizasyonu
      try {
        if (isQuickBtn) {
          await fetch(`${API_BASE}/api/pos/quick_buttons/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: title,
              code: quickCode,
              price: parsePrice(price),
              unit: 'Adet',
              color: quickColor,
              icon: quickIcon
            })
          });
        } else {
          await fetch(`${API_BASE}/api/pos/quick_buttons/remove`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: barcode, id: barcode })
          });
        }
      } catch (qbErr) {
        console.warn("Hızlı buton güncellenirken hata:", qbErr);
      }

      closeCatalogProductDetailModal();
      showToast(`✅ '${title}' başarıyla güncellendi!`, "success");
      buildBrandDropdownOptions();
      onCatalogFilterChange();
    } else {
      showToast(`❌ Güncelleme başarısız: ${data.message}`, "error");
    }
  } catch (err) {
    showToast(`❌ Güncelleme hatası: ${err.message}`, "error");
  }
}


// ==========================================
// MANUEL HIZLI DÜZENLEME FONKSİYONLARI
// ==========================================

async function openQuickPriceEdit(barcode) {
  const prod = allCatalogProducts.find(p => p.barcode === barcode);
  if (!prod) return;
  
  const newPrice = await showCustomPrompt(`Mevcut Fiyat: ${prod.price || '0,00 TL'}\nYeni Satış Fiyatını Girin:`, prod.price || '', `💰 Fiyat Düzenle: ${prod.title}`, "Kaydet", "İptal");
  if (!newPrice) return;
  const cleanPrice = newPrice.trim();
  if (!cleanPrice) return;

  const formattedPrice = formatPriceInput(cleanPrice);

  try {
    const res = await fetch(`${API_BASE}/api/catalog/batch-price-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barcodes: [barcode],
        price: formattedPrice
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      prod.price = formattedPrice;
      onCatalogFilterChange();
      showToast(`✓ '${prod.title}' yeni fiyatı: ${formattedPrice}`, "success");
    } else {
      showToast(`Hata: ${data.message}`, "error");
    }
  } catch (err) {
    showToast(`Bağlantı hatası: ${err.message}`, "error");
  }
}

async function openQuickTitleEdit(barcode) {
  const prod = allCatalogProducts.find(p => p.barcode === barcode);
  if (!prod) return;
  
  const newTitle = await showCustomPrompt(`Mevcut Ürün Adı:\n${prod.title}`, prod.title, `✏️ İsim Düzenle: ${prod.barcode}`, "Kaydet", "İptal");
  if (!newTitle) return;
  const cleanTitle = newTitle.trim().toUpperCase();
  if (!cleanTitle) return;

  try {
    const res = await fetch(`${API_BASE}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barcode: barcode,
        title: cleanTitle,
        price: prod.price,
        brand: prod.brand,
        origin: prod.origin || 'TÜRKİYE'
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      prod.title = cleanTitle;
      prod.title1 = cleanTitle;
      onCatalogFilterChange();
      showToast(`✓ Ürün adı güncellendi: ${cleanTitle}`, "success");
    } else {
      showToast(`Hata: ${data.message}`, "error");
    }
  } catch (err) {
    showToast(`Bağlantı hatası: ${err.message}`, "error");
  }
}

async function openQuickBrandEdit(barcode) {
  const prod = allCatalogProducts.find(p => p.barcode === barcode);
  if (!prod) return;
  
  const newBrand = await showCustomPrompt(`Mevcut Marka: ${prod.brand || 'DİĞER'}\nYeni Marka / Firma Adını Girin:`, prod.brand || '', `🏷️ Firma Düzenle: ${prod.title}`, "Kaydet", "İptal");
  if (!newBrand) return;
  const cleanBrand = newBrand.trim().toUpperCase();
  if (!cleanBrand) return;

  try {
    const res = await fetch(`${API_BASE}/api/catalog/batch-brand-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barcodes: [barcode],
        brand: cleanBrand
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      prod.brand = cleanBrand;
      buildBrandDropdownOptions();
      onCatalogFilterChange();
      showToast(`✓ Marka güncellendi: ${cleanBrand}`, "success");
    } else {
      showToast(`Hata: ${data.message}`, "error");
    }
  } catch (err) {
    showToast(`Bağlantı hatası: ${err.message}`, "error");
  }
}


// ==========================================
// TOPLU FİYAT DEĞİŞTİRME MODALI FONKSİYONLARI
// ==========================================

function openBatchPriceModal() {
  if (selectedBarcodes.size === 0) {
    showToast("Lütfen önce tablodan ürün seçin.", "warning");
    return;
  }

  batchPriceTargetProducts = allCatalogProducts.filter(p => selectedBarcodes.has(p.barcode));
  if (batchPriceTargetProducts.length === 0) return;

  updateBatchPriceModalCounters();
  
  const commonInp = document.getElementById('batch-common-price-inp');
  if (commonInp) commonInp.value = "";

  renderBatchPriceItemsList("");

  const modal = document.getElementById('modal-catalog-batch-price');
  if (modal) {
    modal.style.display = 'flex';
    setTimeout(() => {
      if (commonInp) {
        commonInp.focus();
        commonInp.select();
      }
    }, 60);
  }
}

function updateBatchPriceModalCounters() {
  const count = batchPriceTargetProducts.length;
  const badgeEl = document.getElementById('batch-price-selected-badge');
  if (badgeEl) badgeEl.innerText = `${count} Ürün Seçildi`;
  
  const countEl = document.getElementById('batch-price-count-info');
  if (countEl) countEl.innerText = `${count} Ürün`;

  const sumCountEl = document.getElementById('batch-summary-count');
  if (sumCountEl) sumCountEl.innerText = `${count} Ürün`;
}

function removeBatchPriceTargetItem(barcode) {
  batchPriceTargetProducts = batchPriceTargetProducts.filter(p => p.barcode !== barcode);
  selectedBarcodes.delete(barcode);
  
  if (typeof updateBatchBar === 'function') {
    updateBatchBar();
  }
  
  if (batchPriceTargetProducts.length === 0) {
    closeBatchPriceModal();
    showToast("Tüm ürünler seçimden çıkarıldı.", "info");
    return;
  }
  
  updateBatchPriceModalCounters();
  const commonInp = document.getElementById('batch-common-price-inp');
  const cleanVal = (commonInp?.value || '').trim();
  const displayVal = cleanVal ? formatPriceInput(cleanVal) : '';
  renderBatchPriceItemsList(displayVal);
}

function renderBatchPriceItemsList(newPriceStr = "") {
  const container = document.getElementById('batch-price-items-container');
  if (!container) return;
  container.innerHTML = "";

  if (batchPriceTargetProducts.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: #94a3b8; padding: 20px; font-size: 13px;">Seçili ürün kalmadı.</div>`;
    return;
  }

  batchPriceTargetProducts.forEach(p => {
    const row = document.createElement('div');
    row.style.cssText = "display: flex; align-items: center; justify-content: space-between; gap: 10px; background: rgba(15, 23, 42, 0.8); border: 1px solid #1e293b; border-radius: 8px; padding: 8px 10px; transition: all 0.15s ease;";
    row.innerHTML = `
      <div style="flex: 1; min-width: 0;">
        <div style="font-size: 12.5px; font-weight: 800; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${p.title}">${p.title}</div>
        <div style="font-size: 11px; color: #94a3b8; font-family: monospace; margin-top: 2px;">${p.barcode} | ${p.brand || 'DİĞER'}</div>
      </div>
      <div style="text-align: right; min-width: 90px;">
        <div style="font-size: 12px; font-weight: 700; color: #cbd5e1;">Eski: <span style="color: #94a3b8;">${p.price || '-'}</span></div>
        ${newPriceStr ? `<div style="font-size: 12px; font-weight: 900; color: #4ade80;">➔ ${newPriceStr}</div>` : ''}
      </div>
      <button type="button" onclick="removeBatchPriceTargetItem('${p.barcode}')" title="Bu ürünü toplu fiyat listesinden çıkar" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.35); color: #f87171; border-radius: 6px; width: 26px; height: 26px; font-size: 13px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease; flex-shrink: 0;">
        ✕
      </button>
    `;
    container.appendChild(row);
  });
}

function onBatchPriceCommonInput(val) {
  const cleanVal = (val || '').trim();
  const displayVal = cleanVal ? formatPriceInput(cleanVal) : '-';
  const sumPriceEl = document.getElementById('batch-summary-price');
  if (sumPriceEl) sumPriceEl.innerText = displayVal;
  renderBatchPriceItemsList(cleanVal ? displayVal : "");
}

function applyCommonPriceToPreview() {
  const val = document.getElementById('batch-common-price-inp')?.value;
  onBatchPriceCommonInput(val);
}

function closeBatchPriceModal() {
  const modal = document.getElementById('modal-catalog-batch-price');
  if (modal) modal.style.display = 'none';
  batchPriceTargetProducts = [];
}

async function submitBatchPriceUpdate() {
  const rawPrice = document.getElementById('batch-common-price-inp')?.value.trim();
  if (!rawPrice) {
    showToast("Lütfen tümüne uygulanacak yeni bir fiyat girin.", "warning");
    const inp = document.getElementById('batch-common-price-inp');
    if (inp) {
      inp.focus();
      inp.style.borderColor = '#ef4444';
      setTimeout(() => { inp.style.borderColor = '#38bdf8'; }, 800);
    }
    return;
  }

  const formattedPrice = formatPriceInput(rawPrice);
  const barcodes = batchPriceTargetProducts.map(p => p.barcode);

  if (barcodes.length === 0) {
    showToast("Güncellenecek ürün bulunamadı.", "warning");
    return;
  }

  const submitBtn = document.getElementById('btn-submit-batch-price');
  const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '⏳ Kaydediliyor...';
    submitBtn.style.opacity = '0.7';
  }

  try {
    const res = await fetch(`${API_BASE}/api/catalog/batch-price-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barcodes: barcodes,
        price: formattedPrice
      })
    });
    const data = await res.json();
    
    if (data.status === 'success') {
      // 1. Ana ürün listesinde fiyatları güncelle
      allCatalogProducts.forEach(p => {
        if (barcodes.includes(p.barcode)) {
          p.price = formattedPrice;
          p.updated_at = new Date().toISOString();
        }
      });

      // 2. Modalı kapat
      closeBatchPriceModal();

      // 3. Seçimleri temizle ve tabloyu yeniden çiz
      if (typeof clearCatalogSelection === 'function') {
        clearCatalogSelection();
      } else {
        selectedBarcodes.clear();
      }
      
      if (typeof onCatalogFilterChange === 'function') {
        onCatalogFilterChange();
      }

      // 4. Net Bilgilendirme Ekranı / Toast
      showToast(`🎉 ${data.message || `${barcodes.length} ürünün fiyatı ${formattedPrice} olarak güncellendi.`}`, "success");
      
      // 5. Arka planda tam güncel kataloğu yeniden çek
      if (typeof loadCatalog === 'function') {
        loadCatalog(false);
      }
    } else {
      showToast(`❌ Hata: ${data.message}`, "error");
    }
  } catch (err) {
    showToast(`❌ Bağlantı hatası: ${err.message}`, "error");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHtml || '💾 Fiyatları Uygula ve Kaydet';
      submitBtn.style.opacity = '1';
    }
  }
}


