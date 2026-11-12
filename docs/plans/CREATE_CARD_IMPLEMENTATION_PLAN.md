# Create Card (conversational document builder) - Implementation Plan

## The Concept

A new **Create** card in the Planning Application workspace card list. It opens a three-pane view:

- **Left:** source picker + context meter (same as Project Chat).
- **Centre:** the existing rich text editor holding the document.
- **Right:** a conversation with the LLM, with a **document type dropdown** on top.

The user ticks sources, picks a doc type (which sets the Word export template and supplies an example doc for style), and then tells the LLM in free text what to write. It is fully conversational: add, cut, change, or highlight a passage and say what to do with it.

Decisions made: new card (not replacing the Blank doc entry), new standalone doc-types table, no streaming in v1.

---

## Why the current edit flow must change first (root-cause finding)

Reported bug: asking the dash to change some wording in a formatted HLPV rewrote the doc and deleted large parts of the table sections.

Cause: `splitAllParagraphs` ([draftParagraphs.js](../../frontend/src/lib/utils/draftParagraphs.js)) treats each top-level element as one block, so a whole `<table>` is one "paragraph". `incorporateTargetedParagraphs` ([appeal.service.js:771](../../backend/src/services/appeal.service.js#L771)) asks the model to re-emit every touched block as full HTML in a JSON array (cap 16k tokens). Tables get shortened, truncated or dropped, and `mergeParagraphUpdates` writes that lossy version over the original. "Apply to whole document" sends every block through this path.

Fix: the model must never reproduce unchanged content. It returns **small targeted edits** and our code applies them.

### Edit operations (model output)

```json
{ "reply": "short conversational message",
  "edits": [
    { "op": "replace", "find": "exact existing text", "replace": "new text" },
    { "op": "insert_after", "anchor": "exact anchor text", "html": "<p>...</p>" },
    { "op": "delete", "find": "exact existing text" }
  ] }
```

Rules enforced by the applier (`applyEdits(html, edits)`, shared util):
- `find` / `anchor` must match **exactly once** in the document text. Zero or multiple matches: that edit is rejected and reported (the model is asked to retry with more context). Nothing applied on a guess.
- Matching and replacing happen on text nodes, so tables and other structure are untouched. Editing inside a cell is just a text replace. Adding a table row is an explicit `insert_after` with row HTML.
- **Structure guard:** before accepting, compare counts of tables / rows / headings / lists before and after. Any unexplained change rejects the batch with a visible warning.
- Empty document: the model may return a full `html` draft (nothing to lose).
- "Rewrite the whole thing" style requests: a full replacement is allowed but is always shown as a pending change that must be accepted, and the structure guard still warns on lost tables.

Review UI stays: pending-highlight + Accept / Reject (`markChangedWordsPending` etc.), now driven by exact edits rather than word-diff guesses.

---

## Phases

### Phase 1 - Edit engine + fix the existing flows
- `frontend/src/lib/utils/documentEdits.js` (or backend equivalent): `applyEdits`, structure guard, pending-marking of applied edits.
- Change `incorporateTargetedParagraphs` / `sendAiEdit` and `handleReviseAll` to the edit-op protocol. Existing highlight popup and "Apply to whole document" keep working but can no longer drop tables.
- Test against a real HLPV with tables: wording change, add a sentence, delete a paragraph, whole-document tone change.

### Phase 2 - Doc types table + backend chat endpoint
- Migration (user applies): `admin_console.create_doc_types` - `id, name, slug, word_template` (filename in `frontend/static`, matches `SLUG_TEMPLATE_MAP`), `example_html/example_text`, `structure_notes`, `sort_order`, `active`. Small admin CRUD (list/create/update/delete) alongside document style templates in the admin console. Seed with existing templates (planning statement, cover letter, HLPV, stage 1 review, SoC, SoCG).
- `POST /api/draft-create/projects/:id/chat`:
  - body: `messages[]`, `sources` (Project Chat shape), `doc_type_id`, `document_html`, optional `selection` ({ quoted text }).
  - Context: house style + anti-slop, example doc ("match style, do not copy content"), `assembleContext` blocks from `projectChat.service.js`, full current document.
  - Budget guard: same 200k-char check as Project Chat.
  - Returns `{ reply, edits | html }`. `[SOURCE REQUIRED]` for facts not in sources.
  - Provider via `resolveProvider('draft_create', ...)`.
- Keep `/api/draft-create/generate` until the old Create panel is retired.

### Phase 3 - Frontend Create card
- New card in the workspace list, opens the three-pane view.
- Left pane: lift the source tree + meter from `ProjectChatTab.svelte` (`getChatSources` / catalogue endpoint reused). Right pane: chat, doc type dropdown (sets export template for the Word export via the registry).
- Highlighting text in the editor attaches the selection to the next message; typed chat and highlight edits are one flow. Edits come back through `applyEdits` into the editor as pending changes.
- Save goes to the existing custom deliverable (`planning_deliverables`, `createCustomDeliverable`), so export/open/delete already work.

### Phase 4 - Persistence + cleanup
- Persist conversation + source selection + chosen doc type with the deliverable (JSONB column or messages table; migration, user applies).
- Retire `DraftCreatePanel.svelte` and `/generate` once the Create card has replaced it.

---

## Open items / risks
- Exact-match edits can fail on text split across inline tags (`<strong>` mid-sentence). Matching should work on flattened text with an offset map back to DOM nodes; test with bold/italic/links.
- Very long documents: the whole current document is sent each turn; document size counts toward the context meter alongside sources.
- Example doc size: cap/trim example text per doc type (as `sectionChat` does at 12k chars).
- Word template per doc type depends on `SLUG_TEMPLATE_MAP`; new types need a template file added to `frontend/static`.
