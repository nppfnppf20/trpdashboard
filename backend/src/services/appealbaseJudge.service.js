/**
 * Snippet-level LLM judging of scored Appealbase candidates. Anthropic tokens only (no Appealbase calls).
 *
 * Rules enforced in code, not trusted to the model:
 *  - a quote that is not found verbatim in the excerpts is dropped
 *  - effect harm/no_harm needs a verified quote, otherwise it is downgraded to "unclear"
 *  - planning_balance_visible is only true when a quote of the inspector's weighing is returned and verified
 */

import { ISSUES, PROJECT, issueListText } from './appealbaseScoring.js';
import { makeFinder } from './appealbaseQuotes.js';
import { callClaude, parseJSON, MODEL_FAST, MODEL_SONNET } from './llm.shared.js';

const SNIPPET_CHARS_PER_ISSUE = 1400;

const SYSTEM = `You are a planning appeals analyst helping a planning consultant find precedents for a live project. You are given excerpts (not the full text) from one appeal decision. Judge only from the excerpts. Never invent facts or infer a conclusion the excerpts do not state.

QUOTE RULES (checked by code; any quote not found verbatim is discarded):
- Copy one short contiguous span, under 150 characters, exactly as written.
- No ellipsis joins, no paraphrase, no stitching of separate sentences.
- If you cannot find a suitable exact span, leave the quote empty.

DEFINITIONS
- treatment "mentioned": the issue appears in a policy list, a party's argument, a recital of the council's reason, or a list of main issues, with no finding by the inspector.
- treatment "substantive": the inspector states a finding or conclusion on it (e.g. "I find that...", "the proposal would harm...", "this carries significant weight").
- treatment "not_addressed": nothing in the excerpts bears on it.
- effect "harm" or "no_harm" requires a supporting quote showing the inspector's finding. Otherwise use "unclear".
- planning_balance_visible is true ONLY when the excerpts contain the inspector's own weighing of harms against benefits (for example landscape harm against renewable energy benefits), quoted verbatim in balance_quote. Policy lists, party arguments and statements of what the main issues are do not count. If the excerpts do not include the weighing, set it false and leave balance_quote empty.

RELEVANCE RUBRIC (0-10)
- 9-10: the primary issue is decided on the merits, the scheme and setting are closely comparable, and the planning balance is visible.
- 7-8: the primary issue is decided on the merits for a broadly comparable scheme, but the balance is not visible or the setting differs.
- 5-6: several issues are substantive but the primary issue is only mentioned, or the setting differs materially.
- 3-4: mostly policy recital or party argument; few findings.
- 0-2: the scheme is not comparable or the excerpts are about something else.
Use the full range. Most decisions should NOT score 7 or above.

Return ONLY a JSON object, with keys in this order:
{
  "relevance_reason": "<max 30 words explaining the score against the rubric>",
  "relevance": <0-10>,
  "comparable_scheme": "<max 20 words on scale/setting vs the project, or 'unclear'>",
  "planning_balance_visible": <true|false>,
  "balance_quote": "<exact span of the inspector's weighing, or empty>",
  "issues": [
    { "id": "<issue id>", "treatment": "not_addressed" | "mentioned" | "substantive", "effect": "harm" | "no_harm" | "neutral" | "unclear", "finding": "<max 20 words>", "quote": "<exact span or empty>" }
  ],
  "caveats": "<max 20 words on what the excerpts cannot tell you>"
}
Include every listed issue id.`;

function buildPrompt(c) {
  const excerpts = ISSUES.filter(i => c.snippets[i.id]?.length)
    .map(i => {
      const text = c.snippets[i.id].join('\n---\n').replace(/\n{2,}/g, '\n').slice(0, SNIPPET_CHARS_PER_ISSUE);
      return `### Excerpts matched on "${i.label}"\n${text}`;
    })
    .join('\n\n');
  return `PROJECT: ${PROJECT.name}, a ${PROJECT.scheme} in ${PROJECT.lpa}, ${PROJECT.setting}.
WHAT THE CLIENT CARES ABOUT: ${PROJECT.concerns}

ISSUES (id: label, weight):
${issueListText()}

DECISION ${c.reference}: ${c.lpa}, outcome ${c.decision}, ${c.date}.
Development: ${c.dev ?? 'unknown'}

${excerpts}`;
}

/** Verify quotes against the excerpts and enforce the evidence rules. Mutates the judgement. */
function enforce(j, c) {
  const found = makeFinder(Object.values(c.snippets).flat().join(' '));
  let dropped = 0;
  let downgraded = 0;
  for (const i of j.issues ?? []) {
    if (i.quote && !found(i.quote)) {
      i.quote = '';
      dropped++;
    }
    if ((i.effect === 'harm' || i.effect === 'no_harm') && !i.quote) {
      i.effect = 'unclear';
      downgraded++;
    }
  }
  if (j.balance_quote && !found(j.balance_quote)) {
    j.balance_quote = '';
    dropped++;
  }
  const claimed = j.planning_balance_visible;
  j.planning_balance_visible = !!(claimed && j.balance_quote);
  return { dropped, downgraded, balanceOverruled: claimed && !j.planning_balance_visible };
}

async function judgeOne(c, model) {
  const prompt = buildPrompt(c);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const j = parseJSON(await callClaude(SYSTEM, prompt, model, 2500));
      const quotesReturned = (j.issues ?? []).filter(i => i.quote).length + (j.balance_quote ? 1 : 0);
      const enf = enforce(j, c);
      return { reference: c.reference, lpa: c.lpa, decision: c.decision, date: c.date, url: c.url, coverage: c.score, hits: c.hits, judgement: j, quotesReturned, promptChars: prompt.length + SYSTEM.length, ...enf };
    } catch (e) {
      if (attempt === 1) return { reference: c.reference, error: e.message };
    }
  }
}

/**
 * @param {Array} pool scored candidates (see appealbaseScoring.scoreCandidates)
 * @param {{ modelKey?: 'haiku'|'sonnet', concurrency?: number, onProgress?: (r: object) => void }} opts
 */
export async function judgeCandidates(pool, { modelKey = 'sonnet', concurrency = 4, onProgress } = {}) {
  const model = modelKey === 'sonnet' ? MODEL_SONNET : MODEL_FAST;
  const results = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < pool.length) {
        const r = await judgeOne(pool[next++], model);
        results.push(r);
        onProgress?.(r);
      }
    })
  );
  return results;
}
