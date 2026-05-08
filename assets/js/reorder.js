/**
 * reorder.js  —  Drag-to-reorder for child cards
 * Works on both Gen 1 (children-grid) and family pages (fam-children-grid).
 * Uses HTML5 drag API for desktop + touch events for mobile.
 */

let _reorderActive  = false;
let _dragSrcEl      = null;
let _dragSrcIndex   = null;
let _reorderGrid    = null;   // the grid currently being reordered
let _reorderParentId = null;  // parentId of the group being reordered

/* ── Toggle reorder mode ──────────────────────────────────────── */
function toggleReorderMode() {
  _reorderActive = !_reorderActive;

  // Pick the right grid
  const gridId = (_currentScreen === 'gen1') ? 'children-grid' : null;
  _reorderGrid = gridId
    ? document.getElementById(gridId)
    : document.querySelector('#family-page-body .fam-children-grid');

  if (!_reorderGrid) { _reorderActive = false; return; }

  // Determine parent id for this group
  if (_currentScreen === 'gen1') {
    const roots = getRoots();
    const patriarch = roots.find(m => m.gender === 'M') || roots[0];
    _reorderParentId = patriarch ? patriarch.id : null;
  } else {
    _reorderParentId = _focusId;
  }

  // Update button states
  ['reorderBtn', 'reorderBtn2'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.classList.toggle('active', _reorderActive);
  });

  const fab = document.getElementById('saveOrderFab');

  if (_reorderActive) {
    _reorderGrid.classList.add('reorder-mode');
    _bindDragEvents(_reorderGrid);
    if (fab) fab.classList.add('visible');
    _showReorderHint();
  } else {
    _reorderGrid.classList.remove('reorder-mode');
    _unbindDragEvents(_reorderGrid);
    if (fab) fab.classList.remove('visible');
  }
}

/* ── Save order ───────────────────────────────────────────────── */
function saveCurrentOrder() {
  if (!_reorderGrid || _reorderParentId == null) return;

  const cards = [..._reorderGrid.children];
  // Read member id from data attribute we set at card-build time
  const idOrder = cards
    .map(c => parseInt(c.dataset.memberId, 10))
    .filter(id => !isNaN(id));

  setGroupOrder(_reorderParentId, idOrder);

  // Exit reorder mode
  _reorderActive = true;   // toggleReorderMode flips it
  toggleReorderMode();

  // Toast
  _showToast('✓ Order saved!');
}

/* ── Hint toast ───────────────────────────────────────────────── */
function _showReorderHint() {
  const old = document.querySelector('.reorder-hint');
  if (old) old.remove();
  const el = document.createElement('div');
  el.className = 'reorder-hint';
  el.textContent = '✦ Drag cards to reorder · tap Save Order when done';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3600);
}

function _showToast(msg) {
  const el = document.createElement('div');
  el.className = 'reorder-hint';
  el.textContent = msg;
  el.style.borderColor = 'var(--gold-dim)';
  el.style.color = 'var(--gold)';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

/* ── Drag event binding ───────────────────────────────────────── */
function _bindDragEvents(grid) {
  [...grid.children].forEach(card => {
    card.setAttribute('draggable', 'true');
    card.addEventListener('dragstart',  _onDragStart);
    card.addEventListener('dragenter',  _onDragEnter);
    card.addEventListener('dragover',   _onDragOver);
    card.addEventListener('dragleave',  _onDragLeave);
    card.addEventListener('drop',       _onDrop);
    card.addEventListener('dragend',    _onDragEnd);
    // Touch
    card.addEventListener('touchstart', _onTouchStart, { passive: false });
    card.addEventListener('touchmove',  _onTouchMove,  { passive: false });
    card.addEventListener('touchend',   _onTouchEnd);
  });
}

function _unbindDragEvents(grid) {
  [...grid.children].forEach(card => {
    card.removeAttribute('draggable');
    card.removeEventListener('dragstart',  _onDragStart);
    card.removeEventListener('dragenter',  _onDragEnter);
    card.removeEventListener('dragover',   _onDragOver);
    card.removeEventListener('dragleave',  _onDragLeave);
    card.removeEventListener('drop',       _onDrop);
    card.removeEventListener('dragend',    _onDragEnd);
    card.removeEventListener('touchstart', _onTouchStart);
    card.removeEventListener('touchmove',  _onTouchMove);
    card.removeEventListener('touchend',   _onTouchEnd);
  });
}

/* ── Mouse / HTML5 drag ───────────────────────────────────────── */
function _onDragStart(e) {
  _dragSrcEl = this;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', this.dataset.memberId);
  setTimeout(() => this.classList.add('drag-ghost'), 0);
}

function _onDragEnter(e) {
  e.preventDefault();
  if (this !== _dragSrcEl) this.classList.add('drag-over');
}

function _onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function _onDragLeave() {
  this.classList.remove('drag-over');
}

function _onDrop(e) {
  e.preventDefault();
  this.classList.remove('drag-over');
  if (this === _dragSrcEl || !_dragSrcEl) return;

  const grid = this.parentNode;
  const cards = [...grid.children];
  const srcIdx  = cards.indexOf(_dragSrcEl);
  const destIdx = cards.indexOf(this);

  if (srcIdx < destIdx) {
    grid.insertBefore(_dragSrcEl, this.nextSibling);
  } else {
    grid.insertBefore(_dragSrcEl, this);
  }
}

function _onDragEnd() {
  this.classList.remove('drag-ghost');
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  _dragSrcEl = null;
}

/* ── Touch drag ───────────────────────────────────────────────── */
let _touchClone   = null;
let _touchSrc     = null;
let _touchOffsetX = 0;
let _touchOffsetY = 0;

function _onTouchStart(e) {
  if (!_reorderActive) return;
  _touchSrc = this;
  const touch  = e.touches[0];
  const rect   = this.getBoundingClientRect();
  _touchOffsetX = touch.clientX - rect.left;
  _touchOffsetY = touch.clientY - rect.top;

  // Create floating clone
  _touchClone = this.cloneNode(true);
  _touchClone.style.cssText = [
    'position:fixed',
    'left:' + rect.left + 'px',
    'top:'  + rect.top  + 'px',
    'width:'  + rect.width  + 'px',
    'height:' + rect.height + 'px',
    'opacity:0.85',
    'pointer-events:none',
    'z-index:9999',
    'border:2px solid var(--gold)',
    'border-radius:18px',
    'box-shadow:0 12px 40px rgba(0,0,0,.6)',
    'transition:none',
    'background:var(--bg3)'
  ].join(';');
  document.body.appendChild(_touchClone);
  this.classList.add('drag-ghost');
  e.preventDefault();
}

function _onTouchMove(e) {
  if (!_touchClone || !_touchSrc) return;
  e.preventDefault();
  const touch = e.touches[0];

  _touchClone.style.left = (touch.clientX - _touchOffsetX) + 'px';
  _touchClone.style.top  = (touch.clientY - _touchOffsetY) + 'px';

  // Find card under touch point (hide clone briefly)
  _touchClone.style.display = 'none';
  const el = document.elementFromPoint(touch.clientX, touch.clientY);
  _touchClone.style.display = '';

  const target = el && el.closest('.child-card, .fam-child-card');
  if (target && target !== _touchSrc && target.parentNode === _reorderGrid) {
    document.querySelectorAll('.drag-over').forEach(n => n.classList.remove('drag-over'));
    target.classList.add('drag-over');
    _touchDropTarget = target;
  } else {
    document.querySelectorAll('.drag-over').forEach(n => n.classList.remove('drag-over'));
    _touchDropTarget = null;
  }
}

let _touchDropTarget = null;

function _onTouchEnd() {
  if (_touchClone) { _touchClone.remove(); _touchClone = null; }
  document.querySelectorAll('.drag-over').forEach(n => n.classList.remove('drag-over'));

  if (_touchSrc && _touchDropTarget && _touchDropTarget !== _touchSrc) {
    const grid    = _touchSrc.parentNode;
    const cards   = [...grid.children];
    const srcIdx  = cards.indexOf(_touchSrc);
    const destIdx = cards.indexOf(_touchDropTarget);
    if (srcIdx < destIdx) {
      grid.insertBefore(_touchSrc, _touchDropTarget.nextSibling);
    } else {
      grid.insertBefore(_touchSrc, _touchDropTarget);
    }
  }

  if (_touchSrc) { _touchSrc.classList.remove('drag-ghost'); _touchSrc = null; }
  _touchDropTarget = null;
}