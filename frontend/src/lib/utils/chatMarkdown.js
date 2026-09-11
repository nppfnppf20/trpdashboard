// Shared reply renderer for project chat (full tab + Overview widget).
// Escapes HTML first, then converts citation markers ([D12] / [D12 §4.2]),
// #-headings, **bold**, and */- bullets into real tags; \n becomes <br>.

export function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildSourceLabels(groups) {
  const map = { P: 'Project Details', K: 'Key Issues', C: 'Consultation', COND: 'Conditions', IT: 'Project Tracker', A: 'Actions', H: 'Planning History', POL: 'Relevant Policies', PD: 'Policy Documents', PC: 'Public Comments', S: 'Surveyor Management' };
  for (const d of groups.find(g => g.key === 'documents')?.items ?? []) map[`D${d.id}`] = d.label;
  for (const m of groups.find(g => g.key === 'meetings')?.items ?? []) map[`M${m.id}`] = m.label;
  return map;
}

// Cross-project chat qualifies every source ID with its owning project
// (e.g. "57:COND" instead of just "COND") so two projects' conditions
// trackers don't collide — this builds that prefixed label map. `projects`
// is [{ id, project_name, groups }], one entry per project in scope.
export function buildMultiProjectSourceLabels(projects) {
  const map = {};
  for (const p of projects) {
    const perProject = buildSourceLabels(p.groups);
    for (const [id, label] of Object.entries(perProject)) {
      map[`${p.id}:${id}`] = `${label} (${p.project_name})`;
    }
  }
  return map;
}

// A citation token is a source abbreviation (D12, COND, P, ...), optionally
// prefixed with "<projectId>:" for cross-project chat's qualified IDs.
const CITATION_TOKEN = '(?:\\d+:)?(?:D\\d+|M\\d+|COND|IT|POL|PD|PC|P|C|K|A|H|S)';

// Same citation markers renderReply() turns into chips, removed outright —
// for copying a reply as plain text without the [D12]/[COND]/etc. clutter.
export function stripCitations(text) {
  return text
    .replace(new RegExp(`\\s*\\[${CITATION_TOKEN}(?:\\s*[§·][^\\]]*)?\\]`, 'g'), '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([.,;:!?])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function renderReply(text, sourceLabels = {}) {
  const escaped = escapeHtml(text);
  return escaped
    .replace(new RegExp(`\\[(${CITATION_TOKEN}(?:\\s*[§·][^\\]]*)?)\\]`, 'g'), (match, inner) => {
      const id = inner.split(/[\s§·]/)[0];
      const label = sourceLabels[id];
      const title = label ? ` title="${escapeHtml(label)}"` : '';
      return `<span class="cite-chip"${title}>${inner}</span>`;
    })
    .replace(/^#{1,4}\s+(.+)$/gm, '<strong>$1</strong>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/^(\s*)[-*]\s+/gm, '$1• ')
    .replace(/\n/g, '<br>');
}
