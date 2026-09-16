# Decision Notice → Conditions Tracker Import

## Goal

Drag a decision notice (PDF/Word) onto the Conditions Tracker and have it
propose a full set of conditions — verbatim wording, reasoning, split-out
sub-part requirements, and informatives — for the user to review and import,
with an automated check flagging anything that doesn't match the source
text closely enough to trust without a manual read.

## Precedent this reuses

The quote-extraction feature (`AddQuoteModal.svelte` +
`quoteExtraction.service.js` + `quotes.controller.js`) already solves the
hard parts of this exact shape: drag-drop → parse → LLM extraction with a
"VERBATIM RULE" prompt → structured JSON → user reviews before anything is
saved. This plan forks that pattern rather than inventing a new one.

- `backend/src/services/parser.service.js` — `parseFile(buffer, filename)`
  already handles PDF (`pdf-parse`) and Word (`mammoth`), with a graceful
  fallback + warning on parse failure. Reused as-is.
- `backend/src/services/llm.shared.js` — `callLLM` / `parseJSON` /
  `resolveProvider`. Reused as-is.
- Multer memory-storage upload pattern, e.g. `backend/src/routes/quotes.routes.js`.
  Reused as-is (new multer instance on the conditions router).

## Schema — no migration needed for the MVP

`planning_applications.conditions` already has `condition_number`, `title`,
`condition_type`, `wording` (full verbatim text), `reason`, `source_file_name`.
`planning_applications.condition_requirements` already exists for split-out
sub-parts ((a)/(b)/(c)), with `requirement_text` + `requirement_type`.

Decisions for the extraction to follow, using what's already there rather
than adding columns:
- **Informatives** are not a separate table — they're rows with
  `condition_type = 'Informative'`, same as manual entry today. The
  extraction should classify each numbered item into a `condition_type`
  (Condition / Informative / Compliance) the same way a user would.
- `wording` always holds the **full, un-split verbatim text** of the
  condition, even when it's also broken into `condition_requirements` rows —
  so an imperfect split never loses text, it's just redundant until fixed.
- `condition_requirements` rows are the extraction's best attempt at
  separating lettered/numbered sub-parts. `requirement_type` (Pre-Commencement
  etc.) is left null — that's a timing/trigger judgement the user makes
  manually today and the notice text doesn't reliably state it.
- `source_file_name` is set to the uploaded decision notice's filename on
  every imported condition, for traceability.

If we later want to persist the verbatim-check result (rather than just
showing it at review time), a one-line migration adds
`conditions.verbatim_checked_at` / `conditions.verbatim_flagged` — deferred
until we know whether anyone needs it after the initial review.

## Backend

### 1. `backend/src/services/conditionsExtraction.service.js` (new)

Mirrors `quoteExtraction.service.js`. System prompt:

- Same "VERBATIM RULE" framing: `wording`, `reason`, and each requirement's
  `requirement_text` must be copied word-for-word — no paraphrasing,
  shortening, or grammar correction.
- Field rules:
  - `condition_number`: as printed (e.g. "1", "12a").
  - `title`: short label if the notice gives one, else null.
  - `condition_type`: "Condition" | "Informative" | "Compliance" — judged
    the way a planner would (informatives are typically unnumbered or under
    a separate "Informative(s)" heading; compliance conditions reference an
    approved plans list with nothing further to discharge).
  - `wording`: full verbatim text of the condition, including any lettered
    sub-parts inline.
  - `reason`: the verbatim reasoning, usually printed directly under the
    condition or grouped in a "Reasons for Conditions" section — must be
    matched back to the right condition number.
  - `requirements`: array of `{ requirement_text }`, one per lettered/numbered
    sub-part where the notice itself breaks the condition into parts (e.g.
    "(a) ... (b) ..."). Empty array when the condition isn't sub-divided.
- Same `maxTokens`/`jsonMode` call shape as `extractQuoteFromText`, chunked
  via `parser.service.js`'s `chunkText()` if the notice is long (decision
  notices with many conditions can exceed one call's comfortable context —
  chunk by condition-number boundaries, not raw char count, so a condition
  is never split across chunks).

Register `conditions_extraction` in `llmProcessRegistry.js` as
`configurable`, alongside `quote_extraction`.

### 2. Verification: `backend/src/services/verbatimCheck.service.js` (new)

Plain-JS fuzzy diff, not another LLM call, so it's fast/free/deterministic
and checks the thing that actually matters: does the extracted text match
what `parseFile()` actually returned, not what the LLM claims.

- Normalize both the extracted field and the raw parsed text (collapse
  whitespace, strip soft hyphens/line-wrap artifacts that PDF extraction
  introduces).
- Locate the best-matching substring of the raw text for each extracted
  field (sliding window / longest-common-substring) and compute a similarity
  ratio (e.g. Dice coefficient or Levenshtein ratio).
- Below a threshold (e.g. 92%) → flag that field for manual comparison in
  the review UI. Above → shown as verified, no action needed.
- This catches LLM invention/paraphrasing reliably. It does **not** catch
  `pdf-parse` itself mis-reading the source PDF (multi-column layout, tables,
  scanned pages) — that's a real residual risk worth stating plainly to
  whoever reviews the import, not something this check can close. A "view
  raw extracted text side-by-side" toggle in the review UI is the mitigation,
  not a further automated check.

### 3. Routes/controller — `backend/src/routes/conditions.routes.js`

Two new endpoints, following `quotes.routes.js` / `quotes.controller.js`:

```
POST /api/conditions/projects/:projectId/extract-from-document
```
Multer single-file upload → `parseFile` → `extractConditionsFromText` →
`verbatimCheck` each field → respond with
`{ conditions: [...], warning }` (nothing saved yet, same as quotes).

```
POST /api/conditions/projects/:projectId/import-extracted
```
Body: the (user-reviewed/edited) conditions array. Loops through and calls
the existing `createCondition` / `createRequirement` service functions
inside one transaction, in the order given (so `sort_order` matches the
notice). Returns the created rows. A new bulk endpoint rather than looping
the existing single-create endpoints from the frontend, since a decision
notice can carry 20-40 conditions and that many round-trips is worth
avoiding.

## Frontend

### New: "Import from Decision Notice" flow on `ConditionsTrackerTab.svelte`

- A drop zone / button near the existing "Add condition" action, styled like
  `AddQuoteModal.svelte`'s `.extract-dropzone`.
- On drop: upload, show a loading state, then open a review modal
  (`ImportConditionsModal.svelte`, new) listing every extracted condition as
  an editable row: number, type, title, wording, reason, requirements
  sub-list — each with the verbatim-check outcome shown inline (a quiet
  checkmark when verified, an amber "check this" badge with a "view source
  text" expand when flagged).
- User can edit any field inline, delete a proposed condition, or re-split
  requirements before committing — same "review before save" principle as
  quotes; nothing hits the database until they click Import.
- On Import: call the bulk endpoint, close the modal, refresh the tracker.

### Reused as-is
- `parser.service.js` warning surfaced the same way `AddQuoteModal` shows
  "Could not read any text from this document" for scanned PDFs.
- Provider selection (Anthropic/OpenAI) via the existing admin-console
  `conditions_extraction` toggle — no per-request UI needed, matching how
  quote extraction works today.

## Open questions to settle before building

1. **Import target**: only into an empty tracker (first-time setup), or
   also merging into a tracker that already has conditions (dedupe by
   condition_number)? Affects whether `import-extracted` needs a
   duplicate-detection step.
2. **Multi-document notices**: some decision notices arrive as a covering
   letter + a separate conditions schedule/appendix. Single-file upload is
   the MVP; multi-file merge is a fast-follow if needed.
3. **Chunk boundaries**: confirm chunking by condition-number heading
   (rather than fixed char count) is reliable enough across LPA formatting
   styles, or whether a first "find all condition-number headings" pass is
   needed before the extraction call.
