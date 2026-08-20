-- Adds a "Conditions Suggested" column to the statutory consultee tracker,
-- separate from action_required (migration 158): action_required is what's
-- needed BEFORE a decision (further info, reports); conditions_suggested is
-- planning conditions the consultee proposes to attach AFTER approval.

ALTER TABLE planning_applications.consultation_responses
  ADD COLUMN IF NOT EXISTS conditions_suggested TEXT;
