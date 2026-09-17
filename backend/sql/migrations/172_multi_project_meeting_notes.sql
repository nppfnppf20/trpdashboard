-- Multi-project meeting notes: one upload can now produce a note per
-- ticked project plus an optional combined note spanning all of them.
--
-- Per-project notes reuse the existing meeting_type = 'project' shape
-- (same project_id column, no schema change needed for them). The
-- combined note is a new meeting_type value with no single project_id.

ALTER TABLE planning_applications.meeting_transcripts
  DROP CONSTRAINT IF EXISTS meeting_transcripts_meeting_type_check;

ALTER TABLE planning_applications.meeting_transcripts
  ADD CONSTRAINT meeting_transcripts_meeting_type_check
  CHECK (meeting_type IN ('project', 'internal', 'cpd', 'multi_project'));

ALTER TABLE planning_applications.meeting_transcripts
  ADD COLUMN IF NOT EXISTS batch_id UUID,
  ADD COLUMN IF NOT EXISTS covered_project_ids JSONB DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_meeting_transcripts_batch
  ON planning_applications.meeting_transcripts(batch_id);

COMMENT ON COLUMN planning_applications.meeting_transcripts.batch_id IS 'Shared by every note (individual + combined) generated from one multi-project upload; informational only, not a hard link.';
COMMENT ON COLUMN planning_applications.meeting_transcripts.covered_project_ids IS 'Populated only on meeting_type = multi_project rows: JSONB array of project ids the combined note was generated from.';
