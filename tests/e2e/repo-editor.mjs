// Проверка безопасного импорта публичного репозитория и редактирования HTML в браузере.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { root } from '../helpers.mjs';

let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); }
catch { console.error('Playwright не найден. Установите: npm i -D playwright && npx playwright install chromium'); process.exit(1); }

const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="styles.css"></head><body>
<main><h1 id="headline">Старая надпись</h1><p id="description">Описание страницы</p><img id="asset" src="/assets/cover.png" alt="Обложка"></main>
<script>parent.postMessage({type:'source-script-ran'}, '*')</script><button id="unsafe" onclick="parent.postMessage({type:'source-handler-ran'}, '*')">Не запускать</button>
</body></html>`;
const css = 'body{background:#fafafa;color:#202329}#headline{font-size:28px;color:#123456}';
const blob = content => ({ encoding: 'base64', content: Buffer.from(content).toString('base64') });
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const file = join(root, normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' }); res.end(readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
  ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
  : {});
const failures = [];
let checks = 0;
const check = (ok, message) => { checks++; if (!ok) failures.push(message); };

try {
  const page = await browser.newPage({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
  const errors = [];
  const messages = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.exposeFunction('recordRepoMessage', data => messages.push(data));
  await page.addInitScript(() => window.addEventListener('message', event => window.recordRepoMessage(event.data)));
  await page.route('https://api.github.com/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/repos/example/site') {
      await route.fulfill({ json: { private: false, default_branch: 'main' } }); return;
    }
    if (url.pathname === '/repos/example/site/git/trees/main') {
      await route.fulfill({ json: { truncated: false, tree: [
        { type: 'blob', path: 'index.html', size: Buffer.byteLength(html), sha: 'html-blob' },
        { type: 'blob', path: 'styles.css', size: Buffer.byteLength(css), sha: 'css-blob' },
      ] } }); return;
    }
    if (url.pathname === '/repos/example/site/git/blobs/html-blob') { await route.fulfill({ json: blob(html) }); return; }
    if (url.pathname === '/repos/example/site/git/blobs/css-blob') { await route.fulfill({ json: blob(css) }); return; }
    await route.fulfill({ status: 404, json: { message: 'not found' } });
  });

  await page.goto(`${base}/studio/repo-editor.html`);
  await page.fill('#repo-url', 'https://github.com/example/site');
  await page.click('#repo-connect');
  await page.waitForSelector('#repo-pages-row:not([hidden])');
  check(await page.locator('#repo-page option').count() === 1, 'HTML-страница не найдена в списке репозитория');
  await page.click('#repo-load');
  await page.waitForSelector('#editor-workspace:not([hidden])');
  await page.waitForFunction(() => Number.parseInt(document.querySelector('#repo-structure-count')?.textContent, 10) > 0);
  const frame = page.frameLocator('#repo-frame');
  await frame.locator('body').evaluate(() => { window.__udsInboundEditTrace = []; window.addEventListener('message', event => { if (event.data?.type === 'uds-repo-edit') { window.__udsInboundEditTrace.push(event.data); parent.postMessage({ type: 'uds-test-edit-received', patch: event.data.patch }, '*'); } }); });
  await page.click('#repo-structure summary');
  await page.fill('#repo-node-filter', 'Старая надпись');
  const treeItem = page.locator('#repo-node-tree [data-node-key]').filter({ hasText: 'Старая надпись' });
  check(await treeItem.count() === 1, 'поиск по дереву не находит HTML-элемент');
  await treeItem.click();
  await page.waitForFunction(() => document.querySelector('#repo-text')?.value === 'Старая надпись');
  check((await frame.locator('#headline').getAttribute('class')).includes('uds-repo-selected'), 'выбор из структуры не подсвечивает элемент');
  await page.fill('#repo-node-filter', '');
  await frame.locator('#headline').click();
  await page.waitForFunction(() => document.querySelector('#repo-selection')?.textContent?.startsWith('Элемент №'));
  const beforeMove = await frame.locator('#headline').boundingBox();
  await page.mouse.move(beforeMove.x + beforeMove.width / 2, beforeMove.y + beforeMove.height / 2);
  await page.mouse.down(); await page.mouse.move(beforeMove.x + beforeMove.width / 2 + 34, beforeMove.y + beforeMove.height / 2 + 18, { steps: 4 }); await page.mouse.up();
  try {
    await page.waitForFunction(() => Number(document.querySelector('#repo-x')?.value) >= 30);
  } catch (error) {
    const inspector = await page.locator('#repo-x').inputValue();
    const frameState = await frame.locator('#headline').evaluate(node => ({
      translate: getComputedStyle(node).translate,
      selected: node.classList.contains('uds-repo-selected'),
      rect: (() => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })(),
      centerHit: (() => { const r = node.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { tag: hit?.tagName, id: hit?.id, key: hit?.dataset?.udsRepoKey }; })(),
    }));
    console.error('Repo editor drag diagnostic:', JSON.stringify({
      inspectorX: inspector,
      frameState,
      recentMessages: messages.filter(item => item?.type?.startsWith('uds-repo-')).slice(-8),
      pageErrors: errors,
    }));
    throw error;
  }
  check(Number(await page.inputValue('#repo-y')) >= 15, 'перетаскивание не обновило вертикальное смещение');
  const resizeHandle = await frame.locator('#uds-repo-resize').boundingBox();
  const resizeHitTarget = await frame.locator('#uds-repo-resize').evaluate(handle => {
    const rect = handle.getBoundingClientRect();
    return document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2) === handle;
  });
  check(resizeHitTarget, 'маркер размера не попадает в область hit-testing iframe');
  await page.evaluate(() => {
    window.__udsParentPointerTrace = [];
    for (const type of ['pointerdown', 'pointermove', 'pointerup']) document.addEventListener(type, event => window.__udsParentPointerTrace.push({ type, target: event.target.id || event.target.tagName, button: event.button, x: event.clientX, y: event.clientY }), true);
  });
  await frame.locator('body').evaluate(() => {
    window.__udsPointerTrace = [];
    for (const type of ['pointerdown', 'pointermove', 'pointerup']) document.addEventListener(type, event => window.__udsPointerTrace.push({ type, target: event.target.id || event.target.tagName, button: event.button, pointerId: event.pointerId, x: event.clientX, y: event.clientY }), true);
  });
  const widthBeforeResize = Number(await page.inputValue('#repo-width'));
  await page.mouse.move(resizeHandle.x + resizeHandle.width / 2, resizeHandle.y + resizeHandle.height / 2);
  await page.mouse.down(); await page.mouse.move(resizeHandle.x + resizeHandle.width / 2 + 28, resizeHandle.y + resizeHandle.height / 2 + 18, { steps: 4 }); await page.mouse.up();
  try { await page.waitForFunction(value => Number(document.querySelector('#repo-width')?.value) > value, widthBeforeResize); }
  catch (error) {
    const trace = await frame.locator('body').evaluate(() => window.__udsPointerTrace);
    const parentTrace = await page.evaluate(() => window.__udsParentPointerTrace);
    const boxes = { handle: resizeHandle, iframe: await page.locator('#repo-frame').boundingBox() };
    const style = await frame.locator('#headline').evaluate(node => ({ width: node.style.width, height: node.style.height, overlay: (() => { const r = document.querySelector('#uds-repo-overlay').getBoundingClientRect(); return { left:r.left,top:r.top,width:r.width,height:r.height }; })() }));
    console.error('Repo editor resize diagnostic:', JSON.stringify({ widthBeforeResize, widthAfter: await page.inputValue('#repo-width'), trace, parentTrace, boxes, style, pageErrors: errors }));
    throw error;
  }
  check(Number(await page.inputValue('#repo-height')) > 0, 'маркер изменения размера не обновил высоту');
  const rotateHandle = await frame.locator('#uds-repo-rotate').boundingBox();
  const afterResize = await frame.locator('#headline').boundingBox();
  const centerX = afterResize.x + afterResize.width / 2, centerY = afterResize.y + afterResize.height / 2;
  const rotateX = rotateHandle.x + rotateHandle.width / 2, rotateY = rotateHandle.y + rotateHandle.height / 2;
  const radius = Math.hypot(rotateX - centerX, rotateY - centerY);
  const rotateHitTarget = await frame.locator('#uds-repo-rotate').evaluate(handle => { const r = handle.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === handle; });
  check(rotateHitTarget, 'маркер наклона не попадает в область hit-testing iframe');
  const angle = Math.atan2(rotateY - centerY, rotateX - centerX) + 0.35;
  await page.mouse.move(rotateX, rotateY); await page.mouse.down();
  await page.mouse.move(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius, { steps: 4 }); await page.mouse.up();
  try { await page.waitForFunction(() => Math.abs(Number(document.querySelector('#repo-rotation')?.value)) > 0); }
  catch (error) {
    const trace = await frame.locator('body').evaluate(() => window.__udsPointerTrace);
    const parentTrace = await page.evaluate(() => window.__udsParentPointerTrace);
    console.error('Repo editor rotation diagnostic:', JSON.stringify({ rotateHitTarget, trace, parentTrace, rotateHandle, afterResize, rotation: await page.inputValue('#repo-rotation'), pageErrors: errors }));
    throw error;
  }
  check(Math.abs(Number(await page.inputValue('#repo-rotation'))) > 0, 'маркер наклона не обновил угол элемента');
  check((await frame.locator('h1').evaluate(node => getComputedStyle(node).fontSize)) === '28px', 'импортированный CSS не применился');
  check((await frame.locator('#asset').getAttribute('src')).includes('raw.githubusercontent.com/example/site/main/assets/cover.png'), 'корневой путь ресурса не преобразован к GitHub raw');
  check(!messages.some(item => ['source-script-ran', 'source-handler-ran'].includes(item?.type)), 'исходный скрипт или обработчик события запустился');

  await page.fill('#repo-text', 'Новый заголовок');
  await page.fill('#repo-color', '#ff0000');
  await page.fill('#repo-size', '36');
  await page.fill('#repo-width', '520');
  await page.fill('#repo-rotation', '12');
  await page.fill('#repo-x', '18');
  await page.fill('#repo-y', '-9');
  await page.click('#repo-apply');
  await page.waitForTimeout(50);
  console.error('Repo editor edit diagnostic:', JSON.stringify({ selection: await page.locator('#repo-selection').textContent(), inputs: { text: await page.inputValue('#repo-text'), color: await page.inputValue('#repo-color'), rotation: await page.inputValue('#repo-rotation'), x: await page.inputValue('#repo-x') }, editMessages: messages.filter(item => item?.type === 'uds-test-edit-received' || item?.type === 'uds-repo-transform').slice(-8), inbound: await frame.locator('body').evaluate(() => window.__udsInboundEditTrace) }));
  const textUpdated = await frame.locator('#headline').evaluate(node => new Promise(resolve => {
    if (node.textContent === 'Новый заголовок') return resolve(true);
    const observer = new MutationObserver(() => {
      if (node.textContent === 'Новый заголовок') { observer.disconnect(); resolve(true); }
    });
    observer.observe(node, { childList: true, characterData: true, subtree: true });
    setTimeout(() => { observer.disconnect(); resolve(node.textContent === 'Новый заголовок'); }, 1500);
  }));
  check(textUpdated, `текст элемента не обновился в предпросмотре: ${await frame.locator('#headline').textContent()}`);
  check((await frame.locator('#headline').evaluate(node => node.style.color)) === 'rgb(255, 0, 0)', 'цвет элемента не применился');
  check((await frame.locator('#headline').evaluate(node => node.style.rotate)) === '12deg', 'наклон элемента не применился');
  check((await frame.locator('#headline').evaluate(node => node.style.translate)) === '18px -9px', 'смещение элемента не применилось');

  const downloadPromise = page.waitForEvent('download');
  await page.click('#repo-download');
  const download = await downloadPromise;
  const output = readFileSync(await download.path(), 'utf8');
  check(output.includes('Новый заголовок') && output.includes('rotate: 12deg') && output.includes('translate: 18px -9px'), 'HTML-экспорт не содержит выполненные правки');
  check(output.includes("parent.postMessage({type:'source-script-ran'}"), 'экспорт неожиданно удалил исходный скрипт');

  await page.click('#repo-reset');
  await frame.locator('#headline').click();
  check((await frame.locator('#headline').textContent()) === 'Старая надпись', 'сброс не вернул исходную страницу');
  check(errors.length === 0, `ошибки браузера: ${errors.join('; ')}`);
  await page.close();
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

if (failures.length) { console.error(`FAIL repo editor (${failures.length}/${checks})\n- ${failures.join('\n- ')}`); process.exitCode = 1; }
else console.log(`PASS repo editor: ${checks} checks`);
