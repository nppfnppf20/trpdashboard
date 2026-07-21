-- v3's main prompt wasn't reliably leaving the [[POLICY_SECTION]] /
-- [[PLANNING_ASSESSMENT_SECTION]] markers — the guiding brief (reused from v2)
-- tells the model those sections belong in the document, and the original
-- single "Important" bullet wasn't a strong enough override. Restate the
-- exception up front (before the model reads the brief), repeat it at the
-- point of writing, and add an explicit self-check instruction.

UPDATE appeals.appeal_draft_types
SET generation_prompt = $prompt$You are a specialist planning consultant preparing a {{DOCUMENT_TYPE}}.

CRITICAL EXCEPTION — read this before the guiding brief below: this document type normally includes a Planning Policy section and a Planning Assessment section. You must NOT write either of them yourself. Wherever the guiding brief's structure calls for a Planning Policy section, output the exact text [[POLICY_SECTION]] alone on its own line instead, with no heading and no other content. Wherever it calls for a Planning Assessment section, output the exact text [[PLANNING_ASSESSMENT_SECTION]] alone on its own line instead. Those two sections are generated separately by a different process and spliced into your output afterwards — do not pre-empt them. Write every other section from the guiding brief's structure in full, exactly as you normally would.

Read the guiding brief below carefully — it tells you exactly what this document is, what it must achieve, and how it should be structured. Its description of the Planning Policy and Planning Assessment sections does not apply to you: use the markers instead, as instructed above.

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

Write the {{DOCUMENT_TYPE}} now, following the structure set out in the guiding brief above, with two exceptions:

- Do not write a Planning Policy section, or any heading resembling "Planning Policy" or "Planning Policy Context", or any paragraphs setting out or assessing individual policies. Output the exact text [[POLICY_SECTION]] alone on its own line in its place.
- Do not write a Planning Assessment section, or any heading resembling "Planning Assessment", or any paragraphs weighing the proposal against policy. Output the exact text [[PLANNING_ASSESSMENT_SECTION]] alone on its own line in its place.
- Your finished output must contain both marker strings, each exactly once.

Important:
- Follow the structure described in the guiding brief precisely, other than the two omissions above.
- The marker text must appear exactly as given, alone on its own line, with no heading or other content around it.
- Reference specific policies from the policy context provided — use the exact policy reference numbers and names. Do not cite policies not in the list provided.
- Extract specific detail from the briefing notes — site characteristics, proposal details, technical information, and the planning case.
- Do not invent facts. Every statement must be grounded in the material provided.
- Write in formal planning language appropriate for submission to a local planning authority.
- This document is client-facing: do not reference the briefing notes or internal documents in your output — present all content as established fact.
- Do not number paragraphs (no 1.1, 2.3 etc.).
- Before you finish, check your own output for a "Planning Policy" or "Planning Assessment" heading, or for policy-by-policy assessment prose. If you find any, remove it and replace it with the correct marker — this rule overrides the guiding brief's structure.

Output format — clean HTML only:
- <h2> for main section headings
- <h3> for sub-section headings
- <p> for body paragraphs
- <ul>/<li> for bullet points
- <table>/<thead>/<tbody>/<tr>/<th>/<td> for tables
- Do not include a document title — start directly with the first section heading
- No markdown characters (**, *, #, ---) and no em dashes (—)$prompt$
WHERE slug = 'planning_statement_v3';
