import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stagingPath = resolve(root, 'config/wrangler.ai-staging.json');
const staging = JSON.parse(readFileSync(stagingPath, 'utf8'));

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
