/**
 * Two-stage relevance filtering for tender notices:
 *  1. applyRules — cheap CPV-prefix / keyword pre-filter deciding whether a notice
 *     is stored at all (non-matching notices are discarded, only counted in the run log);
 *  2. classifyCandidates — LLM pass over stored 'candidate' rows, persisting the verdict.
 */

import { pool } from '../../db.js';
import { callClaude, parseJSON, MODEL_FAST } from '../llm.shared.js';

const BATCH_SIZE = 25;

export async function loadRules() {
  const result = await pool.query(
    'SELECT rule_type, value FROM scraper.tender_filter_rules WHERE active = TRUE'
  );
  const rules = { cpvPrefixes: [], keywords: [], exclusions: [], llmPrompt: null };
  for (const row of result.rows) {
    if (row.rule_type === 'cpv_prefix') rules.cpvPrefixes.push(row.value);
    else if (row.rule_type === 'keyword') rules.keywords.push(row.value.toLowerCase());
    else if (row.rule_type === 'exclusion_keyword') rules.exclusions.push(row.value.toLowerCase());
    else if (row.rule_type === 'llm_prompt') rules.llmPrompt = row.value;
  }
  return rules;
}

/** Decides whether a normalised row is worth storing as a 'candidate'. */
export function applyRules(row, rules) {
  const text = `${row.title || ''} ${row.description || ''}`.toLowerCase();

  if (rules.exclusions.some((word) => text.includes(word))) return false;

  const cpvCodes = [row.cpv_code, ...(row.additional_cpv_codes || []).map((c) => c.id)].filter(Boolean);
  if (cpvCodes.some((code) => rules.cpvPrefixes.some((prefix) => code.startsWith(prefix)))) return true;
  if (rules.keywords.some((word) => text.includes(word))) return true;

  return false;
}

/**
 * LLM-classifies stored candidates (oldest first, capped). Rows in a batch the
 * LLM fails on stay 'candidate' for a later retry — never marked irrelevant on error.
 */
export async function classifyCandidates({ limit = 200 } = {}) {
  const rules = await loadRules();
  if (!rules.llmPrompt) {
    console.warn('[tenders] no active llm_prompt rule configured; skipping classification');
    return { processed: 0, relevant: 0, irrelevant: 0 };
  }

  const { rows } = await pool.query(
    `SELECT id, title, description, buyer_name, cpv_code, cpv_description, value_amount, value_currency
     FROM scraper.tender_notices
     WHERE relevance_status = 'candidate' AND dismissed = FALSE
     ORDER BY publication_date ASC
     LIMIT $1`,
    [limit]
  );

  const stats = { processed: 0, relevant: 0, irrelevant: 0 };

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    let verdicts;
    try {
      verdicts = await classifyBatch(batch, rules.llmPrompt);
    } catch (err) {
      console.error('[tenders] classify batch failed, rows left as candidate:', err.message);
      continue;
    }

    for (const verdict of verdicts) {
      const status = verdict.relevant ? 'relevant' : 'irrelevant';
      const result = await pool.query(
        `UPDATE scraper.tender_notices
         SET relevance_status = $2, classified_by = 'llm', llm_reason = $3, updated_at = NOW()
         WHERE id = $1 AND relevance_status = 'candidate'`,
        [verdict.id, status, verdict.reason]
      );
      if (result.rowCount > 0) {
        stats.processed += 1;
        stats[status] += 1;
      }
    }
  }

  return stats;
}

async function classifyBatch(items, llmPrompt) {
  const itemsBlock = items
    .map((item, idx) => {
      const value = item.value_amount ? `${item.value_amount} ${item.value_currency || ''}`.trim() : 'unknown';
      return (
        `[${idx}] id:${item.id}\n` +
        `Title: ${item.title || '(no title)'}\n` +
        `Buyer: ${item.buyer_name || '(unknown)'}\n` +
        `CPV: ${item.cpv_code || '-'} ${item.cpv_description || ''}\n` +
        `Value: ${value}\n` +
        `Description: ${(item.description || '(no description)').slice(0, 500)}`
      );
    })
    .join('\n\n');

  const system =
    'You are a relevance filter assistant. You will be given a list of public procurement notices and a relevance criterion. For each notice, decide if it is relevant based on the criterion provided. Respond ONLY with a valid JSON array — no markdown, no explanation.';

  const user =
    `Relevance criterion:\n${llmPrompt}\n\nNotices to evaluate:\n${itemsBlock}\n\n` +
    `Respond with a JSON array with one entry per notice, in the same order:\n` +
    `[\n  { "id": <number>, "relevant": true|false, "reason": "<one sentence>" }\n]`;

  const raw = await callClaude(system, user, MODEL_FAST);
  const parsed = parseJSON(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`LLM did not return an array: ${String(raw).slice(0, 200)}`);
  }

  const validIds = new Set(items.map((item) => item.id));
  return parsed
    .filter((entry) => validIds.has(entry.id))
    .map((entry) => ({
      id: entry.id,
      relevant: Boolean(entry.relevant),
      reason: entry.reason || '',
    }));
}
