import { pool } from '../db.js';
import { parseFile } from '../services/parser.service.js';
import { processConsultationResponse } from '../services/consultation.service.js';

// ─────────────────────────────────────────────────────────────────────────────
// Process a consultation document: parse → LLM → return suggestion (no save)
// ─────────────────────────────────────────────────────────────────────────────

export async function processConsultation(req, res) {
  try {
    const { projectId } = req.params;
    const { user_notes } = req.body;

    // Fetch project to get development_type for guiding brief lookup
    const { rows: [project] } = await pool.query(
      `SELECT development_type FROM public.projects WHERE id = $1`,
      [projectId]
    );

    let text;
    let fileName;
    if (req.file) {
      ({ text } = await parseFile(req.file.buffer, req.file.originalname));
      fileName = req.file.originalname;
    } else if (req.body.text) {
      text = req.body.text;
      fileName = req.body.file_name || null;
    } else {
      return res.status(400).json({ error: 'No file or text provided' });
    }

    const suggestion = await processConsultationResponse(
      text,
      fileName,
      project?.development_type || null,
      user_notes?.trim() || null
    );

    res.json({ suggestion, source_file_name: fileName });
  } catch (err) {
    console.error('consultation.processConsultation error:', err);
    res.status(500).json({ error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Get all responses + tracker meta for a project
// ─────────────────────────────────────────────────────────────────────────────

export async function getConsultationData(req, res) {
  const { projectId } = req.params;
  try {
    const [{ rows: responses }, { rows: meta }] = await Promise.all([
      pool.query(
        `SELECT id, consultee_name, date_received, position, comments,
                consultant_response, response_issued, follow_up,
                discipline, original_consultant, original_consultant_email,
                source_file_name, sort_order, created_at, updated_at
         FROM planning_applications.consultation_responses
         WHERE project_id = $1
         ORDER BY sort_order ASC, date_received ASC NULLS LAST, created_at ASC`,
        [projectId]
      ),
      pool.query(
        `SELECT last_exported_at, last_issued_to_client_at
         FROM planning_applications.consultation_tracker_meta
         WHERE project_id = $1`,
        [projectId]
      ),
    ]);

    // Consultants on this project (via quotes) — fail-safe: empty array if query errors
    let availableConsultants = [];
    try {
      const { rows } = await pool.query(
        `SELECT DISTINCT ON (so.id)
                so.id, so.organisation, so.discipline,
                c.name  AS contact_name,
                c.email AS contact_email
         FROM admin_console.quotes q
         JOIN public.projects p ON p.unique_id = q.project_id
         JOIN admin_console.surveyor_organisations so ON so.id = q.surveyor_organisation_id
         LEFT JOIN admin_console.contacts c
           ON c.organisation_id = so.id
          AND c.organisation_type = 'surveyor'
          AND c.is_primary = true
         WHERE p.id = $1
         ORDER BY so.id, so.discipline, so.organisation`,
        [projectId]
      );
      availableConsultants = rows;
    } catch (consultantErr) {
      console.error('consultation.getConsultationData: availableConsultants query failed (non-fatal):', consultantErr.message);
    }

    res.json({
      responses,
      meta: meta[0] || { last_exported_at: null, last_issued_to_client_at: null },
      availableConsultants,
    });
  } catch (err) {
    console.error('consultation.getConsultationData error:', err);
    res.status(500).json({ error: 'Failed to fetch consultation data' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Create a single response row
// ─────────────────────────────────────────────────────────────────────────────

export async function createResponse(req, res) {
  const { projectId } = req.params;
  const { consultee_name, date_received, position, comments, consultant_response, response_issued, follow_up, source_file_name, discipline, original_consultant, original_consultant_email } = req.body;
  if (!consultee_name?.trim()) return res.status(400).json({ error: 'consultee_name is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO planning_applications.consultation_responses
         (project_id, consultee_name, date_received, position, comments,
          consultant_response, response_issued, follow_up, source_file_name,
          discipline, original_consultant, original_consultant_email)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        projectId,
        consultee_name.trim(),
        date_received || null,
        position?.trim() || null,
        comments?.trim() || null,
        consultant_response?.trim() || null,
        response_issued === true || response_issued === 'true',
        follow_up?.trim() || null,
        source_file_name?.trim() || null,
        discipline?.trim() || null,
        original_consultant?.trim() || null,
        original_consultant_email?.trim() || null,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('consultation.createResponse error:', err);
    res.status(500).json({ error: 'Failed to create consultation response' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Update a response row
// ─────────────────────────────────────────────────────────────────────────────

export async function updateResponse(req, res) {
  const { responseId } = req.params;
  const { consultee_name, date_received, position, comments, consultant_response, response_issued, follow_up, discipline, original_consultant, original_consultant_email } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE planning_applications.consultation_responses SET
         consultee_name               = COALESCE($2, consultee_name),
         date_received                = $3,
         position                     = $4,
         comments                     = $5,
         consultant_response          = $6,
         response_issued              = COALESCE($7, response_issued),
         follow_up                    = $8,
         discipline                   = $9,
         original_consultant          = $10,
         original_consultant_email    = $11,
         updated_at                   = NOW()
       WHERE id = $1 RETURNING *`,
      [
        responseId,
        consultee_name?.trim() || null,
        date_received || null,
        position?.trim() || null,
        comments?.trim() || null,
        consultant_response?.trim() || null,
        response_issued != null ? (response_issued === true || response_issued === 'true') : null,
        follow_up?.trim() || null,
        discipline?.trim() || null,
        original_consultant?.trim() || null,
        original_consultant_email?.trim() || null,
      ]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('consultation.updateResponse error:', err);
    res.status(500).json({ error: 'Failed to update consultation response' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete a response row
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteResponse(req, res) {
  const { responseId } = req.params;
  try {
    await pool.query(
      `DELETE FROM planning_applications.consultation_responses WHERE id = $1`,
      [responseId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('consultation.deleteResponse error:', err);
    res.status(500).json({ error: 'Failed to delete consultation response' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stamp last_exported_at
// ─────────────────────────────────────────────────────────────────────────────

export async function markExported(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `INSERT INTO planning_applications.consultation_tracker_meta (project_id, last_exported_at)
       VALUES ($1, NOW())
       ON CONFLICT (project_id) DO UPDATE SET last_exported_at = NOW(), updated_at = NOW()
       RETURNING last_exported_at, last_issued_to_client_at`,
      [projectId]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('consultation.markExported error:', err);
    res.status(500).json({ error: 'Failed to update export timestamp' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stamp last_issued_to_client_at (placeholder — email not yet wired)
// ─────────────────────────────────────────────────────────────────────────────

export async function markIssuedToClient(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `INSERT INTO planning_applications.consultation_tracker_meta (project_id, last_issued_to_client_at)
       VALUES ($1, NOW())
       ON CONFLICT (project_id) DO UPDATE SET last_issued_to_client_at = NOW(), updated_at = NOW()
       RETURNING last_exported_at, last_issued_to_client_at`,
      [projectId]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('consultation.markIssuedToClient error:', err);
    res.status(500).json({ error: 'Failed to update issue timestamp' });
  }
}
