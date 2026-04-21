CREATE TABLE IF NOT EXISTS public.appeal_issue_notes (
  id          SERIAL PRIMARY KEY,
  project_id  INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  track_id    INTEGER NOT NULL REFERENCES admin_console.project_issue_tracks(id) ON DELETE CASCADE,
  notes       TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, track_id)
);
