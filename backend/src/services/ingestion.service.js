/**
 * Core document ingestion pipeline.
 * Chunks a document, analyses each chunk against project topics,
 * aggregates results, and produces a document summary + unmatched content report.
 */

import { chunkText } from './parser.service.js';
import { aggregateChunkResults } from './aggregator.service.js';
import { callClaude, parseJSON, MAX_CHUNKS, MODEL_FAST, MODEL_SONNET } from './llm.shared.js';

// ─────────────────────────────────────────────────────────────────────────────
// Prompt constants
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
// Exports
// ─────────────────────────────────────────────────────────────────────────────

export async function runIngestion(rawText, topics, stageConfig = null) {
  const chunks = chunkText(rawText).slice(0, MAX_CHUNKS);
  const topicsJson = JSON.stringify(
    topics.map(t => ({ id: t.id, code: t.code, title: t.title, description: t.description, keywords: t.keywords }))
  );

  const systemPrompt = stageConfig?.llm_system_prompt || DEFAULT_SYSTEM_PROMPT;
  const userTemplate = stageConfig?.llm_user_prompt_template || DEFAULT_USER_PROMPT_TEMPLATE;

  const chunkResults = [];
  for (const chunk of chunks) {
    const userPrompt = userTemplate
      .replace('{{CHUNK_TEXT}}', chunk)
      .replace('{{TOPICS_JSON}}', topicsJson);
    const raw = await callClaude(systemPrompt, userPrompt, MODEL_FAST);
    try {
      chunkResults.push(parseJSON(raw));
    } catch {
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

  const aggregated = aggregateChunkResults(chunkResults);

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

  const docSummaryPrompt = DOCUMENT_SUMMARY_PROMPT.replace('{{FULL_RAW_TEXT}}', rawText.slice(0, 40000));
  const documentSummary = (await callClaude(DEFAULT_SYSTEM_PROMPT, docSummaryPrompt)).trim();

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
