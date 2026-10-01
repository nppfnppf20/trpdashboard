// @ts-nocheck
// Voice dictation — records-then-transcribes via the backend's Whisper proxy
import { authFetch } from './client.js';

export async function transcribeAudio(blob) {
  const formData = new FormData();
  formData.append('audio', blob, 'dictation.webm');
  const res = await authFetch('/api/voice/transcribe', {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.details ? `${e.error || 'Failed to transcribe audio'}: ${e.details}` : (e.error || `Failed to transcribe audio (HTTP ${res.status})`));
  }
  const { text } = await res.json();
  return text;
}
