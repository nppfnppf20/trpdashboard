// Helpers for the Create card's "Import" dropdown: list what can be imported
// (saved documents, other deliverables, workspace drafts and their sections),
// pull a section's text out of a draft, and tidy imported HTML.

import { clearPendingMarkers } from './draftParagraphs.js';

/** Longest prompt sent to the AI as context for one import. Mirrors the backend cap. */
export const IMPORT_PROMPT_MAX_CHARS = 12000;
/** Per-section share when a whole draft is imported (each section has its own prompt). */
export const SECTION_PROMPT_IN_DRAFT_CHARS = 1000;

const hasText = html => !!html?.replace(/<[^>]+>/g, '').trim();

/**
 * Pulls one section's HTML out of a draft. Sections live in the draft as an
 * <h2> carrying the section's name followed by its content up to the next <h2>
 * (the same rule the workspace uses to patch a regenerated section back in).
 * Returns '' when the draft has no such section.
 */
export function extractSectionHtml(draftHtml, sectionName) {
  if (!draftHtml || !sectionName) return '';
  const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`<h2>[^<]*${escaped}[^<]*<\\/h2>[\\s\\S]*?(?=<h2>|$)`, 'i');
  const match = pattern.exec(draftHtml);
  return match ? cleanImportedHtml(match[0]) : '';
}

/**
 * Tidies HTML taken from elsewhere in the workspace: drops any pending-edit
 * markers, unwraps the "AI-generated" highlight blocks so the text doesn't
 * arrive shaded, and removes the empty wrappers a section cut can leave.
 */
export function cleanImportedHtml(html) {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(`<div>${clearPendingMarkers(html)}</div>`, 'text/html');
  const root = doc.body.firstChild;
  root.querySelectorAll('.llm-generated').forEach(el => el.replaceWith(...el.childNodes));
  root.querySelectorAll('div').forEach(el => {
    if (!el.textContent.trim() && !el.querySelector('img, table')) el.remove();
  });
  return root.innerHTML.trim();
}

/**
 * The options for the Import dropdown, grouped.
 * Option values: `deliv:<id>`, `draft:<typeId>`, `sect:<typeId>:<sectionId>`.
 * Drafts with no text, and sections not present in their draft, are left out.
 *
 * @param {object} p
 * @param {{id: string|number, name: string, tool?: string}[]} p.draftTypes
 * @param {Record<string, {content_html?: string}>} p.drafts - keyed by draft type id
 * @param {Record<string, {id: number, name: string}[]>} p.sectionsByType
 * @param {{id: number, deliverable_name: string, deliverable_type: string}[]} p.deliverables
 * @returns {{label: string, items: {value: string, label: string}[]}[]}
 */
export function buildImportGroups({ draftTypes = [], drafts = {}, sectionsByType = {}, deliverables = [] }) {
  const groups = [];

  const saved = deliverables.filter(d => d.deliverable_type === 'custom_document');
  if (saved.length) {
    groups.push({ label: 'Saved documents', items: saved.map(d => ({ value: `deliv:${d.id}`, label: d.deliverable_name })) });
  }
  const others = deliverables.filter(d => d.deliverable_type !== 'custom_document');
  if (others.length) {
    groups.push({ label: 'Other deliverables', items: others.map(d => ({ value: `deliv:${d.id}`, label: d.deliverable_name })) });
  }

  for (const type of draftTypes) {
    const draftHtml = drafts[type.id]?.content_html;
    if (!hasText(draftHtml)) continue;
    const items = [{ value: `draft:${type.id}`, label: 'Whole draft' }];
    for (const section of sectionsByType[type.id] ?? []) {
      if (hasText(extractSectionHtml(draftHtml, section.name))) {
        items.push({ value: `sect:${type.id}:${section.id}`, label: `Section: ${section.name}` });
      }
    }
    groups.push({ label: type.name, items });
  }

  return groups;
}

/** Joins the prompts of a draft's sections into one labelled block, capped per section. */
export function combineSectionPrompts(entries) {
  return entries
    .filter(e => e.prompt?.trim())
    .map(e => `### ${e.name}\n${e.prompt.trim().slice(0, SECTION_PROMPT_IN_DRAFT_CHARS)}`)
    .join('\n\n');
}
