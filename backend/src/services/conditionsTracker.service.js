import { callClaude } from './llm.shared.js';

const SYSTEM_PROMPT = `You are a planning consultant assistant maintaining a planning conditions discharge tracker. The user will provide:

1. SOURCE MATERIAL — typically an email trail or a typed note describing recent progress on discharging planning conditions.
2. One or more CONDITIONS, each with its number, title, full wording, the stated reason for the condition, and the previous dated progress entries already in the tracker.

The user has selected these conditions as ones the source material may relate to. For each condition it ACTUALLY contains relevant new information for, write the next dated entry in its progress log: a short note of what has just happened, written as if by the consultant team keeping the tracker.

Relevance — decide per condition:
- Return an <ITEM> only for conditions where the source material contains relevant NEW information (something that happened for that condition beyond what its previous progress entries already record). Omit the others entirely — never pad, stretch or speculate to cover a condition the material does not address.
- Exception: if the user has provided their own notes for a condition, always return an <ITEM> for it, based on those notes.
- If the source material contains nothing relevant to any of the listed conditions, return exactly:
<NONE/>

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

  const raw = await callClaude(SYSTEM_PROMPT, content, undefined, 8000);

  const blocks = raw.match(/<ITEM>[\s\S]*?<\/ITEM>/gi) || [];
  if (!blocks.length) {
    if (/<NONE\s*\/?>/i.test(raw)) return [];   // nothing relevant found — a valid outcome
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

// ─────────────────────────────────────────────────────────────────────────────
// Fee quote drafting: for each condition, list the actual works/documents the
// condition wording requires the consultant to provide. The email itself is
// assembled programmatically (wording and reason are inserted verbatim by
// code, never rewritten by the LLM).
// ─────────────────────────────────────────────────────────────────────────────

const FEE_QUOTE_PROMPT = `You are a planning consultant assistant. For EACH planning condition provided, identify the actual work the appointed consultant is being asked to provide in order to discharge the condition. This list goes in a fee quote request email that also quotes the full condition wording, so the consultant reads the detail there themselves.

Rules:
- Read the condition wording carefully and identify EVERY distinct document, plan, scheme, survey or piece of work the wording requires to be submitted, approved or carried out. Capture all of them, but list each deliverable ONCE.
- Name each deliverable at a high level ONLY. Do NOT itemise or summarise its required contents: no lists of what it must include, no sub-parts, no specifications. Where the condition sets out what the deliverable must contain (e.g. lettered parts (a), (b), (c) or a list of details), simply append "in line with the requirements stated within the condition wording" to the deliverable's name.
- Example: a condition requiring a CEMP that must include parts (a) to (h) becomes exactly one short item: "Construction Environmental Management Plan (CEMP: Biodiversity) in line with the requirements stated within the condition wording". It must NOT become a paragraph reciting parts (a) to (h).
- Use the condition wording's own name for the deliverable. Keep each item to a single short line.
- Separate items only for genuinely separate deliverables (e.g. a condition requiring both a lighting scheme and a landscaping plan is two items). Sub-parts of one document are never separate items.
- If the condition is a simple compliance condition with no deliverable (e.g. a time limit), return a single item stating the compliance action, e.g. "Confirmation of commencement date, no further deliverables identified".
- Never use an em dash anywhere in your output. Use a comma or the word "to" instead.
- Plain text only, no markdown.

Return your response using EXACTLY this XML structure, one <ITEM> block per condition, in the order given, nothing before the first <ITEM> and nothing after the last </ITEM>:

<ITEM>
<CONDITION_ID>the numeric id given for the condition</CONDITION_ID>
<WORKS>
<WORK>first deliverable</WORK>
<WORK>second deliverable</WORK>
</WORKS>
</ITEM>`;

export async function suggestFeeQuoteWorks(conditions) {
  const blocks = conditions.map(c => `CONDITION (id: ${c.id})
Number: ${c.condition_number || 'n/a'}
Title: ${c.title}
Wording: ${c.wording || 'n/a'}
Reason: ${c.reason || 'n/a'}`).join('\n\n');

  const raw = await callClaude(FEE_QUOTE_PROMPT, blocks, undefined, 8000);

  const items = raw.match(/<ITEM>[\s\S]*?<\/ITEM>/gi) || [];
  if (!items.length) {
    console.error('[conditionsTracker.service] No ITEM blocks in fee quote works. Raw (first 400):', raw.slice(0, 400));
    throw new Error('Could not generate fee quote items');
  }

  return items
    .map(block => {
      const worksBlock = extractTag(block, 'WORKS') || '';
      const works = (worksBlock.match(/<WORK>[\s\S]*?<\/WORK>/gi) || [])
        .map(w => extractTag(w, 'WORK'))
        .filter(Boolean)
        // belt and braces: no em dashes, ever
        .map(w => w.replace(/\s*—\s*/g, ', ').replace(/\s*–\s*/g, ', '));
      return {
        condition_id: parseInt(extractTag(block, 'CONDITION_ID'), 10),
        works,
      };
    })
    .filter(s => Number.isFinite(s.condition_id));
}
