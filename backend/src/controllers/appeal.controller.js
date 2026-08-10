/**
 * Appeal Controller
 *
 * Backs the PA workspace's appeal-tool draft types (Statement of Case, SoCG,
 * etc.) — draft-type/section CRUD, PA-notes generation, incorporation, and
 * starting docs. The standalone /appeal workspace's living-argument-document
 * and legacy generation pipeline were retired.
 */

import { pool } from '../db.js';
import { parseFile } from '../services/parser.service.js';
import { getGuidingBrief } from './guidingBriefs.controller.js';
import { generateDraftSection, summariseDocument, scopeDocumentIncorporation, incorporateTargetedParagraphs, resolveProvider } from '../services/llm.service.js';
import { generateAppealDraftFromPrompt, generateIssueOrderedSection, generatePlanningPolicySection, DEFAULT_DRAFT_PROMPT } from '../services/appeal.service.js';
import { fetchLinkedPoliciesByTrack, fetchIssueTypesByTrack } from './planningApplication.controller.js';

async function loadGlobalPrompt(key) {
  const { rows } = await pool.query(
    `SELECT prompt_text FROM admin_console.llm_prompts WHERE prompt_key = $1`, [key]
  );
  return rows[0]?.prompt_text ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Draft documents — appeal_draft_types + appeal_drafts
// ─────────────────────────────────────────────────────────────────────────────

export async function getDraftTypes(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, slug, description, sort_order
       FROM appeals.appeal_draft_types
       ORDER BY sort_order, id`
    );
    res.json(rows);
  } catch (err) {
    console.error('getDraftTypes error:', err);
    res.status(500).json({ error: 'Failed to fetch draft types' });
  }
}

// ── Sections ──────────────────────────────────────────────────────────────────

export async function getSections(req, res) {
  const { typeId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT id, draft_type_id, name, slug, description, sort_order, generation_prompt, example_text
       FROM appeals.appeal_draft_sections
       WHERE draft_type_id = $1
       ORDER BY sort_order, id`,
      [typeId]
    );
    res.json(rows);
  } catch (err) {
    console.error('getSections error:', err);
    res.status(500).json({ error: 'Failed to fetch sections' });
  }
}

export async function createSection(req, res) {
  const { typeId } = req.params;
  const { name, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

  try {
    // Place at end
    const { rows: maxRows } = await pool.query(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM appeals.appeal_draft_sections WHERE draft_type_id = $1`,
      [typeId]
    );
    const { rows } = await pool.query(
      `INSERT INTO appeals.appeal_draft_sections (draft_type_id, name, slug, description, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [typeId, name.trim(), slug, description ?? null, maxRows[0].next_order]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('createSection error:', err);
    res.status(500).json({ error: 'Failed to create section' });
  }
}

export async function updateSection(req, res) {
  const { sectionId } = req.params;
  const { name, description, sort_order, generation_prompt, example_text } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE appeals.appeal_draft_sections
       SET name              = COALESCE($1, name),
           description       = COALESCE($2, description),
           sort_order        = COALESCE($3, sort_order),
           generation_prompt = $4,
           example_text      = $5
       WHERE id = $6
       RETURNING *`,
      [name ?? null, description ?? null, sort_order ?? null, generation_prompt ?? null, example_text ?? null, sectionId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Section not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('updateSection error:', err);
    res.status(500).json({ error: 'Failed to update section' });
  }
}

export async function deleteSection(req, res) {
  const { sectionId } = req.params;
  try {
    const { rows } = await pool.query(
      `DELETE FROM appeals.appeal_draft_sections WHERE id = $1 RETURNING id`, [sectionId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Section not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('deleteSection error:', err);
    res.status(500).json({ error: 'Failed to delete section' });
  }
}

export async function reorderSections(req, res) {
  const { typeId } = req.params;
  const { order } = req.body; // array of section ids in desired order
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array of ids' });
  try {
    await Promise.all(order.map((id, idx) =>
      pool.query(
        `UPDATE appeals.appeal_draft_sections SET sort_order = $1 WHERE id = $2 AND draft_type_id = $3`,
        [idx, id, typeId]
      )
    ));
    const { rows } = await pool.query(
      `SELECT * FROM appeals.appeal_draft_sections WHERE draft_type_id = $1 ORDER BY sort_order, id`,
      [typeId]
    );
    res.json(rows);
  } catch (err) {
    console.error('reorderSections error:', err);
    res.status(500).json({ error: 'Failed to reorder sections' });
  }
}

export async function getDraft(req, res) {
  const { projectId, typeId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT id, project_id, draft_type_id, content_html, generated_at, updated_at,
              example_doc_filename
       FROM appeals.appeal_drafts
       WHERE project_id = $1 AND draft_type_id = $2`,
      [projectId, typeId]
    );
    res.json(rows[0] ?? null);
  } catch (err) {
    console.error('getDraft error:', err);
    res.status(500).json({ error: 'Failed to fetch draft' });
  }
}

export async function getDraftContext(req, res) {
  const { projectId, typeId } = req.params;
  try {
    const [{ rows: projectRows }, { rows: typeRows }] = await Promise.all([
      pool.query(`SELECT project_name, development_type FROM public.projects WHERE id = $1`, [projectId]),
      pool.query(`SELECT name, slug, generation_prompt FROM appeals.appeal_draft_types WHERE id = $1`, [typeId]),
    ]);
    if (!projectRows.length) return res.status(404).json({ error: 'Project not found' });
    if (!typeRows.length) return res.status(404).json({ error: 'Draft type not found' });

    const project = projectRows[0];
    const draftType = typeRows[0];
    const promptTemplate = draftType.generation_prompt ?? '';

    const [{ projectBrief, guidingBrief }, exampleDoc] = await Promise.all([
      fetchPromptContext(projectId, draftType.slug, project.development_type),
      fetchExampleDoc(projectId, typeId),
    ]);

    // Char counts for server-side injected content
    const contextChars = {
      promptTemplate: promptTemplate.length,
      styleExample:   guidingBrief?.style_example?.length ?? 0,
      policies:       0,
      planningHistory: 0,
      issueNotes:     0,
    };

    // Only fetch what the prompt actually uses
    const conditionalQueries = [];

    if (/\{\{(LOCAL_POLICIES|NATIONAL_POLICIES)\}\}/.test(promptTemplate)) {
      conditionalQueries.push(
        pool.query(
          `SELECT coalesce(length(policy_reference), 0) + coalesce(length(policy_name), 0) + coalesce(length(policy_text), 0) AS chars
           FROM public.project_policies WHERE project_id = $1`,
          [projectId]
        ).then(({ rows }) => {
          contextChars.policies = rows.reduce((acc, r) => acc + (r.chars ?? 0), 0);
        })
      );
    }

    if (/\{\{PLANNING_HISTORY\}\}/.test(promptTemplate)) {
      conditionalQueries.push(
        pool.query(
          `SELECT coalesce(length(planning_ref), 0) + coalesce(length(description), 0) + coalesce(length(decision), 0) AS chars
           FROM public.project_planning_history WHERE project_id = $1`,
          [projectId]
        ).then(({ rows }) => {
          contextChars.planningHistory = rows.reduce((acc, r) => acc + (r.chars ?? 0), 0);
        })
      );
    }

    // Issue notes always contribute (argument_for / argument_against on key issues)
    conditionalQueries.push(
      pool.query(
        `SELECT coalesce(length(ain.argument_against), 0) + coalesce(length(ain.argument_for), 0) AS chars
         FROM admin_console.project_issue_tracks pit
         LEFT JOIN planning_applications.issue_notes ain ON ain.track_id = pit.id AND ain.project_id = $1
         WHERE pit.project_id = $1 AND pit.is_active = TRUE`,
        [projectId]
      ).then(({ rows }) => {
        contextChars.issueNotes = rows.reduce((acc, r) => acc + (r.chars ?? 0), 0);
      })
    );

    await Promise.all(conditionalQueries);

    res.json({
      guidingBrief: guidingBrief ? {
        name: guidingBrief.name,
        content: guidingBrief.guidance_content ?? null,
      } : null,
      projectBrief: projectBrief ?? null,
      exampleDoc: exampleDoc ? { filename: exampleDoc.filename } : null,
      contextChars,
    });
  } catch (err) {
    console.error('getDraftContext error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function saveDraft(req, res) {
  const { projectId, typeId } = req.params;
  const { content_html } = req.body;
  if (content_html === undefined) return res.status(400).json({ error: 'content_html is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO appeals.appeal_drafts (project_id, draft_type_id, content_html, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (project_id, draft_type_id)
       DO UPDATE SET content_html = $3, updated_at = NOW()
       RETURNING *`,
      [projectId, typeId, content_html]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('saveDraft error:', err);
    res.status(500).json({ error: 'Failed to save draft' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PA-notes generation — reads from planning_applications.issue_notes
// ─────────────────────────────────────────────────────────────────────────────

// Marker tokens a draft type's main prompt can emit in place of a section it
// deliberately skips — e.g. Planning Statement v3 writes everything except
// Policy/Assessment, then each marker is replaced with that section's own
// dedicated prompt (from appeals.appeal_draft_sections, matched by slug).
// No-op for any draft type whose prompt doesn't contain these tokens.
const SECTION_SPLICE_MARKERS = {
  planning_policy:     '[[POLICY_SECTION]]',
  planning_assessment: '[[PLANNING_ASSESSMENT_SECTION]]',
};

// Each spliced section gets its own guiding brief (document_type in
// admin_console.guiding_briefs) rather than reusing the main document's —
// falls back to the main draft type's guiding brief if not set.
const SECTION_GUIDING_BRIEF_SLUGS = {
  planning_policy:     'planning_policy_v3',
  planning_assessment: 'planning_assessment_v3',
};

// Matches an <h2>...heading...</h2> block through to the next <h2> (or end of
// document) — used to find/replace a section the model wrote directly instead
// of leaving the marker for it.
function buildHeadingBlockPattern(sectionName) {
  const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`<h2>[^<]*${escaped}[^<]*<\\/h2>[\\s\\S]*?(?=<h2>|$)`, 'i');
}

// Pre-substitutes project-level and data-driven variables into a prompt so they
// are resolved before generateAppealDraftFromPrompt handles the remaining
// {{vars}} (GUIDING_BRIEF, PROJECT_NAME, etc). No-op for prompts that don't
// reference these variables.
async function substituteAppealPromptVariables(promptText, project, projectId) {
  if (!promptText) return promptText;

  const lpaName = Array.isArray(project.local_planning_authority)
    ? project.local_planning_authority.join(', ')
    : project.local_planning_authority || '';

  let text = promptText
    .replace(/\{\{SITE_ADDRESS\}\}/g, project.address || '(not set)')
    .replace(/\{\{LPA_NAME\}\}/g, lpaName || '(not set)')
    .replace(/\{\{DEVELOPMENT_DESCRIPTION\}\}/g, project.development_description || '(not set)');

  if (/\{\{(LOCAL_POLICIES|NATIONAL_POLICIES|NEIGHBOURHOOD_POLICIES|SUPPLEMENTARY_POLICIES|OTHER_POLICIES)\}\}/.test(text)) {
    const { rows: policyRows } = await pool.query(
      `SELECT policy_reference, policy_name, policy_text, policy_type
       FROM public.project_policies WHERE project_id = $1 ORDER BY policy_type, id`,
      [projectId]
    );
    const formatPolicies = rows => rows.length
      ? rows.map(p => {
          const header = `${p.policy_reference}${p.policy_name ? `: ${p.policy_name}` : ''}`;
          const body = p.policy_text?.trim() ? `\n${p.policy_text.trim()}` : '';
          return header + body;
        }).join('\n\n')
      : '(none recorded)';
    text = text
      .replace(/\{\{LOCAL_POLICIES\}\}/g, formatPolicies(policyRows.filter(p => p.policy_type === 'local')))
      .replace(/\{\{NATIONAL_POLICIES\}\}/g, formatPolicies(policyRows.filter(p => p.policy_type === 'national')))
      .replace(/\{\{NEIGHBOURHOOD_POLICIES\}\}/g, formatPolicies(policyRows.filter(p => p.policy_type === 'neighbourhood')))
      .replace(/\{\{SUPPLEMENTARY_POLICIES\}\}/g, formatPolicies(policyRows.filter(p => p.policy_type === 'supplementary')))
      .replace(/\{\{OTHER_POLICIES\}\}/g, formatPolicies(policyRows.filter(p => p.policy_type === 'other')));
  }

  if (/\{\{PLANNING_HISTORY\}\}/.test(text)) {
    const { rows: historyRows } = await pool.query(
      `SELECT section, planning_ref, description, decision, decision_date
       FROM public.project_planning_history WHERE project_id = $1 ORDER BY section, id`,
      [projectId]
    );
    const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
    const fmtHistory = rows => rows.length
      ? rows.map(h => {
          const parts = [];
          if (h.planning_ref) parts.push(`Ref: ${h.planning_ref}`);
          if (h.description)  parts.push(h.description);
          if (h.decision)     parts.push(`Decision: ${h.decision}`);
          const d = fmtDate(h.decision_date);
          if (d) parts.push(`Date: ${d}`);
          return parts.join(', ');
        }).join('\n')
      : 'None recorded.';
    const onSite = historyRows.filter(r => r.section === 'on_site');
    const nearby = historyRows.filter(r => r.section === 'nearby');
    const block = historyRows.length
      ? `On-site:\n${fmtHistory(onSite)}\n\nNearby:\n${fmtHistory(nearby)}`
      : '(none recorded)';
    text = text.replace(/\{\{PLANNING_HISTORY\}\}/g, block);
  }

  return text;
}

// Planning Statement v3 is the only draft type currently wired to the
// independent admin_console.drafting_issues list rather than the shared
// project_issue_tracks ("key issues") table — see draftingIssues.controller.js.
const V3_SLUG = 'planning_statement_v3';

// ─────────────────────────────────────────────────────────────────────────────
// Planning Policy section context — organised by plan/policy-document
// hierarchy (public.policy_documents + public.project_policies.plan_id),
// not by project issue. Used only by the v3 Planning Policy section, which
// generates as a single flat call (see generatePlanningPolicySection in
// appeal.service.js) rather than the issue-ordered pipeline.
// ─────────────────────────────────────────────────────────────────────────────

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function formatPlanDate(doc) {
  if (!doc.year_adopted) return doc.section === 'adopted' ? '[STATUS OR DATE REQUIRED]' : 'emerging';
  const monthPart = doc.month_adopted ? `${MONTH_NAMES[doc.month_adopted - 1]} ` : '';
  const verb = doc.section === 'adopted' ? 'adopted' : 'emerging';
  return `${verb} ${monthPart}${doc.year_adopted}`;
}

function formatPlanDocumentsList(docs) {
  if (!docs.length) return '(none recorded)';
  return docs.map(d => `▪ ${d.plan_name} (${formatPlanDate(d)})`).join('\n');
}

function formatPolicyGroup(policies) {
  const lines = [];
  for (const p of policies) {
    const ref = p.policy_reference ? `Policy ${p.policy_reference}: ` : '';
    const label = `${ref}${p.policy_name}`;
    lines.push(`▪ ${label}`);
    if (p.is_key_policy) {
      lines.push(p.relevant_supporting_text?.trim() || `[ADD RELEVANCE NOTE FOR ${label}]`);
    }
  }
  return lines;
}

function formatPlanPolicies(policies, docs) {
  if (!policies.length) return '(none recorded)';
  const byPlan = {};
  const unassigned = [];
  for (const p of policies) {
    if (p.plan_id) {
      (byPlan[p.plan_id] ??= []).push(p);
    } else {
      unassigned.push(p);
    }
  }
  const lines = [];
  for (const [planId, ps] of Object.entries(byPlan)) {
    const plan = docs.find(d => d.id === Number(planId));
    lines.push(`### ${plan?.plan_name ?? 'Plan'}`, ...formatPolicyGroup(ps));
  }
  if (unassigned.length) {
    lines.push(`### (Not yet linked to a specific plan)`, ...formatPolicyGroup(unassigned));
  }
  return lines.join('\n');
}

function formatDocGroup(docs) {
  if (!docs.length) return '(none recorded)';
  return docs.map(d => {
    const dateStr = d.year_adopted ? ` (${formatPlanDate(d)})` : '';
    const header = `▪ ${d.plan_name}${dateStr}`;
    return d.relevance?.trim() ? `${header}\n${d.relevance.trim()}` : header;
  }).join('\n\n');
}

async function buildPolicyDocumentContext(projectId) {
  const [{ rows: docs }, { rows: policies }] = await Promise.all([
    pool.query(
      `SELECT id, section, plan_name, plan_type, year_adopted, month_adopted, summary, relevance
       FROM policy_documents WHERE project_id = $1 ORDER BY section, id`,
      [projectId]
    ),
    pool.query(
      `SELECT id, policy_reference, policy_name, policy_type, policy_text, relevant_supporting_text, is_key_policy, plan_id
       FROM project_policies WHERE project_id = $1 ORDER BY is_key_policy DESC, id`,
      [projectId]
    ),
  ]);

  const localDocs = docs.filter(d => d.section === 'adopted' && d.plan_type !== 'neighbourhood');
  const neighbourhoodDocs = docs.filter(d => d.section === 'adopted' && d.plan_type === 'neighbourhood');
  const supplementaryDocs = docs.filter(d => d.section === 'supplementary');
  const otherDocs = docs.filter(d => d.section === 'other');

  const localPolicies = policies.filter(p => p.policy_type === 'local');
  const neighbourhoodPolicies = policies.filter(p => p.policy_type === 'neighbourhood');

  return {
    DEVELOPMENT_PLAN_DOCUMENTS: formatPlanDocumentsList(localDocs),
    DEVELOPMENT_PLAN_POLICIES: formatPlanPolicies(localPolicies, docs),
    NEIGHBOURHOOD_PLAN_DOCUMENTS: formatPlanDocumentsList(neighbourhoodDocs),
    NEIGHBOURHOOD_PLAN_POLICIES: formatPlanPolicies(neighbourhoodPolicies, docs),
    SUPPLEMENTARY_PLANNING_DOCUMENTS: formatDocGroup(supplementaryDocs),
    OTHER_POLICY_AND_GUIDANCE: formatDocGroup(otherDocs),
  };
}

async function fetchIssuesForDraftType(draftType, projectId) {
  if (draftType.slug === V3_SLUG) {
    const { rows } = await pool.query(
      `SELECT id, label, discipline, issue_type_id, argument_for, argument_against, summary, specialist_report,
              policy_national, policy_local, policy_neighbourhood, policy_supplementary, policy_other
       FROM admin_console.drafting_issues
       WHERE project_id = $1
       ORDER BY sort_order, id`,
      [projectId]
    );
    return rows;
  }
  const { rows } = await pool.query(
    `SELECT pit.id, pit.label, pit.discipline, ain.argument_against, ain.argument_for
     FROM admin_console.project_issue_tracks pit
     LEFT JOIN planning_applications.issue_notes ain
       ON ain.track_id = pit.id AND ain.project_id = $1
     WHERE pit.project_id = $1 AND pit.is_active = TRUE
     ORDER BY pit.sort_order, pit.id`,
    [projectId]
  );
  return rows;
}

async function fetchLinkedPoliciesForDraftType(draftType, projectId) {
  if (draftType.slug === V3_SLUG) {
    const { rows } = await pool.query(
      `SELECT pp.id, pp.policy_reference, pp.policy_name, pp.policy_type,
              pp.policy_text, pp.relevant_supporting_text, pp.is_key_policy,
              dipr.drafting_issue_id AS track_id
       FROM public.project_policies pp
       JOIN admin_console.drafting_issue_policy_relevance dipr ON dipr.policy_id = pp.id
       WHERE pp.project_id = $1
       ORDER BY dipr.drafting_issue_id, pp.policy_type, pp.policy_reference`,
      [projectId]
    );
    const map = {};
    for (const row of rows) {
      if (!map[row.track_id]) map[row.track_id] = [];
      map[row.track_id].push(row);
    }
    return map;
  }
  return fetchLinkedPoliciesByTrack(projectId);
}

// Fetches everything generateIssueOrderedSection needs for one spliced
// section (Planning Policy / Planning Assessment), standalone. Used by the
// per-section "Generate" button (generateSectionFromPaNotes below) so that
// button goes through the same v3-aware pipeline as a full draft generation,
// instead of silently falling back to the older, generic per-draft-type
// mechanism (wrong issue source, wrong guiding brief, wrong style field)
// that has no idea these sections exist.
async function buildV3SectionContext(project, projectId, typeId, draftType, briefingNoteId) {
  const issues = await fetchIssuesForDraftType(draftType, projectId);

  let briefingNoteQuery;
  if (briefingNoteId) {
    briefingNoteQuery = pool.query(
      `SELECT summary_html FROM planning_applications.document_summaries
       WHERE id = $1 AND project_id = $2 AND doc_type = 'briefing_transcript'`,
      [briefingNoteId, projectId]
    );
  } else {
    briefingNoteQuery = pool.query(
      `SELECT summary_html FROM planning_applications.document_summaries
       WHERE project_id = $1 AND doc_type = 'briefing_transcript'
       ORDER BY created_at DESC LIMIT 1`,
      [projectId]
    );
  }

  const [{ rows: briefingRows }, { rows: startingDocRows }, linkedPoliciesByTrack, allTypesRes] = await Promise.all([
    briefingNoteQuery,
    pool.query(
      `SELECT slot_slug, content_text FROM appeals.pa_draft_starting_docs
       WHERE project_id = $1 AND draft_type_id = $2`,
      [projectId, typeId]
    ),
    fetchLinkedPoliciesForDraftType(draftType, projectId),
    pool.query(
      `SELECT id, label, development_type, nppf_text, nppg_text, other_national_text, other_guidance_text
       FROM admin_console.issue_types ORDER BY label`
    ),
  ]);

  const projectBrief = briefingRows[0]?.summary_html ?? null;
  const startingDocs = Object.fromEntries(startingDocRows.map(r => [r.slot_slug, r.content_text]));
  const allIssueTypes = allTypesRes.rows;

  let briefingNotes = '';
  const briefingSelectionJson = startingDocs['briefing_notes'];
  if (briefingSelectionJson) {
    try {
      const ids = JSON.parse(briefingSelectionJson);
      if (Array.isArray(ids) && ids.length > 0) {
        const { rows: noteRows } = await pool.query(
          `SELECT title, summary_html FROM planning_applications.document_summaries
           WHERE id = ANY($1) AND project_id = $2 AND doc_type = 'briefing_transcript'
           ORDER BY created_at DESC`,
          [ids, projectId]
        );
        briefingNotes = noteRows
          .map(r => `${r.title ? `[${r.title}]\n` : ''}${r.summary_html?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() ?? ''}`)
          .join('\n\n---\n\n');
      }
    } catch { /* malformed JSON — ignore */ }
  }

  // Same shape-normalisation as the full-draft splice loop: v3 links snippet
  // templates many-to-many per (issue, field); other draft types match a
  // single template per issue via project_issue_tracks.issue_type_id.
  let linkedSnippetsByTrack;
  if (draftType.slug === V3_SLUG) {
    const { rows: snippetRows } = await pool.query(
      `SELECT disr.drafting_issue_id, disr.field, it.id, it.label, it.development_type,
              it.nppf_text, it.nppg_text, it.other_national_text, it.other_guidance_text
       FROM admin_console.drafting_issue_snippet_relevance disr
       JOIN admin_console.issue_types it ON it.id = disr.issue_type_id
       JOIN admin_console.drafting_issues di ON di.id = disr.drafting_issue_id
       WHERE di.project_id = $1`,
      [projectId]
    );
    const grouped = {};
    for (const row of snippetRows) {
      const { drafting_issue_id, field, ...issueType } = row;
      const key = `${drafting_issue_id}:${issueType.id}`;
      if (!grouped[key]) {
        grouped[key] = {
          drafting_issue_id,
          id: issueType.id,
          label: issueType.label,
          development_type: issueType.development_type,
          nppf_text: null,
          nppg_text: null,
          other_national_text: null,
          other_guidance_text: null,
        };
      }
      grouped[key][field] = issueType[field];
    }
    linkedSnippetsByTrack = {};
    for (const { drafting_issue_id, ...issueType } of Object.values(grouped)) {
      if (!linkedSnippetsByTrack[drafting_issue_id]) linkedSnippetsByTrack[drafting_issue_id] = [];
      linkedSnippetsByTrack[drafting_issue_id].push(issueType);
    }
  } else {
    const singleMatchByTrack = await fetchIssueTypesByTrack(projectId);
    linkedSnippetsByTrack = Object.fromEntries(
      Object.entries(singleMatchByTrack).map(([trackId, row]) => [trackId, row ? [row] : []])
    );
  }

  return { issues, linkedPoliciesByTrack, linkedSnippetsByTrack, allIssueTypes, projectBrief, startingDocs, briefingNotes };
}

export async function generateDraftFromPaNotes(req, res) {
  const { projectId, typeId } = req.params;
  const { briefingNoteId, developmentType: bodyDevType, provider } = req.body ?? {};
  try {
    const { rows: projectRows } = await pool.query(
      `SELECT project_name, development_type, address, local_planning_authority, development_description
       FROM public.projects WHERE id = $1`, [projectId]
    );
    if (!projectRows.length) return res.status(404).json({ error: 'Project not found' });
    const project = projectRows[0];

    const { rows: typeRows } = await pool.query(
      `SELECT id, name, slug, generation_prompt FROM appeals.appeal_draft_types WHERE id = $1`, [typeId]
    );
    if (!typeRows.length) return res.status(404).json({ error: 'Draft type not found' });
    const draftType = typeRows[0];

    const typePrompt = await substituteAppealPromptVariables(draftType.generation_prompt, project, projectId);

    const issues = await fetchIssuesForDraftType(draftType, projectId);

    // Fetch briefing note (specific by ID, or latest)
    let briefingNoteQuery;
    if (briefingNoteId) {
      briefingNoteQuery = pool.query(
        `SELECT summary_html FROM planning_applications.document_summaries
         WHERE id = $1 AND project_id = $2 AND doc_type = 'briefing_transcript'`,
        [briefingNoteId, projectId]
      );
    } else {
      briefingNoteQuery = pool.query(
        `SELECT summary_html FROM planning_applications.document_summaries
         WHERE project_id = $1 AND doc_type = 'briefing_transcript'
         ORDER BY created_at DESC LIMIT 1`,
        [projectId]
      );
    }
    // planning_statement_v3 is running without any guiding brief as a test —
    // its prompts (top-level and both spliced sections) have their guidance
    // and style example inlined directly as prose instead (see migrations
    // 131-133), so fetching one here would only risk the style example
    // being auto-appended a second time by generateAppealDraftFromPrompt.
    const [{ rows: briefingRows }, guidingBrief, { rows: startingDocRows }] = await Promise.all([
      briefingNoteQuery,
      draftType.slug === V3_SLUG
        ? null
        : getGuidingBrief(GUIDING_BRIEF_SLUG_ALIAS[draftType.slug] || draftType.slug, bodyDevType ?? project.development_type),
      pool.query(
        `SELECT slot_slug, content_text FROM appeals.pa_draft_starting_docs
         WHERE project_id = $1 AND draft_type_id = $2`,
        [projectId, typeId]
      )
    ]);
    const projectBrief = briefingRows[0]?.summary_html ?? null;
    const startingDocs = Object.fromEntries(startingDocRows.map(r => [r.slot_slug, r.content_text]));

    // Resolve briefing note selections stored in the starting docs slot
    let briefingNotes = '';
    const briefingSelectionJson = startingDocs['briefing_notes'];
    if (briefingSelectionJson) {
      try {
        const ids = JSON.parse(briefingSelectionJson);
        if (Array.isArray(ids) && ids.length > 0) {
          const { rows: noteRows } = await pool.query(
            `SELECT title, summary_html FROM planning_applications.document_summaries
             WHERE id = ANY($1) AND project_id = $2 AND doc_type = 'briefing_transcript'
             ORDER BY created_at DESC`,
            [ids, projectId]
          );
          briefingNotes = noteRows
            .map(r => `${r.title ? `[${r.title}]\n` : ''}${r.summary_html?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() ?? ''}`)
            .join('\n\n---\n\n');
        }
      } catch { /* malformed JSON — ignore */ }
    }

    let contentHtml = await generateAppealDraftFromPrompt({
      projectName: project.project_name,
      draftTypeName: draftType.name,
      typePrompt,
      issues,
      guidingBrief,
      projectBrief,
      startingDocs,
      briefingNotes,
      provider,
    });

    // Splice in any sections the main prompt deliberately left as markers —
    // see SECTION_SPLICE_MARKERS. No-op when the main prompt contains neither
    // a marker nor a same-named heading (i.e. this draft type doesn't use them).
    // These sections are generated issue-by-issue (one <h3> + one LLM call per
    // project issue) so each can draw on that issue's linked policies and any
    // development-type-specific policy snippets (admin_console.issue_types).
    let linkedPoliciesByTrack = null;
    let linkedSnippetsByTrack = null;
    let allIssueTypes = null;

    for (const [sectionSlug, marker] of Object.entries(SECTION_SPLICE_MARKERS)) {
      const { rows: sectionRows } = await pool.query(
        `SELECT * FROM appeals.appeal_draft_sections WHERE draft_type_id = $1 AND slug = $2`,
        [typeId, sectionSlug]
      );
      const sectionDef = sectionRows[0];

      const hasMarker = contentHtml.includes(marker);
      // The model is instructed to leave a marker instead of writing this section,
      // but occasionally writes it anyway despite that — fall back to replacing
      // its heading block by name so the split still happens correctly.
      const headingPattern = sectionDef ? buildHeadingBlockPattern(sectionDef.name) : null;
      const hasHeading = !hasMarker && headingPattern?.test(contentHtml);
      if (!hasMarker && !hasHeading) continue;

      const sectionPrompt = sectionDef?.generation_prompt?.trim();
      if (!sectionPrompt) {
        contentHtml = hasMarker ? contentHtml.split(marker).join('') : contentHtml.replace(headingPattern, '');
        continue;
      }

      // Fetched once, lazily, and reused across both sections. allIssueTypes is
      // the whole snippet-template library, offered to the model as candidates
      // for any issue that isn't explicitly linked to any via linkedSnippetsByTrack.
      if (!linkedPoliciesByTrack) {
        const [linkedRes, allTypesRes] = await Promise.all([
          fetchLinkedPoliciesForDraftType(draftType, projectId),
          pool.query(
            `SELECT id, label, development_type, nppf_text, nppg_text, other_national_text, other_guidance_text
             FROM admin_console.issue_types ORDER BY label`
          ),
        ]);
        linkedPoliciesByTrack = linkedRes;
        allIssueTypes = allTypesRes.rows;

        if (draftType.slug === V3_SLUG) {
          // Many-to-many via admin_console.drafting_issue_snippet_relevance —
          // an issue can have several linked templates (manually toggled, or
          // matched by "Draft from Briefing Note").
          const { rows: snippetRows } = await pool.query(
            `SELECT disr.drafting_issue_id, disr.field, it.id, it.label, it.development_type,
                    it.nppf_text, it.nppg_text, it.other_national_text, it.other_guidance_text
             FROM admin_console.drafting_issue_snippet_relevance disr
             JOIN admin_console.issue_types it ON it.id = disr.issue_type_id
             JOIN admin_console.drafting_issues di ON di.id = disr.drafting_issue_id
             WHERE di.project_id = $1`,
            [projectId]
          );
          // Each row is one (issue, template, field) link. Group into one
          // object per (issue, template) pair, populating only the fields
          // that are actually linked — a template's NPPF text can be linked
          // to an issue while its NPPG text is not, for example.
          const grouped = {};
          for (const row of snippetRows) {
            const { drafting_issue_id, field, ...issueType } = row;
            const key = `${drafting_issue_id}:${issueType.id}`;
            if (!grouped[key]) {
              grouped[key] = {
                drafting_issue_id,
                id: issueType.id,
                label: issueType.label,
                development_type: issueType.development_type,
                nppf_text: null,
                nppg_text: null,
                other_national_text: null,
                other_guidance_text: null,
              };
            }
            grouped[key][field] = issueType[field];
          }
          linkedSnippetsByTrack = {};
          for (const { drafting_issue_id, ...issueType } of Object.values(grouped)) {
            if (!linkedSnippetsByTrack[drafting_issue_id]) linkedSnippetsByTrack[drafting_issue_id] = [];
            linkedSnippetsByTrack[drafting_issue_id].push(issueType);
          }
        } else {
          // Single-match via project_issue_tracks.issue_type_id (unchanged),
          // normalised to the same array-per-issue shape.
          const singleMatchByTrack = await fetchIssueTypesByTrack(projectId);
          linkedSnippetsByTrack = Object.fromEntries(
            Object.entries(singleMatchByTrack).map(([trackId, row]) => [trackId, row ? [row] : []])
          );
        }
      }

      const substitutedSectionPrompt = await substituteAppealPromptVariables(sectionPrompt, project, projectId);
      // planning_statement_v3's section prompts have their guidance and
      // style inlined directly (migrations 132/133) and run without a
      // guiding brief, as a test — see the matching comment above.
      const sectionGuidingBriefSlug = SECTION_GUIDING_BRIEF_SLUGS[sectionSlug];
      const sectionGuidingBrief = draftType.slug === V3_SLUG
        ? null
        : sectionGuidingBriefSlug
          ? await getGuidingBrief(sectionGuidingBriefSlug, bodyDevType ?? project.development_type)
          : guidingBrief;

      // Planning Policy is organised by plan/policy-document hierarchy, not
      // by issue — it gets a flat single call instead of the issue-ordered
      // pipeline the other spliced section (Planning Assessment) uses.
      const sectionHtml = sectionSlug === 'planning_policy'
        ? await generatePlanningPolicySection({
            sectionName: sectionDef.name,
            sectionPromptTemplate: substitutedSectionPrompt,
            policyContext: await buildPolicyDocumentContext(projectId),
            projectName: project.project_name,
            projectBrief,
            startingDocs,
            briefingNotes,
            provider,
          })
        : await generateIssueOrderedSection({
            sectionName: sectionDef.name,
            sectionPromptTemplate: substitutedSectionPrompt,
            projectName: project.project_name,
            issues,
            linkedPoliciesByTrack,
            linkedSnippetsByTrack,
            allIssueTypes,
            guidingBrief: sectionGuidingBrief,
            projectBrief,
            startingDocs,
            briefingNotes,
            provider,
          });
      contentHtml = hasMarker
        ? contentHtml.split(marker).join(sectionHtml)
        : contentHtml.replace(headingPattern, sectionHtml + '\n\n');
    }

    const { rows } = await pool.query(
      `INSERT INTO appeals.appeal_drafts (project_id, draft_type_id, content_html, generated_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (project_id, draft_type_id)
       DO UPDATE SET content_html = $3, generated_at = NOW(), updated_at = NOW()
       RETURNING *`,
      [projectId, typeId, contentHtml]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('generateDraftFromPaNotes error:', err);
    res.status(500).json({ error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Starting documents — per-project source docs for PA-workspace appeal drafts
// ─────────────────────────────────────────────────────────────────────────────

export async function getStartingDocs(req, res) {
  const { projectId, typeId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT slot_slug, content_text, file_name, updated_at
       FROM appeals.pa_draft_starting_docs
       WHERE project_id = $1 AND draft_type_id = $2`,
      [projectId, typeId]
    );
    res.json(rows);
  } catch (err) {
    console.error('getStartingDocs error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function upsertStartingDoc(req, res) {
  const { projectId, typeId, slotSlug } = req.params;
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
      `INSERT INTO appeals.pa_draft_starting_docs
         (project_id, draft_type_id, slot_slug, content_text, file_name, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (project_id, draft_type_id, slot_slug)
       DO UPDATE SET content_text = $4, file_name = $5, updated_at = NOW()
       RETURNING slot_slug, content_text, file_name, updated_at`,
      [projectId, typeId, slotSlug, contentText, fileName]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('upsertStartingDoc error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function deleteStartingDoc(req, res) {
  const { projectId, typeId, slotSlug } = req.params;
  try {
    await pool.query(
      `DELETE FROM appeals.pa_draft_starting_docs
       WHERE project_id = $1 AND draft_type_id = $2 AND slot_slug = $3`,
      [projectId, typeId, slotSlug]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('deleteStartingDoc error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function getAppealTypePrompt(req, res) {
  const { typeId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT generation_prompt FROM appeals.appeal_draft_types WHERE id = $1`, [typeId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Draft type not found' });
    res.json({ prompt: rows[0].generation_prompt ?? DEFAULT_DRAFT_PROMPT, isCustom: !!rows[0].generation_prompt });
  } catch (err) {
    console.error('getAppealTypePrompt error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function saveAppealTypePrompt(req, res) {
  const { typeId } = req.params;
  const { prompt } = req.body;
  if (!prompt?.trim()) return res.status(400).json({ error: 'prompt is required' });
  try {
    await pool.query(
      `UPDATE appeals.appeal_draft_types SET generation_prompt = $1 WHERE id = $2`, [prompt.trim(), typeId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('saveAppealTypePrompt error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function resetAppealTypePrompt(req, res) {
  const { typeId } = req.params;
  try {
    await pool.query(`UPDATE appeals.appeal_draft_types SET generation_prompt = NULL WHERE id = $1`, [typeId]);
    res.json({ prompt: DEFAULT_DRAFT_PROMPT, isCustom: false });
  } catch (err) {
    console.error('resetAppealTypePrompt error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function generateSectionFromPaNotes(req, res) {
  const { projectId, typeId, sectionId } = req.params;
  const { briefingNoteId, developmentType: bodyDevType, provider: requestedProvider } = req.body ?? {};
  try {
    const provider = await resolveProvider('appeal_draft_pa_notes', requestedProvider);
    const { rows: projectRows } = await pool.query(
      `SELECT project_name, development_type, address, local_planning_authority, development_description
       FROM public.projects WHERE id = $1`, [projectId]
    );
    if (!projectRows.length) return res.status(404).json({ error: 'Project not found' });
    const project = projectRows[0];

    const { rows: typeRows } = await pool.query(
      `SELECT name, slug FROM appeals.appeal_draft_types WHERE id = $1`, [typeId]
    );
    if (!typeRows.length) return res.status(404).json({ error: 'Draft type not found' });
    const draftType = typeRows[0];

    const { rows: sectionRows } = await pool.query(
      `SELECT * FROM appeals.appeal_draft_sections WHERE id = $1 AND draft_type_id = $2`,
      [sectionId, typeId]
    );
    if (!sectionRows.length) return res.status(404).json({ error: 'Section not found' });
    const sectionDef = sectionRows[0];

    // Planning Statement v3's Planning Policy / Planning Assessment sections
    // are spliced sections with their own issue-ordered generation pipeline
    // (see generateDraftFromPaNotes) — this per-section "Generate" button
    // (Configure sections modal) must go through that same pipeline, not the
    // generic one below, which has no concept of drafting_issues, per-issue
    // policy/snippet context, or these sections' own dedicated guiding briefs
    // (it was resolving the main planning_statement_v3 brief instead of
    // planning_policy_v3 / planning_assessment_v3, and pulling issues from
    // the old project_issue_tracks table instead of drafting_issues).
    if (draftType.slug === V3_SLUG && SECTION_SPLICE_MARKERS[sectionDef.slug]) {
      const sectionPrompt = sectionDef.generation_prompt?.trim();
      if (!sectionPrompt) return res.status(400).json({ error: 'No generation prompt configured for this section' });

      const context = await buildV3SectionContext(project, projectId, typeId, draftType, briefingNoteId);

      // planning_statement_v3's section prompts have their guidance and
      // style inlined directly (migrations 132/133) and run without a
      // guiding brief, as a test — see the matching comment in
      // generateDraftFromPaNotes's splice loop.
      const substitutedSectionPrompt = await substituteAppealPromptVariables(sectionPrompt, project, projectId);

      // Planning Policy is organised by plan/policy-document hierarchy, not
      // by issue — flat single call, same as the splice loop in
      // generateDraftFromPaNotes, instead of the issue-ordered pipeline.
      const html = sectionDef.slug === 'planning_policy'
        ? await generatePlanningPolicySection({
            sectionName: sectionDef.name,
            sectionPromptTemplate: substitutedSectionPrompt,
            policyContext: await buildPolicyDocumentContext(projectId),
            projectName: project.project_name,
            projectBrief: context.projectBrief,
            startingDocs: context.startingDocs,
            briefingNotes: context.briefingNotes,
            provider,
          })
        : await generateIssueOrderedSection({
            sectionName: sectionDef.name,
            sectionPromptTemplate: substitutedSectionPrompt,
            projectName: project.project_name,
            issues: context.issues,
            linkedPoliciesByTrack: context.linkedPoliciesByTrack,
            linkedSnippetsByTrack: context.linkedSnippetsByTrack,
            allIssueTypes: context.allIssueTypes,
            guidingBrief: null,
            projectBrief: context.projectBrief,
            startingDocs: context.startingDocs,
            briefingNotes: context.briefingNotes,
            provider,
          });

      return res.json({ html, section_id: sectionDef.id, section_name: sectionDef.name });
    }

    const { rows: issues } = await pool.query(
      `SELECT pit.id, pit.label, pit.discipline, ain.argument_against, ain.argument_for
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

    const guidingBrief = await getGuidingBrief(
      GUIDING_BRIEF_SLUG_ALIAS[draftType.slug] || draftType.slug,
      project.development_type
    );

    const substitutedPrompt = await substituteAppealPromptVariables(
      sectionDef.generation_prompt, project, projectId
    );

    const html = await generateDraftSection({
      section: { ...sectionDef, generation_prompt: substitutedPrompt },
      projectName: project.project_name,
      draftTypeName: draftType.name,
      issueContext,
      guidingBrief,
      provider,
    });

    res.json({ html, section_id: sectionDef.id, section_name: sectionDef.name });
  } catch (err) {
    console.error('generateSectionFromPaNotes error:', err);
    res.status(500).json({ error: err.message });
  }
}

// Some draft type slugs share guiding briefs stored under a different document_type key.
const GUIDING_BRIEF_SLUG_ALIAS = {
  hlpv_narrative: 'hlpv',
};

async function fetchPromptContext(projectId, typeSlug, developmentType) {
  const briefDocType = GUIDING_BRIEF_SLUG_ALIAS[typeSlug] || typeSlug;
  const [projectBriefRows, guidingBrief] = await Promise.all([
    pool.query(
      `SELECT summary_html FROM planning_applications.document_summaries
       WHERE project_id = $1 AND doc_type = 'briefing_note'
       ORDER BY created_at DESC LIMIT 1`,
      [projectId]
    ),
    getGuidingBrief(briefDocType, developmentType)
  ]);
  return {
    projectBrief: projectBriefRows.rows[0]?.summary_html ?? null,
    guidingBrief
  };
}

async function fetchExampleDoc(projectId, typeId) {
  const { rows: typeRows } = await pool.query(
    `SELECT slug FROM appeals.appeal_draft_types WHERE id = $1`, [typeId]
  );
  if (!typeRows.length) return null;

  const { rows } = await pool.query(
    `SELECT doc_text, filename FROM admin_console.document_templates WHERE document_type = $1`,
    [typeRows[0].slug]
  );
  return rows[0]?.doc_text
    ? { text: rows[0].doc_text, filename: rows[0].filename }
    : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Briefing notes (shared storage with planning-application)
// ─────────────────────────────────────────────────────────────────────────────

export async function getBriefingNotes(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT id, title, file_name, created_at, length(summary_html) AS summary_length
       FROM planning_applications.document_summaries
       WHERE project_id = $1 AND doc_type = 'briefing_transcript'
       ORDER BY created_at DESC`,
      [projectId]
    );
    res.json(rows);
  } catch (err) {
    console.error('appeal.getBriefingNotes error:', err);
    res.status(500).json({ error: 'Failed to fetch briefing notes' });
  }
}

export async function uploadBriefingNote(req, res) {
  const { projectId } = req.params;
  try {
    let text, fileName;
    if (req.file) {
      ({ text } = await parseFile(req.file.buffer, req.file.originalname));
      fileName = req.file.originalname;
    } else if (req.body.text) {
      text = req.body.text;
      fileName = null;
    } else {
      return res.status(400).json({ error: 'No file or text provided' });
    }
    const title = req.body.title?.trim() || fileName || 'Briefing note';
    const { rows: promptRows } = await pool.query(
      `SELECT prompt_template FROM planning_applications.doc_type_prompts WHERE doc_type = $1`,
      ['briefing_transcript']
    );
    const customPrompt = promptRows[0]?.prompt_template ?? null;
    const summaryHtml = await summariseDocument(text, fileName, 'briefing_transcript', customPrompt);
    const { rows } = await pool.query(
      `INSERT INTO planning_applications.document_summaries
         (project_id, title, file_name, doc_type, summary_html, transcript_text)
       VALUES ($1, $2, $3, 'briefing_transcript', $4, $5) RETURNING id, title, file_name, created_at`,
      [projectId, title, fileName, summaryHtml, text]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('appeal.uploadBriefingNote error:', err);
    res.status(500).json({ error: err.message || 'Failed to upload briefing note' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Scoped incorporation — Step 1: scope which paragraphs are relevant
// ─────────────────────────────────────────────────────────────────────────────

export async function scopeIncorporation(req, res) {
  const { projectId, typeId } = req.params;
  const { document_id, document_text, document_title, provider: requestedProvider } = req.body ?? {};
  const paragraphs = JSON.parse(req.body?.paragraphs || '[]');

  if (!paragraphs?.length) return res.status(400).json({ error: 'paragraphs required' });
  if (!document_id && !document_text && !req.file) return res.status(400).json({ error: 'document_id, document_text, or file required' });

  try {
    const provider = await resolveProvider('appeal_argument_building', requestedProvider);
    const { rows: projectRows } = await pool.query(
      `SELECT development_type FROM public.projects WHERE id = $1`, [projectId]
    );
    const { rows: typeRows } = await pool.query(
      `SELECT slug FROM appeals.appeal_draft_types WHERE id = $1`, [typeId]
    );

    let documentText, filename;
    if (document_id) {
      const { rows } = await pool.query(
        `SELECT filename, file_text FROM public.appeal_documents WHERE id = $1 AND project_id = $2`,
        [document_id, projectId]
      );
      if (!rows.length) return res.status(404).json({ error: 'Document not found' });
      documentText = rows[0].file_text ?? '';
      filename = rows[0].filename;
    } else if (req.file) {
      const parsed = await parseFile(req.file.buffer, req.file.originalname);
      documentText = parsed.text;
      filename = document_title || req.file.originalname;
    } else {
      documentText = document_text;
      filename = document_title || 'Pasted document';
    }

    const [issueRows, { guidingBrief }] = await Promise.all([
      pool.query(
        `SELECT pit.id, pit.label, pit.discipline, ain.argument_against, ain.argument_for
         FROM admin_console.project_issue_tracks pit
         LEFT JOIN public.appeal_issue_notes ain
           ON ain.track_id = pit.id AND ain.project_id = $1
         WHERE pit.project_id = $1 AND pit.is_active = TRUE
         ORDER BY pit.sort_order, pit.id`,
        [projectId]
      ),
      fetchPromptContext(projectId, typeRows[0]?.slug, projectRows[0]?.development_type)
    ]);

    const result = await scopeDocumentIncorporation({
      paragraphs,
      documentText,
      filename,
      issues: issueRows.rows,
      guidingBrief,
      customPrompt: await loadGlobalPrompt('scope_incorporation'),
      provider,
    });
    res.json({ ...result, filename });
  } catch (err) {
    console.error('scopeIncorporation error:', err);
    res.status(500).json({ error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Scoped incorporation — Step 2: update only targeted paragraphs
// ─────────────────────────────────────────────────────────────────────────────

export async function incorporateTargeted(req, res) {
  const { projectId, typeId } = req.params;
  const { document_id, document_text, document_title, user_notes = null, provider: requestedProvider } = req.body ?? {};
  const paragraphs = JSON.parse(req.body?.paragraphs || '[]');

  if (!paragraphs?.length) return res.status(400).json({ error: 'paragraphs required' });
  if (!document_id && !document_text && !req.file) return res.status(400).json({ error: 'document_id, document_text, or file required' });

  try {
    const provider = await resolveProvider('appeal_argument_building', requestedProvider);
    const { rows: projectRows } = await pool.query(
      `SELECT project_name, development_type FROM public.projects WHERE id = $1`, [projectId]
    );
    const { rows: typeRows } = await pool.query(
      `SELECT name, slug FROM appeals.appeal_draft_types WHERE id = $1`, [typeId]
    );

    let documentText, filename;
    if (document_id) {
      const { rows } = await pool.query(
        `SELECT filename, file_text FROM public.appeal_documents WHERE id = $1 AND project_id = $2`,
        [document_id, projectId]
      );
      if (!rows.length) return res.status(404).json({ error: 'Document not found' });
      documentText = rows[0].file_text ?? '';
      filename = rows[0].filename;
    } else if (req.file) {
      const parsed = await parseFile(req.file.buffer, req.file.originalname);
      documentText = parsed.text;
      filename = document_title || req.file.originalname;
    } else {
      documentText = document_text;
      filename = document_title || 'Pasted document';
    }

    const [issueRows, { projectBrief, guidingBrief }, exampleDoc] = await Promise.all([
      pool.query(
        `SELECT pit.id, pit.label, pit.discipline, ain.argument_against, ain.argument_for
         FROM admin_console.project_issue_tracks pit
         LEFT JOIN public.appeal_issue_notes ain
           ON ain.track_id = pit.id AND ain.project_id = $1
         WHERE pit.project_id = $1 AND pit.is_active = TRUE
         ORDER BY pit.sort_order, pit.id`,
        [projectId]
      ),
      fetchPromptContext(projectId, typeRows[0]?.slug, projectRows[0]?.development_type),
      fetchExampleDoc(projectId, typeId)
    ]);

    const updated = await incorporateTargetedParagraphs({
      paragraphs,
      documentText,
      filename,
      issues: issueRows.rows,
      userNotes: user_notes,
      projectName: projectRows[0]?.project_name,
      draftTypeName: typeRows[0]?.name,
      guidingBrief,
      projectBrief,
      exampleDoc,
      customPrompt: await loadGlobalPrompt('incorporate_appeal'),
      provider,
    });
    res.json({ updated });
  } catch (err) {
    console.error('incorporateTargeted error:', err);
    res.status(500).json({ error: err.message });
  }
}
