import { pool } from '../db.js';
import { callClaude, parseJSON, MODEL_FAST } from '../services/llm.shared.js';

const VALID_CATEGORIES = ['renewables', 'datacentres', 'contracts_finder'];
const BATCH_SIZE = 25;

export async function getFilterPrompts(req, res) {
  try {
    const result = await pool.query(
      'SELECT category, prompt, updated_at FROM scraper.llm_filter_prompts ORDER BY category'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[scraperFilters] getFilterPrompts error:', err);
    res.status(500).json({ error: 'Failed to load filter prompts' });
  }
}

export async function updateFilterPrompt(req, res) {
  const { category } = req.params;
  const { prompt } = req.body;

  if (!VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 10) {
    return res.status(400).json({ error: 'Prompt must be a non-empty string' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO scraper.llm_filter_prompts (category, prompt, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (category) DO UPDATE SET prompt = $2, updated_at = NOW()
       RETURNING category, prompt, updated_at`,
      [category, prompt.trim()]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[scraperFilters] updateFilterPrompt error:', err);
    res.status(500).json({ error: 'Failed to update filter prompt' });
  }
}

export async function applyFilter(req, res) {
  const { category } = req.params;

  if (!VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  try {
    const promptRow = await pool.query(
      'SELECT prompt FROM scraper.llm_filter_prompts WHERE category = $1',
      [category]
    );
    if (promptRow.rows.length === 0) {
      return res.status(404).json({ error: 'No prompt configured for this category' });
    }
    const userPrompt = promptRow.rows[0].prompt;

    const items = await fetchItemsForCategory(category);
    if (items.length === 0) {
      return res.json({ results: [], totalProcessed: 0 });
    }

    const results = [];
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      const batchResults = await filterBatch(batch, userPrompt, category);
      results.push(...batchResults);
    }

    res.json({ results, totalProcessed: items.length });
  } catch (err) {
    console.error('[scraperFilters] applyFilter error:', err);
    res.status(500).json({ error: 'Failed to apply filter' });
  }
}

async function fetchItemsForCategory(category) {
  if (category === 'renewables') {
    const r = await pool.query(
      'SELECT id, uid AS title, description FROM scraper.planit_renewables WHERE dismissed = false ORDER BY created_at DESC'
    );
    return r.rows;
  }
  if (category === 'datacentres') {
    const r = await pool.query(
      'SELECT id, uid AS title, description FROM scraper.planit_datacentres WHERE dismissed = false ORDER BY created_at DESC'
    );
    return r.rows;
  }
  if (category === 'contracts_finder') {
    const r = await pool.query(
      'SELECT id, title, description FROM scraper.contracts_finder WHERE dismissed = false ORDER BY published_date DESC'
    );
    return r.rows;
  }
  return [];
}

async function filterBatch(items, userPrompt, category) {
  const itemsBlock = items.map((item, idx) =>
    `[${idx}] id:${item.id}\nTitle: ${item.title || '(no title)'}\nDescription: ${(item.description || '(no description)').slice(0, 500)}`
  ).join('\n\n');

  const system = `You are a relevance filter assistant. You will be given a list of scraped items and a relevance criterion. For each item, decide if it is relevant based on the criterion provided. Respond ONLY with a valid JSON array — no markdown, no explanation.`;

  const user = `Relevance criterion:\n${userPrompt}\n\nItems to evaluate:\n${itemsBlock}\n\nRespond with a JSON array with one entry per item, in the same order:\n[\n  { "id": <number>, "relevant": true|false, "reason": "<one sentence>" }\n]`;

  const raw = await callClaude(system, user, MODEL_FAST);
  const parsed = parseJSON(raw);

  if (!Array.isArray(parsed)) {
    console.error('[scraperFilters] LLM did not return array:', raw.slice(0, 300));
    return items.map(item => ({ id: item.id, relevant: false, reason: 'Filter error' }));
  }

  return parsed.map(entry => ({
    id: entry.id,
    relevant: Boolean(entry.relevant),
    reason: entry.reason || ''
  }));
}
