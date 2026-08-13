-- Multi-select development type per project, replacing the old single
-- `projects.development_type` (VARCHAR) as the field users actually edit.
--
-- `development_type` (singular) is left in place and kept in sync from
-- `development_types[0]` on save (see projectsApi.js) rather than dropped,
-- since it's still read by guiding-brief matching, the NPPF/NPPG
-- policy-context-template lookups, and the HLPV per-card override default --
-- none of which have been taught to handle multiple values yet. The plural
-- field is the new source of truth for anything that should consider every
-- selected type (the National Policy snippet browser and precedent lookup
-- on RelevantPolicyTab.svelte).
--
-- Mirrors the existing sectors/sub_sectors pattern (migration 019): a JSONB
-- array of name strings on the project, editable via a MultiSelectDropdown,
-- backed by a DB lookup table for the option list. Unlike sub_sectors (whose
-- admin_console.sub_sectors lookup table was created directly in the DB with
-- no migration), this one is version-controlled from the start.

CREATE TABLE IF NOT EXISTS admin_console.development_types (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

INSERT INTO admin_console.development_types (name) VALUES
  ('Residential'), ('Co-Living'), ('Commercial'), ('Solar'), ('Wind'),
  ('Mixed Use'), ('Industrial'), ('Change of Use'), ('Agricultural'),
  ('Synchronous condensers'), ('Other')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS development_types JSONB DEFAULT '[]';

-- Backfill: carry forward any project that already has a singular dev type
-- set (via the old Planning Statement card selector) into the new array.
UPDATE projects
SET development_types = to_jsonb(ARRAY[development_type])
WHERE development_type IS NOT NULL
  AND development_type != ''
  AND (development_types IS NULL OR development_types = '[]'::jsonb);
