# Moving Appeal Draft Cards into the Planning Application Workspace
_2026-06-04_

## Background

The Planning Application workspace now shows document generation cards (planning statement, stage 1 review). The goal is to also show appeal document cards (Appeal Statement, Statement of Case, Common Ground etc.) in the same card list, so all document generation for a project lives in one place.

---

## What's the same

- Both use `admin_console.project_issue_tracks` — same issue tracks table, same project
- Both use guiding briefs and project briefs — same context accordion pattern
- Both have draft types + sections with per-section generation prompts — same card structure
- Generated HTML goes into the same rich text editor — same open/export/incorporate flow
- The context endpoint pattern (`getPaDraftContext`, `getDraftContext`) is the same shape

---

## What's different

| | Planning Application drafts | Appeal drafts |
|---|---|---|
| DB schema | `planning_applications.draft_types` / `draft_sections` / `drafts` | `appeals.appeal_draft_types` / `appeal_draft_sections` / `appeal_drafts` |
| Issue notes table | `planning_applications.issue_notes` — has policy tiers (policy_national, policy_local, policy_supplementary etc.) | `public.appeal_issue_notes` — just `argument_for`, `argument_against` |
| Extra generation context | Linked policies per track, accepted argument points from analysed documents | Refusal reasons (`admin_console.refusal_reasons`), per-type example doc |
| Generate endpoint | `POST /api/planning-application/projects/:id/drafts/:typeId/generate` | `POST /api/appeal/projects/:id/drafts/:typeId/generate` |
| Variables in section prompts | `{{LOCAL_POLICIES}}`, `{{NPPF_TEXT}}`, `{{ABOUT_APPLICANT}}` etc. | None — generation is from issue notes + guiding brief only |
| Context item 4 | — | Example doc (a reference document uploaded per draft type in the appeal tool) |

---

## Work required

### 1. Load appeal draft types into the card list (low–medium effort)

The `planning-drafts.js` store currently only fetches from `planning_applications.draft_types`. It would need to also fetch from `appeals.appeal_draft_types` (via a new or existing API endpoint) and tag each card with `tool: 'pa'` or `tool: 'appeal'` so the card knows which endpoint to call.

The card rendering is already generic — it just needs to know the tool flag.

### 2. Route generation correctly (low effort)

`handleGenerate` in `planning-drafts.js` currently calls the PA generate endpoint. It would need to check the card's `tool` flag and call either:
- `/api/planning-application/projects/:id/drafts/:typeId/generate` (PA)
- `/api/appeal/projects/:id/drafts/:typeId/generate` (appeal)

Same for save draft, get draft, sections modal, etc.

### 3. Context accordion — appeal cards add a 4th item (low effort)

The guiding brief and project brief are identical. Appeal cards add:
- **Example doc** — whether a reference document has been uploaded for this draft type in the appeal tool (stored in `appeals.appeal_draft_example_docs` or similar)

The `getDraftContext` endpoint in the appeal controller already returns this; it would just need to be called for appeal cards.

### 4. Sections modal (low effort)

The sections modal already works generically — it just needs to call the right API (PA sections vs appeal sections). A `tool` flag on the card would route it correctly.

---

## Important caveat: data dependency

The issue notes drawn on are fundamentally different:

- **Appeal drafts** draw on `appeal_issue_notes.argument_against` (the refusal reason rebuttal) and `argument_for` (your positive case). These are only populated when a project has been worked on in the **appeal tool**.
- **PA drafts** draw on `planning_applications.issue_notes` with full policy context.

A project that has only had PA work done will not have `appeal_issue_notes` populated, so appeal draft generation would produce empty or poor output.

**Recommendation:** Only show appeal draft cards if the project has at least one `appeal_issue_note` record. This keeps the card list clean and prevents confusing empty generations.

---

## What stays in the Appeal workspace

Moving the generation cards does not mean moving everything. These would stay in the appeal workspace:

- Document analysis (extract argument points from documents)
- Suggest argument (prose chat flow against specialist reports)
- Incorporate panel (weave specialist report evidence into draft paragraphs)
- Document log
- Argument structure / key issue notes editing

The appeal workspace remains the working environment for building the argument. The PA workspace just gains the appeal document *generation* cards, so you can trigger and view all your documents in one place.

---

## Estimated effort

| Task | Effort |
|---|---|
| Load appeal types into store, tag with `tool` flag | ~1 hour |
| Route generate/save/get/sections to correct endpoint | ~1 hour |
| Context accordion for appeal cards (4th item: example doc) | ~30 min |
| Conditional display (only show if appeal notes exist) | ~30 min |
| Testing across a project with both PA and appeal data | ~1 hour |

**Total: ~4 hours**

---

## Decision needed before building

1. **Conditional display** — show appeal cards only if project has appeal issue notes, or always show them?
2. **Card order** — show PA drafts first, then appeal drafts? Or interleaved by sort_order?
3. **Incorporate panel** — the appeal incorporate panel currently lives in the appeal workspace draft editor. Should it also be available from the PA workspace draft editor for appeal drafts, or is that a later step?
