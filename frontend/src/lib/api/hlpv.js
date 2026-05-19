/**
 * HLPV API
 * Client-side API calls for the High-Level Planning View tool.
 */

import { authFetch } from '$lib/api/client.js';

const PLANNING_BASE = '/api/planning-application';
const HLPV_BASE = '/api/hlpv';

/**
 * Fetch briefing notes for a project (reuses the planning application endpoint).
 * @param {string|number} projectId
 */
export async function getBriefingNotes(projectId) {
  const res = await authFetch(`${PLANNING_BASE}/projects/${projectId}/briefing-notes`);
  if (!res.ok) throw new Error('Failed to fetch briefing notes');
  return res.json();
}

/**
 * Generate HLPV narrative text for the given disciplines via LLM.
 *
 * @param {string|number|null} projectId   — used to fetch briefing note context
 * @param {Array}              disciplines — discipline objects with triggeredRules
 * @param {number|null}        briefingNoteId
 */
export async function generateHlpvNarrative(projectId, disciplines, briefingNoteId = null, developmentType = null) {
  // Strip to only the fields the backend prompt builder actually uses — full
  // discipline objects include large report cards and geometry that bloat the payload.
  const trimmed = disciplines.map(d => ({
    name: d.name,
    overallRisk: d.overallRisk,
    triggeredRules: (d.triggeredRules ?? []).map(r => ({
      rule: r.rule,
      level: r.level,
      findings: r.findings
    })),
    designationDetails: d.designationDetails ?? null,
    disciplineRecommendation: d.disciplineRecommendation ?? null
  }));

  const res = await authFetch(`${HLPV_BASE}/generate-narrative`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, disciplines: trimmed, briefingNoteId, developmentType })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
