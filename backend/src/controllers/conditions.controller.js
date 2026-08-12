import { pool } from '../db.js';
import { suggestAdvancementSummaries, suggestFeeQuoteWorks, draftAdvancementsSummaryEmail } from '../services/conditionsTracker.service.js';

// ─────────────────────────────────────────────────────────────────────────────
// Fee quote drafting: per condition, list the works the wording requires.
// The email template itself is assembled on the frontend with the wording
// and reason inserted verbatim.
// ─────────────────────────────────────────────────────────────────────────────

export async function feeQuoteWorks(req, res) {
  const { projectId } = req.params;
  const { condition_ids } = req.body;
  if (!Array.isArray(condition_ids) || !condition_ids.length) {
    return res.status(400).json({ error: 'At least one condition is required' });
  }
  try {
    const { rows: conditions } = await pool.query(
      `SELECT id, condition_number, title, wording, reason
       FROM planning_applications.conditions
       WHERE project_id = $1 AND id = ANY($2::int[])`,
      [projectId, condition_ids]
    );
    if (!conditions.length) return res.status(404).json({ error: 'No matching conditions found' });

    const suggestions = await suggestFeeQuoteWorks(conditions);
    res.json({ suggestions });
  } catch (err) {
    console.error('conditions.feeQuoteWorks error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate fee quote items' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Get all conditions (with requirements) + tracker meta for a project
// ─────────────────────────────────────────────────────────────────────────────

export async function getConditionsData(req, res) {
  const { projectId } = req.params;
  try {
    const [{ rows: conditions }, { rows: requirements }, { rows: advancements }, { rows: advReqLinks }, { rows: quoteLinks }, { rows: quoteActions }, { rows: quoteKeyDates }, { rows: meta }] = await Promise.all([
      pool.query(
        `SELECT id, condition_number, title, condition_type, wording, reason, initial_actions,
                original_consultant, original_consultant_email, fee_quote_requested_at,
                status, source_file_name, sort_order, created_at, updated_at
         FROM planning_applications.conditions
         WHERE project_id = $1
         ORDER BY
           sort_order ASC,
           COALESCE(NULLIF(regexp_replace(condition_number, '\\D', '', 'g'), '')::int, 999999) ASC,
           id ASC`,
        [projectId]
      ),
      pool.query(
        `SELECT cr.id, cr.condition_id, cr.requirement_text, cr.requirement_type, cr.status,
                cr.sort_order, cr.created_at, cr.updated_at
         FROM planning_applications.condition_requirements cr
         JOIN planning_applications.conditions c ON c.id = cr.condition_id
         WHERE c.project_id = $1
         ORDER BY cr.sort_order ASC, cr.id ASC`,
        [projectId]
      ),
      pool.query(
        `SELECT ca.id, ca.condition_id, ca.advancement_date, ca.summary,
                ca.full_text, ca.source_type, ca.quote_id, ca.created_at, ca.updated_at
         FROM planning_applications.condition_advancements ca
         JOIN planning_applications.conditions c ON c.id = ca.condition_id
         WHERE c.project_id = $1
         ORDER BY ca.advancement_date DESC, ca.id DESC`,
        [projectId]
      ),
      pool.query(
        `SELECT car.advancement_id, car.requirement_id
         FROM planning_applications.condition_advancement_requirements car
         JOIN planning_applications.condition_advancements ca ON ca.id = car.advancement_id
         JOIN planning_applications.conditions c ON c.id = ca.condition_id
         WHERE c.project_id = $1`,
        [projectId]
      ),
      pool.query(
        `SELECT cql.condition_id, cql.quote_id,
                q.status AS quote_status, q.total AS quote_total,
                q.instruction_status, q.instruction_status_changed_at, q.work_status,
                so.organisation, so.discipline
         FROM planning_applications.condition_quote_links cql
         JOIN planning_applications.conditions c ON c.id = cql.condition_id
         JOIN admin_console.quotes q ON q.id = cql.quote_id
         LEFT JOIN admin_console.surveyor_organisations so ON so.id = q.surveyor_organisation_id
         WHERE c.project_id = $1`,
        [projectId]
      ),
      pool.query(
        `SELECT qa.quote_id, qa.id, qa.action_date, qa.summary, qa.full_text, qa.source_type
         FROM admin_console.quote_actions qa
         WHERE qa.quote_id IN (
           SELECT cql.quote_id
           FROM planning_applications.condition_quote_links cql
           JOIN planning_applications.conditions c ON c.id = cql.condition_id
           WHERE c.project_id = $1
         )
         ORDER BY qa.action_date DESC, qa.id DESC`,
        [projectId]
      ),
      pool.query(
        `SELECT qkd.quote_id, qkd.id, qkd.title, qkd.date, qkd.colour
         FROM admin_console.quote_key_dates qkd
         WHERE qkd.quote_id IN (
           SELECT cql.quote_id
           FROM planning_applications.condition_quote_links cql
           JOIN planning_applications.conditions c ON c.id = cql.condition_id
           WHERE c.project_id = $1
         )
         ORDER BY qkd.date ASC, qkd.id ASC`,
        [projectId]
      ),
      pool.query(
        `SELECT last_exported_at, last_issued_to_client_at
         FROM planning_applications.conditions_tracker_meta
         WHERE project_id = $1`,
        [projectId]
      ),
    ]);

    const byCondition = {};
    for (const r of requirements) {
      (byCondition[r.condition_id] ||= []).push(r);
    }
    const reqIdsByAdvancement = {};
    for (const link of advReqLinks) {
      (reqIdsByAdvancement[link.advancement_id] ||= []).push(link.requirement_id);
    }
    const advByCondition = {};
    for (const a of advancements) {
      (advByCondition[a.condition_id] ||= []).push({ ...a, requirement_ids: reqIdsByAdvancement[a.id] || [] });
    }
    const actionsByQuote = {};
    for (const qa of quoteActions) {
      (actionsByQuote[qa.quote_id] ||= []).push(qa);
    }
    const keyDatesByQuote = {};
    for (const kd of quoteKeyDates) {
      (keyDatesByQuote[kd.quote_id] ||= []).push(kd);
    }
    const quotesByCondition = {};
    for (const link of quoteLinks) {
      (quotesByCondition[link.condition_id] ||= []).push({
        quote_id: link.quote_id,
        quote_status: link.quote_status,
        quote_total: link.quote_total,
        instruction_status: link.instruction_status,
        instruction_status_changed_at: link.instruction_status_changed_at,
        work_status: link.work_status,
        organisation: link.organisation,
        discipline: link.discipline,
        actions: actionsByQuote[link.quote_id] || [],
        key_dates: keyDatesByQuote[link.quote_id] || [],
      });
    }
    const withRequirements = conditions.map(c => ({
      ...c,
      requirements: byCondition[c.id] || [],
      advancements: advByCondition[c.id] || [],
      linked_quotes: quotesByCondition[c.id] || [],
    }));

    res.json({
      conditions: withRequirements,
      meta: meta[0] || { last_exported_at: null, last_issued_to_client_at: null },
    });
  } catch (err) {
    console.error('conditions.getConditionsData error:', err);
    res.status(500).json({ error: 'Failed to fetch conditions data' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Create a condition (optionally with requirements) — transactional
// ─────────────────────────────────────────────────────────────────────────────

export async function createCondition(req, res) {
  const { projectId } = req.params;
  const { condition_number, title, condition_type, wording, reason, initial_actions, original_consultant, original_consultant_email, status, source_file_name, requirements } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [condition] } = await client.query(
      `INSERT INTO planning_applications.conditions
         (project_id, condition_number, title, condition_type, wording, reason, initial_actions,
          original_consultant, original_consultant_email, status, source_file_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        projectId,
        condition_number?.trim() || null,
        title.trim(),
        condition_type?.trim() || null,
        wording?.trim() || null,
        reason?.trim() || null,
        initial_actions?.trim() || null,
        original_consultant?.trim() || null,
        original_consultant_email?.trim() || null,
        status?.trim() || 'Not Started',
        source_file_name?.trim() || null,
      ]
    );

    const createdRequirements = [];
    const reqItems = (Array.isArray(requirements) ? requirements : [])
      .map(r => typeof r === 'string'
        ? { text: r.trim(), type: null }
        : { text: (r?.requirement_text ?? '').trim(), type: r?.requirement_type?.trim() || null })
      .filter(r => r.text);
    for (let i = 0; i < reqItems.length; i++) {
      const { rows: [reqRow] } = await client.query(
        `INSERT INTO planning_applications.condition_requirements
           (condition_id, requirement_text, requirement_type, sort_order)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [condition.id, reqItems[i].text, reqItems[i].type, i]
      );
      createdRequirements.push(reqRow);
    }

    await client.query('COMMIT');
    res.status(201).json({ ...condition, requirements: createdRequirements, advancements: [] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('conditions.createCondition error:', err);
    res.status(500).json({ error: 'Failed to create condition' });
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Update a condition row
// ─────────────────────────────────────────────────────────────────────────────

export async function updateCondition(req, res) {
  const { conditionId } = req.params;
  const { condition_number, title, condition_type, wording, reason, initial_actions, original_consultant, original_consultant_email, fee_quote_requested_at, status, sort_order } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE planning_applications.conditions SET
         condition_number = CASE WHEN $2 THEN $3 ELSE condition_number END,
         title            = COALESCE($4, title),
         condition_type   = CASE WHEN $5 THEN $6 ELSE condition_type END,
         wording          = CASE WHEN $7 THEN $8 ELSE wording END,
         reason           = CASE WHEN $9 THEN $10 ELSE reason END,
         initial_actions  = CASE WHEN $11 THEN $12 ELSE initial_actions END,
         original_consultant       = CASE WHEN $13 THEN $14 ELSE original_consultant END,
         original_consultant_email = CASE WHEN $15 THEN $16 ELSE original_consultant_email END,
         fee_quote_requested_at    = CASE WHEN $17 THEN $18::timestamptz ELSE fee_quote_requested_at END,
         status           = COALESCE($19, status),
         sort_order       = COALESCE($20, sort_order),
         updated_at       = NOW()
       WHERE id = $1 RETURNING *`,
      [
        conditionId,
        'condition_number' in req.body, condition_number?.trim() || null,
        title != null ? title.trim() || null : null,
        'condition_type' in req.body, condition_type?.trim() || null,
        'wording' in req.body, wording?.trim() || null,
        'reason' in req.body, reason?.trim() || null,
        'initial_actions' in req.body, initial_actions?.trim() || null,
        'original_consultant' in req.body, original_consultant?.trim() || null,
        'original_consultant_email' in req.body, original_consultant_email?.trim() || null,
        'fee_quote_requested_at' in req.body, fee_quote_requested_at || null,
        status?.trim() || null,
        sort_order ?? null,
      ]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('conditions.updateCondition error:', err);
    res.status(500).json({ error: 'Failed to update condition' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete a condition (requirements cascade)
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteCondition(req, res) {
  const { conditionId } = req.params;
  try {
    await pool.query(
      `DELETE FROM planning_applications.conditions WHERE id = $1`,
      [conditionId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('conditions.deleteCondition error:', err);
    res.status(500).json({ error: 'Failed to delete condition' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Requirements: create / update / delete
// ─────────────────────────────────────────────────────────────────────────────

export async function createRequirement(req, res) {
  const { conditionId } = req.params;
  const { requirement_text, requirement_type, status } = req.body;
  if (!requirement_text?.trim()) return res.status(400).json({ error: 'requirement_text is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO planning_applications.condition_requirements
         (condition_id, requirement_text, requirement_type, status, sort_order)
       VALUES (
         $1, $2, $3, $4,
         COALESCE((SELECT MAX(sort_order) + 1 FROM planning_applications.condition_requirements WHERE condition_id = $1), 0)
       )
       RETURNING *`,
      [conditionId, requirement_text.trim(), requirement_type?.trim() || null, status?.trim() || 'Outstanding']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('conditions.createRequirement error:', err);
    res.status(500).json({ error: 'Failed to create requirement' });
  }
}

export async function updateRequirement(req, res) {
  const { requirementId } = req.params;
  const { requirement_text, requirement_type, status, sort_order } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE planning_applications.condition_requirements SET
         requirement_text = COALESCE($2, requirement_text),
         requirement_type = CASE WHEN $3 THEN $4 ELSE requirement_type END,
         status           = COALESCE($5, status),
         sort_order       = COALESCE($6, sort_order),
         updated_at       = NOW()
       WHERE id = $1 RETURNING *`,
      [
        requirementId,
        requirement_text != null ? requirement_text.trim() || null : null,
        'requirement_type' in req.body, requirement_type?.trim() || null,
        status?.trim() || null,
        sort_order ?? null,
      ]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('conditions.updateRequirement error:', err);
    res.status(500).json({ error: 'Failed to update requirement' });
  }
}

export async function deleteRequirement(req, res) {
  const { requirementId } = req.params;
  try {
    await pool.query(
      `DELETE FROM planning_applications.condition_requirements WHERE id = $1`,
      [requirementId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('conditions.deleteRequirement error:', err);
    res.status(500).json({ error: 'Failed to delete requirement' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Advancements: dated progress entries against one or more conditions
// ─────────────────────────────────────────────────────────────────────────────

// Batch create: one advancement (date + source text) applied to several
// conditions, each with its own summary. Transactional.
export async function createAdvancements(req, res) {
  const { projectId } = req.params;
  const { advancement_date, full_text, source_type, items } = req.body;
  if (!advancement_date) return res.status(400).json({ error: 'advancement_date is required' });
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'At least one condition is required' });
  if (items.some(i => !i.summary?.trim())) return res.status(400).json({ error: 'Each selected condition needs a summary' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const created = [];
    for (const item of items) {
      const quoteId = item.quote_id || null;
      const { rows } = await client.query(
        `INSERT INTO planning_applications.condition_advancements
           (condition_id, advancement_date, summary, full_text, source_type, quote_id)
         SELECT $1, $2, $3, $4, $5, $7::uuid
         WHERE EXISTS (
           SELECT 1 FROM planning_applications.conditions c
           WHERE c.id = $1 AND c.project_id = $6
         )
         AND (
           $7::uuid IS NULL
           OR EXISTS (
             SELECT 1 FROM planning_applications.condition_quote_links cql
             WHERE cql.condition_id = $1 AND cql.quote_id = $7::uuid
           )
         )
         RETURNING *`,
        [
          item.condition_id,
          advancement_date,
          item.summary.trim(),
          full_text?.trim() || null,
          source_type?.trim() || 'note',
          projectId,
          quoteId,
        ]
      );
      if (!rows[0]) throw new Error(`Condition ${item.condition_id} does not belong to this project, or the tagged quote isn't linked to it`);

      // Link to specific requirements where given (verified against the condition)
      const linkedIds = [];
      for (const reqId of item.requirement_ids || []) {
        const { rows: [link] } = await client.query(
          `INSERT INTO planning_applications.condition_advancement_requirements (advancement_id, requirement_id)
           SELECT $1, $2
           WHERE EXISTS (
             SELECT 1 FROM planning_applications.condition_requirements cr
             WHERE cr.id = $2 AND cr.condition_id = $3
           )
           RETURNING requirement_id`,
          [rows[0].id, reqId, item.condition_id]
        );
        if (link) linkedIds.push(link.requirement_id);
      }
      created.push({ ...rows[0], requirement_ids: linkedIds });
    }
    await client.query('COMMIT');
    res.status(201).json(created);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('conditions.createAdvancements error:', err);
    res.status(500).json({ error: 'Failed to save advancement' });
  } finally {
    client.release();
  }
}

// Suggest per-condition summaries from source text: reads each condition's
// wording, reason and previous advancements. User-supplied notes take
// precedence. Among the ticked conditions, only those the source material
// actually contains relevant new information for come back with a summary.
export async function suggestAdvancements(req, res) {
  const { projectId } = req.params;
  const { full_text, items } = req.body;
  if (!full_text?.trim()) return res.status(400).json({ error: 'Paste the email trail or note text to summarise from' });
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'At least one condition is required' });

  try {
    const ids = items.map(i => i.condition_id);
    const [{ rows: conditions }, { rows: advancements }, { rows: requirements }] = await Promise.all([
      pool.query(
        `SELECT id, condition_number, title, wording, reason
         FROM planning_applications.conditions
         WHERE project_id = $1 AND id = ANY($2::int[])`,
        [projectId, ids]
      ),
      pool.query(
        `SELECT condition_id, advancement_date::text, summary
         FROM planning_applications.condition_advancements
         WHERE condition_id = ANY($1::int[])
         ORDER BY advancement_date DESC, id DESC`,
        [ids]
      ),
      pool.query(
        `SELECT id, condition_id, requirement_text
         FROM planning_applications.condition_requirements
         WHERE condition_id = ANY($1::int[])
         ORDER BY sort_order ASC, id ASC`,
        [ids]
      ),
    ]);
    if (!conditions.length) return res.status(404).json({ error: 'No matching conditions found' });

    const advByCondition = {};
    for (const a of advancements) {
      (advByCondition[a.condition_id] ||= []).push(a);
    }
    const reqsByCondition = {};
    for (const r of requirements) {
      (reqsByCondition[r.condition_id] ||= []).push(r);
    }
    const userSummaries = Object.fromEntries(items.map(i => [i.condition_id, i.user_summary?.trim() || null]));
    const tickedReqIds = Object.fromEntries(items.map(i => [i.condition_id, i.requirement_ids || []]));

    const enriched = conditions.map(c => {
      const reqs = reqsByCondition[c.id] || [];
      const ticked = tickedReqIds[c.id] || [];
      return {
        ...c,
        advancements: advByCondition[c.id] || [],
        user_summary: userSummaries[c.id] || null,
        target_requirements: reqs.filter(r => ticked.includes(r.id)).map(r => r.requirement_text),
      };
    });

    const suggestions = await suggestAdvancementSummaries(full_text, enriched);
    res.json({ suggestions });
  } catch (err) {
    console.error('conditions.suggestAdvancements error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate summaries' });
  }
}

// Draft a client progress summary email from the advancements logged in a
// date range. The LLM is told the email's length must follow the advancements'
// own content — a starting draft, not a finished email.
export async function advancementsSummaryEmail(req, res) {
  const { projectId } = req.params;
  const { from_date, to_date } = req.body;
  if (!from_date || !to_date) return res.status(400).json({ error: 'from_date and to_date are required' });

  try {
    const [{ rows: entries }, { rows: [project] }] = await Promise.all([
      pool.query(
        `SELECT c.id AS condition_id, c.condition_number, c.title, c.status,
                ca.advancement_date::text, ca.summary
         FROM planning_applications.condition_advancements ca
         JOIN planning_applications.conditions c ON c.id = ca.condition_id
         WHERE c.project_id = $1 AND ca.advancement_date BETWEEN $2 AND $3
         ORDER BY
           c.sort_order ASC,
           COALESCE(NULLIF(regexp_replace(c.condition_number, '\\D', '', 'g'), '')::int, 999999) ASC,
           c.id ASC,
           ca.advancement_date ASC, ca.id ASC`,
        [projectId, from_date, to_date]
      ),
      pool.query(
        `SELECT project_name, project_id FROM public.projects WHERE id = $1`,
        [projectId]
      ),
    ]);

    if (!entries.length) {
      return res.status(404).json({ error: 'No advancements were logged between those dates' });
    }

    // Group by condition, preserving the ORDER BY above
    const conditions = [];
    const byId = {};
    for (const e of entries) {
      if (!byId[e.condition_id]) {
        byId[e.condition_id] = {
          condition_number: e.condition_number,
          title: e.title,
          status: e.status,
          advancements: [],
        };
        conditions.push(byId[e.condition_id]);
      }
      byId[e.condition_id].advancements.push({ advancement_date: e.advancement_date, summary: e.summary });
    }

    const email = await draftAdvancementsSummaryEmail({
      projectName: project?.project_name || '',
      projectRef: project?.project_id || '',
      fromDate: from_date,
      toDate: to_date,
      conditions,
    });

    res.json({ ...email, advancement_count: entries.length });
  } catch (err) {
    console.error('conditions.advancementsSummaryEmail error:', err);
    res.status(500).json({ error: err.message || 'Failed to draft the summary email' });
  }
}

export async function updateAdvancement(req, res) {
  const { advancementId } = req.params;
  const { advancement_date, summary, full_text, source_type, requirement_ids, quote_id } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if ('quote_id' in req.body && quote_id) {
      const { rows: [ok] } = await client.query(
        `SELECT 1
         FROM planning_applications.condition_advancements ca
         JOIN planning_applications.condition_quote_links cql
           ON cql.condition_id = ca.condition_id AND cql.quote_id = $2::uuid
         WHERE ca.id = $1`,
        [advancementId, quote_id]
      );
      if (!ok) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: "That quote isn't linked to this condition" });
      }
    }

    const { rows } = await client.query(
      `UPDATE planning_applications.condition_advancements SET
         advancement_date = COALESCE($2, advancement_date),
         summary          = COALESCE($3, summary),
         full_text        = CASE WHEN $4 THEN $5 ELSE full_text END,
         source_type      = COALESCE($6, source_type),
         quote_id         = CASE WHEN $7 THEN $8::uuid ELSE quote_id END,
         updated_at       = NOW()
       WHERE id = $1 RETURNING *`,
      [
        advancementId,
        advancement_date || null,
        summary != null ? summary.trim() || null : null,
        'full_text' in req.body, full_text?.trim() || null,
        source_type?.trim() || null,
        'quote_id' in req.body, quote_id || null,
      ]
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Not found' });
    }

    let linkedIds = null;
    if ('requirement_ids' in req.body) {
      await client.query(
        `DELETE FROM planning_applications.condition_advancement_requirements WHERE advancement_id = $1`,
        [advancementId]
      );
      linkedIds = [];
      for (const reqId of requirement_ids || []) {
        const { rows: [link] } = await client.query(
          `INSERT INTO planning_applications.condition_advancement_requirements (advancement_id, requirement_id)
           SELECT $1, $2
           WHERE EXISTS (
             SELECT 1 FROM planning_applications.condition_requirements cr
             WHERE cr.id = $2 AND cr.condition_id = $3
           )
           RETURNING requirement_id`,
          [advancementId, reqId, rows[0].condition_id]
        );
        if (link) linkedIds.push(link.requirement_id);
      }
    } else {
      const { rows: links } = await client.query(
        `SELECT requirement_id FROM planning_applications.condition_advancement_requirements WHERE advancement_id = $1`,
        [advancementId]
      );
      linkedIds = links.map(l => l.requirement_id);
    }

    await client.query('COMMIT');
    res.json({ ...rows[0], requirement_ids: linkedIds });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('conditions.updateAdvancement error:', err);
    res.status(500).json({ error: 'Failed to update advancement' });
  } finally {
    client.release();
  }
}

export async function deleteAdvancement(req, res) {
  const { advancementId } = req.params;
  try {
    await pool.query(
      `DELETE FROM planning_applications.condition_advancements WHERE id = $1`,
      [advancementId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('conditions.deleteAdvancement error:', err);
    res.status(500).json({ error: 'Failed to delete advancement' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Quote links: attach quotes from surveyor management to conditions
// ─────────────────────────────────────────────────────────────────────────────

// Quotes on this project, for the link picker
export async function listProjectQuotes(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT q.id, q.status, q.total,
              so.organisation, so.discipline,
              c.name AS contact_name
       FROM admin_console.quotes q
       JOIN public.projects p ON p.unique_id = q.project_id
       LEFT JOIN admin_console.surveyor_organisations so ON so.id = q.surveyor_organisation_id
       LEFT JOIN admin_console.contacts c ON c.id = q.contact_id
       WHERE p.id = $1
       ORDER BY so.organisation ASC NULLS LAST, q.created_at DESC`,
      [projectId]
    );
    res.json({ quotes: rows });
  } catch (err) {
    console.error('conditions.listProjectQuotes error:', err);
    res.status(500).json({ error: 'Failed to fetch project quotes' });
  }
}

export async function linkConditionQuote(req, res) {
  const { conditionId } = req.params;
  const { quote_id } = req.body;
  if (!quote_id) return res.status(400).json({ error: 'quote_id is required' });
  try {
    // Only link quotes on the same project as the condition
    await pool.query(
      `INSERT INTO planning_applications.condition_quote_links (condition_id, quote_id)
       SELECT c.id, q.id
       FROM planning_applications.conditions c
       JOIN public.projects p ON p.id = c.project_id
       JOIN admin_console.quotes q ON q.project_id = p.unique_id
       WHERE c.id = $1 AND q.id = $2
       ON CONFLICT DO NOTHING`,
      [conditionId, quote_id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('conditions.linkConditionQuote error:', err);
    res.status(500).json({ error: 'Failed to link quote' });
  }
}

export async function unlinkConditionQuote(req, res) {
  const { conditionId, quoteId } = req.params;
  try {
    await pool.query(
      `DELETE FROM planning_applications.condition_quote_links
       WHERE condition_id = $1 AND quote_id = $2`,
      [conditionId, quoteId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('conditions.unlinkConditionQuote error:', err);
    res.status(500).json({ error: 'Failed to unlink quote' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stamp last_exported_at / last_issued_to_client_at
// ─────────────────────────────────────────────────────────────────────────────

export async function markExported(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `INSERT INTO planning_applications.conditions_tracker_meta (project_id, last_exported_at)
       VALUES ($1, NOW())
       ON CONFLICT (project_id) DO UPDATE SET last_exported_at = NOW(), updated_at = NOW()
       RETURNING last_exported_at, last_issued_to_client_at`,
      [projectId]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('conditions.markExported error:', err);
    res.status(500).json({ error: 'Failed to update export timestamp' });
  }
}

export async function markIssuedToClient(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `INSERT INTO planning_applications.conditions_tracker_meta (project_id, last_issued_to_client_at)
       VALUES ($1, NOW())
       ON CONFLICT (project_id) DO UPDATE SET last_issued_to_client_at = NOW(), updated_at = NOW()
       RETURNING last_exported_at, last_issued_to_client_at`,
      [projectId]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('conditions.markIssuedToClient error:', err);
    res.status(500).json({ error: 'Failed to update issue timestamp' });
  }
}
