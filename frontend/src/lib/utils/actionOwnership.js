// Is this meeting action "theirs"? An action counts when it is assigned to the
// account; if it has no linked account it falls back to an exact (case-insensitive)
// match on the free-text owner name. Used for the profile page's My actions filter.
export function isActionMine(action, userId, userName) {
  if (action.assigned_user_id) return String(action.assigned_user_id) === String(userId);
  return !!userName && action.owner?.trim().toLowerCase() === userName.trim().toLowerCase();
}
