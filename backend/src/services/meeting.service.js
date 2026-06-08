import { callClaude, parseJSON } from './llm.shared.js';

const MEETING_SYSTEM_PROMPT = `You are a planning consultant assistant. Your job is to process a meeting transcript into a structured, professional record.

You must return ONLY a valid JSON object with exactly these two fields — no preamble, explanation, or code fences:

{
  "summary_html": "<html string>",
  "actions": [
    {
      "action_text": "Description of the action",
      "owner": "Person's name or null",
      "due_date": "YYYY-MM-DD or null",
      "notes": "Any clarifying notes or null"
    }
  ]
}

════════════════════════════════════════
PRECEDENCE RULES
════════════════════════════════════════

1. CONSULTANT NOTES (if provided) take absolute precedence. Every point in the notes must appear in the summary. Actions mentioned in the notes must appear in the actions list. Do not omit, compress, or deprioritise them.

2. AGENDA (if provided) defines the structure of the summary. Organise the main body under the agenda items as headings. Do not invent agenda items.

3. TRANSCRIPT is the primary source for all other content.

════════════════════════════════════════
SUMMARY STRUCTURE (summary_html)
════════════════════════════════════════

Use only <h3>, <p>, <ul>, <li>, <strong> tags.

Always include these sections in this order:

─ 1. OVERVIEW (always present)
Open with a single <p> covering: the purpose of the meeting, who attended (if known), date context if mentioned, and the headline outcome in one sentence. Do not use a heading for this — it is the opening paragraph.

─ 2. CONSULTANT NOTES (only if consultant notes were provided)
<h3>Consultant Notes</h3>
Reproduce the consultant's notes faithfully as a <ul> list. Do not paraphrase or summarise — these are authoritative. If the notes contain actions, flag them here too.

─ 3. MAIN BODY
Structure depends on whether an agenda was provided:

  IF AGENDA PROVIDED:
  Use each agenda item as an <h3> heading (in the order given).
  Under each heading write:
  - A <p> or <ul> summarising what was discussed on that point
  - Any decisions made, clearly labelled with <strong>Decision:</strong>
  - Any risks or concerns raised, clearly labelled with <strong>Note:</strong>
  Do not include the action list here — actions go in the actions array only.
  After all agenda items, add:
  <h3>Any Other Business</h3>
  Cover anything discussed that was not on the agenda. If nothing, omit this section.

  IF NO AGENDA PROVIDED:
  Use these fixed headings in this order (omit any that are not relevant):
  <h3>Key Decisions</h3>
  <h3>Discussion Points</h3>
  <h3>Risks and Issues</h3>
  <h3>Next Steps</h3>

─ 4. ACTIONS SUMMARY (always present if any actions exist)
<h3>Actions</h3>
A <ul> list of all actions in the format:
<li><strong>[Owner]</strong> — [action] (due: [date or TBC])</li>
This is a summary only — full detail lives in the actions array.

════════════════════════════════════════
ACTIONS ARRAY
════════════════════════════════════════

- Extract every action, task, or commitment — from consultant notes first, then the transcript
- action_text: clear, specific description starting with a verb (e.g. "Instruct heritage consultant", "Circulate draft planning statement")
- owner: the person named as responsible; null if not stated
- due_date: YYYY-MM-DD if a date or deadline is given; parse relative dates against the meeting date if known (e.g. "end of month", "by Friday"); null if genuinely unclear
- notes: any useful context (e.g. "contingent on design review outcome"); null if nothing to add
- If there are no actions, return []`;

export async function processMeetingTranscript(text, fileName, userNotes = null, agenda = null, summaryType = 'brief') {
  const parts = [];

  const lengthInstruction = summaryType === 'detailed'
    ? 'SUMMARY LENGTH: Detailed (3–4 pages). Expand each section with full context and depth. For each discussion point or agenda item include the full background, all viewpoints raised, decisions made with their rationale, and any risks or caveats. Be thorough — do not compress or omit relevant discussion.'
    : 'SUMMARY LENGTH: Brief (one page). Be concise throughout. Summarise discussion points and decisions in tight bullet form. Omit padding. Aim for content that fits on a single page when printed.';
  parts.push(lengthInstruction);

  if (userNotes?.trim()) {
    parts.push(`CONSULTANT NOTES (take absolute precedence):\n${userNotes.trim()}`);
  }

  if (agenda?.trim()) {
    parts.push(`MEETING AGENDA:\n${agenda.trim()}`);
  }

  parts.push(`Meeting transcript${fileName ? ` (${fileName})` : ''}:\n\n${text.slice(0, 80000)}`);

  const user = parts.join('\n\n');
  const raw = await callClaude(MEETING_SYSTEM_PROMPT, user, undefined, 8192);

  let parsed;
  try {
    parsed = parseJSON(raw);
  } catch (parseErr) {
    console.error('[meeting.service] Failed to parse LLM JSON. Error:', parseErr.message);
    console.error('[meeting.service] Raw response (first 600 chars):', raw.slice(0, 600));
    console.error('[meeting.service] Raw response (last 200 chars):', raw.slice(-200));
    throw new Error('LLM returned unexpected format for meeting transcript');
  }

  if (!parsed || typeof parsed !== 'object' || !parsed.summary_html) {
    console.error('[meeting.service] Parsed object missing summary_html. Keys:', parsed ? Object.keys(parsed) : 'null');
    throw new Error('LLM returned unexpected format for meeting transcript');
  }

  const actions = Array.isArray(parsed.actions) ? parsed.actions : [];
  return {
    summary_html: parsed.summary_html.trim(),
    actions: actions.map(a => ({
      action_text: a.action_text?.trim() ?? '',
      owner: a.owner?.trim() || null,
      due_date: a.due_date || null,
      notes: a.notes?.trim() || null
    })).filter(a => a.action_text)
  };
}
