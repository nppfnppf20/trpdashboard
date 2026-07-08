import { callClaude } from './llm.shared.js';

const SYSTEM_PROMPT = `You are a planning consultant assistant maintaining a planning conditions discharge tracker. The user will provide:

1. SOURCE MATERIAL — typically an email trail or a typed note describing recent progress on discharging planning conditions.
2. One or more CONDITIONS, each with its number, title, full wording, the stated reason for the condition, and the previous dated progress entries already in the tracker.

For EACH condition listed, write the next dated entry in its progress log: a short note of what has just happened, written as if by the consultant team keeping the tracker.

Tone and voice — this matters:
- Write in the team's own voice, first person plural, e.g. "Issued marked-up ground floor plan to LPA", "Chased officer for sign-off", "We confirmed in writing that…". Where another party acted, name them plainly: "LPA confirmed details acceptable", "Applicant provided updated drainage strategy".
- This is an internal log entry, not a planning report. No report-speak ("the applicant's agent submitted… following which…"), no long chained clauses, no restating the condition's requirements back.
- Keep it SHORT: one or two brisk sentences, 35 words maximum. If two things happened, two short sentences beat one long one.
- End with where things now stand only if it's genuinely useful, kept blunt: "Awaiting officer sign-off", "Expect discharge".

Content rules:
- Cover only what is NEW in the source material relative to the previous progress entries. Do not repeat history that is already logged.
- Use the condition's wording and reason to understand what the condition requires, so the note is specific (e.g. "LPA confirmed ecology details satisfy part (b)" rather than "LPA replied").
- If the user has provided their own notes or a partial summary for a condition, treat that as authoritative — it takes precedence over your own reading of the source material. Refine it for clarity only; do not contradict it.
- Plain text only — no markdown, no bullets, no headings.

Return your response using EXACTLY this XML structure — one <ITEM> block per condition, in the same order they were given, nothing before the first <ITEM> and nothing after the last </ITEM>:

<ITEM>
<CONDITION_ID>the numeric id given for the condition</CONDITION_ID>
<SUMMARY>the 1-2 sentence progress summary</SUMMARY>
</ITEM>`;

function extractTag(text, tag) {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

export async function suggestAdvancementSummaries(fullText, conditions) {
  const conditionBlocks = conditions.map(c => {
    const history = (c.advancements || []).length
      ? c.advancements.map(a => `  - ${a.advancement_date}: ${a.summary}`).join('\n')
      : '  (none yet)';
    const targets = (c.target_requirements || []).length
      ? `\nThis advancement specifically relates to these parts of the condition:\n${c.target_requirements.map(t => `  - ${t}`).join('\n')}`
      : '';
    return `CONDITION (id: ${c.id})
Number: ${c.condition_number || 'n/a'}
Title: ${c.title}
Wording: ${c.wording || 'n/a'}
Reason: ${c.reason || 'n/a'}
Previous progress entries (newest first):
${history}${targets}${c.user_summary ? `\nUser's own notes for this condition (authoritative): ${c.user_summary}` : ''}`;
  }).join('\n\n');

  const content = `SOURCE MATERIAL:

${(fullText || '').slice(0, 80000)}

════════════════════════════════════════

${conditionBlocks}`;

  const raw = await callClaude(SYSTEM_PROMPT, content, undefined, 4000);

  const blocks = raw.match(/<ITEM>[\s\S]*?<\/ITEM>/gi) || [];
  if (!blocks.length) {
    console.error('[conditionsTracker.service] No ITEM blocks found. Raw (first 400):', raw.slice(0, 400));
    throw new Error('Could not generate summaries from the provided text');
  }

  return blocks
    .map(block => ({
      condition_id: parseInt(extractTag(block, 'CONDITION_ID'), 10),
      summary: extractTag(block, 'SUMMARY'),
    }))
    .filter(s => Number.isFinite(s.condition_id) && s.summary);
}
