-- 019_add_sectors_jsonb.sql
-- Adds JSONB array columns for multi-select sectors and sub-sectors.
-- The existing sector VARCHAR column is left intact (views depend on it).

ALTER TABLE projects ADD COLUMN IF NOT EXISTS sectors JSONB DEFAULT '[]';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS sub_sectors JSONB DEFAULT '[]';
