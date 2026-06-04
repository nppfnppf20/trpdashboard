-- Add Stage 1 Planning Appraisal as a draft type so its generated HTML
-- is stored in planning_applications.drafts alongside other document types.
INSERT INTO planning_applications.draft_types (name, slug, description, sort_order)
VALUES ('Stage 1 Planning Appraisal', 'stage1_review', 'Desk-based appraisal table generated from briefing note', 99)
ON CONFLICT (slug) DO NOTHING;
