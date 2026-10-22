import { authFetch } from './client.js';
import { expandActionOwners } from '$lib/utils/meetingActions.js';

export async function processMeetingNote(projectId, { file, text, fileName, userNotes, agenda, summaryType, customPrompt, provider }) {
  const formData = new FormData();
  if (userNotes) formData.append('user_notes', userNotes);
  if (agenda) formData.append('agenda', agenda);
  if (summaryType) formData.append('summary_type', summaryType);
  if (customPrompt) formData.append('custom_prompt', customPrompt);
  if (provider) formData.append('provider', provider);

  if (file) {
    formData.append('file', file);
  } else {
    formData.append('text', text);
    if (fileName) formData.append('file_name', fileName);
  }

  const res = await authFetch(`/api/meeting-notes/projects/${projectId}/process`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to process meeting note');
  }
  return res.json(); // { transcript, summary, actions }
}

export async function saveVerbatimMeetingNote(projectId, { file, text, fileName, title, meetingDate }) {
  const formData = new FormData();
  formData.append('title', title);
  // The date of the note or document (YYYY-MM-DD); left out means the server uses today
  if (meetingDate) formData.append('meeting_date', meetingDate);

  if (file) {
    formData.append('file', file);
  } else {
    formData.append('text', text);
    if (fileName) formData.append('file_name', fileName);
  }

  const res = await authFetch(`/api/meeting-notes/projects/${projectId}/save-verbatim`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to save meeting note');
  }
  return res.json(); // { transcript, summary }
}

export async function getMeetingNotes(projectId) {
  const res = await authFetch(`/api/meeting-notes/projects/${projectId}`);
  if (!res.ok) throw new Error('Failed to fetch meeting notes');
  return res.json();
}

export async function getMeetingTranscript(meetingId) {
  const res = await authFetch(`/api/meeting-notes/${meetingId}/transcript`);
  if (!res.ok) throw new Error('Failed to fetch transcript');
  return res.json();
}

// Saves the formatted (bold / highlight / line breaks) version of a transcript.
// The transcript text itself is never changed by this.
export async function saveTranscriptAnnotated(meetingId, html) {
  const res = await authFetch(`/api/meeting-notes/${meetingId}/transcript-annotated`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html })
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to save formatting');
  }
  return res.json();
}

export async function updateMeetingSummary(meetingId, summaryHtml) {
  const res = await authFetch(`/api/meeting-notes/${meetingId}/summary`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary_html: summaryHtml })
  });
  if (!res.ok) throw new Error('Failed to update summary');
  return res.json();
}

export async function updateMeetingNote(meetingId, { title, meeting_date, attendees_text }) {
  const res = await authFetch(`/api/meeting-notes/${meetingId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, meeting_date, attendees_text })
  });
  if (!res.ok) throw new Error('Failed to update meeting note');
  return res.json();
}

export async function deleteMeetingNote(meetingId) {
  const res = await authFetch(`/api/meeting-notes/${meetingId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete meeting note');
  return res.json();
}

export async function getMeetingActions(projectId, status = null) {
  const url = status
    ? `/api/meeting-notes/projects/${projectId}/actions?status=${status}`
    : `/api/meeting-notes/projects/${projectId}/actions`;
  const res = await authFetch(url);
  if (!res.ok) throw new Error('Failed to fetch actions');
  return res.json();
}

export async function createMeetingAction(projectId, { action_text, owner, due_date, notes, transcript_id }) {
  const res = await authFetch(`/api/meeting-notes/projects/${projectId}/actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action_text, owner, due_date, notes, transcript_id })
  });
  if (!res.ok) throw new Error('Failed to create action');
  return res.json();
}

export async function updateMeetingAction(actionId, fields) {
  const res = await authFetch(`/api/meeting-notes/actions/${actionId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields)
  });
  if (!res.ok) throw new Error('Failed to update action');
  return res.json();
}

export async function deleteMeetingAction(actionId) {
  const res = await authFetch(`/api/meeting-notes/actions/${actionId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete action');
  return res.json();
}

export async function processInternalNote(meetingType, { file, text, fileName, userNotes, agenda, summaryType, customPrompt }) {
  const formData = new FormData();
  formData.append('meeting_type', meetingType);
  if (userNotes) formData.append('user_notes', userNotes);
  if (agenda) formData.append('agenda', agenda);
  if (summaryType) formData.append('summary_type', summaryType);
  if (customPrompt) formData.append('custom_prompt', customPrompt);

  if (file) {
    formData.append('file', file);
  } else {
    formData.append('text', text);
    if (fileName) formData.append('file_name', fileName);
  }

  const res = await authFetch('/api/meeting-notes/internal/process', {
    method: 'POST',
    body: formData
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to process meeting note');
  }
  return res.json();
}

export async function processMultiProjectNote({ file, text, fileName, projectIds, createIndividual, createCombined, userNotes, agenda, summaryType, customPrompt, provider }) {
  const formData = new FormData();
  formData.append('project_ids', JSON.stringify(projectIds));
  formData.append('create_individual', createIndividual !== false ? 'true' : 'false');
  formData.append('create_combined', createCombined !== false ? 'true' : 'false');
  if (userNotes) formData.append('user_notes', userNotes);
  if (agenda) formData.append('agenda', agenda);
  if (summaryType) formData.append('summary_type', summaryType);
  if (customPrompt) formData.append('custom_prompt', customPrompt);
  if (provider) formData.append('provider', provider);

  if (file) {
    formData.append('file', file);
  } else {
    formData.append('text', text);
    if (fileName) formData.append('file_name', fileName);
  }

  const res = await authFetch('/api/meeting-notes/multi-project/process', {
    method: 'POST',
    body: formData
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to process multi-project meeting note');
  }
  return res.json(); // { batchId, transcriptMeta, projectNotes, combinedNote }
}

export async function getAllMeetingNotes(type = null) {
  const url = type ? `/api/meeting-notes?type=${type}` : '/api/meeting-notes';
  const res = await authFetch(url);
  if (!res.ok) throw new Error('Failed to fetch meeting notes');
  return res.json();
}

export async function getMeetingNoteActions(meetingId) {
  const res = await authFetch(`/api/meeting-notes/${meetingId}/actions`);
  if (!res.ok) throw new Error('Failed to fetch actions');
  return res.json();
}

export async function saveExtractedInsights(transcriptId, insights) {
  const res = await authFetch(`/api/meeting-notes/${transcriptId}/insights`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ insights })
  });
  if (!res.ok) throw new Error('Failed to save insights');
  return res.json();
}

export async function createStandaloneAction(transcriptId, { action_text, owner, due_date, notes }) {
  const res = await authFetch('/api/meeting-notes/actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript_id: transcriptId, action_text, owner, due_date, notes })
  });
  if (!res.ok) throw new Error('Failed to create action');
  return res.json();
}

// Persist what was confirmed in the review modal: new actions become rows,
// updates on existing open actions are logged (and 'complete' ones close them).
export async function saveMeetingReviewActions(meetingId, { newActions, updates }) {
  const res = await authFetch(`/api/meeting-notes/${meetingId}/review-actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newActions: expandActionOwners(newActions), updates })
  });
  if (!res.ok) throw new Error('Failed to save actions');
  return res.json();
}

// Log a progress note on an action, or resolve it (update_type 'completed').
export async function addMeetingActionUpdate(actionId, { update_type, update_text = null }) {
  const res = await authFetch(`/api/meeting-notes/actions/${actionId}/updates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ update_type, update_text })
  });
  if (!res.ok) throw new Error('Failed to save update');
  return res.json();
}
