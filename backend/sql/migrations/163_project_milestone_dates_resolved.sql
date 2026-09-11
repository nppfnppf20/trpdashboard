-- Lets each of the project's own fixed milestone date fields (Submission,
-- Validation, Committee, etc. — shown in the Key Dates widget/Programme
-- alongside tracker- and quote-owned key dates) be marked resolved too.
-- These are plain columns on `projects`, not rows in a key-dates table, so
-- each gets its own companion `_resolved` flag rather than a shared table.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS submission_date_resolved BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS validation_date_resolved BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lpa_consultation_end_date_resolved BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS committee_date_resolved BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS target_determination_date_resolved BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS determined_date_resolved BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expiry_of_1st_stat_period_date_resolved BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS eot_date_resolved BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS six_months_appeal_window_date_resolved BOOLEAN NOT NULL DEFAULT false;
