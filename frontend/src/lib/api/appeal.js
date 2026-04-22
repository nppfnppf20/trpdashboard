/**
 * Appeal API Client
 */

import { authFetch } from './client.js';

export async function getKeyIssues(projectId) {
  const res = await authFetch(`/api/appeal/projects/${projectId}/key-issues`);
  if (!res.ok) throw new Error('Failed to fetch key issues');
  return res.json();
}

export async function updateKeyIssueSummary(trackId, summary) {
  const res = await authFetch(`/api/appeal/key-issues/${trackId}/summary`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary })
  });
  if (!res.ok) throw new Error('Failed to update summary');
  return res.json();
}

export async function getArgument(projectId) {
  const res = await authFetch(`/api/appeal/projects/${projectId}/argument`);
  if (!res.ok) throw new Error('Failed to fetch argument');
  return res.json();
}

export async function saveArgument(projectId, argumentHtml) {
  const res = await authFetch(`/api/appeal/projects/${projectId}/argument`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ argument_html: argumentHtml })
  });
  if (!res.ok) throw new Error('Failed to save argument');
  return res.json();
}

export async function getIssueNotes(projectId) {
  const res = await authFetch(`/api/appeal/projects/${projectId}/issue-notes`);
  if (!res.ok) throw new Error('Failed to fetch issue notes');
  return res.json();
}

export async function upsertIssueNote(projectId, trackId, argumentAgainst, argumentFor) {
  const res = await authFetch(`/api/appeal/projects/${projectId}/issue-notes/${trackId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ argument_against: argumentAgainst, argument_for: argumentFor })
  });
  if (!res.ok) throw new Error('Failed to save issue note');
  return res.json();
}

export async function analyseDocument(projectId, { file, text, documentType, documentDirection, userNotes, relevantTrackIds, customPrompt, preview = false }) {
  const qs = preview ? '?preview=true' : '';
  if (file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', documentType);
    if (documentDirection) formData.append('document_direction', documentDirection);
    if (userNotes) formData.append('user_notes', userNotes);
    if (relevantTrackIds?.length) formData.append('relevant_track_ids', JSON.stringify(relevantTrackIds));
    if (customPrompt) formData.append('custom_prompt', customPrompt);
    const res = await authFetch(`/api/appeal/projects/${projectId}/analyse${qs}`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed to analyse document'); }
    return res.json();
  } else {
    const res = await authFetch(`/api/appeal/projects/${projectId}/analyse${qs}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        document_type: documentType,
        document_direction: documentDirection,
        user_notes: userNotes,
        relevant_track_ids: relevantTrackIds ?? [],
        custom_prompt: customPrompt ?? null
      })
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed to analyse document'); }
    return res.json();
  }
}

export async function generateArgument(projectId, initialNotes) {
  const res = await authFetch(`/api/appeal/projects/${projectId}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initial_notes: initialNotes })
  });
  if (!res.ok) throw new Error('Failed to generate argument');
  return res.json();
}

export async function getDocuments(projectId) {
  const res = await authFetch(`/api/appeal/projects/${projectId}/documents`);
  if (!res.ok) throw new Error('Failed to fetch documents');
  return res.json();
}

export async function uploadDocument(projectId, file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await authFetch(`/api/appeal/projects/${projectId}/documents`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) throw new Error('Failed to upload document');
  return res.json();
}

export async function getPromptTemplate(projectId) {
  const res = await authFetch(`/api/appeal/projects/${projectId}/prompt-template`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GET prompt-template ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json(); // null if none saved
}

export async function savePromptTemplate(projectId, template) {
  const res = await authFetch(`/api/appeal/projects/${projectId}/prompt-template`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ template })
  });
  if (!res.ok) throw new Error('Failed to save prompt template');
  return res.json();
}

export async function deletePromptTemplate(projectId) {
  const res = await authFetch(`/api/appeal/projects/${projectId}/prompt-template`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete prompt template');
  return res.json();
}

// ── Draft documents ────────────────────────────────────────────────────────

export async function getDraftTypes() {
  const res = await authFetch('/api/appeal/draft-types');
  if (!res.ok) throw new Error('Failed to fetch draft types');
  return res.json();
}

export async function getSections(typeId) {
  const res = await authFetch(`/api/appeal/draft-types/${typeId}/sections`);
  if (!res.ok) throw new Error('Failed to fetch sections');
  return res.json();
}

export async function createSection(typeId, { name, description }) {
  const res = await authFetch(`/api/appeal/draft-types/${typeId}/sections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description })
  });
  if (!res.ok) throw new Error('Failed to create section');
  return res.json();
}

export async function updateSection(sectionId, fields) {
  const res = await authFetch(`/api/appeal/sections/${sectionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields)
  });
  if (!res.ok) throw new Error('Failed to update section');
  return res.json();
}

export async function deleteSection(sectionId) {
  const res = await authFetch(`/api/appeal/sections/${sectionId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete section');
  return res.json();
}

export async function reorderSections(typeId, order) {
  const res = await authFetch(`/api/appeal/draft-types/${typeId}/sections/reorder`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order })
  });
  if (!res.ok) throw new Error('Failed to reorder sections');
  return res.json();
}

export async function getDraft(projectId, typeId) {
  const res = await authFetch(`/api/appeal/projects/${projectId}/drafts/${typeId}`);
  if (!res.ok) throw new Error('Failed to fetch draft');
  return res.json();
}

export async function saveDraft(projectId, typeId, contentHtml) {
  const res = await authFetch(`/api/appeal/projects/${projectId}/drafts/${typeId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content_html: contentHtml })
  });
  if (!res.ok) throw new Error('Failed to save draft');
  return res.json();
}

export async function generateDraft(projectId, typeId) {
  const res = await authFetch(`/api/appeal/projects/${projectId}/drafts/${typeId}/generate`, {
    method: 'POST'
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed to generate draft'); }
  return res.json();
}

export async function generateDraftSection(projectId, typeId, sectionId) {
  const res = await authFetch(`/api/appeal/projects/${projectId}/drafts/${typeId}/sections/${sectionId}/generate`, {
    method: 'POST'
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed to generate section'); }
  return res.json();
}

export async function updateDocumentStatus(docId, reviewStatus) {
  const res = await authFetch(`/api/appeal/documents/${docId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ review_status: reviewStatus })
  });
  if (!res.ok) throw new Error('Failed to update document status');
  return res.json();
}
