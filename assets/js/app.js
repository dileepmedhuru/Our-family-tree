/**
 * app.js  —  Multi-page family tree
 *
 * Pages:
 *  splash   → animated welcome
 *  gen1     → Yellaiah & Vanamma + their 7 children
 *  family   → One child + spouse + their children
 *  profile  → Full member detail (overlay)
 */

/* ── Router state ─────────────────────────────────────────────────── */
let currentPage   = 'splash';
let currentFocusId = null;   // which child is open on "family" page
let breadcrumb    = [];       // [{page, focusId, label}]

/* ── Bootstrap ────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initPhotoInputs();
  loadMembers();   // calls onDataReady when done
});

function onDataReady() {
  startAlarmChecker();
  showPage('splash');
  setTimeout(() => showPage('gen1'), 3000);  // auto-advance splash after 3s
}

function onDataUpdate() {
  refreshCurrentPage();
}

/* ── Page Router ──────────────────────────────────────────────────── */
function showPage(page, focusId) {
  currentPage = page;
  if (focusId !== undefined) currentFocusId = focusId;

  // hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('page-' + page);
  if (el) el.classList.add('active');

  // render
  switch (page) {
    case 'splash': renderSplash();  break;
    case 'gen1':   renderGen1();    break;
    case 'family': renderFamily();  break;
  }

  updateNavBar();
}

function refreshCurrentPage() {
  showPage(currentPage, currentFocusId);
}

/* ── Nav bar ──────────────────────────────────────────────────────── */
function updateNavBar() {
  const nb = document.getElementById('mainNav');
  nb.style.display = currentPage === 'splash' ? 'none' : 'flex';

  // update stats
  const all = getAllMembers();
  document.getElementById('statTotal').textContent  = all.length;
  document.getElementById('statAlarms').textContent = all.filter(m => m.alarm).length;

  // breadcrumb
  renderBreadcrumb();
}

function renderBreadcrumb() {
  const bc = document.getElementById('breadcrumb');
  if (!bc) return;
  bc.innerHTML = '';

  // home crumb
  const home = document.createElement('button');
  home.className = 'bc-btn'; home.textContent = '🏠 Home';
  home.onclick = () => showPage('gen1');
  bc.appendChild(home);

  if (currentPage === 'family' && currentFocusId) {
    const sep = document.createElement('span'); sep.className = 'bc-sep'; sep.textContent = '›';
    bc.appendChild(sep);
    const m = getMember(currentFocusId);
    const label = document.createElement('span');
    label.className = 'bc-current';
    label.textContent = m ? m.name + "'s Family" : 'Family';
    bc.appendChild(label);
  }
}

/* ══════════════════════════════════════════════════════════════
   PAGE 1 — SPLASH
══════════════════════════════════════════════════════════════ */
function renderSplash() {
  // splash is pure CSS/HTML, nothing dynamic needed
  // but check for birthdays
  checkBirthdayAlarms();
}

/* ══════════════════════════════════════════════════════════════
   PAGE 2 — GEN1  (Yellaiah + Vanamma + children)
══════════════════════════════════════════════════════════════ */
function renderGen1() {
  checkBirthdayAlarms();
  const container = document.getElementById('gen1-body');
  if (!container) return;
  container.innerHTML = '';

  // patriarch couple
  const root = getMember(1);  // Yellaiah
  const spouse = root ? getMember(root.spouseId) : null;

  // couple row
  const coupleWrap = document.createElement('div');
  coupleWrap.className = 'gen1-couple';

  coupleWrap.appendChild(buildGen1Card(root));
  if (spouse) {
    const heart = document.createElement('div');
    heart.className = 'heart-divider';
    heart.innerHTML = '<span>♥</span>';
    coupleWrap.appendChild(heart);
    coupleWrap.appendChild(buildGen1Card(spouse));
  }
  container.appendChild(coupleWrap);

  // connector
  const conn = document.createElement('div');
  conn.className = 'gen1-connector';
  conn.innerHTML = '<div class="gen1-vline"></div><div class="gen1-label">Children</div>';
  container.appendChild(conn);

  // children grid
  const children = getChildren(1).sort((a,b) => (a.dob||'').localeCompare(b.dob||''));
  const grid = document.createElement('div');
  grid.className = 'children-grid';

  children.forEach(child => {
    grid.appendChild(buildChildCard(child));
  });

  container.appendChild(grid);
}

function buildGen1Card(m) {
  if (!m) return document.createElement('div');
  const card = document.createElement('div');
  card.className = 'patriarch-card';
  card.onclick = () => openProfile(m.id);

  const av = buildAvatarEl(m, 90);
  card.appendChild(av);

  const name = document.createElement('div');
  name.className = 'pc-name'; name.textContent = m.name;
  card.appendChild(name);

  if (m.dob) {
    const dob = document.createElement('div');
    dob.className = 'pc-dob'; dob.textContent = formatDob(m.dob);
    card.appendChild(dob);
  }
  if (m.note) {
    const note = document.createElement('div');
    note.className = 'pc-note'; note.textContent = m.note;
    card.appendChild(note);
  }

  // bell
  const bell = document.createElement('button');
  bell.className = 'card-bell ' + (m.alarm ? 'on' : '');
  bell.innerHTML = '🔔';
  bell.title = m.alarm ? 'Alarm on' : 'Set alarm';
  bell.onclick = e => { e.stopPropagation(); toggleAlarm(m.id); refreshCurrentPage(); };
  card.appendChild(bell);

  return card;
}

function buildChildCard(m) {
  const childCount = getChildren(m.id).length;
  const spouse = m.spouseId ? getMember(m.spouseId) : null;

  const card = document.createElement('div');
  card.className = 'child-card';
  card.onclick = () => showPage('family', m.id);

  // photo
  const av = buildAvatarEl(m, 80);
  card.appendChild(av);

  const name = document.createElement('div');
  name.className = 'cc-name'; name.textContent = m.name;
  card.appendChild(name);

  if (m.dob) {
    const dob = document.createElement('div');
    dob.className = 'cc-dob'; dob.textContent = formatDob(m.dob);
    card.appendChild(dob);
  }

  if (spouse) {
    const sw = document.createElement('div');
    sw.className = 'cc-spouse';
    sw.innerHTML = `<span class="heart-tiny">♥</span> ${spouse.name}`;
    card.appendChild(sw);
  }

  const footer = document.createElement('div');
  footer.className = 'cc-footer';
  footer.innerHTML = `<span class="cc-children">${childCount} child${childCount !== 1 ? 'ren' : ''}</span><span class="cc-arrow">View Family →</span>`;
  card.appendChild(footer);

  // alarm dot
  const d = daysUntilBirthday(m.dob);
  if (m.alarm && d !== null && d <= 7) {
    const dot = document.createElement('div');
    dot.className = 'bday-dot'; dot.title = d === 0 ? 'Birthday today!' : `Birthday in ${d} days`;
    card.appendChild(dot);
  }

  return card;
}

/* ══════════════════════════════════════════════════════════════
   PAGE 3 — FAMILY  (one child + spouse + their children)
══════════════════════════════════════════════════════════════ */
function renderFamily() {
  checkBirthdayAlarms();
  const container = document.getElementById('family-body');
  if (!container || !currentFocusId) return;
  container.innerHTML = '';

  const person = getMember(currentFocusId);
  if (!person) return;

  const spouse   = person.spouseId ? getMember(person.spouseId) : null;
  const children = getChildren(person.id);

  // ── Couple header ─────────────────────────────
  const coupleSection = document.createElement('div');
  coupleSection.className = 'family-couple-section';

  // parent context
  if (person.parentId) {
    const parent = getMember(person.parentId);
    if (parent) {
      const ctx = document.createElement('div');
      ctx.className = 'parent-context';
      ctx.innerHTML = `<span class="ctx-label">Child of</span> <button class="ctx-link" onclick="showPage('gen1')">${parent.name} &amp; ${getMember(parent.spouseId)?.name || ''}</button>`;
      coupleSection.appendChild(ctx);
    }
  }

  const coupleRow = document.createElement('div');
  coupleRow.className = 'family-couple-row';
  coupleRow.appendChild(buildFamilyCard(person, true));

  if (spouse) {
    const heartDiv = document.createElement('div');
    heartDiv.className = 'family-heart';
    heartDiv.innerHTML = `<div class="heart-circle">♥</div><div class="married-since">Married</div>`;
    coupleRow.appendChild(heartDiv);
    coupleRow.appendChild(buildFamilyCard(spouse, false));
  } else {
    const addSpouseBtn = document.createElement('div');
    addSpouseBtn.className = 'add-spouse-btn';
    addSpouseBtn.innerHTML = '<div class="add-spouse-icon">+</div><div class="add-spouse-text">Add Spouse</div>';
    addSpouseBtn.onclick = () => openAddModal('spouse', person.id);
    coupleRow.appendChild(addSpouseBtn);
  }

  coupleSection.appendChild(coupleRow);
  container.appendChild(coupleSection);

  // ── Children ──────────────────────────────────
  if (children.length > 0) {
    const connEl = document.createElement('div');
    connEl.className = 'family-connector';
    connEl.innerHTML = '<div class="fam-vline"></div><div class="fam-children-label">Their Children</div>';
    container.appendChild(connEl);

    const childGrid = document.createElement('div');
    childGrid.className = 'family-children-grid';

    children.forEach(child => {
      childGrid.appendChild(buildChildFamilyCard(child));
    });
    container.appendChild(childGrid);
  } else {
    const noKids = document.createElement('div');
    noKids.className = 'no-children-msg';
    noKids.innerHTML = `<div class="no-kids-icon">🌱</div><div>No children added yet</div>`;
    container.appendChild(noKids);
  }

  // ── Add child button ───────────────────────────
  const addBtn = document.createElement('button');
  addBtn.className = 'fab-add';
  addBtn.innerHTML = '+ Add Child';
  addBtn.onclick = () => openAddModal('child', person.id);
  container.appendChild(addBtn);
}

function buildFamilyCard(m, isPrimary) {
  const card = document.createElement('div');
  card.className = 'family-member-card ' + (isPrimary ? 'primary' : 'spouse');
  card.onclick = () => openProfile(m.id);

  const role = document.createElement('div');
  role.className = 'fmc-role';
  role.textContent = isPrimary
    ? (m.gender === 'F' ? '👩 Wife' : '👨 Husband')
    : (m.gender === 'F' ? '👩 Wife' : '👨 Husband');
  card.appendChild(role);

  const av = buildAvatarEl(m, 96);
  card.appendChild(av);

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
      ageEl.className = 'fmc-age'; ageEl.textContent = `Age ${age}`;
      card.appendChild(ageEl);
    }
  }

  if (m.note) {
    const note = document.createElement('div');
    note.className = 'fmc-note'; note.textContent = m.note;
    card.appendChild(note);
  }

  const bell = document.createElement('button');
  bell.className = 'card-bell ' + (m.alarm ? 'on' : '');
  bell.innerHTML = '🔔'; bell.title = m.alarm ? 'Alarm on' : 'Set alarm';
  bell.onclick = e => { e.stopPropagation(); toggleAlarm(m.id); refreshCurrentPage(); };
  card.appendChild(bell);

  const d = daysUntilBirthday(m.dob);
  if (m.alarm && d !== null && d <= 7) {
    const dot = document.createElement('div');
    dot.className = 'bday-dot';
    card.appendChild(dot);
  }

  return card;
}

function buildChildFamilyCard(m) {
  const grandkids = getChildren(m.id);
  const spouse = m.spouseId ? getMember(m.spouseId) : null;

  const card = document.createElement('div');
  card.className = 'child-fam-card';

  const av = buildAvatarEl(m, 68);
  card.appendChild(av);

  const name = document.createElement('div');
  name.className = 'cfc-name'; name.textContent = m.name;
  card.appendChild(name);

  if (m.dob) {
    const dob = document.createElement('div');
    dob.className = 'cfc-dob'; dob.textContent = formatDob(m.dob);
    card.appendChild(dob);
  }

  if (spouse) {
    const sw = document.createElement('div');
    sw.className = 'cfc-spouse'; sw.innerHTML = `♥ ${spouse.name}`;
    card.appendChild(sw);
  }

  if (grandkids.length > 0) {
    const gk = document.createElement('div');
    gk.className = 'cfc-kids'; gk.textContent = `${grandkids.length} child${grandkids.length !== 1 ? 'ren' : ''}`;
    card.appendChild(gk);

    const btn = document.createElement('button');
    btn.className = 'cfc-view-btn';
    btn.textContent = 'View Family →';
    btn.onclick = e => { e.stopPropagation(); showPage('family', m.id); };
    card.appendChild(btn);
  }

  card.onclick = () => openProfile(m.id);

  const bell = document.createElement('button');
  bell.className = 'card-bell ' + (m.alarm ? 'on' : '');
  bell.innerHTML = '🔔'; bell.title = m.alarm ? 'Alarm on' : 'Set alarm';
  bell.onclick = e => { e.stopPropagation(); toggleAlarm(m.id); refreshCurrentPage(); };
  card.appendChild(bell);

  return card;
}

/* ══════════════════════════════════════════════════════════════
   PROFILE OVERLAY
══════════════════════════════════════════════════════════════ */
let _profId   = null;
let _profEdit = false;

function openProfile(id) {
  const m = getMember(id); if (!m) return;
  _profId = id; _profEdit = false;
  renderProfileView(m);
  document.getElementById('profileModal').classList.add('open');
}

function renderProfileView(m) {
  _profEdit = false;
  const av = document.getElementById('pAvatar');
  av.innerHTML = '';
  if (m.photo) {
    const img = document.createElement('img'); img.src = m.photo; av.appendChild(img);
  } else { av.textContent = initials(m.name); }

  document.getElementById('pName').textContent = m.name;
  document.getElementById('pNote').textContent = m.note || '';

  const sp  = m.spouseId ? getMember(m.spouseId) : null;
  const ch  = getChildren(m.id);
  const age = ageToday(m.dob);
  document.getElementById('pMeta').textContent = [
    m.gender === 'M' ? 'Male' : m.gender === 'F' ? 'Female' : '',
    age !== null ? `Age ${age}` : '',
    ch.length ? `${ch.length} child${ch.length > 1 ? 'ren' : ''}` : ''
  ].filter(Boolean).join(' · ');

  const spouseRow  = document.getElementById('pSpouseRow');
  const spouseLbl  = document.getElementById('pSpouseLabel');
  const spouseName = document.getElementById('pSpouseName');
  if (sp) {
    spouseLbl.textContent  = m.gender === 'F' ? 'Wife of' : m.gender === 'M' ? 'Husband of' : 'Spouse of';
    spouseName.textContent = sp.name;
    spouseRow.style.display = '';
  } else { spouseRow.style.display = 'none'; }

  document.getElementById('pDob').textContent = m.dob ? 'Born: ' + formatDob(m.dob) : 'No date of birth';
  const d = daysUntilBirthday(m.dob);
  document.getElementById('pDays').textContent = d === null ? ''
    : d === 0 ? '🎂 Birthday Today!' : d === 1 ? '🔔 Birthday Tomorrow!' : `🔔 Birthday in ${d} days`;

  syncProfAlarmToggle(m.alarm);

  document.getElementById('profViewBody').style.display   = '';
  document.getElementById('profEditForm').style.display   = 'none';
  document.getElementById('profViewActions').style.display = '';
  document.getElementById('profEditActions').style.display = 'none';
  document.getElementById('editSuccess').style.display    = 'none';
}

function enterEditMode() {
  const m = getMember(_profId); if (!m) return;
  _profEdit = true;
  document.getElementById('eName').value   = m.name   || '';
  document.getElementById('eDob').value    = m.dob    || '';
  document.getElementById('eNote').value   = m.note   || '';
  document.getElementById('eGender').value = m.gender || '';
  const sp2 = m.spouseId ? getMember(m.spouseId) : null;
  const esr = document.getElementById('eSpouseRow');
  if (sp2) {
    document.getElementById('eSpouseLabel').textContent = m.gender === 'F' ? 'Wife of' : 'Husband of';
    document.getElementById('eSpouseName').textContent  = sp2.name;
    esr.style.display = '';
  } else esr.style.display = 'none';
  document.getElementById('profViewBody').style.display    = 'none';
  document.getElementById('profEditForm').style.display    = '';
  document.getElementById('profViewActions').style.display = 'none';
  document.getElementById('profEditActions').style.display = '';
  setTimeout(() => document.getElementById('eName').focus(), 50);
}

function cancelEdit() { const m = getMember(_profId); if (m) renderProfileView(m); }

function saveEdit() {
  const name = document.getElementById('eName').value.trim();
  if (!name) { showEditError('Name cannot be empty.'); return; }
  updateMember(_profId, { name, dob: document.getElementById('eDob').value, note: document.getElementById('eNote').value.trim(), gender: document.getElementById('eGender').value });
  refreshCurrentPage();
  renderProfileView(getMember(_profId));
  const s = document.getElementById('editSuccess');
  s.textContent = '✓ Saved!'; s.style.display = 'block';
  setTimeout(() => s.style.display = 'none', 2000);
}

function closeProfile() { document.getElementById('profileModal').classList.remove('open'); }
function syncProfAlarmToggle(state) {
  document.getElementById('pToggle').className = 'tog ' + (state ? 'on' : '');
  document.getElementById('pTogLbl').textContent = 'Alarm ' + (state ? 'on' : 'off');
}
function flipProfAlarm() {
  const v = toggleAlarm(_profId); syncProfAlarmToggle(v); refreshCurrentPage();
}
function triggerProfPhoto() {
  triggerPhotoUpload(_profId, (id, url) => {
    setPhoto(id, url); refreshCurrentPage(); openProfile(id);
  });
}
function showEditError(msg) {
  const el = document.getElementById('editError');
  el.textContent = msg; el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 3000);
}
function confirmDeleteMember() {
  const m = getMember(_profId); if (!m) return;
  if (!confirm(`Remove "${m.name}"? This cannot be undone.`)) return;
  deleteMember(_profId); closeProfile(); refreshCurrentPage();
}

/* ══════════════════════════════════════════════════════════════
   ADD MEMBER MODAL
══════════════════════════════════════════════════════════════ */
let _formAlarm = false;
let _formPhoto = null;
let _addContext = null;  // {type:'child'|'spouse', parentId}

function openAddModal(type, parentId) {
  _addContext = type ? { type, parentId } : null;
  _formAlarm = false; _formPhoto = null;

  ['fName','fDob','fNote'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('fGender').value = '';
  document.getElementById('fToggle').className = 'tog';
  document.getElementById('fTogLbl').textContent = 'Off';
  document.getElementById('prevImg').style.display  = 'none';
  document.getElementById('dropHint').style.display = 'block';
  document.getElementById('formError').style.display = 'none';

  // Set relationship type
  if (_addContext) {
    document.getElementById('fRel').value = _addContext.type;
    document.getElementById('parentRow').style.display = 'flex';
    document.getElementById('parentLbl').textContent = _addContext.type === 'spouse' ? 'Spouse of' : 'Child of';
    const sel = document.getElementById('fParent');
    sel.innerHTML = '';
    const m = getMember(_addContext.parentId);
    if (m) { const o = document.createElement('option'); o.value = m.id; o.textContent = m.name; sel.appendChild(o); }
  } else {
    document.getElementById('fRel').value = 'child';
    populateMemberDropdown('child');
    onRelChange();
  }

  document.getElementById('addModal').classList.add('open');
}

function closeAddModal() { document.getElementById('addModal').classList.remove('open'); }

function onRelChange() {
  const rt = document.getElementById('fRel').value;
  document.getElementById('parentRow').style.display = rt === 'root' ? 'none' : 'flex';
  document.getElementById('parentLbl').textContent = rt === 'spouse' ? 'Spouse of' : 'Child of';
  if (rt !== 'root') populateMemberDropdown(rt);
}

function populateMemberDropdown(rt) {
  const sel = document.getElementById('fParent');
  sel.innerHTML = '';
  const list = rt === 'spouse' ? getAllMembers().filter(m => !m.spouseId) : getAllMembers();
  list.forEach(m => {
    const o = document.createElement('option');
    o.value = m.id; o.textContent = m.name + (m.dob ? '  (' + formatDob(m.dob) + ')' : '');
    sel.appendChild(o);
  });
}

function flipFormAlarm() {
  _formAlarm = !_formAlarm;
  document.getElementById('fToggle').className = 'tog ' + (_formAlarm ? 'on' : '');
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

  const rt = document.getElementById('fRel').value;
  const parentId = rt === 'root' ? null : parseInt(document.getElementById('fParent').value, 10);

  const newM = addMember({
    name, dob: document.getElementById('fDob').value,
    gender: document.getElementById('fGender').value,
    note:   document.getElementById('fNote').value.trim(),
    parentId: rt === 'child' ? parentId : null,
    photo: _formPhoto, alarm: _formAlarm
  });

  if (rt === 'spouse' && parentId) {
    linkSpouses(parentId, newM.id);
    const partner = getMember(parentId);
    if (partner && partner.parentId) updateMember(newM.id, { parentId: partner.parentId });
  }

  closeAddModal(); refreshCurrentPage();
}

function showFormError(msg) {
  const el = document.getElementById('formError');
  el.textContent = msg; el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 3000);
}

/* ── Search ───────────────────────────────────────────────────────── */
let _searchT = null;

function initSearchEvents() {
  const input = document.getElementById('searchInput');
  if (!input) return;
  input.addEventListener('input', () => {
    clearTimeout(_searchT); _searchT = setTimeout(runSearch, 120);
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') hideSearchDrop();
    if (e.key === 'Enter') { const f = document.querySelector('.search-result-item'); if (f) f.click(); }
  });
  document.addEventListener('click', e => { if (!e.target.closest('.search-wrap')) hideSearchDrop(); });
}

function runSearch() {
  const q   = (document.getElementById('searchInput').value || '').trim().toLowerCase();
  const box = document.getElementById('searchResults');
  if (!q) { hideSearchDrop(); return; }
  const res = getAllMembers().filter(m => m.name.toLowerCase().includes(q) || (m.note||'').toLowerCase().includes(q));
  if (!res.length) { hideSearchDrop(); return; }
  box.innerHTML = '';
  res.forEach(m => {
    const item = document.createElement('div');
    item.className = 'search-result-item';
    const av = document.createElement('div');
    av.className = 'sri-av';
    if (m.photo) { const img = document.createElement('img'); img.src = m.photo; av.appendChild(img); }
    else av.textContent = initials(m.name);
    const txt = document.createElement('div');
    txt.innerHTML = `<div class="sri-name">${m.name}</div><div class="sri-dob">${formatDob(m.dob)}</div>`;
    item.appendChild(av); item.appendChild(txt);
    item.onclick = () => { hideSearchDrop(); document.getElementById('searchInput').value = ''; openProfile(m.id); };
    box.appendChild(item);
  });
  box.style.display = 'block';
}

function hideSearchDrop() {
  const box = document.getElementById('searchResults');
  if (box) box.style.display = 'none';
}

function clearSearch() {
  document.getElementById('searchInput').value = '';
  hideSearchDrop();
}

/* ── Sync status ─────────────────────────────────────────────────── */
function setSyncStatus(state) {
  const el = document.getElementById('syncStatus');
  if (!el) return;
  const map = { connecting:'⏳', synced:'🟢 Live', offline:'🟡 Offline', error:'🔴 Error' };
  el.textContent = map[state] || '🟡';
}

function showFirebaseError(msg) {
  let el = document.getElementById('fbError');
  if (!el) {
    el = document.createElement('div'); el.id = 'fbError';
    el.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#2a0a0a;border:1px solid #e05252;border-radius:10px;color:#f0c0c0;font-size:13px;max-width:90vw;padding:12px 16px;z-index:9999;';
    document.body.appendChild(el);
  }
  el.innerHTML = msg + ' <button onclick="this.parentElement.remove()" style="margin-left:8px;background:none;border:none;color:#e05252;cursor:pointer">✕</button>';
}

// init search once DOM ready
document.addEventListener('DOMContentLoaded', () => setTimeout(initSearchEvents, 500));