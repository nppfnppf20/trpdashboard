/**
 * Stage Analysis Controller
 * Handles document upload + LLM analysis for the stage completion modal.
 * The analysis result is returned to the frontend to pre-populate the notes
 * fields — nothing is written to the DB here. The existing completeStage
 * flow handles the actual save when the user hits "Mark complete".
 */

import { pool } from '../db.js';
import { parseFile } from '../services/parser.service.js';
import { analyseDocumentForStage, checkDocumentSize } from '../services/llm.service.js';

/**
 * Lightweight document size check.
 * Parses the file and returns truncation/rejection info without running any LLM calls.
 * Frontend calls this on file select so the user sees the warning before clicking Analyse.
 */
export async function checkDocumentSizeHandler(req, res) {
  try {
    let rawText;
    if (req.file) {
      ({ text: rawText } = await parseFile(req.file.buffer, req.file.originalname));
    } else if (req.body.pasted_text?.trim()) {
      rawText = req.body.pasted_text.trim();
    } else {
      return res.status(400).json({ error: 'No file or text provided' });
    }
    const sizeCheck = checkDocumentSize(rawText);
    res.json({
      status: sizeCheck.status,
      total_chunks: sizeCheck.totalChunks,
      analysed_chunks: sizeCheck.analysedChunks,
      warning: sizeCheck.warningMessage
    });
  } catch (err) {
    console.error('checkDocumentSizeHandler error:', err);
    res.status(500).json({ error: 'Failed to check document size' });
  }
}

export async function analyseStageDocument(req, res) {
  const { projectId, stageInstanceId } = req.params;

  // userGuidance is an optional JSON object: { [issue_track_id]: "guidance text" }
  let userGuidance = {};
  if (req.body.user_guidance) {
    try {
      userGuidance = JSON.parse(req.body.user_guidance);
    } catch {
      return res.status(400).json({ error: 'user_guidance must be valid JSON' });
    }
  }

  try {
    // Verify stage belongs to project and get stage name
    const { rows: stageRows } = await pool.query(
      `SELECT psi.id, psd.name AS stage_name
       FROM admin_console.project_stage_instances psi
       JOIN admin_console.project_stage_definitions psd ON psd.id = psi.stage_definition_id
       WHERE psi.id = $1 AND psi.project_id = $2`,
      [stageInstanceId, projectId]
    );
    if (!stageRows.length) return res.status(404).json({ error: 'Stage not found for this project' });
    const stageName = stageRows[0].stage_name;

    // Fetch issue tracks for the project
    const { rows: tracks } = await pool.query(
      `SELECT id, label, source_key, discipline
       FROM admin_console.project_issue_tracks
       WHERE project_id = $1 AND is_active = TRUE
       ORDER BY sort_order, id`,
      [projectId]
    );
    if (!tracks.length) return res.status(400).json({ error: 'No issue tracks defined for this project' });

    // Fetch all prior confirmed stage entry notes per issue track so the LLM
    // has longitudinal context — it understands how each issue has evolved
    const { rows: priorEntries } = await pool.query(
      `SELECT
         pise.issue_track_id,
         pise.notes,
         psd.name AS stage_name,
         psd.display_order
       FROM admin_console.project_issue_stage_entries pise
       JOIN admin_console.project_stage_instances psi ON psi.id = pise.project_stage_instance_id
       JOIN admin_console.project_stage_definitions psd ON psd.id = psi.stage_definition_id
       WHERE psi.project_id = $1
         AND psi.is_complete = TRUE
         AND pise.notes IS NOT NULL
       ORDER BY psd.display_order ASC`,
      [projectId]
    );

    // Group prior notes by track id
    const priorByTrack = {};
    for (const e of priorEntries) {
      if (!priorByTrack[e.issue_track_id]) priorByTrack[e.issue_track_id] = [];
      priorByTrack[e.issue_track_id].push({ stage_name: e.stage_name, notes: e.notes });
    }

    const tracksWithHistory = tracks.map(t => ({
      ...t,
      prior_summaries: priorByTrack[t.id] ?? []
    }));

    // Parse the uploaded file (or use pasted text sent as plain body field)
    let rawText, parseWarning;
    if (req.file) {
      ({ text: rawText, warning: parseWarning } = await parseFile(req.file.buffer, req.file.originalname));
    } else if (req.body.pasted_text?.trim()) {
      rawText = req.body.pasted_text.trim();
      parseWarning = null;
    } else {
      return res.status(400).json({ error: 'No file or text provided' });
    }

    // Check document size before committing to a full LLM run
    const sizeCheck = checkDocumentSize(rawText);
    if (sizeCheck.status === 'rejected') {
      return res.status(422).json({
        error: 'document_too_large',
        message: sizeCheck.warningMessage,
        total_chunks: sizeCheck.totalChunks
      });
    }

    // Run LLM analysis
    const results = await analyseDocumentForStage(rawText, stageName, tracksWithHistory, userGuidance);

    res.json({
      stage_name: stageName,
      parse_warning: parseWarning,
      truncation_warning: sizeCheck.status === 'truncated' ? sizeCheck.warningMessage : null,
      results
    });
  } catch (err) {
    console.error('analyseStageDocument error:', err);
    res.status(500).json({ error: 'Analysis failed', detail: err.message });
  }
}
