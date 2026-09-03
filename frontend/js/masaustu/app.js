// =========================================================================
// MARKET RAF ETİKETİ & BASKI YÖNETİM SİSTEMİ - ANA BAŞLATICI (APP.JS)
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log("🚀 Market Raf Etiketi Paneli Başlatılıyor (Modüler Mimari)...");

  // 1. Tema ve Aktif Sekmeyi Geri Yükle (F5 Yenileme Kalıcılığı)
  initAppTheme();

  // URL parametresi (?tab=tab-manav veya ?page=manav veya ?tab=manav) veya hash (#tab-manav)
  const urlParams = new URLSearchParams(window.location.search);
  const paramTab = urlParams.get('tab') || urlParams.get('page') || urlParams.get('module');
  const hashTab = window.location.hash ? window.location.hash.replace('#', '') : null;
  const sessionTab = sessionStorage.getItem('active_tab');

  let targetTab = 'tab-home';
  if (paramTab) {
    const formattedTab = paramTab.startsWith('tab-') ? paramTab : `tab-${paramTab}`;
    if (document.getElementById(formattedTab)) {
      targetTab = formattedTab;
    }
  } else if (hashTab && document.getElementById(hashTab) && hashTab !== 'tab-print') {
    targetTab = hashTab;
  } else if (sessionTab && document.getElementById(sessionTab) && sessionTab !== 'tab-print') {
    targetTab = sessionTab;
  } else {
    targetTab = 'tab-home';
  }

  switchTab(targetTab);

  // 2. Modül Verilerini Sırayla ve Hafifçe Yükle (UI Donmasını Engelle)
  setTimeout(() => {
    if (typeof loadTemplates === 'function') loadTemplates().catch(() => {});
    if (typeof loadCurrentDate === 'function') loadCurrentDate().catch(() => {});
    if (typeof checkBackendAndDevices === 'function') checkBackendAndDevices().catch(() => {});
    if (typeof loadDashboardSummary === 'function') loadDashboardSummary().catch(() => {});
    if (typeof loadCustomersList === 'function') loadCustomersList().catch(() => {});
    if (typeof loadMarketEmployees === 'function') loadMarketEmployees().catch(() => {});
    if (typeof setupSyncDropzone === 'function') setupSyncDropzone();
  }, 100);

  setTimeout(() => {
    if (typeof loadCatalog === 'function') loadCatalog().catch(() => {});
  }, 400);

  setTimeout(() => {
    if (typeof loadSyncStatus === 'function') loadSyncStatus().catch(() => {});
    if (typeof loadBackupsList === 'function') loadBackupsList().catch(() => {});
    if (typeof loadDailyReportsSummary === 'function') loadDailyReportsSummary().catch(() => {});
    if (typeof loadManavStatus === 'function') loadManavStatus().catch(() => {});
  }, 1000);

  console.log("✅ Tüm modüller ve paneller başarıyla hazırlandı.");
});
