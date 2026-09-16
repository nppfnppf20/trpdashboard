import { callLLM, parseJSON, resolveProvider } from './llm.shared.js';

// Extracts planning conditions from an uploaded decision notice (PDF/Word)
// to prefill the Conditions Tracker's "Add Conditions" bulk form. The user
// reviews every row (a verbatim-check flag highlights anything that looks
// paraphrased, see verbatimCheck.service.js) before anything is saved.

const TYPE_OPTIONS = [
  'Pre-Commencement',
  'Pre-Beneficial Use',
  'Action Required (not Pre-Commencement)',
  'Compliance',
  'Informative',
];

const SYSTEM = `You are a planning consultant assistant. You will be given the text of a local planning authority decision notice granting planning permission subject to conditions. Extract every condition and informative into structured JSON so it can prefill a bulk "Add Conditions" form.

VERBATIM RULE — this is the most important instruction, and it applies to every field except "title": the "wording", "reason", and each requirement's "requirement_text" must be copied WORD-FOR-WORD from the document. Do not paraphrase, shorten, retitle, correct grammar, merge lines, or renumber sub-parts. If a condition has no separately stated reason, use null rather than inventing one.

Extract items in the order they appear in the document, numbered conditions first, followed by any informatives.

Field rules:
- condition_type: your best judgement of which of these categories the item belongs to, based on its wording and where it sits in the document — one of: ${TYPE_OPTIONS.map(t => `"${t}"`).join(', ')}. Typical signals: wording requiring action "before development commences" is Pre-Commencement; "before the development is occupied/brought into use" is Pre-Beneficial Use; a condition tying the development to the approved plans with nothing further to discharge is Compliance; items under an "Informative(s)"/"Note(s)" heading (not numbered as conditions) are Informative. Use null only if genuinely unclear.
- title: a SHORT descriptive label (a few words) summarising the condition's subject, e.g. "Landscaping scheme" or "Contaminated land". Decision notices don't usually give conditions titles, so this field is the one exception to the verbatim rule — write your own short label, do not quote the document here. Null only if you cannot summarise it at all.
- wording: the full verbatim text of the condition or informative, exactly as printed, including any lettered/numbered sub-parts inline.
- reason: the verbatim reason given for the condition, exactly as printed — often directly beneath the condition, or grouped together in a "Reasons for Conditions" section keyed by condition number. Match reasons back to the correct condition. Null if none is stated (informatives typically have no separate reason).
- requirements: where — and only where — the document itself splits the condition into lettered or numbered sub-parts (e.g. "(a) ... (b) ..."), one entry per sub-part: { "requirement_text": the verbatim text of that sub-part }. Empty array when the condition is not sub-divided.

Respond with JSON only — no markdown, no explanation:
{
  "conditions": [
    { "condition_type": string | null, "title": string | null, "wording": string, "reason": string | null, "requirements": [ { "requirement_text": string } ] }
  ]
}`;

/**
 * Extract conditions from parsed decision notice text.
 * @param {string} text - Parsed document text
 * @param {string|null} fileName - Original file name, for context
 * @param {string|null} provider - explicit 'anthropic'/'openai' override, or null to use the central setting
 * @returns {Promise<object|null>} extraction JSON, or null if unparseable
 */
export async function extractConditionsFromText(text, fileName = null, provider = null) {
  const user = `Decision notice${fileName ? ` (${fileName})` : ''}:

${(text || '').slice(0, 100000)}`;

  const resolvedProvider = await resolveProvider('conditions_extraction', provider);
  const raw = await callLLM({ provider: resolvedProvider, system: SYSTEM, prompt: user, maxTokens: 16000, jsonMode: true });
  const parsed = parseJSON(raw);
  if (!parsed || !Array.isArray(parsed.conditions)) return null;

  parsed.conditions = parsed.conditions
    .filter(c => c && typeof c.wording === 'string' && c.wording.trim())
    .map(c => ({
      condition_type: TYPE_OPTIONS.includes(c.condition_type) ? c.condition_type : null,
      title: typeof c.title === 'string' && c.title.trim() ? c.title.trim() : null,
      wording: c.wording.trim(),
      reason: typeof c.reason === 'string' && c.reason.trim() ? c.reason.trim() : null,
      requirements: Array.isArray(c.requirements)
        ? c.requirements
          .filter(r => r && typeof r.requirement_text === 'string' && r.requirement_text.trim())
          .map(r => ({ requirement_text: r.requirement_text.trim() }))
        : [],
    }));

  return parsed;
}
