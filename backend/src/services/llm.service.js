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
const MODEL = 'claude-sonnet-4-20250514';

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
 * Uses non-streaming for all calls — documents rarely exceed the context window
 * when chunked properly, and streaming complicates the review/draft flow.
 *
 * @param {string} system
 * @param {string} user
 * @returns {Promise<string>}
 */
async function callClaude(system, user) {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system,
    messages: [{ role: 'user', content: user }]
  });
  return message.content[0].text;
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
  const chunks = chunkText(rawText);
  const topicsJson = JSON.stringify(
    topics.map(t => ({ id: t.id, code: t.code, title: t.title, description: t.description, keywords: t.keywords }))
  );

  const systemPrompt = stageConfig?.llm_system_prompt || DEFAULT_SYSTEM_PROMPT;
  const userTemplate = stageConfig?.llm_user_prompt_template || DEFAULT_USER_PROMPT_TEMPLATE;

  // Step 1 — analyse each chunk against all topics in parallel
  const chunkResults = await Promise.all(
    chunks.map(async chunk => {
      const userPrompt = userTemplate
        .replace('{{CHUNK_TEXT}}', chunk)
        .replace('{{TOPICS_JSON}}', topicsJson);
      const raw = await callClaude(systemPrompt, userPrompt);
      try {
        return parseJSON(raw);
      } catch {
        // If a chunk returns malformed JSON, treat it as no mentions rather than failing the whole document
        console.warn('Chunk returned malformed JSON — skipping chunk');
        return topics.map(t => ({
          issue_id: t.id,
          mentioned: false,
          summary: null,
          sentiment: 'not_mentioned',
          confidence: 'low',
          source_quote: null
        }));
      }
    })
  );

  // Step 2 — aggregate chunk results per topic
  const aggregated = aggregateChunkResults(chunkResults);

  // Step 3 — merge partial summaries for topics that were mentioned in multiple chunks
  const topicResults = await Promise.all(
    Array.from(aggregated.values()).map(async agg => {
      let summary = null;

      if (agg.mentioned && agg.partialSummaries.length > 1) {
        const mergePrompt = SUMMARY_MERGE_PROMPT.replace(
          '{{SUMMARIES}}',
          agg.partialSummaries.join('\n\n---\n\n')
        );
        summary = await callClaude(DEFAULT_SYSTEM_PROMPT, mergePrompt);
        summary = summary.trim();
      } else if (agg.partialSummaries.length === 1) {
        summary = agg.partialSummaries[0];
      }

      return {
        topic_id: Number(agg.topic_id),
        mentioned: agg.mentioned,
        summary,
        sentiment: agg.sentiment,
        confidence: agg.confidence,
        source_quote: agg.source_quote
      };
    })
  );

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
