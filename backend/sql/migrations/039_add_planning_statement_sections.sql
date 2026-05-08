-- Add all Planning Statement sections and reorder

-- Executive Summary (runs last — summarises the completed document)
INSERT INTO planning_applications.draft_sections (draft_type_id, name, slug, description, sort_order)
SELECT dt.id,
  'Executive Summary',
  'executive_summary',
  'High-level summary of the application and key conclusions. Generated after all other sections are complete.',
  0
FROM planning_applications.draft_types dt
WHERE dt.slug = 'planning_statement'
ON CONFLICT (draft_type_id, slug) DO NOTHING;

-- Introduction
INSERT INTO planning_applications.draft_sections (draft_type_id, name, slug, description, sort_order)
SELECT dt.id,
  'Introduction',
  'introduction',
  'Sets out the purpose of the document, the applicant, and the scope of documents submitted.',
  1
FROM planning_applications.draft_types dt
WHERE dt.slug = 'planning_statement'
ON CONFLICT (draft_type_id, slug) DO NOTHING;

-- Site, Surroundings and Planning History
INSERT INTO planning_applications.draft_sections (draft_type_id, name, slug, description, sort_order)
SELECT dt.id,
  'Site, Surroundings and Planning History',
  'site_surroundings',
  'Description of the site, its context and any relevant planning history.',
  2
FROM planning_applications.draft_types dt
WHERE dt.slug = 'planning_statement'
ON CONFLICT (draft_type_id, slug) DO NOTHING;

-- Proposed Development
INSERT INTO planning_applications.draft_sections (draft_type_id, name, slug, description, sort_order)
SELECT dt.id,
  'Proposed Development',
  'proposed_development',
  'Description of what is proposed and how it responds to the site context.',
  3
FROM planning_applications.draft_types dt
WHERE dt.slug = 'planning_statement'
ON CONFLICT (draft_type_id, slug) DO NOTHING;

-- Background
INSERT INTO planning_applications.draft_sections (draft_type_id, name, slug, description, sort_order)
SELECT dt.id,
  'Background',
  'background',
  'Pre-application engagement, EIA scoping, community involvement and other background context.',
  4
FROM planning_applications.draft_types dt
WHERE dt.slug = 'planning_statement'
ON CONFLICT (draft_type_id, slug) DO NOTHING;

-- Policy Context
INSERT INTO planning_applications.draft_sections (draft_type_id, name, slug, description, sort_order)
SELECT dt.id,
  'Policy Context',
  'policy_context',
  'Sets out the relevant national, local and other planning policies that apply to the proposals.',
  5
FROM planning_applications.draft_types dt
WHERE dt.slug = 'planning_statement'
ON CONFLICT (draft_type_id, slug) DO NOTHING;

-- Move Planning Assessment to sort_order 6
UPDATE planning_applications.draft_sections
SET sort_order = 6
WHERE slug = 'planning_assessment'
  AND draft_type_id = (
    SELECT id FROM planning_applications.draft_types WHERE slug = 'planning_statement'
  );

-- Conclusion (runs last — concludes the completed assessment)
INSERT INTO planning_applications.draft_sections (draft_type_id, name, slug, description, sort_order)
SELECT dt.id,
  'Conclusion',
  'conclusion',
  'Overall conclusion drawing together the policy case. Generated after all other sections are complete.',
  7
FROM planning_applications.draft_types dt
WHERE dt.slug = 'planning_statement'
ON CONFLICT (draft_type_id, slug) DO NOTHING;
