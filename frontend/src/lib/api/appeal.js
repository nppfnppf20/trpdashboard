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

// ── Argument suggestion ────────────────────────────────────────────────────

export async function suggestArgument(projectId, { file, text, documentType, documentTitle, documentDirection, userNotes, relevantTrackIds, conversation, customPrompt, preview = false }) {
  const qs = preview ? '?preview=true' : '';
  if (file) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('document_type', documentType);
    fd.append('document_title', documentTitle || '');
    if (documentDirection) fd.append('document_direction', documentDirection);
    if (userNotes) fd.append('user_notes', userNotes);
    if (relevantTrackIds?.length) fd.append('relevant_track_ids', JSON.stringify(relevantTrackIds));
    if (conversation?.length) fd.append('conversation', JSON.stringify(conversation));
    if (customPrompt) fd.append('custom_prompt', customPrompt);
    const res = await authFetch(`/api/appeal/projects/${projectId}/suggest-argument${qs}`, { method: 'POST', body: fd });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed to generate suggestion'); }
    return res.json();
  } else {
    const res = await authFetch(`/api/appeal/projects/${projectId}/suggest-argument${qs}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, document_type: documentType, document_title: documentTitle || '', document_direction: documentDirection, user_notes: userNotes, relevant_track_ids: relevantTrackIds ?? [], conversation: conversation ?? [], custom_prompt: customPrompt ?? null })
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed to generate suggestion'); }
    return res.json();
  }
}

export async function getSuggestTemplate(projectId) {
  const res = await authFetch(`/api/appeal/projects/${projectId}/suggest-template`);
  if (!res.ok) throw new Error('Failed to fetch suggest template');
  return res.json();
}

export async function saveSuggestTemplate(projectId, template) {
  const res = await authFetch(`/api/appeal/projects/${projectId}/suggest-template`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ template })
  });
  if (!res.ok) throw new Error('Failed to save suggest template');
  return res.json();
}

export async function deleteSuggestTemplate(projectId) {
  const res = await authFetch(`/api/appeal/projects/${projectId}/suggest-template`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete suggest template');
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

export async function getDocumentLog(projectId) {
  const res = await authFetch(`/api/appeal/projects/${projectId}/document-log`);
  if (!res.ok) throw new Error('Failed to fetch document log');
  return res.json();
}

export async function createDocumentLogEntry(projectId, { title, code, document_summary, argument_points }) {
  const res = await authFetch(`/api/appeal/projects/${projectId}/document-log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, code, document_summary, argument_points })
  });
  if (!res.ok) throw new Error('Failed to save log entry');
  return res.json();
}

export async function updateDocumentLogEntry(entryId, data) {
  const res = await authFetch(`/api/appeal/document-log/${entryId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to update log entry');
  return res.json();
}

export async function deleteDocumentLogEntry(entryId) {
  const res = await authFetch(`/api/appeal/document-log/${entryId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete log entry');
  return res.json();
}

export async function getArgumentPoints(projectId) {
  const res = await authFetch(`/api/planning-application/projects/${projectId}/argument-points`);
  if (!res.ok) throw new Error('Failed to fetch argument points');
  return res.json();
}

export async function createArgumentPoint(projectId, point) {
  const res = await authFetch(`/api/planning-application/projects/${projectId}/argument-points`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(point)
  });
  if (!res.ok) throw new Error('Failed to create argument point');
  return res.json();
}

// ── Briefing notes ─────────────────────────────────────────────────────────

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

export async function appealIncorporateTargeted(projectId, typeId, { file, documentText, documentTitle, paragraphs, userNotes, docType }) {
  const form = new FormData();
  form.append('paragraphs', JSON.stringify(paragraphs));
  if (userNotes) form.append('user_notes', userNotes);
  if (docType) form.append('doc_type', docType);
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

export async function amendDraftFromBriefing(projectId, typeId, { currentHtml, briefingNoteId, docText, docType }) {
  const res = await authFetch(`/api/appeal/projects/${projectId}/drafts/${typeId}/amend-from-briefing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentHtml, briefingNoteId: briefingNoteId ?? null, docText: docText ?? null, docType: docType ?? 'project_briefing' }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed to amend draft'); }
  return res.json(); // { html }
}

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

export async function draftArgumentsFromBriefing(projectId, briefingNoteId = null) {
  const res = await authFetch(`/api/appeal/projects/${projectId}/draft-arguments-from-briefing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ briefing_note_id: briefingNoteId })
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed to draft arguments'); }
  return res.json();
}

export async function draftArgumentsFromIssueNotes(projectId) {
  const res = await authFetch(`/api/appeal/projects/${projectId}/draft-arguments-from-issue-notes`, { method: 'POST' });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed to draft arguments from issue notes'); }
  return res.json();
}

export async function draftKeySummariesFromBriefing(projectId, briefingNoteId = null) {
  const res = await authFetch(`/api/appeal/projects/${projectId}/draft-key-summaries-from-briefing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ briefing_note_id: briefingNoteId })
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed to draft key summaries'); }
  return res.json();
}

export async function evolveArgument(projectId, { trackId, newInformation, conversation }) {
  const res = await authFetch(`/api/appeal/projects/${projectId}/evolve-argument`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ track_id: trackId, new_information: newInformation, conversation })
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed to evolve argument'); }
  return res.json();
}

export async function chatArgument(projectId, { trackId, briefingNoteId, conversation }) {
  const res = await authFetch(`/api/appeal/projects/${projectId}/chat-argument`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ track_id: trackId, briefing_note_id: briefingNoteId, conversation })
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed to chat argument'); }
  return res.json();
}

export async function scopeIncorporation(projectId, typeId, { documentId, documentText, documentTitle, paragraphs }) {
  const res = await authFetch(`/api/appeal/projects/${projectId}/drafts/${typeId}/scope-incorporate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      document_id: documentId ?? null,
      document_text: documentText ?? null,
      document_title: documentTitle ?? null,
      paragraphs
    })
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed to scope incorporation'); }
  return res.json();
}

export async function incorporateTargeted(projectId, typeId, { documentId, documentText, documentTitle, paragraphs, userNotes = null }) {
  const res = await authFetch(`/api/appeal/projects/${projectId}/drafts/${typeId}/incorporate-targeted`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      document_id: documentId ?? null,
      document_text: documentText ?? null,
      document_title: documentTitle ?? null,
      paragraphs,
      user_notes: userNotes
    })
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed to incorporate'); }
  return res.json();
}

export async function uploadDraftExample(projectId, typeId, file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await authFetch(`/api/appeal/projects/${projectId}/drafts/${typeId}/upload-example`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed to upload example'); }
  return res.json();
}

export async function incorporateDocument(projectId, typeId, { documentId, documentText, documentTitle, userNotes = null, conversation = [] }) {
  const res = await authFetch(`/api/appeal/projects/${projectId}/drafts/${typeId}/incorporate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      document_id: documentId ?? null,
      document_text: documentText ?? null,
      document_title: documentTitle ?? null,
      user_notes: userNotes,
      conversation
    })
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed to incorporate document'); }
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
