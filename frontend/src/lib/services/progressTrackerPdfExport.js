import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { drawTitleBlock, drawPageFooter, projectLineFor } from './pdfExportShared.js';
import { buildExportFilename } from './exportFilename.js';

// A4 landscape export of the Project Tracker: one merged block per issue
// (like the on-screen table), one row slice per sub-issue, with progress
// split into Sub-issue Progress (actions tagged to that sub-issue) and
// Main Issue Progress (actions logged against the issue as a whole).

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}

// Progress is split the same way as the on-screen table: actions tagged to a
// specific sub-issue, and actions logged against the issue as a whole.
function progressText(actions) {
  return (actions || [])
    .map(a => `${formatDate(a.action_date)}${a.stage_name ? ` [${a.stage_name}]` : ''} - ${a.summary}`)
    .join('\n\n');
}

const DONE_FILL = [240, 253, 244];

export function drawProgressSection(doc, { project, issues, margin, pageWidth, pageHeight, totalPagesExp }) {
  const projectLine = projectLineFor(project);
  const cursorY = drawTitleBlock(doc, { title: 'Project Tracker', projectLine, margin, pageWidth });

  // Sub-issue Progress only earns a column once something in the tracker
  // actually uses sub-issues — many projects won't.
  const hasAnySubIssues = issues.some(iss => iss.sub_issues?.length > 0);

  const head = [[
    'Discipline', 'Issue', 'Sub-issue',
    ...(hasAnySubIssues ? ['Sub-issue Progress'] : []),
    'Main Issue Progress', 'Status',
  ]];

  const body = [];
  for (const iss of issues) {
    const done = iss.status === 'Complete';
    const base = done ? { fillColor: DONE_FILL } : {};
    const subs = iss.sub_issues?.length ? iss.sub_issues : [null];
    const span = subs.length;

    const mainProgress = progressText((iss.actions || []).filter(a => !a.sub_issue_ids || a.sub_issue_ids.length === 0));

    subs.forEach((s, i) => {
      const row = [];
      if (i === 0) {
        row.push(
          { content: iss.discipline || '', rowSpan: span, styles: { ...base, fontStyle: 'bold' } },
          { content: iss.title || '', rowSpan: span, styles: base },
        );
      }
      row.push({ content: s ? s.sub_issue_text : '', styles: base });
      if (hasAnySubIssues) {
        row.push({ content: s ? progressText((iss.actions || []).filter(a => a.sub_issue_ids?.includes(s.id))) : '', styles: base });
      }
      if (i === 0) {
        row.push(
          { content: mainProgress, rowSpan: span, styles: base },
          { content: iss.status || '', rowSpan: span, styles: base },
        );
      }
      body.push(row);
    });
  }

  autoTable(doc, {
    head,
    body,
    startY: cursorY,
    margin: { left: margin, right: margin, top: 13, bottom: 11 },
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7.2,
      cellPadding: 1.8,
      textColor: [51, 65, 85],
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      valign: 'top',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [51, 65, 85],
      fontSize: 7.5,
      fontStyle: 'bold',
      valign: 'middle',
      lineColor: [203, 213, 225],
    },
    columnStyles: hasAnySubIssues
      ? { 0: { cellWidth: 28 }, 1: { cellWidth: 45 }, 2: { cellWidth: 50 }, 3: { cellWidth: 65 }, 4: { cellWidth: 65 }, 5: { cellWidth: 24 } }
      : { 0: { cellWidth: 30 }, 1: { cellWidth: 55 }, 2: { cellWidth: 60 }, 3: { cellWidth: 90 }, 4: { cellWidth: 26 } },
    didDrawPage: (data) => {
      drawPageFooter(doc, { pageWidth, pageHeight, margin, projectLine, pageNumber: data.pageNumber, totalPagesExp });
    },
  });

  return doc.lastAutoTable.finalY;
}

export function exportProgressPdf(project, issues) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const totalPagesExp = '{total_pages_count_string}';

  drawProgressSection(doc, { project, issues, margin, pageWidth, pageHeight, totalPagesExp });

  if (typeof doc.putTotalPages === 'function') {
    doc.putTotalPages(totalPagesExp);
  }

  doc.save(`${buildExportFilename(project, 'Project Tracker')}.pdf`);
}
