/**
 * Voice dictation — transcribes recorded audio via OpenAI's Whisper API.
 */

import { openaiClient } from './llm.shared.js';
import { toFile } from 'openai';

// Whisper invents stock phrases ("Thank you.", "Thanks for watching") when it is given silence or
// background noise, because those are common endings in its training data. verbose_json gives each
// segment a no_speech_prob and avg_logprob, so we can drop segments the model itself thinks aren't speech.
const NO_SPEECH_PROB_HARD = 0.6;   // above this the segment is treated as silence outright
const NO_SPEECH_PROB_SOFT = 0.4;   // above this, silence only if the model is also unsure of its words...
const AVG_LOGPROB_UNSURE = -1.0;   // ...i.e. avg_logprob below this

// Whole transcript is nothing but one of these (repeated), e.g. "Thank you. Thank you." — treat as silence.
const STOCK_HALLUCINATION = /^(?:(?:thank you(?: so much)?|thanks(?: for watching)?|thanks for watching!?|bye|goodbye|you|okay|ok|so)[\s.,!?]*)+$/i;

function isSilentSegment(seg) {
  if (seg.no_speech_prob > NO_SPEECH_PROB_HARD) return true;
  return seg.no_speech_prob > NO_SPEECH_PROB_SOFT && seg.avg_logprob < AVG_LOGPROB_UNSURE;
}

export async function transcribeAudio(buffer, mimetype) {
  const ext = mimetype?.includes('mp4') ? 'mp4' : mimetype?.includes('wav') ? 'wav' : 'webm';
  const file = await toFile(buffer, `dictation.${ext}`, { type: mimetype || 'audio/webm' });
  const result = await openaiClient.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    response_format: 'verbose_json',
  });

  const segments = Array.isArray(result.segments) ? result.segments : null;
  const kept = segments ? segments.filter(seg => !isSilentSegment(seg)) : null;
  if (segments && segments.length !== kept.length) {
    console.log(`[voice] dropped ${segments.length - kept.length}/${segments.length} silent segment(s):`,
      segments.filter(isSilentSegment).map(s => ({ text: s.text, no_speech_prob: s.no_speech_prob, avg_logprob: s.avg_logprob })));
  }

  const text = (kept ? kept.map(seg => seg.text).join(' ') : (result.text || ''))
    .replace(/\s+/g, ' ')
    .trim();

  // A lone stock phrase on its own is almost certainly the silence artefact, even if the
  // per-segment probabilities didn't flag it
  if (STOCK_HALLUCINATION.test(text)) return '';
  return text;
}
