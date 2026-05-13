/**
 * HLPV Narrative Store
 * Manages state for LLM-generated HLPV discipline narratives.
 */

import { writable, get } from 'svelte/store';
import { getBriefingNotes, generateHlpvNarrative } from '$lib/api/hlpv.js';

// Generated narrative HTML per discipline name, e.g. { Heritage: '<p>...</p>' }
export const narratives = writable({});

export const narrativeLoading = writable(false);
export const narrativeError = writable(null);

// Briefing note selection
export const briefingNotes = writable([]);
export const selectedBriefingNoteId = writable(null);
export const briefingDropdownOpen = writable(false);

export async function loadBriefingNotes(projectId) {
  if (!projectId) return;
  try {
    const notes = await getBriefingNotes(projectId);
    briefingNotes.set(notes);
  } catch (err) {
    console.error('[hlpv-narrative] Failed to load briefing notes:', err);
  }
}

export function selectBriefingNote(id) {
  selectedBriefingNoteId.set(id);
  briefingDropdownOpen.set(false);
}

/**
 * Generate narrative for all disciplines that have triggered rules.
 * @param {string|number|null} projectId
 * @param {Array} allDisciplines — full disciplines array from the report; filtered internally
 */
export async function generateNarrative(projectId, allDisciplines) {
  const active = (allDisciplines ?? []).filter(d => d.triggeredRules?.length > 0);
  if (!active.length) return;

  narrativeLoading.set(true);
  narrativeError.set(null);

  try {
    const noteId = get(selectedBriefingNoteId);
    const { narratives: result } = await generateHlpvNarrative(projectId, active, noteId);
    narratives.set(result);
  } catch (err) {
    console.error('[hlpv-narrative] Generation failed:', err);
    narrativeError.set(err.message ?? 'Generation failed');
  } finally {
    narrativeLoading.set(false);
  }
}

export function updateNarrative(disciplineName, html) {
  narratives.update(n => ({ ...n, [disciplineName]: html }));
}

export function clearNarratives() {
  narratives.set({});
  narrativeError.set(null);
}
