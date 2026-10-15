// @ts-nocheck
import { authFetch } from './client.js';

async function json(res, fallback) {
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || fallback);
  }
  return res.json();
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// Whole workbook: { gate: [...], items: [...] } (each item carries its progress `log`)
export async function getWorkbook(projectId) {
  return json(await authFetch(`/api/workbook/projects/${projectId}`), 'Failed to load the workbook');
}

export async function updateGateQuestion(id, fields) {
  return json(await authFetch(`/api/workbook/gate-questions/${id}`, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(fields) }), 'Failed to save');
}

// Add a gate question. Resolves with the whole refreshed list (later questions shift down to make room): { gate: [...] }
export async function createGateQuestion(projectId, question) {
  return json(await authFetch(`/api/workbook/projects/${projectId}/gate-questions`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(question) }), 'Failed to add the gate question');
}

// Remove a gate question. Resolves with the refreshed workbook ({ gate, items }): rows linked to it lose that gate ref.
export async function deleteGateQuestion(id) {
  return json(await authFetch(`/api/workbook/gate-questions/${id}`, { method: 'DELETE' }), 'Failed to delete the gate question');
}

export async function createWorkbookItem(projectId, item) {
  return json(await authFetch(`/api/workbook/projects/${projectId}/items`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(item) }), 'Failed to add');
}

export async function updateWorkbookItem(id, fields) {
  return json(await authFetch(`/api/workbook/items/${id}`, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(fields) }), 'Failed to save');
}

export async function deleteWorkbookItem(id) {
  return json(await authFetch(`/api/workbook/items/${id}`, { method: 'DELETE' }), 'Failed to delete');
}

export async function addWorkbookProgress(itemId, entry) {
  return json(await authFetch(`/api/workbook/items/${itemId}/progress`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(entry) }), 'Failed to add progress');
}

export async function updateWorkbookProgress(id, fields) {
  return json(await authFetch(`/api/workbook/progress/${id}`, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(fields) }), 'Failed to save progress');
}

export async function deleteWorkbookProgress(id) {
  return json(await authFetch(`/api/workbook/progress/${id}`, { method: 'DELETE' }), 'Failed to delete progress');
}

// Notes kept on the workbook page (separate from the main Meeting Notes feature)
export async function listWorkbookNotes(projectId) {
  return json(await authFetch(`/api/workbook/projects/${projectId}/notes`), 'Failed to load notes');
}

export async function getWorkbookNote(id) {
  return json(await authFetch(`/api/workbook/notes/${id}`), 'Failed to load the note');
}

// Read an uploaded file (.docx, .pdf, .txt, .md) into plain text. Nothing is saved.
export async function parseWorkbookFile(projectId, file) {
  const form = new FormData();
  form.append('file', file);
  return json(await authFetch(`/api/workbook/projects/${projectId}/notes/parse`, { method: 'POST', body: form }), 'Could not read that file');
}

export async function deleteWorkbookNote(id) {
  return json(await authFetch(`/api/workbook/notes/${id}`, { method: 'DELETE' }), 'Failed to delete the note');
}

// Add advancement: draft proposals from a note (nothing is saved), then apply the ticked ones.
export async function suggestWorkbookAdvancement(projectId, { text, noteId, date, source }) {
  return json(await authFetch(`/api/workbook/projects/${projectId}/advancements/suggest`, {
    method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ text, note_id: noteId || null, date, source }),
  }), 'Failed to draft suggestions');
}

// saveNote: keep a copy of the notes on the workbook, stored now that the changes are applied (never when only drafting).
export async function applyWorkbookAdvancement(projectId, { ops, date, source, summary, noteId, saveNote, noteText, noteTitle }) {
  return json(await authFetch(`/api/workbook/projects/${projectId}/advancements/apply`, {
    method: 'POST', headers: JSON_HEADERS,
    body: JSON.stringify({ ops, date, source, summary, note_id: noteId || null, save_note: !!saveNote, note_text: saveNote ? noteText : undefined, note_title: saveNote ? noteTitle : undefined }),
  }), 'Failed to apply');
}
