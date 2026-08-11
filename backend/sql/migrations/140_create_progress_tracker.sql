-- Issues Tracker: pre-decision counterpart to the Conditions Tracker.
-- Same shape (issue -> sub-issues -> dated action timeline), plus a project-wide
-- stage tag on each action, reusing the stage list already backing the Stages
-- Board (admin_console.project_stage_instances) rather than a new stage table.

CREATE TABLE IF NOT EXISTS planning_applications.progress_issues (
  id           SERIAL PRIMARY KEY,
  project_id   INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  discipline   TEXT,
  title        TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'In Progress',
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_progress_issues_project
  ON planning_applications.progress_issues(project_id);

CREATE TABLE IF NOT EXISTS planning_applications.progress_sub_issues (
  id              SERIAL PRIMARY KEY,
  issue_id        INTEGER NOT NULL REFERENCES planning_applications.progress_issues(id) ON DELETE CASCADE,
  sub_issue_text  TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'In Progress',
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_progress_sub_issues_issue
  ON planning_applications.progress_sub_issues(issue_id);

-- source_type: 'note' | 'email' | 'meeting' (the last written only by the
-- Draft from Meeting Notes flow, which also stamps meeting_transcript_id).
CREATE TABLE IF NOT EXISTS planning_applications.progress_actions (
  id                     SERIAL PRIMARY KEY,
  issue_id               INTEGER NOT NULL REFERENCES planning_applications.progress_issues(id) ON DELETE CASCADE,
  action_date            DATE NOT NULL,
  summary                TEXT NOT NULL,
  full_text              TEXT,
  source_type            TEXT NOT NULL DEFAULT 'note',
  stage_instance_id      INTEGER REFERENCES admin_console.project_stage_instances(id) ON DELETE SET NULL,
  meeting_transcript_id  INTEGER REFERENCES planning_applications.meeting_transcripts(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_progress_actions_issue
  ON planning_applications.progress_actions(issue_id);
CREATE INDEX IF NOT EXISTS idx_progress_actions_stage
  ON planning_applications.progress_actions(stage_instance_id);

CREATE TABLE IF NOT EXISTS planning_applications.progress_action_sub_issues (
  action_id     INTEGER NOT NULL REFERENCES planning_applications.progress_actions(id) ON DELETE CASCADE,
  sub_issue_id  INTEGER NOT NULL REFERENCES planning_applications.progress_sub_issues(id) ON DELETE CASCADE,
  PRIMARY KEY (action_id, sub_issue_id)
);

CREATE TABLE IF NOT EXISTS planning_applications.progress_tracker_meta (
  id                       SERIAL PRIMARY KEY,
  project_id               INTEGER UNIQUE NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  last_exported_at         TIMESTAMPTZ,
  last_issued_to_client_at TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE planning_applications.progress_issues IS 'Issues Tracker: pre-decision issue rows, grouped by discipline — counterpart to planning_applications.conditions';
COMMENT ON TABLE planning_applications.progress_actions IS 'Dated action timeline per issue; stage_instance_id tags which project stage the action happened under (shared list from admin_console.project_stage_instances, same one the Stages Board uses)';
COMMENT ON COLUMN planning_applications.progress_actions.meeting_transcript_id IS 'Set when this action was materialized by the Draft from Meeting Notes flow, for traceability and to avoid re-drafting the same note into the same issue twice';
