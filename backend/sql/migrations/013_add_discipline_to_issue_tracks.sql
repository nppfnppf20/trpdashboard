-- Migration: Add discipline column to project_issue_tracks
-- Allows rows to carry a discipline category separate from the specific issue label.
-- HLPV-seeded tracks (created_from_hlpv = TRUE) are discipline-level risks,
-- so their existing label is migrated into discipline.

ALTER TABLE admin_console.project_issue_tracks
  ADD COLUMN IF NOT EXISTS discipline VARCHAR(255);

-- Populate discipline from label for HLPV-seeded tracks
UPDATE admin_console.project_issue_tracks
SET discipline = label
WHERE created_from_hlpv = TRUE;

COMMENT ON COLUMN admin_console.project_issue_tracks.discipline IS
  'Optional discipline category (e.g. Heritage, Ecology). Nullable — rows can be discipline-level or issue-level or both.';
