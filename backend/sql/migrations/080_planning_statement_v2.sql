-- Add Planning Statement v2 as an appeal-type draft.
-- Uses the same single-prompt {{VARIABLE}} machinery as SOC/SOCG/HLPV/Socio-econ
-- but injects local policies, national policies, and planning history from the DB.
-- This is a parallel test version; the original planning_statement draft type is unchanged.

INSERT INTO appeals.appeal_draft_types (name, slug, description, sort_order, generation_prompt)
VALUES (
  'Planning Statement v2',
  'planning_statement_v2',
  'Single-prompt planning statement generated from guiding brief, policy context, planning history, and briefing notes.',
  90,
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

Write a complete {{DOCUMENT_TYPE}} following the structure set out in the guiding brief above.

Important:
- Follow the structure described in the guiding brief precisely.
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
