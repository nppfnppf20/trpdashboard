import { writable, get } from 'svelte/store';
import { upsertIssueNote } from '$lib/api/appeal.js';

// ── Issue notes ───────────────────────────────────────────────────────────────

export const issueNotes = writable({});
export const noteStatus = writable({});

let _projectId;
const _saveTimers = {};

export function initNotes(projectId, initialNotes = {}) {
  _projectId = projectId;
  issueNotes.set(initialNotes);
  noteStatus.set({});
}

export function handleNoteInput(trackId, field, value) {
  issueNotes.update(n => ({
    ...n,
    [trackId]: { ...(n[trackId] ?? {}), [field]: value }
  }));
  if (_saveTimers[trackId]) clearTimeout(_saveTimers[trackId]);
  _saveTimers[trackId] = setTimeout(() => saveNote(trackId), 1500);
}

export function appendToNote(trackId, field, appendText) {
  issueNotes.update(n => {
    const current = n[trackId]?.[field] ?? '';
    const updated = current ? `${current}\n\n${appendText}` : appendText;
    return { ...n, [trackId]: { ...(n[trackId] ?? {}), [field]: updated } };
  });
  saveNote(trackId);
}

export function replaceNote(trackId, field, text) {
  issueNotes.update(n => ({ ...n, [trackId]: { ...(n[trackId] ?? {}), [field]: text } }));
  saveNote(trackId);
}

export async function saveNote(trackId) {
  noteStatus.update(s => ({ ...s, [trackId]: 'saving' }));
  try {
    const n = get(issueNotes)[trackId] ?? {};
    await upsertIssueNote(_projectId, trackId, n.argument_against ?? null, n.argument_for ?? null);
    noteStatus.update(s => ({ ...s, [trackId]: 'saved' }));
    setTimeout(() => noteStatus.update(s => ({ ...s, [trackId]: null })), 2000);
  } catch (err) {
    console.error('Failed to save note:', err);
    noteStatus.update(s => ({ ...s, [trackId]: null }));
  }
}
