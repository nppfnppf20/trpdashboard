import { callClaude, callLLM, resolveProvider } from './llm.shared.js';
import { getGuidingBrief } from '../controllers/guidingBriefs.controller.js';

const PROMPT_PREFIX = `You are a planning consultant assistant. Process a meeting transcript into a structured record.

Return your response using EXACTLY these delimiters — nothing before <MEETING_TITLE> and nothing after </DATE_SUGGESTIONS_JSON>:

<MEETING_TITLE>short title or leave blank</MEETING_TITLE>
<MEETING_DATE>YYYY-MM-DD or leave blank</MEETING_DATE>
<ATTENDEES>comma-separated names or leave blank</ATTENDEES>
<SUMMARY_HTML>
HTML summary here
</SUMMARY_HTML>
<ACTIONS_JSON>
[{"action_text":"...","owner":null,"due_date":null,"notes":null}]
</ACTIONS_JSON>
<COMPLETED_ACTIONS_JSON>
[{"id":123,"evidence":"..."}]
</COMPLETED_ACTIONS_JSON>
<DATE_SUGGESTIONS_JSON>
[{"title":"...","date":"YYYY-MM-DD"}]
</DATE_SUGGESTIONS_JSON>

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
2. AGENDA (if provided) DRIVES THE STRUCTURE of the summary. Use each agenda item as an <h3> section heading in the order given. Cover the discussion under each item. If topics arose outside the agenda, add a final <h3>Other Business</h3> section.
3. If NO agenda is provided, use the default structure defined below.
4. TRANSCRIPT is the primary source for all other content.
5. Never use em dashes (—) in any output. Use a comma, colon, or rewrite the sentence instead.`;

const PROMPT_STRUCTURE_DEFAULT = `════════════════════════════════════════
SUMMARY_HTML STRUCTURE (when no agenda is provided)
════════════════════════════════════════

Use the following structure when no agenda has been supplied. Use only <h3>, <p>, <ul>, <ol>, <li>, <strong> tags.

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

const PROMPT_COMPLETED_ACTIONS = `════════════════════════════════════════
COMPLETED_ACTIONS_JSON
════════════════════════════════════════

You may be given a numbered list of EXISTING OPEN ACTIONS carried over from previous meetings (id, text, owner). Review the transcript and identify ONLY the ones this transcript gives CLEAR evidence are now finished, resolved, or no longer needed.

JSON array. Each item: {"id": <the existing action's id, as a number>, "evidence": "short quote or close paraphrase from the transcript showing it's done"}
- Be conservative: an action being merely discussed, referenced, or chased up is NOT evidence it's complete. Only include it if the transcript clearly states or implies it has been finished, resolved, or is no longer needed.
- Never invent an id — only use ids from the EXISTING OPEN ACTIONS list you were given.
- If no existing open actions were provided, or none appear complete: []`;

const PROMPT_DATE_SUGGESTIONS = `════════════════════════════════════════
DATE_SUGGESTIONS_JSON
════════════════════════════════════════

Separately from ACTIONS_JSON, scan the transcript for specific dates that matter for SCHEDULING this project going forward — a site visit, a committee date, a submission or report deadline, a follow-up meeting date, a decision date. Not the date of this meeting itself, and not a date already in the past relative to TODAY'S DATE given below.

JSON array. Each item: {"title":"short label for what happens on that date, e.g. \\"Committee date\\"","date":"YYYY-MM-DD"}
- Only include a genuinely new, specific, future, schedulable date. Never invent one or guess from vague phrasing ("in a few weeks").
- Do not duplicate a due_date already captured on an action in ACTIONS_JSON — only include dates that aren't already represented there.
- If no such dates are mentioned: []`;

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

  return [PROMPT_PREFIX, structureSection + styleSection, PROMPT_ACTIONS, PROMPT_COMPLETED_ACTIONS, PROMPT_DATE_SUGGESTIONS].join('\n\n');
}

function extractTag(text, tag) {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

const EXTRACT_PROMPTS = {
  internal: `You are analysing an internal planning team meeting transcript. Your sole task is to identify and extract every piece of information discussed about POLICY UPDATES.

Policy updates include: changes to national planning policy (NPPF, NPPGs, PPGs), changes to local plans or SPDs, emerging policies, new appeal decisions that set precedent, changes to regulations or legislation affecting planning.

For each distinct policy topic mentioned, extract EVERYTHING that was said about it. Do NOT summarise or condense — capture the full substance of the discussion: what the policy change is, the specific wording or paragraph references if mentioned, who said what, every concern or implication raised, any examples given, any disagreement or uncertainty expressed, any practical consequences for live projects or future work. If someone made an offhand remark about a policy, include it. Nothing should be left out.

For each topic extract:
- topic: concise name/title (e.g. "NPPF Chapter 14 revision", "Local Plan partial review")
- detail: the complete record of everything said — treat this as a verbatim account in prose, not a summary. Include all specific details, references, names, figures, and opinions expressed.
- raised_by: who first raised it — use a real name or role if identifiable (e.g. "Sarah", "planning officer"). If the transcript only labels the speaker by number (e.g. "Speaker 4", "Speaker 7"), set this to null — speaker numbers carry no useful meaning.

Return ONLY a valid JSON array — no explanation, no markdown code fences, nothing else. If there are no policy updates discussed, return [].

Example format: [{"topic":"...","detail":"...","raised_by":"..."}]`,

  cpd: `You are analysing a CPD (Continuing Professional Development) session record. Your task is to identify the key topics covered and extract meaningful insights from each.

For each significant topic or learning point covered, extract:
- topic: concise title of what was covered
- detail: a thorough account — key points made, practical implications for planning work, anything noteworthy. Be detailed.

Return ONLY a valid JSON array — no explanation, no markdown code fences, nothing else. If no clear topics emerge, return [].

Example format: [{"topic":"...","detail":"..."}]`
};

export async function extractInsights(transcriptText, meetingType) {
  const prompt = EXTRACT_PROMPTS[meetingType];
  if (!prompt) return [];

  try {
    const raw = await callClaude(prompt, transcriptText.slice(0, 80000), undefined, 4096);
    // Strip any accidental markdown fences
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(item => item?.topic?.trim())
      .map(item => ({
        topic:     item.topic?.trim() ?? '',
        detail:    item.detail?.trim() ?? null,
        raised_by: item.raised_by?.trim() || null,
      }));
  } catch (err) {
    console.warn('[meeting.service] extractInsights failed:', err.message);
    return [];
  }
}

export async function processMeetingTranscript(text, fileName, userNotes = null, agenda = null, summaryType = 'brief', customPrompt = null, meetingType = 'project', provider = null, existingOpenActions = []) {
  const systemPrompt = await buildSystemPrompt();

  const parts = [`TODAY'S DATE: ${new Date().toISOString().slice(0, 10)}`];

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

  if (existingOpenActions?.length) {
    const list = existingOpenActions
      .map(a => `- id ${a.id}: ${a.action_text}${a.owner ? ` (owner: ${a.owner})` : ''}`)
      .join('\n');
    parts.push(`EXISTING OPEN ACTIONS (mark complete in COMPLETED_ACTIONS_JSON only with clear evidence):\n${list}`);
  }

  parts.push(`Meeting transcript${fileName ? ` (${fileName})` : ''}:\n\n${text.slice(0, 80000)}`);

  const resolvedProvider = await resolveProvider('meeting_processing', provider);
  const raw = await callLLM({ provider: resolvedProvider, system: systemPrompt, prompt: parts.join('\n\n'), maxTokens: 16000 });

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

  const completedRaw = extractTag(raw, 'COMPLETED_ACTIONS_JSON') || '[]';
  let completedActions = [];
  try {
    const parsed = JSON.parse(completedRaw);
    if (Array.isArray(parsed)) {
      const validIds = new Set(existingOpenActions.map(a => a.id));
      completedActions = parsed
        .filter(item => validIds.has(Number(item.id)))
        .map(item => ({ id: Number(item.id), evidence: item.evidence?.trim() || null }));
    }
  } catch {
    console.warn('[meeting.service] Could not parse COMPLETED_ACTIONS_JSON, defaulting to []:', completedRaw.slice(0, 200));
  }

  const dateSuggestionsRaw = extractTag(raw, 'DATE_SUGGESTIONS_JSON') || '[]';
  let dateSuggestions = [];
  try {
    const parsed = JSON.parse(dateSuggestionsRaw);
    if (Array.isArray(parsed)) {
      dateSuggestions = parsed
        .map(item => ({ title: item.title?.trim() || '', date: item.date || null }))
        .filter(d => d.title && d.date && /^\d{4}-\d{2}-\d{2}$/.test(d.date));
    }
  } catch {
    console.warn('[meeting.service] Could not parse DATE_SUGGESTIONS_JSON, defaulting to []:', dateSuggestionsRaw.slice(0, 200));
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
    })).filter(a => a.action_text),
    completedActions,
    dateSuggestions
  };
}
