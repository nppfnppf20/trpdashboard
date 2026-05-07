import { writable, get } from 'svelte/store';
import { createDocumentLogEntry } from '$lib/api/planningApplication.js';

export const documentLog = writable([]);
export const logModalOpen = writable(false);
export const logTitle = writable('');
export const logCode = writable('');
export const logSummary = writable('');
export const logPoints = writable([]);
export const logSaving = writable(false);

export function initLog(initialLog = []) {
  documentLog.set(initialLog);
}

export function openLogModal(analysisSummary, acceptedPoints) {
  logTitle.set('');
  logCode.set('');
  logSummary.set(analysisSummary);
  logPoints.set(acceptedPoints.map((p, i) => ({ id: i, ...p, text: p.point })));
  logModalOpen.set(true);
}

export function removeLogPoint(id) {
  logPoints.update(pts => pts.filter(p => p.id !== id));
}

export async function saveLogEntry(projectId) {
  if (!get(logTitle).trim()) return;
  logSaving.set(true);
  try {
    const entry = await createDocumentLogEntry(projectId, {
      title: get(logTitle),
      code: get(logCode),
      document_summary: get(logSummary),
      argument_points: get(logPoints).map(p => ({
        track_id: p.track_id,
        issue_label: p.issue_label,
        field: p.field,
        point: p.text
      }))
    });
    documentLog.update(log => [entry, ...log]);
    logModalOpen.set(false);
  } catch (err) {
    console.error('Failed to save log entry:', err);
  } finally {
    logSaving.set(false);
  }
}
