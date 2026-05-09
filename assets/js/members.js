/**
 * members.js  —  Data layer: Firebase + localStorage fallback
 * FIREBASE_CONFIG is loaded from assets/js/config.js (gitignored)
 */

const DB_PATH = 'members';
const LS_KEY  = 'medhuru_members';

let _members = [];
let _db      = null;
let _ready   = false;

function loadMembers() {
  setSyncStatus('connecting');
  if (typeof firebase === 'undefined') {
    let t = 0;
    const iv = setInterval(() => {
      t += 100;
      if (typeof firebase !== 'undefined') { clearInterval(iv); _initFB(); }
      else if (t >= 5000) { clearInterval(iv); _fallback(); }
    }, 100);
    return;
  }
  _initFB();
}

function _initFB() {
  try {
    if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    _db = firebase.database();
  } catch(e) { _fallback(); return; }

  firebase.database().ref('.info/connected').on('value', snap => {
    setSyncStatus(snap.val() ? 'synced' : 'offline');
  });
  _listenOrders();

  _db.ref(DB_PATH).on('value', snap => {
    const data = snap.val();
    if (!data) {
      _members = [];
    } else {
      _members = Object.values(data).map(m => ({
        ...m, id: +m.id,
        parentId: m.parentId != null ? +m.parentId : null,
        spouseId: m.spouseId != null ? +m.spouseId : null,
        photo: m.photo || null, alarm: !!m.alarm
      }));
    }
    if (!_ready) { _ready = true; if (typeof onDataReady === 'function') onDataReady(); }
    else { if (typeof onDataUpdate === 'function') onDataUpdate(); }
  }, err => {
    console.error(err);
    _fallback();
  });
}

function _fallback() {
  setSyncStatus('offline');
  _listenOrders();
  try {
    const raw = localStorage.getItem(LS_KEY);
    _members  = raw ? JSON.parse(raw) : [];
  } catch (_) { _members = []; }
  if (!_ready) { _ready = true; if (typeof onDataReady === 'function') onDataReady(); }
}

function _persist(m) {
  if (_db) { _db.ref(`${DB_PATH}/${m.id}`).set(m); return; }
  try { localStorage.setItem(LS_KEY, JSON.stringify(_members)); } catch(_) {}
}
function _persistDelete(id) {
  if (_db) { _db.ref(`${DB_PATH}/${id}`).remove(); return; }
  try { localStorage.setItem(LS_KEY, JSON.stringify(_members)); } catch(_) {}
}

function getAllMembers()   { return [..._members]; }
function getMember(id)    { return _members.find(m => m.id === +id) || null; }
function getRoots()       { return _members.filter(m => !m.parentId); }
function getChildren(pid) { return _members.filter(m => m.parentId === +pid); }

function addMember(data) {
  const maxId = _members.reduce((a, m) => Math.max(a, m.id), 0);
  const m = {
    id: maxId + 1, name: data.name || '', dob: data.dob || '',
    gender: data.gender || '', note: data.note || '',
    parentId: data.parentId || null, spouseId: null,
    photo: data.photo || null, alarm: data.alarm || false
  };
  _members.push(m); _persist(m); return m;
}

function updateMember(id, fields) {
  const idx = _members.findIndex(m => m.id === +id);
  if (idx === -1) return;
  Object.assign(_members[idx], fields); _persist(_members[idx]);
}

function deleteMember(id) {
  const m = getMember(id); if (!m) return;
  if (m.spouseId) updateMember(m.spouseId, { spouseId: null });
  getChildren(id).forEach(c => updateMember(c.id, { parentId: null }));
  _members = _members.filter(x => x.id !== +id);
  _persistDelete(id);
}

function linkSpouses(a, b) {
  updateMember(a, { spouseId: +b });
  updateMember(b, { spouseId: +a });
}

function toggleAlarm(id) {
  const m = getMember(id); if (!m) return false;
  const v = !m.alarm; updateMember(id, { alarm: v }); return v;
}

function setPhoto(id, dataUrl) { updateMember(id, { photo: dataUrl }); }

// ── Member order ──────────────────────────────────────────────
function getGroupOrder(parentId) {
  const key = 'order_' + (parentId || 0);
  if (_db) return _orderCache[key] || null;
  try {
    const raw = localStorage.getItem('medhuru_' + key);
    return raw ? JSON.parse(raw) : null;
  } catch(_) { return null; }
}

function setGroupOrder(parentId, idArray) {
  const key = 'order_' + (parentId || 0);
  if (_db) {
    _db.ref('orders/' + key).set(idArray);
    _orderCache[key] = idArray;
    return;
  }
  try { localStorage.setItem('medhuru_' + key, JSON.stringify(idArray)); } catch(_) {}
}

let _orderCache = {};

function _listenOrders() {
  if (!_db) return;
  _db.ref('orders').on('value', snap => {
    _orderCache = snap.val() || {};
  });
}

function applyOrder(parentId, members) {
  const order = getGroupOrder(parentId);
  if (!order || !order.length) return members;
  const map = new Map(members.map(m => [m.id, m]));
  const sorted = [];
  order.forEach(id => { if (map.has(id)) { sorted.push(map.get(id)); map.delete(id); } });
  map.forEach(m => sorted.push(m));
  return sorted;
}