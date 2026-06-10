import { authFetch } from '$lib/api/client.js';

const BASE = '/api/socioeconomics';

export async function saveSocioSession(projectId, csvData, sessionName = null) {
  const res = await authFetch(`${BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: projectId, csv_data: csvData, session_name: sessionName })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function listSocioSessions(projectId) {
  const res = await authFetch(`${BASE}/project/${projectId}/sessions`);
  if (!res.ok) throw new Error('Failed to list socio-economics sessions');
  return res.json();
}

export async function getSocioSession(sessionId) {
  const res = await authFetch(`${BASE}/sessions/${sessionId}`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || `HTTP ${res.status}`);
  }
  return res.json();
}
