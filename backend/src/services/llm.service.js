/**
 * LLM Service
 * All Claude API calls and prompt definitions live here.
 * Keeping prompts in one file makes them easy to iterate on without
 * touching route or controller logic.
 */

import Anthropic from '@anthropic-ai/sdk';
import { aggregateChunkResults } from './aggregator.service.js';
import { chunkText } from './parser.service.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Haiku for per-chunk extraction (fast, cheap, accurate enough for structured JSON)
// Sonnet for summary merging and document-level calls (better prose quality)
const MODEL_FAST = 'claude-haiku-4-5-20251001';
const MODEL_SONNET = 'claude-sonnet-4-6';

// Chunk thresholds:
// ANALYSE_CHUNKS  — analyse all of these (no warning)
// MAX_CHUNKS      — cap here, warn user that document was truncated
// REJECT_CHUNKS   — refuse entirely, tell user to paste the relevant section
// At ~6000 chars/chunk: 8 ≈ 12,500 words | 20 ≈ 31,000 words
const ANALYSE_CHUNKS = 15;
const REJECT_CHUNKS  = 30;
// Alias used internally — kept as ANALYSE_CHUNKS cap
const MAX_CHUNKS = ANALYSE_CHUNKS;

/**
 * Check a raw text string against the chunk thresholds.
 * Returns { status, totalChunks, analysedChunks, warningMessage }
 * status: 'ok' | 'truncated' | 'rejected'
 */
export function checkDocumentSize(rawText) {
  const allChunks = chunkText(rawText);
  const total = allChunks.length;
  if (total <= ANALYSE_CHUNKS) {
    return { status: 'ok', totalChunks: total, analysedChunks: total, warningMessage: null };
  }
  if (total > REJECT_CHUNKS) {
    return {
      status: 'rejected',
      totalChunks: total,
      analysedChunks: 0,
      warningMessage: `This document is too large to analyse in full (approx. ${Math.round(total * 6000 / 5)} words across ${total} sections). Please paste the specific section you want analysed — e.g. the relevant chapter or appendix.`
    };
  }
  return {
    status: 'truncated',
    totalChunks: total,
    analysedChunks: ANALYSE_CHUNKS,
    warningMessage: `Document is large — only the first ~${Math.round(ANALYSE_CHUNKS * 6000 / 5).toLocaleString()} words (${ANALYSE_CHUNKS} of ${total} sections) were analysed. For better coverage, paste the most relevant section directly.`
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt constants — edit these to tune LLM behaviour
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_SYSTEM_PROMPT = `You are a project document analyst. Your job is to read a section of a project \
document and assess it against a list of predefined project topics. For each topic, determine \
whether this section contains relevant information, and if so, summarise what it says about that topic.`;

const DEFAULT_USER_PROMPT_TEMPLATE = `Here is a section of a project document:

<document_chunk>
{{CHUNK_TEXT}}
</document_chunk>

Here are the predefined topics for this project:

<topics>
{{TOPICS_JSON}}
</topics>

For each topic, respond ONLY with a valid JSON array (no markdown, no explanation):
[
  {
    "issue_id": "the-numeric-id",
    "mentioned": true or false,
    "summary": "1-3 sentence summary or null",
    "sentiment": "positive" | "neutral" | "negative" | "not_mentioned",
    "confidence": "high" | "medium" | "low",
    "source_quote": "verbatim excerpt max 300 chars or null"
  }
]
Do not skip any topics. If nothing relevant, set mentioned: false, sentiment: not_mentioned, summary: null, source_quote: null, confidence: low.`;

const SUMMARY_MERGE_PROMPT = `Combine these partial summaries of the same project topic into one coherent 2-4 sentence summary. \
Return only the summary text, no preamble:

{{SUMMARIES}}`;

const DOCUMENT_SUMMARY_PROMPT = `Write a concise 200 word plain English summary of the following project document. \
Focus on decisions made, actions raised, and overall progress. Do not reference any issue tracking system.

<document>
{{FULL_RAW_TEXT}}
</document>

Respond with only the summary text, no preamble.`;

const UNMATCHED_CONTENT_PROMPT = `You are reviewing a project document against a set of predefined topics. \
Extract significant content not captured by existing topics, and suggest new topics worth tracking.

<document>
{{FULL_RAW_TEXT}}
</document>

Existing topics (already covered, do not repeat):
<topics>
{{TOPICS_JSON}}
</topics>

Respond ONLY with valid JSON:
{
  "unmatched_content": "paragraph summarising uncaptured significant content, or null",
  "suggested_topics": [
    {
      "title": "short title",
      "description": "1-2 sentences",
      "reason": "why this appeared and might need tracking"
    }
  ]
}
Only suggest genuinely new recurring-worthy topics. Return empty array if none.`;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Call Claude and return the text response.
 * Retries up to 3 times on 429 rate-limit errors with exponential backoff.
 *
 * @param {string} system
 * @param {string} user
 * @param {string} model
 * @returns {Promise<string>}
 */
async function callClaude(system, user, model = MODEL_SONNET) {
  const MAX_RETRIES = 3;
  let delay = 15000; // 15s initial — gives rate-limited tier room to breathe
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const message = await client.messages.create({
        model,
        max_tokens: 4096,
        system,
        messages: [{ role: 'user', content: user }]
      });
      return message.content[0].text;
    } catch (err) {
      const isRateLimit = err?.status === 429 || err?.message?.includes('rate_limit');
      if (isRateLimit && attempt < MAX_RETRIES) {
        console.warn(`Rate limit hit — retrying in ${delay / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise(r => setTimeout(r, delay));
        delay *= 2;
      } else {
        throw err;
      }
    }
  }
}

/**
 * Parse a JSON response from Claude, stripping any accidental markdown fences.
 * @param {string} text
 * @returns {any}
 */
function parseJSON(text) {
  const cleaned = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
  return JSON.parse(cleaned);
}

// ─────────────────────────────────────────────────────────────────────────────
// Core ingestion pipeline
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the full ingestion pipeline for a document.
 * Returns { topicResults, documentSummary, unmatchedContent, suggestedTopics }
 *
 * stageConfig can override system/user prompts and is set when the document
 * is uploaded against a project stage that has custom prompts configured.
 *
 * @param {string} rawText
 * @param {Array<{ id: number, code: string, title: string, description: string, keywords: string[] }>} topics
 * @param {{ llm_system_prompt?: string, llm_user_prompt_template?: string }|null} stageConfig
 * @returns {Promise<object>}
 */
export async function runIngestion(rawText, topics, stageConfig = null) {
  const chunks = chunkText(rawText).slice(0, MAX_CHUNKS);
  const topicsJson = JSON.stringify(
    topics.map(t => ({ id: t.id, code: t.code, title: t.title, description: t.description, keywords: t.keywords }))
  );

  const systemPrompt = stageConfig?.llm_system_prompt || DEFAULT_SYSTEM_PROMPT;
  const userTemplate = stageConfig?.llm_user_prompt_template || DEFAULT_USER_PROMPT_TEMPLATE;

  // Step 1 — analyse each chunk against all topics sequentially to avoid rate limits
  const chunkResults = [];
  for (const chunk of chunks) {
    const userPrompt = userTemplate
      .replace('{{CHUNK_TEXT}}', chunk)
      .replace('{{TOPICS_JSON}}', topicsJson);
    const raw = await callClaude(systemPrompt, userPrompt, MODEL_FAST);
    try {
      chunkResults.push(parseJSON(raw));
    } catch {
      // If a chunk returns malformed JSON, treat it as no mentions rather than failing the whole document
      console.warn('Chunk returned malformed JSON — skipping chunk');
      chunkResults.push(topics.map(t => ({
        issue_id: t.id,
        mentioned: false,
        summary: null,
        sentiment: 'not_mentioned',
        confidence: 'low',
        source_quote: null
      })));
    }
  }

  // Step 2 — aggregate chunk results per topic
  const aggregated = aggregateChunkResults(chunkResults);

  // Step 3 — merge partial summaries for topics that were mentioned in multiple chunks (sequential)
  const topicResults = [];
  for (const agg of aggregated.values()) {
    let summary = null;

    if (agg.mentioned && agg.partialSummaries.length > 1) {
      const mergePrompt = SUMMARY_MERGE_PROMPT.replace(
        '{{SUMMARIES}}',
        agg.partialSummaries.join('\n\n---\n\n')
      );
      summary = (await callClaude(DEFAULT_SYSTEM_PROMPT, mergePrompt)).trim();
    } else if (agg.partialSummaries.length === 1) {
      summary = agg.partialSummaries[0];
    }

    topicResults.push({
      topic_id: Number(agg.topic_id),
      mentioned: agg.mentioned,
      summary,
      sentiment: agg.sentiment,
      confidence: agg.confidence,
      source_quote: agg.source_quote
    });
  }

  // Step 4 — 200-word document summary
  const docSummaryPrompt = DOCUMENT_SUMMARY_PROMPT.replace('{{FULL_RAW_TEXT}}', rawText.slice(0, 40000));
  const documentSummary = (await callClaude(DEFAULT_SYSTEM_PROMPT, docSummaryPrompt)).trim();

  // Step 5 — unmatched content + suggested topics
  const unmatchedPrompt = UNMATCHED_CONTENT_PROMPT
    .replace('{{FULL_RAW_TEXT}}', rawText.slice(0, 40000))
    .replace('{{TOPICS_JSON}}', topicsJson);
  const unmatchedRaw = await callClaude(DEFAULT_SYSTEM_PROMPT, unmatchedPrompt);
  let unmatchedContent = null;
  let suggestedTopics = [];
  try {
    const parsed = parseJSON(unmatchedRaw);
    unmatchedContent = parsed.unmatched_content ?? null;
    suggestedTopics = parsed.suggested_topics ?? [];
  } catch {
    console.warn('Unmatched content call returned malformed JSON');
  }

  return { topicResults, documentSummary, unmatchedContent, suggestedTopics };
}

/**
 * Run ingestion for a single topic against a document.
 * Used during backfill when a new topic is accepted from suggestions —
 * we only need to analyse the new topic, not re-run everything.
 *
 * @param {string} rawText
 * @param {{ id: number, code: string, title: string, description: string, keywords: string[] }} topic
 * @returns {Promise<{ topic_id: number, mentioned: boolean, summary: string|null, sentiment: string, confidence: string, source_quote: string|null }>}
 */
export async function runSingleTopicIngestion(rawText, topic) {
  const result = await runIngestion(rawText, [topic]);
  return result.topicResults[0] ?? {
    topic_id: topic.id,
    mentioned: false,
    summary: null,
    sentiment: 'not_mentioned',
    confidence: 'low',
    source_quote: null
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LPA Decision Analysis
// Per-document analysis + synthesis across all documents for a project.
// ─────────────────────────────────────────────────────────────────────────────

const LPA_DOC_ANALYSIS_SYSTEM = `You are a specialist planning consultant. \
Your job is to read planning documents — decision notices, officer reports, appeal decisions, \
supporting documents — and extract structured intelligence about how a Local Planning Authority \
(LPA) has approached and decided similar planning applications. \
You will be given context about a live project (site, description, use type) and a list of \
relevant planning policies the team is tracking. \
Your analysis will be used to inform the project team's strategy and advice to their client.`;

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
to a planning team preparing a case.`;

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
- **[Policy Reference] — [Policy Name]**
  - How has this policy been applied across the cases?
  - Has it been used to support refusal, justify approval, or treated as a neutral factor?
  - Are there any notable interpretations or weightings by the LPA or Inspector?
  - What does this mean for our project's position against this policy?

Only include policies that genuinely feature in the reviewed documents. If a tracked policy does not appear, note it briefly at the end under "Policies Not Yet Evidenced".`;

/**
 * Analyse a single LPA decision/planning document for a project.
 *
 * @param {string} rawText  - extracted text from the document
 * @param {object} projectContext - { name, description, use_type, lpa, site_address }
 * @param {Array<{ policy_reference, policy_name, policy_type, is_key_policy }>} policies
 * @returns {Promise<object>}  parsed doc_summary JSON
 */
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
        `- ${p.policy_reference ? p.policy_reference + ' — ' : ''}${p.policy_name} (${p.policy_type})${p.is_key_policy ? ' [KEY POLICY]' : ''}`
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

/**
 * Synthesise all per-document analyses into a structured report.
 *
 * @param {object} projectContext
 * @param {Array} policies
 * @param {Array<{ filename, doc_summary }>} documents
 * @returns {Promise<string>}  markdown report text
 */
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
        `- ${p.policy_reference ? p.policy_reference + ' — ' : ''}${p.policy_name} (${p.policy_type})${p.is_key_policy ? ' [KEY POLICY]' : ''}`
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

// ─────────────────────────────────────────────────────────────────────────────
// Stage completion analysis
// Prompts kept here alongside the others so all LLM behaviour is in one place.
// ─────────────────────────────────────────────────────────────────────────────

const STAGE_ANALYSIS_SYSTEM = `You are a planning consultant managing an issue tracker for a planning project. \
The tracker follows key planning concerns — such as highway impacts, ecology, noise, heritage, drainage — \
through each stage of the project lifecycle, from pre-application through to decision. \
Each issue has a recorded history of notes from prior stages. Your job is to analyse documents uploaded \
at each new stage and write detailed professional notes for each issue, building on that history. \
Your notes will be saved as the stage record and read by the project team to track progress and inform decisions.`;

const STAGE_ANALYSIS_USER_TEMPLATE = `You are processing a document at the "{{STAGE_NAME}}" stage of a planning project.

This project uses an issue tracker to follow planning concerns through each stage of the lifecycle. \
You are extracting the {{STAGE_NAME}}-stage content for each tracked issue from the document section below.

<document_chunk>
{{CHUNK_TEXT}}
</document_chunk>

Here are the tracked issues, each with their prior stage history so you know what has already been recorded:

<issues>
{{ISSUES_JSON}}
</issues>

{{USER_GUIDANCE_BLOCK}}

Instructions:
- Read the document section carefully. For each issue, look for both explicit mentions AND implicit references. \
An issue about traffic impact may be addressed through junction capacity figures without using the word "traffic". \
An ecology issue may be addressed through habitat survey results. An issue about noise may be addressed through \
distance-to-receptor calculations. Use the issue label, discipline, and prior history to guide what to look for.
- If an issue is addressed, write a detailed summary (~200 words) of what this section says about it. \
Focus on new information, decisions, commitments, mitigation proposed, or outstanding concerns — \
do not repeat what is already in the prior history.
- If the user has provided specific guidance for an issue, treat that as your primary focus — \
ensure your summary specifically covers those points even if they appear only briefly in the text.

Respond ONLY with a valid JSON array (no markdown, no explanation):
[
  {
    "issue_track_id": <numeric id>,
    "relevant": true or false,
    "summary": "detailed ~200 word summary of what this section says about this issue, or null if not relevant",
    "sentiment": "positive" | "neutral" | "negative" | "not_mentioned",
    "source_quote": "verbatim excerpt max 300 chars or null"
  }
]
If the issue is not relevant to this section, set relevant: false, sentiment: not_mentioned, summary: null.
Do not skip any issues.`;

// Synthesis prompt — runs once per relevant issue after all chunks are processed.
// Has full context: prior history, user guidance, all chunk summaries.
// Targets ~1000 words so the output is a substantive stage record, not a brief note.
const STAGE_SYNTHESIS_PROMPT = `You are a planning consultant writing the "{{STAGE_NAME}}" stage notes \
for a tracked planning issue.

Issue: {{ISSUE_LABEL}}
Discipline: {{DISCIPLINE}}

Prior stage history (what has already been recorded for this issue):
{{PRIOR_HISTORY}}

{{USER_GUIDANCE_BLOCK}}

The following notes were extracted from different sections of the {{STAGE_NAME}} document:
{{CHUNK_SUMMARIES}}

Write comprehensive professional notes for this issue at the {{STAGE_NAME}} stage. \
Aim for around 400 words — but write as much as needed (up to 1000 words) to ensure all important \
information is captured. Do not pad; do not truncate significant content. Your notes should:
- Synthesise all extracted sections into a coherent, detailed record
- Build explicitly on the prior history — identify what has progressed, what has changed position, \
what commitments have been made, and what remains unresolved or outstanding
- Be written in professional planning language suitable for a project record
- If user guidance was provided above, ensure those specific points are prominently addressed
- Cover the substance in depth — this is a reference document for the project team and may be \
referred to at appeal or examination

Return only the notes text. No preamble, no headings, no bullet points — continuous professional prose.`;

/**
 * Analyse a document against a project's issue tracks for stage completion.
 * Returns suggested notes per issue track, informed by the full history of
 * prior stage summaries so each analysis builds on what came before.
 *
 * @param {string} rawText
 * @param {string} stageName  display name of the stage (e.g. "EIA")
 * @param {Array<{
 *   id: number,
 *   label: string,
 *   source_key: string,
 *   prior_summaries: Array<{ stage_name: string, notes: string }>
 * }>} issueTracks
 * @param {Record<number, string>} userGuidance  map of issue_track_id → guidance text
 * @returns {Promise<Array<{ issue_track_id: number, relevant: boolean, suggested_notes: string|null, sentiment: string, source_quote: string|null }>>}
 */
export async function analyseDocumentForStage(rawText, stageName, issueTracks, userGuidance = {}) {
  const chunks = chunkText(rawText).slice(0, MAX_CHUNKS);

  // Build issues JSON including prior history so the LLM has longitudinal context
  const issuesJson = JSON.stringify(
    issueTracks.map(t => ({
      issue_track_id: t.id,
      label: t.label,
      discipline: t.source_key ?? null,
      prior_summaries: t.prior_summaries ?? []
    }))
  );

  // Build the optional user guidance block — only included if any guidance was provided
  const guidanceEntries = issueTracks
    .filter(t => userGuidance[t.id]?.trim())
    .map(t => `- ${t.label}: ${userGuidance[t.id].trim()}`);
  const userGuidanceBlock = guidanceEntries.length
    ? `The user has provided specific guidance for some issues:\n<guidance>\n${guidanceEntries.join('\n')}\n</guidance>`
    : '';

  // Analyse each chunk sequentially to stay within rate limits
  const chunkResults = [];
  for (let i = 0; i < chunks.length; i++) {
    console.log(`[stage-analysis] chunk ${i + 1}/${chunks.length}`);
    const chunk = chunks[i];
    const userPrompt = STAGE_ANALYSIS_USER_TEMPLATE
      .replace('{{STAGE_NAME}}', stageName)
      .replace('{{CHUNK_TEXT}}', chunk)
      .replace('{{ISSUES_JSON}}', issuesJson)
      .replace('{{USER_GUIDANCE_BLOCK}}', userGuidanceBlock);

    const raw = await callClaude(STAGE_ANALYSIS_SYSTEM, userPrompt, MODEL_FAST);
    try {
      chunkResults.push(parseJSON(raw));
    } catch {
      console.warn('Stage analysis chunk returned malformed JSON — skipping');
      chunkResults.push(issueTracks.map(t => ({
        issue_track_id: t.id,
        relevant: false,
        summary: null,
        sentiment: 'not_mentioned',
        source_quote: null
      })));
    }
  }

  // Aggregate results per issue track — same pattern as runIngestion
  const byTrack = new Map();
  for (const chunkArray of chunkResults) {
    for (const entry of chunkArray) {
      const id = String(entry.issue_track_id);
      if (!byTrack.has(id)) byTrack.set(id, []);
      byTrack.get(id).push(entry);
    }
  }

  const results = [];
  for (const [trackId, entries] of byTrack.entries()) {
    const relevant = entries.some(e => e.relevant);
    const mentionedEntries = entries.filter(e => e.relevant && e.summary);
    const sentiments = entries.map(e => e.sentiment).filter(Boolean);

    let suggested_notes = null;
    if (mentionedEntries.length > 0) {
      console.log(`[stage-analysis] synthesising issue track ${trackId}`);
      // Always run synthesis so every relevant issue gets the full ~1000-word treatment
      // with prior history and user guidance in context — not just multi-chunk issues.
      const track = issueTracks.find(t => String(t.id) === trackId);

      const priorHistory = (track?.prior_summaries ?? []).length > 0
        ? track.prior_summaries.map(p => `${p.stage_name}:\n${p.notes}`).join('\n\n')
        : 'No prior stage history — this is the first stage entry for this issue.';

      const guidance = userGuidance[Number(trackId)]?.trim() ?? '';
      const guidanceBlock = guidance
        ? `The user has provided specific guidance for this issue — treat this as your primary focus:\n<guidance>\n${guidance}\n</guidance>`
        : '';

      const chunkSummaries = mentionedEntries
        .map((e, i) => `Section ${i + 1}:\n${e.summary}`)
        .join('\n\n---\n\n');

      const synthesisPrompt = STAGE_SYNTHESIS_PROMPT
        .replace(/{{STAGE_NAME}}/g, stageName)
        .replace('{{ISSUE_LABEL}}', track?.label ?? 'Unknown')
        .replace('{{DISCIPLINE}}', track?.source_key ?? 'Not specified')
        .replace('{{PRIOR_HISTORY}}', priorHistory)
        .replace('{{USER_GUIDANCE_BLOCK}}', guidanceBlock)
        .replace('{{CHUNK_SUMMARIES}}', chunkSummaries);

      suggested_notes = (await callClaude(STAGE_ANALYSIS_SYSTEM, synthesisPrompt, MODEL_SONNET)).trim();
    }

    const source_quote = mentionedEntries[0]?.source_quote ?? null;
    const sentiment = sentiments.includes('negative') ? 'negative'
      : sentiments.includes('positive') ? 'positive'
      : sentiments.includes('neutral') ? 'neutral'
      : 'not_mentioned';

    results.push({
      issue_track_id: Number(trackId),
      relevant,
      suggested_notes,
      sentiment,
      source_quote
    });
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Appeal drafting — generate a formal appeal document from working argument
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_DRAFT_PROMPT = `You are an experienced planning appeal consultant drafting a formal appeal document.
You will be given the working argument notes for an appeal — the case built up across all key issues — and you must polish these into a well-structured, professionally written document.

Instructions:
- Write in formal planning language suitable for submission to the Planning Inspectorate
- Structure the document clearly with numbered sections and sub-sections
- Draw on ALL the argument notes provided — do not omit issues
- Where argument_against notes set out the opposing position, acknowledge it before rebutting with the argument_for
- Produce clean HTML using <h2> for main sections, <h3> for sub-sections, <p> for body text, <ol>/<li> for numbered lists
- Do not include a title — start directly with the first section
- Do not add placeholder text or "[INSERT X]" gaps — write the full document from the material provided`;

/**
 * Generate a formal appeal document from the working argument notes.
 *
 * @param {object} params
 * @param {string} params.projectName
 * @param {string} params.draftTypeName  e.g. "Statement of Case"
 * @param {string|null} params.generationPrompt  custom instructions (overrides default)
 * @param {string|null} params.exampleDocument  HTML style example shown to LLM
 * @param {Array<{ label: string, discipline: string|null, argument_against: string|null, argument_for: string|null }>} params.issues
 * @returns {Promise<string>}  HTML document
 */
/**
 * Generate a single section of an appeal draft document.
 */
export async function generateDraftSection({ section, projectName, draftTypeName, issueContext }) {
  const instructions = section.generation_prompt?.trim() ||
    `Write the "${section.name}" section of a ${draftTypeName}. Use formal planning language suitable for submission to the Planning Inspectorate. Produce clean HTML: <h2> for the section heading, <p> for body text, <ol>/<li> for numbered lists. Do not add placeholder text — write the full section from the material provided.`;

  const exampleBlock = section.example_text?.trim()
    ? `The following is an example of this section's tone and format. Match the style but use NO information from it — all content must come from the working argument notes:\n<example>\n${section.example_text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000)}\n</example>\n`
    : '';

  const prompt = `You are drafting the "${section.name}" section of a formal planning appeal document. Output HTML only — no markdown.

CONTENT INSTRUCTIONS:
${instructions}

${exampleBlock}Project: ${projectName}
Document: ${draftTypeName}

Working argument notes:
${issueContext}

FORMAT RULES (mandatory):
- Your entire response must be valid HTML
- Begin with <h2>${section.name}</h2>
- Every paragraph must be wrapped in <p>...</p> tags
- Numbered lists must use <ol><li>...</li></ol>
- Bullet lists must use <ul><li>...</li></ul>
- Bold text must use <strong>...</strong>
- Do not use **, *, #, ---, or any other markdown characters at all`;

  const response = await client.messages.create({
    model: MODEL_SONNET,
    max_tokens: 2000,
    system: 'You are a planning appeal consultant. You output clean HTML documents. You never use markdown — every paragraph is a <p> tag, lists are <ol> or <ul>, bold is <strong>. If you use **, *, or --- you have made an error.',
    messages: [{ role: 'user', content: prompt }]
  });

  const raw = response.content[0].text.trim();
  return raw.replace(/^```(?:html)?\n?/i, '').replace(/\n?```$/i, '').trim();
}

/**
 * Generate a full appeal draft document, section by section.
 * Falls back to a single-call approach if no sections are defined.
 *
 * @param {object} params
 * @param {string} params.projectName
 * @param {string} params.draftTypeName
 * @param {Array} params.sections  rows from appeal_draft_sections ordered by sort_order
 * @param {Array} params.issues
 * @returns {Promise<string>}  stitched HTML
 */
/**
 * Build the issueContext string passed to draft generation prompts.
 * evidenceByTrack is a map of track_id → array of { headline, detailed_summary, quote_snapshot, source_doc_title }.
 * When evidence is present it is appended under each issue so the LLM can quote sources directly.
 *
 * @param {Array} issues
 * @param {Record<number, Array>} evidenceByTrack
 * @returns {string}
 */
export function buildIssueContext(issues, evidenceByTrack = {}) {
  return issues.map(issue => {
    const lines = [`## ${issue.label}${issue.discipline ? ` (${issue.discipline})` : ''}`];
    if (issue.argument_against) lines.push(`Opposing position:\n${issue.argument_against}`);
    if (issue.argument_for)     lines.push(`Our case:\n${issue.argument_for}`);
    if (!issue.argument_against && !issue.argument_for) lines.push('(No notes yet — acknowledge this issue but flag it as to be developed.)');

    const evidence = evidenceByTrack[issue.id];
    if (evidence?.length) {
      const evidenceLines = evidence.map(e => {
        const source = e.source_doc_title ? `[${e.source_doc_title}]` : '[Document]';
        const quote = e.quote_snapshot ? `"${e.quote_snapshot.slice(0, 500)}"` : '(no direct quote)';
        const detail = e.detailed_summary ?? e.headline ?? '';
        return `- ${source}: ${quote}\n  ${detail}`;
      });
      lines.push(`Source evidence from documents:\n${evidenceLines.join('\n')}`);
    }

    return lines.join('\n');
  }).join('\n\n---\n\n');
}

export async function generateAppealDraft({ projectName, draftTypeName, sections, issues, evidenceByTrack = {} }) {
  const issueContext = buildIssueContext(issues, evidenceByTrack);

  if (!sections || sections.length === 0) {
    // No sections defined — single-call fallback
    const prompt = `${DEFAULT_DRAFT_PROMPT}

Project: ${projectName}
Document type: ${draftTypeName}

Working argument notes by issue:
${issueContext}

Produce the complete ${draftTypeName} as HTML now.`;

    const response = await client.messages.create({
      model: MODEL_SONNET,
      max_tokens: 6000,
      messages: [{ role: 'user', content: prompt }]
    });
    const raw = response.content[0].text.trim();
    return raw.replace(/^```(?:html)?\n?/i, '').replace(/\n?```$/i, '').trim();
  }

  // Section-by-section generation (sequential to respect rate limits)
  const parts = [];
  for (const section of sections) {
    console.log(`[generateAppealDraft] generating section: ${section.name}`);
    const html = await generateDraftSection({ section, projectName, draftTypeName, issueContext });
    parts.push(html);
  }

  return parts.join('\n\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Appeal drafting — generate initial argument from key issues + refusal reasons
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate the initial structured appeal argument document.
 * Returns HTML suitable for the RichTextEditor.
 */
export async function generateAppealArgument({ projectName, refusalReasons, keyIssues, initialNotes }) {
  const reasonsText = refusalReasons.length
    ? refusalReasons.map((r, i) => `${i + 1}. ${r.title}${r.summary ? ` — ${r.summary}` : ''}${r.risk_level ? ` [${r.risk_level}]` : ''}`).join('\n')
    : 'None recorded';

  const issuesText = keyIssues.length
    ? keyIssues.map(k => `- ${k.label}${k.discipline_group ? ` (${k.discipline_group})` : ''}`).join('\n')
    : 'None recorded';

  const notesSection = initialNotes?.trim()
    ? `\n\nInitial strategic notes from the team:\n${initialNotes}`
    : '';

  const prompt = `You are an experienced planning appeal consultant drafting a working argument summary for a planning appeal.

Project: ${projectName}

Reasons for refusal:
${reasonsText}

Key issues identified for this appeal:
${issuesText}${notesSection}

Produce a structured working argument summary in HTML. Use <h2> for the main sections, <h3> for issue headings, <p> for body text, and <ul>/<li> for bullet points. Do not use markdown.

Structure:
1. Appeal Overview — brief description of what is being appealed and the overall strategic position
2. Reasons for Refusal — for each reason, one paragraph on the current position and a provisional argument
3. Argument by Issue — for each key issue listed, a section with:
   - Current position
   - Provisional argument
   - Evidence gaps / items still needed
4. Risks and Unknowns — what could change strategy; what still needs confirmation
5. Next Steps — immediate actions and evidence required

Be concise and professional. Write in working note style, not formal legal prose. This is a starting point the user will edit.`;

  const response = await client.messages.create({
    model: MODEL_SONNET,
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }]
  });

  return response.content[0].text;
}

// ─────────────────────────────────────────────────────────────────────────────
// Appeal drafting — review an uploaded document against the live argument
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Review a single document against the current live argument.
 * Returns structured JSON with relevance, extracted points, and drafting suggestions.
 */
export async function reviewDocumentAgainstArgument({ documentText, currentArgument, keyIssues, refusalReasons, filename }) {
  const issueLabels = keyIssues.map(k => k.label).join(', ') || 'none listed';
  const reasonTitles = refusalReasons.map(r => r.title).join('; ') || 'none listed';

  // Strip HTML tags from the current argument for the prompt
  const plainArgument = currentArgument.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  const prompt = `You are a planning appeal consultant reviewing a document against the current working argument for an appeal.

Document filename: ${filename}

Key issues in this appeal: ${issueLabels}
Reasons for refusal: ${reasonTitles}

Current working argument (condensed):
<current_argument>
${plainArgument.slice(0, 6000)}
</current_argument>

Document to review:
<document>
${documentText.slice(0, 8000)}
</document>

Respond ONLY with valid JSON in this exact shape (no markdown, no explanation):
{
  "relevant": true or false,
  "relevance_summary": "one sentence explaining why this document is or isn't relevant",
  "affected_issues": ["issue label 1", "issue label 2"],
  "extracted_points": {
    "helpful": ["point 1", "point 2"],
    "harmful": ["point 1"],
    "procedural": ["point 1"],
    "policy": ["point 1"]
  },
  "argument_impact": "strengthens" | "weakens" | "qualifies" | "neutral" | "new_sub_point",
  "impact_explanation": "one or two sentences",
  "bullet_suggestions": ["Add under [Issue]: ...", "Under [Issue], note that ..."],
  "draft_paragraph": "optional suggested paragraph text to add to the argument, or null",
  "caution_note": "any verification needed or contradictions to flag, or null"
}`;

  const response = await client.messages.create({
    model: MODEL_SONNET,
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }]
  });

  const raw = response.content[0].text.trim();
  // Strip markdown code fences if present
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

// ─────────────────────────────────────────────────────────────────────────────
// Appeal: extract actionable points from an uploaded document
// ─────────────────────────────────────────────────────────────────────────────

const DOC_TYPE_INSTRUCTIONS = {
  'Officer Report':        'This is a local authority officer report recommending refusal. Extract points that articulate the planning authority\'s objections — these should populate "argument_against". Also extract any concessions or positive observations that could support the appeal — these go to "argument_for".',
  'Refusal Notice':        'This is the formal refusal notice. Extract each reason for refusal as an "argument_against" point, mapped to the most relevant key issue.',
  'Appeal Decision':       'This is an appeal inspector\'s decision. Extract the inspector\'s reasoning against the proposal as "argument_against" points and any findings that favour the appellant as "argument_for" points.',
  'Planning Statement':    'This is a planning statement supporting the proposal. Extract points that support the argument for the appeal — these go to "argument_for".',
  'Proof of Evidence':     'This is an expert proof of evidence. Extract technical findings and conclusions that support the appeal case — these go to "argument_for".',
  'Expert Report':         'This is an expert technical report. Extract findings and conclusions relevant to the key issues — "argument_for" if supportive, "argument_against" if they identify problems.',
  'Consultation Response': 'This is a consultation response. Extract objections as "argument_against" and any supportive comments as "argument_for".',
  'Other':                 'Extract any points relevant to the key issues. Use your judgement on whether each point supports "argument_for" or "argument_against".'
};

const PLANNING_APP_DOC_TYPE_INSTRUCTIONS = {
  'Surveyor Report':       'This is a specialist surveyor\'s or consultant\'s report commissioned to support the proposal. Extract technical findings, assessments, and conclusions that demonstrate the proposal\'s compliance with the linked policies. Focus on what the expert concludes, what technical evidence they cite, and any conditions or mitigation they propose to secure compliance.',
  'Heritage Statement':    'This is a heritage statement. Extract assessments of heritage significance, the expert\'s conclusions on impact, and any findings that show the proposal preserves or enhances the character, appearance, or significance of heritage assets as required by policy.',
  'Ecology Report':        'This is an ecology report. Extract species survey results, impact assessments, and mitigation or enhancement measures that demonstrate policy compliance.',
  'Transport Assessment':  'This is a transport assessment. Extract trip generation figures, capacity assessments, and conclusions on highway safety and accessibility that demonstrate policy compliance.',
  'Noise Assessment':      'This is a noise assessment. Extract measured levels, comparison against standards, and mitigation proposed that demonstrate the proposal would not cause unacceptable harm.',
  'Planning Statement':    'This is a planning statement. Extract the policy compliance arguments, assessments of need, and planning balance conclusions that support the application.',
  'Design and Access Statement': 'This is a design and access statement. Extract the design rationale, character assessments, and accessibility provisions that demonstrate policy compliance.',
  'Other':                 'This is a supporting document. Extract any technical findings, assessments, or conclusions that demonstrate the proposal\'s compliance with the linked planning policies.'
};

const HIGH_VALUE_PATTERN = /^(conclusions?|executive summary|summary(?: and conclusions)?|recommendations|key findings|overall assessment)\s*$/im;

/**
 * Format raw document text as indexed chunks for the extraction prompt.
 * High-value sections (Conclusions, Executive Summary etc.) are floated to the
 * front so the model reads them first, regardless of where they appear in the doc.
 * Each chunk retains its original index so span matching stays correct.
 * maxChunks=4 — high-value section + 3 regular early chunks.
 */
export function buildDocumentBlock(text, maxChunks = 4) {
  const allChunks = chunkText(text);

  const highValueIndices = new Set(
    allChunks
      .map((c, i) => HIGH_VALUE_PATTERN.test(c.trim().slice(0, 200)) ? i : -1)
      .filter(i => i !== -1)
  );

  const regularIndices = allChunks.map((_, i) => i).filter(i => !highValueIndices.has(i));
  const ordered = [...highValueIndices, ...regularIndices].slice(0, maxChunks);

  return ordered.map(i => {
    const label = highValueIndices.has(i)
      ? `[Chunk ${i} — HIGH VALUE SECTION: read this first, weight it heavily]`
      : `[Chunk ${i}]`;
    return `${label}\n${allChunks[i]}`;
  }).join('\n\n');
}

/**
 * Build the extraction prompt template with {{DOCUMENT}} as the placeholder
 * for the actual document text. Used when saving/loading editable templates.
 * Issue list and context are baked in fresh at call time.
 */
export function buildExtractPointsTemplate({ allIssues, targetIssues, documentType, documentDirection, userNotes, linkedPolicies = [], existingPointsByTrack = {} }) {
  return buildExtractPointsPrompt({ documentBlock: '{{DOCUMENT}}', allIssues, targetIssues, documentType, documentDirection, userNotes, linkedPolicies, existingPointsByTrack });
}

/**
 * Build the extraction prompt without running the LLM.
 * Exported so the controller can return it for preview/editing.
 * Pass either `text` (raw document text, will be formatted as indexed chunks)
 * or `documentBlock` (pre-formatted string, used by buildExtractPointsTemplate).
 */
export function buildExtractPointsPrompt({ text, documentBlock, allIssues, targetIssues, documentType, documentDirection, userNotes, linkedPolicies = [], existingPointsByTrack = {} }) {
  const docBlock = documentBlock ?? buildDocumentBlock(text);
  const issues = targetIssues.length > 0 ? targetIssues : allIssues;
  const isPlanningApp = linkedPolicies.length > 0;

  const tierOrder = ['national', 'local', 'neighbourhood', 'supplementary', 'other'];
  const tierLabels = { national: 'National Policy', local: 'Local Plan Policy', neighbourhood: 'Neighbourhood Plan Policy', supplementary: 'Supplementary Guidance', other: 'Other Policy' };
  const tierFields = { national: 'policy_national', local: 'policy_local', neighbourhood: 'policy_neighbourhood', supplementary: 'policy_supplementary', other: 'policy_other' };

  const linkedPoliciesBlock = linkedPolicies.length > 0
    ? '\n\n## Policies Linked to the Target Issue(s)\n' +
      'The following policies have been linked to the relevant issue(s) by the project team. ' +
      'Assess the document\'s content against these policies specifically — ' +
      'find evidence that supports compliance with each one.\n\n' +
      tierOrder
        .flatMap(tier => linkedPolicies.filter(p => p.policy_type === tier))
        .map(p => {
          const header = `### ${tierLabels[p.policy_type] ?? p.policy_type} — ${p.policy_reference ? p.policy_reference + ': ' : ''}${p.policy_name}${p.is_key_policy ? ' [KEY POLICY]' : ''}`;
          const policyText = p.policy_text?.trim() ? `Policy wording:\n${p.policy_text.trim()}` : '(No policy wording recorded)';
          const support = p.relevant_supporting_text?.trim() ? `\nRelevant context/guidance:\n${p.relevant_supporting_text.trim()}` : '';
          return `${header}\n${policyText}${support}`;
        })
        .join('\n\n')
    : '';

  const userNotesSection = userNotes
    ? `\n\n⚑ USER GUIDANCE (treat this as high priority context — it overrides your own judgement where it conflicts):\n${userNotes}\n`
    : '';

  const targetNote = targetIssues.length > 0
    ? `The user has indicated this document is specifically relevant to: ${targetIssues.map(i => i.label).join(', ')}. Focus extraction on these issues first, but still surface any other relevant points.`
    : `No specific issues were flagged — review against all issues and use your judgement.`;

  if (isPlanningApp) {
    // ── Planning application mode ──────────────────────────────────────────────
    // Documents are specialist consultant reports supporting the proposal.
    // Points are tagged to policy tiers, not for/against.

    const docInstruction = PLANNING_APP_DOC_TYPE_INSTRUCTIONS[documentType] || PLANNING_APP_DOC_TYPE_INSTRUCTIONS['Other'];

    const issueList = issues.map(issue => {
      const tierNotes = [
        issue.policy_national      && `    National policy notes: ${issue.policy_national.slice(0, 300)}`,
        issue.policy_local         && `    Local policy notes: ${issue.policy_local.slice(0, 300)}`,
        issue.policy_neighbourhood && `    Neighbourhood policy notes: ${issue.policy_neighbourhood.slice(0, 300)}`,
        issue.policy_supplementary && `    Supplementary notes: ${issue.policy_supplementary.slice(0, 300)}`,
      ].filter(Boolean).join('\n');
      const existing = existingPointsByTrack[issue.id] ?? [];
      const existingBlock = existing.length
        ? `\n    Existing argument points (already accepted from prior documents):\n` +
          existing.map(p => `      • ${p.headline}${p.source ? ` [${p.source}]` : ''}`).join('\n')
        : '';
      return `- id:${issue.id} | ${issue.label}${issue.discipline ? ` (${issue.discipline})` : ''}${tierNotes ? '\n' + tierNotes : ''}${existingBlock}`;
    }).join('\n');

    const tierFieldList = tierOrder.map(t => `"${tierFields[t]}" → ${tierLabels[t]} points`).join(', ');

    return `You are a planning consultant preparing a planning statement. Your job is to read a specialist consultant's report and extract evidence that demonstrates the proposal's compliance with the linked planning policies.
${userNotesSection}
Document type: ${documentType}
${docInstruction}

This is a SUPPORTING document. Extract technical findings, assessments, and conclusions that show the proposal complies with the relevant policies. Where the expert proposes mitigation or conditions to secure compliance, extract those too.

${targetNote}

Issues to assess (with existing policy notes for context):
${issueList}
${linkedPoliciesBlock}

Document (shown as numbered chunks — note the chunk index for each point you extract):
<document>
${docBlock}
</document>

Instructions:
- Chunks marked HIGH VALUE SECTION contain conclusions, summaries or recommendations — read these first and extract all relevant compliance evidence from them
- For each point, identify which linked policy it most directly addresses and use that policy's tier as the field value
- Field values must be one of: ${tierFieldList}, or "argument_for" for generally supportive points not tied to a specific policy tier
- The existing argument points shown above are already accepted — do not extract the exact same point from the same source. However, if THIS document provides independent or additional evidence for the same conclusion (reinforcing evidence), extract it as a new point — note what the new evidence adds
- Focus on filling genuine gaps in the argument structure where no evidence exists yet
- Map each point to the most relevant issue id, or null if general
- Write a short headline (max 15 words) and a detailed_summary (2–4 sentences including the specific technical finding, figure, or assessment that supports compliance)
- For every point, record the citation: the most specific paragraph/section/page reference available, and a verbatim quote (max 150 chars) of the key phrase
- Record which chunk index or indices contain the source evidence
- If the user guidance above directs you to specific themes or paragraphs, prioritise those

Respond ONLY with valid JSON in this exact shape — no markdown, no explanation:
{
  "summary": "2-4 sentence overview of the document and what it demonstrates about the proposal's policy compliance",
  "coverage": [
    { "issue_id": 42, "assessment": "one sentence on how this document addresses the policy compliance case for this issue" }
  ],
  "points": [
    {
      "track_id": 42,
      "field": "policy_local",
      "headline": "Heritage consultant concludes no less than substantial harm",
      "detailed_summary": "Section 7.3 of the Heritage Statement concludes that the proposed works would result in less than substantial harm to the significance of the Listed Building, engaging NPPF paragraph 208. The consultant finds the harm sits at the lower end of the scale, to be weighed against the public benefits of the enabling development.",
      "citation": { "para_ref": "Section 7.3", "quote": "the proposed works would result in less than substantial harm to the significance of the Listed Building" },
      "relevant_chunk_indices": [0]
    },
    {
      "track_id": 42,
      "field": "policy_national",
      "headline": "Public benefits identified to outweigh heritage harm",
      "detailed_summary": "The conclusions section identifies four public benefits: securing the long-term viable use of the building, funding urgent structural repairs, providing affordable housing, and improving public access. The consultant assesses these as collectively outweighing the identified less than substantial harm under NPPF paragraph 208.",
      "citation": { "para_ref": "Conclusions", "quote": "collectively outweighing the identified less than substantial harm" },
      "relevant_chunk_indices": [0, 2]
    }
  ]
}

citation rules:
- para_ref: the paragraph number, section heading, page number, or table reference where the point appears — use the most specific reference available (e.g. "Para 6.4", "Section 7.3", "p.24", "Table 3", "Conclusions") — null if none found
- quote: a verbatim excerpt from the document, max 150 characters, capturing the key phrase that carries the point — must be exact text from the document

If no relevant points are found, return points as an empty array but still provide the summary and coverage.`;
  }

  // ── Appeals mode (original) ────────────────────────────────────────────────

  const docInstruction = DOC_TYPE_INSTRUCTIONS[documentType] || DOC_TYPE_INSTRUCTIONS['Other'];

  const directionInstruction = documentDirection === 'for'
    ? 'This document SUPPORTS the proposal. Unless a point clearly articulates an objection or problem, default to tagging it as "argument_for".'
    : 'This document is AGAINST the proposal (e.g. officer report, refusal notice, objection). Unless a point clearly supports the appellant, default to tagging it as "argument_against".';

  const issueList = issues.map(issue => {
    const points = argumentPoints[issue.id] ?? [];
    const forPoints     = points.filter(p => p.field === 'argument_for');
    const againstPoints = points.filter(p => p.field === 'argument_against');

    let againstSection, forSection;
    if (againstPoints.length > 0) {
      againstSection = '\n    Established argument_against:\n' +
        againstPoints.map(p => `      • ${p.headline}${p.detailed_summary ? `\n        ${p.detailed_summary}` : ''}`).join('\n');
    } else if (issue.argument_against) {
      againstSection = `\n    Current against: ${issue.argument_against.slice(0, 400)}`;
    } else {
      againstSection = '';
    }
    if (forPoints.length > 0) {
      forSection = '\n    Established argument_for:\n' +
        forPoints.map(p => `      • ${p.headline}${p.detailed_summary ? `\n        ${p.detailed_summary}` : ''}`).join('\n');
    } else if (issue.argument_for) {
      forSection = `\n    Current for: ${issue.argument_for.slice(0, 400)}`;
    } else {
      forSection = '';
    }
    return `- id:${issue.id} | ${issue.label}${issue.discipline ? ` (${issue.discipline})` : ''}${againstSection}${forSection}`;
  }).join('\n');

  const fullContext = allIssues.map(issue => {
    const points = argumentPoints[issue.id] ?? [];
    const forPoints     = points.filter(p => p.field === 'argument_for');
    const againstPoints = points.filter(p => p.field === 'argument_against');
    const parts = [];
    if (againstPoints.length > 0)    parts.push(`Against: ${againstPoints.map(p => p.headline).join('; ')}`);
    else if (issue.argument_against) parts.push(`Against: ${issue.argument_against.slice(0, 200)}`);
    if (forPoints.length > 0)        parts.push(`For: ${forPoints.map(p => p.headline).join('; ')}`);
    else if (issue.argument_for)     parts.push(`For: ${issue.argument_for.slice(0, 200)}`);
    return parts.length ? `${issue.label}: ${parts.join(' | ')}` : null;
  }).filter(Boolean).join('\n');

  return `You are a planning appeal consultant helping to build the argument structure for a planning appeal. Your job is to read a document and extract points that could strengthen or inform the working argument.
${userNotesSection}
Document type: ${documentType}
${directionInstruction}
${docInstruction}

${targetNote}

Issues to extract against (with current working notes):
${issueList}

Full working argument context (all issues, for background):
${fullContext || 'No notes yet.'}

Document (shown as numbered chunks — note the chunk index for each point you extract):
<document>
${docBlock}
</document>

Instructions:
- Chunks marked HIGH VALUE SECTION contain conclusions, summaries or recommendations — these carry the most weight; extract all relevant points from them before moving to regular chunks
- Extract every point from the document that could be useful to the argument, including things that fill gaps in the current notes
- Do NOT repeat points already captured in the established argument points above — check both headline and detail before suggesting a point
- Map each point to the most relevant issue id, or null if it is general
- Tag each point as "argument_against" (articulates the opposing position) or "argument_for" (supports the appeal)
- For each point, write a short headline (max 15 words) and a fuller detailed_summary (2–4 sentences with any technical detail, measurements, or specific findings)
- For every point, record the citation: the most specific paragraph/section/page reference available, and a verbatim quote (max 150 chars) of the key phrase
- Record which chunk index or indices contain the source evidence for each point
- If the user guidance above directs you to specific themes or paragraphs, prioritise those

Respond ONLY with valid JSON in this exact shape — no markdown, no explanation:
{
  "summary": "2-4 sentence overview of the document and its overall relevance to the appeal",
  "coverage": [
    { "issue_id": 42, "assessment": "one sentence on how this document bears on this issue" }
  ],
  "points": [
    {
      "track_id": 42,
      "field": "argument_against",
      "headline": "Officer found overlooking impact unacceptable",
      "detailed_summary": "The officer's report finds that the proposed first-floor rear window would result in direct views into the neighbouring garden at No. 14, reducing residential amenity in a manner contrary to Policy DM10. The report notes a separation distance of only 8m, well below the 21m guideline.",
      "citation": { "para_ref": "Para 5.12", "quote": "direct views into the neighbouring garden at No. 14, reducing residential amenity" },
      "relevant_chunk_indices": [0]
    },
    {
      "track_id": 42,
      "field": "argument_for",
      "headline": "Obscure glazing offered as mitigation",
      "detailed_summary": "Paragraph 6.4 of the officer report acknowledges that the applicant offered obscure glazing as a condition, which the officer accepted would resolve the overlooking concern if secured by condition.",
      "citation": { "para_ref": "Para 6.4", "quote": "the officer accepted would resolve the overlooking concern if secured by condition" },
      "relevant_chunk_indices": [0, 1]
    }
  ]
}

citation rules:
- para_ref: the paragraph number, section heading, page number, or table reference where the point appears — use the most specific reference available (e.g. "Para 6.4", "Section 7.3", "p.24", "Table 3") — null if none found
- quote: a verbatim excerpt from the document, max 150 characters, capturing the key phrase that carries the point — must be exact text from the document

If no relevant points are found, return points as an empty array but still provide the summary and coverage.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Planning Statement generation — per-issue assessment sections
// ─────────────────────────────────────────────────────────────────────────────

const PLANNING_TIER_LABELS = {
  national:      'National Planning Policy',
  local:         'Local Plan Policy',
  neighbourhood: 'Neighbourhood Plan Policy',
  supplementary: 'Supplementary Planning Guidance',
  other:         'Other Material Considerations'
};

const PLANNING_TIER_ORDER = ['national', 'local', 'neighbourhood', 'supplementary', 'other'];

function buildPlanningAppIssueContext(issue, linkedPolicies, evidence = []) {
  const lines = [];

  for (const tier of PLANNING_TIER_ORDER) {
    const tierPolicies = linkedPolicies.filter(p => p.policy_type === tier);
    if (!tierPolicies.length) continue;
    lines.push(`### ${PLANNING_TIER_LABELS[tier]}`);
    for (const p of tierPolicies) {
      const ref = p.policy_reference ? `${p.policy_reference} — ` : '';
      const keyTag = p.is_key_policy ? ' [KEY POLICY — quote verbatim in draft]' : '';
      lines.push(`**${ref}${p.policy_name}**${keyTag}`);
      if (p.policy_text?.trim()) {
        lines.push(`Policy wording: "${p.policy_text.trim()}"`);
      }
      if (p.relevant_supporting_text?.trim()) {
        lines.push(`Supporting context: ${p.relevant_supporting_text.trim().slice(0, 400)}`);
      }
    }
  }

  if (issue.argument_for?.trim()) {
    lines.push(`### Policy Assessment Notes`);
    lines.push(issue.argument_for.trim());
  }

  if (evidence.length) {
    lines.push(`### Supporting Evidence from Documents`);
    for (const e of evidence) {
      const source = e.source_doc_title ? `[${e.source_doc_title}]` : '[Document]';
      const ref = e.relevance_note ? ` (${e.relevance_note})` : '';
      const quote = e.quote_snapshot ? `"${e.quote_snapshot.slice(0, 300)}"` : '';
      lines.push(`- ${source}${ref}${quote ? ': ' + quote : ''}`);
      if (e.detailed_summary) lines.push(`  ${e.detailed_summary}`);
    }
  }

  return lines.join('\n');
}

/**
 * Generate a Planning Statement "Planning Assessment" section by producing one
 * <h3> sub-section per issue and stitching them under the section <h2>.
 *
 * @param {object} params
 * @param {string} params.projectName
 * @param {{ name: string, example_text?: string }} params.section
 * @param {Array} params.issues  rows from project_issue_tracks + issue_notes
 * @param {Record<number, Array>} params.linkedPoliciesByTrack  track_id → policy rows
 * @param {Record<number, Array>} params.evidenceByTrack  track_id → evidence rows
 * @returns {Promise<string>}  stitched HTML
 */
export const PLANNING_ASSESSMENT_DEFAULT_PROMPT = `You are a planning consultant drafting the "{{SECTION_NAME}}" section of a Planning Statement for the project "{{PROJECT_NAME}}". Output HTML only — no markdown.

{{EXAMPLE_BLOCK}}CONTENT INSTRUCTIONS:
Write a Planning Assessment sub-section for the issue "{{ISSUE_LABEL}}"{{ISSUE_DISCIPLINE}}.

Structure the sub-section as follows:
1. Policy framework — state the relevant policies. For any policy marked [KEY POLICY], paraphrase what it requires in a sentence or two — do not use quotation marks or present any wording as a direct quote. For non-key policies, summarise what they require in a single sentence.
2. Assessment — explain in professional planning language how the proposal is compliant with each policy. Draw on the assessment notes and supporting evidence provided below. Where expert evidence supports compliance, reference it specifically (e.g. "The Heritage Statement concludes that...").
3. Conclusion — end the sub-section with a single concluding paragraph. If the proposal is compliant, state: "The proposals are therefore considered to comply with {{POLICY_REFS}}." If compliance is subject to conditions or mitigation mentioned in the assessment, say instead: "Subject to [the conditions/mitigation described above], the proposals are considered to comply with {{POLICY_REFS}}."

Issue context (policy framework, assessment notes, and evidence):
{{ISSUE_CONTEXT}}

FORMAT RULES (mandatory):
- Begin with <h3>{{ISSUE_LABEL}}</h3>
- Every paragraph must be wrapped in <p>...</p>
- Bold policy names and references with <strong>...</strong>
- Do not use **, *, #, ---, or any other markdown characters
- Do not add placeholder text — write the full sub-section from the material provided
- If assessment notes are sparse, produce a professional assessment drawing from the policy wording and evidence`;

export async function generatePlanningStatementAssessment({ projectName, section, issues, linkedPoliciesByTrack, evidenceByTrack, briefingSummary }) {
  const exampleBlock = section.example_text?.trim()
    ? `Match the tone and style of this example. Use NO content from it — all content must come from the notes and policies provided:\n<example>\n${section.example_text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000)}\n</example>\n\n`
    : '';

  const customPromptTemplate = section.generation_prompt?.trim() || null;

  const briefingBlock = briefingSummary?.trim()
    ? `\n\nBriefing context (use to inform strategic direction, planning arguments, and framing — do not reproduce verbatim):\n${briefingSummary.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 6000)}`
    : '';

  const systemPrompt = `You are a planning consultant drafting formal Planning Statements. You output clean HTML only. Every paragraph is a <p> tag, headings are <h2> or <h3>, bold is <strong>. Never use **, *, #, or --- — that is an error.${briefingBlock}`;

  const parts = [`<h2>${section.name}</h2>`];

  for (const issue of issues) {
    const linkedPolicies = linkedPoliciesByTrack[issue.id] ?? [];
    const evidence = evidenceByTrack[issue.id] ?? [];
    if (!linkedPolicies.length && !issue.argument_for?.trim() && !evidence.length) continue;
    console.log(`[generatePlanningStatementAssessment] generating issue: ${issue.label}`);
    const html = await generateSingleAssessmentIssue({ projectName, section, issue, linkedPolicies, evidence, briefingSummary });
    parts.push(html);
  }

  return parts.join('\n\n');
}

export async function generateSingleAssessmentIssue({ projectName, section, issue, linkedPolicies, evidence, briefingSummary }) {
  const exampleBlock = section.example_text?.trim()
    ? `Match the tone and style of this example. Use NO content from it — all content must come from the notes and policies provided:\n<example>\n${section.example_text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000)}\n</example>\n\n`
    : '';

  const customPromptTemplate = section.generation_prompt?.trim() || null;

  const briefingBlock = briefingSummary?.trim()
    ? `\n\nBriefing context (use to inform strategic direction, planning arguments, and framing — do not reproduce verbatim):\n${briefingSummary.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 6000)}`
    : '';

  const systemPrompt = `You are a planning consultant drafting formal Planning Statements. You output clean HTML only. Every paragraph is a <p> tag, headings are <h2> or <h3>, bold is <strong>. Never use **, *, #, or --- — that is an error.${briefingBlock}`;

  const issueContext = buildPlanningAppIssueContext(issue, linkedPolicies, evidence);

  const allPolicyRefs = linkedPolicies
    .filter(p => p.policy_reference)
    .map(p => p.policy_reference);
  const policyRefList = allPolicyRefs.length ? allPolicyRefs.join(', ') : 'the relevant policies';

  const prompt = (customPromptTemplate ?? PLANNING_ASSESSMENT_DEFAULT_PROMPT)
    .replace(/\{\{PROJECT_NAME\}\}/g, projectName)
    .replace(/\{\{SECTION_NAME\}\}/g, section.name)
    .replace(/\{\{ISSUE_LABEL\}\}/g, issue.label)
    .replace(/\{\{ISSUE_DISCIPLINE\}\}/g, issue.discipline ? ` (${issue.discipline})` : '')
    .replace(/\{\{POLICY_REFS\}\}/g, policyRefList)
    .replace(/\{\{ISSUE_CONTEXT\}\}/g, issueContext)
    .replace(/\{\{EXAMPLE_BLOCK\}\}/g, exampleBlock);

  const response = await client.messages.create({
    model: MODEL_SONNET,
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }]
  });

  const raw = response.content[0].text.trim()
    .replace(/^```(?:html)?\n?/i, '').replace(/\n?```$/i, '').trim();
  return `<div class="llm-generated">${raw}</div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Planning Statement — template-based section generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a planning statement section by resolving {{VARIABLE}} placeholders
 * in the section's generation_prompt and calling Claude.
 *
 * @param {{ section: object, variables: Record<string, string> }} params
 * @returns {Promise<string>}  HTML string
 */
// These variables are substituted AFTER generation — Claude writes the token literally
// and the real value is injected programmatically, guaranteeing no hallucination.
const PLANNING_STATEMENT_OUTPUT_VARS = new Set([
  'PROJECT_NAME', 'APPLICANT_NAME', 'LPA_NAME', 'SITE_ADDRESS', 'DEVELOPMENT_DESCRIPTION',
  'ABOUT_APPLICANT', 'PRE_APP_SUMMARY', 'EIA_SUMMARY', 'SCI_SUMMARY',
  'NATIONAL_POLICIES', 'LOCAL_POLICIES', 'OTHER_POLICIES',
  'LOCAL_POLICY_NAMES', 'SUPPLEMENTARY_POLICY_NAMES',
  'PROPOSED_DEVELOPMENT_HTML', 'SITE_SURROUNDINGS_HTML', 'PLANNING_HISTORY_TABLE',
  'DOCUMENT_LIST_DOCS', 'DOCUMENT_LIST_DRAWINGS',
]);

const OUTPUT_VAR_PLACEHOLDER_LABELS = {
  ABOUT_APPLICANT:   'About the Applicant',
  PRE_APP_SUMMARY:   'Pre-Application Response Summary',
  EIA_SUMMARY:       'EIA / Environmental Statement Summary',
  SCI_SUMMARY:       'Statement of Community Involvement Summary',
  NATIONAL_POLICIES:          'National Policies',
  LOCAL_POLICIES:             'Local Development Plan Policies',
  OTHER_POLICIES:             'Other Material Policies',
  LOCAL_POLICY_NAMES:         'Local Policy Names',
  SUPPLEMENTARY_POLICY_NAMES: 'Supplementary Policy Names',
  PROPOSED_DEVELOPMENT_HTML:  'Proposed Development',
  SITE_SURROUNDINGS_HTML:     'Site and Surroundings',
  PLANNING_HISTORY_TABLE:     'Planning History Table',
  DOCUMENT_LIST_DOCS:         'Document List',
  DOCUMENT_LIST_DRAWINGS:     'Drawings List',
};

export async function generatePlanningStatementSection({ section, variables, sectionNumber, briefingSummary }) {
  let prompt = section.generation_prompt ?? '';

  // Substitute only input vars (content Claude synthesises from).
  // Output vars stay as {{TOKEN}} so Claude echoes them into its response.
  for (const [key, value] of Object.entries(variables)) {
    if (!PLANNING_STATEMENT_OUTPUT_VARS.has(key)) {
      prompt = prompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value ?? '');
    }
  }

  // Instruct Claude to write output-var tokens literally rather than inventing values
  const outputVarLines = [...PLANNING_STATEMENT_OUTPUT_VARS]
    .filter(k => variables[k] !== undefined)
    .map(k => `  {{${k}}}`)
    .join('\n');
  const outputVarInstruction = outputVarLines
    ? `CRITICAL INSTRUCTION: The following placeholders will be filled in programmatically after you write. Write them EXACTLY as shown — including the double curly braces — wherever you would use that value. Never invent or rephrase these values:\n${outputVarLines}\n\n`
    : '';

  // Section numbering — overrides any numbering in the stored prompt
  let numberingInstruction = '';
  if (sectionNumber > 0) {
    const n = sectionNumber;
    numberingInstruction = `NUMBERING: This is section ${n} of the Planning Statement. Ignore any section numbers written in the instructions below. Apply this scheme to every heading and paragraph — no exceptions:
  - Main section heading → ${n}.0  (use <h2>)
  - Subsection headings → ${n}.1, ${n}.2, ${n}.3 …  (use <h3>, only where the section has genuinely distinct sub-topics)
  - Paragraphs directly under the ${n}.0 heading → ${n}.0.1, ${n}.0.2, ${n}.0.3 …  (prefix every <p> with the number, e.g. <p>${n}.0.1 Lorem ipsum…</p>)
  - Paragraphs within subsection ${n}.1 → ${n}.1.1, ${n}.1.2 …  (same pattern)
  - Every <p> must begin with its paragraph number. Do not write any unnumbered paragraph.\n\n`;
  } else {
    numberingInstruction = `NUMBERING: This is a prefatory section (Executive Summary — no section number). Do not add any numeric prefix to the heading or paragraphs.\n\n`;
  }

  const exampleBlock = section.example_text?.trim()
    ? `The following example shows the target tone and structure. Match the style — do NOT use any content from it:\n<example>\n${section.example_text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 3000)}\n</example>\n\n`
    : '';

  const fullPrompt = outputVarInstruction + numberingInstruction + exampleBlock + prompt;

  const briefingBlock = briefingSummary?.trim()
    ? `\n\nBriefing context (use this to inform strategic direction, framing, and planning arguments — do not reproduce it verbatim):\n${briefingSummary.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 6000)}`
    : '';

  const response = await client.messages.create({
    model: MODEL_SONNET,
    max_tokens: 4096,
    system: `You are a senior planning consultant writing a formal Planning Statement for submission to a local planning authority. Output clean HTML only — no markdown. Every paragraph is <p>, section headings are <h2>, subsection headings are <h3>, lists are <ul>/<li>, bold is <strong>. Never use **, *, #, or --- — those are errors.\n\nCRITICAL RULE: If you need to state a fact, figure, name, date, designation, measurement, or project-specific claim that is not explicitly present in the content provided to you, write [SOURCE REQUIRED] in its place. Never invent or infer project-specific information.${briefingBlock}`,
    messages: [{ role: 'user', content: fullPrompt }]
  });

  let output = response.content[0].text.trim();
  output = output.replace(/^```(?:html)?\n?/i, '').replace(/\n?```$/i, '').trim();

  // Programmatic substitution of output vars — these are never touched by the LLM
  for (const key of PLANNING_STATEMENT_OUTPUT_VARS) {
    const value = variables[key];
    const replacement = value || (() => {
      const label = OUTPUT_VAR_PLACEHOLDER_LABELS[key] ?? key;
      return `<p class="draft-placeholder">[${label} — not yet provided. Upload and summarise the relevant document to populate this section.]</p>`;
    })();
    output = output.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), replacement);
  }

  return output;
}

// ─────────────────────────────────────────────────────────────────────────────
// Template-based generation
// Template format:
//   {{VARIABLE}}            — substituted programmatically from variables map
//   {{LLM:slug}}...{{/LLM}} — Claude writes this slot; variables available as context
//   [Placeholder text]      — left as-is for manual editing
// ─────────────────────────────────────────────────────────────────────────────

async function generateLlmSlot({ instruction, variables, briefingSummary }) {
  const contextLines = [
    variables.PROJECT_NAME            && `Project: ${variables.PROJECT_NAME}`,
    variables.APPLICANT_NAME          && `Applicant: ${variables.APPLICANT_NAME}`,
    variables.LPA_NAME                && `LPA: ${variables.LPA_NAME}`,
    variables.SITE_ADDRESS            && `Site: ${variables.SITE_ADDRESS}`,
    variables.DEVELOPMENT_DESCRIPTION && `Development: ${variables.DEVELOPMENT_DESCRIPTION}`,
  ].filter(Boolean).join('\n');

  const briefingBlock = briefingSummary?.trim()
    ? `\n\nBriefing context (use this to inform strategic direction, framing, and planning arguments — do not reproduce it verbatim):\n${briefingSummary.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 6000)}`
    : '';

  const response = await client.messages.create({
    model: MODEL_SONNET,
    max_tokens: 600,
    system: `You are writing a single short passage for a formal Planning Statement submission.\n\nProject context (for reference — do not reproduce these verbatim as they appear elsewhere in the document):\n${contextLines}${briefingBlock}\n\nRULES:\n- Write [SOURCE REQUIRED] for any project-specific fact not in the context above\n- Output clean HTML using only <p> tags (and <ul>/<li> only if the instruction explicitly asks for a list)\n- No headings, no markdown, no code blocks`,
    messages: [{ role: 'user', content: instruction }]
  });

  const html = response.content[0].text.trim()
    .replace(/^```(?:html)?\n?/i, '').replace(/\n?```$/i, '').trim();
  return `<div class="llm-generated">${html}</div>`;
}

export async function generateFromTemplate({ section, variables, briefingSummary }) {
  let output = section.template_html;

  // 1. Fill {{LLM:slug}}instruction{{/LLM}} slots
  const llmSlotRegex = /\{\{LLM:([^}]+)\}\}([\s\S]*?)\{\{\/LLM\}\}/g;
  const slots = [...output.matchAll(llmSlotRegex)];
  for (const [fullMatch, , rawInstruction] of slots) {
    // Substitute plain-text vars into the instruction so the LLM sees resolved values
    let instruction = rawInstruction.trim();
    for (const [key, value] of Object.entries(variables)) {
      if (value && typeof value === 'string' && !value.includes('<')) {
        instruction = instruction.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      }
    }
    const slotHtml = await generateLlmSlot({ instruction, variables, briefingSummary });
    output = output.replace(fullMatch, slotHtml);
  }

  // 2. Substitute all {{VARIABLE}} programmatically
  const placeholderLabel = (key) => {
    const labels = {
      ABOUT_APPLICANT: 'About the Applicant',
      PRE_APP_SUMMARY: 'Pre-Application Response Summary',
      EIA_SUMMARY:     'EIA / Environmental Statement Summary',
      SCI_SUMMARY:     'Statement of Community Involvement Summary',
      NATIONAL_POLICIES:          'National Policies',
      LOCAL_POLICIES:             'Local Development Plan Policies',
      OTHER_POLICIES:             'Other Material Policies',
      LOCAL_POLICY_NAMES:         'Local Policy Names',
      SUPPLEMENTARY_POLICY_NAMES: 'Supplementary Policy Names',
      PROPOSED_DEVELOPMENT_HTML:  'Proposed Development',
      SITE_SURROUNDINGS_HTML:     'Site and Surroundings',
      PLANNING_HISTORY_TABLE:     'Planning History Table',
      DOCUMENT_LIST_DOCS:         'Document List',
      DOCUMENT_LIST_DRAWINGS:     'Drawings List',
    };
    return labels[key] ?? key.replace(/_/g, ' ').toLowerCase();
  };

  for (const [key, value] of Object.entries(variables)) {
    const hasValue = value && String(value).trim();
    const replacement = hasValue
      ? String(value)
      : `<p class="draft-placeholder">[${placeholderLabel(key)} — not yet provided]</p>`;
    output = output.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), replacement);
  }

  return output;
}

// ─────────────────────────────────────────────────────────────────────────────
// Document summarisation
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_SUMMARY_PROMPTS = {
  pre_app: `You are a planning consultant. Summarise this pre-application response from the Local Planning Authority.
Structure your summary with these headings: Overview of Proposal Assessed, Key Concerns Raised, Aspects Supported or Not Objected To, Recommended Changes or Conditions.
Write in clear professional prose. Output clean HTML using only <h3>, <p>, <ul>, <li> tags.`,

  eia_response: `You are a planning consultant. Summarise this EIA Scoping Opinion or Environmental Statement response.
Structure your summary with these headings: Topics Scoped In and Out, Key Technical Concerns or Requirements, Methodology Recommendations, Overarching Comments.
Write in clear professional prose. Output clean HTML using only <h3>, <p>, <ul>, <li> tags.`,

  sci: `You are a planning consultant. Summarise this Statement of Community Involvement or consultation document.
Structure your summary with these headings: Consultation Methods and Timeline, Key Themes from Community Feedback, Objections and Concerns Raised, Support Received, How Feedback Has Been Addressed.
Write in clear professional prose. Output clean HTML using only <h3>, <p>, <ul>, <li> tags.`,

  site_surroundings: `You are a planning consultant. Summarise this Site and Surroundings document.
Structure your summary with these headings: Site Description and Key Characteristics, Surrounding Context and Land Uses, Planning Constraints and Designations, Access and Infrastructure, Development Opportunities and Constraints.
Write in clear professional prose. Output clean HTML using only <h3>, <p>, <ul>, <li> tags.`,

  about_applicant: `You are a planning consultant. This document contains the applicant's standard 'About the Applicant' text for use in a Planning Statement.
Format this content clearly for inclusion in the statement. Preserve the original wording exactly — do not paraphrase, shorten, or alter the substance.
Output clean HTML using only <h3>, <p>, <ul>, <li> tags.`,

  proposed_development: `You are a planning consultant. Summarise this Proposed Development description for inclusion in a Planning Statement.
Structure your summary to cover: the formal description of development, the main components of the proposal, key technical figures or specifications, and any design or sustainability principles.
Write in clear professional prose. Output clean HTML using only <h3>, <p>, <ul>, <li> tags.`,

  briefing_transcript: `You are a senior planning consultant. You have been given a transcript of a project briefing or client meeting relating to a planning application.

Produce a detailed structured summary of this transcript for use as context when drafting a Planning Statement. Your summary should capture:

1. **Proposed Development** — what is being proposed, at what scale, and with what key components, as described in the briefing (not just formal figures — include the strategic framing of what this project is)
2. **Planning Strategy** — the overall planning angle, how the case is being framed, and the key arguments the consultant or applicant intends to make
3. **Planning Benefits** — the material planning benefits identified or discussed
4. **Policy Positioning** — how the proposal is positioned against key national or local policies, any policy conflicts acknowledged and how they are addressed
5. **Constraints and Sensitivities** — known issues, objections, or sensitivities and the approach to addressing them
6. **Specific Instructions or Directions** — any explicit instructions about tone, emphasis, sections to prioritise, or approaches to avoid

Be comprehensive. This summary will be used as background context by an AI when drafting all sections of a Planning Statement — do not compress or omit nuance.
Write in clear professional prose. Output clean HTML using only <h3>, <p>, <ul>, <li> tags.`,

  other: `You are a planning consultant. Provide a structured summary of this document.
Structure your summary with these headings: Purpose and Scope, Key Findings or Conclusions, Relevance to the Planning Application, Material Considerations Raised.
Write in clear professional prose. Output clean HTML using only <h3>, <p>, <ul>, <li> tags.`
};

export function getDefaultSummaryPrompt(docType) {
  return DEFAULT_SUMMARY_PROMPTS[docType] ?? DEFAULT_SUMMARY_PROMPTS.other;
}

export async function summariseDocument(text, fileName, docType, customPrompt = null) {
  const systemPrompt = customPrompt ?? getDefaultSummaryPrompt(docType);
  const userPrompt = `Document: ${fileName || 'Untitled'}\n\n${text.slice(0, 80000)}`;

  const response = await client.messages.create({
    model: MODEL_SONNET,
    max_tokens: 4000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }]
  });

  return response.content[0].text.trim();
}

export async function suggestTranscriptUpdates(text) {
  const systemPrompt = `You are a planning consultant analysing a briefing transcript to identify content that should update specific project data fields.

For each field listed below, assess whether the transcript contains clear, explicit content that belongs in that field. Only suggest an update if the content is clearly and explicitly present — do not infer, fabricate, or pad. If the transcript does not clearly address a field, omit it from your response.

Fields to assess:

1. field: "about_applicant" | label: "About the Applicant" — Who the applicant/developer is, their background, track record, and what they do. Only suggest if the transcript explicitly describes the applicant organisation.

2. field: "proposed_development" | label: "Proposed Development" — A full description of what is being proposed: components, scale, layout, technical specifications, key design features. Only suggest if the transcript contains a detailed description of the proposal.

3. field: "site_surroundings" | label: "Site and Surroundings" — Description of the site and its surrounding context, land uses, physical characteristics, constraints, designations. Only suggest if the transcript explicitly describes the site.

4. field: "pre_app" | label: "Pre-Application Response" — Any pre-application advice received from the LPA. Only suggest if the transcript explicitly references pre-application advice.

For each field where clear content exists, return a JSON object with:
- "field": the field identifier exactly as listed above
- "label": the human-readable label as listed above
- "suggested_content": the content written as clean HTML using only <p>, <ul>, <li>, <h3> tags — write the actual content, not a summary of what the transcript says
- "reason": a single sentence explaining what in the transcript justifies this suggestion

Return ONLY a valid JSON array with no preamble, explanation, or code fences. If no fields have clear content, return [].`;

  const response = await client.messages.create({
    model: MODEL_SONNET,
    max_tokens: 4000,
    system: systemPrompt,
    messages: [{ role: 'user', content: `Transcript:\n\n${text.slice(0, 80000)}` }]
  });

  const raw = response.content[0].text.trim();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.error('[suggestTranscriptUpdates] Failed to parse JSON:', cleaned.slice(0, 300));
    return [];
  }
}

export async function extractPointsFromDocument({ text, allIssues, targetIssues, documentType, documentDirection, userNotes, linkedPolicies = [], existingPointsByTrack = {}, customPrompt }) {
  const prompt = customPrompt ?? buildExtractPointsPrompt({ text, allIssues, targetIssues, documentType, documentDirection, userNotes, linkedPolicies, existingPointsByTrack });

  const response = await client.messages.create({
    model: MODEL_SONNET,
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }]
  });

  const raw = response.content[0].text.trim();
  console.log('[extractPointsFromDocument] raw response length:', raw.length);
  console.log('[extractPointsFromDocument] raw response preview:', raw.slice(0, 300));

  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (parseErr) {
    console.error('[extractPointsFromDocument] JSON.parse failed. cleaned length:', cleaned.length);
    console.error('[extractPointsFromDocument] cleaned preview:', cleaned.slice(0, 500));
    throw new Error(`LLM returned unparseable response: ${parseErr.message}`);
  }

  // Normalise points to the new shape — handles old custom prompts that still return `point`
  return {
    ...parsed,
    points: (parsed.points ?? []).map(p => ({
      track_id:               p.track_id ?? null,
      field:                  p.field,
      headline:               p.headline ?? p.point ?? '',
      detailed_summary:       p.detailed_summary ?? null,
      citation:               p.citation ?? null,
      relevant_chunk_indices: p.relevant_chunk_indices ?? []
    }))
  };
}
