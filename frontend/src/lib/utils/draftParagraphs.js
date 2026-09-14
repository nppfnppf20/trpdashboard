// Shared helpers for treating a draft's HTML as an ordered list of top-level
// blocks (p, h2, h3, li, ...), each addressable by a stable `p{idx}` id. This
// is the same scheme PlanningDocIncorporatePanel.svelte's own splitAllParagraphs
// uses — kept here too so the quick highlight-driven edit flow in
// PlanningWorkspace.svelte can target/replace exact blocks without needing
// that whole component.

import { diffWords } from 'diff';

export function splitAllParagraphs(html) {
  if (!html?.trim()) return [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstChild;
  if (!root) return [];
  const blocks = [];
  let idx = 0;
  root.childNodes.forEach(node => {
    if (node.nodeType !== 1) return;
    const text = node.textContent.trim();
    if (text) blocks.push({ id: `p${idx++}`, html: node.outerHTML, text });
  });
  return blocks;
}

// Splices `updates` (from an incorporate-targeted API response: [{id, html}],
// with ids like "INSERT_AFTER_p3" supported) into `allParagraphs`, returning
// the full joined HTML string.
export function mergeParagraphUpdates(allParagraphs, updates) {
  const updatedMap = {};
  const insertionsAfter = {};
  for (const p of updates ?? []) {
    if (p.id.startsWith('INSERT_AFTER_')) {
      const anchorId = p.id.replace('INSERT_AFTER_', '');
      if (!insertionsAfter[anchorId]) insertionsAfter[anchorId] = [];
      insertionsAfter[anchorId].push(p.html);
    } else {
      updatedMap[p.id] = p.html;
    }
  }

  const parts = [];
  for (const p of allParagraphs) {
    parts.push(updatedMap[p.id] ?? p.html);
    if (insertionsAfter[p.id]) parts.push(...insertionsAfter[p.id]);
  }
  return parts.join('\n');
}

// Marker class for a paragraph that's been rewritten by the quick highlight
// AI-edit flow but not yet Accepted. Deliberately its own class rather than
// reusing .llm-generated (used elsewhere for whole-section regeneration, with
// its own separate lifecycle) — Accept/Edit Again only ever need to touch
// markers this flow itself created.
export const PENDING_CLASS = 'quick-ai-edit-pending';

// Tags a single paragraph/insertion fragment's root element as pending. Apply
// this to each `{id, html}` entry from an incorporate-targeted API response
// BEFORE merging — tagging after merge would need to re-derive ids by
// position, which breaks as soon as an INSERT_AFTER_ shifts the numbering.
export function markFragmentPending(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const el = doc.body.firstElementChild;
  if (!el) return html;
  el.classList.add(PENDING_CLASS);
  return el.outerHTML;
}

function stripHtml(html) {
  return (html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Same stripHtml+diffWords approach PlanningDocIncorporatePanel.svelte's own
// review diff already uses (inline formatting like bold/italic within the
// diffed text is lost — an accepted, pre-existing trade-off there too).
// Renders only the NEW text, with just the changed/added words wrapped in the
// pending marker — unlike the full before/after diff view elsewhere, this is
// a live preview of the one paragraph, so there's no separate "old" to show.
export function markChangedWordsPending(oldHtml, newHtml) {
  const tagMatch = newHtml?.match(/^<(\w+)[^>]*>/) ?? oldHtml?.match(/^<(\w+)[^>]*>/);
  const tag = tagMatch ? tagMatch[1] : 'p';
  const parts = diffWords(stripHtml(oldHtml), stripHtml(newHtml));
  const inner = parts
    .filter(part => !part.removed)
    .map(part => part.added ? `<span class="${PENDING_CLASS}">${escapeHtml(part.value)}</span>` : escapeHtml(part.value))
    .join('');
  return `<${tag}>${inner}</${tag}>`;
}

// Strips the pending marker from every element carrying it in `html` (used on
// Accept — only one quick-edit is pending review at a time, so this always
// targets exactly the paragraphs that edit touched).
export function clearPendingMarkers(html) {
  if (!html?.includes(PENDING_CLASS)) return html;
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstChild;
  root.querySelectorAll(`.${PENDING_CLASS}`).forEach(el => el.classList.remove(PENDING_CLASS));
  return root.innerHTML;
}
