import { authFetch } from './client.js';

export async function processMeetingNote(projectId, { file, text, fileName, userNotes, agenda, summaryType, customPrompt }) {
  const formData = new FormData();
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

export async function createStandaloneAction(transcriptId, { action_text, owner, due_date, notes }) {
  const res = await authFetch('/api/meeting-notes/actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript_id: transcriptId, action_text, owner, due_date, notes })
  });
  if (!res.ok) throw new Error('Failed to create action');
  return res.json();
}
