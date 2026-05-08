/**
 * photos.js
 * Photo upload with drag-to-reposition + zoom crop modal.
 */

/* ── State ─────────────────────────────────────────────────── */
let _pendingMemberId = null;
let _pendingCallback = null;

// Crop state
let _cropCallback  = null;  // called with cropped dataUrl
let _cropImgSrc    = null;
let _cropNatW      = 0;
let _cropNatH      = 0;
let _cropX         = 0;     // image top-left offset in viewport
let _cropY         = 0;
let _cropZoom      = 1;
let _cropDragging  = false;
let _cropLastX     = 0;
let _cropLastY     = 0;

const CROP_SIZE    = 260;   // viewport px
const CROP_RADIUS  = 108;   // circle radius px

/* ── File triggers ──────────────────────────────────────────── */
function triggerPhotoUpload(memberId, callback) {
  _pendingMemberId = memberId;
  _pendingCallback = callback;
  document.getElementById('globalPhotoInput').click();
}

function triggerFormPhotoUpload(callback) {
  _pendingMemberId = null;
  _pendingCallback = callback;
  document.getElementById('formPhotoInput').click();
}

function initPhotoInputs() {
  document.getElementById('globalPhotoInput').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    _readAndOpenCrop(file, croppedUrl => {
      if (_pendingCallback) _pendingCallback(_pendingMemberId, croppedUrl);
      _pendingMemberId = _pendingCallback = null;
    });
  });

  document.getElementById('formPhotoInput').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    _readAndOpenCrop(file, croppedUrl => {
      if (_pendingCallback) _pendingCallback(null, croppedUrl);
      _pendingCallback = null;
    });
  });
}

/* ── Read file → open crop modal ───────────────────────────── */
function _readAndOpenCrop(file, callback) {
  const reader = new FileReader();
  reader.onload = ev => {
    _cropCallback = callback;
    _openCropModal(ev.target.result);
  };
  reader.readAsDataURL(file);
}

/* ── Crop modal ─────────────────────────────────────────────── */
function _openCropModal(src) {
  _cropImgSrc = src;
  const img   = document.getElementById('cropImg');
  const modal = document.getElementById('cropModal');

  img.onload = () => {
    _cropNatW = img.naturalWidth;
    _cropNatH = img.naturalHeight;
    _cropZoom = 1;

    // Center image in viewport at zoom=1
    const initScale = Math.max(CROP_SIZE / _cropNatW, CROP_SIZE / _cropNatH);
    _cropZoom = initScale;
    document.getElementById('cropZoom').min   = initScale;
    document.getElementById('cropZoom').value = initScale;
    document.getElementById('cropZoom').max   = initScale * 4;

    _cropX = (CROP_SIZE - _cropNatW * initScale) / 2;
    _cropY = (CROP_SIZE - _cropNatH * initScale) / 2;
    _applyCropTransform();
    _clampCrop();
    _applyCropTransform();
    document.getElementById('cropZoomVal').textContent = (initScale).toFixed(1) + 'x';
  };
  img.src = src;

  modal.classList.add('open');
  _bindCropEvents();
}

function closeCropModal() {
  document.getElementById('cropModal').classList.remove('open');
  _unbindCropEvents();
  _cropCallback = null;
}

function confirmCrop() {
  const canvas = document.createElement('canvas');
  const OUTPUT = 300;
  canvas.width  = OUTPUT;
  canvas.height = OUTPUT;
  const ctx = canvas.getContext('2d');

  // Draw circle clip
  ctx.beginPath();
  ctx.arc(OUTPUT / 2, OUTPUT / 2, OUTPUT / 2, 0, Math.PI * 2);
  ctx.clip();

  // What portion of the original image is visible inside the circle?
  // Circle centre in viewport = (CROP_SIZE/2, CROP_SIZE/2)
  // Image is at (_cropX, _cropY) with scale _cropZoom
  const scale  = _cropZoom;
  const srcX   = (CROP_SIZE / 2 - CROP_RADIUS - _cropX) / scale;
  const srcY   = (CROP_SIZE / 2 - CROP_RADIUS - _cropY) / scale;
  const srcW   = (CROP_RADIUS * 2) / scale;
  const srcH   = (CROP_RADIUS * 2) / scale;

  const img = document.getElementById('cropImg');
  ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, OUTPUT, OUTPUT);

  const croppedUrl = canvas.toDataURL('image/jpeg', 0.92);
  closeCropModal();
  if (_cropCallback) _cropCallback(croppedUrl);
}

/* ── Transform helpers ──────────────────────────────────────── */
function _applyCropTransform() {
  const img = document.getElementById('cropImg');
  img.style.transform = `translate(${_cropX}px, ${_cropY}px) scale(${_cropZoom})`;
  img.style.transformOrigin = '0 0';
  img.style.width  = _cropNatW + 'px';
  img.style.height = _cropNatH + 'px';
}

function _clampCrop() {
  const w = _cropNatW * _cropZoom;
  const h = _cropNatH * _cropZoom;
  // The circle area: from CROP_SIZE/2 - CROP_RADIUS to CROP_SIZE/2 + CROP_RADIUS
  const minX = CROP_SIZE / 2 + CROP_RADIUS - w;   // image right edge must cover circle right
  const maxX = CROP_SIZE / 2 - CROP_RADIUS;        // image left edge must cover circle left
  const minY = CROP_SIZE / 2 + CROP_RADIUS - h;
  const maxY = CROP_SIZE / 2 - CROP_RADIUS;
  _cropX = Math.min(maxX, Math.max(minX, _cropX));
  _cropY = Math.min(maxY, Math.max(minY, _cropY));
}

/* ── Event binding ──────────────────────────────────────────── */
function _bindCropEvents() {
  const vp   = document.querySelector('.crop-viewport');
  const zoom = document.getElementById('cropZoom');
  if (!vp) return;

  // Mouse drag
  vp.addEventListener('mousedown',  _onCropMouseDown);
  window.addEventListener('mousemove', _onCropMouseMove);
  window.addEventListener('mouseup',   _onCropMouseUp);

  // Touch drag
  vp.addEventListener('touchstart',  _onCropTouchStart,  { passive: false });
  vp.addEventListener('touchmove',   _onCropTouchMove,   { passive: false });
  vp.addEventListener('touchend',    _onCropTouchEnd);

  // Scroll zoom
  vp.addEventListener('wheel', _onCropWheel, { passive: false });

  // Slider zoom
  zoom.addEventListener('input', _onCropZoomSlider);
}

function _unbindCropEvents() {
  const vp   = document.querySelector('.crop-viewport');
  const zoom = document.getElementById('cropZoom');
  if (!vp) return;
  vp.removeEventListener('mousedown',  _onCropMouseDown);
  window.removeEventListener('mousemove', _onCropMouseMove);
  window.removeEventListener('mouseup',   _onCropMouseUp);
  vp.removeEventListener('touchstart',  _onCropTouchStart);
  vp.removeEventListener('touchmove',   _onCropTouchMove);
  vp.removeEventListener('touchend',    _onCropTouchEnd);
  vp.removeEventListener('wheel',       _onCropWheel);
  if (zoom) zoom.removeEventListener('input', _onCropZoomSlider);
}

function _onCropMouseDown(e) {
  _cropDragging = true;
  _cropLastX = e.clientX; _cropLastY = e.clientY;
}
function _onCropMouseMove(e) {
  if (!_cropDragging) return;
  _cropX += e.clientX - _cropLastX;
  _cropY += e.clientY - _cropLastY;
  _cropLastX = e.clientX; _cropLastY = e.clientY;
  _clampCrop(); _applyCropTransform();
}
function _onCropMouseUp() { _cropDragging = false; }

let _lastTouchDist = 0;
function _onCropTouchStart(e) {
  e.preventDefault();
  if (e.touches.length === 1) {
    _cropDragging = true;
    _cropLastX = e.touches[0].clientX;
    _cropLastY = e.touches[0].clientY;
  } else if (e.touches.length === 2) {
    _lastTouchDist = _touchDist(e.touches);
  }
}
function _onCropTouchMove(e) {
  e.preventDefault();
  if (e.touches.length === 1 && _cropDragging) {
    _cropX += e.touches[0].clientX - _cropLastX;
    _cropY += e.touches[0].clientY - _cropLastY;
    _cropLastX = e.touches[0].clientX;
    _cropLastY = e.touches[0].clientY;
    _clampCrop(); _applyCropTransform();
  } else if (e.touches.length === 2) {
    const dist  = _touchDist(e.touches);
    const delta = dist - _lastTouchDist;
    _lastTouchDist = dist;
    _applyZoomDelta(delta * 0.005);
  }
}
function _onCropTouchEnd() { _cropDragging = false; }

function _onCropWheel(e) {
  e.preventDefault();
  _applyZoomDelta(-e.deltaY * 0.001);
}

function _onCropZoomSlider() {
  const slider = document.getElementById('cropZoom');
  const newZ   = parseFloat(slider.value);
  // Zoom around centre of viewport
  const cx = CROP_SIZE / 2, cy = CROP_SIZE / 2;
  _cropX = cx - (cx - _cropX) * (newZ / _cropZoom);
  _cropY = cy - (cy - _cropY) * (newZ / _cropZoom);
  _cropZoom = newZ;
  document.getElementById('cropZoomVal').textContent = newZ.toFixed(1) + 'x';
  _clampCrop(); _applyCropTransform();
}

function _applyZoomDelta(delta) {
  const slider = document.getElementById('cropZoom');
  const minZ   = parseFloat(slider.min);
  const maxZ   = parseFloat(slider.max);
  const newZ   = Math.min(maxZ, Math.max(minZ, _cropZoom + delta));
  const cx     = CROP_SIZE / 2, cy = CROP_SIZE / 2;
  _cropX = cx - (cx - _cropX) * (newZ / _cropZoom);
  _cropY = cy - (cy - _cropY) * (newZ / _cropZoom);
  _cropZoom = newZ;
  slider.value = newZ;
  document.getElementById('cropZoomVal').textContent = newZ.toFixed(1) + 'x';
  _clampCrop(); _applyCropTransform();
}

function _touchDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

/* ── Avatar builder (unchanged interface) ───────────────────── */
function initials(name) {
  return (name || '?').split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
}

function buildAvatarEl(member, size) {
  size = size || 72;
  const wrap = document.createElement('div');
  wrap.className = 'avatar';
  wrap.style.cssText = 'width:' + size + 'px;height:' + size + 'px';

  if (member.photo) {
    const img = document.createElement('img');
    img.src = member.photo; img.alt = member.name;
    wrap.appendChild(img);
  } else {
    const s = document.createElement('div');
    s.className = 'ini';
    s.style.fontSize = Math.floor(size * 0.3) + 'px';
    s.textContent = initials(member.name);
    wrap.appendChild(s);
  }

  const cam = document.createElement('div');
  cam.className = 'cam-hint';
  cam.innerHTML = '📷';
  cam.onclick = e => {
    e.stopPropagation();
    triggerPhotoUpload(member.id, (id, url) => {
      setPhoto(id, url);
      if (typeof refreshCurrentPage === 'function') refreshCurrentPage();
      // Refresh drawer if open
      const drawer = document.getElementById('profileDrawer');
      if (drawer && drawer.classList.contains('open') && id === _pendingMemberId) {
        const m = getMember(id);
        if (m && typeof _renderProfileView === 'function') _renderProfileView(m);
      }
    });
  };
  wrap.appendChild(cam);
  return wrap;
}

function readFile(file, cb) {
  const r = new FileReader();
  r.onload = ev => cb(ev.target.result);
  r.readAsDataURL(file);
}