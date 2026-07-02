import { callClaude, parseJSON } from './llm.shared.js';

const SYSTEM = `You are an actions tracker assistant for a planning consultancy. Read a block of text and identify which tracked action threads it relates to, then write a concise 20-25 word summary of what changed or progressed for each.`;

export async function processTrackerIntake(text, existingActions) {
  const actionsList = existingActions.length > 0
    ? existingActions.map(a => `- id:${a.id} | ${a.title}${a.owner ? ` (owner: ${a.owner})` : ''}`).join('\n')
    : '(No actions currently in tracker)';

  const user = `Tracked actions for this project:
${actionsList}

Text to analyse:
${text.slice(0, 20000)}

For each action the text references or updates: return its id and a 20-25 word summary of what changed.
If the text contains a new action not yet tracked: return action_id null with a suggested_title and summary.
Ignore pure background context with no action implications.

Respond ONLY with valid JSON — no markdown, no explanation:
{
  "matches": [
    { "action_id": 12, "summary": "20-25 word factual summary of what changed for this action" },
    { "action_id": null, "suggested_title": "Verb-led new action title", "summary": "20-25 word summary" }
  ]
}

Rules:
- summary must be 20-25 words, factual, present or past tense as appropriate
- Only include actions genuinely referenced in the text — no padding
- If nothing matches, return matches: []`;

  const raw = await callClaude(SYSTEM, user, undefined, 2000);
  const parsed = parseJSON(raw);
  return Array.isArray(parsed?.matches) ? parsed.matches : [];
}
