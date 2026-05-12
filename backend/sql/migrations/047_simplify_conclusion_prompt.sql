UPDATE planning_applications.draft_sections
SET generation_prompt = $prompt$
Write the Conclusion section for this Planning Statement.

Project: {{PROJECT_NAME}}
LPA: {{LPA_NAME}}
Site: {{SITE_ADDRESS}}
Development: {{DEVELOPMENT_DESCRIPTION}}

Completed Planning Statement:
{{FULL_STATEMENT}}

Write a single concise page that summarises the planning statement. Cover:
- The nature of the proposal and the applicant
- The main planning policy position
- The key planning benefits
- How any constraints or issues are addressed or outweighed
- A clear concluding statement that permission should be granted

One page only. Do not introduce information not already in the statement. Do not repeat the assessment in detail — draw it together into a short, confident summary.

Output clean HTML. Use <h2>Conclusion</h2> as the heading, then <p> paragraphs only. No headings below h2, no lists, no other tags.
$prompt$
WHERE slug = 'conclusion'
  AND draft_type_id = (SELECT id FROM planning_applications.draft_types WHERE slug = 'planning_statement');
