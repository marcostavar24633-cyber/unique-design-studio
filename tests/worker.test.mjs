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
