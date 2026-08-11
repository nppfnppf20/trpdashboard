-- Meeting Decisions log (freeform topic + decision text, no FK to Issues Tracker)
-- plus a traceability column on meeting_actions so an AI-suggested completion
-- records which meeting transcript prompted it.

CREATE TABLE IF NOT EXISTS planning_applications.meeting_decisions (
  id             SERIAL PRIMARY KEY,
  transcript_id  INTEGER REFERENCES planning_applications.meeting_transcripts(id) ON DELETE CASCADE,
  project_id     INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  topic          TEXT NOT NULL,
  decision_text  TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_decisions_project
  ON planning_applications.meeting_decisions(project_id);

ALTER TABLE planning_applications.meeting_actions
  ADD COLUMN IF NOT EXISTS completed_via_transcript_id INTEGER
    REFERENCES planning_applications.meeting_transcripts(id) ON DELETE SET NULL;

COMMENT ON TABLE planning_applications.meeting_decisions IS 'Freeform decisions log extracted from meeting transcripts alongside actions; topic is free text, not linked to the Issues Tracker.';
COMMENT ON COLUMN planning_applications.meeting_actions.completed_via_transcript_id IS 'Set when this action was marked complete via an AI suggestion in the meeting-notes review modal, for traceability back to the meeting that closed it.';
