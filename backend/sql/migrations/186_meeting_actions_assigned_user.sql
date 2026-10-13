-- Additive FK linking a meeting action to a real app account, alongside (not
-- replacing) the free-text owner column. The LLM still extracts a free-text
-- owner from the transcript, and not everyone named has a login, so owner
-- stays as the display/fallback field and assigned_user_id is populated only
-- when the owner is matched/picked as a user_profiles account.

ALTER TABLE planning_applications.meeting_actions
  ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_meeting_actions_assigned_user
  ON planning_applications.meeting_actions(assigned_user_id, status);

COMMENT ON COLUMN planning_applications.meeting_actions.assigned_user_id IS 'Linked account for owner, when that name matches a synced user_profiles row. Null for client contacts / anyone without a login — owner (text) remains the display/fallback field.';
