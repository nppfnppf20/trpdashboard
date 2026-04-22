CREATE SCHEMA IF NOT EXISTS appeals;

-- Document type definitions (global, one row per type)
CREATE TABLE IF NOT EXISTS appeals.appeal_draft_types (
  id                  SERIAL PRIMARY KEY,
  name                TEXT NOT NULL,
  slug                TEXT NOT NULL UNIQUE,
  description         TEXT,
  generation_prompt   TEXT,
  example_document    TEXT,
  sort_order          INT NOT NULL DEFAULT 0
);

-- Per-project generated drafts
CREATE TABLE IF NOT EXISTS appeals.appeal_drafts (
  id              SERIAL PRIMARY KEY,
  project_id      INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  draft_type_id   INTEGER NOT NULL REFERENCES appeals.appeal_draft_types(id) ON DELETE CASCADE,
  content_html    TEXT,
  generated_at    TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, draft_type_id)
);

-- Seed initial document types
INSERT INTO appeals.appeal_draft_types (name, slug, description, sort_order)
VALUES
  ('Statement of Case', 'statement_of_case', 'Sets out the appellant''s case on the main issues in the appeal.', 1),
  ('Statement of Common Ground', 'statement_of_common_ground', 'Records matters agreed between appellant and LPA.', 2)
ON CONFLICT (slug) DO NOTHING;
