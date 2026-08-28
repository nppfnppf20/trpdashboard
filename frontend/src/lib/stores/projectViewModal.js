/**
 * Main Content Workspace / Edit Modal Store
 * A single shared "which project-scoped tool currently owns the main
 * content area, for which project" state so the sidebar (and other
 * entry points like ProjectsTable/ProjectViewModal) can swap what
 * renders in place of the routed page from one hoisted spot in the
 * root layout, instead of each page owning its own instance.
 */

import { writable } from 'svelte/store';

// Main content area — null shows the routed page; otherwise one of
// 'project' (ProjectViewModal), 'surveyor' (SurveyorWorkspace), 'planning' (PlanningWorkspace)
export const mainView = writable(null);
export const mainViewProjectId = writable(null);
export const mainViewInitialTab = writable(null); // only meaningful for 'project'

// Edit modal — unrelated to the above, stays a true overlay
export const editModalOpen = writable(false);
export const editModalProjectId = writable(null);

export function openProjectModal(projectId, tab = null) {
  mainView.set('project');
  mainViewProjectId.set(projectId);
  mainViewInitialTab.set(tab);
}

export function openSurveyorManagement(projectId) {
  mainView.set('surveyor');
  mainViewProjectId.set(projectId);
  mainViewInitialTab.set(null);
}

export function openPlanningDeliverables(projectId) {
  mainView.set('planning');
  mainViewProjectId.set(projectId);
  mainViewInitialTab.set(null);
}

export function closeProjectModal() {
  mainView.set(null);
  mainViewProjectId.set(null);
  mainViewInitialTab.set(null);
}

export function openEditModal(projectId) {
  editModalProjectId.set(projectId);
  editModalOpen.set(true);
}

export function closeEditModal() {
  editModalOpen.set(false);
  editModalProjectId.set(null);
}
