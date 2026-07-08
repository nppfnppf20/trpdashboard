// Re-flow text copied from PDFs, where hard line breaks land mid-sentence at
// the PDF's column width. Within each paragraph (paragraphs are separated by
// blank lines), wrapped lines are joined back into flowing text. Lines that
// start a list item — "(a)", "b)", "1.", "-", "•" — keep their own line.

const LIST_START = /^\s*(\(?[a-zA-Z0-9]{1,4}[).:]|[-•*–])\s+/;

export function cleanPastedText(text) {
  if (!text) return text;

  const paragraphs = text.replace(/\r\n/g, '\n').split(/\n\s*\n/);

  const cleaned = paragraphs.map(p => {
    const lines = p.split('\n').map(l => l.trim()).filter(Boolean);
    const parts = [];
    let current = '';
    for (const line of lines) {
      if (!current) {
        current = line;
      } else if (LIST_START.test(line)) {
        parts.push(current);
        current = line;
      } else {
        current += ' ' + line;
      }
    }
    if (current) parts.push(current);
    return parts.join('\n');
  });

  return cleaned
    .filter(p => p.trim())
    .join('\n\n')
    .replace(/[ \t]{2,}/g, ' ');
}
