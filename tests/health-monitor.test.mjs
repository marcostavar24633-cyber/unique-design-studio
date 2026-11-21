import test from 'node:test';
import assert from 'node:assert/strict';
import { redactDiagnostic, summarizeHttpFailure, repairHint, isAiProbePayload } from '../scripts/ops/health-check.mjs';

test('diagnostic redaction masks common token formats and flattens multiline values', () => {
  const text = 'upstream failed\nBearer super-secret-token api_key=abcdefghijklmnop ghp_abcdefghijklmnop';
  const safe = redactDiagnostic(text);
  assert.doesNotMatch(safe, /super-secret-token|abcdefghijklmnop|\n/);
  assert.match(safe, /REDACTED/);
});

test('diagnostic redaction bounds untrusted error messages', () => {
  assert.equal(redactDiagnostic('a'.repeat(500)).length, 240);
});

test('HTTP failures only include allowlisted structured diagnostic fields', () => {
  const details = summarizeHttpFailure({
    data: {
      error: 'upstream unavailable',
      provider: 'workers-ai',
      model: 'gemma',
      route: 'gateway',
      prompt: 'private user content',
      generation: { status: 'failed', prompt: 'private content' },
    },
    text: '',
    response: { headers: new Headers({ 'content-type': 'application/json' }) },
  });
  assert.match(details, /provider=workers-ai/);
  assert.match(details, /generation.status=failed/);
  assert.doesNotMatch(details, /private|prompt/);
});

test('HTML upstream errors include only content type and title', () => {
  const details = summarizeHttpFailure({
    data: null,
    text: '<html><title>Bad Gateway</title><body>secret</body></html>',
    response: { headers: new Headers({ 'content-type': 'text/html' }) },
  });
  assert.match(details, /Bad Gateway/);
  assert.doesNotMatch(details, /secret/);
});

test('HTTP 502 is triage advice, not a confirmed cause or retry', () => {
  const hint = repairHint({ label: 'Workers AI inference', message: 'HTTP 502' });
  assert.match(hint, /не устанавливает причину/);
  assert.doesNotMatch(hint, /повторите запрос/i);
});

test('inference probe requires explicit non-applied safety contract', () => {
  assert.equal(isAiProbePayload({ review: { recommendations: [], status: 'looks-good', safety: { autoApplied: false } } }), true);
  assert.equal(isAiProbePayload({ review: { recommendations: [], status: 'looks-good', safety: { autoApplied: true } } }), false);
});
