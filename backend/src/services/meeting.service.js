import { callClaude } from './llm.shared.js';

const MEETING_SYSTEM_PROMPT = `You are a planning consultant assistant. Process a meeting transcript into a structured record.

Return your response using EXACTLY these delimiters — nothing before <MEETING_TITLE> and nothing after </ACTIONS_JSON>:

<MEETING_TITLE>short title or leave blank</MEETING_TITLE>
<MEETING_DATE>YYYY-MM-DD or leave blank</MEETING_DATE>
<ATTENDEES>comma-separated names or leave blank</ATTENDEES>
<SUMMARY_HTML>
HTML summary here
</SUMMARY_HTML>
<ACTIONS_JSON>
[{"action_text":"...","owner":null,"due_date":null,"notes":null}]
</ACTIONS_JSON>

════════════════════════════════════════
METADATA
════════════════════════════════════════

- MEETING_TITLE: short descriptive title (e.g. "Design Review", "Pre-Application Meeting — High Street"). Leave blank if not determinable.
- MEETING_DATE: date as YYYY-MM-DD. Leave blank if not determinable.
- ATTENDEES: comma-separated names or roles. Leave blank if not determinable.

════════════════════════════════════════
PRECEDENCE RULES
════════════════════════════════════════

1. CONSULTANT NOTES (if provided) take absolute precedence. Every point must appear in the summary. Actions mentioned in the notes must appear in ACTIONS_JSON.
2. AGENDA (if provided) defines the structure of the summary.
3. TRANSCRIPT is the primary source for all other content.

════════════════════════════════════════
SUMMARY_HTML STRUCTURE
════════════════════════════════════════

Use only <h3>, <p>, <ul>, <li>, <strong> tags.

Always include in this order:

1. OVERVIEW (always present — no heading)
Single <p>: purpose of the meeting, who attended, date context, headline outcome.

2. CONSULTANT NOTES (only if consultant notes were provided)
<h3>Consultant Notes</h3>
Reproduce faithfully as a <ul> list. Do not paraphrase.

3. MAIN BODY

  IF AGENDA PROVIDED: use each agenda item as an <h3> heading. Under each: <p>/<ul> summary, decisions labelled <strong>Decision:</strong>, risks labelled <strong>Note:</strong>. After all items add <h3>Any Other Business</h3> (omit if nothing).

  IF NO AGENDA: use these headings (omit if not relevant):
  <h3>Key Decisions</h3>
  <h3>Discussion Points</h3>
  <h3>Risks and Issues</h3>
  <h3>Next Steps</h3>

Do NOT include an actions section in SUMMARY_HTML — actions go in ACTIONS_JSON only.

════════════════════════════════════════
ACTIONS_JSON
════════════════════════════════════════

JSON array. Each item: {"action_text":"verb-led description","owner":null,"due_date":null,"notes":null}
- action_text: starts with a verb (e.g. "Instruct heritage consultant")
- owner: name of person responsible, or null
- due_date: YYYY-MM-DD or null
- notes: brief context or null
- If no actions: []`;

function extractTag(text, tag) {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

export async function processMeetingTranscript(text, fileName, userNotes = null, agenda = null, summaryType = 'brief', customPrompt = null) {
  const parts = [];

  let lengthInstruction;
  if (summaryType === 'custom' && customPrompt?.trim()) {
    lengthInstruction = `SUMMARY INSTRUCTIONS: ${customPrompt.trim()}`;
  } else if (summaryType === 'detailed') {
    lengthInstruction = 'SUMMARY LENGTH: Detailed (3-4 pages). Expand each section with full context and depth.';
  } else {
    lengthInstruction = 'SUMMARY LENGTH: Brief (one page). Be concise. Summarise in tight bullet form. Omit padding.';
  }
  parts.push(lengthInstruction);

  if (userNotes?.trim()) {
    parts.push(`CONSULTANT NOTES (take absolute precedence):\n${userNotes.trim()}`);
  }

  if (agenda?.trim()) {
    parts.push(`MEETING AGENDA:\n${agenda.trim()}`);
  }

  parts.push(`Meeting transcript${fileName ? ` (${fileName})` : ''}:\n\n${text.slice(0, 80000)}`);

  const raw = await callClaude(MEETING_SYSTEM_PROMPT, parts.join('\n\n'), undefined, 16000);

  const summary_html = extractTag(raw, 'SUMMARY_HTML');
  if (!summary_html) {
    console.error('[meeting.service] Missing SUMMARY_HTML. Raw (first 400):', raw.slice(0, 400));
    throw new Error('LLM returned unexpected format for meeting transcript');
  }

  const actionsRaw = extractTag(raw, 'ACTIONS_JSON') || '[]';
  let actions = [];
  try {
    const parsed = JSON.parse(actionsRaw);
    actions = Array.isArray(parsed) ? parsed : [];
  } catch {
    console.warn('[meeting.service] Could not parse ACTIONS_JSON, defaulting to []:', actionsRaw.slice(0, 200));
  }

  return {
    meeting_title: extractTag(raw, 'MEETING_TITLE') || null,
    meeting_date: extractTag(raw, 'MEETING_DATE') || null,
    attendees: extractTag(raw, 'ATTENDEES') || null,
    summary_html,
    actions: actions.map(a => ({
      action_text: a.action_text?.trim() ?? '',
      owner: a.owner?.trim() || null,
      due_date: a.due_date || null,
      notes: a.notes?.trim() || null
    })).filter(a => a.action_text)
  };
}
