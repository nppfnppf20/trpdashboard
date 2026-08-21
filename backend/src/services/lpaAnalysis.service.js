/**
 * LPA Decision Analysis service.
 * Analyses individual planning documents and synthesises patterns across a set
 * of LPA decisions to produce a strategic intelligence report.
 */

import { chunkText } from './parser.service.js';
import { callClaude, parseJSON, MAX_CHUNKS, MODEL_SONNET, buildFullDocumentBlock, checkDocumentSize } from './llm.shared.js';

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

## Relevant Planning Policies We Are Tracking
{{POLICIES_LIST}}

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

## Relevant Planning Policies We Are Tracking
{{POLICIES_LIST}}

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
  - How has this policy been applied across the cases?
  - Has it been used to support refusal, justify approval, or treated as a neutral factor?
  - Are there any notable interpretations or weightings by the LPA or Inspector?
  - What does this mean for our project's position against this policy?

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
Accuracy is critical: where the document quotes a policy's wording, you must transcribe it EXACTLY as it appears, character for character, \
including punctuation and capitalisation. Never paraphrase, summarise, correct, or invent policy wording. \
Never use em dashes (—); use a comma, colon, or rewrite the sentence instead.`;

const POLICY_EXTRACTION_PROMPT = `Read the following document and extract two things so they can be added to a project's policy tracker:
1. Every distinct planning policy it cites, quotes, or discusses.
2. Every development plan document, supplementary planning document, or other material consideration document it references (e.g. an adopted or emerging Local Plan, a Neighbourhood Plan, an SPD/SPG, or another material consideration such as the NPPF as a whole document).

Document (shown as numbered chunks — note the chunk index each item is found in):
<document>
{{DOCUMENT}}
</document>

For each distinct DOCUMENT/PLAN referenced, extract:
- plan_name: the document's title as given, e.g. "Anytown District Local Plan", "Anytown Neighbourhood Plan", "Residential Design SPD"
- section: one of "adopted" (an adopted/made Local or Neighbourhood Plan), "emerging" (a Local or Neighbourhood Plan not yet adopted/made, e.g. "emerging", "draft", "Regulation 19"), "supplementary" (SPD/SPG/design guide), "other" (anything else material, e.g. national guidance documents, technical standards)
- plan_type: "local" or "neighbourhood" if section is "adopted" or "emerging" (otherwise null)
- year_adopted: the adoption year as a number if given and section is "adopted" (otherwise null)
- month_adopted: the adoption month as a number 1-12 if given (otherwise null)
- source_chunk_index: the chunk index where this document is referenced

For each distinct POLICY you find, extract:
- policy_reference: the policy's reference/number as given, e.g. "Policy H1", "NPPF Para 11", "Policy DM10" (null if the document doesn't give one)
- policy_name: the policy's title/name as given in the document, or a short descriptive name if only a reference is given
- policy_type: one of "national" (NPPF/NPPG/national guidance), "local" (adopted Local Plan), "neighbourhood" (Neighbourhood Plan), "supplementary" (SPD/SPG/design guide), "other"
- policy_text: the policy wording VERBATIM, copied character-for-character from the document, complete and untruncated. If the document only references the policy by number/name without quoting its actual wording, leave this null — do NOT reconstruct or invent wording from general knowledge.
- plan_name: the name of the parent plan/document this policy belongs to, exactly matching a "plan_name" from the plans list above where applicable (null if the policy is national/NPPF or has no identifiable parent document)
- source_chunk_index: the chunk index where this policy appears

Rules:
- Only extract policies and plans actually present in this document — never add ones you recognise from general knowledge that aren't cited here.
- If the same policy or plan is referenced more than once, merge into a single entry using the fullest information available.
- Skip vague references with no identifiable name (e.g. "relevant planning policies", "the development plan" with no document named).
- Do not list the NPPF itself as a plan/document unless the document is being logged as a whole (e.g. "other") — individual NPPF paragraphs should just be policies with policy_type "national" and plan_name null.

Respond ONLY with valid JSON, no markdown fences:
{
  "plans": [
    { "plan_name": "Anytown District Local Plan", "section": "adopted", "plan_type": "local", "year_adopted": 2021, "month_adopted": null, "source_chunk_index": 1 }
  ],
  "policies": [
    { "policy_reference": "Policy H1", "policy_name": "Housing Delivery", "policy_type": "local", "policy_text": "exact verbatim wording, or null", "plan_name": "Anytown District Local Plan", "source_chunk_index": 2 }
  ]
}

If none are found, return empty arrays.`;

export async function extractPoliciesFromDocument(rawText) {
  const sizeCheck = checkDocumentSize(rawText);
  if (sizeCheck.status === 'rejected') {
    const err = new Error(sizeCheck.warningMessage);
    err.status = 400;
    throw err;
  }

  const docBlock = buildFullDocumentBlock(rawText);
  const userPrompt = POLICY_EXTRACTION_PROMPT.replace('{{DOCUMENT}}', docBlock);

  const raw = await callClaude(POLICY_EXTRACTION_SYSTEM, userPrompt, MODEL_SONNET, 8000);

  let parsed;
  try {
    parsed = parseJSON(raw);
  } catch (err) {
    console.error('[extractPoliciesFromDocument] JSON parse failed. Raw (first 400):', raw.slice(0, 400));
    throw new Error('LLM returned an unparseable response while extracting policies');
  }

  const plans = (Array.isArray(parsed.plans) ? parsed.plans : [])
    .filter(p => p.plan_name?.trim())
    .map(p => ({
      plan_name: p.plan_name.trim(),
      section: PLAN_SECTIONS.has(p.section) ? p.section : 'other',
      plan_type: PLAN_TYPES.has(p.plan_type) ? p.plan_type : null,
      year_adopted: Number.isInteger(p.year_adopted) ? p.year_adopted : null,
      month_adopted: Number.isInteger(p.month_adopted) && p.month_adopted >= 1 && p.month_adopted <= 12 ? p.month_adopted : null
    }));

  const policies = (Array.isArray(parsed.policies) ? parsed.policies : [])
    .filter(p => p.policy_name?.trim())
    .map(p => ({
      policy_reference: p.policy_reference?.trim() || '',
      policy_name: p.policy_name.trim(),
      policy_type: POLICY_TYPES.has(p.policy_type) ? p.policy_type : 'other',
      policy_text: p.policy_text?.trim() || '',
      relevant_supporting_text: '',
      notes: '',
      is_key_policy: false,
      plan_name: p.plan_name?.trim() || null
    }));

  return { policies, plans, sizeWarning: sizeCheck.warningMessage };
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

export async function analyseLpaDocument(rawText, projectContext, policies) {
  const chunks = chunkText(rawText).slice(0, MAX_CHUNKS);
  const fullText = chunks.join('\n\n---\n\n');

  const projectBlock = [
    projectContext.name && `Project: ${projectContext.name}`,
    projectContext.site_address && `Site: ${projectContext.site_address}`,
    projectContext.lpa && `LPA: ${projectContext.lpa}`,
    projectContext.use_type && `Use type: ${projectContext.use_type}`,
    projectContext.description && `Description: ${projectContext.description}`
  ].filter(Boolean).join('\n');

  const policiesList = policies.length
    ? policies.map(p =>
        `- ${p.policy_reference ? p.policy_reference + ': ' : ''}${p.policy_name} (${p.policy_type})${p.is_key_policy ? ' [KEY POLICY]' : ''}`
      ).join('\n')
    : 'No specific policies have been entered yet.';

  const userPrompt = LPA_DOC_ANALYSIS_PROMPT
    .replace('{{PROJECT_CONTEXT}}', projectBlock)
    .replace('{{POLICIES_LIST}}', policiesList)
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

export async function synthesiseLpaAnalysis(projectContext, policies, documents) {
  const projectBlock = [
    projectContext.name && `Project: ${projectContext.name}`,
    projectContext.site_address && `Site: ${projectContext.site_address}`,
    projectContext.lpa && `LPA: ${projectContext.lpa}`,
    projectContext.use_type && `Use type: ${projectContext.use_type}`,
    projectContext.description && `Description: ${projectContext.description}`
  ].filter(Boolean).join('\n');

  const policiesList = policies.length
    ? policies.map(p =>
        `- ${p.policy_reference ? p.policy_reference + ': ' : ''}${p.policy_name} (${p.policy_type})${p.is_key_policy ? ' [KEY POLICY]' : ''}`
      ).join('\n')
    : 'No specific policies have been entered yet.';

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
    .replace('{{PROJECT_CONTEXT}}', projectBlock)
    .replace('{{POLICIES_LIST}}', policiesList)
    .replace('{{DOC_SUMMARIES}}', docSummaries);

  return (await callClaude(LPA_SYNTHESIS_SYSTEM, userPrompt, MODEL_SONNET)).trim();
}
