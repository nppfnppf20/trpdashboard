// @ts-nocheck
import { authFetch } from './client.js';

async function json(res, fallback) {
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || fallback);
  }
  return res.json();
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// Every project's stages for the global table: [{ project_id, applicable, stages: { <key>: status } }] (a missing key means not started)
export async function getPlanningStagesOverview() {
  return json(await authFetch('/api/planning-stages/overview'), 'Failed to load the planning stages');
}

// The three below resolve with the whole state: { applicable, stages: [{ key, status, changed_at }] } (seven stages, in order)
export async function getPlanningStages(projectId) {
  return json(await authFetch(`/api/planning-stages/projects/${projectId}`), 'Failed to load the planning stages');
}

// status: 'not_started' | 'in_progress' | 'complete' | 'na'
export async function setPlanningStage(projectId, key, status) {
  return json(await authFetch(`/api/planning-stages/projects/${projectId}/stages/${key}`, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ status }) }), 'Failed to save the stage');
}

// Completes this stage and starts the next one that is still not started (N/A stages are skipped)
export async function completeStageAndStartNext(projectId, key) {
  return json(await authFetch(`/api/planning-stages/projects/${projectId}/stages/${key}/complete-and-next`, { method: 'POST' }), 'Failed to move to the next stage');
}

// false hides the whole strip for the project; stage statuses are kept
export async function setPlanningStagesApplicable(projectId, applicable) {
  return json(await authFetch(`/api/planning-stages/projects/${projectId}/applicable`, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ applicable }) }), 'Failed to save');
}
