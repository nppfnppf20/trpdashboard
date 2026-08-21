/**
 * LPA Analysis Controller
 * Handles:
 *   - Relevant Policy CRUD (project_policies table)
 *   - LPA Decision Document upload + per-doc AI analysis (lpa_decision_documents)
 *   - Synthesis of all doc analyses into a structured report (lpa_decision_analysis)
 */

import { pool } from '../db.js';
import { parseFile } from '../services/parser.service.js';
import { analyseLpaDocument, synthesiseLpaAnalysis, extractPoliciesFromDocument } from '../services/llm.service.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getProjectContext(client, projectId) {
  const { rows } = await client.query(
    `SELECT project_name, local_planning_authority, address, sectors, sub_sectors, detailed_description
     FROM projects p
     LEFT JOIN admin_console.project_information pi ON pi.project_id = p.unique_id
     WHERE p.id = $1`,
    [projectId]
  );
  if (!rows.length) throw Object.assign(new Error('Project not found'), { status: 404 });
  const p = rows[0];
  return {
    name: p.project_name,
    lpa: p.local_planning_authority,
    site_address: p.address,
    use_type: [p.sectors, p.sub_sectors].filter(Boolean).join(' / '),
    description: p.detailed_description
  };
}

async function getPolicies(client, projectId) {
  const { rows } = await client.query(
    `SELECT id, policy_reference, policy_name, policy_type, policy_text,
            relevant_supporting_text, notes, is_key_policy, created_at
     FROM project_policies
     WHERE project_id = $1
     ORDER BY is_key_policy DESC, policy_type, id`,
    [projectId]
  );
  return rows;
}

async function getBriefingNote(client, projectId) {
  const { rows } = await client.query(
    `SELECT briefing_note FROM lpa_decision_analysis WHERE project_id = $1`,
    [projectId]
  );
  return rows[0]?.briefing_note ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Relevant Policies
// ─────────────────────────────────────────────────────────────────────────────

export async function listPolicies(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT pp.id, pp.policy_reference, pp.policy_name, pp.policy_type, pp.policy_text,
              pp.relevant_supporting_text, pp.notes, pp.is_key_policy, pp.created_at,
              pp.plan_id, pd.plan_name
       FROM project_policies pp
       LEFT JOIN policy_documents pd ON pd.id = pp.plan_id
       WHERE pp.project_id = $1
       ORDER BY pp.is_key_policy DESC, pp.policy_type, pp.id`,
      [projectId]
    );
    res.json(rows);
  } catch (err) {
    console.error('listPolicies error:', err);
    res.status(500).json({ error: 'Failed to fetch policies' });
  }
}

export async function createPolicy(req, res) {
  const { projectId } = req.params;
  const { policy_reference, policy_name, policy_type, policy_text, relevant_supporting_text, notes, is_key_policy, plan_id } = req.body;

  if (!policy_name?.trim()) return res.status(400).json({ error: 'policy_name is required' });
  if (!policy_type) return res.status(400).json({ error: 'policy_type is required' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO project_policies
         (project_id, policy_reference, policy_name, policy_type, policy_text, relevant_supporting_text, notes, is_key_policy, plan_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        projectId,
        policy_reference?.trim() || null,
        policy_name.trim(),
        policy_type,
        policy_text?.trim() || null,
        relevant_supporting_text?.trim() || null,
        notes?.trim() || null,
        is_key_policy ?? false,
        plan_id || null
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('createPolicy error:', err);
    res.status(500).json({ error: 'Failed to create policy' });
  }
}

// National policy is the one tier that's genuinely portable between projects
// regardless of LPA (unlike Local/Neighbourhood, which are area-specific) —
// see [[project_dev_type_and_national_policy_library]]. Scoped to
// policy_type = 'national' only, and only to other projects sharing at
// least one development type with this one.
export async function listNationalPolicyPrecedents(req, res) {
  const { projectId } = req.params;
  try {
    const { rows: projectRows } = await pool.query(
      `SELECT development_types FROM projects WHERE id = $1`,
      [projectId]
    );
    if (!projectRows.length) return res.status(404).json({ error: 'Project not found' });
    const devTypes = projectRows[0].development_types ?? [];
    if (!devTypes.length) return res.json([]);

    const { rows } = await pool.query(
      `SELECT pp.policy_reference, pp.policy_name, pp.policy_text,
              COUNT(DISTINCT pp.project_id) AS used_on
       FROM project_policies pp
       JOIN projects p ON p.id = pp.project_id
       WHERE pp.policy_type = 'national'
         AND pp.project_id != $1
         AND p.development_types ?| $2::text[]
       GROUP BY pp.policy_reference, pp.policy_name, pp.policy_text
       ORDER BY used_on DESC, pp.policy_name`,
      [projectId, devTypes]
    );
    res.json(rows);
  } catch (err) {
    console.error('listNationalPolicyPrecedents error:', err);
    res.status(500).json({ error: 'Failed to fetch national policy precedents' });
  }
}

// Parses an uploaded file OR pasted text and asks the LLM to pull out the
// policies it cites, verbatim, for review before anything is saved — see
// [[project_policy_extraction_from_document]].
export async function extractPolicies(req, res) {
  try {
    let rawText;

    if (req.file) {
      const { text, warning } = await parseFile(req.file.buffer, req.file.originalname);
      rawText = text;
      if (!rawText?.trim()) {
        return res.status(400).json({ error: warning || 'Could not extract any text from that file' });
      }
    } else if (req.body.text?.trim()) {
      rawText = req.body.text;
    } else {
      return res.status(400).json({ error: 'No file or text provided' });
    }

    const { policies, plans, sizeWarning } = await extractPoliciesFromDocument(rawText);
    res.json({ policies, plans, warning: sizeWarning || null });
  } catch (err) {
    console.error('extractPolicies error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to extract policies from document' });
  }
}

export async function updatePolicy(req, res) {
  const { policyId } = req.params;
  const { policy_reference, policy_name, policy_type, policy_text, relevant_supporting_text, notes, is_key_policy, plan_id } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE project_policies SET
         policy_reference = COALESCE($1, policy_reference),
         policy_name = COALESCE($2, policy_name),
         policy_type = COALESCE($3, policy_type),
         policy_text = $4,
         relevant_supporting_text = $5,
         notes = $6,
         is_key_policy = COALESCE($7, is_key_policy),
         plan_id = $9
       WHERE id = $8
       RETURNING *`,
      [
        policy_reference ?? null,
        policy_name ?? null,
        policy_type ?? null,
        policy_text ?? null,
        relevant_supporting_text ?? null,
        notes ?? null,
        is_key_policy ?? null,
        policyId,
        plan_id || null
      ]
    );
    if (!rows.length) return res.status(404).json({ error: 'Policy not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('updatePolicy error:', err);
    res.status(500).json({ error: 'Failed to update policy' });
  }
}

export async function deletePolicy(req, res) {
  const { policyId } = req.params;
  try {
    const { rowCount } = await pool.query('DELETE FROM project_policies WHERE id = $1', [policyId]);
    if (!rowCount) return res.status(404).json({ error: 'Policy not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('deletePolicy error:', err);
    res.status(500).json({ error: 'Failed to delete policy' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LPA Decision Documents
// ─────────────────────────────────────────────────────────────────────────────

export async function listLpaDocuments(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT id, project_id, filename, token_estimate, parse_warning,
              doc_summary, status, uploaded_at
       FROM lpa_decision_documents
       WHERE project_id = $1
       ORDER BY uploaded_at ASC`,
      [projectId]
    );
    res.json(rows);
  } catch (err) {
    console.error('listLpaDocuments error:', err);
    res.status(500).json({ error: 'Failed to fetch LPA documents' });
  }
}

export async function uploadLpaDocument(req, res) {
  const { projectId } = req.params;
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const client = await pool.connect();
  try {
    // Parse file
    const { text: rawText, warning: parseWarning } = await parseFile(req.file.buffer, req.file.originalname);
    const tokenEstimate = Math.round(rawText.length / 4);

    // Insert record in processing state
    const { rows: docRows } = await client.query(
      `INSERT INTO lpa_decision_documents
         (project_id, filename, extracted_text, token_estimate, parse_warning, status)
       VALUES ($1, $2, $3, $4, $5, 'processing')
       RETURNING id`,
      [projectId, req.file.originalname, rawText, tokenEstimate, parseWarning || null]
    );
    const docId = docRows[0].id;

    // Fetch project context, policies, and briefing note for the prompt
    const [projectContext, policies, briefingNote] = await Promise.all([
      getProjectContext(client, projectId),
      getPolicies(client, projectId),
      getBriefingNote(client, projectId)
    ]);

    // Run LLM analysis
    const docSummary = await analyseLpaDocument(rawText, projectContext, policies, briefingNote);

    // Store result
    await client.query(
      `UPDATE lpa_decision_documents
       SET doc_summary = $1, status = 'complete', uploaded_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(docSummary), docId]
    );

    // Auto-trigger synthesis with updated document set
    await runSynthesis(client, projectId, projectContext, policies, briefingNote);

    const { rows: finalDoc } = await client.query(
      `SELECT id, project_id, filename, token_estimate, parse_warning, doc_summary, status, uploaded_at
       FROM lpa_decision_documents WHERE id = $1`,
      [docId]
    );

    res.status(201).json({ document: finalDoc[0], parseWarning });
  } catch (err) {
    console.error('uploadLpaDocument error:', err);
    await pool.query(
      `UPDATE lpa_decision_documents SET status = 'error' WHERE id = $1 AND status = 'processing'`,
      [err._docId]
    ).catch(() => {});
    res.status(500).json({ error: 'LPA document analysis failed', detail: err.message });
  } finally {
    client.release();
  }
}

export async function deleteLpaDocument(req, res) {
  const { projectId, docId } = req.params;
  const client = await pool.connect();
  try {
    const { rowCount } = await client.query(
      'DELETE FROM lpa_decision_documents WHERE id = $1 AND project_id = $2',
      [docId, projectId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Document not found' });

    // Re-synthesise with remaining docs (or clear if none left)
    const { rows: remaining } = await client.query(
      `SELECT COUNT(*) AS cnt FROM lpa_decision_documents WHERE project_id = $1 AND status = 'complete'`,
      [projectId]
    );
    if (parseInt(remaining[0].cnt, 10) === 0) {
      await client.query(
        `UPDATE lpa_decision_analysis SET themes_report = null, policy_treatment = null, full_report = null,
         documents_processed = 0, last_synthesised_at = NOW() WHERE project_id = $1`,
        [projectId]
      );
    } else {
      const [projectContext, policies, briefingNote] = await Promise.all([
        getProjectContext(client, projectId),
        getPolicies(client, projectId),
        getBriefingNote(client, projectId)
      ]);
      await runSynthesis(client, projectId, projectContext, policies, briefingNote);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('deleteLpaDocument error:', err);
    res.status(500).json({ error: 'Failed to delete document' });
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Synthesis
// ─────────────────────────────────────────────────────────────────────────────

async function runSynthesis(client, projectId, projectContext, policies, briefingNote = null) {
  const { rows: docs } = await client.query(
    `SELECT filename, doc_summary FROM lpa_decision_documents
     WHERE project_id = $1 AND status = 'complete'
     ORDER BY uploaded_at ASC`,
    [projectId]
  );

  if (!docs.length) return;

  const fullReport = await synthesiseLpaAnalysis(projectContext, policies, docs, briefingNote);

  await client.query(
    `INSERT INTO lpa_decision_analysis (project_id, full_report, documents_processed, last_synthesised_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (project_id) DO UPDATE SET
       full_report = EXCLUDED.full_report,
       documents_processed = EXCLUDED.documents_processed,
       last_synthesised_at = EXCLUDED.last_synthesised_at`,
    [projectId, fullReport, docs.length]
  );
}

export async function getLpaAnalysis(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT full_report, documents_processed, last_synthesised_at, briefing_note
       FROM lpa_decision_analysis WHERE project_id = $1`,
      [projectId]
    );
    res.json(rows[0] ?? null);
  } catch (err) {
    console.error('getLpaAnalysis error:', err);
    res.status(500).json({ error: 'Failed to fetch analysis' });
  }
}

// Upserts the free-text scheme context used to frame LPA decision analysis —
// works even before any document has been uploaded. If a report already
// exists, re-synthesises immediately so it reflects the new note.
export async function saveBriefingNote(req, res) {
  const { projectId } = req.params;
  const { briefing_note } = req.body;
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO lpa_decision_analysis (project_id, briefing_note)
       VALUES ($1, $2)
       ON CONFLICT (project_id) DO UPDATE SET briefing_note = EXCLUDED.briefing_note`,
      [projectId, briefing_note?.trim() || null]
    );

    const { rows: complete } = await client.query(
      `SELECT COUNT(*) AS cnt FROM lpa_decision_documents WHERE project_id = $1 AND status = 'complete'`,
      [projectId]
    );
    if (parseInt(complete[0].cnt, 10) > 0) {
      const [projectContext, policies, briefingNote] = await Promise.all([
        getProjectContext(client, projectId),
        getPolicies(client, projectId),
        getBriefingNote(client, projectId)
      ]);
      await runSynthesis(client, projectId, projectContext, policies, briefingNote);
    }

    const { rows } = await client.query(
      `SELECT full_report, documents_processed, last_synthesised_at, briefing_note
       FROM lpa_decision_analysis WHERE project_id = $1`,
      [projectId]
    );
    res.json(rows[0] ?? null);
  } catch (err) {
    console.error('saveBriefingNote error:', err);
    res.status(500).json({ error: 'Failed to save briefing note' });
  } finally {
    client.release();
  }
}

export async function triggerSynthesis(req, res) {
  const { projectId } = req.params;
  const client = await pool.connect();
  try {
    const [projectContext, policies, briefingNote] = await Promise.all([
      getProjectContext(client, projectId),
      getPolicies(client, projectId),
      getBriefingNote(client, projectId)
    ]);
    await runSynthesis(client, projectId, projectContext, policies, briefingNote);
    const { rows } = await client.query(
      `SELECT full_report, documents_processed, last_synthesised_at, briefing_note
       FROM lpa_decision_analysis WHERE project_id = $1`,
      [projectId]
    );
    res.json(rows[0] ?? null);
  } catch (err) {
    console.error('triggerSynthesis error:', err);
    res.status(500).json({ error: 'Synthesis failed', detail: err.message });
  } finally {
    client.release();
  }
}
