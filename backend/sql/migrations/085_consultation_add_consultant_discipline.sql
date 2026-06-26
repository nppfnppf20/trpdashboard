-- Add discipline and consultant fields to consultation responses

ALTER TABLE planning_applications.consultation_responses
  ADD COLUMN IF NOT EXISTS discipline                TEXT,
  ADD COLUMN IF NOT EXISTS original_consultant       TEXT,
  ADD COLUMN IF NOT EXISTS original_consultant_email TEXT;
