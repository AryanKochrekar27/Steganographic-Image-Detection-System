/*
 * background.js — StegoDetect Guard (Manifest V3 Service Worker)
 *
 * Flow:
 *   1. Intercept every new download via chrome.downloads.onCreated
 *   2. If it's an image file → pause it immediately
 *   3. POST the URL to local Flask: http://localhost:5000/predict_url
 *   4. If STEGO → inject a modal dialog into the active tab asking user to
 *                 Cancel or Resume the download
 *   5. If COVER or error → silently resume download
 *   6. All scan results logged to chrome.storage.local (for popup history)
 */

const FLASK_URL      = 'http://localhost:5000/predict';
const IMAGE_EXTS     = new Set(['jpg','jpeg','png','bmp','gif','webp','tiff','tif','pgm']);
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB — skip very large files

// Map: tabId → { url, filename }
const pendingDownloads = new Map();
const allowedUrls = new Set();

// ── Helpers ──────────────────────────────────────────────────────────────────

function getExtension(filename) {
  const parts = (filename || '').split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

function isImageUrl(url, filename, mime) {
  if (IMAGE_EXTS.has(getExtension(filename))) return true;
  try { if (IMAGE_EXTS.has(getExtension(new URL(url).pathname))) return true; } catch(_) {}
  if (mime && mime.startsWith('image/')) return true;
  return false;
}

function log(msg) { console.log('[StegoDetect]', msg); }

async function fetchImageBlob(url) {
  try {
    const r = await fetch(url, { credentials: 'include' });
    if (!r.ok) throw new Error(`HTTP error ${r.status}`);
    const contentType = r.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      throw new Error('Received HTML instead of an image');
    }
    return await r.blob();
  } catch (err) {
    if (url.startsWith('blob:')) {
      return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (!tabs || !tabs.length) return reject(new Error('No active tab to fetch blob'));
          chrome.tabs.sendMessage(tabs[0].id, { type: 'FETCH_BLOB', url }, (resp) => {
            if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
            if (resp && resp.error) return reject(new Error(resp.error));
            if (resp && resp.dataUri) {
              fetch(resp.dataUri).then(r => r.blob()).then(resolve).catch(reject);
            } else {
              reject(new Error('No data received from content script'));
            }
          });
        });
      });
    }
    throw err;
  }
}

// ── Modal injection ──────────────────────────────────────────────────────────

async function showStegoModal(item, result) {
  const { url, filename } = item;
  // Find the active tab to inject the modal into
  let tabs;
  try {
    tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch (_) { tabs = []; }

  if (!tabs.length) {
    // No active tab — download was already cancelled, just log it
    log(`No active tab found for ${url}.`);
    return;
  }

  const tabId = tabs[0].id;
  const shortName = truncate(filename || url, 55);
  const conf      = result.confidence.toFixed(1);

  // Store info keyed by tabId so the message handler can look it up
  pendingDownloads.set(tabId, { url, filename });

  // Inject the modal HTML + CSS + JS directly into the page
  await chrome.scripting.executeScript({
    target: { tabId },
    func: injectStegoModal,
    args: [shortName, conf],
  });
}

/**
 * This function runs IN the page context (not the service worker).
 * It builds a full-screen modal overlay and resolves with the user's choice.
 */
function injectStegoModal(filename, confidence) {
  // Avoid duplicate modals
  if (document.getElementById('stegodetect-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'stegodetect-overlay';
  overlay.style.cssText = `
    all: initial;
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0.72);
    backdrop-filter: blur(6px);
    font-family: 'Segoe UI', system-ui, sans-serif;
    animation: sdFadeIn 0.2s ease;
  `;

  overlay.innerHTML = `
    <style>
      @keyframes sdFadeIn  { from { opacity:0; } to { opacity:1; } }
      @keyframes sdSlideUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
      #stegodetect-card {
        background: linear-gradient(145deg, #1a1a2e 0%, #16213e 100%);
        border: 1px solid rgba(255,80,80,0.35);
        border-radius: 18px;
        box-shadow: 0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,80,80,0.1);
        padding: 36px 40px 32px;
        max-width: 460px;
        width: 90vw;
        color: #e8e8f0;
        animation: sdSlideUp 0.25s ease;
        box-sizing: border-box;
      }
      #stegodetect-card * { box-sizing: border-box; font-family: 'Segoe UI', system-ui, sans-serif; }
      .sd-badge {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        background: rgba(255,60,60,0.15);
        border: 1px solid rgba(255,60,60,0.4);
        color: #ff6b6b;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 1.2px;
        text-transform: uppercase;
        padding: 4px 12px;
        border-radius: 20px;
        margin-bottom: 18px;
      }
      .sd-icon { font-size: 20px; }
      .sd-title {
        font-size: 22px;
        font-weight: 700;
        color: #fff;
        margin: 0 0 10px;
        line-height: 1.25;
      }
      .sd-subtitle {
        font-size: 13.5px;
        color: #9a9ab5;
        margin: 0 0 22px;
        line-height: 1.55;
      }
      .sd-info-box {
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 10px;
        padding: 14px 16px;
        margin-bottom: 26px;
      }
      .sd-info-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 13px;
        color: #b0b0cc;
        padding: 3px 0;
      }
      .sd-info-row span:last-child { color: #e0e0f0; font-weight: 600; }
      .sd-conf-bar-wrap {
        height: 6px;
        background: rgba(255,255,255,0.08);
        border-radius: 3px;
        margin-top: 10px;
        overflow: hidden;
      }
      .sd-conf-bar {
        height: 100%;
        border-radius: 3px;
        background: linear-gradient(90deg, #ff6b6b, #ff4444);
        transition: width 0.6s ease;
      }
      .sd-btns {
        display: flex;
        gap: 12px;
      }
      .sd-btn {
        flex: 1;
        padding: 13px 10px;
        border: none;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.15s, transform 0.12s;
        outline: none;
      }
      .sd-btn:hover  { opacity: 0.88; transform: translateY(-1px); }
      .sd-btn:active { opacity: 1.0;  transform: translateY(0); }
      .sd-btn-cancel {
        background: linear-gradient(135deg, #e53935, #b71c1c);
        color: #fff;
        box-shadow: 0 4px 18px rgba(229,57,53,0.4);
      }
      .sd-btn-resume {
        background: rgba(255,255,255,0.07);
        border: 1px solid rgba(255,255,255,0.14);
        color: #b0b0cc;
      }
      .sd-footer {
        margin-top: 18px;
        font-size: 11.5px;
        color: #585870;
        text-align: center;
      }
    </style>

    <div id="stegodetect-card">
      <div class="sd-badge"><span class="sd-icon">⚠️</span> Steganography Detected</div>
      <div class="sd-title">Hidden Data Found in Image</div>
      <p class="sd-subtitle">
        This image appears to contain concealed steganographic data.
        Downloading it may expose you to hidden payloads or covert communication channels.
      </p>
      <div class="sd-info-box">
        <div class="sd-info-row"><span>File</span><span>${filename}</span></div>
        <div class="sd-info-row"><span>Detection confidence</span><span>${confidence}%</span></div>
        <div class="sd-info-row"><span>Status</span><span style="color:#ff6b6b">⛔ Blocked</span></div>
        <div class="sd-conf-bar-wrap">
          <div class="sd-conf-bar" style="width:${confidence}%"></div>
        </div>
      </div>
      <div class="sd-btns">
        <button class="sd-btn sd-btn-cancel" id="sd-cancel-btn">❌ Cancel Download</button>
        <button class="sd-btn sd-btn-resume" id="sd-resume-btn">▶ Resume Anyway</button>
      </div>
      <div class="sd-footer">Powered by StegoDetect · StegoNet model</div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Button actions — post message to service worker
  document.getElementById('sd-cancel-btn').addEventListener('click', () => {
    overlay.remove();
    chrome.runtime.sendMessage({ type: 'MODAL_RESPONSE', action: 'cancel' });
  });
  document.getElementById('sd-resume-btn').addEventListener('click', () => {
    overlay.remove();
    chrome.runtime.sendMessage({ type: 'MODAL_RESPONSE', action: 'resume' });
  });
}

// ── Handle modal response from active tab ─────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'MODAL_RESPONSE') {
    const tabId   = sender.tab?.id;
    const pending = pendingDownloads.get(tabId);
    if (!pending) return;
    pendingDownloads.delete(tabId);

    if (msg.action === 'cancel') {
      log(`Download of ${pending.url} cancelled by user via modal.`);
    } else {
      log(`Download of ${pending.url} resumed by user via modal.`);
      if (pending.url) {
        allowedUrls.add(pending.url);
        chrome.downloads.download({ url: pending.url, filename: pending.filename });
      }
    }
  }

  // content.js right-click scan
  if (msg.type === 'SCAN_URL') {
    fetchImageBlob(msg.url)
      .then(blob => {
        const formData = new FormData();
        formData.append('image', blob, 'scan.png');
        return fetch(FLASK_URL, {
          method:  'POST',
          body:    formData,
        });
      })
      .then(r => r.json())
      .then(data => {
        // If called from content script we can inject a modal directly
        const tabId = sender.tab?.id;
        if (data.is_stego && tabId != null) {
          pendingDownloads.set(tabId, { url: msg.url }); // Store url so they can resume
          chrome.scripting.executeScript({
            target: { tabId },
            func: injectStegoModal,
            args: [msg.url, data.confidence.toFixed(1)],
          });
        }
      })
      .catch(err => log('SCAN_URL error: ' + err.message));
    return false;
  }
});

// ── Clean notif (non-blocking) ────────────────────────────────────────────────
function showCleanNotif(filename, confidence) {
  chrome.notifications.create('clean_' + Date.now(), {
    type:    'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title:   '✅ StegoDetect — Image is Clean',
    message: `${truncate(filename, 50)}\nNo hidden data detected (confidence: ${confidence.toFixed(1)}%)`,
    priority: 0,
  });
}

// ── Main download listener ────────────────────────────────────────────────────
chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  chrome.storage.local.get(['enabled'], (prefs) => {
    const enabled = prefs.enabled !== false;
    if (!enabled || !isImageUrl(item.url, item.filename, item.mime)) {
      suggest();
      return;
    }
    
    if (allowedUrls.has(item.url)) {
      allowedUrls.delete(item.url); // Consume the bypass
      suggest();
      return;
    }

    if (item.fileSize && item.fileSize > MAX_FILE_BYTES) {
      log(`Skipping large file: ${item.filename}`);
      suggest();
      return;
    }

    log(`Scanning: ${item.url}`);

    fetchImageBlob(item.url)
      .then(blob => {
        const formData = new FormData();
        formData.append('image', blob, item.filename || 'download.png');
        return fetch(FLASK_URL, {
          method:  'POST',
          body:    formData,
        });
      })
      .then(resp => resp.json())
      .then(result => {
        if (result.error) {
          log(`Scan error: ${result.error} — resuming.`);
          suggest();
          return;
        }

        log(`Result: ${result.label}  conf=${result.confidence}%`);

        addToLog({
          filename: item.filename || item.url,
          url: item.url,
          is_stego: result.is_stego,
          confidence: result.confidence,
        });

        if (result.is_stego) {
          // Cancel the current download to prevent Save As dialog or saving
          chrome.downloads.cancel(item.id, () => {
            showStegoModal(item, result);
            suggest();
          });
        } else {
          showCleanNotif(item.filename || item.url, result.confidence);
          suggest(); // Continue normally
        }
      })
      .catch(err => {
        log('Flask server unreachable — resuming download silently.');
        suggest();
      });
  });

  return true; // Indicates asynchronous suggest call
});

// ── Scan log ──────────────────────────────────────────────────────────────────
function addToLog(entry) {
  chrome.storage.local.get(['scanLog'], (data) => {
    const scanLog = data.scanLog || [];
    scanLog.push(entry);
    if (scanLog.length > 50) scanLog.splice(0, scanLog.length - 50);
    chrome.storage.local.set({ scanLog });
  });
}

// ── Utility ───────────────────────────────────────────────────────────────────
function truncate(str, len) {
  return str.length > len ? str.slice(0, len - 3) + '…' : str;
}
