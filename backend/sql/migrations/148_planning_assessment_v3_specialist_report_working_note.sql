-- Planning Assessment v3: an issue's Specialist Report field
-- (admin_console.drafting_issues.specialist_report, "Specialist report" in
-- the Drafting Issues UI) is a hand-typed, pre-draft placeholder -- the
-- consultant's own anticipated position on what a report is expected to
-- find, not a verified technical finding. It was previously surfaced in
-- {{ISSUES_CONTEXT}} under a plain "### Specialist Report" heading
-- (buildIssueSnippetContext in appeal.service.js), indistinguishable from
-- confirmed technical evidence, and the model would draft confident prose
-- from it -- including attributing it to a named report -- exactly as if it
-- were a verified finding. That's a hallucination risk: an unverified
-- working note dressed up as evidence in a document intended for submission.
--
-- appeal.service.js now labels that heading "### Specialist Report —
-- Working Note (anticipated position, not a verified technical report...)".
-- This migration teaches the Planning Assessment section prompt what to do
-- when it sees that heading: don't draft it as evidence, don't invent an
-- attribution, and don't reach a compliance conclusion from it -- render it
-- as a flagged placeholder instead, using the same bracket-marker
-- convention the master prompt already uses elsewhere (e.g.
-- [INFORMATION REQUIRED: ...], [INCONSISTENCY TO BE RESOLVED: ...]).
--
-- The real evidencing step -- grounding the assessment in the actual
-- specialist report once it exists -- is handled separately, after a draft
-- exists, by the draft editor's paragraph-incorporation panel
-- (incorporateSpecialistReportIntoIssue in appeal.service.js). This
-- placeholder instruction is what keeps the two from being conflated: an
-- anticipated note must never read, in the submitted document, as if it
-- were the verified outcome that only that later step is meant to produce.
--
-- Applied as a targeted REPLACE() immediately after the existing "Technical
-- Evidence" subsection, untouched by migrations 144/145.
--
-- Scoped to Planning Statement v3's Planning Assessment section only.

UPDATE appeals.appeal_draft_sections
SET generation_prompt = REPLACE(
  generation_prompt,
  $old1$Retain any qualification or uncertainty stated in the report.

## Compliance$old1$,
  $new1$Retain any qualification or uncertainty stated in the report.

## Specialist Report Working Notes

An issue's context above may include a heading marked "Specialist Report — Working Note". This is the project team's own anticipated position on what a specialist report is expected to find. It has not been obtained or verified. It is not technical evidence.

Do not draft this material as if it were a verified technical conclusion. Do not attribute it to a named report, author or date unless the note itself expressly states one. Do not use it to reach or support a policy compliance conclusion.

Instead, render it as a placeholder, immediately after the relevant policy or proposal discussion for that issue:

[SPECIALIST EVIDENCE AWAITED: <concise restatement of the working note>]

Where the sub-section's conclusion would otherwise depend on this anticipated material, state plainly that the conclusion is provisional pending the specialist report, rather than reaching a conclusion the report has not yet supported.

## Compliance$new1$
)
WHERE slug = 'planning_assessment'
  AND draft_type_id = (SELECT id FROM appeals.appeal_draft_types WHERE slug = 'planning_statement_v3');
