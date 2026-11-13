/* ─────────────────────────────────────────────────────────
   app.js — StegoDetect frontend logic
   ───────────────────────────────────────────────────────── */

(function () {
  'use strict';

  // ── DOM refs ──────────────────────────────────────────────
  const dropZone    = document.getElementById('drop-zone');
  const dropInner   = document.getElementById('drop-inner');
  const previewInner= document.getElementById('preview-inner');
  const previewImg  = document.getElementById('preview-img');
  const previewName = document.getElementById('preview-name');
  const previewSize = document.getElementById('preview-size');
  const fileInput   = document.getElementById('file-input');
  const btnBrowse   = document.getElementById('btn-browse');
  const btnClear    = document.getElementById('btn-clear');
  const btnAnalyze  = document.getElementById('btn-analyze');
  const btnText     = document.getElementById('btn-text');
  const btnSpinner  = document.getElementById('btn-spinner');
  const btnRescan   = document.getElementById('btn-rescan');
  const resultPanel = document.getElementById('result-panel');
  const statusDot   = document.getElementById('status-dot');
  const statusText  = document.getElementById('status-text');

  let selectedFile = null;

  // ── Server status check ───────────────────────────────────
  function checkStatus() {
    fetch('/status')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(() => {
        statusDot.classList.add('online');
        statusText.textContent = 'Model Ready';
      })
      .catch(() => {
        statusDot.classList.add('offline');
        statusText.textContent = 'Offline';
      });
  }
  checkStatus();

  // ── File selection helpers ────────────────────────────────
  function formatBytes(bytes) {
    if (bytes < 1024)      return bytes + ' B';
    if (bytes < 1048576)   return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
  }

  function showPreview(file) {
    selectedFile = file;
    const url = URL.createObjectURL(file);
    previewImg.src = url;
    previewName.textContent = file.name;
    previewSize.textContent = formatBytes(file.size);
    dropInner.classList.add('hidden');
    previewInner.classList.remove('hidden');
    btnAnalyze.disabled = false;
    resultPanel.classList.add('hidden');
  }

  function clearFile() {
    selectedFile = null;
    fileInput.value = '';
    previewImg.src = '';
    previewInner.classList.add('hidden');
    dropInner.classList.remove('hidden');
    btnAnalyze.disabled = true;
    resultPanel.classList.add('hidden');
  }

  // ── Event listeners ───────────────────────────────────────
  btnBrowse.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('click', (e) => {
    if (!e.target.closest('#btn-clear') && !e.target.closest('#btn-browse')) {
      if (selectedFile) return;
      fileInput.click();
    }
  });

  dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) showPreview(fileInput.files[0]);
  });

  btnClear.addEventListener('click', (e) => { e.stopPropagation(); clearFile(); });
  btnRescan.addEventListener('click', clearFile);

  // Drag-and-drop
  ['dragenter', 'dragover'].forEach(evt => {
    dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  });
  ['dragleave', 'drop'].forEach(evt => {
    dropZone.addEventListener(evt, () => dropZone.classList.remove('drag-over'));
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) showPreview(file);
  });

  // ── Analyze ───────────────────────────────────────────────
  btnAnalyze.addEventListener('click', analyze);

  function setLoading(on) {
    btnAnalyze.disabled = on;
    btnText.textContent  = on ? 'Analyzing…' : 'Analyze Image';
    btnSpinner.classList.toggle('hidden', !on);
  }

  async function analyze() {
    if (!selectedFile) return;
    setLoading(true);
    resultPanel.classList.add('hidden');

    const fd = new FormData();
    fd.append('image', selectedFile);

    try {
      const res  = await fetch('/predict', { method: 'POST', body: fd });
      const data = await res.json();

      if (!res.ok || data.error) {
        showError(data.error || 'Server error');
        return;
      }
      renderResult(data);
    } catch (err) {
      showError('Could not reach the server. Is Flask running?');
    } finally {
      setLoading(false);
    }
  }

  // ── Render result ─────────────────────────────────────────
  function renderResult(data) {
    const isStego   = data.is_stego;
    const conf      = data.confidence;
    const coverProb = data.cover_prob;
    const stegoProb = data.stego_prob;

    // Verdict banner
    const verdict = document.getElementById('result-verdict');
    verdict.className = 'result-verdict ' + (isStego ? 'stego-result' : 'cover-result');
    verdict.innerHTML = isStego
      ? `<span class="verdict-icon">🚨</span>Steganography Detected!<div class="verdict-sub">Hidden data found embedded in this image</div>`
      : `<span class="verdict-icon">✅</span>Image Appears Clean<div class="verdict-sub">No steganographic payload detected</div>`;

    // Gauge
    const gaugeFill  = document.getElementById('gauge-fill');
    const gaugeValue = document.getElementById('gauge-value');
    const gaugeLabel = document.getElementById('gauge-label');
    const arcLength  = 283; // half-circle path length

    const offset = arcLength - (conf / 100) * arcLength;
    gaugeFill.style.strokeDashoffset = offset;
    gaugeFill.style.stroke = isStego
      ? (conf > 80 ? '#ef4444' : '#f97316')
      : '#22c55e';

    gaugeValue.textContent = conf.toFixed(1) + '%';
    gaugeValue.style.color = isStego ? '#ef4444' : '#22c55e';
    gaugeLabel.textContent = isStego ? 'Stego Confidence' : 'Cover Confidence';

    // Probability bars (animate after next frame)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById('cover-bar').style.width  = coverProb + '%';
        document.getElementById('stego-bar').style.width  = stegoProb + '%';
        document.getElementById('cover-pct').textContent  = coverProb.toFixed(1) + '%';
        document.getElementById('stego-pct').textContent  = stegoProb.toFixed(1) + '%';
      });
    });

    // Meta info
    document.getElementById('result-meta').innerHTML =
      `<span><strong>File:</strong> ${escHtml(data.filename || selectedFile.name)}</span>` +
      `<span><strong>Label:</strong> ${data.label}</span>` +
      `<span><strong>Cover P:</strong> ${coverProb.toFixed(2)}%</span>` +
      `<span><strong>Stego P:</strong> ${stegoProb.toFixed(2)}%</span>`;

    resultPanel.classList.remove('hidden');
    resultPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ── Error display ─────────────────────────────────────────
  function showError(msg) {
    const verdict = document.getElementById('result-verdict');
    verdict.className = 'result-verdict stego-result';
    verdict.innerHTML = `<span class="verdict-icon">⚠️</span>${escHtml(msg)}`;
    document.getElementById('cover-bar').style.width  = '0%';
    document.getElementById('stego-bar').style.width  = '0%';
    document.getElementById('cover-pct').textContent  = '—';
    document.getElementById('stego-pct').textContent  = '—';
    document.getElementById('gauge-fill').style.strokeDashoffset = '283';
    document.getElementById('gauge-value').textContent = '—';
    document.getElementById('gauge-label').textContent = 'Error';
    document.getElementById('result-meta').innerHTML   = '';
    resultPanel.classList.remove('hidden');
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

})();
