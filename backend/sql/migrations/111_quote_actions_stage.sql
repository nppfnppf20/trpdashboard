-- Quote actions on the Quotes tab: the same dated progress log now starts at
-- quote stage (chasing quotes, surveyor questions, fee revisions) and carries
-- over when the quote is instructed. `stage` records where an entry was added
-- ('quote' | 'instructed') and selects the LLM summariser prompt; both tabs
-- display the quote's full timeline.

ALTER TABLE admin_console.quote_actions
  ADD COLUMN IF NOT EXISTS stage TEXT NOT NULL DEFAULT 'instructed';
