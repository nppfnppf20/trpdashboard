import { pool } from '../db.js';
import { suggestActionSummaries } from '../services/quoteActions.service.js';

/**
 * GET /api/admin-console/quote-actions/projects/:projectId
 * All actions for the project's quotes, newest first.
 */
export async function getActionsForProject(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT qa.id, qa.quote_id, qa.action_date::text, qa.summary, qa.full_text, qa.source_type, qa.stage
       FROM admin_console.quote_actions qa
       JOIN admin_console.quotes q ON q.id = qa.quote_id
       WHERE q.project_id = $1
       ORDER BY qa.action_date DESC, qa.id DESC`,
      [projectId]
    );
    res.json(rows);
  } catch (err) {
    console.error('getActionsForProject error:', err);
    res.status(500).json({ error: 'Failed to fetch actions', details: err.message });
  }
}

/**
 * POST /api/admin-console/quote-actions/projects/:projectId/actions
 * Create one action per selected quote (fan-out from a single date/full_text).
 * Body: { action_date, full_text, source_type, stage, items: [{ quote_id, summary }] }
 */
export async function createActions(req, res) {
  const { projectId } = req.params;
  const { action_date, full_text, source_type, stage, items } = req.body;
  if (!action_date) return res.status(400).json({ error: 'action_date is required' });
  if (stage && !['quote', 'instructed'].includes(stage)) return res.status(400).json({ error: 'stage must be quote or instructed' });
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'At least one survey is required' });
  if (items.some(i => !i.summary?.trim())) return res.status(400).json({ error: 'Each selected survey needs a summary' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const created = [];
    for (const item of items) {
      const { rows } = await client.query(
        `INSERT INTO admin_console.quote_actions
           (quote_id, action_date, summary, full_text, source_type, stage)
         SELECT $1, $2, $3, $4, $5, $6
         WHERE EXISTS (
           SELECT 1 FROM admin_console.quotes q
           WHERE q.id = $1 AND q.project_id = $7
         )
         RETURNING id, quote_id, action_date::text, summary, full_text, source_type, stage`,
        [
          item.quote_id,
          action_date,
          item.summary.trim(),
          full_text?.trim() || null,
          source_type?.trim() || 'note',
          stage || 'instructed',
          projectId,
        ]
      );
      if (!rows[0]) throw new Error(`Survey ${item.quote_id} does not belong to this project`);
      created.push(rows[0]);
    }
    await client.query('COMMIT');
    res.status(201).json(created);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createActions error:', err);
    res.status(500).json({ error: 'Failed to save actions', details: err.message });
  } finally {
    client.release();
  }
}

/**
 * POST /api/admin-console/quote-actions/projects/:projectId/actions/suggest
 * Generate action summaries from pasted source text via LLM.
 * Body: { full_text, stage, items: [{ quote_id, user_summary }] }
 */
export async function suggestActions(req, res) {
  const { projectId } = req.params;
  const { full_text, stage, items } = req.body;
  if (!full_text?.trim()) return res.status(400).json({ error: 'Paste the email trail or note text to summarise from' });
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'At least one survey is required' });

  try {
    const ids = items.map(i => i.quote_id);
    // Quote stage: nothing is instructed yet, so include all line items plus
    // the quote's fee and instruction status instead of instructed scope.
    const quoteStage = stage === 'quote';
    const [{ rows: quotes }, { rows: actions }] = await Promise.all([
      pool.query(
        `SELECT q.id, q.discipline, q.work_status, q.instruction_status, q.total,
                so.organisation AS surveyor_organisation,
                COALESCE(
                  json_agg(qli.item ORDER BY qli.created_at)
                    FILTER (WHERE qli.id IS NOT NULL AND ($3 OR COALESCE(qli.is_instructed, false))),
                  '[]'
                ) AS line_items
         FROM admin_console.quotes q
         LEFT JOIN admin_console.surveyor_organisations so ON so.id = q.surveyor_organisation_id
         LEFT JOIN admin_console.quote_line_items qli ON qli.quote_id = q.id
         WHERE q.project_id = $1 AND q.id = ANY($2::uuid[])
         GROUP BY q.id, so.organisation`,
        [projectId, ids, quoteStage]
      ),
      pool.query(
        `SELECT quote_id, action_date::text, summary
         FROM admin_console.quote_actions
         WHERE quote_id = ANY($1::uuid[])
         ORDER BY action_date DESC, id DESC`,
        [ids]
      ),
    ]);
    if (!quotes.length) return res.status(404).json({ error: 'No matching surveys found' });

    const actionsByQuote = {};
    for (const a of actions) {
      (actionsByQuote[a.quote_id] ||= []).push(a);
    }
    const userSummaries = Object.fromEntries(items.map(i => [i.quote_id, i.user_summary?.trim() || null]));

    const suggestions = await suggestActionSummaries(
      full_text,
      quotes.map(q => ({
        ...q,
        actions: actionsByQuote[q.id] || [],
        user_summary: userSummaries[q.id],
      })),
      quoteStage ? 'quote' : 'instructed'
    );
    res.json({ suggestions });
  } catch (err) {
    console.error('suggestActions error:', err);
    res.status(500).json({ error: 'Failed to generate summaries', details: err.message });
  }
}

/**
 * PUT /api/admin-console/quote-actions/actions/:actionId
 */
export async function updateAction(req, res) {
  const { actionId } = req.params;
  const { action_date, summary, full_text, source_type } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE admin_console.quote_actions SET
         action_date = COALESCE($2, action_date),
         summary     = COALESCE($3, summary),
         full_text   = CASE WHEN $4 THEN $5 ELSE full_text END,
         source_type = COALESCE($6, source_type),
         updated_at  = NOW()
       WHERE id = $1
       RETURNING id, quote_id, action_date::text, summary, full_text, source_type, stage`,
      [
        actionId,
        action_date || null,
        summary != null ? summary.trim() || null : null,
        'full_text' in req.body, full_text?.trim() || null,
        source_type?.trim() || null,
      ]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('updateAction error:', err);
    res.status(500).json({ error: 'Failed to update action', details: err.message });
  }
}

/**
 * DELETE /api/admin-console/quote-actions/actions/:actionId
 */
export async function deleteAction(req, res) {
  const { actionId } = req.params;
  try {
    const { rows } = await pool.query(
      `DELETE FROM admin_console.quote_actions WHERE id = $1 RETURNING id`,
      [actionId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, id: rows[0].id });
  } catch (err) {
    console.error('deleteAction error:', err);
    res.status(500).json({ error: 'Failed to delete action', details: err.message });
  }
}
