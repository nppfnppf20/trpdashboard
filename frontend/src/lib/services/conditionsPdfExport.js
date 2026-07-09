import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// A4 landscape export of the Conditions Tracker: one merged block per
// condition (like the on-screen table), one row slice per requirement,
// full advancement history in the Progress column.

const TYPE_COLORS = {
  'Pre-Commencement': [185, 28, 28],
  'Pre-Beneficial Use': [37, 99, 235],
  'Action Required (not Pre-Commencement)': [234, 88, 12],
  'Compliance': [21, 128, 61],
  'Informative': [22, 163, 74],
};

const STATUS_COLORS = {
  'Not Started': [100, 116, 139],
  'In Progress': [217, 119, 6],
  'Submitted': [37, 99, 235],
  'Discharged': [22, 163, 74],
  'Not Required': [109, 40, 217],
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
  doc.setTextColor(88, 28, 135);
  doc.text('Conditions Tracker', margin, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  const projectLine = [project?.project_id, project?.site_name || project?.project_name].filter(Boolean).join(' — ');
  if (projectLine) doc.text(projectLine, margin, 19);

  doc.setTextColor(148, 163, 184);
  doc.text(
    `Exported ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    pageWidth - margin, 19, { align: 'right' }
  );

  // ── Table ─────────────────────────────────────────────────────────────────
  const head = [[
    'No.', 'Title', 'Type', 'Condition Wording', 'Reason',
    'Separated Requirements', 'Req. Type', 'Req. Status', 'Initial Actions',
    'Original Consultant', 'Progress', 'Status',
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
          { content: c.condition_type || '', rowSpan: span, styles: { ...base, textColor: TYPE_COLORS[c.condition_type] || SLATE, fontStyle: c.condition_type ? 'bold' : 'normal' } },
          { content: c.wording || '', rowSpan: span, styles: base },
          { content: c.reason || '', rowSpan: span, styles: base },
        );
      }
      row.push(
        { content: r ? r.requirement_text : '', styles: base },
        {
          content: r ? (r.requirement_type || '') : '',
          styles: { ...base, fontStyle: r?.requirement_type ? 'bold' : 'normal', textColor: TYPE_COLORS[r?.requirement_type] || SLATE },
        },
        {
          content: r ? (r.status || 'Outstanding') : '',
          styles: { ...base, fontStyle: r ? 'bold' : 'normal', textColor: r?.status === 'Complete' ? [22, 163, 74] : [217, 119, 6] },
        },
      );
      if (i === 0) {
        row.push(
          { content: c.initial_actions || '', rowSpan: span, styles: base },
          { content: consultant, rowSpan: span, styles: base },
          { content: progress, rowSpan: span, styles: base },
          { content: c.status || 'Not Started', rowSpan: span, styles: { ...base, fontStyle: 'bold', textColor: STATUS_COLORS[c.status] || SLATE } },
        );
      }
      body.push(row);
    });
  }

  autoTable(doc, {
    head,
    body,
    startY: 23,
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
      fillColor: [124, 58, 237],
      textColor: 255,
      fontSize: 7,
      fontStyle: 'bold',
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: 9 },
      1: { cellWidth: 22 },
      2: { cellWidth: 15 },
      3: { cellWidth: 46 },
      4: { cellWidth: 28 },
      5: { cellWidth: 31 },
      6: { cellWidth: 16 },
      7: { cellWidth: 13 },
      8: { cellWidth: 22 },
      9: { cellWidth: 22 },
      10: { cellWidth: 40 },
      11: { cellWidth: 13 },
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
