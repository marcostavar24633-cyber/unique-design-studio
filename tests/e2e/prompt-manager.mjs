// End-to-end проверки Prompt Manager: версии, активация, импорт/экспорт и мобильная раскладка.
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
try {
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/studio/prompt-manager.html`, { waitUntil: 'networkidle' });

  check(await page.locator('#modules button').count() === 5, 'не отображаются все пять AI-модулей');
  check(await page.locator('#prompt-content').isVisible(), 'редактор промта не отображается');

  // Создаём две версии, затем возвращаем первую и проверяем фактическое состояние редактора.
  await page.locator('#prompt-content').fill('Write concise, factual copy for the selected brand.');
  await page.locator('#version-note').fill('Initial version');
  await page.click('#save');
  check((await page.textContent('#active-version')).includes('1'), 'первая версия не стала активной');
  await page.locator('#prompt-content').fill('Write concise, factual copy. Avoid unsupported claims.');
  await page.locator('#version-note').fill('More precise claims');
  await page.click('#save');
  check((await page.textContent('#active-version')).includes('2'), 'вторая версия не стала активной');
  await page.locator('.version').filter({ hasText: 'Версия 1' }).getByRole('button', { name: 'Активировать' }).click();
  check((await page.locator('#prompt-content').inputValue()).includes('selected brand'), 'активация старой версии не восстановила её текст');
  check((await page.textContent('#active-version')).includes('1'), 'после переключения активной осталась не первая версия');

  // Экспорт должен содержать историю и выбранную активную версию.
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#export')]);
  const exportPath = await download.path();
  const { readFileSync: readDownloaded } = await import('node:fs');
  const exported = JSON.parse(readDownloaded(exportPath, 'utf8'));
  check(exported.modules?.['landing-copy']?.activeVersion === 1, 'экспорт не сохранил выбранную активную версию');
  check(exported.modules?.['landing-copy']?.versions?.length === 2, 'экспорт потерял историю версий');

  // Меняем реестр, импортируем файл и убеждаемся, что импорт восстановил точную версию.
  await page.locator('#prompt-content').fill('Temporary third version.');
  await page.click('#save');
  await page.locator('#import-file').setInputFiles({ name: 'uds-prompt-registry.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Реестр импортирован'));
  check((await page.locator('#active-version').textContent()).includes('1'), 'импорт не восстановил активную версию');
  check((await page.locator('#prompt-content').inputValue()).includes('selected brand'), 'импорт не восстановил текст активной версии');
  check(await page.locator('.version').count() === 2, 'импорт не восстановил историю версий');

  // Ошибочный импорт не должен менять сохранённый реестр.
  const beforeInvalidImport = await page.evaluate(() => localStorage.getItem('uds:prompt-manager:v1'));
  await page.locator('#import-file').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{broken') });
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Импорт отклонён'));
  check(await page.evaluate(() => localStorage.getItem('uds:prompt-manager:v1')) === beforeInvalidImport, 'ошибочный импорт повредил сохранённый реестр');

  // Хранилище должно пережить полную перезагрузку вкладки.
  await page.reload({ waitUntil: 'networkidle' });
  check((await page.locator('#active-version').textContent()).includes('1'), 'активная версия потерялась после перезагрузки');
  check((await page.locator('#prompt-content').inputValue()).includes('selected brand'), 'текст промта потерялся после перезагрузки');

  // На мобильном экране модули, редактор и основные действия остаются в пределах viewport.
  await page.setViewportSize({ width: 375, height: 812 });
  const mobile = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    editor: document.querySelector('#prompt-content').getBoundingClientRect().toJSON(),
    exportButton: document.querySelector('#export').getBoundingClientRect().toJSON(),
  }));
  check(mobile.overflow <= 1, `Prompt Manager создаёт горизонтальную прокрутку на мобильном: ${mobile.overflow}px`);
  check(mobile.editor.width > 0 && mobile.editor.left >= 0 && mobile.editor.right <= 376, 'редактор промта выходит за границы мобильного экрана');
  check(mobile.exportButton.width > 0 && mobile.exportButton.left >= 0 && mobile.exportButton.right <= 376, 'кнопка экспорта недоступна на мобильном экране');
  check(errors.length === 0, `ошибки браузерного JavaScript: ${errors.join('; ')}`);
  await context.close();
} finally {
  await browser.close();
  server.close();
}
if (failures.length) { console.error(`Проверка Prompt Manager провалена: ${failures.length}\\n- ${failures.join('\\n- ')}`); process.exit(1); }
console.log('Prompt Manager E2E пройден: 5 модулей, версии, активация, импорт/экспорт, восстановление и мобильная раскладка.');
