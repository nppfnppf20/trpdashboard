import { writable, get } from 'svelte/store';
import { createDocumentLogEntry, updateDocumentLogEntry, deleteDocumentLogEntry, createArgumentPoint } from '$lib/api/appeal.js';

export const documentLog = writable([]);
export const logModalOpen = writable(false);
export const logTitle = writable('');
export const logCode = writable('');
export const logSummary = writable('');
export const logPoints = writable([]);
export const logSaving = writable(false);

// Edit modal state
export const editModalOpen = writable(false);
export const editEntryId = writable(null);
export const editTitle = writable('');
export const editCode = writable('');
export const editSummary = writable('');
export const editPoints = writable([]);
export const editSaving = writable(false);

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

export function openEditModal(entry) {
  editEntryId.set(entry.id);
  editTitle.set(entry.title);
  editCode.set(entry.code ?? '');
  editSummary.set(entry.document_summary ?? '');
  editPoints.set((entry.argument_points ?? []).map((p, i) => ({ ...p, id: i })));
  editModalOpen.set(true);
}

export function removeEditPoint(id) {
  editPoints.update(pts => pts.filter(p => p.id !== id));
}

export async function saveEditEntry() {
  const id = get(editEntryId);
  if (!id || !get(editTitle).trim()) return;
  editSaving.set(true);
  try {
    const updated = await updateDocumentLogEntry(id, {
      title: get(editTitle),
      code: get(editCode),
      document_summary: get(editSummary),
      argument_points: get(editPoints).map(({ id: _id, ...p }) => p)
    });
    documentLog.update(log => log.map(e => e.id === id ? updated : e));
    editModalOpen.set(false);
  } catch (err) {
    console.error('Failed to update log entry:', err);
  } finally {
    editSaving.set(false);
  }
}

export async function deleteEntry(entryId) {
  try {
    await deleteDocumentLogEntry(entryId);
    documentLog.update(log => log.filter(e => e.id !== entryId));
  } catch (err) {
    console.error('Failed to delete log entry:', err);
  }
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

    // Save structured argument points so detailed_summary is persisted and queryable.
    // Fire-and-forget — failures don't block the log save.
    const points = get(logPoints).filter(p => p.track_id != null);
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
  } catch (err) {
    console.error('Failed to save log entry:', err);
  } finally {
    logSaving.set(false);
  }
}
