/**
 * HLPV Narrative Controller
 * Generates LLM narrative assessments for HLPV discipline sections.
 */

import { pool } from '../db.js';
import { generateHlpvNarrative } from '../services/llm.service.js';

/**
 * POST /api/hlpv/generate-narrative
 *
 * Body:
 *   projectId       {number|null}  — if provided, fetches briefing note from this project
 *   disciplines     {Array}        — discipline data from the frontend (only risk-triggering ones)
 *   briefingNoteId  {number|null}  — specific briefing note to use; null = latest
 */
export async function generateNarrative(req, res) {
  const { projectId, disciplines, briefingNoteId } = req.body;

  if (!Array.isArray(disciplines) || disciplines.length === 0) {
    return res.status(400).json({ error: 'disciplines array is required' });
  }

  try {
    let briefingText = null;

    if (projectId) {
      const query = briefingNoteId
        ? `SELECT summary_html FROM planning_applications.document_summaries
           WHERE id = $1 AND project_id = $2 AND doc_type = 'briefing_transcript'`
        : `SELECT summary_html FROM planning_applications.document_summaries
           WHERE project_id = $1 AND doc_type = 'briefing_transcript'
           ORDER BY created_at DESC LIMIT 1`;

      const params = briefingNoteId ? [briefingNoteId, projectId] : [projectId];
      const { rows } = await pool.query(query, params);
      const html = rows[0]?.summary_html ?? null;

      if (html) {
        briefingText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      }
    }

    const narratives = await generateHlpvNarrative(disciplines, briefingText);
    res.json({ narratives });
  } catch (err) {
    console.error('hlpvNarrative.generateNarrative error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate narrative' });
  }
}
