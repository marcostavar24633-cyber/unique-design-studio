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
  const canvasRender = () => {
    let timer;
    const timedOut = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('preview iframe did not finish rendering within 15s')), 15000); });
    const rendered = page.locator('#frame').evaluate(frame => new Promise(resolve => frame.addEventListener('load', resolve, { once: true })));
    return Promise.race([rendered, timedOut]).finally(() => clearTimeout(timer));
  };
  const setCanvasControl = async (selector, value) => {
    const render = canvasRender();
    await page.locator(selector).evaluate((control, next) => {
      control.value = String(next);
      control.dispatchEvent(new Event('input', { bubbles: true }));
      control.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
    await render;
  };
  const chooseCanvasOption = async (selector, value) => {
    const control = page.locator(selector);
    if (await control.inputValue() === value) return;
    const render = canvasRender();
    await control.selectOption(value);
    await render;
  };
  const useCanvasMenuAction = async action => {
    await page.click('#canvas-add');
    const render = canvasRender();
    await page.click(`#canvas-menu [data-canvas-menu="${action}"]`);
    await render;
  };
  await page.click('#ptab-editor');
  // Живой предпросмотр: реальные стили, плавное переключение и сохранение прокрутки.
  const previewSelect = page.locator('#form select[data-special][data-preview-enhanced="true"]').first();
  const previewControl = await previewSelect.evaluate(select => ({
    special: select.dataset.special,
    current: select.value,
    values: [...select.nextElementSibling.querySelectorAll('[data-preview-value]')].map(option => option.dataset.previewValue).filter(value => value && value !== select.value)
  }));
  check(previewControl.values.length >= 2, 'для живого предпросмотра доступны менее двух вариантов');
  if (previewControl.values.length >= 2) {
    await previewSelect.evaluate(select => { const group = select.closest('details.group'); if (group) group.open = true; });
    const optionGroup = previewSelect.locator('xpath=following-sibling::*[1]');
    const firstChoice = optionGroup.locator(`[data-preview-value="${previewControl.values[0]}"]`);
    const secondChoice = optionGroup.locator(`[data-preview-value="${previewControl.values[1]}"]`);
    const mainBeforeHover = await page.locator('#frame').evaluate(frame => frame.srcdoc);
    const scrollTarget = await preview.locator('html').evaluate(root => {
      root.style.scrollBehavior = 'auto';
      const max = Math.max(0, document.documentElement.scrollHeight - innerHeight);
      const y = Math.min(360, max);
      window.scrollTo({ top: y, behavior: 'instant' });
      return { y, max };
    });
    await page.waitForTimeout(140);
    await page.evaluate(() => {
      window.__udsLastPreviewRestore = null;
      window.__udsPreviewRestoreHandler = event => {
        if (event.data?.type === 'uds-canvas-scroll-restored') window.__udsLastPreviewRestore = event.data;
      };
      window.addEventListener('message', window.__udsPreviewRestoreHandler);
    });
    await firstChoice.scrollIntoViewIfNeeded();
    await firstChoice.hover();
    await page.locator('#view-preview iframe.visual-option-preview-frame.is-visible').waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForFunction(() => Boolean(window.__udsLastPreviewRestore), null, { timeout: 10000 });
    const previewA = await page.evaluate(() => {
      const frame = document.querySelector('#view-preview iframe.visual-option-preview-frame.is-visible');
      return {
        differs: Boolean(frame && frame.srcdoc !== document.querySelector('#frame')?.srcdoc),
        transition: frame ? getComputedStyle(frame).transitionProperty : '',
        restored: window.__udsLastPreviewRestore
      };
    });
    check(previewA.differs, 'наведение не меняет визуальный вариант относительно текущего сайта');
    check(previewA.transition.includes('opacity'), `плавное появление предпросмотра не настроено: ${previewA.transition}`);
    check(Math.abs(Number(previewA.restored.targetY) - scrollTarget.y) < 8, `предпросмотр не получил текущую прокрутку: ожидалось ${scrollTarget.y}, получено ${previewA.restored.targetY}`);
    check(scrollTarget.max > 0, 'страница предпросмотра не прокручивается, поэтому позицию нельзя проверить');
    await secondChoice.scrollIntoViewIfNeeded();
    await secondChoice.hover();
    await page.locator('#view-preview iframe.visual-option-preview-frame.is-visible').waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForFunction(() => document.querySelectorAll('#view-preview iframe.visual-option-preview-frame').length === 1, null, { timeout: 10000 });
    const mainRender = canvasRender();
    await secondChoice.click();
    await mainRender;
    check(await previewSelect.inputValue() === previewControl.values[1], 'клик по варианту не выбрал соответствующее значение');
    const mainAfterSelect = await page.locator('#frame').evaluate(frame => frame.srcdoc);
    check(mainAfterSelect !== mainBeforeHover, 'выбранный вариант не обновил основной предпросмотр сайта');
    await page.evaluate(() => window.removeEventListener('message', window.__udsPreviewRestoreHandler));
  }
  const sourceElement = preview.locator('#about .about__text');
  await sourceElement.click({ button: 'right' });
  await page.waitForFunction(() => document.querySelector('#canvas-inspector')?.hidden === false);
  check(!(await page.locator('#canvas-menu').evaluate(dialog => dialog.open)), 'ПКМ по элементу открыло меню добавления вместо его настроек');
  await page.click('#canvas-inspector-close');
  await preview.locator('body').evaluate(body => body.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
  await page.waitForFunction(() => document.querySelector('#canvas-menu')?.open === true);
  check(await page.locator('#canvas-menu [data-canvas-menu="add-card"]').isEnabled(), 'ПКМ по пустому месту не открыло меню добавления');
  await page.keyboard.press('Escape');
  await sourceElement.evaluate(node => node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', pointerId: 42, isPrimary: true })));
  await page.waitForTimeout(650);
  await page.waitForFunction(() => document.querySelector('#canvas-inspector')?.hidden === false);
  check((await page.locator('#canvas-selected-label').innerText()).startsWith('p:'), 'долгое нажатие на телефоне не открыло настройки выбранного элемента');
  await page.click('#canvas-inspector-close');
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
  await preview.locator('html').evaluate(root => { root.style.scrollBehavior = 'auto'; window.scrollTo({ top: Math.min(500, document.documentElement.scrollHeight - innerHeight), behavior: 'instant' }); });
  await preview.locator('body').evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const scrollBeforeResize = await preview.locator('body').evaluate(() => window.scrollY);
  const resizeHandle = preview.locator('.uds-resize-handle');
  await resizeHandle.waitFor({ state: 'visible' });
  const resizeBox = await resizeHandle.boundingBox();
  const scrollRestored = page.evaluate(() => new Promise(resolve => {
    const done = event => { if (event.data?.type !== 'uds-canvas-scroll-restored') return; window.removeEventListener('message', done); resolve(event.data); };
    window.addEventListener('message', done);
    setTimeout(() => { window.removeEventListener('message', done); resolve(null); }, 10000);
  }));
  await page.mouse.move(resizeBox.x + 9, resizeBox.y + 9);
  await page.mouse.down();
  await page.mouse.move(resizeBox.x + 89, resizeBox.y + 49, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(100);
  const restoredPosition = await scrollRestored;
  await heroMovedText.waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(80);
  check(Boolean(restoredPosition), 'перерисовка не подтвердила восстановление прокрутки');
  const dragWidth = Number.parseFloat(await heroMovedText.evaluate(node => getComputedStyle(node).width));
  check(dragWidth > 100, `изменение размера ручкой не применилось: ${dragWidth}px`);
  const scrollAfterResize = await preview.locator('body').evaluate(() => ({ y: window.scrollY, max: Math.max(0, document.documentElement.scrollHeight - innerHeight) }));
  check(Boolean(restoredPosition) && Math.abs(scrollAfterResize.y - Math.min(restoredPosition.targetY, scrollAfterResize.max)) < 8, `прокрутка не восстановилась после перерисовки: до перетаскивания=${scrollBeforeResize}, целевая позиция=${restoredPosition?.targetY ?? 'нет'}, подтверждение=${restoredPosition ? JSON.stringify(restoredPosition) : 'нет'}, после=${scrollAfterResize.y} (max ${scrollAfterResize.max})`);
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

  // Полный набор индивидуальных стилей, свойств, копирования и истории.
  for (const style of ['inherit', 'soft', 'outline', 'glass', 'accent', 'quote']) {
    await chooseCanvasOption('#canvas-element-style', style);
    const renderedStyle = await heroMovedText.getAttribute('data-uds-canvas-style');
    check(style === 'inherit' ? renderedStyle === null : renderedStyle === style, `стиль «${style}» не применяется`);
  }
  await setCanvasControl('#canvas-color', '#123456');
  check(await heroMovedText.evaluate(node => node.style.color) === 'rgb(18, 52, 86)', 'цвет текста не применяется');
  await setCanvasControl('#canvas-background', '#abcdef');
  check(await heroMovedText.evaluate(node => node.style.backgroundColor) === 'rgb(171, 205, 239)', 'цвет фона не применяется');
  await setCanvasControl('#canvas-size', '38');
  check(await heroMovedText.evaluate(node => node.style.fontSize) === '38px', 'размер текста не применяется');
  await setCanvasControl('#canvas-opacity', '65');
  check(await heroMovedText.evaluate(node => node.style.opacity) === '0.65', 'прозрачность не применяется');
  await setCanvasControl('#canvas-offset-x', '32');
  await setCanvasControl('#canvas-offset-y', '-18');
  const appliedOffset = await heroMovedText.evaluate(node => node.style.translate);
  check(appliedOffset.includes('calc(-50% + 32px)') && appliedOffset.includes('calc(-50% - 18px)'), `смещение X/Y не совмещено с центрированием свободного холста: ${appliedOffset}`);
  await page.click('#canvas-copy-position');
  check(await page.locator('#canvas-paste-position').isEnabled(), 'копирование ненулевого смещения не активировало вставку');
  await page.click('#canvas-reset-position');
  check(await page.inputValue('#canvas-offset-x') === '0' && await page.inputValue('#canvas-offset-y') === '0', 'сброс смещения не обновил поля X/Y');
  check((await heroMovedText.evaluate(node => node.style.translate)).includes('-50%') && (await heroMovedText.evaluate(node => node.style.translate)).includes('0px'), 'сброс смещения нарушил центрирование элемента на свободном холсте');
  await setCanvasControl('#canvas-height', '120');
  await page.check('#canvas-lock-ratio');
  await setCanvasControl('#canvas-width', '360');
  const lockedSize = await heroMovedText.evaluate(node => ({ width: node.style.width, height: node.style.height }));
  check(lockedSize.width === '360px' && Number.parseFloat(lockedSize.height) > 0, `фиксация пропорций не пересчитала размер: ${JSON.stringify(lockedSize)}`);
  await page.uncheck('#canvas-lock-ratio');

  // Все типы текста и варианты выравнивания доступны из контекстного меню.
  const textKey = await heroMovedText.getAttribute('data-uds-edit-key');
  const textNode = preview.locator(`[data-uds-edit-key="${textKey}"]`);
  for (const tag of ['h2', 'p', 'a', 'button', 'p']) {
    await useCanvasMenuAction(`tag-${tag}`);
    check(await textNode.evaluate(node => node.tagName.toLowerCase()) === tag, `смена типа на <${tag}> не сработала`);
  }
  for (const align of ['left', 'center', 'right', 'auto']) {
    await useCanvasMenuAction(`align-${align}`);
    const textAlign = await textNode.evaluate(node => getComputedStyle(node).textAlign);
    check(['left', 'center', 'right', 'start', 'end'].includes(textAlign), `выравнивание «${align}» установило неверное значение: ${textAlign}`);
  }

  for (const shape of ['auto', 'square', 'soft', 'round', 'pill', 'circle']) {
    await chooseCanvasOption('#canvas-shape', shape);
    const radius = await heroMovedText.evaluate(node => getComputedStyle(node).borderRadius);
    const expected = { auto: null, square: '0px', soft: '8px', round: '22px', pill: '999px', circle: '50%' }[shape];
    if (expected) check(radius === expected, `форма «${shape}» не применилась: ${radius}`);
  }
  for (const animation of ['none', 'fade', 'rise', 'float', 'pulse', 'glow', 'tilt']) {
    await chooseCanvasOption('#canvas-animation', animation);
    const renderedAnimation = await heroMovedText.getAttribute('data-uds-canvas-animation');
    check(animation === 'none' ? renderedAnimation === null : renderedAnimation === animation, `анимация «${animation}» не применилась`);
  }
  await page.click('#canvas-copy-style');
  check(await page.locator('#canvas-paste-position').isEnabled() && await page.locator('#canvas-paste-style').isEnabled(), 'копирование позиции/стиля не активировало вставку');

  await heroCta.click();
  await page.click('#canvas-options-trigger');
  const pastePositionRender = canvasRender();
  await page.click('#canvas-paste-position');
  await pastePositionRender;
  const pastedPosition = await heroCta.evaluate(node => node.style.translate);
  check(pastedPosition.includes('32px') && pastedPosition.includes('18px'), `вставка скопированного положения не перенесла смещение на кнопку: ${pastedPosition}`);
  const pasteStyleRender = canvasRender();
  await page.click('#canvas-paste-style');
  await pasteStyleRender;
  check(await heroCta.evaluate(node => node.style.opacity) === '0.65', 'вставка скопированного стиля не перенесла прозрачность');
  const alignRender = canvasRender();
  await page.click('#canvas-align');
  await alignRender;
  await page.waitForFunction(() => document.querySelector('#canvas-offset-x')?.value === '0' && document.querySelector('#canvas-offset-y')?.value === '0');
  check((await heroCta.evaluate(node => node.style.translate)).includes('0px'), 'автовыравнивание не сбросило ручные смещения');
  for (const style of ['inherit', 'solid', 'outline', 'ghost', 'gradient', 'glass', 'glow']) {
    await chooseCanvasOption('#canvas-button-style', style);
    const rendered = await heroCta.evaluate(node => ({ bg: getComputedStyle(node).backgroundColor, image: getComputedStyle(node).backgroundImage, backdrop: getComputedStyle(node).backdropFilter, shadow: getComputedStyle(node).boxShadow }));
    if (style === 'gradient') check(rendered.image.includes('gradient'), 'градиентный стиль кнопки не создал фон');
  }
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
  const sendBackRender = canvasRender();
  await page.click('#canvas-send-back');
  await sendBackRender;
  check(Number(await heroCta.evaluate(node => getComputedStyle(node).zIndex)) <= 0, 'перевод элемента назад не уменьшил его уровень слоя');
  const duplicateRender = canvasRender();
  await page.click('#canvas-duplicate');
  await duplicateRender;
  check(await preview.locator('.hero [data-uds-free-canvas] .nav__cta').count() === 2, 'дублирование элемента не создало копию');
  const undoRender = canvasRender();
  await page.click('#canvas-undo');
  await undoRender;
  check(await preview.locator('.hero [data-uds-free-canvas] .nav__cta').count() === 1, 'отмена не вернула состояние до дублирования');
  const redoRender = canvasRender();
  await page.click('#canvas-redo');
  await redoRender;
  check(await preview.locator('.hero [data-uds-free-canvas] .nav__cta').count() === 2, 'повтор не восстановил дублированный элемент');
  const deleteDuplicateRender = canvasRender();
  await page.click('#canvas-delete');
  await deleteDuplicateRender;
  check(await preview.locator('.hero [data-uds-free-canvas] .nav__cta').count() === 1, 'удаление выбранного дубликата не сработало');

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
  check(await page.locator('#canvas-href-field').isVisible(), 'для кнопки не показано поле ссылки');
  const buttonLinkRender = page.locator('#frame').evaluate(frame => new Promise(resolve => frame.addEventListener('load', resolve, { once: true })));
  await page.fill('#canvas-href', 'https://example.com/consultation');
  await page.locator('#canvas-href').press('Tab');
  await buttonLinkRender;
  check(await addedButton.getAttribute('href') === 'https://example.com/consultation', 'адрес добавленной кнопки не сохранился');
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
  await addedImage.scrollIntoViewIfNeeded();
  await page.click('#canvas-inspector-close');
  await addedImage.locator('img').click({ force: true });
  await page.click('#canvas-options-trigger');
  await page.waitForFunction(() => [...document.querySelector('#canvas-element-style')?.options || []].some(option => option.value === 'polaroid'));
  const photoResizeHandle = preview.locator('.uds-resize-handle');
  await page.click('#canvas-inspector-close');
  await photoResizeHandle.waitFor({ state: 'visible', timeout: 10000 });
  const currentFrameSource = () => page.locator('#frame').getAttribute('srcdoc');
  const waitForFrameSourceChange = source => page.waitForFunction(previous => document.querySelector('#frame')?.srcdoc !== previous, source, { timeout: 10000 });
  const beforePhotoResize = await currentFrameSource();
  const photoHandleBox = await photoResizeHandle.boundingBox();
  await page.mouse.move(photoHandleBox.x + 9, photoHandleBox.y + 9);
  await page.mouse.down();
  await page.mouse.move(photoHandleBox.x - 31, photoHandleBox.y - 31, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(100);
  await waitForFrameSourceChange(beforePhotoResize);
  const resizedPhoto = await addedImage.locator('img').evaluate(node => ({ width: Number.parseFloat(getComputedStyle(node).width), height: Number.parseFloat(getComputedStyle(node).height), frameWidth: Number.parseFloat(getComputedStyle(node.closest('figure')).width), objectFit: getComputedStyle(node).objectFit }));
  check(resizedPhoto.width >= 40 && resizedPhoto.height >= 24 && Math.abs(resizedPhoto.width - resizedPhoto.frameWidth) < 2 && resizedPhoto.objectFit === 'cover', `размер фото оторвался от рамки: ${JSON.stringify(resizedPhoto)}`);
  await addedImage.locator('img').click({ force: true });
  await page.click('#canvas-options-trigger');
  const beforePhotoRotation = await currentFrameSource();
  await page.locator('#canvas-rotation').evaluate(input => { input.value = '18'; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); });
  await waitForFrameSourceChange(beforePhotoRotation);
  check(await addedImage.locator('img').evaluate(node => getComputedStyle(node).rotate) === '18deg', 'наклон фото не сохранился после повторной отрисовки');
  const beforePhotoCaption = await currentFrameSource();
  await page.fill('#canvas-text', 'Портрет для обложки');
  await page.locator('#canvas-text').press('Tab');
  await waitForFrameSourceChange(beforePhotoCaption);
  check((await addedImage.locator('figcaption').innerText()).includes('Портрет для обложки'), 'подпись фотографии не редактируется в инспекторе');
  const beforePhotoAlt = await currentFrameSource();
  await page.fill('#canvas-alt', 'Персональная тренировка с тренером');
  await page.locator('#canvas-alt').press('Tab');
  await waitForFrameSourceChange(beforePhotoAlt);
  check(await addedImage.locator('img').getAttribute('alt') === 'Персональная тренировка с тренером', 'альтернативное описание фото не сохраняется');
  const beforePhotoStyle = await currentFrameSource();
  await page.selectOption('#canvas-element-style', 'polaroid');
  await waitForFrameSourceChange(beforePhotoStyle);
  check(await addedImage.locator('[data-uds-canvas-style="polaroid"]').count() === 1, 'стиль фото «Полароид» не сохранился на выбранном элементе');
  const rectangleImageStyle = await addedImage.locator('img').evaluate(node => ({ radius: getComputedStyle(node).borderRadius, fit: getComputedStyle(node).objectFit }));
  check(rectangleImageStyle.radius !== '50%' && rectangleImageStyle.fit === 'cover', `фото должно оставаться прямоугольным со скруглением: ${JSON.stringify(rectangleImageStyle)}`);
  await page.click('#canvas-inspector-close');
  const aboutSection = preview.locator('#about');
  const aboutBox = await aboutSection.boundingBox();
  const freeSpot = { x: Math.round(aboutBox.width * 0.82), y: Math.round(aboutBox.height * 0.8) };
  await addedImage.dragTo(aboutSection, { targetPosition: freeSpot, force: true });
  const withinSectionPhoto = preview.locator('#about [data-uds-free-canvas] .uds-added-element--image');
  await withinSectionPhoto.waitFor({ state: 'visible', timeout: 10000 });
  check(await withinSectionPhoto.evaluate(node => getComputedStyle(node).position) === 'absolute', 'фото нельзя разместить в соседнем контейнере того же блока');
  const freePhotoPosition = await withinSectionPhoto.evaluate(node => ({ left: Number.parseFloat(node.style.left), top: Number.parseFloat(node.style.top) }));
  check(Math.abs(freePhotoPosition.left - 82) < 2 && Math.abs(freePhotoPosition.top - 80) < 2, `перетаскивание на пустое место не сохранило координаты: ${JSON.stringify(freePhotoPosition)}`);
  await withinSectionPhoto.dragTo(preview.locator('#faq'), { targetPosition: { x: 24, y: 80 } });
  const movedPhoto = preview.locator('#faq .uds-added-element--image');
  await movedPhoto.waitFor({ state: 'visible', timeout: 10000 });
  check(await preview.locator('#about .uds-added-element--image').count() === 0, 'фото осталось в старом контейнере после перемещения в соседнюю секцию');
  check(await movedPhoto.locator('img').evaluate(node => getComputedStyle(node).rotate) === '18deg', 'после перемещения фото потеряло наклон');

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

  // Пользовательские секционные блоки: добавление, выбор для настройки и размещение.
  await preview.locator('#about h2').click({ force: true });
  await page.click('#canvas-options-trigger');
  await page.click('#canvas-add');
  const blockAddRender = canvasRender();
  await page.click('#canvas-menu [data-canvas-menu="add-text"]');
  await blockAddRender;
  const addedTextBlock = preview.locator('[data-uds-block]').last();
  await addedTextBlock.waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(120);
  const blockControlsVisible = await page.locator('#canvas-block-placement-row').evaluate(row => !row.hidden);
  const blockSelection = await addedTextBlock.evaluate(node => ({ id: node.dataset.udsBlock, selected: Boolean(node.querySelector('.uds-edit-selected')) }));
  console.log('Пользовательский блок:', JSON.stringify({ blockSelection, label: await page.locator('#canvas-selected-label').innerText(), blockControlsVisible }));
  check(blockControlsVisible, 'инспектор не показал управление пользовательским блоком');

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

