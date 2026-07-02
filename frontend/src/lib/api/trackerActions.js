const BASE = '/api/tracker';

export async function getTrackerActions(projectId) {
  const res = await fetch(`${BASE}/projects/${projectId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getStagedActions(projectId) {
  const res = await fetch(`${BASE}/projects/${projectId}/staged`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function confirmStagedActions(projectId, actions) {
  const res = await fetch(`${BASE}/projects/${projectId}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actions })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function dismissStagedActions(projectId, action_ids) {
  const res = await fetch(`${BASE}/projects/${projectId}/dismiss`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action_ids })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createTrackerAction(projectId, { title, owner }) {
  const res = await fetch(`${BASE}/projects/${projectId}/actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, owner })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateTrackerAction(actionId, fields) {
  const res = await fetch(`${BASE}/actions/${actionId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteTrackerAction(actionId) {
  const res = await fetch(`${BASE}/actions/${actionId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function intakeText(projectId, text) {
  const res = await fetch(`${BASE}/projects/${projectId}/intake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function saveIntakeUpdates(projectId, payload) {
  const res = await fetch(`${BASE}/projects/${projectId}/intake/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function addActionUpdate(actionId, { update_date, summary, full_text, source_type }) {
  const res = await fetch(`${BASE}/actions/${actionId}/updates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ update_date, summary, full_text, source_type })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteActionUpdate(updateId) {
  const res = await fetch(`${BASE}/updates/${updateId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
