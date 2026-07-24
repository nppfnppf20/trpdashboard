-- Adds what the new Planning Policy v3 prompt needs to group policies by
-- their parent plan (e.g. "Central Lincolnshire Local Plan (adopted
-- September 2024)") instead of just by policy_type tier:
--
--   1. plan_type on policy_documents -- distinguishes a Local Plan from a
--      Neighbourhood Plan (independent of `section`, which only tracks
--      adopted/emerging/supplementary/other status). Only meaningful for
--      the 'adopted'/'emerging' sections; NULL for supplementary/other rows.
--   2. month_adopted on policy_documents -- year_adopted already existed
--      but had no month, so "adopted September 2024" could only ever be
--      "adopted 2024". Nullable, since the month isn't always known.
--   3. plan_id on project_policies -- there was previously no link at all
--      from an individual policy to the plan record it belongs to, so the
--      Planning Policy prompt couldn't group "Policy S14" beneath "Central
--      Lincolnshire Local Plan" programmatically. Nullable and ON DELETE
--      SET NULL, since a policy can exist without being tied to a specific
--      plan record (e.g. NPPF-tier policies, or existing untagged rows).

ALTER TABLE policy_documents
  ADD COLUMN IF NOT EXISTS plan_type VARCHAR(20)
    CHECK (plan_type IN ('local', 'neighbourhood')),
  ADD COLUMN IF NOT EXISTS month_adopted SMALLINT
    CHECK (month_adopted BETWEEN 1 AND 12);

ALTER TABLE project_policies
  ADD COLUMN IF NOT EXISTS plan_id INTEGER
    REFERENCES policy_documents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_policies_plan_id ON project_policies(plan_id);
