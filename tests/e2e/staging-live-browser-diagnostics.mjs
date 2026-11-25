// Direct browser CORS check against the briefly enabled private staging Worker.
// This makes one GET to /api/diagnostics; it never invokes AI or image generation.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const studioUrl = new URL(process.env.STUDIO_URL || 'https://marcostavar24633-cyber.github.io/unique-design-studio/studio/index.html');
const stagingUrl = new URL(process.env.STAGING_WORKER_PUBLIC_URL || 'https://unique-design-studio-ai-staging.marcostavar24633.workers.dev');
assert.equal(studioUrl.origin, 'https://marcostavar24633-cyber.github.io', 'diagnostics must originate from the published Studio');
assert.equal(stagingUrl.protocol, 'https:');
assert.match(stagingUrl.hostname, /^unique-design-studio-ai-staging\..+\.workers\.dev$/, 'must target the temporary staging Worker, never production');

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.goto(studioUrl.href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const result = await page.evaluate(async endpoint => {
    const response = await fetch(`${endpoint}/api/diagnostics`, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    });
    return {
      status: response.status,
      contentType: response.headers.get('content-type') || '',
      body: await response.json(),
    };
  }, stagingUrl.origin);

  assert.equal(result.status, 200, `staging diagnostics returned HTTP ${result.status}`);
  assert.match(result.contentType, /application\/json/i);
  assert.equal(result.body.ok, true, 'staging diagnostics must report a healthy Worker');
  assert.equal(result.body.service, 'unique-design-studio-ai', 'unexpected Worker responded');
  assert.equal(result.body.runtime?.workersAiBindingConfigured, true, 'Workers AI binding is not configured');
  console.log('Direct browser diagnostics passed: HTTP 200, exact Studio origin accepted, Workers AI binding configured. No AI inference was run.');
  await context.close();
} finally {
  await browser.close();
}

