/**
 * app.js  —  Medhuru Family Tree
 */

/* ══════════════════════════════════════════════
   ROUTER STATE
══════════════════════════════════════════════ */
let _currentScreen = 'splash';
let _focusId       = null;
let _navStack      = [];

/* ══════════════════════════════════════════════
   BOOTSTRAP
══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initPhotoInputs();
  initSearch();
  loadMembers();
});

function onDataReady() {
  startAlarmChecker();
  goTo('splash');
}

function onDataUpdate() {
  _redrawCurrentScreen();
}

/* ══════════════════════════════════════════════
   NAVIGATION
══════════════════════════════════════════════ */
function goTo(screen, focusId, isBack) {
  if (!isBack && _currentScreen !== 'splash') {
    _navStack.push({ screen: _currentScreen, focusId: _focusId });
  }
  _currentScreen = screen;
  _focusId       = focusId || null;

  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active', 'slide-back');
  });

  const el = document.getElementById('screen-' + screen);
  if (!el) return;
  el.classList.add('active');
  if (isBack) el.classList.add('slide-back');
  el.scrollTo(0, 0);

  if (screen === 'splash')  _renderSplash();
  if (screen === 'gen1')    _renderGen1();
  if (screen === 'family')  _renderFamily(_focusId);
}

function goBack() {
  if (_navStack.length === 0) { goTo('gen1', null, true); return; }
  const prev = _navStack.pop();
  goTo(prev.screen, prev.focusId, true);
}

function _redrawCurrentScreen() {
  checkBirthdayAlarms();
  if (_currentScreen === 'gen1')   _renderGen1();
  if (_currentScreen === 'family') _renderFamily(_focusId);
}

/* ══════════════════════════════════════════════
   SCREEN 1 — SPLASH
══════════════════════════════════════════════ */
function _renderSplash() {
  checkBirthdayAlarms();
}

/* ══════════════════════════════════════════════
   SCREEN 2 — GEN 1
══════════════════════════════════════════════ */
function _renderGen1() {
  checkBirthdayAlarms();

  const coupleEl = document.getElementById('patriarch-couple');
  if (!coupleEl) return;
  coupleEl.innerHTML = '';

  const roots     = getRoots();
  const patriarch = roots.find(m => m.gender === 'M') || roots[0];
  const matriarch = patriarch && patriarch.spouseId ? getMember(patriarch.spouseId) : null;

  if (patriarch) coupleEl.appendChild(_makePatriarchCard(patriarch));
  if (matriarch) {
    const heart = document.createElement('div');
    heart.className = 'couple-heart';
    heart.innerHTML = '<div class="couple-heart-circle">♥</div>';
    coupleEl.appendChild(heart);
    coupleEl.appendChild(_makePatriarchCard(matriarch));
  }

  const grid = document.getElementById('children-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const primaryParentId = patriarch ? patriarch.id : null;
  const allChildren     = primaryParentId ? getChildren(primaryParentId) : [];

  // Build a map of all members in allChildren for quick lookup
  const byId = new Map(allChildren.map(c => [c.id, c]));

  // A member is an in-law if some sibling in allChildren claims them as a spouse
  const claimedAsSpouse = new Set(
    allChildren
      .filter(c => c.spouseId != null && byId.has(c.spouseId))
      .map(c => c.spouseId)
  );

  // Real children = in allChildren but NOT claimed as a spouse by a sibling
  const uniqueChildren = allChildren.filter(c => !claimedAsSpouse.has(c.id));

  const dobSorted       = [...uniqueChildren].sort((a, b) => (a.dob || '').localeCompare(b.dob || ''));
  const orderedChildren = patriarch ? applyOrder(patriarch.id, dobSorted) : dobSorted;

  if (orderedChildren.length === 0) {
    grid.innerHTML = '<div style="color:var(--text4);text-align:center;padding:40px;grid-column:1/-1">No children added yet. Click + Add to begin.</div>';
    return;
  }

  orderedChildren.forEach(child => grid.appendChild(_makeChildCard(child)));
}

function _makePatriarchCard(m) {
  const card = document.createElement('div');
  card.className = 'patriarch-card';

  const bell = document.createElement('button');
  bell.className = 'card-bell' + (m.alarm ? ' on' : '');
  bell.innerHTML = '🔔';
  bell.title = m.alarm ? 'Alarm on' : 'Set birthday alarm';
  bell.onclick = e => { e.stopPropagation(); toggleAlarm(m.id); _redrawCurrentScreen(); };
  card.appendChild(bell);

  const d = daysUntilBirthday(m.dob);
  if (m.alarm && d !== null && d <= 7) {
    const dot = document.createElement('div');
    dot.className = 'bday-dot';
    dot.title = d === 0 ? 'Birthday today!' : `Birthday in ${d} days`;
    card.appendChild(dot);
  }

  card.appendChild(buildAvatarEl(m, 90));

  const name = document.createElement('div');
  name.className = 'pc-name'; name.textContent = m.name;
  card.appendChild(name);

  if (m.dob) {
    const dob = document.createElement('div');
    dob.className = 'pc-dob';
    dob.textContent = formatDob(m.dob) + (ageToday(m.dob) !== null ? ' · Age ' + ageToday(m.dob) : '');
    card.appendChild(dob);
  }

  if (m.note) {
    const note = document.createElement('div');
    note.className = 'pc-note'; note.textContent = m.note;
    card.appendChild(note);
  }

  card.addEventListener('click', () => openProfile(m.id));
  return card;
}

function _makeChildCard(m) {
  const spouse     = m.spouseId ? getMember(m.spouseId) : null;
  const childCount = getChildren(m.id).length +
                     (spouse ? getChildren(spouse.id).length : 0);

  const card = document.createElement('div');
  card.className = 'child-card';
  card.dataset.memberId = m.id;

  const bell = document.createElement('button');
  bell.className = 'card-bell' + (m.alarm ? ' on' : '');
  bell.innerHTML = '🔔';
  bell.onclick = e => { e.stopPropagation(); toggleAlarm(m.id); _redrawCurrentScreen(); };
  card.appendChild(bell);

  const d = daysUntilBirthday(m.dob);
  if (m.alarm && d !== null && d <= 7) {
    const dot = document.createElement('div');
    dot.className = 'bday-dot'; dot.title = d === 0 ? 'Birthday today!' : `Birthday in ${d} days`;
    card.appendChild(dot);
  }

  card.appendChild(buildAvatarEl(m, 76));

  const name = document.createElement('div');
  name.className = 'cc-name'; name.textContent = m.name;
  card.appendChild(name);

  if (m.dob) {
    const dob = document.createElement('div');
    dob.className = 'cc-dob'; dob.textContent = formatDob(m.dob);
    card.appendChild(dob);
  }

  const hint = document.createElement('div');
  hint.className = 'cc-tap-hint';
  hint.textContent = (childCount > 0 ? childCount + ' children · ' : '') + 'View Family →';
  card.appendChild(hint);

  card.addEventListener('click', () => goTo('family', m.id));
  return card;
}

/* ══════════════════════════════════════════════
   SCREEN 3 — FAMILY PAGE
══════════════════════════════════════════════ */
function _renderFamily(focusId) {
  checkBirthdayAlarms();
  const container = document.getElementById('family-page-body');
  if (!container) return;
  container.innerHTML = '';

  const person = getMember(focusId);
  if (!person) {
    container.innerHTML = '<div style="color:var(--text4);padding:40px;text-align:center">Member not found.</div>';
    return;
  }

  const bcName = document.getElementById('bc-name');
  if (bcName) bcName.textContent = person.name + "'s Family";

  const spouse   = person.spouseId ? getMember(person.spouseId) : null;
  const children = _getFamilyChildren(person, spouse);

  // Parent context
  if (person.parentId) {
    const parent       = getMember(person.parentId);
    const parentSpouse = parent && parent.spouseId ? getMember(parent.spouseId) : null;
    if (parent) {
      const ctx = document.createElement('div');
      ctx.className = 'family-context';
      ctx.innerHTML =
        '<span class="ctx-label">Child of</span> ' +
        '<button class="ctx-link" onclick="goTo(\'gen1\')">' +
          parent.name +
          (parentSpouse ? ' &amp; ' + parentSpouse.name : '') +
        '</button>';
      container.appendChild(ctx);
    }
  }

  // Couple section
  const coupleWrap = document.createElement('div');
  coupleWrap.className = 'fam-couple-wrap';
  const coupleRow = document.createElement('div');
  coupleRow.className = 'fam-couple-row';

  coupleRow.appendChild(_makeFamCard(person, true));

  if (spouse) {
    const heartDiv = document.createElement('div');
    heartDiv.className = 'fam-heart';
    heartDiv.innerHTML =
      '<div class="fam-heart-circle">♥</div>' +
      '<div class="fam-heart-lbl">Married</div>';
    coupleRow.appendChild(heartDiv);
    coupleRow.appendChild(_makeFamCard(spouse, false));
  } else {
    const heartDiv = document.createElement('div');
    heartDiv.className = 'fam-heart';
    heartDiv.innerHTML = '<div class="fam-heart-circle" style="opacity:.35">♥</div>';
    coupleRow.appendChild(heartDiv);

    const ph = document.createElement('div');
    ph.className = 'add-spouse-ph';
    ph.innerHTML = '<div class="add-icon">＋</div><div class="add-text">Add Spouse</div>';
    ph.onclick = () => _openAddModalAs('spouse', person.id);
    coupleRow.appendChild(ph);
  }

  coupleWrap.appendChild(coupleRow);
  container.appendChild(coupleWrap);

  // Children section
  if (children.length > 0) {
    const conn = document.createElement('div');
    conn.className = 'fam-connector';
    conn.innerHTML =
      '<div class="vline" style="height:28px"></div>' +
      '<div class="fam-children-tag">Their Children (' + children.length + ')</div>' +
      '<div class="vline" style="height:16px"></div>';
    container.appendChild(conn);

    const grid = document.createElement('div');
    grid.className = 'fam-children-grid';
    children.forEach(child => grid.appendChild(_makeFamChildCard(child)));
    container.appendChild(grid);
  } else {
    const noKids = document.createElement('div');
    noKids.className = 'no-kids';
    noKids.innerHTML =
      '<div class="no-kids-icon">🌱</div>' +
      '<div class="no-kids-txt">No children added yet</div>';
    container.appendChild(noKids);
  }

  // FAB
  const fab = document.createElement('button');
  fab.className = 'fab';
  fab.innerHTML = '＋ Add Child';
  fab.onclick = () => _openAddModalAs('child', person.id);
  container.appendChild(fab);
}

function _getFamilyChildren(person, spouse) {
  const all = [
    ...getChildren(person.id),
    ...(spouse ? getChildren(spouse.id) : [])
  ];

  const seenC         = new Set();
  const seenAsSpouseC = new Set();
  const result        = [];

  [...all].sort((a, b) => a.id - b.id).forEach(c => {
    if (seenC.has(c.id) || seenAsSpouseC.has(c.id)) return;
    seenC.add(c.id);
    result.push(c);
    if (c.spouseId) seenAsSpouseC.add(c.spouseId);
  });

  const dobSorted = result.sort((a, b) => (a.dob || '').localeCompare(b.dob || ''));
  return applyOrder(person.id, dobSorted);
}

function _makeFamCard(m, isPrimary) {
  const card = document.createElement('div');
  card.className = 'fam-card' + (isPrimary ? ' primary' : '');

  const role = document.createElement('div');
  role.className = 'fmc-role';
  role.textContent = m.gender === 'F' ? '👩 Wife' : m.gender === 'M' ? '👨 Husband' : '👤';
  card.appendChild(role);

  const bell = document.createElement('button');
  bell.className = 'card-bell' + (m.alarm ? ' on' : '');
  bell.innerHTML = '🔔';
  bell.onclick = e => { e.stopPropagation(); toggleAlarm(m.id); _redrawCurrentScreen(); };
  card.appendChild(bell);

  const d = daysUntilBirthday(m.dob);
  if (m.alarm && d !== null && d <= 7) {
    const dot = document.createElement('div'); dot.className = 'bday-dot'; card.appendChild(dot);
  }

  card.appendChild(buildAvatarEl(m, 96));

  const name = document.createElement('div');
  name.className = 'fmc-name'; name.textContent = m.name;
  card.appendChild(name);

  if (m.dob) {
    const dob = document.createElement('div');
    dob.className = 'fmc-dob'; dob.textContent = formatDob(m.dob);
    card.appendChild(dob);
    const age = ageToday(m.dob);
    if (age !== null) {
      const ageEl = document.createElement('div');
      ageEl.className = 'fmc-age'; ageEl.textContent = 'Age ' + age;
      card.appendChild(ageEl);
    }
  }

  if (m.note) {
    const note = document.createElement('div');
    note.className = 'fmc-note'; note.textContent = m.note;
    card.appendChild(note);
  }

  card.addEventListener('click', () => openProfile(m.id));
  return card;
}

function _makeFamChildCard(m) {
  const spouse    = m.spouseId ? getMember(m.spouseId) : null;
  const grandkids = _getFamilyChildren(m, spouse);
  const hasFamily = grandkids.length > 0 || spouse;

  const card = document.createElement('div');
  card.className = 'fam-child-card';
  card.dataset.memberId = m.id;

  const bell = document.createElement('button');
  bell.className = 'card-bell' + (m.alarm ? ' on' : '');
  bell.innerHTML = '🔔';
  bell.onclick = e => { e.stopPropagation(); toggleAlarm(m.id); _redrawCurrentScreen(); };
  card.appendChild(bell);

  const d = daysUntilBirthday(m.dob);
  if (m.alarm && d !== null && d <= 7) {
    const dot = document.createElement('div'); dot.className = 'bday-dot'; card.appendChild(dot);
  }

  card.appendChild(buildAvatarEl(m, 66));

  const name = document.createElement('div');
  name.className = 'fcc-name'; name.textContent = m.name;
  card.appendChild(name);

  if (m.dob) {
    const dob = document.createElement('div');
    dob.className = 'fcc-dob'; dob.textContent = formatDob(m.dob);
    card.appendChild(dob);
  }

  if (spouse) {
    const sw = document.createElement('div');
    sw.className = 'fcc-spouse';
    sw.innerHTML = '♥ ' + spouse.name;
    card.appendChild(sw);
  }

  if (grandkids.length > 0) {
    const gk = document.createElement('div');
    gk.className = 'fcc-kids';
    gk.textContent = grandkids.length + ' child' + (grandkids.length !== 1 ? 'ren' : '');
    card.appendChild(gk);
  }

  if (hasFamily) {
    const btn = document.createElement('button');
    btn.className = 'fcc-drill';
    btn.textContent = 'View Family →';
    btn.onclick = e => { e.stopPropagation(); goTo('family', m.id); };
    card.appendChild(btn);
  }

  card.addEventListener('click', () => {
    if (!hasFamily) openProfile(m.id);
  });

  return card;
}

/* ══════════════════════════════════════════════
   PROFILE DRAWER
══════════════════════════════════════════════ */
let _profId   = null;
let _profEdit = false;

function openProfile(id) {
  const m = getMember(id);
  if (!m) return;
  _profId = id; _profEdit = false;
  _renderProfileView(m);
  document.getElementById('profileBackdrop').classList.add('open');
  document.getElementById('profileDrawer').classList.add('open');
}

function closeProfile() {
  document.getElementById('profileBackdrop').classList.remove('open');
  document.getElementById('profileDrawer').classList.remove('open');
}

function _renderProfileView(m) {
  _profEdit = false;

  const av = document.getElementById('dAvatar');
  av.innerHTML = '';
  if (m.photo) { const img = document.createElement('img'); img.src = m.photo; av.appendChild(img); }
  else av.textContent = initials(m.name);

  document.getElementById('dName').textContent = m.name;
  document.getElementById('dNote').textContent = m.note || '';

  const sp  = m.spouseId ? getMember(m.spouseId) : null;
  const ch  = getChildren(m.id);
  const age = ageToday(m.dob);
  document.getElementById('dMeta').textContent = [
    m.gender === 'M' ? 'Male' : m.gender === 'F' ? 'Female' : '',
    age !== null ? 'Age ' + age : '',
    ch.length ? ch.length + ' child' + (ch.length > 1 ? 'ren' : '') : ''
  ].filter(Boolean).join(' · ');

  const spRow = document.getElementById('dSpouseRow');
  if (sp) {
    document.getElementById('dSpouseLabel').textContent =
      m.gender === 'F' ? 'Wife of' : m.gender === 'M' ? 'Husband of' : 'Spouse of';
    document.getElementById('dSpouseName').textContent = sp.name;
    spRow.style.display = '';
  } else spRow.style.display = 'none';

  document.getElementById('dDob').textContent = m.dob ? 'Born: ' + formatDob(m.dob) : 'No date of birth';
  const d = daysUntilBirthday(m.dob);
  document.getElementById('dDays').textContent =
    d === null ? '' : d === 0 ? '🎂 Birthday Today!' : d === 1 ? '🔔 Tomorrow!' : '🔔 In ' + d + ' days';

  const tog = document.getElementById('dAlarmTog');
  tog.className = 'tog' + (m.alarm ? ' on' : '');
  document.getElementById('dAlarmLbl').textContent = 'Alarm ' + (m.alarm ? 'on' : 'off');

  document.getElementById('dViewBody').style.display    = '';
  document.getElementById('dEditForm').style.display    = 'none';
  document.getElementById('dViewActions').style.display = '';
  document.getElementById('dEditActions').style.display = 'none';
  document.getElementById('dEditSuccess').style.display = 'none';
}

function enterEditMode() {
  const m = getMember(_profId); if (!m) return;
  _profEdit = true;

  document.getElementById('eName').value   = m.name   || '';
  document.getElementById('eDob').value    = m.dob    || '';
  document.getElementById('eNote').value   = m.note   || '';
  document.getElementById('eGender').value = m.gender || '';

  const sp  = m.spouseId ? getMember(m.spouseId) : null;
  const esr = document.getElementById('dESpouseRow');
  if (sp) {
    document.getElementById('dESpouseLabel').textContent =
      m.gender === 'F' ? 'Wife of' : 'Husband of';
    document.getElementById('dESpouseName').textContent = sp.name;
    esr.style.display = '';
  } else esr.style.display = 'none';

  document.getElementById('dViewBody').style.display    = 'none';
  document.getElementById('dEditForm').style.display    = '';
  document.getElementById('dViewActions').style.display = 'none';
  document.getElementById('dEditActions').style.display = '';
  setTimeout(() => document.getElementById('eName').focus(), 50);
}

function cancelEdit() {
  const m = getMember(_profId); if (m) _renderProfileView(m);
}

function saveEdit() {
  const name = document.getElementById('eName').value.trim();
  if (!name) { showEditError('Name cannot be empty.'); return; }
  updateMember(_profId, {
    name,
    dob:    document.getElementById('eDob').value || '',
    note:   document.getElementById('eNote').value.trim(),
    gender: document.getElementById('eGender').value
  });
  _redrawCurrentScreen();
  _renderProfileView(getMember(_profId));
  const s = document.getElementById('dEditSuccess');
  s.textContent = '✓ Saved!'; s.style.display = 'block';
  setTimeout(() => { s.style.display = 'none'; }, 2200);
}

function showEditError(msg) {
  const el = document.getElementById('editError');
  el.textContent = msg; el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}

function flipProfAlarm() {
  const v = toggleAlarm(_profId);
  const tog = document.getElementById('dAlarmTog');
  tog.className = 'tog' + (v ? ' on' : '');
  document.getElementById('dAlarmLbl').textContent = 'Alarm ' + (v ? 'on' : 'off');
  _redrawCurrentScreen();
}

function triggerProfPhoto() {
  triggerPhotoUpload(_profId, (id, url) => {
    setPhoto(id, url);
    _redrawCurrentScreen();
    const m = getMember(id);
    if (m && document.getElementById('profileDrawer').classList.contains('open')) {
      _renderProfileView(m);
    }
  });
}

function confirmDeleteMember() {
  const m = getMember(_profId); if (!m) return;
  if (!confirm('Remove "' + m.name + '"? This cannot be undone.')) return;
  deleteMember(_profId);
  closeProfile();
  _redrawCurrentScreen();
}

/* ══════════════════════════════════════════════
   ADD MEMBER MODAL
══════════════════════════════════════════════ */
let _formAlarm = false;
let _formPhoto = null;

function openAddModal(type, parentId) {
  _openAddModalAs(type || null, parentId || null);
}

function _openAddModalAs(type, parentId) {
  _formAlarm = false; _formPhoto = null;

  ['fName','fDob','fNote'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('fGender').value = '';
  document.getElementById('fToggle').className = 'tog';
  document.getElementById('fTogLbl').textContent = 'Off';
  document.getElementById('prevImg').style.display  = 'none';
  document.getElementById('dropHint').style.display = 'block';
  document.getElementById('formError').style.display = 'none';

  if (type && parentId) {
    document.getElementById('fRel').value = type;
    document.getElementById('parentRow').style.display = '';
    document.getElementById('parentLbl').textContent =
      type === 'spouse' ? 'Spouse of' : 'Child of';
    _populateParentDropdown(type);
    document.getElementById('fParent').value = parentId;
  } else {
    document.getElementById('fRel').value = 'child';
    onRelChange();
  }

  document.getElementById('addModal').classList.add('open');
}

function closeAddModal() {
  document.getElementById('addModal').classList.remove('open');
}

function onRelChange() {
  const rt = document.getElementById('fRel').value;
  document.getElementById('parentRow').style.display = rt === 'root' ? 'none' : '';
  document.getElementById('parentLbl').textContent =
    rt === 'spouse' ? 'Spouse of' : 'Child of';
  if (rt !== 'root') _populateParentDropdown(rt);
}

function _populateParentDropdown(rt) {
  const sel = document.getElementById('fParent');
  sel.innerHTML = '';
  const list = rt === 'spouse'
    ? getAllMembers().filter(m => !m.spouseId)
    : getAllMembers();
  list.forEach(m => {
    const o = document.createElement('option');
    o.value = m.id;
    o.textContent = m.name + (m.dob ? '  (' + formatDob(m.dob) + ')' : '');
    sel.appendChild(o);
  });
}

function flipFormAlarm() {
  _formAlarm = !_formAlarm;
  document.getElementById('fToggle').className = 'tog' + (_formAlarm ? ' on' : '');
  document.getElementById('fTogLbl').textContent = _formAlarm ? 'On' : 'Off';
}

function openFormPhotoUpload() {
  triggerFormPhotoUpload((_, url) => {
    _formPhoto = url;
    const img = document.getElementById('prevImg');
    img.src = url; img.style.display = 'block';
    document.getElementById('dropHint').style.display = 'none';
  });
}

function saveMember() {
  const name = document.getElementById('fName').value.trim();
  if (!name) { showFormError('Please enter a full name.'); return; }

  const rt       = document.getElementById('fRel').value;
  const parentId = rt === 'root' ? null : parseInt(document.getElementById('fParent').value, 10);

  const newM = addMember({
    name,
    dob:      document.getElementById('fDob').value,
    gender:   document.getElementById('fGender').value,
    note:     document.getElementById('fNote').value.trim(),
    parentId: rt === 'child' ? parentId : null,
    photo:    _formPhoto,
    alarm:    _formAlarm
  });

  if (rt === 'spouse' && parentId) {
    linkSpouses(parentId, newM.id);
    // Do NOT copy parentId to spouse — spouses are found via spouseId link only
  }

  closeAddModal();
  _redrawCurrentScreen();
}

function showFormError(msg) {
  const el = document.getElementById('formError');
  el.textContent = msg; el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}

/* ══════════════════════════════════════════════
   SEARCH (family screen second input)
══════════════════════════════════════════════ */
function runSearch2() {
  const q   = (document.getElementById('searchInput2').value || '').trim().toLowerCase();
  const box = document.getElementById('searchResults2');
  if (!box) return;
  if (!q) { box.style.display = 'none'; return; }

  const results = getAllMembers().filter(m =>
    m.name.toLowerCase().includes(q) ||
    (m.note && m.note.toLowerCase().includes(q))
  );

  if (!results.length) { box.style.display = 'none'; return; }

  box.innerHTML = '';
  results.forEach(m => {
    const item = document.createElement('div');
    item.className = 'sri';
    const av = document.createElement('div');
    av.className = 'sri-av';
    if (m.photo) { const img = document.createElement('img'); img.src = m.photo; av.appendChild(img); }
    else av.textContent = initials(m.name);
    const txt = document.createElement('div');
    txt.innerHTML = '<div class="sri-name">' + m.name + '</div><div class="sri-sub">' + (formatDob(m.dob) || '') + '</div>';
    item.appendChild(av); item.appendChild(txt);
    item.onclick = () => {
      document.getElementById('searchInput2').value = '';
      box.style.display = 'none';
      openProfile(m.id);
    };
    box.appendChild(item);
  });
  box.style.display = 'block';
}

/* ══════════════════════════════════════════════
   SYNC STATUS
══════════════════════════════════════════════ */
function setSyncStatus(state) {
  const el = document.getElementById('syncStatus');
  if (!el) return;
  const map = {
    connecting: '⏳ Connecting',
    synced:     '🟢 Live',
    offline:    '🟡 Offline',
    error:      '🔴 Error'
  };
  el.textContent = map[state] || '🟡';
  if (state === 'synced') {
    setTimeout(() => { if (el.textContent === '🟢 Live') el.textContent = '🟢'; }, 4000);
  }
}

function showFirebaseError(msg) {
  let el = document.getElementById('fbError');
  if (!el) {
    el = document.createElement('div'); el.id = 'fbError';
    el.style.cssText = [
      'position:fixed','bottom:16px','left:50%','transform:translateX(-50%)',
      'background:#1a0808','border:1px solid #f87171','border-radius:12px',
      'color:#fca5a5','font-size:13px','max-width:90vw',
      'padding:12px 18px','z-index:9999','line-height:1.5'
    ].join(';');
    document.body.appendChild(el);
  }
  el.innerHTML = msg +
    ' <button onclick="this.parentElement.remove()" ' +
    'style="margin-left:10px;background:none;border:none;color:#f87171;cursor:pointer;font-size:16px;">✕</button>';
}