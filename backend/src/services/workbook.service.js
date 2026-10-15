import { callClaude, ANTI_AI_SLOP_BLOCK, noEmDash } from './llm.shared.js';

// ─────────────────────────────────────────────────────────────────────────────
// Project Workbook: suggest updates to the workbook from pasted notes.
//
// The model is given the workbook's current rows and one set of notes, and
// returns proposals only: nothing is written here. The controller checks every
// id against the project's own rows before anything reaches the client, and
// the client applies the ticked proposals through the apply endpoint.
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You maintain a project-management workbook for a UK planning consultancy. It holds stage-gate questions (scored 0 to 5), risks, actions, issues and decisions for one planning project.

You are given the workbook's current state as JSON, then notes from a meeting, email, call or site visit. Propose changes to the workbook that the notes clearly support.

Rules:
- Never invent facts, dates, owners or scores. Leave a field out if the notes do not say.
- Prefer updating an existing row over creating a new one. Only create a row for something genuinely not covered by an existing row.
- "note" is one or two plain sentences saying what happened or was agreed, written in the team's own voice, with no date (the date is added for you). No em dashes.
- Use an existing owner name where one fits.
- Decisions are things agreed or decided in the notes. Issues are problems that have already happened. Risks are things that might happen. Actions are tasks someone must do.
- Only raise a gate "score" if the notes show the question is better answered than its current score. A score of 4 or 5 means ready to progress.
- Only propose a link when the notes make the relationship clear: "parent_id" puts an action under a risk, or an issue under an action or risk. "add_gate_refs" attaches an item to gate questions.
- "quote" is a short phrase copied from the notes that supports the proposal.
- Dates are YYYY-MM-DD. Priority is 1 (high) to 3 (low).
- If the notes contain nothing relevant, return empty arrays.

Reply with only JSON of this shape, no commentary:
{"summary":"one sentence on what the notes changed",
 "updates":[
   {"kind":"item","id":<item id>,"note":"...","status":"not started|in progress|completed","target":"YYYY-MM-DD","owner":"...","reason":"short why","quote":"..."},
   {"kind":"gate","gate_ref":"3.8","note":"...","score":3,"reason":"...","quote":"..."}],
 "new":[{"type":"action|risk|issue|decision","subject":"short title","text":"full wording","owner":"","priority":2,"target":"","gate_refs":["3.8"],"parent_id":<existing risk id for an action, existing action or risk id for an issue, or null>,"reason":"...","quote":"..."}],
 "links":[{"item_id":<item id>,"parent_id":<id or null>,"add_gate_refs":["3.7"],"reason":"...","quote":"..."}]}
Omit optional keys you are not changing.`;

function extractJson(raw) {
  const text = String(raw || '').trim();
  try { return JSON.parse(text); } catch { /* fall through */ }
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) { try { return JSON.parse(fence[1]); } catch { /* fall through */ } }
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last > first) { try { return JSON.parse(text.slice(first, last + 1)); } catch { /* fall through */ } }
  return null;
}

export async function suggestWorkbookUpdates({ noteText, noteDate, source, gate, items, owners }) {
  const state = {
    gate: gate.map(g => ({ gate_ref: g.ref, question: g.question, owner: g.owner, score: g.score, comment: (g.comment || '').slice(0, 150) })),
    items: items.map(i => ({
      id: i.id, type: i.type, subject: i.subject, text: (i.text || '').slice(0, 220), owner: i.owner, status: i.status,
      target: i.target, priority: i.priority, gate_refs: i.gate_refs, parent_id: i.parent_id,
      progress: (i.log || []).slice(-3).map(e => `${e.date}: ${e.text}`.slice(0, 200)),
    })),
  };

  const content = `TODAY'S DATE: ${new Date().toISOString().slice(0, 10)}
EXISTING OWNER NAMES: ${owners.join(', ') || 'none yet'}

CURRENT WORKBOOK STATE:
${JSON.stringify(state)}

NEW ${String(source || 'notes').toUpperCase()} DATED ${noteDate}:
${String(noteText || '').slice(0, 80000)}`;

  const raw = await callClaude(SYSTEM_PROMPT + ANTI_AI_SLOP_BLOCK, content, undefined, 8000);
  const parsed = extractJson(raw);
  if (!parsed || typeof parsed !== 'object') throw new Error('Could not read the suggestions. Try again, or paste less text.');

  const clean = v => (typeof v === 'string' ? noEmDash(v) : v);
  const arr = v => (Array.isArray(v) ? v : []);
  return {
    summary: clean(String(parsed.summary || '')),
    updates: arr(parsed.updates).map(u => ({ ...u, note: clean(u.note), reason: clean(u.reason) })),
    new: arr(parsed.new).map(n => ({ ...n, subject: clean(n.subject), text: clean(n.text), reason: clean(n.reason) })),
    links: arr(parsed.links).map(l => ({ ...l, reason: clean(l.reason) })),
  };
}
