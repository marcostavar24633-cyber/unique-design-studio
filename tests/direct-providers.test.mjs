import test from 'node:test';
import assert from 'node:assert/strict';
import { isDirectProviderEnabled, runDirectProvider } from '../worker/direct-providers.js';

test('GPT and Claude API providers require explicit API billing, enable flag, and secret', () => {
  assert.equal(isDirectProviderEnabled({ AI_BILLING_MODE: 'free', AI_DIRECT_PROVIDERS_ENABLED: 'true', OPENAI_API_KEY: 'x' }, 'openai'), false);
  assert.equal(isDirectProviderEnabled({ AI_BILLING_MODE: 'api', OPENAI_API_KEY: 'x' }, 'openai'), false);
  assert.equal(isDirectProviderEnabled({ AI_BILLING_MODE: 'api', AI_DIRECT_PROVIDERS_ENABLED: 'true' , ANTHROPIC_API_KEY: 'x' }, 'anthropic'), true);
  assert.equal(isDirectProviderEnabled({ AI_BILLING_MODE: 'api', AI_DIRECT_PROVIDERS_ENABLED: 'true', OPENAI_API_KEY: 'x' }, 'openai'), true);
});

test('OpenAI adapter normalizes chat completion response', async () => {
  const previousFetch = globalThis.fetch;
  let sent;
  globalThis.fetch = async (url, init) => {
    sent = { url: String(url), init };
    return new Response(JSON.stringify({ model: 'gpt-test', choices: [{ message: { content: 'hello' } }], usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 } }), { status: 200 });
  };
  try {
    const result = await runDirectProvider({ AI_BILLING_MODE: 'api', AI_DIRECT_PROVIDERS_ENABLED: 'true', OPENAI_API_KEY: 'secret' }, 'openai', { messages: [{ role: 'user', content: 'hi' }], max_tokens: 20 });
    assert.equal(sent.url, 'https://api.openai.com/v1/chat/completions');
    assert.equal(sent.init.headers.Authorization, 'Bearer secret');
    assert.equal(result.provider, 'openai');
    assert.equal(result.result.choices[0].message.content, 'hello');
    assert.equal(result.result.usage.total_tokens, 5);
  } finally { globalThis.fetch = previousFetch; }
});

test('Anthropic adapter converts system, text and usage to the common model shape', async () => {
  const previousFetch = globalThis.fetch;
  let sent;
  globalThis.fetch = async (url, init) => {
    sent = { url: String(url), init };
    return new Response(JSON.stringify({ model: 'claude-test', content: [{ type: 'text', text: 'bonjour' }], usage: { input_tokens: 4, output_tokens: 6 } }), { status: 200 });
  };
  try {
    const result = await runDirectProvider({ AI_BILLING_MODE: 'api', AI_DIRECT_PROVIDERS_ENABLED: 'true', ANTHROPIC_API_KEY: 'secret' }, 'anthropic', { messages: [{ role: 'system', content: 'rules' }, { role: 'user', content: 'hi' }], max_tokens: 20 });
    const body = JSON.parse(sent.init.body);
    assert.equal(sent.url, 'https://api.anthropic.com/v1/messages');
    assert.equal(sent.init.headers['x-api-key'], 'secret');
    assert.equal(body.system, 'rules');
    assert.equal(body.messages.length, 1);
    assert.equal(result.provider, 'anthropic');
    assert.equal(result.result.choices[0].message.content, 'bonjour');
    assert.equal(result.result.usage.total_tokens, 10);
  } finally { globalThis.fetch = previousFetch; }
});

test('direct provider quota response preserves HTTP status for free fallback routing', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'quota exceeded' } }), { status: 429 });
  try {
    await assert.rejects(
      () => runDirectProvider({ AI_BILLING_MODE: 'api', AI_DIRECT_PROVIDERS_ENABLED: 'true', OPENAI_API_KEY: 'secret' }, 'openai', { messages: [], max_tokens: 10 }),
      error => error.status === 429 && /HTTP 429/.test(error.message),
    );
  } finally { globalThis.fetch = previousFetch; }
});
