-- Add Planning Statement v3: a hybrid of v1 and v2.
-- Most of the document is written by one broad prompt, same as v2 — but the
-- Planning Policy and Planning Assessment sections are carved out into their
-- own dedicated prompts (stored as appeal_draft_sections rows below) and
-- spliced back into the main output at the [[POLICY_SECTION]] /
-- [[PLANNING_ASSESSMENT_SECTION]] markers. See generateDraftFromPaNotes in
-- appeal.controller.js for the splice logic.
-- This is a parallel test version; v1 and v2 are unchanged.

INSERT INTO appeals.appeal_draft_types (name, slug, description, sort_order, generation_prompt)
VALUES (
  'Planning Statement v3',
  'planning_statement_v3',
  'Hybrid: one broad prompt for most sections, with dedicated separate prompts for Planning Policy and Planning Assessment.',
  91,
  $prompt$You are a specialist planning consultant preparing a {{DOCUMENT_TYPE}}.

Read the guiding brief below carefully — it tells you exactly what this document is, what it must achieve, and how it should be structured:

{{GUIDING_BRIEF}}

## Site Details
Address: {{SITE_ADDRESS}}
Local Planning Authority: {{LPA_NAME}}
Proposed Development: {{DEVELOPMENT_DESCRIPTION}}

## Local Policy Context
The following local policies have been identified as relevant to this proposal. Reference specific policies by number and name throughout the document where applicable.

{{LOCAL_POLICIES}}

## National Policy Context
{{NATIONAL_POLICIES}}

## Planning History
{{PLANNING_HISTORY}}

## Briefing Notes
The following has been prepared by the project team and contains key project information, context, and strategy.

{{BRIEFING_NOTES}}

---

Write the {{DOCUMENT_TYPE}} following the structure set out in the guiding brief above, with two exceptions:

- Do not write a Planning Policy section. In its place, output the exact text [[POLICY_SECTION]] alone on its own line.
- Do not write a Planning Assessment section. In its place, output the exact text [[PLANNING_ASSESSMENT_SECTION]] alone on its own line.

Both of those sections are written separately and spliced in afterwards — write every other section from the guiding brief's structure in full, exactly as you normally would.

Important:
- Follow the structure described in the guiding brief precisely, other than the two omissions above.
- The marker text must appear exactly as given, alone on its own line, with no heading or other content around it.
- Reference specific policies from the policy context provided — use the exact policy reference numbers and names. Do not cite policies not in the list provided.
- Extract specific detail from the briefing notes — site characteristics, proposal details, technical information, and the planning case.
- Do not invent facts. Every statement must be grounded in the material provided.
- Write in formal planning language appropriate for submission to a local planning authority.
- This document is client-facing: do not reference the briefing notes or internal documents in your output — present all content as established fact.
- Do not number paragraphs (no 1.1, 2.3 etc.).

Output format — clean HTML only:
- <h2> for main section headings
- <h3> for sub-section headings
- <p> for body paragraphs
- <ul>/<li> for bullet points
- <table>/<thead>/<tbody>/<tr>/<th>/<td> for tables
- Do not include a document title — start directly with the first section heading
- No markdown characters (**, *, #, ---) and no em dashes (—)$prompt$
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO appeals.appeal_draft_sections (draft_type_id, name, slug, description, sort_order, generation_prompt)
SELECT id, 'Planning Policy', 'planning_policy', 'Statutory development plan and national policy framework relevant to the proposal.', 1,
$section1$Write the Planning Policy section of a {{DOCUMENT_TYPE}}.

## Site Details
Address: {{SITE_ADDRESS}}
Local Planning Authority: {{LPA_NAME}}
Proposed Development: {{DEVELOPMENT_DESCRIPTION}}

## Local Policy Context
{{LOCAL_POLICIES}}

## National Policy Context
{{NATIONAL_POLICIES}}

## Briefing Notes
{{BRIEFING_NOTES}}

---

Set out the statutory development plan and the national policy framework relevant to this proposal, and explain how each policy applies to the site and the development described above. Reference specific policies by their exact number and name from the lists above — do not cite policies not provided.

Important:
- Do not invent policies, references, or wording not supplied above.
- Write in formal planning language appropriate for submission to a local planning authority.
- Write only this section — do not write an introduction, conclusion, or any other part of the document.
- Do not number paragraphs (no 1.1, 2.3 etc.).

Output format — clean HTML only:
- <h2>Planning Policy</h2> as the section heading
- <h3> for sub-headings if useful
- <p> for body paragraphs
- <ul>/<li> for bullet points where useful
- No markdown characters (**, *, #, ---) and no em dashes (—)$section1$
FROM appeals.appeal_draft_types WHERE slug = 'planning_statement_v3'
ON CONFLICT (draft_type_id, slug) DO NOTHING;

INSERT INTO appeals.appeal_draft_sections (draft_type_id, name, slug, description, sort_order, generation_prompt)
SELECT id, 'Planning Assessment', 'planning_assessment', 'Issue-by-issue assessment of the proposal against the policy framework.', 2,
$section2$Write the Planning Assessment section of a {{DOCUMENT_TYPE}}.

## Site Details
Address: {{SITE_ADDRESS}}
Local Planning Authority: {{LPA_NAME}}
Proposed Development: {{DEVELOPMENT_DESCRIPTION}}

## Local Policy Context
{{LOCAL_POLICIES}}

## National Policy Context
{{NATIONAL_POLICIES}}

## Planning History
{{PLANNING_HISTORY}}

## Briefing Notes
{{BRIEFING_NOTES}}

---

Assess the proposal against the policies set out above, issue by issue (for example: principle of development, design and layout, residential amenity, highways and access, landscape and ecology, drainage, heritage — include only the issues relevant to this proposal, drawn from the briefing notes). For each issue, weigh the proposal against the relevant policy tests and reach a clear planning judgement.

Important:
- Reference specific policies by their exact number and name — do not cite policies not provided.
- Do not invent facts, effects, or mitigation not grounded in the briefing notes.
- Write in formal planning language appropriate for submission to a local planning authority.
- Write only this section — do not write an introduction, conclusion, or any other part of the document.
- Do not number paragraphs (no 1.1, 2.3 etc.).

Output format — clean HTML only:
- <h2>Planning Assessment</h2> as the section heading
- <h3> for each issue considered
- <p> for body paragraphs
- <ul>/<li> for bullet points where useful
- No markdown characters (**, *, #, ---) and no em dashes (—)$section2$
FROM appeals.appeal_draft_types WHERE slug = 'planning_statement_v3'
ON CONFLICT (draft_type_id, slug) DO NOTHING;
