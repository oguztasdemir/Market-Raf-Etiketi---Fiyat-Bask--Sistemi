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
    } else if (currentSortColumn === 'date') {
      return ((a.date || '19 Ağu 2026').localeCompare(b.date || '19 Ağu 2026', 'tr')) * dir;
    }
    return 0;
  });
}


function updateSortIcons() {
  ['brand', 'barcode', 'title', 'price', 'label_price', 'date', 'status'].forEach(col => {
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


function getSystemFormattedDateTime() {
  const months = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = months[now.getMonth()];
  const y = now.getFullYear();
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${d} ${m} ${y} ${h}:${min}`;
}

function formatCatalogDate(p) {
  let val = p.updated_at || p.last_printed_at || p.date || '';
  if (!val) {
    return getSystemFormattedDateTime();
  }
  // Eğer saat içermiyorsa (örn: '20 Ağu 2026' veya '19 Ağu 2026')
  if (!val.includes(':')) {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    return `${val} ${h}:${min}`;
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
  // Buton, input veya seçim karesine tıklandıysa çift tetiklemeyi önle
  if (event && (event.target.closest('button') || event.target.tagName === 'BUTTON')) return;
  if (event && event.target.tagName === 'INPUT' && event.target.type === 'checkbox') return;
  if (event && (event.target.closest('.custom-select-square') || event.target.classList.contains('custom-select-square') || event.target.closest('.td-select-col'))) return;

  // 1. Manuel Hızlı Düzenleme Modu Kontrolü
  if (currentQuickAction !== 'none') {
    if (currentQuickAction === 'price') {
      openQuickPriceEdit(barcode);
    } else if (currentQuickAction === 'title') {
      openQuickTitleEdit(barcode);
    } else if (currentQuickAction === 'brand') {
      openQuickBrandEdit(barcode);
    }
    return;
  }

  // 2. Normal Tıklama ➔ Doğrudan ÜRÜN DETAY MODALINI AÇ!
  openCatalogProductDetailModal(barcode);
}


function onRowCheckboxChange(barcode, checked, event) {
  const clickedIdx = filteredCatalogProducts.findIndex(p => p.barcode === barcode);
  if (clickedIdx === -1) return;

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
  } else {
    if (checked) {
      selectedBarcodes.add(barcode);
    } else {
      selectedBarcodes.delete(barcode);
    }
    anchorIndex = clickedIdx;
    baseSelection = new Set(selectedBarcodes);
  }

  updateBatchActionBar();
  updateRowSelections();
}


function handleCatalogSelectSquareClick(barcode, event) {
  if (event) event.stopPropagation();
  const isSelected = selectedBarcodes.has(barcode);
  onRowCheckboxChange(barcode, !isSelected, event);
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
  const prod = allCatalogProducts.find(p => p.barcode === barcode);
  if (!prod) return;
  currentDetailProduct = prod;

  const badgeEl = document.getElementById('cat-detail-barcode-badge');
  if (badgeEl) badgeEl.innerText = prod.barcode || '';
  
  const bcInp = document.getElementById('cat-detail-inp-barcode');
  if (bcInp) bcInp.value = prod.barcode || '';

  const titleInp = document.getElementById('cat-detail-inp-title');
  if (titleInp) titleInp.value = prod.title || prod.title1 || '';

  const brandInp = document.getElementById('cat-detail-inp-brand');
  if (brandInp) brandInp.value = prod.brand || 'YARENLER';

  const priceInp = document.getElementById('cat-detail-inp-price');
  if (priceInp) priceInp.value = prod.price || '';

  const originInp = document.getElementById('cat-detail-inp-origin');
  if (originInp) originInp.value = prod.origin || 'TÜRKİYE';

  updateDetailModalStatusUI(prod);

  const modal = document.getElementById('modal-catalog-product-detail');
  if (modal) modal.style.display = 'flex';
}

function closeCatalogProductDetailModal() {
  const modal = document.getElementById('modal-catalog-product-detail');
  if (modal) modal.style.display = 'none';
  currentDetailProduct = null;
}

function copyDetailBarcode() {
  const bc = document.getElementById('cat-detail-inp-barcode')?.value;
  if (bc) {
    navigator.clipboard.writeText(bc);
    showToast(`📋 Barkod kopyalandı: ${bc}`, "info");
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

async function blacklistFromDetailModal() {
  if (!currentDetailProduct) return;
  const prod = currentDetailProduct;
  const confirmMsg = `"${prod.title}" ürününü kara listeye eklemek istiyor musunuz?\n(Bu ürün sistemde engellenecek ve etiket basılmayacaktır)`;
  const ok = await showCustomConfirm(confirmMsg, "Kara Listeye Ekle", "Kara Listeye Ekle", "Vazgeç", "🚫");
  if (!ok) return;

  try {
    const res = await fetch(`${API_BASE}/api/blacklist/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barcode: prod.barcode,
        title: prod.title,
        reason: "Kullanıcı Katalogdan Ekledi"
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      const bcSet = new Set([prod.barcode]);
      allCatalogProducts = allCatalogProducts.filter(p => !bcSet.has(p.barcode));
      populateBrandFilterOptions();
      onCatalogFilterChange();
      closeCatalogProductDetailModal();
      showToast(`🚫 '${prod.title}' kara listeye eklendi.`, "success");
    } else {
      showToast(`Hata: ${data.message}`, "error");
    }
  } catch (err) {
    showToast(`Bağlantı hatası: ${err.message}`, "error");
  }
}

async function submitBatchBlacklist() {
  if (selectedBarcodes.size === 0) {
    showToast("Lütfen önce tablodan kara listeye eklenecek ürünleri seçin.", "warning");
    return;
  }

  const count = selectedBarcodes.size;
  const confirmMsg = `Seçilen ${count} adet ürünü kara listeye eklemek istiyor musunuz?\n(Bu ürünler kara listeye kaydedilecek ve aktif katalogdan kaldırılacaktır)`;
  const ok = await showCustomConfirm(confirmMsg, "Toplu Kara Liste", "Kara Listeye Ekle", "Vazgeç", "🚫");
  if (!ok) return;

  const targetBarcodes = Array.from(selectedBarcodes);
  try {
    const res = await fetch(`${API_BASE}/api/blacklist/batch-add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barcodes: targetBarcodes,
        reason: "Kullanıcı Toplu Seçimle Ekledi",
        delete_from_catalog: true
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      const bcSet = new Set(targetBarcodes);
      allCatalogProducts = allCatalogProducts.filter(p => !bcSet.has(p.barcode));
      clearCatalogSelection();
      populateBrandFilterOptions();
      onCatalogFilterChange();
      showToast(`🚫 ${data.message}`, "success");
    } else {
      showToast(`Hata: ${data.message}`, "error");
    }
  } catch (err) {
    showToast(`Bağlantı hatası: ${err.message}`, "error");
  }
}

async function submitCatalogProductDetail() {
  if (!currentDetailProduct) return;
  
  const barcode = document.getElementById('cat-detail-inp-barcode')?.value.trim();
  const title = document.getElementById('cat-detail-inp-title')?.value.trim().toUpperCase();
  const brand = document.getElementById('cat-detail-inp-brand')?.value.trim().toUpperCase() || 'YARENLER';
  const rawPrice = document.getElementById('cat-detail-inp-price')?.value.trim();
  const origin = document.getElementById('cat-detail-inp-origin')?.value.trim().toUpperCase() || 'TÜRKİYE';

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
        title: title,
        brand: brand,
        price: price,
        origin: origin,
        source: 'PC'
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      currentDetailProduct.title = title;
      currentDetailProduct.title1 = title;
      currentDetailProduct.brand = brand;
      currentDetailProduct.price = price;
      currentDetailProduct.origin = origin;
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
        <td colspan="9" style="text-align: center; padding: 40px; color: var(--text-muted);">
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

    tr.innerHTML = `
      <td class="td-select-col" onclick="handleCatalogSelectSquareClick('${p.barcode}', event)" title="Bu ürünü seç / kaldır">
        <div class="custom-select-square ${isSelected ? 'active-checked' : ''}">${isSelected ? '✓' : ''}</div>
      </td>
      <td><span class="badge-brand">${p.brand || 'DİĞER'}</span></td>
      <td><span class="barcode-text">${formatBarcodeDisplay(p.barcode)}</span></td>
      <td style="font-weight: 700; color: var(--text-main);">${p.title}</td>
      <td style="text-align: right;"><span class="price-text">${p.price}</span></td>
      <td style="text-align: right;">${labelPriceBadge}</td>
      <td style="text-align: center;"><span class="date-text">${displayDate}</span></td>
      <td style="text-align: center;">${statusBadge}</td>
      <td style="text-align: center;">
        <button class="btn-sm btn-primary" style="padding: 4px 10px; font-size: 11px;" onclick="event.stopPropagation(); printProductFromCatalog('${p.barcode}')" title="Bu ürünün etiketini tasarımcıya yükle ve bas">
          🏷️ Bas
        </button>
      </td>
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


function selectProduct(p) {
  selectProductFromStock(p);
}


function printProductFromCatalog(barcode) {
  const product = allCatalogProducts.find(p => p.barcode === barcode);
  if (!product) return;

  // 1. Ana Etiket Çıkart sekmesine aktar
  selectProduct(product);
  
  // 2. Etiket Çıkart sekmesini aç
  switchTab('tab-print');
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

// Global Window Dışa Aktarımları
window.resetCatalogFilters = resetCatalogFilters;
window.toggleQuickEditDropdown = toggleQuickEditDropdown;
window.setQuickActionFilter = setQuickActionFilter;
window.openCatalogProductDetailModal = openCatalogProductDetailModal;
window.closeCatalogProductDetailModal = closeCatalogProductDetailModal;
window.copyDetailBarcode = copyDetailBarcode;
window.printFromDetailModal = printFromDetailModal;
window.blacklistFromDetailModal = blacklistFromDetailModal;
window.submitCatalogProductDetail = submitCatalogProductDetail;
window.submitBatchBlacklist = submitBatchBlacklist;
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
window.clearCatalogSelection = clearCatalogSelection;
window.sortCatalog = sortCatalog;
window.setCatalogStatusFilter = setCatalogStatusFilter;
window.toggleBrandDropdown = toggleBrandDropdown;
window.onBrandSearchInput = onBrandSearchInput;
window.clearBrandSearch = clearBrandSearch;
window.selectBrandFromDropdown = selectBrandFromDropdown;
window.onCatalogFilterChange = onCatalogFilterChange;
window.syncSingleProductLabelAndPrint = syncSingleProductLabelAndPrint;
window.printProductFromCatalog = printProductFromCatalog;
window.submitBatchPrint = submitBatchPrint;



