/**
 * NPPF Policy Library API
 * Canonical, shared (not project-scoped) NPPF policy reference library.
 */

import { authFetch } from '$lib/api/client.js';

const BASE = '/api/nppf-policies';

export async function getNppfPolicies() {
  const res = await authFetch(BASE);
  if (!res.ok) throw new Error('Failed to fetch NPPF policies');
  return res.json();
}

export async function createNppfPolicy(data) {
  const res = await authFetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create NPPF policy');
  }
  return res.json();
}

export async function updateNppfPolicy(id, data) {
  const res = await authFetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to update NPPF policy');
  return res.json();
}

export async function deleteNppfPolicy(id) {
  const res = await authFetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete NPPF policy');
  return res.json();
}

export async function extractNppfPolicies({ file, text } = {}) {
  let body;
  const opts = { method: 'POST' };
  if (file) {
    body = new FormData();
    body.append('file', file);
  } else {
    body = JSON.stringify({ text });
    opts.headers = { 'Content-Type': 'application/json' };
  }
  opts.body = body;
  const res = await authFetch(`${BASE}/extract`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to extract NPPF policies');
  }
  return res.json();
}
