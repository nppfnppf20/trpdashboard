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
export async function generateAppealDraft({ projectName, draftTypeName, sections, issues }) {
  const issueContext = issues.map(issue => {
    const lines = [`## ${issue.label}${issue.discipline ? ` (${issue.discipline})` : ''}`];
    if (issue.argument_against) lines.push(`Opposing position:\n${issue.argument_against}`);
    if (issue.argument_for)     lines.push(`Our case:\n${issue.argument_for}`);
    if (!issue.argument_against && !issue.argument_for) lines.push('(No notes yet — acknowledge this issue but flag it as to be developed.)');
    return lines.join('\n');
  }).join('\n\n---\n\n');

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

/**
 * Build the extraction prompt template with {{DOCUMENT}} as the placeholder
 * for the actual document text. Used when saving/loading editable templates.
 * Issue list and context are baked in fresh at call time.
 */
export function buildExtractPointsTemplate({ allIssues, targetIssues, documentType, documentDirection, userNotes }) {
  return buildExtractPointsPrompt({ text: '{{DOCUMENT}}', allIssues, targetIssues, documentType, documentDirection, userNotes });
}

/**
 * Build the extraction prompt without running the LLM.
 * Exported so the controller can return it for preview/editing.
 */
export function buildExtractPointsPrompt({ text, allIssues, targetIssues, documentType, documentDirection, userNotes }) {
  const docInstruction = DOC_TYPE_INSTRUCTIONS[documentType] || DOC_TYPE_INSTRUCTIONS['Other'];

  const directionInstruction = documentDirection === 'for'
    ? 'This document SUPPORTS the proposal. Unless a point clearly articulates an objection or problem, default to tagging it as "argument_for".'
    : 'This document is AGAINST the proposal (e.g. officer report, refusal notice, objection). Unless a point clearly supports the appellant, default to tagging it as "argument_against".';

  const issues = targetIssues.length > 0 ? targetIssues : allIssues;

  const issueList = issues.map(issue => {
    const against = issue.argument_against ? `\n    Current against: ${issue.argument_against.slice(0, 400)}` : '';
    const forNote  = issue.argument_for    ? `\n    Current for: ${issue.argument_for.slice(0, 400)}`    : '';
    return `- id:${issue.id} | ${issue.label}${issue.discipline ? ` (${issue.discipline})` : ''}${against}${forNote}`;
  }).join('\n');

  const fullContext = allIssues.map(issue => {
    const parts = [];
    if (issue.argument_against) parts.push(`Against: ${issue.argument_against.slice(0, 200)}`);
    if (issue.argument_for)     parts.push(`For: ${issue.argument_for.slice(0, 200)}`);
    return parts.length ? `${issue.label}: ${parts.join(' | ')}` : null;
  }).filter(Boolean).join('\n');

  const userNotesSection = userNotes
    ? `\n\n⚑ USER GUIDANCE (treat this as high priority context — it overrides your own judgement where it conflicts):\n${userNotes}\n`
    : '';

  const targetNote = targetIssues.length > 0
    ? `The user has indicated this document is specifically relevant to: ${targetIssues.map(i => i.label).join(', ')}. Focus extraction on these issues first, but still surface any other relevant points.`
    : `No specific issues were flagged — review against all issues and use your judgement.`;

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

Document:
<document>
${text.slice(0, 10000)}
</document>

Instructions:
- Extract every point from the document that could be useful to the argument, including things that fill gaps in the current notes
- Do NOT repeat points already captured in the current working notes above
- Map each point to the most relevant issue id, or null if it is general
- Tag each point as "argument_against" (articulates the opposing position) or "argument_for" (supports the appeal)
- Write each point as a concise, directly usable note (1–3 sentences max)
- If the user guidance above directs you to specific themes or paragraphs, prioritise those

Respond ONLY with valid JSON in this exact shape — no markdown, no explanation:
{
  "summary": "2-4 sentence overview of the document and its overall relevance to the appeal",
  "coverage": [
    { "issue_id": 42, "assessment": "one sentence on how this document bears on this issue" }
  ],
  "points": [
    { "track_id": 42, "field": "argument_against", "point": "The officer found that..." },
    { "track_id": 42, "field": "argument_for", "point": "Paragraph 6.4 acknowledges that..." },
    { "track_id": null, "field": "argument_for", "point": "The committee noted a general presumption in favour..." }
  ]
}

If no relevant points are found, return points as an empty array but still provide the summary and coverage.`;
}

export async function extractPointsFromDocument({ text, allIssues, targetIssues, documentType, documentDirection, userNotes, customPrompt }) {
  const prompt = customPrompt ?? buildExtractPointsPrompt({ text, allIssues, targetIssues, documentType, documentDirection, userNotes });

  const response = await client.messages.create({
    model: MODEL_SONNET,
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }]
  });

  const raw = response.content[0].text.trim();
  console.log('[extractPointsFromDocument] raw response length:', raw.length);
  console.log('[extractPointsFromDocument] raw response preview:', raw.slice(0, 300));

  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(cleaned);
  } catch (parseErr) {
    console.error('[extractPointsFromDocument] JSON.parse failed. cleaned length:', cleaned.length);
    console.error('[extractPointsFromDocument] cleaned preview:', cleaned.slice(0, 500));
    throw new Error(`LLM returned unparseable response: ${parseErr.message}`);
  }
}
