/**
 * Draft Check Controller
 * Powers the "Check Draft" panel — runs a working draft through a set of
 * independent LLM checks: guiding brief coverage, project information
 * consistency, and grammar & style. Each check is its own endpoint so the
 * frontend can run them in parallel and render results as they arrive.
 *
 * Prompt templates live in admin_console.llm_prompts (seeded by migration
 * 083) with hardcoded fallbacks below — same pattern as stage1_review.
 */

import { pool } from '../db.js';
import { callLLM, parseJSON, MODEL_FAST, resolveProvider } from '../services/llm.shared.js';
import { getGuidingBrief } from './guidingBriefs.controller.js';
import { getDocumentStyleTemplateByDocType } from './documentStyleTemplates.controller.js';

const DRAFT_TEXT_CAP = 40000;

const SYSTEM_PROMPT = 'You are a senior planning consultant quality-checking a colleague\'s working draft before it goes to the client. Be precise and specific. Return only valid JSON. Never use em dashes (—) in any output; use a comma, colon, or rewrite the sentence instead.';

export const DEFAULT_BRIEF_CHECK_TEMPLATE = `You are reviewing a working draft of a planning document against the practice's guiding brief for this document type.

## Guiding Brief
{{GUIDING_BRIEF}}

## Review Checklist
{{REVIEW_CHECKLIST}}

## Working Draft (plain text)
{{DRAFT_TEXT}}

Go through every distinct topic, requirement, or expectation in the guiding brief and review checklist. For each one, assess whether the working draft covers it adequately, and frame a question to put to the author.

Return ONLY a valid JSON object — no explanation, no markdown fences:
{
  "items": [
    {
      "topic": "short label for the checklist topic",
      "question": "a direct question to the author, e.g. 'Have you considered the impact on the setting of nearby listed buildings?'",
      "status": "present" | "partial" | "missing",
      "suggestion": "one concise sentence on what is missing or could be strengthened, or null if status is present"
    }
  ]
}

Rules:
- "present" = clearly and adequately addressed; "partial" = mentioned but thin, vague, or incomplete; "missing" = not addressed at all
- Always include the question, even for "present" items — it lets the author sanity-check the coverage
- Some topics may legitimately not apply to this project. Absence is not automatically an error — flag it and ask the question so the author can confirm it was considered and dismissed
- Keep suggestions short and actionable — one sentence maximum`;

export const DEFAULT_CONSISTENCY_CHECK_TEMPLATE = `You are checking a working draft of a planning document for factual consistency against the project's recorded information.

## Recorded Project Information (ground truth)
{{PROJECT_INFO}}

## Working Draft (plain text)
{{DRAFT_TEXT}}

Check every project detail used in the draft against the recorded information: project and site names, applicant name, local planning authority, site address, description of development, application references, dates, and any other facts listed. Also flag internal inconsistencies within the draft itself — figures, names, or descriptions that change between sections.

Return ONLY a valid JSON object — no explanation, no markdown fences:
{
  "items": [
    {
      "field": "what is being checked, e.g. 'Site address'",
      "expected": "the value from the recorded project information, or null for internal draft inconsistencies",
      "found_in_draft": "what the draft actually says (verbatim where possible), or null if not mentioned",
      "status": "consistent" | "mismatch" | "not_mentioned",
      "note": "one sentence explanation, or null if consistent"
    }
  ]
}

Rules:
- Report each recorded field exactly once, in the order given
- "not_mentioned" is informational — some fields legitimately do not appear in every document type
- For mismatches, quote the draft wording exactly in found_in_draft
- Append any internal draft inconsistencies as extra items after the recorded fields`;

export const DEFAULT_GRAMMAR_CHECK_TEMPLATE = `You are proofreading a working draft of a professional UK planning document.

## House Style Guide
{{STYLE_GUIDE}}

## Working Draft (plain text)
{{DRAFT_TEXT}}

Identify grammar, spelling, punctuation, and style issues: typos; grammatical errors; inconsistent terminology or abbreviations (e.g. an abbreviation used before it is defined, or "the Council" and "the LPA" used interchangeably); inconsistent capitalisation of defined terms; US spellings; repeated or missing words; and departures from the house style guide above.

Return ONLY a valid JSON object — no explanation, no markdown fences:
{
  "items": [
    {
      "excerpt": "verbatim text from the draft containing the issue (max 120 characters)",
      "issue": "short description of the problem",
      "suggestion": "the corrected text or recommended approach",
      "severity": "high" | "medium" | "low"
    }
  ]
}

Rules:
- "high" = errors a client would notice (wrong words, broken grammar, misspellings); "medium" = inconsistencies in terminology, capitalisation, or formatting; "low" = polish
- Surface mechanical issues only — do not rewrite for tone and do not restructure content
- Return at most 30 items, the most important first, ordered by severity`;

const DEFAULT_TEMPLATES = {
  draft_check_brief: DEFAULT_BRIEF_CHECK_TEMPLATE,
  draft_check_consistency: DEFAULT_CONSISTENCY_CHECK_TEMPLATE,
  draft_check_grammar: DEFAULT_GRAMMAR_CHECK_TEMPLATE,
};

async function loadPromptTemplate(promptKey) {
  const { rows } = await pool.query(
    `SELECT prompt_text FROM admin_console.llm_prompts WHERE prompt_key = $1`,
    [promptKey]
  );
  return rows[0]?.prompt_text ?? DEFAULT_TEMPLATES[promptKey];
}

function htmlToPlain(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, DRAFT_TEXT_CAP);
}

function requireDraftFields(req, res) {
  const { draft_html, document_type } = req.body;
  if (!draft_html?.trim()) {
    res.status(400).json({ error: 'draft_html is required' });
    return null;
  }
  if (!document_type?.trim()) {
    res.status(400).json({ error: 'document_type is required' });
    return null;
  }
  return { draftText: htmlToPlain(draft_html), documentType: document_type.trim() };
}

async function runCheck(promptKey, substitutions) {
  let prompt = await loadPromptTemplate(promptKey);
  for (const [key, value] of Object.entries(substitutions)) {
    prompt = prompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), () => value);
  }
  const raw = await callClaude(SYSTEM_PROMPT, prompt, MODEL_FAST, 4000);
  const parsed = parseJSON(raw);
  return Array.isArray(parsed.items) ? parsed.items : [];
}

// ── 1. Guiding brief coverage ────────────────────────────────────────────────

export async function checkBriefCoverage(req, res) {
  const fields = requireDraftFields(req, res);
  if (!fields) return;
  const { development_type } = req.body;

  try {
    const brief = await getGuidingBrief(fields.documentType, development_type || null);
    if (!brief) return res.json({ items: [], no_brief: true });

    const guidance = brief.guidance_content?.trim();
    const checklist = brief.review_checklist?.trim();
    if (!guidance && !checklist) return res.json({ items: [], no_content: true });

    const items = await runCheck('draft_check_brief', {
      GUIDING_BRIEF: guidance || '(no guiding brief content set, rely on the review checklist below)',
      REVIEW_CHECKLIST: checklist || '(no separate review checklist set, derive the topics to check from the guiding brief above)',
      DRAFT_TEXT: fields.draftText,
    });
    res.json({ items });
  } catch (err) {
    console.error('draftCheck.briefCoverage error:', err);
    res.status(500).json({ error: 'Failed to run guiding brief check' });
  }
}

// ── 2. Project information consistency ───────────────────────────────────────

export async function checkConsistency(req, res) {
  const fields = requireDraftFields(req, res);
  if (!fields) return;
  const { projectId } = req.params;

  try {
    const [projectRows, projectInfoRows, historyRows] = await Promise.all([
      pool.query(
        `SELECT project_name, project_id, client, client_spv_name, local_planning_authority,
                address, area, development_description, development_type, case_officer_name,
                submission_date, target_determination_date,
                designations_on_site, relevant_nearby_designations
         FROM public.projects WHERE id = $1`,
        [projectId]
      ),
      pool.query(
        `SELECT pi.*
         FROM admin_console.project_information pi
         JOIN public.projects p ON p.unique_id = pi.project_id
         WHERE p.id = $1`,
        [projectId]
      ),
      pool.query(
        `SELECT section, planning_ref, description, decision, decision_date
         FROM public.project_planning_history
         WHERE project_id = $1
         ORDER BY section, id`,
        [projectId]
      ),
    ]);
    if (!projectRows.rows.length) return res.status(404).json({ error: 'Project not found' });
    const p = projectRows.rows[0];

    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
    const lpa = Array.isArray(p.local_planning_authority)
      ? p.local_planning_authority.join(', ')
      : p.local_planning_authority;
    const infoLines = [
      ['Project name', p.project_name],
      ['Project reference', p.project_id],
      ['Applicant / client', p.client],
      ['Client SPV name', p.client_spv_name],
      ['Local planning authority', lpa],
      ['Site address', p.address],
      ['Site area', p.area],
      ['Description of development', p.development_description],
      ['Development type', p.development_type],
      ['Designations on site', p.designations_on_site],
      ['Relevant nearby designations', p.relevant_nearby_designations],
      ['Case officer', p.case_officer_name],
      ['Submission date', formatDate(p.submission_date)],
      ['Target determination date', formatDate(p.target_determination_date)],
    ].filter(([, v]) => v?.toString().trim())
     .map(([label, v]) => `${label}: ${v}`);

    // Detailed technical specification from admin_console.project_information —
    // panel counts, export capacities, heights etc. that drafts most often get wrong.
    const TECH_FIELD_LABELS = {
      client_or_spv_name:       'Client or SPV name',
      detailed_description:     'Detailed project description',
      proposed_use_duration:    'Proposed use duration',
      distribution_network:     'Distribution network',
      solar_export_capacity:    'Solar export capacity',
      pv_max_panel_height:      'Maximum PV panel height',
      fence_height:             'Fence height',
      pv_clearance_from_ground: 'PV clearance from ground',
      number_of_solar_panels:   'Number of solar panels',
      panel_tilt:               'Panel tilt',
      panel_tilt_direction:     'Panel tilt direction',
      bess_export_capacity:     'BESS export capacity',
      bess_containers:          'Number of BESS containers',
      gwh_per_year:             'Energy generation (GWh per year)',
      homes_powered:            'Equivalent homes powered',
      co2_offset:               'CO2 offset',
      equivalent_cars:          'Equivalent cars removed',
      access_arrangements:      'Access arrangements',
      parking_details:          'Parking details',
      atv_use:                  'ATV use',
      additional_notes:         'Additional project notes',
    };
    const techInfo = projectInfoRows.rows[0] ?? {};
    const techLines = Object.entries(TECH_FIELD_LABELS)
      .filter(([key]) => techInfo[key]?.toString().trim())
      .map(([key, label]) => `${label}: ${techInfo[key]}`);

    const historyLines = historyRows.rows.map(h => {
      const parts = [h.planning_ref, h.description, h.decision, formatDate(h.decision_date)].filter(Boolean);
      return `Planning history (${h.section === 'on_site' ? 'on-site' : 'nearby'}): ${parts.join(', ')}`;
    });

    const projectInfo = [...infoLines, ...techLines, ...historyLines].join('\n');
    if (!projectInfo.trim()) return res.json({ items: [], no_project_info: true });

    const items = await runCheck('draft_check_consistency', {
      PROJECT_INFO: projectInfo,
      DRAFT_TEXT: fields.draftText,
    });
    res.json({ items });
  } catch (err) {
    console.error('draftCheck.consistency error:', err);
    res.status(500).json({ error: 'Failed to run consistency check' });
  }
}

// ── 3. Grammar & style ───────────────────────────────────────────────────────

export async function checkGrammar(req, res) {
  const fields = requireDraftFields(req, res);
  if (!fields) return;
  const { development_type } = req.body;

  try {
    const styleTemplate = await getDocumentStyleTemplateByDocType(fields.documentType, development_type || null);
    const items = await runCheck('draft_check_grammar', {
      STYLE_GUIDE: styleTemplate?.style_text?.trim() || '(no house style guide set for this document type, apply standard professional UK planning document conventions)',
      DRAFT_TEXT: fields.draftText,
    });
    res.json({ items });
  } catch (err) {
    console.error('draftCheck.grammar error:', err);
    res.status(500).json({ error: 'Failed to run grammar check' });
  }
}
