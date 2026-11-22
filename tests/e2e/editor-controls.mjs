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
  const headerCta = preview.locator('.nav__cta');
  await headerCta.waitFor({ state: 'visible' });
  await headerCta.dragTo(preview.locator('.hero h1'), { targetPosition: { x: 20, y: 20 } });
  const heroCta = preview.locator('.hero [data-uds-free-canvas] .nav__cta');
  await heroCta.waitFor({ state: 'visible', timeout: 10000 });
  check(await heroCta.count() === 1, 'кнопка из шапки не переместилась на первый экран');
  await movedElement.dragTo(preview.locator('.hero'), { targetPosition: { x: 20, y: 320 } });
  const heroMovedText = preview.locator('.hero [data-uds-free-canvas] .about__text');
  await heroMovedText.waitFor({ state: 'visible', timeout: 10000 });
  await heroMovedText.click();
  await page.click('#canvas-options-trigger');
  const resizeHandle = preview.locator('.uds-resize-handle');
  await resizeHandle.waitFor({ state: 'visible' });
  const resizeBox = await resizeHandle.boundingBox();
  const resizeRender = page.locator('#frame').evaluate(frame => new Promise(resolve => frame.addEventListener('load', resolve, { once: true })));
  await page.mouse.move(resizeBox.x + 9, resizeBox.y + 9);
  await page.mouse.down();
  await page.mouse.move(resizeBox.x + 89, resizeBox.y + 49, { steps: 5 });
  await page.mouse.up();
  await resizeRender;
  await heroMovedText.waitFor({ state: 'visible', timeout: 10000 });
  const dragWidth = Number.parseFloat(await heroMovedText.evaluate(node => getComputedStyle(node).width));
  check(dragWidth > 100, `изменение размера ручкой не применилось: ${dragWidth}px`);
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
  await heroMovedText.waitFor({ state: 'visible', timeout: 10000 });
  const movedStyle = await heroMovedText.evaluate(node => ({ width: getComputedStyle(node).width, rotate: getComputedStyle(node).rotate }));
  check(movedStyle.width === '420px', `ширина после повторного рендера: ${movedStyle.width}`);
  check(movedStyle.rotate === '15deg', `угол после повторного рендера: ${movedStyle.rotate}`);
  check(await heroMovedText.count() === 1, 'перетащенный элемент потерялся после изменения размера и поворота');
  const elementStyleRender = page.locator('#frame').evaluate(frame => new Promise(resolve => frame.addEventListener('load', resolve, { once: true })));
  await page.selectOption('#canvas-element-style', 'quote');
  await elementStyleRender;
  check(await heroMovedText.getAttribute('data-uds-canvas-style') === 'quote', 'стиль элемента не сохранился после повторной отрисовки');
  await heroCta.click();
  await page.click('#canvas-options-trigger');
  check(await page.locator('#canvas-layer-actions').isVisible(), 'для свободно размещённого элемента не показаны действия со слоями');
  check(await page.locator('#canvas-overlap-list-row').isVisible(), 'список перекрывающихся элементов не показан при двух слоях');
  check(await page.locator('#canvas-overlap-layers option').count() === 2, 'список перекрытия не содержит оба свободно размещённых элемента');
  const bringFront = page.locator('#canvas-bring-front');
  const layerRender = page.locator('#frame').evaluate(frame => new Promise(resolve => frame.addEventListener('load', resolve, { once: true })));
  await bringFront.click();
  await layerRender;
  const movedZ = await heroCta.evaluate(node => getComputedStyle(node).zIndex); check(movedZ === '1', `кнопка из шапки не вышла на передний план: ${movedZ}`);
  const frontLayerKey = await heroCta.getAttribute('data-uds-edit-key');
  check(await page.locator('#canvas-overlap-layers option').first().getAttribute('value') === frontLayerKey, 'передний слой не отображается первым в списке наложения');

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
  await preview.locator('#about .uds-added-element--button').click();
  await page.click('#canvas-options-trigger');
  await page.click('#canvas-replace');
  check(await page.locator('#canvas-menu [data-canvas-menu="replace-card"]').isEnabled(), 'замена типа отключена для выбранной кнопки');
  const replaceRender = page.locator('#frame').evaluate(frame => new Promise(resolve => frame.addEventListener('load', resolve, { once: true })));
  await page.click('#canvas-menu [data-canvas-menu="replace-card"]');
  await replaceRender;
  check(await preview.locator('#about .uds-added-element--button').count() === 0, 'замена кнопки на карточку оставила прежний элемент');
  check((await preview.locator('#about .uds-added-element--card').last().innerText()).includes('Записаться на консультацию'), 'замена типа потеряла исходный текст кнопки');

  // Фото должны открывать собственные стили и применять круглую маску к самому изображению.
  await preview.locator('#about h2').click();
  await page.click('#canvas-options-trigger');
  await page.click('#canvas-add');
  await page.click('#canvas-menu [data-canvas-menu="add-image"]');
  const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p2cAAAAASUVORK5CYII=', 'base64');
  await page.locator('#canvas-element-image-file').setInputFiles({ name: 'editor-photo.png', mimeType: 'image/png', buffer: tinyPng });
  const addedImage = preview.locator('#about .uds-added-element--image').last();
  await addedImage.waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForFunction(() => [...document.querySelector('#canvas-element-style')?.options || []].some(option => option.value === 'polaroid'));
  const captionRender = page.locator('#frame').evaluate(frame => new Promise(resolve => frame.addEventListener('load', resolve, { once: true })));
  await page.fill('#canvas-text', 'Портрет для обложки');
  await page.locator('#canvas-text').press('Tab');
  await captionRender;
  check((await addedImage.locator('figcaption').innerText()).includes('Портрет для обложки'), 'подпись фотографии не редактируется в инспекторе');
  const photoStyleRender = page.locator('#frame').evaluate(frame => new Promise(resolve => frame.addEventListener('load', resolve, { once: true })));
  await page.selectOption('#canvas-element-style', 'polaroid');
  await photoStyleRender;
  check(await addedImage.getAttribute('data-uds-canvas-style') === 'polaroid', 'стиль фото «Полароид» не сохранился');
  const circleRender = page.locator('#frame').evaluate(frame => new Promise(resolve => frame.addEventListener('load', resolve, { once: true })));
  await page.selectOption('#canvas-shape', 'circle');
  await circleRender;
  const circleImageStyle = await addedImage.locator('img').evaluate(node => ({ radius: getComputedStyle(node).borderRadius, fit: getComputedStyle(node).objectFit, ratio: getComputedStyle(node).aspectRatio }));
  check(circleImageStyle.radius === '50%' && circleImageStyle.fit === 'cover' && circleImageStyle.ratio === '1 / 1', `круглая маска фото неполная: ${JSON.stringify(circleImageStyle)}`);

  // Обычный элемент страницы заменяется компонентом, а не только меняет HTML-тег.
  const faqHeading = preview.locator('#faq h2');
  await faqHeading.click();
  await page.click('#canvas-options-trigger');
  await page.click('#canvas-replace');
  const staticReplaceRender = page.locator('#frame').evaluate(frame => new Promise(resolve => frame.addEventListener('load', resolve, { once: true })));
  await page.click('#canvas-menu [data-canvas-menu="replace-card"]');
  await staticReplaceRender;
  check(await preview.locator('#faq h2').count() === 0, 'замена статического заголовка не удалила исходный элемент');
  check(await preview.locator('#faq .uds-added-element--card').count() === 1, 'замена статического заголовка не создала карточку в той же секции');
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
