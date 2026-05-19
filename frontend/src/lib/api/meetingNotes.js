import { authFetch } from './client.js';

export async function processMeetingNote(projectId, { file, text, fileName, title, meetingDate, attendeesText, userNotes }) {
  const formData = new FormData();
  formData.append('title', title);
  if (meetingDate) formData.append('meeting_date', meetingDate);
  if (attendeesText) formData.append('attendees_text', attendeesText);
  if (userNotes) formData.append('user_notes', userNotes);

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

export async function createMeetingAction(projectId, { action_text, owner, due_date, notes }) {
  const res = await authFetch(`/api/meeting-notes/projects/${projectId}/actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action_text, owner, due_date, notes })
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
