-- Stage 1 Planning Appraisal v2: independent copy for prompt experimentation.
-- The generation controller uses draft_type_slug to pick the right prompt key.

INSERT INTO planning_applications.draft_types (name, slug, description, sort_order)
VALUES ('Stage 1 Planning Appraisal v2', 'stage1_review_v2', 'Working copy of Stage 1 appraisal for independent prompt editing', 101)
ON CONFLICT (slug) DO NOTHING;

-- Seed generation prompt from v1
INSERT INTO admin_console.llm_prompts (prompt_key, prompt_text)
SELECT 'stage1_review_v2', prompt_text FROM admin_console.llm_prompts WHERE prompt_key = 'stage1_review'
ON CONFLICT (prompt_key) DO NOTHING;

-- Copy all guiding briefs from stage1_review to stage1_review_v2
INSERT INTO admin_console.guiding_briefs
  (name, document_type, development_type, guidance_content, review_checklist, meeting_prompt, style_example, sort_order)
SELECT
  name, 'stage1_review_v2', development_type, guidance_content, review_checklist, meeting_prompt, style_example, sort_order
FROM admin_console.guiding_briefs
WHERE document_type = 'stage1_review'
ON CONFLICT DO NOTHING;
