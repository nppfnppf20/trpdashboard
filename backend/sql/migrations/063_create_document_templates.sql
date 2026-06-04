-- Global example document templates per document type
-- Replaces per-project example_doc_text/example_doc_filename on appeal_drafts
-- Keyed by document_type slug (matches appeals.appeal_draft_types.slug)

CREATE TABLE IF NOT EXISTS admin_console.document_templates (
  id             SERIAL PRIMARY KEY,
  document_type  TEXT NOT NULL UNIQUE,
  name           TEXT,
  doc_text       TEXT,
  filename       TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
