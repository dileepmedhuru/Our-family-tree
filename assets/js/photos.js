/**
 * photos.js
 * Handles photo uploads via FileReader and updates member data.
 */

/* ─── State ────────────────────────────────────────────────────────── */
let _pendingMemberId = null;
let _pendingCallback = null;

/* ─── Public API ───────────────────────────────────────────────────── */

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
  const globalInput = document.getElementById('globalPhotoInput');
  const formInput   = document.getElementById('formPhotoInput');

  globalInput.addEventListener('change', (e) => {
    readFile(e.target.files[0], (dataUrl) => {
      if (_pendingCallback) _pendingCallback(_pendingMemberId, dataUrl);
      _pendingMemberId = null;
      _pendingCallback = null;
    });
    globalInput.value = '';
  });

  formInput.addEventListener('change', (e) => {
    readFile(e.target.files[0], (dataUrl) => {
      if (_pendingCallback) _pendingCallback(null, dataUrl);
      _pendingCallback = null;
    });
    formInput.value = '';
  });
}

/* ─── Helpers ──────────────────────────────────────────────────────── */

function readFile(file, callback) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload  = (ev) => callback(ev.target.result);
  reader.onerror = () => console.error('FileReader error');
  reader.readAsDataURL(file);
}

function buildAvatarEl(member, size = 68) {
  const wrap = document.createElement('div');
  wrap.className = 'avatar';
  wrap.style.width  = size + 'px';
  wrap.style.height = size + 'px';

  if (member.photo) {
    const img = document.createElement('img');
    img.src = member.photo;
    img.alt = member.name;
    wrap.appendChild(img);
  } else {
    const span = document.createElement('div');
    span.className   = 'ini';
    span.textContent = initials(member.name);
    wrap.appendChild(span);
  }

  /* Camera overlay */
  const cam = document.createElement('div');
  cam.className = 'cam-hint';
  cam.innerHTML = '<i class="ti ti-camera" style="font-size:13px"></i>';
  cam.onclick = (e) => {
    e.stopPropagation();
    triggerPhotoUpload(member.id, (id, dataUrl) => {
      setPhoto(id, dataUrl);
      buildTree();
      if (document.getElementById('profileModal').classList.contains('open')) {
        openProfile(id);
      }
    });
  };
  wrap.appendChild(cam);

  return wrap;
}

function initials(name) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
}