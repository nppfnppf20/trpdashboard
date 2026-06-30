-- Actions Tracker: persistent action threads with a timeline of updates per project

CREATE TABLE IF NOT EXISTS planning_applications.tracker_actions (
  id                   SERIAL PRIMARY KEY,
  project_id           INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title                TEXT NOT NULL,
  owner                TEXT,
  status               TEXT NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'blocked', 'complete')),
  confirmed            BOOLEAN NOT NULL DEFAULT false,
  source_transcript_id INTEGER REFERENCES planning_applications.meeting_transcripts(id) ON DELETE SET NULL,
  order_index          INTEGER NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS planning_applications.action_updates (
  id                SERIAL PRIMARY KEY,
  action_id         INTEGER NOT NULL REFERENCES planning_applications.tracker_actions(id) ON DELETE CASCADE,
  update_date       DATE NOT NULL,
  summary           TEXT NOT NULL,
  full_text         TEXT,
  source_type       TEXT NOT NULL DEFAULT 'manual'
                      CHECK (source_type IN ('meeting', 'email', 'manual')),
  source_meeting_id INTEGER REFERENCES planning_applications.meeting_transcripts(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracker_actions_project
  ON planning_applications.tracker_actions(project_id, confirmed);

CREATE INDEX IF NOT EXISTS idx_action_updates_action
  ON planning_applications.action_updates(action_id);
