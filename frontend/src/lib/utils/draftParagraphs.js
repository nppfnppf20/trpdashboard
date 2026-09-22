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
// Marker class for text the edit removed — kept visible (struck through, see
// trpformatting.css) rather than silently dropped, so the reviewer can see
// both sides of the change before Accepting. Accept removes these elements
// outright (see clearPendingMarkers); Edit Again/Cancel discard the whole
// pending version and revert to originalHtml, so they never need cleaning up.
export const PENDING_DELETED_CLASS = 'quick-ai-edit-pending-deleted';

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
// Shows both sides of the change inline: added words wrapped in the pending
// marker, removed words kept but struck through (see PENDING_DELETED_CLASS)
// rather than silently dropped — unlike the full before/after diff view
// elsewhere, this is a live preview of the one paragraph, so there's no
// separate "old" version shown alongside it.
export function markChangedWordsPending(oldHtml, newHtml) {
  const tagMatch = newHtml?.match(/^<(\w+)[^>]*>/) ?? oldHtml?.match(/^<(\w+)[^>]*>/);
  const tag = tagMatch ? tagMatch[1] : 'p';
  const parts = diffWords(stripHtml(oldHtml), stripHtml(newHtml));
  const inner = parts
    .map(part => {
      if (part.added) return `<span class="${PENDING_CLASS}">${escapeHtml(part.value)}</span>`;
      if (part.removed) return `<span class="${PENDING_DELETED_CLASS}">${escapeHtml(part.value)}</span>`;
      return escapeHtml(part.value);
    })
    .join('');
  return `<${tag}>${inner}</${tag}>`;
}

// Strips the pending marker from every element carrying it in `html` (used on
// Accept — only one quick-edit is pending review at a time, so this always
// targets exactly the paragraphs that edit touched). Struck-through deleted
// text is removed outright here rather than unwrapped, since accepting means
// finalising to the new version — the old wording shouldn't survive into the
// saved document.
export function clearPendingMarkers(html) {
  if (!html?.includes(PENDING_CLASS) && !html?.includes(PENDING_DELETED_CLASS)) return html;
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstChild;
  root.querySelectorAll(`.${PENDING_DELETED_CLASS}`).forEach(el => el.remove());
  root.querySelectorAll(`.${PENDING_CLASS}`).forEach(el => el.classList.remove(PENDING_CLASS));
  return root.innerHTML;
}

// Square-bracket text (e.g. "[insert site address]", "[INCONSISTENCY TO BE
// RESOLVED: ...]") is this app's convention for a placeholder the consultant
// still needs to fill in or resolve — wrap each one in a span so it's
// visually flagged in the editor. The class is picked up by the Word export's
// inlineRuns() as a highlighter-pen highlight, so it survives into the
// exported .docx too, not just the on-screen editor.
export const PLACEHOLDER_CLASS = 'draft-placeholder';

export function highlightPlaceholders(html) {
  if (!html?.includes('[')) return html;
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstChild;
  if (!root) return html;

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) {
    // Skip text already inside a placeholder span — setHTML runs this on
    // every AI-edit accept/cancel, so without this a repeat pass would nest
    // a fresh span inside the previous one each time.
    if (node.parentElement?.closest(`.${PLACEHOLDER_CLASS}`)) continue;
    if (/\[[^\]]+\]/.test(node.textContent)) textNodes.push(node);
  }

  for (const textNode of textNodes) {
    const parts = textNode.textContent.split(/(\[[^\]]+\])/g);
    if (parts.length <= 1) continue;
    const frag = doc.createDocumentFragment();
    for (const part of parts) {
      if (!part) continue;
      if (/^\[[^\]]+\]$/.test(part)) {
        const span = doc.createElement('span');
        span.className = PLACEHOLDER_CLASS;
        span.textContent = part;
        frag.appendChild(span);
      } else {
        frag.appendChild(doc.createTextNode(part));
      }
    }
    textNode.parentNode.replaceChild(frag, textNode);
  }
  return root.innerHTML;
}
