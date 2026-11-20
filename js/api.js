(() => {
  let current = null;
  let csrfToken = null;
  const ready = fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' })
    .then(async response => {
      if (!response.ok) return null;
      const payload = await response.json();
      current = payload.user;
      csrfToken = payload.csrfToken;
      return current;
    })
    .catch(() => null);

  async function request(url, options = {}) {
    await ready;
    const method = (options.method || 'GET').toUpperCase();
    const headers = new Headers(options.headers || {});
    if (method !== 'GET' && method !== 'HEAD') headers.set('X-CSRF-Token', csrfToken || '');
    let body = options.body;
    if (body && typeof body !== 'string' && !(body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(body);
    }
    const response = await fetch(url, { ...options, method, body, headers, credentials: 'same-origin', cache: 'no-store' });
    if (response.status === 401) { window.location.assign('/login.html'); throw new Error('Sesi habis. Silakan masuk kembali.'); }
    if (response.status === 204) return null;
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Permintaan gagal.');
    return payload;
  }

  async function requireRole(role) {
    const user = await ready;
    const expected = role === 'tutor' ? 'guru' : role;
    if (!user || user.role !== expected) {
      window.location.replace('/login.html');
      return null;
    }
    return user;
  }

  document.addEventListener('click', event => {
    const link = event.target.closest('[data-logout]');
    if (!link) return;
    event.preventDefault();
    request('/api/auth/logout', { method: 'POST' }).catch(() => {}).finally(() => window.location.assign('/login.html'));
  });

  window.TrevyAPI = { ready, request, requireRole, get user() { return current; } };
})();
