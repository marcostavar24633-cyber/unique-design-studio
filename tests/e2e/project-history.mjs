// Проверка ручного сохранения, сравнения и безопасного восстановления версий проекта.
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
  const relative = normalize(pathname).replace(/^[/\\\\]+/, '');
  const file = join(root, relative);
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  await page.goto(`${base}/studio/index.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#form [data-path="brand"]') !== null);
  await page.fill('#qs-niche', 'Студия интерьерного освещения');
  await page.fill('#qs-brand', 'VERSION E2E');
  await page.click('#quick-start [type="submit"]');
  await page.waitForFunction(() => document.querySelector('#auto-status').textContent.includes('Готово'), null, { timeout: 20000 });
  const originalTitle = await page.locator('#form [data-path="title"]').inputValue();
  await page.click('#tab-registry');
  await page.waitForSelector('#project-history-list');
  await page.locator('#history-label').fill('Исходная концепция');
  await page.click('[data-history-save]');
  await page.waitForSelector('.project-history__item');
  check((await page.locator('.project-history__item').count()) === 1, 'первая версия не появилась в истории');

  await page.click('#ptab-editor');
  await page.locator('#form [data-path="title"]').fill('Новая редакция главного экрана');
  await page.waitForFunction(() => document.querySelector('#frame').srcdoc.includes('Новая редакция главного экрана'));
  await page.locator('#history-label').fill('Обновлённый заголовок');
  await page.click('[data-history-save]');
  await page.waitForFunction(() => document.querySelectorAll('.project-history__item').length === 2);
  await page.locator('.project-history__item').filter({ hasText: 'Исходная концепция' }).getByRole('button', { name: 'Сравнить' }).click();
  await page.waitForFunction(() => document.querySelector('#project-history-diff').textContent.includes('Сравнение:'));
  const comparisonText = await page.locator('#project-history-diff').textContent();
  const currentTitle = await page.locator('#form [data-path="title"]').inputValue();
  check(currentTitle === 'Новая редакция главного экрана', 'поле заголовка не сохранило введённое значение: ' + currentTitle);
  check(comparisonText.includes('Заголовок'), 'сравнение не обнаружило изменение заголовка; сравнение: ' + comparisonText + '; текущее поле: ' + currentTitle);

  await page.locator('.project-history__item').filter({ hasText: 'Исходная концепция' }).getByRole('button', { name: 'Восстановить' }).click();
  await page.waitForFunction(value => document.querySelector('#form [data-path="title"]').value === value, originalTitle);
  check(await page.locator('#form [data-path="title"]').inputValue() === originalTitle, 'восстановление не вернуло исходный заголовок');
  await page.waitForFunction(() => [...document.querySelectorAll('.project-history__item')].some(item => item.textContent.includes('Перед восстановлением')));
  const retainedVersions = await page.evaluate(async () => {
    const api = await import('/studio/project-history.js');
    const saved = JSON.parse(localStorage.getItem('uds:studio:v1'));
    const projectId = saved.raw.id;
    for (let i = 0; i < 11; i++) {
      await api.saveProjectVersion({ projectId, raw: { ...saved.raw, title: 'Cap test ' + i }, label: 'Cap test ' + i });
    }
    return (await api.listProjectVersions(projectId)).length;
  });
  check(retainedVersions === 10, 'ограничение истории не оставило ровно 10 последних версий: ' + retainedVersions);
  check(errors.length === 0, 'ошибки браузерного JavaScript: ' + errors.join('; '));
  await page.close();
} finally {
  await browser.close();
  server.close();
}
if (failures.length) { console.error('История версий проекта: ' + failures.join('\\n- ')); process.exit(1); }
console.log('История версий пройдена: сохранение, сравнение, восстановление и автоматический снимок перед откатом.');
