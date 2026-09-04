// -*- coding: utf-8 -*-
/**
 * KASA MODALLARI & YARDIMCI DİYALOGLAR (kasa_modallar.js)
 */

// =========================================================
// 5. MODAL YÖNETİMİ (100% KARARLI VE GÜVENLİ)
// =========================================================
function showPosModal(modalId) {
  let m = typeof modalId === 'string' ? document.getElementById(modalId) : modalId;
  if (!m) {
    console.error('Modal bulunamadı:', modalId);
    return;
  }
  if (m.parentElement !== document.body) {
    document.body.appendChild(m);
  }
  m.classList.add('active');
  m.style.removeProperty('display');
  m.style.setProperty('display', 'flex', 'important');
  m.style.setProperty('visibility', 'visible', 'important');
  m.style.setProperty('opacity', '1', 'important');
  m.style.setProperty('pointer-events', 'auto', 'important');
  m.style.setProperty('z-index', '99999999', 'important');
  m.style.setProperty('position', 'fixed', 'important');
  m.style.setProperty('inset', '0px', 'important');
  m.style.setProperty('width', '100vw', 'important');
  m.style.setProperty('height', '100vh', 'important');
  m.style.setProperty('background', 'rgba(4, 8, 16, 0.88)', 'important');
  m.style.setProperty('backdrop-filter', 'blur(8px)', 'important');
}

function hidePosModal(modalId) {
  const m = typeof modalId === 'string' ? document.getElementById(modalId) : modalId;
  if (!m) return;
  m.classList.remove('active');
  m.style.removeProperty('display');
  m.style.setProperty('display', 'none', 'important');
  m.style.setProperty('visibility', 'hidden', 'important');
  m.style.setProperty('opacity', '0', 'important');
  m.style.setProperty('pointer-events', 'none', 'important');
}

// 5.1. HIZLI ÜRÜN TANIMLA / DÜZENLE MODALI
function openPosQuickProductModal(barcodeOrEvent = '') {
  let presetBarcode = '';
  if (typeof barcodeOrEvent === 'string' || typeof barcodeOrEvent === 'number') {
    presetBarcode = String(barcodeOrEvent).trim();
  }

  const bcInp = document.getElementById('quick-prod-barcode');
  const titleInp = document.getElementById('quick-prod-title');
  const salePriceInp = document.getElementById('quick-prod-sale-price');
  const buyingPriceInp = document.getElementById('quick-prod-buying-price');
  const marginInp = document.getElementById('quick-prod-margin');
  const brandInp = document.getElementById('quick-prod-brand');
  const stockInp = document.getElementById('quick-prod-stock');
  const unitInp = document.getElementById('quick-prod-unit');
  const kdvInp = document.getElementById('quick-prod-kdv');
  const badgeEl = document.getElementById('pos-quick-prod-status-badge');
  const btnSave = document.getElementById('btn-save-quick-prod');

  if (bcInp) bcInp.value = presetBarcode;
  if (titleInp) titleInp.value = '';
  if (salePriceInp) salePriceInp.value = '';
  if (buyingPriceInp) buyingPriceInp.value = '';
  if (marginInp) marginInp.value = '%0';
  if (brandInp) brandInp.value = '';
  if (stockInp) stockInp.value = '0';
  if (kdvInp) kdvInp.value = '10';

  if (badgeEl) {
    badgeEl.style.background = '#0f172a';
    badgeEl.style.borderColor = '#334155';
    badgeEl.style.color = '#94a3b8';
    badgeEl.innerText = 'Barkod okutun veya yazın (Kayıtlı ise bilgileri gelir)';
  }

  if (btnSave) {
    btnSave.innerText = 'Kaydet (Enter)';
    btnSave.style.background = '#2563eb';
  }

  validateQuickProdInputs();
  showPosModal('modal-pos-quick-product-manage');

  setTimeout(() => {
    if (presetBarcode) {
      lookupQuickProductByBarcode(presetBarcode);
    } else if (bcInp) {
      bcInp.focus();
      bcInp.select();
    }
  }, 80);
}

function validateQuickProdInputs() {
  const bc = (document.getElementById('quick-prod-barcode')?.value || '').trim();
  const title = (document.getElementById('quick-prod-title')?.value || '').trim();
  const salePriceVal = (document.getElementById('quick-prod-sale-price')?.value || '').replace(',', '.').trim();
  const salePrice = parseFloat(salePriceVal);

  const btnSave = document.getElementById('btn-save-quick-prod');
  const isValid = bc.length > 0 && title.length > 0 && !isNaN(salePrice) && salePrice > 0;

  if (btnSave) {
    if (isValid) {
      btnSave.style.opacity = '1';
      btnSave.style.pointerEvents = 'auto';
      btnSave.style.cursor = 'pointer';
    } else {
      btnSave.style.opacity = '0.4';
      btnSave.style.pointerEvents = 'none';
      btnSave.style.cursor = 'not-allowed';
    }
  }
  return isValid;
}

function closePosQuickProductModal() {
  hidePosModal('modal-pos-quick-product-manage');
  const posInp = document.getElementById('pos-barcode-input');
  if (posInp) posInp.focus();
}

let quickProdLookupTimer = null;
function onQuickProdBarcodeChange(val) {
  clearTimeout(quickProdLookupTimer);
  const bc = String(val || '').trim();
  validateQuickProdInputs();
  if (bc.length >= 2) {
    quickProdLookupTimer = setTimeout(() => {
      lookupQuickProductByBarcode(bc);
    }, 200);
  }
}

const POPULAR_BRANDS = [
  'ÇAYKUR', 'ÜLKER', 'ETİ', 'SÜTAŞ', 'PINAR', 'TORKU', 'DOĞUŞ', 'LİPTON', 'DURU', 
  'ARİEL', 'FAİRY', 'ALO', 'OMO', 'NESTLE', 'EKER', 'İÇİM', 'TAT', 'SALAT', 'YUDUM', 
  'KOMİLİ', 'CALVE', 'KNORR', 'MAGGİ', 'KENT', 'HARİBO', 'TADIM', 'PEYMAN', 'DORİTOS', 
  'RUFFLES', 'LAYS', 'ERİKLİ', 'SIRMA', 'DAMLA', 'HAYAT', 'KIZILAY', 'BEYPAZARI', 
  'ULUDAĞ', 'RED BULL', 'BURN', 'SENSODYNE', 'COLGATE', 'SİGNAL', 'İPANA', 'PANTENE', 
  'ELİDOR', 'CLEAR', 'HACI ŞAKİR', 'FAMİLİA', 'PAPİA', 'SELPAK', 'SOLO', 'PAREX', 
  'CİF', 'DOMESTOS', 'PRİL', 'VERNEL', 'YUMOŞ', 'ACE', 'BİNGO', 'MOLFİX', 'PRİMA', 
  'SLEEPY', 'CANBEBE', 'COCA COLA', 'FANTA', 'SPRİTE', 'PEPSİ', 'YEDİGÜN', 'FRUKO', 
  'CAPPY', 'DİMES', 'TAMEK', 'AROMEL', 'NİVEA', 'DOVE', 'REXONA', 'AXE', 'DERBY', 
  'GİLLETTE', 'PERMASHARP', 'DURACELL', 'PANASONİC', 'TOSHIBA', 'BEYPİLİÇ', 'ŞENPİLİÇ', 
  'BANVİT', 'KESTANE', 'BAŞHAN', 'ÖĞÜT', 'OFÇAY', 'BİLLUR', 'BALKÜPÜ', 'BORŞEKER', 
  'FİSKOBİRLİK', 'KOROPLAST', 'DR.OETKER'
];

function autoDetectBrandFromTitle(titleText) {
  if (!titleText) return '';
  const upper = String(titleText).toLocaleUpperCase('tr-TR').trim();
  
  for (const b of POPULAR_BRANDS) {
    if (upper.includes(b)) {
      return b.split(' ').map(w => w.charAt(0) + w.slice(1).toLocaleLowerCase('tr-TR')).join(' ');
    }
  }

  const words = upper.split(/\s+/).filter(w => w.length >= 3 && !/^\d+/.test(w));
  const ignoredPrefixes = ['BÜYÜK', 'KÜÇÜK', 'YENİ', 'ÖZEL', 'SÜPER', 'EKONOMİK', 'ORGANİK', 'KLASİK', 'MNV'];
  if (words.length > 0 && !ignoredPrefixes.includes(words[0])) {
    const firstWord = words[0];
    return firstWord.charAt(0) + firstWord.slice(1).toLocaleLowerCase('tr-TR');
  }

  return '';
}

function onQuickProdTitleChange(val) {
  const brandInp = document.getElementById('quick-prod-brand');
  if (brandInp && (!brandInp.dataset.userEdited || brandInp.dataset.userEdited === 'false' || !brandInp.value.trim())) {
    const detected = autoDetectBrandFromTitle(val);
    if (detected) {
      brandInp.value = detected;
    }
  }
}

async function triggerQuickProductBarcodeLookup() {
  clearTimeout(quickProdLookupTimer);
  const bcInp = document.getElementById('quick-prod-barcode');
  const bc = String(bcInp?.value || '').trim();
  if (!bc) {
    if (typeof showToast === 'function') showToast('Lütfen barkod numarası giriniz.', 'warning');
    if (bcInp) bcInp.focus();
    return;
  }
  await lookupQuickProductByBarcode(bc);
  
  // Eğer ürün bilgisi geldiyse direkt Satış Fiyatına odaklan, yoksa Ürün Adına
  const titleInp = document.getElementById('quick-prod-title');
  const priceInp = document.getElementById('quick-prod-sale-price');
  if (titleInp && titleInp.value) {
    if (priceInp) { priceInp.focus(); priceInp.select(); }
  } else if (titleInp) {
    titleInp.focus();
  }
}

function onQuickProdBarcodeKey(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    triggerQuickProductBarcodeLookup();
  }
}

async function lookupQuickProductByBarcode(barcode) {
  if (!barcode) return;
  try {
    const res = await fetch(`/api/pos/search?q=${encodeURIComponent(barcode)}`);
    const data = await res.json();

    const titleInp = document.getElementById('quick-prod-title');
    const salePriceInp = document.getElementById('quick-prod-sale-price');
    const buyingPriceInp = document.getElementById('quick-prod-buying-price');
    const brandInp = document.getElementById('quick-prod-brand');
    const stockInp = document.getElementById('quick-prod-stock');
    const kdvInp = document.getElementById('quick-prod-kdv');
    const badgeEl = document.getElementById('pos-quick-prod-status-badge');
    const btnSave = document.getElementById('btn-save-quick-prod');

    if (data.status === 'success' && data.product) {
      const p = data.product;
      const effectiveBrand = p.brand || autoDetectBrandFromTitle(p.title) || data.detected_brand || '';
      
      if (badgeEl) {
        badgeEl.style.background = 'rgba(16,185,129,0.1)';
        badgeEl.style.borderColor = 'rgba(16,185,129,0.3)';
        badgeEl.style.color = '#34d399';
        badgeEl.innerText = `✓ Kayıtlı Ürün: ${p.title} ${effectiveBrand ? '• ' + effectiveBrand : ''}`;
      }
      if (titleInp) titleInp.value = p.title || '';
      if (salePriceInp) salePriceInp.value = (p.unit_price || p.price || 0.0).toFixed(2);
      if (buyingPriceInp) buyingPriceInp.value = (p.buying_price || 0.0).toFixed(2);
      if (brandInp) brandInp.value = effectiveBrand;
      if (stockInp) stockInp.value = p.stock || 0;
      if (kdvInp && p.kdv) kdvInp.value = p.kdv;
      recalcQuickProdMargin();

      if (btnSave) {
        btnSave.innerText = 'Güncelle ve Kaydet (Enter)';
        btnSave.style.background = '#059669';
      }
    } else {
      const detectedBrand = data.detected_brand || '';
      if (badgeEl) {
        badgeEl.style.background = 'rgba(56,189,248,0.1)';
        badgeEl.style.borderColor = 'rgba(56,189,248,0.3)';
        badgeEl.style.color = '#38bdf8';
        badgeEl.innerText = detectedBrand 
          ? `Yeni Ürün: [${detectedBrand}] Üretici/Firma Algılandı`
          : 'Yeni Ürün: Ürün adı ve satış fiyatını giriniz';
      }
      if (brandInp && detectedBrand) {
        brandInp.value = detectedBrand;
      }
      if (btnSave) {
        btnSave.innerText = 'Yeni Ürünü Kaydet (Enter)';
        btnSave.style.background = '#2563eb';
      }
    }
    validateQuickProdInputs();
  } catch (err) {
    console.error(err);
  }
}

function recalcQuickProdMargin() {
  const buyingInp = document.getElementById('quick-prod-buying-price');
  const saleInp = document.getElementById('quick-prod-sale-price');
  const marginInp = document.getElementById('quick-prod-margin');

  const buying = parseFloat((buyingInp?.value || '0').replace(',', '.')) || 0;
  const sale = parseFloat((saleInp?.value || '0').replace(',', '.')) || 0;

  if (marginInp) {
    if (buying > 0 && sale > 0) {
      const margin = (((sale - buying) / buying) * 100).toFixed(1);
      marginInp.value = `%${margin}`;
      marginInp.style.color = margin >= 25 ? '#34d399' : margin > 0 ? '#fbbf24' : '#f87171';
    } else {
      marginInp.value = '%0';
      marginInp.style.color = '#fbbf24';
    }
  }
}

async function submitQuickProductSave(addToCart = false, closeOnSave = true) {
  const bcInp = document.getElementById('quick-prod-barcode');
  const titleInp = document.getElementById('quick-prod-title');
  const salePriceInp = document.getElementById('quick-prod-sale-price');
  const buyingPriceInp = document.getElementById('quick-prod-buying-price');
  const brandInp = document.getElementById('quick-prod-brand');
  const stockInp = document.getElementById('quick-prod-stock');
  const kdvInp = document.getElementById('quick-prod-kdv');

  const barcode = (bcInp?.value || '').trim();
  const title = (titleInp?.value || '').trim();
  const price = (salePriceInp?.value || '').trim();
  const buyingPrice = (buyingPriceInp?.value || '').trim();
  const brand = (brandInp?.value || '').trim();
  const stock = parseInt(stockInp?.value || '0', 10) || 0;
  const unit = 'Adet'; // Manav ürünü buradan eklenmez, hepsi Adet
  const kdv = parseInt(kdvInp?.value || '10', 10);

  if (!barcode) {
    if (typeof showToast === 'function') showToast('⚠️ Barkod Numarası zorunludur.', 'warning');
    if (bcInp) bcInp.focus();
    return;
  }
  if (!title) {
    if (typeof showToast === 'function') showToast('⚠️ Ürün Adı zorunludur.', 'warning');
    if (titleInp) titleInp.focus();
    return;
  }
  if (!price || isNaN(parseFloat(price.replace(',', '.'))) || parseFloat(price.replace(',', '.')) <= 0) {
    if (typeof showToast === 'function') showToast('⚠️ Satış Fiyatı zorunludur.', 'warning');
    if (salePriceInp) salePriceInp.focus();
    return;
  }

  const numericPrice = parseFloat(price.replace(',', '.'));

  const payload = {
    barcode: barcode,
    title: title,
    price: price,
    buying_price: buyingPrice || '0.00',
    brand: brand || 'DİĞER',
    stock: stock,
    unit: unit,
    kdv: kdv,
    vat_rate: kdv,
    source: 'POS'
  };

  try {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.status === 'success') {
      if (typeof showToast === 'function') {
        showToast(`✅ ${title} kaydedildi!`, 'success');
      }

      if (addToCart) {
        addItemToPosCart({
          title: title,
          barcode: barcode,
          unit_price: numericPrice,
          total_price: numericPrice,
          quantity: 1,
          unit: unit
        });
        closePosQuickProductModal();
      } else if (closeOnSave) {
        // Kaydedip pencereyi hemen kapat ve barkod alanına odaklan
        closePosQuickProductModal();
      } else {
        // Formu temizle ve imleci doğrudan yeni barkod okuma alanına odakla (Seri Kayıt modu)
        if (bcInp) {
          bcInp.value = '';
          bcInp.focus();
        }
        if (titleInp) titleInp.value = '';
        if (salePriceInp) salePriceInp.value = '';
        if (buyingPriceInp) buyingPriceInp.value = '';
        if (brandInp) brandInp.value = '';
        if (stockInp) stockInp.value = '0';
        if (kdvInp) kdvInp.value = '10';
        const marginInp = document.getElementById('quick-prod-margin');
        if (marginInp) marginInp.value = '%0';

        const badgeEl = document.getElementById('pos-quick-prod-status-badge');
        if (badgeEl) {
          badgeEl.style.background = 'rgba(16,185,129,0.12)';
          badgeEl.style.borderColor = 'rgba(16,185,129,0.3)';
          badgeEl.style.color = '#34d399';
          badgeEl.innerText = `✓ Son Kaydedilen: "${title}" • Yeni barkod okutun veya yazın`;
        }

        const btnSave = document.getElementById('btn-save-quick-prod');
        if (btnSave) {
          btnSave.innerText = '💾 Kaydet ve Kapat (Enter)';
          btnSave.style.background = '#2563eb';
        }

        validateQuickProdInputs();
      }

      // UI ve Özetleri anında tazele
      if (typeof loadPosQuickGrid === 'function') {
        loadPosQuickGrid(window.currentPosQuickCategory || 'manav_adet');
      }
      if (typeof loadDashboardSummary === 'function') {
        loadDashboardSummary();
      }
      if (typeof loadProducts === 'function') loadProducts();
      if (typeof loadCatalogProducts === 'function') loadCatalogProducts();
      if (typeof loadManavProducts === 'function') loadManavProducts();
    } else {
      if (typeof showToast === 'function') showToast(`⚠️ ${data.message}`, 'error');
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('Ürün kaydetme hatası.', 'error');
  }
}

// 5.2. FİYAT GÖR / BARKOD SORGULA (F6)
let priceCheckDebounceTimer = null;
let lastFoundPriceCheckProduct = null;

function openPosPriceCheckModal() {
  const inp = document.getElementById('pos-price-check-input');
  const resEl = document.getElementById('pos-price-check-result');
  const btnAdd = document.getElementById('btn-add-checked-to-cart');

  lastFoundPriceCheckProduct = null;
  if (inp) inp.value = '';
  if (btnAdd) btnAdd.style.display = 'none';

  if (resEl) {
    resEl.innerHTML = `
      <div style="font-size: 36px; margin-bottom: 6px;">🔍</div>
      <div style="font-size: 15px; font-weight: 800; color: #f8fafc;">Barkod Okutun veya Yazın</div>
      <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Okuttuğunuz ürünün adı, satış fiyatı ve stok durumu büyük puntolarla gösterilir.</div>
    `;
  }

  showPosModal('modal-pos-price-check');

  setTimeout(() => {
    if (inp) {
      inp.focus();
      inp.select();
    }
  }, 80);
}

function closePosPriceCheckModal() {
  lastFoundPriceCheckProduct = null;
  hidePosModal('modal-pos-price-check');
  const posInp = document.getElementById('pos-barcode-input');
  if (posInp) posInp.focus();
}

function handlePosPriceCheckLive(val) {
  // Canlı arama kullanıcının isteği üzerine devre dışı bırakıldı (Barkod tam yazılmalı veya Fiyat Gör butonuna basılmalı)
}

function executePosPriceCheck() {
  const inp = document.getElementById('pos-price-check-input');
  const query = (inp?.value || '').trim();
  if (!query) {
    if (typeof showToast === 'function') showToast('Lütfen barkod okutun veya ürün adı yazın.', 'warning');
    if (inp) inp.focus();
    return;
  }
  executePriceCheckQuery(query);
}

async function handlePosPriceCheckKey(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    const inp = document.getElementById('pos-price-check-input');
    const query = (inp?.value || '').trim();
    
    // Eğer ekranda daha önceden sorgulanmış ürün varsa ve input değişmediyse sepete ekle
    if (lastFoundPriceCheckProduct && query && (lastFoundPriceCheckProduct.barcode === query || lastFoundPriceCheckProduct.title === query)) {
      addFoundProductToPosCart();
      return;
    }

    if (query) {
      executePriceCheckQuery(query);
    }
  }
}

async function executePriceCheckQuery(query) {
  const resEl = document.getElementById('pos-price-check-result');
  const btnAdd = document.getElementById('btn-add-checked-to-cart');
  if (!resEl) return;

  resEl.innerHTML = '<div style="color: #38bdf8; font-size: 14px; font-weight: 700; padding: 15px 0;"><span style="font-size: 20px;">⏳</span> Ürün sorgulanıyor...</div>';

  try {
    const res = await fetch(`/api/pos/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (data.status === 'success' && data.product) {
      const p = data.product;
      lastFoundPriceCheckProduct = p;
      const numPrice = parseFloat(p.unit_price || p.price || 0);
      const numericPriceStr = numPrice.toFixed(2).replace('.', ',');
      const stockVal = p.stock !== undefined ? p.stock : (p.stock_qty || 100);
      
      resEl.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; width: 100%;">
          <div style="font-size: 17px; font-weight: 900; color: #ffffff; letter-spacing: 0.3px; line-height: 1.3; text-align: center;">${p.title}</div>
          
          <div style="background: rgba(16,185,129,0.12); border: 2px solid #10b981; border-radius: 12px; padding: 10px 20px; width: 100%; box-sizing: border-box; text-align: center; margin: 2px 0;">
            <div style="font-size: 10.5px; font-weight: 800; color: #34d399; text-transform: uppercase; letter-spacing: 1px;">SATIŞ FİYATI</div>
            <div style="font-size: 40px; font-weight: 900; color: #10b981; font-family: monospace; text-shadow: 0 0 16px rgba(16,185,129,0.45); line-height: 1.1; margin: 3px 0;">
              ${numericPriceStr} TL
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; width: 100%; margin-top: 2px;">
            <div style="background: #070d1e; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 6px; text-align: center;">
              <span style="font-size: 10px; color: #64748b; font-weight: 700; display: block;">BARKOD</span>
              <strong style="color: #38bdf8; font-family: monospace; font-size: 12px;">${p.barcode}</strong>
            </div>
            <div style="background: #070d1e; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 6px; text-align: center;">
              <span style="font-size: 10px; color: #64748b; font-weight: 700; display: block;">BİRİM</span>
              <strong style="color: #f8fafc; font-size: 12px;">${p.unit || 'Adet'}</strong>
            </div>
            <div style="background: #070d1e; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 6px; text-align: center;">
              <span style="font-size: 10px; color: #64748b; font-weight: 700; display: block;">STOK</span>
              <strong style="color: #fbbf24; font-size: 12px;">${stockVal}</strong>
            </div>
          </div>
        </div>
      `;
      if (btnAdd) btnAdd.style.display = 'inline-block';
    } else {
      lastFoundPriceCheckProduct = null;
      resEl.innerHTML = `
        <div style="color: #f87171; font-size: 16px; font-weight: 800;">❌ Ürün Bulunamadı</div>
        <div style="color: #94a3b8; font-size: 12px; margin-top: 6px;">'<strong>${query}</strong>' barkodlu / isimli ürün sistemde kayıtlı değil.</div>
      `;
      if (btnAdd) btnAdd.style.display = 'none';
    }
  } catch(err) {
    resEl.innerHTML = '<span style="color: #f87171; font-size: 13px;">Sorgulama bağlantı hatası.</span>';
    if (btnAdd) btnAdd.style.display = 'none';
  }
}

function addFoundProductToPosCart() {
  if (!lastFoundPriceCheckProduct) return;
  const p = lastFoundPriceCheckProduct;
  const uPrice = parseFloat(p.unit_price || p.price || 0);
  addItemToPosCart({
    barcode: p.barcode,
    title: p.title,
    unit_price: uPrice,
    total_price: uPrice,
    quantity: 1,
    unit: p.unit || 'Adet',
    is_scale_item: p.is_scale_item
  });
  closePosPriceCheckModal();
}

// 5.3. MOBİL QR VE CANLI BAĞLI CİHAZLAR MODALI (F1)
let currentMobileInfoData = null;
let currentMobileProtocol = 'https';

async function openPosMobileQrModal() {
  showPosModal('modal-pos-mobile-qr');

  try {
    const res = await fetch('/api/pos/mobile_info');
    const data = await res.json();
    if (data.status === 'success') {
      currentMobileInfoData = data;
      renderPosMobileQrCode();
      renderConnectedDevicesList(data.connected_devices || []);
    }
  } catch (e) {
    console.error('Mobile info error:', e);
  }
}

function closePosMobileQrModal() {
  hidePosModal('modal-pos-mobile-qr');
}

function renderPosMobileQrCode() {
  if (!currentMobileInfoData) return;
  const canvas = document.getElementById('pos-mobile-qr-canvas');
  const urlInp = document.getElementById('pos-mobile-url-inp');
  const btnHttps = document.getElementById('btn-qr-https');
  const btnHttp = document.getElementById('btn-qr-http');

  const targetUrl = (currentMobileProtocol === 'https' && currentMobileInfoData.https_url) 
    ? currentMobileInfoData.https_url 
    : currentMobileInfoData.http_url;

  if (urlInp) urlInp.value = targetUrl || '';

  if (btnHttps && btnHttp) {
    if (currentMobileProtocol === 'https' && currentMobileInfoData.https_url) {
      btnHttps.style.background = '#0284c7';
      btnHttps.style.borderColor = '#38bdf8';
      btnHttps.style.color = '#fff';
      btnHttp.style.background = 'rgba(255,255,255,0.06)';
      btnHttp.style.borderColor = 'rgba(255,255,255,0.15)';
      btnHttp.style.color = '#94a3b8';
    } else {
      btnHttp.style.background = '#0284c7';
      btnHttp.style.borderColor = '#38bdf8';
      btnHttp.style.color = '#fff';
      btnHttps.style.background = 'rgba(255,255,255,0.06)';
      btnHttps.style.borderColor = 'rgba(255,255,255,0.15)';
      btnHttps.style.color = '#94a3b8';
    }
  }

  if (canvas && typeof QRCode !== 'undefined' && targetUrl) {
    QRCode.toCanvas(canvas, targetUrl, {
      width: 170,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    }, function (error) {
      if (error) console.error('QR draw error:', error);
    });
  }
}

function switchPosMobileQrProtocol(proto) {
  currentMobileProtocol = proto;
  renderPosMobileQrCode();
}

function copyPosMobileUrl() {
  const inp = document.getElementById('pos-mobile-url-inp');
  if (inp && inp.value) {
    navigator.clipboard.writeText(inp.value).then(() => {
      if (typeof showToast === 'function') showToast('📋 Mobil bağlantı linki kopyalandı!', 'success');
    }).catch(() => {
      inp.select();
      document.execCommand('copy');
      if (typeof showToast === 'function') showToast('📋 Link kopyalandı!', 'success');
    });
  }
}

async function loadConnectedDevices() {
  const listEl = document.getElementById('pos-mobile-devices-list');
  if (!listEl) return;

  try {
    const res = await fetch('/api/pos/connected_devices');
    const data = await res.json();
    renderConnectedDevicesList(data.devices || []);
  } catch (e) {
    console.error('Devices load error:', e);
  }
}

function renderConnectedDevicesList(devices) {
  const listEl = document.getElementById('pos-mobile-devices-list');
  const badgeEl = document.getElementById('pos-mobile-connected-badge');
  if (!listEl) return;

  if (badgeEl) {
    badgeEl.innerText = `${devices.length} Cihaz`;
    badgeEl.style.color = devices.length > 0 ? '#34d399' : '#94a3b8';
  }

  if (!devices || devices.length === 0) {
    listEl.innerHTML = `
      <div style="color: #64748b; font-size: 12px; text-align: center; margin: auto; padding: 20px 0;">
        Henüz bağlı mobil cihaz bulunmuyor.<br>
        <small style="color: #475569; font-size: 11px;">Soldaki QR kodu telefonunuzla okutun</small>
      </div>
    `;
    return;
  }

  listEl.innerHTML = devices.map(d => `
    <div style="display: flex; justify-content: space-between; align-items: center; background: #070d1e; border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 6px 10px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 16px;">📱</span>
        <div>
          <strong style="color: #f8fafc; font-size: 12px;">${d.device || d.ip}</strong>
          <small style="color: #94a3b8; font-size: 10px; display: block;">Son işlem: ${d.last_seen || 'Aktif'}</small>
        </div>
      </div>
      <span style="background: rgba(16,185,129,0.2); color: #34d399; font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 800;">
        ONLINE
      </span>
    </div>
  `).join('');
}

// 5.4. ESKİ SATIŞLAR & BEKLEYEN FİŞLER MODALI (F8)
let allRecentSalesCache = [];

function openPosRecentSalesModal() {
  showPosModal('modal-parked-receipts');
  switchRecentSalesSubTab('sales');
  fetchRecentSalesList();
  renderParkedReceiptsList();
}

function closeParkedReceiptsModal() {
  hidePosModal('modal-parked-receipts');
}

function switchRecentSalesSubTab(tabKey) {
  const paneSales = document.getElementById('pane-recent-sales');
  const paneParked = document.getElementById('pane-parked-receipts');
  const btnSales = document.getElementById('btn-tab-recent-sales');
  const btnParked = document.getElementById('btn-tab-parked-receipts');

  if (tabKey === 'sales') {
    if (paneSales) paneSales.style.display = 'flex';
    if (paneParked) paneParked.style.display = 'none';
    if (btnSales) { btnSales.style.background = '#2563eb'; btnSales.style.color = '#fff'; }
    if (btnParked) { btnParked.style.background = 'transparent'; btnParked.style.color = '#94a3b8'; }
  } else {
    if (paneSales) paneSales.style.display = 'none';
    if (paneParked) paneParked.style.display = 'flex';
    if (btnParked) { btnParked.style.background = '#eab308'; btnParked.style.color = '#000'; }
    if (btnSales) { btnSales.style.background = 'transparent'; btnSales.style.color = '#94a3b8'; }
    renderParkedReceiptsList();
  }
}

async function fetchRecentSalesList() {
  const tbody = document.getElementById('recent-pos-sales-table-body');
  const badge = document.getElementById('recent-sales-count-badge');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="6" style="padding: 24px; text-align: center; color: #38bdf8;">🔄 Satışlar ve fişler yükleniyor...</td></tr>';
  }

  try {
    const res = await fetch('/api/pos/recent_sales?limit=100');
    const data = await res.json();
    if (data.status === 'success' && data.sales) {
      allRecentSalesCache = data.sales;
      if (badge) badge.innerText = allRecentSalesCache.length;
      renderRecentSalesTable(allRecentSalesCache);
    } else {
      if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="padding: 24px; text-align: center; color: #64748b;">Henüz kayıtlı satış fişi bulunmuyor.</td></tr>';
    }
  } catch (err) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="padding: 24px; text-align: center; color: #f87171;">Satışlar yüklenirken hata oluştu.</td></tr>';
  }
}

function renderRecentSalesTable(sales) {
  const tbody = document.getElementById('recent-pos-sales-table-body');
  if (!tbody) return;

  if (!sales || sales.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="padding: 24px; text-align: center; color: #64748b;">Eşleşen satış fişi bulunamadı.</td></tr>';
    return;
  }

  tbody.innerHTML = sales.map(s => {
    const isCancelled = s.is_cancelled || s.payment_type === 'İptal Edildi' || (s.receipt_no && s.receipt_no.startsWith('FIS-IPTAL'));
    const isRet = s.is_return || (s.payment_type && s.payment_type.toLowerCase().includes('iade')) || (s.receipt_no && s.receipt_no.startsWith('FIS-IADE'));
    const hasReturns = Array.isArray(s.returns) && s.returns.length > 0;
    const isFullyReturned = s.is_fully_returned || (hasReturns && s.net_amount <= 0.01);
    
    let badgeColor = '#10b981';
    let badgeBg = 'rgba(16,185,129,0.15)';
    let badgeText = s.payment_type || 'Nakit';

    if (isCancelled) {
      badgeColor = '#ef4444';
      badgeBg = 'rgba(239,68,68,0.18)';
      badgeText = '🚫 İptal Edildi';
    } else if (isFullyReturned) {
      badgeColor = '#ef4444';
      badgeBg = 'rgba(239,68,68,0.18)';
      badgeText = '↩️ Tamamı İade';
    } else if (hasReturns) {
      badgeColor = '#fb923c';
      badgeBg = 'rgba(251,146,60,0.15)';
      badgeText = `${s.payment_type || 'Nakit'} (Kısmi İade)`;
    } else if (s.payment_type === 'Kredi Kartı') {
      badgeColor = '#38bdf8';
      badgeBg = 'rgba(56,189,248,0.15)';
    } else if (s.payment_type === 'Veresiye') {
      badgeColor = '#fbbf24';
      badgeBg = 'rgba(251,191,36,0.15)';
    }

    const amountColor = isCancelled ? '#94a3b8' : (isFullyReturned ? '#ef4444' : '#10b981');
    const itemsSummary = (s.items || []).map(i => `${i.quantity || 1}x ${i.title}`).join(', ') || `${s.item_count || 1} Kalem Ürün`;

    return `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.06); transition: background 0.15s ease;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">
        <td style="padding: 10px 14px;">
          <strong style="color: ${isCancelled ? '#f87171' : '#f8fafc'}; font-family: monospace; font-size: 13px;">${s.receipt_no || 'FIS-000'}</strong>
          <div style="font-size: 11px; color: #94a3b8;">${s.date || ''} • ${s.time || ''}</div>
          ${hasReturns ? `
            <div style="font-size: 10.5px; color: #f87171; background: rgba(239,68,68,0.12); border-left: 2px solid #ef4444; padding: 2px 6px; border-radius: 3px; margin-top: 4px; display: inline-block;">
              ↩️ ${parseFloat(s.total_returned_amount || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL İade Edildi${isFullyReturned ? '' : ` (Kalan: ${parseFloat(s.net_amount || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL)`}
            </div>
          ` : ''}
        </td>
        <td style="padding: 10px 14px;">
          <span style="background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeColor}40; padding: 3px 8px; border-radius: 4px; font-weight: 800; font-size: 11px;">
            ${badgeText}
          </span>
        </td>
        <td style="padding: 10px 14px;">
          <div style="font-weight: 700; color: #cbd5e1;">${s.customer || 'Perakende Müşteri'}</div>
          <div style="font-size: 11px; color: #64748b;">Kasiyer: ${s.cashier || 'Kasa 1'}</div>
        </td>
        <td style="padding: 10px 14px; max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${itemsSummary}">
          <div style="font-size: 12px; color: ${isCancelled || isFullyReturned ? '#94a3b8' : '#e2e8f0'}; text-decoration: ${isCancelled || isFullyReturned ? 'line-through' : 'none'};">${itemsSummary}</div>
          <small style="color: #94a3b8;">${s.item_count || (s.items ? s.items.length : 1)} Kalem • ${s.total_quantity || 1} Adet</small>
        </td>
        <td style="padding: 10px 14px; text-align: right;">
          <strong style="color: ${amountColor}; font-family: monospace; font-size: 14.5px; font-weight: 900; text-decoration: ${isFullyReturned ? 'line-through' : 'none'};">
            ${(parseFloat(s.total_amount) || 0).toFixed(2).replace('.', ',')} TL
          </strong>
        </td>
        <td style="padding: 10px 14px; text-align: center;">
          <div style="display: flex; gap: 6px; justify-content: center; align-items: center;">
            <button type="button" onclick="loadSaleToPosCart('${s.receipt_no}')" class="btn-secondary" style="padding: 5px 9px; font-size: 11.5px; font-weight: 800; background: rgba(234,179,8,0.15); border-color: rgba(234,179,8,0.4); color: #fbbf24; display: inline-flex; align-items: center; gap: 4px;" title="Bu Fişi Satış Sepetine Yükle">
              <span>📥</span> Fişi Getir
            </button>
            ${!isCancelled ? `
              <button type="button" onclick="openEditSaleModal('${s.receipt_no}')" class="btn-secondary" style="padding: 5px 8px; font-size: 11.5px; font-weight: 700; background: rgba(168,85,247,0.15); border-color: rgba(168,85,247,0.4); color: #c084fc;" title="Ödeme Türünü veya Müşteriyi Düzenle">
                ✏️ Düzenle
              </button>
              <button type="button" onclick="reprintRecentSale('${s.receipt_no}')" class="btn-secondary" style="padding: 5px 8px; font-size: 11.5px; font-weight: 700; background: rgba(56,189,248,0.1); border-color: rgba(56,189,248,0.3); color: #38bdf8;" title="Fişi Tekrar Yazdır">
                🖨️ Yazdır
              </button>
            ` : ''}
            ${(!isCancelled && !isFullyReturned) ? `
              <button type="button" onclick="openReturnItemsModal('${s.receipt_no}')" class="btn-secondary" style="padding: 5px 8px; font-size: 11.5px; font-weight: 700; background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.3); color: #f87171;" title="Bu Fişten Seçili veya Tüm Ürünleri İade Al">
                ↩️ İade Al
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterRecentSalesTable(query) {
  const q = String(query || '').trim().toLocaleLowerCase('tr-TR');
  if (!q) {
    renderRecentSalesTable(allRecentSalesCache);
    return;
  }
  const filtered = allRecentSalesCache.filter(s => {
    const str = `${s.receipt_no || ''} ${s.customer || ''} ${s.cashier || ''} ${s.payment_type || ''} ${(s.items || []).map(i => i.title).join(' ')}`.toLocaleLowerCase('tr-TR');
    return str.includes(q);
  });
  renderRecentSalesTable(filtered);
}

function reprintRecentSale(receiptNo) {
  const sale = allRecentSalesCache.find(s => s.receipt_no === receiptNo);
  if (!sale) {
    if (typeof showToast === 'function') showToast('Fiş bulunamadı.', 'warning');
    return;
  }
  if (typeof triggerThermalReceiptPrint === 'function') {
    triggerThermalReceiptPrint(sale);
  }
  if (typeof showToast === 'function') {
    showToast(`🖨️ Fiş #${receiptNo} yazıcıya gönderildi.`, 'success');
  }
}

function loadSaleToPosCart(receiptNo) {
  const sale = allRecentSalesCache.find(s => s.receipt_no === receiptNo);
  if (!sale || !sale.items || sale.items.length === 0) {
    if (typeof showToast === 'function') showToast('Fişe ait ürün bulunamadı.', 'warning');
    return;
  }

  posCart = sale.items.map(item => ({
    title: item.title || item.name || 'Ürün',
    barcode: item.barcode || '8690000000000',
    unit_price: parseFloat(item.unit_price || item.price || 0.0),
    total_price: parseFloat(item.total_price || (item.unit_price * (item.quantity || 1)) || 0.0),
    quantity: parseFloat(item.quantity) || 1,
    unit: item.unit || 'Adet',
    is_scale_item: item.is_scale_item || (item.unit === 'Kg')
  }));

  renderPosCart();
  if (typeof updatePosSummaryCounters === 'function') updatePosSummaryCounters();
  closeParkedReceiptsModal();

  if (typeof showToast === 'function') {
    showToast(`📥 Fiş #${receiptNo} sepeti kasaya başarıyla yüklendi!`, 'success');
  }
}

