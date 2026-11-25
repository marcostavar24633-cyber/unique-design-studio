// Browser-side CORS check against the temporary staging runtime.
// Playwright forwards the browser's request to the private local wrangler dev port,
// then returns the real Worker response to Chromium for normal CORS enforcement.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const studioUrl = new URL(process.env.STUDIO_URL || 'https://marcostavar24633-cyber.github.io/unique-design-studio/');
const studioOrigin = process.env.STUDIO_ORIGIN || studioUrl.origin;
const workerPublicUrl = new URL(process.env.STAGING_WORKER_PUBLIC_URL || 'https://unique-design-studio-ai.marcostavar24633.workers.dev');
const stagingLocalUrl = new URL(process.env.STAGING_LOCAL_URL || 'http://127.0.0.1:8787');

assert.equal(studioUrl.origin, studioOrigin, 'STUDIO_ORIGIN must match the browser page origin');
assert.equal(workerPublicUrl.protocol, 'https:', 'The browser must address the Worker through its HTTPS URL');
assert.ok(['http:', 'https:'].includes(stagingLocalUrl.protocol), 'STAGING_LOCAL_URL must be an HTTP URL');

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  let stagingAllowOrigin = null;
  await page.route(`${workerPublicUrl.origin}/**`, async route => {
    const requested = new URL(route.request().url());
    const upstreamUrl = new URL(`${requested.pathname}${requested.search}`, stagingLocalUrl);
    const response = await route.fetch({
      url: upstreamUrl.href,
      headers: { origin: studioOrigin, accept: 'application/json' },
    });
    stagingAllowOrigin = response.headers()['access-control-allow-origin'] || null;
    await route.fulfill({ response });
  });

  await page.goto(studioUrl.href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const result = await page.evaluate(async workerUrl => {
    const response = await fetch(`${workerUrl}/api/diagnostics`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    return {
      status: response.status,
      contentType: response.headers.get('content-type') || '',
      body: await response.json(),
    };
  }, workerPublicUrl.origin);

  assert.equal(result.status, 200, `staging diagnostics returned HTTP ${result.status}`);
  assert.equal(stagingAllowOrigin, studioOrigin, 'staging Worker did not allow the exact browser origin');
  assert.match(result.contentType, /application\/json/i);
  assert.equal(result.body.ok, true, 'staging diagnostics did not report ok=true');
  assert.equal(result.body.service, 'unique-design-studio-ai');
  assert.equal(result.body.runtime?.workersAiBindingConfigured, true, 'staging AI binding is not configured');
  console.log('Browser CORS diagnostics passed: Pages origin fetched the temporary staging Worker and received the real diagnostic response.');
} finally {
  await browser.close();
}
