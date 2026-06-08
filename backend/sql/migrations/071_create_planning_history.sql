-- Planning History per project, split into on-site and nearby sections
CREATE TABLE IF NOT EXISTS project_planning_history (
  id              SERIAL PRIMARY KEY,
  project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  section         TEXT NOT NULL CHECK (section IN ('on_site', 'nearby')),
  planning_ref    TEXT,
  description     TEXT,
  decision        TEXT,
  decision_date   DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_planning_history_project_id
  ON project_planning_history(project_id);
