import { pool } from '../db.js';
import { resolveBriefingSourceTexts } from '../services/quoteRequests.service.js';
import { generateOutline, buildPptxBuffer, TEMPLATE_OPTIONS, DEFAULT_TEMPLATE } from '../services/slideshow.service.js';

const CONTEXT_BUDGET = 200000;

// GET /api/slideshows/templates
export function listTemplates(req, res) {
  res.json({ templates: TEMPLATE_OPTIONS, default: DEFAULT_TEMPLATE });
}

// POST /api/slideshows/:projectId/generate  (projectId = projects.unique_id)
// body: { sources: [{ type: 'briefing_note'|'meeting_note', id, full }], guidance, template }
// Returns { deck_title, slide_titles, filename, file_base64 }
export async function generateSlideshow(req, res) {
  const { projectId } = req.params;
  const { sources = [], guidance = '', template = DEFAULT_TEMPLATE } = req.body ?? {};

  if (!Array.isArray(sources) || !sources.length) {
    return res.status(400).json({ error: 'Select at least one briefing or meeting note.' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT project_name, client FROM public.projects WHERE unique_id = $1`,
      [projectId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Project not found' });
    const { project_name, client } = rows[0];

    const sourceText = await resolveBriefingSourceTexts(sources, projectId);
    if (!sourceText) {
      return res.status(404).json({ error: 'The selected notes have no content to build slides from.' });
    }
    if (sourceText.length > CONTEXT_BUDGET) {
      const pct = Math.round(sourceText.length / CONTEXT_BUDGET * 100);
      return res.status(400).json({ error: `Selected notes exceed the context budget (~${pct}%). Untick some or switch a full transcript to its summary.` });
    }

    const outline = await generateOutline({
      projectName: project_name,
      clientName: client,
      sourceText,
      guidance,
    });
    const buffer = await buildPptxBuffer(outline, template, { projectName: project_name });

    const safeName = outline.deck_title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_').slice(0, 80) || 'slideshow';
    res.json({
      deck_title: outline.deck_title,
      slide_titles: outline.slides.map(s => s.title),
      filename: `${safeName}.pptx`,
      file_base64: buffer.toString('base64'),
    });
  } catch (err) {
    console.error('slideshow.generate error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate slideshow' });
  }
}
