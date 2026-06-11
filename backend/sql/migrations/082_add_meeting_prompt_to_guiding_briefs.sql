-- Add meeting_prompt column to guiding_briefs.
-- Stores the LLM prompt used to generate a meeting agenda for this document type.
-- Keyed the same way as guidance_content (by document_type + development_type).

ALTER TABLE admin_console.guiding_briefs
  ADD COLUMN IF NOT EXISTS meeting_prompt TEXT;
