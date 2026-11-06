-- pa_draft_starting_docs.draft_type_id was created with a foreign key to
-- appeals.appeal_draft_types (migration 068). The HLPV v3 card is a
-- planning_applications.draft_types row, so ticking a meeting note in its
-- Sources modal violated the FK and the save failed ("Failed to save starting doc").
-- The column now holds ids from either table, so the FK can't stay.
-- Idempotent: safe to run more than once.
ALTER TABLE appeals.pa_draft_starting_docs
  DROP CONSTRAINT IF EXISTS pa_draft_starting_docs_draft_type_id_fkey;
