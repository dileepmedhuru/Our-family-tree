/**
 * search.js
 * Live search with dropdown results and card/page navigation.
 * Depends on: members.js (getAllMembers, getMember), alarms.js (formatDob),
 *             photos.js (initials), app.js (showPage, openProfile, expandedIds)
 */

let _searchTimeout = null;

/* ══════════════════════════════════════════════════════════════
   INIT  —  call once after DOM ready
══════════════════════════════════════════════════════════════ */
function initSearch() {
  const input = document.getElementById('searchInput');
  if (!input) return;

  /* Type → debounced search */
  input.addEventListener('input', () => {
    clearTimeout(_searchTimeout);
    _searchTimeout = setTimeout(runSearch, 140);
  });

  /* Keyboard shortcuts */
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      clearSearch();
    }
    if (e.key === 'Enter') {
      const first = document.querySelector('#searchResults .search-result-item');
      if (first) first.click();
    }
    /* Arrow keys to move through results */
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      _moveSelection(e.key === 'ArrowDown' ? 1 : -1);
    }
  });

  /* Close dropdown when clicking outside the search area */
  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrap')) hideSearchDropdown();
  });
}

/* ══════════════════════════════════════════════════════════════
   SEARCH LOGIC
══════════════════════════════════════════════════════════════ */
function runSearch() {
  const q   = (document.getElementById('searchInput').value || '').trim().toLowerCase();
  const box = document.getElementById('searchResults');
  if (!box) return;

  if (!q) { hideSearchDropdown(); return; }

  /* Search by name AND note/occupation */
  const results = getAllMembers().filter(m =>
    m.name.toLowerCase().includes(q) ||
    (m.note   && m.note.toLowerCase().includes(q)) ||
    (m.gender === 'M' && 'male'.includes(q)) ||
    (m.gender === 'F' && 'female'.includes(q))
  );

  if (!results.length) {
    box.innerHTML = '<div class="search-no-results">No members found</div>';
    box.style.display = 'block';
    return;
  }

  box.innerHTML = '';

  results.forEach(m => {
    const item = document.createElement('div');
    item.className = 'search-result-item';
    item.setAttribute('tabindex', '0');

    /* Mini circular avatar */
    const av = document.createElement('div');
    av.className = 'sri-av';
    if (m.photo) {
      const img = document.createElement('img');
      img.src = m.photo;
      img.alt = m.name;
      av.appendChild(img);
    } else {
      av.textContent = initials(m.name);
    }

    /* Text info */
    const txt = document.createElement('div');
    txt.innerHTML =
      `<div class="sri-name">${_highlight(m.name, q)}</div>` +
      `<div class="sri-dob">${formatDob(m.dob) || ''}${m.note ? ' · ' + m.note : ''}</div>`;

    item.appendChild(av);
    item.appendChild(txt);

    /* Click → navigate to member */
    item.addEventListener('click',  () => jumpToMember(m.id));
    item.addEventListener('keydown', e => { if (e.key === 'Enter') jumpToMember(m.id); });

    box.appendChild(item);
  });

  box.style.display = 'block';
}

/* ══════════════════════════════════════════════════════════════
   NAVIGATION
══════════════════════════════════════════════════════════════ */

/**
 * Jump directly to the member:
 *  - If they're a root (Gen 1 person) → show gen1 page
 *  - Otherwise find their parent branch and open the family page,
 *    then highlight their card
 */
function jumpToMember(id) {
  clearSearch();

  const m = getMember(id);
  if (!m) return;

  /* Determine which page and which focus to show */
  if (!m.parentId) {
    /* Root-level member → Generation 1 page */
    showPage('gen1');
  } else {
    /* Find the "family page owner" — walk up until we find
       a child of a root member, that's whose family page to open */
    const familyOwner = _findFamilyPageOwner(m);
    if (familyOwner) {
      showPage('family', familyOwner);
    } else {
      showPage('gen1');
    }
  }

  /* Highlight the target card after the page has rendered */
  setTimeout(() => _highlightCard(id), 180);
}

/**
 * Walk up the tree to find the ancestor whose family page should be shown.
 * "Family page owner" = a direct child of a root member (Gen 2).
 */
function _findFamilyPageOwner(m) {
  if (!m) return null;

  /* If this member is a direct child of a root → they are the owner */
  if (m.parentId) {
    const parent = getMember(m.parentId);
    if (parent && !parent.parentId) return m.id;
  }

  /* Otherwise walk up */
  if (m.parentId) {
    return _findFamilyPageOwner(getMember(m.parentId));
  }

  return null;
}

/**
 * Flash-highlight the card for a given member id.
 */
function _highlightCard(id) {
  const m = getMember(id);
  if (!m) return;

  const cards = document.querySelectorAll('.card-name, .cc-name, .fmc-name, .cfc-name, .pc-name');
  cards.forEach(nameEl => {
    if (nameEl.textContent.trim() === m.name) {
      const card = nameEl.closest(
        '.child-card, .family-member-card, .child-fam-card, .patriarch-card'
      );
      if (card) {
        card.classList.add('highlighted');
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => card.classList.remove('highlighted'), 2500);
      }
    }
  });
}

/* ══════════════════════════════════════════════════════════════
   DROPDOWN HELPERS
══════════════════════════════════════════════════════════════ */

function hideSearchDropdown() {
  const box = document.getElementById('searchResults');
  if (box) box.style.display = 'none';
}

function clearSearch() {
  const input = document.getElementById('searchInput');
  if (input) input.value = '';
  hideSearchDropdown();
}

/** Move keyboard selection up/down through result items */
function _moveSelection(dir) {
  const items = document.querySelectorAll('#searchResults .search-result-item');
  if (!items.length) return;
  const active = document.querySelector('#searchResults .search-result-item.kbd-focus');
  let idx = -1;
  items.forEach((el, i) => { if (el === active) idx = i; });

  if (active) active.classList.remove('kbd-focus');
  idx = Math.max(0, Math.min(items.length - 1, idx + dir));
  items[idx].classList.add('kbd-focus');
  items[idx].scrollIntoView({ block: 'nearest' });
}

/* ══════════════════════════════════════════════════════════════
   TEXT HIGHLIGHT
══════════════════════════════════════════════════════════════ */

/** Wrap the matching substring in a <mark> tag */
function _highlight(text, query) {
  if (!query) return text;
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i === -1) return text;
  return (
    text.slice(0, i) +
    '<mark style="background:rgba(139,92,246,.28);color:#c4b5fd;border-radius:3px;padding:0 1px">' +
    text.slice(i, i + query.length) +
    '</mark>' +
    text.slice(i + query.length)
  );
}