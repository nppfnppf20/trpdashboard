-- Add a 'supplementary' (Supplementary Guidance) section to policy_documents,
-- with summary and relevance-to-project text fields used only by that section.

BEGIN;

ALTER TABLE policy_documents DROP CONSTRAINT IF EXISTS policy_documents_section_check;
ALTER TABLE policy_documents ADD CONSTRAINT policy_documents_section_check
  CHECK (section IN ('adopted', 'emerging', 'other', 'supplementary'));

ALTER TABLE policy_documents ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE policy_documents ADD COLUMN IF NOT EXISTS relevance TEXT;

COMMIT;
