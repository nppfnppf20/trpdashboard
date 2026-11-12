-- Notes log for Drafting Issues (Policy Assessment tab).
--
-- Each "Draft from document" run adds one entry per issue here (meeting title /
-- date, and the notes drafted from that source) instead of overwriting the
-- issue's current notes. admin_console.drafting_issues.argument_for stays the
-- single "current notes" field the Planning Statement and Stage 1 Review read;
-- this log is history only and is never sent to a generation prompt.
-- "Consolidate" merges the log into current notes (later meetings supersede
-- earlier ones) after the user reviews the proposal, and snapshots whatever
-- the current notes were beforehand so nothing is lost.
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS admin_console.drafting_issue_note_log (
  id                serial PRIMARY KEY,
  drafting_issue_id integer NOT NULL REFERENCES admin_console.drafting_issues(id) ON DELETE CASCADE,
  -- 'draft'    = notes drafted from a meeting / pasted text / tracker
  -- 'snapshot' = the current notes as they were just before a consolidation replaced them
  kind              text NOT NULL DEFAULT 'draft' CHECK (kind IN ('draft', 'snapshot')),
  source_label      text,
  -- Date of the meeting (latest, if several were ticked); NULL for pasted text / tracker
  source_date       date,
  note_text         text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  -- Set once the entry has been folded into the current notes
  consolidated_at   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_drafting_issue_note_log_issue
  ON admin_console.drafting_issue_note_log (drafting_issue_id, created_at);
