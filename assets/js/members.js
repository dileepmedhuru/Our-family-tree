/**
 * members.js
 * Data layer: load/save/query family members from localStorage.
 */

const STORAGE_KEY = 'familyTreeData';
let _members = [];

/* ─── Load / Save ──────────────────────────────────────────────────── */

function loadMembers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      _members = JSON.parse(raw);
    } else {
      /* Seed with default data */
      _members = [
        {
          id: 1,
          name: "Raju",
          dob: "1945-05-06",
          gender: "M",
          parentId: null,
          spouseId: 2,
          photo: null,
          alarm: true,
          note: "Patriarch"
        },
        {
          id: 2,
          name: "Savitri",
          dob: "1948-09-14",
          gender: "F",
          parentId: null,
          spouseId: 1,
          photo: null,
          alarm: false,
          note: "Matriarch"
        }
      ];
      saveMembers();
    }
  } catch (e) {
    console.error('loadMembers failed', e);
    _members = [];
  }
}

function saveMembers() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_members));
  } catch (e) {
    console.error('saveMembers failed', e);
  }
}

/* ─── Queries ──────────────────────────────────────────────────────── */

/** Return a shallow copy of all members. */
function getAllMembers() {
  return [..._members];
}

/** Return a single member by id, or undefined. */
function getMember(id) {
  return _members.find(m => m.id === id);
}

/** Return all root members (no parentId). */
function getRoots() {
  return _members.filter(m => !m.parentId);
}

/** Return direct children of parentId. */
function getChildren(parentId) {
  return _members.filter(m => m.parentId === parentId);
}

/* ─── Mutations ────────────────────────────────────────────────────── */

/**
 * Add a new member and return it.
 * @param {object} data  { name, dob, gender, note, parentId, photo, alarm }
 * @returns {object} the new member
 */
function addMember(data) {
  const maxId = _members.reduce((acc, m) => Math.max(acc, m.id), 0);
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
  saveMembers();
  return member;
}

/**
 * Update an existing member's fields.
 * @param {number} id
 * @param {object} updates  partial fields to merge
 */
function updateMember(id, updates) {
  const idx = _members.findIndex(m => m.id === id);
  if (idx === -1) return;
  _members[idx] = { ..._members[idx], ...updates };
  saveMembers();
}

/**
 * Delete a member by id.
 * Also removes spouse links and orphans children (sets parentId to null).
 * @param {number} id
 */
function deleteMember(id) {
  const member = getMember(id);
  if (!member) return;

  /* Unlink spouse */
  if (member.spouseId) {
    const sp = getMember(member.spouseId);
    if (sp) updateMember(sp.id, { spouseId: null });
  }

  /* Orphan children */
  getChildren(id).forEach(child => updateMember(child.id, { parentId: null }));

  /* Remove */
  _members = _members.filter(m => m.id !== id);
  saveMembers();
}

/**
 * Link two members as spouses (bidirectional).
 * @param {number} idA
 * @param {number} idB
 */
function linkSpouses(idA, idB) {
  updateMember(idA, { spouseId: idB });
  updateMember(idB, { spouseId: idA });
}

/**
 * Toggle birthday alarm for a member.
 * @param {number} id
 * @returns {boolean}  new alarm state
 */
function toggleAlarm(id) {
  const m = getMember(id);
  if (!m) return false;
  const newState = !m.alarm;
  updateMember(id, { alarm: newState });
  return newState;
}

/**
 * Set a member's photo (base64 dataURL).
 * @param {number} id
 * @param {string} dataUrl
 */
function setPhoto(id, dataUrl) {
  updateMember(id, { photo: dataUrl });
}