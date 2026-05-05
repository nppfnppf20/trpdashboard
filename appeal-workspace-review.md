# AppealWorkspace.svelte Review

## Findings

1. The initial page load is coupled too tightly to the draft feature. In `frontend/src/lib/components/appeal/AppealWorkspace.svelte`, `load()` fetches key issues, notes, log, and then awaits `loadDraftTypes()`. If draft loading fails, the whole workspace drops into `loadError`, even though the key-issues and argument tabs could still render. That is a real availability bug, not just a cleanliness issue.

2. Section regeneration is patching HTML with a regex in `frontend/src/lib/components/appeal/AppealWorkspace.svelte`. `patchSectionInDraft()` assumes sections are delimited by plain `<h2>` tags with matching text. That is fragile if headings are reformatted by the editor, duplicated, nested, or include markup. This is the riskiest piece of document logic in the file.

3. The component owns too many unrelated state machines at once. The script starts with analysis/upload state, then log modal state, then draft/section editor state, then key-issue/note state later in the same file. That makes behavior hard to reason about because every tab and modal can mutate top-level locals. It is the main reason the file became 2,379 lines.

4. A few async interactions are relying on timing rather than explicit lifecycle. The clearest example is `openSectionExampleModal()`, which uses `setTimeout(..., 50)` to push content into the editor after opening. That is brittle and should be replaced with `tick()` or a child component that accepts `content` declaratively.

## What It’s Doing Now

This file is really four features plus shared shell:

- `Key Issues` tab: renders issues and saves per-issue summaries on blur.
- `Argument Structure` tab: manages issue notes plus the document-analysis workflow, prompt editing, extracted-point acceptance, and save-to-log flow.
- `Draft Document` tab: loads draft types, opens a rich-text editor, regenerates whole drafts, and manages sections.
- `Document Log` tab: shows saved analysis outputs.

So this is not one large component so much as an entire appeal workspace module flattened into one Svelte file.

## How I’d Refactor It

First split by feature boundary, not by visual snippet:

1. Keep a thin `AppealWorkspace.svelte` shell for tabs, project header, and top-level loading.
2. Extract tab components:
   - `AppealKeyIssuesTab.svelte`
   - `AppealArgumentTab.svelte`
   - `AppealDraftTab.svelte`
   - `AppealDocumentLogTab.svelte`
3. Extract modal/components owned by those tabs:
   - `AnalysisPromptModal.svelte`
   - `DocumentLogSaveModal.svelte`
   - `DraftSectionsModal.svelte`
   - `SectionExampleModal.svelte`

Then move logic out of components into small state modules or composables:

- `appeal-analysis.js`
  - payload building
  - prompt load/save/reset
  - analysis run/reset
  - point accept/dismiss/grouping
- `appeal-drafts.js`
  - draft type loading
  - open/save/generate draft
  - section CRUD/reorder/generate
- `appeal-notes.js`
  - note input debounce
  - save state per issue
- `appeal-log.js`
  - transform accepted points into log entries
  - create log entry

Then fix the two risky contracts:

- Decouple `load()` so draft failures do not block the rest of the page.
- Replace regex HTML patching with a section model keyed by IDs, or have the backend return/save per-section content and compose final draft HTML from structured sections.

## Recommended First Pass

If the goal is a safe refactor, start with shell plus tab extraction and leave behavior unchanged:

- `AppealWorkspace.svelte` as workspace shell
- `AppealKeyIssuesTab.svelte`
- `AppealArgumentTab.svelte`
- `AppealDraftTab.svelte`
- `AppealDocumentLogTab.svelte`

That is the safest first refactor because it reduces the file size and state surface without forcing API or behavior changes at the same time.
