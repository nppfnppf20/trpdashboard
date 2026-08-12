-- Richer Conditions Tracker <-> Surveyor Management quote linking:
-- 1) a timestamp for the quote's most recent instruction-status transition
--    (single current transition, not a full history), so it can be shown as
--    a dated entry in a linked condition's timeline.
-- 2) an optional "relevant quote" tag on each condition advancement, so a
--    typed update can be marked as belonging to a specific linked quote
--    without duplicating it into admin_console.quote_actions.

ALTER TABLE admin_console.quotes
  ADD COLUMN IF NOT EXISTS instruction_status_changed_at TIMESTAMPTZ;

COMMENT ON COLUMN admin_console.quotes.instruction_status_changed_at IS 'When instruction_status was last changed. Restamped on every change — reflects only the current transition, not a full history.';

ALTER TABLE planning_applications.condition_advancements
  ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES admin_console.quotes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_condition_advancements_quote
  ON planning_applications.condition_advancements(quote_id);

COMMENT ON COLUMN planning_applications.condition_advancements.quote_id IS 'Optional tag marking this advancement as relevant to one of the condition''s linked quotes (via condition_quote_links). Nullable — most advancements have nothing to do with a quote.';
