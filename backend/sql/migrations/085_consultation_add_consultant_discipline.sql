-- Add discipline and consultant fields to consultation responses

ALTER TABLE planning_applications.consultation_responses
  ADD COLUMN IF NOT EXISTS discipline       TEXT,
  ADD COLUMN IF NOT EXISTS consultant_name  TEXT,
  ADD COLUMN IF NOT EXISTS consultant_email TEXT;
