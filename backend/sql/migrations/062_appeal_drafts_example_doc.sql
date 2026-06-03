-- Add example document fields to appeal_drafts
-- Stores a per-project per-draft-type example document (tone + structure reference)
-- uploaded by the user, parsed to plain text, injected into generation prompts

ALTER TABLE appeals.appeal_drafts
  ADD COLUMN IF NOT EXISTS example_doc_text     TEXT,
  ADD COLUMN IF NOT EXISTS example_doc_filename  TEXT;
