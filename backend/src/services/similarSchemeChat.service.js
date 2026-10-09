/**
 * Chat over the documents uploaded against saved Similar Schemes. Answers come only from the text of the ticked
 * schemes' documents (decision notices, officer reports, consultee responses). The project's own sources (policies,
 * trackers, meeting notes) are given as framing so questions like "how is the policy being interpreted" can be answered
 * in terms of our project. Every claim about a scheme carries a citation, and each cited quote is checked against the
 * document's text (unverified quotes are dropped).
 */

import { pool } from '../db.js';
import { assembleContext, assembleSourceTexts } from './projectChat.service.js';
import { makeFinder } from './appealbaseQuotes.js';
import { salvage } from './appealPrecedentChat.service.js';
import { client as anthropic, parseJSON, MODEL_SONNET } from './llm.shared.js';

export const CHAT_LIMITS = { maxSchemes: 10, maxDocChars: 600000, maxSourceChars: 100000, maxBlockChars: 30000, maxMessages: 30 }; // ~175k tokens in all

export const TYPE_LABELS = {
  decision_notice: 'Decision notice',
  officer_report: 'Officer report',
  consultee: 'Consultee response',
  other: 'Other document'
};

/** Project groups the chat may be given (all exist in projectChat.service). */
export const CHAT_GROUPS = ['policies', 'policy_documents', 'planning_history', 'consultation', 'conditions', 'issues_tracker', 'key_issues'];

const bad = (message, status = 400) => Object.assign(new Error(message), { status });
const clip = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

function instructions(project, hasSources) {
  return `You are a planning analyst helping a planning consultant interrogate documents from planning applications for comparable schemes (precedents). The documents are decision notices, officer or committee reports and consultee responses. Answer ONLY from the documents provided.

THE LIVE PROJECT: ${project?.project_name ?? 'the project'}.${hasSources ? ' Its own information (project details, policies, trackers, notes) is given under PROJECT SOURCES. Use it to understand what the user is asking and to relate the precedents to the project, but never present it as evidence about a precedent scheme.' : ''}

RULES
- Answer the question directly in plain prose, using short paragraphs or bullet points. Name each scheme by its reference and say which kind of document each point comes from (officer report, decision notice, consultee). Distinguish clearly between schemes, and between what an officer recommended and what the decision-maker decided.
- Aim for under 500 words and no more than about 20 citations; cite the strongest support for each point rather than every detail.
- Every factual claim about a scheme must be supported by a citation. Mark it in the answer with [n] and list it in "citations".
- Quotes: one short contiguous span, under 250 characters, copied exactly from the cited document, no ellipsis joins and no paraphrase. If you cannot quote support for a claim, do not make the claim.
- If the documents do not contain the answer, or a scheme has no document of the kind needed (for example no officer report), say so plainly. Never infer a conclusion the text does not state.
- Give the paragraph, section or reason number in "para" where you can see it, otherwise an empty string.

Return ONLY a JSON object, no other text:
{"answer": "<your answer, with [1] [2] markers>", "citations": [{"n": 1, "doc": <document id number>, "para": "<paragraph number or empty>", "quote": "<exact span>"}]}`;
}

/** The chosen project policies (by id), as rows. */
export async function loadPolicies(projectId, ids) {
  const clean = (Array.isArray(ids) ? ids : []).map(Number).filter(Number.isFinite).slice(0, 50);
  if (!clean.length) return [];
  const { rows } = await pool.query(
    `SELECT id, policy_reference, policy_name, policy_type, policy_text, relevant_supporting_text, notes
       FROM project_policies
      WHERE project_id = $1 AND id = ANY($2)
      ORDER BY policy_type, id`,
    [projectId, clean]
  );
  return rows;
}

/** Policy rows as the text the model reads. */
export function policyText(rows) {
  return rows
    .map(r =>
      [
        `Policy${r.policy_reference ? ` ${r.policy_reference}` : ''}: ${r.policy_name}${r.policy_type ? ` (${r.policy_type})` : ''}`,
        r.policy_text ? `  Policy text: ${r.policy_text}` : null,
        r.relevant_supporting_text ? `  Relevant supporting text: ${r.relevant_supporting_text}` : null,
        r.notes ? `  Notes: ${r.notes}` : null
      ]
        .filter(Boolean)
        .join('\n')
    )
    .join('\n\n');
}

/** Project sources as labelled blocks, capped so they cannot crowd out the documents. */
async function loadSources(projectId, sources = {}) {
  const policyRows = await loadPolicies(projectId, sources.policy_ids);
  // Individually chosen policies replace the all-policies group.
  const groups = (Array.isArray(sources.groups) ? sources.groups : []).filter(g => CHAT_GROUPS.includes(g) && !(g === 'policies' && policyRows.length));
  const ids = a => (Array.isArray(a) ? a.map(Number).filter(Number.isFinite).slice(0, 25) : []);
  const documentIds = ids(sources.document_ids);
  const meetingIds = ids(sources.meeting_ids);
  const mode = ['notes', 'transcript', 'both'].includes(sources.mode) ? sources.mode : 'notes';

  const { blocks: projectBlocks } = await assembleContext(projectId, { project_details: true, groups });
  const blocks = policyRows.length ? [...projectBlocks, { label: 'Selected policies', text: policyText(policyRows) }] : projectBlocks;
  const picked = documentIds.length || meetingIds.length ? (await assembleSourceTexts(projectId, { documentIds, meetingIds, mode })).blocks : [];

  let used = 0;
  let truncated = false;
  const kept = [];
  for (const b of [...blocks, ...picked]) {
    const room = CHAT_LIMITS.maxSourceChars - used;
    if (room <= 500) {
      truncated = true;
      break;
    }
    let text = b.text.slice(0, Math.min(CHAT_LIMITS.maxBlockChars, room));
    if (text.length < b.text.length) truncated = true;
    used += text.length;
    kept.push(`### ${b.label}\n${text}`);
  }
  return { text: kept.join('\n\n'), truncated, hasSources: kept.length > 0 };
}

/**
 * @param {{ projectId: number, names: string[], messages: {role: 'user'|'assistant', content: string}[], sources?: object }} args
 */
export async function chatAboutSchemeDocuments({ projectId, names, messages, sources }) {
  const unique = [...new Set((names ?? []).map(String))];
  if (!unique.length) throw bad('Tick at least one saved scheme to ask about.');
  if (unique.length > CHAT_LIMITS.maxSchemes) throw bad(`Too many schemes ticked (${unique.length}). Choose ${CHAT_LIMITS.maxSchemes} or fewer.`);
  const convo = (messages ?? []).filter(m => (m.role === 'user' || m.role === 'assistant') && String(m.content ?? '').trim()).slice(-CHAT_LIMITS.maxMessages);
  if (!convo.length || convo[convo.length - 1].role !== 'user') throw bad('Send a question.');

  const { rows } = await pool.query(
    `SELECT d.id, d.planit_name, d.filename, d.doc_type, d.extracted_text, s.data AS scheme
       FROM similar_scheme_documents d
       JOIN similar_schemes_saved s ON s.project_id = d.project_id AND s.planit_name = d.planit_name
      WHERE d.project_id = $1 AND d.planit_name = ANY($2)
      ORDER BY d.planit_name, d.doc_type, d.id`,
    [projectId, unique]
  );
  if (!rows.length) throw bad('None of the ticked schemes have documents yet. Upload some first.');

  const totalChars = rows.reduce((n, d) => n + d.extracted_text.length, 0);
  if (totalChars > CHAT_LIMITS.maxDocChars) {
    throw bad(`These documents are too long to read together (about ${Math.round(totalChars / 4000)}k tokens). Untick some schemes and try again.`);
  }

  const { rows: proj } = await pool.query('SELECT project_name FROM projects WHERE id = $1', [projectId]);
  const src = await loadSources(projectId, sources);

  const byScheme = new Map();
  for (const d of rows) {
    if (!byScheme.has(d.planit_name)) byScheme.set(d.planit_name, { scheme: d.scheme, docs: [] });
    byScheme.get(d.planit_name).docs.push(d);
  }
  const documentsBlock = [...byScheme.entries()]
    .map(([name, { scheme, docs }]) => {
      const head = `<scheme reference="${name}" status="${scheme?.app_state ?? ''}" address="${clip(scheme?.address, 120)}" proposal="${clip(scheme?.description, 300)}">`;
      const body = docs
        .map(d => `<document id="${d.id}" type="${TYPE_LABELS[d.doc_type]}" file="${clip(d.filename, 100)}">\n${d.extracted_text}\n</document>`)
        .join('\n');
      return `${head}\n${body}\n</scheme>`;
    })
    .join('\n\n');

  const system = [{ type: 'text', text: instructions(proj[0], src.hasSources) }];
  if (src.hasSources) system.push({ type: 'text', text: `PROJECT SOURCES\n\n${src.text}` });
  system.push({ type: 'text', text: `PRECEDENT DOCUMENTS\n\n${documentsBlock}`, cache_control: { type: 'ephemeral' } });

  const resp = await anthropic.messages.create({
    model: MODEL_SONNET,
    max_tokens: 8000,
    system,
    messages: convo.map(m => ({ role: m.role, content: String(m.content) }))
  });

  const raw = resp.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
  let answer = raw;
  let citations = [];
  try {
    const j = parseJSON(raw);
    answer = String(j.answer ?? '');
    citations = Array.isArray(j.citations) ? j.citations : [];
  } catch {
    ({ answer, citations } = salvage(raw));
    if (resp.stop_reason === 'max_tokens') answer += '\n\n(The reply was cut off because it was very long, so some citations may be missing. Ask a narrower question for a shorter answer.)';
  }

  const byId = new Map(rows.map(d => [d.id, d]));
  const finders = new Map();
  const checked = citations
    .filter(c => c && byId.has(Number(c.doc)))
    .map((c, i) => {
      const d = byId.get(Number(c.doc));
      if (!finders.has(d.id)) finders.set(d.id, makeFinder(d.extracted_text));
      const verified = !!c.quote && finders.get(d.id)(c.quote);
      return {
        n: Number(c.n) || i + 1,
        doc: d.id,
        scheme: d.planit_name,
        type: TYPE_LABELS[d.doc_type],
        filename: d.filename,
        para: c.para ? String(c.para) : '',
        quote: verified ? c.quote : '',
        verified
      };
    });

  return {
    reply: answer,
    citations: checked,
    contextTokens: Math.round((totalChars + (src.hasSources ? src.text.length : 0)) / 4),
    sourcesTruncated: src.truncated,
    usage: { input: resp.usage.input_tokens, output: resp.usage.output_tokens, cacheRead: resp.usage.cache_read_input_tokens ?? 0, cacheWrite: resp.usage.cache_creation_input_tokens ?? 0 }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Policy lens: how each ticked scheme's documents treat the chosen policies
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_LENS_QUESTION = 'How is each policy interpreted, and what weight is given to any harm or conflict with it?';
const KINDS = ['officer_report', 'decision_notice', 'consultee'];

const LENS_SYSTEM = `You are a planning analyst comparing how decision-makers treated specific planning policies in documents from comparable schemes (precedents). Answer ONLY from the precedent documents provided.

You are given SELECTED POLICIES (the policies the consultant is interested in), a QUESTION, and the documents of several schemes. For each scheme, report what its documents say about the selected policies or the matter they cover, in answer to the question.

Return ONLY a JSON object, no other text:
{"schemes": [{"reference": "<scheme reference exactly as given>", "weight": {"wording": "<the decision-maker's exact words for the level of harm, conflict or weight given, or empty>", "doc": <document id or null>, "quote": "<exact span containing that wording, or empty>"}, "findings": [{"doc": <document id number>, "para": "<paragraph, section or reason number, or empty>", "text": "<one or two plain sentences answering the question from that document>", "quote": "<exact span from that document supporting the sentence>"}]}], "pattern": ["<short bullet>"]}

RULES
- Every finding needs a quote: one short contiguous span, under 250 characters, copied exactly from the cited document, no ellipsis joins and no paraphrase. If you cannot quote support, leave the finding out.
- At most 3 findings per document. Prefer the passages that show how the policy was read and what weight the harm or conflict was given.
- If a scheme's documents do not address the policies, return its entry with an empty findings list. Never infer a conclusion the text does not state.
- "pattern" is 2 to 4 short bullets comparing the schemes (for example how strictly the policy was read, how the refused and permitted cases differ, what the permitted ones relied on). Base every bullet only on the findings you have returned; add no new claims.
- Distinguish what an officer recommended from what the decision-maker decided.`;

/**
 * @param {{ projectId: number, names: string[], policyIds: number[], question?: string }} args
 */
export async function lensSchemeDocuments({ projectId, names, policyIds, question }) {
  const unique = [...new Set((names ?? []).map(String))];
  if (!unique.length) throw bad('Tick at least one saved scheme.');
  if (unique.length > CHAT_LIMITS.maxSchemes) throw bad(`Too many schemes ticked (${unique.length}). Choose ${CHAT_LIMITS.maxSchemes} or fewer.`);
  const policyRows = await loadPolicies(projectId, policyIds);
  if (!policyRows.length) throw bad('Choose at least one policy.');

  const { rows } = await pool.query(
    `SELECT d.id, d.planit_name, d.filename, d.doc_type, d.extracted_text, s.data AS scheme
       FROM similar_scheme_documents d
       JOIN similar_schemes_saved s ON s.project_id = d.project_id AND s.planit_name = d.planit_name
      WHERE d.project_id = $1 AND d.planit_name = ANY($2)
      ORDER BY d.planit_name, d.doc_type, d.id`,
    [projectId, unique]
  );
  if (!rows.length) throw bad('None of the ticked schemes have documents yet. Upload some first.');
  const totalChars = rows.reduce((n, d) => n + d.extracted_text.length, 0);
  if (totalChars > CHAT_LIMITS.maxDocChars) {
    throw bad(`These documents are too long to read together (about ${Math.round(totalChars / 4000)}k tokens). Untick some schemes and try again.`);
  }

  const byScheme = new Map();
  for (const d of rows) {
    if (!byScheme.has(d.planit_name)) byScheme.set(d.planit_name, { scheme: d.scheme, docs: [] });
    byScheme.get(d.planit_name).docs.push(d);
  }
  const documentsBlock = [...byScheme.entries()]
    .map(([name, { scheme, docs }]) => {
      const head = `<scheme reference="${name}" status="${scheme?.app_state ?? ''}" address="${clip(scheme?.address, 120)}" proposal="${clip(scheme?.description, 300)}">`;
      const body = docs.map(d => `<document id="${d.id}" type="${TYPE_LABELS[d.doc_type]}" file="${clip(d.filename, 100)}">\n${d.extracted_text}\n</document>`).join('\n');
      return `${head}\n${body}\n</scheme>`;
    })
    .join('\n\n');

  const resp = await anthropic.messages.create({
    model: MODEL_SONNET,
    max_tokens: 8000,
    system: [
      { type: 'text', text: LENS_SYSTEM },
      { type: 'text', text: `SELECTED POLICIES\n\n${policyText(policyRows)}` },
      { type: 'text', text: `PRECEDENT DOCUMENTS\n\n${documentsBlock}`, cache_control: { type: 'ephemeral' } }
    ],
    messages: [{ role: 'user', content: `QUESTION: ${clip(question, 600) || DEFAULT_LENS_QUESTION}` }]
  });
  const raw = resp.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
  let out;
  try {
    out = parseJSON(raw);
  } catch {
    throw bad(resp.stop_reason === 'max_tokens' ? 'The comparison was too long to finish. Select fewer schemes or policies and try again.' : 'The AI reply could not be read. Try again.', 502);
  }

  const byId = new Map(rows.map(d => [d.id, d]));
  const finders = new Map();
  const verify = (d, quote) => {
    if (!quote) return false;
    if (!finders.has(d.id)) finders.set(d.id, makeFinder(d.extracted_text));
    return finders.get(d.id)(quote);
  };

  const returned = new Map((out.schemes ?? []).map(x => [String(x.reference), x]));
  const schemes = [...byScheme.entries()].map(([name, { scheme, docs }]) => {
    const got = returned.get(name) ?? {};
    const mine = d => !!d && d.planit_name === name;
    const findings = (Array.isArray(got.findings) ? got.findings : [])
      .map(f => ({ f, d: byId.get(Number(f.doc)) }))
      .filter(({ d }) => mine(d))
      .map(({ f, d }) => {
        const verified = verify(d, f.quote);
        return { kind: d.doc_type, doc: d.id, type: TYPE_LABELS[d.doc_type], para: f.para ? String(f.para) : '', text: clip(f.text, 500), quote: verified ? f.quote : '', verified };
      });
    const wd = got.weight?.doc != null ? byId.get(Number(got.weight.doc)) : null;
    const weightOk = !!got.weight?.wording && mine(wd);
    const weight = weightOk
      ? { wording: clip(got.weight.wording, 120), doc: wd.id, quote: verify(wd, got.weight.quote) ? got.weight.quote : '', verified: verify(wd, got.weight.quote) }
      : null;
    return {
      name,
      description: clip(scheme?.description, 200),
      state: scheme?.app_state ?? '',
      missing: KINDS.filter(k => !docs.some(d => d.doc_type === k)),
      findings,
      weight
    };
  });

  return {
    schemes,
    pattern: (Array.isArray(out.pattern) ? out.pattern : []).map(b => clip(b, 400)).filter(Boolean).slice(0, 5),
    policies: policyRows.map(p => ({ id: p.id, reference: p.policy_reference, name: p.policy_name })),
    contextTokens: Math.round(totalChars / 4),
    usage: { input: resp.usage.input_tokens, output: resp.usage.output_tokens, cacheRead: resp.usage.cache_read_input_tokens ?? 0, cacheWrite: resp.usage.cache_creation_input_tokens ?? 0 }
  };
}
