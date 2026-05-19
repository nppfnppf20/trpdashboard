-- Meeting Notes: transcripts, AI summaries, and extracted/manual actions

CREATE TABLE IF NOT EXISTS planning_applications.meeting_transcripts (
  id              SERIAL PRIMARY KEY,
  project_id      INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  meeting_date    DATE,
  attendees_text  TEXT,
  file_name       TEXT,
  transcript_text TEXT NOT NULL,
  user_notes      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_transcripts_project
  ON planning_applications.meeting_transcripts(project_id);

CREATE TABLE IF NOT EXISTS planning_applications.meeting_summaries (
  id             SERIAL PRIMARY KEY,
  transcript_id  INTEGER NOT NULL REFERENCES planning_applications.meeting_transcripts(id) ON DELETE CASCADE,
  project_id     INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  summary_html   TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_summaries_project
  ON planning_applications.meeting_summaries(project_id);

CREATE TABLE IF NOT EXISTS planning_applications.meeting_actions (
  id             SERIAL PRIMARY KEY,
  transcript_id  INTEGER REFERENCES planning_applications.meeting_transcripts(id) ON DELETE CASCADE,
  project_id     INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  action_text    TEXT NOT NULL,
  owner          TEXT,
  due_date       DATE,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'complete')),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_meeting_actions_project
  ON planning_applications.meeting_actions(project_id);
CREATE INDEX IF NOT EXISTS idx_meeting_actions_status
  ON planning_applications.meeting_actions(project_id, status);
