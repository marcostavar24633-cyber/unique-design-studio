// Worker AI-генерации (worker/index.js): полнота ответа, повтор, ограничение частоты.
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import { MAX_OUTPUT_TOKENS, FALLBACK_LIMIT, allowRequest, missingFields, modelOutput, aboutNiche } from '../worker/ai-utils.js';

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

test('лимит ответа модели — 6000 токенов', async () => {
  const env = aiReturning(JSON.stringify(full));
  const res = await worker.fetch(request({ niche: 'кофейня' }), env);
  assert.equal(res.status, 200);
  assert.equal(env.calls[0].max_tokens, MAX_OUTPUT_TOKENS);
  assert.equal(MAX_OUTPUT_TOKENS, 6000);
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
