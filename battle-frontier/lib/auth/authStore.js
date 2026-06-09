/**
 * Auth store – thin wrapper over localStorage.
 * Provides reactive helpers for reading/writing the auth token and current user.
 */

const STORAGE_KEY_TOKEN = 'cb_auth_token';
const STORAGE_KEY_USER = 'cb_auth_user';

export const AVAILABLE_AVATARS = [
  'warrior', 'ninja', 'wizard', 'dragon',
  'phoenix', 'titan', 'cipher', 'oracle',
  'ghost', 'shadow', 'storm', 'nexus',
];

/**
 * Returns the avatar image URL for a given avatar seed.
 * Uses DiceBear with "bottts" style for distinct robotic avatars.
 */
export function avatarUrl(seed) {
  return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

export function getToken() {
  return localStorage.getItem(STORAGE_KEY_TOKEN);
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setAuthSession(token, user) {
  localStorage.setItem(STORAGE_KEY_TOKEN, token);
  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
}

export function clearAuthSession() {
  localStorage.removeItem(STORAGE_KEY_TOKEN);
  localStorage.removeItem(STORAGE_KEY_USER);
}

export function isLoggedIn() {
  return Boolean(getToken() && getStoredUser());
}

export function getAuthHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
