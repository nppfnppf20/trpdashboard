/**
 * HLPV Narrative Store
 * Manages state for the LLM-generated combined HLPV narrative document.
 */

import { writable, get } from 'svelte/store';
import { getBriefingNotes, generateHlpvNarrative } from '$lib/api/hlpv.js';

// Single combined HTML narrative (all disciplines + briefing-note topics)
export const narrative = writable('');

// Increments each time generation completes — used as a key to remount the editor
export const narrativeGenerationId = writable(0);

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
 * Generate a combined narrative for all triggered disciplines + briefing-note topics.
 * @param {string|number|null} projectId
 * @param {Array} allDisciplines — full disciplines array; filtered internally to triggered rules only
 */
export async function generateNarrative(projectId, allDisciplines) {
  const active = (allDisciplines ?? []).filter(d => d.triggeredRules?.length > 0);
  if (!active.length) return;

  narrativeLoading.set(true);
  narrativeError.set(null);

  try {
    const noteId = get(selectedBriefingNoteId);
    const { narrative: result } = await generateHlpvNarrative(projectId, active, noteId);
    narrative.set(result);
    narrativeGenerationId.update(n => n + 1);
  } catch (err) {
    console.error('[hlpv-narrative] Generation failed:', err);
    narrativeError.set(err.message ?? 'Generation failed');
  } finally {
    narrativeLoading.set(false);
  }
}

export function updateNarrative(html) {
  narrative.set(html);
}

export function clearNarrative() {
  narrative.set('');
  narrativeGenerationId.set(0);
  narrativeError.set(null);
}
