# Handoff: Implement Prose Argument Suggestion for Planning Application Tool

## What this is

The appeal tool has just had its document ingestion flow replaced with a **prose argument suggestion + chat refinement** system. The same needs building for the planning application tool. Instead of extracting bullet-point argument points for the user to tick/dismiss, the LLM reads a document, understands the current working argument, and suggests prose additions only — new sentences/paragraphs from the document that aren't already captured. The user can then refine via a scrolling chat thread before accepting, which appends the text to the relevant issue note.

---

## What was built for the appeal tool (mirror this)

### DB migration (`045_add_suggest_template_to_prompt_settings.sql`)
```sql
ALTER TABLE public.appeal_prompt_settings
  ADD COLUMN IF NOT EXISTS suggest_argument_template TEXT;
```

### `llm.service.js` — new exported functions added at the bottom
- `buildFullDocumentBlock(text)` — chunks text, floats Conclusions/Summaries to front, uses all `ANALYSE_CHUNKS` (raised from 15→20). No 4-chunk cap.
- `buildArgumentSuggestionPrompt({ text, documentBlock, documentType, documentTitle, documentDirection, issues, briefingNote, refusalReasons, userNotes })` — builds the full prompt
- `buildArgumentSuggestionTemplate(...)` — same but with `{{DOCUMENT}}` placeholder for preview/editing
- `suggestArgumentAddition({ text, documentType, documentTitle, documentDirection, issues, briefingNote, refusalReasons, userNotes, conversation, customPrompt })` — calls Claude (Sonnet), handles multi-turn via `conversation[]` array

### What the appeal prompt contains (in order)
1. Role framing (planning appeal consultant)
2. Briefing note from `planning_applications.document_summaries WHERE doc_type = 'briefing_note'` — framed as *strategic background, not all relevant to every issue*
3. Refusal reasons from `admin_console.refusal_reasons` — framed as *the grounds the appeal must address*
4. Per-issue: label, current `argument_for` prose, current `argument_against` prose
5. User guidance (flagged high priority)
6. Document metadata (type, title, direction for/against)
7. Full document via `buildFullDocumentBlock`
8. Tone example from `planningstatementexample.md`
9. Instruction: **additions only** — not restatements. "Nothing to add." if nothing new. Prose with inline document references. 1–4 sentences per issue.

### `appeal.controller.js` — new functions
`suggestArgument`, `getSuggestTemplate`, `saveSuggestTemplate`, `deleteSuggestTemplate`

### `appeal.routes.js` — new routes
```
POST   /projects/:projectId/suggest-argument   (multer file upload)
GET    /projects/:projectId/suggest-template
PUT    /projects/:projectId/suggest-template
DELETE /projects/:projectId/suggest-template
```

### `frontend/src/lib/api/appeal.js` — new functions
`suggestArgument`, `getSuggestTemplate`, `saveSuggestTemplate`, `deleteSuggestTemplate`

### `frontend/src/lib/stores/appeal-suggestion.js` — new store managing
- Form state: `suggestInputTab`, `suggestFile`, `suggestPasteText`, `suggestDocumentType`, `suggestDocumentTitle`, `suggestDirection`, `suggestUserNotes`, `suggestTrackIds`
- Chat state: `suggestState` (`idle|loading|chat`), `conversation[]`, `refinementInput`, `refinementLoading`
- Accept state: `acceptedIssues` — `{ [issueId]: { text, field, issueLabel } }`
- Prompt modal state: `suggestPromptOpen`, `suggestPromptText`, `suggestPromptLoading/Saving/Saved/IsCustom`
- Key actions: `runSuggestion()`, `sendRefinement()`, `acceptSuggestion(issueId, field, text, issueLabel)` (uses `appendToNote` not replace), `resetSuggestion()`, `openSuggestionLogModal()`, `openSuggestPromptModal()`, `saveSuggestPrompt()`, `resetSuggestPromptToDefault()`, `runSuggestionWithPrompt()`

### `AppealWorkspace.svelte` — right panel of Argument Structure tab replaced
States: idle form → loading spinner → chat thread. Chat thread shows assistant messages as prose blocks with Accept button(s), user messages right-aligned. Bottom has textarea + send button (Enter to send, Shift+Enter for newline). After accepting, "Log document" button appears in header using existing log modal infrastructure.

---

## Key differences for the planning application tool

### 1. DB — no migration needed
The planning app tool already has `planning_applications.prompt_settings (project_id, prompt_key, prompt_text)`. Use `prompt_key = 'suggest_argument'` for the new template. No new column or table needed.

### 2. No refusal reasons
Planning applications don't have refusal reasons. Drop that section from the prompt entirely.

### 3. No direction toggle (for/against)
The user confirmed planning applications don't have the for/against concept. The issue notes table (`planning_applications.issue_notes`) does have `argument_for` and `argument_against` columns plus policy tier fields (`policy_national`, `policy_local`, `policy_neighbourhood`, `policy_supplementary`, `policy_other`) — but the document direction UI toggle should not be shown. The LLM should always be writing additions to the compliance case.

### 4. Policy tier context instead of refusal reasons
The planning application tool has policies linked to issues via `planning_applications.policy_track_relevance`. These should be fetched and included in the prompt as the policy context the document needs to speak to — similar role to refusal reasons in appeals.

### 5. Briefing note doc_type
The existing planning application controller uses `doc_type = 'briefing_transcript'` in most places (not `'briefing_note'`). Verify which is correct before writing the query — check `planningApplication.controller.js`.

### 6. Different frontend files
- Component: `PlanningWorkspace.svelte`
- Analysis store (for patterns): `planning-analysis.js`
- Notes store: `planning-notes.js` — check `appendToNote` equivalent exists
- API: `planningApplication.js`
- Log store: `planning-log.js`

### 7. Prompt settings CRUD — different table structure
The appeal tool uses a single-column upsert on `appeal_prompt_settings`. The planning app uses `planning_applications.prompt_settings (project_id, prompt_key, prompt_text)` with a composite key. Upsert on `(project_id, prompt_key)` with `prompt_key = 'suggest_argument'`.

---

## What to verify before starting

1. Confirm `doc_type` value for the briefing note in `planning_applications.document_summaries` — check existing controller, it may be `briefing_transcript`
2. Check what `planning-notes.js` exposes — confirm `appendToNote(trackId, field, text)` exists or find the equivalent
3. Confirm which field(s) the accepted prose should be written into — `argument_for` only, or one of the policy tier fields, or a separate field
4. Check `ArgumentStructurePanel.svelte` to understand the current layout of the right panel in the planning app's argument tab — that's what gets replaced
