// ─────────────────────────────────────────────────────────────────────────────
// Planning stages: shared definitions, the per-project state loader, and the
// "has a stage moved on?" suggestion logic used by meeting note processing and
// Project Chat. Table shapes are documented in migration 190_project_planning_stages.sql.
//
// Suggestions are strict on purpose and are never applied automatically: the
// model proposes a single change to a single stage with a verbatim quote, the
// server rejects anything it cannot verify, and the user accepts or dismisses.
// ─────────────────────────────────────────────────────────────────────────────

export const STAGE_KEYS = ['appraisal', 'pre_app', 'eia_screening', 'surveys', 'public_engagement', 'prepare_application', 'post_submission'];
export const STAGE_STATUSES = ['not_started', 'in_progress', 'complete', 'na'];

// What counts as clear evidence for each stage. Edit this list to tune what the model looks for.
export const STAGE_DEFINITIONS = [
  { key: 'appraisal', num: '1(a)', name: 'Detailed appraisal',
    start: 'work on the feasibility appraisal or scoping has actually begun (e.g. the client has instructed it, site appraisal is under way)',
    complete: 'the appraisal or scoping report has been delivered or signed off' },
  { key: 'pre_app', num: '2', name: 'Pre-application discussions',
    start: 'a pre-application request has been submitted to the LPA, or the first pre-application meeting has been booked or held',
    complete: 'the LPA\'s pre-application response or advice letter has been received' },
  { key: 'eia_screening', num: '3', name: 'EIA screening',
    start: 'an EIA screening opinion request has been submitted',
    complete: 'the EIA screening opinion has been issued or received',
    na: 'it has been clearly agreed that EIA screening is not required' },
  { key: 'surveys', num: '4(a)', name: 'Specialist surveys and reports',
    start: 'specialist surveys or reports have been instructed or fieldwork has started',
    complete: 'all the specialist surveys and reports have been completed and received' },
  { key: 'public_engagement', num: '5', name: 'Public engagement',
    start: 'public consultation or engagement has been launched, or an engagement event has been held',
    complete: 'public engagement has finished and its feedback has been reported',
    na: 'it has been clearly agreed that no public engagement will be carried out' },
  { key: 'prepare_application', num: '6', name: 'Prepare planning application',
    start: 'preparation of the application documents has started',
    complete: 'the application has been submitted to the LPA' },
  { key: 'post_submission', num: '7', name: 'Post-submission',
    start: 'the application has been submitted or validated by the LPA',
    complete: 'a decision has been issued, or the application has been withdrawn or closed' }
];

const DEF_BY_KEY = new Map(STAGE_DEFINITIONS.map(d => [d.key, d]));

// { applicable, stages: { <key>: status } } for a project, with a missing row meaning not started.
// null if there is no such project.
export async function loadPlanningStageState(db, projectId) {
  const { rows: proj } = await db.query('SELECT planning_stages_applicable AS applicable FROM public.projects WHERE id = $1', [projectId]);
  if (!proj.length) return null;
  const { rows } = await db.query('SELECT stage_key, status FROM public.project_planning_stages WHERE project_id = $1', [projectId]);
  const byKey = new Map(rows.map(r => [r.stage_key, r.status]));
  return {
    applicable: proj[0].applicable,
    stages: Object.fromEntries(STAGE_KEYS.map(k => [k, byKey.get(k) || 'not_started']))
  };
}

// A stage-suggestion pass is only worth running when the project uses stages at all.
export const stageSuggestionsWanted = state => !!state && state.applicable === true;

const normText = v => String(v || '').toLowerCase().replace(/[\s ]+/g, ' ').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").trim();

// The current status of each stage, one per line, for the model to read.
export function describeStageState(state) {
  return STAGE_DEFINITIONS.map(d => `- ${d.key} (Stage ${d.num} ${d.name}): ${state.stages[d.key].replace('_', ' ')}`).join('\n');
}

// What each stage counts as clear evidence of, for the model to read.
function describeEvidence() {
  return STAGE_DEFINITIONS.map(d => {
    const lines = [`- ${d.key}:`, `    start: ${d.start}`, `    complete: ${d.complete}`];
    if (d.na) lines.push(`    na: ${d.na}`);
    return lines.join('\n');
  }).join('\n');
}

// The strict rules, shared by the meeting prompt and the chat tool description.
export const STAGE_RULES = `This is a STRICT check. It should return nothing for the large majority of sources. Only report a change when the source states, plainly and in the past or present tense, that a specific event has actually happened or is happening now.

Each suggestion is ONE change to ONE stage. Stages are not a strict sequence: a new stage can start while an earlier one is still running, so never infer that an earlier stage has finished because a later one started, and never infer a start from a completion. If two separate events are clearly stated, give two separate suggestions.

Report a change only when ALL of these hold:
- The event is stated as having happened or as happening now ("we've received the pre-app response", "the EIA screening request went in on Monday", "consultation starts today"). Plans, intentions, expectations, requests and waiting do not count ("we'll submit next month", "still waiting for the response", "we should start the surveys").
- It matches the evidence for that stage below.
- The change makes sense for the stage's current status: "start" only for a stage that is not started, "complete" only for a stage that is not started or in progress, "na" only for a stage that is not started. Never suggest a change for a stage that is already complete or not applicable.
- You can quote the exact words that show it, copied verbatim from the source.

Evidence that counts, per stage:
${describeEvidence()}`;

export const STAGE_SUGGESTION_CHANGES = ['start', 'complete', 'na'];

// Validate what the model proposed. Anything that cannot be verified is dropped.
// `evidenceText` is the text the quote must appear in (the transcript plus any consultant notes).
export function validateStageSuggestions(items, state, evidenceText, { max = 3 } = {}) {
  if (!stageSuggestionsWanted(state) || !Array.isArray(items)) return [];
  const haystack = normText(evidenceText);
  const seen = new Set();
  const out = [];
  for (const raw of items) {
    const def = DEF_BY_KEY.get(raw?.stage_key);
    const change = raw?.change;
    if (!def || !STAGE_SUGGESTION_CHANGES.includes(change)) continue;
    if (String(raw?.confidence || '').toLowerCase() !== 'high') continue;
    if (seen.has(def.key)) continue;

    const status = state.stages[def.key];
    const allowed = change === 'start' ? status === 'not_started'
      : change === 'complete' ? (status === 'not_started' || status === 'in_progress')
      : status === 'not_started';
    if (!allowed) continue;
    if (change === 'na' && !def.na) continue;

    const quote = String(raw?.quote || '').trim();
    if (quote.length < 8 || !haystack.includes(normText(quote))) continue;

    seen.add(def.key);
    out.push({
      stage_key: def.key,
      stage_num: def.num,
      stage_name: def.name,
      change,
      quote: quote.slice(0, 300),
      reason: String(raw?.reason || '').trim().slice(0, 300) || null,
      current_status: status
    });
    if (out.length >= max) break;
  }
  return out;
}

// The status a change leads to.
export const STATUS_FOR_CHANGE = { start: 'in_progress', complete: 'complete', na: 'na' };

// Meeting-note prompt section. Returns '' when the project does not use stages.
export function buildMeetingStagePromptSection(state) {
  if (!stageSuggestionsWanted(state)) return '';
  return `════════════════════════════════════════
STAGE_SUGGESTIONS_JSON
════════════════════════════════════════

This project tracks seven planning stages. After the DATE_SUGGESTIONS_JSON block, also output a STAGE_SUGGESTIONS_JSON block. This is an exception to the instruction that nothing may follow </DATE_SUGGESTIONS_JSON>:

<STAGE_SUGGESTIONS_JSON>
[{"stage_key":"pre_app","change":"complete","confidence":"high","quote":"exact words from the source","reason":"one short sentence"}]
</STAGE_SUGGESTIONS_JSON>

${STAGE_RULES}

JSON array. Each item: {"stage_key": one of the keys listed, "change": "start" | "complete" | "na", "confidence": "high" or "low", "quote": "exact words copied from the transcript or consultant notes, max 200 characters", "reason": "one short sentence"}
- Only output items you are highly confident in, and mark them "high". If you are not sure, leave the item out.
- If nothing clearly qualifies, output: []`;
}

// The user-message part carrying the current stage statuses. '' when stages are not used.
export function buildMeetingStageContext(state) {
  if (!stageSuggestionsWanted(state)) return '';
  return `CURRENT PLANNING STAGE STATUS (do not suggest a change the status already reflects):\n${describeStageState(state)}`;
}

// Chat tool: one suggested stage change, accepted by the user on a card.
export const suggestStageChangeTool = {
  name: 'suggest_stage_change',
  description: `Suggest a change to ONE planning stage of this project. Call it only when a source, or the user, clearly states that a specific stage event has happened or is happening now. Never call it for plans, expectations or requests. Never call it for a stage whose status already reflects the event. Never infer one stage's change from another. You may call it more than once if two separate events are clearly stated. Always still produce your normal text reply.

${STAGE_RULES}`,
  input_schema: {
    type: 'object',
    properties: {
      stage_key: { type: 'string', enum: STAGE_KEYS },
      change: { type: 'string', enum: STAGE_SUGGESTION_CHANGES },
      quote: { type: 'string', description: 'Exact words from a source block or the user message that show the event, max 200 characters.' },
      reason: { type: 'string', description: 'One short sentence.' }
    },
    required: ['stage_key', 'change', 'quote', 'reason']
  }
};

// Chat system-prompt addendum with the current statuses. '' when stages are not used.
export function buildChatStageContext(state) {
  if (!stageSuggestionsWanted(state)) return '';
  return `\n\nCurrent planning stage status for this project:\n${describeStageState(state)}\nYou have a suggest_stage_change tool; follow its rules strictly.`;
}
