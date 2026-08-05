# LLM Provider Toggle — Central Admin Console Page

Implementation plan for a central admin page that lists every AI-assisted
process in the app, shows which LLM provider (Claude/OpenAI) it uses, and
lets an admin toggle the default provider per process — while still letting
existing per-instance toggles act as a temporary, session-only override.
Not yet implemented; pick this up in a fresh session when ready.

---

## Context

Three AI-assisted flows already support switching between Claude and OpenAI
per-request: **quote extraction** (PDF import in `AddQuoteModal.svelte`),
**appeal draft generation from PA notes**, and **planning statement draft
generation**. Each has its own local, per-instance toggle in the UI (a
dropdown/radio group), defaulting to Claude, with no persistence — pure
Svelte component state.

A wider codebase survey found roughly 26 more backend files making LLM
calls, almost all hardcoded to Claude via either the legacy `callClaude()`
helper or raw `client.messages.create()`/`.stream()` calls, with zero
provider abstraction.

The goal is a single **central admin console page** that:
1. Lists every AI-assisted process in the app and which provider it's
   currently using.
2. Lets an admin toggle the provider **from that central page**, persisting
   as the default for that process.
3. Still respects **existing per-instance toggles** (e.g. the dropdown on a
   specific appeal-draft card) as a **temporary, session-only override** — if
   the user picks a provider on that specific item's own page/panel, that
   choice wins until the browser refreshes; after a refresh (or if never
   touched), the process falls back to whatever is set on the central page.

Given the size of a full conversion (~26 files), this plan is scoped as:
**build the full central-settings infrastructure and list every known
process for visibility, but only wire the toggle to actually take effect for
the 3 processes that are already provider-agnostic today.** The rest are
listed with the toggle disabled/badged "not yet configurable" until
converted in a later pass (explicitly out of scope here).

---

## Precedence rule (the core mechanism)

For any of the 3 already-agnostic processes, when a request is about to call
`callLLM(...)`:

1. If the frontend sent an **explicit provider** on this specific request
   (i.e. the user touched that item's own local toggle this session) → use it.
   This is naturally "temporary" because it's plain Svelte `let` state, never
   persisted to storage — a browser refresh wipes it for free, no extra code
   needed for that part.
2. Otherwise → look up the **central setting** for that process key in the
   new settings table.
3. Otherwise (no row yet) → default to `'anthropic'`.

This means: **local toggles must stop defaulting to `'anthropic'` when
untouched.** Today `AddQuoteModal.svelte`'s `extractionProvider` and
`PlanningWorkspace.svelte`'s `draftProviderByType[type.id] || 'anthropic'`
both force an explicit `'anthropic'` even when the user never touched the
control, which would always win over the central setting and defeat the
whole point. Both need a third "Default" state that sends **no provider
field at all**, so the backend's fallback logic actually gets a chance to run.

---

## Backend design

### 1. New migration — `backend/sql/migrations/0XX_create_llm_process_settings.sql`

No generic key-value settings table exists in this codebase today (confirmed
via research — the closest analog, `appeal_prompt_settings`, is per-project
prompt text, not a general settings store). Create a dedicated table,
following the existing `admin_console.*` schema convention:

```sql
CREATE TABLE IF NOT EXISTS admin_console.llm_process_settings (
  process_key  text PRIMARY KEY,
  provider     text NOT NULL DEFAULT 'anthropic' CHECK (provider IN ('anthropic', 'openai')),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
```

### 2. Process registry — `backend/src/services/llmProcessRegistry.js`

A single hardcoded array is the source of truth for "what processes exist."
The admin page reads this (merged with DB overrides) to render its table.
Each entry: `{ key, label, description, status }` where `status` is
`'configurable'` (wired to callLLM + resolveProvider, toggle live) or
`'claude_only'` (not converted yet, toggle disabled) or `'background'`
(cron/automated job — central setting still applies, but no per-instance UI
override is possible since there's no "item page" to toggle from).

Full registry to seed (compiled from an earlier survey — no need to re-run it):

**`configurable` (wire up in this pass):**

| key | label | source |
|---|---|---|
| `quote_extraction` | Quote Extraction (PDF import) | `quoteExtraction.service.js` → `extractQuoteFromText` |
| `appeal_draft_pa_notes` | Appeal Draft Generation (from PA Notes) | `appeal.service.js` → `generateAppealDraftFromPrompt`, via `appeal.controller.js` → `generateDraftFromPaNotes` |
| `planning_statement_draft` | Planning Statement Draft Generation | `planningStatement.service.js` → `generatePlanningStatementAssessment` / `generateSingleAssessmentIssue` / `generatePlanningStatementSection` / `generateFromTemplate`, via `planningApplication.controller.js` → `generateDraft` |

**`claude_only` (list for visibility, disabled toggle, convert later):**

| key | label | source |
|---|---|---|
| `appeal_draft_legacy` | Appeal Draft Generation (legacy/manual) | `appeal.service.js` → `generateAppealDraft`, via `appeal.controller.js` → `generateDraft` (route `POST .../drafts/:typeId/generate`). **No provider plumbing at all today** — some branches call raw `client.messages.create` directly (line ~214-218), deepest conversion of the batch. |
| `appeal_section_generate` | Appeal Section Generation (manual) | `appeal.controller.js` → `generateSection` (route `.../sections/:sectionId/generate`) — no provider plumbing |
| `appeal_argument_building` | Appeal Argument Building/Chat/Incorporation | `appeal.service.js` sibling functions not on the `callLLM` path: `generateAppealArgument`, `reviewDocumentAgainstArgument`, `scopeDocumentIncorporation`, `draftIssueArgumentsFromBriefing`, `evolveArgumentFromBriefing`, `chatArgumentWithBriefing`, `suggestArgumentAddition`, `incorporateDocument`, `amendDraftFromBriefing` |
| `planning_statement_helpers` | Planning Statement Helper Functions | `planningStatement.service.js`: `summariseDocument`, `suggestTranscriptUpdates`, `incorporatePlanningAssessment`, `draftKeyIssueSummariesFromBriefing`, `draftIssuesFromBriefingNote`, `draftArgumentsFromIssueSummaries`, `suggestPlanningArgumentAddition` |
| `draft_check` | Draft Check (brief coverage / consistency / grammar) | `draftCheck.controller.js` → `runCheck`; UI: `DraftCheckPanel.svelte` |
| `scraper_filter` | Scraper Result Filtering | `scraperFilters.controller.js` → `applyFilter`; UI: `ContractsFinderTab/DataCentresTab/RenewablesTab.svelte` |
| `marketing_draft` | Marketing Draft Generation | `marketing.controller.js` → `generateDraft`; UI: `MarketingWorkspace.svelte` |
| `guiding_brief_review` | Guiding Brief Review | `guidingBriefs.controller.js` → `reviewDraft`; UI: `NarrativeTab.svelte` |
| `project_chat` | Project Chat | `projectChat.controller.js` → `chat`; UI: `ProjectChatTab.svelte` |
| `section_chat` | Section Chat | `sectionChat.controller.js` → `sectionChat`; UI: `SectionChatPanel.svelte` / `PlanningWorkspace.svelte` |
| `planit_keyword_suggest` | Planning App Keyword Suggestions | `planit.controller.js` → `suggestKeywords` (hardcoded to Haiku model specifically); UI: `SimilarSchemesTab.svelte` |
| `hlpv_v3_generate` | HLPV v3 Generation | `hlpvV3.controller.js` → `generateHlpvV3` (streamed); UI: `PlanningWorkspace.svelte` |
| `stage1_review` | Stage 1 Review Generation | `stage1Review.controller.js` → `generateStage1Review` (streamed); UI: `Stage1ReviewPanel.svelte` / `StartingDocsModal.svelte` |
| `lpa_doc_analysis` | LPA Document Analysis | `lpaAnalysis.service.js` → `analyseLpaDocument` / `synthesiseLpaAnalysis` |
| `stage_analysis` | Stage Analysis | `stageAnalysis.service.js` → `analyseDocumentForStage` |
| `surveyor_briefing_analysis` | Surveyor Briefing Analysis | `surveyorBriefing.service.js` → `analyseBriefingForDisciplines` / `suggestEmailEdits` |
| `hlpv_legacy_narrative` | HLPV v1/v2 Narrative Generation | `hlpv.service.js` → `generateHlpvNarrative` |
| `tracker_intake` | Tracker Intake Processing | `trackerActions.service.js` → `processTrackerIntake` |
| `meeting_processing` | Meeting Notes Processing | `meeting.service.js` → `extractInsights` / `processMeetingTranscript` |
| `conditions_tracker_suggestions` | Conditions Tracker Suggestions | `conditionsTracker.service.js` → `suggestAdvancementSummaries` / `draftAdvancementsSummaryEmail` / `suggestFeeQuoteWorks` |
| `quote_action_summaries` | Quote Action Summaries | `quoteActions.service.js` → `suggestActionSummaries` |
| `consultation_processing` | Consultation Response Processing | `consultation.service.js` → `processConsultationResponse` / `summariseConsultation` |
| `public_comment_processing` | Public Comment Processing | `public_comments.service.js` → `processPublicComment` / `analysePublicComments` |
| `policy_doc_processing` | Policy Document Processing | `policy.service.js` → `processPolicyDocument` |

**`background` (automated jobs — central setting applies, no per-instance override possible):**

| key | label | source |
|---|---|---|
| `tender_relevance_classification` | Tender Relevance Classification | `tenders/relevance.js` → `classifyCandidates` — cron ingestion + manual admin trigger (`tenders.controller.js` → `triggerClassify`) |
| `document_ingestion` | Document Ingestion Pipeline | `ingestion.service.js` → `runIngestion` / `runSingleTopicIngestion` |

### 3. Settings API

- `backend/src/routes/llmSettings.routes.js` — `GET /` (list registry merged
  with DB rows), `PUT /:key` (upsert provider for a key; reject unknown keys
  or invalid provider values).
- `backend/src/controllers/llmSettings.controller.js` — no separate service
  file needed, direct `pool.query` against `admin_console.llm_process_settings`,
  matching the simple-CRUD convention used by `documentStyleTemplates.controller.js`.
- Register in `backend/src/routes/index.js`: `router.use('/api/admin-console/llm-settings', llmSettingsRoutes)`.
  Everything under `/api/admin-console` already gets `requireAdmin` applied
  once at the top of that file — no extra auth wiring needed.

### 4. `resolveProvider` helper — `backend/src/services/llm.shared.js`

```js
const providerCache = new Map(); // processKey -> { provider, expiresAt }
const CACHE_TTL_MS = 30_000;

export async function resolveProvider(processKey, explicitProvider) {
  if (explicitProvider === 'anthropic' || explicitProvider === 'openai') return explicitProvider;
  const cached = providerCache.get(processKey);
  if (cached && cached.expiresAt > Date.now()) return cached.provider;
  const { rows } = await pool.query(
    'SELECT provider FROM admin_console.llm_process_settings WHERE process_key = $1',
    [processKey]
  );
  const provider = rows[0]?.provider ?? 'anthropic';
  providerCache.set(processKey, { provider, expiresAt: Date.now() + CACHE_TTL_MS });
  return provider;
}
```

(Needs `pool` imported in `llm.shared.js` — check how other services import
the DB pool, e.g. `import { pool } from '../db.js'` or similar, and match
that convention exactly.)

### 5. Wire the 3 configurable processes

For each, the pattern is: change the function's default parameter from
`provider = 'anthropic'` to `provider = null`, then resolve it just before
the `callLLM` call:

- `quoteExtraction.service.js` → `extractQuoteFromText(text, fileName, provider)`:
  add `const resolved = await resolveProvider('quote_extraction', provider);`
  before the `callLLM({...})` call, use `resolved` instead of `provider`.
- `appeal.service.js` → `generateAppealDraftFromPrompt(...)`: same pattern
  with key `'appeal_draft_pa_notes'`.
- `planningStatement.service.js` → `generatePlanningStatementAssessment`,
  `generateSingleAssessmentIssue`, `generatePlanningStatementSection`,
  `generateFromTemplate` (and its internal `generateLlmSlot`): same pattern
  with key `'planning_statement_draft'`. All four currently default
  `provider = 'anthropic'` at the function signature — change all to `null`.

No controller changes needed for these 3 — they already read `provider` from
`req.body` as `undefined` when omitted, which is exactly the "no explicit
override" signal `resolveProvider` expects.

---

## Frontend design

### 1. Settings API client — `frontend/src/lib/api/llmSettings.js`

```js
export async function getLlmSettings() { ... } // GET /api/admin-console/llm-settings
export async function updateLlmSetting(key, provider) { ... } // PUT /api/admin-console/llm-settings/:key
```

### 2. New admin page — `frontend/src/routes/admin-console/llm-settings/+page.svelte`

Follow the `style-templates/+page.svelte` conventions: Svelte 5 runes
(`$state`, `$derived`), `onMount(load)` with `loading`/`error` state, plain
`<style>` block matching the existing slate/blue palette (`#1e293b`,
`#64748b`, `#2563eb`, `#e2e8f0`), Line Awesome icons.

Unlike `style-templates` (which uses an edit modal), this page should be a
flat table with an **inline** toggle per row — simpler than a modal since
there's only one field to change:

| Process | Description | Provider |
|---|---|---|
| Quote Extraction (PDF import) | ... | ( Claude ) ( OpenAI ) — live, auto-saves on click via `updateLlmSetting` |
| Appeal Draft Generation (from PA Notes) | ... | ( Claude ) ( OpenAI ) — live |
| Planning Statement Draft Generation | ... | ( Claude ) ( OpenAI ) — live |
| Draft Check | ... | ( Claude ) ( OpenAI ) — **disabled**, badge "Not yet configurable" |
| ...(rest of `claude_only` and `background` rows, all disabled)... |

Group visually by status (`configurable` first, then `claude_only`, then
`background`) so it reads as "here's what you can control today" followed by
"here's everything else, coming later."

### 3. Add nav entry — `frontend/src/routes/admin-console/+layout.svelte`

Add one entry to the `navItems` array (path `/admin-console/llm-settings`,
label e.g. "AI Providers", suitable Line Awesome icon).

### 4. Update the 3 existing per-instance toggles to a 3-state model

**`AddQuoteModal.svelte`** — `extractionProvider` currently defaults to
`'anthropic'` and is always sent. Change to a 3-way control: **Default /
Claude / OpenAI**, defaulting to `''` (or `null`) meaning "no override."
In `extractQuoteFromDocument(file, provider)` (`frontend/src/lib/api/quotes.js`),
only `formData.append('provider', provider)` when `provider` is truthy —
otherwise omit the field entirely so the backend's `resolveProvider` fallback
actually runs.

**`PlanningWorkspace.svelte`** — `draftProviderByType[type.id]` dropdown
currently has 2 options and the call site does
`provider: draftProviderByType[type.id] || 'anthropic'` (forces Claude when
untouched). Add a third "Default" option as the initial/unset state, and
change the fallback to `provider: draftProviderByType[type.id] || undefined`
so an untouched card sends no provider field, letting the central setting
apply. This affects both draft-generation call sites in that file (the two
`requestGenerate(...)` calls around lines 824 and 854) — both already route
through `generateDraftFromPaNotes` (appeal) or `paGenerateDraft` (planning
application) per `planning-drafts.js`'s dispatcher, both of which are in the
"configurable" set above, so no additional backend routing changes needed
here beyond what's in section "Wire the 3 configurable processes."

---

## Explicitly out of scope for this pass

- Converting any of the `claude_only` processes to use `callLLM` — that's
  the ~20-file follow-up work, tackle in a separate later plan/session,
  probably in batches grouped by area (e.g. appeal-service cluster,
  planning-statement-service cluster, then the rest one at a time).
- Fixing `appeal_draft_legacy` / `appeal_section_generate` specifically is
  the deepest item in that follow-up — those routes have **zero** provider
  plumbing today (not even reading `req.body.provider`), and one branch of
  `generateAppealDraft` calls the raw Anthropic SDK directly with no
  abstraction at all.
- Any caching invalidation UI (the 30s in-memory cache on `resolveProvider`
  means a central-setting change can take up to 30s to take effect on a
  busy server; acceptable for this use case, not worth building a
  cache-bust mechanism for).

---

## Verification (for whichever session implements this)

1. Run the new migration, confirm `admin_console.llm_process_settings` exists.
2. Hit `GET /api/admin-console/llm-settings` as an admin user, confirm it
   returns all ~29 registry entries with default `provider: 'anthropic'` for
   ones with no DB row yet.
3. On the new admin page, toggle "Quote Extraction" to OpenAI, confirm
   `PUT` succeeds and the row persists across a page refresh.
4. In `AddQuoteModal.svelte`, upload a quote **without** touching the local
   provider toggle (leave it on "Default") — confirm (via backend logs or a
   temporary console.log of `resolved` in `resolveProvider`) that it resolves
   to `'openai'`, matching the central setting just set in step 3.
5. In the same modal, explicitly pick "Claude" on the local toggle, upload
   another quote — confirm it uses Claude despite the central setting being
   OpenAI (session override wins).
6. Refresh the page, reopen the modal — confirm the local toggle is back to
   "Default" (not persisted) and a new upload again resolves to OpenAI (falls
   back to central setting).
7. Repeat steps 4-6 conceptually for the appeal-draft-from-PA-notes and
   planning-statement flows in `PlanningWorkspace.svelte`.
8. Confirm `claude_only` and `background` rows render with disabled controls
   and a clear "not yet configurable" indicator, and that `PUT`-ing one of
   their keys is either rejected by the controller or simply has no effect
   on the (unconverted) code path — decide which and document it.
