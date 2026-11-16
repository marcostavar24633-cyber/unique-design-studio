import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';

const origin = 'https://marcostavar24633-cyber.github.io';

test('Workers AI Design Director returns only allowlisted text patches for approval', async () => {
  let called = false;
  const env = { AI: { run: async (_model, options) => {
    called = true;
    assert.match(options.messages[0].content, /allowlist/i);
    return { response: JSON.stringify({ recommendations: [{
      id: 'hero-copy',
      title: 'Уточнить заголовок',
      priority: 'high',
      reason: 'Текущий заголовок общий.',
      action: 'Сделать предложение конкретнее.',
      patch: { title: 'Мебель, созданная под ваш интерьер', privateNote: 'не пропускать', cta: 42 },
    }] }) };
  } } };
  const response = await worker.fetch(new Request('https://worker.test/api/generate-landing', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ task: 'design-review', project: { niche: 'мебель', title: 'Мебель' } }),
  }), env);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(called, true);
  assert.equal(body.review.mode, 'workers-ai');
  assert.deepEqual(body.review.recommendations[0].patch, { title: 'Мебель, созданная под ваш интерьер' });
  assert.equal(body.review.safety.autoApplied, false);
});

test('Workers AI Design Director rejects disallowed origins before inference', async () => {
  let called = false;
  const response = await worker.fetch(new Request('https://worker.test/api/generate-landing', {
    method: 'POST',
    headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
    body: JSON.stringify({ task: 'design-review', project: { niche: 'мебель' } }),
  }), { AI: { run: async () => { called = true; return {}; } } });
  assert.equal(response.status, 403);
  assert.equal(called, false);
});


function memoryKv() {
  const store = new Map();
  return {
    async get(key, type) {
      const value = store.get(key);
      if (value === undefined) return null;
      return type === 'json' ? JSON.parse(value) : value;
    },
    async put(key, value) { store.set(key, value); },
    async delete(key) { store.delete(key); },
    async list({ prefix, limit }) {
      return { keys: [...store.keys()].filter(key => key.startsWith(prefix)).slice(0, limit).map(name => ({ name })) };
    },
  };
}

const monitorEnv = () => ({
  MONITOR_KV: memoryKv(),
  MONITOR_API_TOKEN: 'test-monitor-secret',
  MONITOR_ALLOWED_HOSTS: 'demo.pages.dev,shop.example.org',
});
const monitorHeaders = { Origin: origin, Authorization: 'Bearer test-monitor-secret', 'Content-Type': 'application/json' };

test('monitor API requires bearer authentication and an exact host allowlist', async () => {
  const env = monitorEnv();
  const denied = await worker.fetch(new Request('https://worker.test/api/monitor/sites'), env);
  assert.equal(denied.status, 401);
  const badHost = await worker.fetch(new Request('https://worker.test/api/monitor/sites', {
    method: 'POST', headers: monitorHeaders,
    body: JSON.stringify({ url: 'https://not-allowed.invalid-domain.com/', label: 'External' }),
  }), env);
  assert.equal(badHost.status, 400);
  assert.match((await badHost.json()).error, /MONITOR_ALLOWED_HOSTS/);
  const local = await worker.fetch(new Request('https://worker.test/api/monitor/sites', {
    method: 'POST', headers: monitorHeaders,
    body: JSON.stringify({ url: 'https://127.0.0.1/' }),
  }), env);
  assert.equal(local.status, 400);
});

test('monitor stores allowlisted sites and performs an authenticated manual HTTP check', async () => {
  const env = monitorEnv();
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async (_url, options) => {
    requests++;
    assert.equal(options.method, 'HEAD');
    return new Response(null, { status: 200 });
  };
  try {
    const added = await worker.fetch(new Request('https://worker.test/api/monitor/sites', {
      method: 'POST', headers: monitorHeaders,
      body: JSON.stringify({ url: 'https://demo.pages.dev/', label: 'Demo', environment: 'production' }),
    }), env);
    assert.equal(added.status, 201);
    const site = (await added.json()).site;
    assert.equal(site.label, 'Demo');
    const checked = await worker.fetch(new Request('https://worker.test/api/monitor/check', {
      method: 'POST', headers: monitorHeaders, body: '{}',
    }), env);
    const result = await checked.json();
    assert.equal(checked.status, 200);
    assert.equal(result.checked, 1);
    assert.equal(result.sites[0].lastCheck.state, 'reachable');
    assert.equal(result.sites[0].lastCheck.httpStatus, 200);
    assert.equal(requests, 1);
    const listed = await worker.fetch(new Request('https://worker.test/api/monitor/sites', { headers: monitorHeaders }), env);
    assert.equal((await listed.json()).sites.length, 1);
    const deleted = await worker.fetch(new Request('https://worker.test/api/monitor/sites/' + site.id, {
      method: 'DELETE', headers: monitorHeaders,
    }), env);
    assert.equal(deleted.status, 200);
    const afterDelete = await worker.fetch(new Request('https://worker.test/api/monitor/sites', { headers: monitorHeaders }), env);
    assert.equal((await afterDelete.json()).sites.length, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test('monitor refuses redirects to hosts outside the allowlist', async () => {
  const env = monitorEnv();
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return new Response(null, { status: 302, headers: { Location: 'https://evil.example/redirect' } });
  };
  try {
    const added = await worker.fetch(new Request('https://worker.test/api/monitor/sites', {
      method: 'POST', headers: monitorHeaders,
      body: JSON.stringify({ url: 'https://demo.pages.dev/' }),
    }), env);
    const site = (await added.json()).site;
    const checked = await worker.fetch(new Request('https://worker.test/api/monitor/check', {
      method: 'POST', headers: monitorHeaders, body: JSON.stringify({ id: site.id }),
    }), env);
    const result = await checked.json();
    assert.equal(checked.status, 200);
    assert.equal(result.sites[0].lastCheck.state, 'check-error');
    assert.equal(requests, 1);
  } finally { globalThis.fetch = originalFetch; }
});
