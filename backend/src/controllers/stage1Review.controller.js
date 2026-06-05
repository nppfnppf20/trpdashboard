/**
 * Stage 1 Review Controller
 * LLM-assisted generation of Stage 1 Planning Appraisal table content.
 */

import { pool } from '../db.js';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { MODEL_SONNET } from '../services/llm.shared.js';
import { getGuidingBrief } from './guidingBriefs.controller.js';

const client = new Anthropic();
const __dirname = dirname(fileURLToPath(import.meta.url));

// Load tone example at startup
let TONE_EXAMPLE_BLOCK = '';
try {
  const raw = readFileSync(join(__dirname, '../../../stage1reviewexample.md'), 'utf-8');
  if (raw.trim().length > 100) {
    TONE_EXAMPLE_BLOCK = `\n\nThe following is a real Stage 1 Planning Appraisal written by this consultancy. Use it ONLY as a writing style reference — to learn the professional register, the level of detail expected in each row, and the way conclusions and risks are phrased. Do NOT reproduce any place names, policy references, distances, designations, site details, or factual content from it. Every fact in your output must come solely from the briefing note provided:\n<tone_example>\n${raw.trim()}\n</tone_example>`;
    console.log('[stage1Review] Tone example loaded:', raw.trim().length, 'chars');
  }
} catch (e) {
  console.warn('[stage1Review] Could not load stage1reviewexample.md:', e.message);
}

export const DEFAULT_STAGE1_REVIEW_PROMPT = `You are a specialist planning consultant at a UK planning consultancy completing a Stage 1 Planning Appraisal. This is a detailed desk-based review document — your entries must be thorough, substantive, and draw out all relevant planning information from the briefing note. Write in the third person in clear, professional UK planning language. This document is client-facing: never reference the briefing note, the client, or internal documents in your output — present all information as established fact as if you are the author of the appraisal.`;

// Fixed table structure — labels in the order they appear in the appraisal
const TABLE_ROWS = [
  { type: 'header', label: 'Site Details' },
  { type: 'data',   label: 'Site address',                    autofill: true },
  { type: 'data',   label: 'Proposal',                        autofill: true },
  { type: 'data',   label: 'Local planning authority',         autofill: true },
  { type: 'header', label: 'Planning policy' },
  { type: 'data',   label: 'Development plan' },
  { type: 'data',   label: 'Neighbourhood plan' },
  { type: 'data',   label: 'Key local policy' },
  { type: 'data',   label: 'Supplementary guidance' },
  { type: 'header', label: 'Site context' },
  { type: 'data',   label: 'Site description' },
  { type: 'data',   label: 'Planning history' },
  { type: 'header', label: 'Planning discussion' },
  { type: 'data',   label: 'Benefits of proposal' },
  { type: 'data',   label: 'Landscape and visual effects' },
  { type: 'data',   label: 'Ecology' },
  { type: 'data',   label: 'Trees' },
  { type: 'data',   label: 'Site Access' },
  { type: 'data',   label: 'Heritage and archaeology' },
  { type: 'data',   label: 'Agricultural land grade and use' },
  { type: 'data',   label: 'Flood risk and drainage' },
  { type: 'data',   label: 'Noise' },
  { type: 'data',   label: 'Glint and glare' },
  { type: 'data',   label: 'Battery safety fire management plan' },
  { type: 'header', label: 'Planning application considerations' },
  { type: 'data',   label: 'Public consultation' },
  { type: 'data',   label: 'Scope of supporting information' },
  { type: 'data',   label: 'Summary and recommendation' },
];

const LLM_LABELS = TABLE_ROWS
  .filter(r => r.type === 'data' && !r.autofill)
  .map(r => r.label);

function renderTableHtml(rows) {
  let html = '<table class="trp-appraisal-table" data-section-id="appraisal_table"><tbody>';
  for (const row of rows) {
    if (row.type === 'header') {
      html += `<tr class="tbl-header"><td colspan="2"><strong>${row.label}</strong></td></tr>`;
    } else {
      const value = row.value || '';
      html += `<tr class="tbl-row"><td class="tbl-label"><strong>${row.label}</strong></td><td class="tbl-value">${value}</td></tr>`;
    }
  }
  html += '</tbody></table>';
  return html;
}

export async function generateStage1Review(req, res) {
  const { projectId } = req.params;
  const { briefing_note_id } = req.body;

  try {
    // ── 1. Project data ───────────────────────────────────────────────────────
    const { rows: projectRows } = await pool.query(
      `SELECT p.project_name, p.address, p.development_type,
              p.local_planning_authority, p.sub_sectors
       FROM public.projects p
       WHERE p.id = $1`,
      [projectId]
    );
    if (!projectRows.length) return res.status(404).json({ error: 'Project not found' });
    const project = projectRows[0];

    const lpa = Array.isArray(project.local_planning_authority)
      ? project.local_planning_authority.join(', ')
      : project.local_planning_authority || 'N/A';

    const proposal = Array.isArray(project.sub_sectors) && project.sub_sectors.length
      ? project.sub_sectors.join(', ')
      : 'N/A';

    // ── 2. Briefing note — full text, no truncation ───────────────────────────
    let briefingText = null;
    if (briefing_note_id) {
      const { rows: noteRows } = await pool.query(
        `SELECT summary_html FROM planning_applications.document_summaries
         WHERE id = $1 AND project_id = $2`,
        [briefing_note_id, projectId]
      );
      briefingText = noteRows[0]?.summary_html ?? null;
    } else {
      const { rows: noteRows } = await pool.query(
        `SELECT summary_html FROM planning_applications.document_summaries
         WHERE project_id = $1 AND doc_type = 'briefing_transcript'
         ORDER BY created_at DESC LIMIT 1`,
        [projectId]
      );
      briefingText = noteRows[0]?.summary_html ?? null;
    }

    if (!briefingText?.trim()) {
      return res.status(400).json({ error: 'No briefing note found for this project. Please upload a briefing note first.' });
    }

    // Strip HTML tags — keep full text, no character cap
    const briefingPlain = briefingText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    // ── 3. Guiding brief ──────────────────────────────────────────────────────
    const guidingBrief = await getGuidingBrief('stage1_review', project.development_type || null);

    // ── 4. Load prompt from global table ─────────────────────────────────────
    const { rows: promptRows } = await pool.query(
      `SELECT prompt_text FROM admin_console.llm_prompts WHERE prompt_key = 'stage1_review'`
    );

    const guidanceSection = guidingBrief?.guidance_content?.trim()
      ? `\n\n## Practice Guidance\n${guidingBrief.guidance_content.trim()}`
      : '';

    const systemPrompt = (promptRows[0]?.prompt_text ?? DEFAULT_STAGE1_REVIEW_PROMPT) + TONE_EXAMPLE_BLOCK;

    const labelsJson = JSON.stringify(LLM_LABELS, null, 2);

    const userPrompt = `Project: ${project.project_name}
Address: ${project.address || 'N/A'}
LPA: ${lpa}
Proposal: ${proposal}${guidanceSection}

## Full Briefing Note
${briefingPlain}

## Task
You are completing a Stage 1 Planning Appraisal table. For each row below, extract and synthesise ALL relevant information from the briefing note above. These entries must be detailed and comprehensive — this is a substantive planning appraisal, not a summary. Include specific policy references, constraint names, distances, designations, risk assessments, and recommended next steps where the briefing note provides them.

For rows where the briefing note contains no relevant information, return an empty string — do not invent content.

Do not write phrases like "the briefing note states", "according to the briefing", "the client has advised", or any reference to source documents — present all information as established fact in the voice of the consultant authoring the appraisal.

Return ONLY a JSON object where the keys are the exact row labels below and the values are the completed text. Use plain text — no markdown, no bullet characters, no HTML.

Rows to complete:
${labelsJson}

Example of the level of detail expected for a policy row:
"Development plan: Wiltshire Core Strategy (2015); West Wiltshire District Plan (2004) Saved Policies. A Local Plan review is currently at Reg 19 stage, meaning draft policies hold some planning weight, likely to increase as the application progresses."

Return ONLY valid JSON — no explanation, no markdown fences.`;

    // ── 5. Call LLM ───────────────────────────────────────────────────────────
    const response = await client.messages.create({
      model: MODEL_SONNET,
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });

    let raw = response.content[0].text.trim()
      .replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

    let generated;
    try {
      generated = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try { generated = JSON.parse(match[0]); }
        catch { return res.status(500).json({ error: 'Failed to parse LLM response' }); }
      } else {
        return res.status(500).json({ error: 'LLM did not return valid JSON' });
      }
    }

    // ── 6. Assemble final table rows ──────────────────────────────────────────
    const filledRows = TABLE_ROWS.map(row => {
      if (row.type === 'header') return { type: 'header', label: row.label };
      if (row.label === 'Site address') return { type: 'data', label: row.label, value: project.address || '' };
      if (row.label === 'Proposal') return { type: 'data', label: row.label, value: proposal };
      if (row.label === 'Local planning authority') return { type: 'data', label: row.label, value: lpa };
      return { type: 'data', label: row.label, value: generated[row.label] || '' };
    });

    // ── 7. Build document HTML ────────────────────────────────────────────────
    const now = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const tableHtml = renderTableHtml(filledRows);
    const documentHtml = [
      `<h1>${project.project_name}</h1>`,
      `<p>Stage 1 Planning Appraisal</p>`,
      `<p>${now}</p>`,
      tableHtml,
    ].join('');

    // ── 8. Save to drafts table and return standard draft record ─────────────
    const { rows: typeRows } = await pool.query(
      `SELECT id FROM planning_applications.draft_types WHERE slug = 'stage1_review' LIMIT 1`
    );
    if (typeRows.length) {
      const draftTypeId = typeRows[0].id;
      const { rows: draftRows } = await pool.query(
        `INSERT INTO planning_applications.drafts
           (project_id, draft_type_id, content_html, generated_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         ON CONFLICT (project_id, draft_type_id)
         DO UPDATE SET content_html = $3, generated_at = NOW(), updated_at = NOW()
         RETURNING *`,
        [projectId, draftTypeId, documentHtml]
      );
      return res.json(draftRows[0]);
    }

    res.json({ html: documentHtml, rows: filledRows });
  } catch (err) {
    console.error('stage1Review.generate error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function getStage1Context(req, res) {
  const { projectId } = req.params;
  try {
    const [projectRows, briefRows] = await Promise.all([
      pool.query(`SELECT development_type FROM public.projects WHERE id = $1`, [projectId]),
      pool.query(
        `SELECT summary_html FROM planning_applications.document_summaries
         WHERE project_id = $1 AND doc_type = 'briefing_transcript'
         ORDER BY created_at DESC LIMIT 1`,
        [projectId]
      )
    ]);
    const developmentType = projectRows.rows[0]?.development_type ?? null;
    const guidingBrief = await getGuidingBrief('stage1_review', developmentType);
    res.json({
      guidingBrief: guidingBrief ? { name: guidingBrief.name, content: guidingBrief.guidance_content ?? null } : null,
      projectBrief: briefRows.rows[0]?.summary_html ?? null,
      toneExampleLoaded: TONE_EXAMPLE_BLOCK.length > 0,
    });
  } catch (err) {
    console.error('stage1Review.getContext error:', err);
    res.status(500).json({ error: err.message });
  }
}
