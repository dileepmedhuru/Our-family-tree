/**
 * app.js
 * Core application: tree rendering, card building, all modal logic.
 * Depends on: members.js, photos.js, alarms.js, search.js
 */

/* ─── Global tree state ────────────────────────────────────────────── */
const expandedIds = new Set([1]);  /* IDs that are currently expanded */

/* ─── Bootstrap ────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  loadMembers();
  initPhotoInputs();
  initSearch();
  buildTree();
  startAlarmChecker();
  initAddModal();
});

/* ═══════════════════════════════════════════════════════════════════
   TREE RENDERING
═══════════════════════════════════════════════════════════════════ */

function buildTree() {
  const canvas = document.getElementById('treeCanvas');
  canvas.innerHTML = '';

  /* Group root members into couples */
  const roots  = getRoots();
  const seen   = new Set();
  const couples = [];

  roots.forEach(m => {
    if (seen.has(m.id)) return;
    if (m.spouseId) {
      const sp = getMember(m.spouseId);
      if (sp && !sp.parentId) {
        couples.push([m, sp]);
        seen.add(m.id);
        seen.add(sp.id);
        return;
      }
    }
    couples.push([m]);
    seen.add(m.id);
  });

  /* Generation 0 — great-grandparents */
  const rootSec = makeSectionLabel('Great-Grandparents');
  canvas.appendChild(rootSec);

  const rootRow = document.createElement('div');
  rootRow.className = 'level';
  couples.forEach(grp => rootRow.appendChild(makeCoupleEl(grp)));
  canvas.appendChild(rootRow);

  /* Recursively expand each patriarch / solo root */
  roots
    .filter(m => m.gender === 'M' || !m.spouseId)
    .forEach(m => {
      if (expandedIds.has(m.id)) renderChildren(m.id, canvas, 0);
    });

  checkBirthdayAlarms();
  updateStats();
}

/* ─── Recursive children renderer ─────────────────────────────────── */
const GEN_LABELS = ['Children', 'Grandchildren', 'Great-Grandchildren', 'Generation 4', 'Generation 5'];

function renderChildren(parentId, container, depth) {
  const children = getChildren(parentId);
  if (!children.length) return;

  container.appendChild(makeVConnector());
  container.appendChild(makeSectionLabel(GEN_LABELS[depth] || `Generation ${depth + 2}`));

  const hWrap = document.createElement('div');
  hWrap.className = 'connector-h-wrap';

  const sibRow = document.createElement('div');
  sibRow.className = 'siblings-row';
  if (children.length === 1) sibRow.style.cssText = 'display:flex;gap:14px;justify-content:center;';

  children.forEach(child => {
    const col = document.createElement('div');
    col.className = 'node-col';
    col.appendChild(makeVConnectorSmall());

    const cr = document.createElement('div');
    cr.className = 'couple-row';
    cr.appendChild(makeCard(child));

    if (child.spouseId) {
      const sp = getMember(child.spouseId);
      if (sp) {
        cr.appendChild(makeHeartBadge());
        cr.appendChild(makeCard(sp));
      }
    }
    col.appendChild(cr);

    if (expandedIds.has(child.id)) {
      const sub = document.createElement('div');
      sub.style.cssText = 'display:flex;flex-direction:column;align-items:center;';
      renderChildrenInto(child.id, sub, depth + 1);
      col.appendChild(sub);
    }

    sibRow.appendChild(col);
  });

  hWrap.appendChild(sibRow);
  container.appendChild(hWrap);
}

function renderChildrenInto(parentId, container, depth) {
  const children = getChildren(parentId);
  if (!children.length) return;

  container.appendChild(makeVConnector());
  container.appendChild(makeSectionLabel(GEN_LABELS[depth] || `Generation ${depth + 2}`));

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;gap:14px;justify-content:center;';

  children.forEach(child => {
    const col = document.createElement('div');
    col.className = 'node-col';
    col.appendChild(makeVConnectorSmall());

    const cr = document.createElement('div');
    cr.className = 'couple-row';
    cr.appendChild(makeCard(child));

    if (child.spouseId) {
      const sp = getMember(child.spouseId);
      if (sp) { cr.appendChild(makeHeartBadge()); cr.appendChild(makeCard(sp)); }
    }
    col.appendChild(cr);

    if (expandedIds.has(child.id)) {
      const sub = document.createElement('div');
      sub.style.cssText = 'display:flex;flex-direction:column;align-items:center;';
      renderChildrenInto(child.id, sub, depth + 1);
      col.appendChild(sub);
    }
    wrap.appendChild(col);
  });

  container.appendChild(wrap);
}

/* ═══════════════════════════════════════════════════════════════════
   CARD BUILDER
═══════════════════════════════════════════════════════════════════ */

function makeCard(m) {
  const card = document.createElement('div');
  card.className = 'card';

  const d = daysUntilBirthday(m.dob);
  if (d === 0 && m.alarm)  card.classList.add('bday-ring');
  if (expandedIds.has(m.id)) card.classList.add('selected');

  /* Birthday dot */
  if (m.alarm && d !== null && d <= 7) {
    const dot = document.createElement('div');
    dot.className = 'bday-dot';
    dot.title = d === 0 ? 'Birthday today!' : `Birthday in ${d} days`;
    card.appendChild(dot);
  }

  /* Bell button */
  const bell = document.createElement('button');
  bell.className = 'bell-btn' + (m.alarm ? ' on' : '');
  bell.innerHTML = '<i class="ti ti-bell" style="font-size:13px"></i>';
  bell.title = m.alarm ? 'Alarm on — click to disable' : 'Click to set birthday alarm';
  bell.setAttribute('aria-label', 'Toggle birthday alarm for ' + m.name);
  bell.onclick = e => { e.stopPropagation(); toggleAlarm(m.id); buildTree(); };
  card.appendChild(bell);

  /* Avatar */
  card.appendChild(buildAvatarEl(m, 68));

  /* Name */
  const nm = document.createElement('div');
  nm.className = 'card-name';
  nm.textContent = m.name;
  card.appendChild(nm);

  /* DOB */
  if (m.dob) {
    const db = document.createElement('div');
    db.className = 'card-dob';
    db.textContent = formatDob(m.dob);
    card.appendChild(db);
  }

  /* Note / occupation */
  if (m.note) {
    const nt = document.createElement('div');
    nt.className = 'card-note';
    nt.textContent = m.note;
    card.appendChild(nt);
  }

  /* Expand hint */
  const childCount = getChildren(m.id).length;
  if (childCount > 0 || !m.parentId) {
    const ex = document.createElement('div');
    ex.className = 'card-expand';
    ex.textContent = expandedIds.has(m.id)
      ? `▲ collapse (${childCount})`
      : `▼ tap to expand${childCount ? ` (${childCount})` : ''}`;
    card.appendChild(ex);
  }

  /* Click = expand/collapse, double-click = profile */
  card.addEventListener('click', () => {
    if (expandedIds.has(m.id)) expandedIds.delete(m.id);
    else expandedIds.add(m.id);
    buildTree();
  });
  card.addEventListener('dblclick', e => { e.stopPropagation(); openProfile(m.id); });

  return card;
}

/* ─── DOM helpers ──────────────────────────────────────────────────── */
function makeCoupleEl(grp) {
  const w = document.createElement('div');
  w.className = 'couple-row';
  w.appendChild(makeCard(grp[0]));
  if (grp[1]) { w.appendChild(makeHeartBadge()); w.appendChild(makeCard(grp[1])); }
  return w;
}
function makeHeartBadge() {
  const h = document.createElement('div');
  h.className = 'heart-badge';
  h.textContent = '♥';
  return h;
}
function makeSectionLabel(text) {
  const l = document.createElement('div');
  l.className = 'section-label';
  l.textContent = text;
  return l;
}
function makeVConnector() {
  const v = document.createElement('div');
  v.className = 'connector-v';
  return v;
}
function makeVConnectorSmall() {
  const v = document.createElement('div');
  v.className = 'sibling-top';
  return v;
}

function updateStats() {
  const all = getAllMembers();
  document.getElementById('statTotal').textContent  = all.length;
  document.getElementById('statAlarms').textContent = all.filter(m => m.alarm).length;
}

/* ═══════════════════════════════════════════════════════════════════
   PROFILE MODAL  — view + edit modes
═══════════════════════════════════════════════════════════════════ */

let _profId   = null;
let _profEdit = false;   /* true = edit mode */

function openProfile(id) {
  const m = getMember(id);
  if (!m) return;
  _profId   = id;
  _profEdit = false;

  renderProfileView(m);
  document.getElementById('profileModal').classList.add('open');
}

/* ─── VIEW mode ────────────────────────────────────────────────────── */
function renderProfileView(m) {
  _profEdit = false;

  /* Avatar */
  const av = document.getElementById('pAvatar');
  av.innerHTML = '';
  if (m.photo) {
    const img = document.createElement('img');
    img.src = m.photo;
    av.appendChild(img);
  } else {
    av.textContent = initials(m.name);
  }

  document.getElementById('pName').textContent = m.name;
  document.getElementById('pNote').textContent = m.note || '';

  const sp  = m.spouseId ? getMember(m.spouseId) : null;
  const ch  = getChildren(m.id);
  const age = ageToday(m.dob);
  const meta = [
    m.gender === 'M' ? 'Male' : m.gender === 'F' ? 'Female' : '',
    age !== null ? `Age ${age}` : '',
    ch.length ? ch.length + ' child' + (ch.length > 1 ? 'ren' : '') : ''
  ].filter(Boolean).join(' · ');
  document.getElementById('pMeta').textContent = meta;

  /* Spouse row — “Husband of / Wife of / Spouse of” */
  const spouseRow   = document.getElementById('pSpouseRow');
  const spouseLabel = document.getElementById('pSpouseLabel');
  const spouseName  = document.getElementById('pSpouseName');
  if (sp) {
    const label = m.gender === 'F' ? 'Wife of'
                : m.gender === 'M' ? 'Husband of'
                : 'Spouse of';
    spouseLabel.textContent = label;
    spouseName.textContent  = sp.name;
    spouseRow.style.display = '';
  } else {
    spouseRow.style.display = 'none';
  }

  document.getElementById('pDob').textContent  = m.dob ? 'Born: ' + formatDob(m.dob) : 'No date of birth set';
  const d = daysUntilBirthday(m.dob);
  document.getElementById('pDays').textContent = d === null ? ''
    : d === 0 ? '🎂 Birthday Today!'
    : d === 1 ? '🔔 Birthday Tomorrow!'
    : `🔔 Birthday in ${d} days`;

  syncProfileAlarmToggle(m.alarm);

  /* Show view sections, hide edit form */
  document.getElementById('profViewBody').style.display  = '';
  document.getElementById('profEditForm').style.display  = 'none';
  document.getElementById('profViewActions').style.display = '';
  document.getElementById('profEditActions').style.display = 'none';
}

/* ─── EDIT mode ────────────────────────────────────────────────────── */
function enterEditMode() {
  const m = getMember(_profId);
  if (!m) return;
  _profEdit = true;

  /* Populate edit fields */
  document.getElementById('eName').value   = m.name   || '';
  document.getElementById('eDob').value    = m.dob    || '';
  document.getElementById('eNote').value   = m.note   || '';
  document.getElementById('eGender').value = m.gender || '';

  /* Hide view, show edit */
  document.getElementById('profViewBody').style.display  = 'none';
  document.getElementById('profEditForm').style.display  = '';
  document.getElementById('profViewActions').style.display = 'none';
  document.getElementById('profEditActions').style.display = '';

  /* Focus name field */
  setTimeout(() => document.getElementById('eName').focus(), 50);
}

function cancelEdit() {
  const m = getMember(_profId);
  if (m) renderProfileView(m);
}

function saveEdit() {
  const name = document.getElementById('eName').value.trim();
  if (!name) {
    showEditError('Name cannot be empty.');
    return;
  }

  updateMember(_profId, {
    name:   name,
    dob:    document.getElementById('eDob').value   || '',
    note:   document.getElementById('eNote').value.trim(),
    gender: document.getElementById('eGender').value
  });

  /* Re-render everything */
  buildTree();
  const updated = getMember(_profId);
  renderProfileView(updated);

  showEditSuccess('Changes saved!');
}

function showEditError(msg) {
  const el = document.getElementById('editError');
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}

function showEditSuccess(msg) {
  const el = document.getElementById('editSuccess');
  el.textContent = '✓ ' + msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 2500);
}

/* ─── Shared profile helpers ───────────────────────────────────────── */
function closeProfile() {
  document.getElementById('profileModal').classList.remove('open');
}

function syncProfileAlarmToggle(state) {
  document.getElementById('pToggle').className = 'tog' + (state ? ' on' : '');
  document.getElementById('pTogLbl').textContent = 'Alarm ' + (state ? 'on' : 'off');
}

function flipProfAlarm() {
  const newState = toggleAlarm(_profId);
  syncProfileAlarmToggle(newState);
  buildTree();
}

function triggerProfPhoto() {
  triggerPhotoUpload(_profId, (id, dataUrl) => {
    setPhoto(id, dataUrl);
    buildTree();
    openProfile(id);
  });
}

/* ═══════════════════════════════════════════════════════════════════
   ADD MEMBER MODAL
═══════════════════════════════════════════════════════════════════ */

let _formAlarm  = false;
let _formPhoto  = null;

function initAddModal() {
  document.getElementById('fRel').addEventListener('change', onRelChange);
}

function openAddModal() {
  ['fName','fDob','fNote'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('fGender').value = '';
  document.getElementById('fRel').value    = 'child';
  _formAlarm = false;
  _formPhoto = null;
  document.getElementById('fToggle').className = 'tog';
  document.getElementById('fTogLbl').textContent = 'Off';
  document.getElementById('prevImg').style.display  = 'none';
  document.getElementById('dropHint').style.display = 'block';

  const sel = document.getElementById('fParent');
  sel.innerHTML = '';
  getAllMembers().forEach(m => {
    const o = document.createElement('option');
    o.value = m.id;
    o.textContent = m.name + (m.dob ? ' (' + formatDob(m.dob) + ')' : '');
    sel.appendChild(o);
  });

  onRelChange();
  document.getElementById('addModal').classList.add('open');
}

function closeAddModal() {
  document.getElementById('addModal').classList.remove('open');
}

function onRelChange() {
  const rt = document.getElementById('fRel').value;
  document.getElementById('parentRow').style.display = rt === 'root' ? 'none' : 'block';
  document.getElementById('parentLbl').textContent   = rt === 'spouse' ? 'Spouse of' : 'Parent';
}

function flipFormAlarm() {
  _formAlarm = !_formAlarm;
  document.getElementById('fToggle').className = 'tog' + (_formAlarm ? ' on' : '');
  document.getElementById('fTogLbl').textContent = _formAlarm ? 'On — will remind on birthday' : 'Off';
}

function openFormPhotoUpload() {
  triggerFormPhotoUpload((_, dataUrl) => {
    _formPhoto = dataUrl;
    const img = document.getElementById('prevImg');
    img.src = _formPhoto;
    img.style.display = 'block';
    document.getElementById('dropHint').style.display = 'none';
  });
}

function saveMember() {
  const name = document.getElementById('fName').value.trim();
  if (!name) { showFormError('Please enter a full name.'); return; }

  const rt       = document.getElementById('fRel').value;
  const parentId = rt === 'root' ? null : parseInt(document.getElementById('fParent').value, 10);

  const newMember = addMember({
    name,
    dob:      document.getElementById('fDob').value,
    gender:   document.getElementById('fGender').value,
    note:     document.getElementById('fNote').value.trim(),
    parentId: rt === 'child' ? parentId : null,
    photo:    _formPhoto,
    alarm:    _formAlarm
  });

  if (rt === 'spouse' && parentId) {
    linkSpouses(parentId, newMember.id);
  }

  if (newMember.parentId) expandedIds.add(newMember.parentId);

  closeAddModal();
  buildTree();
}

function showFormError(msg) {
  const el = document.getElementById('formError');
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}

/* ═══════════════════════════════════════════════════════════════════
   DELETE MEMBER
═══════════════════════════════════════════════════════════════════ */

function confirmDeleteMember() {
  const m = getMember(_profId);
  if (!m) return;
  if (!confirm(`Remove "${m.name}" from the family tree? This cannot be undone.`)) return;
  deleteMember(_profId);
  closeProfile();
  expandedIds.delete(_profId);
  buildTree();
}