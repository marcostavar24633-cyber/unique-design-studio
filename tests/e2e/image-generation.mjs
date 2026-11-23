// Проверка реального клиентского потока генерации изображений через mock Worker.
// Текстовый endpoint имитируется. Ответ для фото — тестовый PNG или JSON,
// полученный отдельным живым staging probe и переданный через UDS_IMAGE_RESPONSE_FILE.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { extname, isAbsolute, relative, resolve } from 'node:path';
import { root } from '../helpers.mjs';

let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); }
catch { console.error('Playwright не найден. Установите его перед запуском E2E.'); process.exit(1); }

const imageResponseFile = process.env.UDS_IMAGE_RESPONSE_FILE;
const imageResponse = imageResponseFile ? JSON.parse(readFileSync(imageResponseFile, 'utf8')) : {
  image: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pWQAAAAASUVORK5CYII=',
  mimeType: 'image/png',
  model: 'mock-flux',
  usage: { totalTokens: 7 },
  route: 'direct',
  provider: 'cloudflare'
};
const matchesImageJournal = entry => entry.status === 'ok'
  && entry.model === imageResponse.model
  && entry.route === (imageResponse.route || '')
  && entry.provider === (imageResponse.provider || '')
  && (entry.tokens ?? null) === (imageResponse.usage?.totalTokens ?? null);

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };
const servingRoot = realpathSync(root);
const server = createServer((req, res) => {
  let file;
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    // Resolve against the root, then check path boundaries (not a string prefix).
    const candidate = resolve(servingRoot, '.' + pathname);
    const relativePath = relative(servingRoot, candidate);
    if (relativePath === '..' || relativePath.split(/[\\\\/]/)[0] === '..' || isAbsolute(relativePath)) {
      res.writeHead(404); res.end('not found'); return;
    }
    // Also reject symlinks that escape the served tree.
    file = realpathSync(candidate);
    const realRelative = relative(servingRoot, file);
    if (realRelative === '..' || realRelative.split(/[\\\\/]/)[0] === '..' || isAbsolute(realRelative) || !existsSync(file) || statSync(file).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
  } catch {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch();
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
let textRequests = 0;
let hintRequests = 0;
const imageRequests = [];
const transientFailures = ['server outage', 'rate limit', 'network timeout'];
const failedImageRequests = new Map();
const recoveredImageFailures = new Set();
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
      // Fail one attempt for each of three different image requests.
      const key = JSON.stringify(payload);
      const previousFailure = failedImageRequests.get(key);
      if (!previousFailure && failedImageRequests.size < transientFailures.length) {
        const failure = transientFailures[failedImageRequests.size];
        failedImageRequests.set(key, failure);
        if (failure === 'network timeout') return route.abort('timedout');
        const headers = failure === 'rate limit'
          ? { ...cors, 'retry-after': '1', 'access-control-expose-headers': 'retry-after' }
          : cors;
        return route.fulfill({
          status: failure === 'rate limit' ? 429 : 503,
          headers,
          contentType: 'application/json',
          body: JSON.stringify({ error: failure })
        });
      }
      if (previousFailure) recoveredImageFailures.add(previousFailure);
      imageRequests.push(payload);
      return route.fulfill({
        status: 200,
        headers: cors,
        contentType: 'application/json',
        body: JSON.stringify(imageResponse)
      });
    }
    return route.fulfill({ status: 404, headers: cors, contentType: 'application/json', body: JSON.stringify({ error: 'unexpected mock route' }) });
  });

  await page.goto(base + '/studio/index.html', { waitUntil: 'networkidle' });
  // The studio starts on the dashboard; editor tabs are hidden until Create is opened.
  await page.click('[data-dash="create"]');
  await page.locator('#ptab-own').waitFor({ state: 'visible' });
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
      gallerySources: (raw.gallery || []).map(item => item?.src).filter(Boolean),
      services: services.filter(item => Array.isArray(item) ? Boolean(item[3]) : Boolean(item?.image)).length,
      serviceSources: services.map(item => Array.isArray(item) ? item[3] : item?.image).filter(Boolean),
      imageJournal: journal.filter(entry => entry.kind === 'image')
    };
  });

  check(textRequests >= 1, 'локальный fallback не подтвердился: не было неудачных запросов текста');
  check(hintRequests === 1, 'visual-hints вызван ' + hintRequests + ' раз вместо одного');
  for (const failure of transientFailures) {
    check(recoveredImageFailures.has(failure), 'не подтверждён успешный повтор запроса: ' + failure);
  }
  check(imageRequests.length > 0 && imageRequests.length <= 15, 'неверное число запросов изображений: ' + imageRequests.length);
  check(imageRequests.every(item => typeof item.prompt === 'string' && item.prompt.length > 0 && item.aspect), 'запрос изображения не содержит prompt или aspect');
  check(snapshot.hero.startsWith('data:image/'), 'сгенерированное главное фото не сохранено в images.hero');
  check(snapshot.gallery > 0, 'сгенерированные изображения не добавлены в галерею');
  check([...snapshot.gallerySources, ...snapshot.serviceSources].every(src => typeof src === 'string' && src.startsWith('data:image/')), 'галерея или услуги содержат не встроенный image data URI');
  check(snapshot.imageJournal.length === imageRequests.length, 'журнал AI содержит ' + snapshot.imageJournal.length + ' image-записей при ' + imageRequests.length + ' запросах');
  check(snapshot.imageJournal.every(matchesImageJournal), 'журнал не сохранил model/route/provider/usage из ответа Worker');
  check(await page.locator('#form .media-preview img').count() > 0, 'главное изображение не отображается в редакторе');
  check(await page.locator('#form [data-gallery-item]').count() > 0, 'галерея не отрисовала сгенерированные изображения');
  check(snapshot.services > 0, 'сгенерированные изображения не сохранены в карточках услуг');

  // A successful in-memory render is not enough: verify that generated image
  // references and usage metadata survive a full studio reload.
  await page.reload({ waitUntil: 'networkidle' });
  const restored = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('uds:studio:v1') || 'null');
    const raw = saved?.raw || {};
    const journal = JSON.parse(localStorage.getItem('uds:ai-journal:v1') || '[]');
    return {
      hero: raw.images?.hero || '',
      gallery: (raw.gallery || []).filter(item => item?.src).length,
      gallerySources: (raw.gallery || []).map(item => item?.src).filter(Boolean),
      services: (raw.services || []).filter(item => Array.isArray(item) ? Boolean(item[3]) : Boolean(item?.image)).length,
      serviceSources: (raw.services || []).map(item => Array.isArray(item) ? item[3] : item?.image).filter(Boolean),
      imageJournal: journal.filter(entry => entry.kind === 'image')
    };
  });
  check(restored.hero === snapshot.hero, 'главное изображение потеряно после перезагрузки');
  check(restored.gallery === snapshot.gallery, 'изображения галереи потеряны после перезагрузки');
  check(JSON.stringify(restored.gallerySources) === JSON.stringify(snapshot.gallerySources), 'источники изображений галереи изменились после перезагрузки');
  check(restored.services === snapshot.services, 'изображения услуг потеряны после перезагрузки');
  check(JSON.stringify(restored.serviceSources) === JSON.stringify(snapshot.serviceSources), 'источники изображений услуг изменились после перезагрузки');
  check(imageRequests.length === snapshot.imageJournal.length, 'перезагрузка неожиданно вызвала повторную генерацию изображений');
  check(restored.imageJournal.length === snapshot.imageJournal.length, 'AI journal потерял записи после перезагрузки');
  check(restored.imageJournal.every(matchesImageJournal), 'AI journal потерял model/route/provider/usage после перезагрузки');
  check(appErrors.length === 0, 'ошибки JavaScript студии: ' + appErrors.join('; '));

  await context.close();
} finally {
  await browser.close();
  server.close();
}
if (failures.length) { console.error('Image generation E2E: ' + failures.join('\n- ')); process.exit(1); }
console.log(imageResponseFile
  ? 'Staging image E2E пройден: вставка изображения Cloudflare, сохранение, перезагрузка и AI journal.'
  : 'Image generation E2E пройден: mock Worker, вставка, сохранение и AI journal.');
