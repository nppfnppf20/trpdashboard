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

// Fresh editable rows from the LLM's suggestedActions.
export function toEditableActions(suggestedActions) {
  return (suggestedActions || []).map((a, i) => ({
    _key: i,
    action_text: a.action_text || '',
    owner: a.owner || '',
    due_date: a.due_date ? a.due_date.split('T')[0] : '',
    notes: a.notes || ''
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
