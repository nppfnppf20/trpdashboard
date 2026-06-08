ALTER TABLE project_planning_history
  ALTER COLUMN decision_date TYPE TEXT USING decision_date::TEXT;
