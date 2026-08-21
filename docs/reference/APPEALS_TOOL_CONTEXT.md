# Appeals Tool — Session Context

## What it is
A tool for building and drafting planning appeals. Two phases: (1) ingest documents to build a structured working argument per issue, (2) generate formal appeal documents (Statement of Case etc.) from that argument, now backed by verbatim source evidence.

---

## Key files

**Backend**
- `backend/src/controllers/planningApplication.controller.js` — all route handlers, DB queries, orchestration
- `backend/src/services/llm.service.js` — all LLM calls and prompts
- `backend/src/routes/planningApplication.routes.js` — route definitions
- `backend/src/services/parser.service.js` — `parseFile` and `chunkText`

**Frontend**
- `frontend/src/lib/stores/planning-analysis.js` — document analysis flow, extracted points, `analysisChunks`
- `frontend/src/lib/stores/planning-log.js` — document log modal, creates argument points after log save
- `frontend/src/lib/stores/planning-notes.js` — `issue_notes` flat fields, `appendToNote`
- `frontend/src/lib/stores/planning-drafts.js` — draft types, sections, generation
- `frontend/src/lib/api/planningApplication.js` — all API calls
- `frontend/src/lib/components/planning-application/PlanningWorkspace.svelte` — main UI
- `frontend/src/lib/components/planning-application/ArgumentStructurePanel.svelte` — per-issue editing

**Reference docs**
- `APPEALS_TOOL_REFERENCE.md` — full architecture, schema, prompts, data flow (read this first)
- `discussions.md` — agreed architectural principles (layered evidence, no LLM quotes, separate prompts)
- `PLANNING_APPLICATION_TOOL_DESIGN.md` — planning app tool (separate)

---

## Database (all in `planning_applications` schema)

| Table | Purpose |
|-------|---------|
| `issue_notes` | Flat `argument_for` / `argument_against` per issue — editable by user, accumulated from accepted points |
| `document_log` | Logged documents with summary and legacy points JSON |
| `document_text_spans` | Verbatim chunk texts from every logged document — source of truth for evidence |
| `argument_points` | Structured points: `headline` + `detailed_summary` + `accepted` flag |
| `argument_point_evidence` | Links points to spans via `quote_snapshot` |
| `draft_types` | Global document types (Statement of Case, Proof of Evidence, etc.) |
| `draft_sections` | Sections within each draft type — have editable `generation_prompt` and `example_text` |
| `drafts` | Saved draft HTML per project per draft type |
| `prompt_settings` | Per-project saved extraction prompt template (`extract_points` key) |

Key issues (`project_issue_tracks`) live in `admin_console` schema and are shared with the planning application tool.

---

## What was recently built (migration 036)

Evidence-backed drafting. Before this, draft generation only saw the flat accumulated `argument_for` / `argument_against` notes — no source material.

**Now:**
- Documents are chunked on ingest and returned as `chunks` in the analysis response
- Extracted points return `headline` + `detailed_summary` + `relevant_chunk_indices` (not a flat `point` string)
- When user logs a document, `document_text_spans` rows are created (verbatim chunk texts)
- `argument_points` + `argument_point_evidence` rows are created — linking each accepted point to the actual chunk text that backs it (`quote_snapshot`)
- Draft generation queries this evidence via `fetchEvidenceByTrack` and passes it into `buildIssueContext` alongside the flat notes
- The draft LLM sees verbatim source passages per issue, not just accumulated headlines

**Backward compatible** — projects with no `argument_points` records fall back to flat notes only.

---

## Next task (parked)

**Wire policy text into the appeals tool.**

`project_policies` (in `public` schema) already has `policy_text` and `relevant_supporting_text` columns, populated via the policy UI. `policy_track_relevance` already links policies to issue tracks. The appeals tool doesn't use any of this yet.

Changes needed:
1. `fetchEvidenceByTrack` in the controller — add a join to pull linked policies per issue
2. `buildIssueContext` in `llm.service.js` — include policy wording under each issue in the draft prompt context
3. `buildExtractPointsPrompt` in `llm.service.js` — include linked policy wording in the extraction prompt so the LLM can spot misapplication when reading officer reports etc.
4. Optional: add `'policy_interpretation'` as a third valid `field` value on `argument_points` (currently only `argument_for` / `argument_against`) to tag points that are specifically interpretive/legal arguments about how a policy was read

**No schema changes needed** — everything already exists. Purely query and prompt work.

---

## Key architectural principles (from discussions.md — follow these)

1. **Separate the layers.** UI shows clean headlines. DB stores verbatim evidence. LLM interprets and drafts. Don't conflate these.
2. **The LLM is not the source of truth for quotes.** Verbatim text must come from `document_text_spans`, not from asking the LLM to reproduce a quote.
3. **Each argument point has two representations** — a short `headline` for the UI/notes, and a `detailed_summary` for drafting. Store both separately.
4. **Extraction and drafting are separate prompts.** Extraction produces structured data. Drafting produces polished prose. Never combine them.
5. **Evidence is linked, not re-discovered.** The draft LLM receives pre-selected evidence — it does not re-read documents at draft time.
6. **Flat `issue_notes` fields are kept for backward compat and manual editing.** `argument_points` runs alongside them, not replacing them.
