/**
 * pdf.js
 * Generates a beautiful multi-page PDF of the family tree.
 * Uses html2canvas to screenshot the tree + jsPDF to build the PDF.
 */

async function downloadPDF() {
  const btn = document.getElementById('pdfBtn');

  /* ── Button loading state ── */
  btn.disabled   = true;
  btn.innerHTML  = '<i class="ti ti-loader" style="animation:spin .8s linear infinite"></i> <span>Generating…</span>';

  /* Add spin keyframe if not present */
  if (!document.getElementById('spinStyle')) {
    const s = document.createElement('style');
    s.id          = 'spinStyle';
    s.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(s);
  }

  try {
    const { jsPDF } = window.jspdf;
    const canvas    = document.getElementById('treeCanvas');

    /* ── Expand ALL nodes temporarily for the screenshot ── */
    const allMembers  = getAllMembers();
    const prevExpanded = new Set(expandedIds);
    allMembers.forEach(m => expandedIds.add(m.id));
    buildTree();

    /* Small delay so DOM repaints */
    await new Promise(r => setTimeout(r, 400));

    /* ── Screenshot the tree canvas ── */
    const shot = await html2canvas(canvas, {
      backgroundColor: '#0e0b07',
      scale:           1.5,          /* higher = sharper */
      useCORS:         true,
      allowTaint:      true,
      logging:         false,
      scrollX:         0,
      scrollY:         0,
      windowWidth:     canvas.scrollWidth,
      windowHeight:    canvas.scrollHeight
    });

    /* ── Restore previous expand state ── */
    expandedIds.clear();
    prevExpanded.forEach(id => expandedIds.add(id));
    buildTree();

    /* ── Build PDF ── */
    const imgData   = shot.toDataURL('image/jpeg', 0.92);
    const imgW      = shot.width;
    const imgH      = shot.height;

    /* A4 landscape for wide trees */
    const pageW     = 297;   /* mm */
    const pageH     = 210;   /* mm */
    const margin    = 12;    /* mm */
    const usableW   = pageW - margin * 2;
    const usableH   = pageH - margin * 2 - 18; /* 18mm reserved for header/footer */

    /* Scale image to fit page width */
    const scale     = usableW / imgW;
    const scaledW   = usableW;
    const scaledH   = imgH * scale;

    /* How many pages needed */
    const totalPages = Math.ceil(scaledH / usableH);

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit:        'mm',
      format:      'a4'
    });

    const today    = new Date().toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' });
    const members  = getAllMembers();
    const totalMem = members.length;

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) pdf.addPage();

      /* ── Header ── */
      pdf.setFillColor(18, 13, 8);
      pdf.rect(0, 0, pageW, pageH, 'F');

      /* Gold top bar */
      pdf.setFillColor(232, 169, 70);
      pdf.rect(0, 0, pageW, 8, 'F');

      /* Title */
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(15);
      pdf.setTextColor(232, 169, 70);
      pdf.text('🌳  Medhuru Family Tree', margin, 16);

      /* Subtitle */
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(154, 136, 112);
      pdf.text(`${totalMem} members  ·  Generated ${today}  ·  Page ${page + 1} of ${totalPages}`, margin, 21);

      /* ── Tree image slice ── */
      const srcY      = (page * usableH) / scale;
      const srcSliceH = Math.min(usableH / scale, imgH - srcY);

      /* Slice the canvas */
      const sliceCanvas  = document.createElement('canvas');
      sliceCanvas.width  = imgW;
      sliceCanvas.height = Math.ceil(srcSliceH);
      const ctx = sliceCanvas.getContext('2d');
      ctx.drawImage(shot, 0, -srcY);
      const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.92);

      const sliceDrawH = srcSliceH * scale;
      pdf.addImage(sliceData, 'JPEG', margin, 24, scaledW, sliceDrawH);

      /* ── Footer ── */
      pdf.setFillColor(232, 169, 70);
      pdf.rect(0, pageH - 5, pageW, 5, 'F');

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(154, 136, 112);
      pdf.text('Medhuru Family Tree  —  Confidential', margin, pageH - 7);
      pdf.text(`Page ${page + 1} / ${totalPages}`, pageW - margin - 20, pageH - 7);
    }

    /* ── Member list appendix page ── */
    pdf.addPage();
    pdf.setFillColor(18, 13, 8);
    pdf.rect(0, 0, pageW, pageH, 'F');
    pdf.setFillColor(232, 169, 70);
    pdf.rect(0, 0, pageW, 8, 'F');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(232, 169, 70);
    pdf.text('Member List', margin, 18);

    pdf.setDrawColor(58, 47, 34);
    pdf.line(margin, 21, pageW - margin, 21);

    /* Table header */
    const cols = { name:margin, dob:90, age:140, note:170 };
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(154, 136, 112);
    pdf.text('Name',        cols.name, 27);
    pdf.text('Date of Birth', cols.dob, 27);
    pdf.text('Age',         cols.age,  27);
    pdf.text('Note',        cols.note, 27);
    pdf.line(margin, 29, pageW - margin, 29);

    /* Table rows */
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    let y = 35;
    const lineH = 7;

    const sorted = [...members].sort((a, b) => a.name.localeCompare(b.name));

    sorted.forEach((m, i) => {
      if (y > pageH - 20) {
        pdf.addPage();
        pdf.setFillColor(18, 13, 8);
        pdf.rect(0, 0, pageW, pageH, 'F');
        y = 20;
      }

      /* Alternating row background */
      if (i % 2 === 0) {
        pdf.setFillColor(30, 23, 16);
        pdf.rect(margin - 2, y - 5, pageW - margin * 2 + 4, lineH, 'F');
      }

      pdf.setTextColor(240, 232, 216);
      pdf.text(m.name || '—',                     cols.name, y, { maxWidth: 55 });
      pdf.setTextColor(154, 136, 112);
      pdf.text(m.dob ? formatDob(m.dob) : '—',    cols.dob,  y);
      pdf.text(m.dob ? String(ageToday(m.dob) ?? '—') : '—', cols.age, y);
      pdf.text(m.note || '—',                      cols.note, y, { maxWidth: 100 });

      y += lineH;
    });

    /* Footer on last page */
    pdf.setFillColor(232, 169, 70);
    pdf.rect(0, pageH - 5, pageW, 5, 'F');

    /* ── Save ── */
    pdf.save(`Medhuru_Family_Tree_${today.replace(/ /g,'_')}.pdf`);

  } catch (err) {
    console.error('PDF generation failed:', err);
    alert('PDF generation failed: ' + err.message);
  } finally {
    btn.disabled  = false;
    btn.innerHTML = '<i class="ti ti-download"></i> <span>PDF</span>';
  }
}