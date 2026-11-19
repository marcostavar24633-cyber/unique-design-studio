import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';

const ORIGIN = 'https://marcostavar24633-cyber.github.io';
const request = (path, { origin = ORIGIN, method = 'GET' } = {}) =>
  new Request('https://worker.example' + path, { method, headers: origin ? { Origin: origin } : {} });

test('runtime diagnostics report only presence of Worker bindings and secrets', async () => {
  const response = await worker.fetch(request('/api/diagnostics'), {
    CF_ANALYTICS_TOKEN: 'test-secret',
    CF_ACCOUNT_ID: 'test-account',
    AI: {},
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    service: 'unique-design-studio-ai',
    runtime: {
      analyticsTokenConfigured: true,
      accountIdConfigured: true,
      workersAiBindingConfigured: true,
      aiGatewayConfigured: false,
      aiBillingMode: 'free',
      nvidiaFallbackConfigured: false,
      nvidiaModel: 'nvidia/nemotron-3.5-lightning-30b-a3b',
    },
    gateway: { configured: false },
  });
});

test('runtime diagnostics identify missing runtime configuration without exposing values', async () => {
  const response = await worker.fetch(request('/api/diagnostics'), {});
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).runtime, {
    analyticsTokenConfigured: false,
    accountIdConfigured: false,
    workersAiBindingConfigured: false,
    aiGatewayConfigured: false,
    aiBillingMode: 'free',
    nvidiaFallbackConfigured: false,
    nvidiaModel: 'nvidia/nemotron-3.5-lightning-30b-a3b',
  });
});

test('runtime diagnostics reject foreign origins and non-GET requests', async () => {
  assert.equal((await worker.fetch(request('/api/diagnostics', { origin: 'https://evil.example' }), {})).status, 403);
  assert.equal((await worker.fetch(request('/api/diagnostics', { method: 'POST' }), {})).status, 405);
});

test('diagnostics report gateway quota and fallbacks without exposing the project token', async () => {
  const seen = [];
  const GATEWAY = { fetch: async (url, init) => { seen.push({ url: String(url), auth: init.headers.Authorization }); return new Response(JSON.stringify({ ok: true, fallback: ['groq'], quota: { limit: 1000, used: 3, remaining: 997, resetAt: '2026-11-21T00:00:00.000Z' } }), { status: 200 }); } };
  const response = await worker.fetch(request('/api/diagnostics'), { AI: {}, GATEWAY, GATEWAY_TOKEN: 'secret-project-token' });
  const body = await response.json();
  assert.deepEqual(body.gateway, { configured: true, ok: true, fallback: ['groq'], quota: { limit: 1000, used: 3, remaining: 997, resetAt: '2026-11-21T00:00:00.000Z' } });
  assert.match(seen[0].url, /\/v1\/status$/);
  assert.equal(seen[0].auth, 'Bearer secret-project-token');
  assert.ok(!JSON.stringify(body).includes('secret-project-token'));
});

test('diagnostics report an unreachable gateway as not ok', async () => {
  const GATEWAY = { fetch: async () => { throw new Error('connection refused'); } };
  const body = await (await worker.fetch(request('/api/diagnostics'), { AI: {}, GATEWAY, GATEWAY_TOKEN: 't' })).json();
  assert.equal(body.gateway.configured, true);
  assert.equal(body.gateway.ok, false);
});
