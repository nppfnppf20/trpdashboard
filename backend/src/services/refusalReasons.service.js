/**
 * Refusal Reasons Service
 * CRUD for appeal project refusal reasons
 */

import { pool } from '../db.js';

export async function getRefusalReasons(projectId) {
  const result = await pool.query(
    `SELECT id, project_id, title, summary, risk_level, is_key_issue, sort_order, created_at, updated_at
     FROM admin_console.refusal_reasons
     WHERE project_id = $1
     ORDER BY sort_order, id`,
    [projectId]
  );
  return result.rows;
}

export async function createRefusalReason(projectId, { title, summary, riskLevel, isKeyIssue }) {
  const maxRow = await pool.query(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM admin_console.refusal_reasons WHERE project_id = $1`,
    [projectId]
  );
  const sortOrder = maxRow.rows[0].next;

  const result = await pool.query(
    `INSERT INTO admin_console.refusal_reasons (project_id, title, summary, risk_level, is_key_issue, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [projectId, title, summary || null, riskLevel || null, isKeyIssue ?? false, sortOrder]
  );
  return result.rows[0];
}

export async function updateRefusalReason(reasonId, projectId, { title, summary, riskLevel, isKeyIssue, sortOrder }) {
  const result = await pool.query(
    `UPDATE admin_console.refusal_reasons
     SET title        = $1,
         summary      = $2,
         risk_level   = $3,
         is_key_issue = $4,
         sort_order   = COALESCE($5, sort_order),
         updated_at   = NOW()
     WHERE id = $6 AND project_id = $7
     RETURNING *`,
    [title, summary ?? null, riskLevel ?? null, isKeyIssue ?? false, sortOrder ?? null, reasonId, projectId]
  );
  if (result.rows.length === 0) throw new Error('Refusal reason not found');
  return result.rows[0];
}

export async function deleteRefusalReason(reasonId, projectId) {
  const result = await pool.query(
    `DELETE FROM admin_console.refusal_reasons WHERE id = $1 AND project_id = $2 RETURNING id`,
    [reasonId, projectId]
  );
  if (result.rows.length === 0) throw new Error('Refusal reason not found');
}

export async function reorderRefusalReasons(projectId, orderedIds) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < orderedIds.length; i++) {
      await client.query(
        `UPDATE admin_console.refusal_reasons SET sort_order = $1, updated_at = NOW() WHERE id = $2 AND project_id = $3`,
        [i, orderedIds[i], projectId]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
