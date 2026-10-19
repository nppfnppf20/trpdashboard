/**
 * Company Policy Library API
 * Internal company policy documents (global, not project-scoped).
 */

import { authFetch } from '$lib/api/client.js';

const BASE = '/api/company-policies';

async function fail(res, fallback) {
  const err = await res.json().catch(() => ({}));
  throw new Error(err.error || fallback);
}

export async function getCompanyPolicies({ includeHistory = false } = {}) {
  const res = await authFetch(`${BASE}${includeHistory ? '?include_history=1' : ''}`);
  if (!res.ok) await fail(res, 'Failed to fetch policies');
  return res.json();
}

// fields: { title, category, version, effective_date, visibility, supersedes_id }
export async function uploadCompanyPolicy(file, fields = {}) {
  const body = new FormData();
  body.append('file', file);
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null && value !== '') body.append(key, value);
  }
  const res = await authFetch(BASE, { method: 'POST', body });
  if (!res.ok) await fail(res, 'Failed to upload policy');
  return res.json();
}

export async function updateCompanyPolicy(id, data) {
  const res = await authFetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) await fail(res, 'Failed to update policy');
  return res.json();
}

export async function reindexCompanyPolicy(id) {
  const res = await authFetch(`${BASE}/${id}/reindex`, { method: 'POST' });
  if (!res.ok) await fail(res, 'Failed to start indexing');
  return res.json();
}

// Asks a question and streams the answer. onDelta(text) is called with each piece as it is written;
// resolves with the final { answer, sources: [{ document_id, title, section_path, page_start, page_end, excerpt }], query }.
// history: [{ role: 'user' | 'assistant', content }] — earlier turns, so follow-up questions make sense.
// folderId limits the search to that folder and everything inside it (omit to search everything).
/**
 * @param {string} question
 * @param {{ role: string, content: string }[]} [history]
 * @param {{ onDelta?: (text: string) => void, folderId?: number | null }} [opts]
 */
export async function askCompanyPolicies(question, history = [], { onDelta, folderId = null } = {}) {
  const res = await authFetch(`${BASE}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, history, stream: true, folder_id: folderId })
  });
  if (!res.ok) await fail(res, 'Failed to get an answer');

  if (!res.body) throw new Error('The answer could not be streamed. Please try again.');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let done = null;

  const handle = (frame) => {
    const line = frame.split('\n').find(l => l.startsWith('data:'));
    if (!line) return;
    const event = JSON.parse(line.slice(5));
    if (event.type === 'delta') onDelta?.(event.text);
    else if (event.type === 'done') done = event;
    else if (event.type === 'error') throw new Error(event.message || 'Failed to get an answer');
  };

  while (true) {
    const { value, done: finished } = await reader.read();
    if (finished) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? ''; // the last piece may be an incomplete frame
    frames.forEach(handle);
  }
  if (buffer.trim()) handle(buffer);

  if (!done) throw new Error('The answer was interrupted. Please try again.');
  return done;
}

// The whole document as indexed sections, for the in-app reader:
// { document, sections: [{ chunk_index, section_path, section_ref, page_start, page_end, content }] }
// ── Folders ──────────────────────────────────────────────────────────────────

// { folders: [{ id, name, parent_id, sort_order, doc_count }], max_depth }
export async function getCompanyPolicyFolders() {
  const res = await authFetch(`${BASE}/folders`);
  if (!res.ok) await fail(res, 'Failed to fetch folders');
  return res.json();
}

/** @param {string} name @param {number | null} [parentId] */
export async function createCompanyPolicyFolder(name, parentId = null) {
  const res = await authFetch(`${BASE}/folders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, parent_id: parentId })
  });
  if (!res.ok) await fail(res, 'Failed to create the folder');
  return res.json();
}

// data: { name?, parent_id? } (parent_id null moves it to the top level)
export async function updateCompanyPolicyFolder(id, data) {
  const res = await authFetch(`${BASE}/folders/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) await fail(res, 'Failed to update the folder');
  return res.json();
}

// Refused (409) while the folder still has documents or sub-folders in it
export async function deleteCompanyPolicyFolder(id) {
  const res = await authFetch(`${BASE}/folders/${id}`, { method: 'DELETE' });
  if (!res.ok) await fail(res, 'Failed to delete the folder');
  return res.json();
}

export async function getCompanyPolicyContent(id) {
  const res = await authFetch(`${BASE}/${id}/content`);
  if (!res.ok) await fail(res, 'Failed to load the policy');
  return res.json();
}

// inline: true returns a link that opens in the browser (PDFs can then be opened at a page); otherwise it downloads
export async function getCompanyPolicyFileUrl(id, { inline = false } = {}) {
  const res = await authFetch(`${BASE}/${id}/file-url${inline ? '?inline=1' : ''}`);
  if (!res.ok) await fail(res, 'Failed to get download link');
  const { url } = await res.json();
  return url;
}

export async function deleteCompanyPolicy(id) {
  const res = await authFetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) await fail(res, 'Failed to delete policy');
  return res.json();
}
