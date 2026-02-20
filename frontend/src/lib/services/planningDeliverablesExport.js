import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import fileSaver from 'file-saver';

const { saveAs } = fileSaver;

/**
 * Export a planning deliverable to Word format
 * @param {Object} deliverable - The deliverable data
 * @param {string} html - The HTML content from the editor
 */
export async function exportDeliverableToWord(deliverable, html) {
  try {
    const doc = createWordDocumentFromHTML(deliverable, html);
    const blob = await Packer.toBlob(doc);
    
    // Generate filename
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
 * Convert HTML content to Word document
 * @param {Object} deliverable - The deliverable metadata
 * @param {string} html - HTML content
 * @returns {Document} Word document
 */
function createWordDocumentFromHTML(deliverable, html) {
  const children = [];

  // Parse HTML and convert to Word paragraphs
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  // Process each element
  Array.from(tempDiv.children).forEach(element => {
    const paragraph = convertElementToParagraph(element);
    if (paragraph) {
      children.push(paragraph);
    }
  });

  // If no content, add a placeholder
  if (children.length === 0) {
    children.push(
      new Paragraph({
        text: 'No content available',
        spacing: { after: 200 }
      })
    );
  }

  return new Document({
    sections: [{
      properties: {},
      children: children
    }]
  });
}

/**
 * Convert HTML element to Word Paragraph
 * @param {HTMLElement} element - HTML element
 * @returns {Paragraph|null} Word paragraph or null
 */
function convertElementToParagraph(element) {
  const tagName = element.tagName.toLowerCase();

  switch (tagName) {
    case 'h1':
      return new Paragraph({
        text: element.textContent,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 }
      });

    case 'h2':
      return new Paragraph({
        text: element.textContent,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 200 }
      });

    case 'h3':
      return new Paragraph({
        text: element.textContent,
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 200, after: 100 }
      });

    case 'p':
      return createParagraphFromContent(element);

    case 'ul':
    case 'ol':
      // For lists, we need to process each li individually
      // This is a simplified version - proper list handling would require more logic
      return null; // Will be handled by parent processing

    default:
      if (element.textContent.trim()) {
        return new Paragraph({
          text: element.textContent,
          spacing: { after: 200 }
        });
      }
      return null;
  }
}

/**
 * Create a paragraph with formatted text runs (bold, italic, etc.)
 * @param {HTMLElement} element - The paragraph element
 * @returns {Paragraph} Word paragraph
 */
function createParagraphFromContent(element) {
  const children = [];

  // Process child nodes to handle inline formatting
  Array.from(element.childNodes).forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      if (text.trim()) {
        children.push(new TextRun({ text }));
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();
      const text = node.textContent;

      if (tag === 'strong' || tag === 'b') {
        children.push(new TextRun({ text, bold: true }));
      } else if (tag === 'em' || tag === 'i') {
        children.push(new TextRun({ text, italics: true }));
      } else if (tag === 'u') {
        children.push(new TextRun({ text, underline: {} }));
      } else {
        children.push(new TextRun({ text }));
      }
    }
  });

  // If no formatted children, just use plain text
  if (children.length === 0) {
    children.push(new TextRun({ text: element.textContent }));
  }

  return new Paragraph({
    children,
    spacing: { after: 200 }
  });
}

/**
 * Export to PDF (placeholder - will use print functionality)
 * @param {Object} deliverable - The deliverable data
 * @param {string} html - The HTML content
 */
export function exportDeliverableToPDF(deliverable, html) {
  // For now, we'll use browser print-to-PDF
  // Create a new window with the content
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
          h1 {
            font-size: 24pt;
            font-weight: 600;
            margin: 1.5em 0 1em;
            color: #000;
          }
          h2 {
            font-size: 18pt;
            font-weight: 600;
            margin: 1.25em 0 0.75em;
            color: #000;
          }
          h3 {
            font-size: 14pt;
            font-weight: 600;
            margin: 1em 0 0.5em;
            color: #000;
          }
          p {
            margin: 0.5em 0;
          }
          ul, ol {
            margin: 0.5em 0;
            padding-left: 2em;
          }
          li {
            margin: 0.25em 0;
          }
          @media print {
            body {
              margin: 0;
              padding: 1in;
            }
          }
        </style>
      </head>
      <body>
        ${html}
      </body>
    </html>
  `);

  printWindow.document.close();
  
  // Trigger print dialog after a short delay
  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 250);
}

export default {
  exportDeliverableToWord,
  exportDeliverableToPDF
};

