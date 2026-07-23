-- Bring admin_console.drafting_issues up to parity with the Planning Issues
-- tab's data model, so the Drafting Issues tab can offer the same fields:
-- a general "Issue notes" summary, and the five policy-tier note fields
-- (mirroring planning_applications.issue_notes) alongside the existing
-- argument_for.

ALTER TABLE admin_console.drafting_issues
  ADD COLUMN IF NOT EXISTS summary                TEXT,
  ADD COLUMN IF NOT EXISTS policy_national         TEXT,
  ADD COLUMN IF NOT EXISTS policy_local            TEXT,
  ADD COLUMN IF NOT EXISTS policy_neighbourhood    TEXT,
  ADD COLUMN IF NOT EXISTS policy_supplementary    TEXT,
  ADD COLUMN IF NOT EXISTS policy_other            TEXT;
