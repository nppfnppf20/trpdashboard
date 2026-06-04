import { writable, get } from 'svelte/store';
import { getActionPrompt, saveActionPrompt, resetActionPrompt } from '$lib/api/planningApplication.js';

// Map of key → { open, text, loading, saving, saved }
const _states = writable({});

function initKey(key) {
  if (!get(_states)[key]) {
    _states.update(s => ({ ...s, [key]: { open: false, text: '', loading: false, saving: false, saved: false } }));
  }
}

export function actionPromptState(key) {
  return {
    subscribe: (cb) => _states.subscribe(s => cb(s[key] ?? { open: false, text: '', loading: false, saving: false, saved: false }))
  };
}

export function setPromptText(key, text) {
  _states.update(s => ({ ...s, [key]: { ...(s[key] ?? {}), text } }));
}

export async function openActionPrompt(key) {
  initKey(key);
  _states.update(s => ({ ...s, [key]: { ...s[key], open: true, loading: true } }));
  try {
    const data = await getActionPrompt(key);
    _states.update(s => ({ ...s, [key]: { ...s[key], text: data.prompt, loading: false } }));
  } catch {
    _states.update(s => ({ ...s, [key]: { ...s[key], loading: false } }));
  }
}

export function closeActionPrompt(key) {
  _states.update(s => ({ ...s, [key]: { ...s[key], open: false } }));
}

export async function saveActionPromptStore(key) {
  const text = get(_states)[key]?.text;
  if (!text?.trim()) return;
  _states.update(s => ({ ...s, [key]: { ...s[key], saving: true } }));
  try {
    await saveActionPrompt(key, text);
    _states.update(s => ({ ...s, [key]: { ...s[key], saving: false, saved: true } }));
    setTimeout(() => _states.update(s => ({ ...s, [key]: { ...s[key], saved: false } })), 2500);
  } catch {
    _states.update(s => ({ ...s, [key]: { ...s[key], saving: false } }));
  }
}

export async function resetActionPromptStore(key) {
  _states.update(s => ({ ...s, [key]: { ...s[key], saving: true } }));
  try {
    const data = await resetActionPrompt(key);
    _states.update(s => ({ ...s, [key]: { ...s[key], saving: false, text: data.prompt, saved: true } }));
    setTimeout(() => _states.update(s => ({ ...s, [key]: { ...s[key], saved: false } })), 2500);
  } catch {
    _states.update(s => ({ ...s, [key]: { ...s[key], saving: false } }));
  }
}
