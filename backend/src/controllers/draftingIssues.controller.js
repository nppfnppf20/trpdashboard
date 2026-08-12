/**
 * Drafting Issues controller.
 * A project-scoped issue list for AI document generation, independent of
 * admin_console.project_issue_tracks (the workflow/Stages-board "key issues").
 * Built manually or via "Draft from Briefing Note" — no longer seeded from
 * key issues.
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
              di.specialist_report,
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
                 argument_for, argument_against, summary, specialist_report,
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
    label, discipline, issue_type_id, argument_for, argument_against, summary, specialist_report,
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
           policy_other          = CASE WHEN $11::text IS NOT NULL THEN $11 ELSE policy_other END,
           specialist_report     = CASE WHEN $13::text IS NOT NULL THEN $13 ELSE specialist_report END
       WHERE id = $12
       RETURNING id, project_id, label, discipline, issue_type_id, source_track_id,
                 argument_for, argument_against, summary, specialist_report,
                 policy_national, policy_local, policy_neighbourhood, policy_supplementary, policy_other,
                 sort_order`,
      [label?.trim() || null, discipline?.trim() ?? null, issue_type_id ?? null,
       argument_for ?? null, argument_against ?? null, summary ?? null,
       policy_national ?? null, policy_local ?? null, policy_neighbourhood ?? null,
       policy_supplementary ?? null, policy_other ?? null, id, specialist_report ?? null]
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

const SNIPPET_FIELDS = new Set(['nppf_text', 'nppg_text', 'other_national_text', 'other_guidance_text']);

export async function getDraftingIssueSnippetRelevance(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT disr.drafting_issue_id, disr.issue_type_id, disr.field
       FROM admin_console.drafting_issue_snippet_relevance disr
       JOIN admin_console.drafting_issues di ON di.id = disr.drafting_issue_id
       WHERE di.project_id = $1`,
      [projectId]
    );
    // Return as { [drafting_issue_id]: [{issue_type_id, field}, ...] }
    const map = {};
    for (const row of rows) {
      if (!map[row.drafting_issue_id]) map[row.drafting_issue_id] = [];
      map[row.drafting_issue_id].push({ issue_type_id: row.issue_type_id, field: row.field });
    }
    res.json(map);
  } catch (err) {
    console.error('draftingIssues.getSnippetRelevance error:', err);
    res.status(500).json({ error: 'Failed to fetch snippet relevance' });
  }
}

export async function toggleDraftingIssueSnippet(req, res) {
  const { draftingIssueId, issueTypeId, field } = req.params;
  if (!SNIPPET_FIELDS.has(field)) return res.status(400).json({ error: 'Invalid field' });
  try {
    const { rows: existing } = await pool.query(
      `SELECT 1 FROM admin_console.drafting_issue_snippet_relevance WHERE drafting_issue_id = $1 AND issue_type_id = $2 AND field = $3`,
      [draftingIssueId, issueTypeId, field]
    );
    if (existing.length) {
      await pool.query(
        `DELETE FROM admin_console.drafting_issue_snippet_relevance WHERE drafting_issue_id = $1 AND issue_type_id = $2 AND field = $3`,
        [draftingIssueId, issueTypeId, field]
      );
      res.json({ linked: false });
    } else {
      await pool.query(
        `INSERT INTO admin_console.drafting_issue_snippet_relevance (drafting_issue_id, issue_type_id, field) VALUES ($1, $2, $3)`,
        [draftingIssueId, issueTypeId, field]
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
  const { sources, allowNewIssues = true, issueScope = {} } = req.body ?? {};
  if (!Array.isArray(sources) || !sources.length) {
    return res.status(400).json({ error: 'sources is required' });
  }
  // issueScope is a per-issue permission map the "Draft from Briefing Note"
  // picker sends: { [issueId]: { argumentNotes: bool, specialistReport: bool } }.
  // An issue absent from the map (e.g. request predates the picker) defaults
  // to both fields allowed, so existing callers keep the old behaviour.
  const scopeFor = (id) => issueScope[id] ?? { argumentNotes: true, specialistReport: true };

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
      pool.query(`SELECT id, label, development_type, nppf_text, nppg_text, other_national_text, other_guidance_text FROM admin_console.issue_types ORDER BY label`),
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
      provider: req.body.provider ?? null,
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
          if (!allowNewIssues) continue;
          if (!r.suggested_label?.trim()) continue;
          const { rows: inserted } = await client.query(
            `INSERT INTO admin_console.drafting_issues (project_id, label, discipline, argument_for, specialist_report, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [projectId, r.suggested_label.trim(), r.suggested_discipline?.trim() || null, r.argument_for ?? null, r.specialist_report ?? null, nextOrder++]
          );
          draftingIssueId = inserted[0].id;
        } else {
          if (!r.drafting_issue_id) continue;
          const scope = scopeFor(r.drafting_issue_id);
          if (!scope.argumentNotes && !scope.specialistReport) continue; // issue excluded from this run entirely

          // Only the fields the picker allowed for this issue are included in
          // the SET clause — an unchecked field is left completely alone.
          // specialist_report, when allowed, only overwrites if the model
          // actually returned something for it this pass — unlike
          // argument_for, not every briefing touches on specialist report
          // findings for an issue, and we don't want to blank out an
          // existing entry just because this pass didn't.
          const setParts = [];
          const params = [];
          if (scope.argumentNotes) {
            params.push(r.argument_for ?? null);
            setParts.push(`argument_for = $${params.length}`);
          }
          if (scope.specialistReport) {
            params.push(r.specialist_report ?? null);
            setParts.push(`specialist_report = CASE WHEN $${params.length}::text IS NOT NULL THEN $${params.length} ELSE specialist_report END`);
          }
          params.push(r.drafting_issue_id, projectId);
          const { rows: updated } = await client.query(
            `UPDATE admin_console.drafting_issues
             SET ${setParts.join(', ')}
             WHERE id = $${params.length - 1} AND project_id = $${params.length} RETURNING id`,
            params
          );
          if (!updated.length) continue;
          draftingIssueId = updated[0].id;
        }

        for (const m of (r.matched_snippet_fields ?? [])) {
          if (!SNIPPET_FIELDS.has(m.field)) continue;
          await client.query(
            `INSERT INTO admin_console.drafting_issue_snippet_relevance (drafting_issue_id, issue_type_id, field)
             VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
            [draftingIssueId, m.issue_type_id, m.field]
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
