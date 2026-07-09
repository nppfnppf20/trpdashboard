/**
 * Surveyor Briefing LLM Service
 * Two functions:
 *   analyseBriefingForDisciplines — identifies which surveyor disciplines are needed
 *   suggestEmailEdits             — suggests scope section edits for a specific discipline
 */

import { callClaude, parseJSON, noEmDash, MODEL_SONNET } from './llm.shared.js';

const DISCIPLINE_SYSTEM = `You are a planning consultant reviewing a project briefing note.
Your task is to identify which specialist surveyor disciplines are required based on the project description, site characteristics, and constraints mentioned.
Only include disciplines that are clearly needed or strongly implied by the briefing — do not speculate.`;

/**
 * Analyse a briefing note and return which disciplines from the provided list are needed.
 * @param {string} briefingText - Briefing note content (may be HTML)
 * @param {string[]} availableDisciplines - Discipline names from templates in the DB
 * @param {object|null} guidingBrief - Optional guiding brief for this development type
 * @returns {Promise<Array<{discipline: string, reasoning: string}>>}
 */
export async function analyseBriefingForDisciplines(briefingText, availableDisciplines, guidingBrief = null) {
  const list = availableDisciplines.map(d => `- ${d}`).join('\n');

  const guidingBlock = guidingBrief?.guidance_content?.trim()
    ? `\n\nStandard discipline requirements for this development type:\n${guidingBrief.guidance_content.trim()}\n\nUse this as a baseline — disciplines listed here should be included unless the briefing clearly indicates they are not relevant to this specific site.`
    : '';

  const user = `Review this project briefing note and identify which of the following surveyor disciplines are needed.${guidingBlock}

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

const EMAIL_EDIT_SYSTEM = `You are a planning consultant preparing a briefing email that will be sent directly to a specialist consultant. You are reviewing the email's existing scope of work alongside a project briefing note.
Your only task is to identify project-specific information in the briefing note that is NOT already covered by the existing scope of work, and return it as a new section.

Content rules:
- You may ONLY add content. Never modify or remove anything from the existing scope.
- If there is relevant additional information, return it as a new HTML section with the exact heading <h3>Additional Information</h3>, formatted as a concise bullet list.
- Do not repeat anything already stated in the existing scope.
- Do not add speculative content. Only include items directly supported by the briefing note.
- Do NOT modify any [PLACEHOLDER] tokens.
- If there is nothing to add, return hasChanges: false.

Tone and style rules:
- The section you write is inserted verbatim into the email and read by the consultant it is sent to. Write it as part of that email: state facts about the site and project plainly, and where a request or instruction is needed, address the consultant directly as "you".
- Never refer to the recipient in the third person (e.g. "the ecology consultant should be aware that...") and never address or refer to the project team sending the email. You are speaking TO the consultant.
- Absolutely no em dashes or en dashes, ever. Use commas, brackets, or separate sentences instead, and write ranges with "to" (e.g. "20 to 30 years", not "20-30 years").`;

/**
 * Suggest edits to the scope sections of a briefing email based on a briefing note.
 * @param {string} briefingText - Briefing note content
 * @param {string} discipline - Discipline name (e.g. "Heritage")
 * @param {string} templateContent - Scope sections HTML only (extracted client-side)
 * @returns {Promise<{hasChanges: boolean, reasoning: string, suggestedContent: string|null}>}
 */
export async function suggestEmailEdits(briefingText, discipline, templateContent) {
  const user = `Discipline: ${discipline}

Existing scope sections from email template:
${templateContent}

---

Project briefing note:
${briefingText}

---

Is there any project-specific information in the briefing note that is NOT already covered by the scope above and that the ${discipline} consultant receiving this email needs to know or act on?

If YES: return ONLY an <h3>Additional Information</h3> section as HTML with bullet points covering the new items, written as part of the email to the consultant. Do not repeat anything already in the scope.
If NO: return hasChanges as false.

Respond with JSON only:
{ "hasChanges": boolean, "reasoning": string, "suggestedContent": string | null }`;

  const raw = await callClaude(EMAIL_EDIT_SYSTEM, user, MODEL_SONNET);
  const parsed = parseJSON(raw);
  if (!parsed) return { hasChanges: false, reasoning: 'Could not parse LLM response', suggestedContent: null };
  if (parsed.suggestedContent) {
    parsed.suggestedContent = noEmDash(parsed.suggestedContent).replace(/\s*–\s*/g, ' to ');
  }
  return parsed;
}
