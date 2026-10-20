// Meeting actions live in two places: as editable rows in the review modal, and
// as bullet lists inside the summary HTML (so exported summaries carry them).
// The rows are the source of truth — when they've been edited, the summary's
// blocks are regenerated from them. Three blocks:
//   Actions                    — new actions from this meeting
//   Completed since last meeting — existing open actions closed in this meeting
//   Action updates             — progress on existing open actions

import { escapeHtml } from '$lib/utils/chatMarkdown.js';

function isoToDisplay(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('T')[0].split('-');
  return d ? `${d}/${m}/${y}` : iso;
}

function list(heading, items) {
  return items.length ? `<h3>${heading}</h3><ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>` : '';
}

export function buildActionsHtml(actions) {
  const items = (actions || []).filter(a => a.action_text?.trim()).map(a => {
    const bits = [];
    if (a.owner?.trim()) bits.push(`Owner: ${escapeHtml(a.owner.trim())}`);
    if (a.due_date) bits.push(`Due: ${escapeHtml(isoToDisplay(a.due_date))}`);
    const meta = bits.length ? ` (${bits.join(', ')})` : '';
    return `${escapeHtml(a.action_text.trim())}${meta}`;
  });
  return list('Actions', items);
}

export function buildCompletedHtml(updates) {
  const items = (updates || []).filter(u => u.status === 'complete').map(u => {
    const note = u.update_text?.trim() ? ` — ${escapeHtml(u.update_text.trim())}` : '';
    return `${escapeHtml(u.action_text)} ✓${note}`;
  });
  return list('Completed since last meeting', items);
}

export function buildUpdatesHtml(updates) {
  const items = (updates || []).filter(u => u.status === 'progress' && u.update_text?.trim())
    .map(u => `${escapeHtml(u.action_text)}: ${escapeHtml(u.update_text.trim())}`);
  return list('Action updates', items);
}

export function buildReviewBlocksHtml(actions, updates) {
  return buildActionsHtml(actions) + buildCompletedHtml(updates) + buildUpdatesHtml(updates);
}

const blockRegex = heading =>
  new RegExp(`<h3[^>]*>\\s*${heading}\\s*<\\/h3>\\s*<ul[^>]*>[\\s\\S]*?<\\/ul>`, 'i');

function swapBlock(html, heading, block) {
  const re = blockRegex(heading);
  if (re.test(html)) return html.replace(re, () => block);
  return block ? html + block : html;
}

// Swap each block in the summary for one built from the current rows. A block
// is appended if the summary has none, and removed if its rows are all gone.
export function syncReviewIntoSummary(summaryHtml, actions, updates) {
  let html = summaryHtml || '';
  html = swapBlock(html, 'Actions', buildActionsHtml(actions));
  html = swapBlock(html, 'Completed since last meeting', buildCompletedHtml(updates));
  html = swapBlock(html, 'Action updates', buildUpdatesHtml(updates));
  return html;
}

// ── Owners ─────────────────────────────────────────────────────────────────
// An editable action row carries `owner_sel` = { users: [{ id, name }], external }
// (set by OwnerPicker) and `owner`, the display string derived from it.

export function composeOwnerDisplay(selection, totalUsers = 0) {
  const users = selection?.users || [];
  const parts = [];
  if (totalUsers > 0 && users.length === totalUsers) parts.push('All TRP');
  else parts.push(...users.map(u => u.name));
  const external = (selection?.external || '').trim();
  if (external) parts.push(external);
  return parts.join(', ');
}

// Turn a free-text owner (e.g. the name the AI heard) into a selection: an exact
// display-name match, or a first name that matches exactly one user, becomes
// that user; anything else is kept as an external name.
export function selectionFromText(text, users = []) {
  const t = (text || '').trim();
  if (!t) return { users: [], external: '' };
  const lower = t.toLowerCase();
  const exact = users.find(u => (u.display_name || '').toLowerCase() === lower);
  if (exact) return { users: [{ id: exact.id, name: exact.display_name }], external: '' };
  const firstNameMatches = users.filter(u => (u.display_name || '').trim().split(/\s+/)[0].toLowerCase() === lower);
  if (firstNameMatches.length === 1) {
    const u = firstNameMatches[0];
    return { users: [{ id: u.id, name: u.display_name }], external: '' };
  }
  return { users: [], external: t };
}

// One saved action per person: each picked TRP user gets their own action
// (linked to their account), and an external name gets one more with no
// account. Rows without a picker selection pass through unchanged.
export function expandActionOwners(actions) {
  const out = [];
  for (const a of actions || []) {
    const { owner_sel: sel, source_quote, source_start, ...rest } = a;
    const people = sel?.users || [];
    const external = (sel?.external || '').trim();
    if (!sel || (people.length === 0 && !external)) {
      out.push(rest);
      continue;
    }
    for (const u of people) out.push({ ...rest, owner: u.name, assigned_user_id: u.id });
    if (external) out.push({ ...rest, owner: external, assigned_user_id: null });
  }
  return out;
}

// The transcript around an action's source quote: the quote's own lines plus
// `around` lines either side, split so the quote can be highlighted. Very long
// lines (pasted text with few line breaks) are capped to a window around the quote.
export function sourceContext(text, start, quote, around = 5, maxChars = 2500) {
  if (!text || start == null || !quote || text.slice(start, start + quote.length) !== quote) return null;
  const end = start + quote.length;

  let from = start > 0 ? text.lastIndexOf('\n', start - 1) + 1 : 0;
  for (let i = 0; i < around && from > 0; i++) {
    from = from >= 2 ? text.lastIndexOf('\n', from - 2) + 1 : 0;
  }
  let to = text.indexOf('\n', end);
  if (to === -1) to = text.length;
  for (let i = 0; i < around && to < text.length; i++) {
    const next = text.indexOf('\n', to + 1);
    to = next === -1 ? text.length : next;
  }

  if (to - from > maxChars) {
    const pad = Math.max(200, Math.floor((maxChars - quote.length) / 2));
    from = Math.max(from, start - pad);
    to = Math.min(to, end + pad);
  }
  return {
    before: text.slice(from, start),
    match: quote,
    after: text.slice(end, to),
    cutBefore: from > 0,
    cutAfter: to < text.length
  };
}

// Fresh editable rows from the LLM's suggestedActions.
export function toEditableActions(suggestedActions) {
  return (suggestedActions || []).map((a, i) => ({
    _key: i,
    action_text: a.action_text || '',
    owner: a.owner || '',
    due_date: a.due_date ? a.due_date.split('T')[0] : '',
    notes: a.notes || '',
    source_quote: a.source_quote || null,
    source_start: a.source_start ?? null
  }));
}

// Editable rows for open actions the LLM says this meeting spoke to.
// status: 'complete' | 'progress' | 'none'
export function toEditableUpdates(actionUpdates) {
  return (actionUpdates || []).map(u => ({
    _key: u.id,
    action_id: u.id,
    action_text: u.action_text,
    owner: u.owner || '',
    status: u.status === 'complete' ? 'complete' : 'progress',
    update_text: u.update || '',
    evidence: u.evidence || ''
  }));
}
