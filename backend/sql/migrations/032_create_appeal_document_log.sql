CREATE TABLE appeals.appeal_document_log (
  id            SERIAL PRIMARY KEY,
  project_id    INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  code          TEXT,
  document_summary TEXT,
  argument_points  JSONB NOT NULL DEFAULT '[]',
  logged_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON appeals.appeal_document_log(project_id, logged_at DESC);
