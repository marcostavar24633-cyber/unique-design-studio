// Проверка реального клиентского потока генерации изображений через mock Worker.
// Внешний AI/Cloudflare не вызывается: текстовый endpoint намеренно недоступен,
// локальный автопилот продолжает работу, а image endpoint возвращает тестовый PNG.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { root } from '../helpers.mjs';

let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); }
catch { console.error('Playwright не найден. Установите его перед запуском E2E.'); process.exit(1); }

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };
const server = createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const relative = normalize(pathname).replace(/^[/\\]+/, '');
  const file = join(root, relative);
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch();
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pWQAAAAASUVORK5CYII=';
let textRequests = 0;
let hintRequests = 0;
const imageRequests = [];
const appErrors = [];
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('pageerror', error => {
    const stack = String(error.stack || error.message);
    if (/\/studio\/(?:studio|ai-diagnostics)\.js|\/studio\/index\.html/.test(stack)) appErrors.push(stack);
  });
  await page.route('https://example.test/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type'
    };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (url.pathname.endsWith('/api/generate-landing')) {
      textRequests++;
      return route.fulfill({ status: 503, headers: cors, contentType: 'application/json', body: JSON.stringify({ error: 'mock text AI unavailable' }) });
    }
    if (url.pathname.endsWith('/api/visual-hints')) {
      hintRequests++;
      return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: '{}' });
    }
    if (url.pathname.endsWith('/api/generate-image')) {
      const payload = JSON.parse(request.postData() || '{}');
      imageRequests.push(payload);
      return route.fulfill({
        status: 200,
        headers: cors,
        contentType: 'application/json',
        body: JSON.stringify({
          image: tinyPng,
          mimeType: 'image/png',
          model: 'mock-flux',
          usage: { totalTokens: 7 },
          route: 'direct',
          provider: 'cloudflare'
        })
      });
    }
    return route.fulfill({ status: 404, headers: cors, contentType: 'application/json', body: JSON.stringify({ error: 'unexpected mock route' }) });
  });

  await page.goto(base + '/studio/index.html', { waitUntil: 'networkidle' });
  await page.click('#ptab-own');
  await page.locator('#auto-endpoint').waitFor({ state: 'visible' });
  await page.fill('#auto-endpoint', 'https://example.test/api/generate-landing');
  await page.click('#ptab-ai');
  await page.fill('#auto-niche', 'Кофейня у моря');
  await page.fill('#auto-brand', 'CAFE IMAGE E2E');
  await page.click('#auto-go');

  await page.waitForFunction(
    () => document.querySelector('#auto-status')?.textContent.includes('Автоматически созданы и вставлены изображения'),
    null,
    { timeout: 60000 }
  );
  await page.waitForFunction(() => document.querySelector('#auto-go')?.disabled === false, null, { timeout: 10000 });

  const snapshot = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('uds:studio:v1') || 'null');
    const raw = saved?.raw || {};
    const services = Array.isArray(raw.services) ? raw.services : [];
    const journal = JSON.parse(localStorage.getItem('uds:ai-journal:v1') || '[]');
    return {
      hero: raw.images?.hero || '',
      gallery: (raw.gallery || []).filter(item => item?.src).length,
      services: services.filter(item => Array.isArray(item) ? Boolean(item[3]) : Boolean(item?.image)).length,
      imageJournal: journal.filter(entry => entry.kind === 'image')
    };
  });

  check(textRequests === 2, 'локальный fallback не подтвердился: ожидалось 2 неудачных запроса текста, получено ' + textRequests);
  check(hintRequests === 1, 'visual-hints вызван ' + hintRequests + ' раз вместо одного');
  check(imageRequests.length > 0 && imageRequests.length <= 15, 'неверное число запросов изображений: ' + imageRequests.length);
  check(imageRequests.every(item => typeof item.prompt === 'string' && item.prompt.length > 0 && item.aspect), 'запрос изображения не содержит prompt или aspect');
  check(snapshot.hero.startsWith('data:image/'), 'сгенерированное главное фото не сохранено в images.hero');
  check(snapshot.gallery > 0, 'сгенерированные изображения не добавлены в галерею');
  check(snapshot.imageJournal.length === imageRequests.length, 'журнал AI содержит ' + snapshot.imageJournal.length + ' image-записей при ' + imageRequests.length + ' запросах');
  check(snapshot.imageJournal.some(entry => entry.status === 'ok' && entry.route === 'direct' && entry.provider === 'cloudflare' && entry.tokens === 7), 'журнал не сохранил реальные route/provider/usage-поля mock Worker');
  check(await page.locator('#form .media-preview img').count() > 0, 'главное изображение не отображается в редакторе');
  check(await page.locator('#form [data-gallery-item]').count() > 0, 'галерея не отрисовала сгенерированные изображения');
  check(appErrors.length === 0, 'ошибки JavaScript студии: ' + appErrors.join('; '));

  await context.close();
} finally {
  await browser.close();
  server.close();
}
if (failures.length) { console.error('Image generation E2E: ' + failures.join('\n- ')); process.exit(1); }
console.log('Image generation E2E пройден: fallback на локальный автопилот, visual hints, Worker image mock, оптимизация, вставка фото и AI journal.');
