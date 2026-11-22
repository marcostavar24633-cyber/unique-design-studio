// Проверка оставшихся пользовательских действий редактора:
// новый проект, сравнение до/после, диагностика AI и локальный Publish Manager.
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
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
  : {});
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
  await page.waitForFunction(() => document.querySelector('#form [data-path="brand"]') !== null);

  // Генерируем локальный проект и проверяем действие «Новый» без потери реестра.
  await page.fill('#qs-niche', 'Студия тестирования редактора');
  await page.fill('#qs-brand', 'EDITOR CONTROLS E2E');
  await page.click('#quick-start [type="submit"]');
  await page.waitForFunction(() => document.querySelector('#auto-status').textContent.includes('Готово'), null, { timeout: 20000 });

  // Свободное размещение: перетаскиваем живой элемент в другой раздел,
  // затем проверяем сохранение размера и поворота после повторного рендера.
  await page.click('#tab-preview');
  await page.click('#arrange-toggle');
  const preview = page.frameLocator('#frame');
  const sourceElement = preview.locator('#about .about__text');
  const targetSection = preview.locator('#contact');
  await sourceElement.waitFor({ state: 'visible' });
  await sourceElement.dragTo(targetSection, { targetPosition: { x: 24, y: 24 } });
  const movedElement = preview.locator('#contact [data-uds-free-canvas] .about__text');
  await movedElement.waitFor({ state: 'visible', timeout: 10000 });
  const sourceCard = preview.locator('#items li.item').first();
  await sourceCard.waitFor({ state: 'visible' });
  const cardTargetSection = preview.locator('#about');
  await sourceCard.dragTo(cardTargetSection, { targetPosition: { x: 24, y: 24 } });
  const movedCard = preview.locator('#about [data-uds-free-canvas] li.item');
  await movedCard.waitFor({ state: 'visible', timeout: 10000 });
  check(await movedCard.count() === 1, 'карточка каталога не переместилась в другой раздел');
  await movedElement.click();
  await page.click('#canvas-options-trigger');
  const widthRender = page.locator('#frame').evaluate(frame => new Promise(resolve => frame.addEventListener('load', resolve, { once: true })));
  await page.fill('#canvas-width', '420');
  await page.locator('#canvas-width').press('Tab');
  await widthRender;
  const rotationRender = page.locator('#frame').evaluate(frame => new Promise(resolve => frame.addEventListener('load', resolve, { once: true })));
  await page.locator('#canvas-rotation').evaluate(node => {
    node.value = '15';
    node.dispatchEvent(new Event('input', { bubbles: true }));
    node.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForFunction(() => document.querySelector('#canvas-rotation-out')?.textContent === '15°');
  await rotationRender;
  await movedElement.waitFor({ state: 'visible', timeout: 10000 });
  const movedStyle = await movedElement.evaluate(node => ({ width: getComputedStyle(node).width, rotate: getComputedStyle(node).rotate }));
  check(movedStyle.width === '420px', `ширина после повторного рендера: ${movedStyle.width}`);
  check(movedStyle.rotate === '15deg', `угол после повторного рендера: ${movedStyle.rotate}`);
  check(await movedElement.count() === 1, 'перетащенный элемент потерялся после изменения размера и поворота');

  // Добавленная пользователем кнопка должна редактировать подпись прямо в инспекторе.
  await preview.locator('#about h2').click();
  await page.click('#canvas-options-trigger');
  await page.click('#canvas-add');
  await page.click('#canvas-menu [data-canvas-menu="add-button"]');
  const addedButton = preview.locator('#about .uds-added-element--button');
  await addedButton.waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForFunction(() => document.querySelector('#canvas-text')?.value === 'Новая кнопка');
  check(await page.inputValue('#canvas-text') === 'Новая кнопка', 'подпись добавленной кнопки не показана в инспекторе');
  const buttonTextRender = page.locator('#frame').evaluate(frame => new Promise(resolve => frame.addEventListener('load', resolve, { once: true })));
  await page.fill('#canvas-text', 'Записаться на консультацию');
  await page.locator('#canvas-text').press('Tab');
  await buttonTextRender;
  check((await preview.locator('#about .uds-added-element--button').innerText()).includes('Записаться на консультацию'), 'новая кнопка не сохранила изменённую подпись');
  await page.click('#arrange-toggle');

  await page.click('#save');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('uds:studio:v1') || '{}').library?.length === 1);
  await page.click('#new');
  await page.waitForFunction(() => document.querySelector('#form [data-path="brand"]')?.value === '');
  check(await page.locator('#form [data-path="niche"]').inputValue() === '', 'кнопка «Новый» не очистила нишу');
  check(await page.evaluate(() => JSON.parse(localStorage.getItem('uds:studio:v1') || '{}').library?.length === 1), 'создание нового проекта удалило существующий реестр');

  // Кнопка диагностики должна вызывать только /api/diagnostics и корректно показать конфигурацию.
  await page.click('#ptab-own');
  await page.locator('#auto-endpoint').waitFor({ state: 'visible' });
  await page.fill('#auto-endpoint', 'https://example.test/api/generate-landing');
  await page.route('https://example.test/api/diagnostics', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      runtime: { workersAiBindingConfigured: true, accountIdConfigured: true, analyticsTokenConfigured: true },
      gateway: { configured: true, ok: true, quota: { remaining: 8, limit: 10 } }
    })
  }));
  await page.click('#ai-connection-check');
  await page.waitForFunction(() => document.querySelector('#ai-connection-status')?.textContent.includes('Подключение полностью настроено'));
  const diagnostics = await page.locator('#ai-connection-details').innerText();
  check(diagnostics.includes('Workers AI binding') && diagnostics.includes('Universal AI Gateway'), 'диагностика не показала состояние Workers AI и шлюза');

  // Изменение проекта должно активировать сравнение. Применение версии возвращает её в редактор.
  await page.click('#ptab-editor');
  const titleField = page.locator('#form [data-path="title"]');
  await titleField.fill('Версия после изменений E2E');
  await page.waitForFunction(() => document.querySelector('#change-preview')?.disabled === false, null, { timeout: 10000 });
  const popupPromise = page.waitForEvent('popup');
  await page.click('.top-more summary'); // «Сравнить до / после» находится в меню «Ещё»
  await page.click('#change-preview');
  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded');
  await popup.locator('#workspace').waitFor({ state: 'visible' });
  const beforeHtml = await popup.locator('#before-frame').getAttribute('srcdoc');
  const afterHtml = await popup.locator('#after-frame').getAttribute('srcdoc');
  check(Boolean(beforeHtml && afterHtml && beforeHtml !== afterHtml), 'сравнение не показало две разные версии HTML');
  check(afterHtml.includes('Версия после изменений E2E'), 'в версии «После» нет внесённого изменения');
  await popup.click('button[data-mode="before"]');
  check(await popup.locator('button[data-mode="before"]').getAttribute('aria-pressed') === 'true', 'переключатель «До» не изменил режим сравнения');
  await popup.click('button[data-mode="after"]');
  await popup.click('#apply');
  await page.waitForFunction(() => document.querySelector('#form [data-path="title"]')?.value === 'Версия после изменений E2E');
  await page.waitForFunction(() => document.querySelector('#frame')?.srcdoc?.includes('Версия после изменений E2E'));
  check((await page.locator('#form [data-path="title"]').inputValue()) === 'Версия после изменений E2E', 'применённая версия не обновила поле проекта');
  await popup.close();

  // Publish Manager только подготавливает команду и ведёт локальную историю: реальный deploy не запускается.
  await page.click('#tab-publish');
  await page.locator('#pm-record-form').waitFor({ state: 'visible' });
  await page.fill('#pm-project-name', 'lumen-e2e');
  await page.selectOption('#pm-branch', 'preview/staging');
  await page.click('#pm-save-settings');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('uds:publish:v1') || '{}').projectName === 'lumen-e2e');
  check((await page.locator('#pm-project-name').inputValue()) === 'lumen-e2e', 'настройки Pages project не сохранились');

  // HTTP URL должен быть отклонён; запись разрешена только для HTTPS и с явным подтверждением.
  await page.fill('#pm-deployment-url', 'http://lumen-e2e.pages.dev/');
  await page.check('#pm-confirm-success');
  await page.click('#pm-record-form button[type="submit"]');
  await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('корректный HTTPS URL'));
  check(await page.locator('.pm-history-item').count() === 0, 'небезопасный HTTP URL попал в историю публикаций');

  await page.fill('#pm-deployment-url', 'https://lumen-e2e.pages.dev/');
  await page.click('#pm-record-form button[type="submit"]');
  await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('Deployment добавлен'));
  check(await page.locator('.pm-history-item').count() === 1, 'успешный deployment не добавлен в локальную историю');
  await page.click('[data-pm-filter="preview"]');
  check(await page.locator('.pm-history-item').count() === 1, 'фильтр Preview не показал запись preview/staging');
  await page.click('.pm-history-item [data-pm-delete]');
  check(await page.locator('.pm-history-item').count() === 0, 'удаление записи не обновило историю');

  const [jsonDownload] = await Promise.all([page.waitForEvent('download'), page.click('#pm-download-json')]);
  check(jsonDownload.suggestedFilename() === 'uds-project.json', 'Publish Manager скачал JSON под неверным именем');
  const [htmlDownload] = await Promise.all([page.waitForEvent('download'), page.click('#pm-download-html')]);
  check(htmlDownload.suggestedFilename().endsWith('.html'), 'Publish Manager не скачал HTML');

  check(appErrors.length === 0, 'ошибки JavaScript в студии: ' + appErrors.join('; '));
  await context.close();
} finally {
  await browser.close();
  server.close();
}
if (failures.length) { console.error('Editor controls E2E: ' + failures.join('\n- ')); process.exit(1); }
console.log('Editor controls E2E пройден: новый проект, сравнение и применение, AI diagnostics, Publish Manager и локальная история deployment.');

// Расположение блоков (перетаскивание и кнопки ↑↓) — отдельный сценарий, запускается следом.
await import('./layout-order.mjs');
