-- Add runs_last flag to draft_sections
ALTER TABLE planning_applications.draft_sections
  ADD COLUMN IF NOT EXISTS runs_last BOOLEAN NOT NULL DEFAULT FALSE;

-- Mark Executive Summary and Conclusion as runs_last
UPDATE planning_applications.draft_sections
SET runs_last = TRUE
WHERE slug IN ('executive_summary', 'conclusion')
  AND draft_type_id = (
    SELECT id FROM planning_applications.draft_types WHERE slug = 'planning_statement'
  );

-- Planning history table
CREATE TABLE IF NOT EXISTS planning_applications.planning_history (
  id              SERIAL PRIMARY KEY,
  project_id      INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  app_reference   TEXT,
  description     TEXT NOT NULL,
  decision        TEXT,
  decision_date   DATE,
  implemented     BOOLEAN,
  notes           TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS planning_history_project_idx
  ON planning_applications.planning_history(project_id, sort_order);
