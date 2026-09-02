/**
 * =========================================================================
 * ⚡ MOBIL HIZLI ÜRÜN: Yeni Ürün Tanımlama Modalı & Kayıt
 * =========================================================================
 */

function openMobileQuickProductModal(presetBarcode = '') {
  const modal = document.getElementById('modal-mobile-quick-product');
  if (!modal) return;

  const bcInp = document.getElementById('mob-quick-barcode') || document.getElementById('mob-qp-barcode');
  const titleInp = document.getElementById('mob-quick-title') || document.getElementById('mob-qp-title');
  const priceInp = document.getElementById('mob-quick-price') || document.getElementById('mob-qp-price');
  const buyInp = document.getElementById('mob-quick-buying-price') || document.getElementById('mob-qp-buying-price');
  const unitInp = document.getElementById('mob-quick-unit') || document.getElementById('mob-qp-unit');

  if (bcInp) bcInp.value = presetBarcode || '';
  if (titleInp) titleInp.value = '';
  if (priceInp) priceInp.value = '';
  if (buyInp) buyInp.value = '';
  if (unitInp) unitInp.value = 'Adet';

  modal.style.display = 'flex';
  setTimeout(() => {
    if (bcInp) bcInp.focus();
  }, 100);
}

function closeMobileQuickProductModal() {
  const modal = document.getElementById('modal-mobile-quick-product');
  if (modal) modal.style.display = 'none';
}

function generateRandomMobileBarcode() {
  const rnd = '869' + Math.floor(1000000000 + Math.random() * 9000000000);
  const bcInp = document.getElementById('mob-quick-barcode') || document.getElementById('mob-qp-barcode');
  if (bcInp) {
    bcInp.value = rnd;
    showToast('🎲 Rastgele barkod üretildi!', 'info');
  }
}

async function submitMobileQuickProduct(addToQueue = false) {
  const barcode = (document.getElementById('mob-quick-barcode')?.value || document.getElementById('mob-qp-barcode')?.value || '').trim();
  const title = (document.getElementById('mob-quick-title')?.value || document.getElementById('mob-qp-title')?.value || '').trim();
  const price = (document.getElementById('mob-quick-price')?.value || document.getElementById('mob-qp-price')?.value || '').trim();
  const buyingPrice = (document.getElementById('mob-quick-buying-price')?.value || document.getElementById('mob-qp-buying-price')?.value || '').trim();
  const unit = document.getElementById('mob-quick-unit')?.value || document.getElementById('mob-qp-unit')?.value || 'Adet';

  if (!barcode) {
    showToast('⚠️ Lütfen barkod girin veya okutun.', 'warning');
    return;
  }
  if (!title) {
    showToast('⚠️ Lütfen ürün adını girin.', 'warning');
    return;
  }
  if (!price) {
    showToast('⚠️ Lütfen satış fiyatı girin.', 'warning');
    return;
  }

  const payload = {
    barcode: barcode,
    title: title,
    price: price,
    buying_price: buyingPrice || '0.00',
    brand: 'DİĞER',
    stock: 0,
    unit: unit,
    source: 'MOBILE'
  };

  try {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.status === 'success') {
      showToast(`✅ ${title} kaydedildi!`, 'success');
      
      if (addToQueue) {
        mobileQueue.push({
          barcode: barcode,
          title: title,
          price: price.includes('TL') ? price : `${price} TL`,
          old_price: '',
          status: 'NEW',
          time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        });
        saveQueueToStorage();
        renderQueueList();
        showToast(`📋 ${title} basım listesine eklendi!`, 'info');
      }

      closeMobileQuickProductModal();
    } else {
      showToast(`❌ ${data.message}`, 'error');
    }
  } catch (e) {
    showToast('❌ Ürün kaydetme hatası.', 'error');
  }
}

// Window Global Tanımlamaları
window.openMobileQuickProductModal = openMobileQuickProductModal;
window.closeMobileQuickProductModal = closeMobileQuickProductModal;
window.generateRandomMobileBarcode = generateRandomMobileBarcode;
window.submitMobileQuickProduct = submitMobileQuickProduct;
