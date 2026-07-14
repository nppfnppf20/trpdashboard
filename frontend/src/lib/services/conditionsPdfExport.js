import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// A4 landscape export of the Conditions Tracker: one merged block per
// condition (like the on-screen table), one row slice per requirement,
// full advancement history in the Progress column.

// Cell box fills (same scheme as the Excel copy): wording cell coloured by
// condition type, req. type cell by requirement type, text stays dark.
// A colour key above the table replaces a separate Type column.
const TYPE_FILLS = {
  'Pre-Commencement': [255, 0, 0],
  'Pre-Beneficial Use': [0, 176, 240],
  'Action Required (not Pre-Commencement)': [255, 192, 0],
  'Compliance': [146, 208, 80],
  'Informative': [146, 208, 80],
};

const SLATE = [51, 65, 85];
const DONE_FILL = [240, 253, 244];

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}

export function exportConditionsPdf(project, conditions) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const totalPagesExp = '{total_pages_count_string}';

  // ── Title block (first page) ──────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(30, 41, 59);
  doc.text('Conditions Tracker', margin, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  const projectLine = [project?.project_id, project?.site_name || project?.project_name].filter(Boolean).join(' - ');
  if (projectLine) doc.text(projectLine, margin, 19);

  doc.setTextColor(148, 163, 184);
  doc.text(
    `Exported ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    pageWidth - margin, 19, { align: 'right' }
  );

  // ── Colour key (replaces the Type column: box fills carry the type) ───────
  const legend = [
    ['Pre-Commencement', TYPE_FILLS['Pre-Commencement']],
    ['Pre-Beneficial Use', TYPE_FILLS['Pre-Beneficial Use']],
    ['Action Required (not Pre-Commencement)', TYPE_FILLS['Action Required (not Pre-Commencement)']],
    ['Compliance / Informative', TYPE_FILLS['Compliance']],
  ];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  let lx = margin;
  const ly = 24.5;
  for (const [label, fill] of legend) {
    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.setDrawColor(148, 163, 184);
    doc.rect(lx, ly - 2.7, 3.4, 3.4, 'FD');
    lx += 4.8;
    doc.text(label, lx, ly);
    lx += doc.getTextWidth(label) + 7;
  }

  // ── Table ─────────────────────────────────────────────────────────────────
  const head = [[
    'No.', 'Title', 'Condition Wording', 'Reason',
    'Separated Requirements',
    'Original Consultant', 'Progress',
  ]];

  const body = [];
  for (const c of conditions) {
    const done = c.status === 'Discharged' || c.condition_type === 'Informative';
    const base = done ? { fillColor: DONE_FILL } : {};
    const reqs = c.requirements?.length ? c.requirements : [null];
    const span = reqs.length;

    const progress = (c.advancements || [])
      .map(a => `${formatDate(a.advancement_date)} - ${a.summary}`)
      .join('\n\n');
    const consultant = [c.original_consultant, c.original_consultant_email].filter(Boolean).join('\n');

    reqs.forEach((r, i) => {
      const row = [];
      if (i === 0) {
        row.push(
          { content: c.condition_number || '', rowSpan: span, styles: { ...base, fontStyle: 'bold', halign: 'center' } },
          { content: c.title || '', rowSpan: span, styles: { ...base, fontStyle: 'bold' } },
          {
            content: c.wording || '',
            rowSpan: span,
            styles: { ...base, ...(TYPE_FILLS[c.condition_type] ? { fillColor: TYPE_FILLS[c.condition_type] } : {}) },
          },
          { content: c.reason || '', rowSpan: span, styles: base },
        );
      }
      row.push(
        {
          content: r ? r.requirement_text : '',
          styles: { ...base, ...(r && TYPE_FILLS[r.requirement_type] ? { fillColor: TYPE_FILLS[r.requirement_type] } : {}) },
        },
      );
      if (i === 0) {
        row.push(
          { content: consultant, rowSpan: span, styles: base },
          { content: progress, rowSpan: span, styles: base },
        );
      }
      body.push(row);
    });
  }

  autoTable(doc, {
    head,
    body,
    startY: 28,
    margin: { left: margin, right: margin, top: 13, bottom: 11 },
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 6.8,
      cellPadding: 1.6,
      textColor: SLATE,
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      valign: 'top',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [51, 65, 85],
      fontSize: 7,
      fontStyle: 'bold',
      valign: 'middle',
      lineColor: [203, 213, 225],
    },
    columnStyles: {
      0: { cellWidth: 9 },
      1: { cellWidth: 29 },
      2: { cellWidth: 64 },
      3: { cellWidth: 40 },
      4: { cellWidth: 47 },
      5: { cellWidth: 32 },
      6: { cellWidth: 56 },
    },
    didDrawPage: (data) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(`Page ${data.pageNumber} of ${totalPagesExp}`, pageWidth - margin, pageHeight - 5, { align: 'right' });
      if (projectLine) doc.text(projectLine, margin, pageHeight - 5);
    },
  });

  if (typeof doc.putTotalPages === 'function') {
    doc.putTotalPages(totalPagesExp);
  }

  const projectRef = project?.project_reference || project?.site_name || 'Project';
  doc.save(`${projectRef} Conditions Tracker.pdf`);
}
