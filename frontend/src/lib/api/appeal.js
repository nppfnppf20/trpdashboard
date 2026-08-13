/**
 * Appeal API Client
 *
 * Only the endpoints the PA workspace's appeal-tool draft types (Statement of
 * Case, SoCG, etc.) actually use — the standalone /appeal workspace and its
 * legacy generation pipeline were retired.
 */

import { authFetch } from './client.js';

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

export async function getDraftContext(projectId, typeId) {
  const res = await authFetch(`/api/appeal/projects/${projectId}/drafts/${typeId}/context`);
  if (!res.ok) throw new Error('Failed to fetch draft context');
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

export async function getAppealTypePrompt(typeId) {
  const res = await authFetch(`/api/appeal/draft-types/${typeId}/prompt`);
  if (!res.ok) throw new Error('Failed to fetch prompt');
  return res.json();
}

export async function saveAppealTypePrompt(typeId, prompt) {
  const res = await authFetch(`/api/appeal/draft-types/${typeId}/prompt`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  });
  if (!res.ok) throw new Error('Failed to save prompt');
  return res.json();
}

export async function resetAppealTypePrompt(typeId) {
  const res = await authFetch(`/api/appeal/draft-types/${typeId}/prompt`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to reset prompt');
  return res.json();
}

export async function generateDraftFromPaNotes(projectId, typeId, { briefingNoteId, developmentType, provider } = {}) {
  const res = await authFetch(`/api/appeal/projects/${projectId}/drafts/${typeId}/generate-from-pa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ briefingNoteId: briefingNoteId ?? null, developmentType: developmentType ?? null, provider: provider ?? null })
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed to generate draft'); }
  return res.json();
}

export async function generateSectionFromPaNotes(projectId, typeId, sectionId, provider) {
  const res = await authFetch(`/api/appeal/projects/${projectId}/drafts/${typeId}/sections/${sectionId}/generate-from-pa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider })
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed to generate section'); }
  return res.json();
}

// ── Incorporation ───────────────────────────────────────────────────────────

export async function appealScopeIncorporation(projectId, typeId, { file, documentText, documentTitle, paragraphs, docType }) {
  const form = new FormData();
  form.append('paragraphs', JSON.stringify(paragraphs));
  if (docType) form.append('doc_type', docType);
  if (file) {
    form.append('file', file);
  } else {
    form.append('document_text', documentText ?? '');
    form.append('document_title', documentTitle ?? '');
  }
  const res = await authFetch(`/api/appeal/projects/${projectId}/drafts/${typeId}/scope-incorporation`, { method: 'POST', body: form });
  if (!res.ok) throw new Error('Failed to scope incorporation');
  return res.json();
}

export async function appealIncorporateTargeted(projectId, typeId, { file, documentText, documentTitle, paragraphs, userNotes, docType, issueId }) {
  const form = new FormData();
  form.append('paragraphs', JSON.stringify(paragraphs));
  if (userNotes) form.append('user_notes', userNotes);
  if (docType) form.append('doc_type', docType);
  if (issueId) form.append('issue_id', issueId);
  if (file) {
    form.append('file', file);
  } else {
    form.append('document_text', documentText ?? '');
    form.append('document_title', documentTitle ?? '');
  }
  const res = await authFetch(`/api/appeal/projects/${projectId}/drafts/${typeId}/incorporate-targeted`, { method: 'POST', body: form });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed to incorporate document'); }
  return res.json();
}

// ── Briefing notes ─────────────────────────────────────────────────────────

export async function getBriefingNotes(projectId) {
  const res = await authFetch(`/api/appeal/projects/${projectId}/briefing-notes`);
  if (!res.ok) throw new Error('Failed to fetch briefing notes');
  return res.json();
}

export async function uploadBriefingNote(projectId, { file, text, title }) {
  if (file) {
    const fd = new FormData();
    fd.append('file', file);
    if (title) fd.append('title', title);
    const res = await authFetch(`/api/appeal/projects/${projectId}/briefing-notes`, { method: 'POST', body: fd });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed to upload briefing note'); }
    return res.json();
  } else {
    const res = await authFetch(`/api/appeal/projects/${projectId}/briefing-notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, title })
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed to upload briefing note'); }
    return res.json();
  }
}

// ── Starting documents (PA workspace appeal draft types) ──────────────────────

export async function getStartingDocs(projectId, typeId) {
  const res = await authFetch(`/api/appeal/projects/${projectId}/starting-docs/${typeId}`);
  if (!res.ok) throw new Error('Failed to fetch starting docs');
  return res.json();
}

export async function upsertStartingDocText(projectId, typeId, slotSlug, contentText) {
  const res = await authFetch(`/api/appeal/projects/${projectId}/starting-docs/${typeId}/${slotSlug}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content_text: contentText })
  });
  if (!res.ok) throw new Error('Failed to save starting doc');
  return res.json();
}

export async function upsertStartingDocFile(projectId, typeId, slotSlug, file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await authFetch(`/api/appeal/projects/${projectId}/starting-docs/${typeId}/${slotSlug}`, {
    method: 'PUT',
    body: formData
  });
  if (!res.ok) throw new Error('Failed to upload starting doc');
  return res.json();
}

export async function deleteStartingDoc(projectId, typeId, slotSlug) {
  const res = await authFetch(`/api/appeal/projects/${projectId}/starting-docs/${typeId}/${slotSlug}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Failed to remove starting doc');
  return res.json();
}
