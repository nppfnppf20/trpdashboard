-- Switch snippet template linking from whole-row to per-field: an issue can
-- now link just the NPPF paragraph from one template and the Other Guidance
-- text from a different one, rather than always linking all four fields of
-- a template together. Recreated rather than altered — there's no way to
-- know which field an existing whole-row link was "for", and this table
-- only has early test data in it so far.

DROP TABLE IF EXISTS admin_console.drafting_issue_snippet_relevance;

CREATE TABLE admin_console.drafting_issue_snippet_relevance (
  drafting_issue_id INTEGER NOT NULL REFERENCES admin_console.drafting_issues(id) ON DELETE CASCADE,
  issue_type_id     INTEGER NOT NULL REFERENCES admin_console.issue_types(id) ON DELETE CASCADE,
  field             TEXT NOT NULL CHECK (field IN ('nppf_text', 'nppg_text', 'other_national_text', 'other_guidance_text')),
  PRIMARY KEY (drafting_issue_id, issue_type_id, field)
);
