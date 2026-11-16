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
  assert.deepEqual([...new Set(result.stages.map(item => item.id))], WORKFLOW_STAGES);
  assert.equal(result.stages.findLast(item => item.id === 'visual').status, 'needs_input');
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
  assert.equal(result.stages.findLast(item => item.id === 'visual').status, 'completed');
  assert.equal(result.stages.findLast(item => item.id === 'approved_fixes').status, 'completed');
});

test('workflow never applies review findings unless an explicit fix adapter is supplied', async () => {
  const result = await runWorkflow({ niche: 'салон красоты' }, {
    designDirector: async () => ({ approvedFixes: [{ id: 'change-hero' }] }),
  });
  assert.equal(result.fixes.status, 'awaiting_approval');
  assert.equal(result.stages.find(item => item.id === 'approved_fixes').status, 'needs_approval');
});

test('workflow uses a prepared AI draft instead of replacing it with local niche copy', async () => {
  const draft = {
    project: { niche: 'авторские диваны', brand: 'AI Atelier', title: 'Диваны по вашему сценарию', description: 'AI draft', services: [] },
    analysis: { source: 'ai', niche: 'авторские диваны', audience: 'Покупатели дизайнерской мебели', segments: [], objections: [], keywords: [], imagePrompts: ['Editorial sofa photograph'] },
  };
  const result = await runWorkflow({ niche: 'другая ниша' }, { draft });
  assert.equal(result.project.brand, 'AI Atelier');
  assert.equal(result.project.title, 'Диваны по вашему сценарию');
  assert.equal(result.analysis.source, 'ai');
  assert.deepEqual(result.imageBrief.prompts, ['Editorial sofa photograph']);
});

test('workflow runs the built-in Design Director and keeps its recommendations pending approval', async () => {
  const result = await runWorkflow({ niche: 'магазин авторской мебели', title: 'Авторская мебель', cta: 'Посмотреть коллекцию' });
  assert.ok(result.designReview);
  assert.equal(result.designReview.mode, 'rules-based');
  assert.equal(result.designReview.safety.autoApplied, false);
  assert.equal(result.stages.findLast(item => item.id === 'design_review').status, 'completed');
  assert.equal(result.stages.findLast(item => item.id === 'approved_fixes').status, 'needs_approval');
  assert.equal(result.fixes.status, 'awaiting_approval');
});

test('approved design patches expose a preview and only change allowlisted approved fields', async () => {
  const { applyApprovedDesignPatch } = await import('../src/engine/design-director.js');
  const source = { title: 'Старый заголовок', cta: 'Подробнее', privateNote: 'не менять' };
  const proposal = { title: 'Новый заголовок', privateNote: 'подмена' };
  const preview = applyApprovedDesignPatch(source, proposal, ['title', 'privateNote']);
  assert.equal(preview.changed, true);
  assert.deepEqual(preview.applied, ['title']);
  assert.equal(preview.project.title, 'Новый заголовок');
  assert.equal(preview.project.privateNote, 'не менять');
  assert.equal(source.title, 'Старый заголовок');
});
