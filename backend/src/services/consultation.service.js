import { callClaude, noEmDash } from './llm.shared.js';
import { getGuidingBrief } from '../controllers/guidingBriefs.controller.js';

const PROMPT_PREFIX = `You are a planning consultant assistant. Extract key information from a statutory consultation response document.

Return your response using EXACTLY these XML delimiters — nothing before <CONSULTEE_NAME> and nothing after </COMMENTS>:

<CONSULTEE_NAME>name of the consultee organisation or body</CONSULTEE_NAME>
<DATE_RECEIVED>YYYY-MM-DD or leave blank</DATE_RECEIVED>
<POSITION>Objection | Support | Conditional Support | No Comment | or short free text</POSITION>
<COMMENTS>
Summary of the consultee's response here
</COMMENTS>
<ACTION_REQUIRED>
Bullet points here, or leave the tags empty if nothing is required
</ACTION_REQUIRED>

CONSULTEE_NAME: Full name of the statutory consultee (e.g. "Natural England", "Environment Agency"). Leave blank if not determinable.

DATE_RECEIVED: Date the response was issued, as YYYY-MM-DD. Leave blank if not determinable.

POSITION:
- Objection — raises concerns that must be resolved before consent
- Conditional Support — support subject to conditions or further information
- Support — no objections raised
- No Comment — no observations
- Use short free text only if none of the above fit.

COMMENTS: Summarise the consultee's response, covering all of their issues and points. Do not miss anything out. Write in plain text only — no markdown, no bold, no headings, no bullet symbols.

Word limit: 500 words maximum.
- If the response is short, write it naturally in prose.
- If covering all points would exceed 500 words, switch to a brief bullet-point-style list (one short sentence per issue, no elaboration) so every point is still represented.
- If detail has been condensed in this way, add the sentence "Further detail is contained in the full response." at the very end.

ACTION_REQUIRED: What, as a direct result of this consultation response, the team or a consultant needs to provide to the council — e.g. further information, a specific technical report or survey, a revised drawing, written clarification on a point. This is NOT a restatement of the consultee's issues — it is the concrete deliverable(s) needed to address them.
- Brief bullet points only, one per action, each starting on its own line with "- ".
- If the response is pure support or no comment with nothing to action, leave the tags empty: <ACTION_REQUIRED></ACTION_REQUIRED>
- Do not use em dashes (—) anywhere in this field.`;

async function buildSystemPrompt(developmentType) {
  const brief = await getGuidingBrief('consultation_response', developmentType).catch(() => null);

  const extraSection = brief?.guidance_content?.trim()
    ? `\n\n════════════════════════════════════════\nADDITIONAL GUIDANCE\n════════════════════════════════════════\n\n${brief.guidance_content.trim()}`
    : '';

  const styleSection = brief?.style_example?.trim()
    ? `\n\n════════════════════════════════════════\nSTYLE EXAMPLE\n════════════════════════════════════════\n\nThe following is an example of the expected summary style and level of detail:\n\n${brief.style_example.trim()}`
    : '';

  return PROMPT_PREFIX + extraSection + styleSection;
}

function extractTag(text, tag) {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

export async function summariseConsultation(responses) {
  const outstanding = responses.filter(r => {
    const p = (r.position || '').toLowerCase();
    return p !== 'support' && p !== 'no comment';
  });
  const noIssue = responses.filter(r => {
    const p = (r.position || '').toLowerCase();
    return p === 'support' || p === 'no comment';
  });

  const outstandingList = outstanding.map(r =>
    `- ${r.consultee_name || 'Unknown'} [${r.position || 'Unknown position'}]${r.status ? ` (Status: ${r.status})` : ''}: ${r.comments || 'No detail recorded'}`
  ).join('\n');

  const noIssueList = noIssue.map(r =>
    `- ${r.consultee_name || 'Unknown'} (${r.position || 'No Comment'})`
  ).join('\n');

  const prompt = `You are a planning consultant assistant. Summarise the current state of statutory consultation responses for a planning application.

RESPONSES WITH OUTSTANDING ISSUES (objections, conditional support, or unresolved positions):
${outstandingList || 'None'}

RESPONSES WITH NO OUTSTANDING ISSUES (support or no comment):
${noIssueList || 'None'}

Produce a concise bullet-point summary for the planning team covering:
1. The key outstanding issues that need to be addressed, grouped by theme where there are multiple (e.g. several consultees raising highway concerns). For each bullet, name the consultee(s) and state the issue clearly but briefly.
2. Note where any outstanding items are already closed out or in progress if that status is recorded.
3. At the end, a short final bullet listing respondees who raised no objection (support or no comment) — just their names.

Keep the whole summary under 400 words. Plain bullet points only — no headers, no bold, no markdown.`;

  const raw = await callClaude(prompt, 'Please summarise the consultation responses as instructed.', undefined, 1500);
  return raw.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Advancements: dated progress entries against one or more consultee
// responses. Mirrors conditionsTracker.service.js's suggestAdvancementSummaries.
// ─────────────────────────────────────────────────────────────────────────────

const ADVANCEMENT_SYSTEM_PROMPT = `You are a planning consultant assistant maintaining a statutory consultation tracker. The user will provide:

1. SOURCE MATERIAL — typically an email trail or a typed note describing recent progress with statutory consultees.
2. One or more CONSULTEE RESPONSES, each with the consultee's name, their position, their original comments, and the previous dated progress entries already in the tracker.

The user has selected these responses as ones the source material may relate to. For each response it ACTUALLY contains relevant new information for, write the next dated entry in its progress log: a short note of what has just happened, written as if by the consultant team keeping the tracker.

Relevance — decide per response:
- Return an <ITEM> only for responses where the source material contains relevant NEW information (something that happened beyond what the previous progress entries already record). Omit the others entirely — never pad, stretch or speculate to cover a response the material does not address.
- Exception: if the user has provided their own notes for a response, always return an <ITEM> for it, based on those notes.
- If the source material contains nothing relevant to any of the listed responses, return exactly:
<NONE/>

Tone and voice — this matters:
- Write in the team's own voice, first person plural, e.g. "Drafted response to Highways' concerns", "Chased Natural England for their outstanding comments", "We confirmed in writing that…". Where the consultee acted, name them plainly: "Highways confirmed the revised drawings were acceptable".
- This is an internal log entry, not a planning report. No report-speak, no long chained clauses, no restating the consultee's comments back.
- Keep it SHORT: one or two brisk sentences, 35 words maximum. If two things happened, two short sentences beat one long one.
- End with where things now stand only if it's genuinely useful, kept blunt: "Awaiting their sign-off", "Response issued to consultee".

Content rules:
- Cover only what is NEW in the source material relative to the previous progress entries. Do not repeat history that is already logged.
- Use the consultee's position and comments to understand what's outstanding, so the note is specific.
- If the user has provided their own notes or a partial summary for a response, treat that as authoritative — it takes precedence over your own reading of the source material. Refine it for clarity only; do not contradict it.
- Plain text only — no markdown, no bullets, no headings.

Return your response using EXACTLY this XML structure — one <ITEM> block per response, in the same order they were given, nothing before the first <ITEM> and nothing after the last </ITEM>:

<ITEM>
<RESPONSE_ID>the numeric id given for the response</RESPONSE_ID>
<SUMMARY>the 1-2 sentence progress summary</SUMMARY>
</ITEM>`;

export async function suggestConsultationAdvancementSummaries(fullText, responses) {
  const responseBlocks = responses.map(r => {
    const history = (r.advancements || []).length
      ? r.advancements.map(a => `  - ${a.advancement_date}: ${a.summary}`).join('\n')
      : '  (none yet)';
    return `RESPONSE (id: ${r.id})
Consultee: ${r.consultee_name}
Position: ${r.position || 'n/a'}
Comments: ${r.comments || 'n/a'}
Previous progress entries (newest first):
${history}${r.user_summary ? `\nUser's own notes for this response (authoritative): ${r.user_summary}` : ''}`;
  }).join('\n\n');

  const content = `SOURCE MATERIAL:

${(fullText || '').slice(0, 80000)}

════════════════════════════════════════

${responseBlocks}`;

  const raw = await callClaude(ADVANCEMENT_SYSTEM_PROMPT, content, undefined, 8000);

  const blocks = raw.match(/<ITEM>[\s\S]*?<\/ITEM>/gi) || [];
  if (!blocks.length) {
    if (/<NONE\s*\/?>/i.test(raw)) return [];   // nothing relevant found — a valid outcome
    console.error('[consultation.service] No ITEM blocks found. Raw (first 400):', raw.slice(0, 400));
    throw new Error('Could not generate summaries from the provided text');
  }

  return blocks
    .map(block => ({
      response_id: parseInt(extractTag(block, 'RESPONSE_ID'), 10),
      summary: extractTag(block, 'SUMMARY'),
    }))
    .filter(s => Number.isFinite(s.response_id) && s.summary);
}

export async function processConsultationResponse(text, fileName, developmentType = null, userNotes = null) {
  const systemPrompt = await buildSystemPrompt(developmentType);

  const parts = [];

  if (userNotes) {
    parts.push(`CONSULTANT NOTES:\n${userNotes}\n\nThe above notes highlight issues the consultant considers important. Make sure these are captured in your summary. Do not treat them as a replacement for the document — still extract everything else the consultee raises.`);
  }

  parts.push(`Consultation response document${fileName ? ` (${fileName})` : ''}:\n\n${text.slice(0, 80000)}`);

  const content = parts.join('\n\n');

  const raw = await callClaude(systemPrompt, content, undefined, 8000);

  const comments = extractTag(raw, 'COMMENTS');
  if (!comments) {
    console.error('[consultation.service] Missing COMMENTS. Raw (first 400):', raw.slice(0, 400));
    throw new Error('LLM returned unexpected format for consultation response');
  }

  return {
    consultee_name:  extractTag(raw, 'CONSULTEE_NAME') || null,
    date_received:   extractTag(raw, 'DATE_RECEIVED') || null,
    position:        extractTag(raw, 'POSITION') || null,
    comments,
    action_required: noEmDash(extractTag(raw, 'ACTION_REQUIRED')) || null,
  };
}
