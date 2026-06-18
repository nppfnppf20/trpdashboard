/**
 * HLPV Narrative Controller
 * Generates LLM narrative assessments for HLPV discipline sections.
 */

import { pool } from '../db.js';
import { generateHlpvNarrative, formatHlpvDataAsText, buildDisciplinesFromSessionData } from '../services/llm.service.js';
import { getGuidingBrief } from './guidingBriefs.controller.js';
import { getDocumentStyleTemplateByDocType } from './documentStyleTemplates.controller.js';
import { getFullSessionData } from '../services/analysisSession.service.js';

/**
 * POST /api/hlpv/generate-narrative
 *
 * Body:
 *   projectId       {number|null}  — if provided, fetches briefing note from this project
 *   disciplines     {Array}        — discipline data from the frontend (only risk-triggering ones)
 *   briefingNoteId  {number|null}  — specific briefing note to use; null = latest
 */
export async function generateNarrative(req, res) {
  const { projectId, disciplines, briefingNoteId, developmentType: bodyDevType } = req.body;

  if (!Array.isArray(disciplines) || disciplines.length === 0) {
    return res.status(400).json({ error: 'disciplines array is required' });
  }

  try {
    let briefingText = null;
    let developmentType = bodyDevType ?? null;

    if (projectId) {
      const { rows: projRows } = await pool.query(
        'SELECT development_type FROM public.projects WHERE id = $1',
        [projectId]
      );
      developmentType = developmentType ?? projRows[0]?.development_type ?? null;

      if (briefingNoteId) {
        const { rows } = await pool.query(
          `SELECT summary_html FROM planning_applications.document_summaries
           WHERE id = $1 AND project_id = $2 AND doc_type = 'briefing_transcript'`,
          [briefingNoteId, projectId]
        );
        const html = rows[0]?.summary_html ?? null;
        if (html) {
          briefingText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        }
      }
    }

    const [guidingBrief, styleTemplate] = await Promise.all([
      getGuidingBrief('hlpv', developmentType),
      getDocumentStyleTemplateByDocType('hlpv', developmentType),
    ]);
    const narrative = await generateHlpvNarrative(disciplines, briefingText, guidingBrief, styleTemplate);
    res.json({ narrative });
  } catch (err) {
    console.error('hlpvNarrative.generateNarrative error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate narrative' });
  }
}

/**
 * GET /api/hlpv/project/:projectId/sessions
 * Lists saved HLPV analysis sessions for a project (for the starter doc dropdown).
 */
export async function listProjectSessions(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT id, site_name, created_at
       FROM public.analysis_sessions
       WHERE project_id = $1
       ORDER BY created_at DESC`,
      [projectId]
    );
    res.json(rows);
  } catch (err) {
    console.error('hlpvNarrative.listProjectSessions error:', err);
    res.status(500).json({ error: err.message || 'Failed to list sessions' });
  }
}

/**
 * GET /api/hlpv/sessions/:sessionId/formatted-data
 * Returns the formatted HLPV discipline text for a session, ready to save into the starter doc slot.
 */
export async function getFormattedSessionData(req, res) {
  const { sessionId } = req.params;
  try {
    const { summaries, rules, findings, edits } = await getFullSessionData(sessionId);

    if (!summaries.length) {
      return res.status(404).json({ error: 'Session not found or has no discipline data' });
    }

    const disciplines = buildDisciplinesFromSessionData(summaries, rules, findings, edits);
    const contentText = formatHlpvDataAsText(disciplines);
    res.json({ contentText });
  } catch (err) {
    console.error('hlpvNarrative.getFormattedSessionData error:', err);
    res.status(500).json({ error: err.message || 'Failed to get session data' });
  }
}
