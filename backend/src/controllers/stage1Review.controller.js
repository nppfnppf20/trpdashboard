/**
 * Stage 1 Review Controller
 * LLM-assisted generation of Stage 1 Planning Appraisal.
 */

import { pool } from '../db.js';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { MODEL_SONNET } from '../services/llm.shared.js';
import { getGuidingBrief } from './guidingBriefs.controller.js';
import { getDocumentStyleTemplateByDocType } from './documentStyleTemplates.controller.js';
import { parseFile } from '../services/parser.service.js';

const client = new Anthropic();
const __dirname = dirname(fileURLToPath(import.meta.url));

// Load tone example at startup — used two ways below:
// - as the {{STYLE_GUIDE}} fallback for templates that reference it (e.g. v2)
// - wrapped in TONE_EXAMPLE_BLOCK for legacy templates with no {{STYLE_GUIDE}} token (v1)
let TONE_EXAMPLE_RAW = '';
let TONE_EXAMPLE_BLOCK = '';
try {
  const raw = readFileSync(join(__dirname, '../../../stage1reviewexample.md'), 'utf-8');
  if (raw.trim().length > 100) {
    TONE_EXAMPLE_RAW = raw.trim();
    TONE_EXAMPLE_BLOCK = `\n\nThe following is a real Stage 1 Planning Appraisal written by this consultancy. Use it ONLY as a writing style reference — to learn the professional register, the level of detail expected in each section, and the way conclusions and risks are phrased. Do NOT reproduce any place names, policy references, distances, designations, site details, or factual content from it. Every fact in your output must come solely from the briefing note provided:\n<tone_example>\n${TONE_EXAMPLE_RAW}\n</tone_example>`;
    console.log('[stage1Review] Tone example loaded:', TONE_EXAMPLE_RAW.length, 'chars');
  }
} catch (e) {
  console.warn('[stage1Review] Could not load stage1reviewexample.md:', e.message);
}

// System prompt — role/persona injected as the system message, not stored in DB
const DEFAULT_STAGE1_SYSTEM_PROMPT = `You are a specialist planning consultant at a UK planning consultancy completing a Stage 1 Planning Appraisal. This is a detailed desk-based review document — your entries must be thorough, substantive, and draw out all relevant planning information from the briefing note. Write in the third person in clear, professional UK planning language. This document is client-facing: never reference the briefing note, the client, or internal documents in your output — present all information as established fact as if you are the author of the appraisal.`;

// User prompt template — stored in admin_console.llm_prompts (key: stage1_review); this is the fallback
export const DEFAULT_STAGE1_REVIEW_TEMPLATE = `## Guiding Brief
The following describes how this type of document should be structured and approached — use it for format, framing, and emphasis. The briefing note and planning history provided below are your only source of project-specific content. If the guiding brief describes a section or topic for which nothing has been provided in the project materials, omit it — do not invent content to fill it.

{{GUIDING_BRIEF}}

## Briefing Note
The following briefing note has been prepared by the project team and contains the primary project-specific information for this appraisal. Extract all relevant detail — site description, proposal, planning policy context, constraints, planning history, and any other matters covered.

{{BRIEFING_NOTES}}

{{PLANNING_HISTORY}}

## Planning Policy
The following policies apply to this project. Use them in any sections of the appraisal where they are relevant according to the guiding brief.

### Local Policies
{{LOCAL_POLICIES}}

### National Policies
{{NATIONAL_POLICIES}}

---

Write a complete Stage 1 Planning Appraisal following the structure set out in the guiding brief above.

Important:
- Follow the structure described in the guiding brief precisely.
- Extract specific detail from the briefing note — policy references, constraint names, distances, designations, risk assessments, and recommended next steps where provided.
- Do not invent facts. Every statement must come from the briefing note or planning history provided.
- If the briefing note contains no information on a particular row or topic, leave that cell blank or note that further information is needed — do not pad with invented content.
- Write in the third person in formal, professional UK planning language.
- This document is client-facing: do not reference the briefing note, the client, or internal documents in your output — present all information as established fact.
- Do not number paragraphs (no 1.1, 2.3 etc.).

Output format — clean HTML only:
- <h2> for main section headings
- <h3> for sub-section headings
- <p> for body paragraphs
- <ul>/<li> for bullet points
- <table>/<thead>/<tbody>/<tr>/<th>/<td> for tables
- Do not include a document title — start directly with the first section heading
- No markdown characters (**, *, #, ---) and no em dashes (—)`;

// Kept for backward-compat — old stored prompts were the system prompt text.
// Any value fetched from the DB is now treated as the user prompt template.
export const DEFAULT_STAGE1_REVIEW_PROMPT = DEFAULT_STAGE1_SYSTEM_PROMPT;

export async function generateStage1Review(req, res) {
  const { projectId } = req.params;
  const { briefing_note_id, draft_type_slug } = req.body;
  const promptKey = draft_type_slug ?? 'stage1_review';
  const draftSlug = draft_type_slug ?? 'stage1_review';

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

    // ── 2. Briefing note — full text, no truncation ───────────────────────────
    // Priority: explicit briefing_note_id → starting docs selection → most recent transcript
    let briefingText = null;
    if (briefing_note_id) {
      const { rows: noteRows } = await pool.query(
        `SELECT summary_html FROM planning_applications.document_summaries
         WHERE id = $1 AND project_id = $2`,
        [briefing_note_id, projectId]
      );
      briefingText = noteRows[0]?.summary_html ?? null;
    } else {
      // Check starting docs for a briefing note selection
      const { rows: selectionRows } = await pool.query(
        `SELECT content_text FROM planning_applications.stage1_starting_docs
         WHERE project_id = $1 AND slot_slug = 'briefing_notes'`,
        [projectId]
      );
      const selectionJson = selectionRows[0]?.content_text;
      if (selectionJson) {
        try {
          const ids = JSON.parse(selectionJson);
          if (Array.isArray(ids) && ids.length > 0) {
            const { rows: noteRows } = await pool.query(
              `SELECT title, summary_html FROM planning_applications.document_summaries
               WHERE id = ANY($1) AND project_id = $2 AND doc_type = 'briefing_transcript'
               ORDER BY created_at DESC`,
              [ids, projectId]
            );
            if (noteRows.length) {
              briefingText = noteRows
                .map(r => `${r.title ? `[${r.title}]\n` : ''}${r.summary_html ?? ''}`)
                .join('\n\n---\n\n');
            }
          }
        } catch { /* malformed JSON */ }
      }
      // Fall back to most recent transcript
      if (!briefingText) {
        const { rows: noteRows } = await pool.query(
          `SELECT summary_html FROM planning_applications.document_summaries
           WHERE project_id = $1 AND doc_type = 'briefing_transcript'
           ORDER BY created_at DESC LIMIT 1`,
          [projectId]
        );
        briefingText = noteRows[0]?.summary_html ?? null;
      }
    }

    if (!briefingText?.trim()) {
      return res.status(400).json({ error: 'No briefing note found for this project. Please upload a briefing note first.' });
    }

    // Strip HTML tags — keep full text, no character cap
    const briefingPlain = briefingText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    // ── 3. Policies ───────────────────────────────────────────────────────────
    const { rows: policyRows } = await pool.query(
      `SELECT policy_reference, policy_name, policy_text, policy_type
       FROM public.project_policies WHERE project_id = $1 ORDER BY policy_type, id`,
      [projectId]
    );
    const formatPolicies = rows => rows.length
      ? rows.map(p => {
          const header = `${p.policy_reference}${p.policy_name ? `: ${p.policy_name}` : ''}`;
          const text = p.policy_text?.trim() ? `\n${p.policy_text.trim()}` : '';
          return header + text;
        }).join('\n\n')
      : '(none recorded)';
    const localPolicies    = formatPolicies(policyRows.filter(p => p.policy_type === 'local'));
    const nationalPolicies = formatPolicies(policyRows.filter(p => p.policy_type === 'national'));

    // ── 4. Planning history ───────────────────────────────────────────────────
    const { rows: planningHistoryRows } = await pool.query(
      `SELECT section, planning_ref, description, decision, decision_date
       FROM public.project_planning_history
       WHERE project_id = $1
       ORDER BY section, id`,
      [projectId]
    );

    const formatHistoryPlain = (rows) => {
      if (!rows.length) return 'None recorded.';
      const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
      return rows.map(h => {
        const parts = [];
        if (h.planning_ref) parts.push(`Ref: ${h.planning_ref}`);
        if (h.description) parts.push(h.description);
        if (h.decision) parts.push(`Decision: ${h.decision}`);
        const d = formatDate(h.decision_date);
        if (d) parts.push(`Date: ${d}`);
        return parts.join(', ');
      }).join('\n');
    };

    const onSiteRows  = planningHistoryRows.filter(r => r.section === 'on_site');
    const nearbyRows  = planningHistoryRows.filter(r => r.section === 'nearby');

    const planningHistoryBlock = planningHistoryRows.length
      ? `## Planning History\n\n**On-site applications:**\n${formatHistoryPlain(onSiteRows)}\n\n**Nearby applications:**\n${formatHistoryPlain(nearbyRows)}`
      : '';

    // ── 5. Guiding brief + style template ─────────────────────────────────────
    // Scoped to promptKey (e.g. 'stage1_review_v2') so the v2 experimentation
    // track has its own guiding brief and style template, independent of v1.
    const guidingBrief = await getGuidingBrief(promptKey, project.development_type || null);
    const guidingBriefText = guidingBrief?.guidance_content?.trim() || '(no guiding brief set for this document type)';
    const styleTemplate = await getDocumentStyleTemplateByDocType(promptKey, project.development_type || null);

    // ── 6. Load user prompt template from DB; fall back to default ─────────────
    const { rows: promptRows } = await pool.query(
      `SELECT prompt_text FROM admin_console.llm_prompts WHERE prompt_key = $1`,
      [promptKey]
    );
    const promptTemplate = promptRows[0]?.prompt_text ?? DEFAULT_STAGE1_REVIEW_TEMPLATE;

    // ── 6b. Fetch starting docs ───────────────────────────────────────────────
    const { rows: startingDocRows } = await pool.query(
      `SELECT slot_slug, content_text FROM planning_applications.stage1_starting_docs
       WHERE project_id = $1`,
      [projectId]
    );
    const startingDocs = Object.fromEntries(startingDocRows.map(r => [r.slot_slug, r.content_text]));
    const highLevelReview = startingDocs['high_level_planning_review']?.trim() || '(not provided)';

    // ── 7. Substitute variables ───────────────────────────────────────────────
    const userPrompt = promptTemplate
      .replace(/\{\{GUIDING_BRIEF\}\}/g, guidingBriefText)
      .replace(/\{\{BRIEFING_NOTES\}\}/g, briefingPlain)
      .replace(/\{\{PLANNING_HISTORY\}\}/g, planningHistoryBlock)
      .replace(/\{\{HIGH_LEVEL_PLANNING_REVIEW\}\}/g, highLevelReview)
      .replace(/\{\{LOCAL_POLICIES\}\}/g, localPolicies)
      .replace(/\{\{NATIONAL_POLICIES\}\}/g, nationalPolicies)
      .replace(/\{\{STYLE_GUIDE\}\}/g, styleTemplate?.style_text?.trim() || TONE_EXAMPLE_RAW || '(no house style example set for this document type)');

    // Templates that reference {{STYLE_GUIDE}} (e.g. stage1_review_v2) carry the style
    // example in the user prompt instead — don't also append the legacy system-prompt block.
    const systemPrompt = promptTemplate.includes('{{STYLE_GUIDE}}')
      ? DEFAULT_STAGE1_SYSTEM_PROMPT
      : DEFAULT_STAGE1_SYSTEM_PROMPT + TONE_EXAMPLE_BLOCK;

    // ── 7. Call LLM — expect HTML output directly ─────────────────────────────
    const bodyHtml = (await client.messages.stream({
      model: MODEL_SONNET,
      max_tokens: 64000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    }).finalText()).trim().replace(/^```(?:html)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

    // ── 8. Build document HTML ────────────────────────────────────────────────
    const now = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const documentHtml = [
      `<h1>${project.project_name}</h1>`,
      `<p>Stage 1 Planning Appraisal</p>`,
      `<p>${now}</p>`,
      bodyHtml,
    ].join('\n');

    // ── 9. Save to drafts table ───────────────────────────────────────────────
    const { rows: typeRows } = await pool.query(
      `SELECT id FROM planning_applications.draft_types WHERE slug = $1 LIMIT 1`,
      [draftSlug]
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

    res.json({ html: documentHtml });
  } catch (err) {
    console.error('stage1Review.generate error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function getStage1StartingDocs(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT slot_slug, content_text, file_name, updated_at
       FROM planning_applications.stage1_starting_docs
       WHERE project_id = $1`,
      [projectId]
    );
    res.json(rows);
  } catch (err) {
    console.error('getStage1StartingDocs error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function upsertStage1StartingDoc(req, res) {
  const { projectId, slotSlug } = req.params;
  try {
    let contentText = '';
    let fileName = null;

    if (req.file) {
      const { text } = await parseFile(req.file.buffer, req.file.originalname);
      contentText = text;
      fileName = req.file.originalname;
    } else {
      contentText = req.body.content_text ?? '';
      fileName = req.body.file_name ?? null;
    }

    const { rows } = await pool.query(
      `INSERT INTO planning_applications.stage1_starting_docs
         (project_id, slot_slug, content_text, file_name, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (project_id, slot_slug)
       DO UPDATE SET content_text = $3, file_name = $4, updated_at = NOW()
       RETURNING slot_slug, content_text, file_name, updated_at`,
      [projectId, slotSlug, contentText, fileName]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('upsertStage1StartingDoc error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function deleteStage1StartingDoc(req, res) {
  const { projectId, slotSlug } = req.params;
  try {
    await pool.query(
      `DELETE FROM planning_applications.stage1_starting_docs
       WHERE project_id = $1 AND slot_slug = $2`,
      [projectId, slotSlug]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('deleteStage1StartingDoc error:', err);
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
