/* MoveAssist — QR Scanner */
/* scan.js */

// ─── QR SCAN ──────────────────────────────────────────────────
const STATUSES = ['packed','loaded','in_transit','delivered'];
let scanStream = null;
let scannedQR = null;
let selectedScanStatus = '';
let scanAnimFrame = null;
let scanPaused = false;

async function startCamera() {
  // Don't reset if we're showing the success screen — let user read it
  if (document.getElementById('scanSuccess')?.style.display !== 'none' &&
      document.getElementById('scanSuccess')?.style.display !== '') return;

  scannedQR = null;
  selectedScanStatus = '';
  scanPaused = false;
  document.getElementById('scanResult').style.display = 'none';
  document.getElementById('cameraError').style.display = 'none';
  stopCamera();

  // Always show our custom prompt first — permission is only
  // requested when user explicitly taps the button (required by iOS Safari)
  document.getElementById('cameraPrompt').style.display = 'block';
  document.getElementById('scanArea').style.display = 'none';
  document.getElementById('scanPlaceholder').style.display = 'none';
  document.getElementById('scanResult').style.display = 'none';
}

async function requestCameraPermission() {
  const btn = document.getElementById('cameraPermBtn');
  btn.disabled = true;
  btn.textContent = 'Opening camera...';

  try {
    // Must be called directly inside a user gesture handler (button tap)
    // This is what triggers the native browser permission popup
    scanStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
    });

    // Permission granted — show camera UI
    document.getElementById('cameraPrompt').style.display = 'none';
    document.getElementById('scanArea').style.display = 'block';
    document.getElementById('scanPlaceholder').style.display = 'block';
    document.getElementById('scanFrame').className = 'scan-frame';
    document.getElementById('scanStatus').textContent = 'Scanning...';

    const video = document.getElementById('scanVideo');
    video.srcObject = scanStream;
    video.setAttribute('playsinline', true);
    await video.play();
    scanAnimFrame = requestAnimationFrame(scanFrame);

  } catch(e) {
    btn.disabled = false;
    btn.textContent = 'Allow Camera Access';
    document.getElementById('cameraPrompt').style.display = 'none';
    document.getElementById('scanArea').style.display = 'none';
    document.getElementById('scanPlaceholder').style.display = 'block';
    document.getElementById('cameraError').style.display = 'block';
  }
}

function skipToManual() {
  document.getElementById('cameraPrompt').style.display = 'none';
  document.getElementById('scanArea').style.display = 'none';
  document.getElementById('scanPlaceholder').style.display = 'block';
}

function showCameraUI() {
  document.getElementById('cameraPrompt').style.display = 'none';
  document.getElementById('scanArea').style.display = 'block';
  document.getElementById('scanPlaceholder').style.display = 'block';
}

async function launchCamera() {
  stopCamera();
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    const video = document.getElementById('scanVideo');
    video.srcObject = scanStream;
    video.setAttribute('playsinline', true);
    video.play();
    video.addEventListener('loadedmetadata', () => {
      requestAnimationFrame(scanFrame);
    }, { once: true });
  } catch(e) {
    document.getElementById('cameraError').style.display = 'block';
    document.getElementById('scanArea').style.display = 'none';
  }
}

function scanFrame() {
  if (scanPaused) return;
  const video = document.getElementById('scanVideo');
  const canvas = document.getElementById('scanCanvas');
  if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
    scanAnimFrame = requestAnimationFrame(scanFrame);
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Only scan centre region for performance
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  if (typeof jsQR !== 'undefined') {
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert'
    });
    if (code && code.data) {
      onQRDetected(code.data);
      return; // Stop loop until reset
    }
  }

  scanAnimFrame = requestAnimationFrame(scanFrame);
}

async function onQRDetected(rawData) {
  scanPaused = true;
  // Flash frame green
  document.getElementById('scanFrame').className = 'scan-frame detected';
  document.getElementById('scanStatus').textContent = '✓ QR Detected!';

  // Haptic feedback on mobile
  if (navigator.vibrate) navigator.vibrate(80);

  // Extract UUID - the QR contains a full URL, get the last path segment
  const parts = rawData.split('/');
  const qrCode = parts[parts.length - 1];

  toast('QR detected — looking up box...', '');

  try {
    const box = await api('GET', `/api/boxes/qr/${qrCode}`);
    scannedQR = box.qr_code;
    lastScannedBox = box;
    showScanResult(box);
  } catch(e) {
    // Maybe the raw data IS the UUID directly
    try {
      const box2 = await api('GET', `/api/boxes/qr/${rawData}`);
      scannedQR = box2.qr_code;
      lastScannedBox = box2;
      showScanResult(box2);
    } catch(e2) {
      toast('Box not found for this QR', 'error');
      document.getElementById('scanFrame').className = 'scan-frame';
      document.getElementById('manualQR').value = qrCode;
      // Resume scanning
      scanPaused = false;
      scanAnimFrame = requestAnimationFrame(scanFrame);
    }
  }
}

function resetScanner() {
  scannedQR = null;
  selectedScanStatus = '';
  scanPaused = false;
  scanPhotoDataUrl = null;
  document.getElementById('scanResult').style.display = 'none';
  document.getElementById('scanFrame').className = 'scan-frame';
  document.getElementById('scanStatus').textContent = 'Scanning...';
  document.getElementById('scanLocation').value = '';
  document.getElementById('scanNotes').value = '';
  document.getElementById('manualQR').value = '';
  const photoInput = document.getElementById('scanPhoto');
  if (photoInput) photoInput.value = '';
  const photoPreview = document.getElementById('photoPreview');
  if (photoPreview) photoPreview.style.display = 'none';
  scanAnimFrame = requestAnimationFrame(scanFrame);
}

function retryCamera() {
  document.getElementById('cameraError').style.display = 'none';
  document.getElementById('cameraPrompt').style.display = 'block';
  const btn = document.getElementById('cameraPermBtn');
  btn.disabled = false;
  btn.textContent = 'Allow Camera Access';
}

function showCameraUI() {} // no longer needed, kept for safety
function launchCamera() {}  // no longer needed, kept for safety

function stopCamera() {
  if (scanAnimFrame) { cancelAnimationFrame(scanAnimFrame); scanAnimFrame = null; }
  if (scanStream) { scanStream.getTracks().forEach(t => t.stop()); scanStream = null; }
  const video = document.getElementById('scanVideo');
  if (video) video.srcObject = null;
}

async function lookupManualQR() {
  const qr = document.getElementById('manualQR').value.trim();
  if (!qr) return;
  try {
    const box = await api('GET', `/api/boxes/qr/${qr}`);
    scannedQR = box.qr_code;
    lastScannedBox = box;
    showScanResult(box);
  } catch(e) {
    toast('Box not found: ' + e.message, 'error');
  }
}

function showScanResult(box) {
  const catIcon = { kitchen:'🍳', bedroom:'🛏️', electronics:'💻', fragile:'⚠️', clothes:'👕', books:'📚', bathroom:'🚿', general:'📦' };
  const statusColor = { packed:'#6366f1', loaded:'#f59e0b', in_transit:'#3b82f6', delivered:'#22c55e', created:'#94a3b8' };
  document.getElementById('scannedBoxCard').innerHTML = `
    <div class="sq-box-identity">
      <div class="sq-box-icon">${catIcon[box.category]||'📦'}</div>
      <div class="sq-box-info">
        <div class="sq-box-name">${box.label||'Unlabeled Box'}</div>
        ${box.move_title ? `<div class="sq-box-move">${box.move_title}</div>` : ''}
        ${box.contents ? `<div class="sq-box-contents">${box.contents}</div>` : ''}
      </div>
      <span class="sq-status-badge" style="background:${statusColor[box.status]||'#94a3b8'}18;color:${statusColor[box.status]||'#94a3b8'};border-color:${statusColor[box.status]||'#94a3b8'}33">${box.status.replace('_',' ')}</span>
    </div>
  `;
  selectedScanStatus = '';
  const nextIdx = STATUSES.indexOf(box.status) + 1;
  if (nextIdx > 0 && nextIdx < STATUSES.length) selectedScanStatus = STATUSES[nextIdx];

  const statusLabels = { packed:'Packed', loaded:'Loaded', in_transit:'In Transit', delivered:'Delivered' };
  document.getElementById('statusChips').innerHTML = STATUSES.map(s => `
    <button class="sq-chip ${s === selectedScanStatus ? 'sq-chip-active' : ''}" onclick="selectStatus('${s}',this)" data-status="${s}">
      <span class="sq-chip-dot" style="background:${statusColor[s]||'#94a3b8'}"></span>
      ${statusLabels[s]||s}
    </button>
  `).join('');

  document.getElementById('scanPlaceholder').style.display = 'none';
  document.getElementById('scanResult').style.display = 'block';
}

function selectStatus(s, el) {
  selectedScanStatus = s;
  document.querySelectorAll('#statusChips .sq-chip').forEach(c => c.classList.remove('sq-chip-active'));
  el.classList.add('sq-chip-active');
}

// ── State for success screen ──────────────────────────────────
let lastScannedBox = null;
let scanCountdownTimer = null;

async function submitScan() {
  if (!scannedQR || !selectedScanStatus) { toast('Select a status first', 'error'); return; }
  const btn = document.getElementById('scanSubmitBtn');
  btn.disabled = true; btn.textContent = 'Logging...';
  try {
    const result = await api('POST', `/api/boxes/scan/${scannedQR}`, {
      status: selectedScanStatus,
      location: document.getElementById('scanLocation').value,
      notes: document.getElementById('scanNotes').value,
      photo_url: scanPhotoDataUrl || null,
    });

    stopCamera();
    showScanSuccess(result, selectedScanStatus);

  } catch(e) { toast(e.message, 'error'); }
  btn.disabled = false; btn.textContent = 'Log Scan';
}

async function showScanSuccess(result, newStatus) {
  // Hide all other panels
  document.getElementById('scanResult').style.display = 'none';
  document.getElementById('scanArea').style.display = 'none';
  document.getElementById('scanPlaceholder').style.display = 'none';
  document.getElementById('cameraPrompt').style.display = 'none';

  const statusColor = { packed:'#6366f1', loaded:'#f59e0b', in_transit:'#3b82f6', delivered:'#22c55e' };
  const statusEmoji = { packed:'📦', loaded:'🚛', in_transit:'🛣️', delivered:'✅' };
  const statusLabel = { packed:'Packed', loaded:'Loaded onto truck', in_transit:'In Transit', delivered:'Delivered' };

  document.getElementById('scanSuccessTitle').textContent =
    newStatus === 'delivered' ? 'Delivered!' : 'Scan Logged';
  document.getElementById('scanSuccessSubtitle').textContent =
    `Status updated to "${statusLabel[newStatus] || newStatus}"`;

  const ring = document.getElementById('scanSuccessIcon');
  ring.style.background = `${statusColor[newStatus]||'#22c55e'}18`;
  ring.style.borderColor = `${statusColor[newStatus]||'#22c55e'}44`;
  ring.style.color = statusColor[newStatus] || '#22c55e';
  ring.style.animation = 'none';
  requestAnimationFrame(() => { ring.style.animation = 'successPulse 0.5s ease-out forwards'; });

  const catIcon = { kitchen:'🍳', bedroom:'🛏️', electronics:'💻', fragile:'⚠️', clothes:'👕', books:'📚', bathroom:'🚿', general:'📦' };
  const box = lastScannedBox || {};
  const loc = document.getElementById('scanLocation')?.value;
  const notes = document.getElementById('scanNotes')?.value;
  document.getElementById('scanSuccessCard').innerHTML = `
    <div class="sq-box-identity">
      <div class="sq-box-icon">${catIcon[box.category]||'📦'}</div>
      <div class="sq-box-info">
        <div class="sq-box-name">${box.label||'Box'}</div>
        ${box.move_title ? `<div class="sq-box-move">${box.move_title}</div>` : ''}
        ${loc ? `<div class="sq-box-contents">📍 ${loc}</div>` : ''}
        ${notes ? `<div class="sq-box-contents">📝 ${notes}</div>` : ''}
      </div>
      <span class="sq-status-badge" style="background:${statusColor[newStatus]||'#22c55e'}18;color:${statusColor[newStatus]||'#22c55e'};border-color:${statusColor[newStatus]||'#22c55e'}33">${statusLabel[newStatus]||newStatus}</span>
    </div>
  `;

  // Show "View Move" button if we have move info
  const moveBtn = document.getElementById('scanViewMoveBtn');
  if (box.move_id) {
    moveBtn.style.display = '';
    moveBtn.dataset.moveId = box.move_id;
  } else {
    moveBtn.style.display = 'none';
  }

  // Fetch + show move progress
  if (box.move_id) {
    try {
      const moveBoxes = await api('GET', `/api/boxes/move/${box.move_id}`);
      if (Array.isArray(moveBoxes) && moveBoxes.length > 0) {
        const total = moveBoxes.length;
        const delivered = moveBoxes.filter(b => b.status === 'delivered').length;
        const pct = Math.round((delivered / total) * 100);
        document.getElementById('scanProgressLabel').textContent = `${delivered} / ${total} boxes delivered`;
        document.getElementById('scanProgressBar').style.width = pct + '%';
        document.getElementById('scanProgressBar').style.background = pct === 100 ? '#22c55e' : 'var(--accent)';
        document.getElementById('scanSuccessProgress').style.display = '';
        requestAnimationFrame(() => {
          document.getElementById('scanProgressBar').style.width = pct + '%';
        });
      }
    } catch(e) { /* progress is optional */ }
  }

  // Show success screen
  document.getElementById('scanSuccess').style.display = '';

  // Countdown hint to scan next
  startScanCountdown();
}

function startScanCountdown() {
  if (scanCountdownTimer) clearInterval(scanCountdownTimer);
  let secs = 8;
  const el = document.getElementById('scanCountdown');
  el.textContent = `Camera will re-open in ${secs}s — or tap "Scan Next Box"`;
  scanCountdownTimer = setInterval(() => {
    secs--;
    if (secs <= 0) {
      clearInterval(scanCountdownTimer);
      scanCountdownTimer = null;
      el.textContent = '';
      scanNextBox();
    } else {
      el.textContent = `Camera will re-open in ${secs}s — or tap "Scan Next Box"`;
    }
  }, 1000);
}

function hideScanSuccess() {
  if (scanCountdownTimer) { clearInterval(scanCountdownTimer); scanCountdownTimer = null; }
  document.getElementById('scanSuccess').style.display = 'none';
  document.getElementById('scanCountdown').textContent = '';
  document.getElementById('scanSuccessProgress').style.display = 'none';
}

function scanNextBox() {
  hideScanSuccess();
  // Reset state
  scannedQR = null;
  selectedScanStatus = '';
  scanPhotoDataUrl = null;
  lastScannedBox = null;
  const photoInput = document.getElementById('scanPhoto');
  if (photoInput) photoInput.value = '';
  const photoPreview = document.getElementById('photoPreview');
  if (photoPreview) photoPreview.style.display = 'none';
  document.getElementById('scanLocation').value = '';
  document.getElementById('scanNotes').value = '';
  // Restart camera
  startCamera();
}

function scanNextBoxManual() {
  hideScanSuccess();
  scannedQR = null;
  selectedScanStatus = '';
  scanPhotoDataUrl = null;
  lastScannedBox = null;
  document.getElementById('scanLocation').value = '';
  document.getElementById('scanNotes').value = '';
  document.getElementById('scanResult').style.display = 'none';
  document.getElementById('cameraPrompt').style.display = 'none';
  document.getElementById('scanArea').style.display = 'none';
  document.getElementById('scanPlaceholder').style.display = 'block';
  document.getElementById('manualQR').value = '';
  document.getElementById('manualQR').focus();
}

function scanGoToMove() {
  hideScanSuccess();
  const moveId = document.getElementById('scanViewMoveBtn').dataset.moveId;
  if (moveId) {
    navTo('agent');
    // Give agent screen a tick to load then highlight the move
    setTimeout(() => { if (typeof loadAgentMoves === 'function') loadAgentMoves(); }, 100);
  }
}

