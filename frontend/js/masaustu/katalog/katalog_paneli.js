// -*- coding: utf-8 -*-
/**
 * KATALOG TABLO, FİLTRELEME & ARAMA MOTORU (katalog_paneli.js)
 */

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
  if (p.no_label === true) return true;
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
  const pillSpecial = document.getElementById('pill-filter-special');
  const pillLowStock = document.getElementById('pill-filter-low-stock');

  if (pillAll) pillAll.classList.toggle('active', filterType === 'ALL');
  if (pillOutdated) pillOutdated.classList.toggle('active', filterType === 'OUTDATED');
  if (pillMatched) pillMatched.classList.toggle('active', filterType === 'MATCHED');
  if (pillSpecial) pillSpecial.classList.toggle('active', filterType === 'SPECIAL');
  if (pillLowStock) pillLowStock.classList.toggle('active', filterType === 'LOW_STOCK');

  onCatalogFilterChange();
}


function isProductExpiringSoon(p, daysAhead = 7) {
  const expStr = String(p.expiration_date || p.skt || '').trim();
  if (!expStr) return false;
  try {
    let expDate = null;
    if (expStr.includes('-')) {
      expDate = new Date(expStr);
    } else if (expStr.includes('.')) {
      const pts = expStr.split('.');
      if (pts.length === 3) expDate = new Date(`${pts[2]}-${pts[1]}-${pts[0]}`);
    }
    if (!expDate || isNaN(expDate.getTime())) return false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));
    return diffDays <= daysAhead;
  } catch (e) {
    return false;
  }
}

function updateCatalogStatusCounts() {
  let total = allCatalogProducts.length;
  let outdated = 0;
  let matched = 0;
  let special = 0;
  let lowStock = 0;
  let expiring = 0;

  allCatalogProducts.forEach(p => {
    if (p.is_special || p.special_category) {
      special++;
    }
    if (isLabelPriceUpToDate(p)) {
      matched++;
    } else {
      outdated++;
    }
    const st = parseFloat(p.stock || 0);
    if (st <= 5) {
      lowStock++;
    }
    if (isProductExpiringSoon(p, 7)) {
      expiring++;
    }
  });

  const cAll = document.getElementById('count-pill-all');
  const cOutdated = document.getElementById('count-pill-outdated');
  const cMatched = document.getElementById('count-pill-matched');
  const cSpecial = document.getElementById('count-pill-special');
  const cLowStock = document.getElementById('count-pill-low-stock');
  const cExpiring = document.getElementById('count-pill-expiring');

  if (cAll) cAll.innerText = total.toLocaleString('tr-TR');
  if (cOutdated) cOutdated.innerText = outdated.toLocaleString('tr-TR');
  if (cMatched) cMatched.innerText = matched.toLocaleString('tr-TR');
  if (cSpecial) cSpecial.innerText = special.toLocaleString('tr-TR');
  if (cLowStock) cLowStock.innerText = lowStock.toLocaleString('tr-TR');
  if (cExpiring) cExpiring.innerText = expiring.toLocaleString('tr-TR');

  const pBadge = document.getElementById('price-changed-count-badge');
  if (pBadge) {
    pBadge.innerText = outdated.toLocaleString('tr-TR');
    pBadge.style.display = outdated > 0 ? 'inline-block' : 'none';
  }
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

    // Etiket Durumu Filtresi (Tümü / Güncel Değil / Güncel / Özel Kategori / Azalan Stok / SKT Alarmları)
    if (catalogStatusFilter === 'OUTDATED' && isLabelPriceUpToDate(p)) return false;
    if (catalogStatusFilter === 'MATCHED' && !isLabelPriceUpToDate(p)) return false;
    if (catalogStatusFilter === 'SPECIAL' && !p.is_special && !p.special_category) return false;
    if (catalogStatusFilter === 'LOW_STOCK' && (parseFloat(p.stock || 0) > 5)) return false;
    if (catalogStatusFilter === 'EXPIRING' && !isProductExpiringSoon(p, 7)) return false;

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
    } else if (currentSortColumn === 'custom_barcode') {
      const aCb = (a.custom_barcode || a.ozel_barkod || '').toString();
      const bCb = (b.custom_barcode || b.ozel_barkod || '').toString();
      return aCb.localeCompare(bCb, 'tr') * dir;
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
  ['brand', 'barcode', 'custom_barcode', 'title', 'stock', 'buying_price', 'price', 'profit_margin', 'label_price', 'date', 'status'].forEach(col => {
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
  let clean = String(pStr).replace(/TL/gi, '').replace(/₺/g, '').trim().replace(/\s+/g, '');
  if (!clean) return 0;
  if (clean.includes(',') && clean.includes('.')) {
    if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else {
      clean = clean.replace(/,/g, '');
    }
  } else if (clean.includes(',')) {
    clean = clean.replace(',', '.');
  }
  return parseFloat(clean) || 0;
}

function formatPriceInput(val) {
  if (val === null || val === undefined) return '';
  let s = String(val).replace(/TL/gi, '').replace(/₺/g, '').trim();
  if (!s) return '';
  s = s.replace(/\s+/g, '');
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  let num = parseFloat(s);
  if (isNaN(num)) return String(val).trim() + (String(val).trim().toUpperCase().endsWith('TL') ? '' : ' TL');
  return num.toFixed(2).replace('.', ',') + ' TL';
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
  if (event && (event.target.closest('button') || event.target.tagName === 'BUTTON' || event.target.tagName === 'INPUT')) return;

  const cleanBc = String(barcode || '').trim();
  const list = (filteredCatalogProducts && filteredCatalogProducts.length > 0) ? filteredCatalogProducts : allCatalogProducts;
  let clickedIdx = list.findIndex(p => String(p.barcode || '').trim() === cleanBc);

  // 1. Shift + Tık (veya Ctrl + Shift + Tık): Önceki Seçimleri KORU ve Aralığı Seç
  if (event && event.shiftKey) {
    if (anchorIndex === -1 || clickedIdx === -1) {
      anchorIndex = clickedIdx !== -1 ? clickedIdx : 0;
      selectedBarcodes.add(cleanBc);
      baseSelection = new Set(selectedBarcodes);
    } else {
      // Önceki Ctrl seçimlerini taban alarak aralığı üzerine inşa et
      selectedBarcodes = new Set(baseSelection);
      const start = Math.min(anchorIndex, clickedIdx);
      const end = Math.max(anchorIndex, clickedIdx);
      for (let i = start; i <= end; i++) {
        const item = list[i];
        if (item && item.barcode) {
          selectedBarcodes.add(String(item.barcode).trim());
        }
      }
    }
    updateBatchActionBar();
    updateRowSelections();
    return;
  }

  // 2. Ctrl / Cmd + Tık: Tekli Seçimi Aç / Kapat ve Yeni Çapa (Anchor) Belirle
  if (event && (event.ctrlKey || event.metaKey)) {
    if (selectedBarcodes.has(cleanBc)) {
      selectedBarcodes.delete(cleanBc);
    } else {
      selectedBarcodes.add(cleanBc);
    }
    anchorIndex = clickedIdx !== -1 ? clickedIdx : 0;
    baseSelection = new Set(selectedBarcodes);
    updateBatchActionBar();
    updateRowSelections();
    return;
  }

  // 3. Normal Tıklama: Ürün Detay & Düzenleme Modalını Aç!
  openCatalogProductDetailModal(cleanBc);
}

function onRowCheckboxChange(barcode, checked, event) {
  handleCatalogRowClick(barcode, event);
}

function handleCatalogSelectSquareClick(barcode, event) {
  if (event) event.stopPropagation();
  handleCatalogRowClick(barcode, { ctrlKey: true });
}


