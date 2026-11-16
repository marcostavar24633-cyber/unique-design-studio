import test from 'node:test';
import assert from 'node:assert/strict';
import { runWorkflow, WORKFLOW_STAGES } from '../src/engine/workflow.js';

test('workflow generates a project, concept, HTML, audit and export without external adapters', async () => {
  const result = await runWorkflow({ niche: 'магазин диванов', brand: 'Тест Диван', tier: 'premium' });
  assert.equal(result.project.niche, 'магазин диванов');
  assert.ok(result.concept.designDNA.primaryArchetype);
  assert.match(result.html, /<!doctype html/i);
  assert.ok(result.audit);
  assert.ok(result.exported);
  assert.deepEqual(result.stages.map(item => item.id), WORKFLOW_STAGES);
  assert.equal(result.stages.find(item => item.id === 'visual').status, 'needs_input');
  assert.equal(result.stages.find(item => item.id === 'publish').status, 'manual');
});

test('workflow calls optional visual and review adapters and only applies fixes through explicit adapter', async () => {
  const calls = [];
  const result = await runWorkflow({ niche: 'фотостудия', brand: 'Тест Фото' }, {
    imageDirector: async ({ brief }) => { calls.push('visual'); return { selected: brief.prompts.length }; },
    designDirector: async ({ audit }) => { calls.push('review'); return { approved: true, auditErrors: audit.errors.length }; },
    applyApprovedFixes: async ({ generated, review }) => {
      calls.push('fixes');
      assert.equal(review.approved, true);
      return { ...generated, exported: { ...generated.exported, testFixApplied: true } };
    },
  });
  assert.deepEqual(calls, ['visual', 'review', 'fixes']);
  assert.equal(result.fixes.status, 'applied');
  assert.equal(result.exported.testFixApplied, true);
  assert.equal(result.stages.find(item => item.id === 'visual').status, 'completed');
  assert.equal(result.stages.find(item => item.id === 'approved_fixes').status, 'completed');
});

test('workflow never applies review findings unless an explicit fix adapter is supplied', async () => {
  const result = await runWorkflow({ niche: 'салон красоты' }, {
    designDirector: async () => ({ approvedFixes: [{ id: 'change-hero' }] }),
  });
  assert.equal(result.fixes.status, 'awaiting_approval');
  assert.equal(result.stages.find(item => item.id === 'approved_fixes').status, 'needs_approval');
});
