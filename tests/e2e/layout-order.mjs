// Расположение блоков: перестановка секций и элементов кнопками, перетаскиванием в панели
// и перетаскиванием прямо в предпросмотре; порядок сохраняется в проекте.
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
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const appErrors = [];
try {
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  page.on('pageerror', error => {
    const stack = String(error.stack || error.message);
    if (/\/studio\/(?:studio|ai-diagnostics)\.js|\/studio\/index\.html/.test(stack)) appErrors.push(stack);
  });
  await page.goto(`${base}/studio/index.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelectorAll('#examples option').length > 1);

  await page.fill('#qs-niche', 'кофейня');
  await page.fill('#qs-brand', 'LAYOUT ORDER E2E');
  await page.click('#quick-start [type="submit"]');
  await page.waitForFunction(() => document.querySelector('#auto-status').textContent.includes('Готово'), null, { timeout: 20000 });
  await page.click('#ptab-editor');
  const frameOrder = () => page.evaluate(() => [...new DOMParser().parseFromString(document.querySelector('#frame').srcdoc, 'text/html').querySelectorAll('main section.ds-section')]
    .map(s => ([...s.classList].find(c => c.startsWith('sec--')) || '').slice(5)).filter(id => id && id !== 'hero' && id !== 'contact'));
  const group = page.locator('details.group', { has: page.locator('summary', { hasText: 'Расположение блоков' }) });
  await group.locator('summary').click();
  const sections = group.locator('[data-order-list="sections"] li');
  check(await sections.count() >= 3, 'панель не показала секции страницы');
  const before = await frameOrder();

  // Кнопка ↓ с клавиатуры: Enter на кнопке переставляет первую секцию на второе место.
  await sections.nth(0).locator('[data-direction="1"]').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(n => document.querySelectorAll('[data-order-list="sections"] li').length === n && document.querySelector('.order-block__title')?.textContent.includes('вручную'), await sections.count());
  const afterKey = await frameOrder();
  check(afterKey[0] === before[1] && afterKey[1] === before[0], `кнопка ↓ не переставила секции: ${before} → ${afterKey}`);
  check(await group.evaluate(d => d.open), 'группа свернулась после перестановки');

  // Перетаскивание в панели: последняя позиция каталога — на первое место.
  const services = group.locator('[data-order-list="services"] li');
  const n = await services.count();
  const lastName = await services.nth(n - 1).locator('.order-list__name').innerText();
  await services.nth(n - 1).dragTo(services.nth(0));
  await page.waitForFunction(t => document.querySelector('[data-order-list="services"] li .order-list__name')?.textContent === t, lastName);
  check(await page.locator('#form [data-list="services"]').inputValue().then(v => v.startsWith(lastName)), 'перетаскивание не изменило порядок позиций в данных');

  // Перетаскивание в предпросмотре: вторая секция на место первой.
  await page.click('#arrange-toggle');
  const frame = page.frameLocator('#frame');
  const fSecs = frame.locator('[data-arrange="section"]');
  await fSecs.first().waitFor();
  const cur = await frameOrder();
  await fSecs.nth(0).locator('.uds-arrange-tag button').click(); // ↓ у первой секции
  await page.waitForFunction(first => { const d = new DOMParser().parseFromString(document.querySelector('#frame').srcdoc, 'text/html'); const s = [...d.querySelectorAll('main section.ds-section')].map(x => ([...x.classList].find(c => c.startsWith('sec--')) || '').slice(5)).filter(id => id && id !== 'hero' && id !== 'contact'); return s[0] === first; }, cur[1], { timeout: 10000 });
  // Перетаскивание карточек каталога в предпросмотре (соседние карточки).
  const firstTitle = (await page.locator('#form [data-list="services"]').inputValue()).split('|')[0].trim();
  const cards = frame.locator('[data-arrange="item"]');
  await cards.first().waitFor();
  await cards.nth(1).dragTo(cards.nth(0));
  await page.waitForFunction(t => !document.querySelector('#form [data-list="services"]').value.startsWith(t), firstTitle, { timeout: 10000 });
  check(await page.locator('#arrange-toggle').getAttribute('aria-pressed') === 'true', 'кнопка режима не отражает состояние');

  // Порядок попадает в экспорт проекта и переживает перезагрузку.
  const saved = await page.evaluate(() => JSON.stringify(localStorage));
  check(saved.includes('sectionOrder'), 'ручной порядок секций не сохранён');
  await page.click('#arrange-toggle');
  check(!(await page.locator('#frame').getAttribute('srcdoc')).includes('uds-arrange'), 'служебный скрипт остался в предпросмотре после выключения режима');

  // Сброс возвращает автоматический порядок.
  await group.locator('[data-order-reset]').click();
  await page.waitForFunction(() => document.querySelector('.order-block__title')?.textContent.includes('авто'));
  check(appErrors.length === 0, 'ошибки JavaScript в студии: ' + appErrors.join('; '));
  await context.close();
} finally {
  await browser.close();
  server.close();
}
if (failures.length) { console.error('Layout order E2E: ' + failures.join('\n- ')); process.exit(1); }
console.log('Layout order E2E пройден: кнопки и клавиатура, перетаскивание в панели и в предпросмотре, сохранение и сброс.');
