// ==========================================
// PRINT PANELİ: Etiket Çıkart, Form & Canlı Önizleme
// ==========================================

let searchTimeout = null;

async function checkBackendAndDevices(isManual = false) {
  const badgeText = document.getElementById('backend-status-text');
  const printerSelect = document.getElementById('settings-printer-select');
  const sidebarPrinterName = document.getElementById('sidebar-printer-name');

  try {
    const res = await fetch(`${API_BASE}/api/devices`);
    if (!res.ok) throw new Error('API bağlantı hatası');
    const data = await res.json();

    if (data.usb_connected) {
      if (badgeText) badgeText.innerHTML = `USB: <strong>Termal Bağlı</strong>`;
    } else {
      if (badgeText) badgeText.innerHTML = `Sunucu: <strong>Aktif</strong>`;
    }

    if (data.default_printer) {
      selectedPrinter = data.default_printer;
      if (sidebarPrinterName) sidebarPrinterName.innerText = data.default_printer;
    }

    if (printerSelect && data.printers && data.printers.length > 0) {
      printerSelect.innerHTML = '';
      data.printers.forEach(printer => {
        const opt = document.createElement('option');
        opt.value = printer;
        opt.innerText = `🖨️ ${printer}`;
        if (printer === (selectedPrinter || data.default_printer)) opt.selected = true;
        printerSelect.appendChild(opt);
      });
    }

    await loadConnectedDevicesLive(isManual);

  } catch (err) {
    if (badgeText) badgeText.innerHTML = `Durum: <strong>Yerel Mod</strong>`;
  }
}


async function loadMobileQrCode() {
  await loadConnectedDevicesLive(false);
}

async function loadConnectedDevicesLive(isManual = false) {
  try {
    const res = await fetch(`${API_BASE}/api/system/connected_devices`);
    const data = await res.json();

    if (data.status === 'success') {
      // 1. Link Alanları
      const pcInp = document.getElementById('inp-pc-web-url');
      const mobInp = document.getElementById('inp-mobile-url');
      if (pcInp) pcInp.value = data.web_pc_url || `http://${data.ip}:5000`;
      if (mobInp) mobInp.value = data.web_mobile_url || `http://${data.ip}:5000/mobile`;

      // 2. QR Kodu Render
      const qrContainer = document.getElementById('mobile-qr-canvas');
      if (qrContainer) {
        qrContainer.innerHTML = '';
        const canvas = document.createElement('canvas');
        canvas.style.borderRadius = '8px';
        canvas.style.maxWidth = '100%';

        let generated = false;
        if (window.QRCode && typeof QRCode.toCanvas === 'function') {
          try {
            await QRCode.toCanvas(canvas, data.web_mobile_url, {
              width: 150,
              margin: 1,
              color: { dark: '#000000', light: '#ffffff' }
            });
            qrContainer.appendChild(canvas);
            generated = true;
          } catch (qrErr) {}
        }

        if (!generated) {
          const img = document.createElement('img');
          img.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(data.web_mobile_url)}`;
          img.alt = "Mobil QR Kodu";
          img.style.width = "150px";
          img.style.height = "150px";
          img.style.borderRadius = "8px";
          qrContainer.appendChild(img);
        }
      }

      // 3. Özet Sayaç Rozetleri
      const s = data.summary || {};
      const cPcs = document.getElementById('dev-count-pcs');
      const cMobiles = document.getElementById('dev-count-mobiles');
      const cScales = document.getElementById('dev-count-scales');
      const cPrinters = document.getElementById('dev-count-printers');
      const cScanners = document.getElementById('dev-count-scanners');
      const cPos = document.getElementById('dev-count-pos');
      const cAll = document.getElementById('dev-count-all');

      const totalCount = (s.pcs_count || 0) + (s.mobiles_count || 0) + (s.scales_count || 0) + (s.printers_count || 0) + (s.scanners_count || 0) + (s.pos_count || 0);
      if (cAll) cAll.innerText = `${totalCount} Cihaz`;

      if (cPcs) cPcs.innerText = `${s.pcs_count || 0} PC`;
      if (cMobiles) cMobiles.innerText = `${s.mobiles_count || 0} Mobil`;
      if (cScales) cScales.innerText = `${s.scales_count || 0} Terazi`;
      if (cPrinters) cPrinters.innerText = `${s.printers_count || 0} Yazıcı`;
      if (cScanners) cScanners.innerText = `${s.scanners_count || 0} Okuyucu`;
      if (cPos) cPos.innerText = `${s.pos_count || 0} POS`;

      const bPcs = document.getElementById('dev-badge-pcs');
      const bMobiles = document.getElementById('dev-badge-mobiles');
      const bScales = document.getElementById('dev-badge-scales');
      const bPrinters = document.getElementById('dev-badge-printers');
      const bScanners = document.getElementById('dev-badge-scanners');
      const bPos = document.getElementById('dev-badge-pos');

      if (bPcs) bPcs.innerText = `${s.pcs_count || 0} Cihaz`;
      if (bMobiles) bMobiles.innerText = `${s.mobiles_count || 0} Cihaz`;
      if (bScales) bScales.innerText = `${s.scales_count || 0} Terazi`;
      if (bPrinters) bPrinters.innerText = `${s.printers_count || 0} Yazıcı`;
      if (bScanners) bScanners.innerText = `${s.scanners_count || 0} Aygıt`;
      if (bPos) bPos.innerText = `${s.pos_count || 0} Terminal`;

      // 4. Detaylı Listeleri Doldur
      // 4.1. Bilgisayarlar
      const listPcs = document.getElementById('dev-list-pcs');
      if (listPcs && data.pcs) {
        listPcs.innerHTML = data.pcs.map(p => `
          <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(15,23,42,0.8); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
            <div>
              <strong style="color: #f8fafc; font-size: 12.5px;">💻 ${p.name}</strong>
              <div style="font-size: 11px; color: #94a3b8;">IP: <span style="color: #38bdf8; font-family: monospace;">${p.ip}</span> • Rol: ${p.role}</div>
            </div>
            <span class="badge-status-pill online">${p.status}</span>
          </div>
        `).join('');
      }

      // 4.2. Mobil Cihazlar
      const listMobiles = document.getElementById('dev-list-mobiles');
      if (listMobiles && data.mobiles) {
        listMobiles.innerHTML = data.mobiles.map(m => `
          <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(15,23,42,0.8); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
            <div>
              <strong style="color: #f8fafc; font-size: 12.5px;">📱 ${m.name}</strong>
              <div style="font-size: 11px; color: #94a3b8;">Ağ: <span style="color: #34d399; font-family: monospace;">${m.ip}</span> • ${m.type}</div>
            </div>
            <span class="badge-status-pill online">${m.status}</span>
          </div>
        `).join('');
      }

      // 4.3. Teraziler
      const listScales = document.getElementById('dev-list-scales');
      if (listScales && data.scales) {
        listScales.innerHTML = data.scales.map(sc => `
          <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(15,23,42,0.8); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
            <div>
              <strong style="color: #f8fafc; font-size: 12.5px;">⚖️ ${sc.name}</strong>
              <div style="font-size: 11px; color: #94a3b8;">IP & Port: <span style="color: #c084fc; font-family: monospace;">${sc.ip}</span> • Model: ${sc.model}</div>
            </div>
            <span class="badge-status-pill ${sc.is_online ? 'online' : 'offline'}">${sc.status}</span>
          </div>
        `).join('');
      }

      // 4.4. Yazıcılar
      const listPrinters = document.getElementById('dev-list-printers');
      if (listPrinters && data.printers) {
        listPrinters.innerHTML = data.printers.map(pr => {
          let badgeHtml = '';
          if (pr.is_online) {
            badgeHtml = '<span class="badge-status-pill online">🟢 Hazır (Bağlı)</span>';
          } else if (pr.is_offline) {
            badgeHtml = '<span style="background: rgba(239,68,68,0.15); color: #f87171; border: 1px solid rgba(239,68,68,0.35); padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 800;">🔴 Çevrimdışı (Bağlı Değil)</span>';
          } else {
            badgeHtml = '<span style="background: rgba(148,163,184,0.12); color: #94a3b8; border: 1px solid rgba(148,163,184,0.25); padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 600;">⚪ Sanal Kuyruk</span>';
          }

          return `
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(15,23,42,0.8); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
              <div>
                <strong style="color: #f8fafc; font-size: 12.5px;">${pr.is_default ? '⭐' : '🖨️'} ${pr.name}</strong>
                <div style="font-size: 11px; color: #94a3b8;">${pr.is_default ? '<span style="color: #fbbf24; font-weight: 700;">Varsayılan Etiket Yazıcısı</span>' : (pr.is_virtual ? 'Windows Sanal Yazılımı' : 'Fiziksel Yazıcı Kuyruğu')}</div>
              </div>
              ${badgeHtml}
            </div>
          `;
        }).join('');
      }

      // 4.5. Barkod Okuyucular
      const listScanners = document.getElementById('dev-list-scanners');
      if (listScanners && data.scanners) {
        listScanners.innerHTML = data.scanners.map(sc => `
          <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(15,23,42,0.8); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
            <div>
              <strong style="color: #f8fafc; font-size: 12.5px;">🔍 ${sc.name}</strong>
              <div style="font-size: 11px; color: #94a3b8;">Bağlantı: ${sc.type}</div>
            </div>
            <span class="badge-status-pill online">${sc.status}</span>
          </div>
        `).join('');
      }

      // 4.6. Banka POS Terminalleri
      const listPos = document.getElementById('dev-list-pos');
      if (listPos && data.pos_terminals) {
        listPos.innerHTML = data.pos_terminals.map(pt => `
          <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(15,23,42,0.8); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
            <div>
              <strong style="color: #f8fafc; font-size: 12.5px;">💳 ${pt.name}</strong>
              <div style="font-size: 11px; color: #94a3b8;">Arayüz: ${pt.type} • Görev: ${pt.role}</div>
            </div>
            <span style="background: rgba(14,165,233,0.15); color: #38bdf8; border: 1px solid rgba(14,165,233,0.3); padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700;">${pt.status}</span>
          </div>
        `).join('');
      }

      // Aktif filtreyi uygula
      filterDeviceView(currentDeviceFilter || 'all');

      if (isManual && typeof showToast === 'function') {
        showToast("✓ Bağlı tüm cihazlar ve ağ durumu güncellendi.", "success");
      }
    }
  } catch (e) {
    console.error("Cihazları yükleme hatası:", e);
  }
}

// 5. Cihazları Filtreleme Mantığı (Tümü, PC, Mobil, Terazi, Yazıcı, Okuyucu, POS)
let currentDeviceFilter = 'all';

function filterDeviceView(type) {
  currentDeviceFilter = type;

  const filterCards = {
    'all': 'dev-filter-all',
    'pcs': 'dev-filter-pcs',
    'mobiles': 'dev-filter-mobiles',
    'scales': 'dev-filter-scales',
    'printers': 'dev-filter-printers',
    'scanners': 'dev-filter-scanners',
    'pos': 'dev-filter-pos'
  };

  // Buton aktiflik stilleri
  Object.entries(filterCards).forEach(([k, elId]) => {
    const el = document.getElementById(elId);
    if (!el) return;
    if (k === type) {
      el.style.background = 'rgba(56,189,248,0.22)';
      el.style.border = '2px solid #38bdf8';
      el.style.boxShadow = '0 0 14px rgba(56,189,248,0.4)';
    } else {
      el.style.background = 'rgba(15,23,42,0.7)';
      el.style.border = '1px solid rgba(255,255,255,0.08)';
      el.style.boxShadow = 'none';
    }
  });

  // Bölümleri Filtrele
  const sections = {
    'pcs': 'dev-section-pcs',
    'mobiles': 'dev-section-mobiles',
    'scales': 'dev-section-scales',
    'printers': 'dev-section-printers',
    'scanners': 'dev-section-scanners',
    'pos': 'dev-section-pos'
  };

  Object.entries(sections).forEach(([k, sId]) => {
    const sEl = document.getElementById(sId);
    if (!sEl) return;
    if (type === 'all' || type === k) {
      sEl.style.display = 'block';
    } else {
      sEl.style.display = 'none';
    }
  });
}

window.filterDeviceView = filterDeviceView;

// 6. QR Panelinden Canlı Terazi Testi & Görsel Geri Bildirim
async function testScaleLiveFromQr() {
  const btn = document.getElementById('btn-test-scale-live');
  const alertBox = document.getElementById('qr-device-live-alert');

  if (btn) {
    btn.disabled = true;
    btn.innerText = '⏳ Sınanıyor (Ping)...';
  }

  try {
    const res = await fetch(`${API_BASE}/api/scale/test_connection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const data = await res.json();
    const result = data.result || {};

    if (alertBox) {
      alertBox.style.display = 'block';
      if (result.online) {
        alertBox.style.background = 'rgba(16,185,129,0.15)';
        alertBox.style.color = '#34d399';
        alertBox.style.border = '1px solid rgba(16,185,129,0.3)';
        alertBox.innerHTML = `✅ <strong>Terazi Bağlantısı Başarılı:</strong> ${result.message || 'DIGI SM-100 (192.168.1.61) anında yanıt verdi!'}`;
      } else {
        alertBox.style.background = 'rgba(239,68,68,0.15)';
        alertBox.style.color = '#f87171';
        alertBox.style.border = '1px solid rgba(239,68,68,0.3)';
        alertBox.innerHTML = `⚠️ <strong>Teraziye Ulaşılamadı:</strong> ${result.message || '192.168.1.61:2061 bağlantısı kurulamadı.'}`;
      }
      setTimeout(() => { alertBox.style.display = 'none'; }, 4500);
    }

    await loadConnectedDevicesLive(false);

  } catch (err) {
    if (alertBox) {
      alertBox.style.display = 'block';
      alertBox.style.background = 'rgba(239,68,68,0.15)';
      alertBox.style.color = '#f87171';
      alertBox.style.border = '1px solid rgba(239,68,68,0.3)';
      alertBox.innerHTML = `❌ <strong>Bağlantı Hatası:</strong> ${err.message}`;
      setTimeout(() => { alertBox.style.display = 'none'; }, 4500);
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = '🧪 Terazi Bağlantısını Test Et';
    }
  }
}

// 7. QR Panelinden Canlı Yazıcı Testi & Görsel Geri Bildirim
async function testPrinterQuickLive() {
  const btn = document.getElementById('btn-test-printer-live');
  const alertBox = document.getElementById('qr-device-live-alert');

  if (btn) {
    btn.disabled = true;
    btn.innerText = '⏳ Yazıcıya Gönderiliyor...';
  }

  const printer = selectedPrinter || "Termal Etiket Yazici";
  try {
    const res = await fetch(`${API_BASE}/api/print/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        printer: printer,
        orientation: "POR",
        products: [{
          barcode: "8690000000001",
          stock_code: "TEST-01",
          title: "DONANIM TEST ETIKETI",
          price: "1,00 TL",
          price_raw: 1.0,
          origin: "TURKIYE",
          unit: "Adet",
          print_count: 1
        }]
      })
    });
    const data = await res.json();

    if (alertBox) {
      alertBox.style.display = 'block';
      if (data.status === 'success') {
        alertBox.style.background = 'rgba(16,185,129,0.15)';
        alertBox.style.color = '#34d399';
        alertBox.style.border = '1px solid rgba(16,185,129,0.3)';
        alertBox.innerHTML = `✅ <strong>Test Etiketi Gönderildi:</strong> '${printer}' kuyruğuna test baskısı iletildi.`;
      } else {
        alertBox.style.background = 'rgba(239,68,68,0.15)';
        alertBox.style.color = '#f87171';
        alertBox.style.border = '1px solid rgba(239,68,68,0.3)';
        alertBox.innerHTML = `⚠️ <strong>Yazıcı Uyarısı:</strong> ${data.message || 'Yazıcı çevrimdışı veya kuyruk meşgul.'}`;
      }
      setTimeout(() => { alertBox.style.display = 'none'; }, 4500);
    }

    await loadConnectedDevicesLive(false);

  } catch (err) {
    if (alertBox) {
      alertBox.style.display = 'block';
      alertBox.style.background = 'rgba(239,68,68,0.15)';
      alertBox.style.color = '#f87171';
      alertBox.style.border = '1px solid rgba(239,68,68,0.3)';
      alertBox.innerHTML = `❌ <strong>Baskı Hatası:</strong> ${err.message}`;
      setTimeout(() => { alertBox.style.display = 'none'; }, 4500);
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = '🧪 Yazıcıya Test Etiketi Bas';
    }
  }
}

window.testScaleLiveFromQr = testScaleLiveFromQr;
window.testPrinterQuickLive = testPrinterQuickLive;

function copyPcWebUrl() {
  const inp = document.getElementById('inp-pc-web-url');
  if (!inp) return;
  inp.select();
  document.execCommand('copy');
  if (typeof showToast === 'function') {
    showToast("📋 PC Web tarayıcı linki kopyalandı:\n" + inp.value, "success");
  }
}

function copyMobileUrl() {
  const inp = document.getElementById('inp-mobile-url');
  if (!inp) return;
  inp.select();
  document.execCommand('copy');
  if (typeof showToast === 'function') {
    showToast("📋 Mobil reyon terminali linki kopyalandı:\n" + inp.value, "success");
  }
}
