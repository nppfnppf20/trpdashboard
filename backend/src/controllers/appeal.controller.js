/**
 * Appeal Controller
 * Handles the appeal drafting tool: living argument document + document review workflow.
 */

import { pool } from '../db.js';
import { parseFile } from '../services/parser.service.js';
import { getGuidingBrief } from './guidingBriefs.controller.js';
import { generateAppealArgument, reviewDocumentAgainstArgument, extractPointsFromDocument, buildExtractPointsPrompt, buildExtractPointsTemplate, generateAppealDraft, generateDraftSection, suggestArgumentAddition, buildArgumentSuggestionTemplate, draftIssueArgumentsFromBriefing, draftArgumentsFromIssueSummaries, draftKeyIssueSummariesFromBriefing, evolveArgumentFromBriefing, chatArgumentWithBriefing, summariseDocument, incorporateDocument, buildIssueContext, scopeDocumentIncorporation, incorporateTargetedParagraphs, DEFAULT_GENERATE_APPEAL_ARGUMENT_PROMPT, DEFAULT_INCORPORATE_APPEAL_PROMPT, DEFAULT_DRAFT_ARGUMENTS_PROMPT, DEFAULT_DRAFT_KEY_SUMMARIES_PROMPT, DEFAULT_SCOPE_INCORPORATION_PROMPT } from '../services/llm.service.js';
import { generateAppealDraftFromPrompt, DEFAULT_DRAFT_PROMPT, DEFAULT_PA_APPEAL_DRAFT_PROMPT } from '../services/appeal.service.js';

// Keys that this controller reads from admin_console.llm_prompts
const APPEAL_PROMPT_KEYS = new Set([
  'generate_appeal_argument',
  'incorporate_appeal',
  'draft_arguments_from_briefing',
  'draft_key_summaries',
  'scope_incorporation',
]);

async function loadGlobalPrompt(key) {
  const { rows } = await pool.query(
    `SELECT prompt_text FROM admin_console.llm_prompts WHERE prompt_key = $1`, [key]
  );
  return rows[0]?.prompt_text ?? null;
}

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

    const { rows: pointRows } = await pool.query(
      `SELECT track_id, field, headline, detailed_summary
       FROM planning_applications.argument_points
       WHERE project_id = $1 AND accepted = TRUE
       ORDER BY track_id, created_at`,
      [projectId]
    );
    const argumentPoints = {};
    for (const row of pointRows) {
      if (!argumentPoints[row.track_id]) argumentPoints[row.track_id] = [];
      argumentPoints[row.track_id].push(row);
    }

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
        ?? buildExtractPointsTemplate({ allIssues, targetIssues, documentType, documentDirection, userNotes, argumentPoints });
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
      argumentPoints,
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
      initialNotes: initial_notes ?? null,
      customPrompt: await loadGlobalPrompt('generate_appeal_argument')
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
    const { text, warning } = await parseFile(req.file.buffer, req.file.originalname);

    const { rows } = await pool.query(
      `INSERT INTO public.appeal_documents (project_id, filename, file_text, review_status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING id, project_id, filename, review_status, uploaded_at`,
      [projectId, req.file.originalname, text]
    );

    const doc = rows[0];
    if (warning) doc.warning = warning;
    res.status(201).json(doc);
  } catch (err) {
    console.error('uploadDocument error:', err);
    res.status(500).json({ error: 'Failed to upload document' });
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

// ─────────────────────────────────────────────────────────────────────────────
// Document log
// ─────────────────────────────────────────────────────────────────────────────

export async function getDocumentLog(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT id, project_id, title, code, document_summary, argument_points, logged_at
       FROM appeals.appeal_document_log
       WHERE project_id = $1
       ORDER BY logged_at DESC`,
      [projectId]
    );
    res.json(rows);
  } catch (err) {
    console.error('getDocumentLog error:', err);
    res.status(500).json({ error: 'Failed to fetch document log' });
  }
}

export async function createDocumentLogEntry(req, res) {
  const { projectId } = req.params;
  const { title, code, document_summary, argument_points } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO appeals.appeal_document_log (project_id, title, code, document_summary, argument_points)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [projectId, title.trim(), code?.trim() || null, document_summary?.trim() || null, JSON.stringify(argument_points ?? [])]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('createDocumentLogEntry error:', err);
    res.status(500).json({ error: 'Failed to create log entry' });
  }
}

export async function deleteDocumentLogEntry(req, res) {
  const { entryId } = req.params;
  try {
    const { rows } = await pool.query(
      `DELETE FROM appeals.appeal_document_log WHERE id = $1 RETURNING id`,
      [entryId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Log entry not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('appeal.deleteDocumentLogEntry error:', err);
    res.status(500).json({ error: 'Failed to delete log entry' });
  }
}

export async function updateDocumentLogEntry(req, res) {
  const { entryId } = req.params;
  const { title, code, document_summary, argument_points } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
  try {
    const { rows } = await pool.query(
      `UPDATE appeals.appeal_document_log
       SET title = $1, code = $2, document_summary = $3, argument_points = $4
       WHERE id = $5
       RETURNING *`,
      [title.trim(), code?.trim() || null, document_summary?.trim() || null,
       JSON.stringify(argument_points ?? []), entryId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Log entry not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('appeal.updateDocumentLogEntry error:', err);
    res.status(500).json({ error: 'Failed to update log entry' });
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
      `SELECT project_name, development_type FROM public.projects WHERE id = $1`, [projectId]
    );
    if (!projectRows.length) return res.status(404).json({ error: 'Project not found' });

    const { rows: typeRows } = await pool.query(
      `SELECT name, slug FROM appeals.appeal_draft_types WHERE id = $1`, [typeId]
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

    const guidingBrief = await getGuidingBrief(typeRows[0].slug, projectRows[0].development_type);

    const html = await generateDraftSection({
      section: sectionRows[0],
      projectName: projectRows[0].project_name,
      draftTypeName: typeRows[0].name,
      issueContext,
      guidingBrief
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
      `SELECT id, project_id, draft_type_id, content_html, generated_at, updated_at,
              example_doc_filename
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

export async function getDraftContext(req, res) {
  const { projectId, typeId } = req.params;
  try {
    const { rows: projectRows } = await pool.query(
      `SELECT project_name, development_type FROM public.projects WHERE id = $1`, [projectId]
    );
    if (!projectRows.length) return res.status(404).json({ error: 'Project not found' });

    const { rows: typeRows } = await pool.query(
      `SELECT name, slug FROM appeals.appeal_draft_types WHERE id = $1`, [typeId]
    );
    if (!typeRows.length) return res.status(404).json({ error: 'Draft type not found' });

    const [{ projectBrief, guidingBrief }, exampleDoc] = await Promise.all([
      fetchPromptContext(projectId, typeRows[0].slug, projectRows[0].development_type),
      fetchExampleDoc(projectId, typeId)
    ]);

    res.json({
      guidingBrief: guidingBrief ? {
        name: guidingBrief.name,
        content: guidingBrief.guidance_content ?? null
      } : null,
      projectBrief: projectBrief ?? null,
      exampleDoc: exampleDoc ? { filename: exampleDoc.filename } : null
    });
  } catch (err) {
    console.error('getDraftContext error:', err);
    res.status(500).json({ error: err.message });
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
      `SELECT project_name, development_type FROM public.projects WHERE id = $1`, [projectId]
    );
    if (!projectRows.length) return res.status(404).json({ error: 'Project not found' });

    const { rows: typeRows } = await pool.query(
      `SELECT id, name, slug FROM appeals.appeal_draft_types WHERE id = $1`, [typeId]
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

    const { projectBrief, guidingBrief } = await fetchPromptContext(projectId, draftType.slug, projectRows[0].development_type);
    const exampleDoc = await fetchExampleDoc(projectId, typeId);

    const contentHtml = await generateAppealDraft({
      projectName: projectRows[0].project_name,
      draftTypeName: draftType.name,
      sections,
      issues,
      guidingBrief,
      projectBrief,
      exampleDoc
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

// ─────────────────────────────────────────────────────────────────────────────
// PA-notes variants — same as above but read from planning_applications.issue_notes
// ─────────────────────────────────────────────────────────────────────────────

export async function generateDraftFromPaNotes(req, res) {
  const { projectId, typeId } = req.params;
  const { briefingNoteId } = req.body ?? {};
  try {
    const { rows: projectRows } = await pool.query(
      `SELECT project_name, development_type FROM public.projects WHERE id = $1`, [projectId]
    );
    if (!projectRows.length) return res.status(404).json({ error: 'Project not found' });

    const { rows: typeRows } = await pool.query(
      `SELECT id, name, slug, generation_prompt FROM appeals.appeal_draft_types WHERE id = $1`, [typeId]
    );
    if (!typeRows.length) return res.status(404).json({ error: 'Draft type not found' });
    const draftType = typeRows[0];

    const { rows: issues } = await pool.query(
      `SELECT pit.id, pit.label, pit.discipline, ain.argument_against, ain.argument_for
       FROM admin_console.project_issue_tracks pit
       LEFT JOIN planning_applications.issue_notes ain
         ON ain.track_id = pit.id AND ain.project_id = $1
       WHERE pit.project_id = $1 AND pit.is_active = TRUE
       ORDER BY pit.sort_order, pit.id`,
      [projectId]
    );

    // Fetch briefing note (specific by ID, or latest)
    let briefingNoteQuery;
    if (briefingNoteId) {
      briefingNoteQuery = pool.query(
        `SELECT summary_html FROM planning_applications.document_summaries
         WHERE id = $1 AND project_id = $2 AND doc_type = 'briefing_transcript'`,
        [briefingNoteId, projectId]
      );
    } else {
      briefingNoteQuery = pool.query(
        `SELECT summary_html FROM planning_applications.document_summaries
         WHERE project_id = $1 AND doc_type = 'briefing_transcript'
         ORDER BY created_at DESC LIMIT 1`,
        [projectId]
      );
    }
    const [{ rows: briefingRows }, guidingBrief] = await Promise.all([
      briefingNoteQuery,
      getGuidingBrief(draftType.slug, projectRows[0].development_type)
    ]);
    const projectBrief = briefingRows[0]?.summary_html ?? null;

    const contentHtml = await generateAppealDraftFromPrompt({
      projectName: projectRows[0].project_name,
      draftTypeName: draftType.name,
      typePrompt: draftType.generation_prompt,
      issues,
      guidingBrief,
      projectBrief,
    });

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
    console.error('generateDraftFromPaNotes error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function getAppealTypePrompt(req, res) {
  const { typeId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT generation_prompt FROM appeals.appeal_draft_types WHERE id = $1`, [typeId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Draft type not found' });
    res.json({ prompt: rows[0].generation_prompt ?? DEFAULT_DRAFT_PROMPT, isCustom: !!rows[0].generation_prompt });
  } catch (err) {
    console.error('getAppealTypePrompt error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function saveAppealTypePrompt(req, res) {
  const { typeId } = req.params;
  const { prompt } = req.body;
  if (!prompt?.trim()) return res.status(400).json({ error: 'prompt is required' });
  try {
    await pool.query(
      `UPDATE appeals.appeal_draft_types SET generation_prompt = $1 WHERE id = $2`, [prompt.trim(), typeId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('saveAppealTypePrompt error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function resetAppealTypePrompt(req, res) {
  const { typeId } = req.params;
  try {
    await pool.query(`UPDATE appeals.appeal_draft_types SET generation_prompt = NULL WHERE id = $1`, [typeId]);
    res.json({ prompt: DEFAULT_DRAFT_PROMPT, isCustom: false });
  } catch (err) {
    console.error('resetAppealTypePrompt error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function generateSectionFromPaNotes(req, res) {
  const { projectId, typeId, sectionId } = req.params;
  try {
    const { rows: projectRows } = await pool.query(
      `SELECT project_name, development_type FROM public.projects WHERE id = $1`, [projectId]
    );
    if (!projectRows.length) return res.status(404).json({ error: 'Project not found' });

    const { rows: typeRows } = await pool.query(
      `SELECT name, slug FROM appeals.appeal_draft_types WHERE id = $1`, [typeId]
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
       LEFT JOIN planning_applications.issue_notes ain
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

    const guidingBrief = await getGuidingBrief(typeRows[0].slug, projectRows[0].development_type);

    const html = await generateDraftSection({
      section: sectionRows[0],
      projectName: projectRows[0].project_name,
      draftTypeName: typeRows[0].name,
      issueContext,
      guidingBrief
    });

    res.json({ html, section_id: sectionRows[0].id, section_name: sectionRows[0].name });
  } catch (err) {
    console.error('generateSectionFromPaNotes error:', err);
    res.status(500).json({ error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared context fetcher — project brief, guiding brief, example doc
// ─────────────────────────────────────────────────────────────────────────────

export async function uploadDraftExample(req, res) {
  const { projectId, typeId } = req.params;
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const { rows: typeRows } = await pool.query(
      `SELECT slug, name FROM appeals.appeal_draft_types WHERE id = $1`, [typeId]
    );
    if (!typeRows.length) return res.status(404).json({ error: 'Draft type not found' });
    const { slug, name } = typeRows[0];

    const { text, warning } = await parseFile(req.file.buffer, req.file.originalname);
    await pool.query(
      `INSERT INTO admin_console.document_templates (document_type, name, doc_text, filename, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (document_type)
       DO UPDATE SET doc_text = $3, filename = $4, updated_at = NOW()`,
      [slug, name, text, req.file.originalname]
    );
    res.json({ ok: true, filename: req.file.originalname, warning: warning ?? null });
  } catch (err) {
    console.error('uploadDraftExample error:', err);
    res.status(500).json({ error: err.message });
  }
}

async function fetchPromptContext(projectId, typeSlug, developmentType) {
  const [projectBriefRows, guidingBrief] = await Promise.all([
    pool.query(
      `SELECT summary_html FROM planning_applications.document_summaries
       WHERE project_id = $1 AND doc_type = 'briefing_note'
       ORDER BY created_at DESC LIMIT 1`,
      [projectId]
    ),
    getGuidingBrief(typeSlug, developmentType)
  ]);
  return {
    projectBrief: projectBriefRows.rows[0]?.summary_html ?? null,
    guidingBrief
  };
}

async function fetchExampleDoc(projectId, typeId) {
  const { rows: typeRows } = await pool.query(
    `SELECT slug FROM appeals.appeal_draft_types WHERE id = $1`, [typeId]
  );
  if (!typeRows.length) return null;

  const { rows } = await pool.query(
    `SELECT doc_text, filename FROM admin_console.document_templates WHERE document_type = $1`,
    [typeRows[0].slug]
  );
  return rows[0]?.doc_text
    ? { text: rows[0].doc_text, filename: rows[0].filename }
    : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Argument suggestion — prose chat flow
// ─────────────────────────────────────────────────────────────────────────────

export async function suggestArgument(req, res) {
  try {
    const { projectId } = req.params;
    const documentType      = req.body.document_type      || 'Other';
    const documentTitle     = req.body.document_title     || '';
    const documentDirection = req.body.document_direction || 'against';
    const userNotes         = req.body.user_notes         || null;
    const customPrompt      = req.body.custom_prompt      || null;
    const preview           = req.query.preview === 'true';

    const rawIds = req.body.relevant_track_ids;
    let relevantTrackIds = [];
    if (Array.isArray(rawIds)) {
      relevantTrackIds = rawIds;
    } else if (typeof rawIds === 'string' && rawIds.trim()) {
      relevantTrackIds = JSON.parse(rawIds);
    }

    let conversation = [];
    const rawConv = req.body.conversation;
    if (typeof rawConv === 'string' && rawConv.trim()) {
      conversation = JSON.parse(rawConv);
    } else if (Array.isArray(rawConv)) {
      conversation = rawConv;
    }

    let text;
    if (req.file) {
      ({ text } = await parseFile(req.file.buffer, req.file.originalname));
    } else if (req.body.text) {
      text = req.body.text;
    } else if (!preview) {
      return res.status(400).json({ error: 'No file or text provided' });
    }

    // Fetch all active issues with their current argument notes
    const { rows: allIssues } = await pool.query(
      `SELECT pit.id, pit.label, pit.discipline, ain.argument_against, ain.argument_for
       FROM admin_console.project_issue_tracks pit
       LEFT JOIN public.appeal_issue_notes ain
         ON ain.track_id = pit.id AND ain.project_id = $1
       WHERE pit.project_id = $1 AND pit.is_active = TRUE
       ORDER BY pit.sort_order, pit.id`,
      [projectId]
    );

    const issues = relevantTrackIds.length > 0
      ? allIssues.filter(i => relevantTrackIds.includes(i.id))
      : allIssues;

    // Fetch briefing note
    const { rows: briefingRows } = await pool.query(
      `SELECT summary_html FROM planning_applications.document_summaries
       WHERE project_id = $1 AND doc_type = 'briefing_note'
       ORDER BY created_at DESC LIMIT 1`,
      [projectId]
    );
    const briefingNote = briefingRows[0]?.summary_html ?? null;

    // Fetch refusal reasons
    const { rows: refusalRows } = await pool.query(
      `SELECT title, summary, risk_level, is_key_issue
       FROM admin_console.refusal_reasons
       WHERE project_id = $1
       ORDER BY sort_order, id`,
      [projectId]
    );
    const refusalReasons = refusalRows;

    // Fetch saved suggest template for this project
    const { rows: templateRows } = await pool.query(
      `SELECT suggest_argument_template FROM public.appeal_prompt_settings WHERE project_id = $1`,
      [projectId]
    );
    const savedTemplate = templateRows[0]?.suggest_argument_template ?? null;

    if (preview) {
      const template = savedTemplate
        ?? buildArgumentSuggestionTemplate({ documentType, documentTitle, documentDirection, issues, briefingNote, refusalReasons, userNotes });
      return res.json({ template });
    }

    let resolvedCustomPrompt = null;
    if (customPrompt) {
      resolvedCustomPrompt = customPrompt.replace('{{DOCUMENT}}', text.slice(0, 120000));
    } else if (savedTemplate) {
      resolvedCustomPrompt = savedTemplate.replace('{{DOCUMENT}}', text.slice(0, 120000));
    }

    const suggestion = await suggestArgumentAddition({
      text,
      documentType,
      documentTitle,
      documentDirection,
      issues,
      briefingNote,
      refusalReasons,
      userNotes,
      conversation,
      customPrompt: resolvedCustomPrompt
    });

    res.json({ suggestion });
  } catch (err) {
    console.error('suggestArgument error:', err.message, err.stack);
    res.status(500).json({ error: err.message });
  }
}

export async function getSuggestTemplate(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT suggest_argument_template, updated_at FROM public.appeal_prompt_settings WHERE project_id = $1`,
      [projectId]
    );
    res.json(rows[0] ?? null);
  } catch (err) {
    console.error('getSuggestTemplate error:', err);
    res.status(500).json({ error: 'Failed to fetch suggest template' });
  }
}

export async function saveSuggestTemplate(req, res) {
  const { projectId } = req.params;
  const { template } = req.body;
  if (!template?.trim()) return res.status(400).json({ error: 'template is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO public.appeal_prompt_settings (project_id, suggest_argument_template, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (project_id)
       DO UPDATE SET suggest_argument_template = $2, updated_at = NOW()
       RETURNING suggest_argument_template, updated_at`,
      [projectId, template.trim()]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('saveSuggestTemplate error:', err);
    res.status(500).json({ error: 'Failed to save suggest template' });
  }
}

export async function deleteSuggestTemplate(req, res) {
  const { projectId } = req.params;
  try {
    await pool.query(
      `UPDATE public.appeal_prompt_settings SET suggest_argument_template = NULL, updated_at = NOW() WHERE project_id = $1`,
      [projectId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('deleteSuggestTemplate error:', err);
    res.status(500).json({ error: 'Failed to delete suggest template' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Briefing notes (shared storage with planning-application)
// ─────────────────────────────────────────────────────────────────────────────

export async function getBriefingNotes(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT id, title, file_name, created_at FROM planning_applications.document_summaries
       WHERE project_id = $1 AND doc_type = 'briefing_transcript'
       ORDER BY created_at DESC`,
      [projectId]
    );
    res.json(rows);
  } catch (err) {
    console.error('appeal.getBriefingNotes error:', err);
    res.status(500).json({ error: 'Failed to fetch briefing notes' });
  }
}

export async function uploadBriefingNote(req, res) {
  const { projectId } = req.params;
  try {
    let text, fileName;
    if (req.file) {
      ({ text } = await parseFile(req.file.buffer, req.file.originalname));
      fileName = req.file.originalname;
    } else if (req.body.text) {
      text = req.body.text;
      fileName = null;
    } else {
      return res.status(400).json({ error: 'No file or text provided' });
    }
    const title = req.body.title?.trim() || fileName || 'Briefing note';
    const { rows: promptRows } = await pool.query(
      `SELECT prompt_template FROM planning_applications.doc_type_prompts WHERE doc_type = $1`,
      ['briefing_transcript']
    );
    const customPrompt = promptRows[0]?.prompt_template ?? null;
    const summaryHtml = await summariseDocument(text, fileName, 'briefing_transcript', customPrompt);
    const { rows } = await pool.query(
      `INSERT INTO planning_applications.document_summaries
         (project_id, title, file_name, doc_type, summary_html)
       VALUES ($1, $2, $3, 'briefing_transcript', $4) RETURNING id, title, file_name, created_at`,
      [projectId, title, fileName, summaryHtml]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('appeal.uploadBriefingNote error:', err);
    res.status(500).json({ error: err.message || 'Failed to upload briefing note' });
  }
}

export async function draftArgumentsFromBriefing(req, res) {
  const { projectId } = req.params;
  try {
    const briefingNoteId = req.body.briefing_note_id ? parseInt(req.body.briefing_note_id) : null;
    const [{ rows: bsRows }, { rows: issues }] = await Promise.all([
      briefingNoteId
        ? pool.query(
            `SELECT summary_html FROM planning_applications.document_summaries
             WHERE id = $2 AND project_id = $1 AND doc_type = 'briefing_transcript'`,
            [projectId, briefingNoteId]
          )
        : pool.query(
            `SELECT summary_html FROM planning_applications.document_summaries
             WHERE project_id = $1 AND doc_type = 'briefing_transcript' ORDER BY created_at DESC LIMIT 1`,
            [projectId]
          ),
      pool.query(
        `SELECT pit.id, pit.label, pit.discipline, ain.argument_for
         FROM admin_console.project_issue_tracks pit
         LEFT JOIN public.appeal_issue_notes ain
           ON ain.track_id = pit.id AND ain.project_id = $1
         WHERE pit.project_id = $1 AND pit.is_active = TRUE
         ORDER BY pit.sort_order, pit.id`,
        [projectId]
      )
    ]);
    if (!bsRows.length) return res.status(404).json({ error: 'No briefing transcript found for this project. Upload a briefing note first.' });
    const suggestions = await draftIssueArgumentsFromBriefing({ briefingSummary: bsRows[0].summary_html, issues, customPrompt: await loadGlobalPrompt('draft_arguments_from_briefing') });
    const issueMap = Object.fromEntries(issues.map(i => [i.id, i.label]));
    res.json({ suggestions: suggestions.map(s => ({ ...s, label: issueMap[s.track_id] ?? '' })) });
  } catch (err) {
    console.error('appeal.draftArgumentsFromBriefing error:', err);
    res.status(500).json({ error: err.message || 'Failed to draft arguments' });
  }
}

export async function draftArgumentsFromIssueNotes(req, res) {
  const { projectId } = req.params;
  try {
    const { rows: issues } = await pool.query(
      `SELECT pit.id, pit.label, pit.discipline, pit.summary, ain.argument_for
       FROM admin_console.project_issue_tracks pit
       LEFT JOIN public.appeal_issue_notes ain
         ON ain.track_id = pit.id AND ain.project_id = $1
       WHERE pit.project_id = $1 AND pit.is_active = TRUE AND pit.summary IS NOT NULL AND pit.summary != ''
       ORDER BY pit.sort_order, pit.id`,
      [projectId]
    );
    if (!issues.length) return res.status(404).json({ error: 'No key issue notes found. Add position notes in the Key Issues tab first.' });
    const suggestions = await draftArgumentsFromIssueSummaries({ issues, policiesByTrack: {} });
    const issueMap = Object.fromEntries(issues.map(i => [i.id, i.label]));
    res.json({ suggestions: suggestions.map(s => ({ ...s, label: issueMap[s.track_id] ?? '' })) });
  } catch (err) {
    console.error('appeal.draftArgumentsFromIssueNotes error:', err);
    res.status(500).json({ error: err.message || 'Failed to draft arguments from issue notes' });
  }
}

export async function draftKeySummariesFromBriefing(req, res) {
  const { projectId } = req.params;
  try {
    const briefingNoteId = req.body.briefing_note_id ? parseInt(req.body.briefing_note_id) : null;
    const [{ rows: bsRows }, { rows: issues }] = await Promise.all([
      briefingNoteId
        ? pool.query(
            `SELECT summary_html FROM planning_applications.document_summaries
             WHERE id = $2 AND project_id = $1 AND doc_type = 'briefing_transcript'`,
            [projectId, briefingNoteId]
          )
        : pool.query(
            `SELECT summary_html FROM planning_applications.document_summaries
             WHERE project_id = $1 AND doc_type = 'briefing_transcript' ORDER BY created_at DESC LIMIT 1`,
            [projectId]
          ),
      pool.query(
        `SELECT id, label, discipline, summary
         FROM admin_console.project_issue_tracks
         WHERE project_id = $1 AND is_active = TRUE
         ORDER BY sort_order, id`,
        [projectId]
      )
    ]);
    if (!bsRows.length) return res.status(404).json({ error: 'No briefing transcript found for this project.' });
    const suggestions = await draftKeyIssueSummariesFromBriefing({ briefingSummary: bsRows[0].summary_html, issues, customPrompt: await loadGlobalPrompt('draft_key_summaries') });
    const issueMap = Object.fromEntries(issues.map(i => [i.id, i.label]));
    res.json({ suggestions: suggestions.map(s => ({ ...s, label: issueMap[s.track_id] ?? '' })) });
  } catch (err) {
    console.error('appeal.draftKeySummariesFromBriefing error:', err);
    res.status(500).json({ error: err.message || 'Failed to draft key issue summaries' });
  }
}

export async function evolveArgument(req, res) {
  const { projectId } = req.params;
  const { track_id, new_information, conversation } = req.body;
  if (!track_id || !new_information?.trim()) {
    return res.status(400).json({ error: 'track_id and new_information are required' });
  }
  try {
    const [{ rows: issueRows }, { rows: noteRows }] = await Promise.all([
      pool.query(
        `SELECT label FROM admin_console.project_issue_tracks WHERE id = $1 AND project_id = $2`,
        [track_id, projectId]
      ),
      pool.query(
        `SELECT argument_for FROM public.appeal_issue_notes WHERE track_id = $1 AND project_id = $2`,
        [track_id, projectId]
      )
    ]);
    if (!issueRows.length) return res.status(404).json({ error: 'Issue not found' });
    const evolved = await evolveArgumentFromBriefing({
      issueLabel: issueRows[0].label,
      existingArgument: noteRows[0]?.argument_for ?? '',
      newInformation: new_information,
      conversation: conversation ?? []
    });
    res.json({ evolved });
  } catch (err) {
    console.error('appeal.evolveArgument error:', err);
    res.status(500).json({ error: err.message || 'Failed to evolve argument' });
  }
}

export async function chatArgument(req, res) {
  const { projectId } = req.params;
  const { track_id, briefing_note_id, conversation } = req.body;
  if (!track_id || !Array.isArray(conversation) || !conversation.length) {
    return res.status(400).json({ error: 'track_id and conversation are required' });
  }
  try {
    const briefingNoteId = briefing_note_id ? parseInt(briefing_note_id) : null;
    const briefingQuery = briefingNoteId
      ? pool.query(
          `SELECT summary_html FROM planning_applications.document_summaries WHERE id = $2 AND project_id = $1 AND doc_type = 'briefing_transcript'`,
          [projectId, briefingNoteId]
        )
      : pool.query(
          `SELECT summary_html FROM planning_applications.document_summaries WHERE project_id = $1 AND doc_type = 'briefing_transcript' ORDER BY created_at DESC LIMIT 1`,
          [projectId]
        );

    const [{ rows: issueRows }, { rows: noteRows }, { rows: bRows }] = await Promise.all([
      pool.query(`SELECT label FROM admin_console.project_issue_tracks WHERE id = $1 AND project_id = $2`, [track_id, projectId]),
      pool.query(`SELECT argument_for FROM public.appeal_issue_notes WHERE track_id = $1 AND project_id = $2`, [track_id, projectId]),
      briefingQuery
    ]);

    if (!issueRows.length) return res.status(404).json({ error: 'Issue not found' });

    const evolved = await chatArgumentWithBriefing({
      issueLabel: issueRows[0].label,
      existingArgument: noteRows[0]?.argument_for ?? '',
      briefingContent: bRows[0]?.summary_html ?? '',
      conversation
    });
    res.json({ evolved });
  } catch (err) {
    console.error('appeal.chatArgument error:', err);
    res.status(500).json({ error: err.message || 'Failed to chat argument' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Document incorporation — two-panel interactive flow
// ─────────────────────────────────────────────────────────────────────────────

export async function incorporateDocumentIntoTdraft(req, res) {
  const { projectId, typeId } = req.params;
  const { document_id, document_text, document_title, user_notes = null, conversation = [] } = req.body;

  if (!document_id && !document_text) {
    return res.status(400).json({ error: 'document_id or document_text is required' });
  }

  try {
    const { rows: projectRows } = await pool.query(
      `SELECT project_name, development_type FROM public.projects WHERE id = $1`, [projectId]
    );
    if (!projectRows.length) return res.status(404).json({ error: 'Project not found' });

    const { rows: typeRows } = await pool.query(
      `SELECT id, name, slug FROM appeals.appeal_draft_types WHERE id = $1`, [typeId]
    );
    if (!typeRows.length) return res.status(404).json({ error: 'Draft type not found' });

    // Current working draft
    const { rows: draftRows } = await pool.query(
      `SELECT content_html FROM appeals.appeal_drafts WHERE project_id = $1 AND draft_type_id = $2`,
      [projectId, typeId]
    );
    const currentDraftHtml = draftRows[0]?.content_html ?? '';

    // Resolve document text — either from DB record or directly from request
    let documentText, docLabel;
    if (document_id) {
      const { rows: docRows } = await pool.query(
        `SELECT filename, file_text FROM public.appeal_documents WHERE id = $1 AND project_id = $2`,
        [document_id, projectId]
      );
      if (!docRows.length) return res.status(404).json({ error: 'Document not found' });
      documentText = docRows[0].file_text ?? '';
      docLabel = docRows[0].filename;
    } else {
      documentText = document_text;
      docLabel = document_title || 'Pasted document';
    }

    // Issues with argument notes
    const { rows: issues } = await pool.query(
      `SELECT pit.id, pit.label, pit.discipline, ain.argument_against, ain.argument_for
       FROM admin_console.project_issue_tracks pit
       LEFT JOIN public.appeal_issue_notes ain
         ON ain.track_id = pit.id AND ain.project_id = $1
       WHERE pit.project_id = $1 AND pit.is_active = TRUE
       ORDER BY pit.sort_order, pit.id`,
      [projectId]
    );

    const guidingBrief = await getGuidingBrief(typeRows[0].slug, projectRows[0].development_type);

    const updatedHtml = await incorporateDocument({
      projectName: projectRows[0].project_name,
      draftTypeName: typeRows[0].name,
      currentDraftHtml,
      documentText,
      issues,
      userNotes: user_notes,
      guidingBrief,
      conversation
    });

    res.json({ content_html: updatedHtml, doc_label: docLabel });
  } catch (err) {
    console.error('incorporateDocument error:', err);
    res.status(500).json({ error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Scoped incorporation — Step 1: scope which paragraphs are relevant
// ─────────────────────────────────────────────────────────────────────────────

export async function scopeIncorporation(req, res) {
  const { projectId, typeId } = req.params;
  const { document_id, document_text, document_title, paragraphs } = req.body;

  if (!paragraphs?.length) return res.status(400).json({ error: 'paragraphs required' });
  if (!document_id && !document_text) return res.status(400).json({ error: 'document_id or document_text required' });

  try {
    const { rows: projectRows } = await pool.query(
      `SELECT development_type FROM public.projects WHERE id = $1`, [projectId]
    );
    const { rows: typeRows } = await pool.query(
      `SELECT slug FROM appeals.appeal_draft_types WHERE id = $1`, [typeId]
    );

    let documentText, filename;
    if (document_id) {
      const { rows } = await pool.query(
        `SELECT filename, file_text FROM public.appeal_documents WHERE id = $1 AND project_id = $2`,
        [document_id, projectId]
      );
      if (!rows.length) return res.status(404).json({ error: 'Document not found' });
      documentText = rows[0].file_text ?? '';
      filename = rows[0].filename;
    } else {
      documentText = document_text;
      filename = document_title || 'Pasted document';
    }

    const [issueRows, { guidingBrief }] = await Promise.all([
      pool.query(
        `SELECT pit.id, pit.label, pit.discipline, ain.argument_against, ain.argument_for
         FROM admin_console.project_issue_tracks pit
         LEFT JOIN public.appeal_issue_notes ain
           ON ain.track_id = pit.id AND ain.project_id = $1
         WHERE pit.project_id = $1 AND pit.is_active = TRUE
         ORDER BY pit.sort_order, pit.id`,
        [projectId]
      ),
      fetchPromptContext(projectId, typeRows[0]?.slug, projectRows[0]?.development_type)
    ]);

    const result = await scopeDocumentIncorporation({
      paragraphs,
      documentText,
      filename,
      issues: issueRows.rows,
      guidingBrief,
      customPrompt: await loadGlobalPrompt('scope_incorporation')
    });
    res.json({ ...result, filename });
  } catch (err) {
    console.error('scopeIncorporation error:', err);
    res.status(500).json({ error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Scoped incorporation — Step 2: update only targeted paragraphs
// ─────────────────────────────────────────────────────────────────────────────

export async function incorporateTargeted(req, res) {
  const { projectId, typeId } = req.params;
  const { document_id, document_text, document_title, paragraphs, user_notes = null } = req.body;

  if (!paragraphs?.length) return res.status(400).json({ error: 'paragraphs required' });
  if (!document_id && !document_text) return res.status(400).json({ error: 'document_id or document_text required' });

  try {
    const { rows: projectRows } = await pool.query(
      `SELECT project_name, development_type FROM public.projects WHERE id = $1`, [projectId]
    );
    const { rows: typeRows } = await pool.query(
      `SELECT name, slug FROM appeals.appeal_draft_types WHERE id = $1`, [typeId]
    );

    let documentText, filename;
    if (document_id) {
      const { rows } = await pool.query(
        `SELECT filename, file_text FROM public.appeal_documents WHERE id = $1 AND project_id = $2`,
        [document_id, projectId]
      );
      if (!rows.length) return res.status(404).json({ error: 'Document not found' });
      documentText = rows[0].file_text ?? '';
      filename = rows[0].filename;
    } else {
      documentText = document_text;
      filename = document_title || 'Pasted document';
    }

    const [issueRows, { projectBrief, guidingBrief }, exampleDoc] = await Promise.all([
      pool.query(
        `SELECT pit.id, pit.label, pit.discipline, ain.argument_against, ain.argument_for
         FROM admin_console.project_issue_tracks pit
         LEFT JOIN public.appeal_issue_notes ain
           ON ain.track_id = pit.id AND ain.project_id = $1
         WHERE pit.project_id = $1 AND pit.is_active = TRUE
         ORDER BY pit.sort_order, pit.id`,
        [projectId]
      ),
      fetchPromptContext(projectId, typeRows[0]?.slug, projectRows[0]?.development_type),
      fetchExampleDoc(projectId, typeId)
    ]);

    const updated = await incorporateTargetedParagraphs({
      paragraphs,
      documentText,
      filename,
      issues: issueRows.rows,
      userNotes: user_notes,
      projectName: projectRows[0]?.project_name,
      draftTypeName: typeRows[0]?.name,
      guidingBrief,
      projectBrief,
      exampleDoc,
      customPrompt: await loadGlobalPrompt('incorporate_appeal')
    });
    res.json({ updated });
  } catch (err) {
    console.error('incorporateTargeted error:', err);
    res.status(500).json({ error: err.message });
  }
}
