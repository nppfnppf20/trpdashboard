-- Add our_take to meeting-extracted insights
ALTER TABLE admin_console.extracted_insights
  ADD COLUMN IF NOT EXISTS our_take text;

-- Uploaded policy documents / industry updates
CREATE TABLE IF NOT EXISTS admin_console.policy_documents (
  id           serial PRIMARY KEY,
  title        text NOT NULL,
  source_name  text,
  policy_date  date,
  summary_html text,
  key_points   text,
  implications text,
  user_notes   text,
  our_take     text,
  raw_text     text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_policy_documents_created
  ON admin_console.policy_documents (created_at DESC);
