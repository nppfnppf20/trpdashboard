/**
 * Appeal Controller
 * Handles the appeal drafting tool: living argument document + document review workflow.
 */

import { pool } from '../db.js';
import { parseFile } from '../services/parser.service.js';
import { generateAppealArgument, reviewDocumentAgainstArgument } from '../services/llm.service.js';

// ─────────────────────────────────────────────────────────────────────────────
// Key issues
// ─────────────────────────────────────────────────────────────────────────────

export async function getKeyIssues(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT id, label, discipline_group, sort_order, last_known_risk_level
       FROM admin_console.project_key_issues
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
