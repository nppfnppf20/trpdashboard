import { callClaude } from './llm.shared.js';
import { getGuidingBrief } from '../controllers/guidingBriefs.controller.js';

const PROMPT_PREFIX = `You are a planning consultant assistant. Process a meeting transcript into a structured record.

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

- MEETING_TITLE: short descriptive title (e.g. "Design Review", "Pre-Application Meeting"). Leave blank if not determinable.
- MEETING_DATE: date as YYYY-MM-DD. Leave blank if not determinable.
- ATTENDEES: comma-separated names or roles. Leave blank if not determinable.

════════════════════════════════════════
PRECEDENCE RULES
════════════════════════════════════════

1. CONSULTANT NOTES (if provided) take absolute precedence. Every point must appear in the summary. Actions mentioned in the notes must appear in ACTIONS_JSON.
2. AGENDA (if provided) provides context for the content — do not use agenda items as headings; map them to the standard structure below.
3. TRANSCRIPT is the primary source for all other content.`;

const PROMPT_STRUCTURE_DEFAULT = `════════════════════════════════════════
SUMMARY_HTML STRUCTURE
════════════════════════════════════════

Always use the following structure, in exactly this order. Use only <h3>, <p>, <ul>, <ol>, <li>, <strong> tags.

1. OVERVIEW (no heading)
Single <p>: purpose of the meeting, who attended, date, and headline outcome. 2-3 sentences maximum.

2. KEY DISCUSSION POINTS
<h3>Key Discussion Points</h3>
Numbered <ol>. Each item covers one distinct topic discussed. After each item, if a decision was reached, append on a new line: <strong>Decision:</strong> [what was decided]. If no decision was reached on that point, omit the Decision line.

3. CONCLUSIONS
<h3>Conclusions</h3>
Short <p> or <ul> summarising the overall outcome of the meeting, agreed next steps, and any outstanding matters requiring follow-up.

Do NOT include an actions section in SUMMARY_HTML — actions go in ACTIONS_JSON only.`;

const PROMPT_ACTIONS = `════════════════════════════════════════
ACTIONS_JSON
════════════════════════════════════════

JSON array. Each item: {"action_text":"verb-led description","owner":null,"due_date":null,"notes":null}
- action_text: starts with a verb (e.g. "Instruct heritage consultant")
- owner: name of person responsible, or null
- due_date: YYYY-MM-DD or null
- notes: brief context or null
- If no actions: []`;

async function buildSystemPrompt() {
  const brief = await getGuidingBrief('meeting_notes', null).catch(() => null);

  const structureSection = brief?.guidance_content?.trim()
    ? `════════════════════════════════════════
SUMMARY_HTML STRUCTURE
════════════════════════════════════════

${brief.guidance_content.trim()}`
    : PROMPT_STRUCTURE_DEFAULT;

  const styleSection = brief?.style_example?.trim()
    ? `\n\n════════════════════════════════════════
STYLE EXAMPLE
════════════════════════════════════════

The following is an example of the required format and style. Match its structure and tone exactly:

${brief.style_example.trim()}`
    : '';

  return [PROMPT_PREFIX, structureSection + styleSection, PROMPT_ACTIONS].join('\n\n');
}

function extractTag(text, tag) {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

export async function processMeetingTranscript(text, fileName, userNotes = null, agenda = null, summaryType = 'brief', customPrompt = null, meetingType = 'project') {
  const systemPrompt = await buildSystemPrompt();

  // CPD records always use detailed length unless the caller explicitly chose custom
  if (meetingType === 'cpd' && summaryType === 'brief') {
    summaryType = 'detailed';
  }

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

  const raw = await callClaude(systemPrompt, parts.join('\n\n'), undefined, 16000);

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
