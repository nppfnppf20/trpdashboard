import { pool } from '../db.js';
import { parseFile } from '../services/parser.service.js';
import { processConsultationResponse, summariseConsultation, suggestConsultationAdvancementSummaries } from '../services/consultation.service.js';
import { sendEmail } from '../services/emailService.js';

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
      if (!text || text.trim().length < 30) {
        return res.status(422).json({
          error: 'Could not extract readable text from this PDF. It may be a scanned or image-based document, try pasting the text directly instead.',
        });
      }
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
    const [{ rows: responses }, { rows: advancements }, { rows: meta }] = await Promise.all([
      pool.query(
        `SELECT id, consultee_name, date_received, position, comments, action_required, conditions_suggested, status,
                discipline, original_consultant, original_consultant_email,
                source_file_name, sort_order, created_at, updated_at
         FROM planning_applications.consultation_responses
         WHERE project_id = $1
         ORDER BY
           CASE lower(position)
             WHEN 'objection'           THEN 1
             WHEN 'conditional support' THEN 2
             WHEN 'support'             THEN 4
             WHEN 'no comment'          THEN 5
             ELSE                            3
           END ASC,
           date_received ASC NULLS LAST,
           created_at ASC`,
        [projectId]
      ),
      pool.query(
        `SELECT cra.id, cra.response_id, cra.advancement_date, cra.summary,
                cra.full_text, cra.source_type, cra.created_at, cra.updated_at
         FROM planning_applications.consultation_response_advancements cra
         JOIN planning_applications.consultation_responses cr ON cr.id = cra.response_id
         WHERE cr.project_id = $1
         ORDER BY cra.advancement_date DESC, cra.id DESC`,
        [projectId]
      ),
      pool.query(
        `SELECT last_exported_at, last_issued_to_client_at
         FROM planning_applications.consultation_tracker_meta
         WHERE project_id = $1`,
        [projectId]
      ),
    ]);

    const advByResponse = {};
    for (const a of advancements) {
      (advByResponse[a.response_id] ||= []).push(a);
    }
    const withAdvancements = responses.map(r => ({ ...r, advancements: advByResponse[r.id] || [] }));

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
      responses: withAdvancements,
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
  const { consultee_name, date_received, position, comments, action_required, conditions_suggested, status, source_file_name, discipline, original_consultant, original_consultant_email } = req.body;
  if (!consultee_name?.trim()) return res.status(400).json({ error: 'consultee_name is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO planning_applications.consultation_responses
         (project_id, consultee_name, date_received, position, comments, action_required, conditions_suggested,
          status, source_file_name, discipline, original_consultant, original_consultant_email)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        projectId,
        consultee_name.trim(),
        date_received || null,
        position?.trim() || null,
        comments?.trim() || null,
        action_required?.trim() || null,
        conditions_suggested?.trim() || null,
        status?.trim() || 'In Progress',
        source_file_name?.trim() || null,
        discipline?.trim() || null,
        original_consultant?.trim() || null,
        original_consultant_email?.trim() || null,
      ]
    );
    res.status(201).json({ ...rows[0], advancements: [] });
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
  const { consultee_name, date_received, position, comments, action_required, conditions_suggested, status, discipline, original_consultant, original_consultant_email } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE planning_applications.consultation_responses SET
         consultee_name               = COALESCE($2, consultee_name),
         date_received                = CASE WHEN $3  THEN $4  ELSE date_received END,
         position                     = CASE WHEN $5  THEN $6  ELSE position END,
         comments                     = CASE WHEN $7  THEN $8  ELSE comments END,
         action_required              = CASE WHEN $9  THEN $10 ELSE action_required END,
         conditions_suggested         = CASE WHEN $11 THEN $12 ELSE conditions_suggested END,
         status                       = COALESCE($13, status),
         discipline                   = CASE WHEN $14 THEN $15 ELSE discipline END,
         original_consultant          = CASE WHEN $16 THEN $17 ELSE original_consultant END,
         original_consultant_email    = CASE WHEN $18 THEN $19 ELSE original_consultant_email END,
         updated_at                   = NOW()
       WHERE id = $1 RETURNING *`,
      [
        responseId,
        consultee_name != null ? consultee_name.trim() || null : null,
        'date_received' in req.body, date_received || null,
        'position' in req.body, position?.trim() || null,
        'comments' in req.body, comments?.trim() || null,
        'action_required' in req.body, action_required?.trim() || null,
        'conditions_suggested' in req.body, conditions_suggested?.trim() || null,
        status?.trim() || null,
        'discipline' in req.body, discipline?.trim() || null,
        'original_consultant' in req.body, original_consultant?.trim() || null,
        'original_consultant_email' in req.body, original_consultant_email?.trim() || null,
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
// Advancements: dated progress entries against one or more consultee responses
// ─────────────────────────────────────────────────────────────────────────────

// Batch create: one advancement (date + source text) applied to several
// responses, each with its own summary. Transactional.
export async function createAdvancements(req, res) {
  const { projectId } = req.params;
  const { advancement_date, full_text, source_type, items } = req.body;
  if (!advancement_date) return res.status(400).json({ error: 'advancement_date is required' });
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'At least one response is required' });
  if (items.some(i => !i.summary?.trim())) return res.status(400).json({ error: 'Each selected response needs a summary' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const created = [];
    for (const item of items) {
      const { rows } = await client.query(
        `INSERT INTO planning_applications.consultation_response_advancements
           (response_id, advancement_date, summary, full_text, source_type)
         SELECT $1, $2, $3, $4, $5
         WHERE EXISTS (
           SELECT 1 FROM planning_applications.consultation_responses cr
           WHERE cr.id = $1 AND cr.project_id = $6
         )
         RETURNING *`,
        [
          item.response_id,
          advancement_date,
          item.summary.trim(),
          full_text?.trim() || null,
          source_type?.trim() || 'note',
          projectId,
        ]
      );
      if (!rows[0]) throw new Error(`Response ${item.response_id} does not belong to this project`);
      created.push(rows[0]);
    }
    await client.query('COMMIT');
    res.status(201).json(created);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('consultation.createAdvancements error:', err);
    res.status(500).json({ error: 'Failed to save advancement' });
  } finally {
    client.release();
  }
}

// Suggest per-response summaries from source text: reads each response's
// position, comments and previous advancements. User-supplied notes take
// precedence. Among the ticked responses, only those the source material
// actually contains relevant new information for come back with a summary.
export async function suggestAdvancements(req, res) {
  const { projectId } = req.params;
  const { full_text, items } = req.body;
  if (!full_text?.trim()) return res.status(400).json({ error: 'Paste the email trail or note text to summarise from' });
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'At least one response is required' });

  try {
    const ids = items.map(i => i.response_id);
    const [{ rows: responses }, { rows: advancements }] = await Promise.all([
      pool.query(
        `SELECT id, consultee_name, position, comments
         FROM planning_applications.consultation_responses
         WHERE project_id = $1 AND id = ANY($2::int[])`,
        [projectId, ids]
      ),
      pool.query(
        `SELECT response_id, advancement_date::text, summary
         FROM planning_applications.consultation_response_advancements
         WHERE response_id = ANY($1::int[])
         ORDER BY advancement_date DESC, id DESC`,
        [ids]
      ),
    ]);
    if (!responses.length) return res.status(404).json({ error: 'No matching responses found' });

    const advByResponse = {};
    for (const a of advancements) {
      (advByResponse[a.response_id] ||= []).push(a);
    }
    const userSummaries = Object.fromEntries(items.map(i => [i.response_id, i.user_summary?.trim() || null]));

    const enriched = responses.map(r => ({
      ...r,
      advancements: advByResponse[r.id] || [],
      user_summary: userSummaries[r.id] || null,
    }));

    const suggestions = await suggestConsultationAdvancementSummaries(full_text, enriched);
    res.json({ suggestions });
  } catch (err) {
    console.error('consultation.suggestAdvancements error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate summaries' });
  }
}

export async function updateAdvancement(req, res) {
  const { advancementId } = req.params;
  const { advancement_date, summary, full_text, source_type } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE planning_applications.consultation_response_advancements SET
         advancement_date = COALESCE($2, advancement_date),
         summary          = COALESCE($3, summary),
         full_text        = CASE WHEN $4 THEN $5 ELSE full_text END,
         source_type      = COALESCE($6, source_type),
         updated_at       = NOW()
       WHERE id = $1 RETURNING *`,
      [
        advancementId,
        advancement_date || null,
        summary != null ? summary.trim() || null : null,
        'full_text' in req.body, full_text?.trim() || null,
        source_type?.trim() || null,
      ]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('consultation.updateAdvancement error:', err);
    res.status(500).json({ error: 'Failed to update advancement' });
  }
}

export async function deleteAdvancement(req, res) {
  const { advancementId } = req.params;
  try {
    await pool.query(
      `DELETE FROM planning_applications.consultation_response_advancements WHERE id = $1`,
      [advancementId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('consultation.deleteAdvancement error:', err);
    res.status(500).json({ error: 'Failed to delete advancement' });
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

// ─────────────────────────────────────────────────────────────────────────────
// Email a consultation response to the original consultant for review
// ─────────────────────────────────────────────────────────────────────────────

function buildConsultantEmailHtml({ toName, consultee_name, projectName, projectRef, comments, introNote }) {
  // Split comments into issue rows: newlines first, then sentences as fallback
  let lines = (comments || '').split(/\n+/).map(l => l.trim()).filter(Boolean);
  if (lines.length <= 1 && comments) {
    lines = comments.split(/(?<=[.!?])\s+(?=[A-Z])/).map(l => l.trim()).filter(Boolean);
  }
  if (!lines.length) lines = [comments || ''];

  const th = (t) => `<th style="text-align:left;padding:8px 12px;background:#f8fafc;border:1px solid #cbd5e1;font-size:13px;font-weight:600;color:#475569;">${t}</th>`;
  const td = (t, style = '') => `<td style="padding:8px 12px;border:1px solid #cbd5e1;vertical-align:top;font-size:13px;color:#1e293b;${style}">${t}</td>`;

  const dataRows = lines.map(line =>
    `<tr>${td(line)}${td('')}${td('', 'min-width:200px;background:#fafff5;')}</tr>`
  ).join('');

  const blankRows = Array(3).fill(
    `<tr>${td('')}${td('')}${td('', 'min-width:200px;background:#fafff5;')}</tr>`
  ).join('');

  const greeting = toName ? `Hi ${toName},` : 'Hi,';
  const projectLine = [projectRef, projectName].filter(Boolean).join(': ');
  const introBlock = introNote ? `<p style="margin:0 0 16px;">${introNote}</p>` : '';

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#1e293b;max-width:800px;margin:0 auto;padding:32px 24px;">

  <p style="margin:0 0 16px;">${greeting}</p>

  <p style="margin:0 0 16px;">We have received a statutory consultation response from <strong>${consultee_name || 'the consultee'}</strong>${projectLine ? ` in relation to <strong>${projectLine}</strong>` : ''}. Please find this attached for your reference.</p>

  ${introBlock}

  <p style="margin:0 0 16px;">We would be grateful if you could review the key issues raised below and provide your suggested response in the right-hand column. <strong>Please note this is not an exhaustive list</strong>, if you identify any additional issues not captured here, please add them as further rows.</p>

  <table style="border-collapse:collapse;width:100%;margin:0 0 24px;">
    <thead>
      <tr>${th('Issue Raised')}${th('Response / Approach')}${th('Your Response (please complete)')}</tr>
    </thead>
    <tbody>
      ${dataRows}
      ${blankRows}
    </tbody>
  </table>

  <p style="margin:0 0 16px;">Could you please complete the response column at your earliest convenience? If you have any questions, do not hesitate to get in touch.</p>

  <p style="margin:0;">Many thanks for your assistance.</p>

</body></html>`;
}

export async function emailConsultant(req, res) {
  const { responseId } = req.params;
  const { to_email, to_name, subject, intro_note } = req.body;

  if (!to_email?.trim()) return res.status(400).json({ error: 'to_email is required' });

  try {
    // Fetch the response + project info
    const { rows: [row] } = await pool.query(
      `SELECT cr.*, p.project_name, p.project_id as project_ref, p.id as int_project_id
       FROM planning_applications.consultation_responses cr
       JOIN public.projects p ON p.id = cr.project_id
       WHERE cr.id = $1`,
      [responseId]
    );
    if (!row) return res.status(404).json({ error: 'Response not found' });

    const html = buildConsultantEmailHtml({
      toName:        to_name?.trim() || null,
      consultee_name: row.consultee_name,
      projectName:   row.project_name,
      projectRef:    row.project_ref,
      comments:      row.comments,
      introNote:     intro_note?.trim() || null,
    });

    const emailSubject = subject?.trim()
      || `Consultation Response Review: ${row.consultee_name || 'Consultee'}${row.project_ref ? ` (${row.project_ref})` : ''}`;

    const result = await sendEmail({
      to:        to_email.trim(),
      subject:   emailSubject,
      html,
      type:      'consultation_consultant_review',
      projectId: row.int_project_id,
    });

    // Stamp the timestamp on the response row
    const { rows: [updated] } = await pool.query(
      `UPDATE planning_applications.consultation_responses
          SET last_emailed_consultant_at = NOW(), updated_at = NOW()
        WHERE id = $1 RETURNING *`,
      [responseId]
    );

    res.json({ result, response: updated });
  } catch (err) {
    console.error('consultation.emailConsultant error:', err);
    res.status(500).json({ error: 'Failed to send email', details: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Summarise outstanding consultation issues for a project
// ─────────────────────────────────────────────────────────────────────────────

export async function summarise(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT consultee_name, position, comments, status
       FROM planning_applications.consultation_responses
       WHERE project_id = $1
       ORDER BY
         CASE lower(position)
           WHEN 'objection'           THEN 1
           WHEN 'conditional support' THEN 2
           WHEN 'support'             THEN 4
           WHEN 'no comment'          THEN 5
           ELSE                            3
         END ASC`,
      [projectId]
    );
    if (!rows.length) return res.status(400).json({ error: 'No consultation responses to summarise' });
    const summary = await summariseConsultation(rows);
    res.json({ summary });
  } catch (err) {
    console.error('consultation.summarise error:', err);
    res.status(500).json({ error: 'Failed to summarise consultation responses', details: err.message });
  }
}
