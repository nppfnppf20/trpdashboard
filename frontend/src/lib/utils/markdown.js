// Lightweight markdown → HTML renderer for guiding briefs and prompt previews.
// Handles the subset of markdown commonly found in planning briefs and prompts.
export function md(text) {
  if (!text) return '';

  const lines = text.split('\n');
  const out = [];
  let inList = false;
  let listItems = [];

  function flushList() {
    if (listItems.length) {
      out.push(`<ul>${listItems.map(li => `<li>${li}</li>`).join('')}</ul>`);
      listItems = [];
      inList = false;
    }
  }

  function inlineFormat(s) {
    return s
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>');
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trimEnd();

    if (/^#{4,}\s/.test(line)) {
      flushList();
      out.push(`<h4>${inlineFormat(line.replace(/^#{4,}\s+/, ''))}</h4>`);
    } else if (/^###\s/.test(line)) {
      flushList();
      out.push(`<h3>${inlineFormat(line.replace(/^###\s+/, ''))}</h3>`);
    } else if (/^##\s/.test(line)) {
      flushList();
      out.push(`<h2>${inlineFormat(line.replace(/^##\s+/, ''))}</h2>`);
    } else if (/^#\s/.test(line)) {
      flushList();
      out.push(`<h1>${inlineFormat(line.replace(/^#\s+/, ''))}</h1>`);
    } else if (/^---+$/.test(line.trim())) {
      flushList();
      out.push('<hr>');
    } else if (/^[-*]\s+/.test(line)) {
      inList = true;
      listItems.push(inlineFormat(line.replace(/^[-*]\s+/, '')));
    } else if (/^\d+\.\s/.test(line)) {
      // Numbered list — treat as ordered list items
      if (inList) flushList();
      inList = true;
      listItems.push(inlineFormat(line.replace(/^\d+\.\s+/, '')));
    } else if (line.trim() === '') {
      flushList();
      out.push(''); // blank line separator
    } else {
      flushList();
      out.push(`<p>${inlineFormat(line)}</p>`);
    }
  }
  flushList();

  // Remove consecutive empty strings, collapse into clean output
  return out.filter((l, i) => !(l === '' && out[i - 1] === '')).join('\n');
}
