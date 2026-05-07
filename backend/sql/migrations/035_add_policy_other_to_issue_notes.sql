ALTER TABLE planning_applications.issue_notes
  ADD COLUMN IF NOT EXISTS policy_other TEXT;
