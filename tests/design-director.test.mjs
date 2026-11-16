import test from 'node:test';
import assert from 'node:assert/strict';
import { applyApprovedDesignPatch, reviewDesign } from '../src/engine/design-director.js';
import { full } from './helpers.mjs';

test('Director reviews the generated structure without mutating the source project', () => {
  const source = structuredClone(full);
  const before = JSON.stringify(source);
  const report = reviewDesign(source);
  assert.equal(JSON.stringify(source), before);
  assert.equal(report.safety.sourceMutated, false);
  assert.equal(report.safety.autoApplied, false);
  assert.equal(report.safety.requiresApproval, true);
  assert.ok(Array.isArray(report.recommendations));
});

test('Director flags missing real conversion destination and visual assets', () => {
  const report = reviewDesign({ niche: 'Услуги', title: 'Услуги', cta: 'Оставить заявку' });
  const ids = report.recommendations.map(item => item.id);
  assert.ok(ids.includes('conversion-destination'));
  assert.ok(ids.includes('hero-visual'));
});

test('approved patch applies only explicitly approved allowlisted fields', () => {
  const source = { niche: 'Кофейня', title: 'Старый', images: { hero: 'data:image/png;base64,abc' }, privateNote: 'keep' };
  const result = applyApprovedDesignPatch(source, {
    title: 'Новый',
    privateNote: 'overwrite',
    images: {},
    cta: 'Посмотреть меню',
  }, ['title', 'privateNote', 'images', 'cta']);
  assert.deepEqual(result.applied.sort(), ['cta', 'title']);
  assert.equal(result.project.title, 'Новый');
  assert.equal(result.project.cta, 'Посмотреть меню');
  assert.equal(result.project.privateNote, 'keep');
  assert.deepEqual(result.project.images, source.images);
  assert.equal(source.title, 'Старый');
});

test('unapproved or empty patch does not alter project', () => {
  const source = { niche: 'Магазин', title: 'Каталог' };
  const result = applyApprovedDesignPatch(source, { title: 'Изменено' }, []);
  assert.equal(result.changed, false);
  assert.deepEqual(result.project, source);
});
