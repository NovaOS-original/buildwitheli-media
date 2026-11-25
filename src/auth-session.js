/**
 * Decide whether an auth event requires a database profile read.
 * Routine token refreshes do not change the profile and must not trigger
 * another RLS-protected query for an already-loaded user.
 */
export function shouldLoadProfileForAuthEvent(event, nextUserId, currentUserId, loadedProfileUserId) {
  if (!nextUserId) return false;
  if (event === 'USER_UPDATED') return true;
  return nextUserId !== currentUserId || nextUserId !== loadedProfileUserId;
}
