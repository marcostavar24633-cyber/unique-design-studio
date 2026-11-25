// Быстрая браузерная проверка демонстрационного заполнения и необязательного квиза.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { generate } from '../../src/engine/index.js';
import { full, root } from '../helpers.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://localhost').pathname)).replace(/^[/\\]+/, '');
  const file = join(root, path);
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/studio/index.html`, { waitUntil: 'domcontentloaded' });
  await page.fill('#qs-niche', 'Тестовая студия интерьера');
  await page.fill('#qs-brand', 'E2E');
  await page.locator('#quick-start').evaluate(form => form.requestSubmit());
  await page.waitForFunction(() => document.querySelector('#form [data-demo-fill]'), null, { timeout: 20000 });
  await page.locator('#ptab-editor').click();
  await page.locator('[data-demo-fill]').click();
  await page.waitForFunction(() => {
    const html = document.querySelector('#frame')?.getAttribute('srcdoc') || '';
    return html.includes('id="pricing"') && html.includes('id="cases"') && html.includes('data-uds-quiz');
  }, null, { timeout: 20000 });
  let html = await page.locator('#frame').getAttribute('srcdoc');
  assert.match(html, /демонстрац/i, 'пример явно отмечен как демонстрационный');
  assert.match(html, /15 000 ₽/, 'демо-тариф показан в сгенерированной странице');
  assert.doesNotMatch(html, /class="uds-testimonial"/, 'пример не создаёт фиктивные отзывы');

  const frame = page.frameLocator('#frame');
  const publishedPreview = await browser.newPage();
  const standalone = generate({ ...full, quiz: { enabled: true } }).html;
  await publishedPreview.setContent(standalone, { waitUntil: 'domcontentloaded' });
  const site = publishedPreview.locator('[data-uds-quiz]');
  await site.locator('[name="uds-quiz-service"]').first().check();
  await site.locator('[name="uds-quiz-priority"]').nth(1).check();
  await site.evaluate(form => form.requestSubmit());
  assert.equal(await site.locator('[data-uds-quiz-result]').isVisible(), true, 'квиз показывает результат без внешнего сервиса');
  assert.ok((await site.locator('[data-uds-quiz-result]').innerText()).length > 10);
  await publishedPreview.close();
  assert.deepEqual(errors, [], 'в редакторе не должно быть ошибок JavaScript');
  console.log('Generator sections and optional quiz E2E passed.');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
