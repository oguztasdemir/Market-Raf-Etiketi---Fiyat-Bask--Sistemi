// =========================================================================
// MARKET RAF ETİKETİ & BASKI YÖNETİM SİSTEMİ - ANA BAŞLATICI (APP.JS)
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log("🚀 Market Raf Etiketi Paneli Başlatılıyor (Modüler Mimari)...");

  // 1. Tema ve Aktif Sekmeyi ANINDA Geri Yükle (F5 Yenileme Kalıcılığı)
  initAppTheme();

  const hashTab = window.location.hash ? window.location.hash.replace('#', '') : null;
  const savedTab = hashTab || localStorage.getItem('active_tab') || 'tab-print';
  if (savedTab && document.getElementById(savedTab)) {
    switchTab(savedTab);
  } else {
    switchTab('tab-print');
  }

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

  // 5. Modül Verilerini Arka Planda Yükle
  Promise.all([
    checkBackendAndDevices(),
    loadTemplates(),
    loadCatalog(),
    loadSyncStatus(),
    loadBackupsList(),
    loadCurrentDate()
  ]).catch(err => console.error("Modül veri yükleme hatası:", err));

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
