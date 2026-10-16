/**
 * PlanIt API
 * Similar schemes: drafting the search from project sources, PlanIt search and AI triage.
 */

import { authFetch } from '$lib/api/client.js';

const BASE = '/api/planit';

/**
 * Draft the search from the project and the chosen sources (meeting notes, documents, trackers):
 * keyword terms, the LPA and a detailed description of what to find.
 *
 * @param {number} projectId
 * @param {{ document_ids: number[], meeting_ids: number[], trackers: string[], mode: string } | null} sources
 * @returns {Promise<{ terms: string[], lpa: string, brief: string, usedSources: { trackers: number, meetings: number, documents: number, mode: string | null } }>}
 */
export async function generateSearchFromSources(projectId, sources = null) {
  const res = await authFetch(`${BASE}/projects/${projectId}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sources ? { sources } : {})
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to generate the search');
  }
  return res.json();
}

/**
 * Authorities PlanIt holds applications for, for the LPA type-ahead.
 *
 * @returns {Promise<Array<{ id: string, label: string, long_name: string }>>}
 */
export async function getPlanitAreas() {
  const res = await authFetch(`${BASE}/areas`);
  if (!res.ok) throw new Error('Failed to load authorities');
  return (await res.json()).areas ?? [];
}

/**
 * Search PlanIt for planning applications matching keywords within an LPA.
 *
 * @param {number} projectId
 * @param {{ keywords: string, lpa: string, page?: number, pg_sz?: number, filters?: { appState?: string[], appType?: string[], appSize?: string[], since?: string } }} params
 * @returns {Promise<{ records: Array, total: number, from: number, to: number, lpa_used: string }>}
 */
export async function searchSimilarSchemes(projectId, { keywords, lpa, page = 1, pg_sz = 20, filters = {} }) {
  const qs = new URLSearchParams({ keywords, lpa, page: String(page), pg_sz: String(pg_sz) });
  if (filters.appState?.length) qs.set('app_state', filters.appState.join(','));
  if (filters.appType?.length) qs.set('app_type', filters.appType.join(','));
  if (filters.appSize?.length) qs.set('app_size', filters.appSize.join(','));
  if (filters.since) qs.set('since', filters.since);
  const res = await authFetch(`${BASE}/projects/${projectId}/search?${qs}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Search failed');
  }
  return res.json();
}

/**
 * Search PlanIt for a wide pool, then have the LLM score each record against the written brief.
 *
 * @param {number} projectId
 * @param {{ keywords: string, lpa: string, brief: string, filters?: object }} params
 * @returns {Promise<{ records: Array, total: number, reviewed: number, relevant: number, failedBatches: number, lpa_used: string }>}
 */
export async function triageSimilarSchemes(projectId, { keywords, lpa, brief, filters = {} }) {
  const res = await authFetch(`${BASE}/projects/${projectId}/triage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keywords, lpa, brief, filters })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.message || 'AI search failed');
  }
  return res.json();
}

async function savedJson(res, fallback) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || fallback);
  }
  return (await res.json()).schemes;
}

/** The schemes saved against this project, newest first. */
export async function getSavedSchemes(projectId) {
  return savedJson(await authFetch(`${BASE}/projects/${projectId}/saved`), 'Could not load the saved schemes');
}

/** Save the chosen results (PlanIt records, with the AI reason if there is one). Returns the full saved list. */
export async function saveSchemes(projectId, schemes) {
  return savedJson(
    await authFetch(`${BASE}/projects/${projectId}/saved`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schemes })
    }),
    'Could not save the schemes'
  );
}

/**
 * Re-check saved schemes against PlanIt (only those not checked in the last day, unless forced).
 * Returns the updated list and a summary of what happened.
 *
 * @returns {Promise<{ schemes: Array, refreshed: number, changed: number, failed: number, rateLimited: boolean, busy?: boolean }>}
 */
export async function refreshSavedSchemes(projectId, force = false) {
  const res = await authFetch(`${BASE}/projects/${projectId}/saved/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ force })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Could not refresh the saved schemes');
  }
  return res.json();
}

/** Remove one saved scheme by its PlanIt application name. Returns the remaining saved list. */
export async function removeSavedScheme(projectId, name) {
  return savedJson(
    await authFetch(`${BASE}/projects/${projectId}/saved?${new URLSearchParams({ name })}`, { method: 'DELETE' }),
    'Could not remove the scheme'
  );
}

// ── Documents uploaded against saved schemes, and chat over them ──────────────

async function docJson(res, fallback) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.message || fallback);
  }
  return res.json();
}

/** Metadata (no text) for every document uploaded against this project's saved schemes. */
export async function getSchemeDocuments(projectId) {
  return (await docJson(await authFetch(`${BASE}/projects/${projectId}/saved/documents`), 'Could not load the documents')).documents;
}

/** The stored text of one document. */
export async function getSchemeDocumentText(projectId, docId) {
  return (await docJson(await authFetch(`${BASE}/projects/${projectId}/saved/documents/${docId}/text`), 'Could not load the document text')).text;
}

/** Upload a document to a saved scheme. The returned document carries the AI-suggested type (type_confirmed false). */
export async function uploadSchemeDocument(projectId, planitName, file) {
  const form = new FormData();
  form.append('planit_name', planitName);
  form.append('file', file);
  return (await docJson(await authFetch(`${BASE}/projects/${projectId}/saved/documents`, { method: 'POST', body: form }), 'Upload failed')).document;
}

/** Add pasted text as a document on a saved scheme. The returned document carries the AI-suggested type. */
export async function addSchemeText(projectId, planitName, { title, text }) {
  return (
    await docJson(
      await authFetch(`${BASE}/projects/${projectId}/saved/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planit_name: planitName, title, text })
      }),
      'Could not add the text'
    )
  ).document;
}

/** Accept or change a document's type. */
export async function setSchemeDocumentType(projectId, docId, docType) {
  return (
    await docJson(
      await authFetch(`${BASE}/projects/${projectId}/saved/documents/${docId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc_type: docType })
      }),
      'Could not update the document'
    )
  ).document;
}

export async function deleteSchemeDocument(projectId, docId) {
  await docJson(await authFetch(`${BASE}/projects/${projectId}/saved/documents/${docId}`, { method: 'DELETE' }), 'Could not delete the document');
}

/**
 * Ask a question about the ticked schemes' documents.
 * `sources` is { groups, document_ids, meeting_ids, mode } from the project (policies, trackers, notes).
 * @returns {Promise<{ reply: string, citations: Array, contextTokens: number, sourcesTruncated: boolean }>}
 */
export async function askSchemeDocuments(projectId, { names, messages, sources }) {
  return docJson(
    await authFetch(`${BASE}/projects/${projectId}/saved/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names, messages, sources })
    }),
    'Chat request failed'
  );
}

/**
 * Compare how the ticked schemes' documents treat the chosen policies.
 * @returns {Promise<{ schemes: Array, pattern: string[], policies: Array, contextTokens: number }>}
 */
export async function lensSchemeDocuments(projectId, { names, policy_ids, question }) {
  return docJson(
    await authFetch(`${BASE}/projects/${projectId}/saved/lens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names, policy_ids, question })
    }),
    'Policy lens request failed'
  );
}
