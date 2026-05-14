import { writable, get } from 'svelte/store';
import {
  upsertIssueNote,
  updateKeyIssueSummary,
  getBriefingNotes,
  uploadBriefingNote,
  draftArgumentsFromBriefing,
  draftArgumentsFromIssueNotes,
  draftKeySummariesFromBriefing,
  evolveArgument
} from '$lib/api/appeal.js';

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

// ── Briefing notes ────────────────────────────────────────────────────────────

export const briefingNotes = writable([]);
export const selectedBriefingNoteId = writable(null);
export const briefingDropdownOpen = writable(false);

export const briefingUploadOpen = writable(false);
export const briefingUploadTab = writable('upload');
export const briefingUploadFile = writable(null);
export const briefingUploadText = writable('');
export const briefingUploadTitle = writable('');
export const briefingUploadLoading = writable(false);

export async function loadBriefingNotes(projectId) {
  try {
    const notes = await getBriefingNotes(projectId);
    briefingNotes.set(notes);
  } catch (err) {
    console.error('Failed to load briefing notes:', err);
  }
}

export function selectBriefingNote(id) {
  selectedBriefingNoteId.set(id);
  briefingDropdownOpen.set(false);
}

export function openBriefingUpload() {
  briefingDropdownOpen.set(false);
  briefingUploadFile.set(null);
  briefingUploadText.set('');
  briefingUploadTitle.set('');
  briefingUploadTab.set('upload');
  briefingUploadOpen.set(false);
  setTimeout(() => briefingUploadOpen.set(true), 10);
}

export async function submitBriefingUpload(projectId) {
  const file = get(briefingUploadFile);
  const text = get(briefingUploadText);
  const title = get(briefingUploadTitle);
  if (!file && !text.trim()) return;
  briefingUploadLoading.set(true);
  try {
    const newNote = await uploadBriefingNote(projectId, { file, text: text || undefined, title: title || undefined });
    briefingNotes.update(notes => [newNote, ...notes]);
    selectedBriefingNoteId.set(newNote.id);
    briefingUploadOpen.set(false);
    runDraftFromBriefing(projectId, newNote.id);
  } catch (err) {
    console.error('Failed to upload briefing note:', err);
    alert(err.message);
  } finally {
    briefingUploadLoading.set(false);
  }
}

// ── Draft arguments from briefing ─────────────────────────────────────────────

export const briefingDraftOpen = writable(false);
export const briefingDraftLoading = writable(false);
export const briefingDraftSuggestions = writable([]);
export const briefingDraftSkipped = writable(new Set());
export const briefingEvolveState = writable({});

export async function runDraftFromIssueSummaries(projectId) {
  briefingDraftLoading.set(true);
  briefingDraftOpen.set(true);
  briefingDraftSuggestions.set([]);
  briefingDraftSkipped.set(new Set());
  briefingEvolveState.set({});
  try {
    const { suggestions } = await draftArgumentsFromIssueNotes(projectId);
    briefingDraftSuggestions.set(suggestions);
  } catch (err) {
    console.error('Draft from issue notes failed:', err);
    alert(err.message);
    briefingDraftOpen.set(false);
  } finally {
    briefingDraftLoading.set(false);
  }
}

export async function runDraftFromBriefing(projectId, briefingNoteId = null) {
  briefingDraftLoading.set(true);
  briefingDraftOpen.set(true);
  briefingDraftSuggestions.set([]);
  briefingDraftSkipped.set(new Set());
  briefingEvolveState.set({});
  try {
    const { suggestions } = await draftArgumentsFromBriefing(projectId, briefingNoteId);
    briefingDraftSuggestions.set(suggestions);
  } catch (err) {
    console.error('Draft from briefing failed:', err);
    alert(err.message);
    briefingDraftOpen.set(false);
  } finally {
    briefingDraftLoading.set(false);
  }
}

export async function startEvolveArgument(projectId, trackId, newInformation) {
  briefingEvolveState.update(s => ({ ...s, [trackId]: { loading: true, evolved: null, conversation: [], input: '', applied: false } }));
  try {
    const { evolved } = await evolveArgument(projectId, { trackId, newInformation, conversation: [] });
    briefingEvolveState.update(s => ({ ...s, [trackId]: { ...s[trackId], loading: false, evolved } }));
  } catch (err) {
    console.error('evolveArgument failed:', err);
    alert(err.message);
    briefingEvolveState.update(s => { const n = { ...s }; delete n[trackId]; return n; });
  }
}

export async function sendEvolveRefinement(projectId, trackId, newInformation) {
  const state = get(briefingEvolveState)[trackId];
  if (!state?.input?.trim()) return;
  const userMsg = { role: 'user', content: state.input.trim() };
  const updatedConv = [...state.conversation, { role: 'assistant', content: state.evolved }, userMsg];
  briefingEvolveState.update(s => ({ ...s, [trackId]: { ...s[trackId], loading: true, input: '', conversation: updatedConv } }));
  try {
    const { evolved } = await evolveArgument(projectId, { trackId, newInformation, conversation: updatedConv });
    briefingEvolveState.update(s => ({ ...s, [trackId]: { ...s[trackId], loading: false, evolved, conversation: [...updatedConv, { role: 'assistant', content: evolved }] } }));
  } catch (err) {
    console.error('sendEvolveRefinement failed:', err);
    briefingEvolveState.update(s => ({ ...s, [trackId]: { ...s[trackId], loading: false } }));
  }
}

export function applyEvolvedArgument(trackId) {
  const state = get(briefingEvolveState)[trackId];
  if (!state?.evolved) return;
  replaceNote(trackId, 'argument_for', state.evolved);
  briefingEvolveState.update(s => ({ ...s, [trackId]: { ...s[trackId], applied: true } }));
}

export function skipBriefingDraftSuggestion(trackId) {
  briefingDraftSkipped.update(s => { const n = new Set(s); n.add(trackId); return n; });
}

export function closeBriefingDraft() {
  briefingDraftOpen.set(false);
  briefingEvolveState.set({});
}

// ── Draft key issue summaries from briefing ───────────────────────────────────

export const keyIssueDraftOpen = writable(false);
export const keyIssueDraftLoading = writable(false);
export const keyIssueDraftSuggestions = writable([]);
export const keyIssueDraftAccepted = writable(new Set());
export const keyIssueDraftSkipped = writable(new Set());
export const keyIssueDropdownOpen = writable(false);
export const keyIssueSelectedNoteId = writable(null);

export async function runKeyIssueDraftFromBriefing(projectId, briefingNoteId = null) {
  keyIssueDraftLoading.set(true);
  keyIssueDraftOpen.set(true);
  keyIssueDraftSuggestions.set([]);
  keyIssueDraftAccepted.set(new Set());
  keyIssueDraftSkipped.set(new Set());
  try {
    const { suggestions } = await draftKeySummariesFromBriefing(projectId, briefingNoteId);
    keyIssueDraftSuggestions.set(suggestions);
  } catch (err) {
    console.error('Draft key summaries from briefing failed:', err);
    alert(err.message);
    keyIssueDraftOpen.set(false);
  } finally {
    keyIssueDraftLoading.set(false);
  }
}

export async function acceptKeyIssueSummary(trackId, summary) {
  await updateKeyIssueSummary(trackId, summary);
  keyIssueDraftAccepted.update(s => { const n = new Set(s); n.add(trackId); return n; });
}

export function skipKeyIssueSummary(trackId) {
  keyIssueDraftSkipped.update(s => { const n = new Set(s); n.add(trackId); return n; });
}

export function closeKeyIssueDraft() {
  keyIssueDraftOpen.set(false);
}
