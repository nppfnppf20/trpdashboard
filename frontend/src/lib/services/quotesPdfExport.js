import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { drawTitleBlock, drawPageFooter, projectLineFor } from './pdfExportShared.js';

// A4 landscape export of the Surveyor Quotes page: quote requests sent,
// followed by quotes received with their line items (mirrors the Conditions
// Tracker PDF export's grouped-rowspan layout).

const SLATE = [51, 65, 85];

// Mirrors the status pill colours from badges.css (badge-select-*)
const STATUS_COLORS = {
  'pending': { fill: [254, 243, 199], text: [146, 64, 14] },
  'instructed': { fill: [209, 250, 229], text: [6, 95, 70] },
  'partially instructed': { fill: [209, 250, 229], text: [6, 95, 70] },
  'will not be instructed': { fill: [254, 226, 226], text: [153, 27, 27] },
};

function statusColors(status) {
  return STATUS_COLORS[(status || 'pending').toLowerCase()] || STATUS_COLORS.pending;
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return '';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
}

function lineTotal(item) {
  const cost = parseFloat(item.cost) || 0;
  return item.vat_included ? cost * 1.2 : cost;
}

/**
 * Draws the Surveyor Quotes title + sent-requests table + quotes-received
 * table onto the given doc, starting at the top of whatever page it's
 * currently on.
 */
export function drawQuotesSection(doc, { project, quotes, sentRequests, margin, pageWidth, pageHeight, totalPagesExp }) {
  const projectLine = projectLineFor(project);
  let cursorY = drawTitleBlock(doc, { title: 'Surveyor Quotes Summary', projectLine, margin, pageWidth });

  // ── Table 1: Quote requests sent — section omitted entirely if none ────────
  if (sentRequests && sentRequests.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text('Quote Requests Sent', margin, cursorY);
    cursorY += 4;

    autoTable(doc, {
      head: [['Sent Date', 'Discipline', 'Recipients']],
      body: sentRequests.map(r => [
        formatDate(r.sent_date),
        r.template_discipline || '',
        (r.recipients || []).map(rc => `${rc.organisation}${rc.contact_name ? ` (${rc.contact_name})` : ''}`).join('\n'),
      ]),
      startY: cursorY,
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: {
        font: 'helvetica', fontSize: 7.5, cellPadding: 1.8, textColor: SLATE,
        lineColor: [226, 232, 240], lineWidth: 0.15, valign: 'top', overflow: 'linebreak',
      },
      headStyles: {
        fillColor: [241, 245, 249], textColor: [51, 65, 85], fontSize: 7.8,
        fontStyle: 'bold', valign: 'middle', lineColor: [203, 213, 225],
      },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 45 },
        2: { cellWidth: 202 },
      },
    });
    cursorY = doc.lastAutoTable.finalY + 10;
  }

  // ── Table 2: Quotes received, grouped with line items ───────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text('Quotes Received', margin, cursorY);
  cursorY += 4;

  const head = [[
    'Discipline', 'Organisation', 'Contact', 'Status',
    'Item', 'Cost (excl. VAT)', 'VAT', 'Line Total',
    'Quote Total (incl. VAT)',
  ]];

  const body = [];
  for (const q of quotes) {
    const items = q.line_items?.length ? q.line_items : [null];
    const span = items.length;

    items.forEach((item, i) => {
      const row = [];
      if (i === 0) {
        const statusText = q.instruction_status || 'pending';
        const sc = statusColors(statusText);
        row.push(
          { content: q.discipline || '', rowSpan: span, styles: { fontStyle: 'bold' } },
          { content: q.surveyor_organisation || '', rowSpan: span },
          { content: q.contact_name || '', rowSpan: span },
          { content: statusText, rowSpan: span, styles: { fillColor: sc.fill, textColor: sc.text, fontStyle: 'bold' } },
        );
      }
      row.push(
        { content: item ? item.item || '' : 'No line items' },
        { content: item ? formatCurrency(item.cost) : '', styles: { halign: 'right' } },
        { content: item ? (item.vat_included ? 'Y' : 'N') : '', styles: { halign: 'center' } },
        { content: item ? formatCurrency(lineTotal(item)) : '', styles: { halign: 'right' } },
      );
      if (i === 0) {
        row.push(
          { content: formatCurrency(q.total), rowSpan: span, styles: { fontStyle: 'bold', halign: 'right' } },
        );
      }
      body.push(row);
    });
  }

  if (quotes.length > 0) {
    autoTable(doc, {
      head,
      body,
      startY: cursorY,
      margin: { left: margin, right: margin, top: 13, bottom: 11 },
      theme: 'grid',
      styles: {
        font: 'helvetica', fontSize: 6.8, cellPadding: 1.6, textColor: SLATE,
        lineColor: [226, 232, 240], lineWidth: 0.15, valign: 'top', overflow: 'linebreak',
      },
      headStyles: {
        fillColor: [241, 245, 249], textColor: [51, 65, 85], fontSize: 7,
        fontStyle: 'bold', valign: 'middle', lineColor: [203, 213, 225],
      },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 45 },
        2: { cellWidth: 34 },
        3: { cellWidth: 26 },
        4: { cellWidth: 50 },
        5: { cellWidth: 26 },
        6: { cellWidth: 14 },
        7: { cellWidth: 26 },
        8: { cellWidth: 28 },
      },
      didDrawPage: (data) => {
        drawPageFooter(doc, { pageWidth, pageHeight, margin, projectLine, pageNumber: data.pageNumber, totalPagesExp });
      },
    });
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text('No quotes received for this project.', margin, cursorY + 4);
  }

  return doc.lastAutoTable?.finalY ?? cursorY;
}

export function exportQuotesPdf(project, quotes, sentRequests) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const totalPagesExp = '{total_pages_count_string}';

  drawQuotesSection(doc, { project, quotes, sentRequests, margin, pageWidth, pageHeight, totalPagesExp });

  if (typeof doc.putTotalPages === 'function') {
    doc.putTotalPages(totalPagesExp);
  }

  const projectRef = project?.project_reference || project?.project_code || project?.site_name || 'Project';
  doc.save(`${projectRef} Surveyor Quotes.pdf`);
}
