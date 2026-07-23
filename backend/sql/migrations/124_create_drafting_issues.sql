-- New, independent issue list for AI document drafting (initially wired to
-- Planning Statement v3 only — see appeal.controller.js).
--
-- Separate from admin_console.project_issue_tracks (the "key issues" used by
-- the Stages board / workflow tracking) on purpose: this list is seeded from
-- key issues as a starting point (source_track_id keeps a soft pointer back,
-- for traceability only), but can then be renamed, added to, or deleted
-- freely without touching the original workflow tracker, and vice versa.
-- Project-scoped, not document-type-scoped, so other document types (SOC,
-- v1, Stage 1 Review, etc.) can be wired in later against the same list.

CREATE TABLE IF NOT EXISTS admin_console.drafting_issues (
  id                SERIAL PRIMARY KEY,
  project_id        INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  label             TEXT NOT NULL,
  discipline        TEXT,
  issue_type_id     INTEGER REFERENCES admin_console.issue_types(id) ON DELETE SET NULL,
  source_track_id   INTEGER REFERENCES admin_console.project_issue_tracks(id) ON DELETE SET NULL,
  argument_for      TEXT,
  argument_against  TEXT,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS drafting_issues_project_idx
  ON admin_console.drafting_issues (project_id, sort_order);

-- Reuses the trigger function already defined for admin_console.guiding_briefs.
CREATE TRIGGER drafting_issues_updated_at
  BEFORE UPDATE ON admin_console.drafting_issues
  FOR EACH ROW EXECUTE FUNCTION admin_console.set_updated_at();

-- Independent policy linking, separate from planning_applications.policy_track_relevance.
-- Seeded from it at import time, then editable independently.
CREATE TABLE IF NOT EXISTS admin_console.drafting_issue_policy_relevance (
  drafting_issue_id INTEGER NOT NULL REFERENCES admin_console.drafting_issues(id) ON DELETE CASCADE,
  policy_id         INTEGER NOT NULL REFERENCES public.project_policies(id) ON DELETE CASCADE,
  PRIMARY KEY (drafting_issue_id, policy_id)
);
