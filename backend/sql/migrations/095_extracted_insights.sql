-- Stores insights extracted from internal and CPD meeting notes.
-- policy_update (from internal meetings) and cpd_topic (from CPDs).
-- The policy page reads from this table.

CREATE TABLE IF NOT EXISTS admin_console.extracted_insights (
  id           serial PRIMARY KEY,
  transcript_id integer NOT NULL
    REFERENCES planning_applications.meeting_transcripts(id) ON DELETE CASCADE,
  meeting_type  text NOT NULL CHECK (meeting_type IN ('internal', 'cpd')),
  insight_type  text NOT NULL CHECK (insight_type IN ('policy_update', 'cpd_topic')),
  topic         text NOT NULL,
  detail        text,
  raised_by     text,
  meeting_date  date,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_extracted_insights_transcript
  ON admin_console.extracted_insights (transcript_id);

CREATE INDEX IF NOT EXISTS idx_extracted_insights_type
  ON admin_console.extracted_insights (insight_type, created_at DESC);
