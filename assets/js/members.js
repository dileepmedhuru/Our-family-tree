/**
 * members.js  —  Data layer: Firebase + localStorage fallback
 */

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyC5jEYWBqGA0jdTZDU4vZPGaZCyHtyTUMk",
  authDomain:        "medhurur-family-tree.firebaseapp.com",
  databaseURL:       "https://medhurur-family-tree-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "medhurur-family-tree",
  storageBucket:     "medhurur-family-tree.firebasestorage.app",
  messagingSenderId: "655190326543",
  appId:             "1:655190326543:web:3c48c890b93df9d18cd27a"
};

const DB_PATH = 'members';
const LS_KEY  = 'medhuru_members';

let _members = [];
let _db      = null;
let _ready   = false;

const SEED = [
  { id:1,  name:"Yellaiah",  dob:"1930-01-15", gender:"M", parentId:null, spouseId:2,    photo:null, alarm:false, note:"Patriarch" },
  { id:2,  name:"Vanamma",   dob:"1935-06-20", gender:"F", parentId:null, spouseId:1,    photo:null, alarm:false, note:"Matriarch" },
  { id:3,  name:"Munuswamy", dob:"1955-03-10", gender:"M", parentId:1,    spouseId:4,    photo:null, alarm:false, note:"" },
  { id:4,  name:"Lakshmi",   dob:"1958-07-22", gender:"F", parentId:null, spouseId:3,    photo:null, alarm:false, note:"" },
  { id:5,  name:"Raju",      dob:"1957-11-05", gender:"M", parentId:1,    spouseId:6,    photo:null, alarm:false, note:"" },
  { id:6,  name:"Savitri",   dob:"1960-04-18", gender:"F", parentId:null, spouseId:5,    photo:null, alarm:false, note:"" },
  { id:7,  name:"Suresh",    dob:"1959-08-30", gender:"M", parentId:1,    spouseId:8,    photo:null, alarm:false, note:"" },
  { id:8,  name:"Padma",     dob:"1962-02-14", gender:"F", parentId:null, spouseId:7,    photo:null, alarm:false, note:"" },
  { id:9,  name:"Venkat",    dob:"1961-12-01", gender:"M", parentId:1,    spouseId:10,   photo:null, alarm:false, note:"" },
  { id:10, name:"Kamala",    dob:"1964-09-25", gender:"F", parentId:null, spouseId:9,    photo:null, alarm:false, note:"" },
  { id:11, name:"Ramaiah",   dob:"1963-05-17", gender:"M", parentId:1,    spouseId:12,   photo:null, alarm:false, note:"" },
  { id:12, name:"Bhavani",   dob:"1966-11-08", gender:"F", parentId:null, spouseId:11,   photo:null, alarm:false, note:"" },
  { id:13, name:"Srinivas",  dob:"1965-07-03", gender:"M", parentId:1,    spouseId:14,   photo:null, alarm:false, note:"" },
  { id:14, name:"Meena",     dob:"1968-03-29", gender:"F", parentId:null, spouseId:13,   photo:null, alarm:false, note:"" },
  { id:15, name:"Anitha",    dob:"1967-09-12", gender:"F", parentId:1,    spouseId:16,   photo:null, alarm:false, note:"" },
  { id:16, name:"Krishna",   dob:"1964-06-05", gender:"M", parentId:null, spouseId:15,   photo:null, alarm:false, note:"" },
  { id:17, name:"Arun",      dob:"1980-04-22", gender:"M", parentId:3,    spouseId:null, photo:null, alarm:true,  note:"" },
  { id:18, name:"Priya",     dob:"1983-08-15", gender:"F", parentId:3,    spouseId:null, photo:null, alarm:true,  note:"" },
  { id:19, name:"Kiran",     dob:"1982-01-30", gender:"M", parentId:5,    spouseId:null, photo:null, alarm:true,  note:"" },
  { id:20, name:"Deepa",     dob:"1984-06-11", gender:"F", parentId:5,    spouseId:null, photo:null, alarm:true,  note:"" },
  { id:21, name:"Naveen",    dob:"1985-11-20", gender:"M", parentId:7,    spouseId:null, photo:null, alarm:true,  note:"" },
  { id:22, name:"Suma",      dob:"1988-03-05", gender:"F", parentId:7,    spouseId:null, photo:null, alarm:true,  note:"" },
  { id:23, name:"Rahul",     dob:"2005-07-18", gender:"M", parentId:17,   spouseId:null, photo:null, alarm:true,  note:"" },
  { id:24, name:"Sneha",     dob:"2008-12-03", gender:"F", parentId:17,   spouseId:null, photo:null, alarm:true,  note:"" }
];

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
      const obj = {}; SEED.forEach(m => { obj[m.id] = m; });
      _db.ref(DB_PATH).set(obj);
      _members = JSON.parse(JSON.stringify(SEED));
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
  _listenOrders(); // no-op for localStorage path, but safe to call
  try {
    const raw = localStorage.getItem(LS_KEY);
    _members  = raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(SEED));
  } catch (_) { _members = JSON.parse(JSON.stringify(SEED)); }
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
// Stores an explicit sort order per parent group.
// Key: "order_<parentId>"  (parentId=0 means root/gen1 group)
// Value: array of member ids in display order

function getGroupOrder(parentId) {
  const key = 'order_' + (parentId || 0);
  if (_db) {
    // Sync read from local cache — Firebase listener keeps _orderCache fresh
    return _orderCache[key] || null;
  }
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

// Local cache so reads are synchronous even with Firebase
let _orderCache = {};

function _listenOrders() {
  if (!_db) return;
  _db.ref('orders').on('value', snap => {
    _orderCache = snap.val() || {};
  });
}

/**
 * Apply saved order to a list of members.
 * Members not in the saved order are appended at the end.
 */
function applyOrder(parentId, members) {
  const order = getGroupOrder(parentId);
  if (!order || !order.length) return members;
  const map = new Map(members.map(m => [m.id, m]));
  const sorted = [];
  order.forEach(id => { if (map.has(id)) { sorted.push(map.get(id)); map.delete(id); } });
  map.forEach(m => sorted.push(m)); // append any new members not yet in order
  return sorted;
}