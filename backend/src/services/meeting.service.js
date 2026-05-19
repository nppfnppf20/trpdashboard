import { callClaude, parseJSON } from './llm.shared.js';

const MEETING_SYSTEM_PROMPT = `You are a planning consultant assistant processing a meeting transcript.

Your task is to produce two things:
1. A structured HTML summary of the meeting
2. A list of action items extracted from the transcript

IMPORTANT: If consultant notes are provided, they take precedence over the transcript. Key points from the notes must be prominently featured in the summary and any actions they reference must appear in the actions list — do not omit or downplay them.

Return ONLY a valid JSON object with exactly these two fields — no preamble, explanation, or code fences:

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

For summary_html:
- Use only <h3>, <p>, <ul>, <li> tags
- Structure the summary with these headings where relevant: Key Decisions, Discussion Points, Context and Background, Next Steps
- If consultant notes were provided, open with a "Consultant Notes" section that captures those points verbatim before the transcript summary
- Be comprehensive — this will be used as a project record
- Write in clear professional prose

For actions:
- Extract every action, task, or commitment mentioned — in the consultant notes first, then the transcript
- owner: the person named as responsible, or null if unclear
- due_date: only populate if a specific date or clear deadline is mentioned; parse relative dates (e.g. "end of June 2025" → "2025-06-30"); use null if ambiguous
- notes: any relevant context for the action, or null
- If there are no actions, return an empty array`;

export async function processMeetingTranscript(text, fileName, userNotes = null) {
  const noteSection = userNotes?.trim()
    ? `CONSULTANT NOTES (take precedence — must be reflected prominently):\n${userNotes.trim()}\n\n`
    : '';
  const user = `${noteSection}Meeting transcript${fileName ? ` (${fileName})` : ''}:\n\n${text.slice(0, 80000)}`;
  const raw = await callClaude(MEETING_SYSTEM_PROMPT, user);

  let parsed;
  try {
    parsed = parseJSON(raw);
  } catch {
    console.error('[meeting.service] Failed to parse LLM JSON:', raw.slice(0, 300));
    throw new Error('LLM returned unexpected format for meeting transcript');
  }

  if (!parsed || typeof parsed !== 'object' || !parsed.summary_html) {
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
