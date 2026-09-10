import { writable } from 'svelte/store';
import { getLlmStatus } from '$lib/api/llmStatus.js';

// { anthropic: null | { message, since }, openai: null | { message, since } }
export const llmProviderStatus = writable({ anthropic: null, openai: null });

let pollHandle = null;

async function refresh() {
  try {
    llmProviderStatus.set(await getLlmStatus());
  } catch (err) {
    console.warn('Failed to fetch LLM provider status:', err);
  }
}

// Polls the backend's per-provider credit/quota status. Safe to call more
// than once (e.g. from an $effect that re-fires) — only the first call
// actually starts an interval. Returns a cleanup function.
export function startLlmStatusPolling(intervalMs = 60000) {
  if (pollHandle) return () => {};
  refresh();
  pollHandle = setInterval(refresh, intervalMs);
  return () => {
    clearInterval(pollHandle);
    pollHandle = null;
  };
}
