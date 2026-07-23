-- Many-to-many linking between drafting issues and snippet templates
-- (admin_console.issue_types), replacing the single-select
-- drafting_issues.issue_type_id for new linking going forward — an issue can
-- now have multiple relevant templates, matched automatically by the
-- "Draft from Briefing Note" flow (see draftIssuesFromBriefing) or toggled
-- manually. The old issue_type_id column is left in place (harmless,
-- unused going forward) rather than dropped.

CREATE TABLE IF NOT EXISTS admin_console.drafting_issue_snippet_relevance (
  drafting_issue_id INTEGER NOT NULL REFERENCES admin_console.drafting_issues(id) ON DELETE CASCADE,
  issue_type_id     INTEGER NOT NULL REFERENCES admin_console.issue_types(id) ON DELETE CASCADE,
  PRIMARY KEY (drafting_issue_id, issue_type_id)
);
