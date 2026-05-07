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
Per-project, per-issue argument notes. The core working argument store — accumulated flat text, fully editable by the user.

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

Key issues (`project_issue_tracks`) are defined in the admin console per project and are shared across both the appeals and planning application tools.

### `document_log`
A log of every document that has been analysed and committed by the user.

| Column | Type | Description |
|--------|------|-------------|
| `id` | int | PK |
| `project_id` | int | FK |
| `title` | text | Document title (user-entered) |
| `code` | text | Short reference code |
| `document_summary` | text | 200-word plain English summary (from LLM) |
| `argument_points` | jsonb | Legacy array of extracted points `[{ track_id, field, point }]` — kept for display in the log UI |
| `logged_at` | timestamptz | When it was logged |

### `document_text_spans`
The actual extracted text of every chunk from every logged document. This is the source-of-truth for verbatim evidence — text here comes directly from the document, not from the LLM.

| Column | Type | Description |
|--------|------|-------------|
| `id` | int | PK |
| `document_log_id` | int | FK to `document_log` — cascades on delete |
| `project_id` | int | FK to `public.projects` — cascades on delete |
| `chunk_index` | int | Position of this chunk in the document (0-based) |
| `char_start` | int | Character offset of the start of this chunk in the original text |
| `char_end` | int | Character offset of the end of this chunk |
| `text` | text | The actual extracted chunk text |
| `is_high_value` | bool | True if the chunk was detected as a conclusion/summary section |
| `created_at` | timestamptz | — |

**High-value detection:** The controller checks the first 200 chars of each chunk against a regex for headings: Conclusion, Conclusions, Executive Summary, Summary, Summary and Conclusions, Recommendations, Key Findings, Overall Assessment.

### `argument_points`
Structured argument points — one record per accepted point from a document. Separates the short display label from the richer detail needed at draft time.

| Column | Type | Description |
|--------|------|-------------|
| `id` | int | PK |
| `project_id` | int | FK |
| `track_id` | int | FK to `admin_console.project_issue_tracks` |
| `document_log_id` | int | FK to `document_log` — nullable (manually written points have no source doc) |
| `field` | text | `'argument_for'` or `'argument_against'` |
| `headline` | text | Short display label (max ~15 words) — what appears in the UI and gets appended to `issue_notes` |
| `detailed_summary` | text | 2–4 sentence AI-generated explanation with technical detail, measurements, policy references |
| `accepted` | bool | Whether the user accepted this point (default true on creation) |
| `sort_order` | int | Display order within an issue |
| `created_at`, `updated_at` | timestamptz | — |

### `argument_point_evidence`
Links each argument point to the source text spans that back it. The `quote_snapshot` is the verbatim chunk text saved at the time of linking — this is what gets passed to the draft LLM.

| Column | Type | Description |
|--------|------|-------------|
| `id` | int | PK |
| `argument_point_id` | int | FK to `argument_points` — cascades on delete |
| `span_id` | int | FK to `document_text_spans` — set null on delete (snapshot preserved separately) |
| `quote_snapshot` | text | Copy of the span text at time of linking — stable source of truth for drafting |
| `relevance_note` | text | Optional note on why this span backs this point |
| `created_at` | timestamptz | — |

### `draft_types`
Global reference table for document types that can be generated (e.g. "Statement of Case", "Proof of Evidence").

| Column | Description |
|--------|-------------|
| `id`, `name`, `slug` | Identity |
| `description` | Short description shown in UI |
| `sort_order` | Display order |

### `draft_sections`
Sections within each draft type (e.g. "Introduction", "Case on Heritage").

| Column | Description |
|--------|-------------|
| `draft_type_id` | FK to `draft_types` |
| `name`, `slug` | Identity |
| `description` | Short description |
| `generation_prompt` | Custom LLM instructions for this section (optional — overrides default) |
| `example_text` | Example HTML output shown to LLM as style reference (HTML stripped, 2000 char limit) |
| `sort_order` | Display order |

### `drafts`
Saved draft HTML content per project per draft type.

| Column | Description |
|--------|-------------|
| `project_id`, `draft_type_id` | Composite unique key |
| `content_html` | Full HTML content of the draft |
| `generated_at` | When AI last generated it |
| `updated_at` | When it was last saved (including manual edits) |

### `prompt_settings`
Per-project saved LLM prompt templates.

| Column | Description |
|--------|-------------|
| `project_id` | FK |
| `prompt_key` | `'extract_points'` (currently only one) |
| `prompt_text` | The saved custom prompt template — `{{DOCUMENT}}` is the placeholder |

### `policy_track_relevance`
Links policies to issue tracks. Used in the planning application tool, not the appeals tool.

---

## The two main LLM pipelines

### Pipeline 1 — Document analysis (ingestion)

**Trigger:** User uploads a document in the Document Analysis tab and clicks Analyse.

**Purpose:** Read a document and extract structured argument points mapped to key issues.

**Steps:**

1. File is parsed to raw text (`parseFile` in `parser.service.js`).
2. Controller queries `issue_notes` for current argument state of all issues (used for deduplication context in the prompt — truncated to 400 chars per issue).
3. Text is formatted as **indexed chunks** by `buildDocumentBlock` — up to 3 chunks (~18,000 chars) formatted as `[Chunk 0]\n...\n\n[Chunk 1]\n...`. This is what the LLM receives.
4. `extractPointsFromDocument` → `buildExtractPointsPrompt` → single Claude Sonnet call.
5. Returns structured JSON:
   ```json
   {
     "summary": "2-4 sentence overview",
     "coverage": [{ "issue_id": 42, "assessment": "..." }],
     "points": [
       {
         "track_id": 42,
         "field": "argument_against",
         "headline": "Officer found overlooking impact unacceptable",
         "detailed_summary": "The officer's report finds the proposed first-floor rear window would result in direct views into the neighbouring garden at No. 14... 8m separation, below the 21m guideline.",
         "relevant_chunk_indices": [0]
       }
     ],
     "chunks": [{ "index": 0, "char_start": 0, "char_end": 5999, "text": "...", "is_high_value": false }]
   }
   ```
6. The `chunks` array is stored in the frontend `analysisChunks` store — not yet in the DB.
7. User reviews extracted points. Each point shows its `headline`. They accept or dismiss individually.
8. Accepted points: `headline` is appended to `issue_notes.argument_for` / `argument_against` (flat text, for backward compat and manual editing). The full structured point is held in `acceptedPoints` store.

**Key prompt behaviour (`buildExtractPointsPrompt`):**
- Formats text as indexed chunks so the LLM can reference chunk numbers per point.
- Covers ~3 chunks (~18k chars) vs the old 10k char flat slice.
- Knows document type (Officer Report, Refusal Notice, Appeal Decision, Planning Statement, Proof of Evidence, Expert Report, Consultation Response, Other) and applies type-specific instructions.
- Knows document direction (`for` or `against`) and biases tagging accordingly.
- Sends current argument notes (truncated to 400 chars per issue) so LLM avoids repeating already-captured points.
- Respects user notes (free text guidance) as high-priority context.
- Old custom prompts that return `point` instead of `headline`/`detailed_summary` are normalised on the way out — backward compatible.

**Prompt template can be saved per project** in `prompt_settings`. The `{{DOCUMENT}}` placeholder is replaced with the formatted chunk block at call time.

---

### Pipeline 2 — Document logging (evidence storage)

**Trigger:** User fills in the log modal and clicks Save.

**Purpose:** Commit the document and its evidence to the database.

**Steps:**

1. `createDocumentLogEntry` creates the `document_log` row.
2. The `chunks` from `analysisChunks` store are sent in the same request body and inserted as `document_text_spans` — the actual extracted text blocks, verbatim from the document.
3. For each accepted point that has a `track_id`, `createArgumentPoint` is called (fire-and-forget after the log save). This:
   - Creates an `argument_points` record with `headline`, `detailed_summary`, `document_log_id`.
   - Looks up `document_text_spans` by `document_log_id` + `chunk_index` (from `relevant_chunk_indices`).
   - Creates `argument_point_evidence` records with `quote_snapshot` = the actual span text.

After this step, each accepted point is traceable to the exact passage in the source document that supports it.

---

### Pipeline 3 — Draft generation

**Trigger:** User clicks Generate on a draft type, or Regenerate on a specific section.

**Purpose:** Produce a formal, professionally written HTML document grounded in the working argument and source evidence.

**Steps:**

1. Controller queries `issue_notes` for all issues (flat argument text).
2. Controller queries `argument_points` + `argument_point_evidence` + `document_log` via `fetchEvidenceByTrack` — returns a map of `track_id → [{ headline, detailed_summary, quote_snapshot, source_doc_title }]`.
3. `buildIssueContext(issues, evidenceByTrack)` assembles the context string per issue:
   ```
   ## Heritage Impact (Heritage)
   Opposing position:
   [argument_against text]

   Our case:
   [argument_for text]

   Source evidence from documents:
   - [Refusal Notice]: "The proposed window would result in direct overlooking..."
     The officer's report identifies a separation distance of only 8m, well below the 21m guideline...
   ```
4. For full draft: `generateAppealDraft` calls `generateDraftSection` for each section sequentially.
5. For single section: controller calls `generateDraftSection` directly with the same enriched context.
6. Output is clean HTML, saved to `drafts` table.

**Fallback:** If a project has no `argument_points` records (old data, or purely manual notes), the evidence block is absent and the draft generates from flat notes only — same as before.

---

## Argument structure accumulation

The `argument_for` / `argument_against` fields in `issue_notes` remain the primary editable store:

- Initially empty, or seeded by `generateAppealArgument` (produces a structured HTML working document from refusal reasons + key issues at appeal setup).
- Grown over time by accepted document points — `headline` is appended as a new paragraph.
- Fully editable by the user at any time in the Argument Structure tab.

The new `argument_points` table is a parallel structured store. It holds the same information with more depth, and is what powers the evidence-backed draft generation. The two stores stay in sync: when a point is accepted, both are written.

**Deduplication note:** The extraction prompt receives the current `issue_notes` text (truncated to 400 chars per issue) and is instructed not to repeat already-captured points. As notes grow past ~400 chars per issue, the LLM can only see the first portion, so some duplicate suggestions may appear — the user can dismiss these. A future improvement would be to send the structured `argument_points` headlines (more information-dense) instead of the truncated flat text.

---

## Additional LLM functions in the tool

### `generateAppealArgument`
Called at appeal setup to seed the initial working argument. Takes refusal reasons + key issues + optional initial notes. Returns a 5-section HTML document (Appeal Overview, Reasons for Refusal, Argument by Issue, Risks and Unknowns, Next Steps). Written in working note style, not formal prose.

### `reviewDocumentAgainstArgument`
An alternative holistic document review mode. Takes a document + current working argument and returns structured JSON: relevance assessment, extracted points (helpful/harmful/procedural/policy), argument impact rating, suggested bullet points, draft paragraph, caution notes. Less used than the main extraction pipeline.

### `buildDocumentBlock`
Exported helper. Formats raw text as indexed `[Chunk 0]`, `[Chunk 1]` blocks covering up to 3 chunks (~18k chars). Used by `buildExtractPointsPrompt` and by the controller when resolving saved prompt templates.

### `buildIssueContext`
Exported helper. Takes the issues array + `evidenceByTrack` map and returns the formatted context string used in draft prompts. When evidence exists, appends a source evidence block per issue with verbatim `quote_snapshot` text.

---

## Prompt customisation points

| Location | What can be customised |
|----------|----------------------|
| `prompt_settings` table (`extract_points` key) | The full document extraction prompt, per project. Editable in the UI. `{{DOCUMENT}}` is replaced with the formatted chunk block at call time. |
| `draft_sections.generation_prompt` | Per-section instructions for the draft LLM. Editable in the Sections modal. |
| `draft_sections.example_text` | Example HTML for style matching. Editable in the Sections modal. |
| `DOC_TYPE_INSTRUCTIONS` (hardcoded in `llm.service.js`) | Per-document-type extraction instructions. Code-only. |

---

## Models used

| Task | Model | Reason |
|------|-------|--------|
| Document extraction (`extractPointsFromDocument`) | `claude-sonnet-4-6` | Needs judgement on point relevance, field tagging, and detailed summary quality |
| Draft section generation | `claude-sonnet-4-6` | Prose quality |
| Appeal argument initialisation | `claude-sonnet-4-6` | Prose quality |
| Document review against argument | `claude-sonnet-4-6` | Judgement heavy |
| Stage analysis per chunk (separate stage tool) | `claude-haiku-4-5` | Fast, cheap, structured JSON |
| Stage synthesis | `claude-sonnet-4-6` | Long-form professional prose |

---

## Data flow summary

```
Document uploaded
       ↓
  parseFile() → raw text
       ↓
  buildDocumentBlock() → indexed chunks [Chunk 0], [Chunk 1]...
       ↓
  buildExtractPointsPrompt() → Claude Sonnet
       ↓
  { summary, coverage, points[{ headline, detailed_summary, relevant_chunk_indices }], chunks[] }
       ↓
  chunks[] held in frontend analysisChunks store (not yet in DB)
       ↓
  User reviews + accepts points
       ↓
  issue_notes.argument_for / argument_against ← headline appended (flat text, editable)
  acceptedPoints store ← headline + detailed_summary + relevant_chunk_indices held
       ↓
  User logs document
       ↓
  document_log row created
  document_text_spans rows created ← actual chunk texts, verbatim from document
  argument_points rows created ← headline + detailed_summary per accepted point
  argument_point_evidence rows created ← quote_snapshot = actual span text (not LLM-generated)
       ↓
  generateAppealDraft() / generateDraftSection()
       ↓
  fetchEvidenceByTrack() ← argument_points JOIN evidence JOIN spans JOIN document_log
       ↓
  buildIssueContext(issues, evidenceByTrack)
  ← flat argument notes + verbatim source evidence per issue
       ↓
  Claude Sonnet → HTML
       ↓
  drafts table (content_html)
```

---

## Key architectural principles (from discussions.md)

These govern the design of this tool and should be followed when replicating the system for the planning application tool:

1. **Separate the layers.** UI shows clean headlines. DB stores verbatim evidence. LLM interprets and drafts. Don't conflate these.
2. **The LLM is not the source of truth for quotes.** Verbatim text must come from the extracted document chunks (`document_text_spans`), not from asking the LLM to reproduce a quote.
3. **Each argument point has two representations:** a short headline for the UI/notes, and a detailed summary for drafting. Store both separately.
4. **Prompts are separated by task.** Extraction prompt: structured data output. Draft prompt: polished prose output. Never combine these — the extraction stage must not try to draft final prose.
5. **Evidence is linked, not re-discovered.** The draft LLM receives evidence that was pre-selected and verified during ingestion. It does not re-read documents at draft time.
6. **Flat notes fields are kept for backward compat and manual editing.** The structured `argument_points` table runs alongside them, not replacing them.
