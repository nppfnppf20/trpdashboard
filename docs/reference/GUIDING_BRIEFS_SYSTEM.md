# Guiding Briefs System

## What it is

`admin_console.guiding_briefs` is a table of reusable, admin-editable instruction blocks — one row per `(document_type, development_type)` pair, plus optional `development_type IS NULL` rows that act as a fallback for any dev type. Each row has:

- `guidance_content` — the actual instructions substituted into a prompt's `{{GUIDING_BRIEF}}` token. Tells the model what the document is, what it must achieve, and how it should be structured.
- `review_checklist`, `meeting_prompt`, `style_example` — supporting fields used by some tools (draft-check, meeting-note extraction, style calibration).

Lookup is `getGuidingBrief(document_type, development_type)` in `backend/src/controllers/guidingBriefs.controller.js`:

```sql
SELECT ... FROM admin_console.guiding_briefs
WHERE document_type = $1
  AND (development_type = $2 OR development_type IS NULL)
ORDER BY (development_type = $2) DESC NULLS LAST
LIMIT 1
```

A dev-type-specific row wins if one exists; otherwise the generic row for that `document_type` is used.

`document_type` is a free-text key, not a foreign key — it's matched against a doc type's `slug` (or an alias, see below) by convention, not enforced by the schema. Managed through the admin console's Guiding Briefs screen, not through migrations.

## Why some doc types stopped using it

Every "classic" doc type in the Planning Application / Appeal workspace injects `{{GUIDING_BRIEF}}` into its prompt and lets an admin fully control structure/content rules from the admin console. The v3 generation of Planning Statement, Stage 1 Review and HLPV moved away from this: their prompts are hand-authored and self-contained (structure, rules and style example written directly into the prompt text, committed via migration), on the stated basis that admin-console-editable guiding briefs weren't a good fit for how tightly controlled those v3 prompts needed to be. See migration `135` (Planning Statement v3), `132`/`133` (its Policy/Assessment splices), and `137` (Stage 1 Review v3) for the explicit reasoning.

## Which doc types use it

### Actively driven by a guiding brief

The `{{GUIDING_BRIEF}}` token is present in the prompt and a `guidance_content` row genuinely shapes the output.

| Doc type | Slug | Notes |
|---|---|---|
| Planning Statement (v1) | `planning_statement` | Template + per-section generation, guiding brief fetched per section |
| Planning Statement v2 | `planning_statement_v2` | Single-prompt experiment, still guiding-brief-driven |
| Stage 1 Review (v1) | `stage1_review` | |
| Stage 1 Review v2 | `stage1_review_v2` | `{{STYLE_GUIDE}}` also added (migration 104) |
| Statement of Case | `statement_of_case` | |
| Statement of Common Ground | `statement_of_common_ground` | |
| HLPV Narrative (old, pre-v3) | `hlpv_narrative` | Aliased to document_type `'hlpv'` via `GUIDING_BRIEF_SLUG_ALIAS` in `appeal.controller.js` |
| Socio-economic Baseline Assessment | `socio_economic_baseline` | |
| Pre-application Request | `pre_application_request` | Structure is *entirely* defined by the guiding brief — the prompt itself has no hardcoded section list, just "follow the structure set out in the guiding brief above" |

### Explicitly opted out — self-contained, never fetched

| Doc type | Slug | How it's excluded |
|---|---|---|
| Planning Statement v3 | `planning_statement_v3` | `appeal.controller.js`: `draftType.slug === V3_SLUG ? null : getGuidingBrief(...)` — for both the top-level prompt and its Planning Policy / Planning Assessment splices |
| HLPV v3 | `hlpv_v3` | Has its own controller (`hlpvV3.controller.js`) with no `getGuidingBrief` call anywhere in it |

### Fetched, but dead code

| Doc type | Slug | What actually happens |
|---|---|---|
| Stage 1 Review v3 | `stage1_review_v3` | `stage1Review.controller.js` still calls `getGuidingBrief(promptKey, ...)` because that function is shared across the v1/v2/v3 `promptKey`s. But migration `137`'s prompt text has zero `{{GUIDING_BRIEF}}` occurrences, so the fetched brief is substituted nowhere — a wasted DB query with no effect on output. Not a real dependency; safe to ignore, worth cleaning up eventually. |

## Used elsewhere in the app (outside the PA/Appeal workspace)

`getGuidingBrief` is also called for tools unrelated to the doc types above:

| Feature | document_type key | File |
|---|---|---|
| Surveyor Briefing quote requests | `surveyor_briefing` | `quoteRequests.controller.js` |
| Meeting-notes AI action-item extraction | `meeting_notes` | `meeting.service.js` |
| Consultation response drafting | `consultation_response` | `consultation.service.js` |
| Marketing content generation | (marketing draft type's own slug) | `marketing.controller.js` |
| Draft Check tool | (the document type being checked) | `draftCheck.controller.js` |
