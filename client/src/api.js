// Cliente HTTP con JWT (patrón PPS). Token en localStorage.
const TOKEN_KEY = 'ov3_token';
const USER_KEY = 'ov3_user';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const getUser = () => { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } };
export const setSession = (token, user) => { localStorage.setItem(TOKEN_KEY, token); localStorage.setItem(USER_KEY, JSON.stringify(user)); };
export const clearSession = () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); };

export async function api(path, { method = 'GET', body, formData } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`/api${path}`, { method, headers, body: formData || (body ? JSON.stringify(body) : undefined) });
  if (res.status === 401) { clearSession(); window.location.href = '/login'; throw new Error('Sesión expirada'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

export const fmt = (n) => `Bs ${Number(n || 0).toLocaleString('es-BO', { maximumFractionDigits: 2 })}`;
export const fdate = (d) => (d ? new Date(d).toLocaleDateString('es-BO', { timeZone: 'UTC' }) : '—');

export function animateClose(setter) {
  const el = document.querySelector('.modal-bg');
  if (!el) return setter(null);
  el.classList.add('out');
  setTimeout(() => setter(null), 140);
}
