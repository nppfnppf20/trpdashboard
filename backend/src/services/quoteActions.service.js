import { callClaude, noEmDash } from './llm.shared.js';

// Actions tracker for instructed surveys — LLM summariser, mirroring the
// conditions tracker's advancement summaries (conditionsTracker.service.js).

const SYSTEM_PROMPT = `You are a planning consultant assistant maintaining an actions tracker for the specialist surveys instructed on a project. The user will provide:

1. SOURCE MATERIAL — typically an email trail or a typed note describing recent progress on one or more instructed surveys.
2. One or more SURVEYS, each with its discipline, the surveyor organisation appointed, the instructed scope (line items), the current work status, and the previous dated action entries already in the tracker.

For EACH survey listed, write the next dated entry in its actions log: a short note of what has just happened, written as if by the consultant team keeping the tracker.

Tone and voice — this matters:
- Write in the team's own voice, first person plural, e.g. "Chased Enzygo for the draft LVIA", "Issued red line boundary to surveyor", "We confirmed site access for w/c 14 July". Where another party acted, name them plainly: "Enzygo confirmed site visit booked for 21 July", "Surveyor raised access constraint at the waste transfer station".
- This is an internal log entry, not a planning report. No report-speak, no long chained clauses, no restating the survey scope back.
- Keep it SHORT: one or two brisk sentences, 35 words maximum. If two things happened, two short sentences beat one long one.
- End with where things now stand only if it's genuinely useful, kept blunt: "Awaiting draft report", "Site visit booked".

Content rules:
- Cover only what is NEW in the source material relative to the previous action entries. Do not repeat history that is already logged.
- Use the survey's discipline and instructed scope to keep the note specific (e.g. "Draft PEA received, GCN surveys still to be scoped" rather than "Report received").
- If the user has provided their own notes or a partial summary for a survey, treat that as authoritative — it takes precedence over your own reading of the source material. Refine it for clarity only; do not contradict it.
- Never use an em dash or en dash anywhere in your output. Use a comma, a colon or a separate sentence instead, and write ranges with "to".
- Plain text only — no markdown, no bullets, no headings.

Return your response using EXACTLY this XML structure — one <ITEM> block per survey, in the same order they were given, nothing before the first <ITEM> and nothing after the last </ITEM>:

<ITEM>
<QUOTE_ID>the id given for the survey</QUOTE_ID>
<SUMMARY>the 1-2 sentence action summary</SUMMARY>
</ITEM>`;

const QUOTE_STAGE_SYSTEM_PROMPT = `You are a planning consultant assistant maintaining an actions tracker for the specialist survey quotes being sought on a project. Nothing has been instructed yet: this log tracks getting quotes in, questions raised by surveyors, fee revisions and scope clarifications. The user will provide:

1. SOURCE MATERIAL — typically an email trail or a typed note describing recent activity on one or more quotes.
2. One or more QUOTES, each with its discipline, the surveyor organisation approached, the quoted scope (line items), the fee if known, the current status, and the previous dated action entries already in the tracker.

For EACH quote listed, write the next dated entry in its actions log: a short note of what has just happened, written as if by the consultant team keeping the tracker.

Tone and voice — this matters:
- Write in the team's own voice, first person plural, e.g. "Chased Enzygo for the ecology quote", "Issued red line boundary and site plans to surveyor". Where another party acted, name them plainly: "Enzygo asked for confirmation of panel heights and site access arrangements", "Revised fee received, £4,200 excluding GCN surveys".
- This is an internal log entry, not a planning report. No report-speak, no long chained clauses, no restating the quoted scope back.
- Keep it SHORT: one or two brisk sentences, 35 words maximum. If two things happened, two short sentences beat one long one.
- End with where things now stand only if it's genuinely useful, kept blunt: "Awaiting revised quote", "Quote expected w/c 21 July".

Content rules:
- Cover only what is NEW in the source material relative to the previous action entries. Do not repeat history that is already logged.
- Use the quote's discipline and scope to keep the note specific (e.g. "Surveyor queried whether GCN surveys are in scope" rather than "Surveyor asked a question").
- If the user has provided their own notes or a partial summary for a quote, treat that as authoritative — it takes precedence over your own reading of the source material. Refine it for clarity only; do not contradict it.
- Never use an em dash or en dash anywhere in your output. Use a comma, a colon or a separate sentence instead, and write ranges with "to".
- Plain text only — no markdown, no bullets, no headings.

Return your response using EXACTLY this XML structure — one <ITEM> block per quote, in the same order they were given, nothing before the first <ITEM> and nothing after the last </ITEM>:

<ITEM>
<QUOTE_ID>the id given for the quote</QUOTE_ID>
<SUMMARY>the 1-2 sentence action summary</SUMMARY>
</ITEM>`;

function extractTag(text, tag) {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

/**
 * Generate action log summaries for one or more surveys/quotes from pasted
 * source text (email trail or note).
 * @param {string} fullText - The pasted source material
 * @param {Array} quotes - [{ id, discipline, surveyor_organisation, work_status, instruction_status, total, line_items, actions, user_summary }]
 * @param {string} stage - 'instructed' (work in progress) or 'quote' (quotes being sought)
 * @returns {Promise<Array<{quote_id: string, summary: string}>>}
 */
export async function suggestActionSummaries(fullText, quotes, stage = 'instructed') {
  const quoteStage = stage === 'quote';
  const quoteBlocks = quotes.map(q => {
    const history = (q.actions || []).length
      ? q.actions.map(a => `  - ${a.action_date}: ${a.summary}`).join('\n')
      : '  (none yet)';
    const scope = (q.line_items || []).length
      ? q.line_items.map(li => `  - ${li}`).join('\n')
      : '  (not itemised)';
    const statusLine = quoteStage
      ? `Quote status: ${q.instruction_status || 'Pending'}${q.total ? `\nQuoted fee: £${q.total}` : ''}`
      : `Current work status: ${q.work_status || 'In progress'}`;
    return `${quoteStage ? 'QUOTE' : 'SURVEY'} (id: ${q.id})
Discipline: ${q.discipline || 'n/a'}
Surveyor organisation: ${q.surveyor_organisation || 'n/a'}
${statusLine}
${quoteStage ? 'Quoted scope' : 'Instructed scope'}:
${scope}
Previous action entries (newest first):
${history}${q.user_summary ? `\nUser's own notes for this ${quoteStage ? 'quote' : 'survey'} (authoritative): ${q.user_summary}` : ''}`;
  }).join('\n\n');

  const content = `SOURCE MATERIAL:

${(fullText || '').slice(0, 80000)}

════════════════════════════════════════

${quoteBlocks}`;

  const raw = await callClaude(quoteStage ? QUOTE_STAGE_SYSTEM_PROMPT : SYSTEM_PROMPT, content, undefined, 4000);

  const blocks = raw.match(/<ITEM>[\s\S]*?<\/ITEM>/gi) || [];
  if (!blocks.length) {
    console.error('[quoteActions.service] No ITEM blocks found. Raw (first 400):', raw.slice(0, 400));
    throw new Error('Could not generate summaries from the provided text');
  }

  return blocks
    .map(block => ({
      quote_id: extractTag(block, 'QUOTE_ID'),
      summary: noEmDash(extractTag(block, 'SUMMARY') || ''),
    }))
    .filter(s => s.quote_id && s.summary);
}
