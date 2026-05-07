# Appeals Tool — Reference Document

This document describes the architecture, data model, user workflow, and LLM prompts for the Appeals Tool. It is intended as a quick-reference for development so you do not need to re-read the codebase from scratch each session.

---

## What the tool is for

The Appeals Tool helps a planning consultant build and manage the argument for a **planning appeal** — i.e. where a planning application has been refused and the applicant is appealing to the Planning Inspectorate.

The workflow has two phases:

1. **Build the argument** — ingest documents (officer reports, refusal notices, expert reports, etc.) and use AI to extract argument points mapped to key planning issues. The consultant reviews and edits these before they accumulate into a structured working argument.
2. **Draft the document** — generate a formal appeal document (Statement of Case, Proof of Evidence, etc.) from the working argument, section by section.

---

## Key source files

| File | Purpose |
|------|---------|
| `backend/src/controllers/planningApplication.controller.js` | All HTTP route handlers — DB queries, orchestration |
| `backend/src/services/llm.service.js` | All LLM calls and prompt definitions |
| `backend/src/routes/planningApplication.routes.js` | Route definitions |
| `frontend/src/routes/planning-application/+page.svelte` | Page entry point |
| `frontend/src/lib/components/planning-application/PlanningWorkspace.svelte` | Main UI workspace |
| `frontend/src/lib/components/planning-application/ArgumentStructurePanel.svelte` | Issue-by-issue argument editing UI |
| `frontend/src/lib/stores/planning-analysis.js` | Store for document analysis flow |
| `frontend/src/lib/stores/planning-drafts.js` | Store for draft types, sections, generation |
| `frontend/src/lib/stores/planning-log.js` | Store for document log |
| `frontend/src/lib/stores/planning-notes.js` | Store for issue notes (argument fields) |

---

## Database schema

All tables live in the `planning_applications` schema.

### `issue_notes`
Per-project, per-issue argument notes. This is the core working argument store.

| Column | Type | Description |
|--------|------|-------------|
| `project_id` | int | FK to `public.projects` |
| `track_id` | int | FK to `admin_console.project_issue_tracks` |
| `argument_for` | text | Our case — points that support the appeal |
| `argument_against` | text | Opposing position — LPA's case / objections |
| `policy_national` | text | (Planning app tool only) |
| `policy_local` | text | (Planning app tool only) |
| `policy_neighbourhood` | text | (Planning app tool only) |
| `policy_supplementary` | text | (Planning app tool only) |
| `policy_other` | text | (Planning app tool only) |

Key issues (`project_issue_tracks`) are defined in the admin console per project and are shared across both the appeals and planning application tools. They represent the tracked planning concerns — e.g. Heritage, Highways, Ecology.

### `document_log`
A log of every document that has been analysed.

| Column | Type | Description |
|--------|------|-------------|
| `id` | int | PK |
| `project_id` | int | FK |
| `title` | text | Document title (user-entered) |
| `code` | text | Short reference code |
| `document_summary` | text | 200-word plain English summary of the document |
| `argument_points` | jsonb | Array of extracted points: `[{ track_id, field, point }]` |
| `logged_at` | timestamp | When it was logged |

**Note:** The `argument_points` JSON also contains `source_quote` fields (verbatim excerpts up to 300 chars) from each extracted point — these are stored here but not currently surfaced in the draft generation prompt (this is a known gap — see below).

### `draft_types`
The types of formal documents that can be generated (e.g. "Statement of Case", "Proof of Evidence").

| Column | Description |
|--------|-------------|
| `id`, `name`, `slug` | Identity |
| `description` | Short description shown in UI |
| `sort_order` | Display order |

### `draft_sections`
Sections within each draft type (e.g. "Introduction", "Planning Policy", "Case on Heritage").

| Column | Description |
|--------|-------------|
| `draft_type_id` | FK to `draft_types` |
| `name`, `slug` | Identity |
| `description` | Short description |
| `generation_prompt` | Custom LLM instructions for this section (optional — overrides default) |
| `example_text` | Example HTML output shown to LLM as style reference |
| `sort_order` | Display order |

### `drafts`
Saved draft HTML content per project per draft type.

| Column | Description |
|--------|-------------|
| `project_id`, `draft_type_id` | Composite key |
| `content_html` | Full HTML content of the draft |
| `generated_at` | When AI last generated it |
| `updated_at` | When it was last saved (including manual edits) |

### `prompt_settings`
Per-project saved LLM prompt templates.

| Column | Description |
|--------|-------------|
| `project_id` | FK |
| `prompt_key` | `'extract_points'` (currently only one) |
| `prompt_text` | The saved custom prompt template |

### `policy_track_relevance`
Links policies to issue tracks (used in the planning application tool, not the appeals tool).

---

## The two main LLM pipelines

### Pipeline 1 — Document analysis (ingestion)

**Trigger:** User uploads a document in the Document Analysis tab and clicks Analyse.

**Purpose:** Read a document and extract argument points mapped to key issues.

**Steps:**

1. File is parsed to raw text (`parseFile`).
2. Controller queries `issue_notes` for current argument state of all issues.
3. `extractPointsFromDocument` is called → `buildExtractPointsPrompt` builds the prompt → single Claude Sonnet call.
4. Returns structured JSON:
   ```json
   {
     "summary": "2-4 sentence overview of the document",
     "coverage": [{ "issue_id": 42, "assessment": "one sentence per issue" }],
     "points": [
       { "track_id": 42, "field": "argument_against", "point": "The officer found that..." },
       { "track_id": 42, "field": "argument_for", "point": "Paragraph 6.4 acknowledges..." }
     ]
   }
   ```
5. User reviews the extracted points in the UI. They can accept/reject individual points or edit them.
6. Accepted points are **appended to** the existing `argument_for` / `argument_against` text in `issue_notes`.
7. Document is logged to `document_log` with its summary and extracted points.

**Key prompt behaviour (`buildExtractPointsPrompt`):**
- Knows the document type (Officer Report, Refusal Notice, Appeal Decision, Planning Statement, Proof of Evidence, Expert Report, Consultation Response, Other) and applies type-specific instructions.
- Knows the document direction (`for` or `against` the proposal) — biases tagging accordingly.
- Receives the current accumulated argument notes for each issue (up to 400 chars each) so it can avoid repeating what is already captured.
- Respects user notes (free text guidance) as high-priority context.
- If specific issues are flagged as relevant (`relevant_track_ids`), it focuses on those first.
- Text is truncated to 10,000 chars.

**Prompt template can be saved per project** in `prompt_settings`. The `{{DOCUMENT}}` placeholder is replaced at call time. This allows the user to edit the extraction prompt.

---

### Pipeline 2 — Draft generation

**Trigger:** User clicks Generate on a draft type, or Regenerate on a specific section.

**Purpose:** Produce a formal, properly written HTML document from the working argument notes.

**Two modes:**

#### Full draft (`generateAppealDraft`)
- Queries all issues with their `argument_for` / `argument_against` notes.
- Queries all sections for the draft type (ordered by `sort_order`).
- If sections exist: calls `generateDraftSection` for each section sequentially, stitches results together.
- If no sections defined: single-call fallback using `DEFAULT_DRAFT_PROMPT`.

#### Single section (`generateDraftSection`)
- Takes the section's `generation_prompt` (or falls back to a sensible default).
- Takes the section's `example_text` as a style guide (HTML stripped for the prompt, 2000 char limit).
- Passes `issueContext` — all issues formatted as:
  ```
  ## Issue Label (Discipline)
  Opposing position:
  [argument_against text]
  Our case:
  [argument_for text]
  ```
- Output is clean HTML starting with `<h2>Section Name</h2>`.
- Max tokens: 2000 per section.

**What the draft prompt sees:**
- Project name, document type name
- Section-specific generation instructions (custom or default)
- Optional style example (HTML stripped, 2000 char limit)
- The accumulated `argument_for` and `argument_against` text for each issue

**What it does NOT see:**
- The original document text
- Source quotes / verbatim excerpts from documents
- Document summaries from the document log
- Individual extracted points from the document log

This is the **known gap** — see section below.

---

## Argument structure accumulation

The `argument_for` / `argument_against` fields in `issue_notes` are plain text fields that grow over time as documents are ingested. They are:

- Initially empty or seeded by the `generateAppealArgument` function (which produces a structured HTML working argument from refusal reasons and key issues at the start of the appeal).
- Added to each time the user accepts extracted points from a document review — points are appended as new lines or sentences.
- Fully editable by the user at any time in the Argument Structure tab.

There is no versioning — it is a single accumulated text per issue.

---

## Additional LLM functions in the tool

### `generateAppealArgument`
Called at appeal setup to produce the initial structured working argument HTML. Takes refusal reasons + key issues + optional initial notes. Produces a 5-section HTML document (Appeal Overview, Reasons for Refusal, Argument by Issue, Risks and Unknowns, Next Steps). Written in working note style, not formal prose.

### `reviewDocumentAgainstArgument`
An older/alternative document review function. Takes a document + the current working argument and returns structured JSON with:
- Relevance assessment
- Extracted points (helpful / harmful / procedural / policy)
- Argument impact assessment
- Suggested bullet points and draft paragraph
- Caution notes

This appears to be a different, more holistic review mode compared to the point-extraction pipeline.

---

## Known gap: source detail lost at draft time

**The problem:** The draft generation prompt only receives the accumulated argument notes (`argument_for` / `argument_against`). These notes are built from concise 1–3 sentence extracted points. The original document text, verbatim source quotes, and document summaries are stored in `document_log` but are never passed to the draft generator.

**What is available in `document_log` that could help:**
- `document_summary` — 200-word summary of each ingested document
- `argument_points` — the raw extracted points JSON, which includes `source_quote` (verbatim excerpts up to 300 chars per point) and the full `point` text before any user editing

**The fix (not yet implemented):** At draft/section generation time, query `document_log` for the project and include source quotes + document summaries as supplementary context in the prompt, in addition to the accumulated argument notes.

---

## Prompt customisation points

| Location | What can be customised |
|----------|----------------------|
| `prompt_settings` table (`extract_points` key) | The full document extraction prompt, per project. Editable in the UI. `{{DOCUMENT}}` is the placeholder. |
| `draft_sections.generation_prompt` | Per-section instructions for the draft LLM. Editable in the Sections modal. |
| `draft_sections.example_text` | Example HTML for style matching. Editable in the Sections modal. |
| `DOC_TYPE_INSTRUCTIONS` (hardcoded in `llm.service.js`) | Per-document-type extraction instructions. Code-only. |

---

## Models used

| Task | Model | Reason |
|------|-------|--------|
| Document extraction (`extractPointsFromDocument`) | `claude-sonnet-4-6` | Needs judgement on point relevance and field tagging |
| Draft section generation | `claude-sonnet-4-6` | Prose quality |
| Appeal argument initialisation | `claude-sonnet-4-6` | Prose quality |
| Document review against argument | `claude-sonnet-4-6` | Judgement heavy |
| Stage analysis per chunk (separate stage tool) | `claude-haiku-4-5` | Fast, cheap, structured JSON |
| Stage synthesis | `claude-sonnet-4-6` | Long-form professional prose |

---

## Data flow summary

```
Documents uploaded
       ↓
  parseFile() → raw text
       ↓
  buildExtractPointsPrompt() → Claude Sonnet
       ↓
  { summary, coverage, points[] }
       ↓
  User reviews + accepts points
       ↓
  issue_notes.argument_for / argument_against (accumulated)
  document_log (summary + raw points with source quotes)
       ↓
  generateAppealDraft() / generateDraftSection()
       ↓
  issueContext = argument_for + argument_against only  ← GAP: source quotes lost here
       ↓
  Claude Sonnet → HTML
       ↓
  drafts table (content_html)
```
