import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { generate } from '../../src/engine/index.js';
import { full } from '../helpers.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const { html } = generate({ ...full, architecture: 'immersive', architectureMode: 'exact', navStyle: 'overlay' });
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => scrollTo(0, Math.max(0, document.querySelector('.hero').offsetHeight - 120)));
  const before = await page.evaluate(() => scrollY);
  await page.mouse.move(640, 80);
  await page.mouse.wheel(0, -360);
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => scrollY);
  assert.ok(after < before - 80, `upward wheel input should move toward the hero (before=${before}, after=${after})`);

  await page.locator('.nav__links a[href="#items"]').first().click();
  await page.waitForTimeout(1200);
  assert.equal(new URL(page.url()).hash, '#items');
  const targetTop = await page.locator('#items').evaluate(el => el.getBoundingClientRect().top);
  assert.ok(Math.abs(targetTop) < 80, `anchor navigation should land on its section (top=${targetTop})`);
} finally {
  await browser.close();
}
console.log('Scroll behavior passed: upward wheel input is immediate and anchor navigation remains smooth.');
