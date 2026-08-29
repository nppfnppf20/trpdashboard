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

function parseIssueActionItems(raw, logLabel, errorMessage) {
  const blocks = raw.match(/<ITEM>[\s\S]*?<\/ITEM>/gi) || [];
  if (!blocks.length) {
    if (/<NONE\s*\/?>/i.test(raw)) return [];
    console.error(`[${logLabel}] No ITEM blocks found. Raw (first 400):`, raw.slice(0, 400));
    throw new Error(errorMessage);
  }
  return blocks
    .map(block => ({
      issue_id: parseInt(extractTag(block, 'ISSUE_ID'), 10),
      summary: extractTag(block, 'SUMMARY'),
    }))
    .filter(s => Number.isFinite(s.issue_id) && s.summary);
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
  return parseIssueActionItems(raw, 'progressTracker.service', 'Could not generate summaries from the provided text');
}

// Same job, but for when nothing has been ticked yet: given every issue
// currently tracked (not just a pre-picked set), work out which ones (if
// any) the source material actually relates to. Lighter per-row context
// than the scoped path above (no full history) since the first job here is
// picking the right rows out of potentially many, not writing a rich entry.
const CANDIDATE_SYSTEM_PROMPT = `You are a planning consultant assistant maintaining a pre-decision planning issues tracker. The user will provide:

1. SOURCE MATERIAL — typically an email trail or a typed note describing recent progress on a planning issue being worked through with the LPA/client.
2. Every ISSUE currently tracked for this project, each with its title, discipline, and a one-line note of where things currently stand.

Nothing has been pre-selected. Work out for yourself which issue(s), if any, the source material is actually about, then write the next dated entry in its action log for each one.

Relevance — decide per issue:
- Return an <ITEM> only for issues the source material genuinely mentions or is clearly about. Most issues in the list will NOT be relevant — do not pad the list to cover more issues than the material actually supports. Returning only one or two <ITEM>s, or none at all, is the normal and expected outcome.
- If the source material doesn't relate to any of the listed issues, return exactly:
<NONE/>

Tone and voice — this matters:
- Write in the team's own voice, first person plural, e.g. "Raised massing concern with conservation officer", "Agreed revised access strategy with highways". Where another party acted, name them plainly: "LPA confirmed setting impact acceptable", "Applicant provided updated tree survey".
- This is an internal log entry, not a planning report. No report-speak, no long chained clauses, no restating the issue back.
- Keep it SHORT: one or two brisk sentences, 35 words maximum. If two things happened, two short sentences beat one long one.
- End with where things now stand only if it's genuinely useful, kept blunt: "Awaiting officer response", "Agreed in principle".

Content rules:
- Use the issue's title and discipline to understand what's outstanding, so the note is specific.
- Plain text only — no markdown, no bullets, no headings.

Return your response using EXACTLY this XML structure — one <ITEM> block per relevant issue, nothing before the first <ITEM> and nothing after the last </ITEM>:

<ITEM>
<ISSUE_ID>the numeric id given for the issue</ISSUE_ID>
<SUMMARY>the 1-2 sentence progress summary</SUMMARY>
</ITEM>`;

export async function suggestActionCandidates(fullText, issues) {
  const issueBlocks = issues.map(iss => `ISSUE (id: ${iss.id})
Title: ${iss.title}
Discipline: ${iss.discipline || 'n/a'}
Latest action: ${iss.latest_summary || 'no actions logged yet'}`).join('\n\n');

  const content = `SOURCE MATERIAL:

${(fullText || '').slice(0, 80000)}

════════════════════════════════════════

${issueBlocks}`;

  const raw = await callClaude(CANDIDATE_SYSTEM_PROMPT, content, undefined, 8000);
  return parseIssueActionItems(raw, 'progressTracker.service.candidates', 'Could not identify which issues this relates to');
}

// ─────────────────────────────────────────────────────────────────────────────
// Draft from Meeting Notes — given one or more saved meeting transcripts,
// propose an action for every issue they're actually relevant to, and propose
// brand-new issue rows for topics raised that aren't tracked yet (same
// materialize-on-accept pattern as draftIssuesFromBriefing for Drafting
// Issues). Returns proposals only — nothing is written until the caller
// commits the accepted subset.
// ─────────────────────────────────────────────────────────────────────────────

const MEETING_DRAFT_SYSTEM_PROMPT = `You are a planning consultant assistant maintaining a pre-decision planning issues tracker. The user will provide one or more MEETING NOTES (transcripts/summaries from meetings with the LPA, client or consultants) and the current list of tracked ISSUES, each with its discipline, existing sub-issues, and previous logged actions.

For every issue whose situation has genuinely moved on according to the meeting notes, propose the next dated action for its log.

Deciding where a topic belongs — this is the part that matters most:
- First, check whether the topic fits an EXISTING issue in the same discipline (or an obviously related discipline). Discipline match is a strong signal — treat it as the same broad concern unless the topic is clearly unrelated.
- If it's simply more detail on what that issue already covers, propose an EXISTING_ISSUE action.
- If it's a genuinely distinct facet of that same broad concern — a sub-topic worth tracking as its own line, not just folded into the parent's general notes — propose a NEW_SUB_ISSUE attached to that existing issue, rather than a whole new top-level issue. Example: an existing "Heritage" issue, and the notes raise archaeology — archaeology is a distinct facet of heritage, so it becomes a sub-issue of the existing Heritage issue, never a new standalone "Heritage/Archaeology" issue.
- Check the existing issue's sub-issues first so you never propose a NEW_SUB_ISSUE that duplicates one already there — if it already exists, propose an EXISTING_ISSUE action against the parent issue instead (or reference the existing sub-issue's own history) rather than re-creating it.
- Only propose a brand new top-level NEW_ISSUE when the topic doesn't reasonably belong under any tracked issue's discipline at all, even as a sub-issue. New top-level issues should be rare — reach for NEW_SUB_ISSUE first whenever a same- or related-discipline issue already exists.
- Never propose anything for an issue or topic a note doesn't actually discuss.
- If nothing in the notes is relevant to anything tracked and nothing new is raised, return exactly:
<NONE/>

Tone and voice:
- Write in the team's own voice, first person plural, e.g. "Agreed massing tweak with conservation officer at design review", "LPA raised concern on roofline". Plain text only, one or two brisk sentences, 35 words maximum per action.
- This is an internal tracker log entry, not meeting minutes — do not restate the whole discussion, just what moved on.

Return your response using EXACTLY this XML structure — one <PROPOSAL> block per proposed action, new sub-issue or new issue, nothing before the first <PROPOSAL> and nothing after the last </PROPOSAL>:

<PROPOSAL>
<KIND>existing_issue</KIND>
<ISSUE_ID>the numeric id of the existing issue this relates to</ISSUE_ID>
<SUMMARY>the 1-2 sentence action summary</SUMMARY>
<SOURCE_NOTE_ID>the numeric id of the meeting note this came from</SOURCE_NOTE_ID>
</PROPOSAL>

<PROPOSAL>
<KIND>new_sub_issue</KIND>
<ISSUE_ID>the numeric id of the EXISTING issue to attach this new sub-issue under</ISSUE_ID>
<SUB_ISSUE_TITLE>a short title for the new sub-issue, e.g. "Archaeological impact"</SUB_ISSUE_TITLE>
<SUMMARY>the 1-2 sentence action summary for its first logged action</SUMMARY>
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
        const subIssues = (iss.sub_issues || []).length
          ? iss.sub_issues.map(s => `  - ${s.sub_issue_text}`).join('\n')
          : '  (none)';
        return `ISSUE (id: ${iss.id})
Title: ${iss.title}
Discipline: ${iss.discipline || 'n/a'}
Existing sub-issues:
${subIssues}
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
      if (kind === 'new_sub_issue') {
        return {
          ...base,
          kind: 'new_sub_issue',
          issue_id: Number.isFinite(issueId) ? issueId : null,
          sub_issue_title: extractTag(block, 'SUB_ISSUE_TITLE'),
        };
      }
      return {
        ...base,
        kind: 'existing_issue',
        issue_id: Number.isFinite(issueId) ? issueId : null,
      };
    })
    .filter(p => {
      if (!p.summary) return false;
      if (p.kind === 'new_issue') return !!p.title;
      if (p.kind === 'new_sub_issue') return !!(p.issue_id && p.sub_issue_title);
      return !!p.issue_id;
    });
}
