-- General internal meeting: informal catch-ups / one-offs with no policy
-- extraction or carried-over actions. 'internal' stays as the Internal Team
-- Meeting type (policy updates), so this only widens the allowed values.

ALTER TABLE planning_applications.meeting_transcripts
  DROP CONSTRAINT IF EXISTS meeting_transcripts_meeting_type_check;

ALTER TABLE planning_applications.meeting_transcripts
  ADD CONSTRAINT meeting_transcripts_meeting_type_check
  CHECK (meeting_type IN ('project', 'internal', 'cpd', 'multi_project', 'general'));
