/**
 * search.js
 * Live search with dropdown results and card highlighting.
 */

let _searchTimeout = null;

/* ─── Init ─────────────────────────────────────────────────────────── */

function initSearch() {
  const input = document.getElementById('searchInput');
  const box   = document.getElementById('searchResults');

  input.addEventListener('input', onSearchInput);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideSearchDropdown();
    if (e.key === 'Enter') {
      const first = box.querySelector('.search-result-item');
      if (first) first.click();
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrap')) hideSearchDropdown();
  });
}

/* ─── Handlers ─────────────────────────────────────────────────────── */

function onSearchInput() {
  clearTimeout(_searchTimeout);
  _searchTimeout = setTimeout(runSearch, 120);
}

function runSearch() {
  const q   = document.getElementById('searchInput').value.trim().toLowerCase();
  const box = document.getElementById('searchResults');

  if (!q) { hideSearchDropdown(); return; }

  const results = getAllMembers().filter(m =>
    m.name.toLowerCase().includes(q) ||
    (m.note && m.note.toLowerCase().includes(q))
  );

  if (!results.length) { hideSearchDropdown(); return; }

  box.innerHTML = '';
  results.forEach(m => {
    const item = document.createElement('div');
    item.className = 'search-result-item';

    /* Mini avatar */
    const av = document.createElement('div');
    av.className = 'sri-av';
    if (m.photo) {
      const img = document.createElement('img');
      img.src = m.photo;
      av.appendChild(img);
    } else {
      av.textContent = initials(m.name);
    }

    const txt = document.createElement('div');
    txt.innerHTML = `
      <div class="sri-name">${highlightMatch(m.name, q)}</div>
      <div class="sri-dob">${formatDob(m.dob)}${m.note ? ' · ' + m.note : ''}</div>
    `;

    item.appendChild(av);
    item.appendChild(txt);
    item.addEventListener('click', () => jumpToMember(m.id));
    box.appendChild(item);
  });

  box.style.display = 'block';
}

function hideSearchDropdown() {
  document.getElementById('searchResults').style.display = 'none';
}

function clearSearch() {
  document.getElementById('searchInput').value = '';
  hideSearchDropdown();
}

/* ─── Jump-to & highlight ──────────────────────────────────────────── */

function jumpToMember(id) {
  clearSearch();

  expandedIds.add(id);
  const m = getMember(id);
  if (m && m.parentId) expandedIds.add(m.parentId);

  buildTree();

  setTimeout(() => {
    const all = document.querySelectorAll('.card');
    all.forEach(card => {
      const nameEl = card.querySelector('.card-name');
      if (nameEl && nameEl.textContent === getMember(id)?.name) {
        card.classList.add('highlighted');
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => card.classList.remove('highlighted'), 2500);
      }
    });
  }, 150);
}

/* ─── Helpers ──────────────────────────────────────────────────────── */

function highlightMatch(text, query) {
  const idx = text.toLowerCase().indexOf(query);
  if (idx === -1) return text;
  return (
    text.slice(0, idx) +
    '<mark style="background:#7c3aed22;color:#c8a0f0;border-radius:3px">' +
    text.slice(idx, idx + query.length) +
    '</mark>' +
    text.slice(idx + query.length)
  );
}