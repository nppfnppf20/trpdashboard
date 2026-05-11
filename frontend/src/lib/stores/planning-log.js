import { writable, get } from 'svelte/store';
import { createDocumentLogEntry, updateDocumentLogEntry, deleteDocumentLogEntry, createArgumentPoint, getArgumentPoints } from '$lib/api/planningApplication.js';
import { analysisChunks, initArgumentPoints } from '$lib/stores/planning-analysis.js';
import { issueNotes, handleNoteInput } from '$lib/stores/planning-notes.js';

export const documentLog = writable([]);
export const logModalOpen = writable(false);
export const logTitle = writable('');
export const logCode = writable('');
export const logItemType = writable('document');
export const logPreparedBy = writable('');
export const logSummary = writable('');
export const logPoints = writable([]);
export const logSaving = writable(false);

// Edit modal state
export const editModalOpen = writable(false);
export const editEntryId = writable(null);
export const editTitle = writable('');
export const editCode = writable('');
export const editItemType = writable('document');
export const editPreparedBy = writable('');
export const editSummary = writable('');
export const editPoints = writable([]);
export const editSaving = writable(false);

export function initLog(initialLog = []) {
  documentLog.set(initialLog);
}

export function openLogModal(analysisSummary, acceptedPoints) {
  logTitle.set('');
  logCode.set('');
  logItemType.set('document');
  logPreparedBy.set('');
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
  editItemType.set(entry.item_type ?? 'document');
  editPreparedBy.set(entry.prepared_by ?? '');
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
      item_type: get(editItemType),
      prepared_by: get(editPreparedBy),
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
      item_type: get(logItemType),
      prepared_by: get(logPreparedBy),
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

    // Backfill document title into the argument_for notes we already appended
    const notes = get(issueNotes);
    for (const p of get(logPoints)) {
      if (p.track_id == null) continue;
      const paraRef = p.citation?.para_ref;
      const oldLine = `${p.headline}${paraRef ? ` (${paraRef})` : ''}`;
      const newLine = `${p.headline}${paraRef ? ` (${paraRef} — ${entry.title})` : ` (${entry.title})`}`;
      const current = get(issueNotes)[p.track_id]?.argument_for ?? '';
      if (current.includes(oldLine)) {
        handleNoteInput(p.track_id, 'argument_for', current.replace(oldLine, newLine));
      }
    }

    logModalOpen.set(false);

    // Refresh argument points store so the Argument Structure panel shows new evidence
    getArgumentPoints(projectId).then(initArgumentPoints).catch(() => {});
  } catch (err) {
    console.error('Failed to save log entry:', err);
  } finally {
    logSaving.set(false);
  }
}
