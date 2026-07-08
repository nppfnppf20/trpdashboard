-- Re-sync stage1_review_v2 prompt from stage1_review.
-- Overwrites whatever was seeded by migration 102 (which may have run before 101
-- updated the stage1_review prompt with {{HIGH_LEVEL_PLANNING_REVIEW}} etc.).

INSERT INTO admin_console.llm_prompts (prompt_key, prompt_text)
SELECT 'stage1_review_v2', prompt_text
FROM admin_console.llm_prompts
WHERE prompt_key = 'stage1_review'
ON CONFLICT (prompt_key) DO UPDATE SET prompt_text = EXCLUDED.prompt_text;
