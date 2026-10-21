/**
 * Plan Policy Picker controller.
 * Upload a full development plan, get back what it is + a policy index
 * (analyse), then pull chosen policies out verbatim (extract). The document
 * is re-uploaded for the second call: nothing is persisted between them,
 * same as the Extract Policy Wording flow.
 */

import { pool } from '../db.js';
import { parseFile } from '../services/parser.service.js';
import {
  identifyPlan, buildPolicyIndex, findExistingPlanMatch, extractSelectedPolicies,
} from '../services/planPolicyPicker.service.js';

async function readDocumentText(req) {
  if (req.file) {
    const { text, warning } = await parseFile(req.file.buffer, req.file.originalname);
    if (!text?.trim()) {
      throw Object.assign(new Error(warning || 'Could not extract any text from that file'), { status: 400 });
    }
    return { rawText: text, parseWarning: warning };
  }
  if (req.body.text?.trim()) return { rawText: req.body.text, parseWarning: null };
  throw Object.assign(new Error('No file or text provided'), { status: 400 });
}

export async function analysePlanDocument(req, res) {
  const { projectId } = req.params;
  try {
    const { rawText, parseWarning } = await readDocumentText(req);

    const [plan, indexResult, { rows: existingDocs }] = await Promise.all([
      identifyPlan(rawText),
      buildPolicyIndex(rawText),
      pool.query(
        `SELECT id, section, plan_name, plan_type, year_adopted, month_adopted, summary, relevance
         FROM policy_documents WHERE project_id = $1 ORDER BY section, id`,
        [projectId]
      ),
    ]);

    res.json({
      plan,
      existingMatch: findExistingPlanMatch(plan.plan_name, existingDocs),
      index: indexResult.entries,
      indexMethod: indexResult.method,
      textLength: rawText.length,
      warning: [parseWarning, indexResult.warning].filter(Boolean).join(' ') || null,
    });
  } catch (err) {
    console.error('analysePlanDocument error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to analyse the plan document' });
  }
}

export async function extractPlanPolicies(req, res) {
  try {
    let selections = req.body.selections;
    if (typeof selections === 'string') {
      try { selections = JSON.parse(selections); } catch { return res.status(400).json({ error: 'selections must be a JSON array' }); }
    }
    if (!Array.isArray(selections) || !selections.length) {
      return res.status(400).json({ error: 'Choose at least one policy' });
    }
    if (selections.length > 40) {
      return res.status(400).json({ error: 'Choose 40 policies or fewer at a time' });
    }

    const { rawText, parseWarning } = await readDocumentText(req);

    // Offsets come from the client, so validate them against this text.
    const clean = [];
    for (const s of selections) {
      const start = Number(s.start);
      const end = Number(s.end);
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > rawText.length) {
        return res.status(400).json({ error: 'Policy locations do not match this document. Re-upload the same file you analysed.' });
      }
      clean.push({
        id: s.id,
        reference: typeof s.reference === 'string' ? s.reference : '',
        name: typeof s.name === 'string' ? s.name : '',
        start,
        end,
      });
    }

    const results = await extractSelectedPolicies(rawText, clean, {
      hint: typeof req.body.hint === 'string' ? req.body.hint : '',
      hintNote: typeof req.body.hint_note === 'string' ? req.body.hint_note.slice(0, 500) : '',
    });

    res.json({ results, warning: parseWarning || null });
  } catch (err) {
    console.error('extractPlanPolicies error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to extract policies' });
  }
}
