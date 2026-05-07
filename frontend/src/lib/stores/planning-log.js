import { writable, get } from 'svelte/store';
import { createDocumentLogEntry, createArgumentPoint, getArgumentPoints } from '$lib/api/planningApplication.js';
import { analysisChunks, initArgumentPoints } from '$lib/stores/planning-analysis.js';

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
  logPoints.set(acceptedPoints.map((p, i) => ({
    id: i,
    ...p,
    text: p.headline ?? p.point,
    headline: p.headline ?? p.point,
    detailed_summary: p.detailed_summary ?? null,
    citation: p.citation ?? null,
    relevant_chunk_indices: p.relevant_chunk_indices ?? []
  })));
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
      })),
      chunks: get(analysisChunks)
    });
    documentLog.update(log => [entry, ...log]);

    // Create structured argument points now that we have the document_log_id.
    // Fire-and-forget — failures don't block the log save.
    const points = get(logPoints).filter(p => p.track_id !== null && p.track_id !== undefined);
    for (const p of points) {
      createArgumentPoint(projectId, {
        track_id: p.track_id,
        document_log_id: entry.id,
        field: p.field,
        headline: p.headline ?? p.text,
        detailed_summary: p.detailed_summary ?? null,
        citation: p.citation ?? null,
        relevant_chunk_indices: p.relevant_chunk_indices ?? []
      }).catch(err => console.warn('Failed to create argument point:', err));
    }

    logModalOpen.set(false);

    // Refresh argument points store so the Argument Structure panel shows new citations
    getArgumentPoints(projectId).then(initArgumentPoints).catch(() => {});
  } catch (err) {
    console.error('Failed to save log entry:', err);
  } finally {
    logSaving.set(false);
  }
}
