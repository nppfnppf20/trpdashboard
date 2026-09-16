-- Lets a draft comment carry an attached document's extracted text alongside
-- the note. Previously, attaching a document while composing a Comment (as
-- opposed to sending straight to AI) silently dropped it — the comment only
-- ever stored `body`, so a later batch "send comments to AI" had nothing to
-- give the model but the note text itself.

ALTER TABLE public.draft_paragraph_comments
  ADD COLUMN IF NOT EXISTS document_text TEXT,
  ADD COLUMN IF NOT EXISTS document_title TEXT,
  ADD COLUMN IF NOT EXISTS doc_type TEXT;
