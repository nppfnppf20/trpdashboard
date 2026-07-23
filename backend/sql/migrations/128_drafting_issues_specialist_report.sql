-- Adds a "Specialist Report" working-notes field to drafting issues,
-- alongside argument_for/argument_against. Free text for now, filled in
-- either manually or via "Draft from Briefing Note".

ALTER TABLE admin_console.drafting_issues
  ADD COLUMN IF NOT EXISTS specialist_report TEXT;
