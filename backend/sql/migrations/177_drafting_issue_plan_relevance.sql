-- Supplementary Guidance / Other Material Considerations documents often
-- have no discrete policies extracted under them at all — instead, their
-- relevance to the project is written directly onto policy_documents.relevance
-- (see generatePlanRelevanceSummary in lpaAnalysis.service.js, used by the
-- "Extract Policy Wording" flow when a selected plan has no policies).
-- That relevance text previously had no way to be linked to a drafting issue
-- at all — only project_policies rows could be (via
-- drafting_issue_policy_relevance). This mirrors that table, but points at
-- the plan document itself rather than a policy row.

CREATE TABLE IF NOT EXISTS admin_console.drafting_issue_plan_relevance (
  drafting_issue_id INTEGER NOT NULL REFERENCES admin_console.drafting_issues(id) ON DELETE CASCADE,
  plan_id           INTEGER NOT NULL REFERENCES public.policy_documents(id) ON DELETE CASCADE,
  PRIMARY KEY (drafting_issue_id, plan_id)
);
