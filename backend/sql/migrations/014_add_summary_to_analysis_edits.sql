-- Migration: 014_add_summary_to_analysis_edits.sql
-- Adds a per-discipline summary text field to analysis_edits

ALTER TABLE public.analysis_edits
  ADD COLUMN IF NOT EXISTS edited_summary TEXT;

COMMENT ON COLUMN public.analysis_edits.edited_summary IS 'User-written summary text for this discipline, included in Word/PDF exports';
