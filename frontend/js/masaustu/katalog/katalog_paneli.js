// ==========================================
// CATALOG PANELİ: Ürün Kataloğu & Toplu Baskı
// ==========================================

let allCatalogProducts = [];
let filteredCatalogProducts = [];
let selectedBarcodes = new Set();
let anchorIndex = -1;
let baseSelection = new Set();
let catalogRenderedCount = 100;
let catalogSearchQuery = "";
let catalogStatusFilter = "ALL";
let currentSortColumn = null;
let currentSortDirection = "asc";

function isLabelPriceUpToDate(p) {
  if (!p) return true;
  const sysVal = parsePrice(p.price);
  const labelVal = parsePrice(p.label_price || p.price);
  if (p.label_price !== undefined && p.label_price !== null && p.label_price !== "") {
    return Math.abs(sysVal - labelVal) < 0.01;
  }
  return true;
}


function setCatalogStatusFilter(filterType) {
  catalogStatusFilter = filterType;
  const pillAll = document.getElementById('pill-filter-all');
  const pillOutdated = document.getElementById('pill-filter-outdated');
  const pillMatched = document.getElementById('pill-filter-matched');

  if (pillAll) pillAll.classList.toggle('active', filterType === 'ALL');
  if (pillOutdated) pillOutdated.classList.toggle('active', filterType === 'OUTDATED');
  if (pillMatched) pillMatched.classList.toggle('active', filterType === 'MATCHED');

  onCatalogFilterChange();
}


function updateCatalogStatusCounts() {
  let total = allCatalogProducts.length;
  let outdated = 0;
  let matched = 0;

  allCatalogProducts.forEach(p => {
    if (isLabelPriceUpToDate(p)) {
      matched++;
    } else {
      outdated++;
    }
  });

  const cAll = document.getElementById('count-pill-all');
  const cOutdated = document.getElementById('count-pill-outdated');
  const cMatched = document.getElementById('count-pill-matched');

  if (cAll) cAll.innerText = total.toLocaleString('tr-TR');
  if (cOutdated) cOutdated.innerText = outdated.toLocaleString('tr-TR');
  if (cMatched) cMatched.innerText = matched.toLocaleString('tr-TR');
}


async function loadCatalog() {
  try {
    const res = await fetch(`${API_BASE}/api/products`);
    const data = await res.json();
    if (data.status === 'success' && data.products) {
      allCatalogProducts = data.products;
      populateBrandFilterOptions();
      setupCatalogScrollListener();
      updateCatalogStatusCounts();
      onCatalogFilterChange();
    }
  } catch(e) {
    console.warn("Katalog ürünleri yüklenirken hata:", e);
  }
}


let allSortedBrandsList = [];
let allBrandCounts = {};
let selectedCatalogBrand = 'ALL';

function populateBrandFilterOptions() {
  const brandCounts = {};
  allCatalogProducts.forEach(p => {
    const b = (p.brand && p.brand.trim()) || 'DİĞER';
    brandCounts[b] = (brandCounts[b] || 0) + 1;
  });

  allBrandCounts = brandCounts;
  allSortedBrandsList = Object.keys(brandCounts).sort((a, b) => {
    if (a === 'DİĞER') return 1;
    if (b === 'DİĞER') return -1;
    return a.localeCompare(b, 'tr', { sensitivity: 'base' });
  });

  const uniqueBrandCount = allSortedBrandsList.length;
  const labelEl = document.getElementById('selected-brand-label');
  
  if (selectedCatalogBrand === 'ALL') {
    if (labelEl) labelEl.innerText = `🏢 Tüm Firmalar (${uniqueBrandCount})`;
  } else {
    if (labelEl) labelEl.innerText = `🏢 ${selectedCatalogBrand} (${brandCounts[selectedCatalogBrand] || 0})`;
  }

  const hiddenInput = document.getElementById('catalog-brand-select');
  if (hiddenInput) hiddenInput.value = selectedCatalogBrand;

  renderBrandOptionsList('');
}

function buildBrandDropdownOptions() {
  populateBrandFilterOptions();
}

function toggleBrandDropdown() {
  const popup = document.getElementById('brand-dropdown-popup');
  if (!popup) return;
  const isVisible = popup.style.display !== 'none';
  
  if (!isVisible) {
    popup.style.display = 'block';
    const searchInp = document.getElementById('brand-search-input');
    if (searchInp) {
      searchInp.value = '';
      searchInp.focus();
    }
    renderBrandOptionsList('');
  } else {
    popup.style.display = 'none';
  }
}

function renderBrandOptionsList(query = '') {
  const listContainer = document.getElementById('brand-options-list');
  if (!listContainer) return;
  listContainer.innerHTML = '';

  const normQ = normalizeTurkish(query).trim();
  const totalBrands = allSortedBrandsList.length;

  // 1. "Tüm Firmalar" seçeneği
  if (!normQ || normQ === 'tum' || normQ === 'tumu' || normQ === 'all') {
    const allItem = document.createElement('div');
    allItem.className = `brand-option-item ${selectedCatalogBrand === 'ALL' ? 'selected' : ''}`;
    allItem.innerHTML = `
      <span>🏢 Tüm Firmalar</span>
      <span class="brand-option-count">${allCatalogProducts.length} Ürün</span>
    `;
    allItem.onclick = () => selectBrandFromDropdown('ALL');
    listContainer.appendChild(allItem);
  }

  // 2. Filtrelenen Markalar
  let matchCount = 0;
  allSortedBrandsList.forEach(brand => {
    const normBrand = normalizeTurkish(brand);
    if (!normQ || normBrand.includes(normQ)) {
      matchCount++;
      const item = document.createElement('div');
      const isSel = selectedCatalogBrand === brand;
      item.className = `brand-option-item ${isSel ? 'selected' : ''}`;
      item.innerHTML = `
        <span>${brand}</span>
        <span class="brand-option-count">${allBrandCounts[brand] || 0} Ürün</span>
      `;
      item.onclick = () => selectBrandFromDropdown(brand);
      listContainer.appendChild(item);
    }
  });

  if (matchCount === 0 && normQ) {
    listContainer.innerHTML = `
      <div style="padding: 12px; text-align: center; color: var(--text-muted); font-size: 11.5px;">
        🔍 "<strong>${query}</strong>" ile eşleşen firma bulunamadı.
      </div>
    `;
  }
}

function onBrandSearchInput(val) {
  renderBrandOptionsList(val || '');
}

function clearBrandSearch() {
  const searchInp = document.getElementById('brand-search-input');
  if (searchInp) {
    searchInp.value = '';
    searchInp.focus();
  }
  renderBrandOptionsList('');
}

function selectBrandFromDropdown(brand) {
  selectedCatalogBrand = brand;
  const hiddenInput = document.getElementById('catalog-brand-select');
  if (hiddenInput) hiddenInput.value = brand;

  const labelEl = document.getElementById('selected-brand-label');
  if (labelEl) {
    if (brand === 'ALL') {
      labelEl.innerText = `🏢 Tüm Firmalar (${allSortedBrandsList.length})`;
    } else {
      labelEl.innerText = `🏢 ${brand} (${allBrandCounts[brand] || 0} Ürün)`;
    }
  }

  const popup = document.getElementById('brand-dropdown-popup');
  if (popup) popup.style.display = 'none';

  onCatalogFilterChange();
}

// Menü dışına tıklandığında marka dropdown'ını kapat
document.addEventListener('click', (e) => {
  if (!e.target.closest('#brand-dropdown-wrapper')) {
    const popup = document.getElementById('brand-dropdown-popup');
    if (popup) popup.style.display = 'none';
  }
});



const SEARCH_CATEGORY_KEYWORDS = new Set([
  'sut', 'peynir', 'kasar', 'suzme', 'ayran', 'yogurt', 'tereyag', 'kaymak', 'labne', 'lor', 'krema',
  'cikolata', 'biskuvi', 'kek', 'gofret', 'kraker', 'cips', 'cay', 'kahve', 'seker', 'un', 'yag',
  'salca', 'makarna', 'pirinc', 'bulgur', 'su', 'soda', 'gazoz', 'kola', 'meyvesuyu', 'deterjan',
  'sabun', 'sampuan', 'ekmek', 'yumurta', 'tavuk', 'helva', 'recel', 'bal', 'findik', 'fistik', 'ceviz'
]);

function isTokenMatchingWord(targetWord, tok) {
  if (!targetWord || !tok) return false;
  if (targetWord === tok) return true;
  // 'sut' araması 'sutas' marka adıyla eşleşmemeli!
  if (tok === 'sut' && targetWord.startsWith('sutas')) return false;
  
  // 1. Önek eşleşmesi (örn: 'salg' -> 'salgam', 'doga' -> 'doganay', 'cay' -> 'caykur', 'yag' -> 'yagli')
  if (targetWord.startsWith(tok)) return true;
  
  // 2. İçerik eşleşmesi (3 harf veya daha uzunsa kelimenin içinde de geçebilir, örn: 'salgam' -> 'adanasalgami')
  if (tok.length >= 3 && targetWord.includes(tok)) return true;
  
  return false;
}

function checkProductMatchesSearch(p, searchTokens, normBarcode, normTitle, normBrand) {
  if (searchTokens.length === 0) return true;

  const titleWords = normTitle.split(/\s+/).filter(Boolean);
  const brandWords = normBrand.split(/\s+/).filter(Boolean);
  const allWords = [...titleWords, ...brandWords];

  // Her arama kelimesinin (token) hedef üründe bulunması gerekir
  for (let i = 0; i < searchTokens.length; i++) {
    const tok = searchTokens[i];
    if (normBarcode.includes(tok)) continue;

    let matched = false;
    for (let j = 0; j < allWords.length; j++) {
      if (isTokenMatchingWord(allWords[j], tok)) {
        matched = true;
        break;
      }
    }
    if (!matched) return false;
  }

  // 'süt' araması gibi durumlarda, eğer aranan kelime 'sut' ise ürünün başlığında süt kelimesi geçmeli
  if (searchTokens.includes('sut')) {
    const hasMilk = titleWords.some(w => isTokenMatchingWord(w, 'sut'));
    if (!hasMilk) return false;
  }

  return true;
}

function getProductRelevanceScore(p, normQuery, queryTokens) {
  const normTitle = normalizeTurkish(p.title || p.title1 || '');
  const normBarcode = normalizeTurkish(p.barcode || '');
  const normBrand = normalizeTurkish(p.brand || '');
  
  let score = 0;
  if (normBarcode === normQuery) score += 1000;
  else if (normBarcode.startsWith(normQuery)) score += 500;
  else if (normBarcode.includes(normQuery)) score += 300;

  if (normTitle === normQuery) score += 800;
  else if (normTitle.startsWith(normQuery)) score += 400;
  else if (normTitle.includes(normQuery)) score += 250;

  if (queryTokens.every(tok => normTitle.includes(tok))) {
    score += 150;
    if (queryTokens.length > 0 && normTitle.startsWith(queryTokens[0])) {
      score += 50;
    }
  }

  if (normBrand && queryTokens.some(tok => normBrand.includes(tok))) {
    score += 30;
  }

  score += Math.max(0, 40 - normTitle.length);
  return score;
}


function onCatalogFilterChange() {
  const rawSearch = document.getElementById('catalog-search-inp')?.value || '';
  const normSearch = normalizeTurkish(rawSearch).trim();
  const searchTokens = normSearch ? normSearch.split(/\s+/).filter(Boolean) : [];
  let selectedBrand = document.getElementById('catalog-brand-select')?.value || 'ALL';

  // Eğer kullanıcı arama kutusuna yazı yazıyorsa ve aktif bir firma filtresi varsa,
  // kullanıcının aradığı ürünleri engellememek için firma filtresini otomatik olarak 'ALL' yap
  if (searchTokens.length > 0 && selectedBrand !== 'ALL') {
    selectedCatalogBrand = 'ALL';
    selectedBrand = 'ALL';
    const brandInput = document.getElementById('catalog-brand-select');
    if (brandInput) brandInput.value = 'ALL';
    const brandLabel = document.getElementById('selected-brand-label');
    if (brandLabel) brandLabel.innerText = `🏢 Tüm Firmalar (${allSortedBrandsList.length || 0})`;
  }

  updateCatalogStatusCounts();

  // 1. Filtrele
  filteredCatalogProducts = allCatalogProducts.filter(p => {
    const matchesBrand = (selectedBrand === 'ALL') || (p.brand === selectedBrand);
    if (!matchesBrand) return false;

    // Etiket Durumu Filtresi (Tümü / Güncel Değil / Güncel)
    if (catalogStatusFilter === 'OUTDATED' && isLabelPriceUpToDate(p)) return false;
    if (catalogStatusFilter === 'MATCHED' && !isLabelPriceUpToDate(p)) return false;

    if (searchTokens.length === 0) return true;
    
    const normTitle = normalizeTurkish(p.title || p.title1 || '');
    const normBarcode = normalizeTurkish(p.barcode || '');
    const normBrand = normalizeTurkish(p.brand || '');
    
    return checkProductMatchesSearch(p, searchTokens, normBarcode, normTitle, normBrand);
  });

  // 2. Eğer sütun sıralaması aktifse sırala, değilse arama varsa alakalılık puanına göre sırala
  if (currentSortColumn) {
    applyColumnSorting();
  } else if (searchTokens.length > 0) {
    filteredCatalogProducts.sort((a, b) => {
      const scoreA = getProductRelevanceScore(a, normSearch, searchTokens);
      const scoreB = getProductRelevanceScore(b, normSearch, searchTokens);
      return scoreB - scoreA;
    });
  }

  // 3. Render sayacını sıfırla ve çiz
  catalogRenderedCount = 100;
  renderCatalogTable(true);
}


function sortCatalogColumn(columnKey) {
  if (currentSortColumn === columnKey) {
    currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    currentSortColumn = columnKey;
    currentSortDirection = 'asc';
  }

  updateSortIcons();
  applyColumnSorting();
  catalogRenderedCount = 100;
  renderCatalogTable(true);
}


function applyColumnSorting() {
  const dir = currentSortDirection === 'asc' ? 1 : -1;

  filteredCatalogProducts.sort((a, b) => {
    if (currentSortColumn === 'price') {
      return (parsePrice(a.price) - parsePrice(b.price)) * dir;
    } else if (currentSortColumn === 'label_price') {
      return (parsePrice(a.label_price || a.price) - parsePrice(b.label_price || b.price)) * dir;
    } else if (currentSortColumn === 'status') {
      const aUp = isLabelPriceUpToDate(a) ? 1 : 0;
      const bUp = isLabelPriceUpToDate(b) ? 1 : 0;
      return (aUp - bUp) * dir;
    } else if (currentSortColumn === 'barcode') {
      return (a.barcode || '').localeCompare(b.barcode || '') * dir;
    } else if (currentSortColumn === 'brand') {
      return (a.brand || '').localeCompare(b.brand || '', 'tr') * dir;
    } else if (currentSortColumn === 'title') {
      return (a.title || '').localeCompare(b.title || '', 'tr') * dir;
    } else if (currentSortColumn === 'stock') {
      const aStock = parseFloat(a.stock || 0);
      const bStock = parseFloat(b.stock || 0);
      return (aStock - bStock) * dir;
    } else if (currentSortColumn === 'buying_price') {
      const aBuy = parseFloat(String(a.buying_price || '0').replace(',', '.')) || 0;
      const bBuy = parseFloat(String(b.buying_price || '0').replace(',', '.')) || 0;
      return (aBuy - bBuy) * dir;
    } else if (currentSortColumn === 'profit_margin') {
      const aBuy = parseFloat(String(a.buying_price || '0').replace(',', '.')) || 0;
      const aSale = parsePrice(a.price || 0);
      const aMargin = aBuy > 0 ? ((aSale - aBuy) / aBuy) : -999;
      const bBuy = parseFloat(String(b.buying_price || '0').replace(',', '.')) || 0;
      const bSale = parsePrice(b.price || 0);
      const bMargin = bBuy > 0 ? ((bSale - bBuy) / bBuy) : -999;
      return (aMargin - bMargin) * dir;
    } else if (currentSortColumn === 'date') {
      return ((a.date || '19 Ağu 2026').localeCompare(b.date || '19 Ağu 2026', 'tr')) * dir;
    }
    return 0;
  });
}


function updateSortIcons() {
  ['brand', 'barcode', 'title', 'stock', 'buying_price', 'price', 'profit_margin', 'label_price', 'date', 'status'].forEach(col => {
    const iconEl = document.getElementById(`sort-ico-${col}`);
    if (iconEl) {
      if (currentSortColumn === col) {
        iconEl.innerText = currentSortDirection === 'asc' ? '▲' : '▼';
        iconEl.style.color = '#38bdf8';
        iconEl.style.opacity = '1';
      } else {
        iconEl.innerText = '↕';
        iconEl.style.color = '';
        iconEl.style.opacity = '0.5';
      }
    }
  });
}


function parsePrice(pStr) {
  if (!pStr) return 0;
  const clean = String(pStr).replace('TL', '').replace('tl', '').replace('₺', '').replace(',', '.').trim();
  return parseFloat(clean) || 0;
}


function setupCatalogScrollListener() {
  const container = document.getElementById('catalog-scroll-container');
  if (!container) return;

  container.addEventListener('scroll', () => {
    if (container.scrollTop + container.clientHeight >= container.scrollHeight - 150) {
      if (catalogRenderedCount < filteredCatalogProducts.length) {
        catalogRenderedCount += 100;
        renderCatalogTable(false);
      }
    }
  });
}

function formatCatalogDate(p) {
  let val = p.updated_at || p.last_printed_at || p.date || '';
  if (!val) {
    return '20 Ağu 2026';
  }
  // Eğer saat ve uzun metin varsa sadece gün-ay-yıl kısmını göster
  if (val.length > 12) {
    return val.split(' ')[0] + (val.split(' ')[1] ? ' ' + val.split(' ')[1] : '') + (val.split(' ')[2] ? ' ' + val.split(' ')[2] : '');
  }
  return val;
}


// Manuel Hızlı Düzenleme Modu Durumu: 'none' | 'price' | 'title' | 'brand'
let currentQuickAction = 'none';
let currentDetailProduct = null;
let batchPriceTargetProducts = [];

function resetCatalogFilters() {
  const searchInp = document.getElementById('catalog-search-inp');
  if (searchInp) searchInp.value = '';
  catalogSearchQuery = '';
  
  selectedCatalogBrand = 'ALL';
  const brandSelect = document.getElementById('catalog-brand-select');
  if (brandSelect) brandSelect.value = 'ALL';
  const labelEl = document.getElementById('selected-brand-label');
  if (labelEl) labelEl.innerText = `🏢 Tüm Firmalar (${allSortedBrandsList.length || 0})`;
  
  setCatalogStatusFilter('ALL');
  currentSortColumn = null;
  currentSortDirection = 'asc';
  
  onCatalogFilterChange();
}

function toggleQuickEditDropdown() {
  const menu = document.getElementById('quick-edit-menu');
  if (!menu) return;
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

function setQuickActionFilter(action) {
  currentQuickAction = action;
  const toggleBtn = document.getElementById('btn-quick-edit-mode');
  const exitBtn = document.getElementById('btn-quick-edit-exit');
  const menu = document.getElementById('quick-edit-menu');
  if (menu) menu.style.display = 'none';

  if (toggleBtn) {
    if (action === 'price') {
      toggleBtn.classList.add('active');
      toggleBtn.innerHTML = `💰 Hızlı Fiyat Modu <span style="font-size:10px;">▼</span>`;
      if (exitBtn) exitBtn.style.display = 'inline-flex';
    } else if (action === 'title') {
      toggleBtn.classList.add('active');
      toggleBtn.innerHTML = `✏️ Hızlı İsim Modu <span style="font-size:10px;">▼</span>`;
      if (exitBtn) exitBtn.style.display = 'inline-flex';
    } else if (action === 'brand') {
      toggleBtn.classList.add('active');
      toggleBtn.innerHTML = `🏷️ Hızlı Firma Modu <span style="font-size:10px;">▼</span>`;
      if (exitBtn) exitBtn.style.display = 'inline-flex';
    } else {
      toggleBtn.classList.remove('active');
      toggleBtn.innerHTML = `⚡ Manuel Düzenlemeler <span style="font-size:10px;">▼</span>`;
      if (exitBtn) exitBtn.style.display = 'none';
    }
  }
}

// Menü dışına tıklandığında dropdown'ı kapat
document.addEventListener('click', (e) => {
  if (!e.target.closest('.manual-edit-dropdown-wrapper')) {
    const menu = document.getElementById('quick-edit-menu');
    if (menu) menu.style.display = 'none';
  }
});

function handleCatalogRowClick(barcode, event) {
  // Buton veya input'a tıklandıysa modal açmayı durdur
  if (event && (event.target.closest('button') || event.target.tagName === 'BUTTON')) return;
  if (event && event.target.tagName === 'INPUT') return;

  const clickedIdx = filteredCatalogProducts.findIndex(p => p.barcode === barcode);

  // 1. Shift + Tık: Aralık Seçimi
  if (event && event.shiftKey && anchorIndex !== -1) {
    selectedBarcodes.clear();
    const start = Math.min(anchorIndex, clickedIdx);
    const end = Math.max(anchorIndex, clickedIdx);
    for (let i = start; i <= end; i++) {
      const item = filteredCatalogProducts[i];
      if (item && item.barcode) {
        selectedBarcodes.add(item.barcode);
      }
    }
    updateBatchActionBar();
    updateRowSelections();
    return;
  }

  // 2. Ctrl / Cmd + Tık: Tekli Seçimi Aç / Kapat
  if (event && (event.ctrlKey || event.metaKey)) {
    if (selectedBarcodes.has(barcode)) {
      selectedBarcodes.delete(barcode);
    } else {
      selectedBarcodes.add(barcode);
    }
    anchorIndex = clickedIdx;
    updateBatchActionBar();
    updateRowSelections();
    return;
  }

  // 3. Normal Tıklama: Ürün Detay & Düzenleme Modalını Aç!
  openCatalogProductDetailModal(barcode);
}

function onRowCheckboxChange(barcode, checked, event) {
  handleCatalogRowClick(barcode, event);
}

function handleCatalogSelectSquareClick(barcode, event) {
  if (event) event.stopPropagation();
  handleCatalogRowClick(barcode, { ctrlKey: true });
}


// ==========================================
// ÜRÜN DETAY & DÜZENLEME MODALI FONKSİYONLARI
// ==========================================

function updateDetailModalStatusUI(prod, currentInputPrice = null) {
  const labelPrice = prod.label_price || prod.price || '0,00 TL';
  const sysPrice = currentInputPrice !== null ? currentInputPrice : (prod.price || '');
  const isUpToDate = isLabelPriceUpToDate(prod) && (!currentInputPrice || parsePrice(currentInputPrice) === parsePrice(labelPrice));
  
  const labelValEl = document.getElementById('cat-detail-label-price-val');
  if (labelValEl) {
    labelValEl.innerText = labelPrice;
    labelValEl.style.color = isUpToDate ? '#34d399' : '#fbbf24';
  }

  const diffPill = document.getElementById('cat-detail-diff-pill');
  if (diffPill) {
    if (isUpToDate) {
      diffPill.innerHTML = '<span style="color:#34d399;">Fiyat Eşit ✓</span>';
    } else {
      diffPill.innerHTML = '<span style="color:#ef4444; background: rgba(239,68,68,0.15); padding: 2px 6px; border-radius: 4px;">Fark Var ⚠️</span>';
    }
  }

  const statusEl = document.getElementById('cat-detail-status-text');
  if (statusEl) {
    statusEl.innerHTML = isUpToDate 
      ? '<span style="color:#34d399;">✅ Güncel (Etiket Basılmış)</span>' 
      : '<span style="color:#fbbf24;">⚠️ Güncel Değil (Etiket Basılmadı - Yazdır Butonuna Basın)</span>';
  }
}

function onDetailPriceInputChange() {
  if (!currentDetailProduct) return;
  const rawPrice = document.getElementById('cat-detail-inp-price')?.value || '';
  updateDetailModalStatusUI(currentDetailProduct, rawPrice);
}

function openCatalogProductDetailModal(barcode) {
  const cleanBc = String(barcode || '').trim();
  const prod = allCatalogProducts.find(p => String(p.barcode || '').trim() === cleanBc);
  if (!prod) {
    console.warn("Ürün bulunamadı:", barcode);
    return;
  }
  currentDetailProduct = prod;

  const badgeEl = document.getElementById('cat-detail-barcode-badge');
  if (badgeEl) badgeEl.innerText = prod.barcode || '';
  
  const bcInp = document.getElementById('cat-detail-inp-barcode');
  if (bcInp) bcInp.value = prod.barcode || '';

  const customBcInp = document.getElementById('cat-detail-inp-custom-barcode');
  if (customBcInp) customBcInp.value = prod.custom_barcode || '';

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

  updateDetailModalStatusUI(prod);

  const modal = document.getElementById('modal-catalog-product-detail');
  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add('active');
  }
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
  const customBarcode = document.getElementById('cat-detail-inp-custom-barcode')?.value.trim();
  const title = document.getElementById('cat-detail-inp-title')?.value.trim().toUpperCase();
  const brand = document.getElementById('cat-detail-inp-brand')?.value.trim().toUpperCase() || 'DİĞER';
  const rawPrice = document.getElementById('cat-detail-inp-price')?.value.trim();
  const origin = document.getElementById('cat-detail-inp-origin')?.value.trim().toUpperCase() || 'TÜRKİYE';
  const stock = parseInt(document.getElementById('cat-detail-inp-stock')?.value || '0', 10) || 0;
  const kdv = parseInt(document.getElementById('cat-detail-inp-kdv')?.value || '10', 10);

  if (!barcode || !title || !rawPrice) {
    showToast("Lütfen tüm alanları eksiksiz doldurun.", "warning");
    return;
  }

  const price = rawPrice.includes('TL') ? rawPrice : `${rawPrice} TL`;

  try {
    const res = await fetch(`${API_BASE}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barcode: barcode,
        custom_barcode: customBarcode,
        title: title,
        brand: brand,
        price: price,
        origin: origin,
        stock: stock,
        kdv: kdv,
        vat_rate: kdv,
        source: 'PC'
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      currentDetailProduct.title = title;
      currentDetailProduct.title1 = title;
      currentDetailProduct.custom_barcode = customBarcode;
      currentDetailProduct.brand = brand;
      currentDetailProduct.price = price;
      currentDetailProduct.origin = origin;
      currentDetailProduct.stock = stock;
      currentDetailProduct.kdv = kdv;
      currentDetailProduct.vat_rate = kdv;
      // Dikkat: label_price (etiket fiyatı) manuel güncellemede DEĞİŞMEZ, sadece yazıcıdan basılınca değişir!

      const priceInp = document.getElementById('cat-detail-inp-price');
      if (priceInp) priceInp.value = price;
      
      updateDetailModalStatusUI(currentDetailProduct);

      buildBrandDropdownOptions();
      onCatalogFilterChange();
      showToast(`✓ Ürün sistem satış fiyatı güncellendi: ${price}`, "success");
    } else {
      showToast(`Hata: ${data.message}`, "error");
    }
  } catch (err) {
    showToast(`Bağlantı hatası: ${err.message}`, "error");
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

  const formattedPrice = cleanPrice.includes('TL') ? cleanPrice : `${cleanPrice} TL`;

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

  const badgeEl = document.getElementById('batch-price-selected-badge');
  if (badgeEl) badgeEl.innerText = `${batchPriceTargetProducts.length} Ürün Seçildi`;
  
  const countEl = document.getElementById('batch-price-count-info');
  if (countEl) countEl.innerText = `${batchPriceTargetProducts.length} Ürün`;

  const sumCountEl = document.getElementById('batch-summary-count');
  if (sumCountEl) sumCountEl.innerText = `${batchPriceTargetProducts.length} Ürün`;

  const sumPriceEl = document.getElementById('batch-summary-price');
  if (sumPriceEl) sumPriceEl.innerText = "-";
  
  const commonInp = document.getElementById('batch-common-price-inp');
  if (commonInp) commonInp.value = "";

  renderBatchPriceItemsList("");

  const modal = document.getElementById('modal-catalog-batch-price');
  if (modal) modal.style.display = 'flex';
}

function renderBatchPriceItemsList(newPriceStr = "") {
  const container = document.getElementById('batch-price-items-container');
  if (!container) return;
  container.innerHTML = "";

  batchPriceTargetProducts.forEach(p => {
    const row = document.createElement('div');
    row.className = 'batch-price-item-row';
    row.innerHTML = `
      <div class="batch-price-item-info">
        <div class="batch-price-item-title" title="${p.title}">${p.title}</div>
        <div class="batch-price-item-barcode">${p.barcode} | ${p.brand || 'DİĞER'}</div>
      </div>
      <div style="text-align: right;">
        <div class="batch-price-item-old-price">Eski: ${p.price || '-'}</div>
        ${newPriceStr ? `<div class="batch-price-item-new-price">➔ ${newPriceStr}</div>` : ''}
      </div>
    `;
    container.appendChild(row);
  });
}

function onBatchPriceCommonInput(val) {
  const cleanVal = (val || '').trim();
  const displayVal = cleanVal ? (cleanVal.includes('TL') ? cleanVal : `${cleanVal} TL`) : '-';
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
    return;
  }

  const formattedPrice = rawPrice.includes('TL') ? rawPrice : `${rawPrice} TL`;
  const barcodes = batchPriceTargetProducts.map(p => p.barcode);

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
      batchPriceTargetProducts.forEach(p => {
        p.price = formattedPrice;
      });
      onCatalogFilterChange();
      closeBatchPriceModal();
      showToast(`✓ ${data.message}`, "success");
    } else {
      showToast(`Hata: ${data.message}`, "error");
    }
  } catch (err) {
    showToast(`Bağlantı hatası: ${err.message}`, "error");
  }
}


// ==========================================
// TOPLU MARKA / FİRMA DEĞİŞTİRME FONKSİYONLARI
// ==========================================

function openBatchBrandModal() {
  if (selectedBarcodes.size === 0) {
    showToast("Lütfen önce tablodan ürün seçin.", "warning");
    return;
  }

  const badgeEl = document.getElementById('batch-brand-selected-badge');
  if (badgeEl) badgeEl.innerText = `${selectedBarcodes.size} Ürün Seçildi`;
  
  const inp = document.getElementById('batch-new-brand-inp');
  if (inp) inp.value = "";

  const modal = document.getElementById('modal-catalog-batch-brand');
  if (modal) modal.style.display = 'flex';
}

function closeBatchBrandModal() {
  const modal = document.getElementById('modal-catalog-batch-brand');
  if (modal) modal.style.display = 'none';
}

async function submitBatchBrandUpdate() {
  const newBrand = document.getElementById('batch-new-brand-inp')?.value.trim().toUpperCase();
  if (!newBrand) {
    showToast("Lütfen yeni bir marka / firma adı girin.", "warning");
    return;
  }

  const barcodes = Array.from(selectedBarcodes);
  try {
    const res = await fetch(`${API_BASE}/api/catalog/batch-brand-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barcodes: barcodes,
        brand: newBrand
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      allCatalogProducts.forEach(p => {
        if (selectedBarcodes.has(p.barcode)) {
          p.brand = newBrand;
        }
      });
      buildBrandDropdownOptions();
      onCatalogFilterChange();
      closeBatchBrandModal();
      showToast(`✓ ${data.message}`, "success");
    } else {
      showToast(`Hata: ${data.message}`, "error");
    }
  } catch (err) {
    showToast(`Bağlantı hatası: ${err.message}`, "error");
  }
}



function toggleSelectAllCatalog(checked) {
  if (checked) {
    filteredCatalogProducts.forEach(p => {
      if (p.barcode) selectedBarcodes.add(p.barcode);
    });
    baseSelection = new Set(selectedBarcodes);
  } else {
    selectedBarcodes.clear();
    baseSelection.clear();
  }
  anchorIndex = -1;
  updateBatchActionBar();
  updateRowSelections();
}


function clearCatalogSelection() {
  selectedBarcodes.clear();
  baseSelection.clear();
  anchorIndex = -1;
  const selectAllChk = document.getElementById('catalog-select-all-chk');
  if (selectAllChk) {
    selectAllChk.checked = false;
    selectAllChk.indeterminate = false;
  }
  updateBatchActionBar();
  updateRowSelections();
}


function updateBatchActionBar() {
  const bar = document.getElementById('catalog-batch-bar');
  const countEl = document.getElementById('batch-selected-count');
  const btnPrint = document.getElementById('btn-batch-print');
  const selectAllChk = document.getElementById('catalog-select-all-chk');

  const count = selectedBarcodes.size;

  if (bar) {
    if (count > 0) {
      bar.style.display = 'flex';
      if (countEl) countEl.innerText = `${count} ürün seçildi`;
      if (btnPrint) btnPrint.innerText = `🖨️ Seçili ${count} Ürünü Toplu Yazdır`;
    } else {
      bar.style.display = 'none';
    }
  }

  const selectAllBox = document.getElementById('catalog-select-all-box');
  if (selectAllBox) {
    if (filteredCatalogProducts.length > 0 && count >= filteredCatalogProducts.length) {
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


function toggleSelectAllCatalogCustom(event) {
  if (event) event.stopPropagation();
  const allSelected = (filteredCatalogProducts.length > 0 && selectedBarcodes.size >= filteredCatalogProducts.length);
  toggleSelectAllCatalog(!allSelected);
}


function updateRowSelections() {
  const tbody = document.getElementById('catalog-tbody');
  if (!tbody) return;

  const rows = tbody.querySelectorAll('tr[data-barcode]');
  rows.forEach(tr => {
    const barcode = tr.getAttribute('data-barcode');
    const box = tr.querySelector('.custom-select-square');
    const isSelected = selectedBarcodes.has(barcode);

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


function renderCatalogTable(reset = true) {
  const tbody = document.getElementById('catalog-tbody');
  const statsBadge = document.getElementById('catalog-stats-badge');
  const pageInfo = document.getElementById('catalog-page-info');

  if (!tbody) return;

  const total = filteredCatalogProducts.length;
  if (statsBadge) statsBadge.innerText = `${total.toLocaleString('tr-TR')} Ürün`;

  const itemsToRender = filteredCatalogProducts.slice(0, catalogRenderedCount);

  if (pageInfo) {
    pageInfo.innerText = total > 0 
      ? `Toplam ${total.toLocaleString('tr-TR')} ürün listeleniyor (İlk ${itemsToRender.length.toLocaleString('tr-TR')} gösteriliyor - kaydırarak devam edin)`
      : `Eşleşen ürün bulunamadı.`;
  }

  if (reset) {
    tbody.innerHTML = '';
  }

  if (itemsToRender.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align: center; padding: 40px; color: var(--text-muted);">
          🔍 Aradığınız kriterlere uygun ürün bulunamadı.
        </td>
      </tr>
    `;
    return;
  }

  const startIdx = reset ? 0 : tbody.children.length;
  const newChunk = itemsToRender.slice(startIdx);

  const fragment = document.createDocumentFragment();
  newChunk.forEach(p => {
    const tr = document.createElement('tr');
    const isSelected = selectedBarcodes.has(p.barcode);
    if (isSelected) tr.className = 'selected-row';
    tr.setAttribute('data-barcode', p.barcode);
    tr.onclick = (e) => handleCatalogRowClick(p.barcode, e);

    const displayDate = formatCatalogDate(p);
    const isUpToDate = isLabelPriceUpToDate(p);
    const labelPriceText = p.label_price || p.price;
    const labelPriceBadge = isUpToDate
      ? `<span class="badge-label-price matched">${labelPriceText}</span>`
      : `<span class="badge-label-price outdated" title="Basılan Raf Etiketi Fiyatı: ${labelPriceText}">${labelPriceText}</span>`;

    const statusBadge = isUpToDate
      ? `<span class="badge-label-status matched">✅ Güncel</span>`
      : `<button class="btn-label-status outdated" onclick="event.stopPropagation(); syncSingleProductLabelAndPrint('${p.barcode}')" title="Fiyat güncellendi ama etiket basılmadı! Tıklayarak etiketi basın ve güncelleyin">⚠️ Güncel Değil</button>`;

    // Geliş Fiyatı & Kâr Marjı Hesabı
    const buyingNum = parseFloat(String(p.buying_price || '0').replace(',', '.')) || 0;
    const saleNum = parseFloat(String(p.price || '0').replace(',', '.')) || 0;
    let marginText = '-';
    let marginColor = '#64748b';
    if (buyingNum > 0 && saleNum > 0) {
      const marginVal = (((saleNum - buyingNum) / buyingNum) * 100).toFixed(1);
      marginText = `%${marginVal}`;
      marginColor = marginVal >= 25 ? '#10b981' : marginVal > 0 ? '#f59e0b' : '#ef4444';
    }

    const stockVal = p.stock !== undefined ? p.stock : 0;
    const stockNum = parseInt(stockVal, 10) || 0;
    const stockColor = stockNum > 0 ? '#38bdf8' : '#64748b';
    const buyingPriceDisp = buyingNum > 0 ? (p.buying_price + ' TL') : '-';

    tr.innerHTML = `
      <td><span class="badge-brand" style="max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block; font-size: 10.5px; padding: 2px 6px;">${p.brand || 'DİĞER'}</span></td>
      <td><span class="barcode-text" style="font-size: 11px;">${p.barcode || ''}</span></td>
      <td style="font-weight: 700; color: #f8fafc; font-size: 11.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="Detayı Görüntüle ve Düzenle: ${p.title}"><span style="border-bottom: 1px dashed rgba(56,189,248,0.4);">${p.title}</span></td>
      <td style="text-align: center; font-weight: 800; font-family: monospace; font-size: 11.5px; color: ${stockColor};">${stockNum}</td>
      <td style="text-align: right; color: #94a3b8; font-weight: 600; font-family: monospace; font-size: 11px;">${buyingPriceDisp}</td>
      <td style="text-align: right;"><span class="price-text" style="font-size: 12.5px;">${p.price}</span></td>
      <td style="text-align: center;"><span style="color: ${marginColor}; font-weight: 800; font-size: 10.5px; background: rgba(255,255,255,0.06); padding: 1px 5px; border-radius: 4px;">${marginText}</span></td>
      <td style="text-align: right;">${labelPriceBadge}</td>
      <td style="text-align: center;"><span class="date-text" style="font-size: 11px;">${displayDate}</span></td>
      <td style="text-align: center;">${statusBadge}</td>
    `;
    fragment.appendChild(tr);
  });

  tbody.appendChild(fragment);
  updateBatchActionBar();
}


async function syncSingleProductLabelAndPrint(barcode) {
  const product = allCatalogProducts.find(p => p.barcode === barcode);
  if (!product) return;

  try {
    const res = await fetch(`${API_BASE}/api/catalog/sync-label-price`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode: barcode })
    });
    const data = await res.json();
    if (data.status === 'success') {
      product.label_price = product.price;
      onCatalogFilterChange();
      showToast(`✓ '${product.title}' etiket fiyatı güncellendi. Tasarımcıya alınıyor...`, "success");
      printProductFromCatalog(barcode);
    } else {
      showToast(`Hata: ${data.message}`, "error");
    }
  } catch (e) {
    showToast(`Bağlantı hatası: ${e.message}`, "error");
  }
}

async function printProductFromCatalog(barcode) {
  const product = allCatalogProducts.find(p => p.barcode === barcode);
  if (!product) return;

  if (typeof showToast === 'function') {
    showToast(`🖨️ "${product.title}" için 1 adet etiket basılıyor...`, 'info');
  }

  try {
    const res = await fetch(`${API_BASE}/api/print/custom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barcode: product.barcode,
        title: product.title,
        title1: product.title1 || product.title,
        title2: product.title2 || '',
        price: product.price,
        brand: product.brand || '',
        origin: product.origin || 'TÜRKİYE',
        copies: 1
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      if (typeof showToast === 'function') {
        showToast(`✅ "${product.title}" etiketi başarıyla yazdırıldı.`, 'success');
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


async function submitBatchPrint() {
  const count = selectedBarcodes.size;
  if (count === 0) {
    showToast("Lütfen önce tablodan yazdırılacak ürünleri seçin.", "warning");
    return;
  }

  const selectedProducts = allCatalogProducts.filter(p => selectedBarcodes.has(p.barcode));
  if (selectedProducts.length === 0) {
    showToast("Seçilen ürünler bulunamadı.", "error");
    return;
  }

  const copies = parseInt(document.getElementById('batch-copies-inp')?.value || '1') || 1;
  const btnPrint = document.getElementById('btn-batch-print');
  const origText = btnPrint ? btnPrint.innerText : '';

  if (btnPrint) {
    btnPrint.disabled = true;
    btnPrint.innerText = `⏳ Yazdırılıyor (${count} Ürün)...`;
  }

  try {
    const activeTpl = templatesList.find(t => t.id === activeTemplateId) || templatesList[0] || {};
    const payload = {
      products: selectedProducts,
      printer: selectedPrinter,
      orientation: "POR",
      width_mm: currentWidth,
      height_mm: currentHeight,
      x_offset: parseInt(document.getElementById('settings-x-offset')?.value || 0),
      y_offset: parseInt(document.getElementById('settings-y-offset')?.value || 0),
      dpi: 203,
      copies_per_item: copies,
      template: activeTpl
    };

    const res = await fetch(`${API_BASE}/api/print/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (result.status === 'success') {
      selectedProducts.forEach(p => {
        p.label_price = p.price;
      });
      onCatalogFilterChange();
      showToast(`✓ ${result.message}`, "success");
      clearCatalogSelection();
    } else {
      showToast(`❌ ${result.message}`, "error");
    }
  } catch (err) {
    showToast(`❌ Bağlantı hatası: ${err.message}`, "error");
  } finally {
    if (btnPrint) {
      btnPrint.disabled = false;
      btnPrint.innerText = origText;
    }
  }
}

// =========================================================
// 8. ÖZEL BARKOD YÖNETİMİ (MAKSİMUM 6 ADET)
// =========================================================
let cachedCustomBarcodes = [];

async function loadCustomBarcodes() {
  try {
    const res = await fetch(`${API_BASE}/api/custom_barcodes`);
    const data = await res.json();
    if (data.status === 'success') {
      cachedCustomBarcodes = data.custom_barcodes || [];
    }
  } catch (e) {
    console.error('Özel barkodlar yüklenemedi:', e);
  }
}

async function openCustomBarcodesManageModal() {
  const modal = document.getElementById('modal-custom-barcodes-manage');
  if (!modal) return;

  await loadCustomBarcodes();
  renderCustomBarcodesManageList();

  modal.classList.add('active');
  modal.style.display = 'flex';
}

function closeCustomBarcodesManageModal() {
  const modal = document.getElementById('modal-custom-barcodes-manage');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
}

function renderCustomBarcodesManageList() {
  const listContainer = document.getElementById('custom-barcodes-manage-list');
  const countBadge = document.getElementById('custom-barcodes-count-badge');
  const addFormBox = document.getElementById('custom-barcodes-add-form');
  if (!listContainer) return;

  const count = cachedCustomBarcodes.length;
  if (countBadge) {
    countBadge.innerText = `${count} / 6 Dolu`;
    countBadge.style.color = count >= 6 ? '#f87171' : '#38bdf8';
  }

  if (addFormBox) {
    addFormBox.style.display = count >= 6 ? 'none' : 'block';
  }

  if (count === 0) {
    listContainer.innerHTML = '<div style="text-align: center; color: #64748b; padding: 16px;">Henüz tanımlı özel barkod yok. Aşağıdan yeni bir tane ekleyebilirsiniz.</div>';
    return;
  }

  listContainer.innerHTML = cachedCustomBarcodes.map((item, idx) => `
    <div style="background: #0f172a; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
      <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
        <span style="background: rgba(99,102,241,0.2); color: #818cf8; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 6px;">#${idx + 1}</span>
        <div style="flex: 1;">
          <input type="text" id="cb-name-${item.id}" value="${item.name || ''}" placeholder="Barkod Adı (Örn: REYON-A)" style="width: 100%; padding: 6px 8px; background: #070d1e; border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; color: #f8fafc; font-weight: 700; font-size: 12.5px; box-sizing: border-box; margin-bottom: 4px;">
          <input type="text" id="cb-code-${item.id}" value="${item.code || ''}" placeholder="Barkod Kodu (Örn: OZEL01)" style="width: 100%; padding: 6px 8px; background: #070d1e; border: 1px solid rgba(99,102,241,0.3); border-radius: 6px; color: #38bdf8; font-family: monospace; font-weight: 800; font-size: 12px; box-sizing: border-box;">
        </div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <button type="button" onclick="saveCustomBarcodeRow('${item.id}')" style="padding: 6px 12px; font-size: 11.5px; font-weight: 800; background: linear-gradient(135deg, #10b981, #059669); color: #ffffff; border: none; border-radius: 6px; cursor: pointer;" title="Değişiklikleri Kaydet">
          💾 Kaydet
        </button>
        <button type="button" onclick="deleteCustomBarcodeItem('${item.id}')" style="padding: 6px 12px; font-size: 11.5px; font-weight: 800; background: rgba(239,68,68,0.15); color: #f87171; border: 1px solid rgba(239,68,68,0.3); border-radius: 6px; cursor: pointer;" title="Sil">
          🗑️ Sil
        </button>
      </div>
    </div>
  `).join('');
}

async function saveCustomBarcodeRow(id) {
  const nameInp = document.getElementById(`cb-name-${id}`);
  const codeInp = document.getElementById(`cb-code-${id}`);
  if (!nameInp || !codeInp) return;

  const name = nameInp.value.trim();
  const code = codeInp.value.trim();
  if (!name || !code) {
    if (typeof showToast === 'function') showToast('Özel barkod adı ve kodu boş olamaz.', 'warning');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/custom_barcodes/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name, code })
    });
    const data = await res.json();
    if (data.status === 'success') {
      if (typeof showToast === 'function') showToast(data.message, 'success');
      cachedCustomBarcodes = data.custom_barcodes || [];
      renderCustomBarcodesManageList();
    } else {
      if (typeof showToast === 'function') showToast(data.message || 'Kayıt hatası.', 'error');
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('Kayıt başarısız.', 'error');
  }
}

async function submitAddNewCustomBarcode() {
  const nameInp = document.getElementById('new-cb-name');
  const codeInp = document.getElementById('new-cb-code');
  if (!nameInp || !codeInp) return;

  const name = nameInp.value.trim();
  const code = codeInp.value.trim();
  if (!name || !code) {
    if (typeof showToast === 'function') showToast('Lütfen yeni özel barkod adı ve kodunu girin.', 'warning');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/custom_barcodes/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, code })
    });
    const data = await res.json();
    if (data.status === 'success') {
      if (typeof showToast === 'function') showToast(data.message, 'success');
      nameInp.value = '';
      codeInp.value = '';
      cachedCustomBarcodes = data.custom_barcodes || [];
      renderCustomBarcodesManageList();
    } else {
      if (typeof showToast === 'function') showToast(data.message || 'Kayıt hatası.', 'error');
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('Ekleme başarısız.', 'error');
  }
}

async function deleteCustomBarcodeItem(id) {
  if (!confirm('Bu özel barkodu silmek istediğinize emin misiniz?')) return;

  try {
    const res = await fetch(`${API_BASE}/api/custom_barcodes/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    const data = await res.json();
    if (data.status === 'success') {
      if (typeof showToast === 'function') showToast(data.message, 'info');
      cachedCustomBarcodes = data.custom_barcodes || [];
      renderCustomBarcodesManageList();
    } else {
      if (typeof showToast === 'function') showToast(data.message || 'Silme hatası.', 'error');
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('Silme başarısız.', 'error');
  }
}

async function toggleCustomBarcodeDropdown(targetInputId) {
  const dropdown = document.getElementById(`custom-barcode-dropdown-${targetInputId}`);
  if (!dropdown) return;

  if (dropdown.style.display === 'block') {
    dropdown.style.display = 'none';
    return;
  }

  // Özel barkodları tazele
  await loadCustomBarcodes();

  if (cachedCustomBarcodes.length === 0) {
    dropdown.innerHTML = `
      <div style="padding: 10px; text-align: center; font-size: 11.5px; color: #94a3b8;">
        Tanımlı özel barkod bulunamadı.<br>
        <button type="button" onclick="openCustomBarcodesManageModal()" style="margin-top: 6px; padding: 4px 10px; font-size: 11px; background: #6366f1; color: #fff; border: none; border-radius: 4px; cursor: pointer;">➕ Yeni Oluştur (Maks 6)</button>
      </div>
    `;
  } else {
    dropdown.innerHTML = `
      <div style="padding: 4px; display: flex; flex-direction: column; gap: 4px;">
        <div style="font-size: 10px; font-weight: 800; color: #94a3b8; padding: 2px 4px; text-transform: uppercase;">🏷️ Tanımlı Özel Kodlar:</div>
        ${cachedCustomBarcodes.map(cb => `
          <button type="button" onclick="selectCustomBarcodeForTarget('${targetInputId}', '${cb.code}')" style="display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; background: #1e293b; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #f8fafc; font-size: 12px; cursor: pointer; text-align: left; width: 100%;">
            <strong style="color: #cbd5e1;">${cb.name}</strong>
            <span style="color: #38bdf8; font-family: monospace; font-weight: 800;">${cb.code}</span>
          </button>
        `).join('')}
        <div style="border-top: 1px solid rgba(255,255,255,0.08); margin-top: 4px; padding-top: 4px;">
          <button type="button" onclick="openCustomBarcodesManageModal()" style="padding: 5px 8px; font-size: 11px; font-weight: 700; background: transparent; color: #818cf8; border: 1px dashed rgba(99,102,241,0.4); border-radius: 6px; cursor: pointer; width: 100%; text-align: center;">
            ⚙️ Özel Barkodları Yönet / Düzenle (Maks 6)
          </button>
        </div>
      </div>
    `;
  }

  dropdown.style.display = 'block';

  // Dışarı tıklanınca kapat
  function onDocClick(e) {
    if (!dropdown.contains(e.target) && !e.target.closest(`[onclick*="toggleCustomBarcodeDropdown('${targetInputId}')"]`)) {
      dropdown.style.display = 'none';
      document.removeEventListener('click', onDocClick);
    }
  }
  setTimeout(() => document.addEventListener('click', onDocClick), 50);
}

function selectCustomBarcodeForTarget(targetInputId, code) {
  const inp = document.getElementById(targetInputId);
  const dropdown = document.getElementById(`custom-barcode-dropdown-${targetInputId}`);
  if (dropdown) dropdown.style.display = 'none';

  if (inp) {
    inp.value = code;
    inp.dispatchEvent(new Event('input'));
    inp.focus();
  }
  if (typeof showToast === 'function') {
    showToast(`🏷️ Özel barkod uygulandı: ${code}`, 'success');
  }
}

// Global Window Dışa Aktarımları
window.resetCatalogFilters = resetCatalogFilters;
window.toggleQuickEditDropdown = toggleQuickEditDropdown;
window.setQuickActionFilter = setQuickActionFilter;
window.openCatalogProductDetailModal = openCatalogProductDetailModal;
window.closeCatalogProductDetailModal = closeCatalogProductDetailModal;
window.copyDetailBarcode = copyDetailBarcode;
window.printFromDetailModal = printFromDetailModal;
window.submitCatalogProductDetail = submitCatalogProductDetail;
window.openQuickPriceEdit = openQuickPriceEdit;
window.openQuickTitleEdit = openQuickTitleEdit;
window.openQuickBrandEdit = openQuickBrandEdit;
window.openBatchPriceModal = openBatchPriceModal;
window.closeBatchPriceModal = closeBatchPriceModal;
window.onBatchPriceCommonInput = onBatchPriceCommonInput;
window.applyCommonPriceToPreview = applyCommonPriceToPreview;
window.submitBatchPriceUpdate = submitBatchPriceUpdate;
window.openBatchBrandModal = openBatchBrandModal;
window.closeBatchBrandModal = closeBatchBrandModal;
window.submitBatchBrandUpdate = submitBatchBrandUpdate;
window.handleCatalogRowClick = handleCatalogRowClick;
window.onRowCheckboxChange = onRowCheckboxChange;
window.handleCatalogSelectSquareClick = handleCatalogSelectSquareClick;
window.toggleSelectAllCatalog = toggleSelectAllCatalog;
window.sortCatalog = sortCatalogColumn;
window.sortCatalogColumn = sortCatalogColumn;
window.toggleBrandDropdown = toggleBrandDropdown;
window.onBrandSearchInput = onBrandSearchInput;
window.clearBrandSearch = clearBrandSearch;
window.selectBrandFromDropdown = selectBrandFromDropdown;
window.onCatalogFilterChange = onCatalogFilterChange;
window.syncSingleProductLabelAndPrint = syncSingleProductLabelAndPrint;
window.printProductFromCatalog = printProductFromCatalog;
window.submitBatchPrint = submitBatchPrint;

// ==========================================
// ÜRÜN GEÇMİŞ FAALİYETLERİ & İŞLEM GÜNLÜĞÜ (TIMELINE)
// ==========================================

let currentActivityBarcode = null;
let currentActivitiesList = [];
let currentActivityFilter = 'all';

function openDetailProductActivityHistory() {
  if (currentDetailProduct && currentDetailProduct.barcode) {
    openProductActivityHistory(currentDetailProduct.barcode);
  } else {
    showToast("Ürün bilgisi bulunamadı.", "warning");
  }
}

async function openProductActivityHistory(barcode) {
  const cleanBc = String(barcode || '').trim();
  const prod = allCatalogProducts.find(p => String(p.barcode || '').trim() === cleanBc);
  currentActivityBarcode = cleanBc;

  const modal = document.getElementById('modal-product-activity-history');
  if (!modal) return;

  // Başlık ve Ürün Özet Bilgileri
  const titleEl = document.getElementById('act-history-product-title');
  if (titleEl) titleEl.innerText = prod ? (prod.title || prod.title1 || cleanBc) : cleanBc;

  const bcEl = document.getElementById('act-history-barcode');
  if (bcEl) bcEl.innerText = cleanBc;

  const priceEl = document.getElementById('act-history-price');
  if (priceEl) priceEl.innerText = prod ? (prod.price || '-') : '-';

  const labelEl = document.getElementById('act-history-label-price');
  if (labelEl) labelEl.innerText = prod ? (prod.label_price || '-') : '-';

  const stockEl = document.getElementById('act-history-stock');
  if (stockEl) stockEl.innerText = prod ? (prod.stock !== undefined ? prod.stock : '0') : '0';

  modal.style.display = 'flex';
  modal.classList.add('active');

  // Aktivite kayıtlarını yükle
  await loadProductActivities(cleanBc);
}

function closeProductActivityHistoryModal() {
  const modal = document.getElementById('modal-product-activity-history');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('active');
  }
  currentActivityBarcode = null;
}

async function loadProductActivities(barcode) {
  const container = document.getElementById('act-history-timeline-container');
  if (!container) return;

  container.innerHTML = '<div style="text-align:center; padding: 30px; color: #94a3b8;"><span style="font-size:24px; animation: spin 1s infinite linear; display:inline-block;">🔄</span><p style="margin-top:8px;">Faaliyet geçmişi yükleniyor...</p></div>';

  try {
    const res = await fetch(`${API_BASE}/api/products/${encodeURIComponent(barcode)}/activities`);
    const data = await res.json();
    if (data.status === 'success') {
      currentActivitiesList = data.activities || [];
      updateActivityFilterCounts();
      renderActivityTimeline();
    } else {
      container.innerHTML = `<div style="text-align:center; padding: 20px; color: #f87171;">Hata: ${data.message}</div>`;
    }
  } catch (err) {
    container.innerHTML = `<div style="text-align:center; padding: 20px; color: #f87171;">Bağlantı hatası: ${err.message}</div>`;
  }
}

function updateActivityFilterCounts() {
  const counts = { all: currentActivitiesList.length, print: 0, price: 0, sale: 0, stock: 0 };
  currentActivitiesList.forEach(a => {
    if (a.type === 'print') counts.print++;
    else if (a.type === 'price') counts.price++;
    else if (a.type === 'sale') counts.sale++;
    else counts.stock++;
  });

  const cAll = document.getElementById('act-count-all');
  if (cAll) cAll.innerText = counts.all;
  const cPrint = document.getElementById('act-count-print');
  if (cPrint) cPrint.innerText = counts.print;
  const cPrice = document.getElementById('act-count-price');
  if (cPrice) cPrice.innerText = counts.price;
  const cSale = document.getElementById('act-count-sale');
  if (cSale) cSale.innerText = counts.sale;
  const cStock = document.getElementById('act-count-stock');
  if (cStock) cStock.innerText = counts.stock;
}

function filterActivityTimeline(type) {
  currentActivityFilter = type;
  document.querySelectorAll('#modal-product-activity-history .btn-status-pill').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`act-tab-${type}`);
  if (activeBtn) activeBtn.classList.add('active');
  renderActivityTimeline();
}

function renderActivityTimeline() {
  const container = document.getElementById('act-history-timeline-container');
  if (!container) return;

  const filtered = currentActivityFilter === 'all' 
    ? currentActivitiesList 
    : currentActivitiesList.filter(a => {
        if (currentActivityFilter === 'print') return a.type === 'print';
        if (currentActivityFilter === 'price') return a.type === 'price';
        if (currentActivityFilter === 'sale') return a.type === 'sale';
        return a.type !== 'print' && a.type !== 'price' && a.type !== 'sale';
      });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: #64748b;">
        <span style="font-size: 32px; display: block; margin-bottom: 8px;">📭</span>
        <p style="margin: 0; font-weight: 700; font-size: 13px; color: #94a3b8;">Henüz kayıtlı faaliyet bulunamadı.</p>
        <small style="color: #64748b; font-size: 11px;">Etiket basımları, fiyat değişimleri ve kasa satışları otomatik olarak burada listelenir.</small>
      </div>
    `;
    return;
  }

  const iconMap = {
    print: { icon: '🖨️', color: '#38bdf8', bg: 'rgba(56,189,248,0.15)', border: 'rgba(56,189,248,0.3)', badge: 'ETİKET BASIMI' },
    price: { icon: '💰', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.3)', badge: 'FİYAT DEĞİŞİMİ' },
    sale: { icon: '🛒', color: '#34d399', bg: 'rgba(52,211,153,0.15)', border: 'rgba(52,211,153,0.3)', badge: 'KASA SATIŞI' },
    stock: { icon: '📦', color: '#a855f7', bg: 'rgba(168,85,247,0.15)', border: 'rgba(168,85,247,0.3)', badge: 'STOK HAREKETİ' },
    info: { icon: 'ℹ️', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)', border: 'rgba(148,163,184,0.3)', badge: 'İŞLEM GÜNLÜĞÜ' }
  };

  let html = '';
  filtered.forEach(item => {
    const style = iconMap[item.type] || iconMap.info;
    html += `
      <div style="background: #111827; border: 1px solid ${style.border}; border-left: 4px solid ${style.color}; border-radius: 8px; padding: 10px 14px; display: flex; flex-direction: column; gap: 4px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 15px;">${style.icon}</span>
            <strong style="color: #f8fafc; font-size: 12.5px;">${item.title || 'Faaliyet'}</strong>
            <span style="background: ${style.bg}; color: ${style.color}; font-size: 9.5px; font-weight: 800; padding: 2px 6px; border-radius: 4px; border: 1px solid ${style.border};">${style.badge}</span>
          </div>
          <span style="color: #64748b; font-size: 11px; font-family: monospace; font-weight: 600;">${item.timestamp || '-'}</span>
        </div>
        ${item.details ? `<div style="color: #cbd5e1; font-size: 11.5px; margin-top: 2px; padding-left: 24px;">${item.details}</div>` : ''}
        ${item.actor ? `<div style="color: #64748b; font-size: 10.5px; padding-left: 24px; margin-top: 2px;">İşlem Yapan: <strong style="color: #94a3b8;">${item.actor}</strong></div>` : ''}
      </div>
    `;
  });

  container.innerHTML = html;
}

async function submitProductManualActivityNote() {
  if (!currentActivityBarcode) return;
  const noteInp = document.getElementById('act-history-new-note');
  const note = noteInp ? noteInp.value.trim() : '';
  if (!note) {
    showToast("Lütfen bir not metni girin.", "warning");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/products/${encodeURIComponent(currentActivityBarcode)}/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'info',
        title: 'Özel Kullanıcı Notu',
        details: note,
        actor: 'Yönetici'
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      noteInp.value = '';
      showToast("✓ Not faaliyete eklendi.", "success");
      await loadProductActivities(currentActivityBarcode);
    }
  } catch (err) {
    showToast("Not kaydedilemedi: " + err.message, "error");
  }
}

window.openProductActivityHistory = openProductActivityHistory;
window.openDetailProductActivityHistory = openDetailProductActivityHistory;
window.closeProductActivityHistoryModal = closeProductActivityHistoryModal;
window.filterActivityTimeline = filterActivityTimeline;
window.submitProductManualActivityNote = submitProductManualActivityNote;
window.loadProductActivities = loadProductActivities;

window.loadCustomBarcodes = loadCustomBarcodes;
window.openCustomBarcodesManageModal = openCustomBarcodesManageModal;
window.closeCustomBarcodesManageModal = closeCustomBarcodesManageModal;
window.renderCustomBarcodesManageList = renderCustomBarcodesManageList;
window.saveCustomBarcodeRow = saveCustomBarcodeRow;
window.submitAddNewCustomBarcode = submitAddNewCustomBarcode;
window.deleteCustomBarcodeItem = deleteCustomBarcodeItem;
window.toggleCustomBarcodeDropdown = toggleCustomBarcodeDropdown;
window.selectCustomBarcodeForTarget = selectCustomBarcodeForTarget;





