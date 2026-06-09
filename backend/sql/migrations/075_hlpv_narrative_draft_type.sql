-- Add HLPV Narrative as a draft type in the PA Workspace.
-- Uses the appeals draft type machinery (starter docs, generation prompt, guiding brief).
-- Starter doc slots: hlpv_data (auto-saved from HLPV tool) + additional_designations (user upload).

INSERT INTO appeals.appeal_draft_types (name, slug, description, sort_order, generation_prompt)
VALUES (
  'High-Level Planning Review',
  'hlpv_narrative',
  'HLPV narrative assessment generated from HLPV tool data and consultant site notes.',
  10,
  $prompt$You are a specialist planning consultant writing a High-Level Planning View (HLPV) narrative assessment.

## Guiding Brief
The following is practice guidance from this consultancy explaining how we want this document written — the approach, structure, tone, and professional judgement to apply. Use it as your primary instruction for how to interpret and present the data below. However, only apply guidance that is relevant to the data you have actually been given. If the guiding brief references a constraint type, approach, or consideration for which you have no supporting data in the HLPV tool output or site notes, omit it entirely. Never introduce a fact, designation, distance, or constraint that is not explicitly present in the data provided below.

{{GUIDING_BRIEF}}

## HLPV Tool Data
The following contains planning constraints identified by the HLPV assessment — discipline risk levels, triggered policy rules, and specific designation names and distances.

{{HLPV_DATA}}

## Additional Designations and Site Notes
The following has been provided by the consultant and may include further designations, allocations, and narrative notes about the site and how it is being assessed. Use the consultant's own framing and emphasis as a precedent for tone and priorities.

{{ADDITIONAL_DESIGNATIONS}}

Write a complete HLPV narrative covering every discipline and designation identified above.
For each discipline: 2–3 professional paragraphs.

Output as an HTML fragment:
- <h2> for each discipline or topic heading
- <p><strong>Overall risk: [level]</strong></p> immediately after each discipline heading
- <p> tags for body paragraphs
- No <html>, <head>, <body>, <style>, or <script> tags — start directly with the first <h2>
- No markdown characters (**, *, #, ---) and no em dashes (—)

Do not reference the source documents in the output — this is a client-facing document.$prompt$
)
ON CONFLICT (slug) DO NOTHING;
