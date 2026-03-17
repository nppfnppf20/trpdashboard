import { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun } from 'docx';
import fileSaver from 'file-saver';

const { saveAs } = fileSaver;

/**
 * Load company styles XML and logo for use in exports
 */
async function loadAssets() {
  const [stylesResponse, logoResponse] = await Promise.all([
    fetch('/company-styles.xml'),
    fetch('/logo.png')
  ]);

  if (!stylesResponse.ok) throw new Error('Could not load company-styles.xml');
  if (!logoResponse.ok) throw new Error('Could not load logo.png');

  const rawStyles = await stylesResponse.text();
  const externalStyles = resolveThemeFonts(rawStyles);
  const logoBuffer = await logoResponse.arrayBuffer();

  return { externalStyles, logoBuffer };
}

/**
 * Replace theme font references in styles.xml with explicit font names.
 * The docx library does not embed theme1.xml, so Word cannot resolve
 * w:asciiTheme="majorHAnsi" etc. without it — we resolve them here.
 * majorHAnsi = Calibri Light (headings), minorHAnsi = Calibri (body).
 */
function resolveThemeFonts(stylesXml) {
  const majorFont = 'Calibri Light';
  const minorFont = 'Calibri';

  return stylesXml
    .replace(/w:asciiTheme="major[^"]*"/g, `w:ascii="${majorFont}"`)
    .replace(/w:hAnsiTheme="major[^"]*"/g, `w:hAnsi="${majorFont}"`)
    .replace(/w:asciiTheme="minor[^"]*"/g, `w:ascii="${minorFont}"`)
    .replace(/w:hAnsiTheme="minor[^"]*"/g, `w:hAnsi="${minorFont}"`)
    .replace(/w:eastAsiaTheme="[^"]*"/g, '')
    .replace(/w:cstheme="[^"]*"/g, '');
}

/**
 * Export a planning deliverable to Word format
 * @param {Object} deliverable - The deliverable data
 * @param {string} html - The HTML content from the editor
 */
export async function exportDeliverableToWord(deliverable, html) {
  try {
    const { externalStyles, logoBuffer } = await loadAssets();
    const doc = createWordDocumentFromHTML(deliverable, html, externalStyles, logoBuffer);
    const blob = await Packer.toBlob(doc);

    const safeName = deliverable.deliverable_name.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${safeName}.docx`;

    saveAs(blob, filename);
    console.log('✅ Word document exported successfully:', filename);
  } catch (error) {
    console.error('❌ Error exporting to Word:', error);
    throw error;
  }
}

/**
 * Convert HTML content to Word document using company styles
 */
function createWordDocumentFromHTML(deliverable, html, externalStyles, logoBuffer) {
  const children = [];

  // Logo at top of first page only
  children.push(
    new Paragraph({
      children: [
        new ImageRun({
          data: logoBuffer,
          transformation: { width: 120, height: 120 }
        })
      ],
      spacing: { after: 400 }
    })
  );

  // Parse HTML and convert to Word paragraphs
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  processElements(Array.from(tempDiv.children), children);

  if (children.length === 1) {
    children.push(new Paragraph({ style: 'Normal', text: 'No content available' }));
  }

  return new Document({
    externalStyles,
    sections: [{
      properties: {},
      children
    }]
  });
}

/**
 * Process an array of HTML elements into Word paragraphs, handling lists properly
 */
function processElements(elements, output) {
  elements.forEach(element => {
    const tagName = element.tagName.toLowerCase();

    if (tagName === 'ul' || tagName === 'ol') {
      Array.from(element.children).forEach(li => {
        output.push(new Paragraph({
          style: 'Bullet1',
          children: getTextRuns(li)
        }));
      });
    } else {
      const paragraph = convertElementToParagraph(element);
      if (paragraph) output.push(paragraph);
    }
  });
}

/**
 * Convert a single HTML element to a Word Paragraph
 */
function convertElementToParagraph(element) {
  const tagName = element.tagName.toLowerCase();

  switch (tagName) {
    case 'h1':
      return new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: element.textContent })],
        spacing: { before: 400, after: 200 }
      });

    case 'h2':
      return new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: element.textContent })],
        spacing: { before: 300, after: 200 }
      });

    case 'h3':
      return new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: element.textContent })],
        spacing: { before: 200, after: 100 }
      });

    case 'h4':
      return new Paragraph({
        heading: HeadingLevel.HEADING_4,
        children: [new TextRun({ text: element.textContent })],
        spacing: { before: 200, after: 100 }
      });

    case 'p':
      return new Paragraph({
        style: 'Normal',
        children: getTextRuns(element),
        spacing: { after: 200 }
      });

    default:
      if (element.textContent.trim()) {
        return new Paragraph({
          style: 'Normal',
          children: [new TextRun({ text: element.textContent })],
          spacing: { after: 200 }
        });
      }
      return null;
  }
}

/**
 * Extract inline-formatted TextRuns from an element (bold, italic, underline)
 */
function getTextRuns(element) {
  const runs = [];

  Array.from(element.childNodes).forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      if (text) runs.push(new TextRun({ text }));
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();
      const text = node.textContent;

      if (tag === 'strong' || tag === 'b') {
        runs.push(new TextRun({ text, bold: true }));
      } else if (tag === 'em' || tag === 'i') {
        runs.push(new TextRun({ text, italics: true }));
      } else if (tag === 'u') {
        runs.push(new TextRun({ text, underline: {} }));
      } else {
        runs.push(new TextRun({ text }));
      }
    }
  });

  if (runs.length === 0) {
    runs.push(new TextRun({ text: element.textContent }));
  }

  return runs;
}

/**
 * Export to PDF via browser print
 * @param {Object} deliverable - The deliverable data
 * @param {string} html - The HTML content
 */
export function exportDeliverableToPDF(deliverable, html) {
  const printWindow = window.open('', '_blank');

  if (!printWindow) {
    throw new Error('Could not open print window. Please allow popups for this site.');
  }

  const safeName = deliverable.deliverable_name.replace(/[^a-zA-Z0-9]/g, '_');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${safeName}</title>
        <style>
          body {
            font-family: 'Calibri', 'Arial', sans-serif;
            font-size: 12pt;
            line-height: 1.6;
            color: #000;
            max-width: 8.5in;
            margin: 1in auto;
            padding: 0;
          }
          h1 { font-size: 24pt; font-weight: 600; margin: 1.5em 0 1em; color: #000; }
          h2 { font-size: 18pt; font-weight: 600; margin: 1.25em 0 0.75em; color: #000; }
          h3 { font-size: 14pt; font-weight: 600; margin: 1em 0 0.5em; color: #000; }
          p { margin: 0.5em 0; }
          ul, ol { margin: 0.5em 0; padding-left: 2em; }
          li { margin: 0.25em 0; }
          @media print { body { margin: 0; padding: 1in; } }
        </style>
      </head>
      <body>
        ${html}
      </body>
    </html>
  `);

  printWindow.document.close();

  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 250);
}

export default {
  exportDeliverableToWord,
  exportDeliverableToPDF
};
