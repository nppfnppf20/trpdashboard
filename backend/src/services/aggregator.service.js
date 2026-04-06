/**
 * Aggregator Service
 * Merges per-chunk LLM results into a single result per topic.
 *
 * Each chunk is analysed independently, so a topic may have partial mentions
 * scattered across several chunks. This service collapses those into one
 * coherent row per topic before writing to the DB.
 */

const SENTIMENT_PRIORITY = ['negative', 'positive', 'neutral', 'not_mentioned'];
const CONFIDENCE_PRIORITY = ['high', 'medium', 'low'];

/**
 * Pick the "strongest" value from an array using a priority list.
 * Returns the first priority-list item that appears in the values array,
 * or the last priority item as a safe default.
 *
 * @param {string[]} values
 * @param {string[]} priority  highest priority first
 * @returns {string}
 */
function pickStrongest(values, priority) {
  for (const p of priority) {
    if (values.includes(p)) return p;
  }
  return priority[priority.length - 1];
}

/**
 * Aggregate an array of per-chunk topic results into one result per topic.
 * chunk results shape: [{ issue_id, mentioned, summary, sentiment, confidence, source_quote }]
 * (the LLM field is named issue_id — we keep that here and rename at the DB write layer)
 *
 * @param {Array<Array<object>>} chunkResults  array of chunk arrays
 * @returns {Map<string, object>}  keyed by topic id (string)
 */
export function aggregateChunkResults(chunkResults) {
  // Group all chunk entries by topic id
  const byTopic = new Map();

  for (const chunkArray of chunkResults) {
    for (const entry of chunkArray) {
      const id = String(entry.issue_id);
      if (!byTopic.has(id)) byTopic.set(id, []);
      byTopic.get(id).push(entry);
    }
  }

  const aggregated = new Map();

  for (const [topicId, entries] of byTopic) {
    const mentioned = entries.some(e => e.mentioned === true);
    const mentionedEntries = entries.filter(e => e.mentioned && e.summary);

    const sentiments = entries.map(e => e.sentiment).filter(Boolean);
    const confidences = entries.map(e => e.confidence).filter(Boolean);

    // Best source quote: pick from highest-confidence chunk that mentioned the topic
    const sortedByConfidence = [...mentionedEntries].sort(
      (a, b) => CONFIDENCE_PRIORITY.indexOf(a.confidence) - CONFIDENCE_PRIORITY.indexOf(b.confidence)
    );
    const source_quote = sortedByConfidence[0]?.source_quote ?? null;

    // Collect partial summaries — these are merged via a second LLM call in llm.service.js
    const partialSummaries = mentionedEntries.map(e => e.summary).filter(Boolean);

    aggregated.set(topicId, {
      topic_id: topicId,
      mentioned,
      partialSummaries,  // handed to llm.service for merge call
      sentiment: pickStrongest(sentiments, SENTIMENT_PRIORITY),
      confidence: pickStrongest(confidences, CONFIDENCE_PRIORITY),
      source_quote
    });
  }

  return aggregated;
}
