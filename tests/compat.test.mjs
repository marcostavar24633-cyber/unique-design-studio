import test from 'node:test';
import assert from 'node:assert/strict';
import { LEGACY_FAMILIES, exportProject, generate, normalizeProject } from '../src/engine/index.js';
import { examples, full, readJson } from './helpers.mjs';

const legacy = readJson('tests/fixtures/landing-studio-legacy.json');

test('JSON Landing Studio импортируется без изменений', () => {
  const r = generate(legacy);
  assert.deepEqual(r.audit.errors.map(e => e.id), ['cta-path'], 'единственная ошибка — в старом JSON нет контактов');
  assert.ok(LEGACY_FAMILIES.service.includes(r.concept.designDNA.primaryArchetype), 'семейство service из старого редактора соблюдено');
  assert.equal(r.concept.visualSystem.palette.mode, 'light');
  assert.equal(r.concept.visualSystem.palette.accent, '#2774a8');
  assert.ok(r.html.includes('Строительство'));
  assert.equal(r.concept.designBrief.audience, legacy.targetAudience);
});

test('проект без поля архитектуры работает в автоматическом режиме', () => {
  const { designArchitecture, ...old } = legacy;
  const p = normalizeProject(old);
  assert.equal(p.architecture.mode, 'auto');
  assert.equal(generate(old).concept.designDNA.primaryArchetype, 'split-utility');
});

test('экспорт сохраняет старые поля и неизвестные данные, дополняя устойчивыми идентификаторами', () => {
  const r = generate(legacy);
  const out = r.exported;
  assert.ok(['catalog', 'editorial', 'immersive', 'service', 'modular'].includes(out.designArchitecture));
  assert.ok(['Тёмная', 'Светлая'].includes(out.palette));
  assert.deepEqual(out.services.map(row => row.slice(0, 2)), legacy.services.map(row => row.slice(0, 2)));
  assert.ok(out.services.every(row => typeof row[7] === 'string' && row[7].startsWith('service-')));
  assert.deepEqual(out.faqs.map(row => row.slice(0, 2)), legacy.faqs.map(row => row.slice(0, 2)));
  assert.equal(out.marketResearch, legacy.marketResearch);
  assert.deepEqual(out.researchSources, legacy.researchSources);
  assert.ok(out.concept.designDNA.primaryArchetype, 'концепция сохраняется в экспорте');
  assert.ok(!('visualSystem' in out.concept));
});

test('экспорт → импорт даёт ту же страницу', () => {
  for (const ex of [...examples, full, legacy, { ...full, architecture: 'brutalist' }, { ...legacy, designArchitecture: 'modular' }]) {
    const a = generate(ex);
    const b = generate(JSON.parse(JSON.stringify(a.exported)));
    assert.equal(b.html, a.html, ex.id || ex.brand);
    assert.deepEqual(exportProject(b.project, b.concept), a.exported);
  }
});

test('списки принимаются и массивами, и объектами', () => {
  const p = normalizeProject({ services: [['A', 'a', '100 ₽'], { title: 'B', text: 'b', price: '200 ₽' }, 'C'] });
  assert.deepEqual(p.services.map(s => [s.title, s.text, s.price]), [['A', 'a', '100 ₽'], ['B', 'b', '200 ₽'], ['C', '', '']]);
});

test('некорректный ввод не ломает генерацию', () => {
  for (const bad of [null, undefined, {}, [], 'строка', { services: 'нет', gallery: 5, contacts: 'x', accent: 'красный', architecture: 42 }]) {
    const r = generate(bad);
    assert.ok(r.html.startsWith('<!doctype html>'));
  }
});
