// @ts-nocheck
import { authFetch } from './client.js';

export async function processPublicCommentDoc(projectId, { file, text, fileName, userNotes }) {
  const formData = new FormData();
  if (file) {
    formData.append('file', file);
  } else {
    formData.append('text', text);
    if (fileName) formData.append('file_name', fileName);
  }
  if (userNotes) formData.append('user_notes', userNotes);
  const res = await authFetch(`/api/public-comments/projects/${projectId}/process`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to process comment');
  }
  return res.json();
}

export async function getPublicCommentsData(projectId) {
  const res = await authFetch(`/api/public-comments/projects/${projectId}`);
  if (!res.ok) throw new Error('Failed to fetch public comments');
  return res.json();
}

export async function createPublicComment(projectId, fields) {
  const res = await authFetch(`/api/public-comments/projects/${projectId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to create comment');
  }
  return res.json();
}

export async function updatePublicComment(commentId, fields) {
  const res = await authFetch(`/api/public-comments/comments/${commentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error('Failed to update comment');
  return res.json();
}

export async function deletePublicComment(commentId) {
  const res = await authFetch(`/api/public-comments/comments/${commentId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete comment');
  return res.json();
}

export async function runPublicCommentAnalysis(projectId) {
  const res = await authFetch(`/api/public-comments/projects/${projectId}/analyse`, { method: 'POST' });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to run analysis');
  }
  return res.json();
}
