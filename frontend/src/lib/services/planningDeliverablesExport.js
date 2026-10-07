import PizZip from 'pizzip';
import fileSaver from 'file-saver';
import { sanitizeFilename, buildExportFilename } from './exportFilename.js';
import { sanitizeHtml } from '../utils/sanitizeHtml.js';

const { saveAs } = fileSaver;

const CS_TEMPLATE   = '/planning%20statement%20template%20c%20and%20s.docx';
const SOC_TEMPLATE  = '/appeal%20soc%20template%20c%20and%20s.docx';
const SOCG_TEMPLATE = '/appeal%20socg%20template%20c%20and%20s.docx';

// Map deliverable_type values to static .docx template files
const TEMPLATE_MAP = {
  planning_statement_solar: CS_TEMPLATE,
  site_justification:       CS_TEMPLATE,
  eia_screening:            CS_TEMPLATE,
  cover_letter:             '/letter.docx',
  certificate_b_notice:     '/letter.docx',
  stage1_review:            '/stage1reviewtemplate.docx'
};

// Map draft type slugs (from the workspace) to static .docx template files
const SLUG_TEMPLATE_MAP = {
  planning_statement:           CS_TEMPLATE,
  planning_statement_v2:        CS_TEMPLATE,
  planning_statement_v3:        CS_TEMPLATE,
  planning_statement_solar:     CS_TEMPLATE,
  site_justification:           CS_TEMPLATE,
  eia_screening:                CS_TEMPLATE,
  stage1_review:                '/stage1reviewtemplate.docx',
  // Appeal Statement of Case
  statement_of_case:            SOC_TEMPLATE,
  appeal_statement_of_case:     SOC_TEMPLATE,
  // Statement of Common Ground
  statement_of_common_ground:   SOCG_TEMPLATE,
  appeal_statement_of_common_ground: SOCG_TEMPLATE,
  // Pre-application request letter
  pre_application_request:      '/letter.docx',
};

const DEFAULT_TEMPLATE = CS_TEMPLATE;

// Style maps keyed by template path
// C&S family: h2 = section headings → Heading1, h3 = subsections → Heading3, bullets → Bullet1
const CS_STYLES     = { h1: 'Heading1', h2: 'Heading1', h3: 'Heading3', h4: 'Heading3', p: 'Appealnumberedparagarphs', ul: 'Bullet1', ol: 'Bullet1' };
const DEF_STYLES    = { h1: 'Heading1', h2: 'Heading2', h3: 'Heading3', h4: 'Heading4', p: 'Normal', ul: 'ListBullet', ol: 'ListNumber' };
const LETTER_STYLES = { h1: 'Heading1', h2: 'Heading2', h3: 'Heading3', h4: 'Heading3', p: 'Normal', ul: 'Bullet1', ol: 'Bullet1' };

// basicdocument.docx has no ListBullet/ListNumber styles (Word would silently drop
// the bullet), but does define a bulleted Bullet1.
const BASIC_STYLES  = { ...DEF_STYLES, ul: 'Bullet1', ol: 'Bullet1' };

const CS_FAMILY     = new Set([CS_TEMPLATE, SOC_TEMPLATE, SOCG_TEMPLATE]);
const LETTER_FAMILY = new Set(['/letter.docx']);

function getStyleMap(templatePath) {
  if (CS_FAMILY.has(templatePath))     return CS_STYLES;
  if (LETTER_FAMILY.has(templatePath)) return LETTER_STYLES;
  if (templatePath === '/basicdocument.docx') return BASIC_STYLES;
  return DEF_STYLES;
}

function getTemplatePath(deliverable) {
  return TEMPLATE_MAP[deliverable.deliverable_type] || DEFAULT_TEMPLATE;
}

/** Returns { templatePath, styles } for a given draft type slug (used by the workspace export). */
export function getExportConfigForSlug(slug) {
  const templatePath = SLUG_TEMPLATE_MAP[slug] ?? '/basicdocument.docx';
  return { templatePath, styles: getStyleMap(templatePath) };
}

/**
 * Export a planning deliverable to Word using a .docx style template
 */
export async function exportDeliverableToWord(deliverable, html, project = null) {
  const templatePath = getTemplatePath(deliverable);
  const response = await fetch(templatePath);
  if (!response.ok) throw new Error(`Could not load template: ${templatePath}`);

  const arrayBuffer = await response.arrayBuffer();
  const zip = new PizZip(arrayBuffer);

  const documentXml = new TextDecoder('utf-8').decode(zip.file('word/document.xml').asUint8Array());

  // Generate OOXML body content from HTML
  const bodyContent = htmlToOOXML(html, getStyleMap(templatePath));

  // Insert content before the final sectPr, preserving all existing body content (logo, text etc.)
  const insertAt = documentXml.lastIndexOf('<w:sectPr');
  const bodyClose = documentXml.lastIndexOf('</w:body>');
  const position = (insertAt !== -1 && insertAt < bodyClose) ? insertAt : bodyClose;
  const newDocXml = documentXml.slice(0, position) + bodyContent + documentXml.slice(position);

  zip.file('word/document.xml', newDocXml);

  const blob = zip.generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });

  const filename = project ? buildExportFilename(project, deliverable.deliverable_name) : sanitizeFilename(deliverable.deliverable_name);
  saveAs(blob, `${filename}.docx`);
}

/**
 * Convert HTML to OOXML paragraphs
 */
function htmlToOOXML(html, styles = DEF_STYLES) {
  const div = document.createElement('div');
  div.innerHTML = sanitizeHtml(html);

  // If there are no element children the content is bare text nodes — wrap each line.
  if (div.children.length === 0) {
    return (div.textContent || '').split('\n')
      .map(l => l.trim()).filter(Boolean)
      .map(l => paragraph(styles.p, `<w:r><w:t xml:space="preserve">${escapeXml(l)}</w:t></w:r>`))
      .join('');
  }

  return Array.from(div.childNodes).map(node => {
    if (node.nodeType === Node.ELEMENT_NODE) return elementToOOXML(node, styles);
    // Orphaned top-level text node
    const t = node.textContent.trim();
    return t ? paragraph(styles.p, `<w:r><w:t xml:space="preserve">${escapeXml(t)}</w:t></w:r>`) : '';
  }).filter(Boolean).join('');
}

function elementToOOXML(el, styles = DEF_STYLES) {
  const tag = el.tagName.toLowerCase();

  switch (tag) {
    case 'h1':
      stripLeadingNumber(el);
      return paragraph(styles.h1, inlineRuns(el));
    case 'h2':
      stripLeadingNumber(el);
      return paragraph(styles.h2, inlineRuns(el));
    case 'h3':
      stripLeadingNumber(el);
      return paragraph(styles.h3, inlineRuns(el));
    case 'h4':
      stripLeadingNumber(el);
      return paragraph(styles.h4, inlineRuns(el));
    case 'p':
      return paragraph(styles.p, inlineRuns(el));
    case 'ul':
      return Array.from(el.querySelectorAll('li')).map(li =>
        paragraph(styles.ul, inlineRuns(li))
      ).join('');
    case 'ol':
      return Array.from(el.querySelectorAll('li')).map(li =>
        paragraph(styles.ol, inlineRuns(li))
      ).join('');
    case 'table':
      if (el.classList.contains('trp-appraisal-table')) {
        return appraisalTableToOOXML(el);
      }
      return generalTableToOOXML(el, styles);
    default:
      return el.textContent.trim()
        ? paragraph(styles.p, `<w:r><w:t xml:space="preserve">${escapeXml(el.textContent)}</w:t></w:r>`)
        : '';
  }
}

// Reads background/color/font-weight off a table cell's inline style attribute
// (e.g. status pills coloured to match their on-screen badge) so they survive
// into the OOXML table instead of being silently dropped.
function parseCellStyle(cell) {
  const style = cell.getAttribute('style') || '';
  const result = {};
  style.split(';').forEach(decl => {
    const [prop, val] = decl.split(':').map(s => s && s.trim());
    if (!prop || !val) return;
    if (prop === 'background' || prop === 'background-color') result.bg = val;
    else if (prop === 'color') result.color = val;
    else if (prop === 'font-weight' && (val === 'bold' || parseInt(val, 10) >= 600)) result.bold = true;
  });
  return result;
}

function hexToOoxml(hex) {
  if (!hex) return null;
  const h = hex.replace('#', '');
  return (h.length === 3 ? h.split('').map(c => c + c).join('') : h).toUpperCase();
}

function generalTableToOOXML(tableEl, styles = DEF_STYLES) {
  const rows = Array.from(tableEl.querySelectorAll('tr'));
  if (!rows.length) return '';

  // Count max columns to distribute width evenly
  const colCount = Math.max(...rows.map(tr => tr.querySelectorAll('th, td').length)) || 1;
  const totalWidth = 9072; // twips (~15.9cm, standard page width minus margins)
  const colWidth = Math.floor(totalWidth / colCount);

  // tblLayout=fixed forces Word to honour the widths below instead of
  // autofitting the table to its content, which is what was pushing wide
  // tables (e.g. the Quotes export) off the right edge of a portrait page.
  const tblPr = `<w:tblPr>
    <w:tblStyle w:val="TableGrid"/>
    <w:tblW w:w="${totalWidth}" w:type="dxa"/>
    <w:tblLayout w:type="fixed"/>
    <w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/>
  </w:tblPr>`;

  const tblGrid = `<w:tblGrid>${Array(colCount).fill(`<w:gridCol w:w="${colWidth}"/>`).join('')}</w:tblGrid>`;

  const rowsXml = rows.map(tr => {
    const cells = Array.from(tr.querySelectorAll('th, td'));
    const isHeader = cells.some(c => c.tagName.toLowerCase() === 'th');
    const cellsXml = cells.map(cell => {
      const isHeaderCell = isHeader || cell.tagName.toLowerCase() === 'th';
      const { bg, color, bold } = parseCellStyle(cell);
      const fmt = { bold: isHeaderCell || bold, color: color ? hexToOoxml(color) : null, size: 22 };
      const shdTag = bg ? `<w:shd w:val="clear" w:color="auto" w:fill="${hexToOoxml(bg)}"/>` : '';
      return `<w:tc><w:tcPr><w:tcW w:w="${colWidth}" w:type="dxa"/>${shdTag}</w:tcPr>${cellContentToOOXML(cell, styles, fmt)}</w:tc>`;
    }).join('');
    const trPr = isHeader ? '<w:trPr><w:tblHeader/></w:trPr>' : '';
    return `<w:tr>${trPr}${cellsXml}</w:tr>`;
  }).join('');

  return `<w:tbl>${tblPr}${tblGrid}${rowsXml}</w:tbl>`;
}

function appraisalTableToOOXML(tableEl) {
  const tblPr = `<w:tblPr>
    <w:tblW w:w="9072" w:type="dxa"/>
    <w:tblBorders>
      <w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      <w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      <w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      <w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      <w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      <w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>
    </w:tblBorders>
  </w:tblPr>`;

  let rows = '';
  tableEl.querySelectorAll('tr').forEach(tr => {
    if (tr.classList.contains('tbl-header')) {
      const headerText = escapeXml(tr.querySelector('strong')?.textContent || tr.textContent.trim());
      rows += `<w:tr>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="9072" w:type="dxa"/>
            <w:gridSpan w:val="2"/>
          </w:tcPr>
          <w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t xml:space="preserve">${headerText}</w:t></w:r></w:p>
        </w:tc>
      </w:tr>`;
    } else if (tr.classList.contains('tbl-row')) {
      const cells = tr.querySelectorAll('td');
      if (cells.length >= 2) {
        const labelText = escapeXml(cells[0].textContent.trim());
        const valueText = escapeXml(cells[1].textContent.trim());
        rows += `<w:tr>
          <w:tc>
            <w:tcPr><w:tcW w:w="2722" w:type="dxa"/></w:tcPr>
            <w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${labelText}</w:t></w:r></w:p>
          </w:tc>
          <w:tc>
            <w:tcPr><w:tcW w:w="6350" w:type="dxa"/></w:tcPr>
            <w:p><w:r><w:t xml:space="preserve">${valueText}</w:t></w:r></w:p>
          </w:tc>
        </w:tr>`;
      }
    }
  });

  return `<w:tbl>${tblPr}${rows}</w:tbl>`;
}

function paragraph(styleId, runsXml, options = {}) {
  const pageBreak = options.pageBreakBefore
    ? '<w:pageBreakBefore/>'
    : '';
  return `<w:p><w:pPr><w:pStyle w:val="${styleId}"/>${pageBreak}</w:pPr>${runsXml}</w:p>`;
}

function stripLeadingNumber(el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const firstText = walker.nextNode();
  if (firstText) firstText.nodeValue = firstText.nodeValue.replace(/^\d+(\.\d+)*\.?\s+/, '');
}

function inlineRuns(el, base = {}) {
  return inlineRunsFromNodes(el.childNodes, base);
}

// `base` carries run formatting inherited from the context (e.g. a table cell):
// { bold, italic, underline, highlight, color: 'RRGGBB', size: half-points }.
// Nested inline elements (<strong><em>…</em></strong>) accumulate formatting.
function inlineRunsFromNodes(nodes, base = {}) {
  let xml = '';
  nodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent) xml += run(node.textContent, base);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();
      if (tag === 'br') {
        xml += '<w:r><w:br/></w:r>';
      } else if (tag === 'strong' || tag === 'b') {
        xml += inlineRunsFromNodes(node.childNodes, { ...base, bold: true });
      } else if (tag === 'em' || tag === 'i') {
        xml += inlineRunsFromNodes(node.childNodes, { ...base, italic: true });
      } else if (tag === 'u') {
        xml += inlineRunsFromNodes(node.childNodes, { ...base, underline: true });
      } else if (tag === 'span' && node.classList.contains('draft-placeholder')) {
        // "[...]" placeholder markers (see highlightPlaceholders) — Word's
        // highlighter-pen run property, so it looks the same as on screen.
        xml += inlineRunsFromNodes(node.childNodes, { ...base, highlight: true });
      } else {
        xml += inlineRunsFromNodes(node.childNodes, base);
      }
    }
  });
  return xml;
}

function run(text, fmt = {}) {
  // Element order follows the OOXML schema: b, i, color, sz, highlight, u.
  const rPr =
    (fmt.bold ? '<w:b/>' : '') +
    (fmt.italic ? '<w:i/>' : '') +
    (fmt.color ? `<w:color w:val="${fmt.color}"/>` : '') +
    (fmt.size ? `<w:sz w:val="${fmt.size}"/><w:szCs w:val="${fmt.size}"/>` : '') +
    (fmt.highlight ? '<w:highlight w:val="yellow"/>' : '') +
    (fmt.underline ? '<w:u w:val="single"/>' : '');
  return `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

// Table-cell contents as real paragraphs: <p>/<h*>/<div> become paragraphs,
// <ul>/<ol> become bullet/numbered paragraphs (nested lists included), and
// loose inline content / <br> are grouped into a paragraph. Replaces the old
// `cell.textContent`, which collapsed the whole cell into one flat run.
function cellContentToOOXML(cell, styles, fmt) {
  let xml = '';
  let pending = [];

  const flush = () => {
    const runs = inlineRunsFromNodes(pending, fmt);
    pending = [];
    if (runs.replace(/<[^>]+>/g, '').trim()) xml += `<w:p>${runs}</w:p>`;
  };

  const addList = (listEl, styleId) => {
    Array.from(listEl.children).forEach(li => {
      if (li.tagName.toLowerCase() !== 'li') return;
      const own = Array.from(li.childNodes).filter(n => !(n.nodeType === Node.ELEMENT_NODE && /^(ul|ol)$/i.test(n.tagName)));
      // Tiptap wraps li content in a <p>; unwrap so we get one paragraph per item.
      const inline = own.flatMap(n => (n.nodeType === Node.ELEMENT_NODE && /^p$/i.test(n.tagName)) ? Array.from(n.childNodes) : [n]);
      xml += paragraph(styleId, inlineRunsFromNodes(inline, fmt));
      Array.from(li.children).forEach(child => {
        const t = child.tagName.toLowerCase();
        if (t === 'ul') addList(child, styles.ul);
        else if (t === 'ol') addList(child, styles.ol);
      });
    });
  };

  cell.childNodes.forEach(node => {
    if (node.nodeType !== Node.ELEMENT_NODE) { pending.push(node); return; }
    const tag = node.tagName.toLowerCase();
    if (tag === 'ul' || tag === 'ol') {
      flush();
      addList(node, tag === 'ul' ? styles.ul : styles.ol);
    } else if (/^(p|div|h[1-6]|blockquote)$/.test(tag)) {
      flush();
      const runs = inlineRuns(node, fmt);
      if (runs.replace(/<[^>]+>/g, '').trim()) xml += `<w:p>${runs}</w:p>`;
    } else {
      pending.push(node);
    }
  });
  flush();

  return xml || '<w:p/>'; // a table cell must contain at least one paragraph
}

function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Generic export: any HTML content to a named .docx using a given template path
 */
export async function exportHtmlToWord(html, filename, templatePath = '/basicdocument.docx', styles = null) {
  const response = await fetch(templatePath);
  if (!response.ok) throw new Error(`Could not load template: ${templatePath}`);

  const arrayBuffer = await response.arrayBuffer();
  const zip = new PizZip(arrayBuffer);

  const documentXml = new TextDecoder('utf-8').decode(zip.file('word/document.xml').asUint8Array());
  const bodyContent = htmlToOOXML(html, styles ?? getStyleMap(templatePath));

  const insertAt = documentXml.lastIndexOf('<w:sectPr');
  const bodyClose = documentXml.lastIndexOf('</w:body>');
  const position = (insertAt !== -1 && insertAt < bodyClose) ? insertAt : bodyClose;
  const newDocXml = documentXml.slice(0, position) + bodyContent + documentXml.slice(position);

  zip.file('word/document.xml', newDocXml);

  const blob = zip.generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });

  // Strip a caller-supplied .docx suffix (some callers still pass one) so we
  // never double up the extension after sanitizing.
  const base = filename.replace(/\.docx$/i, '');
  saveAs(blob, `${sanitizeFilename(base)}.docx`);
}

export default { exportDeliverableToWord, exportHtmlToWord };
