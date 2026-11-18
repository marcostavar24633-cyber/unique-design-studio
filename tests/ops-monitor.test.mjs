import test from 'node:test';
import assert from 'node:assert/strict';
import { isAiProbePayload, isWorkerHealthPayload } from '../scripts/ops/health-check.mjs';

test('Worker health response must identify the expected service', () => {
  assert.equal(isWorkerHealthPayload({ ok: true, service: 'unique-design-studio-ai' }), true);
  assert.equal(isWorkerHealthPayload({ ok: true, service: 'other-worker' }), false);
  assert.equal(isWorkerHealthPayload({ ok: false, service: 'unique-design-studio-ai' }), false);
  assert.equal(isWorkerHealthPayload(null), false);
});

test('AI inference probe requires the Design Review contract and no auto-apply', () => {
  assert.equal(isAiProbePayload({
    review: { status: 'review-needed', recommendations: [], safety: { autoApplied: false } },
  }), true);
  assert.equal(isAiProbePayload({
    review: { status: 'review-needed', recommendations: [], safety: { autoApplied: true } },
  }), false);
  assert.equal(isAiProbePayload({ review: { status: 'unknown', recommendations: [] } }), false);
  assert.equal(isAiProbePayload({}), false);
});
