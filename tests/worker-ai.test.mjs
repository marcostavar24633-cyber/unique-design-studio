// Worker AI-генерации (worker/index.js): полнота ответа, повтор, ограничение частоты.
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import { MAX_OUTPUT_TOKENS, FALLBACK_LIMIT, allowRequest, missingFields, modelOutput, aboutNiche } from '../worker/ai-utils.js';
import { isQuotaError, runTextModel, DEFAULT_NVIDIA_MODEL, isFreeAiMode, isNvidiaFallbackEnabled } from '../worker/nvidia.js';

const ORIGIN = 'https://marcostavar24633-cyber.github.io';
let ip = 0;
const request = (body, { origin = ORIGIN, from = `10.0.0.${++ip}` } = {}) => new Request('https://w.dev/api/generate-landing', {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': from }, body: JSON.stringify(body),
});
const full = { title: 'Заголовок', description: 'Кофейня у дома', cta: 'Записаться', services: [['Услуга', 'Описание']] };
const aiReturning = (...answers) => {
  const calls = [];
  return { calls, AI: { run: async (model, opts) => { calls.push(opts); const a = answers[Math.min(calls.length - 1, answers.length - 1)]; if (a instanceof Error) throw a; return { response: a }; } } };
};

test('текстовая генерация всегда использует прямой Workers AI binding, игнорируя старые Gateway vars', async () => {
  const env = { ...aiReturning(JSON.stringify(full)), GATEWAY_API_URL: 'https://gateway.example', GATEWAY_PROJECT_TOKEN: 'legacy-token-must-not-be-used' };
  const res = await worker.fetch(request({ niche: 'кофейня' }), env);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.landing.title, 'Заголовок');
  assert.equal(body.provider, 'cloudflare');
  assert.equal(env.calls.length, 1);
});

test('Gateway vars без Workers AI binding не включают обходной маршрут', async () => {
  const previousFetch = globalThis.fetch;
  let networkCalls = 0;
  globalThis.fetch = async () => { networkCalls++; throw new Error('external route must not be called'); };
  try {
    const env = { GATEWAY_API_URL: 'https://gateway.example', GATEWAY_PROJECT_TOKEN: 'legacy-token' };
    const res = await worker.fetch(request({ niche: 'кофейня' }), env);
    assert.equal(res.status, 503);
    assert.match((await res.json()).error, /Workers AI binding AI не настроен/);
    assert.equal(networkCalls, 0);
  } finally { globalThis.fetch = previousFetch; }
});

test('распознаются только явные ошибки квоты и HTTP 429', () => {
  assert.equal(isQuotaError(Object.assign(new Error('Too many requests'), { status: 429 })), true);
  assert.equal(isQuotaError(new Error('Daily neuron limit exceeded')), true);
  assert.equal(isQuotaError(new Error('3036: You have used up your daily free allocation of 10,000 neurons.')), true);
  assert.equal(isQuotaError(new Error('3036')), true);
  assert.equal(isQuotaError(new Error('429')), true);
  assert.equal(isQuotaError(new Error('RESOURCE_EXHAUSTED')), true);
  assert.equal(isQuotaError(Object.assign(new Error('Internal error'), { status: 500 })), false);
  assert.equal(isQuotaError(new Error('Invalid JSON response')), false);
  assert.equal(DEFAULT_NVIDIA_MODEL, 'nvidia/nemotron-3.5-lightning-30b-a3b');
});

test('NVIDIA NIM вызывается только после квотной ошибки Workers AI и получает OpenAI-compatible payload', async () => {
  const previousFetch = globalThis.fetch;
  let sent;
  globalThis.fetch = async (url, init) => {
    sent = { url: String(url), init };
    return new Response(JSON.stringify({
      model: 'nvidia/test-model',
      choices: [{ message: { role: 'assistant', content: '{"ok":true}' } }],
      usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const env = {
      AI: { run: async () => { throw Object.assign(new Error('Too Many Requests'), { status: 429 }); } },
      NVIDIA_API_KEY: 'nvapi-test-only',
      NVIDIA_MODEL: 'nvidia/test-model',
      AI_BILLING_MODE: 'licensed',
      NVIDIA_NIM_ENABLED: 'true',
    };
    const execution = await runTextModel(env, '@cf/test/model', {
      messages: [{ role: 'user', content: 'test prompt' }],
      max_tokens: 256,
      temperature: 0.2,
    });
    assert.equal(execution.provider, 'nvidia');
    assert.equal(execution.model, 'nvidia/test-model');
    assert.equal(execution.result.usage.total_tokens, 18);
    assert.equal(sent.url, 'https://integrate.api.nvidia.com/v1/chat/completions');
    assert.equal(sent.init.headers.Authorization, 'Bearer nvapi-test-only');
    assert.equal(JSON.parse(sent.init.body).model, 'nvidia/test-model');
    assert.equal(JSON.parse(sent.init.body).stream, false);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('генерация лендинга переключается на NVIDIA после 429, сохраняя фактический usage и модель', async () => {
  const previousFetch = globalThis.fetch;
  let nvidiaCalls = 0;
  globalThis.fetch = async () => {
    nvidiaCalls++;
    return new Response(JSON.stringify({
      model: 'nvidia/test-model',
      choices: [{ message: { role: 'assistant', content: JSON.stringify(full) } }],
      usage: { prompt_tokens: 120, completion_tokens: 400, total_tokens: 520 },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const env = {
      AI: { run: async () => { throw Object.assign(new Error('Daily limit exceeded'), { status: 429 }); } },
      NVIDIA_API_KEY: 'nvapi-test-only',
      NVIDIA_MODEL: 'nvidia/test-model',
      AI_BILLING_MODE: 'licensed',
      NVIDIA_NIM_ENABLED: 'true',
    };
    const res = await worker.fetch(request({ niche: 'кофейня' }), env);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.provider, 'nvidia');
    assert.equal(body.model, 'nvidia/test-model');
    assert.deepEqual(body.usage, { inputTokens: 120, outputTokens: 400, totalTokens: 520 });
    assert.equal(nvidiaCalls, 1);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('ошибки Workers AI, не связанные с квотой, не отправляются в NVIDIA', async () => {
  const previousFetch = globalThis.fetch;
  let nvidiaCalls = 0;
  globalThis.fetch = async () => { nvidiaCalls++; throw new Error('unexpected NVIDIA request'); };
  try {
    const env = { AI: { run: async () => { throw Object.assign(new Error('Internal error'), { status: 500 }); } }, NVIDIA_API_KEY: 'nvapi-test-only' };
    await assert.rejects(() => runTextModel(env, '@cf/test/model', { messages: [] }), /Internal error/);
    assert.equal(nvidiaCalls, 0);
  } finally {
    globalThis.fetch = previousFetch;
  }
});


test('бесплатный режим включён по умолчанию и блокирует NVIDIA даже при наличии ключа', async () => {
  assert.equal(isFreeAiMode({}), true);
  assert.equal(isNvidiaFallbackEnabled({ NVIDIA_API_KEY: 'nvapi-test-only', NVIDIA_NIM_ENABLED: 'true' }), false);
  const previousFetch = globalThis.fetch;
  let nvidiaCalls = 0;
  globalThis.fetch = async () => { nvidiaCalls++; throw new Error('NVIDIA must not be called in free mode'); };
  try {
    const env = {
      AI: { run: async () => { throw Object.assign(new Error('Daily free allocation exceeded'), { status: 429 }); } },
      NVIDIA_API_KEY: 'nvapi-test-only',
      NVIDIA_NIM_ENABLED: 'true',
    };
    await assert.rejects(() => runTextModel(env, '@cf/test/model', { messages: [] }), /Daily free allocation exceeded/);
    await assert.rejects(() => runTextModel(env, '@cf/test/model', { messages: [] }, { preferNvidia: true }), /бесплатный режим/);
    assert.equal(nvidiaCalls, 0);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('NVIDIA fallback requires explicit non-free billing mode, enable flag and secret', () => {
  assert.equal(isNvidiaFallbackEnabled({ AI_BILLING_MODE: 'licensed', NVIDIA_NIM_ENABLED: 'true', NVIDIA_API_KEY: 'test' }), true);
  assert.equal(isNvidiaFallbackEnabled({ AI_BILLING_MODE: 'free', NVIDIA_NIM_ENABLED: 'true', NVIDIA_API_KEY: 'test' }), false);
  assert.equal(isNvidiaFallbackEnabled({ AI_BILLING_MODE: 'licensed', NVIDIA_API_KEY: 'test' }), false);
  assert.equal(isNvidiaFallbackEnabled({ AI_BILLING_MODE: 'licensed', NVIDIA_NIM_ENABLED: 'true' }), false);
});

test('корневой адрес показывает статус сервиса и доступные API-маршруты', async () => {
  const res = await worker.fetch(new Request('https://w.dev/'));
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.status, 'online');
  assert.equal(body.endpoints.health, '/health');
  assert.equal(body.endpoints.generate, 'POST /api/generate-landing');
});

test('health endpoint доступен без Origin и возвращает статус AI Worker', async () => {
  const res = await worker.fetch(new Request('https://w.dev/health'));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, service: 'unique-design-studio-ai' });
});

test('лимит ответа модели — 8192 токена', async () => {
  const env = aiReturning(JSON.stringify(full));
  const res = await worker.fetch(request({ niche: 'кофейня' }), env);
  assert.equal(res.status, 200);
  assert.equal(env.calls[0].max_tokens, MAX_OUTPUT_TOKENS);
  assert.equal(MAX_OUTPUT_TOKENS, 8192);
});

test('оборванный JSON — одна повторная попытка с просьбой ответить короче', async () => {
  const env = aiReturning('{"title":"Заголовок","description":"Опис', JSON.stringify(full));
  const res = await worker.fetch(request({ niche: 'кофейня' }), env);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.attempts, 2);
  assert.equal(env.calls.length, 2);
  assert.match(env.calls[1].messages[0].content, /Ответь короче/);
});

test('после двух неудач — честная ошибка, а не пустая страница; третьей попытки нет', async () => {
  const env = aiReturning(JSON.stringify({ title: 'Только заголовок' }));
  const res = await worker.fetch(request({ niche: 'кофейня' }), env);
  const body = await res.json();
  assert.equal(res.status, 502);
  assert.match(body.error, /неполный результат: нет description, cta, services/);
  assert.equal(env.calls.length, 2);
});

test('проверка обязательных частей ответа', () => {
  assert.deepEqual(missingFields(full), []);
  assert.deepEqual(missingFields(null), ['JSON-объекта']);
  assert.deepEqual(missingFields([]), ['JSON-объекта']);
  assert.deepEqual(missingFields({ ...full, services: [] }), ['services']);
  assert.deepEqual(missingFields({ ...full, title: '  ' }), ['title']);
});

test('частые запросы с одного адреса ограничиваются, даже без привязки Rate Limiting', async () => {
  const req = () => new Request('https://w.dev/api/generate-landing', { headers: { 'CF-Connecting-IP': '203.0.113.7' } });
  const t = 1_000_000;
  for (let i = 0; i < FALLBACK_LIMIT.requests; i++) assert.equal(await allowRequest(req(), {}, t + i), true);
  assert.equal(await allowRequest(req(), {}, t + 100), false, 'лимит исчерпан');
  assert.equal(await allowRequest(req(), {}, t + FALLBACK_LIMIT.windowMs + 200), true, 'через минуту снова можно');
});

test('если привязан AI_RATE_LIMITER — решение принимает он, и отказ возвращает 429 до обращения к модели', async () => {
  const env = { ...aiReturning(JSON.stringify(full)), AI_RATE_LIMITER: { limit: async () => ({ success: false }) } };
  const res = await worker.fetch(request({ niche: 'кофейня' }), env);
  assert.equal(res.status, 429);
  assert.equal(env.calls.length, 0);
});

test('чужой сайт и пустая ниша отклоняются без обращения к модели', async () => {
  const env = aiReturning(JSON.stringify(full));
  assert.equal((await worker.fetch(request({ niche: 'кофейня' }, { origin: 'https://evil.example' }), env)).status, 403);
  assert.equal((await worker.fetch(request({ niche: '' }), env)).status, 400);
  assert.equal(env.calls.length, 0);
});

test('ответ в формате OpenAI (Gemma 4 на Workers AI) разбирается, а не считается пустым', async () => {
  const openai = { choices: [{ message: { role: 'assistant', content: '```json\n' + JSON.stringify(full) + '\n```' } }], usage: { total_tokens: 900 } };
  const env = { AI: { run: async () => openai } };
  const res = await worker.fetch(request({ niche: 'кофейня' }), env);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).landing.title, 'Заголовок');
});

test('текст ответа извлекается из всех известных форматов Workers AI', () => {
  const t = JSON.stringify(full);
  assert.equal(modelOutput({ response: t }), t);
  assert.deepEqual(modelOutput({ response: full }), full);
  assert.equal(modelOutput({ result: { response: t } }), t);
  assert.equal(modelOutput({ choices: [{ message: { content: t } }] }), t);
  assert.equal(modelOutput({ choices: [{ message: { content: [{ type: 'text', text: t }] } }] }), t);
  assert.equal(modelOutput({ choices: [{ text: t }] }), t);
  assert.equal(modelOutput(t), t);
});

test('при неполном ответе ошибка называет ключи ответа модели, но не его содержимое', async () => {
  const env = { AI: { run: async () => ({ choices: [{ message: { content: '{"title":"секрет"}' } }], usage: {} }) } };
  const body = await (await worker.fetch(request({ niche: 'кофейня' }), env)).json();
  assert.match(body.error, /ключи ответа модели: choices, usage/);
  assert.doesNotMatch(body.error, /секрет/);
});

test('бриф идёт одним сообщением, и данные бизнеса стоят в нём текстом, а не теряются', async () => {
  const env = aiReturning(JSON.stringify(full));
  await worker.fetch(request({ niche: 'кофейня', brand: 'Зерно', city: 'Казань' }), env);
  const msgs = env.calls[0].messages;
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].role, 'user');
  assert.match(msgs[0].content, /Ниша бизнеса клиента: кофейня\.\nНазвание бренда: Зерно\.\nГород: Казань\./);
  assert.match(msgs[0].content, /не для веб-студии/);
});

test('текст не про нишу владельца — повтор, затем честная ошибка', async () => {
  const studio = { title: 'Разработка сайтов', description: 'Веб-дизайн под ключ', cta: 'Обсудить', services: [['Лендинг', 'Сайт']] };
  const env = aiReturning(JSON.stringify(studio));
  const res = await worker.fetch(request({ niche: 'кофейня' }), env);
  assert.equal(res.status, 502);
  assert.match((await res.json()).error, /не про нишу «кофейня»/);
  assert.equal(env.calls.length, 2);
  assert.equal(aboutNiche({ title: 'Свежий кофе' }, 'кофейня'), true);
  assert.equal(aboutNiche({ title: 'Диваны' }, 'магазин мебели'), false);
  assert.equal(aboutNiche({ title: 'x' }, 'СПА'), true, 'короткая ниша не блокирует ответ');
});

test('бренд и ниша в ответе — из ввода владельца, «Не указано» не попадает на сайт', async () => {
  const env = aiReturning(JSON.stringify({ ...full, brand: 'Не указано', niche: 'Веб-дизайн' }));
  const body = await (await worker.fetch(request({ niche: 'кофейня' }), env)).json();
  assert.equal(body.landing.niche, 'кофейня');
  assert.equal(body.landing.brand, '');
  const env2 = aiReturning(JSON.stringify({ ...full, brand: 'Другое' }));
  assert.equal((await (await worker.fetch(request({ niche: 'кофейня', brand: 'Зерно' }), env2)).json()).landing.brand, 'Зерно');
});

const imageRequest = (body, { origin = ORIGIN, from = `10.1.0.${++ip}`, method = 'POST' } = {}) =>
  new Request('https://w.dev/api/generate-image', {
    method,
    headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': from },
    body: method === 'GET' ? undefined : JSON.stringify(body),
  });

test('генерация изображения возвращает base64 и использует FLUX.1 Schnell', async () => {
  let called = null;
  const env = { AI: { run: async (model, options) => {
    called = { model, options };
    return { image: 'aGVsbG8=' };
  } } };
  const res = await worker.fetch(imageRequest({ prompt: 'premium coffee product photo' }), env);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.image, 'aGVsbG8=');
  assert.equal(body.mimeType, 'image/jpeg');
  assert.equal(called.model, '@cf/black-forest-labs/flux-1-schnell');
  assert.deepEqual(called.options, { prompt: 'premium coffee product photo', steps: 4 });
});

test('генерация изображения отклоняет пустой prompt и не расходует AI', async () => {
  let calls = 0;
  const env = { AI: { run: async () => { calls++; return { image: 'aGVsbG8=' }; } } };
  const res = await worker.fetch(imageRequest({ prompt: '   ' }), env);
  assert.equal(res.status, 400);
  assert.equal(calls, 0);
});

test('генерация изображения защищена Origin и rate limit', async () => {
  let calls = 0;
  const env = {
    AI: { run: async () => { calls++; return { image: 'aGVsbG8=' }; } },
    AI_RATE_LIMITER: { limit: async () => ({ success: false }) },
  };
  assert.equal((await worker.fetch(imageRequest({ prompt: 'coffee' }, { origin: 'https://evil.example' }), env)).status, 403);
  assert.equal((await worker.fetch(imageRequest({ prompt: 'coffee' }), env)).status, 429);
  assert.equal(calls, 0);
});

test('статистика Cloudflare требует секреты и проверяет период без внешнего запроса', async () => {
  const noSecrets = await worker.fetch(new Request('https://w.dev/api/usage', { headers: { Origin: ORIGIN } }), {});
  assert.equal(noSecrets.status, 503);
  const invalidRange = await worker.fetch(new Request('https://w.dev/api/usage?range=all', { headers: { Origin: ORIGIN } }), {
    CF_ANALYTICS_TOKEN: 'test-token',
    CF_ACCOUNT_ID: 'test-account',
  });
  assert.equal(invalidRange.status, 400);
});

test('AI Design Director returns bounded recommendations and allowlisted draft patches', async () => {
  const answer = JSON.stringify({ recommendations: [
    { id: 'hero-copy', title: 'Уточнить первый экран', category: 'conversion', priority: 'high', reason: 'Заголовок общий', action: 'Добавить конкретику', patch: { title: 'Авторские диваны для вашего интерьера', privateNote: 'не пропускать' } },
    ...Array.from({ length: 8 }, (_, i) => ({ id: 'extra-' + i, title: 'Дополнительная рекомендация', priority: 'low' })),
  ] });
  const env = aiReturning(answer);
  const res = await worker.fetch(request({ task: 'design-review', project: { niche: 'диваны', title: 'Диваны', services: [] } }), env);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.review.mode, 'workers-ai');
  assert.equal(body.review.recommendations.length, 6);
  assert.deepEqual(body.review.recommendations[0].patch, { title: 'Авторские диваны для вашего интерьера' });
  assert.equal(body.review.safety.autoApplied, false);
  assert.equal(body.review.safety.requiresApproval, true);
  assert.equal(env.calls[0].max_tokens, 1800);
});

test('AI Design Director rejects unauthorized origins and unavailable AI without calling a model', async () => {
  const blocked = await worker.fetch(request({ task: 'design-review', project: {} }, { origin: 'https://evil.example' }), aiReturning('{}'));
  assert.equal(blocked.status, 403);
  const unavailable = await worker.fetch(request({ task: 'design-review', project: {} }), {});
  assert.equal(unavailable.status, 503);
});

test('AI Design Director reports malformed model output as a gateway error', async () => {
  const res = await worker.fetch(request({ task: 'design-review', project: { niche: 'кофейня' } }), aiReturning('not-json'));
  assert.equal(res.status, 502);
});

test('Worker возвращает модель, попытки и фактические токены всех попыток — для журнала студии', async () => {
  const { usageOf, addUsage } = await import('../worker/ai-utils.js');
  assert.deepEqual(usageOf({ usage: { prompt_tokens: 900, completion_tokens: 2100, total_tokens: 3000 } }), { inputTokens: 900, outputTokens: 2100, totalTokens: 3000 });
  assert.equal(usageOf({ response: 'x' }), null, 'нет usage — нет выдуманных токенов');
  assert.deepEqual(addUsage({ inputTokens: 1, outputTokens: 2, totalTokens: 3 }, { inputTokens: 10, outputTokens: 20, totalTokens: 30 }), { inputTokens: 11, outputTokens: 22, totalTokens: 33 });
  let n = 0;
  const env = { AI: { run: async () => (++n === 1
    ? { choices: [{ message: { content: '{"title":"Только"}' } }], usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 } }
    : { choices: [{ message: { content: JSON.stringify(full) } }], usage: { prompt_tokens: 120, completion_tokens: 400, total_tokens: 520 } }) } };
  const body = await (await worker.fetch(request({ niche: 'кофейня' }), env)).json();
  assert.equal(body.attempts, 2);
  assert.match(body.model, /gemma/);
  assert.deepEqual(body.usage, { inputTokens: 220, outputTokens: 450, totalTokens: 670 }, 'неудачная попытка тоже учтена');
  assert.equal(typeof body.durationMs, 'number');
});

test('при ошибке генерации Worker тоже сообщает потраченные токены', async () => {
  const env = { AI: { run: async () => ({ choices: [{ message: { content: '{"title":"Только"}' } }], usage: { total_tokens: 80, prompt_tokens: 50, completion_tokens: 30 } }) } };
  const res = await worker.fetch(request({ niche: 'кофейня' }), env);
  const body = await res.json();
  assert.equal(res.status, 502);
  assert.equal(body.usage.totalTokens, 160);
});

test('формат ответа в конце запроса: только поля студии, без 8 больших разделов из задания для внешних AI', async () => {
  const { FORMAT_NOTE, LANDING_FIELDS, EXTRA_SECTIONS } = await import('../worker/ai-utils.js');
  const env = aiReturning(JSON.stringify(full));
  await worker.fetch(request({ niche: 'кофейня', studioPrompt: 'Дополнительно верни: brandStrategy, audienceProfiles, conversionMap.' }), env);
  const content = env.calls[0].messages[0].content;
  assert.ok(content.trimEnd().endsWith(FORMAT_NOTE.trim()), 'формат — последним, после задания студии');
  assert.ok(content.indexOf('ФОРМАТ ОТВЕТА') > content.indexOf('brandStrategy, audienceProfiles'), 'формат главнее и идёт позже');
  for (const f of ['title', 'services', 'seoDescription']) assert.ok(LANDING_FIELDS.includes(f));
  for (const f of ['brandStrategy', 'conversionMap', 'qualityReport']) assert.ok(EXTRA_SECTIONS.includes(f) && !LANDING_FIELDS.includes(f));
});

test('перечень полей Worker совпадает с тем, что читает студия (fromAiLanding)', async () => {
  const { readFileSync } = await import('node:fs');
  const { LANDING_FIELDS } = await import('../worker/ai-utils.js');
  const src = readFileSync(new URL('../src/engine/autopilot.js', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('export function fromAiLanding'));
  const used = new Set([...body.slice(0, 6000).matchAll(/\bl\.([a-zA-Z]+)/g)].map(m => m[1]).filter(k => !['designArchitecture', 'tier'].includes(k)));
  for (const f of used) assert.ok(LANDING_FIELDS.includes(f), `студия читает ${f}, а Worker его не просит`);
});

test('статистика today — с 00:00 UTC, когда сбрасывается суточный объём Workers AI', async () => {
  let sent;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => { sent = JSON.parse(init.body); return new Response(JSON.stringify({ data: { viewer: { accounts: [{ aiInferenceAdaptiveGroups: [] }] } } }), { status: 200 }); };
  try {
    const res = await worker.fetch(new Request('https://w.dev/api/usage?range=today', { headers: { Origin: ORIGIN } }), { CF_ANALYTICS_TOKEN: 't', CF_ACCOUNT_ID: 'a' });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.range, 'today');
    assert.match(sent.variables.start, /T00:00:00\.000Z$/, 'начало — полночь UTC');
    assert.equal((await worker.fetch(new Request('https://w.dev/api/usage?range=year', { headers: { Origin: ORIGIN } }), { CF_ANALYTICS_TOKEN: 't', CF_ACCOUNT_ID: 'a' })).status, 400);
  } finally { globalThis.fetch = realFetch; }
});

// Universal AI Gateway по Service Binding: текст идёт через шлюз, прямой Workers AI — запасной путь.
const gatewayReturning = (status, payload, seen) => ({
  fetch: async (url, init) => { seen.push({ url: String(url), init, body: JSON.parse(init.body) }); return new Response(JSON.stringify(payload), { status }); },
});

test('при настроенном шлюзе генерация идёт через него с той же моделью и токеном проекта', async () => {
  const seen = [];
  const env = { ...aiReturning(JSON.stringify(full)), GATEWAY_TOKEN: 'project-token',
    GATEWAY: gatewayReturning(200, { provider: 'groq', model: 'openai/gpt-oss-120b', fallback: true, choices: [{ message: { content: JSON.stringify(full) } }], usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 } }, seen) };
  const res = await worker.fetch(request({ niche: 'кофейня' }), env);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.provider, 'groq');
  assert.equal(body.route, 'gateway');
  assert.equal(body.gatewayError, undefined);
  assert.equal(body.landing.title, 'Заголовок');
  assert.equal(body.usage.totalTokens, 30);
  assert.equal(env.calls.length, 0, 'прямой Workers AI не вызывается, если шлюз ответил');
  assert.equal(seen[0].init.headers.Authorization, 'Bearer project-token');
  assert.equal(seen[0].body.model, '@cf/google/gemma-4-26b-a4b-it');
  assert.equal(seen[0].body.max_tokens, MAX_OUTPUT_TOKENS);
});

test('если шлюз не ответил, студия вызывает Workers AI напрямую', async () => {
  const seen = [];
  const env = { ...aiReturning(JSON.stringify(full)), GATEWAY_TOKEN: 'project-token',
    GATEWAY: gatewayReturning(503, { error: { code: 'PROVIDER_UNAVAILABLE' } }, seen) };
  const res = await worker.fetch(request({ niche: 'кофейня' }), env);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.provider, 'cloudflare');
  assert.equal(body.route, 'direct');
  assert.ok(body.gatewayError.includes('HTTP 503 (PROVIDER_UNAVAILABLE)'));
  assert.ok(!JSON.stringify(body).includes('project-token'));
  assert.equal(seen.length, 1);
  assert.equal(env.calls.length, 1);
});

test('привязка шлюза без токена проекта не используется', async () => {
  const seen = [];
  const env = { ...aiReturning(JSON.stringify(full)), GATEWAY: gatewayReturning(200, {}, seen) };
  const res = await worker.fetch(request({ niche: 'кофейня' }), env);
  assert.equal(res.status, 200);
  assert.equal(seen.length, 0);
  assert.equal(env.calls.length, 1);
});

test('генерация выключает рассуждения Gemma и на прямом пути, и через шлюз', async () => {
  const direct = aiReturning(JSON.stringify(full));
  await worker.fetch(request({ niche: 'кофейня' }), direct);
  assert.deepEqual(direct.calls[0].chat_template_kwargs, { enable_thinking: false });
  const seen = [];
  const env = { ...aiReturning(JSON.stringify(full)), GATEWAY_TOKEN: 't',
    GATEWAY: { fetch: async (url, init) => { seen.push(JSON.parse(init.body)); return new Response(JSON.stringify({ provider: 'cloudflare', choices: [{ message: { content: JSON.stringify(full) } }] }), { status: 200 }); } } };
  await worker.fetch(request({ niche: 'кофейня' }), env);
  assert.deepEqual(seen[0].chat_template_kwargs, { enable_thinking: false });
});

test('/api/visual-hints переводит нишу и позиции на английский и отбрасывает кириллицу', async () => {
  const answer = { niche: 'specialty coffee shop', setting: 'coffee bar', hero: 'barista at work', avoid: '', items: { 'Авторский раф': 'raf coffee in a glass', 'Эспрессо': 'эспрессо' } };
  const env = aiReturning(JSON.stringify(answer));
  const res = await worker.fetch(new Request('https://w.dev/api/visual-hints', { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.9.9.9' },
    body: JSON.stringify({ niche: 'кофейня', items: ['Авторский раф', 'Эспрессо'] }) }), env);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.hints.niche, 'specialty coffee shop');
  assert.deepEqual(body.hints.items, { 'Авторский раф': 'raf coffee in a glass' });
  assert.deepEqual(env.calls[0].chat_template_kwargs, { enable_thinking: false });
});

test('свой промт владельца не дублируется, если он уже встроен в задание студии', async () => {
  const env = aiReturning(JSON.stringify(full));
  await worker.fetch(request({ niche: 'кофейня', studioPrompt: 'Задание студии. SPECIAL_CUSTOM_INSTRUCTION', customPrompt: 'SPECIAL_CUSTOM_INSTRUCTION' }), env);
  assert.equal(env.calls[0].messages[0].content.split('SPECIAL_CUSTOM_INSTRUCTION').length - 1, 1);
});

test('свой промт без задания студии по-прежнему попадает в факты', async () => {
  const env = aiReturning(JSON.stringify(full));
  await worker.fetch(request({ niche: 'кофейня', customPrompt: 'ONLY_IN_CUSTOM' }), env);
  assert.match(env.calls[0].messages[0].content, /Пожелания владельца \(дополнительно\): ONLY_IN_CUSTOM/);
});

test('большой UTF-8 бриф больше прежних 24 КБ принимается в пределах нового лимита', async () => {
  const env = aiReturning(JSON.stringify(full));
  const body = { niche: 'кофейня', studioPrompt: 'я'.repeat(15_000) };
  const encoded = JSON.stringify(body);
  assert.ok(new TextEncoder().encode(encoded).byteLength > 24_000);
  assert.ok(new TextEncoder().encode(encoded).byteLength < 64_000);
  const res = await worker.fetch(request(body), env);
  assert.equal(res.status, 200);
  assert.equal(env.calls.length, 1);
});

test('запрос больше 64 КБ отклоняется по размеру UTF-8 до обращения к AI', async () => {
  const env = aiReturning(JSON.stringify(full));
  const body = { niche: 'кофейня', studioPrompt: 'я'.repeat(33_000) };
  const res = await worker.fetch(request(body), env);
  const payload = await res.json();
  assert.equal(res.status, 413);
  assert.equal(payload.maxBytes, 64_000);
  assert.match(payload.error, /лимит 64000 байт/);
  assert.equal(env.calls.length, 0);
});

test('customPrompt не дублируется Worker, если он уже встроен в studioPrompt', async () => {
  const env = aiReturning(JSON.stringify(full));
  await worker.fetch(request({
    niche: 'кофейня',
    studioPrompt: 'Задание студии. SPECIAL_CUSTOM_INSTRUCTION',
    customPrompt: 'SPECIAL_CUSTOM_INSTRUCTION',
  }), env);
  const prompt = env.calls[0].messages[0].content;
  assert.equal(prompt.split('SPECIAL_CUSTOM_INSTRUCTION').length - 1, 1);
});


test('API запускает staged Content Engine и возвращает объединённые секции с метаданными этапов', async () => {
  const outputs = [
    { title: 'Кофе рядом', description: 'Свежий кофе', cta: 'Выбрать', targetAudience: 'Жители района', mainOffer: 'Кофе', visualDirection: 'Тёплый', strategySummary: 'Локальная кофейня' },
    { aboutTitle: 'О нас', aboutText: 'Готовим кофе.' },
    { servicesTitle: 'Меню', servicesIntro: 'Напитки', services: [['Капучино', 'Кофе с молоком', '']] },
    { advantagesTitle: 'Преимущества', advantages: [['Свежесть', 'Свежая обжарка']], processTitle: 'Заказ', process: [['Выберите напиток', 'Оформите заказ']], faqs: [['Где мы?', 'В центре района']] },
    { contactTitle: 'Контакты', contactText: 'Приходите', seoTitle: 'Кофейня рядом', seoDescription: 'Кофе каждый день' },
  ];
  let calls = 0;
  const env = { AI: { run: async (_model, options) => {
    const value = outputs[calls++];
    return { response: JSON.stringify(value), usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 } };
  } } };
  const res = await worker.fetch(request({ niche: 'кофейня', contentEngine: 'staged' }), env);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.generation.mode, 'staged');
  assert.equal(body.generation.status, 'completed');
  assert.equal(body.generation.completedStages, 5);
  assert.equal(body.landing.title, 'Кофе рядом');
  assert.deepEqual(body.landing.services, outputs[2].services);
  assert.equal(calls, 5);
});


test('API точечной перегенерации возвращает один раздел и фактический usage', async () => {
  let calls = 0;
  const env = { AI: { run: async (_model, options) => {
    calls++;
    assert.equal(options.max_tokens, 900);
    assert.match(options.messages[0].content, /Текущие данные проекта/);
    return { response: JSON.stringify({ aboutTitle: 'О кофейне', aboutText: 'Готовим кофе каждый день.' }), usage: { prompt_tokens: 12, completion_tokens: 18, total_tokens: 30 } };
  } } };
  const res = await worker.fetch(request({
    niche: 'кофейня', brand: 'Зерно', contentStage: 'about',
    existingLanding: { title: 'Кофе рядом', aboutTitle: 'Старый заголовок', injected: 'ignore' },
    editorialDirection: 'Тёплый тон',
  }), env);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.stage.id, 'about');
  assert.equal(body.stage.status, 'completed');
  assert.deepEqual(body.content, { aboutTitle: 'О кофейне', aboutText: 'Готовим кофе каждый день.' });
  assert.deepEqual(body.usage, { inputTokens: 12, outputTokens: 18, totalTokens: 30 });
  assert.equal(calls, 1);
});

test('API точечной перегенерации отклоняет запрос без текущего объекта проекта', async () => {
  const env = aiReturning(JSON.stringify({ aboutTitle: 'О нас', aboutText: 'Текст' }));
  const res = await worker.fetch(request({ niche: 'кофейня', contentStage: 'about' }), env);
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /текущий контент проекта/);
  assert.equal(env.calls.length, 0);
});

test('API точечной перегенерации не принимает неизвестный этап', async () => {
  const env = aiReturning(JSON.stringify({ aboutTitle: 'О нас', aboutText: 'Текст' }));
  const res = await worker.fetch(request({ niche: 'кофейня', contentStage: 'unknown', existingLanding: {} }), env);
  assert.equal(res.status, 502);
  assert.match((await res.json()).error, /Неизвестный этап/);
  assert.equal(env.calls.length, 0);
});


test('API AI-редактора возвращает новый текст только для выбранного поля', async () => {
  let calls = 0;
  const env = { AI: { run: async (_model, options) => {
    calls++;
    assert.equal(options.max_tokens, 700);
    assert.match(options.messages[0].content, /Сократи текст/);
    return { response: JSON.stringify({ value: 'Короткий и ясный текст.' }), usage: { prompt_tokens: 8, completion_tokens: 12, total_tokens: 20 } };
  } } };
  const res = await worker.fetch(request({
    niche: 'кофейня', brand: 'Зерно', contentField: 'description', editAction: 'shorten',
    currentValue: 'Очень длинное исходное описание кофейни.',
    existingLanding: { title: 'Кофе рядом', description: 'Очень длинное исходное описание кофейни.' },
  }), env);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.field, 'description');
  assert.equal(body.action, 'shorten');
  assert.equal(body.value, 'Короткий и ясный текст.');
  assert.deepEqual(body.usage, { inputTokens: 8, outputTokens: 12, totalTokens: 20 });
  assert.equal(calls, 1);
});

test('API AI-редактора блокирует массивы, неизвестные поля и команды', async () => {
  const env = aiReturning(JSON.stringify({ value: 'Текст' }));
  const base = { niche: 'кофейня', currentValue: 'Исходный текст', existingLanding: {} };
  const arrayField = await worker.fetch(request({ ...base, contentField: 'services', editAction: 'rewrite' }), env);
  assert.equal(arrayField.status, 502);
  assert.match((await arrayField.json()).error, /нельзя редактировать/);
  const invalidAction = await worker.fetch(request({ ...base, contentField: 'title', editAction: 'translate' }), env);
  assert.equal(invalidAction.status, 502);
  assert.match((await invalidAction.json()).error, /Неизвестная команда/);
  assert.equal(env.calls.length, 0);
});


test('API проверки качества возвращает оценку и ограниченные AI-рекомендации без изменения проекта', async () => {
  const env = { AI: { run: async (_model, options) => {
    assert.equal(options.max_tokens, 1300);
    assert.match(options.messages[0].content, /веб-поиска нет/i);
    return { response: JSON.stringify({ recommendations: [
      { category:'seo', priority:'high', issue:'SEO title слишком общий', recommendation:'Добавьте основную услугу.', field:'seoTitle' },
    ] }), usage:{ prompt_tokens:10, completion_tokens:20, total_tokens:30 } };
  } } };
  const project = { niche:'кофейня', title:'Кофе рядом', description:'Свежий кофе', cta:'Открыть меню' };
  const res = await worker.fetch(request({ niche:'кофейня', contentQualityReview:true, project }), env);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.ok(body.review.score < 100);
  assert.equal(body.review.recommendations[0].field, 'seoTitle');
  assert.equal(body.review.safety.contentChanged, false);
  assert.equal(body.review.safety.webSearchPerformed, false);
  assert.equal(project.title, 'Кофе рядом');
});

test('API проверки качества требует объект проекта и не вызывает модель без него', async () => {
  const env = aiReturning('{}');
  const res = await worker.fetch(request({ niche:'кофейня', contentQualityReview:true }), env);
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /объект проекта/);
  assert.equal(env.calls.length, 0);
});

test('по умолчанию лендинг генерируется одним запросом и помечен как завершённый', async () => {
  const env = aiReturning(JSON.stringify(full));
  const body = await (await worker.fetch(request({ niche: 'кофейня', contentEngine: 'auto' }), env)).json();
  assert.equal(env.calls.length, 1);
  assert.deepEqual(body.generation, { mode: 'single', status: 'completed' });
});

test('если одиночный запрос дважды не удался, режим auto спасает результат поэтапным движком', async () => {
  const stageAnswers = [
    { brand: 'Зерно', niche: 'кофейня', title: 'Кофе рядом', description: 'Кофейня у дома', cta: 'Зайти', targetAudience: 'Соседи', mainOffer: 'Кофе', visualDirection: 'Тепло', strategySummary: 'Кофейня у дома' },
    { aboutTitle: 'О нас', aboutText: 'Кофейня у дома.' },
    { servicesTitle: 'Меню', servicesIntro: 'Напитки', services: [['Капучино', 'Кофе с молоком', '']] },
    { advantagesTitle: 'Почему мы', processTitle: 'Как заказать', advantages: [['Свежий кофе', 'Каждый день']], process: [['Выбрать', 'Напиток']], faqs: [['Есть ли выпечка?', 'Да']] },
    { contactTitle: 'Контакты', contactText: 'Ждём вас', assumptions: [], marketResearch: '', researchSources: [], segments: [], objections: [], triggers: [], keywords: ['кофейня'], competitors: [], seoTitle: 'Кофейня', seoDescription: 'Кофе', imagePrompts: [] },
  ];
  const env = aiReturning('{"oops":', '{"oops":', ...stageAnswers.map(answer => JSON.stringify(answer)));
  const res = await worker.fetch(request({ niche: 'кофейня', contentEngine: 'auto' }), env);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.generation.mode, 'staged');
  assert.equal(body.generation.status, 'completed');
  assert.equal(body.landing.title, 'Кофе рядом');
  assert.equal(env.calls.length, 7);
});

test('без режима auto неудачный одиночный запрос не запускает поэтапный движок', async () => {
  const env = aiReturning('{"oops":');
  const res = await worker.fetch(request({ niche: 'кофейня' }), env);
  assert.equal(res.status, 502);
  assert.equal(env.calls.length, 2);
});
