-- Stores a lightly-formatted, user-annotatable HTML version of a policy's
-- verbatim wording, shown in the policy preview modal (Policy tab and
-- Drafting Issues page). Separate from policy_text (the plain-text verbatim
-- record, left untouched) so annotation is purely additive: bold/highlight
-- marks and paragraph breaks for readability, never a rewrite of the
-- underlying wording. NULL until the first time someone opens the preview
-- (the frontend auto-formats policy_text into starting HTML at that point).

ALTER TABLE project_policies ADD COLUMN IF NOT EXISTS policy_text_annotated TEXT;
