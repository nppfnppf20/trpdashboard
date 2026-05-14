/**
 * Surveyor Briefing LLM Service
 * Two functions:
 *   analyseBriefingForDisciplines — identifies which surveyor disciplines are needed
 *   suggestEmailEdits             — suggests scope section edits for a specific discipline
 */

import { callClaude, parseJSON, MODEL_SONNET } from './llm.shared.js';

const DISCIPLINE_SYSTEM = `You are a planning consultant reviewing a project briefing note.
Your task is to identify which specialist surveyor disciplines are required based on the project description, site characteristics, and constraints mentioned.
Only include disciplines that are clearly needed or strongly implied by the briefing — do not speculate.`;

/**
 * Analyse a briefing note and return which disciplines from the provided list are needed.
 * @param {string} briefingText - Briefing note content (may be HTML)
 * @param {string[]} availableDisciplines - Discipline names from templates in the DB
 * @returns {Promise<Array<{discipline: string, reasoning: string}>>}
 */
export async function analyseBriefingForDisciplines(briefingText, availableDisciplines) {
  const list = availableDisciplines.map(d => `- ${d}`).join('\n');
  const user = `Review this project briefing note and identify which of the following surveyor disciplines are needed.
Only include disciplines clearly required or strongly implied by the content.

Available disciplines:
${list}

For each discipline needed, give a brief reason (1-2 sentences).
Use the exact discipline name from the list above.

Respond with JSON only — no explanation, no markdown:
[{ "discipline": "<exact name>", "reasoning": "<why needed>" }]

Briefing note:
${briefingText}`;

  const raw = await callClaude(DISCIPLINE_SYSTEM, user, MODEL_SONNET);
  const parsed = parseJSON(raw);
  return Array.isArray(parsed) ? parsed : [];
}

const EMAIL_EDIT_SYSTEM = `You are a planning consultant reviewing a surveyor briefing email.
You will be given a project briefing note and an existing email template for a specific discipline.
Your task: identify whether the briefing note contains project-specific requirements that would meaningfully change what we are asking from this surveyor.

Rules:
- Only suggest changes when the briefing explicitly mentions something different from the standard scope.
- Do not suggest changes speculatively or for minor wording differences.
- Do NOT modify any [PLACEHOLDER] tokens (e.g. [PROJECT_NAME], [ADDRESS], [CLIENT_NAME]).
- Only modify the scope-of-work / requirements section of the email body.
- If nothing needs changing, return hasChanges: false.`;

/**
 * Suggest edits to an email template's scope section based on a briefing note.
 * @param {string} briefingText - Briefing note content
 * @param {string} discipline - Discipline name (e.g. "Heritage")
 * @param {string} templateContent - Current HTML email template content
 * @returns {Promise<{hasChanges: boolean, reasoning: string, suggestedContent: string|null}>}
 */
export async function suggestEmailEdits(briefingText, discipline, templateContent) {
  const user = `Discipline: ${discipline}

Current email template:
${templateContent}

---

Project briefing note:
${briefingText}

---

Does the briefing note contain project-specific requirements that would meaningfully change what we ask from this ${discipline} surveyor?

If YES: return the full modified email HTML with only the scope/requirements section updated. Keep all [PLACEHOLDER] tokens unchanged.
If NO: return hasChanges as false and suggestedContent as null.

Respond with JSON only:
{ "hasChanges": boolean, "reasoning": string, "suggestedContent": string | null }`;

  const raw = await callClaude(EMAIL_EDIT_SYSTEM, user, MODEL_SONNET);
  const parsed = parseJSON(raw);
  return parsed ?? { hasChanges: false, reasoning: 'Could not parse LLM response', suggestedContent: null };
}
