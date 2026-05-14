# Planning Application & Appeal Tools — Reference

Both tools share a common architecture: key issues, document ingestion, argument building, AI drafting. They differ in context (pre-decision vs. appeal) and output document types.

---

## 1. Planning Application Workspace

### Purpose
Builds a planning argument for a live application. Organises policy, evidence and AI-drafted documents (planning statement, D&A statement etc.) around a set of key issues.

### UI Tabs

| Tab | What it does |
|-----|-------------|
| **Key Issues** | Displays project issue tracks. Per-issue notes across 5 policy tiers: National, Local, Neighbourhood, Supplementary, Other |
| **Document Log** | Log of ingested documents with title, code, summary and extracted argument points |
| **Argument Suggestion** | Upload/paste a document → extract points → get AI suggestions for argument additions |
| **Drafts** | Generate and edit full documents (Planning Statement, D&A Statement etc.) section by section |
| **Briefing Notes** | Upload a briefing note, draft issue summaries from it, or evolve arguments conversationally |

### File Paths

**Frontend**
- `frontend/src/lib/components/planning-application/PlanningWorkspace.svelte` — main workspace
- `frontend/src/lib/components/planning-application/PolicyTierNotes.svelte` — per-issue policy tier notes
- `frontend/src/lib/components/planning-application/ArgumentStructurePanel.svelte` — argument structure view
- `frontend/src/lib/api/planningApplication.js` — all API calls

**Stores**
- `frontend/src/lib/stores/planning-drafts.js` — draft generation, sections, prompts
- `frontend/src/lib/stores/planning-notes.js` — issue notes (policy tiers + briefing drafts)
- `frontend/src/lib/stores/planning-analysis.js` — document analysis, extracted points
- `frontend/src/lib/stores/planning-log.js` — document log CRUD
- `frontend/src/lib/stores/planning-suggestion.js` — argument suggestion workflow

**Backend**
- `backend/src/controllers/planningApplication.controller.js`
- `backend/src/routes/planningApplication.routes.js` → `/api/planning-application/*`

### Draft Document Types (from `planning_applications.draft_types`)
- Planning Statement
- Design & Access Statement
- Site & Surroundings Report
- D&A Assessment

Each document type has multiple **sections** (`planning_applications.draft_sections`), each with its own `generation_prompt` and optional `example_text`.

### Key API Endpoints
```
GET  /api/planning-application/projects/:id/key-issues
GET  /api/planning-application/projects/:id/issue-notes
PUT  /api/planning-application/projects/:id/issue-notes/:trackId
GET  /api/planning-application/projects/:id/draft-types
GET  /api/planning-application/projects/:id/drafts/:typeId
PUT  /api/planning-application/projects/:id/drafts/:typeId
POST /api/planning-application/projects/:id/drafts/:typeId/generate
POST /api/planning-application/projects/:id/drafts/:typeId/sections/:sectionId/generate
POST /api/planning-application/projects/:id/suggest-argument
POST /api/planning-application/projects/:id/draft-arguments-from-briefing
```

### Database Tables (`planning_applications` schema)

| Table | Purpose |
|-------|---------|
| `issue_notes` | Per-issue working notes across 5 policy tiers |
| `document_log` | Logged documents with summaries and argument points |
| `document_text_spans` | Verbatim text chunks from ingested documents |
| `argument_points` | Structured extracted points (headline + detailed summary) |
| `argument_point_evidence` | Links points to source text spans |
| `draft_types` | Global document template definitions |
| `draft_sections` | Sections within draft types, each with generation prompt |
| `drafts` | Per-project saved draft HTML |
| `prompt_settings` | Per-project saved custom prompts |

---

## 2. Appeal Tool Workspace

### Purpose
Builds a planning appeal case. Organises arguments for/against each issue, ingests LPA/inspector documents, and generates formal appeal documents (Statement of Case, Statement of Common Ground, Proof of Evidence).

### UI Tabs

| Tab | What it does |
|-----|-------------|
| **Key Issues** | Same issue tracks as planning app. Per-issue notes: `argument_against` (opposing LPA) and `argument_for` (supporting appeal) |
| **Document Analysis** | Upload/paste LPA or inspector documents → extract points mapped to issues → accept/dismiss |
| **Argument Suggestion** | Upload document → get AI suggestions for how to use it in the appeal argument |
| **Drafts** | Generate and edit formal appeal documents section by section |
| **Document Log** | Tracking log of all ingested documents |
| **Briefing Notes** | Upload briefing, draft arguments conversationally |

### File Paths

**Frontend**
- `frontend/src/lib/components/appeal/AppealWorkspace.svelte` — main workspace
- `frontend/src/lib/components/appeal/AppealDocReviewModal.svelte` — document review modal
- `frontend/src/lib/api/appeal.js` — all API calls

**Stores**
- `frontend/src/lib/stores/appeal-drafts.js` — draft generation and sections
- `frontend/src/lib/stores/appeal-notes.js` — per-issue argument notes
- `frontend/src/lib/stores/appeal-analysis.js` — document analysis workflow
- `frontend/src/lib/stores/appeal-log.js` — document log CRUD
- `frontend/src/lib/stores/appeal-suggestion.js` — argument suggestion workflow

**Backend**
- `backend/src/controllers/appeal.controller.js`
- `backend/src/routes/appeal.routes.js` → `/api/appeal/*`

### Draft Document Types (from `appeals.appeal_draft_types`)
- Statement of Case
- Statement of Common Ground
- Proof of Evidence

Each document type has sections (`appeals.appeal_draft_sections`) with generation prompts.

### Key API Endpoints
```
GET  /api/appeal/projects/:id/key-issues
GET  /api/appeal/projects/:id/issue-notes
PUT  /api/appeal/projects/:id/issue-notes/:trackId
GET  /api/appeal/projects/:id/draft-types
GET  /api/appeal/projects/:id/drafts/:typeId
PUT  /api/appeal/projects/:id/drafts/:typeId
POST /api/appeal/projects/:id/drafts/:typeId/generate
POST /api/appeal/projects/:id/suggest-argument
POST /api/appeal/projects/:id/draft-arguments-from-briefing
```

### Database Tables (`appeals` schema + `public` schema)

| Table | Schema | Purpose |
|-------|--------|---------|
| `appeal_draft_types` | appeals | Appeal document type definitions |
| `appeal_draft_sections` | appeals | Sections with generation prompts |
| `appeal_drafts` | appeals | Per-project saved draft HTML |
| `appeal_issue_notes` | appeals | Per-issue argument_for / argument_against |
| `appeal_document_log` | appeals | Logged documents |
| `appeal_prompt_settings` | appeals | Per-project saved custom prompts |
| `appeal_arguments` | public | Living appeal argument document (HTML) |
| `appeal_documents` | public | Uploaded documents with AI review |

---

## 3. Shared Architecture

### Shared Components
| Component / Service | Path | Used by |
|--------------------|------|---------|
| Rich text editor | `frontend/src/lib/components/planning/RichTextEditor.svelte` | Both tools, HLPV narrative |
| Word export | `frontend/src/lib/services/planningDeliverablesExport.js` | Both tools, planning deliverables |
| HTTP client | `frontend/src/lib/api/client.js` | All tools |
| LLM service | `backend/src/services/llm.service.js` | Both tools (all prompts live here) |
| Parser service | `backend/src/services/parser.service.js` | Both tools (file parsing, chunking) |

### Shared Database Tables (`admin_console` / `public` schemas)
| Table | Schema | Purpose |
|-------|--------|---------|
| `projects` | public | Core project record |
| `project_issue_tracks` | admin_console | Key issues shared across both tools |
| `project_policies` | public | Policy records (national / local / neighbourhood / supplementary / other) |

### AI Models
| Model | Use |
|-------|-----|
| `claude-haiku-4-5-20251001` | Per-chunk extraction (fast, parallel) |
| `claude-sonnet-4-6` | Summary merging, draft generation, argument suggestion |

### Prompt Architecture
All LLM prompts are in `backend/src/services/llm.service.js`. Key functions:

| Function | Purpose |
|----------|---------|
| `extractPointsFromDocument` | Extract structured argument/evidence points from uploaded docs |
| `generateDraftSection` | Generate a single section of a draft document |
| `generateAppealDraft` | Generate a full appeal draft from all sections |
| `suggestArgumentAddition` / `suggestPlanningArgumentAddition` | Suggest how a new document strengthens the argument |
| `draftArgumentsFromIssueSummaries` | Draft arguments from issue summaries |
| `draftKeyIssueSummariesFromBriefing` | Draft issue summaries from a briefing note |
| `evolveArgumentFromBriefing` | Conversational argument refinement |

**Prompt assembly pattern:**
- Global tone/style block (loaded from `/planningstatementexample.md`) injected into all generation calls
- Template variables (`{{PROJECT_NAME}}`, `{{SITE_ADDRESS}}`, `{{LOCAL_POLICIES}}` etc.) resolved at runtime
  - `programmatic: true` — substituted after generation (never seen by LLM)
  - `programmatic: false` — injected into prompt before sending (LLM synthesises from content)
- Per-project custom prompt templates stored in `prompt_settings` / `appeal_prompt_settings`

### Word Export
Both tools export rich text editor content to `.docx` using `basicdocument.docx` as the template (in `frontend/static/`). Export is triggered from the draft editor toolbar.

To swap the template: replace `frontend/static/basicdocument.docx` or add a new file and update `TEMPLATE_MAP` in `planningDeliverablesExport.js`.
