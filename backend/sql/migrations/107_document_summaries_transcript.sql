-- Retain the full source transcript alongside briefing note summaries,
-- so the raw text survives AI summarisation and can be viewed later.
ALTER TABLE planning_applications.document_summaries
  ADD COLUMN IF NOT EXISTS transcript_text TEXT;
