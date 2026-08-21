# PA Workspace — Document Types Reference

## Overview

The workspace loads doc types from **two separate tables** and merges them at runtime in `frontend/src/lib/stores/planning-drafts.js → loadDraftTypes()`.

- `planning_applications.draft_types` → tagged `tool: 'pa'` or `tool: 'stage1'`
- `appeals.appeal_draft_types` → tagged `tool: 'appeal'`, id prefixed `appeal_` in frontend

---

## Document Types

### 1. Planning Statement (`planning_statement`)
- **Table:** `planning_applications.draft_types`
- **Tool tag:** `pa`
- **Generation:** Per-section. Each section in `planning_applications.draft_sections` has either `template_html` (static scaffold with `{{VARIABLE}}` + `{{LLM:slug}}...{{/LLM}}` slots) or `generation_prompt` (written instruction for the LLM).
- **Generation paths** (in `planningApplication.controller.js → generateDraft` / `generateSection`):
  - `template_html` → `generateFromTemplate()` — substitutes variables, then calls LLM for dynamic slots
  - `slug === 'planning_assessment'` → `generatePlanningStatementAssessment()` — per-issue policy assessment
  - `generation_prompt` contains `{{` → `generatePlanningStatementSection()` — prompt-based with variable substitution
  - fallback → `generateDraftSection()` — simple issue-context generation
- **Variable resolution:** `resolvePlanningStatementVariables(projectId)` in `planningApplication.controller.js`
- **Services:** `backend/src/services/planningStatement.service.js`

#### Available `{{VARIABLES}}` for Planning Statement

| Variable | Source | Notes |
|---|---|---|
| `PROJECT_NAME` | `projects.project_name` | |
| `APPLICANT_NAME` | `projects.client` | |
| `LPA_NAME` | `projects.local_planning_authority` | |
| `SITE_ADDRESS` | `projects.address` | |
| `DEVELOPMENT_DESCRIPTION` | `projects.development_description` | |
| `PROPOSED_DEVELOPMENT` | `document_summaries` (type: `proposed_development`) | Plain text |
| `PROPOSED_DEVELOPMENT_HTML` | `document_summaries` (type: `proposed_development`) | HTML |
| `SITE_SURROUNDINGS` | `document_summaries` (type: `site_surroundings`) | Plain text |
| `SITE_SURROUNDINGS_HTML` | `document_summaries` (type: `site_surroundings`) | HTML |
| `ABOUT_APPLICANT` | `document_summaries` (type: `about_applicant`) | |
| `PRE_APP_SUMMARY` | `document_summaries` (type: `pre_app`) | |
| `EIA_SUMMARY` | `document_summaries` (type: `eia_response`) | |
| `SCI_SUMMARY` | `document_summaries` (type: `sci`) | |
| `DOCUMENT_LIST` | `planning_applications.document_log` | Plain text bullet list |
| `DOCUMENT_LIST_DOCS` | `document_log` (item_type: `document`) | HTML `<ul>` |
| `DOCUMENT_LIST_DRAWINGS` | `document_log` (item_type: `drawing`) | HTML `<ul>` |
| `LOCAL_POLICIES` | `public.project_policies` (type: `local`) | All local — key policies include verbatim text |
| `LOCAL_POLICIES_KEY` | `public.project_policies` | Key local policies only, with verbatim text |
| `LOCAL_POLICIES_OTHER` | `public.project_policies` | Non-key local — ref + name only |
| `LOCAL_POLICY_NAMES` | `public.project_policies` | All local — ref + name only, no text |
| `LOCAL_POLICIES_CONTEXT` | `public.project_policies` | Slim: ref, name, relevant_supporting_text (400 char) |
| `NATIONAL_POLICIES` | `public.project_policies` (type: `national`) | With verbatim text |
| `NATIONAL_POLICIES_CONTEXT` | `public.project_policies` | Slim context version |
| `SUPPLEMENTARY_POLICIES` | `public.project_policies` (type: `supplementary`) | Ref + name only |
| `SUPPLEMENTARY_POLICY_NAMES` | `public.project_policies` | Same |
| `OTHER_POLICIES` | `public.project_policies` (other types) | With verbatim text |
| `OTHER_POLICIES_CONTEXT` | `public.project_policies` | Slim context version |
| `PLANNING_HISTORY` | `planning_applications.planning_history` | Plain text (app-level history) |
| `PLANNING_HISTORY_TABLE` | `planning_applications.planning_history` | HTML table |
| `PROJECT_PLANNING_HISTORY` | `public.project_planning_history` | HTML — on-site + nearby, split into two tables |
| `NPPF_TEXT` | `planning_applications.policy_context_templates` | Dev-type-specific national policy boilerplate |
| `NPPG_TEXT` | `planning_applications.policy_context_templates` | |
| `OTHER_NATIONAL_TEXT` | `planning_applications.policy_context_templates` | |
| `OTHER_GUIDANCE_TEXT` | `planning_applications.policy_context_templates` | |
| `FULL_STATEMENT` | `planning_applications.drafts` | Assembled HTML of all prior sections — only used in `runs_last` sections (e.g. Executive Summary) |

#### Missing / not yet wired
| Table | Status |
|---|---|
| `public.policy_documents` (adopted/emerging/other plan list) | **Not yet a variable** — placeholder `[List the development plan documents]` exists in Policy Context template (migration 050) |

---

### 2. Stage 1 Planning Appraisal (`stage1_review`)
- **Table:** `planning_applications.draft_types`
- **Tool tag:** `stage1`
- **Generation:** Own controller — `backend/src/controllers/stage1Review.controller.js`
- **Prompt storage:** `admin_console.llm_prompts` (key: `stage1_review`) — the **user prompt template** with `{{VARIABLE}}` slots (seeded by migration 079)
- **System prompt:** Hardcoded in controller (`DEFAULT_STAGE1_SYSTEM_PROMPT`) — role/persona only; not DB-stored
- **Tone example:** Loaded at startup from `stage1reviewexample.md` (file on server), appended to the hardcoded system prompt
- **Inputs:** Briefing note (from `planning_applications.document_summaries`) + `project_planning_history` table
- **Guiding brief:** Fetched via `getGuidingBrief('stage1_review', development_type)` — substituted into `{{GUIDING_BRIEF}}`
- **`{{VARIABLE}}` substitution:** Yes — same pattern as SOC/SOCG/HLPV/Socio-econ
- **Output format:** LLM returns HTML directly; controller wraps with `<h1>` title + date header

#### Available `{{VARIABLES}}` for Stage 1

| Variable | Source |
|---|---|
| `GUIDING_BRIEF` | `admin_console.guiding_briefs` (matched by doc type + dev type) |
| `BRIEFING_NOTES` | `planning_applications.document_summaries` — selected note or latest `briefing_transcript` |
| `PLANNING_HISTORY` | `public.project_planning_history` — on-site and nearby entries; empty string if none recorded |

---

### 3. Statement of Case (`statement_of_case`)
- **Table:** `appeals.appeal_draft_types`
- **Tool tag:** `appeal`, frontend id: `appeal_{id}`
- **Generation:** `backend/src/controllers/appeal.controller.js → generateFromPa` → `planningStatement.service.js → generateAppealDraftFromPrompt()`
- **Prompt storage:** `appeals.appeal_draft_types.generation_prompt` (editable in admin console)
- **Available `{{VARIABLES}}`:**

| Variable | Source |
|---|---|
| `GUIDING_BRIEF` | `admin_console.guiding_briefs` (matched by doc type + dev type) |
| `PROJECT_NAME` | `projects.project_name` |
| `DOCUMENT_TYPE` | Hard-coded from `appeal_draft_types.name` |
| `PROJECT_BRIEF` | `planning_applications.document_summaries` (briefing transcript) |
| `BRIEFING_NOTES` | Selected briefing note HTML |
| `DECISION_NOTICE` | `appeals.pa_draft_starting_docs` (slot: `decision_notice`) |
| `OFFICERS_REPORT` | `appeals.pa_draft_starting_docs` (slot: `officers_report`) |
| `PLANNING_STATEMENT` | `appeals.pa_draft_starting_docs` (slot: `planning_statement`) |
| `COMMITTEE_REPORT` | `appeals.pa_draft_starting_docs` (slot: `committee_report`) |
| `COMMITTEE_MINUTES` | `appeals.pa_draft_starting_docs` (slot: `committee_minutes`) |
| `OTHER_DOCS` | `appeals.pa_draft_starting_docs` (slot: `other`) |

---

### 4. Statement of Common Ground (`statement_of_common_ground`)
- **Table:** `appeals.appeal_draft_types`
- **Tool tag:** `appeal`, frontend id: `appeal_{id}`
- **Generation:** Same path as Statement of Case
- **Prompt storage:** `appeals.appeal_draft_types.generation_prompt`
- **Variables:** Same set as Statement of Case (see above)

---

### 5. High-Level Planning Review (`hlpv_narrative`)
- **Table:** `appeals.appeal_draft_types`
- **Tool tag:** `appeal`, frontend id: `appeal_{id}`
- **Generation:** `generateAppealDraftFromPrompt()`
- **Prompt storage:** `appeals.appeal_draft_types.generation_prompt`
- **Available `{{VARIABLES}}`:**

| Variable | Source |
|---|---|
| `GUIDING_BRIEF` | `admin_console.guiding_briefs` (matched by doc type + dev type) |
| `HLPV_DATA` | `appeals.pa_draft_starting_docs` (slot: `hlpv_data`) — auto-populated from HLPV tool |
| `ADDITIONAL_DESIGNATIONS` | `appeals.pa_draft_starting_docs` (slot: `additional_designations`) — user upload/paste |

---

### 6. Socio-economic Baseline Assessment (`socio_economic_baseline`)
- **Table:** `appeals.appeal_draft_types`
- **Tool tag:** `appeal`, frontend id: `appeal_{id}`
- **Generation:** `generateAppealDraftFromPrompt()`
- **Prompt storage:** `appeals.appeal_draft_types.generation_prompt`
- **Available `{{VARIABLES}}`:**

| Variable | Source |
|---|---|
| `GUIDING_BRIEF` | `admin_console.guiding_briefs` (matched by doc type + dev type) |
| `SOCIO_DATA` | `appeals.pa_draft_starting_docs` (slot: `socio_data`) |
| `BRIEFING_NOTES` | Selected briefing note HTML |

---

### 7. Pre-application Request (`pre_application_request`)
- **Table:** `appeals.appeal_draft_types`
- **Tool tag:** `appeal`, frontend id: `appeal_{id}`
- **Generation:** `generateDraftFromPaNotes` → `generateAppealDraftFromPrompt()`
- **Prompt storage:** `appeals.appeal_draft_types.generation_prompt` (editable in admin console)
- **Variables:** Same set as Planning Statement v2 — `GUIDING_BRIEF`, `SITE_ADDRESS`, `LPA_NAME`, `DEVELOPMENT_DESCRIPTION`, `LOCAL_POLICIES`, `NATIONAL_POLICIES`, `PLANNING_HISTORY`, `BRIEFING_NOTES`, `PROJECT_BRIEF`, `OTHER_DOCS`

---

### 8. Planning Statement v2 (`planning_statement_v2`)
- **Table:** `appeals.appeal_draft_types`
- **Tool tag:** `appeal`, frontend id: `appeal_{id}`
- **Generation:** `generateDraftFromPaNotes` → `generateAppealDraftFromPrompt()`
- **Prompt storage:** `appeals.appeal_draft_types.generation_prompt` (editable in admin console)
- **Purpose:** Single-prompt parallel version of the planning statement — for testing the `{{VARIABLE}}` generation approach against the section-by-section v1.

#### Available `{{VARIABLES}}` for Planning Statement v2

| Variable | Source |
|---|---|
| `GUIDING_BRIEF` | `admin_console.guiding_briefs` (matched by doc type + dev type) |
| `PROJECT_NAME` | `projects.project_name` |
| `DOCUMENT_TYPE` | `appeals.appeal_draft_types.name` |
| `SITE_ADDRESS` | `projects.address` — pre-substituted in controller |
| `LPA_NAME` | `projects.local_planning_authority` — pre-substituted in controller |
| `DEVELOPMENT_DESCRIPTION` | `projects.development_description` — pre-substituted in controller |
| `LOCAL_POLICIES` | `public.project_policies` (type: `local`) — fetched if variable present in prompt |
| `NATIONAL_POLICIES` | `public.project_policies` (type: `national`) — fetched if variable present in prompt |
| `PLANNING_HISTORY` | `public.project_planning_history` — fetched if variable present in prompt |
| `BRIEFING_NOTES` | `planning_applications.document_summaries` (selected notes via `briefing_notes` slot) |
| `PROJECT_BRIEF` | `planning_applications.document_summaries` (latest `briefing_transcript`) |
| `OTHER_DOCS` | `appeals.pa_draft_starting_docs` (slot: `other`) |

> The `SITE_ADDRESS`, `LPA_NAME`, `DEVELOPMENT_DESCRIPTION`, `LOCAL_POLICIES`, `NATIONAL_POLICIES`, and `PLANNING_HISTORY` variables are pre-substituted in `generateDraftFromPaNotes` before `generateAppealDraftFromPrompt` handles the rest. This means they are available to **any** `appeals.appeal_draft_types` prompt — not just v2.

---

## Key Source Files

| File | Role |
|---|---|
| `backend/src/controllers/planningApplication.controller.js` | Main PA controller — `generateDraft`, `generateSection`, `resolvePlanningStatementVariables` |
| `backend/src/controllers/appeal.controller.js` | Appeal-type doc generation — `generateFromPa`, `getDraftTypes` |
| `backend/src/services/planningStatement.service.js` | Generation functions: `generateFromTemplate`, `generatePlanningStatementSection`, `generatePlanningStatementAssessment`, `generateDraftSection` |
| `backend/src/services/appeal.service.js` | `generateAppealDraft`, `generateAppealDraftFromPrompt` — used by SOC, SOCG, HLPV, Socio-econ |
| `backend/src/controllers/stage1Review.controller.js` | Stage 1 appraisal generation |
| `backend/src/controllers/documentStyleTemplates.controller.js` | `getDocumentStyleTemplateByDocType()` — fetches style template, injected into all generation paths as a `## Style Guide` block |
| `frontend/src/lib/stores/planning-drafts.js` | `loadDraftTypes()` — merges both tables, tags with `tool` property |
| `frontend/src/lib/components/planning-application/PlanningWorkspace.svelte` | Main workspace UI |

---

## Style Templates (cross-cutting)

All generation paths (both `pa` and `appeal` tool types) receive a style template fetched by `getDocumentStyleTemplateByDocType(docTypeSlug, developmentType)`. It joins through `admin_console.guiding_briefs` to find the right template from `admin_console.document_style_templates`. Injected as a `## Style Guide` block appended to the system prompt.

---

## Starting Docs (appeal tool types)

Stored in `appeals.pa_draft_starting_docs` per `(project_id, draft_type_id, slot_slug)`. Managed via `StartingDocsModal.svelte`. The HLPV slot (`hlpv_data`) is auto-populated when a HLPV tool run is saved.
