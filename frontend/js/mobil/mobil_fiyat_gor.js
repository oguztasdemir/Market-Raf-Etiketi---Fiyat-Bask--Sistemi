/**
 * =========================================================================
 * 🏷️ MOBIL FIYAT GÖR & ÜRÜN KARTI MOTORU
 * =========================================================================
 */

let lastAddedProduct = null;

/**
 * 🔎 Barkod Sorgulama & Anında Fiyat/Ürün Getirme
 */
async function lookupBarcode(barcode) {
  barcode = (barcode || '').trim();
  if (!barcode) return;

  // Eğer ürün basım listesinde zaten varsa uyar
  const existingQueueItem = mobileQueue.find(x => x.barcode === barcode);
  if (existingQueueItem) {
    const ok = confirm(
      `⚠️ Bu ürün zaten basım listesinde mevcut!\n\n` +
      `Ürün: ${existingQueueItem.title}\n` +
      `Mevcut Değer: ${existingQueueItem.price}\n\n` +
      `Yine de bu ürün açılsın / güncellensin mi?`
    );
    if (!ok) {
      return;
    }
  }

  currentBarcode = barcode;
  const emptyState = document.getElementById('empty-state');
  const addedCard = document.getElementById('added-success-card');
  const productCard = document.getElementById('product-card');
  const txtBarcode = document.getElementById('txt-barcode');
  const badge = document.getElementById('badge-status');
  const inpTitle = document.getElementById('inp-title');
  const inpPrice = document.getElementById('inp-price');

  if (txtBarcode) txtBarcode.innerText = barcode;
  const manualInp = document.getElementById('inp-manual-barcode');
  if (manualInp) manualInp.value = barcode;

  try {
    const res = await fetch(`/api/products/${barcode}`);
    const data = await res.json();
    
    if (data.status === 'success' && data.product) {
      const p = data.product;
      if (inpTitle) inpTitle.value = p.title || p.title1 || "";
      if (inpPrice) inpPrice.value = formatPriceInput(p.price || "");
      
      const inpBrand = document.getElementById('inp-brand');
      const inpVat = document.getElementById('inp-vat');
      const inpBuyPrice = document.getElementById('inp-buy-price');
      if (inpBrand) inpBrand.value = p.brand || "";
      if (inpVat) inpVat.value = p.vat !== undefined ? p.vat : "10";
      if (inpBuyPrice) inpBuyPrice.value = p.buy_price ? formatPriceInput(p.buy_price) : "";
      
      isNewProduct = false;
      if (badge) {
        badge.className = "product-status-pill found";
        badge.innerText = "✓ Kayıtlı Ürün";
      }
      showToast(`✓ "${p.title || p.title1}" getirildi.`, "success");
    } else {
      isNewProduct = true;
      if (inpTitle) inpTitle.value = "";
      if (inpPrice) inpPrice.value = "";
      const inpBrand = document.getElementById('inp-brand');
      const inpVat = document.getElementById('inp-vat');
      const inpBuyPrice = document.getElementById('inp-buy-price');
      if (inpBrand) inpBrand.value = "";
      if (inpVat) inpVat.value = "10";
      if (inpBuyPrice) inpBuyPrice.value = "";
      
      if (badge) {
        badge.className = "product-status-pill new";
        badge.innerText = "➕ Yeni Ürün";
      }
      showToast("Ürün kayıtlı değil. Bilgilerini yazıp listeye ekleyin.", "success");
      if (inpTitle) inpTitle.focus();
    }

    if (emptyState) emptyState.style.display = 'none';
    if (addedCard) addedCard.style.display = 'none';
    if (productCard) productCard.style.display = 'flex';

  } catch (err) {
    isNewProduct = true;
    if (badge) {
      badge.className = "product-status-pill new";
      badge.innerText = "➕ Yeni Ürün";
    }
    const inpBrand = document.getElementById('inp-brand');
    const inpVat = document.getElementById('inp-vat');
    const inpBuyPrice = document.getElementById('inp-buy-price');
    if (inpBrand) inpBrand.value = "";
    if (inpVat) inpVat.value = "10";
    if (inpBuyPrice) inpBuyPrice.value = "";
    if (emptyState) emptyState.style.display = 'none';
    if (addedCard) addedCard.style.display = 'none';
    if (productCard) productCard.style.display = 'flex';
  }
}

/**
 * ➕ Listeye Ekle Butonu Eylemi
 */
async function addItemToQueue() {
  const title = (document.getElementById('inp-title')?.value || '').trim();
  let price = (document.getElementById('inp-price')?.value || '').trim();
  const brand = document.getElementById('inp-brand') ? document.getElementById('inp-brand').value.trim() : '';
  const vat = document.getElementById('inp-vat') ? document.getElementById('inp-vat').value.trim() : '10';
  const buyPrice = document.getElementById('inp-buy-price') ? document.getElementById('inp-buy-price').value.trim() : '';

  if (!title || !price) {
    showToast("Lütfen Ürün Adı ve Satış Fiyatı girin!", "error");
    return;
  }

  price = formatPriceInput(price);

  // 1. Ürünü sunucu veritabanına/kataloğuna kaydet
  try {
    const response = await fetch('/api/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        barcode: currentBarcode || "8690000000000",
        title: title,
        price: price,
        buying_price: formatPriceInput(buyPrice),
        brand: brand || "YARENLER",
        kdv: vat,
        source: "MOBIL"
      })
    });
    const respData = await response.json();
    if (respData.status === 'success') {
      showToast(`✓ Kataloğa kaydedildi.`, "success");
    } else {
      console.warn("Katalog kaydetme uyarısı:", respData.message);
    }
  } catch (err) {
    console.error("Katalog sunucu hatası:", err);
  }

  // 2. Basım listesine ekle veya güncelle
  const existingIdx = mobileQueue.findIndex(x => x.barcode === currentBarcode);
  if (existingIdx !== -1) {
    mobileQueue[existingIdx].title = title;
    mobileQueue[existingIdx].price = price;
    showToast(`✓ "${title}" güncellendi.`, "success");
  } else {
    mobileQueue.push({
      barcode: currentBarcode || "8690000000000",
      title: title,
      price: price,
      copies: 1
    });
    showToast(`➕ "${title}" basım listesine eklendi!`, "success");
  }

  lastAddedProduct = {
    barcode: currentBarcode || "8690000000000",
    title: title,
    price: price,
    brand: brand,
    vat: vat,
    buyPrice: buyPrice
  };

  saveQueueToStorage();
  if (navigator.vibrate) navigator.vibrate([60, 40, 60]);

  // Kart durumlarını güncelle
  const prodCard = document.getElementById('product-card');
  if (prodCard) prodCard.style.display = 'none';
  if (document.getElementById('empty-state')) document.getElementById('empty-state').style.display = 'none';

  const successCard = document.getElementById('added-success-card');
  const successTitle = document.getElementById('added-success-title');
  const successDesc = document.getElementById('added-success-desc');
  const badgeCountText = document.getElementById('added-badge-count-text');

  if (successTitle) successTitle.innerText = `"${title}" başarıyla listeye eklendi!`;
  if (successDesc) successDesc.innerHTML = `<strong>Barkod:</strong> ${currentBarcode || '-'} &nbsp;|&nbsp; <strong>Fiyat:</strong> ${price}`;
  if (badgeCountText) badgeCountText.innerText = `Listeyi Gör (${mobileQueue.length})`;
  if (successCard) successCard.style.display = 'flex';

  const manualInp = document.getElementById('inp-manual-barcode');
  if (manualInp) manualInp.value = '';
  currentBarcode = '';
}

/**
 * 📷 Sıradaki Okutmaya Hazırlan
 */
function prepareForNextScan() {
  if (document.getElementById('empty-state')) document.getElementById('empty-state').style.display = 'none';
  if (document.getElementById('product-card')) document.getElementById('product-card').style.display = 'none';
  if (document.getElementById('added-success-card')) document.getElementById('added-success-card').style.display = 'none';
  const manualInp = document.getElementById('inp-manual-barcode');
  if (manualInp) manualInp.value = '';
  currentBarcode = '';
  openFullscreenCamera();
}

/**
 * ✏️ Son Eklenen Ürünü Yeniden Düzenlemeye Aç
 */
function editLastAddedProduct() {
  if (!lastAddedProduct) {
    showToast("Düzenlenecek son ürün bulunamadı.", "warning");
    return;
  }
  lookupBarcode(lastAddedProduct.barcode);
}

// Window Global Tanımlamaları
window.lookupBarcode = lookupBarcode;
window.addItemToQueue = addItemToQueue;
window.prepareForNextScan = prepareForNextScan;
window.editLastAddedProduct = editLastAddedProduct;
