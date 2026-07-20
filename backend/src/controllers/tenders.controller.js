import { pool } from '../db.js';
import { runSync, runBackfill, getStats, SyncInProgressError, SOURCES } from '../services/tenders/sync.js';
import { classifyCandidates } from '../services/tenders/relevance.js';
import { addManualAlias } from '../services/tenders/authorityMatcher.js';

const VALID_STAGES = ['planning', 'tender', 'award'];
const VALID_STATUSES = ['candidate', 'relevant', 'irrelevant', 'dismissed'];
const VALID_RULE_TYPES = ['cpv_prefix', 'keyword', 'exclusion_keyword', 'llm_prompt'];

export async function triggerSync(req, res) {
  const { source, from, to, stages, classify } = req.body || {};
  if (source && !SOURCES.includes(source)) {
    return res.status(400).json({ error: `source must be one of: ${SOURCES.join(', ')}` });
  }
  try {
    const result = await runSync({ source, from, to, stages, classify: classify !== false });
    res.json(result);
  } catch (err) {
    if (err instanceof SyncInProgressError) {
      return res.status(409).json({ error: 'Sync already in progress' });
    }
    console.error('[tenders] triggerSync error:', err);
    res.status(500).json({ error: 'Sync failed', detail: err.message });
  }
}

export async function triggerBackfill(req, res) {
  const { source, from, to } = req.body || {};
  if (source && !SOURCES.includes(source)) {
    return res.status(400).json({ error: `source must be one of: ${SOURCES.join(', ')}` });
  }
  if (!from || !to) {
    return res.status(400).json({ error: 'from and to are required (keep ranges to 3 months or less per call)' });
  }
  try {
    const result = await runBackfill({ source, from, to });
    res.json(result);
  } catch (err) {
    if (err instanceof SyncInProgressError) {
      return res.status(409).json({ error: 'Sync already in progress' });
    }
    console.error('[tenders] triggerBackfill error:', err);
    res.status(500).json({ error: 'Backfill failed', detail: err.message });
  }
}

export async function triggerClassify(req, res) {
  const limit = Math.min(parseInt(req.body?.limit, 10) || 200, 1000);
  try {
    const result = await classifyCandidates({ limit });
    res.json(result);
  } catch (err) {
    console.error('[tenders] triggerClassify error:', err);
    res.status(500).json({ error: 'Classification failed', detail: err.message });
  }
}

export async function listNotices(req, res) {
  const { source, stage, status, authority_id, from, to, search } = req.query;
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 25, 1), 100);

  const where = [];
  const params = [];
  const add = (clause, value) => {
    params.push(value);
    where.push(clause.replace('?', `$${params.length}`));
  };

  if (source && SOURCES.includes(source)) add('n.source = ?', source);
  if (stage && VALID_STAGES.includes(stage)) add('n.stage = ?', stage);
  if (status && VALID_STATUSES.includes(status)) add('n.relevance_status = ?', status);
  if (authority_id) add('n.authority_id = ?', parseInt(authority_id, 10));
  if (from) add('n.publication_date >= ?', from);
  if (to) add('n.publication_date <= ?', to);
  if (search) {
    params.push(`%${search}%`);
    const i = params.length;
    where.push(`(n.title ILIKE $${i} OR n.description ILIKE $${i} OR n.buyer_name ILIKE $${i})`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM scraper.tender_notices n ${whereSql}`,
      params
    );
    const rowsResult = await pool.query(
      `SELECT n.id, n.source, n.source_notice_id, n.ocid, n.stage, n.publication_date,
              n.title, n.description, n.buyer_name, n.authority_id, a.name AS authority_name,
              n.value_amount, n.value_currency, n.deadline, n.contract_start, n.contract_end,
              n.procurement_method, n.is_framework, n.cpv_code, n.cpv_description,
              n.contact_name, n.contact_email, n.contact_phone, n.notice_url, n.submission_url,
              n.relevance_status, n.classified_by, n.llm_reason, n.dismissed, n.created_at
       FROM scraper.tender_notices n
       LEFT JOIN scraper.tender_authorities a ON a.id = n.authority_id
       ${whereSql}
       ORDER BY n.publication_date DESC NULLS LAST
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, (page - 1) * pageSize]
    );
    res.json({
      rows: rowsResult.rows,
      total: parseInt(countResult.rows[0].total, 10),
      page,
      pageSize,
    });
  } catch (err) {
    console.error('[tenders] listNotices error:', err);
    res.status(500).json({ error: 'Failed to list notices' });
  }
}

export async function getNoticeStats(req, res) {
  try {
    res.json(await getStats());
  } catch (err) {
    console.error('[tenders] getNoticeStats error:', err);
    res.status(500).json({ error: 'Failed to compute stats' });
  }
}

export async function listSyncRuns(req, res) {
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  try {
    const { rows } = await pool.query(
      'SELECT * FROM scraper.tender_sync_runs ORDER BY started_at DESC LIMIT $1',
      [limit]
    );
    res.json(rows);
  } catch (err) {
    console.error('[tenders] listSyncRuns error:', err);
    res.status(500).json({ error: 'Failed to list sync runs' });
  }
}

export async function updateNotice(req, res) {
  const id = parseInt(req.params.id, 10);
  const { relevance_status, dismissed } = req.body || {};

  if (!id) return res.status(400).json({ error: 'Invalid notice id' });
  if (relevance_status !== undefined && !VALID_STATUSES.includes(relevance_status)) {
    return res.status(400).json({ error: `relevance_status must be one of: ${VALID_STATUSES.join(', ')}` });
  }
  if (relevance_status === undefined && dismissed === undefined) {
    return res.status(400).json({ error: 'Nothing to update' });
  }

  const sets = ['updated_at = NOW()'];
  const params = [id];
  if (relevance_status !== undefined) {
    params.push(relevance_status);
    sets.push(`relevance_status = $${params.length}`, `classified_by = 'human'`);
  }
  if (dismissed !== undefined) {
    params.push(Boolean(dismissed));
    sets.push(`dismissed = $${params.length}`);
  }

  try {
    const result = await pool.query(
      `UPDATE scraper.tender_notices SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Notice not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[tenders] updateNotice error:', err);
    res.status(500).json({ error: 'Failed to update notice' });
  }
}

export async function getUnmatchedBuyers(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT buyer_name, COUNT(*) AS notice_count, MAX(publication_date) AS latest_notice
       FROM scraper.tender_notices
       WHERE authority_id IS NULL AND buyer_name IS NOT NULL
       GROUP BY buyer_name
       ORDER BY notice_count DESC, latest_notice DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('[tenders] getUnmatchedBuyers error:', err);
    res.status(500).json({ error: 'Failed to list unmatched buyers' });
  }
}

export async function matchBuyer(req, res) {
  const { buyer_name, authority_id } = req.body || {};
  if (!buyer_name || !authority_id) {
    return res.status(400).json({ error: 'buyer_name and authority_id are required' });
  }
  try {
    const noticesUpdated = await addManualAlias(buyer_name, parseInt(authority_id, 10));
    res.json({ buyer_name, authority_id, notices_updated: noticesUpdated });
  } catch (err) {
    console.error('[tenders] matchBuyer error:', err);
    res.status(500).json({ error: 'Failed to match buyer', detail: err.message });
  }
}

export async function listAuthorities(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, canonical_code, region, authority_type, active
       FROM scraper.tender_authorities ORDER BY name`
    );
    res.json(rows);
  } catch (err) {
    console.error('[tenders] listAuthorities error:', err);
    res.status(500).json({ error: 'Failed to list authorities' });
  }
}

export async function getFilterRules(req, res) {
  try {
    const { rows } = await pool.query(
      'SELECT id, rule_type, value, active, updated_at FROM scraper.tender_filter_rules ORDER BY rule_type, value'
    );
    res.json(rows);
  } catch (err) {
    console.error('[tenders] getFilterRules error:', err);
    res.status(500).json({ error: 'Failed to load filter rules' });
  }
}

export async function createFilterRule(req, res) {
  const { rule_type, value } = req.body || {};
  if (!VALID_RULE_TYPES.includes(rule_type)) {
    return res.status(400).json({ error: `rule_type must be one of: ${VALID_RULE_TYPES.join(', ')}` });
  }
  if (!value || typeof value !== 'string' || !value.trim()) {
    return res.status(400).json({ error: 'value must be a non-empty string' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO scraper.tender_filter_rules (rule_type, value)
       VALUES ($1, $2)
       ON CONFLICT (rule_type, value) DO UPDATE SET active = TRUE, updated_at = NOW()
       RETURNING *`,
      [rule_type, value.trim()]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[tenders] createFilterRule error:', err);
    res.status(500).json({ error: 'Failed to create filter rule' });
  }
}

export async function deleteFilterRule(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Invalid rule id' });
  try {
    const result = await pool.query('DELETE FROM scraper.tender_filter_rules WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Rule not found' });
    res.json({ deleted: id });
  } catch (err) {
    console.error('[tenders] deleteFilterRule error:', err);
    res.status(500).json({ error: 'Failed to delete filter rule' });
  }
}

export async function updateLlmPrompt(req, res) {
  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 10) {
    return res.status(400).json({ error: 'prompt must be a non-empty string' });
  }
  try {
    // Single llm_prompt row: replace whatever is there
    await pool.query(`DELETE FROM scraper.tender_filter_rules WHERE rule_type = 'llm_prompt'`);
    const result = await pool.query(
      `INSERT INTO scraper.tender_filter_rules (rule_type, value) VALUES ('llm_prompt', $1) RETURNING *`,
      [prompt.trim()]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[tenders] updateLlmPrompt error:', err);
    res.status(500).json({ error: 'Failed to update LLM prompt' });
  }
}
