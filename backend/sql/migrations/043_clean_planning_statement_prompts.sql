-- Strip the repeated opening sentence from planning statement section prompts.
-- The "You are a senior planning consultant..." context belongs in the system
-- message (set in generatePlanningStatementSection), not in the stored prompt.
-- This leaves each section prompt starting with the section-specific task.

UPDATE planning_applications.draft_sections
SET generation_prompt = trim(
  both E'\n' from
  replace(
    generation_prompt,
    E'You are a senior planning consultant writing a formal Planning Statement for submission to a local planning authority.\n\n',
    ''
  )
)
WHERE draft_type_id = (SELECT id FROM planning_applications.draft_types WHERE slug = 'planning_statement')
  AND generation_prompt LIKE 'You are a senior planning consultant writing a formal Planning Statement%';
