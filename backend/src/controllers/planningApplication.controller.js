/**
 * Planning Application Controller
 * Issue notes, document analysis, draft documents, document log.
 */

import { pool } from '../db.js';
import { parseFile } from '../services/parser.service.js';
import {
  extractPointsFromDocument,
  buildExtractPointsTemplate,
  generateAppealDraft,
  generateDraftSection
} from '../services/llm.service.js';

const SCHEMA = 'planning_applications';

// ─────────────────────────────────────────────────────────────────────────────
// Policy-track relevance
// ─────────────────────────────────────────────────────────────────────────────

export async function getPolicyTrackRelevance(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT ptr.policy_id, ptr.track_id
       FROM planning_applications.policy_track_relevance ptr
       JOIN public.project_policies pp ON pp.id = ptr.policy_id
       WHERE pp.project_id = $1`,
      [projectId]
    );
    // Return as { [track_id]: [policy_id, ...] }
    const map = {};
    for (const row of rows) {
      if (!map[row.track_id]) map[row.track_id] = [];
      map[row.track_id].push(row.policy_id);
    }
    res.json(map);
  } catch (err) {
    console.error('pa.getPolicyTrackRelevance error:', err);
    res.status(500).json({ error: 'Failed to fetch policy relevance' });
  }
}

export async function togglePolicyTrack(req, res) {
  const { policyId, trackId } = req.params;
  try {
    const { rows: existing } = await pool.query(
      `SELECT 1 FROM planning_applications.policy_track_relevance WHERE policy_id = $1 AND track_id = $2`,
      [policyId, trackId]
    );
    if (existing.length) {
      await pool.query(
        `DELETE FROM planning_applications.policy_track_relevance WHERE policy_id = $1 AND track_id = $2`,
        [policyId, trackId]
      );
      res.json({ linked: false });
    } else {
      await pool.query(
        `INSERT INTO planning_applications.policy_track_relevance (policy_id, track_id) VALUES ($1, $2)`,
        [policyId, trackId]
      );
      res.json({ linked: true });
    }
  } catch (err) {
    console.error('pa.togglePolicyTrack error:', err);
    res.status(500).json({ error: 'Failed to toggle policy relevance' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Key issues (shared table — read only from here)
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
    console.error('pa.getKeyIssues error:', err);
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
    console.error('pa.updateKeyIssueSummary error:', err);
    res.status(500).json({ error: 'Failed to update summary' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Issue notes
// ─────────────────────────────────────────────────────────────────────────────

export async function getIssueNotes(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT track_id, policy_national, policy_local, policy_neighbourhood,
              policy_supplementary, policy_other, argument_for, argument_against
       FROM planning_applications.issue_notes
       WHERE project_id = $1`,
      [projectId]
    );
    const map = {};
    for (const row of rows) {
      const { track_id, ...fields } = row;
      map[track_id] = fields;
    }
    res.json(map);
  } catch (err) {
    console.error('pa.getIssueNotes error:', err);
    res.status(500).json({ error: 'Failed to fetch issue notes' });
  }
}

export async function upsertIssueNote(req, res) {
  const { projectId, trackId } = req.params;
  const {
    policy_national, policy_local, policy_neighbourhood, policy_supplementary, policy_other,
    argument_for, argument_against
  } = req.body;

  try {
    const { rows } = await pool.query(
      `INSERT INTO planning_applications.issue_notes
         (project_id, track_id, policy_national, policy_local, policy_neighbourhood,
          policy_supplementary, policy_other, argument_for, argument_against, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (project_id, track_id) DO UPDATE SET
         policy_national       = $3,
         policy_local          = $4,
         policy_neighbourhood  = $5,
         policy_supplementary  = $6,
         policy_other          = $7,
         argument_for          = $8,
         argument_against      = $9,
         updated_at            = NOW()
       RETURNING track_id, policy_national, policy_local, policy_neighbourhood,
                 policy_supplementary, policy_other, argument_for, argument_against, updated_at`,
      [projectId, trackId,
       policy_national ?? null, policy_local ?? null,
       policy_neighbourhood ?? null, policy_supplementary ?? null, policy_other ?? null,
       argument_for ?? null, argument_against ?? null]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('pa.upsertIssueNote error:', err);
    res.status(500).json({ error: 'Failed to save issue note' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Document analysis
// ─────────────────────────────────────────────────────────────────────────────

export async function analyseDocument(req, res) {
  try {
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

    const { rows: allIssues } = await pool.query(
      `SELECT pit.id, pit.label, pit.discipline,
              ain.argument_against, ain.argument_for
       FROM admin_console.project_issue_tracks pit
       LEFT JOIN planning_applications.issue_notes ain
         ON ain.track_id = pit.id AND ain.project_id = $1
       WHERE pit.project_id = $1 AND pit.is_active = TRUE
       ORDER BY pit.sort_order, pit.id`,
      [projectId]
    );

    const targetIssues = relevantTrackIds.length > 0
      ? allIssues.filter(i => relevantTrackIds.includes(i.id))
      : [];

    const { rows: templateRows } = await pool.query(
      `SELECT prompt_text FROM planning_applications.prompt_settings
       WHERE project_id = $1 AND prompt_key = 'extract_points'`,
      [projectId]
    );
    const savedTemplate = templateRows[0]?.prompt_text ?? null;

    if (preview) {
      const template = savedTemplate
        ?? buildExtractPointsTemplate({ allIssues, targetIssues, documentType, documentDirection, userNotes });
      return res.json({ template });
    }

    let resolvedPrompt = null;
    if (customPrompt) {
      resolvedPrompt = customPrompt.replace('{{DOCUMENT}}', text.slice(0, 10000));
    } else if (savedTemplate) {
      resolvedPrompt = savedTemplate.replace('{{DOCUMENT}}', text.slice(0, 10000));
    }

    const result = await extractPointsFromDocument({
      text, allIssues, targetIssues, documentType, documentDirection, userNotes,
      customPrompt: resolvedPrompt
    });

    res.json(result);
  } catch (err) {
    console.error('pa.analyseDocument error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt template
// ─────────────────────────────────────────────────────────────────────────────

export async function getPromptTemplate(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT prompt_text, updated_at FROM planning_applications.prompt_settings
       WHERE project_id = $1 AND prompt_key = 'extract_points'`,
      [projectId]
    );
    res.json(rows[0] ? { extract_points_template: rows[0].prompt_text, updated_at: rows[0].updated_at } : null);
  } catch (err) {
    console.error('pa.getPromptTemplate error:', err);
    res.status(500).json({ error: 'Failed to fetch prompt template' });
  }
}

export async function savePromptTemplate(req, res) {
  const { projectId } = req.params;
  const { template } = req.body;
  if (!template?.trim()) return res.status(400).json({ error: 'template is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO planning_applications.prompt_settings (project_id, prompt_key, prompt_text)
       VALUES ($1, 'extract_points', $2)
       ON CONFLICT (project_id, prompt_key) DO UPDATE SET prompt_text = $2
       RETURNING prompt_text`,
      [projectId, template.trim()]
    );
    res.json({ extract_points_template: rows[0].prompt_text });
  } catch (err) {
    console.error('pa.savePromptTemplate error:', err);
    res.status(500).json({ error: 'Failed to save prompt template' });
  }
}

export async function deletePromptTemplate(req, res) {
  const { projectId } = req.params;
  try {
    await pool.query(
      `DELETE FROM planning_applications.prompt_settings WHERE project_id = $1 AND prompt_key = 'extract_points'`,
      [projectId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('pa.deletePromptTemplate error:', err);
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
       FROM planning_applications.document_log
       WHERE project_id = $1
       ORDER BY logged_at DESC`,
      [projectId]
    );
    res.json(rows);
  } catch (err) {
    console.error('pa.getDocumentLog error:', err);
    res.status(500).json({ error: 'Failed to fetch document log' });
  }
}

export async function createDocumentLogEntry(req, res) {
  const { projectId } = req.params;
  const { title, code, document_summary, argument_points } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO planning_applications.document_log
         (project_id, title, code, document_summary, argument_points)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [projectId, title.trim(), code?.trim() || null,
       document_summary?.trim() || null, JSON.stringify(argument_points ?? [])]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('pa.createDocumentLogEntry error:', err);
    res.status(500).json({ error: 'Failed to create log entry' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Draft types & sections
// ─────────────────────────────────────────────────────────────────────────────

export async function getDraftTypes(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, slug, description, sort_order
       FROM planning_applications.draft_types
       ORDER BY sort_order, id`
    );
    res.json(rows);
  } catch (err) {
    console.error('pa.getDraftTypes error:', err);
    res.status(500).json({ error: 'Failed to fetch draft types' });
  }
}

export async function getSections(req, res) {
  const { typeId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT id, draft_type_id, name, slug, description, sort_order, generation_prompt, example_text
       FROM planning_applications.draft_sections
       WHERE draft_type_id = $1
       ORDER BY sort_order, id`,
      [typeId]
    );
    res.json(rows);
  } catch (err) {
    console.error('pa.getSections error:', err);
    res.status(500).json({ error: 'Failed to fetch sections' });
  }
}

export async function createSection(req, res) {
  const { typeId } = req.params;
  const { name, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

  try {
    const { rows: maxRows } = await pool.query(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
       FROM planning_applications.draft_sections WHERE draft_type_id = $1`,
      [typeId]
    );
    const { rows } = await pool.query(
      `INSERT INTO planning_applications.draft_sections
         (draft_type_id, name, slug, description, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [typeId, name.trim(), slug, description ?? null, maxRows[0].next_order]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('pa.createSection error:', err);
    res.status(500).json({ error: 'Failed to create section' });
  }
}

export async function updateSection(req, res) {
  const { sectionId } = req.params;
  const { name, description, sort_order, generation_prompt, example_text } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE planning_applications.draft_sections
       SET name              = COALESCE($1, name),
           description       = COALESCE($2, description),
           sort_order        = COALESCE($3, sort_order),
           generation_prompt = $4,
           example_text      = $5
       WHERE id = $6
       RETURNING *`,
      [name ?? null, description ?? null, sort_order ?? null,
       generation_prompt ?? null, example_text ?? null, sectionId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Section not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('pa.updateSection error:', err);
    res.status(500).json({ error: 'Failed to update section' });
  }
}

export async function deleteSection(req, res) {
  const { sectionId } = req.params;
  try {
    const { rows } = await pool.query(
      `DELETE FROM planning_applications.draft_sections WHERE id = $1 RETURNING id`,
      [sectionId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Section not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('pa.deleteSection error:', err);
    res.status(500).json({ error: 'Failed to delete section' });
  }
}

export async function reorderSections(req, res) {
  const { typeId } = req.params;
  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array of ids' });
  try {
    await Promise.all(order.map((id, idx) =>
      pool.query(
        `UPDATE planning_applications.draft_sections SET sort_order = $1 WHERE id = $2 AND draft_type_id = $3`,
        [idx, id, typeId]
      )
    ));
    const { rows } = await pool.query(
      `SELECT * FROM planning_applications.draft_sections WHERE draft_type_id = $1 ORDER BY sort_order, id`,
      [typeId]
    );
    res.json(rows);
  } catch (err) {
    console.error('pa.reorderSections error:', err);
    res.status(500).json({ error: 'Failed to reorder sections' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Drafts
// ─────────────────────────────────────────────────────────────────────────────

export async function getDraft(req, res) {
  const { projectId, typeId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT id, project_id, draft_type_id, content_html, generated_at, updated_at
       FROM planning_applications.drafts
       WHERE project_id = $1 AND draft_type_id = $2`,
      [projectId, typeId]
    );
    res.json(rows[0] ?? null);
  } catch (err) {
    console.error('pa.getDraft error:', err);
    res.status(500).json({ error: 'Failed to fetch draft' });
  }
}

export async function saveDraft(req, res) {
  const { projectId, typeId } = req.params;
  const { content_html } = req.body;
  if (content_html === undefined) return res.status(400).json({ error: 'content_html is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO planning_applications.drafts (project_id, draft_type_id, content_html, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (project_id, draft_type_id) DO UPDATE SET content_html = $3, updated_at = NOW()
       RETURNING *`,
      [projectId, typeId, content_html]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('pa.saveDraft error:', err);
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
      `SELECT id, name FROM planning_applications.draft_types WHERE id = $1`, [typeId]
    );
    if (!typeRows.length) return res.status(404).json({ error: 'Draft type not found' });

    const { rows: issues } = await pool.query(
      `SELECT pit.id, pit.label, pit.discipline,
              ain.argument_against, ain.argument_for
       FROM admin_console.project_issue_tracks pit
       LEFT JOIN planning_applications.issue_notes ain
         ON ain.track_id = pit.id AND ain.project_id = $1
       WHERE pit.project_id = $1 AND pit.is_active = TRUE
       ORDER BY pit.sort_order, pit.id`,
      [projectId]
    );

    const { rows: sections } = await pool.query(
      `SELECT * FROM planning_applications.draft_sections
       WHERE draft_type_id = $1 ORDER BY sort_order, id`,
      [typeId]
    );

    const contentHtml = await generateAppealDraft({
      projectName: projectRows[0].project_name,
      draftTypeName: typeRows[0].name,
      sections,
      issues
    });

    const { rows } = await pool.query(
      `INSERT INTO planning_applications.drafts
         (project_id, draft_type_id, content_html, generated_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (project_id, draft_type_id)
       DO UPDATE SET content_html = $3, generated_at = NOW(), updated_at = NOW()
       RETURNING *`,
      [projectId, typeId, contentHtml]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('pa.generateDraft error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function generateSection(req, res) {
  const { projectId, typeId, sectionId } = req.params;
  try {
    const { rows: projectRows } = await pool.query(
      `SELECT project_name FROM public.projects WHERE id = $1`, [projectId]
    );
    if (!projectRows.length) return res.status(404).json({ error: 'Project not found' });

    const { rows: typeRows } = await pool.query(
      `SELECT name FROM planning_applications.draft_types WHERE id = $1`, [typeId]
    );
    if (!typeRows.length) return res.status(404).json({ error: 'Draft type not found' });

    const { rows: sectionRows } = await pool.query(
      `SELECT * FROM planning_applications.draft_sections WHERE id = $1 AND draft_type_id = $2`,
      [sectionId, typeId]
    );
    if (!sectionRows.length) return res.status(404).json({ error: 'Section not found' });

    const { rows: issues } = await pool.query(
      `SELECT pit.id, pit.label, pit.discipline,
              ain.argument_against, ain.argument_for
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

    const html = await generateDraftSection({
      section: sectionRows[0],
      projectName: projectRows[0].project_name,
      draftTypeName: typeRows[0].name,
      issueContext
    });

    res.json({ html, section_id: sectionRows[0].id, section_name: sectionRows[0].name });
  } catch (err) {
    console.error('pa.generateSection error:', err);
    res.status(500).json({ error: err.message });
  }
}
