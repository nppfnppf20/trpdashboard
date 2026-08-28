/**
 * Project Selection Store
 * Tracks the single "currently selected project" shared by the sidebar's
 * project switcher and Project Workspace nav.
 */

import { writable, derived } from 'svelte/store';
import { getProjects } from '$lib/api/projects.js';

// Core state
export const projects = writable([]);
export const projectsLoading = writable(false);
export const projectsError = writable(null);
export const selectedProjectId = writable(null);

// Derived convenience
export const selectedProject = derived(
  [projects, selectedProjectId],
  ([$projects, $selectedProjectId]) => $projects.find(p => p.id === $selectedProjectId) ?? null
);
export const hasSelectedProject = derived(selectedProjectId, $selectedProjectId => !!$selectedProjectId);

/**
 * Load the full project list. Safe to call multiple times (e.g. once per
 * Sidebar mount) — each call just re-fetches and replaces the list.
 */
export async function loadProjects() {
  projectsLoading.set(true);
  projectsError.set(null);
  try {
    projects.set(await getProjects());
  } catch (err) {
    console.error('Error loading projects:', err);
    projectsError.set(err.message);
  } finally {
    projectsLoading.set(false);
  }
}

export function selectProject(id) {
  selectedProjectId.set(id);
}

export function clearProjectSelection() {
  selectedProjectId.set(null);
}
