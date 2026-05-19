/**
 * HLPV Narrative Controller
 * Generates LLM narrative assessments for HLPV discipline sections.
 */

import { pool } from '../db.js';
import { generateHlpvNarrative } from '../services/llm.service.js';
import { getGuidingBrief } from './guidingBriefs.controller.js';

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

    const guidingBrief = await getGuidingBrief('hlpv', developmentType);
    const narrative = await generateHlpvNarrative(disciplines, briefingText, guidingBrief);
    res.json({ narrative });
  } catch (err) {
    console.error('hlpvNarrative.generateNarrative error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate narrative' });
  }
}
