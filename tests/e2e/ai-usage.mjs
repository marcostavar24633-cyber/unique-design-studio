// AI Usage dashboard must handle unavailable browser storage and incomplete quota metrics.
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
const check = (condition, message) => { if (!condition) failures.push(message); };
try {
  // Browser privacy/security settings can make even getItem throw. This must not break studio startup.
  const blockedContext = await browser.newContext();
  await blockedContext.addInitScript(() => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = function(key) {
      if (key === 'uds:ai-endpoint') throw new DOMException('Blocked storage', 'SecurityError');
      return original.call(this, key);
    };
  });
  const blockedPage = await blockedContext.newPage();
  const blockedErrors = [];
  blockedPage.on('pageerror', error => blockedErrors.push(error.message));
  await blockedPage.goto(`${base}/studio/index.html`, { waitUntil: 'networkidle' });
  await blockedPage.waitForFunction(() => document.querySelector('#dash-ai-budget')?.textContent.includes('хранилище настроек недоступно'));
  check(blockedErrors.length === 0, 'недоступное localStorage вызвало ошибку страницы: ' + blockedErrors.join('; '));
  await blockedContext.close();

  // An absent metric is not zero usage: show the unavailable state, not a misleading 0/10,000 bar.
  const metricContext = await browser.newContext();
  await metricContext.addInitScript(() => localStorage.setItem('uds:ai-endpoint', 'https://example.test/api/generate-landing'));
  const metricPage = await metricContext.newPage();
  await metricPage.route('https://example.test/api/usage?range=*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ neurons: null, requests: 0 })
  }));
  const metricErrors = [];
  metricPage.on('pageerror', error => metricErrors.push(error.message));
  await metricPage.goto(`${base}/studio/index.html`, { waitUntil: 'networkidle' });
  await metricPage.waitForFunction(() => document.querySelector('#dash-ai-budget')?.textContent.includes('нет данных'));
  const budgetText = await metricPage.locator('#dash-ai-budget').innerText();
  check(!budgetText.includes('0 из ~10 000 Neurons'), 'отсутствующий показатель Neurons ошибочно показан как нулевой расход');
  check(await metricPage.locator('#ai-usage-count').innerText() === '—', 'верхний счётчик AI ошибочно показал null как нулевой расход');
  check((await metricPage.locator('#ai-usage-details').innerText()).includes('нет данных'), 'верхний счётчик не обозначил отсутствие Neurons');
  check(metricErrors.length === 0, 'ошибки JavaScript в AI Usage: ' + metricErrors.join('; '));
  await metricContext.close();
} finally {
  await browser.close();
  server.close();
}
if (failures.length) { console.error('AI Usage: ' + failures.join('\\n- ')); process.exit(1); }
console.log('AI Usage E2E пройден: storage SecurityError и отсутствующий Neurons metric обработаны корректно.');
