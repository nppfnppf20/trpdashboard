/**
 * LPA Decision Analysis service.
 * Analyses individual planning documents and synthesises patterns across a set
 * of LPA decisions to produce a strategic intelligence report.
 */

import { chunkText } from './parser.service.js';
import {
  callClaude, parseJSON, MAX_CHUNKS, MODEL_SONNET,
  PLANNING_TIER_LABELS, PLANNING_TIER_ORDER, buildSequentialBatches,
  buildFullDocumentBlock, checkDocumentSize
} from './llm.shared.js';

// ─────────────────────────────────────────────────────────────────────────────
// Prompt constants
// ─────────────────────────────────────────────────────────────────────────────

const LPA_DOC_ANALYSIS_SYSTEM = `You are a specialist planning consultant. \
Your job is to read planning documents — decision notices, officer reports, appeal decisions, \
supporting documents — and extract structured intelligence about how a Local Planning Authority \
(LPA) has approached and decided similar planning applications. \
You will be given context about a live project (site, description, use type) and a list of \
relevant planning policies the team is tracking. \
Your analysis will be used to inform the project team's strategy and advice to their client. \
Never use em dashes (—); use a comma, colon, or rewrite the sentence instead.`;

const LPA_DOC_ANALYSIS_PROMPT = `You are analysing a planning document to extract intelligence relevant to a live project.

## Live Project Context
{{PROJECT_CONTEXT}}
{{BRIEFING_NOTE}}
## Relevant Planning Policies We Are Tracking
Each policy below is given in full, verbatim, where its wording has been recorded — use the actual wording, not just the reference, when assessing how a document treats it.
{{POLICIES_BLOCK}}

## Document to Analyse
<document>
{{DOCUMENT_TEXT}}
</document>

Analyse this document and respond with a valid JSON object (no markdown fences):
{
  "document_type": "Decision Notice | Officer Report | Appeal Decision | Supporting Document | Other",
  "outcome": "Approved | Refused | Allowed | Dismissed | N/A | Unknown",
  "application_ref": "application reference if found, or null",
  "lpa_name": "LPA name if found, or null",
  "summary": "200 word plain English summary of what this document is and what it decided/concludes",
  "key_reasoning": "The main planning reasoning — why was it approved/refused/allowed/dismissed? What were the determining issues?",
  "policy_treatment": [
    {
      "policy_ref": "exact policy reference as listed in our tracking list, or null if not in our list",
      "policy_name": "policy name",
      "treatment": "How did the decision-maker apply or interpret this policy? Were they found to conflict, comply, or be neutral? Any notable weighting given?"
    }
  ]
}

Rules:
- Only include policies in policy_treatment that are actually discussed in the document. Do not invent entries.
- Prioritise policies from our tracking list but include other significant policies if they appear.
- Be specific and professional — this will be read by planning consultants preparing a case.
- If the document is not a planning decision or report (e.g. a background study), set outcome to "N/A" and focus the summary and key_reasoning on the document's planning implications.`;

const LPA_SYNTHESIS_SYSTEM = `You are a senior planning consultant producing a strategic analysis report. \
You have reviewed a set of planning documents from similar schemes and must now produce a structured \
intelligence report to inform your client's project strategy. \
Write in clear, professional planning language. Be specific, evidence-based, and directly useful \
to a planning team preparing a case. \
Never use em dashes (—); use a comma, colon, or rewrite the sentence instead.`;

const LPA_SYNTHESIS_PROMPT = `You are producing a strategic LPA decision analysis report for the following project.

## Live Project Context
{{PROJECT_CONTEXT}}
{{BRIEFING_NOTE}}
## Relevant Planning Policies We Are Tracking
Each policy below is given in full, verbatim, where its wording has been recorded — ground your assessment of how it has been treated in the actual wording, not just its name.
{{POLICIES_BLOCK}}

## Individual Document Analyses
The following documents have been reviewed. Each entry contains the document type, outcome, and key findings:

{{DOC_SUMMARIES}}

---

Produce a structured report with exactly these three sections. Return plain text with markdown headings — no JSON:

## Key Themes
Identify 4-8 recurring themes across the decisions/documents. For each theme:
- State the theme clearly as a heading
- Explain what the evidence shows, citing which types of decisions/outcomes support it
- Note any tensions or contradictions across the cases

## How the LPA Has Been Deciding Similar Cases
A narrative assessment of the LPA's decision-making pattern across these cases:
- What have been the main determining factors for approval vs refusal?
- Are there conditions commonly attached?
- Has the approach been consistent or is there variability?
- What has been the outcome at appeal where relevant?
- Any notable shifts in approach over time if apparent?

## How Our Relevant Policies Have Been Treated
For each policy in our tracking list that appears across the documents, write a dedicated section:
- **[Policy Reference]: [Policy Name]**
  - How has this policy been applied across the cases, based on its actual wording (not just its name)?
  - Has it been used to support refusal, justify approval, or treated as a neutral factor?
  - Are there any notable interpretations or weightings by the LPA or Inspector?
  - Close with 1-2 sentences of concrete, scheme-specific lessons: given our site, use type, description, and any briefing note above, what does this policy's treatment across these documents mean for how we should approach it on our own scheme? Be specific to our project, not generic.

Only include policies that genuinely feature in the reviewed documents. If a tracked policy does not appear, note it briefly at the end under "Policies Not Yet Evidenced".`;

// ─────────────────────────────────────────────────────────────────────────────
// Policy extraction — read a planning document and pull out the policies it
// cites, verbatim, so they can be reviewed and added to a project's policy
// tracker rather than typed in by hand.
// ─────────────────────────────────────────────────────────────────────────────

const POLICY_TYPES = new Set(['national', 'local', 'neighbourhood', 'supplementary', 'other']);
const PLAN_SECTIONS = new Set(['adopted', 'emerging', 'supplementary', 'other']);
const PLAN_TYPES = new Set(['local', 'neighbourhood']);

const POLICY_EXTRACTION_SYSTEM = `You are a specialist planning consultant extracting planning policies and development plan documents from a planning document \
(e.g. a planning statement, appeal statement, stage one review, or committee report) so they can be logged in a project's policy tracker. \
This is an identification pass only: you are finding WHICH policies and plans are cited, not their wording. A document like a pre-application \
letter or stage one review typically discusses, summarises, or briefly quotes a fragment of a policy while making a point about it — none of \
that counts as the policy's full operative wording, and none of it should be recorded as such. The actual verbatim wording is captured later, \
in a separate pass that reads the source plan document (or, for NPPF policies, pulled from a canonical library) — never by this one. \
Never use em dashes (—); use a comma, colon, or rewrite the sentence instead.`;

const POLICY_EXTRACTION_PROMPT = `The following is one section of a larger document (other sections are sent separately as their own requests) — extract two things found in THIS section, so they can be added to a project's policy tracker:
1. Every distinct planning policy it cites, quotes, or discusses.
2. Every development plan document, supplementary planning document, or other material consideration document it references (e.g. an adopted or emerging Local Plan, a Neighbourhood Plan, an SPD/SPG, or another material consideration such as the NPPF as a whole document).

Document section:
<document>
{{DOCUMENT}}
</document>

For each distinct DOCUMENT/PLAN referenced, extract:
- plan_name: the document's title as given, e.g. "Anytown District Local Plan", "Anytown Neighbourhood Plan", "Residential Design SPD"
- section: one of "adopted" (an adopted/made Local or Neighbourhood Plan), "emerging" (a Local or Neighbourhood Plan not yet adopted/made, e.g. "emerging", "draft", "Regulation 19"), "supplementary" (SPD/SPG/design guide), "other" (anything else material, e.g. national guidance documents, technical standards)
- plan_type: "local" or "neighbourhood" if section is "adopted" or "emerging" (otherwise null)
- year_adopted: the year this document was adopted/made/published/issued, as a number, if given — applies to "adopted" plans, and equally to "supplementary" guidance (e.g. an SPD's adoption year) and "other" material considerations (e.g. a national guidance document's publication year). Null if not given, or if section is "emerging" (not yet adopted).
- month_adopted: the month (1-12) this document was adopted/made/published/issued, as a number, if given — same scope as year_adopted. Null if not given.

For each distinct POLICY you find, extract:
- policy_reference: the policy's reference/number as given, e.g. "Policy H1", "NPPF Para 11", "Policy DM10" (null if the document doesn't give one)
- policy_name: the policy's title/name as given in the document, or a short descriptive name if only a reference is given
- policy_type: one of "national" (NPPF/NPPG/national guidance), "local" (adopted Local Plan), "neighbourhood" (Neighbourhood Plan), "supplementary" (SPD/SPG/design guide), "other"
- plan_name: the name of the parent plan/document this policy belongs to, exactly matching a "plan_name" from the plans list above where applicable (null if the policy is national/NPPF or has no identifiable parent document)

Do NOT include a "policy_text" field, and do not attempt to record a policy's wording at all — not even if this section appears to quote a short fragment of one. This pass only identifies which policies exist; capturing their wording is a separate, later step that reads the actual source plan document.

Rules:
- Only extract policies and plans actually present in THIS section — never add ones you recognise from general knowledge that aren't cited here.
- If the same policy or plan is referenced more than once within this section, merge into a single entry using the fullest information available.
- Skip vague references with no identifiable name (e.g. "relevant planning policies", "the development plan" with no document named).
- Do not list the NPPF itself as a plan/document unless the document is being logged as a whole (e.g. "other") — individual NPPF paragraphs should just be policies with policy_type "national" and plan_name null.

Respond ONLY with valid JSON, no markdown fences:
{
  "plans": [
    { "plan_name": "Anytown District Local Plan", "section": "adopted", "plan_type": "local", "year_adopted": 2021, "month_adopted": null },
    { "plan_name": "Residential Design SPD", "section": "supplementary", "plan_type": null, "year_adopted": 2019, "month_adopted": 6 }
  ],
  "policies": [
    { "policy_reference": "Policy H1", "policy_name": "Housing Delivery", "policy_type": "local", "plan_name": "Anytown District Local Plan" }
  ]
}

If none are found in this section, return empty arrays.`;

// A plan/policy can turn up in more than one batch (partial mention in one
// section, full detail in another, or simply repeated) — these merges keep
// whichever version carries more information rather than just the first seen.
function mergePlans(existing, incoming) {
  const score = p => (p.year_adopted != null ? 1 : 0) + (p.month_adopted != null ? 1 : 0) + (p.plan_type != null ? 1 : 0);
  return score(incoming) > score(existing) ? incoming : existing;
}
function mergePolicies(existing, incoming) {
  if (!existing.policy_text && incoming.policy_text) return incoming;
  return existing;
}

export async function extractPoliciesFromDocument(rawText) {
  const { batches, warningMessage: truncationWarning } = buildSequentialBatches(rawText);
  if (!batches.length) return { policies: [], plans: [], sizeWarning: null };

  const plansByKey = new Map();
  const policiesByKey = new Map();
  let failedBatches = 0;

  // Sequential, not parallel: keeps each call's input and output small
  // enough to stay well under the token caps, regardless of how long the
  // source document is, and avoids firing many large calls at once.
  for (let i = 0; i < batches.length; i++) {
    const userPrompt = POLICY_EXTRACTION_PROMPT.replace('{{DOCUMENT}}', batches[i]);
    let raw, parsed;
    try {
      raw = await callClaude(POLICY_EXTRACTION_SYSTEM, userPrompt, MODEL_SONNET, 12000);
      parsed = parseJSON(raw);
    } catch (err) {
      console.error(`[extractPoliciesFromDocument] batch ${i + 1}/${batches.length} failed:`, err.message);
      failedBatches++;
      continue;
    }

    for (const p of (Array.isArray(parsed.plans) ? parsed.plans : [])) {
      if (!p.plan_name?.trim()) continue;
      const cleaned = {
        plan_name: p.plan_name.trim(),
        section: PLAN_SECTIONS.has(p.section) ? p.section : 'other',
        plan_type: PLAN_TYPES.has(p.plan_type) ? p.plan_type : null,
        year_adopted: Number.isInteger(p.year_adopted) ? p.year_adopted : null,
        month_adopted: Number.isInteger(p.month_adopted) && p.month_adopted >= 1 && p.month_adopted <= 12 ? p.month_adopted : null
      };
      const key = cleaned.plan_name.toLowerCase();
      const existing = plansByKey.get(key);
      plansByKey.set(key, existing ? mergePlans(existing, cleaned) : cleaned);
    }

    for (const p of (Array.isArray(parsed.policies) ? parsed.policies : [])) {
      if (!p.policy_name?.trim()) continue;
      const cleaned = {
        policy_reference: p.policy_reference?.trim() || '',
        policy_name: p.policy_name.trim(),
        policy_type: POLICY_TYPES.has(p.policy_type) ? p.policy_type : 'other',
        // Always empty here regardless of what the model returns — this pass
        // identifies policies, it never records wording (see prompt above).
        // National ones get filled from the NPPF library afterward; others
        // get filled later by the dedicated wording-extraction pass.
        policy_text: '',
        relevant_supporting_text: '',
        notes: '',
        is_key_policy: false,
        plan_name: p.plan_name?.trim() || null
      };
      const key = `${cleaned.policy_reference.toLowerCase()}|${cleaned.policy_name.toLowerCase()}`;
      const existing = policiesByKey.get(key);
      policiesByKey.set(key, existing ? mergePolicies(existing, cleaned) : cleaned);
    }
  }

  const failureWarning = failedBatches > 0
    ? `${failedBatches} of ${batches.length} document section(s) could not be processed — some policies or plans may be missing. Check the source document directly for that section.`
    : null;

  return {
    policies: [...policiesByKey.values()],
    plans: [...plansByKey.values()],
    sizeWarning: [truncationWarning, failureWarning].filter(Boolean).join(' ') || null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Policy wording extraction — given policies already saved against one
// development plan, re-read that plan's document and pull out each named
// policy's verbatim operative wording, distinct from its supporting/
// explanatory text. Run one plan at a time (the caller uploads that plan's
// document each time — nothing is persisted from the original extraction),
// so the prompt only ever has to search one document for the policies that
// actually belong to it. See [[project_policy_wording_extraction]].
// ─────────────────────────────────────────────────────────────────────────────

const POLICY_WORDING_SYSTEM = `You are a specialist planning consultant extracting the exact verbatim wording of specific, named planning policies from a development plan document (e.g. a Local Plan or Neighbourhood Plan), so it can be recorded precisely in a project's policy tracker.

You will be given a list of named policies to find, and the full text of the plan document. For each policy, locate it by its reference and/or name and extract ONLY its operative policy wording, exactly as written, character for character.

CRITICAL DISTINCTION: every policy in a development plan is normally followed or preceded by explanatory material such as "Reasoned Justification", "Supporting Text", "Explanation", or introductory context paragraphs under the same heading. Do NOT include any of this. Extract ONLY the operative wording of the policy itself, i.e. the actual normative text (the numbered/lettered criteria, "the Council will...", "Development will be permitted where...", etc.) that sits directly under the policy's own heading or box, before any "Reasoned Justification"/"Supporting Text"/"Explanation" sub-heading begins.

VERBATIM RULE: copy the operative wording word-for-word, including punctuation, capitalisation, and any lettered/numbered sub-parts inline. Do not paraphrase, summarise, correct grammar, reformat, or merge/split paragraphs.

If a listed policy cannot be found in this document at all (wrong document, or only referenced by name without its wording appearing here), return null for that policy's wording rather than guessing or reconstructing it from general knowledge.

Never use an em dash (—); use a comma, colon, or rewrite the sentence instead.`;

const POLICY_WORDING_PROMPT = `The following is one section of a larger document (other sections are sent separately as their own requests) — find and extract the verbatim operative wording of any of the listed policies that appear in THIS section. Most policies will not appear in any given section — that's expected, return null for those.

Policies to find:
{{POLICY_LIST}}

Document section:
<document>
{{DOCUMENT}}
</document>

Respond ONLY with valid JSON, no markdown fences:
{
  "results": [
    { "index": 1, "wording": "verbatim operative policy wording, or null if this policy is not found in THIS section" }
  ]
}
Return exactly one result per listed policy, in the same order, using its index number.`;

/**
 * @param {Array<{id:number, policy_reference:string|null, policy_name:string}>} policies - policies belonging to one plan
 * @param {string} rawText - the re-uploaded plan document's parsed text
 * @returns {Promise<{results: Array<{policy_id:number, wording:string|null}>, sizeWarning:string|null}>}
 */
export async function extractPolicyWordingFromDocument(policies, rawText) {
  const { batches, warningMessage: truncationWarning } = buildSequentialBatches(rawText);
  if (!batches.length) return { results: policies.map(p => ({ policy_id: p.id, wording: null })), sizeWarning: null };

  const policyList = policies
    .map((p, i) => `${i + 1}. ${p.policy_reference ? `${p.policy_reference}: ` : ''}${p.policy_name}`)
    .join('\n');

  const wordingById = new Map(policies.map(p => [p.id, null]));
  let failedBatches = 0;

  // Sequential, not parallel: keeps each call's input and output small
  // enough to stay well under the token caps, regardless of how long the
  // source document is. The full policy list is re-sent to every batch
  // (cheap — it's just references/names) since any policy could turn up in
  // any section; the document text is what's actually split.
  for (let i = 0; i < batches.length; i++) {
    const userPrompt = POLICY_WORDING_PROMPT
      .replace('{{POLICY_LIST}}', policyList)
      .replace('{{DOCUMENT}}', batches[i]);

    let raw, parsed;
    try {
      raw = await callClaude(POLICY_WORDING_SYSTEM, userPrompt, MODEL_SONNET, 12000);
      parsed = parseJSON(raw);
    } catch (err) {
      console.error(`[extractPolicyWordingFromDocument] batch ${i + 1}/${batches.length} failed:`, err.message);
      failedBatches++;
      continue;
    }

    const results = Array.isArray(parsed.results) ? parsed.results : [];
    const byIndex = new Map(results.map(r => [r.index, r]));
    policies.forEach((p, idx) => {
      if (wordingById.get(p.id)) return; // already found in an earlier batch
      const r = byIndex.get(idx + 1);
      const wording = typeof r?.wording === 'string' && r.wording.trim() ? r.wording.trim() : null;
      if (wording) wordingById.set(p.id, wording);
    });
  }

  const failureWarning = failedBatches > 0
    ? `${failedBatches} of ${batches.length} document section(s) could not be processed — some policy wording may be missing. Check the source document directly for that section.`
    : null;

  return {
    results: policies.map(p => ({ policy_id: p.id, wording: wordingById.get(p.id) })),
    sizeWarning: [truncationWarning, failureWarning].filter(Boolean).join(' ') || null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Plan relevance summary — for a plan document with no policies logged
// against it (typically Supplementary Guidance or another material
// consideration, which isn't structured into discrete "policies" the way a
// Local Plan is), generate a short project-specific note on how the
// document actually applies to this site and proposal, grounded in the
// re-uploaded document and the project's own context. Used by the same
// "Extract Policy Wording" flow as extractPolicyWordingFromDocument above —
// which of the two runs depends on whether the chosen plan has any saved
// policies. Nothing is saved here; the caller reviews it first, same as
// everywhere else, then saves it into that plan's own `relevance` field.
// ─────────────────────────────────────────────────────────────────────────────

const PLAN_RELEVANCE_SYSTEM = `You are a specialist planning consultant writing a short, project-specific relevance note on a planning document (typically supplementary guidance, an SPD, or another material consideration) for a live project's policy tracker. \
You are not summarising the document in general — you are judging what in it actually bears on this specific site and proposal, and saying so plainly. \
Never use em dashes (—); use a comma, colon, or rewrite the sentence instead.`;

const PLAN_RELEVANCE_PROMPT = `## Live Project Context
{{PROJECT_CONTEXT}}

## Document: {{PLAN_NAME}}
<document>
{{DOCUMENT}}
</document>

Write a concise relevance note, 2-4 short paragraphs of plain text (no markdown headings, no bullet lists), explaining how this document applies to THIS project specifically — which parts of its guidance or content are most relevant to the site and the proposed development, and why, given the project context above. Do not produce a generic summary of the whole document; focus only on what matters here. If, having read it, the document turns out to have little or no bearing on this particular site or proposal, say that plainly instead of inventing relevance.`;

/**
 * @param {string} planName
 * @param {object} projectContext - shape returned by the controller's getProjectContext
 * @param {string} rawText - the re-uploaded document's parsed text
 * @returns {Promise<{summary: string, warning: string|null}>}
 */
export async function generatePlanRelevanceSummary(planName, projectContext, rawText) {
  const sizeCheck = checkDocumentSize(rawText);
  if (sizeCheck.status === 'rejected') {
    const err = new Error(sizeCheck.warningMessage);
    err.status = 400;
    throw err;
  }

  const docBlock = buildFullDocumentBlock(rawText);
  const userPrompt = PLAN_RELEVANCE_PROMPT
    .replace('{{PROJECT_CONTEXT}}', buildProjectBlock(projectContext))
    .replace('{{PLAN_NAME}}', planName)
    .replace('{{DOCUMENT}}', docBlock);

  const raw = await callClaude(PLAN_RELEVANCE_SYSTEM, userPrompt, MODEL_SONNET, 2000);

  return {
    summary: raw.trim(),
    warning: sizeCheck.warningMessage,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared prompt-block builders
// ─────────────────────────────────────────────────────────────────────────────

function buildProjectBlock(projectContext) {
  return [
    projectContext.name && `Project: ${projectContext.name}`,
    projectContext.site_address && `Site: ${projectContext.site_address}`,
    projectContext.lpa && `LPA: ${projectContext.lpa}`,
    projectContext.use_type && `Use type: ${projectContext.use_type}`,
    projectContext.description && `Description: ${projectContext.description}`
  ].filter(Boolean).join('\n');
}

function buildBriefingNoteBlock(briefingNote) {
  return briefingNote?.trim()
    ? `\n## Scheme Context / Briefing Note\n${briefingNote.trim()}\n`
    : '';
}

// Full verbatim policy text (not just reference/name) grouped by tier, so
// treatment/interpretation is grounded in what each policy actually says —
// mirrors the linkedPoliciesBlock pattern in llm.shared.js's
// buildExtractPointsPrompt.
function buildPoliciesBlock(policies) {
  if (!policies.length) return 'No specific policies have been entered yet.';

  return PLANNING_TIER_ORDER
    .flatMap(tier => policies.filter(p => p.policy_type === tier))
    .map(p => {
      const header = `### ${PLANNING_TIER_LABELS[p.policy_type] ?? p.policy_type}: ${p.policy_reference ? p.policy_reference + ': ' : ''}${p.policy_name}${p.is_key_policy ? ' [KEY POLICY]' : ''}`;
      const policyText = p.policy_text?.trim() ? `Policy wording:\n${p.policy_text.trim()}` : '(No policy wording recorded)';
      const support = p.relevant_supporting_text?.trim() ? `\nRelevant context/guidance:\n${p.relevant_supporting_text.trim()}` : '';
      return `${header}\n${policyText}${support}`;
    })
    .join('\n\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

export async function analyseLpaDocument(rawText, projectContext, policies, briefingNote = null) {
  const chunks = chunkText(rawText).slice(0, MAX_CHUNKS);
  const fullText = chunks.join('\n\n---\n\n');

  const userPrompt = LPA_DOC_ANALYSIS_PROMPT
    .replace('{{PROJECT_CONTEXT}}', buildProjectBlock(projectContext))
    .replace('{{BRIEFING_NOTE}}', buildBriefingNoteBlock(briefingNote))
    .replace('{{POLICIES_BLOCK}}', buildPoliciesBlock(policies))
    .replace('{{DOCUMENT_TEXT}}', fullText);

  const raw = await callClaude(LPA_DOC_ANALYSIS_SYSTEM, userPrompt, MODEL_SONNET);
  try {
    return parseJSON(raw);
  } catch {
    console.warn('LPA doc analysis returned malformed JSON — returning raw text');
    return {
      document_type: 'Other',
      outcome: 'Unknown',
      application_ref: null,
      lpa_name: null,
      summary: raw.slice(0, 1000),
      key_reasoning: null,
      policy_treatment: []
    };
  }
}

export async function synthesiseLpaAnalysis(projectContext, policies, documents, briefingNote = null) {
  const docSummaries = documents.map((d, i) => {
    const s = d.doc_summary || {};
    return [
      `### Document ${i + 1}: ${d.filename}`,
      `Type: ${s.document_type || 'Unknown'} | Outcome: ${s.outcome || 'Unknown'}`,
      s.application_ref ? `Ref: ${s.application_ref}` : null,
      s.lpa_name ? `LPA: ${s.lpa_name}` : null,
      `Summary: ${s.summary || 'No summary available'}`,
      `Key reasoning: ${s.key_reasoning || 'Not extracted'}`,
      s.policy_treatment?.length
        ? `Policies discussed:\n${s.policy_treatment.map(p => `  - ${p.policy_ref || p.policy_name}: ${p.treatment}`).join('\n')}`
        : null
    ].filter(Boolean).join('\n');
  }).join('\n\n---\n\n');

  const userPrompt = LPA_SYNTHESIS_PROMPT
    .replace('{{PROJECT_CONTEXT}}', buildProjectBlock(projectContext))
    .replace('{{BRIEFING_NOTE}}', buildBriefingNoteBlock(briefingNote))
    .replace('{{POLICIES_BLOCK}}', buildPoliciesBlock(policies))
    .replace('{{DOC_SUMMARIES}}', docSummaries);

  return (await callClaude(LPA_SYNTHESIS_SYSTEM, userPrompt, MODEL_SONNET)).trim();
}
