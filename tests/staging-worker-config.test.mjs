import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stagingPath = resolve(root, 'config/wrangler.ai-staging.json');
const staging = JSON.parse(readFileSync(stagingPath, 'utf8'));
const faultPath = resolve(root, 'config/wrangler.fault-test.json');
const fault = JSON.parse(readFileSync(faultPath, 'utf8'));

test('staging Worker stays private and separate from production', () => {
  assert.equal(staging.name, 'unique-design-studio-ai-staging');
  assert.equal(staging.workers_dev, false);
  assert.equal(staging.preview_urls, false);
  assert.notEqual(staging.name, 'unique-design-studio-ai');
});

test('staging Worker uses direct Workers AI without paid fallbacks', () => {
  assert.equal(staging.ai?.binding, 'AI');
  assert.equal(staging.vars?.AI_BILLING_MODE, 'free');
  assert.equal(staging.vars?.NVIDIA_NIM_ENABLED, 'false');
  assert.equal(staging.services, undefined, 'staging must not depend on the production Gateway');
  assert.equal(existsSync(resolve(dirname(stagingPath), staging.main)), true);
});

test('synthetic fault-test Worker is isolated and cannot invoke AI or the Gateway', () => {
  assert.equal(fault.name, 'unique-design-studio-ai-fault-test');
  assert.equal(fault.workers_dev, true);
  assert.equal(fault.preview_urls, false);
  assert.equal(fault.ai, undefined);
  assert.equal(fault.services, undefined);
  assert.equal(existsSync(resolve(dirname(faultPath), fault.main)), true);
  const fixture = readFileSync(resolve(root, 'tests/fixtures/staging-fault-worker.mjs'), 'utf8');
  assert.match(fixture, /fault-503\\\/api\\\/diagnostics/);
  assert.match(fixture, /fault-timeout\\\/api\\\/diagnostics/);
  assert.match(fixture, /15_000/);
  assert.doesNotMatch(fixture, /env\.AI|env\.GATEWAY|generate-image/);
});

test('fault diagnostics deploy only on manual request and always clean up the temporary Worker', () => {
  const workflow = readFileSync(resolve(root, '.github/workflows/deploy-ai-staging.yml'), 'utf8');
  const browserCheck = readFileSync(resolve(root, 'tests/e2e/staging-fault-diagnostics.mjs'), 'utf8');
  assert.match(workflow, /- fault-diagnostics/);
  assert.match(workflow, /inputs\.operation == 'fault-diagnostics'/);
  assert.match(workflow, /always\(\).*steps\.deploy-fault-test\.outputs\.attempted/);
  assert.match(workflow, /wrangler@4 delete --config config\/wrangler\.fault-test\.json/);
  assert.match(workflow, /post-cleanup|route removed|route remains reachable/i);
  assert.match(browserCheck, /fault-503\/api\/generate-landing/);
  assert.match(browserCheck, /fault-timeout\/api\/generate-landing/);
  assert.match(browserCheck, /Synthetic upstream failure/);
  assert.match(browserCheck, /12 секунд/);
  assert.doesNotMatch(browserCheck, /api\/generate-image/);
});

test('staging offers a private browser diagnostics operation without deploying or invoking image inference', () => {
  const workflow = readFileSync(resolve(root, '.github/workflows/deploy-ai-staging.yml'), 'utf8');
  const browserCheck = readFileSync(resolve(root, 'tests/e2e/staging-browser-diagnostics.mjs'), 'utf8');
  assert.match(workflow, /- browser-diagnostics/);
  assert.match(workflow, /inputs\.operation == 'browser-diagnostics'/);
  assert.match(workflow, /wrangler@4 dev --remote/);
  assert.match(workflow, /tests\/e2e\/staging-browser-diagnostics\.mjs/);
  assert.match(browserCheck, /fetch\(`\$\{workerUrl\}\/api\/diagnostics`/);
  assert.match(browserCheck, /access-control-allow-origin/);
  assert.match(browserCheck, /workersAiBindingConfigured/);
  assert.doesNotMatch(browserCheck, /api\/generate-image/);
  assert.equal(staging.workers_dev, false);
  assert.equal(staging.preview_urls, false);
});

test('live browser diagnostics expose staging only for the check and always restore the private config', () => {
  const workflow = readFileSync(resolve(root, '.github/workflows/deploy-ai-staging.yml'), 'utf8');
  const browserCheck = readFileSync(resolve(root, 'tests/e2e/staging-live-browser-diagnostics.mjs'), 'utf8');
  assert.match(workflow, /- live-browser-diagnostics/);
  assert.match(workflow, /c\.workers_dev=true/);
  assert.match(workflow, /preview_urls=false/);
  assert.match(workflow, /npx --yes wrangler@4 deploy --config config\/wrangler\.ai-staging\.json/);
  assert.match(workflow, /always\(\).*steps\.expose-staging\.outputs\.attempted/);
  assert.match(workflow, /post-cleanup HTTP status/);
  assert.match(browserCheck, /page\.evaluate\(async endpoint/);
  assert.match(browserCheck, /fetch\(`\$\{endpoint\}\/api\/diagnostics`/);
  assert.doesNotMatch(browserCheck, /page\.route\(/, 'browser must make its request directly to the temporary staging hostname');
  assert.doesNotMatch(browserCheck, /api\/generate-image/);
});

test('live request-limit diagnostics use invalid input and never call AI inference', () => {
  const workflow = readFileSync(resolve(root, '.github/workflows/deploy-ai-staging.yml'), 'utf8');
  const payloadCheck = readFileSync(resolve(root, 'tests/e2e/staging-live-payload-limit.mjs'), 'utf8');
  assert.match(workflow, /- live-payload-limit-diagnostics/);
  assert.match(workflow, /inputs\.operation == 'live-payload-limit-diagnostics'/);
  assert.match(workflow, /tests\/e2e\/staging-live-payload-limit\.mjs/);
  assert.match(payloadCheck, /api\/generate-landing/);
  assert.match(payloadCheck, /64_000/);
  assert.match(payloadCheck, /result\.status, 413/);
  assert.match(payloadCheck, /result\.body\.maxBytes, 64_000/);
  assert.match(payloadCheck, /invalid JSON/);
  assert.match(payloadCheck, /attempt < 20/);
  assert.match(payloadCheck, /response\.status === 429/);
  assert.match(payloadCheck, /Некорректный JSON/);
  assert.doesNotMatch(payloadCheck, /api\/generate-image/);
});


