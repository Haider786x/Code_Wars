import { getToken, clearAuthSession } from '@/lib/auth/authStore.js';

const BASE_URL = import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:3000';

/**
 * Build headers for every request — always JSON, attach Bearer token if present.
 */
function buildHeaders(extra = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...extra,
  };
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Central fetch wrapper.
 * - Resolves with parsed JSON on 2xx.
 * - Throws an enriched Error (with .status and .data) on non-2xx.
 * - Clears the auth session on 401.
 */
async function request(method, path, { body, headers: extraHeaders } = {}) {
  const url = `${BASE_URL}${path}`;

  const init = {
    method,
    headers: buildHeaders(extraHeaders),
  };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  const response = await fetch(url, init);

  // Try to parse JSON regardless of status so we can attach it to the error
  let data;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearAuthSession();
    }
    const err = new Error(
      (typeof data === 'object' ? data?.error : data) || `HTTP ${response.status}`,
    );
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const api = {
  getAction: (url, config) =>
    request('GET', url, { headers: config?.headers }),

  postAction: (url, data, config) =>
    request('POST', url, { body: data, headers: config?.headers }),

  patchAction: (url, data, config) =>
    request('PATCH', url, { body: data, headers: config?.headers }),

  deleteAction: (url, config) =>
    request('DELETE', url, { headers: config?.headers }),
};
