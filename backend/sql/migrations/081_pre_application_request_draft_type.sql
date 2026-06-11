-- Add Pre-application Request as a draft type in the PA Workspace.
-- Uses the same single-prompt {{VARIABLE}} machinery as other appeal_draft_types.
-- Injects site details, policies, planning history, and briefing notes from the DB.

INSERT INTO appeals.appeal_draft_types (name, slug, description, sort_order, generation_prompt)
VALUES (
  'Pre-application Request',
  'pre_application_request',
  'Formal letter to the LPA requesting pre-application advice on a proposed development.',
  30,
  $prompt$You are a specialist planning consultant preparing a {{DOCUMENT_TYPE}}.

Read the guiding brief below carefully — it tells you exactly what this document is, what it must achieve, and how it should be structured:

{{GUIDING_BRIEF}}

## Site Details
Address: {{SITE_ADDRESS}}
Local Planning Authority: {{LPA_NAME}}
Proposed Development: {{DEVELOPMENT_DESCRIPTION}}

## Planning Policy Context

### Local Policies
{{LOCAL_POLICIES}}

### National Policies
{{NATIONAL_POLICIES}}

## Planning History
{{PLANNING_HISTORY}}

## Briefing Notes
The following has been prepared by the project team and contains key project information, context, and the matters on which pre-application advice is sought.

{{BRIEFING_NOTES}}

---

Write a complete {{DOCUMENT_TYPE}} following the structure set out in the guiding brief above.

Important:
- Follow the structure described in the guiding brief precisely.
- Extract specific detail from the briefing notes — site description, proposal details, key planning issues, and the specific matters on which pre-application advice is sought.
- Reference relevant policies from the policy context provided where they are material to the issues being raised. Do not cite policies not in the list provided.
- Do not invent facts. Every statement must be grounded in the material provided.
- Write in formal planning language appropriate for submission to a local planning authority.
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
