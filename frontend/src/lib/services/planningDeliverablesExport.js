import PizZip from 'pizzip';
import fileSaver from 'file-saver';

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

const CS_FAMILY     = new Set([CS_TEMPLATE, SOC_TEMPLATE, SOCG_TEMPLATE]);
const LETTER_FAMILY = new Set(['/letter.docx']);

function getStyleMap(templatePath) {
  if (CS_FAMILY.has(templatePath))     return CS_STYLES;
  if (LETTER_FAMILY.has(templatePath)) return LETTER_STYLES;
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
export async function exportDeliverableToWord(deliverable, html) {
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

  const safeName = deliverable.deliverable_name.replace(/[^a-zA-Z0-9]/g, '_');
  saveAs(blob, `${safeName}.docx`);
}

/**
 * Convert HTML to OOXML paragraphs
 */
function htmlToOOXML(html, styles = DEF_STYLES) {
  const div = document.createElement('div');
  div.innerHTML = html;

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
      return generalTableToOOXML(el);
    default:
      return el.textContent.trim()
        ? paragraph(styles.p, `<w:r><w:t xml:space="preserve">${escapeXml(el.textContent)}</w:t></w:r>`)
        : '';
  }
}

function generalTableToOOXML(tableEl) {
  const rows = Array.from(tableEl.querySelectorAll('tr'));
  if (!rows.length) return '';

  // Count max columns to distribute width evenly
  const colCount = Math.max(...rows.map(tr => tr.querySelectorAll('th, td').length)) || 1;
  const totalWidth = 9072; // twips (~15.9cm, standard page width minus margins)
  const colWidth = Math.floor(totalWidth / colCount);

  const tblPr = `<w:tblPr>
    <w:tblStyle w:val="TableGrid"/>
    <w:tblW w:w="${totalWidth}" w:type="dxa"/>
    <w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/>
  </w:tblPr>`;

  const tblGrid = `<w:tblGrid>${Array(colCount).fill(`<w:gridCol w:w="${colWidth}"/>`).join('')}</w:tblGrid>`;

  const rowsXml = rows.map(tr => {
    const cells = Array.from(tr.querySelectorAll('th, td'));
    const isHeader = cells.some(c => c.tagName.toLowerCase() === 'th');
    const cellsXml = cells.map(cell => {
      const text = escapeXml(cell.textContent.trim());
      const runs = isHeader || cell.tagName.toLowerCase() === 'th'
        ? `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${text}</w:t></w:r>`
        : `<w:r><w:t xml:space="preserve">${text}</w:t></w:r>`;
      return `<w:tc><w:tcPr><w:tcW w:w="${colWidth}" w:type="dxa"/></w:tcPr><w:p>${runs}</w:p></w:tc>`;
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

function inlineRuns(el) {
  let xml = '';
  el.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent) {
        xml += `<w:r><w:t xml:space="preserve">${escapeXml(node.textContent)}</w:t></w:r>`;
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();
      const text = escapeXml(node.textContent);
      if (tag === 'strong' || tag === 'b') {
        xml += `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${text}</w:t></w:r>`;
      } else if (tag === 'em' || tag === 'i') {
        xml += `<w:r><w:rPr><w:i/></w:rPr><w:t xml:space="preserve">${text}</w:t></w:r>`;
      } else if (tag === 'u') {
        xml += `<w:r><w:rPr><w:u w:val="single"/></w:rPr><w:t xml:space="preserve">${text}</w:t></w:r>`;
      } else {
        xml += `<w:r><w:t xml:space="preserve">${text}</w:t></w:r>`;
      }
    }
  });
  return xml;
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

  const safeName = filename.replace(/[^a-zA-Z0-9]/g, '_');
  saveAs(blob, `${safeName}.docx`);
}

export default { exportDeliverableToWord, exportHtmlToWord };
