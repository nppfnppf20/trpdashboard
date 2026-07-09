-- Actions tracker for instructed surveys: a dated progress log per quote,
-- mirroring the conditions tracker's advancements (106_conditions_tracker.sql).
-- One pasted email trail can fan out to several quotes, each getting its own
-- row sharing the same date/full_text. Replaces the operational notes column
-- in the Instructed Surveyors tab (quotes.operational_notes is left intact).

CREATE TABLE IF NOT EXISTS admin_console.quote_actions (
  id           SERIAL PRIMARY KEY,
  quote_id     UUID NOT NULL REFERENCES admin_console.quotes(id) ON DELETE CASCADE,
  action_date  DATE NOT NULL,
  summary      TEXT NOT NULL,
  full_text    TEXT,
  source_type  TEXT NOT NULL DEFAULT 'note',  -- 'note' | 'email'
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quote_actions_quote
  ON admin_console.quote_actions(quote_id);
