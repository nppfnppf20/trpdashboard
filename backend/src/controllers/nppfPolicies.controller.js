import { pool } from '../db.js';
import { parseFile } from '../services/parser.service.js';
import { extractNppfPoliciesFromText } from '../services/nppfPolicies.service.js';
import { checkVerbatim } from '../services/verbatimCheck.service.js';

// ─────────────────────────────────────────────────────────────────────────────
// Canonical NPPF policy library (admin_console.nppf_policies) — see
// [[project_nppf_policy_bank]]. Not project-scoped: one shared library.
// ─────────────────────────────────────────────────────────────────────────────

export async function listNppfPolicies(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT id, policy_reference, policy_name, policy_text, sort_order, created_at, updated_at
       FROM admin_console.nppf_policies
       ORDER BY sort_order NULLS LAST, id`
    );
    res.json(rows);
  } catch (err) {
    console.error('nppfPolicies.list error:', err);
    res.status(500).json({ error: 'Failed to fetch NPPF policies' });
  }
}

export async function createNppfPolicy(req, res) {
  const { policy_reference, policy_name, policy_text } = req.body;
  if (!policy_name?.trim()) return res.status(400).json({ error: 'policy_name is required' });
  if (!policy_text?.trim()) return res.status(400).json({ error: 'policy_text is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO admin_console.nppf_policies (policy_reference, policy_name, policy_text)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [policy_reference?.trim() || '', policy_name.trim(), policy_text.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('nppfPolicies.create error:', err);
    res.status(500).json({ error: 'Failed to create NPPF policy' });
  }
}

export async function updateNppfPolicy(req, res) {
  const { id } = req.params;
  const { policy_reference, policy_name, policy_text, sort_order } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE admin_console.nppf_policies SET
         policy_reference = COALESCE($1, policy_reference),
         policy_name      = COALESCE($2, policy_name),
         policy_text      = COALESCE($3, policy_text),
         sort_order       = COALESCE($4, sort_order),
         updated_at       = NOW()
       WHERE id = $5
       RETURNING *`,
      [policy_reference?.trim() || null, policy_name?.trim() || null, policy_text?.trim() || null, sort_order ?? null, id]
    );
    if (!rows.length) return res.status(404).json({ error: 'NPPF policy not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('nppfPolicies.update error:', err);
    res.status(500).json({ error: 'Failed to update NPPF policy' });
  }
}

export async function deleteNppfPolicy(req, res) {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query('DELETE FROM admin_console.nppf_policies WHERE id = $1', [id]);
    if (!rowCount) return res.status(404).json({ error: 'NPPF policy not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('nppfPolicies.delete error:', err);
    res.status(500).json({ error: 'Failed to delete NPPF policy' });
  }
}

// Parses an uploaded file OR pasted text and asks the LLM to pull out every
// NPPF policy, verbatim, for review before anything is saved — a one-off
// job to populate the library. Nothing is saved here.
export async function extractNppfPolicies(req, res) {
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

    const provider = req.body.provider === 'openai' || req.body.provider === 'anthropic' ? req.body.provider : null;
    const extraction = await extractNppfPoliciesFromText(rawText, provider);
    if (!extraction || !extraction.policies.length) {
      return res.status(422).json({ error: extraction?.warning || 'Could not extract any policies from this document.' });
    }

    const policies = extraction.policies.map(p => ({
      ...p,
      _verbatim: {
        policy_name: checkVerbatim(p.policy_name, rawText),
        policy_text: checkVerbatim(p.policy_text, rawText),
      },
    }));

    res.json({ policies, sourceText: rawText, warning: extraction.warning || null });
  } catch (err) {
    console.error('nppfPolicies.extract error:', err);
    res.status(500).json({ error: 'Failed to extract NPPF policies from document', details: err.message });
  }
}
