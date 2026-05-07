-- Seed the Planning Statement draft type and its Planning Assessment section

INSERT INTO planning_applications.draft_types (name, slug, description, sort_order)
VALUES (
  'Planning Statement',
  'planning_statement',
  'A formal planning statement setting out the policy case for the proposed development.',
  0
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO planning_applications.draft_sections (draft_type_id, name, slug, description, sort_order)
SELECT
  dt.id,
  'Planning Assessment',
  'planning_assessment',
  'Per-issue policy assessment explaining how the proposals comply with relevant planning policies.',
  0
FROM planning_applications.draft_types dt
WHERE dt.slug = 'planning_statement'
ON CONFLICT (draft_type_id, slug) DO NOTHING;
