import { callLLM, parseJSON, resolveProvider, noEmDash } from './llm.shared.js';
import { chunkText } from './parser.service.js';

// One-off, AI-assisted bulk extraction of the NPPF's own policies into the
// canonical library (admin_console.nppf_policies) — see [[project_nppf_policy_bank]].
// Reviewed by hand (with a verbatim-check flag) before anything is saved,
// same recipe as conditionsExtraction.service.js.
//
// The NPPF is long enough that a single LLM call risks two different
// truncation failures: the input being cut off, and — since we're asking
// for many policies' full verbatim text back in one response — the output
// hitting its token cap mid-JSON (the exact bug that broke "Extract Policy
// Wording" on this same document). So this runs as a sequential batch: the
// document is split into ~24,000-char sections (with a one-chunk overlap so
// a policy sitting on a section boundary is still whole in at least one
// pass), each is sent through its own extraction call, and results are
// merged and de-duplicated.

const SYSTEM = `You are a specialist planning consultant extracting the individual policies from the National Planning Policy Framework (NPPF) so they can be logged in a canonical reference library, used across every project instead of re-transcribing this document by hand each time.

VERBATIM RULE — this is the most important instruction: "policy_reference", "policy_name" and "policy_text" must all be copied WORD-FOR-WORD from the document, exactly as printed, including punctuation and capitalisation. Do not paraphrase, reformat, renumber, or invent wording.

SCOPE — this library is used when preparing and assessing individual planning applications, not for plan-making. The NPPF distinguishes plan-making policies (guidance for local planning authorities preparing, reviewing, or updating their Local Plan, e.g. housing requirement methodology, Local Plan review cycles, the plan-making evidence base) from decision-making policies (guidance applied when determining an individual planning application, e.g. the presumption in favour, weighing harm against benefit, conditions, how to treat departures from the plan). Extract ONLY policies that are for decision-making, or that explicitly apply to both plan-making and decision-making. Skip any policy that concerns only how a Local Plan is prepared, reviewed, or adopted, with no bearing on determining individual applications.

Extract every distinct decision-making policy in the order it appears in the document.

Field rules:
- policy_reference: the policy's own reference/number exactly as given in the document, whatever numbering or labelling scheme this edition uses.
- policy_name: the policy's title/heading exactly as printed alongside its reference.
- policy_text: the full verbatim operative wording of the policy. Exclude any surrounding narrative, explanatory, or introductory paragraphs that sit between policies but aren't themselves part of the policy's operative wording.

Never use an em dash (—); use a comma, colon, or rewrite the sentence instead.

Respond with JSON only — no markdown, no explanation:
{
  "policies": [
    { "policy_reference": string, "policy_name": string, "policy_text": string }
  ]
}`;

const RAW_CHUNKS_PER_BATCH = 4; // chunkText's chunks are ~6,000 chars each, so ~24,000 chars/batch
const BATCH_OVERLAP = 1;        // re-send the previous batch's last chunk so boundary policies aren't split
const MAX_BATCHES = 15;         // safety cap (~360,000 chars) — comfortably covers a full NPPF-sized document

function buildBatches(rawText) {
  const chunks = chunkText(rawText || '');
  const batches = [];
  for (let i = 0; i < chunks.length && batches.length < MAX_BATCHES; i += RAW_CHUNKS_PER_BATCH) {
    const start = Math.max(0, i - BATCH_OVERLAP);
    batches.push(chunks.slice(start, i + RAW_CHUNKS_PER_BATCH).join('\n\n'));
  }
  return batches;
}

/**
 * @param {string} text - parsed NPPF document text
 * @param {string|null} provider - explicit 'anthropic'/'openai' override, or null for the central setting
 * @returns {Promise<{policies: Array<{policy_reference:string, policy_name:string, policy_text:string}>, warning:string|null}|null>}
 */
export async function extractNppfPoliciesFromText(text, provider = null) {
  const batches = buildBatches(text);
  if (!batches.length) return null;

  const resolvedProvider = await resolveProvider('nppf_extraction', provider);
  const seen = new Set();
  const policies = [];
  let failedBatches = 0;

  // Sequential, not parallel: keeps each call's output small enough to stay
  // well under the token cap, and avoids firing many large calls at once.
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const user = `The following is one section of a larger NPPF document (other sections are sent separately) — extract only the decision-making policies found in THIS section:\n\n${batch}`;
    let raw, parsed;
    try {
      raw = await callLLM({ provider: resolvedProvider, system: SYSTEM, prompt: user, maxTokens: 12000, jsonMode: true });
      parsed = parseJSON(raw);
    } catch (err) {
      console.error(`[extractNppfPoliciesFromText] batch ${i + 1}/${batches.length} failed:`, err.message);
      failedBatches++;
      continue;
    }
    if (!parsed || !Array.isArray(parsed.policies)) {
      console.error(`[extractNppfPoliciesFromText] batch ${i + 1}/${batches.length} returned no "policies" array. Raw response (first 300 chars):`, raw?.slice(0, 300));
      failedBatches++;
      continue;
    }
    console.log(`[extractNppfPoliciesFromText] batch ${i + 1}/${batches.length}: ${parsed.policies.length} polic${parsed.policies.length === 1 ? 'y' : 'ies'} found`);
    if (parsed.policies.length === 0) {
      console.log(`[extractNppfPoliciesFromText] batch ${i + 1}/${batches.length} source excerpt (first 200 chars):`, batch.slice(0, 200));
    }

    for (const p of parsed.policies) {
      if (!p || typeof p.policy_text !== 'string' || !p.policy_text.trim()) continue;
      const policy_reference = typeof p.policy_reference === 'string' && p.policy_reference.trim() ? noEmDash(p.policy_reference.trim()) : '';
      const policy_name = typeof p.policy_name === 'string' && p.policy_name.trim() ? p.policy_name.trim() : '';
      const policy_text = p.policy_text.trim();
      // De-dupes policies re-caught by the batch overlap (and any the model
      // genuinely repeats), keyed on reference+name rather than text, since
      // a policy's wording is what we're relying on the key to distinguish it from.
      const key = `${policy_reference.toLowerCase()}|${policy_name.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      policies.push({ policy_reference, policy_name, policy_text });
    }
  }

  // Always return an object once we've actually tried (not null) so the
  // caller can tell "ran but found nothing" apart from "couldn't run at
  // all" — the two look identical to the user otherwise.
  return {
    policies,
    warning: failedBatches > 0
      ? `${failedBatches} of ${batches.length} document section(s) could not be processed — some policies may be missing. Check the source document directly for that section.`
      : !policies.length
        ? `Processed ${batches.length} section(s) of the document but found no decision-making policies in any of them — check the backend server console for a per-section breakdown.`
        : null,
  };
}
