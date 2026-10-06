-- Stores the full original text of each statutory consultee response, kept
-- separately from the AI-extracted summary fields (comments, action_required,
-- conditions_suggested) so the verbatim wording is available for later use.
-- Statutory consultees only; public comments are not affected.

ALTER TABLE planning_applications.consultation_responses
  ADD COLUMN IF NOT EXISTS verbatim_text TEXT;
