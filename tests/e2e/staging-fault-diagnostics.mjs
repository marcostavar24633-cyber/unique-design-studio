import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const studioUrl = process.env.STUDIO_URL || 'https://marcostavar24633-cyber.github.io/unique-design-studio/studio/index.html';
const workerUrl = process.env.STAGING_WORKER_PUBLIC_URL;
assert.ok(workerUrl, 'STAGING_WORKER_PUBLIC_URL is required');

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(studioUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.locator('#ptab-own').click();
  const endpointInput = page.locator('#auto-endpoint');
  const checkButton = page.locator('#ai-connection-check');
  const status = page.locator('#ai-connection-status');
  assert.equal(await endpointInput.count(), 1, 'published Studio endpoint input is present');
  assert.equal(await checkButton.count(), 1, 'published Studio diagnostics button is present');

  await endpointInput.fill(`${workerUrl}/fault-503/api/generate-landing`);
  await checkButton.click();
  await page.waitForFunction(() => document.querySelector('#ai-connection-status')?.textContent.includes('Synthetic upstream failure (HTTP 503)'), null, { timeout: 10_000 });
  assert.match(await status.textContent(), /Проверка не пройдена/);
  console.log('Published Studio displayed the synthetic HTTP 503 response.');

  await endpointInput.fill(`${workerUrl}/fault-timeout/api/generate-landing`);
  await checkButton.click();
  await page.waitForFunction(() => document.querySelector('#ai-connection-status')?.textContent.includes('12 секунд'), null, { timeout: 20_000 });
  assert.match(await status.textContent(), /Worker не ответил за 12 секунд/);
  console.log('Published Studio reported its 12-second timeout for the synthetic delayed response.');
} finally {
  await browser.close();
}

