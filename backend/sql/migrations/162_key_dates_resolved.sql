-- Lets a key date (on a condition/issue/consultation response, a quote, or a
-- project milestone) be marked resolved — distinct from a tracker row's own
-- "Complete"/"Discharged" status, which is about the row as a whole, not any
-- one date on it.

ALTER TABLE planning_applications.condition_key_dates
  ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE planning_applications.progress_issue_key_dates
  ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE planning_applications.consultation_response_key_dates
  ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE admin_console.quote_key_dates
  ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE admin_console.programme_events
  ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN planning_applications.condition_key_dates.is_resolved IS 'Marked resolved by the user — purely a display/filter flag, no workflow behaviour depends on it.';
COMMENT ON COLUMN planning_applications.progress_issue_key_dates.is_resolved IS 'Marked resolved by the user — purely a display/filter flag, no workflow behaviour depends on it.';
COMMENT ON COLUMN planning_applications.consultation_response_key_dates.is_resolved IS 'Marked resolved by the user — purely a display/filter flag, no workflow behaviour depends on it.';
COMMENT ON COLUMN admin_console.quote_key_dates.is_resolved IS 'Marked resolved by the user — purely a display/filter flag, no workflow behaviour depends on it.';
COMMENT ON COLUMN admin_console.programme_events.is_resolved IS 'Marked resolved by the user — purely a display/filter flag, no workflow behaviour depends on it.';
