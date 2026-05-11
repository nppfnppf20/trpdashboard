import { authFetch } from '$lib/api/client.js';

const BASE = '/api/planning-application';

// ── Policy-track relevance ────────────────────────────────────────────────────

export async function getPolicyTrackRelevance(projectId) {
  const res = await authFetch(`${BASE}/projects/${projectId}/policy-tracks`);
  if (!res.ok) throw new Error('Failed to fetch policy relevance');
  return res.json();
}

export async function togglePolicyTrack(policyId, trackId) {
  const res = await authFetch(`${BASE}/policy-tracks/${policyId}/tracks/${trackId}`, { method: 'PUT' });
  if (!res.ok) throw new Error('Failed to toggle policy relevance');
  return res.json();
}

// ── Key issues ────────────────────────────────────────────────────────────────

export async function getKeyIssues(projectId) {
  const res = await authFetch(`${BASE}/projects/${projectId}/key-issues`);
  if (!res.ok) throw new Error('Failed to fetch key issues');
  return res.json();
}

export async function updateKeyIssueSummary(trackId, summary) {
  const res = await authFetch(`${BASE}/key-issues/${trackId}/summary`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary })
  });
  if (!res.ok) throw new Error('Failed to update summary');
  return res.json();
}

// ── Issue notes ───────────────────────────────────────────────────────────────

export async function getIssueNotes(projectId) {
  const res = await authFetch(`${BASE}/projects/${projectId}/issue-notes`);
  if (!res.ok) throw new Error('Failed to fetch issue notes');
  return res.json();
}

export async function upsertIssueNote(projectId, trackId, fields) {
  const res = await authFetch(`${BASE}/projects/${projectId}/issue-notes/${trackId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields)
  });
  if (!res.ok) throw new Error('Failed to save issue note');
  return res.json();
}

// ── Document analysis ─────────────────────────────────────────────────────────

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
    const res = await authFetch(`${BASE}/projects/${projectId}/analyse${qs}`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
  const res = await authFetch(`${BASE}/projects/${projectId}/analyse${qs}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, document_type: documentType, document_direction: documentDirection, user_notes: userNotes, relevant_track_ids: relevantTrackIds, custom_prompt: customPrompt })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Prompt template ───────────────────────────────────────────────────────────

export async function getPromptTemplate(projectId) {
  const res = await authFetch(`${BASE}/projects/${projectId}/prompt-template`);
  if (!res.ok) throw new Error('Failed to fetch prompt template');
  return res.json();
}

export async function savePromptTemplate(projectId, template) {
  const res = await authFetch(`${BASE}/projects/${projectId}/prompt-template`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ template })
  });
  if (!res.ok) throw new Error('Failed to save prompt template');
  return res.json();
}

export async function deletePromptTemplate(projectId) {
  const res = await authFetch(`${BASE}/projects/${projectId}/prompt-template`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete prompt template');
  return res.json();
}

// ── Draft types & sections ────────────────────────────────────────────────────

export async function getDraftTypes() {
  const res = await authFetch(`${BASE}/draft-types`);
  if (!res.ok) throw new Error('Failed to fetch draft types');
  return res.json();
}

export async function getSections(typeId) {
  const res = await authFetch(`${BASE}/draft-types/${typeId}/sections`);
  if (!res.ok) throw new Error('Failed to fetch sections');
  return res.json();
}

export async function createSection(typeId, data) {
  const res = await authFetch(`${BASE}/draft-types/${typeId}/sections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to create section');
  return res.json();
}

export async function updateSection(sectionId, data) {
  const res = await authFetch(`${BASE}/sections/${sectionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to update section');
  return res.json();
}

export async function deleteSection(sectionId) {
  const res = await authFetch(`${BASE}/sections/${sectionId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete section');
  return res.json();
}

export async function getSectionPrompt(sectionId) {
  const res = await authFetch(`${BASE}/sections/${sectionId}/prompt`);
  if (!res.ok) throw new Error('Failed to fetch section prompt');
  return res.json(); // { prompt, is_custom }
}

export async function resetSectionPrompt(sectionId) {
  const res = await authFetch(`${BASE}/sections/${sectionId}/prompt`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to reset section prompt');
  return res.json(); // { prompt, is_custom: false }
}

export async function reorderSections(typeId, order) {
  const res = await authFetch(`${BASE}/draft-types/${typeId}/sections/reorder`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order })
  });
  if (!res.ok) throw new Error('Failed to reorder sections');
  return res.json();
}

// ── Drafts ────────────────────────────────────────────────────────────────────

export async function getDraft(projectId, typeId) {
  const res = await authFetch(`${BASE}/projects/${projectId}/drafts/${typeId}`);
  if (!res.ok) throw new Error('Failed to fetch draft');
  return res.json();
}

export async function saveDraft(projectId, typeId, contentHtml) {
  const res = await authFetch(`${BASE}/projects/${projectId}/drafts/${typeId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content_html: contentHtml })
  });
  if (!res.ok) throw new Error('Failed to save draft');
  return res.json();
}

export async function generateDraft(projectId, typeId) {
  const res = await authFetch(`${BASE}/projects/${projectId}/drafts/${typeId}/generate`, { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to generate draft');
  }
  return res.json();
}

export async function generateDraftSection(projectId, typeId, sectionId) {
  const res = await authFetch(`${BASE}/projects/${projectId}/drafts/${typeId}/sections/${sectionId}/generate`, { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to generate section');
  }
  return res.json();
}

export async function getAssessmentIssues(projectId) {
  const res = await authFetch(`${BASE}/projects/${projectId}/assessment-issues`);
  if (!res.ok) throw new Error('Failed to fetch assessment issues');
  return res.json();
}

export async function generateAssessmentIssue(projectId, typeId, sectionId, trackId) {
  const res = await authFetch(`${BASE}/projects/${projectId}/drafts/${typeId}/sections/${sectionId}/issues/${trackId}/generate`, { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to generate assessment issue');
  }
  return res.json();
}

// ── Document log ──────────────────────────────────────────────────────────────

export async function getDocumentLog(projectId) {
  const res = await authFetch(`${BASE}/projects/${projectId}/document-log`);
  if (!res.ok) throw new Error('Failed to fetch document log');
  return res.json();
}

export async function createDocumentLogEntry(projectId, data) {
  const res = await authFetch(`${BASE}/projects/${projectId}/document-log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to create log entry');
  return res.json();
}

export async function updateDocumentLogEntry(entryId, data) {
  const res = await authFetch(`${BASE}/document-log/${entryId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to update log entry');
  return res.json();
}

export async function deleteDocumentLogEntry(entryId) {
  const res = await authFetch(`${BASE}/document-log/${entryId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete log entry');
  return res.json();
}

// ── Argument points ───────────────────────────────────────────────────────────

export async function getArgumentPoints(projectId) {
  const res = await authFetch(`${BASE}/projects/${projectId}/argument-points`);
  if (!res.ok) throw new Error('Failed to fetch argument points');
  return res.json();
}

export async function createArgumentPoint(projectId, data) {
  const res = await authFetch(`${BASE}/projects/${projectId}/argument-points`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to create argument point');
  return res.json();
}
