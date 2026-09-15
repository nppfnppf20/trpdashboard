-- Free-text user instructions per email tone (e.g. "no em dashes", "always
-- sign off with Kind regards"), applied alongside the pasted sample_text
-- example when the assistant drafts an email in this tone.

ALTER TABLE public.user_email_tones ADD COLUMN IF NOT EXISTS guidance_notes TEXT;

COMMENT ON COLUMN public.user_email_tones.guidance_notes IS 'Free-text user instructions applied alongside sample_text when drafting emails in this tone (e.g. "no em dashes").';
