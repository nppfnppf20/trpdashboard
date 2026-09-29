-- The Policy tab (RelevantPolicyTab.svelte) and the Drafting Issues policy
-- tiers offer five policy types: national, local, neighbourhood,
-- supplementary, other. The project_policies_policy_type_check constraint
-- was originally limited to local/national/neighbourhood (see the note in
-- migration 137), so saving a Supplementary or Other policy fails with
-- 'violates check constraint "project_policies_policy_type_check"'.
--
-- Drops and recreates the constraint with all five values. Safe to re-run:
-- existing rows are all within the old (narrower) set, so they satisfy the
-- new one.

ALTER TABLE project_policies DROP CONSTRAINT IF EXISTS project_policies_policy_type_check;

ALTER TABLE project_policies
  ADD CONSTRAINT project_policies_policy_type_check
  CHECK (policy_type IN ('national', 'local', 'neighbourhood', 'supplementary', 'other'));
