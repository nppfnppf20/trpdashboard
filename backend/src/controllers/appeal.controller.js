/**
 * Appeal Controller
 * Handles the appeal drafting tool: living argument document + document review workflow.
 */

import { pool } from '../db.js';
import { parseFile } from '../services/parser.service.js';
import { generateAppealArgument, reviewDocumentAgainstArgument, extractPointsFromDocument, buildExtractPointsPrompt, buildExtractPointsTemplate, generateAppealDraft, generateDraftSection } from '../services/llm.service.js';

// ─────────────────────────────────────────────────────────────────────────────
// Key issues
// ─────────────────────────────────────────────────────────────────────────────

export async function getKeyIssues(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT id, label, discipline, sort_order, last_known_risk_level, summary
       FROM admin_console.project_issue_tracks
       WHERE project_id = $1 AND is_active = TRUE
       ORDER BY sort_order, id`,
      [projectId]
    );
    res.json(rows);
  } catch (err) {
    console.error('getKeyIssues error:', err);
    res.status(500).json({ error: 'Failed to fetch key issues' });
  }
}

export async function updateKeyIssueSummary(req, res) {
  const { trackId } = req.params;
  const { summary } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE admin_console.project_issue_tracks
       SET summary = $1
       WHERE id = $2
       RETURNING id, label, discipline, sort_order, last_known_risk_level, summary`,
      [summary ?? null, trackId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Issue track not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('updateKeyIssueSummary error:', err);
    res.status(500).json({ error: 'Failed to update summary' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Issue notes (per-issue argument structure notes)
// ─────────────────────────────────────────────────────────────────────────────

export async function getIssueNotes(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT track_id, argument_against, argument_for
       FROM public.appeal_issue_notes
       WHERE project_id = $1`,
      [projectId]
    );
    // Return as a map: { [track_id]: { argument_against, argument_for } }
    const map = {};
    for (const row of rows) {
      map[row.track_id] = {
        argument_against: row.argument_against,
        argument_for: row.argument_for
      };
    }
    res.json(map);
  } catch (err) {
    console.error('getIssueNotes error:', err);
    res.status(500).json({ error: 'Failed to fetch issue notes' });
  }
}

export async function upsertIssueNote(req, res) {
  const { projectId, trackId } = req.params;
  const { argument_against, argument_for } = req.body;

  try {
    const { rows } = await pool.query(
      `INSERT INTO public.appeal_issue_notes (project_id, track_id, argument_against, argument_for, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (project_id, track_id)
       DO UPDATE SET argument_against = $3, argument_for = $4, updated_at = NOW()
       RETURNING track_id, argument_against, argument_for, updated_at`,
      [projectId, trackId, argument_against ?? null, argument_for ?? null]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('upsertIssueNote error:', err);
    res.status(500).json({ error: 'Failed to save issue note' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Document analysis — extract points mapped to key issues
// ─────────────────────────────────────────────────────────────────────────────

export async function analyseDocument(req, res) {
  try {
    console.log('analyseDocument hit — contentType:', req.headers['content-type'], 'hasFile:', !!req.file, 'bodyKeys:', Object.keys(req.body || {}));

    const { projectId } = req.params;
    const preview = req.query.preview === 'true';
    const documentType = req.body.document_type || 'Other';
    const documentDirection = req.body.document_direction || 'against';
    const userNotes = req.body.user_notes || null;
    const customPrompt = req.body.custom_prompt || null;

    const rawIds = req.body.relevant_track_ids;
    let relevantTrackIds = [];
    if (Array.isArray(rawIds)) {
      relevantTrackIds = rawIds;
    } else if (typeof rawIds === 'string' && rawIds.trim()) {
      relevantTrackIds = JSON.parse(rawIds);
    }

    let text;
    if (req.file) {
      ({ text } = await parseFile(req.file.buffer, req.file.originalname));
    } else if (req.body.text) {
      text = req.body.text;
    } else {
      return res.status(400).json({ error: 'No file or text provided' });
    }

    console.log('analyseDocument text length:', text?.length, 'trackIds:', relevantTrackIds);

    const { rows: allIssues } = await pool.query(
      `SELECT pit.id, pit.label, pit.discipline, ain.argument_against, ain.argument_for
       FROM admin_console.project_issue_tracks pit
       LEFT JOIN public.appeal_issue_notes ain
         ON ain.track_id = pit.id AND ain.project_id = $1
       WHERE pit.project_id = $1 AND pit.is_active = TRUE
       ORDER BY pit.sort_order, pit.id`,
      [projectId]
    );

    const targetIssues = relevantTrackIds.length > 0
      ? allIssues.filter(i => relevantTrackIds.includes(i.id))
      : [];

    // Look up any saved prompt template for this project
    const { rows: templateRows } = await pool.query(
      `SELECT extract_points_template FROM public.appeal_prompt_settings WHERE project_id = $1`,
      [projectId]
    );
    const savedTemplate = templateRows[0]?.extract_points_template ?? null;

    if (preview) {
      // Return the saved template (with {{DOCUMENT}} placeholder) if one exists,
      // otherwise generate a fresh default template with current issue context.
      const template = savedTemplate
        ?? buildExtractPointsTemplate({ allIssues, targetIssues, documentType, documentDirection, userNotes });
      return res.json({ template });
    }

    // Resolve the prompt to use for this run:
    // 1. Explicit custom_prompt from request (user edited in modal and ran)
    // 2. Saved template with {{DOCUMENT}} substituted
    // 3. Fresh build from current context
    let resolvedPrompt = null;
    if (customPrompt) {
      resolvedPrompt = customPrompt.replace('{{DOCUMENT}}', text.slice(0, 10000));
    } else if (savedTemplate) {
      resolvedPrompt = savedTemplate.replace('{{DOCUMENT}}', text.slice(0, 10000));
    }

    const result = await extractPointsFromDocument({
      text,
      allIssues,
      targetIssues,
      documentType,
      documentDirection,
      userNotes,
      customPrompt: resolvedPrompt
    });

    res.json(result);
  } catch (err) {
    console.error('analyseDocument error:', err.message);
    console.error(err.stack);
    res.status(500).json({ error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Argument document
// ─────────────────────────────────────────────────────────────────────────────

export async function getArgument(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT id, project_id, argument_html, initial_notes, created_at, updated_at
       FROM public.appeal_arguments
       WHERE project_id = $1`,
      [projectId]
    );
    res.json(rows[0] ?? null);
  } catch (err) {
    console.error('getArgument error:', err);
    res.status(500).json({ error: 'Failed to fetch argument' });
  }
}

export async function saveArgument(req, res) {
  const { projectId } = req.params;
  const { argument_html } = req.body;

  if (argument_html === undefined) {
    return res.status(400).json({ error: 'argument_html is required' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO public.appeal_arguments (project_id, argument_html)
       VALUES ($1, $2)
       ON CONFLICT (project_id)
       DO UPDATE SET argument_html = $2, updated_at = NOW()
       RETURNING *`,
      [projectId, argument_html]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('saveArgument error:', err);
    res.status(500).json({ error: 'Failed to save argument' });
  }
}

export async function generateArgument(req, res) {
  const { projectId } = req.params;
  const { initial_notes } = req.body;

  try {
    // Fetch project name
    const { rows: projectRows } = await pool.query(
      `SELECT project_name FROM public.projects WHERE id = $1`,
      [projectId]
    );
    if (!projectRows.length) return res.status(404).json({ error: 'Project not found' });
    const projectName = projectRows[0].project_name;

    // Fetch refusal reasons
    const { rows: refusalRows } = await pool.query(
      `SELECT title, summary, risk_level
       FROM admin_console.refusal_reasons
       WHERE project_id = $1
       ORDER BY sort_order, id`,
      [projectId]
    );

    // Fetch key issues
    const { rows: issueRows } = await pool.query(
      `SELECT label, discipline_group
       FROM admin_console.project_key_issues
       WHERE project_id = $1 AND is_active = TRUE
       ORDER BY sort_order, id`,
      [projectId]
    );

    const argumentHtml = await generateAppealArgument({
      projectName,
      refusalReasons: refusalRows,
      keyIssues: issueRows,
      initialNotes: initial_notes ?? null
    });

    // Persist
    const { rows } = await pool.query(
      `INSERT INTO public.appeal_arguments (project_id, argument_html, initial_notes)
       VALUES ($1, $2, $3)
       ON CONFLICT (project_id)
       DO UPDATE SET argument_html = $2, initial_notes = $3, updated_at = NOW()
       RETURNING *`,
      [projectId, argumentHtml, initial_notes ?? null]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error('generateArgument error:', err);
    res.status(500).json({ error: 'Failed to generate argument' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Documents
// ─────────────────────────────────────────────────────────────────────────────

export async function getDocuments(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT id, project_id, filename, review_status, ai_review, uploaded_at
       FROM public.appeal_documents
       WHERE project_id = $1
       ORDER BY uploaded_at DESC`,
      [projectId]
    );
    res.json(rows);
  } catch (err) {
    console.error('getDocuments error:', err);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
}

export async function uploadDocument(req, res) {
  const { projectId } = req.params;

  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    // Parse PDF/text to plain text
    const { text } = await parseFile(req.file);

    // Fetch current argument
    const { rows: argRows } = await pool.query(
      `SELECT argument_html FROM public.appeal_arguments WHERE project_id = $1`,
      [projectId]
    );
    const currentArgument = argRows[0]?.argument_html ?? '';

    // Fetch key issues + refusal reasons for context
    const { rows: issueRows } = await pool.query(
      `SELECT label, discipline_group
       FROM admin_console.project_key_issues
       WHERE project_id = $1 AND is_active = TRUE
       ORDER BY sort_order, id`,
      [projectId]
    );
    const { rows: refusalRows } = await pool.query(
      `SELECT title FROM admin_console.refusal_reasons
       WHERE project_id = $1
       ORDER BY sort_order, id`,
      [projectId]
    );

    // Run AI review
    const aiReview = await reviewDocumentAgainstArgument({
      documentText: text,
      currentArgument,
      keyIssues: issueRows,
      refusalReasons: refusalRows,
      filename: req.file.originalname
    });

    // Persist document record
    const { rows } = await pool.query(
      `INSERT INTO public.appeal_documents (project_id, filename, review_status, ai_review)
       VALUES ($1, $2, 'reviewed', $3)
       RETURNING *`,
      [projectId, req.file.originalname, JSON.stringify(aiReview)]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('uploadDocument error:', err);
    res.status(500).json({ error: 'Failed to process document' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt template — saved per-project extraction prompt
// ─────────────────────────────────────────────────────────────────────────────

export async function getPromptTemplate(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT extract_points_template, updated_at FROM public.appeal_prompt_settings WHERE project_id = $1`,
      [projectId]
    );
    res.json(rows[0] ?? null);
  } catch (err) {
    console.error('getPromptTemplate error:', err);
    res.status(500).json({ error: 'Failed to fetch prompt template' });
  }
}

export async function savePromptTemplate(req, res) {
  const { projectId } = req.params;
  const { template } = req.body;
  if (!template?.trim()) return res.status(400).json({ error: 'template is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO public.appeal_prompt_settings (project_id, extract_points_template, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (project_id)
       DO UPDATE SET extract_points_template = $2, updated_at = NOW()
       RETURNING extract_points_template, updated_at`,
      [projectId, template.trim()]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('savePromptTemplate error:', err);
    res.status(500).json({ error: 'Failed to save prompt template' });
  }
}

export async function deletePromptTemplate(req, res) {
  const { projectId } = req.params;
  try {
    await pool.query(`DELETE FROM public.appeal_prompt_settings WHERE project_id = $1`, [projectId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('deletePromptTemplate error:', err);
    res.status(500).json({ error: 'Failed to delete prompt template' });
  }
}

export async function updateDocumentStatus(req, res) {
  const { docId } = req.params;
  const { review_status } = req.body;

  const allowed = ['reviewed', 'merged', 'ignored', 'notes_only'];
  if (!allowed.includes(review_status)) {
    return res.status(400).json({ error: `review_status must be one of: ${allowed.join(', ')}` });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE public.appeal_documents
       SET review_status = $1
       WHERE id = $2
       RETURNING *`,
      [review_status, docId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Document not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('updateDocumentStatus error:', err);
    res.status(500).json({ error: 'Failed to update document status' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Draft documents — appeal_draft_types + appeal_drafts
// ─────────────────────────────────────────────────────────────────────────────

export async function generateSection(req, res) {
  const { projectId, typeId, sectionId } = req.params;
  try {
    const { rows: projectRows } = await pool.query(
      `SELECT project_name FROM public.projects WHERE id = $1`, [projectId]
    );
    if (!projectRows.length) return res.status(404).json({ error: 'Project not found' });

    const { rows: typeRows } = await pool.query(
      `SELECT name FROM appeals.appeal_draft_types WHERE id = $1`, [typeId]
    );
    if (!typeRows.length) return res.status(404).json({ error: 'Draft type not found' });

    const { rows: sectionRows } = await pool.query(
      `SELECT * FROM appeals.appeal_draft_sections WHERE id = $1 AND draft_type_id = $2`,
      [sectionId, typeId]
    );
    if (!sectionRows.length) return res.status(404).json({ error: 'Section not found' });

    const { rows: issues } = await pool.query(
      `SELECT pit.id, pit.label, pit.discipline, ain.argument_against, ain.argument_for
       FROM admin_console.project_issue_tracks pit
       LEFT JOIN public.appeal_issue_notes ain
         ON ain.track_id = pit.id AND ain.project_id = $1
       WHERE pit.project_id = $1 AND pit.is_active = TRUE
       ORDER BY pit.sort_order, pit.id`,
      [projectId]
    );

    const issueContext = issues.map(issue => {
      const lines = [`## ${issue.label}${issue.discipline ? ` (${issue.discipline})` : ''}`];
      if (issue.argument_against) lines.push(`Opposing position:\n${issue.argument_against}`);
      if (issue.argument_for)     lines.push(`Our case:\n${issue.argument_for}`);
      if (!issue.argument_against && !issue.argument_for) lines.push('(No notes yet.)');
      return lines.join('\n');
    }).join('\n\n---\n\n');

    const html = await generateDraftSection({
      section: sectionRows[0],
      projectName: projectRows[0].project_name,
      draftTypeName: typeRows[0].name,
      issueContext
    });

    res.json({ html, section_id: sectionRows[0].id, section_name: sectionRows[0].name });
  } catch (err) {
    console.error('generateSection error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function getDraftTypes(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, slug, description, sort_order
       FROM appeals.appeal_draft_types
       ORDER BY sort_order, id`
    );
    res.json(rows);
  } catch (err) {
    console.error('getDraftTypes error:', err);
    res.status(500).json({ error: 'Failed to fetch draft types' });
  }
}

// ── Sections ──────────────────────────────────────────────────────────────────

export async function getSections(req, res) {
  const { typeId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT id, draft_type_id, name, slug, description, sort_order, generation_prompt, example_text
       FROM appeals.appeal_draft_sections
       WHERE draft_type_id = $1
       ORDER BY sort_order, id`,
      [typeId]
    );
    res.json(rows);
  } catch (err) {
    console.error('getSections error:', err);
    res.status(500).json({ error: 'Failed to fetch sections' });
  }
}

export async function createSection(req, res) {
  const { typeId } = req.params;
  const { name, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

  try {
    // Place at end
    const { rows: maxRows } = await pool.query(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM appeals.appeal_draft_sections WHERE draft_type_id = $1`,
      [typeId]
    );
    const { rows } = await pool.query(
      `INSERT INTO appeals.appeal_draft_sections (draft_type_id, name, slug, description, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [typeId, name.trim(), slug, description ?? null, maxRows[0].next_order]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('createSection error:', err);
    res.status(500).json({ error: 'Failed to create section' });
  }
}

export async function updateSection(req, res) {
  const { sectionId } = req.params;
  const { name, description, sort_order, generation_prompt, example_text } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE appeals.appeal_draft_sections
       SET name              = COALESCE($1, name),
           description       = COALESCE($2, description),
           sort_order        = COALESCE($3, sort_order),
           generation_prompt = $4,
           example_text      = $5
       WHERE id = $6
       RETURNING *`,
      [name ?? null, description ?? null, sort_order ?? null, generation_prompt ?? null, example_text ?? null, sectionId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Section not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('updateSection error:', err);
    res.status(500).json({ error: 'Failed to update section' });
  }
}

export async function deleteSection(req, res) {
  const { sectionId } = req.params;
  try {
    const { rows } = await pool.query(
      `DELETE FROM appeals.appeal_draft_sections WHERE id = $1 RETURNING id`, [sectionId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Section not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('deleteSection error:', err);
    res.status(500).json({ error: 'Failed to delete section' });
  }
}

export async function reorderSections(req, res) {
  const { typeId } = req.params;
  const { order } = req.body; // array of section ids in desired order
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array of ids' });
  try {
    await Promise.all(order.map((id, idx) =>
      pool.query(
        `UPDATE appeals.appeal_draft_sections SET sort_order = $1 WHERE id = $2 AND draft_type_id = $3`,
        [idx, id, typeId]
      )
    ));
    const { rows } = await pool.query(
      `SELECT * FROM appeals.appeal_draft_sections WHERE draft_type_id = $1 ORDER BY sort_order, id`,
      [typeId]
    );
    res.json(rows);
  } catch (err) {
    console.error('reorderSections error:', err);
    res.status(500).json({ error: 'Failed to reorder sections' });
  }
}

export async function getDraft(req, res) {
  const { projectId, typeId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT id, project_id, draft_type_id, content_html, generated_at, updated_at
       FROM appeals.appeal_drafts
       WHERE project_id = $1 AND draft_type_id = $2`,
      [projectId, typeId]
    );
    res.json(rows[0] ?? null);
  } catch (err) {
    console.error('getDraft error:', err);
    res.status(500).json({ error: 'Failed to fetch draft' });
  }
}

export async function saveDraft(req, res) {
  const { projectId, typeId } = req.params;
  const { content_html } = req.body;
  if (content_html === undefined) return res.status(400).json({ error: 'content_html is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO appeals.appeal_drafts (project_id, draft_type_id, content_html, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (project_id, draft_type_id)
       DO UPDATE SET content_html = $3, updated_at = NOW()
       RETURNING *`,
      [projectId, typeId, content_html]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('saveDraft error:', err);
    res.status(500).json({ error: 'Failed to save draft' });
  }
}

export async function generateDraft(req, res) {
  const { projectId, typeId } = req.params;
  try {
    const { rows: projectRows } = await pool.query(
      `SELECT project_name FROM public.projects WHERE id = $1`, [projectId]
    );
    if (!projectRows.length) return res.status(404).json({ error: 'Project not found' });

    const { rows: typeRows } = await pool.query(
      `SELECT id, name FROM appeals.appeal_draft_types WHERE id = $1`, [typeId]
    );
    if (!typeRows.length) return res.status(404).json({ error: 'Draft type not found' });
    const draftType = typeRows[0];

    // Fetch key issues with their argument notes
    const { rows: issues } = await pool.query(
      `SELECT pit.id, pit.label, pit.discipline, ain.argument_against, ain.argument_for
       FROM admin_console.project_issue_tracks pit
       LEFT JOIN public.appeal_issue_notes ain
         ON ain.track_id = pit.id AND ain.project_id = $1
       WHERE pit.project_id = $1 AND pit.is_active = TRUE
       ORDER BY pit.sort_order, pit.id`,
      [projectId]
    );

    const { rows: sections } = await pool.query(
      `SELECT * FROM appeals.appeal_draft_sections WHERE draft_type_id = $1 ORDER BY sort_order, id`,
      [typeId]
    );

    const contentHtml = await generateAppealDraft({
      projectName: projectRows[0].project_name,
      draftTypeName: draftType.name,
      sections,
      issues
    });

    // Persist
    const { rows } = await pool.query(
      `INSERT INTO appeals.appeal_drafts (project_id, draft_type_id, content_html, generated_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (project_id, draft_type_id)
       DO UPDATE SET content_html = $3, generated_at = NOW(), updated_at = NOW()
       RETURNING *`,
      [projectId, typeId, contentHtml]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('generateDraft error:', err);
    res.status(500).json({ error: err.message });
  }
}
