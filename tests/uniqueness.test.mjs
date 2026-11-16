import test from 'node:test';
import assert from 'node:assert/strict';
import { ARCHETYPE_IDS, buildConcept, generate, registryEntry, similarity } from '../src/engine/index.js';
import { example, examples } from './helpers.mjs';

const triple = f => `${f.archetype}|${f.placement}|${f.typeCharacter}`;

test('соседние проекты не повторяют одновременно архитектуру, расположение визуала и типографику (§5)', () => {
  let registry = [];
  const prints = [];
  for (const ex of examples) {
    const r = generate(ex, { registry });
    registry = r.registry;
    assert.equal(r.concept.uniquenessCheck.templateReuseDetected, false, ex.id);
    assert.deepEqual(r.audit.errors, [], ex.id);
    prints.push(r.entry.fingerprint);
  }
  for (let i = 1; i < prints.length; i++) for (const j of [i - 1, i - 2]) {
    if (j >= 0) assert.notEqual(triple(prints[i]), triple(prints[j]), `${examples[i].id} ↔ ${examples[j].id}`);
  }
});

test('одинаковая ниша подряд: композиция пересобирается, а не перекрашивается', () => {
  const a = { brand: 'Кофейня Первая', niche: 'кофейня', title: 'Кофе', cta: 'Меню', contacts: { email: 'a@example.com' }, services: [['Эспрессо', '']] };
  let registry = [];
  const seen = [];
  for (let i = 0; i < 6; i++) {
    // Один и тот же бренд и ниша под разными id — худший случай: исходный выбор полностью совпадает.
    const r = generate({ ...a, id: `coffee-${i}` }, { registry });
    registry = r.registry;
    const t = triple(r.entry.fingerprint);
    assert.equal(r.concept.uniquenessCheck.templateReuseDetected, false);
    assert.ok(!seen.slice(-2).includes(t), `проект ${i} повторил соседа: ${t}`);
    if (i > 0) {
      assert.ok(r.concept.uniquenessCheck.repeatedPatterns.length > 0, 'повтор должен быть зафиксирован');
      assert.ok(r.concept.uniquenessCheck.differentiationActions.length > 0, 'действие должно быть зафиксировано');
    }
    seen.push(t);
  }
  assert.ok(new Set(registry.map(e => e.fingerprint.archetype)).size >= 2, 'при повторе должна меняться архитектура');
});

test('при жёстко заданной архитектуре меняется расположение визуала или типографика', () => {
  for (const id of ARCHETYPE_IDS) {
    const base = { ...example('hair'), architecture: id };
    const first = buildConcept({ ...base, id: 'one' });
    const second = buildConcept({ ...base, id: 'two' }, { registry: [registryEntry({ ...base, id: 'one' }, first)] });
    assert.equal(second.designDNA.primaryArchetype, id);
    assert.notEqual(triple(second.uniquenessCheck.fingerprint), triple(first.uniquenessCheck.fingerprint), id);
    assert.equal(second.uniquenessCheck.templateReuseDetected, false, id);
  }
});

test('перегенерация того же проекта не считается повтором самого себя', () => {
  const ex = example('penka');
  const first = generate(ex);
  const again = generate(ex, { registry: first.registry });
  assert.equal(again.html, first.html);
  assert.equal(again.registry.length, 1);
});

test('мера сходства: 1 для одинаковых отпечатков, меньше для разных', () => {
  const a = buildConcept(example('penka')).uniquenessCheck.fingerprint;
  const b = buildConcept(example('doma-tech')).uniquenessCheck.fingerprint;
  assert.equal(similarity(a, a), 1);
  assert.ok(similarity(a, b) < 0.5);
});

test('отпечаток дизайна учитывает графический мотив, кнопку и motion, а старые записи совместимы', () => {
  const current = buildConcept(example('penka')).uniquenessCheck.fingerprint;
  for (const key of ['archetype', 'placement', 'typeCharacter', 'nav', 'colorDirection', 'shape', 'motif', 'button', 'motion', 'sectionLayout']) {
    assert.ok(Object.hasOwn(current, key), `нет признака ${key}`);
  }
  const legacy = Object.fromEntries(['archetype', 'placement', 'typeCharacter', 'nav', 'colorDirection', 'shape'].map(key => [key, current[key]]));
  assert.equal(similarity(legacy, legacy), 1);
  assert.equal(similarity(current, current), 1);
  assert.ok(similarity(current, { ...current, motif: 'different-motif', button: 'different-button', motion: 'different-motion' }) < 1);
});
