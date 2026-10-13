-- History of progress on a meeting action: each row is something that
-- happened to it in a later meeting. update_type 'completed' rows are written
-- alongside setting meeting_actions.status = 'complete'; 'progress' rows are
-- notes on an action that is still open.

CREATE TABLE IF NOT EXISTS planning_applications.meeting_action_updates (
  id             SERIAL PRIMARY KEY,
  action_id      INTEGER NOT NULL REFERENCES planning_applications.meeting_actions(id) ON DELETE CASCADE,
  transcript_id  INTEGER REFERENCES planning_applications.meeting_transcripts(id) ON DELETE SET NULL,
  update_type    TEXT NOT NULL CHECK (update_type IN ('progress', 'completed')),
  update_text    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_action_updates_action
  ON planning_applications.meeting_action_updates(action_id, created_at);
