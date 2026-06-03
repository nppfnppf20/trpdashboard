import PizZip from 'pizzip';
import fileSaver from 'file-saver';

const { saveAs } = fileSaver;

// Map template_type values to static .docx template files
const TEMPLATE_MAP = {
  planning_statement_solar: '/planningstatementsolar.docx',
  site_justification:       '/planningstatementsolar.docx',
  eia_screening:            '/planningstatementsolar.docx',
  cover_letter:             '/letter.docx',
  certificate_b_notice:     '/letter.docx',
  stage1_review:            '/stage1reviewtemplate.docx'
};

const DEFAULT_TEMPLATE = '/planningstatementsolar.docx';

function getTemplatePath(deliverable) {
  return TEMPLATE_MAP[deliverable.deliverable_type] || DEFAULT_TEMPLATE;
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
  const bodyContent = htmlToOOXML(html);

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
function htmlToOOXML(html) {
  const div = document.createElement('div');
  div.innerHTML = html;

  // If there are no element children the content is bare text nodes — wrap each line.
  if (div.children.length === 0) {
    return (div.textContent || '').split('\n')
      .map(l => l.trim()).filter(Boolean)
      .map(l => paragraph('Normal', `<w:r><w:t xml:space="preserve">${escapeXml(l)}</w:t></w:r>`))
      .join('');
  }

  return Array.from(div.childNodes).map(node => {
    if (node.nodeType === Node.ELEMENT_NODE) return elementToOOXML(node);
    // Orphaned top-level text node
    const t = node.textContent.trim();
    return t ? paragraph('Normal', `<w:r><w:t xml:space="preserve">${escapeXml(t)}</w:t></w:r>`) : '';
  }).filter(Boolean).join('');
}

function elementToOOXML(el) {
  const tag = el.tagName.toLowerCase();

  switch (tag) {
    case 'h1':
      stripLeadingNumber(el);
      return paragraph('Heading1', inlineRuns(el));
    case 'h2':
      stripLeadingNumber(el);
      return paragraph('Heading2', inlineRuns(el));
    case 'h3':
      stripLeadingNumber(el);
      return paragraph('Heading3', inlineRuns(el));
    case 'h4':
      stripLeadingNumber(el);
      return paragraph('Heading4', inlineRuns(el));
    case 'p':
      return paragraph('Normal', inlineRuns(el));
    case 'ul':
      return Array.from(el.querySelectorAll('li')).map(li =>
        paragraph('ListBullet', inlineRuns(li))
      ).join('');
    case 'ol':
      return Array.from(el.querySelectorAll('li')).map(li =>
        paragraph('ListNumber', inlineRuns(li))
      ).join('');
    case 'table':
      if (el.classList.contains('trp-appraisal-table')) {
        return appraisalTableToOOXML(el);
      }
      return el.textContent.trim()
        ? paragraph('Normal', `<w:r><w:t xml:space="preserve">${escapeXml(el.textContent)}</w:t></w:r>`)
        : '';
    default:
      return el.textContent.trim()
        ? paragraph('Normal', `<w:r><w:t xml:space="preserve">${escapeXml(el.textContent)}</w:t></w:r>`)
        : '';
  }
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
export async function exportHtmlToWord(html, filename, templatePath = '/basicdocument.docx') {
  const response = await fetch(templatePath);
  if (!response.ok) throw new Error(`Could not load template: ${templatePath}`);

  const arrayBuffer = await response.arrayBuffer();
  const zip = new PizZip(arrayBuffer);

  const documentXml = new TextDecoder('utf-8').decode(zip.file('word/document.xml').asUint8Array());
  const bodyContent = htmlToOOXML(html);

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
