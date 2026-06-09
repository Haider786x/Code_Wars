const GUEST_STORAGE_KEY = 'battle_guest_identity';

function generateGuestId() {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `guest_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeIdentity(value) {
  if (!value || typeof value !== 'object') return null;

  const guestId = typeof value.guestId === 'string' ? value.guestId.trim() : '';
  const displayName = typeof value.displayName === 'string' ? value.displayName.trim() : '';
  if (!guestId) return null;

  return { guestId, displayName };
}

export function getGuestIdentity() {
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const normalized = normalizeIdentity(parsed);

    if (normalized) return normalized;
  } catch (_error) {
    // Fall through and create a new guest identity.
  }

  const identity = { guestId: generateGuestId(), displayName: '' };
  localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(identity));
  return identity;
}

export function setGuestDisplayName(displayName) {
  const identity = getGuestIdentity();
  const next = {
    guestId: identity.guestId,
    displayName: typeof displayName === 'string' ? displayName.trim() : '',
  };
  localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(next));
  return next;
}
