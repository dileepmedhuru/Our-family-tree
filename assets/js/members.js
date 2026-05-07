/**
 * members.js
 * Data layer — Firebase Realtime Database (live sync across all devices).
 */

/* ─── FIREBASE CONFIG ──────────────────────────────────────────────── */
const firebaseConfig = {
    apiKey: "AIzaSyA5_j0_9OHkv6EZ18epK07yO2581ASGqwg",
    authDomain: "medhuru-family-tree.firebaseapp.com",
    databaseURL: "https://medhuru-family-tree-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "medhuru-family-tree",
    storageBucket: "medhuru-family-tree.firebasestorage.app",
    messagingSenderId: "348319277723",
    appId: "1:348319277723:web:a79def305dd86bbabadc3e"
  };

const DB_PATH = 'members';

let _members = [];
let _db      = null;
let _ready   = false;

/* ─── Seed data ────────────────────────────────────────────────────── */
const SEED_MEMBERS = [
  { id:1, name:"Raju",    dob:"1945-05-06", gender:"M", parentId:null, spouseId:2, photo:null, alarm:true,  note:"Patriarch" },
  { id:2, name:"Savitri", dob:"1948-09-14", gender:"F", parentId:null, spouseId:1, photo:null, alarm:false, note:"Matriarch" }
];

/* ═══════════════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════════════ */
function loadMembers() {
  _showSyncStatus('connecting');

  /* ── Check if Firebase SDK loaded ── */
  if (typeof firebase === 'undefined') {
    _showError('Firebase SDK failed to load. Check your internet connection and refresh.');
    _fallbackToLocalStorage();
    return;
  }

  /* ── Init Firebase (guard against double-init) ── */
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    _db = firebase.database();
  } catch (e) {
    _showError('Firebase init error: ' + e.message);
    _fallbackToLocalStorage();
    return;
  }

  /* ── Connection state indicator ── */
  firebase.database().ref('.info/connected').on('value', snap => {
    if (snap.val() === true) {
      _showSyncStatus('synced');
    } else {
      _showSyncStatus('offline');
    }
  });

  const ref = _db.ref(DB_PATH);

  /* ── Real-time listener ── */
  ref.on('value', snapshot => {
    const data = snapshot.val();

    if (!data) {
      /* Database empty — seed it */
      const seedObj = {};
      SEED_MEMBERS.forEach(m => { seedObj[m.id] = m; });
      ref.set(seedObj);
      _members = [...SEED_MEMBERS];
    } else {
      _members = Object.values(data).map(m => ({
        ...m,
        id:       Number(m.id),
        parentId: m.parentId ? Number(m.parentId) : null,
        spouseId: m.spouseId ? Number(m.spouseId) : null,
        photo:    m.photo    || null,
        alarm:    m.alarm    || false
      }));
    }

    _hideError();

    if (!_ready) {
      _ready = true;
      if (typeof buildTree          === 'function') buildTree();
      if (typeof startAlarmChecker  === 'function') startAlarmChecker();
    } else {
      if (typeof buildTree === 'function') buildTree();
    }

  }, err => {
    /* ── Firebase permission / rules error ── */
    console.error('Firebase read error:', err);

    let msg = '⚠️ Firebase error: ' + err.message;
    if (err.code === 'PERMISSION_DENIED') {
      msg = '🔒 Database rules are blocking access. Fix: Go to Firebase Console → Realtime Database → Rules → set both ".read" and ".write" to true → Publish.';
    }
    _showError(msg);
    _fallbackToLocalStorage();
  });
}

/* ─── Writes ───────────────────────────────────────────────────────── */
function saveMembers() {
  if (!_db) {
    try { localStorage.setItem('familyTreeData', JSON.stringify(_members)); } catch (_) {}
    return;
  }
  const obj = {};
  _members.forEach(m => { obj[m.id] = m; });
  _db.ref(DB_PATH).set(obj).catch(e => {
    _showError('Write failed: ' + e.message);
  });
}

function _saveSingleMember(m) {
  if (!_db) { saveMembers(); return; }
  _db.ref(`${DB_PATH}/${m.id}`).set(m).catch(e => {
    _showError('Save failed: ' + e.message);
  });
}

function _deleteSingleMember(id) {
  if (!_db) { saveMembers(); return; }
  _db.ref(`${DB_PATH}/${id}`).remove().catch(e => {
    _showError('Delete failed: ' + e.message);
  });
}

/* ─── Offline fallback ─────────────────────────────────────────────── */
function _fallbackToLocalStorage() {
  _showSyncStatus('offline');
  try {
    const raw = localStorage.getItem('familyTreeData');
    _members  = raw ? JSON.parse(raw) : [...SEED_MEMBERS];
  } catch (_) {
    _members = [...SEED_MEMBERS];
  }
  if (!_ready) {
    _ready = true;
    if (typeof buildTree         === 'function') buildTree();
    if (typeof startAlarmChecker === 'function') startAlarmChecker();
  }
}

/* ─── Status / error UI ────────────────────────────────────────────── */
function _showSyncStatus(state) {
  const el = document.getElementById('syncStatus');
  if (!el) return;
  const map = {
    connecting: { text:'⏳ Connecting…', color:'#a0702a' },
    synced:     { text:'🟢 Live',        color:'#5cb85c' },
    offline:    { text:'🟡 Offline',     color:'#e8a946' },
    error:      { text:'🔴 Error',       color:'#e05252' }
  };
  const s = map[state] || map.offline;
  el.textContent = s.text;
  el.style.color = s.color;
  if (state === 'synced') {
    setTimeout(() => { if (el.textContent === '🟢 Live') el.textContent = '🟢 Live'; }, 3000);
  }
}

function _showError(msg) {
  _showSyncStatus('error');
  let el = document.getElementById('firebaseError');
  if (!el) {
    el = document.createElement('div');
    el.id = 'firebaseError';
    el.style.cssText = [
      'position:fixed', 'bottom:16px', 'left:50%', 'transform:translateX(-50%)',
      'background:#2a0a0a', 'border:1px solid #e05252', 'border-radius:10px',
      'color:#f0c0c0', 'font-size:13px', 'max-width:90vw', 'padding:12px 16px',
      'z-index:9999', 'line-height:1.5', 'box-shadow:0 4px 24px rgba(0,0,0,.6)'
    ].join(';');
    document.body.appendChild(el);
  }
  el.innerHTML = msg + ' <button onclick="this.parentElement.remove()" style="margin-left:10px;background:none;border:none;color:#e05252;cursor:pointer;font-size:16px;">✕</button>';
}

function _hideError() {
  const el = document.getElementById('firebaseError');
  if (el) el.remove();
}

/* ═══════════════════════════════════════════════════════════════════
   PUBLIC API
═══════════════════════════════════════════════════════════════════ */
function getAllMembers()      { return [..._members]; }
function getMember(id)        { return _members.find(m => m.id === Number(id)); }
function getRoots()           { return _members.filter(m => !m.parentId); }
function getChildren(parentId){ return _members.filter(m => m.parentId === Number(parentId)); }

function addMember(data) {
  const maxId  = _members.reduce((acc, m) => Math.max(acc, m.id), 0);
  const member = {
    id:       maxId + 1,
    name:     data.name     || '',
    dob:      data.dob      || '',
    gender:   data.gender   || '',
    note:     data.note     || '',
    parentId: data.parentId || null,
    spouseId: null,
    photo:    data.photo    || null,
    alarm:    data.alarm    || false
  };
  _members.push(member);
  _saveSingleMember(member);
  return member;
}

function updateMember(id, updates) {
  const idx = _members.findIndex(m => m.id === Number(id));
  if (idx === -1) return;
  _members[idx] = { ..._members[idx], ...updates };
  _saveSingleMember(_members[idx]);
}

function deleteMember(id) {
  const member = getMember(id);
  if (!member) return;
  if (member.spouseId) {
    const sp = getMember(member.spouseId);
    if (sp) updateMember(sp.id, { spouseId: null });
  }
  getChildren(id).forEach(child => updateMember(child.id, { parentId: null }));
  _members = _members.filter(m => m.id !== Number(id));
  _deleteSingleMember(id);
}

function linkSpouses(idA, idB) {
  updateMember(idA, { spouseId: Number(idB) });
  updateMember(idB, { spouseId: Number(idA) });
}

function toggleAlarm(id) {
  const m = getMember(id);
  if (!m) return false;
  const newState = !m.alarm;
  updateMember(id, { alarm: newState });
  return newState;
}

function setPhoto(id, dataUrl) {
  updateMember(id, { photo: dataUrl });
}