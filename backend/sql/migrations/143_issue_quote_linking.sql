-- Issues Tracker quote linking, mirroring 113_condition_quote_links.sql and
-- 142_condition_quote_linking.sql for the Conditions Tracker equivalent.

CREATE TABLE IF NOT EXISTS planning_applications.progress_issue_quote_links (
  issue_id   INTEGER NOT NULL REFERENCES planning_applications.progress_issues(id) ON DELETE CASCADE,
  quote_id   UUID NOT NULL REFERENCES admin_console.quotes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (issue_id, quote_id)
);

CREATE INDEX IF NOT EXISTS idx_progress_issue_quote_links_quote
  ON planning_applications.progress_issue_quote_links(quote_id);

ALTER TABLE planning_applications.progress_actions
  ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES admin_console.quotes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_progress_actions_quote
  ON planning_applications.progress_actions(quote_id);

COMMENT ON TABLE planning_applications.progress_issue_quote_links IS 'Links a Surveyor Management quote to an Issues Tracker issue — same many-to-many shape as condition_quote_links.';
COMMENT ON COLUMN planning_applications.progress_actions.quote_id IS 'Optional tag marking this action as relevant to one of the issue''s linked quotes (via progress_issue_quote_links). Nullable — most actions have nothing to do with a quote.';
