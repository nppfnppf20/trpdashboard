-- Public comments tracker

CREATE TABLE IF NOT EXISTS planning_applications.public_comments (
  id               SERIAL PRIMARY KEY,
  project_id       INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  commenter_name   TEXT,
  date_received    DATE,
  position         TEXT,   -- Support / Object / Neutral / Mixed
  comment          TEXT,
  further_info     TEXT,
  source_file_name TEXT,
  sort_order       INTEGER DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_public_comments_project_id
  ON planning_applications.public_comments(project_id);

-- Stores LLM-generated analysis (bullet summary + themes) per project
CREATE TABLE IF NOT EXISTS planning_applications.public_comment_analysis (
  project_id       INTEGER PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  bullet_summary   JSONB,   -- string[]
  themes           JSONB,   -- [{theme, count, sentiment, summary}]
  last_analysed_at TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
