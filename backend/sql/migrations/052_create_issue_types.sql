-- Create global issue types table for normalised issue labels with optional
-- per-development-type policy template text.
-- A null development_type row applies universally; a non-null row is a
-- development-type-specific variant of the same issue.

CREATE TABLE IF NOT EXISTS admin_console.issue_types (
  id               SERIAL PRIMARY KEY,
  label            VARCHAR(255) NOT NULL,
  development_type VARCHAR(100) DEFAULT NULL,
  nppf_text        TEXT         DEFAULT NULL,
  nppg_text        TEXT         DEFAULT NULL,
  other_national_text  TEXT     DEFAULT NULL,
  other_guidance_text  TEXT     DEFAULT NULL,
  sort_order       INTEGER      NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Allow multiple rows for the same label as long as development_type differs
CREATE UNIQUE INDEX IF NOT EXISTS issue_types_label_devtype_uidx
  ON admin_console.issue_types (label, COALESCE(development_type, ''));

-- Add FK column to issue tracks (nullable — existing tracks unaffected)
ALTER TABLE admin_console.project_issue_tracks
  ADD COLUMN IF NOT EXISTS issue_type_id INTEGER
    REFERENCES admin_console.issue_types(id) ON DELETE SET NULL;
