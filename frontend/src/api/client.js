const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';

let authToken = null;

export function setAuthToken(token) {
  authToken = token;
}

export function clearAuthToken() {
  authToken = null;
}

export async function apiRequest(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.detail || `Request gagal (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export function get(path) { return apiRequest(path); }
export function post(path, body) { return apiRequest(path, { method: 'POST', body: JSON.stringify(body) }); }
export function put(path, body) { return apiRequest(path, { method: 'PUT', body: JSON.stringify(body) }); }
export function del(path) { return apiRequest(path, { method: 'DELETE' }); }
