import { writable, get } from 'svelte/store';
import { upsertIssueNote, draftArgumentsFromBriefing } from '$lib/api/planningApplication.js';

// ── Draft arguments from briefing ────────────────────────────────────────────

export const briefingDraftOpen = writable(false);
export const briefingDraftLoading = writable(false);
export const briefingDraftSuggestions = writable([]); // [{ track_id, label, argument_for }]
export const briefingDraftAccepted = writable(new Set());
export const briefingDraftSkipped = writable(new Set());

let _briefingProjectId;

export async function runDraftFromBriefing(projectId) {
  _briefingProjectId = projectId;
  briefingDraftLoading.set(true);
  briefingDraftOpen.set(true);
  briefingDraftSuggestions.set([]);
  briefingDraftAccepted.set(new Set());
  briefingDraftSkipped.set(new Set());
  try {
    const { suggestions } = await draftArgumentsFromBriefing(projectId);
    briefingDraftSuggestions.set(suggestions);
  } catch (err) {
    console.error('Draft from briefing failed:', err);
    alert(err.message);
    briefingDraftOpen.set(false);
  } finally {
    briefingDraftLoading.set(false);
  }
}

export function acceptBriefingDraftSuggestion(trackId, argumentFor) {
  appendToNote(trackId, 'argument_for', argumentFor);
  briefingDraftAccepted.update(s => { const n = new Set(s); n.add(trackId); return n; });
}

export function skipBriefingDraftSuggestion(trackId) {
  briefingDraftSkipped.update(s => { const n = new Set(s); n.add(trackId); return n; });
}

export function closeBriefingDraft() {
  briefingDraftOpen.set(false);
}

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

export async function saveNote(trackId) {
  noteStatus.update(s => ({ ...s, [trackId]: 'saving' }));
  try {
    const n = get(issueNotes)[trackId] ?? {};
    await upsertIssueNote(_projectId, trackId, {
      argument_against:      n.argument_against      ?? null,
      argument_for:          n.argument_for          ?? null,
      policy_national:       n.policy_national       ?? null,
      policy_local:          n.policy_local          ?? null,
      policy_neighbourhood:  n.policy_neighbourhood  ?? null,
      policy_supplementary:  n.policy_supplementary  ?? null,
      policy_other:          n.policy_other          ?? null,
    });
    noteStatus.update(s => ({ ...s, [trackId]: 'saved' }));
    setTimeout(() => noteStatus.update(s => ({ ...s, [trackId]: null })), 2000);
  } catch (err) {
    console.error('Failed to save note:', err);
    noteStatus.update(s => ({ ...s, [trackId]: null }));
  }
}
