-- Persist socio-economics analysis results per project as CSV text.

CREATE TABLE IF NOT EXISTS public.socioeconomics_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  INTEGER REFERENCES public.projects(id) ON DELETE CASCADE,
  session_name TEXT,
  csv_data    TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS socioeconomics_sessions_project_idx
  ON public.socioeconomics_sessions(project_id);
