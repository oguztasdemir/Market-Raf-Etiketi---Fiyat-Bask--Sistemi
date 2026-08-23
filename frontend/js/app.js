// =========================================================================
// MARKET RAF ETİKETİ & BASKI YÖNETİM SİSTEMİ - ANA BAŞLATICI (APP.JS)
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log("🚀 Market Raf Etiketi Paneli Başlatılıyor (Modüler Mimari)...");

  // 1. Tema ve Aktif Sekmeyi Geri Yükle (F5 Yenileme Kalıcılığı)
  initAppTheme();

  // F5 yapıldığında mevcut sekmede kalır; ilk açılışta veya hash yoksa Ana Sayfa gelir
  const hashTab = window.location.hash ? window.location.hash.replace('#', '') : null;
  const sessionTab = sessionStorage.getItem('active_tab');

  let targetTab = 'tab-home';
  if (hashTab && document.getElementById(hashTab) && hashTab !== 'tab-print') {
    targetTab = hashTab;
  } else if (sessionTab && document.getElementById(sessionTab) && sessionTab !== 'tab-print') {
    targetTab = sessionTab;
  } else {
    targetTab = 'tab-home';
  }

  switchTab(targetTab);

  // 2. Varsayılan Boyut ve Önizleme
  if (typeof selectSize === 'function') {
    selectSize('76x40');
  }
  if (typeof updateLabel === 'function') {
    updateLabel();
  }

  // 3. Tarih Alanını Otomatik Doldur
  const dtInp = document.getElementById('inp-date');
  if (dtInp && !dtInp.value) {
    const months = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
    const now = new Date();
    dtInp.value = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  }

  // 4. Değişiklik Takibini Başlat (F5 Öncesi Uyarı)
  if (typeof initDraftTracking === 'function') {
    initDraftTracking();
  }

  // 5. Modül Verilerini Sırayla ve Hafifçe Yükle (UI Donmasını Engelle)
  setTimeout(() => {
    if (typeof loadTemplates === 'function') loadTemplates().catch(() => {});
    if (typeof loadCurrentDate === 'function') loadCurrentDate().catch(() => {});
    if (typeof checkBackendAndDevices === 'function') checkBackendAndDevices().catch(() => {});
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

  // 5. Sürükle-Bırak Excel Dropzone
  const dropzone = document.getElementById('sync-dropzone');
  if (dropzone) {
    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-over');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
      }, false);
    });

    dropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files.length > 0) {
        onExcelFileSelected({ target: { files: files, value: '' } });
      }
    });
  }

  console.log("✅ Tüm modüller ve paneller başarıyla hazırlandı.");
});
