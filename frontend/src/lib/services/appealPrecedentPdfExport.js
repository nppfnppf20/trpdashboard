import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { drawTitleBlock, drawPageFooter, projectLineFor, SLATE, HEADER_FILL } from './pdfExportShared.js';
import { buildExportFilename } from './exportFilename.js';
import { levelChip, weightChip, fmtDate, scaleLabel, TREATMENT_NAME, EFFECT_NAME } from '$lib/utils/precedentDisplay.js';

// A4 portrait export of the Appeal Precedent results: a one-page-style summary table of every decision, then the full
// recorded detail for each one (planning balance, how each issue was treated, comparability, citable points, with the
// inspector's verified wording). Decision full text is never held by the page, so it is not included; each decision
// links to its Appealbase page instead.

const MARGIN = 14;
const BODY_FONT = 8.5;
const LINE = 4;

function tableStyles() {
  return {
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1.6, textColor: SLATE, lineColor: [226, 232, 240], lineWidth: 0.15, valign: 'top', overflow: 'linebreak' },
    headStyles: { fillColor: HEADER_FILL, textColor: SLATE, fontSize: 7.5, fontStyle: 'bold', lineColor: [203, 213, 225] },
  };
}

/**
 * @param {any} project the project (for the title and filename)
 * @param {any[]} records the decisions to export, in the order to print them
 * @param {object} [opts]
 * @param {{ id: string, label: string, weight: number }[]} [opts.issues] the issues the search was run for
 * @param {{ scheme?: string, lpa?: string, setting?: string }} [opts.context] the scheme the search was run for
 */
export function exportAppealPrecedentPdf(project, records, { issues = [], context = {} } = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const textWidth = pageWidth - MARGIN * 2;
  const bottom = pageHeight - 14;
  const totalPagesExp = '{total_pages_count_string}';
  const projectLine = projectLineFor(project);
  const issueLabels = Object.fromEntries(issues.map(i => [i.id, i.label]));
  const issueName = id => issueLabels[id] ?? (id === 'other' ? 'Other' : id);

  let y = 0;

  const room = h => {
    if (y + h > bottom) {
      doc.addPage();
      y = 16;
    }
  };

  function text(str, { bold = false, size = BODY_FONT, color = SLATE, indent = 0, gap = 1.5 } = {}) {
    if (!str) return;
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(String(str), textWidth - indent);
    for (const l of lines) {
      room(LINE);
      doc.text(l, MARGIN + indent, y);
      y += LINE;
    }
    y += gap;
  }

  function heading(str) {
    room(10);
    y += 1;
    text(str, { bold: true, size: 9.5, color: [30, 41, 59], gap: 1 });
  }

  function quote(str, cite) {
    if (!str) return;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(BODY_FONT);
    const lines = doc.splitTextToSize(`"${str}"`, textWidth - 8);
    room(Math.min(lines.length, 3) * LINE + 2);
    const startY = y;
    doc.setTextColor(SLATE[0], SLATE[1], SLATE[2]);
    for (const l of lines) {
      room(LINE);
      doc.text(l, MARGIN + 5, y);
      y += LINE;
    }
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.6);
    doc.line(MARGIN + 2, startY - 3, MARGIN + 2, y - 2.5);
    if (cite) text(cite, { size: 7, color: [100, 116, 139], indent: 5, gap: 2 });
    else y += 1.5;
  }

  function table(head, body, columnStyles) {
    room(16);
    autoTable(doc, {
      head: [head],
      body,
      startY: y,
      margin: { left: MARGIN, right: MARGIN, top: 14, bottom: 14 },
      theme: 'grid',
      columnStyles,
      ...tableStyles(),
    });
    y = doc.lastAutoTable.finalY + 3;
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  y = drawTitleBlock(doc, { title: 'Appeal Precedents', projectLine, margin: MARGIN, pageWidth });

  if (context.scheme) text(`Scheme: ${context.scheme}`);
  if (context.lpa) text(`LPA: ${context.lpa}`, { gap: 0.5 });
  if (context.setting) text(`Setting: ${context.setting}`);
  if (issues.length) text(`Issues searched (weight out of 5): ${issues.map(i => `${i.label} (${i.weight})`).join('; ')}`, { gap: 3 });

  heading(`Summary: ${records.length} decision${records.length === 1 ? '' : 's'}`);
  table(
    ['Ref', 'LPA / date', 'Outcome', 'Rating', 'Coverage', 'Scheme', 'Turned on'],
    records.map(r => [
      r.reference,
      `${r.lpa || 'Unknown LPA'}\n${fmtDate(r.date)}`,
      r.outcome,
      `${r.relevance}/10${r.relevanceCapped ? ' (capped for scale)' : ''}`,
      r.weightedCoverage.toFixed(2),
      r.scheme_summary,
      (r.determinative_issues ?? []).join('; '),
    ]),
    { 0: { cellWidth: 17 }, 1: { cellWidth: 28 }, 2: { cellWidth: 17 }, 3: { cellWidth: 18 }, 4: { cellWidth: 16 }, 5: { cellWidth: 48 }, 6: { cellWidth: 'auto' } }
  );
  text('Rating is how useful the decision is as a precedent, out of 10. Coverage is the weighted share of your issues the inspector actually decided.', { size: 7, color: [100, 116, 139] });

  // ── Detail, one decision per page ─────────────────────────────────────────
  for (const r of records) {
    doc.addPage();
    y = 16;
    const b = r.planning_balance ?? {};
    const entries = [...(b.entries ?? []).filter(e => e.side === 'harm'), ...(b.entries ?? []).filter(e => e.side === 'benefit')];

    text(`${r.lpa || 'Unknown LPA'} - ${r.outcome}`, { bold: true, size: 12, color: [30, 41, 59], gap: 1 });
    text(`${r.reference} | ${fmtDate(r.date)} | rated ${r.relevance}/10 | coverage ${r.weightedCoverage.toFixed(2)}${b.present ? ' | planning balance found' : ''}`, { size: 8, color: [100, 116, 139], gap: 0.5 });
    text(r.url, { size: 8, color: [37, 99, 235], gap: 2 });
    text(r.scheme_summary);
    const scale = scaleLabel(r);
    if (scale) text(`Scale: ${scale}`, { size: 8, color: [100, 116, 139] });
    if (r.relevanceCapped) text(`Rating capped at 5 (was ${r.relevanceRaw}) because the scale differs from the project by more than 10 times.`, { size: 8, color: [180, 83, 9] });

    if (r.determinative_issues?.length) {
      heading('What it turned on');
      for (const t of r.determinative_issues) text(`- ${t}`, { indent: 2, gap: 0.5 });
    }

    heading('Planning balance');
    if (entries.length) {
      table(
        ['Issue', 'What', 'Level of harm', 'Weight', "Inspector's wording"],
        entries.map(e => [
          `${e.side === 'harm' ? 'HARM' : 'BENEFIT'}\n${issueName(e.issue_id)}`,
          e.description ?? '',
          levelChip(e).text,
          weightChip(e).text,
          [...[e.level_wording, e.weight_wording].filter(Boolean).map(w => `"${w}"`), e.para ? `para ${e.para}` : ''].filter(Boolean).join(' ') || 'none quoted',
        ]),
        { 0: { cellWidth: 30 }, 1: { cellWidth: 52 }, 2: { cellWidth: 24 }, 3: { cellWidth: 20 }, 4: { cellWidth: 'auto' } }
      );
    }
    if (b.conclusion) text(`Conclusion: ${b.conclusion}`);
    if (b.quote) quote(b.quote, `Inspector${b.para ? `, paragraph ${b.para}` : ''}. Verified against the decision text.`);
    else if (!entries.length) text('No planning balance was verified for this decision.', { color: [100, 116, 139] });

    heading('How each issue was treated');
    table(
      ['Issue', 'Treatment', 'Effect', 'Finding'],
      (r.issues ?? []).map(i => [issueName(i.id), TREATMENT_NAME[i.treatment] ?? i.treatment, EFFECT_NAME[i.effect] ?? '', i.finding ?? '']),
      { 0: { cellWidth: 40 }, 1: { cellWidth: 25 }, 2: { cellWidth: 20 }, 3: { cellWidth: 'auto' } }
    );
    for (const i of (r.issues ?? []).filter(x => x.quote)) quote(i.quote, `${issueName(i.id)}: supports "${EFFECT_NAME[i.effect] || i.effect}". Verified against the decision text.`);

    if (r.comparability) {
      heading('Comparability to this project');
      text(r.comparability);
      if (r.relevance_reason) text(`Rating: ${r.relevance_reason}`, { size: 8, color: [100, 116, 139] });
    }

    if (r.usable_points?.length) {
      heading('Points you could cite or should expect');
      for (const p of r.usable_points) {
        text(p.point, { gap: 0.5 });
        quote(p.quote, `${p.para ? `Paragraph ${p.para}. ` : ''}Verified against the decision text.`);
      }
    }
  }

  for (let p = 1; p <= doc.getNumberOfPages(); p++) {
    doc.setPage(p);
    drawPageFooter(doc, { pageWidth, pageHeight, margin: MARGIN, projectLine, pageNumber: p, totalPagesExp });
  }
  if (typeof doc.putTotalPages === 'function') doc.putTotalPages(totalPagesExp);
  doc.save(`${buildExportFilename(project, 'Appeal Precedents')}.pdf`);
}
