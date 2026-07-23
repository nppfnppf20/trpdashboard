/**
 * Drafting Issues controller.
 * A project-scoped issue list for AI document generation, independent of
 * admin_console.project_issue_tracks (the workflow/Stages-board "key issues").
 * Seeded from key issues via importFromKeyIssues, then edited independently.
 * Currently wired into Planning Statement v3 only — see appeal.controller.js.
 */

import { pool } from '../db.js';
import { resolveBriefingSourceTexts } from '../services/quoteRequests.service.js';
import { draftIssuesFromBriefingNote } from '../services/planningStatement.service.js';

async function loadCustomActionPrompt(key) {
  const { rows } = await pool.query(
    `SELECT prompt_text FROM admin_console.llm_prompts WHERE prompt_key = $1`, [key]
  );
  return rows[0]?.prompt_text ?? null;
}

export async function listDraftingIssues(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT di.id, di.project_id, di.label, di.discipline, di.issue_type_id,
              di.source_track_id, di.argument_for, di.argument_against, di.summary,
              di.policy_national, di.policy_local, di.policy_neighbourhood,
              di.policy_supplementary, di.policy_other, di.sort_order,
              it.label AS issue_type_label, it.development_type AS issue_type_development_type
       FROM admin_console.drafting_issues di
       LEFT JOIN admin_console.issue_types it ON it.id = di.issue_type_id
       WHERE di.project_id = $1
       ORDER BY di.sort_order, di.id`,
      [projectId]
    );
    res.json(rows);
  } catch (err) {
    console.error('draftingIssues.list error:', err);
    res.status(500).json({ error: 'Failed to fetch drafting issues' });
  }
}

export async function createDraftingIssue(req, res) {
  const { projectId } = req.params;
  const { label, discipline, issue_type_id } = req.body;
  if (!label?.trim()) return res.status(400).json({ error: 'label is required' });
  try {
    const { rows: maxRow } = await pool.query(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM admin_console.drafting_issues WHERE project_id = $1`,
      [projectId]
    );
    const { rows } = await pool.query(
      `INSERT INTO admin_console.drafting_issues (project_id, label, discipline, issue_type_id, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, project_id, label, discipline, issue_type_id, source_track_id,
                 argument_for, argument_against, summary,
                 policy_national, policy_local, policy_neighbourhood, policy_supplementary, policy_other,
                 sort_order`,
      [projectId, label.trim(), discipline?.trim() || null, issue_type_id || null, maxRow[0].next]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('draftingIssues.create error:', err);
    res.status(500).json({ error: 'Failed to create drafting issue' });
  }
}

export async function updateDraftingIssue(req, res) {
  const { id } = req.params;
  const {
    label, discipline, issue_type_id, argument_for, argument_against, summary,
    policy_national, policy_local, policy_neighbourhood, policy_supplementary, policy_other,
  } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE admin_console.drafting_issues
       SET label                 = COALESCE($1, label),
           discipline            = CASE WHEN $2::text IS NOT NULL THEN $2 ELSE discipline END,
           issue_type_id         = CASE WHEN $3::int IS NOT NULL THEN $3 ELSE issue_type_id END,
           argument_for          = CASE WHEN $4::text IS NOT NULL THEN $4 ELSE argument_for END,
           argument_against      = CASE WHEN $5::text IS NOT NULL THEN $5 ELSE argument_against END,
           summary               = CASE WHEN $6::text IS NOT NULL THEN $6 ELSE summary END,
           policy_national       = CASE WHEN $7::text IS NOT NULL THEN $7 ELSE policy_national END,
           policy_local          = CASE WHEN $8::text IS NOT NULL THEN $8 ELSE policy_local END,
           policy_neighbourhood  = CASE WHEN $9::text IS NOT NULL THEN $9 ELSE policy_neighbourhood END,
           policy_supplementary  = CASE WHEN $10::text IS NOT NULL THEN $10 ELSE policy_supplementary END,
           policy_other          = CASE WHEN $11::text IS NOT NULL THEN $11 ELSE policy_other END
       WHERE id = $12
       RETURNING id, project_id, label, discipline, issue_type_id, source_track_id,
                 argument_for, argument_against, summary,
                 policy_national, policy_local, policy_neighbourhood, policy_supplementary, policy_other,
                 sort_order`,
      [label?.trim() || null, discipline?.trim() ?? null, issue_type_id ?? null,
       argument_for ?? null, argument_against ?? null, summary ?? null,
       policy_national ?? null, policy_local ?? null, policy_neighbourhood ?? null,
       policy_supplementary ?? null, policy_other ?? null, id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Drafting issue not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('draftingIssues.update error:', err);
    res.status(500).json({ error: 'Failed to update drafting issue' });
  }
}

// issue_type_id is unset via a dedicated flag (rather than reusing the
// COALESCE-style update above) since callers need to be able to clear it
// back to "no template", not just leave it unchanged.
export async function setDraftingIssueType(req, res) {
  const { id } = req.params;
  const { issue_type_id } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE admin_console.drafting_issues SET issue_type_id = $1 WHERE id = $2
       RETURNING id, issue_type_id`,
      [issue_type_id || null, id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Drafting issue not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('draftingIssues.setDraftingIssueType error:', err);
    res.status(500).json({ error: 'Failed to set issue type' });
  }
}

export async function deleteDraftingIssue(req, res) {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `DELETE FROM admin_console.drafting_issues WHERE id = $1 RETURNING id`, [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Drafting issue not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('draftingIssues.delete error:', err);
    res.status(500).json({ error: 'Failed to delete drafting issue' });
  }
}

export async function reorderDraftingIssues(req, res) {
  const { projectId } = req.params;
  const { orderedIds } = req.body;
  if (!Array.isArray(orderedIds)) return res.status(400).json({ error: 'orderedIds must be an array' });
  try {
    await Promise.all(orderedIds.map((id, idx) =>
      pool.query(
        `UPDATE admin_console.drafting_issues SET sort_order = $1 WHERE id = $2 AND project_id = $3`,
        [idx, id, projectId]
      )
    ));
    res.json({ ok: true });
  } catch (err) {
    console.error('draftingIssues.reorder error:', err);
    res.status(500).json({ error: 'Failed to reorder drafting issues' });
  }
}

// Copies any active key issue (project_issue_tracks) not already imported
// (no existing drafting_issues row with that source_track_id) — along with
// its argument notes and linked policies — as a one-off starting point.
// Safe to re-run: already-imported issues are skipped, so it only ever adds
// new ones, never overwrites edits made since the last import.
export async function importFromKeyIssues(req, res) {
  const { projectId } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: tracks } = await client.query(
      `SELECT pit.id, pit.label, pit.discipline, pit.issue_type_id, pit.summary,
              n.argument_for, n.argument_against,
              n.policy_national, n.policy_local, n.policy_neighbourhood,
              n.policy_supplementary, n.policy_other
       FROM admin_console.project_issue_tracks pit
       LEFT JOIN planning_applications.issue_notes n
         ON n.track_id = pit.id AND n.project_id = pit.project_id
       WHERE pit.project_id = $1 AND pit.is_active = TRUE
         AND NOT EXISTS (
           SELECT 1 FROM admin_console.drafting_issues di
           WHERE di.source_track_id = pit.id
         )
       ORDER BY pit.sort_order, pit.id`,
      [projectId]
    );

    if (!tracks.length) {
      await client.query('ROLLBACK');
      return res.json({ imported: 0 });
    }

    const { rows: maxRow } = await client.query(
      `SELECT COALESCE(MAX(sort_order), -1) AS max FROM admin_console.drafting_issues WHERE project_id = $1`,
      [projectId]
    );
    let nextOrder = maxRow[0].max + 1;

    for (const t of tracks) {
      const { rows: inserted } = await client.query(
        `INSERT INTO admin_console.drafting_issues
           (project_id, label, discipline, issue_type_id, source_track_id, argument_for, argument_against,
            summary, policy_national, policy_local, policy_neighbourhood, policy_supplementary, policy_other, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING id`,
        [projectId, t.label, t.discipline, t.issue_type_id, t.id, t.argument_for, t.argument_against,
         t.summary, t.policy_national, t.policy_local, t.policy_neighbourhood, t.policy_supplementary, t.policy_other,
         nextOrder++]
      );
      const draftingIssueId = inserted[0].id;

      await client.query(
        `INSERT INTO admin_console.drafting_issue_policy_relevance (drafting_issue_id, policy_id)
         SELECT $1, ptr.policy_id
         FROM planning_applications.policy_track_relevance ptr
         WHERE ptr.track_id = $2
         ON CONFLICT DO NOTHING`,
        [draftingIssueId, t.id]
      );
    }

    await client.query('COMMIT');
    res.json({ imported: tracks.length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('draftingIssues.importFromKeyIssues error:', err);
    res.status(500).json({ error: 'Failed to import from key issues' });
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Policy relevance (independent of planning_applications.policy_track_relevance)
// ─────────────────────────────────────────────────────────────────────────────

export async function getDraftingIssuePolicyRelevance(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT dipr.drafting_issue_id, dipr.policy_id
       FROM admin_console.drafting_issue_policy_relevance dipr
       JOIN admin_console.drafting_issues di ON di.id = dipr.drafting_issue_id
       WHERE di.project_id = $1`,
      [projectId]
    );
    // Return as { [drafting_issue_id]: [policy_id, ...] }
    const map = {};
    for (const row of rows) {
      if (!map[row.drafting_issue_id]) map[row.drafting_issue_id] = [];
      map[row.drafting_issue_id].push(row.policy_id);
    }
    res.json(map);
  } catch (err) {
    console.error('draftingIssues.getPolicyRelevance error:', err);
    res.status(500).json({ error: 'Failed to fetch policy relevance' });
  }
}

export async function toggleDraftingIssuePolicy(req, res) {
  const { draftingIssueId, policyId } = req.params;
  try {
    const { rows: existing } = await pool.query(
      `SELECT 1 FROM admin_console.drafting_issue_policy_relevance WHERE drafting_issue_id = $1 AND policy_id = $2`,
      [draftingIssueId, policyId]
    );
    if (existing.length) {
      await pool.query(
        `DELETE FROM admin_console.drafting_issue_policy_relevance WHERE drafting_issue_id = $1 AND policy_id = $2`,
        [draftingIssueId, policyId]
      );
      res.json({ linked: false });
    } else {
      await pool.query(
        `INSERT INTO admin_console.drafting_issue_policy_relevance (drafting_issue_id, policy_id) VALUES ($1, $2)`,
        [draftingIssueId, policyId]
      );
      res.json({ linked: true });
    }
  } catch (err) {
    console.error('draftingIssues.togglePolicy error:', err);
    res.status(500).json({ error: 'Failed to toggle policy relevance' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Snippet template relevance (admin_console.issue_types) — many-to-many,
// replacing the old single-select drafting_issues.issue_type_id for new
// linking. An issue can have several relevant templates.
// ─────────────────────────────────────────────────────────────────────────────

export async function getDraftingIssueSnippetRelevance(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT disr.drafting_issue_id, disr.issue_type_id
       FROM admin_console.drafting_issue_snippet_relevance disr
       JOIN admin_console.drafting_issues di ON di.id = disr.drafting_issue_id
       WHERE di.project_id = $1`,
      [projectId]
    );
    // Return as { [drafting_issue_id]: [issue_type_id, ...] }
    const map = {};
    for (const row of rows) {
      if (!map[row.drafting_issue_id]) map[row.drafting_issue_id] = [];
      map[row.drafting_issue_id].push(row.issue_type_id);
    }
    res.json(map);
  } catch (err) {
    console.error('draftingIssues.getSnippetRelevance error:', err);
    res.status(500).json({ error: 'Failed to fetch snippet relevance' });
  }
}

export async function toggleDraftingIssueSnippet(req, res) {
  const { draftingIssueId, issueTypeId } = req.params;
  try {
    const { rows: existing } = await pool.query(
      `SELECT 1 FROM admin_console.drafting_issue_snippet_relevance WHERE drafting_issue_id = $1 AND issue_type_id = $2`,
      [draftingIssueId, issueTypeId]
    );
    if (existing.length) {
      await pool.query(
        `DELETE FROM admin_console.drafting_issue_snippet_relevance WHERE drafting_issue_id = $1 AND issue_type_id = $2`,
        [draftingIssueId, issueTypeId]
      );
      res.json({ linked: false });
    } else {
      await pool.query(
        `INSERT INTO admin_console.drafting_issue_snippet_relevance (drafting_issue_id, issue_type_id) VALUES ($1, $2)`,
        [draftingIssueId, issueTypeId]
      );
      res.json({ linked: true });
    }
  } catch (err) {
    console.error('draftingIssues.toggleSnippet error:', err);
    res.status(500).json({ error: 'Failed to toggle snippet relevance' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Draft from Briefing Note
// ─────────────────────────────────────────────────────────────────────────────

export async function draftIssuesFromBriefing(req, res) {
  const { projectId } = req.params;
  const { sources } = req.body ?? {};
  if (!Array.isArray(sources) || !sources.length) {
    return res.status(400).json({ error: 'sources is required' });
  }

  try {
    const { rows: projectRows } = await pool.query(
      `SELECT id, unique_id, sub_sectors FROM public.projects WHERE id = $1`, [projectId]
    );
    if (!projectRows.length) return res.status(404).json({ error: 'Project not found' });
    const project = projectRows[0];

    const briefingText = await resolveBriefingSourceTexts(sources, project.unique_id);
    if (!briefingText?.trim()) {
      return res.status(400).json({ error: 'No content found for the selected sources' });
    }

    const [{ rows: issues }, { rows: policyRows }, { rows: allPolicies }, { rows: allIssueTypes }, customPrompt] = await Promise.all([
      pool.query(
        `SELECT id, label, discipline FROM admin_console.drafting_issues WHERE project_id = $1 ORDER BY sort_order, id`,
        [projectId]
      ),
      pool.query(
        `SELECT dipr.drafting_issue_id, pp.policy_reference, pp.policy_name, pp.policy_text, pp.is_key_policy
         FROM admin_console.drafting_issue_policy_relevance dipr
         JOIN public.project_policies pp ON pp.id = dipr.policy_id
         JOIN admin_console.drafting_issues di ON di.id = dipr.drafting_issue_id
         WHERE di.project_id = $1`,
        [projectId]
      ),
      pool.query(
        `SELECT id, policy_reference, policy_name, policy_type FROM public.project_policies WHERE project_id = $1 ORDER BY policy_type, policy_reference`,
        [projectId]
      ),
      pool.query(`SELECT id, label, development_type FROM admin_console.issue_types ORDER BY label`),
      loadCustomActionPrompt('draft_issues_from_briefing'),
    ]);

    const policiesByIssue = {};
    for (const r of policyRows) {
      if (!policiesByIssue[r.drafting_issue_id]) policiesByIssue[r.drafting_issue_id] = [];
      policiesByIssue[r.drafting_issue_id].push(r);
    }

    const results = await draftIssuesFromBriefingNote({
      briefingText,
      issues,
      policiesByIssue,
      allPolicies,
      subSectors: project.sub_sectors ?? [],
      allIssueTypes,
      customPrompt,
    });

    const client = await pool.connect();
    let applied = 0;
    try {
      await client.query('BEGIN');

      const { rows: maxRow } = await client.query(
        `SELECT COALESCE(MAX(sort_order), -1) AS max FROM admin_console.drafting_issues WHERE project_id = $1`,
        [projectId]
      );
      let nextOrder = maxRow[0].max + 1;

      for (const r of results) {
        let draftingIssueId;

        if (r.new_issue) {
          if (!r.suggested_label?.trim()) continue;
          const { rows: inserted } = await client.query(
            `INSERT INTO admin_console.drafting_issues (project_id, label, discipline, argument_for, sort_order)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [projectId, r.suggested_label.trim(), r.suggested_discipline?.trim() || null, r.argument_for ?? null, nextOrder++]
          );
          draftingIssueId = inserted[0].id;
        } else {
          if (!r.drafting_issue_id) continue;
          const { rows: updated } = await client.query(
            `UPDATE admin_console.drafting_issues SET argument_for = $1 WHERE id = $2 AND project_id = $3 RETURNING id`,
            [r.argument_for ?? null, r.drafting_issue_id, projectId]
          );
          if (!updated.length) continue;
          draftingIssueId = updated[0].id;
        }

        for (const issueTypeId of (r.matched_issue_type_ids ?? [])) {
          await client.query(
            `INSERT INTO admin_console.drafting_issue_snippet_relevance (drafting_issue_id, issue_type_id)
             VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [draftingIssueId, issueTypeId]
          );
        }
        // Additive only — never removes an existing link, only adds newly
        // discussed ones on top of whatever's already there.
        for (const policyId of (r.matched_policy_ids ?? [])) {
          await client.query(
            `INSERT INTO admin_console.drafting_issue_policy_relevance (drafting_issue_id, policy_id)
             VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [draftingIssueId, policyId]
          );
        }
        applied++;
      }

      await client.query('COMMIT');
      res.json({ applied });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('draftingIssues.draftFromBriefing error:', err);
    res.status(500).json({ error: 'Failed to draft issues from briefing' });
  }
}
