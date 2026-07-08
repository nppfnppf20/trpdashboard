-- Starting documents table for Stage 1 Review generation.
-- Stores user-uploaded/pasted source documents (e.g. High Level Planning Review)
-- injected as {{VARIABLE}} placeholders into the stage1_review prompt.
-- No draft_type_id needed — there is only one stage1_review type per project.

CREATE TABLE IF NOT EXISTS planning_applications.stage1_starting_docs (
  id           SERIAL PRIMARY KEY,
  project_id   INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  slot_slug    TEXT NOT NULL,
  content_text TEXT NOT NULL DEFAULT '',
  file_name    TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, slot_slug)
);

CREATE INDEX IF NOT EXISTS stage1_starting_docs_project
  ON planning_applications.stage1_starting_docs (project_id);
