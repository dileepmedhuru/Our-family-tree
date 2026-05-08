/**
 * pdf.js
 * Generates a beautiful multi-page PDF of the Medhuru Family Tree.
 * Uses html2canvas + jsPDF loaded from CDN.
 *
 * Include in index.html AFTER the other scripts:
 *   <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
 *   <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
 *   <script src="assets/js/pdf.js"></script>
 */

/* ── Main entry point ──────────────────────────────────────────────── */
async function downloadPDF() {
  const btn = document.getElementById('pdfBtn');
  if (!btn) { _generatePDF(); return; }

  /* Loading state */
  btn.disabled  = true;
  btn.innerHTML = '<i class="ti ti-loader" style="animation:spin .8s linear infinite"></i><span>Building…</span>';
  _ensureSpinStyle();

  try {
    await _generatePDF();
  } catch (err) {
    console.error('PDF generation failed:', err);
    alert('PDF generation failed: ' + err.message);
  } finally {
    btn.disabled  = false;
    btn.innerHTML = '<i class="ti ti-download"></i><span>PDF</span>';
  }
}

/* ── Core generator ────────────────────────────────────────────────── */
async function _generatePDF() {
  /* Check libraries */
  if (typeof html2canvas === 'undefined') {
    throw new Error('html2canvas not loaded. Add the CDN script to index.html.');
  }
  if (typeof window.jspdf === 'undefined') {
    throw new Error('jsPDF not loaded. Add the CDN script to index.html.');
  }

  const { jsPDF } = window.jspdf;
  const members   = getAllMembers();
  const today     = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  /* ── Temporarily render the full gen1 page for screenshot ── */
  const prevPage    = currentPage;
  const prevFocusId = currentFocusId;

  showPage('gen1');
  await _wait(400);   /* let DOM paint */

  const canvas = document.getElementById('gen1-body');

  const shot = await html2canvas(canvas, {
    backgroundColor: '#0a0815',
    scale:           1.8,
    useCORS:         true,
    allowTaint:      true,
    logging:         false,
    scrollX:         0,
    scrollY:         -window.scrollY,
    windowWidth:     canvas.scrollWidth  + 60,
    windowHeight:    canvas.scrollHeight + 60
  });

  /* Restore previous page */
  showPage(prevPage, prevFocusId);

  /* ── PDF dimensions ── */
  const pageW   = 297;  /* A4 landscape mm */
  const pageH   = 210;
  const margin  = 14;
  const headerH = 22;
  const footerH = 8;
  const usableW = pageW - margin * 2;
  const usableH = pageH - margin * 2 - headerH - footerH;

  /* Scale image to usable width */
  const scale    = usableW / shot.width;
  const scaledH  = shot.height * scale;
  const pages    = Math.ceil(scaledH / usableH);

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  /* ── Tree pages ── */
  for (let p = 0; p < pages; p++) {
    if (p > 0) pdf.addPage();

    /* Dark background */
    pdf.setFillColor(10, 8, 21);
    pdf.rect(0, 0, pageW, pageH, 'F');

    /* Gold top bar */
    pdf.setFillColor(232, 179, 74);
    pdf.rect(0, 0, pageW, 4, 'F');

    /* Title */
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(232, 179, 74);
    pdf.text('✦  Medhuru Family Tree  ✦', margin, 14);

    /* Subtitle */
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(120, 104, 168);
    pdf.text(
      `${members.length} members  ·  Generated ${today}  ·  Page ${p + 1} of ${pages}`,
      margin, 20
    );

    /* Separator line */
    pdf.setDrawColor(46, 38, 80);
    pdf.line(margin, 22, pageW - margin, 22);

    /* ── Slice of the screenshot ── */
    const srcY      = (p * usableH) / scale;
    const srcSliceH = Math.min(usableH / scale, shot.height - srcY);
    if (srcSliceH <= 0) break;

    const sliceCanvas        = document.createElement('canvas');
    sliceCanvas.width        = shot.width;
    sliceCanvas.height       = Math.ceil(srcSliceH);
    const ctx                = sliceCanvas.getContext('2d');
    ctx.drawImage(shot, 0, -srcY);
    const sliceData          = sliceCanvas.toDataURL('image/jpeg', 0.92);
    const sliceDrawH         = srcSliceH * scale;

    pdf.addImage(sliceData, 'JPEG', margin, margin + headerH, usableW, sliceDrawH);

    /* Footer */
    _drawFooter(pdf, pageW, pageH, margin, p + 1, pages, today);
  }

  /* ── Member directory appendix ── */
  _appendMemberDirectory(pdf, members, pageW, pageH, margin, today);

  /* ── Save ── */
  pdf.save(`Medhuru_Family_Tree_${today.replace(/ /g, '_')}.pdf`);
}

/* ── Member directory page ─────────────────────────────────────────── */
function _appendMemberDirectory(pdf, members, pageW, pageH, margin, today) {
  pdf.addPage();
  pdf.setFillColor(10, 8, 21);
  pdf.rect(0, 0, pageW, pageH, 'F');

  /* Gold bar */
  pdf.setFillColor(232, 179, 74);
  pdf.rect(0, 0, pageW, 4, 'F');

  /* Title */
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.setTextColor(232, 179, 74);
  pdf.text('Family Member Directory', margin, 14);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(120, 104, 168);
  pdf.text(`${members.length} members  ·  ${today}`, margin, 20);

  pdf.setDrawColor(46, 38, 80);
  pdf.line(margin, 22, pageW - margin, 22);

  /* Table columns */
  const cols = { name: margin, dob: margin + 68, age: margin + 118, gender: margin + 138, note: margin + 158, alarm: margin + 246 };

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  pdf.setTextColor(120, 104, 168);

  Object.entries({ name: 'NAME', dob: 'DATE OF BIRTH', age: 'AGE', gender: 'GENDER', note: 'NOTE / OCCUPATION', alarm: 'ALARM' })
    .forEach(([k, label]) => pdf.text(label, cols[k], 28));

  pdf.setDrawColor(46, 38, 80);
  pdf.line(margin, 30, pageW - margin, 30);

  /* Sort alphabetically */
  const sorted = [...members].sort((a, b) => a.name.localeCompare(b.name));
  const lineH  = 7;
  let y = 37;

  sorted.forEach((m, i) => {
    /* New page if needed */
    if (y > pageH - 20) {
      pdf.addPage();
      pdf.setFillColor(10, 8, 21);
      pdf.rect(0, 0, pageW, pageH, 'F');
      pdf.setFillColor(232, 179, 74);
      pdf.rect(0, 0, pageW, 4, 'F');
      y = 16;
    }

    /* Alternating row */
    if (i % 2 === 0) {
      pdf.setFillColor(22, 17, 42);
      pdf.rect(margin - 2, y - 5, pageW - margin * 2 + 4, lineH, 'F');
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(240, 234, 255);
    pdf.text(m.name || '—', cols.name, y, { maxWidth: 60 });

    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(184, 174, 216);
    pdf.text(m.dob ? formatDob(m.dob) : '—',               cols.dob,    y);
    pdf.text(m.dob ? String(ageToday(m.dob) ?? '—') : '—', cols.age,    y);
    pdf.text(m.gender === 'M' ? 'Male' : m.gender === 'F' ? 'Female' : '—', cols.gender, y);
    pdf.text(m.note  || '—',                                cols.note,   y, { maxWidth: 80 });
    pdf.text(m.alarm && m.dob ? '🔔 ' + _nextBdayLabel(m.dob) : '—', cols.alarm, y, { maxWidth: 40 });

    y += lineH;
  });

  /* Footer */
  _drawFooter(pdf, pageW, pageH, margin, '—', '—', today);
}

/* ── Helpers ───────────────────────────────────────────────────────── */
function _drawFooter(pdf, pageW, pageH, margin, pageNum, totalPages, today) {
  pdf.setFillColor(232, 179, 74);
  pdf.rect(0, pageH - 4, pageW, 4, 'F');
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.5);
  pdf.setTextColor(120, 104, 168);
  pdf.text(`Medhuru Family Tree  ·  ${today}  ·  Confidential`, margin, pageH - 6);
  if (totalPages !== '—') {
    pdf.text(`Page ${pageNum} / ${totalPages}`, pageW - margin - 18, pageH - 6);
  }
}

function _nextBdayLabel(dob) {
  const d = daysUntilBirthday(dob);
  if (d === null) return '—';
  if (d === 0)    return 'Today!';
  if (d === 1)    return 'Tomorrow';
  return `in ${d} days`;
}

function _wait(ms) { return new Promise(r => setTimeout(r, ms)); }

function _ensureSpinStyle() {
  if (document.getElementById('pdfSpinStyle')) return;
  const s = document.createElement('style');
  s.id = 'pdfSpinStyle';
  s.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(s);
}