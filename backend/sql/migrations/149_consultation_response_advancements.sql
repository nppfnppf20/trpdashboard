-- Consultation Tracker: replace the flat "Our Response" / "Response Issued" /
-- "Follow Up" fields on each consultee response with a dated advancements
-- log, exactly like Conditions Tracker's condition_advancements. The
-- existing `status` column (In Progress / Closed Out, added by migration
-- 089) already covers what `response_issued` was for, so it's kept as-is.

CREATE TABLE IF NOT EXISTS planning_applications.consultation_response_advancements (
  id               SERIAL PRIMARY KEY,
  response_id      INTEGER NOT NULL REFERENCES planning_applications.consultation_responses(id) ON DELETE CASCADE,
  advancement_date DATE NOT NULL,
  summary          TEXT NOT NULL,
  full_text        TEXT,
  source_type      TEXT NOT NULL DEFAULT 'note',  -- 'note' | 'email'
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultation_response_advancements_response
  ON planning_applications.consultation_response_advancements(response_id);

-- Preserve any existing "Our Response" / "Follow Up" text as a one-off
-- seed advancement per response, before the columns are dropped below.
-- Responses with neither field populated get nothing (there's no narrative
-- to carry forward for those).
INSERT INTO planning_applications.consultation_response_advancements
  (response_id, advancement_date, summary, full_text, source_type)
SELECT
  id,
  COALESCE(updated_at::date, created_at::date, CURRENT_DATE),
  COALESCE(NULLIF(TRIM(consultant_response), ''), NULLIF(TRIM(follow_up), '')),
  CASE
    WHEN NULLIF(TRIM(consultant_response), '') IS NOT NULL AND NULLIF(TRIM(follow_up), '') IS NOT NULL
      THEN consultant_response || E'\n\nFollow up: ' || follow_up
    WHEN NULLIF(TRIM(follow_up), '') IS NOT NULL
      THEN 'Follow up: ' || follow_up
    ELSE consultant_response
  END,
  'note'
FROM planning_applications.consultation_responses
WHERE NULLIF(TRIM(consultant_response), '') IS NOT NULL
   OR NULLIF(TRIM(follow_up), '') IS NOT NULL;

ALTER TABLE planning_applications.consultation_responses
  DROP COLUMN IF EXISTS consultant_response,
  DROP COLUMN IF EXISTS response_issued,
  DROP COLUMN IF EXISTS follow_up;
