CREATE TABLE IF NOT EXISTS policy_documents (
  id          SERIAL PRIMARY KEY,
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  section     VARCHAR(50) NOT NULL CHECK (section IN ('adopted', 'emerging', 'other')),
  plan_name   TEXT NOT NULL,
  year_adopted INTEGER,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_policy_documents_project_id ON policy_documents(project_id);
