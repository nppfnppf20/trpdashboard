import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { drawTitleBlock, drawPageFooter, projectLineFor } from './pdfExportShared.js';
import { buildExportFilename } from './exportFilename.js';

// A4 landscape export of the Consultation Tracker's statutory consultee
// responses table, matching the on-screen columns.

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}

function progressText(advancements) {
  return [...(advancements || [])]
    .sort((a, b) => (b.advancement_date || '').localeCompare(a.advancement_date || '') || b.id - a.id)
    .map(a => `${formatDate(a.advancement_date)} - ${a.summary}`)
    .join('\n\n');
}

export function drawConsultationSection(doc, { project, responses, margin, pageWidth, pageHeight, totalPagesExp }) {
  const projectLine = projectLineFor(project);
  const cursorY = drawTitleBlock(doc, { title: 'Consultation Tracker', projectLine, margin, pageWidth });

  const head = [['Consultee', 'Date Received', 'Position', 'Comments', 'Progress', 'Status']];

  const body = responses.map(r => [
    r.consultee_name || '',
    r.date_received ? formatDate(r.date_received) : '',
    r.position || '',
    r.comments || '',
    progressText(r.advancements),
    r.status || '',
  ]);

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
    columnStyles: {
      0: { cellWidth: 34 },
      1: { cellWidth: 24 },
      2: { cellWidth: 26 },
      3: { cellWidth: 80 },
      4: { cellWidth: 80 },
      5: { cellWidth: 24 },
    },
    didDrawPage: (data) => {
      drawPageFooter(doc, { pageWidth, pageHeight, margin, projectLine, pageNumber: data.pageNumber, totalPagesExp });
    },
  });

  return doc.lastAutoTable.finalY;
}

export function exportConsultationPdf(project, responses) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const totalPagesExp = '{total_pages_count_string}';

  drawConsultationSection(doc, { project, responses, margin, pageWidth, pageHeight, totalPagesExp });

  if (typeof doc.putTotalPages === 'function') {
    doc.putTotalPages(totalPagesExp);
  }

  doc.save(`${buildExportFilename(project, 'Consultation Tracker')}.pdf`);
}
