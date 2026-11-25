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
      allowOrigin: response.headers.get('access-control-allow-origin'),
      body: await response.json(),
    };
  }, stagingUrl.origin);

  assert.equal(result.status, 413, `oversized staging request returned HTTP ${result.status}`);
  assert.equal(result.allowOrigin, studioUrl.origin, '413 response must remain readable by the Studio');
  assert.equal(result.body.maxBytes, 64_000, 'Worker must report its configured body limit');
  assert.match(result.body.error, /лимит 64000 байт/);
  console.log('Live staging payload limit passed: HTTP 413, limit=64000 bytes, CORS valid; invalid JSON ensures no AI inference path.');
  await context.close();
} finally {
  await browser.close();
}

