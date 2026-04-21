-- Migration: 024_create_appeal_tables.sql
-- Creates appeal_arguments (living argument document) and appeal_documents
-- (uploaded docs with AI review results) for the appeal drafting tool.

CREATE TABLE IF NOT EXISTS public.appeal_arguments (
  id             SERIAL PRIMARY KEY,
  project_id     INTEGER NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  argument_html  TEXT NOT NULL DEFAULT '',
  initial_notes  TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appeal_arguments_project_id
  ON public.appeal_arguments(project_id);

CREATE TABLE IF NOT EXISTS public.appeal_documents (
  id             SERIAL PRIMARY KEY,
  project_id     INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  filename       VARCHAR(500) NOT NULL,
  review_status  VARCHAR(50) NOT NULL DEFAULT 'pending',
  ai_review      JSONB,
  uploaded_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appeal_documents_project_id
  ON public.appeal_documents(project_id);
