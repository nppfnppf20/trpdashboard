import PizZip from 'pizzip';
import fileSaver from 'file-saver';

const { saveAs } = fileSaver;

// Map template_type values to static .docx template files
const TEMPLATE_MAP = {
  planning_statement_solar: '/planningstatementsolar.docx',
  site_justification:       '/planningstatementsolar.docx',
  eia_screening:            '/planningstatementsolar.docx',
  cover_letter:             '/letter.docx',
  certificate_b_notice:     '/letter.docx'
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
  return Array.from(div.children).map(el => elementToOOXML(el)).filter(Boolean).join('');
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
    default:
      return el.textContent.trim()
        ? paragraph('Normal', `<w:r><w:t xml:space="preserve">${escapeXml(el.textContent)}</w:t></w:r>`)
        : '';
  }
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
