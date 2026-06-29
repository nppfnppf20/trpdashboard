-- Add status column to consultation_responses

ALTER TABLE planning_applications.consultation_responses
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'In Progress';  -- In Progress / Closed Out
