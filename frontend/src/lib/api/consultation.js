// @ts-nocheck
import { authFetch } from './client.js';

export async function processConsultationDoc(projectId, { file, text, fileName, userNotes }) {
  const formData = new FormData();
  if (file) {
    formData.append('file', file);
  } else {
    formData.append('text', text);
    if (fileName) formData.append('file_name', fileName);
  }
  if (userNotes) formData.append('user_notes', userNotes);
  const res = await authFetch(`/api/consultation/projects/${projectId}/process`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to process consultation document');
  }
  return res.json(); // { suggestion: { consultee_name, date_received, position, comments }, source_file_name }
}

export async function getConsultationData(projectId) {
  const res = await authFetch(`/api/consultation/projects/${projectId}`);
  if (!res.ok) throw new Error('Failed to fetch consultation data');
  return res.json(); // { responses: [...], meta: { last_exported_at, last_issued_to_client_at } }
}

export async function createConsultationResponse(projectId, fields) {
  const res = await authFetch(`/api/consultation/projects/${projectId}/responses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to create consultation response');
  }
  return res.json();
}

export async function updateConsultationResponse(responseId, fields) {
  const res = await authFetch(`/api/consultation/responses/${responseId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error('Failed to update consultation response');
  return res.json();
}

export async function deleteConsultationResponse(responseId) {
  const res = await authFetch(`/api/consultation/responses/${responseId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete consultation response');
  return res.json();
}

export async function markConsultationExported(projectId) {
  const res = await authFetch(`/api/consultation/projects/${projectId}/export`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to record export');
  return res.json(); // { last_exported_at, last_issued_to_client_at }
}

export async function emailConsultantForResponse(responseId, { to_email, to_name, subject, intro_note }) {
  const res = await authFetch(`/api/consultation/responses/${responseId}/email-consultant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to_email, to_name, subject, intro_note }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to send email');
  }
  return res.json();
}

export async function createConsultationAdvancements(projectId, { advancement_date, full_text, source_type, items }) {
  const res = await authFetch(`/api/consultation/projects/${projectId}/advancements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ advancement_date, full_text, source_type, items }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to save advancement');
  }
  return res.json(); // [advancement rows]
}

export async function suggestConsultationAdvancementSummaries(projectId, { full_text, items }) {
  const res = await authFetch(`/api/consultation/projects/${projectId}/advancements/suggest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ full_text, items }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to generate summaries');
  }
  return res.json(); // { suggestions: [{ response_id, summary }] }
}

export async function updateConsultationAdvancement(advancementId, fields) {
  const res = await authFetch(`/api/consultation/advancements/${advancementId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error('Failed to update advancement');
  return res.json();
}

export async function deleteConsultationAdvancement(advancementId) {
  const res = await authFetch(`/api/consultation/advancements/${advancementId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete advancement');
  return res.json();
}

export async function getProjectQuotesForConsultation(projectId) {
  const res = await authFetch(`/api/consultation/projects/${projectId}/quotes`);
  if (!res.ok) throw new Error('Failed to fetch project quotes');
  return res.json(); // { quotes: [{ id, status, total, organisation, discipline, contact_name }] }
}

export async function linkConsultationQuote(responseId, quoteId) {
  const res = await authFetch(`/api/consultation/responses/${responseId}/quote-links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quote_id: quoteId }),
  });
  if (!res.ok) throw new Error('Failed to link quote');
  return res.json();
}

export async function unlinkConsultationQuote(responseId, quoteId) {
  const res = await authFetch(`/api/consultation/responses/${responseId}/quote-links/${quoteId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to unlink quote');
  return res.json();
}

export async function createConsultationKeyDate(responseId, fields) {
  const res = await authFetch(`/api/consultation/responses/${responseId}/key-dates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to create key date');
  }
  return res.json();
}

export async function updateConsultationKeyDate(keyDateId, fields) {
  const res = await authFetch(`/api/consultation/key-dates/${keyDateId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error('Failed to update key date');
  return res.json();
}

export async function deleteConsultationKeyDate(keyDateId) {
  const res = await authFetch(`/api/consultation/key-dates/${keyDateId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete key date');
  return res.json();
}
