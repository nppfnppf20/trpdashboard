-- Add meeting_type to transcripts and make project_id nullable for non-project notes

ALTER TABLE planning_applications.meeting_transcripts
  ADD COLUMN IF NOT EXISTS meeting_type TEXT NOT NULL DEFAULT 'project'
  CHECK (meeting_type IN ('project', 'internal', 'cpd'));

ALTER TABLE planning_applications.meeting_transcripts
  ALTER COLUMN project_id DROP NOT NULL;

ALTER TABLE planning_applications.meeting_summaries
  ALTER COLUMN project_id DROP NOT NULL;

ALTER TABLE planning_applications.meeting_actions
  ALTER COLUMN project_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_meeting_transcripts_type
  ON planning_applications.meeting_transcripts(meeting_type);
