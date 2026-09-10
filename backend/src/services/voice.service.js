/**
 * Voice dictation — transcribes recorded audio via OpenAI's Whisper API.
 */

import { openaiClient } from './llm.shared.js';
import { toFile } from 'openai';

export async function transcribeAudio(buffer, mimetype) {
  const ext = mimetype?.includes('mp4') ? 'mp4' : mimetype?.includes('wav') ? 'wav' : 'webm';
  const file = await toFile(buffer, `dictation.${ext}`, { type: mimetype || 'audio/webm' });
  const result = await openaiClient.audio.transcriptions.create({
    file,
    model: 'whisper-1',
  });
  return (result.text || '').trim();
}
