/**
 * app.js
 * Core application: tree rendering, card building, all modal logic.
 * Depends on: members.js, photos.js, alarms.js, search.js
 */

/* ─── Global tree state ────────────────────────────────────────────── */
const expandedIds = new Set([1]);  /* IDs that are currently expanded */

/* ─── Bootstrap ────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  /* Firebase will call buildTree() and startAlarmChecker() once connected.
     We only init UI helpers here. */
  initPhotoInputs();
  initSearch();
  initAddModal();
  loadMembers();   /* triggers Firebase connection → calls buildTree on success */
});

/* ═══════════════════════════════════════════════════════════════════
   TREE RENDERING
═══════════════════════════════════════════════════════════════════ */

function buildTree() {
  const canvas = document.getElementById('treeCanvas');
  canvas.innerHTML = '';

  /* Group root members into couples.
     A spouse belongs at the root level ONLY if:
       1. They have no parentId (not a child of someone), AND
       2. They have no children of their own at a deeper level
          (meaning they are a true root-generation spouse, not
           a spouse of a child who was added without a parentId) */
  const roots  = getRoots();
  const seen   = new Set();
  const couples = [];

  /* First pass — collect all IDs that are spouses of non-root members */
  const childLevelSpouseIds = new Set();
  getAllMembers().forEach(m => {
    if (m.parentId && m.spouseId) {
      childLevelSpouseIds.add(m.spouseId);
    }
  });

  roots.forEach(m => {
    if (seen.has(m.id)) return;

    /* Skip if this person is actually a spouse of a child-level member */
    if (childLevelSpouseIds.has(m.id)) {
      seen.add(m.id);
      return;
    }

    if (m.spouseId) {
      const sp = getMember(m.spouseId);
      /* Only pair at root if spouse is also root-level and not a child-level spouse */
      if (sp && !sp.parentId && !childLevelSpouseIds.has(sp.id)) {
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

  /* Expand the primary of each couple (the one with children, else first listed) */
  const expandedRoots = new Set();
  couples.forEach(grp => {
    /* Pick whichever partner actually has children, fallback to first */
    const primary = grp.find(m => getChildren(m.id).length > 0) || grp[0];
    if (expandedIds.has(primary.id) || (grp[1] && expandedIds.has(grp[1].id))) {
      if (!expandedRoots.has(primary.id)) {
        expandedRoots.add(primary.id);
        renderChildren(primary.id, canvas, 0);
      }
    }
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

  /* Track which IDs are already rendered as a spouse beside their partner */
  const renderedAsSpouse = new Set();

  children.forEach(child => {
    /* Skip if already shown beside their partner */
    if (renderedAsSpouse.has(child.id)) return;

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
        renderedAsSpouse.add(sp.id); /* mark spouse so we don't render them again */
      }
    }
    col.appendChild(cr);

    /* Expand children of this child OR their spouse (whichever has kids) */
    const expandTarget = expandedIds.has(child.id) ? child.id
      : (child.spouseId && expandedIds.has(child.spouseId)) ? child.spouseId
      : null;

    if (expandTarget) {
      const sub = document.createElement('div');
      sub.style.cssText = 'display:flex;flex-direction:column;align-items:center;';
      /* Collect children from both partners */
      const kids = [
        ...getChildren(child.id),
        ...(child.spouseId ? getChildren(child.spouseId) : [])
      ];
      if (kids.length) renderChildrenInto(child.id, sub, depth + 1);
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

  const renderedAsSpouse2 = new Set();

  children.forEach(child => {
    if (renderedAsSpouse2.has(child.id)) return;

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
        renderedAsSpouse2.add(sp.id);
      }
    }
    col.appendChild(cr);

    if (expandedIds.has(child.id) || (child.spouseId && expandedIds.has(child.spouseId))) {
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

  /* Show spouse in edit mode (read-only) */
  const sp2 = m.spouseId ? getMember(m.spouseId) : null;
  const eSpouseRow = document.getElementById('eSpouseRow');
  if (sp2) {
    const lbl = m.gender === 'F' ? 'Wife of' : m.gender === 'M' ? 'Husband of' : 'Spouse of';
    document.getElementById('eSpouseLabel').textContent = lbl;
    document.getElementById('eSpouseName').textContent  = sp2.name;
    eSpouseRow.style.display = '';
  } else {
    eSpouseRow.style.display = 'none';
  }

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

  populateMemberDropdown('child');
  onRelChange();
  document.getElementById('addModal').classList.add('open');
}

function closeAddModal() {
  document.getElementById('addModal').classList.remove('open');
}

/**
 * Fill the parent/spouse dropdown based on relationship type.
 * For 'spouse' — only show members who don't already have a spouse.
 * For 'child'  — show all members.
 */
function populateMemberDropdown(rt) {
  const sel = document.getElementById('fParent');
  sel.innerHTML = '';
  const all = getAllMembers();

  const list = rt === 'spouse'
    ? all.filter(m => !m.spouseId)   /* only singles */
    : all;

  if (list.length === 0) {
    const o = document.createElement('option');
    o.disabled = true;
    o.textContent = rt === 'spouse'
      ? '— No single members found —'
      : '— No members yet —';
    sel.appendChild(o);
    return;
  }

  list.forEach(m => {
    const o = document.createElement('option');
    o.value = m.id;
    o.textContent = m.name + (m.dob ? '  (' + formatDob(m.dob) + ')' : '');
    sel.appendChild(o);
  });
}

function onRelChange() {
  const rt = document.getElementById('fRel').value;

  /* Hide/show the member picker row */
  document.getElementById('parentRow').style.display = rt === 'root' ? 'none' : 'flex';

  /* Update label */
  document.getElementById('parentLbl').textContent =
    rt === 'spouse' ? 'Spouse of' : 'Child of';

  /* Repopulate dropdown for the chosen relationship */
  if (rt !== 'root') populateMemberDropdown(rt);

  /* Show/hide the spouse-preview card */
  updateSpousePreview();
}

/** Show a small preview card under the dropdown when "Spouse of" is selected */
function updateSpousePreview() {
  const rt      = document.getElementById('fRel').value;
  const preview = document.getElementById('spousePreview');
  if (!preview) return;

  if (rt !== 'spouse') {
    preview.style.display = 'none';
    return;
  }

  const sel = document.getElementById('fParent');
  const id  = parseInt(sel.value, 10);
  const m   = getMember(id);
  if (!m) { preview.style.display = 'none'; return; }

  const age = m.dob ? ageToday(m.dob) : null;

  const newGender = document.getElementById('fGender').value;
  let spouseLabel = 'Spouse of';
  if (newGender === 'M')      spouseLabel = 'Husband of';
  else if (newGender === 'F') spouseLabel = 'Wife of';
  else if (m.gender === 'M')  spouseLabel = 'Wife of';
  else if (m.gender === 'F')  spouseLabel = 'Husband of';

  const avHtml = m.photo
    ? '<img src="' + m.photo + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'
    : initials(m.name);

  const dobStr  = m.dob  ? formatDob(m.dob) : '';
  const ageStr  = age !== null ? '  ·  Age ' + age : '';
  const noteStr = m.note ? '  ·  ' + m.note : '';

  preview.style.display = 'flex';
  preview.innerHTML =
    '<div class="sp-av">' + avHtml + '</div>' +
    '<div>' +
      '<div class="sp-name">' + spouseLabel + ' <strong>' + m.name + '</strong></div>' +
      '<div class="sp-meta">' + dobStr + ageStr + noteStr + '</div>' +
    '</div>';
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
    /* Give the spouse the same parentId as their partner so they
       appear at the correct generation, not as a stray root card */
    const partner = getMember(parentId);
    if (partner && partner.parentId) {
      updateMember(newMember.id, { parentId: partner.parentId });
    }
    expandedIds.add(parentId);
    if (partner && partner.parentId) expandedIds.add(partner.parentId);
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