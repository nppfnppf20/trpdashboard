-- Add consultant email tracking to consultation responses

ALTER TABLE planning_applications.consultation_responses
  ADD COLUMN IF NOT EXISTS last_emailed_consultant_at TIMESTAMPTZ;
