/**
 * Planning Application Controller
 * Issue notes, document analysis, draft documents, document log.
 */

import { pool } from '../db.js';
import { parseFile, chunkText } from '../services/parser.service.js';
import {
  extractPointsFromDocument,
  buildExtractPointsTemplate,
  buildDocumentBlock,
  buildIssueContext,
  generateAppealDraft,
  generateDraftSection,
  generatePlanningStatementAssessment,
  generatePlanningStatementSection,
  summariseDocument,
  getDefaultSummaryPrompt
} from '../services/llm.service.js';

const SCHEMA = 'planning_applications';

const HIGH_VALUE_PATTERN = /^(conclusions?|executive summary|summary(?: and conclusions)?|recommendations|key findings|overall assessment)\s*$/im;

function buildChunkMeta(rawText, chunks) {
  let searchFrom = 0;
  return chunks.map((text, index) => {
    const trimmed = text.trim();
    const start = rawText.indexOf(trimmed, searchFrom);
    const char_start = start === -1 ? searchFrom : start;
    const char_end = char_start + trimmed.length;
    searchFrom = char_end;
    return {
      index,
      char_start,
      char_end,
      text: trimmed,
      is_high_value: HIGH_VALUE_PATTERN.test(trimmed.slice(0, 200))
    };
  });
}

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
              ain.argument_against, ain.argument_for,
              ain.policy_national, ain.policy_local, ain.policy_neighbourhood,
              ain.policy_supplementary, ain.policy_other
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

    // Load linked policy full text for the target tracks so the prompt can assess compliance
    let linkedPolicies = [];
    if (targetIssues.length > 0) {
      const trackIds = targetIssues.map(i => i.id);
      const { rows: policyRows } = await pool.query(
        `SELECT pp.id, pp.policy_reference, pp.policy_name, pp.policy_type,
                pp.policy_text, pp.relevant_supporting_text, pp.is_key_policy,
                ptr.track_id
         FROM public.project_policies pp
         JOIN planning_applications.policy_track_relevance ptr ON ptr.policy_id = pp.id
         WHERE ptr.track_id = ANY($1::int[])
         ORDER BY pp.policy_type, pp.policy_reference`,
        [trackIds]
      );
      linkedPolicies = policyRows;
    }

    const { rows: templateRows } = await pool.query(
      `SELECT prompt_text FROM planning_applications.prompt_settings
       WHERE project_id = $1 AND prompt_key = 'extract_points'`,
      [projectId]
    );
    const savedTemplate = templateRows[0]?.prompt_text ?? null;

    if (preview) {
      const template = savedTemplate
        ?? buildExtractPointsTemplate({ allIssues, targetIssues, documentType, documentDirection, userNotes, linkedPolicies });
      return res.json({ template });
    }

    let resolvedPrompt = null;
    if (customPrompt) {
      resolvedPrompt = customPrompt.replace('{{DOCUMENT}}', buildDocumentBlock(text));
    } else if (savedTemplate) {
      resolvedPrompt = savedTemplate.replace('{{DOCUMENT}}', buildDocumentBlock(text));
    }

    const result = await extractPointsFromDocument({
      text, allIssues, targetIssues, documentType, documentDirection, userNotes,
      linkedPolicies, customPrompt: resolvedPrompt
    });

    const chunks = buildChunkMeta(text, chunkText(text));
    res.json({ ...result, chunks });
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
// Argument points
// ─────────────────────────────────────────────────────────────────────────────

export async function getArgumentPoints(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT ap.id, ap.track_id, ap.document_log_id, ap.field,
              ap.headline, ap.detailed_summary, ap.accepted, ap.sort_order, ap.created_at,
              dl.title AS source_doc_title,
              json_agg(
                json_build_object(
                  'id', ape.id,
                  'span_id', ape.span_id,
                  'quote_snapshot', ape.quote_snapshot,
                  'relevance_note', ape.relevance_note
                ) ORDER BY ape.id
              ) FILTER (WHERE ape.id IS NOT NULL) AS evidence
       FROM planning_applications.argument_points ap
       LEFT JOIN planning_applications.argument_point_evidence ape ON ape.argument_point_id = ap.id
       LEFT JOIN planning_applications.document_log dl ON dl.id = ap.document_log_id
       WHERE ap.project_id = $1 AND ap.accepted = TRUE
       GROUP BY ap.id, dl.title
       ORDER BY ap.track_id, ap.sort_order, ap.id`,
      [projectId]
    );
    res.json(rows);
  } catch (err) {
    console.error('pa.getArgumentPoints error:', err);
    res.status(500).json({ error: 'Failed to fetch argument points' });
  }
}

export async function createArgumentPoint(req, res) {
  const { projectId } = req.params;
  const { track_id, document_log_id, field, headline, detailed_summary, citation, relevant_chunk_indices } = req.body;
  if (!track_id || !field || !headline?.trim()) {
    return res.status(400).json({ error: 'track_id, field, and headline are required' });
  }
  try {
    const { rows: pointRows } = await pool.query(
      `INSERT INTO planning_applications.argument_points
         (project_id, track_id, document_log_id, field, headline, detailed_summary, accepted)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       RETURNING *`,
      [projectId, track_id, document_log_id ?? null, field, headline.trim(), detailed_summary ?? null]
    );
    const point = pointRows[0];

    // Link evidence spans. Use the LLM-extracted citation quote as quote_snapshot when
    // available (precise verbatim excerpt); fall back to the full chunk text.
    // citation.para_ref is stored in relevance_note for display in citations.
    const chunkIndices = Array.isArray(relevant_chunk_indices) ? relevant_chunk_indices : [];
    if (chunkIndices.length > 0 && document_log_id) {
      const { rows: spanRows } = await pool.query(
        `SELECT id, chunk_index, text FROM planning_applications.document_text_spans
         WHERE document_log_id = $1 AND chunk_index = ANY($2::int[])`,
        [document_log_id, chunkIndices]
      );
      const citationQuote = citation?.quote?.trim() || null;
      const paraRef = citation?.para_ref?.trim() || null;
      await Promise.all(spanRows.map(span =>
        pool.query(
          `INSERT INTO planning_applications.argument_point_evidence
             (argument_point_id, span_id, quote_snapshot, relevance_note)
           VALUES ($1, $2, $3, $4)`,
          [point.id, span.id, citationQuote ?? span.text, paraRef]
        )
      ));
    }

    res.status(201).json(point);
  } catch (err) {
    console.error('pa.createArgumentPoint error:', err);
    res.status(500).json({ error: 'Failed to create argument point' });
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

export async function deleteDocumentLogEntry(req, res) {
  const { entryId } = req.params;
  try {
    await pool.query(
      `UPDATE planning_applications.argument_points SET document_log_id = NULL WHERE document_log_id = $1`,
      [entryId]
    );
    await pool.query(
      `DELETE FROM planning_applications.document_text_spans WHERE document_log_id = $1`,
      [entryId]
    );
    const { rows } = await pool.query(
      `DELETE FROM planning_applications.document_log WHERE id = $1 RETURNING id`,
      [entryId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Log entry not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('pa.deleteDocumentLogEntry error:', err);
    res.status(500).json({ error: 'Failed to delete log entry' });
  }
}

export async function updateDocumentLogEntry(req, res) {
  const { entryId } = req.params;
  const { title, code, document_summary, argument_points } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
  try {
    const { rows } = await pool.query(
      `UPDATE planning_applications.document_log
       SET title = $1, code = $2, document_summary = $3, argument_points = $4
       WHERE id = $5
       RETURNING *`,
      [title.trim(), code?.trim() || null, document_summary?.trim() || null,
       JSON.stringify(argument_points ?? []), entryId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Log entry not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('pa.updateDocumentLogEntry error:', err);
    res.status(500).json({ error: 'Failed to update log entry' });
  }
}

export async function createDocumentLogEntry(req, res) {
  const { projectId } = req.params;
  const { title, code, document_summary, argument_points, chunks } = req.body;
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
    const entry = rows[0];

    if (Array.isArray(chunks) && chunks.length > 0) {
      await Promise.all(chunks.map(c =>
        pool.query(
          `INSERT INTO planning_applications.document_text_spans
             (document_log_id, project_id, chunk_index, char_start, char_end, text, is_high_value)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [entry.id, projectId, c.index, c.char_start, c.char_end, c.text, c.is_high_value ?? false]
        )
      ));
    }

    res.status(201).json(entry);
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

async function fetchEvidenceByTrack(projectId) {
  const { rows } = await pool.query(
    `SELECT ap.track_id, ap.headline, ap.detailed_summary,
            ape.quote_snapshot, ape.relevance_note,
            dl.title AS source_doc_title
     FROM planning_applications.argument_points ap
     LEFT JOIN planning_applications.argument_point_evidence ape ON ape.argument_point_id = ap.id
     LEFT JOIN planning_applications.document_log dl ON dl.id = ap.document_log_id
     WHERE ap.project_id = $1 AND ap.accepted = TRUE
     ORDER BY ap.track_id, ap.sort_order, ap.id`,
    [projectId]
  );
  const map = {};
  for (const row of rows) {
    if (!map[row.track_id]) map[row.track_id] = [];
    map[row.track_id].push({
      headline:        row.headline,
      detailed_summary: row.detailed_summary,
      quote_snapshot:  row.quote_snapshot,
      relevance_note:  row.relevance_note,
      source_doc_title: row.source_doc_title
    });
  }
  return map;
}

async function fetchLinkedPoliciesByTrack(projectId) {
  const { rows } = await pool.query(
    `SELECT pp.id, pp.policy_reference, pp.policy_name, pp.policy_type,
            pp.policy_text, pp.relevant_supporting_text, pp.is_key_policy,
            ptr.track_id
     FROM public.project_policies pp
     JOIN planning_applications.policy_track_relevance ptr ON ptr.policy_id = pp.id
     WHERE pp.project_id = $1
     ORDER BY ptr.track_id, pp.policy_type, pp.policy_reference`,
    [projectId]
  );
  const map = {};
  for (const row of rows) {
    if (!map[row.track_id]) map[row.track_id] = [];
    map[row.track_id].push(row);
  }
  return map;
}

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function resolvePlanningStatementVariables(projectId) {
  const { rows: [project] } = await pool.query(
    `SELECT project_name, client, local_planning_authority, address, development_description
     FROM public.projects WHERE id = $1`, [projectId]
  );
  if (!project) return {};

  const { rows: summaries } = await pool.query(
    `SELECT doc_type, summary_html FROM planning_applications.document_summaries
     WHERE project_id = $1 ORDER BY created_at DESC`, [projectId]
  );
  const summaryByType = {};
  for (const s of summaries) {
    if (!summaryByType[s.doc_type]) summaryByType[s.doc_type] = s.summary_html;
  }

  const { rows: docLog } = await pool.query(
    `SELECT title, code FROM planning_applications.document_log
     WHERE project_id = $1 ORDER BY logged_at ASC`, [projectId]
  );

  const { rows: history } = await pool.query(
    `SELECT app_reference, description, decision, decision_date, notes
     FROM planning_applications.planning_history
     WHERE project_id = $1 ORDER BY sort_order, id`, [projectId]
  );

  const { rows: policies } = await pool.query(
    `SELECT policy_reference, policy_name, policy_type, policy_text, relevant_supporting_text, is_key_policy
     FROM public.project_policies WHERE project_id = $1 ORDER BY policy_type, policy_reference`, [projectId]
  );

  const lpaArr = project.local_planning_authority;
  const lpaName = Array.isArray(lpaArr) && lpaArr.length
    ? lpaArr.join(' / ')
    : (typeof lpaArr === 'string' && lpaArr ? lpaArr : '[LPA Name]');

  const documentList = docLog.length
    ? docLog.map(d => `- ${d.title}${d.code ? ` (Ref: ${d.code})` : ''}`).join('\n')
    : '[No documents logged]';

  const planningHistoryText = history.length
    ? history.map(h => {
        const parts = [h.description];
        if (h.app_reference) parts.unshift(`Ref: ${h.app_reference}`);
        if (h.decision) parts.push(`Decision: ${h.decision}`);
        if (h.decision_date) {
          const d = new Date(h.decision_date);
          parts.push(`Date: ${d.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}`);
        }
        if (h.notes) parts.push(h.notes);
        return parts.join(' — ');
      }).join('\n\n')
    : '';

  const formatPolicyList = (pols) => pols.map(p => {
    const ref = p.policy_reference ? `${p.policy_reference} — ` : '';
    const key = p.is_key_policy ? ' [KEY POLICY]' : '';
    const wording = p.policy_text?.trim() ? `\n  Policy wording: "${p.policy_text.trim().slice(0, 500)}"` : '';
    const context = p.relevant_supporting_text?.trim() ? `\n  Context: ${p.relevant_supporting_text.trim().slice(0, 400)}` : '';
    return `- ${ref}${p.policy_name}${key}${wording}${context}`;
  }).join('\n');

  const localPolicies = policies.filter(p => p.policy_type === 'local');
  const nationalPolicies = policies.filter(p => p.policy_type === 'national');
  const otherPolicies = policies.filter(p => !['local', 'national'].includes(p.policy_type));

  return {
    PROJECT_NAME:            project.project_name ?? '[Project Name]',
    APPLICANT_NAME:          project.client ?? '[Applicant Name]',
    LPA_NAME:                lpaName,
    SITE_ADDRESS:            project.address ?? '[Site Address]',
    DEVELOPMENT_DESCRIPTION: project.development_description ?? '[Development Description]',
    ABOUT_APPLICANT:         stripHtml(summaryByType.about_applicant),
    PROPOSED_DEVELOPMENT:    stripHtml(summaryByType.proposed_development),
    DOCUMENT_LIST:           documentList,
    SITE_SURROUNDINGS:       stripHtml(summaryByType.site_surroundings),
    PLANNING_HISTORY:        planningHistoryText,
    PRE_APP_SUMMARY:         stripHtml(summaryByType.pre_app),
    EIA_SUMMARY:             stripHtml(summaryByType.eia_response),
    SCI_SUMMARY:             stripHtml(summaryByType.sci),
    LOCAL_POLICIES:          formatPolicyList(localPolicies),
    NATIONAL_POLICIES:       formatPolicyList(nationalPolicies),
    OTHER_POLICIES:          formatPolicyList(otherPolicies),
    FULL_STATEMENT:          '',
  };
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

    const [{ rows: issues }, { rows: sections }, evidenceByTrack, linkedPoliciesByTrack] = await Promise.all([
      pool.query(
        `SELECT pit.id, pit.label, pit.discipline,
                ain.argument_against, ain.argument_for,
                ain.policy_national, ain.policy_local, ain.policy_neighbourhood,
                ain.policy_supplementary, ain.policy_other
         FROM admin_console.project_issue_tracks pit
         LEFT JOIN planning_applications.issue_notes ain
           ON ain.track_id = pit.id AND ain.project_id = $1
         WHERE pit.project_id = $1 AND pit.is_active = TRUE
         ORDER BY pit.sort_order, pit.id`,
        [projectId]
      ),
      pool.query(
        `SELECT * FROM planning_applications.draft_sections
         WHERE draft_type_id = $1 ORDER BY sort_order, id`,
        [typeId]
      ),
      fetchEvidenceByTrack(projectId),
      fetchLinkedPoliciesByTrack(projectId)
    ]);

    const hasTemplatedSections = sections.some(s => s.generation_prompt?.includes('{{'));
    let contentHtml;

    if (hasTemplatedSections) {
      const variables = await resolvePlanningStatementVariables(projectId);
      const issueContext = buildIssueContext(issues, evidenceByTrack);

      const normalSections = sections.filter(s => !s.runs_last);
      const lastSections = sections.filter(s => s.runs_last);
      const sectionHtmlMap = new Map();

      for (const section of normalSections) {
        console.log(`[generateDraft] generating section: ${section.name}`);
        let html;
        if (section.slug === 'planning_assessment') {
          html = await generatePlanningStatementAssessment({
            projectName: projectRows[0].project_name,
            section, issues, linkedPoliciesByTrack, evidenceByTrack
          });
        } else if (section.generation_prompt?.includes('{{')) {
          html = await generatePlanningStatementSection({ section, variables });
        } else {
          html = await generateDraftSection({
            section,
            projectName: projectRows[0].project_name,
            draftTypeName: typeRows[0].name,
            issueContext
          });
        }
        sectionHtmlMap.set(section.id, html);
      }

      if (lastSections.length > 0) {
        const assembledHtml = normalSections.map(s => sectionHtmlMap.get(s.id)).join('\n\n');
        const fullStatementText = stripHtml(assembledHtml);
        const runsLastVariables = { ...variables, FULL_STATEMENT: fullStatementText };
        for (const section of lastSections) {
          console.log(`[generateDraft] generating runs_last section: ${section.name}`);
          const html = await generatePlanningStatementSection({ section, variables: runsLastVariables });
          sectionHtmlMap.set(section.id, html);
        }
      }

      contentHtml = sections.map(s => sectionHtmlMap.get(s.id)).filter(Boolean).join('\n\n');

    } else if (Object.keys(linkedPoliciesByTrack).length > 0) {
      const issueContext = buildIssueContext(issues, evidenceByTrack);
      const sectionParts = [];
      for (const section of sections) {
        let html;
        if (section.slug === 'planning_assessment') {
          html = await generatePlanningStatementAssessment({
            projectName: projectRows[0].project_name,
            section, issues, linkedPoliciesByTrack, evidenceByTrack
          });
        } else {
          html = await generateDraftSection({
            section,
            projectName: projectRows[0].project_name,
            draftTypeName: typeRows[0].name,
            issueContext
          });
        }
        sectionParts.push(html);
      }
      contentHtml = sectionParts.join('\n\n');

    } else {
      contentHtml = await generateAppealDraft({
        projectName: projectRows[0].project_name,
        draftTypeName: typeRows[0].name,
        sections,
        issues,
        evidenceByTrack
      });
    }

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

// ─────────────────────────────────────────────────────────────────────────────
// Document summaries
// ─────────────────────────────────────────────────────────────────────────────

export async function getDocumentSummaries(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT id, project_id, title, document_ref, file_name, doc_type, summary_html, created_at
       FROM planning_applications.document_summaries
       WHERE project_id = $1 ORDER BY created_at DESC`,
      [projectId]
    );
    res.json(rows);
  } catch (err) {
    console.error('pa.getDocumentSummaries error:', err);
    res.status(500).json({ error: 'Failed to fetch document summaries' });
  }
}

export async function generateDocumentSummary(req, res) {
  try {
    const { projectId } = req.params;
    const docType = req.body.doc_type || 'other';

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

    // Load custom prompt if saved for this doc type
    const { rows: promptRows } = await pool.query(
      `SELECT prompt_template FROM planning_applications.doc_type_prompts WHERE doc_type = $1`,
      [docType]
    );
    const customPrompt = promptRows[0]?.prompt_template ?? null;

    const summaryHtml = await summariseDocument(text, fileName, docType, customPrompt);
    res.json({ summary_html: summaryHtml, file_name: fileName });
  } catch (err) {
    console.error('pa.generateDocumentSummary error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function saveDocumentSummary(req, res) {
  const { projectId } = req.params;
  const { title, document_ref, file_name, doc_type, summary_html } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
  if (!summary_html?.trim()) return res.status(400).json({ error: 'summary_html is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO planning_applications.document_summaries
         (project_id, title, document_ref, file_name, doc_type, summary_html)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [projectId, title.trim(), document_ref?.trim() || null, file_name || null, doc_type || null, summary_html.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('pa.saveDocumentSummary error:', err);
    res.status(500).json({ error: 'Failed to save document summary' });
  }
}

export async function deleteDocumentSummary(req, res) {
  const { summaryId } = req.params;
  try {
    await pool.query(`DELETE FROM planning_applications.document_summaries WHERE id = $1`, [summaryId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('pa.deleteDocumentSummary error:', err);
    res.status(500).json({ error: 'Failed to delete document summary' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Doc type prompts
// ─────────────────────────────────────────────────────────────────────────────

export async function getDocTypePrompt(req, res) {
  const { docType } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT prompt_template FROM planning_applications.doc_type_prompts WHERE doc_type = $1`,
      [docType]
    );
    const saved = rows[0]?.prompt_template ?? null;
    res.json({ prompt: saved ?? getDefaultSummaryPrompt(docType), is_custom: !!saved });
  } catch (err) {
    console.error('pa.getDocTypePrompt error:', err);
    res.status(500).json({ error: 'Failed to fetch prompt' });
  }
}

export async function saveDocTypePrompt(req, res) {
  const { docType } = req.params;
  const { prompt } = req.body;
  if (!prompt?.trim()) return res.status(400).json({ error: 'prompt is required' });
  try {
    await pool.query(
      `INSERT INTO planning_applications.doc_type_prompts (doc_type, prompt_template, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (doc_type) DO UPDATE SET prompt_template = $2, updated_at = NOW()`,
      [docType, prompt.trim()]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('pa.saveDocTypePrompt error:', err);
    res.status(500).json({ error: 'Failed to save prompt' });
  }
}

export async function deleteDocTypePrompt(req, res) {
  const { docType } = req.params;
  try {
    await pool.query(`DELETE FROM planning_applications.doc_type_prompts WHERE doc_type = $1`, [docType]);
    res.json({ prompt: getDefaultSummaryPrompt(docType), is_custom: false });
  } catch (err) {
    console.error('pa.deleteDocTypePrompt error:', err);
    res.status(500).json({ error: 'Failed to reset prompt' });
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
    const section = sectionRows[0];

    let html;

    if (section.slug === 'planning_assessment') {
      const [{ rows: issues }, evidenceByTrack, linkedPoliciesByTrack] = await Promise.all([
        pool.query(
          `SELECT pit.id, pit.label, pit.discipline,
                  ain.argument_against, ain.argument_for,
                  ain.policy_national, ain.policy_local, ain.policy_neighbourhood,
                  ain.policy_supplementary, ain.policy_other
           FROM admin_console.project_issue_tracks pit
           LEFT JOIN planning_applications.issue_notes ain
             ON ain.track_id = pit.id AND ain.project_id = $1
           WHERE pit.project_id = $1 AND pit.is_active = TRUE
           ORDER BY pit.sort_order, pit.id`,
          [projectId]
        ),
        fetchEvidenceByTrack(projectId),
        fetchLinkedPoliciesByTrack(projectId)
      ]);
      html = await generatePlanningStatementAssessment({
        projectName: projectRows[0].project_name,
        section, issues, linkedPoliciesByTrack, evidenceByTrack
      });

    } else if (section.generation_prompt?.includes('{{')) {
      const variables = await resolvePlanningStatementVariables(projectId);
      if (section.runs_last) {
        const { rows: draftRows } = await pool.query(
          `SELECT content_html FROM planning_applications.drafts
           WHERE project_id = $1 AND draft_type_id = $2`,
          [projectId, typeId]
        );
        variables.FULL_STATEMENT = stripHtml(draftRows[0]?.content_html ?? '');
      }
      html = await generatePlanningStatementSection({ section, variables });

    } else {
      const [{ rows: issues }, evidenceByTrack] = await Promise.all([
        pool.query(
          `SELECT pit.id, pit.label, pit.discipline,
                  ain.argument_against, ain.argument_for,
                  ain.policy_national, ain.policy_local, ain.policy_neighbourhood,
                  ain.policy_supplementary, ain.policy_other
           FROM admin_console.project_issue_tracks pit
           LEFT JOIN planning_applications.issue_notes ain
             ON ain.track_id = pit.id AND ain.project_id = $1
           WHERE pit.project_id = $1 AND pit.is_active = TRUE
           ORDER BY pit.sort_order, pit.id`,
          [projectId]
        ),
        fetchEvidenceByTrack(projectId)
      ]);
      const issueContext = buildIssueContext(issues, evidenceByTrack);
      html = await generateDraftSection({
        section,
        projectName: projectRows[0].project_name,
        draftTypeName: typeRows[0].name,
        issueContext
      });
    }

    res.json({ html, section_id: section.id, section_name: section.name });
  } catch (err) {
    console.error('pa.generateSection error:', err);
    res.status(500).json({ error: err.message });
  }
}
