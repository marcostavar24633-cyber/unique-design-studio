const STUDIO_ORIGIN = 'https://marcostavar24633-cyber.github.io';
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

function response(body, status, origin) {
  const headers = new Headers(JSON_HEADERS);
  if (origin === STUDIO_ORIGIN) {
    headers.set('access-control-allow-origin', STUDIO_ORIGIN);
    headers.set('vary', 'Origin');
  }
  return new Response(JSON.stringify(body), { status, headers });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const origin = request.headers.get('origin');
    if (request.method === 'OPTIONS') {
      if (origin !== STUDIO_ORIGIN) return new Response(null, { status: 403 });
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-origin': STUDIO_ORIGIN,
          'access-control-allow-methods': 'GET, OPTIONS',
          'access-control-allow-headers': 'accept',
          'access-control-max-age': '600',
          vary: 'Origin'
        }
      });
    }
    if (request.method !== 'GET') return response({ error: 'Method not allowed' }, 405, origin);
    if (origin !== STUDIO_ORIGIN) return response({ error: 'Origin not allowed' }, 403);
    if (url.pathname === '/health') return response({ ok: true }, 200, origin);
    if (/^\/fault-503\/api\/diagnostics\/?$/.test(url.pathname)) {
      return response({ error: 'Synthetic upstream failure (HTTP 503)' }, 503, origin);
    }
    if (/^\/fault-timeout\/api\/diagnostics\/?$/.test(url.pathname)) {
      await new Promise((resolve) => setTimeout(resolve, 15_000));
      return response({ error: 'Synthetic delayed response completed' }, 200, origin);
    }
    return response({ error: 'Not found' }, 404, origin);
  }
};
