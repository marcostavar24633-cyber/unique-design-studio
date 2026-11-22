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
