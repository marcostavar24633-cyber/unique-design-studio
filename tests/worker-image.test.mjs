import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';

const ORIGIN = 'https://marcostavar24633-cyber.github.io';
const call = (body, { origin = ORIGIN, method = 'POST', env } = {}) => worker.fetch(new Request('https://ai.dev/api/generate-image', {
  method, headers: { ...(origin ? { Origin: origin } : {}), 'Content-Type': 'application/json' },
  body: method === 'POST' ? JSON.stringify(body) : undefined,
}), env || { AI: { run: async () => ({ image: 'aGVsbG8=' }) }, AI_RATE_LIMITER: { limit: async () => ({ success: true }) } });

test('image generation rejects unknown origins and non-POST methods', async () => {
  assert.equal((await call({ prompt: 'product photo' }, { origin: 'https://evil.example' })).status, 403);
  assert.equal((await call({}, { method: 'GET' })).status, 405);
});

test('image generation validates prompt and returns FLUX image data', async () => {
  assert.equal((await call({ prompt: '' })).status, 400);
  const response = await call({ prompt: 'Premium product photo, natural light' });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.image, 'aGVsbG8=');
  assert.equal(body.mimeType, 'image/jpeg');
  assert.equal(body.model, '@cf/black-forest-labs/flux-2-klein-4b');
});

test('image generation uses the AI binding and applies rate limiting', async () => {
  let input;
  const env = {
    AI: { run: async (model, args) => { input = { model, args }; return { image: 'aGVsbG8=' }; } },
    AI_RATE_LIMITER: { limit: async () => ({ success: false }) },
  };
  const limited = await call({ prompt: 'photo' }, { env });
  assert.equal(limited.status, 429);
  assert.equal(input, undefined);
  const allowed = await call({ prompt: 'photo' }, { env: { ...env, AI_RATE_LIMITER: { limit: async () => ({ success: true }) } } });
  assert.equal(allowed.status, 200);
  assert.equal(input.model, '@cf/black-forest-labs/flux-2-klein-4b');
  assert.ok(input.args.multipart, 'FLUX.2 klein получает multipart/form-data');
});

test('stock queries are built from the studio prompt: subject words plus niche', async () => {
  const { stockQueries } = await import('../worker/stock-photo.js');
  const prompt = 'Realistic documentary-style photograph for the website of a artisan bakery, taken on a full-frame camera with a 35mm lens. Subject: fresh baguettes on wooden shelves, a product or service of a artisan bakery, shown clearly as the main subject. Setting: x.';
  const queries = stockQueries(prompt).map(item => item.q);
  assert.equal(queries[0], 'fresh baguettes bakery');
  assert.ok(queries.includes('artisan bakery'));
});

test('when every Workers AI model fails, a CC0 stock photo from Openverse is returned', async () => {
  const realFetch = globalThis.fetch;
  const requested = [];
  globalThis.fetch = async (url) => {
    requested.push(String(url));
    if (String(url).startsWith('https://api.openverse.org/')) {
      return new Response(JSON.stringify({ results: [{ url: 'https://img.example/a.jpg', width: 1200, height: 800, title: 'Bread', creator: 'x', license: 'cc0', foreign_landing_url: 'https://img.example/a' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'Content-Type': 'image/jpeg', 'Content-Length': '3' } });
  };
  try {
    const env = { AI: { run: async () => { throw new Error('4006: you have used up your daily free allocation of 10,000 neurons'); } }, AI_RATE_LIMITER: { limit: async () => ({ success: true }) } };
    const response = await call({ prompt: 'photograph for the website of a artisan bakery, taken on. Subject: fresh bread loaves. ', aspect: '16:9' }, { env });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.model, 'openverse');
    assert.equal(body.image, 'AQID');
    assert.equal(body.fallback, true);
    assert.equal(body.source.license, 'cc0');
    assert.match(requested[0], /license=cc0%2Cpdm/);
    assert.match(requested[0], /aspect_ratio=wide/);
    const disabled = await call({ prompt: 'Subject: bread. ' }, { env: { ...env, IMAGE_STOCK_FALLBACK: 'false' } });
    assert.equal(disabled.status, 502);
  } finally {
    globalThis.fetch = realFetch;
  }
});
