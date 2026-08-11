import { callClaude } from './llm.shared.js';

// ─────────────────────────────────────────────────────────────────────────────
// Summary from pasted text — same mechanism as Conditions Tracker's
// suggestAdvancementSummaries (see conditionsTracker.service.js), adapted to
// issues/actions instead of conditions/advancements.
// ─────────────────────────────────────────────────────────────────────────────

const SUMMARY_SYSTEM_PROMPT = `You are a planning consultant assistant maintaining a pre-decision planning issues tracker. The user will provide:

1. SOURCE MATERIAL — typically an email trail or a typed note describing recent progress on a planning issue being worked through with the LPA/client.
2. One or more ISSUES, each with its title, discipline, and the previous dated actions already logged against it.

The user has selected these issues as ones the source material may relate to. For each issue it ACTUALLY contains relevant new information for, write the next dated entry in its action log: a short note of what has just happened, written as if by the consultant team keeping the tracker.

Relevance — decide per issue:
- Return an <ITEM> only for issues where the source material contains relevant NEW information (something that happened for that issue beyond what its previous actions already record). Omit the others entirely — never pad, stretch or speculate to cover an issue the material does not address.
- Exception: if the user has provided their own notes for an issue, always return an <ITEM> for it, based on those notes.
- If the source material contains nothing relevant to any of the listed issues, return exactly:
<NONE/>

Tone and voice — this matters:
- Write in the team's own voice, first person plural, e.g. "Raised massing concern with conservation officer", "Agreed revised access strategy with highways". Where another party acted, name them plainly: "LPA confirmed setting impact acceptable", "Applicant provided updated tree survey".
- This is an internal log entry, not a planning report. No report-speak, no long chained clauses, no restating the issue back.
- Keep it SHORT: one or two brisk sentences, 35 words maximum. If two things happened, two short sentences beat one long one.
- End with where things now stand only if it's genuinely useful, kept blunt: "Awaiting officer response", "Agreed in principle".

Content rules:
- Cover only what is NEW in the source material relative to the previous actions. Do not repeat history that is already logged.
- If the user has provided their own notes or a partial summary for an issue, treat that as authoritative — it takes precedence over your own reading of the source material. Refine it for clarity only; do not contradict it.
- Plain text only — no markdown, no bullets, no headings.

Return your response using EXACTLY this XML structure — one <ITEM> block per issue, in the same order they were given, nothing before the first <ITEM> and nothing after the last </ITEM>:

<ITEM>
<ISSUE_ID>the numeric id given for the issue</ISSUE_ID>
<SUMMARY>the 1-2 sentence progress summary</SUMMARY>
</ITEM>`;

function extractTag(text, tag) {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

export async function suggestActionSummaries(fullText, issues) {
  const issueBlocks = issues.map(iss => {
    const history = (iss.actions || []).length
      ? iss.actions.map(a => `  - ${a.action_date}: ${a.summary}`).join('\n')
      : '  (none yet)';
    return `ISSUE (id: ${iss.id})
Title: ${iss.title}
Discipline: ${iss.discipline || 'n/a'}
Previous actions (newest first):
${history}${iss.user_summary ? `\nUser's own notes for this issue (authoritative): ${iss.user_summary}` : ''}`;
  }).join('\n\n');

  const content = `SOURCE MATERIAL:

${(fullText || '').slice(0, 80000)}

════════════════════════════════════════

${issueBlocks}`;

  const raw = await callClaude(SUMMARY_SYSTEM_PROMPT, content, undefined, 8000);

  const blocks = raw.match(/<ITEM>[\s\S]*?<\/ITEM>/gi) || [];
  if (!blocks.length) {
    if (/<NONE\s*\/?>/i.test(raw)) return [];
    console.error('[progressTracker.service] No ITEM blocks found. Raw (first 400):', raw.slice(0, 400));
    throw new Error('Could not generate summaries from the provided text');
  }

  return blocks
    .map(block => ({
      issue_id: parseInt(extractTag(block, 'ISSUE_ID'), 10),
      summary: extractTag(block, 'SUMMARY'),
    }))
    .filter(s => Number.isFinite(s.issue_id) && s.summary);
}

// ─────────────────────────────────────────────────────────────────────────────
// Draft from Meeting Notes — given one or more saved meeting transcripts,
// propose an action for every issue they're actually relevant to, and propose
// brand-new issue rows for topics raised that aren't tracked yet (same
// materialize-on-accept pattern as draftIssuesFromBriefing for Drafting
// Issues). Returns proposals only — nothing is written until the caller
// commits the accepted subset.
// ─────────────────────────────────────────────────────────────────────────────

const MEETING_DRAFT_SYSTEM_PROMPT = `You are a planning consultant assistant maintaining a pre-decision planning issues tracker. The user will provide one or more MEETING NOTES (transcripts/summaries from meetings with the LPA, client or consultants) and the current list of tracked ISSUES, each with its discipline and previous logged actions.

For every issue whose situation has genuinely moved on according to the meeting notes, propose the next dated action for its log. For anything the notes raise that is NOT already a tracked issue, propose a brand new issue instead (with a sensible discipline guess).

Relevance — decide per issue:
- Only propose an action for an issue if a meeting note contains relevant NEW information for it, beyond what its previous actions already record.
- Never propose an action for an issue a note doesn't actually discuss.
- If a note raises a genuinely new topic that doesn't match any tracked issue, propose a NEW_ISSUE instead of forcing it onto an unrelated existing issue.
- If nothing in the notes is relevant to any issue and nothing new is raised, return exactly:
<NONE/>

Tone and voice:
- Write in the team's own voice, first person plural, e.g. "Agreed massing tweak with conservation officer at design review", "LPA raised concern on roofline". Plain text only, one or two brisk sentences, 35 words maximum per action.
- This is an internal tracker log entry, not meeting minutes — do not restate the whole discussion, just what moved on.

Return your response using EXACTLY this XML structure — one <PROPOSAL> block per proposed action or new issue, nothing before the first <PROPOSAL> and nothing after the last </PROPOSAL>:

<PROPOSAL>
<KIND>existing_issue</KIND>
<ISSUE_ID>the numeric id of the existing issue this relates to</ISSUE_ID>
<SUMMARY>the 1-2 sentence action summary</SUMMARY>
<SOURCE_NOTE_ID>the numeric id of the meeting note this came from</SOURCE_NOTE_ID>
</PROPOSAL>

<PROPOSAL>
<KIND>new_issue</KIND>
<TITLE>a short title for the new issue</TITLE>
<DISCIPLINE>a short discipline guess, e.g. Heritage, Landscape, Highways, Ecology</DISCIPLINE>
<SUMMARY>the 1-2 sentence action summary for its first logged action</SUMMARY>
<SOURCE_NOTE_ID>the numeric id of the meeting note this came from</SOURCE_NOTE_ID>
</PROPOSAL>`;

export async function draftActionsFromMeetingNotes(transcripts, issues) {
  const noteBlocks = transcripts.map(t => `MEETING NOTE (id: ${t.id})
Title: ${t.title}
Date: ${t.meeting_date || 'n/a'}
Transcript / summary:
${(t.transcript_text || '').slice(0, 40000)}
${t.user_notes ? `User notes: ${t.user_notes}` : ''}`).join('\n\n');

  const issueBlocks = issues.length
    ? issues.map(iss => {
        const history = (iss.actions || []).length
          ? iss.actions.slice(0, 5).map(a => `  - ${a.action_date}: ${a.summary}`).join('\n')
          : '  (none yet)';
        return `ISSUE (id: ${iss.id})
Title: ${iss.title}
Discipline: ${iss.discipline || 'n/a'}
Recent actions (newest first):
${history}`;
      }).join('\n\n')
    : '(no issues tracked yet)';

  const content = `MEETING NOTES:

${noteBlocks}

════════════════════════════════════════

TRACKED ISSUES:

${issueBlocks}`;

  const raw = await callClaude(MEETING_DRAFT_SYSTEM_PROMPT, content, undefined, 8000);

  const blocks = raw.match(/<PROPOSAL>[\s\S]*?<\/PROPOSAL>/gi) || [];
  if (!blocks.length) {
    if (/<NONE\s*\/?>/i.test(raw)) return [];
    console.error('[progressTracker.service] No PROPOSAL blocks found. Raw (first 400):', raw.slice(0, 400));
    throw new Error('Could not draft proposals from the selected meeting notes');
  }

  // meeting_date is looked up programmatically from the transcript row rather
  // than trusted from the LLM, so proposed actions always carry a real date.
  const dateByNoteId = Object.fromEntries(transcripts.map(t => [t.id, t.meeting_date]));

  return blocks
    .map(block => {
      const kind = extractTag(block, 'KIND');
      const sourceNoteId = parseInt(extractTag(block, 'SOURCE_NOTE_ID'), 10);
      const summary = extractTag(block, 'SUMMARY');
      const base = {
        summary,
        source_note_id: Number.isFinite(sourceNoteId) ? sourceNoteId : null,
        action_date: dateByNoteId[sourceNoteId] || new Date().toISOString().slice(0, 10),
      };
      if (kind === 'new_issue') {
        return {
          ...base,
          kind: 'new_issue',
          title: extractTag(block, 'TITLE'),
          discipline: extractTag(block, 'DISCIPLINE'),
        };
      }
      const issueId = parseInt(extractTag(block, 'ISSUE_ID'), 10);
      return {
        ...base,
        kind: 'existing_issue',
        issue_id: Number.isFinite(issueId) ? issueId : null,
      };
    })
    .filter(p => p.summary && (p.kind === 'new_issue' ? p.title : p.issue_id));
}
