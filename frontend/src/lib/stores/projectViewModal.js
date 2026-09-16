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
// 'project' (ProjectViewModal), 'surveyor' (SurveyorWorkspace), 'planning' (PlanningWorkspace),
// 'profile' (ProfileWorkspace)
export const mainView = writable(null);
export const mainViewProjectId = writable(null);
export const mainViewInitialTab = writable(null); // only meaningful for 'project'
export const mainViewUserId = writable(null); // only meaningful for 'profile'

// Set only when a tab is opened as a drill-down from within another tab
// (e.g. the Overview page's "expand tracker" button) — tells the panel's
// close button to go back to that tab instead of exiting the workspace.
// Regular navigation (sidebar clicks) always passes returnTab as null,
// which clears it.
export const mainViewReturnTab = writable(null);

// Edit modal — unrelated to the above, stays a true overlay
export const editModalOpen = writable(false);
export const editModalProjectId = writable(null);

// Create-project modal, opened from the permanent top-right "+" button —
// shared so any page (e.g. ProjectsTable) can react to it closing.
export const createProjectModalOpen = writable(false);

// One-shot handoff for a file dropped on the Overview page's Meeting Notes
// widget — MeetingNotesTab picks this up on mount/navigation and seeds its
// own upload panel with it, then clears it. Not a general-purpose store.
export const pendingMeetingUploadFile = writable(null);

export function setPendingMeetingUploadFile(file) {
  pendingMeetingUploadFile.set(file);
}

export function consumePendingMeetingUploadFile() {
  let file;
  pendingMeetingUploadFile.update(f => { file = f; return null; });
  return file;
}

// Same one-shot handoff, for text pasted into the Meeting Notes widget's
// paste tab instead of a dropped file.
export const pendingMeetingUploadText = writable(null);

export function setPendingMeetingUploadText(text) {
  pendingMeetingUploadText.set(text);
}

export function consumePendingMeetingUploadText() {
  let text;
  pendingMeetingUploadText.update(t => { text = t; return null; });
  return text;
}

// Same one-shot handoff pattern, for a file dropped (or text pasted) on the
// Overview page's Surveyor Management widget — QuotesPanel picks this up on
// mount and seeds/opens the Add Quote modal with it, then clears it.
export const pendingQuoteUploadFile = writable(null);

export function setPendingQuoteUploadFile(file) {
  pendingQuoteUploadFile.set(file);
}

export function consumePendingQuoteUploadFile() {
  let file;
  pendingQuoteUploadFile.update(f => { file = f; return null; });
  return file;
}

export const pendingQuoteUploadText = writable(null);

export function setPendingQuoteUploadText(text) {
  pendingQuoteUploadText.set(text);
}

export function consumePendingQuoteUploadText() {
  let text;
  pendingQuoteUploadText.update(t => { text = t; return null; });
  return text;
}

export function openProjectModal(projectId, tab = null, returnTab = null) {
  mainView.set('project');
  mainViewProjectId.set(projectId);
  mainViewInitialTab.set(tab);
  mainViewReturnTab.set(returnTab);
}

export function openSurveyorManagement(projectId, tab = null, returnTab = null) {
  mainView.set('surveyor');
  mainViewProjectId.set(projectId);
  mainViewInitialTab.set(tab);
  mainViewReturnTab.set(returnTab);
}

export function openPlanningDeliverables(projectId) {
  mainView.set('planning');
  mainViewProjectId.set(projectId);
  mainViewInitialTab.set(null);
}

export function openProfile(userId) {
  mainView.set('profile');
  mainViewUserId.set(userId);
}

export function closeProjectModal() {
  mainView.set(null);
  mainViewProjectId.set(null);
  mainViewInitialTab.set(null);
  mainViewReturnTab.set(null);
  mainViewUserId.set(null);
}

export function openEditModal(projectId) {
  editModalProjectId.set(projectId);
  editModalOpen.set(true);
}

export function closeEditModal() {
  editModalOpen.set(false);
  editModalProjectId.set(null);
}

export function openCreateProjectModal() {
  createProjectModalOpen.set(true);
}

export function closeCreateProjectModal() {
  createProjectModalOpen.set(false);
}
