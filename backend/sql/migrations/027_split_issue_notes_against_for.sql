ALTER TABLE public.appeal_issue_notes RENAME COLUMN notes TO argument_for;
ALTER TABLE public.appeal_issue_notes ADD COLUMN IF NOT EXISTS argument_against TEXT;
