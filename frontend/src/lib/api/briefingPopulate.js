import { authFetch } from './client.js';
import { createIssueTrack } from '$lib/services/workflowApi.js';

export async function getProjectCompleteness(projectId) {
  const res = await authFetch(`/api/planning-application/projects/${projectId}/completeness`);
  if (!res.ok) throw new Error('Failed to fetch project completeness');
  return res.json();
}

export async function getBriefingTranscripts(projectId) {
  const res = await authFetch(`/api/planning-application/projects/${projectId}/document-summaries`);
  if (!res.ok) throw new Error('Failed to fetch document summaries');
  const all = await res.json();
  return all.filter(s => s.doc_type === 'briefing_transcript');
}

export async function populateFromBriefing(projectId, briefingId = null) {
  const res = await authFetch(`/api/planning-application/projects/${projectId}/populate-from-briefing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(briefingId ? { briefing_id: briefingId } : {})
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

  if (suggestion.type === 'new_issue') {
    const created = await createIssueTrack(projectId, {
      label: suggestion.suggested_label,
      discipline: suggestion.suggested_discipline,
      issue_type_id: suggestion.matched_issue_type_id ?? null,
      sortOrder: null,
      riskLevel: null,
      isKeyIssue: false,
    });
    if (suggestion.suggested_content?.trim()) {
      const res = await authFetch(`/api/planning-application/key-issues/${created.id}/summary`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: suggestion.suggested_content })
      });
      if (!res.ok) throw new Error('Issue was created but saving its summary failed');
    }
    return created;
  }

  throw new Error(`Unknown suggestion type: ${suggestion.type}`);
}
