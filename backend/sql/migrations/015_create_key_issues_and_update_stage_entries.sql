-- Migration: 015_create_key_issues_and_update_stage_entries.sql
-- Creates project_key_issues table and updates project_issue_stage_entries
-- to support both discipline track entries and key issue entries.

-- =============================================================================
-- 1. Create project_key_issues table
-- =============================================================================
CREATE TABLE IF NOT EXISTS admin_console.project_key_issues (
  id                    SERIAL PRIMARY KEY,
  project_id            INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  label                 VARCHAR(255) NOT NULL,
  discipline_group      VARCHAR(100),   -- optional link to a discipline key e.g. 'landscape', 'heritage'
  sort_order            INTEGER NOT NULL DEFAULT 0,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  last_known_risk_level VARCHAR(50),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_key_issues_project_id
  ON admin_console.project_key_issues(project_id);

-- =============================================================================
-- 2. Modify project_issue_stage_entries to support key issues
-- =============================================================================

-- Drop the existing UNIQUE constraint (was non-nullable issue_track_id only)
ALTER TABLE admin_console.project_issue_stage_entries
  DROP CONSTRAINT project_issue_stage_entries_project_stage_instance_id_issue_key;

-- Make issue_track_id nullable (key issue entries won't have one)
ALTER TABLE admin_console.project_issue_stage_entries
  ALTER COLUMN issue_track_id DROP NOT NULL;

-- Add key_issue_id column
ALTER TABLE admin_console.project_issue_stage_entries
  ADD COLUMN IF NOT EXISTS key_issue_id INTEGER
    REFERENCES admin_console.project_key_issues(id) ON DELETE CASCADE;

-- Ensure exactly one of issue_track_id or key_issue_id is set
ALTER TABLE admin_console.project_issue_stage_entries
  ADD CONSTRAINT chk_entry_has_exactly_one_target CHECK (
    (issue_track_id IS NOT NULL AND key_issue_id IS NULL) OR
    (issue_track_id IS NULL     AND key_issue_id IS NOT NULL)
  );

-- Partial unique index for discipline track entries
CREATE UNIQUE INDEX IF NOT EXISTS uq_stage_entry_track
  ON admin_console.project_issue_stage_entries (project_stage_instance_id, issue_track_id)
  WHERE issue_track_id IS NOT NULL;

-- Partial unique index for key issue entries
CREATE UNIQUE INDEX IF NOT EXISTS uq_stage_entry_key_issue
  ON admin_console.project_issue_stage_entries (project_stage_instance_id, key_issue_id)
  WHERE key_issue_id IS NOT NULL;
