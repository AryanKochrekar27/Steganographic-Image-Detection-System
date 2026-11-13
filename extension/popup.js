/* popup.js — StegoDetect Guard popup logic */

(function () {
  const srvDot       = document.getElementById('srv-dot');
  const srvLabel     = document.getElementById('srv-label');
  const btnRefresh   = document.getElementById('btn-refresh');
  const toggleEl     = document.getElementById('toggle-enabled');
  const logList      = document.getElementById('log-list');
  const noLog        = document.getElementById('no-log');

  // ── Server status ──────────────────────────────────────────
  function checkServer() {
    srvLabel.textContent = 'Checking…';
    srvDot.className = 'status-dot';
    fetch('http://localhost:5000/status', { signal: AbortSignal.timeout(3000) })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(() => {
        srvDot.classList.add('online');
        srvLabel.textContent = 'Online — Ready';
      })
      .catch(() => {
        srvDot.classList.add('offline');
        srvLabel.textContent = 'Offline — Start Flask first';
      });
  }
  checkServer();
  btnRefresh.addEventListener('click', checkServer);

  // ── Toggle (enabled/disabled) ──────────────────────────────
  chrome.storage.local.get(['enabled'], (prefs) => {
    toggleEl.checked = prefs.enabled !== false;
  });
  toggleEl.addEventListener('change', () => {
    chrome.storage.local.set({ enabled: toggleEl.checked });
  });

  // ── Scan log ───────────────────────────────────────────────
  function renderLog(entries) {
    if (!entries || entries.length === 0) {
      noLog.style.display = '';
      return;
    }
    noLog.style.display = 'none';
    // Clear old items (keep noLog element)
    [...logList.querySelectorAll('.log-item')].forEach(el => el.remove());

    // Show last 6 entries, newest first
    entries.slice(-6).reverse().forEach(entry => {
      const item = document.createElement('div');
      item.className = 'log-item';

      const badgeClass = entry.is_stego ? 'badge-stego'
                       : entry.error    ? 'badge-error'
                                        : 'badge-cover';
      const badgeText  = entry.is_stego ? 'STEGO'
                       : entry.error    ? 'ERROR'
                                        : 'CLEAN';

      const name = truncate(entry.filename || entry.url || '—', 40);
      const conf = entry.confidence != null ? `Confidence: ${entry.confidence.toFixed(1)}%` : '';

      item.innerHTML = `
        <span class="log-badge ${badgeClass}">${badgeText}</span>
        <div>
          <div class="log-name">${escHtml(name)}</div>
          ${conf ? `<div class="log-conf">${conf}</div>` : ''}
        </div>`;
      logList.appendChild(item);
    });
  }

  // Load scan log from storage
  chrome.storage.local.get(['scanLog'], (data) => {
    renderLog(data.scanLog || []);
  });

  // ── Utilities ──────────────────────────────────────────────
  function truncate(str, len) {
    return str.length > len ? str.slice(0, len - 3) + '…' : str;
  }
  function escHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
})();
