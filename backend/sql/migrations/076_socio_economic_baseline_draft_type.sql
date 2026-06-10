-- Add Socio-economic Baseline Assessment as a draft type in the PA Workspace.

INSERT INTO appeals.appeal_draft_types (name, slug, description, sort_order, generation_prompt)
VALUES (
  'Socio-economic Baseline Assessment',
  'socio_economic_baseline',
  'Baseline assessment of the socio-economic conditions relevant to the proposed development.',
  20,
  $prompt$You are a specialist planning consultant writing a Socio-economic Baseline Assessment.

## Guiding Brief
The following is practice guidance from this consultancy explaining how we want this document written — the approach, structure, tone, and professional judgement to apply. Use it as your primary instruction for how to interpret and present the data below.

{{GUIDING_BRIEF}}

## Socio-economic Data
The following contains socio-economic statistics for the local authority, region, and national level, exported from the socio-economics analysis tool.

{{SOCIO_DATA}}

## Briefing Notes
{{BRIEFING_NOTES}}

Write a complete Socio-economic Baseline Assessment covering the relevant socio-economic conditions for the proposed development.

Output as an HTML fragment:
- <h2> for main section headings
- <h3> for sub-section headings where needed
- <p> tags for body paragraphs
- <ul>/<li> for bullet points where appropriate
- No <html>, <head>, <body>, <style>, or <script> tags — start directly with the first <h2>
- No markdown characters (**, *, #, ---) and no em dashes (—)

Do not reference the source documents in the output — this is a client-facing document.$prompt$
)
ON CONFLICT (slug) DO NOTHING;
