// Surgical, exact-match edits for the AI "highlight and edit" flows.
//
// Why this exists: the older flow asked the model to re-emit whole blocks
// (paragraphs, tables, lists) as HTML and swapped them in — so a table, being
// one top-level block, had to be retyped in full and routinely came back
// shortened or flattened. Here the model only returns small edits
// (`replace` / `delete` / `insert_after`, each quoting the exact existing text
// it targets) and THIS code applies them to the live document. Content the
// model doesn't quote is never touched, so it can't be dropped.
//
// Edit shapes (model output):
//   { op: 'replace',      find: 'exact existing text', replace: 'new text' }
//   { op: 'delete',       find: 'exact existing text' }
//   { op: 'insert_after', anchor: 'exact existing text', html: '<p>…</p>' }
//
// Rules enforced here, never trusted to the model:
//   - find/anchor must match exactly once in the whole document (whitespace
//     and quote style are normalised, but nothing else is fuzzy), and inside a
//     single paragraph / list item / table cell. Zero or several matches
//     reject that edit; nothing is applied on a guess.
//   - edits may only land inside the paragraphs the user scoped the request to.
//   - replace/delete work on text nodes only, so tables, lists and inline
//     formatting around the edit are untouched.
//   - a structure check (tables, rows, cells, headings, lists) must hold before
//     and after, otherwise the whole batch is refused.
//
// Applied changes are written in the same pending style as the older flow
// (PENDING_CLASS for new text, PENDING_DELETED_CLASS for struck-through old
// text) so the existing Accept / Edit Again / Cancel UI keeps working.

import {
  PENDING_CLASS,
  PENDING_DELETED_CLASS,
  splitAllParagraphs,
  mergeParagraphUpdates,
  markFragmentPending,
  markChangedWordsPending,
} from './draftParagraphs.js';

const LEAF_BLOCK_SELECTOR = 'p, li, td, th, h1, h2, h3, h4, h5, h6, blockquote, caption, div';
const STRUCTURE_TAGS = ['table', 'tr', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li'];

function parseWrapped(html) {
  const doc = new DOMParser().parseFromString(`<div>${html ?? ''}</div>`, 'text/html');
  return { doc, root: doc.body.firstChild };
}

// Plain text of a model-supplied snippet (strips any tags it added, decodes entities).
function plainText(snippet) {
  return parseWrapped(snippet).root.textContent;
}

function normChar(ch) {
  if ('‘’‚′'.includes(ch)) return "'";
  if ('“”„″'.includes(ch)) return '"';
  if ('–—'.includes(ch)) return '-';
  return ch;
}

// Collapses whitespace runs to one space and unifies quote/dash styles. Returns
// the normalised string plus, per normalised char, the original start/end
// offsets so a match can be mapped back onto the real text nodes.
function normalizeWithMap(s) {
  let out = '';
  const startMap = [];
  const endMap = [];
  let i = 0;
  while (i < s.length) {
    if (/\s/.test(s[i])) {
      let j = i;
      while (j < s.length && /\s/.test(s[j])) j++;
      out += ' ';
      startMap.push(i);
      endMap.push(j);
      i = j;
    } else {
      out += normChar(s[i]);
      startMap.push(i);
      endMap.push(i + 1);
      i++;
    }
  }
  return { out, startMap, endMap };
}

function insidePending(node, block) {
  for (let el = node.parentElement; el && el !== block; el = el.parentElement) {
    if (el.classList?.contains(PENDING_CLASS)) return true;
  }
  return false;
}

function textNodesOf(block) {
  const walker = block.ownerDocument.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) {
    if (!insidePending(n, block)) nodes.push(n);
  }
  return nodes;
}

function buildIndex(root) {
  const blocks = [...root.querySelectorAll(LEAF_BLOCK_SELECTOR)].filter(el => !el.querySelector(LEAF_BLOCK_SELECTOR));
  return blocks.map(block => {
    const nodes = textNodesOf(block);
    const lens = nodes.map(n => n.data.length);
    const starts = [];
    let pos = 0;
    for (const l of lens) { starts.push(pos); pos += l; }
    const text = nodes.map(n => n.data).join('');
    return { block, nodes, lens, starts, ...normalizeWithMap(text) };
  });
}

function findMatches(index, needle) {
  const matches = [];
  if (!needle) return matches;
  for (const entry of index) {
    let from = 0;
    for (;;) {
      const at = entry.out.indexOf(needle, from);
      if (at === -1) break;
      matches.push({ entry, start: entry.startMap[at], end: entry.endMap[at + needle.length - 1] });
      from = at + needle.length;
    }
  }
  return matches;
}

function topLevelElements(root) {
  const els = [];
  root.childNodes.forEach(node => {
    if (node.nodeType === 1 && node.textContent.trim()) els.push(node);
  });
  return els;
}

function paragraphIdOf(root, topLevel, block) {
  let el = block;
  while (el.parentElement && el.parentElement !== root) el = el.parentElement;
  const idx = topLevel.indexOf(el);
  return idx >= 0 ? `p${idx}` : null;
}

function countStructure(root) {
  const counts = {};
  for (const tag of STRUCTURE_TAGS) counts[tag] = root.querySelectorAll(tag).length;
  return counts;
}

function sanitizeFragment(el) {
  el.querySelectorAll('script, style, iframe, object, embed').forEach(x => x.remove());
  [el, ...el.querySelectorAll('*')].forEach(x => {
    for (const attr of [...x.attributes]) {
      if (/^on/i.test(attr.name)) x.removeAttribute(attr.name);
    }
  });
}

function applyTextEdit(doc, entry, start, end, replacement) {
  const hits = [];
  entry.nodes.forEach((node, i) => {
    const ns = entry.starts[i];
    const ne = ns + entry.lens[i];
    if (ne <= start || ns >= end) return;
    hits.push({ node, ls: Math.max(start - ns, 0), le: Math.min(end - ns, entry.lens[i]) });
  });
  hits.forEach((hit, i) => {
    const { node, ls, le } = hit;
    const mid = node.data.slice(ls, le);
    const after = node.data.slice(le);
    node.data = node.data.slice(0, ls);
    const added = [];
    if (mid) {
      const del = doc.createElement('span');
      del.className = PENDING_DELETED_CLASS;
      del.textContent = mid;
      added.push(del);
    }
    if (i === hits.length - 1 && replacement) {
      const ins = doc.createElement('span');
      ins.className = PENDING_CLASS;
      ins.textContent = replacement;
      added.push(ins);
    }
    if (after) added.push(doc.createTextNode(after));
    node.after(...added);
  });
}

function insertAfterBlock(doc, block, fragmentHtml) {
  const tpl = doc.createElement('template');
  tpl.innerHTML = fragmentHtml;
  const els = [...tpl.content.children];
  if (!els.length) return 'the inserted content was empty';
  els.forEach(sanitizeFragment);
  const firstTag = els[0].tagName;
  let target;
  if (firstTag === 'TR') {
    target = block.closest('tr');
    if (!target) return 'a table row can only be inserted next to text inside a table';
  } else if (firstTag === 'LI') {
    target = block.closest('li');
    if (!target) return 'a list item can only be inserted next to text inside a list';
  } else {
    target = block.closest('table') ?? block.closest('ul, ol') ?? block;
  }
  els.forEach(el => el.classList.add(PENDING_CLASS));
  target.after(...els);
  return null;
}

function snippet(s, n = 50) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

/**
 * Applies model-supplied edits to `html`.
 * @param {string} html - the current document HTML
 * @param {Array} edits - see the shapes at the top of this file
 * @param {{allowedParagraphIds?: string[]|null}} [opts] - paragraph ids (p0, p1…
 *   as produced by splitAllParagraphs) edits are allowed to touch; null = anywhere
 * @returns {{html: string, applied: number, rejected: {edit: object, reason: string}[], error?: string}}
 */
export function applyEdits(html, edits, { allowedParagraphIds = null } = {}) {
  const { doc, root } = parseWrapped(html);
  const index = buildIndex(root);
  const topLevel = topLevelElements(root);
  const before = countStructure(root);
  const allowed = allowedParagraphIds ? new Set(allowedParagraphIds) : null;

  const rejected = [];
  const textEdits = [];
  const inserts = [];

  for (const edit of Array.isArray(edits) ? edits : []) {
    const reject = reason => rejected.push({ edit, reason });
    const op = edit?.op;
    if (op !== 'replace' && op !== 'delete' && op !== 'insert_after') { reject('unknown edit type'); continue; }

    const rawNeedle = op === 'insert_after' ? edit.anchor : edit.find;
    const needle = normalizeWithMap(plainText(rawNeedle).trim()).out;
    if (!needle) { reject('no text given to locate'); continue; }

    const matches = findMatches(index, needle);
    if (matches.length === 0) { reject(`text not found in the document: "${snippet(rawNeedle)}"`); continue; }
    if (matches.length > 1) { reject(`"${snippet(rawNeedle)}" appears ${matches.length} times, so it is not specific enough`); continue; }
    const match = matches[0];

    if (allowed) {
      const pid = paragraphIdOf(root, topLevel, match.entry.block);
      if (!pid || !allowed.has(pid)) { reject(`"${snippet(rawNeedle)}" is outside the part you asked to change`); continue; }
    }

    if (op === 'insert_after') {
      if (!String(edit.html ?? '').trim()) { reject('nothing to insert'); continue; }
      inserts.push({ edit, block: match.entry.block });
      continue;
    }

    const replacement = op === 'replace' ? plainText(edit.replace ?? '') : '';
    if (op === 'replace' && normalizeWithMap(replacement).out === needle) { reject('replacement is identical to the original'); continue; }

    const overlaps = textEdits.some(t => t.entry === match.entry && match.start < t.end && t.start < match.end);
    if (overlaps) { reject('overlaps another edit'); continue; }
    textEdits.push({ entry: match.entry, start: match.start, end: match.end, replacement, edit });
  }

  let applied = 0;

  // Highest offsets first so earlier offsets within the same block stay valid.
  const byBlock = new Map();
  for (const t of textEdits) {
    if (!byBlock.has(t.entry)) byBlock.set(t.entry, []);
    byBlock.get(t.entry).push(t);
  }
  for (const list of byBlock.values()) {
    list.sort((a, b) => b.start - a.start);
    for (const t of list) {
      applyTextEdit(doc, t.entry, t.start, t.end, t.replacement);
      applied++;
    }
  }

  let insertsApplied = 0;
  for (const ins of inserts) {
    const problem = insertAfterBlock(doc, ins.block, String(ins.edit.html));
    if (problem) { rejected.push({ edit: ins.edit, reason: problem }); continue; }
    applied++;
    insertsApplied++;
  }

  // Safety net: text edits can never change the document's structure, and an
  // insert can only add to it. Anything else means a bug — refuse the batch
  // rather than hand back a document with missing tables or rows.
  const after = countStructure(root);
  for (const tag of STRUCTURE_TAGS) {
    const broken = insertsApplied === 0 ? after[tag] !== before[tag] : after[tag] < before[tag];
    if (broken) {
      return {
        html,
        applied: 0,
        rejected: [...rejected, ...textEdits.map(t => ({ edit: t.edit, reason: 'structure check failed' }))],
        error: `The edit was blocked because it would have changed the document structure (<${tag}> count ${before[tag]} to ${after[tag]}). Nothing was changed.`,
      };
    }
  }

  return { html: root.innerHTML, applied, rejected };
}

function describeRejections(rejected) {
  const reasons = rejected.slice(0, 3).map(r => r.reason);
  const more = rejected.length > 3 ? ` (and ${rejected.length - 3} more)` : '';
  return `${reasons.join('; ')}${more}`;
}

/**
 * Turns an AI edit response into the document HTML to show as a pending change.
 * Handles both response shapes:
 *   { edits: [...] }   exact-match edits (preferred)
 *   { updated: [...] } legacy whole-block rewrites, kept for the routes that
 *                      haven't moved to edits yet — with a guard so tables and
 *                      lists are never flattened by the word-level diff.
 * @returns {{html: string, warnings: string[]}} — throws Error with a
 *   user-readable message when nothing could be applied.
 */
export function applyAiEditResult(originalHtml, result, paragraphIds = null) {
  const warnings = [];

  if (Array.isArray(result?.edits)) {
    const r = applyEdits(originalHtml, result.edits, { allowedParagraphIds: paragraphIds });
    if (r.error) throw new Error(r.error);
    if (!r.applied) {
      const err = new Error(
        r.rejected.length
          ? `None of the AI's changes could be applied safely: ${describeRejections(r.rejected)}. Try highlighting a smaller passage or rephrasing.`
          : 'The AI did not suggest any changes.'
      );
      // Lets a caller (e.g. the Create card) tell the AI what went wrong and retry once.
      if (r.rejected.length) {
        err.code = 'EDITS_REJECTED';
        err.reasons = describeRejections(r.rejected);
      }
      throw err;
    }
    if (r.rejected.length) {
      warnings.push(`${r.rejected.length} change${r.rejected.length === 1 ? ' was' : 's were'} skipped: ${describeRejections(r.rejected)}.`);
    }
    return { html: r.html, warnings };
  }

  const allParagraphs = splitAllParagraphs(originalHtml);
  const oldHtmlById = Object.fromEntries(allParagraphs.map(p => [p.id, p.html]));
  const taggedUpdates = [];
  let skipped = 0;
  for (const p of result?.updated ?? []) {
    const oldHtml = oldHtmlById[p.id];
    // Tables and lists are rewritten as one block by the legacy path and the
    // word diff below would flatten them to plain text — leave them alone.
    if (oldHtml && /^<(table|ul|ol)[\s>]/i.test(oldHtml.trim())) { skipped++; continue; }
    const html = oldHtml ? markChangedWordsPending(oldHtml, p.html) : markFragmentPending(p.html);
    taggedUpdates.push({ id: p.id, html });
  }
  if (skipped) {
    warnings.push(`${skipped} table or list${skipped === 1 ? ' was' : 's were'} left unchanged — this edit mode can't safely rewrite them. Highlight the specific text inside instead.`);
  }
  if (!taggedUpdates.length) {
    throw new Error(skipped ? warnings[0] : 'The AI did not suggest any changes.');
  }
  return { html: mergeParagraphUpdates(allParagraphs, taggedUpdates), warnings };
}
