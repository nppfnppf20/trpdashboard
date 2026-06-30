-- Marketing drafts are not project-specific — one draft per type globally

ALTER TABLE marketing.drafts DROP CONSTRAINT IF EXISTS marketing_drafts_project_id_draft_type_id_key;
ALTER TABLE marketing.drafts DROP CONSTRAINT IF EXISTS marketing_drafts_project_id_fkey;
ALTER TABLE marketing.drafts DROP COLUMN IF EXISTS project_id;
DROP INDEX IF EXISTS idx_marketing_drafts_project;

ALTER TABLE marketing.drafts ADD CONSTRAINT marketing_drafts_draft_type_id_key UNIQUE (draft_type_id);
