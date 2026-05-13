-- Set template_html for the Background section of the Planning Statement.
-- Replaces the generation prompt with a simple template that inserts the
-- pre-app, EIA, and SCI document summaries directly under their headings.

UPDATE planning_applications.draft_sections
SET template_html = $tpl$<h2>Background to the Proposals</h2>

<h3>Pre-Application Discussions</h3>
{{PRE_APP_SUMMARY}}

<h3>Environmental Impact Assessment</h3>
{{EIA_SUMMARY}}

<h3>Statement of Community Involvement</h3>
{{SCI_SUMMARY}}$tpl$
WHERE slug = 'background'
  AND draft_type_id = (
    SELECT id FROM planning_applications.draft_types WHERE slug = 'planning_statement'
  );
