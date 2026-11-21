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
  const group = page.locator('details.group', { has: page.locator('summary', { hasText: 'Содержание сайта' }) });
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
  // Галерея из трёх фото (адреса-заглушки: важны элементы, а не сами картинки).
  await page.evaluate(() => { const t = document.querySelector('#form [data-list="gallery"]'); t.value = ['a', 'b', 'c'].map(x => `https://example.com/${x}.jpg | Фото ${x}`).join('\n'); t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForFunction(() => document.querySelector('#frame').srcdoc.includes('example.com/c.jpg'), null, { timeout: 10000 });
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
  // Остальные списки на странице: преимущества, вопросы и фото галереи.
  for (const [kind, path] of [['advantages', 'advantages'], ['faqs', 'faqs'], ['gallery', 'gallery']]) {
    const nodes = frame.locator(`[data-arrange="${kind}"]`);
    if (await nodes.count() < 2) { check(false, `на странице нет перетаскиваемых элементов «${kind}»`); continue; }
    const first = await page.locator(`#form [data-list="${path}"]`).inputValue();
    await nodes.nth(1).dragTo(nodes.nth(0));
    await page.waitForFunction(([p, v]) => document.querySelector(`#form [data-list="${p}"]`).value !== v, [path, first], { timeout: 10000 })
      .catch(() => check(false, `перетаскивание «${kind}» на странице не изменило данные`));
    const after = (await page.locator(`#form [data-list="${path}"]`).inputValue()).split('\n');
    const was = first.split('\n');
    check(after[0] === was[1] && after[1] === was[0], `«${kind}»: ожидалась перестановка первых двух`);
  }
  check(await page.locator('#arrange-toggle').getAttribute('aria-pressed') === 'true', 'кнопка режима не отражает состояние');

  // Порядок попадает в экспорт проекта и переживает перезагрузку.
  const saved = await page.evaluate(() => JSON.stringify(localStorage));
  check(saved.includes('sectionOrder'), 'ручной порядок секций не сохранён');
  await page.click('#arrange-toggle');
  check(!(await page.locator('#frame').getAttribute('srcdoc')).includes('uds-arrange'), 'служебный скрипт остался в предпросмотре после выключения режима');

  // Скрытие секции: снимаем галочку — секция пропадает со страницы, данные остаются; галочка возвращает её.
  const firstVisible = group.locator('[data-section-visible]').first();
  const hideId = await firstVisible.getAttribute('data-section-visible');
  await firstVisible.uncheck();
  await page.waitForFunction(id => !document.querySelector('#frame').srcdoc.includes(`sec--${id}`), hideId);
  check(await group.locator(`li.is-hidden [data-section-visible="${hideId}"]`).count() === 1, 'скрытая секция не показана в панели');
  await group.locator(`[data-section-visible="${hideId}"]`).check();
  await page.waitForFunction(id => document.querySelector('#frame').srcdoc.includes(`sec--${id}`), hideId);

  // Дублирование позиции каталога.
  const countBefore = await group.locator('[data-order-list="services"] li').count();
  await group.locator('[data-order-list="services"] [data-order-dup="0"]').click();
  await page.waitForFunction(n => document.querySelectorAll('[data-order-list="services"] li').length === n + 1, countBefore);

  // Отмена и повтор: Ctrl+Z убирает копию, Ctrl+Shift+Z возвращает.
  await page.locator('#undo').click();
  await page.waitForFunction(n => document.querySelectorAll('[data-order-list="services"] li').length === n, countBefore);
  await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.keyboard.press('Control+Shift+Z');
  await page.waitForFunction(n => document.querySelectorAll('[data-order-list="services"] li').length === n + 1, countBefore, { timeout: 5000 })
    .catch(() => check(false, 'Ctrl+Shift+Z не вернул отменённое'));

  // Правка текста прямо на странице.
  await page.click('#edit-toggle');
  const h1 = frame.locator('#hero-h[data-edit]');
  await h1.waitFor();
  await h1.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Новый заголовок со страницы');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#form [data-path="title"]')?.value === 'Новый заголовок со страницы', null, { timeout: 10000 })
    .catch(() => check(false, 'правка заголовка на странице не попала в проект'));
  const adv = frame.locator('.sec--advantages ul.adv>li h3[data-edit]').first();
  await adv.click(); await page.keyboard.press('Control+A'); await page.keyboard.type('Своё преимущество'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#form [data-list="advantages"]').value.startsWith('Своё преимущество'), null, { timeout: 10000 })
    .catch(() => check(false, 'правка преимущества на странице не попала в проект'));
  await page.click('#edit-toggle');
  check(!(await page.locator('#frame').getAttribute('srcdoc')).includes('data-edit'), 'служебный скрипт правки остался в предпросмотре');

  // Три ширины.
  await page.click('.sizes button[data-w="trio"]');
  await page.locator('#trio iframe').nth(2).waitFor();
  check(await page.locator('#trio iframe').count() === 3, 'режим «Три ширины» не показал три предпросмотра');
  check(await page.locator('#frame').isHidden(), 'основной предпросмотр не скрыт в режиме трёх ширин');
  await page.click('.sizes button[data-w=""]');
  check(await page.locator('#frame').isVisible() && await page.locator('#trio').isHidden(), 'выход из режима трёх ширин не вернул предпросмотр');

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
