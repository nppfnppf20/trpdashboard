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
