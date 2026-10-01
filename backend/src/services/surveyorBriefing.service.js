/**
 * Surveyor Briefing LLM Service
 * Two functions:
 *   analyseBriefingForDisciplines — identifies which surveyor disciplines are needed
 *   suggestEmailEdits             — suggests scope section edits for a specific discipline
 */

import { callClaude, parseJSON, noEmDash, MODEL_SONNET, ANTI_AI_SLOP_BLOCK } from './llm.shared.js';

const DISCIPLINE_SYSTEM = `You are a planning consultant reviewing a project briefing note.
Your task is to identify which specialist surveyor disciplines are required based on the project description, site characteristics, and constraints mentioned, a project-specific briefing note, and a standing practice guide for this type of development, where one is provided.
Only include disciplines that are clearly needed or strongly implied — do not speculate.`;

/**
 * Analyse a briefing note and return which disciplines from the provided list are needed.
 * @param {string} briefingText - Briefing note content (may be HTML)
 * @param {string[]} availableDisciplines - Discipline names from templates in the DB
 * @param {object|null} guidingBrief - Optional guiding brief for this development type
 * @param {string} guidance - Optional free-text instruction from the user (which disciplines, how to use the notes)
 * @param {Array<{id: string, organisation: string, discipline: string, contacts?: Array<{id: string, name: string}>}>} surveyorOrgs - Known surveyor organisations and their contacts, so named ones can be matched
 * @returns {Promise<Array<{discipline: string, reasoning: string, named_surveyors?: Array<{id: string, contact_id: string|null, contact_name: string|null}>}>>}
 */
export async function analyseBriefingForDisciplines(briefingText, availableDisciplines, guidingBrief = null, guidance = '', surveyorOrgs = []) {
  const list = availableDisciplines.map(d => `- ${d}`).join('\n');
  const orgList = surveyorOrgs.map(o => `- [${o.id}] ${o.organisation} (${o.discipline || 'no discipline'})`).join('\n');

  const guidingBlock = guidingBrief?.guidance_content?.trim()
    ? `\n\nStandard discipline requirements for this development type:
${guidingBrief.guidance_content.trim()}

This guide may distinguish two tiers of discipline, and you must apply them differently:
- Essential / always-required disciplines: include these by default. Only drop one if the briefing note explicitly states it is not needed on this site (e.g. "no heritage assets nearby, heritage survey not required").
- Conditional / situational disciplines (e.g. "only if X is present", "consider where Y applies"): include one of these ONLY if the briefing note specifically indicates the relevant site feature or need. Do not include a conditional discipline just because the guide mentions it as a possibility.

If the guide is not split into these tiers, treat all disciplines it lists as essential under the same "include unless explicitly ruled out" rule.`
    : '';

  const guidanceBlock = guidance?.trim()
    ? `\n\nUser instruction (written by the person requesting these fee quotes):
"""
${guidance.trim()}
"""
This instruction takes priority over the standard discipline requirements above. Apply it as follows:
- If it names specific disciplines (e.g. "just an ecology one", "ecology and heritage only"), return ONLY those disciplines, matched to the exact names in the available list. Include them even if the notes do not mention them, and do not add any others. If a named discipline has no sensible match in the list, leave it out.
- If it asks for all relevant disciplines, or does not restrict the disciplines at all, determine the disciplines as you normally would.
- If it says which notes or documents to rely on (for example "use the X note for context but the Y note for the scope"), weight those sources accordingly when deciding which disciplines are needed. Sources are headed with their titles.
- For a discipline the user explicitly asked for, the reasoning should say it was requested by the user, plus any relevant supporting detail from the notes.`
    : '';

  const user = `Review this project briefing note and identify which of the following surveyor disciplines are needed.${guidingBlock}${guidanceBlock}

Available disciplines:
${list}

For each discipline needed, give a brief reason (1-2 sentences). Where a guiding brief was provided above, say whether the discipline is included because it's a standard/essential requirement for this development type, or because the briefing note specifically indicates a need for it.
Use the exact discipline name from the list above.

${orgList ? `Known surveyor organisations (ids in square brackets, with their contacts):
${orgList}

Named surveyors: if the notes or the user instruction explicitly name a specific surveyor organisation, or a named person (contact) at one, that is to be approached or instructed for a discipline (e.g. "we'll use Acme Ecology for the bat work", "get a quote from Smith Heritage", "ask Jane Doe at Acme"), add an entry to "named_surveyors" on that discipline's entry: { "id": "<organisation id>", "contact_id": "<contact id or null>", "contact_name": "<the person's name exactly as written in the notes or instruction, or null>" }.
- Match loosely on organisation names (abbreviations, "Ltd", partial names) and on people's names (first name only, surname only, nicknames), but only to an organisation or contact in the list above.
- If a person is named, ALWAYS fill in contact_name with the name as written, and set contact_id to that contact's id when you can find them in the list. Use the id of the organisation they belong to, even if the organisation is not mentioned. If only the organisation is named, set contact_id to null. Never set a contact_id that does not sit under the organisation you give.
- If a first name alone matches several contacts and the notes give no way to tell which, set contact_id to null rather than guess.
- Only include a surveyor that is genuinely named as a choice for this work. Do not include one that is merely mentioned in passing, as a past project, a competitor or a third party, and never guess one.
- A named surveyor's discipline must be the discipline of the entry it sits on; if its discipline would not otherwise be returned and the user instruction does not restrict the disciplines, return that discipline too. If no surveyor is named, leave the array empty.

` : ''}Respond with JSON only — no explanation, no markdown:
[{ "discipline": "<exact name>", "reasoning": "<why needed>", "named_surveyors": [{ "id": "<organisation id exactly as shown>", "contact_id": "<contact id exactly as shown, or null>", "contact_name": "<person name as written, or null>" }] }]

Briefing note:
${briefingText?.trim() || NO_SOURCES_NOTE}`;

  const raw = await callClaude(DISCIPLINE_SYSTEM, user, MODEL_SONNET);
  const parsed = parseJSON(raw);
  return Array.isArray(parsed) ? parsed : [];
}

const EMAIL_EDIT_SYSTEM = `You are a planning consultant preparing a fee quote request email that will be sent directly to a specialist consultant. You have the email's standard scope of work and the project's source notes.
You write two pieces that are inserted into the email: an opening paragraph, and a "Project Information" section that sits directly after it. The template's own Project Details list and Scope of Work are added separately and must not be rewritten or repeated.

1. Opening paragraph ("intro"):
- One short, standard-sounding paragraph, returned as HTML: <p>...</p>.
- It opens with "Hope you are well." and then says what we are seeking a fee quote for, in the form "We are seeking a fee quote for <headline> for a <scheme type> scheme."
- The headline is a short, natural phrase for the work asked for, judged from the discipline, the notes and any user instruction (e.g. "ecology work", "an archaeological desk-based assessment", "a noise assessment"). Do not just paste the discipline name plus "services".
- The scheme type is the kind of development, taken from the notes (e.g. a solar scheme, a residential scheme, a battery storage scheme). If the notes do not make it clear, drop the "for a ... scheme" part rather than guess.
- Do not list the scope items and do not repeat the project name, address or other details that appear in the Project Details list.

2. Project Information section ("suggestedContent"):
- Project-specific information from the notes that the consultant needs to understand the job and price it, and that is NOT already covered by the standard scope of work or by the basic Project Details (name, code, address, site area, client, sector, project type).
- Return it as an HTML section with the exact heading <h3>Project Information</h3>, followed by a concise bullet list.
- Do not repeat anything already stated in the scope.
- Do not add speculative content. Only include items directly supported by the source notes.
- If there is nothing relevant to add, return hasChanges: false and suggestedContent: null.

General rules:
- Do NOT modify any [PLACEHOLDER] tokens.
- If the user gave an instruction, follow it for emphasis and for which sources to rely on, but never invent facts that are not in the sources.

Tone and style rules:
- Both pieces are inserted verbatim into the email and read by the consultant it is sent to. Write them as part of that email: state facts about the site and project plainly, and where a request or instruction is needed, address the consultant directly as "you".
- Never refer to the recipient in the third person (e.g. "the ecology consultant should be aware that...") and never address or refer to the project team sending the email. You are speaking TO the consultant.
- Absolutely no em dashes or en dashes, ever. Use commas, brackets, or separate sentences instead, and write ranges with "to" (e.g. "20 to 30 years", not "20-30 years").`;

// Used when the user ticked no notes or docs and the instruction is the only source material
const NO_SOURCES_NOTE = '(No notes or documents were selected. Rely entirely on the user instruction above, which is the only source material. Do not invent anything beyond what it states.)';

const cleanDashes = (html) => noEmDash(html).replace(/\s*–\s*/g, ' to ');

/**
 * Draft the opening paragraph and the "Project Information" section of a fee quote request email.
 * @param {string} briefingText - Source notes/docs content
 * @param {string} discipline - Discipline name (e.g. "Heritage")
 * @param {string} templateContent - Scope of work section HTML (extracted client-side), used to avoid repeating it
 * @param {string} guidance - Optional free-text instruction from the user
 * @returns {Promise<{intro: string|null, hasChanges: boolean, reasoning: string, suggestedContent: string|null}>}
 */
export async function suggestEmailEdits(briefingText, discipline, templateContent, guidance = '') {
  const guidanceBlock = guidance?.trim()
    ? `\n\nUser instruction (from the person sending this email):\n"""\n${guidance.trim()}\n"""\n`
    : '';

  const user = `Discipline: ${discipline}

Standard scope of work that will appear lower in the email (do not repeat it):
${templateContent}
${guidanceBlock}
---

Source notes:
${briefingText?.trim() || NO_SOURCES_NOTE}

---

Write the opening paragraph and the Project Information section for the ${discipline} consultant receiving this email.

Respond with JSON only:
{ "intro": string, "hasChanges": boolean, "reasoning": string, "suggestedContent": string | null }
- intro: the opening paragraph as <p>...</p> HTML.
- hasChanges / suggestedContent: whether there is a Project Information section, and its HTML (or null).
- reasoning: one or two sentences on what you included and why.`;

  const raw = await callClaude(EMAIL_EDIT_SYSTEM + ANTI_AI_SLOP_BLOCK, user, MODEL_SONNET);
  const parsed = parseJSON(raw);
  if (!parsed) return { intro: null, hasChanges: false, reasoning: 'Could not parse LLM response', suggestedContent: null };
  parsed.intro = typeof parsed.intro === 'string' && parsed.intro.trim() ? cleanDashes(parsed.intro) : null;
  if (parsed.suggestedContent) parsed.suggestedContent = cleanDashes(parsed.suggestedContent);
  else parsed.hasChanges = false;
  return parsed;
}
