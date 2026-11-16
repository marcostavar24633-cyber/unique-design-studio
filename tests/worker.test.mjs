import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handle, robotsAllows, validateTarget } from '../worker/site-fetch.js';
import { root } from './helpers.mjs';

const ORIGIN = 'https://marcostavar24633-cyber.github.io';
const TEST_ENV = { RATE_LIMITER: { limit: async () => ({ success: true }) } };
const call = (path, { origin = ORIGIN, method = 'GET', env = TEST_ENV } = {}) => handle(new Request('https://w.dev' + path, { method, headers: origin ? { Origin: origin } : {} }), env);
/** Подменяет сеть на время одного теста. */
async function withNet(routes, fn) {
  const real = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (url, init) => { seen.push({ url, init }); const r = routes(new URL(url)); if (r instanceof Error) throw r; return r; };
  try { return await fn(seen); } finally { globalThis.fetch = real; }
}

test('Worker принимает только публичные http(s)-адреса по имени хоста', () => {
  for (const bad of ['ftp://a.ru', 'javascript:alert(1)', 'http://127.0.0.1/', 'http://10.0.0.5/', 'http://[::1]/', 'http://localhost/', 'http://router.local/', 'https://user:pass@a.ru/', 'https://a.ru:8443/', 'http://intranet/', '']) {
    assert.equal(validateTarget(bad).ok, false, bad);
  }
  assert.equal(validateTarget('https://пример.рф/страница?a=1#b').url.hash, '');
});

test('robots.txt: самое длинное правило выигрывает, группа для чужого бота не применяется', () => {
  const robots = 'User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /private\nAllow: /private/open\nDisallow: /*.pdf$';
  assert.equal(robotsAllows(robots, '/'), true);
  assert.equal(robotsAllows(robots, '/private/x'), false);
  assert.equal(robotsAllows(robots, '/private/open/x'), true);
  assert.equal(robotsAllows(robots, '/doc.pdf'), false);
  assert.equal(robotsAllows('', '/any'), true);
  assert.equal(robotsAllows('User-agent: UniqueDesignStudio-Analyzer\nDisallow: /', '/'), false);
});

test('Worker отвечает только разрешённым сайтам и только на GET', async () => {
  assert.equal((await call('/fetch?url=https://a.ru', { origin: 'https://evil.example' })).status, 403);
  assert.equal((await call('/fetch?url=https://a.ru', { origin: '' })).status, 403);
  assert.equal((await call('/fetch?url=https://a.ru', { method: 'POST' })).status, 405);
  const pre = await call('/fetch', { method: 'OPTIONS' });
  assert.equal(pre.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  const health = await call('/health');
  assert.deepEqual(await health.json(), { ok: true, service: 'uds-site-fetch', version: '1.0.0' });
  assert.equal((await (await call('/fetch?url=http://192.168.0.1/')).json()).reason, 'private-host');
});

test('Worker отдаёт страницу без cookie и авторизации, с честным User-Agent, и режет слишком большой ответ', async () => {
  const html = readFileSync(root + 'tests/fixtures/sample-site.html', 'utf8');
  await withNet(u => (u.pathname === '/robots.txt' ? new Response('', { status: 404 }) : new Response(html + ' '.repeat(2_000_000), { headers: { 'Content-Type': 'text/html; charset=utf-8' } })), async seen => {
    const body = await (await call('/fetch?url=https://demo-site.ru/')).json();
    assert.equal(body.ok, true);
    assert.equal(body.truncated, true);
    assert.ok(body.text.length <= 1_500_000 && body.text.includes('Мебель по вашим размерам'));
    const headers = seen[1].init.headers;
    assert.match(headers['User-Agent'], /^UniqueDesignStudio-Analyzer/);
    assert.ok(!('Cookie' in headers) && !('Authorization' in headers));
    assert.equal(seen[1].init.redirect, 'manual');
  });
});

test('Worker не обходит защиты: 403, проверка «я не робот», robots.txt, редирект во внутреннюю сеть', async () => {
  const reasonOf = async (routes, path = '/fetch?url=https://site.ru/page') => withNet(routes, async () => (await (await call(path)).json()));
  const noRobots = fn => u => (u.pathname === '/robots.txt' ? new Response('', { status: 404 }) : fn(u));
  assert.equal((await reasonOf(noRobots(() => new Response('no', { status: 403 })))).reason, 'protected');
  assert.equal((await reasonOf(noRobots(() => new Response('wait', { status: 429 })))).reason, 'protected');
  assert.equal((await reasonOf(noRobots(() => new Response('<html>', { headers: { 'Content-Type': 'text/html', 'cf-mitigated': 'challenge' } })))).reason, 'protected');
  assert.equal((await reasonOf(u => (u.pathname === '/robots.txt' ? new Response('User-agent: *\nDisallow: /page') : new Response('x')))).reason, 'robots');
  assert.equal((await reasonOf(noRobots(() => new Response(null, { status: 302, headers: { Location: 'http://169.254.169.254/latest/meta-data' } })))).reason, 'private-host');
  assert.equal((await reasonOf(noRobots(() => new Response('%PDF', { headers: { 'Content-Type': 'application/pdf' } })))).reason, 'content-type');
  assert.equal((await reasonOf(noRobots(() => new Response('gone', { status: 404 })))).reason, 'http');
  assert.equal((await reasonOf(noRobots(() => new Error('boom')))).reason, 'network');
});

test('Worker декодирует windows-1251 и отдаёт CSS только с типом text/css', async () => {
  const bytes = new Uint8Array([0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2]); // «Привет» в windows-1251
  await withNet(u => (u.pathname === '/robots.txt' ? new Response('', { status: 404 }) : new Response(bytes, { headers: { 'Content-Type': 'text/html; charset=windows-1251' } })), async () => {
    assert.equal((await (await call('/fetch?url=https://old.ru/')).json()).text, 'Привет');
  });
  await withNet(() => new Response('body{color:red}', { headers: { 'Content-Type': 'text/css' } }), async seen => {
    const body = await (await call('/fetch?kind=css&url=https://old.ru/s.css')).json();
    assert.equal(body.text, 'body{color:red}');
    assert.equal(seen.length, 1, 'для файла стилей robots.txt повторно не запрашивается');
  });
  await withNet(() => new Response('<html>', { headers: { 'Content-Type': 'text/html' } }), async () => {
    assert.equal((await (await call('/fetch?kind=css&url=https://old.ru/s.css')).json()).reason, 'content-type');
  });
});

test('в коде Worker и страницы библиотеки нет секретов и прямых запросов к чужим сайтам', () => {
  const worker = readFileSync(root + 'worker/site-fetch.js', 'utf8') + readFileSync(root + 'worker/wrangler.toml', 'utf8');
  assert.doesNotMatch(worker, /api[_-]?key|secret\s*=|token\s*=|bearer /i);
  const page = readFileSync(root + 'studio/templates.js', 'utf8');
  const fetches = [...page.matchAll(/fetch\(([^)]*)\)/g)].map(m => m[1]);
  assert.deepEqual(fetches, ['ep + path, { signal: ctrl.signal, headers: { Accept: \'application/json\' } }'], 'страница обращается только к анализатору-серверу');
});

test('robots.txt проверяется и для адреса, на который ведёт перенаправление', async () => {
  await withNet(u => {
    if (u.hostname === 'a-site.ru') return u.pathname === '/robots.txt' ? new Response('', { status: 404 }) : new Response(null, { status: 301, headers: { Location: 'https://b-site.ru/closed/page' } });
    if (u.pathname === '/robots.txt') return new Response('User-agent: *\nDisallow: /closed');
    return new Response('<html><body>секрет</body></html>', { headers: { 'Content-Type': 'text/html' } });
  }, async seen => {
    const body = await (await call('/fetch?url=https://a-site.ru/start')).json();
    assert.equal(body.reason, 'robots');
    assert.ok(!seen.some(s => s.url === 'https://b-site.ru/closed/page'), 'запрещённая страница не запрашивается');
  });
  await withNet(u => (u.pathname === '/robots.txt' ? new Response('', { status: 404 }) : u.hostname === 'a-site.ru' ? new Response(null, { status: 302, headers: { Location: 'https://b-site.ru/open' } }) : new Response('<html>ok</html>', { headers: { 'Content-Type': 'text/html' } })), async () => {
    const body = await (await call('/fetch?url=https://a-site.ru/start')).json();
    assert.equal(body.ok, true);
    assert.equal(body.finalUrl, 'https://b-site.ru/open');
  });
});

test('Worker fail-closed: без RATE_LIMITER не запрашивает целевой сайт', async () => {
  const req = new Request('https://w.dev/fetch?url=https://public-site.example/', {
    headers: { Origin: ORIGIN, 'CF-Connecting-IP': '203.0.113.11' }
  });
  const response = await handle(req, {});
  assert.equal(response.status, 503);
  assert.equal((await response.json()).reason, 'rate-limit-unconfigured');
});

test('при подключённом ограничителе частоты лишние запросы получают 429', async () => {
  const env = { RATE_LIMITER: { limit: async ({ key }) => ({ success: key !== '203.0.113.9' }) } };
  const req = ip => new Request('https://w.dev/fetch?url=http://192.168.0.1/', { headers: { Origin: ORIGIN, 'CF-Connecting-IP': ip } });
  assert.equal((await handle(req('203.0.113.9'), env)).status, 429);
  assert.equal((await handle(req('203.0.113.10'), env)).status, 400, 'обычный запрос доходит до проверки адреса');
});
