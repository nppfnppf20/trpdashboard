import { callLLM, parseJSON, resolveProvider } from './llm.shared.js';

// Extracts planning conditions from an uploaded decision notice (PDF/Word)
// to prefill the Conditions Tracker's "Add Conditions" bulk form. The user
// reviews every row (a verbatim-check flag highlights anything that looks
// paraphrased, see verbatimCheck.service.js) before anything is saved.

const SYSTEM = `You are a planning consultant assistant. You will be given the text of a local planning authority decision notice granting planning permission subject to conditions. Extract every condition and informative into structured JSON so it can prefill a bulk "Add Conditions" form.

VERBATIM RULE — this is the most important instruction, and it applies to every field except "title": the "wording", "reason", and each requirement's "requirement_text" must be copied WORD-FOR-WORD from the document. Do not paraphrase, shorten, retitle, correct grammar, merge lines, or renumber sub-parts. If a condition has no separately stated reason, use null rather than inventing one.

Extract items in the order they appear in the document, numbered conditions first, followed by any informatives.

Do not classify or guess a "type" for each item (e.g. Pre-Commencement, Informative, Compliance) — that judgement is left to the user reviewing the extraction, so there is no "condition_type" field to fill in.

Field rules:
- title: a SHORT descriptive label (a few words) summarising the condition's subject, e.g. "Landscaping scheme" or "Contaminated land". Decision notices don't usually give conditions titles, so this field is the one exception to the verbatim rule — write your own short label, do not quote the document here. Null only if you cannot summarise it at all.
- wording: the full verbatim text of the condition or informative, exactly as printed, including any lettered/numbered sub-parts inline.
- reason: the verbatim reason given for the condition, exactly as printed — often directly beneath the condition, or grouped together in a "Reasons for Conditions" section keyed by condition number. Match reasons back to the correct condition. Null if none is stated (informatives typically have no separate reason).
- requirements: split into separate rows ONLY where the lettered/numbered items are genuinely distinct pieces of work that would be progressed, monitored, or discharged separately, each in its own right. Do NOT split when the list is really one of these two shapes, even though it's lettered:
  (i) ALTERNATIVES — an either/or list satisfying one single requirement. Example (NOT split, one requirement): "...shall not commence unless the Local Planning Authority has been provided with either: a) A licence issued by Natural England...; or b) A statement in writing from Natural England that a licence is not required." That's one requirement with two ways to satisfy it, not two requirements.
  (ii) CONTENTS OF ONE DELIVERABLE — a list specifying what a single document/strategy/scheme must contain. Example (NOT split, one requirement): "...a Farmland Bird Compensation Strategy shall be submitted... The Strategy shall include: a) Purpose and objectives; b) Detailed methodology; c) Location of measures; d) Mechanism for implementation and monitoring." Those four letters are the contents of one strategy, not four requirements — there is one thing to submit and implement.
  DO split when each lettered item is its own actionable stage with its own trigger/gate, genuinely separate work to progress one at a time. Example (SPLIT into four requirements): a phased archaeological condition where (A) securing a Written Scheme of Investigation is agreed, (B) an evaluation is then completed, (C) a mitigation WSI is then submitted, and (D) fieldwork is then completed and approved — four sequential, separately-trackable stages.
  The test: would someone tick these off one at a time as separate pieces of work in progress? If yes, split. If the list is really describing one requirement (alternatives, or the contents of one thing), do not split — leave it as a single condition with an empty requirements array, keeping the full lettered list inline in "wording".
  Each split-out entry: { "requirement_text": the verbatim text of that sub-part }.

Respond with JSON only — no markdown, no explanation:
{
  "conditions": [
    { "title": string | null, "wording": string, "reason": string | null, "requirements": [ { "requirement_text": string } ] }
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
