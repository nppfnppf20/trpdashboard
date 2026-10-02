/**
 * Full-text deep read of one Appealbase decision with Sonnet. Spends Appealbase calls (1 per 100k-char chunk)
 * plus Sonnet tokens.
 *
 * Quotes are verified against the full text in code; unverified quotes are dropped,
 * planning_balance.present needs a verified conclusion quote, and usable_points without a verified quote are removed.
 */

import fs from 'fs';
import { PROJECT, issueListText } from './appealbaseScoring.js';
import { makeFinder } from './appealbaseQuotes.js';
import { ENTRY_PROMPT, processEntries } from './appealbaseBalance.js';
import { callClaude, parseJSON, MODEL_SONNET } from './llm.shared.js';

const SYSTEM = `You are a planning appeals analyst helping a planning consultant learn from a precedent for a live project. You are given the FULL text of one appeal decision. Base everything on the text. Never infer a conclusion the text does not state.

QUOTE RULES (checked by code; any quote not found verbatim in the decision is discarded):
- One short contiguous span, under 200 characters, copied exactly. No ellipsis joins, no paraphrase.
- Give the paragraph number the quote appears under (the inspector's numbered paragraph) in "para", or "" if unclear.

DEFINITIONS
- treatment "mentioned": appears in policy recital, party argument or the council's reason, with no finding by the inspector.
- treatment "substantive": the inspector states a finding or conclusion on it.
- effect "harm"/"no_harm" requires a supporting quote of the inspector's finding, otherwise "unclear".
- planning_balance.present is true only when the inspector actually weighs harms against benefits in the decision (for example National Landscape harm against renewable energy benefits). A statement of what the main issue is, or a list of policies, does not count. The quote must be the inspector's own conclusion of that weighing.
- usable_points: each must be supported by its own verbatim quote; if you cannot quote it, leave it out. Do not generalise beyond what the quote says. At most 3, the most useful to the client.

Return ONLY a JSON object, keys in this order:
{
  "outcome": "Allowed" | "Dismissed" | "Split" | "Other",
  "scheme_summary": "<max 30 words: what was proposed, scale, setting, designations affected>",
  "determinative_issues": ["<the 1-3 issues the outcome actually turned on>"],
  "issues": [
    { "id": "<issue id>", "treatment": "not_addressed"|"mentioned"|"substantive", "effect": "harm"|"no_harm"|"neutral"|"unclear", "weight_given": "<phrase the inspector used, e.g. 'great weight', 'moderate harm', or ''>", "finding": "<max 25 words>", "quote": "<exact span or empty>", "para": "<paragraph no. or empty>" }
  ],
  "planning_balance": {
    "present": <true|false>,
    "entries": [ <balance entries, see BALANCE ENTRIES below> ],
    "conclusion": "<max 30 words: how the balance came out and why>",
    "quote": "<exact span of the inspector's conclusion, or empty>",
    "para": "<paragraph no. or empty>"
  },
  "comparability": "<max 30 words on how comparable this is to the project: scale, designation, policy context>",
  "usable_points": [
    { "point": "<a point the client could cite or must anticipate, max 25 words>", "quote": "<exact span supporting it>", "para": "<paragraph no. or empty>" }
  ],
  "relevance": <0-10 using: 9-10 primary issue decided on merits, closely comparable scheme and setting, balance visible; 7-8 comparable but setting or balance differs; 5-6 partial; 3-4 mostly recital; 0-2 not comparable>,
  "relevance_reason": "<max 30 words>"
}
Include every listed issue id.

${ENTRY_PROMPT}`;

function buildPrompt(appeal, text) {
  return `PROJECT: ${PROJECT.name}, a ${PROJECT.scheme} in ${PROJECT.lpa}, ${PROJECT.setting}.
WHAT THE CLIENT CARES ABOUT: ${PROJECT.concerns}

ISSUES (id: label, weight):
${issueListText()}

DECISION ${appeal.reference}: ${appeal.lpa_name}, ${appeal.decision}, decided ${appeal.decision_date}. Procedure: ${appeal.procedure}.

FULL TEXT:
${text}`;
}

function enforce(j, text) {
  const found = makeFinder(text);
  let returned = 0;
  let dropped = 0;
  let downgraded = 0;
  const check = o => {
    if (!o.quote) return;
    returned++;
    if (!found(o.quote)) {
      o.quote = '';
      o.para = '';
      dropped++;
    }
  };
  for (const i of j.issues ?? []) {
    check(i);
    if ((i.effect === 'harm' || i.effect === 'no_harm') && !i.quote) {
      i.effect = 'unclear';
      downgraded++;
    }
  }
  check((j.planning_balance ??= {}));
  // Structured harm/benefit entries: wording verified against the text, then mapped onto fixed scales in code.
  const proc = processEntries(j.planning_balance.entries, found);
  j.planning_balance.entries = proc.entries;
  const entriesDropped = proc.dropped;
  const claimed = j.planning_balance.present;
  j.planning_balance.present = !!(claimed && j.planning_balance.quote);
  let pointsRemoved = 0;
  j.usable_points = (j.usable_points ?? []).filter(p => {
    check(p);
    if (p.quote) return true;
    pointsRemoved++;
    return false;
  });
  return { returned, dropped, downgraded, pointsRemoved, entriesDropped, balanceOverruled: claimed && !j.planning_balance.present };
}

/**
 * @param {ReturnType<import('./appealbase.service.js').createClient>} client
 * @param {string} reference 7-digit appeal reference
 * @throws if the fetch or the LLM output fails
 */
export async function deepRead(client, reference) {
  const { appeal, text } = await client.getAppealFullTextAll(reference);
  const prompt = buildPrompt(appeal, text);
  const raw = await callClaude(SYSTEM, prompt, MODEL_SONNET, 8000);
  let j;
  try {
    j = parseJSON(raw);
  } catch (e) {
    fs.writeFileSync(new URL(`../../logs/appealbase-deepread-raw-${reference}.txt`, import.meta.url), raw);
    throw new Error(`${e.message} (raw output saved; ${raw.length} chars)`);
  }
  const enf = enforce(j, text);
  return {
    reference,
    lpa: appeal.lpa_name,
    decision: appeal.decision,
    date: appeal.decision_date,
    url: `https://www.appealbase.com/decision/${reference}`,
    chars: text.length,
    promptChars: prompt.length + SYSTEM.length,
    judgement: j,
    ...enf,
  };
}

const ENTRIES_SYSTEM = `You are a planning appeals analyst. You are given the FULL text of one appeal decision. List the harms and the benefits the inspector placed in the planning balance, with the level of harm and the weight given, using only what the text states. Never infer a level or weight the inspector did not state; leave the field empty instead. Only include items the inspector actually weighed in the planning balance or in the assessment of an issue's harm; skip policy recital and party argument.

${ENTRY_PROMPT}

Return ONLY a JSON object: { "entries": [ ... ] }. At most 12 entries, the most important first.`;

/**
 * Focused extraction of structured planning-balance entries (level of harm and weight given) for one decision.
 * Cheaper than a full deepRead; used to enrich existing results.
 * @returns {{ reference: string, entries: Array, dropped: number, promptChars: number }}
 */
export async function extractBalanceEntries(client, reference) {
  const { appeal, text } = await client.getAppealFullTextAll(reference);
  const prompt = `ISSUES (ids): ${issueListText()}\n\nDECISION ${appeal.reference}: ${appeal.lpa_name}, ${appeal.decision}.\n\nFULL TEXT:\n${text}`;
  const j = parseJSON(await callClaude(ENTRIES_SYSTEM, prompt, MODEL_SONNET, 4000));
  const { entries, dropped } = processEntries(j.entries, makeFinder(text));
  return { reference, entries, dropped, returned: (j.entries ?? []).length, promptChars: prompt.length + ENTRIES_SYSTEM.length };
}
