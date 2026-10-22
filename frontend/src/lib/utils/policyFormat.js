/**
 * Policy wording formatting helpers.
 *
 * Two jobs, both whitespace-only so a policy's verbatim wording is never
 * rewritten:
 *   - formatPastedPolicyText: tidies text as it is pasted into a policy box
 *     (PDF line wraps, stray spacing, sub-clauses run together), see
 *     formatOnPaste below.
 *   - autoFormatPolicyText: turns stored plain text into starting HTML
 *     paragraphs for the policy preview modal.
 */

// "(a)", "a)", "a.", "(iv)", "iv)", "1.", "1)", "(1)", "1.3", "1.3.2", bullets and dashes.
// A bare number with no "." or ")" is deliberately not a marker: "10 dwellings or more"
// at the start of a wrapped line is ordinary text.
export const LIST_MARKER = /^(\(?[a-z]{1,4}\)|[a-z]\.|\(\d{1,3}\)|\d{1,3}(?:\.\d{1,3})+\.?|\d{1,3}[.)]|[•▪●◦‣\-–—*])\s/i;

// A line that ends a sentence, clause or lead-in (optionally followed by a closing quote/bracket)
const SENTENCE_END = /[.!?:;]["'”’)\]]*$/;

// A line that carries on from the one before: starts in lower case, or with a
// comma, bracket, quote or digit (e.g. a footnote marker splitting a sentence).
const CONTINUES = /^[a-z0-9(,;.)\]'"’”]/;

// "5.1 Title", "1.3.2 Title"
const NUMBERED_HEADING = /^\d{1,3}(?:\.\d{1,3})+\.?\s/;

// A line that starts with a bullet glyph
const BULLET_LINE = /^[•▪●◦‣]\s/;

const isAllCaps = line => line.length >= 4 && /[A-Z]/.test(line) && line === line.toUpperCase();

// A transcript speaker label with its timestamp: "Speaker 1 0:21", "Robert Shaw 0:35",
// "Unknown Speaker 12:04:30". Always its own line, so the speech under it never gets
// glued onto it, and treated as a heading (bold in the viewer).
const SPEAKER_LINE = /^\p{L}[\p{L}\p{N} .'’-]{0,59}?\s+\d{1,2}:\d{2}(?::\d{2})?$/u;

// "Full width" for a block of text: the median of its longer lines, not the
// single longest one, so one long unwrapped line can't hide the wraps around it.
function typicalLineWidth(lines) {
  const long = lines.map(l => l.length).filter(n => n >= 40).sort((a, b) => a - b);
  return long.length ? long[Math.floor(long.length / 2)] : 0;
}

const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv'];

// Sub-clauses run together inside one flowing line: "must: a) x; b) y; and c) z".
// A marker only counts if it continues a sequence ((a) then (b), 1. then 2.,
// (i) then (ii)), and at least two must be found. That keeps a stray "4." in
// "see section 4. The Council..." from being treated as a list item.
function splitInlineMarkers(text) {
  const padded = ` ${text}`;
  const re = /\s(\(?)([a-z]{1,4}|\d{1,2})([).])(?=\s)/gi;
  let nextLetter = null;
  let nextDigit = null;
  let nextRoman = null;
  /** @type {{ digit: number[], letter: number[], roman: number[] }} */
  const found = { digit: [], letter: [], roman: [] };

  for (const m of padded.matchAll(re)) {
    const token = m[2];
    const close = m[3];
    const lower = token.toLowerCase();

    if (/^\d+$/.test(token)) {
      const n = Number(token);
      if (nextDigit === null || n === nextDigit) { found.digit.push(m.index); nextDigit = n + 1; }
    } else if (close === ')') {
      const romanIdx = ROMAN.indexOf(lower);
      if (lower === 'i' && nextLetter === null && nextRoman === null) {
        // A leading "(i)" could start either a lettered or a roman sequence;
        // count it for both and let the following markers decide.
        found.letter.push(m.index);
        found.roman.push(m.index);
        nextLetter = lower.charCodeAt(0) + 1;
        nextRoman = 1;
      } else if (lower.length === 1 && (nextLetter === null || lower.charCodeAt(0) === nextLetter)) {
        found.letter.push(m.index);
        nextLetter = lower.charCodeAt(0) + 1;
      } else if (romanIdx !== -1 && (nextRoman === null || romanIdx === nextRoman)) {
        found.roman.push(m.index);
        nextRoman = romanIdx + 1;
      }
    }
  }

  // Each kind of marker needs at least two of its own to count.
  const breakAt = [...new Set(Object.values(found).filter(list => list.length >= 2).flat())].sort((a, b) => a - b);
  if (!breakAt.length) return text;
  let out = '';
  let last = 0;
  for (const i of breakAt) {
    out += padded.slice(last, i) + '\n';
    last = i + 1;
  }
  out += padded.slice(last);
  return out.trim();
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Replaces symbol-font bullets with a normal "•". Word and PDF documents often
 * use a bullet from Symbol or Wingdings, which sits in the Unicode private-use
 * area and shows as an empty box anywhere that font isn't loaded. A bullet that
 * follows other text on its line (a table-style "Label  ⇥ ▯ ⇥ text") starts a new
 * line, so it reads as a list item.
 *
 * @param {string} text
 * @returns {string}
 */
export function normaliseBullets(text) {
  if (!text) return '';
  return String(text)
    .replace(/(\S)[ \t]*[-][ \t]*/g, '$1\n• ')
    .replace(/[-][ \t]*/g, '• ');
}

/**
 * Tidies pasted policy wording. Only whitespace changes (apart from symbol-font
 * bullets becoming a normal "•", see normaliseBullets): no words, letters or
 * punctuation are added, removed or reordered.
 *   - invisible characters (non-breaking / zero-width spaces, soft hyphens) become
 *     ordinary spaces or are dropped, tabs and repeated spaces collapse
 *   - lines that a PDF hard-wrapped mid-sentence are joined back up
 *   - each sub-clause ("(a)", "(i)", "1.", bullets) starts on its own line
 *   - a line ending in ":" stays on its own, as the lead-in to a list
 *   - blank lines between paragraphs are kept (once)
 *   - sub-clauses run together on a single line are split out, but only when at
 *     least two markers are found, to avoid breaking on a stray "4." or "a)"
 *
 * @param {string} text
 * @returns {string}
 */
export function formatPastedPolicyText(text) {
  if (!text) return '';

  let t = normaliseBullets(String(text).replace(/\r\n?/g, '\n'))
    .replace(/[­​-‍﻿]/g, '')
    .replace(/[   ]/g, ' ')
    .replace(/[ \t]+/g, ' ');

  // A single flowing line with several sub-clauses: put each on its own line.
  if (!t.includes('\n')) t = splitInlineMarkers(t);

  const out = [];
  let paragraph = '';
  let prevLineLength = 0;

  const flush = () => {
    if (paragraph) out.push(paragraph);
    paragraph = '';
  };

  // A hard-wrapped line runs close to the full line width; a heading or a
  // deliberately short line does not. Joining only after a near-full-width line
  // keeps headings and one-paragraph-per-line text exactly as they were.
  const lines = t.split('\n').map(l => l.trim());
  const typicalWidth = typicalLineWidth(lines);
  const looksWrapped = len => typicalWidth >= 30 && len >= typicalWidth * 0.8;

  // In narrow columns a wrapped line is about as long as a heading, so headings
  // are recognised by their form instead: ALL CAPS, or a section number
  // ("5.1 Special Landscape Qualities") that stops short of full width without
  // ending a sentence. A heading never absorbs the line after it, and never
  // gets absorbed into the paragraph before it.
  const isHeadingLine = line =>
    isAllCaps(line) || SPEAKER_LINE.test(line) ||
    (NUMBERED_HEADING.test(line) && !SENTENCE_END.test(line) && line.length < typicalWidth * 0.95);
  // A heading that itself wrapped: "1.2 Housing development in" / "existing rural groups".
  // The second line starts in lower case, is short, and doesn't end a sentence.
  const continuesHeading = line =>
    /^[a-z]/.test(line) && !SENTENCE_END.test(line) && !LIST_MARKER.test(line) &&
    line.length < (typicalWidth >= 30 ? typicalWidth * 0.8 : 45);
  let paragraphIsHeading = false;
  const startParagraph = line => {
    paragraph = line;
    paragraphIsHeading = isHeadingLine(line);
  };

  for (const line of lines) {
    if (!line) {
      flush();
      prevLineLength = 0;
      if (out.length && out[out.length - 1] !== '') out.push('');
      continue;
    }

    if (!paragraph) {
      startParagraph(line);
    } else if (paragraphIsHeading && NUMBERED_HEADING.test(paragraph) && continuesHeading(line)) {
      // Only a numbered heading can wrap onto a second line. A speaker label
      // ("Speaker 1 0:21") or an ALL CAPS title never takes the next line with it.
      paragraph += ` ${line}`; // still the heading
    } else if (
      LIST_MARKER.test(line) || SENTENCE_END.test(paragraph) || paragraphIsHeading || isHeadingLine(line) ||
      !(CONTINUES.test(line) || looksWrapped(prevLineLength))
    ) {
      // A new item or heading, or the previous line finished a sentence/lead-in,
      // or this line doesn't read as a continuation. A line that starts in lower
      // case (or with a comma, bracket or number) is a continuation of the one
      // before, however short that one was. A line that starts with a capital is
      // only joined when the previous line ran close to full width; otherwise
      // the break is kept. That can leave an occasional wrap un-joined, but it
      // never glues together headings or paragraphs that were already
      // one-per-line.
      flush();
      startParagraph(line);
    } else if (/[A-Za-z]-$/.test(paragraph)) {
      // Wrapped mid-word at a hyphen: join without a space and without
      // deciding whether the hyphen belonged to the word.
      paragraph += line;
    } else {
      paragraph += ` ${line}`;
    }
    prevLineLength = line.length;
  }
  flush();

  while (out.length && out[out.length - 1] === '') out.pop();
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

// Lines that clearly are headings, for the preview's starting formatting.
// Deliberately conservative: a wrongly bolded line is more annoying than a
// missed one, and either is one click to fix in the modal.
//   - ALL CAPS lines
//   - section-numbered lines that stop short of full width ("5.1 Special Landscape Qualities")
//   - the wrapped second line of such a heading
//   - short title-like lines ("Decision-Taking", "Sequential and Exception Test"): capitalised,
//     a few words, no commas/semicolons/full stops, not ending in "and"/"or"/"the"..., and
//     followed by a line that starts a new thought rather than continuing this one
const TRAILING_FILLER = /\b(and|or|the|of|to|in|a|an|for|with|by|on|at|from|that|which|where|when|but)$/i;

function headingFlags(lines) {
  const typical = typicalLineWidth(lines);
  const shortLimit = typical >= 30 ? typical * 0.5 : 45;
  const flags = [];
  // True for a numbered heading and for the wrapped second line of one. Only those
  // can take a continuation line, not speaker labels or ALL CAPS titles.
  const numbered = [];

  lines.forEach((line, i) => {
    const next = lines[i + 1];
    let heading = false;
    let startsNumbered = false;

    if (isAllCaps(line) || SPEAKER_LINE.test(line)) {
      heading = true;
    } else if (NUMBERED_HEADING.test(line) && !SENTENCE_END.test(line) && (typical === 0 || line.length < typical * 0.95)) {
      heading = true;
      startsNumbered = true;
    } else if (i > 0 && numbered[i - 1] && /^[a-z]/.test(line) && !SENTENCE_END.test(line) && !LIST_MARKER.test(line) && line.length < (typical >= 30 ? typical * 0.8 : 45)) {
      heading = true;
      startsNumbered = true; // the wrapped second line of a numbered heading
    } else if (
      next !== undefined && /^[A-Z]/.test(line) && !LIST_MARKER.test(line) && !/[.,;:!?]/.test(line) &&
      line.length <= shortLimit && line.split(/\s+/).length <= 8 && !TRAILING_FILLER.test(line) && !CONTINUES.test(next)
    ) {
      heading = true;
    }
    flags.push(heading);
    numbered.push(startsNumbered);
  });
  return flags;
}

/**
 * Starting HTML for the preview modal, from stored plain text: one paragraph
 * per line (breaking before sub-clause markers where the source has no line
 * breaks at all), with clear headings in bold.
 *
 * @param {string} text
 * @returns {string}
 */
export function autoFormatPolicyText(text) {
  if (!text?.trim()) return '';
  const raw = normaliseBullets(text.trim());
  const lines = (/\r\n|\n/.test(raw) ? raw.split(/\r\n|\n/) : splitInlineMarkers(raw).split('\n'))
    .map(l => l.trim())
    .filter(Boolean);
  const flags = headingFlags(lines);
  // Bullet lines get a hanging indent (see FormattedTextEditor) so the text lines up under the bullet
  return lines
    .map((l, i) => {
      if (flags[i]) return `<p><b>${escapeHtml(l)}</b></p>`;
      return BULLET_LINE.test(l) ? `<p class="bullet">${escapeHtml(l)}</p>` : `<p>${escapeHtml(l)}</p>`;
    })
    .join('');
}

/**
 * Starting HTML for saved documents and transcripts (as opposed to policy
 * wording, which is tidied when it is pasted or saved). Document text often
 * arrives straight from a PDF with a line break at every wrap, so the lines are
 * joined back up first, then clear headings are bolded. Display only: the stored
 * text is never changed by this.
 *
 * @param {string} text
 * @returns {string}
 */
export function autoFormatDocumentText(text) {
  return autoFormatPolicyText(formatPastedPolicyText(text));
}

/**
 * Svelte action for a <textarea>: pasted plain text is tidied with
 * formatPastedPolicyText before it goes in. Uses the browser's own insert
 * command where available, so Ctrl+Z undoes the paste in one step.
 *
 *   <textarea bind:value={x} use:formatOnPaste></textarea>
 */
export function formatOnPaste(node) {
  function onPaste(e) {
    const pasted = e.clipboardData?.getData('text/plain');
    if (!pasted) return;
    e.preventDefault();

    const formatted = formatPastedPolicyText(pasted);
    node.focus();
    const inserted = typeof document.execCommand === 'function' && document.execCommand('insertText', false, formatted);
    if (!inserted) {
      node.setRangeText(formatted, node.selectionStart, node.selectionEnd, 'end');
    }
    // Lets bind:value pick up the change
    node.dispatchEvent(new Event('input', { bubbles: true }));
  }

  node.addEventListener('paste', onPaste);
  return {
    destroy() {
      node.removeEventListener('paste', onPaste);
    }
  };
}
