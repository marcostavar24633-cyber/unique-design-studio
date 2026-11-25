// Sends an invalid oversized JSON body to staging. A correct Worker rejects it
// with 413 before parsing or invoking any AI model.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const studioUrl = new URL(process.env.STUDIO_URL || 'https://marcostavar24633-cyber.github.io/unique-design-studio/studio/index.html');
const stagingUrl = new URL(process.env.STAGING_WORKER_PUBLIC_URL || 'https://unique-design-studio-ai-staging.marcostavar24633.workers.dev');
assert.equal(studioUrl.origin, 'https://marcostavar24633-cyber.github.io', 'request must originate from the published Studio');
assert.equal(stagingUrl.protocol, 'https:');
assert.match(stagingUrl.hostname, /^unique-design-studio-ai-staging\..+\.workers\.dev$/, 'must target temporary staging, never production');

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.goto(studioUrl.href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const result = await page.evaluate(async endpoint => {
    // Invalid JSON is deliberate: if the size guard regresses, parsing fails
    // before there is any path to call the text or image model.
    const body = `${' '.repeat(64_000)}!`;
    const response = await fetch(`${endpoint}/api/generate-landing`, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(20_000),
    });
    return {
      status: response.status,
      body: await response.json(),
    };
  }, stagingUrl.origin);

  assert.equal(result.status, 413, `oversized staging request returned HTTP ${result.status}`);
  assert.equal(result.body.maxBytes, 64_000, 'Worker must report its configured body limit');
  assert.match(result.body.error, /лимит 64000 байт/);

  let rateLimited = false;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await page.evaluate(async endpoint => {
      const result = await fetch(`${endpoint}/api/generate-landing`, {
        method: 'POST',
        mode: 'cors',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
        signal: AbortSignal.timeout(20_000),
      });
      return { status: result.status, body: await result.json() };
    }, stagingUrl.origin);
    if (response.status === 429) {
      assert.match(response.body.error, /Слишком много запросов/);
      rateLimited = true;
      break;
    }
    assert.equal(response.status, 400, `invalid JSON attempt ${attempt + 1} returned HTTP ${response.status}`);
    assert.match(response.body.error, /Некорректный JSON/);
  }
  assert.equal(rateLimited, true, 'Worker must apply its real per-IP rate limit');
  console.log('Live staging request guards passed: oversized body HTTP 413, invalid JSON rate limit HTTP 429; no AI inference path was used.');
  await context.close();
} finally {
  await browser.close();
}

