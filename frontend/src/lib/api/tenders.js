import { authFetch } from './client.js';

async function handle(res, message) {
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body.error || body.detail || '';
    } catch {
      // ignore non-JSON bodies
    }
    throw new Error(detail || message);
  }
  return res.json();
}

export async function listNotices(params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') query.set(key, value);
  }
  const res = await authFetch(`/api/tenders?${query}`);
  return handle(res, 'Failed to load tender notices');
}

export async function triggerSync(body = {}) {
  const res = await authFetch('/api/tenders/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handle(res, 'Sync failed');
}

export async function triggerClassify(limit = 200) {
  const res = await authFetch('/api/tenders/classify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit }),
  });
  return handle(res, 'Classification failed');
}

export async function updateNotice(id, changes) {
  const res = await authFetch(`/api/tenders/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(changes),
  });
  return handle(res, 'Failed to update notice');
}

export async function getStats() {
  const res = await authFetch('/api/tenders/stats');
  return handle(res, 'Failed to load council stats');
}

export async function getSyncRuns(limit = 20) {
  const res = await authFetch(`/api/tenders/runs?limit=${limit}`);
  return handle(res, 'Failed to load sync runs');
}

export async function getUnmatchedBuyers() {
  const res = await authFetch('/api/tenders/unmatched-buyers');
  return handle(res, 'Failed to load unmatched buyers');
}

export async function matchBuyer(buyerName, authorityId) {
  const res = await authFetch('/api/tenders/match-buyer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ buyer_name: buyerName, authority_id: authorityId }),
  });
  return handle(res, 'Failed to match buyer');
}

export async function getAuthorities() {
  const res = await authFetch('/api/tenders/authorities');
  return handle(res, 'Failed to load authorities');
}

export async function getFilterRules() {
  const res = await authFetch('/api/tenders/filter-rules');
  return handle(res, 'Failed to load filter rules');
}

export async function createFilterRule(ruleType, value) {
  const res = await authFetch('/api/tenders/filter-rules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rule_type: ruleType, value }),
  });
  return handle(res, 'Failed to add filter rule');
}

export async function deleteFilterRule(id) {
  const res = await authFetch(`/api/tenders/filter-rules/${id}`, { method: 'DELETE' });
  return handle(res, 'Failed to delete filter rule');
}

export async function updateLlmPrompt(prompt) {
  const res = await authFetch('/api/tenders/filter-rules/llm-prompt', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  return handle(res, 'Failed to update LLM prompt');
}
