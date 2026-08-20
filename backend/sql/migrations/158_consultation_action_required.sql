-- Adds an "Action Required" column to the statutory consultee tracker: brief
-- bullet points on what the team/consultant needs to provide to the council
-- as a result of the consultation response (e.g. further information, a
-- specific report). Filled by the LLM during extraction, editable inline
-- like the other tracker fields.

ALTER TABLE planning_applications.consultation_responses
  ADD COLUMN IF NOT EXISTS action_required TEXT;
