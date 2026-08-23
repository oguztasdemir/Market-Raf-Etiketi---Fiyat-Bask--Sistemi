// ==========================================
// BACKUPS PANELİ: Güvenli Yedekler & Excel Arşivi
// ==========================================

async function loadBackupsList(isManual = false) {
  const tbody = document.getElementById('backups-tbody');
  if (!tbody) return;

  try {
    const res = await fetch(`${API_BASE}/api/backup/list`);
    if (!res.ok) throw new Error(`Sunucu yanıt vermedi (${res.status})`);
    const data = await res.json();
    
    if (data.status === 'success' && Array.isArray(data.backups)) {
      if (data.backups.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align:center; padding:40px; color:var(--text-muted);">
              Henüz kayıtlı bir veritabanı yedeği bulunmuyor.
            </td>
          </tr>
        `;
        return;
      }

      const fragment = document.createDocumentFragment();
      data.backups.forEach(b => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="font-weight: 700; color: #38bdf8; white-space: nowrap;">🕒 ${b.date}</td>
          <td style="font-weight: 600; color: var(--text-main); font-size: 12.5px;">${b.reason}</td>
          <td>
            <span style="font-family: monospace; color: var(--text-muted); font-size: 11px; word-break: break-all;">${b.filename}</span>
          </td>
          <td style="text-align: right; color: #cbd5e1; font-weight: 700; font-size: 12px; white-space: nowrap;">${b.size}</td>
          <td style="text-align: center; white-space: nowrap;">
            <div style="display: inline-flex; gap: 8px; justify-content: center; align-items: center;">
              <button class="btn-sm btn-secondary btn-rollback" onclick="restoreBackup('${b.filename}')" title="Bu tarihteki veritabanı haline geri dön" style="padding: 5px 12px; font-size: 11.5px; font-weight: 700;">
                ↺ Geri Yükle
              </button>
              <button class="btn-sm btn-danger" onclick="deleteBackup('${b.filename}')" title="Bu yedek dosyasını kalıcı olarak sil" style="padding: 5px 12px; font-size: 11.5px; font-weight: 700; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #f87171; border-radius: 6px; cursor: pointer;">
                🗑️ Sil
              </button>
            </div>
          </td>
        `;
        fragment.appendChild(tr);
      });

      tbody.innerHTML = '';
      tbody.appendChild(fragment);

      if (isManual) {
        showToast("✓ Yedek listesi güncellendi.", "info");
      }
    } else {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#ef4444; padding:20px;">Yedek listesi alınamadı: ${data.message || 'Bilinmeyen hata'}</td></tr>`;
    }
  } catch (e) {
    console.error("Yedekler yüklenemedi:", e);
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#ef4444; padding:20px;">Yedekler yüklenirken hata oluştu: ${e.message}</td></tr>`;
  }
}


async function createManualBackup() {
  const reason = await showCustomPrompt("Yedekleme için bir açıklama / not girin:", "Manuel Kullanıcı Yedeği", "➕ Yeni Güvenli Yedek Al");
  if (reason === null) return;

  try {
    const res = await fetch(`${API_BASE}/api/backup/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: (reason && reason.trim()) || "Manuel Kullanıcı Yedeği" })
    });
    const data = await res.json();
    if (data.status === 'success') {
      showToast(`✅ ${data.message}`, "success");
      loadBackupsList();
    } else {
      showToast(`❌ Hata: ${data.message}`, "error");
    }
  } catch (e) {
    showToast(`❌ Bağlantı hatası: ${e.message}`, "error");
  }
}


async function restoreBackup(filename) {
  if (!filename) return;
  const ok = await showCustomConfirm(
    `'${filename}' yedeğindeki veritabanı geri yüklenecektir.\n\nMevcut veritabanınız bu tarihteki haline dönecektir. Devam etmek istiyor musunuz?`,
    "Veritabanı Geri Yükleme",
    "Geri Yükle",
    "Vazgeç",
    "↺"
  );
  if (!ok) return;

  try {
    const res = await fetch(`${API_BASE}/api/backup/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: filename })
    });
    const data = await res.json();
    if (data.status === 'success') {
      showToast(`✅ ${data.message}`, "success");
      await loadCatalog();
      await loadSyncStatus();
      await loadBackupsList();
    } else {
      showToast(`❌ Hata: ${data.message}`, "error");
    }
  } catch (e) {
    showToast(`❌ Bağlantı hatası: ${e.message}`, "error");
  }
}


async function rollbackLatestBackup() {
  const ok = await showCustomConfirm(
    "Son işlemi geri alıp bir önceki güvenlik yedeğine dönmek istediğinize emin misiniz?",
    "Son İşlemi Geri Al",
    "Evet, Geri Al",
    "Vazgeç",
    "↺"
  );
  if (!ok) return;

  try {
    const res = await fetch(`${API_BASE}/api/backup/rollback-latest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.status === 'success') {
      showToast(`✅ ${data.message}`, "success");
      await loadCatalog();
      await loadSyncStatus();
      await loadBackupsList();
    } else {
      showToast(`❌ Hata: ${data.message}`, "error");
    }
  } catch (e) {
    showToast(`❌ Bağlantı hatası: ${e.message}`, "error");
  }
}


async function deleteBackup(filename) {
  if (!filename) return;
  const ok = await showCustomConfirm(
    `'${filename}' adlı yedek dosyasını kalıcı olarak silmek istediğinize emin misiniz?`,
    "Yedek Dosyasını Sil",
    "Evet, Sil",
    "Vazgeç",
    "🗑️"
  );
  if (!ok) return;

  try {
    const res = await fetch(`${API_BASE}/api/backup/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: filename })
    });
    const data = await res.json();
    if (data.status === 'success') {
      showToast(`✅ ${data.message}`, "success");
      await loadBackupsList();
      const modal = document.getElementById('modal-backups');
      if (modal && modal.style.display === 'flex') {
        await openBackupListModal();
      }
    } else {
      showToast(`❌ Hata: ${data.message}`, "error");
    }
  } catch (e) {
    showToast(`❌ Bağlantı hatası: ${e.message}`, "error");
  }
}


async function deleteAllBackups() {
  const ok = await showCustomConfirm(
    "⚠️ DİKKAT: Kayıtlı TÜM veritabanı yedekleri kalıcı olarak silinecektir!\n\nBu işlem geri alınamaz. Devam etmek istediğinize emin misiniz?",
    "Tüm Yedekleri Sil",
    "Evet, Tümünü Sil",
    "Vazgeç",
    "🗑️"
  );
  if (!ok) return;

  try {
    const res = await fetch(`${API_BASE}/api/backup/delete-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.status === 'success') {
      showToast(`✅ ${data.message}`, "success");
      await loadBackupsList();
      const modal = document.getElementById('modal-backups');
      if (modal && modal.style.display === 'flex') {
        await openBackupListModal();
      }
    } else {
      showToast(`❌ Hata: ${data.message}`, "error");
    }
  } catch (e) {
    showToast(`❌ Bağlantı hatası: ${e.message}`, "error");
  }
}


async function openBackupListModal() {
  const modal = document.getElementById('modal-backups');
  const listEl = document.getElementById('backup-list-container');
  if (!modal || !listEl) return;

  modal.style.display = 'flex';
  listEl.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">⏳ Yedekler listeleniyor...</div>';

  try {
    const res = await fetch(`${API_BASE}/api/backup/list`);
    const data = await res.json();
    if (data.status === 'success' && data.backups && data.backups.length > 0) {
      listEl.innerHTML = '';
      data.backups.forEach((b, idx) => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:#090d16; border:1px solid var(--border-color); border-radius:8px;';
        
        const isFirst = (idx === 0);
        const tagBadge = isFirst 
          ? '<span style="background:rgba(56,189,248,0.2); color:#38bdf8; border:1px solid rgba(56,189,248,0.4); padding:2px 7px; border-radius:5px; font-size:10.5px; font-weight:800;">EN SON YEDEK</span>'
          : '';

        row.innerHTML = `
          <div style="display:flex; flex-direction:column; gap:3px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <strong style="color:var(--text-main); font-size:12.5px;">💾 ${b.filename}</strong>
              ${tagBadge}
            </div>
            <div style="font-size:11px; color:var(--text-muted);">
              📅 ${b.date} &bull; Sebep: <span style="color:#e2e8f0;">${b.reason}</span> (${b.size})
            </div>
          </div>
          <div style="display:flex; gap:6px; align-items:center;">
            <button class="btn-sm btn-primary" onclick="restoreBackupFile('${b.filename}')" style="font-size:11.5px; padding:4px 10px; background:linear-gradient(135deg, #f59e0b, #d97706); border:none;" title="Fiyatları bu yedeğe geri yükle">
              ↺ Bu Yedeğe Dön
            </button>
            <button class="btn-sm btn-danger" onclick="deleteBackup('${b.filename}')" style="font-size:11.5px; padding:4px 8px; background:rgba(239, 68, 68, 0.15); border:1px solid rgba(239, 68, 68, 0.4); color:#f87171; border-radius:6px; cursor:pointer;" title="Yedeği sil">
              🗑️
            </button>
          </div>
        `;
        listEl.appendChild(row);
      });
    } else {
      listEl.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">Henüz alınmış bir yedek bulunmuyor.</div>';
    }
  } catch (e) {
    listEl.innerHTML = `<div style="text-align:center; padding:20px; color:#ef4444;">Hata: ${e.message}</div>`;
  }
}


function closeBackupListModal() {
  const modal = document.getElementById('modal-backups');
  if (modal) modal.style.display = 'none';
}


async function restoreBackupFile(filename) {
  const ok = await showCustomConfirm(`'${filename}' yedeğindeki verileri geri yüklemek istediğinize emin misiniz?\n\nMevcut ürün veritabanı bu yedeğe döndürülecektir.`, "Yedeği Geri Yükle", "Evet, Geri Yükle", "Vazgeç", "💾");
  if (!ok) return;

  try {
    const res = await fetch(`${API_BASE}/api/backup/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: filename })
    });
    const result = await res.json();
    if (result.status === 'success') {
      showToast(`✓ ${result.message}`, "success");
      closeBackupListModal();
      await loadCatalog();
      await loadSyncStatus(true);
    } else {
      showToast(`❌ ${result.message}`, "error");
    }
  } catch (e) {
    showToast(`❌ Bağlantı hatası: ${e.message}`, "error");
  }
}


async function openExcelHistoryModal() {
  const modal = document.getElementById('modal-excel-history');
  const listEl = document.getElementById('excel-history-list');
  if (!modal || !listEl) return;

  modal.style.display = 'flex';
  listEl.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">⏳ Yükleniyor...</div>';

  try {
    const res = await fetch(`${API_BASE}/api/catalog/excel-history`);
    const data = await res.json();
    if (data.status === 'success' && data.history && data.history.length > 0) {
      listEl.innerHTML = '';
      data.history.forEach(item => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:12px 16px; background:#090d16; border:1px solid var(--border-color); border-radius:10px; gap:12px;';
        
        const isLatest = item.is_latest;
        const statusBadge = isLatest 
          ? '<span style="background:rgba(16,185,129,0.2); color:#10b981; border:1px solid rgba(16,185,129,0.4); padding:3px 8px; border-radius:6px; font-size:11px; font-weight:800;">🟢 Aktif (En Güncel)</span>'
          : '<span style="background:rgba(148,163,184,0.15); color:#94a3b8; border:1px solid rgba(148,163,184,0.3); padding:3px 8px; border-radius:6px; font-size:11px; font-weight:700;">🔒 Arşiv</span>';

        const stats = item.stats || {};
        const totalRows = (stats.total_excel_rows || 0).toLocaleString('tr-TR');
        const changedCount = (stats.changed_count || 0).toLocaleString('tr-TR');
        const newCount = (stats.new_count || 0).toLocaleString('tr-TR');
        const matchedCount = (stats.matched_count || 0).toLocaleString('tr-TR');
        const blackCount = (stats.blacklisted_count || 0).toLocaleString('tr-TR');

        row.innerHTML = `
          <div style="display:flex; flex-direction:column; gap:4px; flex:1;">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <strong style="color:var(--text-main); font-size:13px;">📅 ${item.date} Yüklemesi</strong>
              <span style="font-size:11px; color:var(--text-muted);">(${item.size})</span>
              ${statusBadge}
            </div>
            <div style="font-size:11.5px; color:var(--text-muted); line-height:1.4;">
              📦 Toplam <b>${totalRows}</b> ürün &bull; 
              ⚠️ Fiyatı Farklı: <b style="color:#f59e0b;">${changedCount}</b> &bull; 
              ✨ Yeni: <b style="color:#38bdf8;">${newCount}</b> &bull; 
              ✅ Aynı: <b style="color:#10b981;">${matchedCount}</b> &bull; 
              🚫 Kara Liste: <b style="color:#ef4444;">${blackCount}</b>
            </div>
          </div>
          <div style="display:flex; gap:6px; align-items:center; flex-shrink:0;">
            <a href="${API_BASE}/api/catalog/excel-download/${encodeURIComponent(item.filename)}" class="btn-sm btn-secondary" style="font-size:11px; padding:5px 10px; display:inline-flex; align-items:center; gap:4px; text-decoration:none;" title="Excel/CSV dosyasını bilgisayarına indir">
              📥 İndir
            </a>
            <button class="btn-sm btn-secondary" onclick="openExcelDetailModal('${item.filename}')" style="font-size:11px; padding:5px 10px;" title="Dosyadaki ürünleri ve fiyat farklarını detaylı incele">
              🔍 İncele
            </button>
            <button class="btn-sm btn-secondary" onclick="deleteExcelArchive('${item.filename}', ${isLatest})" style="font-size:11px; padding:5px 8px; color:#ef4444; border-color:rgba(239,68,68,0.4);" title="Bu arşiv dosyasını sil">
              🗑️ Sil
            </button>
          </div>
        `;
        listEl.appendChild(row);
      });
    } else {
      listEl.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">Arşivde kayıtlı dosya bulunamadı.</div>';
    }
  } catch(e) {
    listEl.innerHTML = `<div style="text-align:center; padding:20px; color:#ef4444;">Hata: ${e.message}</div>`;
  }
}


async function deleteExcelArchive(filename, isLatest) {
  let msg = `Bu arşiv dosyasını silmek istediğinize emin misiniz?`;
  if (isLatest) {
    msg = `⚠️ DİKKAT: Bu dosya şu anda sistemdeki EN GÜNCEL aktif stok dosyasıdır!\n\nSilerseniz sistem bir önceki arşiv dosyasına dönecektir. Onaylıyor musunuz?`;
  }
  const ok = await showCustomConfirm(msg, "Dosyayı Sil", "Evet, Sil", "Vazgeç", "🗑️");
  if (!ok) return;

  try {
    const res = await fetch(`${API_BASE}/api/catalog/excel-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: filename })
    });
    const data = await res.json();
    if (data.status === 'success') {
      showToast("✓ Dosya başarıyla silindi.", "success");
      await openExcelHistoryModal();
      await loadSyncStatus(true);
    } else {
      showToast(`❌ Hata: ${data.message}`, "error");
    }
  } catch (e) {
    showToast(`❌ Bağlantı hatası: ${e.message}`, "error");
  }
}


function closeExcelHistoryModal() {
  const modal = document.getElementById('modal-excel-history');
  if (modal) modal.style.display = 'none';
}


async function openExcelDetailModal(filename) {
  const modal = document.getElementById('modal-excel-detail');
  if (!modal) return;

  modal.style.display = 'flex';
  document.getElementById('excel-detail-title').innerText = `🔍 Arşiv: ${filename}`;
  document.getElementById('excel-detail-subtitle').innerText = 'Yükleniyor...';
  const tbody = document.getElementById('detail-tbody');
  tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px;">⏳ Veriler okunuyor...</td></tr>';

  try {
    const res = await fetch(`${API_BASE}/api/catalog/excel-detail/${encodeURIComponent(filename)}`);
    const data = await res.json();
    if (data.status === 'success') {
      document.getElementById('excel-detail-subtitle').innerText = `Yükleme Tarihi: ${data.updated_at}`;
      document.getElementById('detail-stat-total').innerText = data.stats.total_excel_rows || 0;
      document.getElementById('detail-stat-changed').innerText = data.stats.changed_count || 0;
      document.getElementById('detail-stat-new').innerText = data.stats.new_count || 0;
      document.getElementById('detail-stat-matched').innerText = data.stats.matched_count || 0;
      document.getElementById('detail-stat-black').innerText = data.stats.blacklisted_count || 0;

      const allItems = [
        ...(data.changed_prices || []),
        ...(data.new_products || []),
        ...(data.matched_products || []),
        ...(data.blacklisted_items || [])
      ];

      tbody.innerHTML = '';
      allItems.slice(0, 100).forEach(it => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><span class="barcode-text">${it.barcode}</span></td>
          <td style="color:var(--text-main); font-weight:600;">${it.excel_title || it.current_title || '-'}</td>
          <td style="text-align:right; font-weight:800; color:#38bdf8;">${it.excel_price || '-'}</td>
        `;
        tbody.appendChild(tr);
      });
      if (allItems.length > 100) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="3" style="text-align:center; color:var(--text-muted); font-size:11.5px; padding:8px;">... ve diğer ${allItems.length - 100} kayıt</td>`;
        tbody.appendChild(tr);
      }
    }
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#ef4444;">Hata: ${e.message}</td></tr>`;
  }
}


function closeExcelDetailModal() {
  const modal = document.getElementById('modal-excel-detail');
  if (modal) modal.style.display = 'none';
}
