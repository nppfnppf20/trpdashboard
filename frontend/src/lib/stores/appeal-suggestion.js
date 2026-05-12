import { writable, get } from 'svelte/store';
import { suggestArgument, getSuggestTemplate, saveSuggestTemplate, deleteSuggestTemplate } from '$lib/api/appeal.js';
import { appendToNote } from '$lib/stores/appeal-notes.js';
import { openLogModal } from '$lib/stores/appeal-log.js';

// Form state
export const suggestInputTab      = writable('upload');
export const suggestFile          = writable(null);
export const suggestPasteText     = writable('');
export const suggestDocumentType  = writable('Officer Report');
export const suggestDocumentTitle = writable('');
export const suggestDirection     = writable('against');
export const suggestUserNotes     = writable('');
export const suggestTrackIds      = writable([]);

// Chat state
export const suggestState   = writable('idle'); // 'idle' | 'loading' | 'chat'
export const conversation   = writable([]);     // [{ role: 'user'|'assistant', content }]
export const suggestError   = writable(null);
export const refinementInput = writable('');
export const refinementLoading = writable(false);

// Accept state
export const acceptLoading = writable({});
// { [issueId]: { text, field, issueLabel } } — tracks accepted suggestions for log modal
export const acceptedIssues = writable({});

// Prompt modal
export const suggestPromptOpen    = writable(false);
export const suggestPromptText    = writable('');
export const suggestPromptLoading = writable(false);
export const suggestPromptSaving  = writable(false);
export const suggestPromptSaved   = writable(false);
export const suggestPromptIsCustom = writable(false);

let _projectId;

export function initSuggestion(projectId) {
  _projectId = projectId;
}

function buildPayload(extras = {}) {
  const tab = get(suggestInputTab);
  return {
    documentType:      get(suggestDocumentType),
    documentTitle:     get(suggestDocumentTitle),
    documentDirection: get(suggestDirection),
    userNotes:         get(suggestUserNotes).trim() || null,
    relevantTrackIds:  get(suggestTrackIds),
    ...(tab === 'upload' ? { file: get(suggestFile) } : { text: get(suggestPasteText) }),
    ...extras
  };
}

export function onSuggestDrop(e) {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file) suggestFile.set(file);
}

export function onSuggestFileChange(e) {
  suggestFile.set(e.target.files[0] ?? null);
  e.target.value = '';
}

export function toggleSuggestTrack(id) {
  suggestTrackIds.update(ids =>
    ids.includes(id) ? ids.filter(t => t !== id) : [...ids, id]
  );
}

export async function runSuggestion() {
  suggestState.set('loading');
  suggestError.set(null);
  conversation.set([]);
  try {
    const payload = buildPayload();
    const { suggestion } = await suggestArgument(_projectId, payload);
    conversation.set([{ role: 'assistant', content: suggestion }]);
    suggestState.set('chat');
  } catch (err) {
    suggestError.set(err.message);
    suggestState.set('idle');
  }
}

export async function sendRefinement() {
  const msg = get(refinementInput).trim();
  if (!msg) return;
  refinementInput.set('');
  refinementLoading.set(true);

  const currentConv = get(conversation);
  const updatedConv = [...currentConv, { role: 'user', content: msg }];
  conversation.set(updatedConv);

  try {
    const payload = buildPayload({ conversation: updatedConv });
    const { suggestion } = await suggestArgument(_projectId, payload);
    conversation.update(c => [...c, { role: 'assistant', content: suggestion }]);
  } catch (err) {
    suggestError.set(err.message);
    conversation.update(c => c.slice(0, -1)); // remove the user message on error
  } finally {
    refinementLoading.set(false);
  }
}

export function acceptSuggestion(issueId, field, text, issueLabel) {
  appendToNote(issueId, field, text);
  acceptedIssues.update(s => ({ ...s, [issueId]: { text, field, issueLabel } }));
}

export function openSuggestionLogModal() {
  const accepted = get(acceptedIssues);
  const conv = get(conversation);
  // Use the first assistant message as the document summary
  const summary = conv.find(m => m.role === 'assistant')?.content ?? '';
  const points = Object.entries(accepted).map(([issueId, { text, field, issueLabel }], i) => ({
    id: i,
    track_id: Number(issueId),
    issue_label: issueLabel,
    field,
    text,
    headline: text.slice(0, 100) + (text.length > 100 ? '…' : ''),
    detailed_summary: null,
    citation: null,
    relevant_chunk_indices: []
  }));
  openLogModal(summary, points);
}

export function resetSuggestion() {
  suggestState.set('idle');
  conversation.set([]);
  suggestFile.set(null);
  suggestPasteText.set('');
  suggestUserNotes.set('');
  suggestTrackIds.set([]);
  suggestDirection.set('against');
  suggestError.set(null);
  refinementInput.set('');
}

// ── Prompt modal ─────────────────────────────────────────────────────────────

export async function openSuggestPromptModal() {
  suggestPromptLoading.set(true);
  suggestPromptOpen.set(true);
  suggestPromptText.set('');
  suggestPromptSaved.set(false);
  try {
    const saved = await getSuggestTemplate(_projectId);
    if (saved?.suggest_argument_template) {
      suggestPromptText.set(saved.suggest_argument_template);
      suggestPromptIsCustom.set(true);
    } else {
      const result = await suggestArgument(_projectId, buildPayload({ preview: true }));
      suggestPromptText.set(result.template);
      suggestPromptIsCustom.set(false);
    }
  } catch (err) {
    suggestPromptText.set(`Error loading prompt: ${err.message}`);
  } finally {
    suggestPromptLoading.set(false);
  }
}

export async function saveSuggestPrompt() {
  suggestPromptSaving.set(true);
  try {
    await saveSuggestTemplate(_projectId, get(suggestPromptText));
    suggestPromptIsCustom.set(true);
    suggestPromptSaved.set(true);
    setTimeout(() => suggestPromptSaved.set(false), 2500);
  } catch (err) {
    console.error('Failed to save suggest prompt:', err);
  } finally {
    suggestPromptSaving.set(false);
  }
}

export async function resetSuggestPromptToDefault() {
  suggestPromptLoading.set(true);
  try {
    await deleteSuggestTemplate(_projectId);
    const result = await suggestArgument(_projectId, buildPayload({ preview: true }));
    suggestPromptText.set(result.template);
    suggestPromptIsCustom.set(false);
  } catch (err) {
    console.error('Failed to reset suggest prompt:', err);
  } finally {
    suggestPromptLoading.set(false);
  }
}

export async function runSuggestionWithPrompt() {
  suggestPromptOpen.set(false);
  const customPrompt = get(suggestPromptText);
  suggestState.set('loading');
  suggestError.set(null);
  conversation.set([]);
  try {
    const payload = buildPayload({ customPrompt });
    const { suggestion } = await suggestArgument(_projectId, payload);
    conversation.set([{ role: 'assistant', content: suggestion }]);
    suggestState.set('chat');
  } catch (err) {
    suggestError.set(err.message);
    suggestState.set('idle');
  }
}
