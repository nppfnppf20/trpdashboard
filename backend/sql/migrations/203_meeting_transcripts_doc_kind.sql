-- Distinguish saved-as-is documents/transcripts (no actions) from processed meetings.
-- Separate from meeting_type, which says what kind of meeting it was.
-- Existing rows stay 'meeting'.

ALTER TABLE planning_applications.meeting_transcripts
  ADD COLUMN IF NOT EXISTS doc_kind TEXT NOT NULL DEFAULT 'meeting'
  CHECK (doc_kind IN ('meeting', 'document'));
