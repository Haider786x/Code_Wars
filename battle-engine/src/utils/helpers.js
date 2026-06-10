// ─── Shared Utility Helpers ───────────────────────────────────────────────────

/**
 * Read a positive integer from the environment, falling back to `defaultVal`.
 */
export function readPositiveIntEnv(name, defaultVal) {
  const raw = process.env[name];
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : defaultVal;
}

/**
 * Read a boolean env var. Accepts 'true'/'1'/'yes' as truthy.
 */
export function readBooleanEnv(name, defaultVal = false) {
  const raw = (process.env[name] ?? '').toLowerCase();
  if (['true', '1', 'yes'].includes(raw)) return true;
  if (['false', '0', 'no'].includes(raw)) return false;
  return defaultVal;
}

/**
 * Trim and sanitise a string from untrusted input.
 */
export function cleanString(str) {
  if (typeof str !== 'string') return '';
  return str.trim().replace(/[\x00-\x1F\x7F]/g, '');
}

/**
 * Validate a match ID: 1‑64 alphanumeric/hyphen characters.
 * Throws if invalid.
 */
export function validateMatchId(id) {
  if (!id || typeof id !== 'string' || !/^[a-zA-Z0-9\-_]{1,64}$/.test(id)) {
    throw new Error('Invalid matchId');
  }
  return id;
}

/**
 * Generate a short random ID.
 */
export function generateId(prefix = '') {
  return `${prefix}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Send a JSON error response.
 */
export function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

/**
 * Log route errors consistently.
 */
export function logRouteError(context, error) {
  console.error(`[${context}]`, error?.message ?? error);
}
