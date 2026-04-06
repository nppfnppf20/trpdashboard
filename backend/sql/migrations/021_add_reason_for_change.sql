-- Migration: 021_add_reason_for_change.sql
-- Adds reason_for_change to stage entries so users must explain risk level changes,
-- and adds llm_suggested flag so the UI can badge AI-generated notes.

ALTER TABLE admin_console.project_issue_stage_entries
  ADD COLUMN IF NOT EXISTS reason_for_change TEXT,
  ADD COLUMN IF NOT EXISTS notes_llm_suggested BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN admin_console.project_issue_stage_entries.reason_for_change IS 'Required when user changes risk level from the previous stage value';
COMMENT ON COLUMN admin_console.project_issue_stage_entries.notes_llm_suggested IS 'True if the notes field was populated by LLM analysis rather than typed manually';
