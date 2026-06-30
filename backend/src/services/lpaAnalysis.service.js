/**
 * LPA Decision Analysis service.
 * Analyses individual planning documents and synthesises patterns across a set
 * of LPA decisions to produce a strategic intelligence report.
 */

import { chunkText } from './parser.service.js';
import { callClaude, parseJSON, MAX_CHUNKS, MODEL_SONNET } from './llm.shared.js';

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
