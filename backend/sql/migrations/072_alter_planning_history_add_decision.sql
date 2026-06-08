-- Add decision text column and drop development_date from project_planning_history
ALTER TABLE project_planning_history
  ADD COLUMN IF NOT EXISTS decision TEXT;

ALTER TABLE project_planning_history
  DROP COLUMN IF EXISTS development_date;
