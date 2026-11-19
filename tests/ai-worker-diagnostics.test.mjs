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
