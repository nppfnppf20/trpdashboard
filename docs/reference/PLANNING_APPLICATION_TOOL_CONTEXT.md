# Planning Application Tool — Session Context

## What it is
A tool for building and drafting **planning statements** — documents that make the case *for* a development application. Fundamentally different from the appeals tool: instead of arguing for/against a refusal, it assesses the proposal against a policy framework tier by tier.

| | Appeals Tool | Planning Application Tool |
|---|---|---|
| Purpose | Rebut a refusal, argue on appeal | Make the case for the application |
| Core structure | For / Against per issue | Policy tier assessment per issue |
| Output | Appeal statement / proof of evidence | Planning statement |
| Policy role | Secondary | Central — drives the whole argument structure |

---

## Key files

**Backend**
- `backend/src/controllers/planningApplication.controller.js` — shared with appeals tool; handles issue notes, document analysis, draft generation, argument points
- `backend/src/services/llm.service.js` — shared LLM service; all prompts live here
- `backend/src/routes/planningApplication.routes.js` — shared routes

**Frontend**
- `frontend/src/lib/components/planning-application/PolicyTierNotes.svelte` — the full policy-tier UI per issue (tabs for each tier, policy linking, policy preview modal)
- `frontend/src/lib/components/planning-application/ArgumentStructurePanel.svelte` — simplified version, currently shows a single `policy_assessment` field (in progress — design calls for full 5-tier layout)
- `frontend/src/lib/stores/planning-notes.js` — manages all 7 fields per issue (5 policy tiers + 2 legacy for/against), auto-saves on change
- `frontend/src/lib/api/planningApplication.js` — all API calls (shared with appeals)
- `frontend/src/lib/components/planning-application/PlanningWorkspace.svelte` — main UI workspace

**LPA / Similar Schemes tool (separate but related)**
- `backend/src/controllers/lpaAnalysis.controller.js` — policy CRUD, LPA decision document upload/analysis, synthesis report generation
- `backend/src/routes/lpaAnalysis.routes.js` — routes for above

**Reference docs**
- `PLANNING_APPLICATION_TOOL_DESIGN.md` — design spec (read this for intended architecture)
- `APPEALS_TOOL_REFERENCE.md` — full reference for the appeals tool (shares codebase)
- `discussions.md` — agreed architectural principles that apply to both tools

---

## Database

All tables in `planning_applications` schema, shared with the appeals tool.

### `issue_notes` — the core store
Per-project, per-issue notes. Has fields for both tools:

| Field | Used by |
|-------|---------|
| `argument_for` | Appeals (legacy, still populated) |
| `argument_against` | Appeals (legacy, still populated) |
| `policy_national` | Planning app — NPPF / national guidance notes |
| `policy_local` | Planning app — local plan policy notes |
| `policy_neighbourhood` | Planning app — neighbourhood plan notes |
| `policy_supplementary` | Planning app — SPD / supplementary guidance notes |
| `policy_other` | Planning app — any other relevant guidance |

### `project_policies` (in `public` schema)
Full policy records, not just references. Key columns:

| Column | Description |
|--------|-------------|
| `policy_reference` | e.g. "NPPF Para 11", "Policy H1" |
| `policy_name` | Full policy name |
| `policy_type` | `national` / `local` / `neighbourhood` / `supplementary` / `other` |
| `policy_text` | **Full verbatim wording of the policy** |
| `relevant_supporting_text` | Footnotes, guidance, site-specific context |
| `notes` | Project team's notes on why/how this policy applies |
| `is_key_policy` | Boolean — flags primary determining policies |

### `policy_track_relevance`
Junction table linking `project_policies` to `admin_console.project_issue_tracks`. Allows the user to tag which policies are relevant to which issue. Powers the policy linking UI in `PolicyTierNotes.svelte`.

### Other shared tables
`document_log`, `document_text_spans`, `argument_points`, `argument_point_evidence`, `draft_types`, `draft_sections`, `drafts`, `prompt_settings` — all shared with the appeals tool. See `APPEALS_TOOL_REFERENCE.md` for full schema.

---

## LLM pipeline (current state)

### Document analysis
Same pipeline as appeals tool — `analyseDocument` → `extractPointsFromDocument` → `buildExtractPointsPrompt`. Returns `headline`, `detailed_summary`, `relevant_chunk_indices` per point.

**Gap:** Points are currently tagged as `argument_for` / `argument_against`. For the planning application tool they should ideally be tagged to a policy tier (`policy_national`, `policy_local` etc.). This mapping is not yet implemented.

### Draft generation
Same pipeline as appeals tool — `generateDraft` / `generateSection` → `buildIssueContext` → `generateDraftSection`. Now evidence-backed (see appeals tool for details of the span/evidence system).

**Gap:** `buildIssueContext` currently uses `argument_for` / `argument_against` fields. For the planning app tool it should use the policy tier fields instead.

---

## Current build state

| Feature | Status |
|---------|--------|
| `issue_notes` DB schema (5 policy tiers) | Built |
| `planning-notes.js` store (all 7 fields) | Built |
| `PolicyTierNotes.svelte` — full tier UI with policy linking | Built |
| `ArgumentStructurePanel.svelte` — simplified version | In progress (shows `policy_assessment` placeholder) |
| Policy CRUD UI (`project_policies`) | Built (via LPA tool) |
| `policy_track_relevance` — policy-to-issue linking | Built |
| Document analysis / span storage / argument points | Built (shared with appeals) |
| Draft generation with evidence | Built (shared with appeals) |
| Extraction prompt → policy tier tagging | Not started |
| `buildIssueContext` → policy tier fields | Not started |

---

## What needs doing to make this tool fully independent of the appeals model

1. **Extraction prompt** — `buildExtractPointsPrompt` needs a planning-app mode that tags points to policy tiers rather than `argument_for` / `argument_against`. The document direction concept changes too — for a planning statement, documents are almost always supportive.

2. **Issue context for drafting** — `buildIssueContext` needs a planning-app variant that reads `policy_national`, `policy_local` etc. instead of `argument_for` / `argument_against`, and includes linked policy wording from `project_policies.policy_text`.

3. **`ArgumentStructurePanel`** — UI needs to replace the current `policy_assessment` placeholder with the 5-tier layout already implemented in `PolicyTierNotes.svelte`.

4. **Draft section prompts** — the per-section `generation_prompt` defaults need to be written for planning statement sections (Introduction, Site & Surroundings, Planning Policy, Planning Assessment, Conclusion) rather than appeal document sections.

---

## Key architectural principles to follow (from discussions.md)

These were agreed for the appeals tool but apply equally here:

1. **Separate the layers.** UI shows clean tier notes. DB stores verbatim evidence. LLM drafts from assembled context.
2. **Policy text is not LLM-generated.** The verbatim wording comes from `project_policies.policy_text` (user-entered), not from the model's training data.
3. **Extraction and drafting are separate prompts** with separate purposes. Never combine them.
4. **Each argument point has two representations** — a short headline for the UI, a detailed summary for drafting.
5. **Evidence is linked, not re-discovered.** The draft LLM receives pre-selected evidence; it does not re-read documents.
6. **Modular prompt assembly** — global rules + tone + format + section-specific instructions assembled at runtime. Don't bake everything into one giant prompt.
