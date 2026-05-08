-- Document summaries: AI-generated summaries of project documents
CREATE TABLE IF NOT EXISTS planning_applications.document_summaries (
  id          SERIAL PRIMARY KEY,
  project_id  INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  document_ref TEXT,
  file_name   TEXT,
  doc_type    TEXT,
  summary_html TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_summaries_project
  ON planning_applications.document_summaries(project_id);

-- Global per-doc-type prompt templates
CREATE TABLE IF NOT EXISTS planning_applications.doc_type_prompts (
  doc_type         TEXT PRIMARY KEY,
  prompt_template  TEXT NOT NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
