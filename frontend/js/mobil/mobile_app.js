/**
 * =========================================================================
 * 📱 MOBILE APP: Ana Başlatıcı & Entegrasyon Giriş Noktası
 * =========================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Ayarları ve Yerel Depolamaları Yükle
  if (typeof loadSettings === 'function') loadSettings();
  if (typeof loadQueueFromStorage === 'function') loadQueueFromStorage();
  if (typeof updateQueueUI === 'function') updateQueueUI();
  if (typeof loadMobilePosCart === 'function') loadMobilePosCart();
  if (typeof updateMobilePosUI === 'function') updateMobilePosUI();

  // 2. Personel Giriş / Yetki Motorunu Başlat
  if (typeof initMobileEmployeeAuth === 'function') {
    initMobileEmployeeAuth();
  }
});
