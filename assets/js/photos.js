/**
 * photos.js  —  Photo upload handling
 */

let _pendingMemberId = null;
let _pendingCallback = null;

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
    readFile(e.target.files[0], url => {
      if (_pendingCallback) _pendingCallback(_pendingMemberId, url);
      _pendingMemberId = _pendingCallback = null;
    });
    e.target.value = '';
  });
  document.getElementById('formPhotoInput').addEventListener('change', e => {
    readFile(e.target.files[0], url => {
      if (_pendingCallback) _pendingCallback(null, url);
      _pendingCallback = null;
    });
    e.target.value = '';
  });
}

function readFile(file, cb) {
  if (!file) return;
  const r = new FileReader();
  r.onload = ev => cb(ev.target.result);
  r.readAsDataURL(file);
}

function initials(name) {
  return (name || '?').split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
}

function buildAvatarEl(member, size) {
  size = size || 72;
  const wrap = document.createElement('div');
  wrap.className = 'avatar';
  wrap.style.cssText = `width:${size}px;height:${size}px`;

  if (member.photo) {
    const img = document.createElement('img');
    img.src = member.photo; img.alt = member.name;
    wrap.appendChild(img);
  } else {
    const s = document.createElement('div');
    s.className = 'ini'; s.textContent = initials(member.name);
    wrap.appendChild(s);
  }

  const cam = document.createElement('div');
  cam.className = 'cam-hint';
  cam.innerHTML = '📷';
  cam.onclick = e => {
    e.stopPropagation();
    triggerPhotoUpload(member.id, (id, url) => {
      setPhoto(id, url);
      // refresh whatever is visible
      if (typeof refreshCurrentPage === 'function') refreshCurrentPage();
    });
  };
  wrap.appendChild(cam);
  return wrap;
}