// Every /api request needs the login token. Pages call the API in many ways
// (apiFetch, EmployeeContext, plain fetch), so the token is added here once
// for all of them instead of in each page.

export const TOKEN_KEY = 'mms_token';
export const UNAUTHORIZED_EVENT = 'mms:unauthorized';

export function getToken(): string | null {
  try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
}

// For links that open in a new tab / iframe (file downloads), which can't send
// headers. The server accepts ?token= only on GET .../file routes.
export function withToken(url: string): string {
  const t = getToken();
  return t ? `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(t)}` : url;
}

const apiOrigin = (() => {
  try { const v = (import.meta as any).env?.VITE_API_URL; return v ? new URL(v).origin : null; } catch { return null; }
})();

function isApiUrl(raw: string): URL | null {
  try {
    const u = new URL(raw, window.location.href);
    if (!u.pathname.startsWith('/api/')) return null;
    const ours = u.origin === window.location.origin || u.origin === apiOrigin || u.hostname === 'localhost';
    return ours ? u : null;
  } catch { return null; }
}

let installed = false;
export function installAuthFetch() {
  if (installed) return;
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = isApiUrl(raw);
    if (!url) return original(input, init);

    const token = getToken();
    const headers = new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined));
    if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
    const res = await original(input, { ...init, headers });

    // Session expired or token rejected → log out (but not for a failed login attempt)
    if (res.status === 401 && token && !url.pathname.startsWith('/api/auth/login')) {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    return res;
  };
}
