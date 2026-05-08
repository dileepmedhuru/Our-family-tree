/**
 * app.js  —  Medhuru Family Tree
 *
 * Page flow:
 *   screen-splash  →  screen-gen1  →  screen-family
 *
 * screen-gen1  : Yellaiah + Vanamma couple at top,
 *                then ONLY their children (no wives shown here).
 *                Click a child card → opens screen-family for that child.
 *
 * screen-family: The child + his/her spouse as a couple,
 *                their children listed below.
 *                Click a grandchild who has children → opens another
 *                screen-family for that grandchild (infinite depth).
 *
 * Profile drawer slides in from the right on double-tap / "View" tap.
 */

/* ══════════════════════════════════════════════
   ROUTER STATE
══════════════════════════════════════════════ */
let _currentScreen = 'splash';
let _focusId       = null;    // member id whose family is shown on screen-family
let _navStack      = [];      // [{screen, focusId}] for back navigation

/* ══════════════════════════════════════════════
   BOOTSTRAP
══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initPhotoInputs();
  initSearch();
  loadMembers();   // members.js — calls onDataReady() when Firebase connects
});

/** Called by members.js once data is loaded for the first time */
function onDataReady() {
  startAlarmChecker();
  goTo('splash');
}

/** Called by members.js on every live Firebase update */
function onDataUpdate() {
  _redrawCurrentScreen();
}

/* ══════════════════════════════════════════════
   NAVIGATION
══════════════════════════════════════════════ */

/**
 * Navigate to a screen.
 * @param {string} screen  'splash' | 'gen1' | 'family'
 * @param {number} [focusId]  member id (required for 'family')
 * @param {boolean} [isBack]  true when going back (slide-back animation)
 */
function goTo(screen, focusId, isBack) {
  // push current to stack (unless going back or leaving splash)
  if (!isBack && _currentScreen !== 'splash') {
    _navStack.push({ screen: _currentScreen, focusId: _focusId });
  }

  _currentScreen = screen;
  _focusId       = focusId || null;

  // switch visible screen
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active', 'slide-back');
  });

  const el = document.getElementById('screen-' + screen);
  if (!el) return;
  el.classList.add('active');
  if (isBack) el.classList.add('slide-back');

  // scroll to top
  el.scrollTo(0, 0);

  // render content
  if (screen === 'splash')  _renderSplash();
  if (screen === 'gen1')    _renderGen1();
  if (screen === 'family')  _renderFamily(_focusId);
}

/** Go back one level */
function goBack() {
  if (_navStack.length === 0) { goTo('gen1', null, true); return; }
  const prev = _navStack.pop();
  goTo(prev.screen, prev.focusId, true);
}

/** Re-draw whatever screen is currently visible */
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
  // Splash is fully static HTML — nothing to render dynamically.
  // The "Enter Family Tree" button calls goTo('gen1').
}

/* ══════════════════════════════════════════════
   SCREEN 2 — GEN 1
   Shows: Yellaiah & Vanamma couple + their children only.
   Wives/husbands of children are NOT shown here.
══════════════════════════════════════════════ */
function _renderGen1() {
  checkBirthdayAlarms();

  // ── Patriarch couple ─────────────────────────
  const coupleEl = document.getElementById('patriarch-couple');
  if (!coupleEl) return;
  coupleEl.innerHTML = '';

  // Find root couple — first root male (or id=1 as patriarch)
  const roots = getRoots();
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

  // ── Children grid ─────────────────────────────
  const grid = document.getElementById('children-grid');
  if (!grid) return;
  grid.innerHTML = '';

  // Only use patriarch's children — matriarch children cause duplicates
  // because all children/spouses are stored under patriarch's id
  const primaryParentId = patriarch ? patriarch.id : null;
  const allChildren = primaryParentId ? getChildren(primaryParentId) : [];

  // Filter out in-laws: anyone whose id appears as another member's spouseId
  // is a spouse who was assigned this parentId for tree navigation — not a real child.
  const allSpouseIds = new Set(
    getAllMembers()
      .filter(m => m.spouseId != null)
      .map(m => m.spouseId)
  );

  const uniqueChildren = allChildren.filter(c => !allSpouseIds.has(c.id));

// Apply saved custom order, fall back to DOB sort for new members
  const dobSorted = [...uniqueChildren].sort((a, b) => (a.dob || '').localeCompare(b.dob || ''));
  const orderedChildren = applyOrder(patriarch.id, dobSorted);
  uniqueChildren.length = 0;
  orderedChildren.forEach(c => uniqueChildren.push(c));

  if (uniqueChildren.length === 0) {
    grid.innerHTML = '<div style="color:var(--text4);text-align:center;padding:40px;grid-column:1/-1">No children added yet. Click + Add to begin.</div>';
    return;
  }

  uniqueChildren.forEach(child => {
    grid.appendChild(_makeChildCard(child));
  });
}

/** Large patriarch / matriarch card */
function _makePatriarchCard(m) {
  const card = document.createElement('div');
  card.className = 'patriarch-card';

  // Bell button
  const bell = document.createElement('button');
  bell.className = 'card-bell' + (m.alarm ? ' on' : '');
  bell.innerHTML = '🔔';
  bell.title = m.alarm ? 'Alarm on' : 'Set birthday alarm';
  bell.onclick = e => { e.stopPropagation(); toggleAlarm(m.id); _redrawCurrentScreen(); };
  card.appendChild(bell);

  // Birthday dot
  const d = daysUntilBirthday(m.dob);
  if (m.alarm && d !== null && d <= 7) {
    const dot = document.createElement('div');
    dot.className = 'bday-dot';
    dot.title = d === 0 ? 'Birthday today!' : `Birthday in ${d} days`;
    card.appendChild(dot);
  }

  // Avatar
  card.appendChild(buildAvatarEl(m, 90));

  // Name
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

  // Click → profile drawer
  card.addEventListener('click', () => openProfile(m.id));
  return card;
}

/**
 * Child card on gen1 page — shows ONLY the child, no spouse.
 * Clicking opens their family page.
 */
function _makeChildCard(m) {
  const spouse     = m.spouseId ? getMember(m.spouseId) : null;
  const childCount = getChildren(m.id).length +
                     (spouse ? getChildren(spouse.id).length : 0);

  const card = document.createElement('div');
  card.className = 'child-card';
  card.dataset.memberId = m.id;

  // Bell
  const bell = document.createElement('button');
  bell.className = 'card-bell' + (m.alarm ? ' on' : '');
  bell.innerHTML = '🔔';
  bell.onclick = e => { e.stopPropagation(); toggleAlarm(m.id); _redrawCurrentScreen(); };
  card.appendChild(bell);

  // Birthday dot
  const d = daysUntilBirthday(m.dob);
  if (m.alarm && d !== null && d <= 7) {
    const dot = document.createElement('div');
    dot.className = 'bday-dot'; dot.title = d === 0 ? 'Birthday today!' : `Birthday in ${d} days`;
    card.appendChild(dot);
  }

  // Avatar
  card.appendChild(buildAvatarEl(m, 76));

  // Name
  const name = document.createElement('div');
  name.className = 'cc-name'; name.textContent = m.name;
  card.appendChild(name);

  // DOB
  if (m.dob) {
    const dob = document.createElement('div');
    dob.className = 'cc-dob'; dob.textContent = formatDob(m.dob);
    card.appendChild(dob);
  }

  // Tap hint — "View Family →"
  const hint = document.createElement('div');
  hint.className = 'cc-tap-hint';
  hint.textContent = (childCount > 0 ? childCount + ' children · ' : '') + 'View Family →';
  card.appendChild(hint);

  // Click → family page
  card.addEventListener('click', () => goTo('family', m.id));
  return card;
}

/* ══════════════════════════════════════════════
   SCREEN 3 — FAMILY PAGE
   Shows: [child] ♥ [spouse] couple at top,
          their children in a grid below.
          Each grandchild card has "View Family →"
          if they have their own children.
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

  // Update breadcrumb name
  const bcName = document.getElementById('bc-name');
  if (bcName) bcName.textContent = person.name + "'s Family";

  const spouse   = person.spouseId ? getMember(person.spouseId) : null;
  // Collect children from both person and spouse
  const children = _getFamilyChildren(person, spouse);

  // ── Parent context ────────────────────────────
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

  // ── Couple section ────────────────────────────
  const coupleWrap = document.createElement('div');
  coupleWrap.className = 'fam-couple-wrap';

  const coupleRow = document.createElement('div');
  coupleRow.className = 'fam-couple-row';

  coupleRow.appendChild(_makeFamCard(person, true));

  if (spouse) {
    // Determine labels
    const personLabel = person.gender === 'F' ? 'Wife' : person.gender === 'M' ? 'Husband' : 'Partner';
    const spouseLabel = spouse.gender === 'F' ? 'Wife' : spouse.gender === 'M' ? 'Husband' : 'Partner';

    const heartDiv = document.createElement('div');
    heartDiv.className = 'fam-heart';
    heartDiv.innerHTML =
      '<div class="fam-heart-circle">♥</div>' +
      '<div class="fam-heart-lbl">Married</div>';
    coupleRow.appendChild(heartDiv);
    coupleRow.appendChild(_makeFamCard(spouse, false));
  } else {
    // Show "Add Spouse" placeholder
    const ph = document.createElement('div');
    ph.className = 'add-spouse-ph';
    ph.innerHTML =
      '<div class="add-icon">＋</div>' +
      '<div class="add-text">Add Spouse</div>';
    ph.onclick = () => {
      // pre-fill add modal as spouse-of this person
      _openAddModalAs('spouse', person.id);
    };

    const heartDiv = document.createElement('div');
    heartDiv.className = 'fam-heart';
    heartDiv.innerHTML = '<div class="fam-heart-circle" style="opacity:.35">♥</div>';
    coupleRow.appendChild(heartDiv);
    coupleRow.appendChild(ph);
  }

  coupleWrap.appendChild(coupleRow);
  container.appendChild(coupleWrap);

  // ── Children section ──────────────────────────
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

  // ── FAB — add child ───────────────────────────
  const fab = document.createElement('button');
  fab.className = 'fab';
  fab.innerHTML = '＋ Add Child';
  fab.onclick = () => _openAddModalAs('child', person.id);
  container.appendChild(fab);
}

/** Collect unique children of this couple — excludes anyone who is a spouse of a sibling */
function _getFamilyChildren(person, spouse) {
  const seen = new Set();
  const all  = [
    ...getChildren(person.id),
    ...(spouse ? getChildren(spouse.id) : [])
  ];

  // Same reliable approach: sort by id, skip anyone already seen as a spouse
  const seenC = new Set();
  const seenAsSpouseC = new Set();
  const result = [];

  [...all].sort((a, b) => a.id - b.id).forEach(c => {
    if (seenC.has(c.id) || seenAsSpouseC.has(c.id)) return;
    seenC.add(c.id);
    result.push(c);
    if (c.spouseId) seenAsSpouseC.add(c.spouseId);
  });

  return result.sort((a, b) => (a.dob || '').localeCompare(b.dob || ''));
}

/** Large card for the main couple on the family page */
function _makeFamCard(m, isPrimary) {
  const card = document.createElement('div');
  card.className = 'fam-card' + (isPrimary ? ' primary' : '');

  // Role label
  const role = document.createElement('div');
  role.className = 'fmc-role';
  role.textContent = m.gender === 'F' ? '👩 Wife' : m.gender === 'M' ? '👨 Husband' : '👤';
  card.appendChild(role);

  // Bell
  const bell = document.createElement('button');
  bell.className = 'card-bell' + (m.alarm ? ' on' : '');
  bell.innerHTML = '🔔';
  bell.onclick = e => { e.stopPropagation(); toggleAlarm(m.id); _redrawCurrentScreen(); };
  card.appendChild(bell);

  // Birthday dot
  const d = daysUntilBirthday(m.dob);
  if (m.alarm && d !== null && d <= 7) {
    const dot = document.createElement('div'); dot.className = 'bday-dot'; card.appendChild(dot);
  }

  // Avatar
  card.appendChild(buildAvatarEl(m, 96));

  // Name
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

  // Click → profile drawer
  card.addEventListener('click', () => openProfile(m.id));
  return card;
}

/** Smaller card for children shown on the family page */
function _makeFamChildCard(m) {
  const spouse      = m.spouseId ? getMember(m.spouseId) : null;
  const grandkids   = _getFamilyChildren(m, spouse);
  const hasFamily   = grandkids.length > 0 || spouse;

  const card = document.createElement('div');
  card.className = 'fam-child-card';
  card.dataset.memberId = m.id;

  // Bell
  const bell = document.createElement('button');
  bell.className = 'card-bell' + (m.alarm ? ' on' : '');
  bell.innerHTML = '🔔';
  bell.onclick = e => { e.stopPropagation(); toggleAlarm(m.id); _redrawCurrentScreen(); };
  card.appendChild(bell);

  // Birthday dot
  const d = daysUntilBirthday(m.dob);
  if (m.alarm && d !== null && d <= 7) {
    const dot = document.createElement('div'); dot.className = 'bday-dot'; card.appendChild(dot);
  }

  // Avatar
  card.appendChild(buildAvatarEl(m, 66));

  // Name
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

  // "View Family →" drill-down button if they have a family
  if (hasFamily) {
    const btn = document.createElement('button');
    btn.className = 'fcc-drill';
    btn.textContent = 'View Family →';
    btn.onclick = e => { e.stopPropagation(); goTo('family', m.id); };
    card.appendChild(btn);
  }

  // Single tap = profile, only if no drill button
  card.addEventListener('click', () => {
    if (!hasFamily) openProfile(m.id);
  });

  return card;
}

/* ══════════════════════════════════════════════
   PROFILE DRAWER  (slides in from right)
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

  // Avatar
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

  // Spouse row
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

  // Alarm toggle
  const tog = document.getElementById('dAlarmTog');
  tog.className = 'tog' + (m.alarm ? ' on' : '');
  document.getElementById('dAlarmLbl').textContent = 'Alarm ' + (m.alarm ? 'on' : 'off');

  // Show view, hide edit
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

  const sp = m.spouseId ? getMember(m.spouseId) : null;
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
    // refresh drawer avatar
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

/**
 * Open the add modal.
 * If called from context buttons (Add Child / Add Spouse),
 * pass type and parentId to pre-fill the form.
 */
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
    // Pre-fill relationship type
    document.getElementById('fRel').value = type;
    document.getElementById('parentRow').style.display = '';
    document.getElementById('parentLbl').textContent =
      type === 'spouse' ? 'Spouse of' : 'Child of';
    // Populate full dropdown and pre-select the context person
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
    // Give spouse the same parentId as their partner (keeps them at correct generation)
    const partner = getMember(parentId);
    if (partner && partner.parentId) {
      updateMember(newM.id, { parentId: partner.parentId });
    }
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
   SEARCH  (second search input on family screen)
══════════════════════════════════════════════ */
function runSearch2() {
  // Mirror runSearch but use searchInput2 / searchResults2
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
   SYNC STATUS  (called from members.js)
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