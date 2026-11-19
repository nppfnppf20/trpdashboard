// Block-ID edits for the Create card.
//
// The AI never quotes text to say where a change goes. Every paragraph, heading, list item and
// table cell that has text is numbered (annotateBlocks adds data-b="N" to the copy of the
// document the AI reads), and the AI answers with block numbers:
//   { op: 'replace',      id, html?, as? }   new content for block N (inline html, or block html
//                                            to turn one block into several); `as` restyles it
//   { op: 'delete',       id }
//   { op: 'insert_after', id, html }         new block(s) after block N
//
// Numbering rule (used identically when annotating, when selecting in the editor and when
// applying): blocks are the elements matching LEAF_BLOCK_SELECTOR, in document order, that have
// text of their OWN (not just inside a nested block). Struck-through pending text does not count.
//
// Changes are written as pending markers (PENDING_CLASS / PENDING_DELETED_CLASS) so the existing
// Accept / Discard UI keeps working. Tables are never rebuilt: only cell contents and whole new
// rows are touched, and a structure check refuses the batch if a table, row or cell count moves.

import { diffWords } from 'diff';
import { PENDING_CLASS, PENDING_DELETED_CLASS } from './draftParagraphs.js';

export const LEAF_BLOCK_SELECTOR = 'p, li, td, th, h1, h2, h3, h4, h5, h6, blockquote, caption, div';
const BLOCK_TAGS = new Set(['P', 'UL', 'OL', 'LI', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'DIV', 'CAPTION', 'PRE', 'HR', 'SECTION', 'ARTICLE']);
const INLINE_OK = new Set(['A', 'STRONG', 'B', 'EM', 'I', 'U', 'BR', 'SPAN', 'SUB', 'SUP']);
const RESTYLE_TARGETS = { p: 'P', 'p-bold': 'P', h2: 'H2', h3: 'H3', h4: 'H4' };
const COUNTED = ['table', 'tr', 'td', 'th'];

function parseWrapped(html) {
  const doc = new DOMParser().parseFromString(`<div>${html ?? ''}</div>`, 'text/html');
  return { doc, root: doc.body.firstChild };
}

function ownTextNodes(block) {
  const walker = block.ownerDocument.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) {
    const parent = n.parentElement;
    if (!parent || parent.closest(LEAF_BLOCK_SELECTOR) !== block) continue;
    if (parent.closest(`.${PENDING_DELETED_CLASS}`)) continue;
    nodes.push(n);
  }
  return nodes;
}

/** The numbered blocks of a document root, in order. Index in this array = block id. */
export function textBlocks(root) {
  return [...root.querySelectorAll(LEAF_BLOCK_SELECTOR)].filter(b => ownTextNodes(b).some(n => n.data.trim()));
}

/** Copy of the document with data-b="N" on every numbered block, for the AI to read. */
export function annotateBlocks(html) {
  const { root } = parseWrapped(html);
  textBlocks(root).forEach((b, i) => b.setAttribute('data-b', String(i)));
  return root.innerHTML;
}

/** Ids of the numbered blocks a DOM Range actually covers (touching a boundary does not count). */
export function blockIdsInRange(root, range) {
  const ids = [];
  textBlocks(root).forEach((block, i) => {
    if (!range.intersectsNode(block)) return;
    const r = document.createRange();
    r.selectNodeContents(block);
    if (r.compareBoundaryPoints(Range.START_TO_START, range) < 0) r.setStart(range.startContainer, range.startOffset);
    if (r.compareBoundaryPoints(Range.END_TO_END, range) > 0) r.setEnd(range.endContainer, range.endOffset);
    if (r.toString().trim()) ids.push(i);
  });
  return ids;
}

const escapeHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function stripUnsafe(el) {
  el.querySelectorAll('script, style, iframe, object, embed').forEach(x => x.remove());
  [...(el.nodeType === 1 ? [el] : []), ...el.querySelectorAll('*')].forEach(x => {
    for (const attr of [...x.attributes]) {
      if (/^on/i.test(attr.name) || attr.name === 'data-b') x.removeAttribute(attr.name);
    }
  });
}

// Unwraps any tag that is not simple inline formatting and drops its attributes.
function cleanInline(container) {
  stripUnsafe(container);
  container.querySelectorAll('*').forEach(el => {
    if (!INLINE_OK.has(el.tagName)) { el.replaceWith(...el.childNodes); return; }
    for (const attr of [...el.attributes]) {
      if (!(el.tagName === 'A' && attr.name === 'href')) el.removeAttribute(attr.name);
    }
  });
}

const isBlockChild = n => n.nodeType === 1 && BLOCK_TAGS.has(n.tagName);

// Marks a block's own content as removed (struck through until the user accepts).
function strikeOwnContent(doc, block) {
  const inline = [...block.childNodes].filter(n => !isBlockChild(n));
  if (!inline.length) return;
  const span = doc.createElement('span');
  span.className = PENDING_DELETED_CLASS;
  inline[0].before(span);
  inline.forEach(n => span.append(n));
}

// Shows the change inside the NEW content: added words highlighted, removed words struck through
// at the point they were removed. The new formatting (bold, italic, links) is kept.
function markDiff(doc, holder, oldText, newText) {
  const wrapAll = () => {
    const span = doc.createElement('span');
    span.className = PENDING_CLASS;
    span.append(...holder.childNodes);
    holder.append(span);
  };
  if (oldText === newText) { wrapAll(); return; } // formatting-only change
  const parts = diffWords(oldText, newText);
  if (parts.filter(p => !p.removed).map(p => p.value).join('') !== newText) {
    // The diff did not reproduce the new text exactly: show old struck, then the new content.
    const del = doc.createElement('span');
    del.className = PENDING_DELETED_CLASS;
    del.textContent = oldText;
    wrapAll();
    holder.prepend(del);
    return;
  }
  const adds = [];
  const dels = [];
  let pos = 0;
  for (const p of parts) {
    if (p.removed) { dels.push({ at: pos, text: p.value }); continue; }
    if (p.added) adds.push([pos, pos + p.value.length]);
    pos += p.value.length;
  }
  const total = pos;
  const bounds = new Set();
  adds.forEach(([s, e]) => { bounds.add(s); bounds.add(e); });
  dels.forEach(d => bounds.add(d.at));
  const sorted = [...bounds].sort((a, b) => a - b);

  const collect = () => {
    const walker = doc.createTreeWalker(holder, NodeFilter.SHOW_TEXT);
    const list = [];
    let n; let start = 0;
    while ((n = walker.nextNode())) { list.push({ node: n, start }); start += n.data.length; }
    return list;
  };
  // Split text nodes so every change boundary falls between nodes.
  for (const b of sorted) {
    for (const { node, start } of collect()) {
      if (b > start && b < start + node.data.length) { node.splitText(b - start); break; }
    }
  }
  const inAdd = at => adds.some(([s, e]) => at >= s && at < e);
  const delAt = new Map();
  dels.forEach(d => delAt.set(d.at, [...(delAt.get(d.at) ?? []), d.text]));
  const makeDel = text => {
    const s = doc.createElement('span');
    s.className = PENDING_DELETED_CLASS;
    s.textContent = text;
    return s;
  };
  for (const { node, start } of collect()) {
    if (!node.data.length) continue;
    let anchor = node;
    if (inAdd(start)) {
      const span = doc.createElement('span');
      span.className = PENDING_CLASS;
      node.before(span);
      span.append(node);
      anchor = span;
    }
    (delAt.get(start) ?? []).forEach(t => anchor.before(makeDel(t)));
    delAt.delete(start);
  }
  (delAt.get(total) ?? []).forEach(t => holder.append(makeDel(t)));
}

// Changes a paragraph or heading into another kind of block, keeping its content.
function applyRestyle(doc, block, to) {
  const bold = to === 'p-bold';
  const tag = RESTYLE_TARGETS[to];
  const alreadyBold = block.children.length === 1 && block.firstElementChild.tagName === 'STRONG'
    && block.textContent.trim() === block.firstElementChild.textContent.trim();
  if (block.tagName === tag && (!bold || alreadyBold)) return false;
  const el = doc.createElement(tag.toLowerCase());
  el.className = PENDING_CLASS;
  const kids = [...block.childNodes];
  if (bold && !alreadyBold) {
    const strong = doc.createElement('strong');
    strong.append(...kids);
    el.append(strong);
  } else {
    el.append(...kids);
  }
  block.replaceWith(el);
  return true;
}

// Tag names in order: tells "same words, same formatting" apart from "same words, new formatting".
const tagSignature = el => [...el.querySelectorAll('*')].map(x => x.tagName).join(',');

/**
 * Applies block-ID edits to `html`.
 * @param {string} html
 * @param {Array} edits
 * @param {{allowedIds?: number[]|null}} [opts] block ids the edits may touch (null = anywhere)
 * @returns {{html: string, applied: number, rejected: {edit: object, reason: string}[], error?: string}}
 */
export function applyBlockEdits(html, edits, { allowedIds = null } = {}) {
  const { doc, root } = parseWrapped(html);
  const blocks = textBlocks(root);
  const allowed = Array.isArray(allowedIds) && allowedIds.length ? new Set(allowedIds) : null;
  const countTags = el => Object.fromEntries(COUNTED.map(t => [t, el.querySelectorAll(t).length]));
  const before = countTags(root);
  const added = Object.fromEntries(COUNTED.map(t => [t, 0]));

  const rejected = [];
  const touched = new Set();
  const lastAfter = new Map();
  let applied = 0;

  // Fragment of block elements → pending, inserted after `block` (several inserts after the same
  // block keep the order the AI gave them).
  const insertBlocks = (block, els) => {
    els.forEach(el => {
      el.querySelectorAll('[class]').forEach(x => x.classList.remove(PENDING_CLASS, PENDING_DELETED_CLASS));
      el.classList.add(PENDING_CLASS);
    });
    const first = els[0].tagName;
    let target;
    if (first === 'TR') {
      target = block.closest('tr');
      if (!target) return 'a table row can only be inserted next to text inside a table';
    } else if (first === 'LI') {
      target = block.closest('li');
      if (!target) return 'a list item can only be inserted next to text inside a list';
    } else {
      target = block.closest('table') ?? block.closest('ul, ol') ?? block;
    }
    const ref = lastAfter.get(target) ?? target;
    ref.after(...els);
    lastAfter.set(target, els[els.length - 1]);
    els.forEach(el => COUNTED.forEach(t => { added[t] += (el.tagName.toLowerCase() === t ? 1 : 0) + el.querySelectorAll(t).length; }));
    return null;
  };

  const fragmentOf = h => {
    const tpl = doc.createElement('template');
    tpl.innerHTML = h;
    stripUnsafe(tpl.content);
    return tpl.content;
  };

  for (const edit of Array.isArray(edits) ? edits : []) {
    const reject = reason => rejected.push({ edit, reason });
    const op = edit?.op;
    if (!['replace', 'delete', 'insert_after'].includes(op)) { reject('unknown edit type'); continue; }
    const id = Number(String(edit.id ?? '').replace(/^b/i, ''));
    const block = Number.isInteger(id) ? blocks[id] : null;
    if (!block) { reject(`there is no block numbered ${edit.id}`); continue; }
    if (allowed && !allowed.has(id)) { reject(`block ${id} is outside the part you asked to change`); continue; }

    if (op === 'insert_after') {
      const raw = String(edit.html ?? '').trim();
      if (!raw) { reject('nothing to insert'); continue; }
      const frag = fragmentOf(raw);
      let els = [...frag.children];
      if (!els.length || frag.textContent.trim() !== els.map(e => e.textContent).join('').trim()) {
        // bare text (or text mixed with elements): make it a paragraph
        const p = doc.createElement('p');
        p.append(frag);
        els = [p];
      }
      const problem = insertBlocks(block, els);
      if (problem) { reject(problem); continue; }
      applied++;
      continue;
    }

    if (touched.has(id)) { reject(`block ${id} was already changed by another edit in this batch`); continue; }
    touched.add(id);

    if (op === 'delete') {
      strikeOwnContent(doc, block);
      applied++;
      continue;
    }

    // replace
    const raw = String(edit.html ?? '').trim();
    const to = RESTYLE_TARGETS[edit.as] ? edit.as : '';
    if (!raw && !to) { reject('replace needs "html" (the new content of the block) or "as"'); continue; }
    let didSomething = false;
    let current = block;

    if (raw) {
      const frag = fragmentOf(raw);
      let kids = [...frag.children];
      // A single <p> wrapper is just the block's content.
      if (kids.length === 1 && kids[0].tagName === 'P' && frag.textContent.trim() === kids[0].textContent.trim()) {
        const inner = doc.createDocumentFragment();
        inner.append(...kids[0].childNodes);
        kids = [];
        frag.replaceChildren(inner);
      }
      const hasBlocks = kids.some(el => BLOCK_TAGS.has(el.tagName) || el.querySelector([...BLOCK_TAGS].join(',').toLowerCase()));
      if (hasBlocks) {
        if (block.closest('li, td, th')) { reject('one list item or table cell cannot be turned into several blocks; replace it with its new text, or use insert_after'); continue; }
        const problem = insertBlocks(block, kids);
        if (problem) { reject(problem); continue; }
        strikeOwnContent(doc, block);
        didSomething = true;
      } else {
        const holder = doc.createElement('div');
        holder.append(frag);
        cleanInline(holder);
        const inline = [...block.childNodes].filter(n => !isBlockChild(n));
        const oldHolder = doc.createElement('div');
        inline.forEach(n => oldHolder.append(n.cloneNode(true)));
        stripUnsafe(oldHolder);
        oldHolder.querySelectorAll(`.${PENDING_DELETED_CLASS}`).forEach(x => x.remove());
        const oldText = oldHolder.textContent;
        const newText = holder.textContent;
        if (oldText === newText && tagSignature(oldHolder) === tagSignature(holder)) {
          if (!to) { reject('the new content is identical to the old'); continue; }
        } else {
          markDiff(doc, holder, oldText, newText);
          const firstInline = inline[0];
          if (firstInline) firstInline.before(...holder.childNodes); else block.prepend(...holder.childNodes);
          inline.forEach(n => n.remove());
          didSomething = true;
        }
      }
    }

    if (to) {
      if (!/^(P|H[1-6])$/.test(current.tagName) || current.closest('li, td, th, blockquote')) {
        if (!didSomething) { reject('only an ordinary paragraph or heading can change style'); continue; }
      } else if (applyRestyle(doc, current, to)) {
        didSomething = true;
      }
    }
    if (didSomething) applied++; else reject('nothing would change');
  }

  // A table, row or cell can only be added by an insert; never lost or moved.
  const after = countTags(root);
  for (const t of COUNTED) {
    if (after[t] !== before[t] + added[t]) {
      return {
        html,
        applied: 0,
        rejected,
        error: `The edit was blocked because it would have changed the document structure (<${t}> count ${before[t]} to ${after[t]}). Nothing was changed.`,
      };
    }
  }
  return { html: root.innerHTML, applied, rejected };
}

/**
 * For the Create card: applies the AI's edits and reports what really happened.
 * Throws (code EDITS_REJECTED) when nothing could be applied, so the caller can retry once.
 * @returns {{html: string, applied: number, skipped: string[], warnings: string[]}}
 */
export function applyBlockEditResult(originalHtml, edits, allowedIds = null) {
  const r = applyBlockEdits(originalHtml, edits, { allowedIds });
  if (r.error) throw new Error(r.error);
  const reasons = r.rejected.map(x => x.reason);
  if (!r.applied) {
    const err = new Error(
      reasons.length
        ? `None of the AI's changes could be applied safely: ${reasons.slice(0, 3).join('; ')}. Try rephrasing, or highlight the passage.`
        : 'The AI did not suggest any changes.'
    );
    if (reasons.length) {
      err.code = 'EDITS_REJECTED';
      err.reasons = reasons.slice(0, 5).join('; ');
    }
    throw err;
  }
  return { html: r.html, applied: r.applied, skipped: reasons, warnings: [] };
}
