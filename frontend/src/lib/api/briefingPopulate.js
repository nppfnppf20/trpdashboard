import { authFetch } from './client.js';

export async function getProjectCompleteness(projectId) {
  const res = await authFetch(`/api/planning-application/projects/${projectId}/completeness`);
  if (!res.ok) throw new Error('Failed to fetch project completeness');
  return res.json();
}

export async function populateFromBriefing(projectId) {
  const res = await authFetch(`/api/planning-application/projects/${projectId}/populate-from-briefing`, {
    method: 'POST'
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to populate from briefing');
  }
  return res.json(); // { suggestions: [...] }
}

export async function saveSuggestion(projectId, suggestion) {
  if (suggestion.type === 'document_summary') {
    const res = await authFetch(`/api/planning-application/projects/${projectId}/document-summaries/by-type`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: suggestion.label,
        doc_type: suggestion.doc_type,
        summary_html: suggestion.suggested_content
      })
    });
    if (!res.ok) throw new Error('Failed to save document summary suggestion');
    return res.json();
  }

  if (suggestion.type === 'issue_summary') {
    const res = await authFetch(`/api/planning-application/key-issues/${suggestion.track_id}/summary`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: suggestion.suggested_content })
    });
    if (!res.ok) throw new Error('Failed to save issue summary suggestion');
    return res.json();
  }

  throw new Error(`Unknown suggestion type: ${suggestion.type}`);
}
