// Проверка аварийного сохранения проекта в IndexedDB при недоступном localStorage.
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
  const context = await browser.newContext();
  await context.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/studio/index.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelectorAll('#examples option').length > 1);
  await page.fill('#qs-niche', 'Студия резервного сохранения');
  await page.fill('#qs-brand', 'BACKUP E2E');
  await page.click('#quick-start [type="submit"]');
  await page.waitForFunction(() => document.querySelector('#auto-status').textContent.includes('Готово'), null, { timeout: 20000 });
  await page.waitForFunction(() => new Promise(resolve => {
    const request = indexedDB.open('uds-emergency-project-backup', 1);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('state')) { db.close(); resolve(false); return; }
      const tx = db.transaction('state', 'readonly');
      const get = tx.objectStore('state').get('latest');
      get.onsuccess = () => { const ok = get.result?.state?.raw?.brand === 'BACKUP E2E'; db.close(); resolve(ok); };
      get.onerror = () => { db.close(); resolve(false); };
    };
    request.onerror = () => resolve(false);
  }), null, { timeout: 10000 });
  check(await page.locator('#frame').getAttribute('srcdoc').then(html => html.includes('BACKUP E2E')), 'проект не сформирован перед перезагрузкой');

  await page.reload({ waitUntil: 'networkidle' });
  try {
    await page.waitForFunction(() => document.querySelector('#form [data-path="brand"]')?.value === 'BACKUP E2E', null, { timeout: 15000 });
    await page.waitForFunction(() => document.querySelector('#frame')?.srcdoc?.includes('BACKUP E2E'), null, { timeout: 15000 });
  } catch (error) {
    const debug = await page.evaluate(async () => {
      const module = await import('/studio/project-storage.js');
      const backup = await module.loadEmergencyBackup().catch(err => ({ error: err.message }));
      return {
        inputBrand: document.querySelector('#form [data-path="brand"]')?.value,
        frameHasBrand: document.querySelector('#frame')?.srcdoc?.includes('BACKUP E2E'),
        backupBrand: backup?.state?.raw?.brand,
        backupError: backup?.error
      };
    });
    throw new Error('Восстановление после перезагрузки не завершилось: ' + JSON.stringify(debug) + '; ' + error.message);
  }
  check(await page.locator('#form [data-path="brand"]').inputValue() === 'BACKUP E2E', 'после перезагрузки не восстановлен бренд из IndexedDB');
  check(errors.length === 0, 'ошибки JavaScript: ' + errors.join('; '));
  await context.close();
} finally {
  await browser.close();
  server.close();
}
if (failures.length) { console.error('Аварийное резервное сохранение: ' + failures.join('\\n- ')); process.exit(1); }
console.log('Аварийное сохранение пройдено: quota error → IndexedDB backup → reload → восстановление проекта.');
