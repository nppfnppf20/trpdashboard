// Plain-text bullet helpers for a <textarea>: "• " lines, with "◦ " for
// indented sub-points. Older "- " lines are still recognised as bullets.
// Edits go through execCommand('insertText') where the browser allows it, so
// the textarea's own undo (Ctrl+Z) keeps working; setRangeText is the fallback.

const BULLET = /^(\s*)([-•◦*])\s/;

// Top-level lines get "•", indented lines get "◦"
const markerFor = (indent) => (indent ? '◦' : '•');

function replaceRange(textarea, start, end, text) {
  textarea.focus();
  textarea.setSelectionRange(start, end);
  let done = false;
  try { done = document.execCommand('insertText', false, text); } catch { /* fall through */ }
  if (!done) {
    textarea.setRangeText(text, start, end, 'end');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

/**
 * Toggles bullets on the selected lines (or the caret's line). If every
 * non-empty selected line is already a bullet the bullets are removed,
 * otherwise a bullet is added to the lines that are not bullets yet.
 */
export function toggleBullets(textarea) {
  const value = textarea.value;
  const selStart = textarea.selectionStart ?? 0;
  const selEnd = textarea.selectionEnd ?? selStart;

  const start = value.lastIndexOf('\n', selStart - 1) + 1;
  const nextBreak = value.indexOf('\n', selEnd);
  const end = nextBreak === -1 ? value.length : nextBreak;

  const lines = value.slice(start, end).split('\n');
  const target = lines.filter(l => l.trim());
  if (!target.length) {
    // Empty line: start a bullet on it
    replaceRange(textarea, start, end, `${lines[0]}• `);
    return;
  }

  const allBulleted = target.every(l => BULLET.test(l));
  const mapped = lines.map(l => {
    if (!l.trim()) return l;
    if (allBulleted) return l.replace(BULLET, '$1');
    return BULLET.test(l) ? l : l.replace(/^(\s*)/, (_, indent) => `${indent}${markerFor(indent)} `);
  });

  // Top-level bullets are separated by a blank line (that is what gives the
  // bigger gap between bullets); sub-bullets sit directly under their bullet.
  const out = [];
  for (const l of mapped) {
    const topLevel = /^[•\-*]\s/.test(l);
    const prev = out[out.length - 1];
    if (!allBulleted && topLevel && prev !== undefined && prev.trim()) out.push('');
    out.push(l);
  }

  const text = out.join('\n');
  replaceRange(textarea, start, end, text);
  textarea.setSelectionRange(start, start + text.length);
}

/**
 * keydown handler: pressing Enter at the end of a bullet starts the next
 * bullet (a top-level bullet leaves a blank line first; a sub-bullet does not);
 * Enter on an empty bullet ends the list.
 */
export function continueBulletOnEnter(e) {
  if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
  const ta = e.target;
  if (ta.selectionStart !== ta.selectionEnd) return;

  const pos = ta.selectionStart;
  const value = ta.value;
  const lineStart = value.lastIndexOf('\n', pos - 1) + 1;
  const nextBreak = value.indexOf('\n', pos);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;
  const line = value.slice(lineStart, lineEnd);

  const m = line.match(BULLET);
  if (!m) return;
  // Only when the caret is after the bullet marker
  if (pos < lineStart + m[0].length) return;

  e.preventDefault();
  if (!line.slice(m[0].length).trim()) {
    // Empty bullet: Enter ends the list (and drops the blank line that preceded it)
    const prevBlank = lineStart >= 2 && value[lineStart - 1] === '\n' && value[lineStart - 2] === '\n';
    replaceRange(ta, prevBlank ? lineStart - 1 : lineStart, lineEnd, '');
  } else if (m[1]) {
    // Sub-bullet: next sub-bullet directly underneath
    replaceRange(ta, pos, pos, `\n${m[1]}${markerFor(m[1])} `);
  } else {
    // Top-level bullet: blank line, then the next bullet
    replaceRange(ta, pos, pos, `\n\n${markerFor(m[1])} `);
  }
}
