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
  assert.equal(body.model, '@cf/black-forest-labs/flux-1-schnell');
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
  assert.equal(input.model, '@cf/black-forest-labs/flux-1-schnell');
  assert.equal(input.args.steps, 4);
});
