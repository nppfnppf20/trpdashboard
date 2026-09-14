import { authFetch } from './client.js';

const API_BASE_URL = '/api/email-tones';

export async function getEmailTones() {
  const res = await authFetch(API_BASE_URL);
  if (!res.ok) throw new Error('Failed to load email tones');
  return res.json();
}

export async function createEmailTone({ label, sampleText, isDefault }) {
  const res = await authFetch(API_BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label, sampleText, isDefault }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to create tone');
  }
  return res.json();
}

export async function updateEmailTone(id, { label, sampleText, isDefault }) {
  const res = await authFetch(`${API_BASE_URL}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label, sampleText, isDefault }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to update tone');
  }
  return res.json();
}

export async function deleteEmailTone(id) {
  const res = await authFetch(`${API_BASE_URL}/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to delete tone');
  }
}
