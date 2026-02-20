/**
 * Auth-Aware API Client
 * Centralized fetch wrapper that automatically adds authorization headers
 */

import { getAccessToken } from '$lib/stores/auth.js';
import { goto } from '$app/navigation';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';

/**
 * Auth-aware fetch wrapper
 * Automatically adds Authorization header and handles 401 responses
 *
 * @param {string} url - URL to fetch (can be relative or absolute)
 * @param {RequestInit} options - Fetch options
 * @returns {Promise<Response>}
 */
export async function authFetch(url, options = {}) {
  // Get the current access token (auto-refreshes if expired)
  const token = await getAccessToken();

  // If we couldn't get a token at all, session is gone — redirect to login
  if (!token) {
    if (typeof window !== 'undefined') {
      goto('/auth/login?expired=1');
    }
    throw new Error('Session expired');
  }

  // Build full URL if relative path provided
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;

  // Merge headers with authorization
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`
  };

  try {
    const response = await fetch(fullUrl, {
      ...options,
      headers
    });

    // Handle 401 Unauthorized - redirect to login
    if (response.status === 401) {
      console.warn('Unauthorized request, redirecting to login');
      if (typeof window !== 'undefined') {
        goto('/auth/login?expired=1');
      }
      throw new Error('Unauthorized');
    }

    return response;
  } catch (error) {
    // Re-throw for caller to handle
    throw error;
  }
}

/**
 * GET request with auth
 * @param {string} url
 * @param {RequestInit} options
 * @returns {Promise<Response>}
 */
export function get(url, options = {}) {
  return authFetch(url, {
    ...options,
    method: 'GET'
  });
}

/**
 * POST request with auth and JSON body
 * @param {string} url
 * @param {any} data
 * @param {RequestInit} options
 * @returns {Promise<Response>}
 */
export function post(url, data, options = {}) {
  return authFetch(url, {
    ...options,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    body: JSON.stringify(data)
  });
}

/**
 * PUT request with auth and JSON body
 * @param {string} url
 * @param {any} data
 * @param {RequestInit} options
 * @returns {Promise<Response>}
 */
export function put(url, data, options = {}) {
  return authFetch(url, {
    ...options,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    body: JSON.stringify(data)
  });
}

/**
 * PATCH request with auth and JSON body
 * @param {string} url
 * @param {any} data
 * @param {RequestInit} options
 * @returns {Promise<Response>}
 */
export function patch(url, data, options = {}) {
  return authFetch(url, {
    ...options,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    body: JSON.stringify(data)
  });
}

/**
 * DELETE request with auth
 * @param {string} url
 * @param {RequestInit} options
 * @returns {Promise<Response>}
 */
export function del(url, options = {}) {
  return authFetch(url, {
    ...options,
    method: 'DELETE'
  });
}

// Export as default object for convenience
export default {
  fetch: authFetch,
  get,
  post,
  put,
  patch,
  del
};
