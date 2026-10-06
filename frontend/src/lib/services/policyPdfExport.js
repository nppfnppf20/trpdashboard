import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { drawTitleBlock, drawPageFooter, projectLineFor, SLATE, HEADER_FILL } from './pdfExportShared.js';
import { buildExportFilename } from './exportFilename.js';

// A4 portrait export of everything on the project's Policy tab: the relevant documents (development plans, guidance,
// other material considerations), then every policy grouped by level with its reference, parent plan, key flag,
// policy text, supporting text and notes.

const MARGIN = 14;
const BODY_FONT = 8.5;
const LINE = 4;
const MUTED = [100, 116, 139];
const HEADING = [30, 41, 59];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const DOC_SECTIONS = [
  { key: 'adopted', label: 'Development Plan Adopted' },
  { key: 'emerging', label: 'Development Plan Emerging' },
  { key: 'supplementary', label: 'Supplementary Guidance' },
  { key: 'other', label: 'Other Material Considerations' },
];

const POLICY_GROUPS = [
  { key: 'national', label: 'National policy' },
  { key: 'local', label: 'Local policy' },
  { key: 'neighbourhood', label: 'Neighbourhood policy' },
  { key: 'supplementary', label: 'Supplementary guidance' },
  { key: 'other', label: 'Other policy' },
];

function docTitle(d) {
  const type = d.plan_type === 'neighbourhood' ? 'Neighbourhood Plan' : d.plan_type === 'local' ? 'Local Plan' : '';
  const adopted = d.year_adopted ? `adopted ${d.month_adopted ? `${MONTHS[d.month_adopted - 1]} ` : ''}${d.year_adopted}` : '';
  const extra = [type, adopted].filter(Boolean).join(', ');
  return extra ? `${d.plan_name} (${extra})` : d.plan_name;
}

/**
 * @param {any} project the project (for the title and filename)
 * @param {any[]} policies the project's policies
 * @param {any[]} docs the project's policy documents (plans / guidance)
 */
export function exportPolicyPdf(project, policies, docs) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const textWidth = pageWidth - MARGIN * 2;
  const bottom = pageHeight - 14;
  const totalPagesExp = '{total_pages_count_string}';
  const projectLine = projectLineFor(project);

  let y = 0;

  const room = h => {
    if (y + h > bottom) {
      doc.addPage();
      y = 16;
    }
  };

  function text(str, { bold = false, italic = false, size = BODY_FONT, color = SLATE, indent = 0, gap = 1.5 } = {}) {
    if (!str) return;
    doc.setFont('helvetica', bold ? 'bold' : italic ? 'italic' : 'normal');
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

  function heading(str, size = 11) {
    room(14);
    y += 2;
    text(str, { bold: true, size, color: HEADING, gap: 1.5 });
  }

  // A small-caps style label followed by the body text, indented under the policy's header band.
  function block(label, str) {
    if (!str) return;
    text(label.toUpperCase(), { bold: true, size: 7, color: MUTED, indent: 3, gap: 0.5 });
    text(str, { indent: 3, gap: 2.5 });
  }

  // Shaded band holding the policy's reference, name and parent plan.
  function policyHeader(p) {
    const title = [p.policy_reference, p.policy_name].filter(Boolean).join(' - ');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    const titleLines = doc.splitTextToSize(title, textWidth - 6 - (p.is_key_policy ? 14 : 0));
    const bandH = titleLines.length * 4.6 + (p.plan_name ? 4.5 : 0) + 3;
    room(bandH + 14);
    doc.setFillColor(HEADER_FILL[0], HEADER_FILL[1], HEADER_FILL[2]);
    doc.rect(MARGIN, y, textWidth, bandH, 'F');
    doc.setTextColor(HEADING[0], HEADING[1], HEADING[2]);
    doc.text(titleLines, MARGIN + 3, y + 5);
    if (p.is_key_policy) {
      doc.setFontSize(7.5);
      doc.setTextColor(180, 83, 9);
      doc.text('KEY', MARGIN + textWidth - 3, y + 5, { align: 'right' });
    }
    if (p.plan_name) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text(p.plan_name, MARGIN + 3, y + 5 + titleLines.length * 4.6 - 0.6);
    }
    y += bandH + 3;
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
      styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1.6, textColor: SLATE, lineColor: [226, 232, 240], lineWidth: 0.15, valign: 'top', overflow: 'linebreak' },
      headStyles: { fillColor: HEADER_FILL, textColor: SLATE, fontSize: 7.5, fontStyle: 'bold', lineColor: [203, 213, 225] },
    });
    y = doc.lastAutoTable.finalY + 3;
  }

  y = drawTitleBlock(doc, { title: 'Planning Policy', projectLine, margin: MARGIN, pageWidth });

  // ── Relevant documents ────────────────────────────────────────────────────
  heading('Relevant documents');
  if (!docs.length) text('No relevant documents recorded.', { color: MUTED });
  for (const s of DOC_SECTIONS) {
    const inSection = docs.filter(d => d.section === s.key);
    if (!inSection.length) continue;
    text(s.label, { bold: true, size: 9.5, color: HEADING, gap: 1 });
    for (const d of inSection) {
      text(docTitle(d), { bold: true, indent: 2, gap: 0.5 });
      if (d.summary) text(`Summary: ${d.summary}`, { indent: 2, gap: 0.5 });
      if (d.relevance) text(`Relevance: ${d.relevance}`, { indent: 2, gap: 0.5 });
      y += 1;
    }
  }

  // ── Key policies at a glance ──────────────────────────────────────────────
  const key = policies.filter(p => p.is_key_policy);
  heading(`Key policies (${key.length})`);
  if (key.length) {
    table(
      ['Reference', 'Policy', 'Plan'],
      key.map(p => [p.policy_reference ?? '', p.policy_name ?? '', p.plan_name ?? '']),
      { 0: { cellWidth: 30 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 55 } }
    );
  } else {
    text('No policies flagged as key.', { color: MUTED });
  }

  // ── All policies, grouped by level ────────────────────────────────────────
  const known = new Set(POLICY_GROUPS.map(g => g.key));
  for (const g of POLICY_GROUPS) {
    // Anything with an unrecognised type is printed with "Other policy" rather than dropped.
    const items = policies.filter(p => p.policy_type === g.key || (g.key === 'other' && !known.has(p.policy_type)));
    if (!items.length) continue;
    heading(`${g.label} (${items.length})`);
    for (const p of items) {
      policyHeader(p);
      block('Relevant policy text', p.policy_text);
      block('Relevant supporting text', p.relevant_supporting_text);
      block('Notes', p.notes);
      y += 3;
    }
  }

  for (let p = 1; p <= doc.getNumberOfPages(); p++) {
    doc.setPage(p);
    drawPageFooter(doc, { pageWidth, pageHeight, margin: MARGIN, projectLine, pageNumber: p, totalPagesExp });
  }
  if (typeof doc.putTotalPages === 'function') doc.putTotalPages(totalPagesExp);
  doc.save(`${buildExportFilename(project, 'Planning Policy')}.pdf`);
}
