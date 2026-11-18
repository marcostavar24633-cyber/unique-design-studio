import test from 'node:test';
import assert from 'node:assert/strict';
import { runTextModel } from '../worker/nvidia.js';

const options = { messages: [{ role: 'user', content: 'hello' }], max_tokens: 32, temperature: 0.2 };
const openRouterEnv = {
  AI_BILLING_MODE: 'free',
  OPENROUTER_ENABLED: 'true',
  OPENROUTER_API_KEY: 'test-key',
  AI: { run: async () => { throw new Error('primary should not run'); } },
};

test('manual OpenRouter mode routes directly to the fixed free router', async () => {
  const previousFetch = globalThis.fetch;
  let body;
  globalThis.fetch = async (_url, init) => {
    body = JSON.parse(init.body);
    return new Response(JSON.stringify({ model: 'free-model/test', choices: [{ message: { content: 'ok' } }] }), { status: 200 });
  };
  try {
    const result = await runTextModel(openRouterEnv, 'test-model', options, { providerOverride: 'openai', routeMode: 'openrouter' });
    assert.equal(result.provider, 'openrouter');
    assert.equal(body.model, 'openrouter/free');
  } finally { globalThis.fetch = previousFetch; }
});

test('primary-only manual mode does not silently switch to OpenRouter on quota errors', async () => {
  const previousFetch = globalThis.fetch;
  let fallbackCalled = false;
  globalThis.fetch = async () => {
    fallbackCalled = true;
    return new Response(JSON.stringify({ choices: [{ message: { content: 'fallback' } }] }), { status: 200 });
  };
  try {
    await assert.rejects(
      () => runTextModel(openRouterEnv, 'test-model', options, { routeMode: 'primary' }),
      /quota|429|limit/i,
    );
    assert.equal(fallbackCalled, false);
  } finally { globalThis.fetch = previousFetch; }
});

test('automatic mode uses OpenRouter only after a quota error', async () => {
  const previousFetch = globalThis.fetch;
  let calls = 0;
  const env = { ...openRouterEnv, AI: { run: async () => { throw Object.assign(new Error('quota exceeded'), { status: 429 }); } } };
  globalThis.fetch = async () => {
    calls++;
    return new Response(JSON.stringify({ model: 'free-model/test', choices: [{ message: { content: 'ok' } }] }), { status: 200 });
  };
  try {
    const result = await runTextModel(env, 'test-model', options, { routeMode: 'auto' });
    assert.equal(result.provider, 'openrouter');
    assert.equal(calls, 1);
  } finally { globalThis.fetch = previousFetch; }
});
