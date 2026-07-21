import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// A4 landscape export of the Surveyor Quotes page: quote requests sent,
// followed by quotes received with their line items (mirrors the Conditions
// Tracker PDF export's grouped-rowspan layout).

const SLATE = [51, 65, 85];

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

export function exportQuotesPdf(project, quotes, sentRequests) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const totalPagesExp = '{total_pages_count_string}';

  const projectLine = [project?.project_code || project?.project_reference, project?.site_name || project?.project_name]
    .filter(Boolean).join(' - ');

  // ── Title block ──────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(30, 41, 59);
  doc.text('Surveyor Quotes Summary', margin, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  if (projectLine) doc.text(projectLine, margin, 19);

  doc.setTextColor(148, 163, 184);
  doc.text(
    `Exported ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    pageWidth - margin, 19, { align: 'right' }
  );

  let cursorY = 26;

  // ── Table 1: Quote requests sent ────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text('Quote Requests Sent', margin, cursorY);
  cursorY += 4;

  if (sentRequests && sentRequests.length > 0) {
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
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text('No quote requests have been sent for this project.', margin, cursorY + 4);
    cursorY += 14;
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
        row.push(
          { content: q.discipline || '', rowSpan: span, styles: { fontStyle: 'bold' } },
          { content: q.surveyor_organisation || '', rowSpan: span },
          { content: q.contact_name || '', rowSpan: span },
          { content: q.instruction_status || 'pending', rowSpan: span },
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
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(`Page ${data.pageNumber} of ${totalPagesExp}`, pageWidth - margin, pageHeight - 5, { align: 'right' });
        if (projectLine) doc.text(projectLine, margin, pageHeight - 5);
      },
    });
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text('No quotes received for this project.', margin, cursorY + 4);
  }

  if (typeof doc.putTotalPages === 'function') {
    doc.putTotalPages(totalPagesExp);
  }

  const projectRef = project?.project_reference || project?.project_code || project?.site_name || 'Project';
  doc.save(`${projectRef} Surveyor Quotes.pdf`);
}
