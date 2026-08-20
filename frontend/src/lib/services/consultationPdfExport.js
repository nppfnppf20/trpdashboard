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

function actionRequiredText(actionRequired) {
  if (!actionRequired?.trim()) return '';
  return actionRequired
    .split('\n')
    .map(l => l.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean)
    .map(l => `- ${l}`)
    .join('\n');
}

export function drawConsultationSection(doc, { project, responses, margin, pageWidth, pageHeight, totalPagesExp }) {
  const projectLine = projectLineFor(project);
  const cursorY = drawTitleBlock(doc, { title: 'Consultation Tracker', projectLine, margin, pageWidth });

  const head = [['Consultee', 'Date Received', 'Position', 'Comments', 'Action Required', 'Conditions Suggested', 'Progress', 'Status']];

  const body = responses.map(r => [
    r.consultee_name || '',
    r.date_received ? formatDate(r.date_received) : '',
    r.position || '',
    r.comments || '',
    actionRequiredText(r.action_required),
    actionRequiredText(r.conditions_suggested),
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
      0: { cellWidth: 30 },
      1: { cellWidth: 20 },
      2: { cellWidth: 22 },
      3: { cellWidth: 52 },
      4: { cellWidth: 32 },
      5: { cellWidth: 32 },
      6: { cellWidth: 52 },
      7: { cellWidth: 20 },
    },
    didDrawPage: (data) => {
      drawPageFooter(doc, { pageWidth, pageHeight, margin, projectLine, pageNumber: data.pageNumber, totalPagesExp });
    },
  });

  return doc.lastAutoTable.finalY;
}

export function drawPublicCommentsSection(doc, { project, comments, margin, pageWidth, pageHeight, totalPagesExp }) {
  const projectLine = projectLineFor(project);
  const cursorY = drawTitleBlock(doc, { title: 'Public Comments', projectLine, margin, pageWidth });

  const head = [['Name', 'Date', 'Position', 'Comment Summary', 'Notes']];

  const body = comments.map(c => [
    c.commenter_name || 'Anonymous',
    c.date_received ? formatDate(c.date_received) : '',
    c.position || '',
    c.comment || '',
    c.notes || '',
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
      3: { cellWidth: 90 },
      4: { cellWidth: 84 },
    },
    didDrawPage: (data) => {
      drawPageFooter(doc, { pageWidth, pageHeight, margin, projectLine, pageNumber: data.pageNumber, totalPagesExp });
    },
  });

  return doc.lastAutoTable.finalY;
}

// Renders the same "last run" timestamp, bullet summary and recurring-theme
// breakdown shown as cards on the Public Comments tab, as a title block plus
// a themes table (autoTable handles the pagination the on-screen cards don't
// need to worry about).
export function drawPublicCommentsAnalysisSection(doc, { project, analysis, margin, pageWidth, pageHeight, totalPagesExp }) {
  const projectLine = projectLineFor(project);
  let cursorY = drawTitleBlock(doc, { title: 'Public Comments Analysis', projectLine, margin, pageWidth });

  if (analysis?.last_analysed_at) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Last run ${new Date(analysis.last_analysed_at).toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
      margin, cursorY
    );
    cursorY += 6;
  }

  if (!analysis?.bullet_summary?.length && !analysis?.themes?.length) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text('No analysis has been run yet.', margin, cursorY + 4);
    return doc.lastAutoTable?.finalY ?? cursorY;
  }

  if (analysis.bullet_summary?.length) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text('Summary', margin, cursorY + 4);
    cursorY += 9;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    for (const bullet of analysis.bullet_summary) {
      const lines = doc.splitTextToSize(`-  ${bullet}`, pageWidth - margin * 2);
      doc.text(lines, margin, cursorY + 4);
      cursorY += lines.length * 4.2 + 1.5;
    }
    cursorY += 4;
  }

  if (analysis.themes?.length) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text('Recurring Themes', margin, cursorY + 4);
    cursorY += 7;

    autoTable(doc, {
      head: [['Theme', 'Count', 'Sentiment', 'Summary']],
      body: analysis.themes.map(t => [t.theme || '', String(t.count ?? ''), t.sentiment || '', t.summary || '']),
      startY: cursorY,
      margin: { left: margin, right: margin, top: 13, bottom: 11 },
      theme: 'grid',
      styles: {
        font: 'helvetica', fontSize: 7.5, cellPadding: 1.8, textColor: [51, 65, 85],
        lineColor: [226, 232, 240], lineWidth: 0.15, valign: 'top', overflow: 'linebreak',
      },
      headStyles: {
        fillColor: [241, 245, 249], textColor: [51, 65, 85], fontSize: 7.8,
        fontStyle: 'bold', valign: 'middle', lineColor: [203, 213, 225],
      },
      columnStyles: {
        0: { cellWidth: 36, fontStyle: 'bold' },
        1: { cellWidth: 18, halign: 'center' },
        2: { cellWidth: 24 },
        3: { cellWidth: 110 },
      },
      didDrawPage: (data) => {
        drawPageFooter(doc, { pageWidth, pageHeight, margin, projectLine, pageNumber: data.pageNumber, totalPagesExp });
      },
    });
    return doc.lastAutoTable.finalY;
  }

  return cursorY;
}

// Combined export driven by ExportConsultationModal's checkboxes: any subset
// of the statutory table, the public comments table and the public comments
// analysis, each starting on its own page (mirrors instructedPdfExport.js's
// section-per-page pattern).
export function exportConsultationCombinedPdf(project, { includeStatutory, includePublic, includeAnalysis }, { responses, publicComments, analysis }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const totalPagesExp = '{total_pages_count_string}';

  let started = false;
  if (includeStatutory) {
    drawConsultationSection(doc, { project, responses: responses || [], margin, pageWidth, pageHeight, totalPagesExp });
    started = true;
  }
  if (includePublic) {
    if (started) doc.addPage();
    drawPublicCommentsSection(doc, { project, comments: publicComments || [], margin, pageWidth, pageHeight, totalPagesExp });
    started = true;
  }
  if (includeAnalysis) {
    if (started) doc.addPage();
    drawPublicCommentsAnalysisSection(doc, { project, analysis, margin, pageWidth, pageHeight, totalPagesExp });
    started = true;
  }

  if (typeof doc.putTotalPages === 'function') {
    doc.putTotalPages(totalPagesExp);
  }

  doc.save(`${buildExportFilename(project, 'Consultation Tracker')}.pdf`);
}
