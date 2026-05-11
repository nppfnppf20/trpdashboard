import { authFetch } from './client.js';

export async function getDocumentSummaries(projectId) {
  const res = await authFetch(`/api/planning-application/projects/${projectId}/document-summaries`);
  if (!res.ok) throw new Error('Failed to fetch document summaries');
  return res.json();
}

export async function generateDocumentSummary(projectId, { file, text, fileName, docType }) {
  if (file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('doc_type', docType);
    const res = await authFetch(`/api/planning-application/projects/${projectId}/document-summaries/generate`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed to generate summary'); }
    return res.json();
  } else {
    const res = await authFetch(`/api/planning-application/projects/${projectId}/document-summaries/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, file_name: fileName, doc_type: docType })
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed to generate summary'); }
    return res.json();
  }
}

export async function saveDocumentSummary(projectId, { title, document_ref, file_name, doc_type, summary_html }) {
  const res = await authFetch(`/api/planning-application/projects/${projectId}/document-summaries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, document_ref, file_name, doc_type, summary_html })
  });
  if (!res.ok) throw new Error('Failed to save document summary');
  return res.json();
}

export async function deleteDocumentSummary(summaryId) {
  const res = await authFetch(`/api/planning-application/document-summaries/${summaryId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete document summary');
  return res.json();
}

export async function getDocTypePrompt(docType) {
  const res = await authFetch(`/api/planning-application/doc-type-prompts/${docType}`);
  if (!res.ok) throw new Error('Failed to fetch prompt');
  return res.json(); // { prompt, is_custom }
}

export async function saveDocTypePrompt(docType, prompt) {
  const res = await authFetch(`/api/planning-application/doc-type-prompts/${docType}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  });
  if (!res.ok) throw new Error('Failed to save prompt');
  return res.json();
}

export async function replaceDocumentSummary(projectId, { title, document_ref, file_name, doc_type, summary_html }) {
  const res = await authFetch(`/api/planning-application/projects/${projectId}/document-summaries/by-type`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, document_ref, file_name, doc_type, summary_html })
  });
  if (!res.ok) throw new Error('Failed to replace document summary');
  return res.json();
}

export async function suggestDocumentUpdates(projectId, { text }) {
  const res = await authFetch(`/api/planning-application/projects/${projectId}/document-summaries/suggest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed to get suggestions'); }
  return res.json(); // { suggestions: [...] }
}

export async function deleteDocTypePrompt(docType) {
  const res = await authFetch(`/api/planning-application/doc-type-prompts/${docType}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to reset prompt');
  return res.json(); // { prompt, is_custom: false }
}
