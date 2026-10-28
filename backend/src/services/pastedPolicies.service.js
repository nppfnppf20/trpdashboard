import { callLLM, parseJSON, resolveProvider } from './llm.shared.js';
import { verbatimScore } from './verbatimCheck.service.js';

// The shared checker compares words with their punctuation attached, so a
// correctly copied "H1" fails against a pasted "H1:", and short fields (a
// reference or title is only a word or two) flip between 0% and 100% on that
// alone. Here the comparison is on the words only: quotes, dashes, brackets
// and spacing are ignored. A field passes if it appears as an unbroken run in
// the pasted text, or, for a field the AI has stitched together from separate
// parts of the paste, if nearly all its word pairs do.
const PASTE_THRESHOLD = 0.9;

function wordsOnly(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function checkPasted(extracted, source) {
  const field = wordsOnly(extracted);
  if (!field) return { verified: true, score: 1 };
  const haystack = wordsOnly(source);
  if (` ${haystack} `.includes(` ${field} `)) return { verified: true, score: 1 };
  const score = Math.round(verbatimScore(field, haystack) * 100) / 100;
  return { verified: score >= PASTE_THRESHOLD, score };
}

// Sorts a block of text the user pasted for ONE policy into the policy form's
// fields (reference, name, type, wording, supporting text). The LLM only
// decides where the text splits, never what it says, and every field is then
// run through the verbatim check against the pasted text so any rewording is
// flagged before the user saves.

const MAX_PASTE_CHARS = 30000;

const SYSTEM = `You are a specialist planning consultant. The user has copied and pasted the text of a SINGLE planning policy from a plan or guidance document. Sort the pasted text into the fields below.

VERBATIM RULE, the most important instruction: every field must be copied WORD-FOR-WORD from the pasted text, exactly as given, including punctuation, capitalisation, numbering and clause labels such as (a), (b), (i). Do not paraphrase, summarise, correct, reformat, renumber or invent wording. Do not add anything that is not in the pasted text.

Fields:
- policy_reference: the policy's own reference/number as printed (e.g. "Policy H1", "DM12", "Paragraph 11"). Empty string if none is given.
- policy_name: the policy's title/heading as printed. Empty string if none is given.
- policy_type: one of "national", "local", "neighbourhood", "supplementary", "other". Judge from the reference and wording (NPPF paragraphs are "national"; a Neighbourhood Plan policy is "neighbourhood"; supporting design guides and SPDs are "supplementary"). If unsure use "local".
- policy_text: the operative policy wording, copied in full.
- relevant_supporting_text: any supporting/reasoned justification, explanatory text or footnotes that were pasted after or alongside the policy. Empty string if there is none.

Do not drop any of the pasted text: each part of it belongs in exactly one field, except a heading or reference that has been used for policy_reference / policy_name (which does not need repeating inside policy_text).

Never use an em dash in anything you write yourself; the copied fields stay exactly as pasted.

Respond with JSON only, no markdown, no explanation:
{ "policy_reference": string, "policy_name": string, "policy_type": string, "policy_text": string, "relevant_supporting_text": string }`;

const TYPES = new Set(['national', 'local', 'neighbourhood', 'supplementary', 'other']);

async function sortOne(text, provider) {
  const raw = await callLLM({ provider, system: SYSTEM, prompt: `Pasted policy text:\n\n${text}`, maxTokens: 8000, jsonMode: true });
  const parsed = parseJSON(raw);
  if (!parsed || typeof parsed !== 'object') throw new Error('Unexpected response from the AI');

  const str = v => (typeof v === 'string' ? v.trim() : '');
  const policy_reference = str(parsed.policy_reference);
  const policy_name = str(parsed.policy_name);
  const policy_text = str(parsed.policy_text);
  const relevant_supporting_text = str(parsed.relevant_supporting_text);
  if (!policy_text && !policy_name) throw new Error('Could not find any policy wording in that text');

  return {
    policy_reference,
    policy_name,
    policy_type: TYPES.has(parsed.policy_type) ? parsed.policy_type : 'local',
    policy_text,
    relevant_supporting_text,
    _verbatim: {
      policy_reference: checkPasted(policy_reference, text),
      policy_name: checkPasted(policy_name, text),
      policy_text: checkPasted(policy_text, text),
      relevant_supporting_text: checkPasted(relevant_supporting_text, text),
    },
  };
}

/**
 * @param {string[]} texts - one pasted block per policy
 * @param {string|null} provider
 * @returns {Promise<Array<{ok: true, policy: object, source_text: string} | {ok: false, error: string, source_text: string}>>}
 *   one result per input, in the same order
 */
export async function sortPastedPolicies(texts, provider = null) {
  const resolved = await resolveProvider('policy_paste_sort', provider);
  return Promise.all(texts.map(async source => {
    if (source.length > MAX_PASTE_CHARS) {
      return { ok: false, error: `Too long (over ${MAX_PASTE_CHARS.toLocaleString()} characters): paste one policy at a time`, source_text: source };
    }
    try {
      const policy = await sortOne(source, resolved);
      return { ok: true, policy, source_text: source };
    } catch (err) {
      console.error('[sortPastedPolicies] failed:', err.message);
      return { ok: false, error: err.message || 'Could not sort that text', source_text: source };
    }
  }));
}
