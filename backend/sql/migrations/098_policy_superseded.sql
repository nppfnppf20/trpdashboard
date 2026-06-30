-- Add superseded flag to both policy tables
ALTER TABLE admin_console.policy_documents
  ADD COLUMN IF NOT EXISTS superseded boolean NOT NULL DEFAULT false;

ALTER TABLE admin_console.extracted_insights
  ADD COLUMN IF NOT EXISTS superseded boolean NOT NULL DEFAULT false;
