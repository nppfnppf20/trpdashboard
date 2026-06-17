/**
 * Workflow Service
 * Business logic for the project stages board and notification centre
 */

import { pool } from '../db.js';

// Risk level ordering for seeding (higher = more severe)
const RISK_ORDER = [
  'showstopper',
  'extremely_high_risk',
  'high_risk',
  'medium_high_risk',
  'medium_risk',
  'medium_low_risk',
  'low_risk'
];

function riskSortValue(level) {
  const idx = RISK_ORDER.indexOf(level);
  return idx === -1 ? 999 : idx;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage Board
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch the full stage board for a project.
 * Returns stage definitions, their per-project instances, issue tracks,
 * and all stage entries.
 */
export async function getProjectStageBoard(projectId) {
  const client = await pool.connect();
  try {
    // Stage instances (with definition info — LEFT JOIN to include custom stages)
    const stagesResult = await client.query(
      `SELECT
        psi.id            AS instance_id,
        psi.project_id,
        psi.is_applicable,
        psi.is_complete,
        psi.target_date,
        psi.completed_at,
        psi.completed_by,
        psd.id            AS stage_definition_id,
        COALESCE(psd.name, psi.custom_name)                                                   AS stage_name,
        COALESCE(psi.project_display_order, psd.display_order, psi.custom_display_order)     AS display_order
      FROM admin_console.project_stage_instances psi
      LEFT JOIN admin_console.project_stage_definitions psd
        ON psd.id = psi.stage_definition_id
      WHERE psi.project_id = $1
      ORDER BY COALESCE(psi.project_display_order, psd.display_order, psi.custom_display_order)`,
      [projectId]
    );

    // Issue tracks for this project
    const tracksResult = await client.query(
      `SELECT
        id,
        project_id,
        track_type,
        source_key,
        discipline,
        label,
        sort_order,
        is_key_issue,
        is_active,
        created_from_hlpv,
        last_known_risk_level
      FROM admin_console.project_issue_tracks
      WHERE project_id = $1 AND is_active = TRUE
      ORDER BY sort_order, id`,
      [projectId]
    );

    // Key issues for this project
    const keyIssuesResult = await client.query(
      `SELECT
        id,
        project_id,
        label,
        discipline_group,
        sort_order,
        is_active,
        last_known_risk_level
      FROM admin_console.project_key_issues
      WHERE project_id = $1 AND is_active = TRUE
      ORDER BY sort_order, id`,
      [projectId]
    );

    // All stage entries for this project's stages (both track and key issue entries)
    const entriesResult = await client.query(
      `SELECT
        pise.id,
        pise.project_stage_instance_id,
        pise.issue_track_id,
        pise.key_issue_id,
        pise.risk_level,
        pise.summary,
        pise.notes,
        pise.updated_by,
        pise.updated_at
      FROM admin_console.project_issue_stage_entries pise
      JOIN admin_console.project_stage_instances psi
        ON psi.id = pise.project_stage_instance_id
      WHERE psi.project_id = $1`,
      [projectId]
    );

    return {
      stages: stagesResult.rows,
      tracks: tracksResult.rows,
      keyIssues: keyIssuesResult.rows,
      entries: entriesResult.rows
    };
  } finally {
    client.release();
  }
}

/**
 * Initialize the stage board for a project.
 * Seeds appeal-specific stages for appeal projects, standard stages for all others.
 * Seeds issue tracks from HLPV for non-appeal projects only.
 * Safe to call if already partially initialized (idempotent).
 */
export async function initializeProjectStageBoard(projectId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Resolve project type to determine which stage definitions to seed
    const projectRow = await client.query(
      `SELECT project_type FROM public.projects WHERE id = $1`,
      [projectId]
    );
    const projectType = projectRow.rows[0]?.project_type || null;
    const isAppeal = projectType === 'Appeal';

    // 1. Create stage instances for matching stage definitions only
    await client.query(
      `INSERT INTO admin_console.project_stage_instances
         (project_id, stage_definition_id, is_applicable, is_complete)
       SELECT $1, id, TRUE, FALSE
       FROM admin_console.project_stage_definitions
       WHERE is_active = TRUE
         AND (
           ($2 AND project_type_filter = 'appeal')
           OR
           (NOT $2 AND project_type_filter IS NULL)
         )
       ON CONFLICT (project_id, stage_definition_id) WHERE stage_definition_id IS NOT NULL DO NOTHING`,
      [projectId, isAppeal]
    );

    // 2. For non-appeal projects only: seed issue tracks from HLPV
    if (!isAppeal) {
      const existingTracks = await client.query(
        'SELECT id FROM admin_console.project_issue_tracks WHERE project_id = $1 LIMIT 1',
        [projectId]
      );

      if (existingTracks.rows.length === 0) {
        // Fetch HLPV discipline summaries from the most recent analysis session.
        // Prefer edited risk levels where available.
        const hlpvResult = await client.query(
          `SELECT
            ads.discipline,
            COALESCE(ae.edited_overall_risk, ads.overall_risk) AS risk_level
          FROM public.analysis_discipline_summary ads
          JOIN public.analysis_sessions asess ON asess.id = ads.session_id
          LEFT JOIN public.analysis_edits ae
            ON ae.session_id = ads.session_id AND ae.discipline = ads.discipline
          WHERE asess.project_id = $1
            AND ads.overall_risk IS NOT NULL
          ORDER BY asess.created_at DESC`,
          [projectId]
        );

        // Deduplicate to the latest session per discipline
        const seenDisciplines = new Set();
        const disciplines = [];
        for (const row of hlpvResult.rows) {
          if (!seenDisciplines.has(row.discipline)) {
            seenDisciplines.add(row.discipline);
            disciplines.push(row);
          }
        }

        // Sort by risk severity (highest first)
        disciplines.sort((a, b) => riskSortValue(a.risk_level) - riskSortValue(b.risk_level));

        // Seed issue tracks
        for (let i = 0; i < disciplines.length; i++) {
          const { discipline, risk_level } = disciplines[i];
          const label = disciplineLabel(discipline);
          await client.query(
            `INSERT INTO admin_console.project_issue_tracks
               (project_id, track_type, source_key, label, sort_order,
                is_key_issue, is_active, created_from_hlpv, last_known_risk_level)
             VALUES ($1, 'discipline', $2, $3, $4, FALSE, TRUE, TRUE, $5)
             ON CONFLICT DO NOTHING`,
            [projectId, discipline, label, i, risk_level]
          );
        }

        // No HLPV data — seed default discipline rows so the board isn't empty
        if (disciplines.length === 0) {
          const defaults = ['heritage', 'landscape', 'ecology'];
          for (let i = 0; i < defaults.length; i++) {
            const discipline = defaults[i];
            const label = disciplineLabel(discipline);
            await client.query(
              `INSERT INTO admin_console.project_issue_tracks
                 (project_id, track_type, source_key, label, sort_order,
                  is_key_issue, is_active, created_from_hlpv, last_known_risk_level)
               VALUES ($1, 'discipline', $2, $3, $4, FALSE, TRUE, FALSE, NULL)
               ON CONFLICT DO NOTHING`,
              [projectId, discipline, label, i]
            );
          }
        }
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Mark a stage as complete and save the issue row entries for that stage.
 * Entries is an array of: { issueTrackId, riskLevel, summary, notes, isKeyIssue }
 */
export async function completeProjectStage(projectId, stageInstanceId, entries, completedBy) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify the stage instance belongs to this project
    const check = await client.query(
      `SELECT id FROM admin_console.project_stage_instances
       WHERE id = $1 AND project_id = $2`,
      [stageInstanceId, projectId]
    );
    if (check.rows.length === 0) {
      throw new Error('Stage instance not found for this project');
    }

    // Upsert each issue entry
    for (const entry of entries) {
      await client.query(
        `INSERT INTO admin_console.project_issue_stage_entries
           (project_stage_instance_id, issue_track_id, risk_level, summary, notes,
            reason_for_change, notes_llm_suggested, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (project_stage_instance_id, issue_track_id)
         DO UPDATE SET
           risk_level          = EXCLUDED.risk_level,
           summary             = EXCLUDED.summary,
           notes               = EXCLUDED.notes,
           reason_for_change   = EXCLUDED.reason_for_change,
           notes_llm_suggested = EXCLUDED.notes_llm_suggested,
           updated_by          = EXCLUDED.updated_by,
           updated_at          = NOW()`,
        [
          stageInstanceId, entry.issueTrackId, entry.riskLevel, entry.summary, entry.notes,
          entry.reasonForChange ?? null, entry.notesLlmSuggested ?? false, completedBy
        ]
      );

      // Update last_known_risk_level and is_key_issue on the track
      await client.query(
        `UPDATE admin_console.project_issue_tracks
         SET last_known_risk_level = $1,
             is_key_issue          = $2,
             updated_at            = NOW()
         WHERE id = $3 AND project_id = $4`,
        [entry.riskLevel, entry.isKeyIssue ?? false, entry.issueTrackId, projectId]
      );
    }

    // Mark the stage instance as complete
    await client.query(
      `UPDATE admin_console.project_stage_instances
       SET is_complete  = TRUE,
           completed_at = NOW(),
           completed_by = $1,
           updated_at   = NOW()
       WHERE id = $2`,
      [completedBy, stageInstanceId]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Update stage metadata (target_date, is_applicable) without marking complete.
 */
export async function updateProjectStage(projectId, stageInstanceId, updates) {
  const { targetDate, isApplicable } = updates;
  const result = await pool.query(
    `UPDATE admin_console.project_stage_instances
     SET target_date   = COALESCE($1, target_date),
         is_applicable = COALESCE($2, is_applicable),
         updated_at    = NOW()
     WHERE id = $3 AND project_id = $4
     RETURNING *`,
    [targetDate ?? null, isApplicable ?? null, stageInstanceId, projectId]
  );
  if (result.rows.length === 0) throw new Error('Stage instance not found');
  return result.rows[0];
}

/**
 * Toggle is_applicable for a stage instance.
 */
export async function toggleProjectStageApplicability(projectId, stageInstanceId) {
  const result = await pool.query(
    `UPDATE admin_console.project_stage_instances
     SET is_applicable = NOT is_applicable,
         updated_at    = NOW()
     WHERE id = $1 AND project_id = $2
     RETURNING id, is_applicable`,
    [stageInstanceId, projectId]
  );
  if (result.rows.length === 0) throw new Error('Stage instance not found');
  return result.rows[0];
}

/**
 * Get the prior completed stage entries to prefill the completion modal.
 * Returns the most recently completed stage's entries for this project.
 */
export async function getPriorStageEntries(projectId, stageInstanceId) {
  // Find display_order of the target stage
  const stageRow = await pool.query(
    `SELECT COALESCE(psi.project_display_order, psd.display_order, psi.custom_display_order) AS display_order
     FROM admin_console.project_stage_instances psi
     LEFT JOIN admin_console.project_stage_definitions psd ON psd.id = psi.stage_definition_id
     WHERE psi.id = $1 AND psi.project_id = $2`,
    [stageInstanceId, projectId]
  );
  if (stageRow.rows.length === 0) throw new Error('Stage instance not found');
  const targetOrder = stageRow.rows[0].display_order;

  const result = await pool.query(
    `SELECT
       pise.issue_track_id,
       pise.risk_level,
       pise.summary,
       pise.notes,
       pise.notes_llm_suggested
     FROM admin_console.project_issue_stage_entries pise
     JOIN admin_console.project_stage_instances psi ON psi.id = pise.project_stage_instance_id
     LEFT JOIN admin_console.project_stage_definitions psd ON psd.id = psi.stage_definition_id
     WHERE psi.project_id = $1
       AND psi.is_complete = TRUE
       AND COALESCE(psi.project_display_order, psd.display_order, psi.custom_display_order) < $2
     ORDER BY COALESCE(psi.project_display_order, psd.display_order, psi.custom_display_order) DESC`,
    [projectId, targetOrder]
  );

  // Deduplicate: keep the most recent completed prior entry per track
  const seen = new Set();
  const prefill = [];
  for (const row of result.rows) {
    if (!seen.has(row.issue_track_id)) {
      seen.add(row.issue_track_id);
      prefill.push(row);
    }
  }
  return prefill;
}

/**
 * Reorder stage definitions by updating their display_order.
 * Accepts an array of stage_definition_ids in the desired order.
 */
export async function reorderStageDefinitions(orderedDefinitionIds) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Shift all affected rows to high temp values to avoid unique constraint clashes
    for (let i = 0; i < orderedDefinitionIds.length; i++) {
      await client.query(
        `UPDATE admin_console.project_stage_definitions SET display_order = $1 WHERE id = $2`,
        [1000 + i, orderedDefinitionIds[i]]
      );
    }
    // Now assign the real display_order values
    for (let i = 0; i < orderedDefinitionIds.length; i++) {
      await client.query(
        `UPDATE admin_console.project_stage_definitions SET display_order = $1 WHERE id = $2`,
        [i + 1, orderedDefinitionIds[i]]
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

/**
 * Reorder stage instances for a specific project by updating project_display_order.
 * Accepts an array of project_stage_instance ids in the desired order.
 * Works for both standard and custom stages.
 */
export async function reorderProjectStageInstances(projectId, orderedInstanceIds) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < orderedInstanceIds.length; i++) {
      await client.query(
        `UPDATE admin_console.project_stage_instances
         SET project_display_order = $1
         WHERE id = $2 AND project_id = $3`,
        [i + 1, orderedInstanceIds[i], projectId]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Add a custom (project-specific) stage to a project's stage board.
 * Placed after all existing stages by default.
 */
export async function createCustomProjectStage(projectId, { name }) {
  const maxResult = await pool.query(
    `SELECT COALESCE(MAX(COALESCE(psd.display_order, psi.custom_display_order)), 0) AS max_order
     FROM admin_console.project_stage_instances psi
     LEFT JOIN admin_console.project_stage_definitions psd ON psd.id = psi.stage_definition_id
     WHERE psi.project_id = $1`,
    [projectId]
  );
  const nextOrder = maxResult.rows[0].max_order + 1;

  await pool.query(
    `INSERT INTO admin_console.project_stage_instances
       (project_id, stage_definition_id, custom_name, custom_display_order, is_applicable, is_complete)
     VALUES ($1, NULL, $2, $3, TRUE, FALSE)`,
    [projectId, name.trim(), nextOrder]
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Issue Tracks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Save a single stage entry without marking the stage complete.
 * Used for individual cell edits on the board.
 */
export async function saveStageEntry(projectId, stageInstanceId, { issueTrackId, riskLevel, notes }) {
  // Verify stage belongs to project
  const check = await pool.query(
    `SELECT id FROM admin_console.project_stage_instances WHERE id = $1 AND project_id = $2`,
    [stageInstanceId, projectId]
  );
  if (check.rows.length === 0) throw new Error('Stage instance not found for this project');

  const result = await pool.query(
    `INSERT INTO admin_console.project_issue_stage_entries
       (project_stage_instance_id, issue_track_id, risk_level, notes)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (project_stage_instance_id, issue_track_id)
     DO UPDATE SET
       risk_level = EXCLUDED.risk_level,
       notes      = EXCLUDED.notes,
       updated_at = NOW()
     RETURNING *`,
    [stageInstanceId, issueTrackId, riskLevel || null, notes || null]
  );
  return result.rows[0];
}

/**
 * Get entries for a specific stage instance (current stage, for pre-populating completion modal).
 */
export async function getCurrentStageEntries(projectId, stageInstanceId) {
  const result = await pool.query(
    `SELECT pise.issue_track_id, pise.risk_level, pise.notes
     FROM admin_console.project_issue_stage_entries pise
     JOIN admin_console.project_stage_instances psi ON psi.id = pise.project_stage_instance_id
     WHERE psi.id = $1 AND psi.project_id = $2`,
    [stageInstanceId, projectId]
  );
  return result.rows;
}

/**
 * Reorder issue tracks by updating their sort_order.
 * Accepts an array of issue track IDs in the desired order.
 */
export async function reorderIssueTracks(projectId, orderedIds) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < orderedIds.length; i++) {
      await client.query(
        `UPDATE admin_console.project_issue_tracks
         SET sort_order = $1, updated_at = NOW()
         WHERE id = $2 AND project_id = $3`,
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

async function applyPolicyTemplate(projectId, trackId, discipline) {
  if (!discipline) return;
  const { rows: projRows } = await pool.query(
    `SELECT development_type FROM public.projects WHERE id = $1`, [projectId]
  );
  const developmentType = projRows[0]?.development_type;
  if (!developmentType) return;

  const { rows: tplRows } = await pool.query(
    `SELECT policy_national_text FROM planning_applications.assessment_policy_templates
     WHERE discipline = $1 AND development_type = $2`,
    [discipline, developmentType]
  );
  if (!tplRows[0]?.policy_national_text) return;

  await pool.query(
    `INSERT INTO planning_applications.issue_notes (project_id, track_id, policy_national)
     VALUES ($1, $2, $3)
     ON CONFLICT (project_id, track_id) DO UPDATE
       SET policy_national = EXCLUDED.policy_national
       WHERE planning_applications.issue_notes.policy_national IS NULL
          OR planning_applications.issue_notes.policy_national = ''`,
    [projectId, trackId, tplRows[0].policy_national_text]
  );
}

/**
 * Create a custom issue track for a project.
 */
export async function createProjectIssueTrack(projectId, { label, discipline, issue_type_id, sortOrder, riskLevel, isKeyIssue }) {
  let order = sortOrder;
  if (order == null) {
    const maxRow = await pool.query(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM admin_console.project_issue_tracks WHERE project_id = $1',
      [projectId]
    );
    order = maxRow.rows[0].next;
  }

  const result = await pool.query(
    `INSERT INTO admin_console.project_issue_tracks
       (project_id, track_type, discipline, label, issue_type_id, sort_order, is_active, created_from_hlpv, is_key_issue, last_known_risk_level)
     VALUES ($1, 'custom', $2, $3, $4, $5, TRUE, FALSE, $6, $7)
     RETURNING *`,
    [projectId, discipline || null, label || discipline || null, issue_type_id || null, order, isKeyIssue || false, riskLevel || null]
  );
  const track = result.rows[0];
  await applyPolicyTemplate(projectId, track.id, track.discipline).catch(err =>
    console.error('[applyPolicyTemplate] failed silently:', err)
  );
  return track;
}

/**
 * Update issue track metadata (label, is_key_issue, is_active).
 */
export async function updateProjectIssueTrack(issueTrackId, updates) {
  const { label, discipline, issue_type_id, isKeyIssue, isActive } = updates;
  const result = await pool.query(
    `UPDATE admin_console.project_issue_tracks
     SET label         = COALESCE($1, label),
         discipline    = CASE WHEN $2::text IS NOT NULL THEN $2 ELSE discipline END,
         issue_type_id = CASE WHEN $3::int IS NOT NULL THEN $3 ELSE issue_type_id END,
         is_key_issue  = COALESCE($4, is_key_issue),
         is_active     = COALESCE($5, is_active),
         updated_at    = NOW()
     WHERE id = $6
     RETURNING *`,
    [label ?? null, discipline ?? null, issue_type_id ?? null, isKeyIssue ?? null, isActive ?? null, issueTrackId]
  );
  if (result.rows.length === 0) throw new Error('Issue track not found');
  return result.rows[0];
}

/**
 * Sync the HLPV stage entry for a single discipline.
 * Called automatically when the HLPV edit report is saved.
 * Finds the HLPV stage instance for the project linked to the given session,
 * then upserts a stage entry with the current risk and summary.
 */
export async function syncHLPVStageEntry(sessionId, discipline, riskLevel, summary) {
  // Resolve project_id from the session
  const sessionRow = await pool.query(
    `SELECT project_id FROM public.analysis_sessions WHERE id = $1`,
    [sessionId]
  );
  if (sessionRow.rows.length === 0 || !sessionRow.rows[0].project_id) return;
  const projectId = sessionRow.rows[0].project_id;

  // Find the HLPV stage instance
  const stageRow = await pool.query(
    `SELECT psi.id AS instance_id
     FROM admin_console.project_stage_instances psi
     JOIN admin_console.project_stage_definitions psd ON psd.id = psi.stage_definition_id
     WHERE psi.project_id = $1
       AND psd.name = 'High-Level Planning View'`,
    [projectId]
  );
  if (stageRow.rows.length === 0) return;
  const stageInstanceId = stageRow.rows[0].instance_id;

  // Find the discipline track
  const trackRow = await pool.query(
    `SELECT id FROM admin_console.project_issue_tracks
     WHERE project_id = $1 AND source_key = $2 AND is_active = TRUE`,
    [projectId, discipline]
  );
  if (trackRow.rows.length === 0) return;
  const trackId = trackRow.rows[0].id;

  // Upsert the stage entry
  await pool.query(
    `INSERT INTO admin_console.project_issue_stage_entries
       (project_stage_instance_id, issue_track_id, risk_level, summary)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (project_stage_instance_id, issue_track_id)
       WHERE issue_track_id IS NOT NULL
     DO UPDATE SET
       risk_level = EXCLUDED.risk_level,
       summary    = EXCLUDED.summary,
       updated_at = NOW()`,
    [stageInstanceId, trackId, riskLevel || null, summary || null]
  );

  // Keep last_known_risk_level on the track in sync
  if (riskLevel) {
    await pool.query(
      `UPDATE admin_console.project_issue_tracks
       SET last_known_risk_level = $1, updated_at = NOW()
       WHERE id = $2`,
      [riskLevel, trackId]
    );
  }
}

/**
 * Create a key issue for a project and optionally seed an HLPV stage entry.
 */
export async function createProjectKeyIssue(projectId, { label, disciplineGroup, riskLevel, summary }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const maxRow = await client.query(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next
       FROM admin_console.project_key_issues WHERE project_id = $1`,
      [projectId]
    );
    const sortOrder = maxRow.rows[0].next;

    const result = await client.query(
      `INSERT INTO admin_console.project_key_issues
         (project_id, label, discipline_group, sort_order, last_known_risk_level)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [projectId, label, disciplineGroup || null, sortOrder, riskLevel || null]
    );
    const keyIssue = result.rows[0];

    // Seed the HLPV stage entry if a risk level was provided
    if (riskLevel) {
      const stageRow = await client.query(
        `SELECT psi.id AS instance_id
         FROM admin_console.project_stage_instances psi
         JOIN admin_console.project_stage_definitions psd ON psd.id = psi.stage_definition_id
         WHERE psi.project_id = $1
           AND psd.name = 'High-Level Planning View'`,
        [projectId]
      );
      if (stageRow.rows.length > 0) {
        const stageInstanceId = stageRow.rows[0].instance_id;
        await client.query(
          `INSERT INTO admin_console.project_issue_stage_entries
             (project_stage_instance_id, key_issue_id, risk_level, summary)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (project_stage_instance_id, key_issue_id)
             WHERE key_issue_id IS NOT NULL
           DO UPDATE SET
             risk_level = EXCLUDED.risk_level,
             summary    = EXCLUDED.summary,
             updated_at = NOW()`,
          [stageInstanceId, keyIssue.id, riskLevel, summary || null]
        );
      }
    }

    await client.query('COMMIT');
    return keyIssue;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Notification Feed
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a normalized notification feed.
 * scope: 'team' | 'mine'
 * userName: current user's display name (used for 'mine' scope matching)
 * filters: { projectId, sourceType, dateFrom, dateTo }
 */
export async function getWorkflowNotifications(scope, userName, filters = {}) {
  const { projectId, sourceType, dateFrom, dateTo } = filters;

  // Date window defaults: last 7 days for scraper activity
  const scraperFromDate = dateFrom || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const items = [];
  const shouldInclude = (type) => !sourceType || sourceType === type;

  // Helper: build parameterized WHERE clauses for the shared project/date/scope filters
  // Returns { clauses: string[], params: any[], nextIdx: number }
  function buildProjectFilters(baseIdx, opts = {}) {
    const clauses = [];
    const params = [];
    let idx = baseIdx;

    if (projectId) {
      clauses.push(`AND ${opts.projectAlias || 'psi'}.project_id = $${idx++}`);
      params.push(projectId);
    }
    if (opts.dateFromCol && dateFrom) {
      clauses.push(`AND ${opts.dateFromCol} >= $${idx++}`);
      params.push(dateFrom);
    }
    if (opts.dateToCol && dateTo) {
      clauses.push(`AND ${opts.dateToCol} <= $${idx++}`);
      params.push(dateTo);
    }
    if (scope === 'mine' && userName) {
      clauses.push(`AND (LOWER(p.project_lead) = LOWER($${idx}) OR LOWER(p.project_manager) = LOWER($${idx}) OR LOWER(p.project_director) = LOWER($${idx}))`);
      params.push(userName);
      idx++;
    }
    return { clauses, params, nextIdx: idx };
  }

  // ── Completed stages ──────────────────────────────────────────────────────
  if (shouldInclude('stage_completed')) {
    const { clauses, params } = buildProjectFilters(1, {
      dateFromCol: 'psi.completed_at',
      dateToCol: 'psi.completed_at'
    });
    const rows = await pool.query(
      `SELECT
         psi.id            AS source_id,
         psi.project_id,
         p.project_name,
         psd.name          AS stage_name,
         psi.completed_at  AS event_date,
         psi.completed_by
       FROM admin_console.project_stage_instances psi
       JOIN public.projects p ON p.id = psi.project_id
       JOIN admin_console.project_stage_definitions psd ON psd.id = psi.stage_definition_id
       WHERE psi.is_complete = TRUE
         ${clauses.join('\n         ')}
       ORDER BY psi.completed_at DESC
       LIMIT 100`,
      params
    );
    for (const r of rows.rows) {
      items.push({
        source_type: 'stage_completed',
        source_id: String(r.source_id),
        project_id: r.project_id,
        project_name: r.project_name,
        title: `${r.stage_name} completed`,
        description: r.completed_by ? `Completed by ${r.completed_by}` : null,
        event_date: r.event_date,
        status: 'completed',
        severity: null,
        assigned_scope: null,
        created_at: r.event_date,
        metadata: { stage_name: r.stage_name, completed_by: r.completed_by }
      });
    }
  }

  // ── Upcoming stage target dates ───────────────────────────────────────────
  if (shouldInclude('stage_upcoming')) {
    const { clauses, params } = buildProjectFilters(1, {
      dateToCol: 'psi.target_date'
    });
    const rows = await pool.query(
      `SELECT
         psi.id            AS source_id,
         psi.project_id,
         p.project_name,
         psd.name          AS stage_name,
         psi.target_date   AS event_date
       FROM admin_console.project_stage_instances psi
       JOIN public.projects p ON p.id = psi.project_id
       JOIN admin_console.project_stage_definitions psd ON psd.id = psi.stage_definition_id
       WHERE psi.is_complete = FALSE
         AND psi.is_applicable = TRUE
         AND psi.target_date IS NOT NULL
         AND psi.target_date >= CURRENT_DATE
         ${clauses.join('\n         ')}
       ORDER BY psi.target_date ASC
       LIMIT 100`,
      params
    );
    for (const r of rows.rows) {
      items.push({
        source_type: 'stage_upcoming',
        source_id: String(r.source_id),
        project_id: r.project_id,
        project_name: r.project_name,
        title: `${r.stage_name} upcoming`,
        description: null,
        event_date: r.event_date,
        status: 'upcoming',
        severity: null,
        assigned_scope: null,
        created_at: r.event_date,
        metadata: { stage_name: r.stage_name }
      });
    }
  }

  // ── Overdue stages ────────────────────────────────────────────────────────
  if (shouldInclude('stage_overdue')) {
    const { clauses, params } = buildProjectFilters(1);
    const rows = await pool.query(
      `SELECT
         psi.id            AS source_id,
         psi.project_id,
         p.project_name,
         psd.name          AS stage_name,
         psi.target_date   AS event_date
       FROM admin_console.project_stage_instances psi
       JOIN public.projects p ON p.id = psi.project_id
       JOIN admin_console.project_stage_definitions psd ON psd.id = psi.stage_definition_id
       WHERE psi.is_complete = FALSE
         AND psi.is_applicable = TRUE
         AND psi.target_date < CURRENT_DATE
         ${clauses.join('\n         ')}
       ORDER BY psi.target_date ASC
       LIMIT 100`,
      params
    );
    for (const r of rows.rows) {
      items.push({
        source_type: 'stage_overdue',
        source_id: String(r.source_id),
        project_id: r.project_id,
        project_name: r.project_name,
        title: `${r.stage_name} overdue`,
        description: null,
        event_date: r.event_date,
        status: 'overdue',
        severity: 'high',
        assigned_scope: null,
        created_at: r.event_date,
        metadata: { stage_name: r.stage_name }
      });
    }
  }

  // ── Key issue activity ────────────────────────────────────────────────────
  if (shouldInclude('key_issue')) {
    const { clauses, params } = buildProjectFilters(1, {
      projectAlias: 'pit',
      dateFromCol: 'pit.updated_at',
      dateToCol: 'pit.updated_at'
    });
    const rows = await pool.query(
      `SELECT
         pit.id          AS source_id,
         pit.project_id,
         p.project_name,
         pit.label,
         pit.updated_at  AS event_date
       FROM admin_console.project_issue_tracks pit
       JOIN public.projects p ON p.id = pit.project_id
       WHERE pit.is_key_issue = TRUE
         AND pit.is_active = TRUE
         ${clauses.join('\n         ')}
       ORDER BY pit.updated_at DESC
       LIMIT 100`,
      params
    );
    for (const r of rows.rows) {
      items.push({
        source_type: 'key_issue',
        source_id: String(r.source_id),
        project_id: r.project_id,
        project_name: r.project_name,
        title: `Key issue: ${r.label}`,
        description: null,
        event_date: r.event_date,
        status: 'active',
        severity: 'medium',
        assigned_scope: null,
        created_at: r.event_date,
        metadata: { label: r.label }
      });
    }
  }

  // ── Scraper: planit_renewables ─────────────────────────────────────────────
  if (shouldInclude('scraper_renewables')) {
    const rows = await pool.query(
      `SELECT id, name, area_name, app_state, decision, start_date, decided_date
       FROM scraper.planit_renewables
       WHERE (
         (start_date IS NOT NULL AND start_date >= $1)
         OR (decided_date IS NOT NULL AND decided_date >= $1)
       )
       ORDER BY GREATEST(start_date, decided_date) DESC NULLS LAST
       LIMIT 50`,
      [scraperFromDate]
    );
    for (const r of rows.rows) {
      items.push({
        source_type: 'scraper_renewables',
        source_id: String(r.id),
        project_id: null,
        project_name: null,
        title: r.name || 'Renewables application',
        description: r.area_name || null,
        event_date: r.decided_date || r.start_date,
        status: r.decision || r.app_state || null,
        severity: null,
        assigned_scope: null,
        created_at: r.start_date,
        metadata: { app_state: r.app_state, decision: r.decision, area_name: r.area_name }
      });
    }
  }

  // ── Scraper: planit_datacentres ───────────────────────────────────────────
  if (shouldInclude('scraper_datacentres')) {
    const rows = await pool.query(
      `SELECT id, name, area_name, app_state, decision, start_date, decided_date
       FROM scraper.planit_datacentres
       WHERE (
         (start_date IS NOT NULL AND start_date >= $1)
         OR (decided_date IS NOT NULL AND decided_date >= $1)
       )
       ORDER BY GREATEST(start_date, decided_date) DESC NULLS LAST
       LIMIT 50`,
      [scraperFromDate]
    );
    for (const r of rows.rows) {
      items.push({
        source_type: 'scraper_datacentres',
        source_id: String(r.id),
        project_id: null,
        project_name: null,
        title: r.name || 'Data centre application',
        description: r.area_name || null,
        event_date: r.decided_date || r.start_date,
        status: r.decision || r.app_state || null,
        severity: null,
        assigned_scope: null,
        created_at: r.start_date,
        metadata: { app_state: r.app_state, decision: r.decision, area_name: r.area_name }
      });
    }
  }

  // ── Scraper: contracts_finder ─────────────────────────────────────────────
  if (shouldInclude('scraper_contracts')) {
    const rows = await pool.query(
      `SELECT id, title, organisation, published_date, closing_date, status
       FROM scraper.contracts_finder
       WHERE published_date IS NOT NULL
         AND published_date >= $1
       ORDER BY published_date DESC
       LIMIT 50`,
      [scraperFromDate]
    );
    for (const r of rows.rows) {
      items.push({
        source_type: 'scraper_contracts',
        source_id: String(r.id),
        project_id: null,
        project_name: null,
        title: r.title || 'Contract opportunity',
        description: r.organisation || null,
        event_date: r.published_date,
        status: r.status || null,
        severity: null,
        assigned_scope: null,
        created_at: r.published_date,
        metadata: { organisation: r.organisation, closing_date: r.closing_date }
      });
    }
  }

  // Sort all items by event_date descending
  items.sort((a, b) => {
    const da = a.event_date ? new Date(a.event_date).getTime() : 0;
    const db = b.event_date ? new Date(b.event_date).getTime() : 0;
    return db - da;
  });

  return items;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function disciplineLabel(key) {
  const labels = {
    heritage: 'Heritage',
    landscape: 'Landscape',
    ecology: 'Ecology',
    ag_land: 'Agricultural Land',
    renewables: 'Renewables',
    trees: 'Trees',
    airfields: 'Airfields',
    flood: 'Flood Risk',
    aviation: 'Aviation',
    highways: 'Highways',
    amenity: 'Amenity'
  };
  return labels[key] || key;
}
