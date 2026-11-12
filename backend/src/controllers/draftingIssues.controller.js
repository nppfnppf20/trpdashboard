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
import { draftIssuesFromBriefingNote, draftIssuesFromTrackerLog, consolidateIssueNotes, findMissedPoints } from '../services/planningStatement.service.js';
import { summariseSpecialistReportForIssue } from '../services/appeal.service.js';
import { parseFile } from '../services/parser.service.js';

async function loadCustomActionPrompt(key) {
  const { rows } = await pool.query(
    `SELECT prompt_text FROM admin_console.llm_prompts WHERE prompt_key = $1`, [key]
  );
  return rows[0]?.prompt_text ?? null;
}

// Shared by "Draft from Briefing Note" and "Draft from Tracker" — both feed
// the same drafting-issue-matching prompt shape, just from different source
// text, so they need the same existing-issues/policy-library context.
async function fetchIssueDraftingContext(projectId) {
  const [{ rows: issues }, { rows: policyRows }, { rows: allPolicies }] = await Promise.all([
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
  ]);

  const policiesByIssue = {};
  for (const r of policyRows) {
    if (!policiesByIssue[r.drafting_issue_id]) policiesByIssue[r.drafting_issue_id] = [];
    policiesByIssue[r.drafting_issue_id].push(r);
  }

  return { issues, policiesByIssue, allPolicies };
}

const fmtNoteDate = (d) => {
  const dt = d ? new Date(d) : null;
  return dt && !isNaN(dt) ? dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
};

// One dated section of notes: a "[date · title]" header line, then the bullets.
// Sections are recognised elsewhere by that bracketed header line.
function noteBlock(text, { label, date } = {}) {
  const header = [fmtNoteDate(date), label].filter(Boolean).join(' · ');
  return header ? `[${header}]\n${text}` : text;
}

// Shared apply step for both drafting sources: creates/updates drafting
// issues from the LLM's results and additively links any matched policies.
// Never removes an existing policy link, only adds newly discussed ones.
//
// Drafted notes are APPENDED to the issue's notes (argument_for) under a dated
// header, e.g. "[12 Nov 2026 · Kick-off meeting]", so successive meetings stack
// in the one Notes field and a later run never overwrites earlier content. The
// user merges them with Consolidate. A raw copy of each run is also kept in
// admin_console.drafting_issue_note_log as a record.
// logSource: { label, date } describing where this run's text came from.
async function applyDraftedIssueResults(projectId, results, { allowNewIssues = true, issueScope = {}, logSource = {} } = {}) {
  const scopeFor = (id) => issueScope[id] ?? { argumentNotes: true, specialistReport: true, policyLinks: true };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: maxRow } = await client.query(
      `SELECT COALESCE(MAX(sort_order), -1) AS max FROM admin_console.drafting_issues WHERE project_id = $1`,
      [projectId]
    );
    let nextOrder = maxRow[0].max + 1;

    let applied = 0;
    for (const r of results) {
      let draftingIssueId;
      let linkPolicies = true; // new issues always get their matched policies linked — allowNewIssues already gates whether they're created at all
      let logText = null; // drafted notes (without the dated header) to keep as a record

      if (r.new_issue) {
        if (!allowNewIssues) continue;
        if (!r.suggested_label?.trim()) continue;
        const { rows: inserted } = await client.query(
          `INSERT INTO admin_console.drafting_issues (project_id, label, discipline, argument_for, specialist_report, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [projectId, r.suggested_label.trim(), r.suggested_discipline?.trim() || null,
           r.argument_for?.trim() ? noteBlock(r.argument_for.trim(), logSource) : null, r.specialist_report ?? null, nextOrder++]
        );
        draftingIssueId = inserted[0].id;
        if (r.argument_for?.trim()) logText = r.argument_for.trim();
      } else {
        if (!r.drafting_issue_id) continue;
        const scope = scopeFor(r.drafting_issue_id);
        if (!scope.argumentNotes && !scope.specialistReport && !scope.policyLinks) continue; // issue excluded from this run entirely
        linkPolicies = scope.policyLinks;

        // Only the fields the picker allowed for this issue are included in
        // the SET clause — an unchecked field is left completely alone.
        // specialist_report, when allowed, only overwrites if the model
        // actually returned something for it this pass — not every source
        // touches on specialist report findings for an issue, and we don't
        // want to blank out an existing entry just because this pass didn't.
        const setParts = [];
        const params = [];
        if (scope.argumentNotes && r.argument_for?.trim()) {
          logText = r.argument_for.trim();
          // Appended below whatever is already there, under its own dated header
          params.push(noteBlock(logText, logSource));
          setParts.push(`argument_for = CASE WHEN COALESCE(argument_for, '') = '' THEN $${params.length} ELSE argument_for || E'\\n\\n' || $${params.length} END`);
        }
        if (scope.specialistReport) {
          params.push(r.specialist_report ?? null);
          setParts.push(`specialist_report = CASE WHEN $${params.length}::text IS NOT NULL THEN $${params.length} ELSE specialist_report END`);
        }

        if (setParts.length) {
          params.push(r.drafting_issue_id, projectId);
          const { rows: updated } = await client.query(
            `UPDATE admin_console.drafting_issues
             SET ${setParts.join(', ')}
             WHERE id = $${params.length - 1} AND project_id = $${params.length} RETURNING id`,
            params
          );
          if (!updated.length) continue;
          draftingIssueId = updated[0].id;
        } else {
          // Only policy links were requested for this issue — nothing to
          // write to the issue row itself, just confirm it's really in this
          // project before linking policies to it.
          const { rows: existing } = await client.query(
            `SELECT id FROM admin_console.drafting_issues WHERE id = $1 AND project_id = $2`,
            [r.drafting_issue_id, projectId]
          );
          if (!existing.length) continue;
          draftingIssueId = existing[0].id;
        }
      }

      if (logText && draftingIssueId) {
        await client.query(
          `INSERT INTO admin_console.drafting_issue_note_log
             (drafting_issue_id, kind, source_label, source_date, note_text, consolidated_at)
           VALUES ($1, 'draft', $2, $3, $4, now())`,
          [draftingIssueId, logSource.label ?? null, logSource.date ?? null, logText]
        );
      }

      // Additive only — never removes an existing link, only adds newly
      // discussed ones on top of whatever's already there.
      if (linkPolicies) {
        for (const policyId of (r.matched_policy_ids ?? [])) {
          await client.query(
            `INSERT INTO admin_console.drafting_issue_policy_relevance (drafting_issue_id, policy_id)
             VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [draftingIssueId, policyId]
          );
        }
      }
      applied++;
    }

    await client.query('COMMIT');
    return { applied };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Human-readable label + date for a draft run's sources, stored on each notes
// log entry. Date is the latest meeting date among the ticked meetings.
async function describeBriefingSources(sources, projectUniqueId, hasPastedText) {
  const labels = [];
  let latest = null;
  for (const src of sources) {
    if (src.type === 'meeting_note') {
      const { rows } = await pool.query(
        `SELECT mt.title, mt.meeting_date
         FROM planning_applications.meeting_transcripts mt
         JOIN public.projects p ON p.id = mt.project_id
         WHERE mt.id = $1 AND p.unique_id = $2`,
        [src.id, projectUniqueId]
      );
      if (!rows[0]) continue;
      labels.push(rows[0].title || 'Untitled meeting');
      if (rows[0].meeting_date && (!latest || rows[0].meeting_date > latest)) latest = rows[0].meeting_date;
    } else {
      const { rows } = await pool.query(
        `SELECT ds.title FROM planning_applications.document_summaries ds
         JOIN public.projects p ON p.id = ds.project_id
         WHERE ds.id = $1 AND p.unique_id = $2`,
        [src.id, projectUniqueId]
      );
      if (rows[0]) labels.push(rows[0].title || 'Untitled briefing note');
    }
  }
  if (hasPastedText) labels.push('Pasted text');
  return { label: labels.join('; ') || 'Draft from document', date: latest };
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
// Plan (document) relevance — mirrors drafting_issue_policy_relevance above,
// but for policy_documents rows that have no discrete policies of their own
// (typically Supplementary Guidance / Other Material Considerations, where
// the project-specific relevance is written directly onto the plan's own
// "relevance" field rather than broken into policies — see
// generatePlanRelevanceSummary in lpaAnalysis.service.js).
// ─────────────────────────────────────────────────────────────────────────────

export async function getDraftingIssuePlanRelevance(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT dipr.drafting_issue_id, dipr.plan_id
       FROM admin_console.drafting_issue_plan_relevance dipr
       JOIN admin_console.drafting_issues di ON di.id = dipr.drafting_issue_id
       WHERE di.project_id = $1`,
      [projectId]
    );
    // Return as { [drafting_issue_id]: [plan_id, ...] }
    const map = {};
    for (const row of rows) {
      if (!map[row.drafting_issue_id]) map[row.drafting_issue_id] = [];
      map[row.drafting_issue_id].push(row.plan_id);
    }
    res.json(map);
  } catch (err) {
    console.error('draftingIssues.getPlanRelevance error:', err);
    res.status(500).json({ error: 'Failed to fetch plan relevance' });
  }
}

export async function toggleDraftingIssuePlan(req, res) {
  const { draftingIssueId, planId } = req.params;
  try {
    const { rows: existing } = await pool.query(
      `SELECT 1 FROM admin_console.drafting_issue_plan_relevance WHERE drafting_issue_id = $1 AND plan_id = $2`,
      [draftingIssueId, planId]
    );
    if (existing.length) {
      await pool.query(
        `DELETE FROM admin_console.drafting_issue_plan_relevance WHERE drafting_issue_id = $1 AND plan_id = $2`,
        [draftingIssueId, planId]
      );
      res.json({ linked: false });
    } else {
      await pool.query(
        `INSERT INTO admin_console.drafting_issue_plan_relevance (drafting_issue_id, plan_id) VALUES ($1, $2)`,
        [draftingIssueId, planId]
      );
      res.json({ linked: true });
    }
  } catch (err) {
    console.error('draftingIssues.togglePlan error:', err);
    res.status(500).json({ error: 'Failed to toggle plan relevance' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Draft from Briefing Note
// ─────────────────────────────────────────────────────────────────────────────

export async function draftIssuesFromBriefing(req, res) {
  const { projectId } = req.params;
  const { allowNewIssues = true, issueScope = {} } = req.body ?? {};
  const sources = Array.isArray(req.body?.sources) ? req.body.sources : [];
  const pastedText = typeof req.body?.pastedText === 'string' ? req.body.pastedText.trim() : '';
  if (!sources.length && !pastedText) {
    return res.status(400).json({ error: 'Select at least one source or paste some text' });
  }

  try {
    const { rows: projectRows } = await pool.query(
      `SELECT id, unique_id, sub_sectors FROM public.projects WHERE id = $1`, [projectId]
    );
    if (!projectRows.length) return res.status(404).json({ error: 'Project not found' });
    const project = projectRows[0];

    const sourceText = sources.length ? await resolveBriefingSourceTexts(sources, project.unique_id) : '';
    const briefingText = [sourceText, pastedText ? `## Pasted text\n${pastedText}` : '']
      .filter(t => t?.trim())
      .join('\n\n---\n\n');
    if (!briefingText.trim()) {
      return res.status(400).json({ error: 'No content found for the selected sources' });
    }

    const [{ issues, policiesByIssue, allPolicies }, customPrompt] = await Promise.all([
      fetchIssueDraftingContext(projectId),
      loadCustomActionPrompt('draft_issues_from_briefing'),
    ]);

    const results = await draftIssuesFromBriefingNote({
      briefingText,
      issues,
      policiesByIssue,
      allPolicies,
      subSectors: project.sub_sectors ?? [],
      customPrompt,
      provider: req.body.provider ?? null,
    });

    const logSource = await describeBriefingSources(sources, project.unique_id, !!pastedText);
    const { applied } = await applyDraftedIssueResults(projectId, results, { allowNewIssues, issueScope, logSource });
    // Second pass: anything the source says that the notes did not capture, for review
    const missed = await findMissedPoints({ sourceText: briefingText, results, issues, provider: req.body.provider ?? null });
    res.json({ applied, missed });
  } catch (err) {
    console.error('draftingIssues.draftFromBriefing error:', err);
    res.status(500).json({ error: err.message || 'Failed to draft issues from briefing' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Draft from Project Tracker (planning_applications.progress_issues) — same
// job as Draft from Briefing Note, sourced from the tracker's own issues and
// their dated action log instead of a pasted transcript. No specialist
// report handling: the tracker isn't the right source for that.
// ─────────────────────────────────────────────────────────────────────────────

export async function draftIssuesFromTracker(req, res) {
  const { projectId } = req.params;
  const { allowNewIssues = true, issueScope = {} } = req.body ?? {};

  try {
    const { rows: projectRows } = await pool.query(
      `SELECT id, sub_sectors FROM public.projects WHERE id = $1`, [projectId]
    );
    if (!projectRows.length) return res.status(404).json({ error: 'Project not found' });
    const project = projectRows[0];

    const { rows: trackerIssues } = await pool.query(
      `SELECT id, discipline, title, status FROM planning_applications.progress_issues
       WHERE project_id = $1 ORDER BY sort_order, id`,
      [projectId]
    );
    if (!trackerIssues.length) {
      return res.status(400).json({ error: 'The Project Tracker has no issues logged yet' });
    }

    const { rows: actions } = await pool.query(
      `SELECT a.issue_id, a.action_date, a.summary, a.full_text, a.source_type
       FROM planning_applications.progress_actions a
       JOIN planning_applications.progress_issues i ON i.id = a.issue_id
       WHERE i.project_id = $1
       ORDER BY a.action_date ASC, a.id ASC`,
      [projectId]
    );
    const actionsByIssue = {};
    for (const a of actions) {
      (actionsByIssue[a.issue_id] ||= []).push(a);
    }

    const trackerText = trackerIssues.map(i => {
      const header = `Issue: ${i.title}${i.discipline ? ` (${i.discipline})` : ''} [Status: ${i.status}]`;
      const issueActions = actionsByIssue[i.id] ?? [];
      const actionLines = issueActions.length
        ? issueActions.map(a => `  - ${a.action_date} (${a.source_type}): ${(a.full_text || a.summary || '').trim()}`).join('\n')
        : '  (no actions logged)';
      return `${header}\n${actionLines}`;
    }).join('\n\n');

    const [{ issues, policiesByIssue, allPolicies }, customPrompt] = await Promise.all([
      fetchIssueDraftingContext(projectId),
      loadCustomActionPrompt('draft_issues_from_tracker'),
    ]);

    const results = await draftIssuesFromTrackerLog({
      trackerText,
      issues,
      policiesByIssue,
      allPolicies,
      subSectors: project.sub_sectors ?? [],
      customPrompt,
      provider: req.body.provider ?? null,
    });

    const { applied } = await applyDraftedIssueResults(projectId, results, {
      allowNewIssues, issueScope, logSource: { label: 'Project Tracker', date: null },
    });
    const missed = await findMissedPoints({ sourceText: trackerText, results, issues, provider: req.body.provider ?? null });
    res.json({ applied, missed });
  } catch (err) {
    console.error('draftingIssues.draftFromTracker error:', err);
    res.status(500).json({ error: err.message || 'Failed to draft issues from tracker' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Notes log — history of drafted notes per issue, and consolidation into the
// issue's current notes (argument_for). The log is never sent to a generation
// prompt; only the current notes are.
// ─────────────────────────────────────────────────────────────────────────────

// Per-issue entry counts for the project, so the tab can badge each card
// without loading every entry. Only 'draft' entries count.
export async function getNotesLogSummary(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT l.drafting_issue_id,
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE l.consolidated_at IS NULL)::int AS pending
       FROM admin_console.drafting_issue_note_log l
       JOIN admin_console.drafting_issues di ON di.id = l.drafting_issue_id
       WHERE di.project_id = $1 AND l.kind = 'draft'
       GROUP BY l.drafting_issue_id`,
      [projectId]
    );
    res.json(Object.fromEntries(rows.map(r => [r.drafting_issue_id, { total: r.total, pending: r.pending }])));
  } catch (err) {
    console.error('draftingIssues.notesLogSummary error:', err);
    res.status(500).json({ error: 'Failed to fetch notes log summary' });
  }
}

export async function listNotesLog(req, res) {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT id, kind, source_label, source_date, note_text, created_at, consolidated_at
       FROM admin_console.drafting_issue_note_log
       WHERE drafting_issue_id = $1
       ORDER BY COALESCE(source_date, created_at::date) DESC, created_at DESC, id DESC`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    console.error('draftingIssues.listNotesLog error:', err);
    res.status(500).json({ error: 'Failed to fetch notes log' });
  }
}

// Proposes merged notes from the issue's dated sections. Saves nothing: the user reviews
// (and can edit) the proposal, then applyConsolidatedNotes writes it.
export async function consolidateNotesLog(req, res) {
  const { id } = req.params;
  try {
    const { rows: issueRows } = await pool.query(
      `SELECT id, label, discipline, argument_for FROM admin_console.drafting_issues WHERE id = $1`, [id]
    );
    if (!issueRows.length) return res.status(404).json({ error: 'Drafting issue not found' });
    const issue = issueRows[0];

    // The Notes text itself holds the dated sections (oldest first, as added),
    // including any hand edits, so that is all the model is given.
    const notes = issue.argument_for?.trim();
    if (!notes) return res.status(400).json({ error: 'There are no notes to consolidate' });

    const result = await consolidateIssueNotes({
      issueLabel: issue.label,
      discipline: issue.discipline,
      currentNotes: notes,
      provider: req.body?.provider ?? null,
    });

    // Head the merged notes with the latest section it covers, in the same
    // bracketed format, so it still reads as a dated section.
    const headers = [...notes.matchAll(/^\[(.+)\]\s*$/gm)].map(m => m[1]);
    const latest = headers[headers.length - 1];
    if (latest) result.notes = `[Consolidated up to ${latest}]\n${result.notes}`;
    res.json(result);
  } catch (err) {
    console.error('draftingIssues.consolidateNotesLog error:', err);
    res.status(500).json({ error: 'Failed to consolidate notes' });
  }
}

// Writes the reviewed notes as the issue's current notes. The notes being
// replaced are kept as a 'snapshot' log entry, and every draft entry is marked
// as folded in.
export async function applyConsolidatedNotes(req, res) {
  const { id } = req.params;
  const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : '';
  if (!notes) return res.status(400).json({ error: 'notes is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: cur } = await client.query(
      `SELECT argument_for FROM admin_console.drafting_issues WHERE id = $1 FOR UPDATE`, [id]
    );
    if (!cur.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Drafting issue not found' });
    }
    const previous = cur[0].argument_for?.trim();
    if (previous && previous !== notes) {
      await client.query(
        `INSERT INTO admin_console.drafting_issue_note_log (drafting_issue_id, kind, source_label, note_text, consolidated_at)
         VALUES ($1, 'snapshot', 'Notes before consolidation', $2, now())`,
        [id, previous]
      );
    }
    const { rows } = await client.query(
      `UPDATE admin_console.drafting_issues SET argument_for = $1 WHERE id = $2
       RETURNING id, project_id, label, discipline, issue_type_id, source_track_id,
                 argument_for, argument_against, summary, specialist_report,
                 policy_national, policy_local, policy_neighbourhood, policy_supplementary, policy_other,
                 sort_order`,
      [notes, id]
    );
    await client.query(
      `UPDATE admin_console.drafting_issue_note_log SET consolidated_at = now()
       WHERE drafting_issue_id = $1 AND kind = 'draft' AND consolidated_at IS NULL`,
      [id]
    );
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('draftingIssues.applyConsolidatedNotes error:', err);
    res.status(500).json({ error: 'Failed to save consolidated notes' });
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Specialist report → working note (drag-and-drop / paste on the Specialist
// Report field). Generates only — the frontend appends the returned text to
// whatever is already in the field and saves it via the normal PUT /:id.
// ─────────────────────────────────────────────────────────────────────────────

export async function summarizeSpecialistReport(req, res) {
  const { id } = req.params;
  const { text: pastedText, provider } = req.body ?? {};

  if (!req.file && !pastedText?.trim()) {
    return res.status(400).json({ error: 'file or text is required' });
  }

  try {
    let reportText, filename;
    if (req.file) {
      const parsed = await parseFile(req.file.buffer, req.file.originalname);
      reportText = parsed.text;
      filename = req.file.originalname;
    } else {
      reportText = pastedText;
      filename = req.body.file_name || null;
    }
    if (!reportText?.trim()) {
      return res.status(400).json({ error: 'No text could be extracted from the report' });
    }

    const [{ rows: issueRows }, { rows: policyRows }] = await Promise.all([
      pool.query(`SELECT label, discipline, argument_for FROM admin_console.drafting_issues WHERE id = $1`, [id]),
      pool.query(
        `SELECT pp.policy_reference, pp.policy_name, pp.policy_text, pp.relevant_supporting_text, pp.is_key_policy, pd.plan_name
         FROM public.project_policies pp
         JOIN admin_console.drafting_issue_policy_relevance dipr ON dipr.policy_id = pp.id
         LEFT JOIN public.policy_documents pd ON pd.id = pp.plan_id
         WHERE dipr.drafting_issue_id = $1
         ORDER BY pp.policy_type, pp.policy_reference`,
        [id]
      ),
    ]);
    if (!issueRows.length) return res.status(404).json({ error: 'Drafting issue not found' });

    const note = await summariseSpecialistReportForIssue({
      reportText,
      filename,
      issueLabel: issueRows[0].label,
      issueDiscipline: issueRows[0].discipline,
      argumentFor: issueRows[0].argument_for,
      linkedPolicies: policyRows,
      customPrompt: await loadCustomActionPrompt('summarise_specialist_report'),
      provider: provider || null,
    });

    res.json({ note });
  } catch (err) {
    console.error('draftingIssues.summarizeSpecialistReport error:', err);
    res.status(500).json({ error: 'Failed to summarise specialist report' });
  }
}
