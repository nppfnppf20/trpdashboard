-- Link planning conditions to quotes recorded in surveyor management, so the
-- conditions tracker can show each linked quote's status and interleave its
-- quote_actions log (108) into the condition's progress timeline.
-- Many-to-many: one combined fee quote can cover several conditions, and a
-- condition can receive quotes from several surveyors.

CREATE TABLE IF NOT EXISTS planning_applications.condition_quote_links (
  condition_id INTEGER NOT NULL REFERENCES planning_applications.conditions(id) ON DELETE CASCADE,
  quote_id     UUID NOT NULL REFERENCES admin_console.quotes(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (condition_id, quote_id)
);

CREATE INDEX IF NOT EXISTS idx_condition_quote_links_quote
  ON planning_applications.condition_quote_links(quote_id);
