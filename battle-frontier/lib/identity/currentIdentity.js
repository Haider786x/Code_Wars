import { getGuestIdentity } from './guestIdentity.js';

export function getCurrentIdentity() {
  const userId = localStorage.getItem('battle_user_id');
  if (userId && userId.trim()) {
    return {
      type: 'user',
      userId: userId.trim(),
    };
  }

  const guest = getGuestIdentity();

  return {
    type: 'guest',
    guestId: guest.guestId,
    displayName: guest.displayName,
  };
}
