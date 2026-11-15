// Разнообразие реестра, правило «тёмный фон + золото» и необязательные веб-шрифты.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ARCHETYPES, DIRECTIONS, NICHES, buildConcept, exportProject, generate, normalizeProject } from '../src/engine/index.js';
import { examples } from './helpers.mjs';

const triple = f => `${f.archetype}|${f.placement}|${f.typeCharacter}`;

test('20 проектов подряд: соседи не повторяют hero, ни одна архитектура не занимает больше 40% реестра', () => {
  let registry = [];
  const prints = [];
  for (let round = 0; round < 3; round++) {
    for (const ex of examples) {
      if (prints.length === 20) break;
      const r = generate({ ...ex, id: `${ex.id}-${round}`, brand: `${ex.brand} ${round + 1}` }, { registry });
      registry = r.registry;
      assert.equal(r.concept.uniquenessCheck.templateReuseDetected, false, r.entry.id);
      prints.push(r.entry.fingerprint);
    }
  }
  assert.equal(prints.length, 20);
  for (let i = 1; i < prints.length; i++) assert.notEqual(triple(prints[i]), triple(prints[i - 1]), `проект ${i}`);
  const usage = {};
  for (const p of prints) usage[p.archetype] = (usage[p.archetype] || 0) + 1;
  assert.ok(Object.keys(usage).length >= 6, JSON.stringify(usage));
  assert.ok(Math.max(...Object.values(usage)) <= 8, JSON.stringify(usage));
});

test('примеры реестра получают разные первые экраны (архитектура + расположение визуала)', () => {
  let registry = [];
  const heroes = [];
  for (const ex of examples) {
    const r = generate(ex, { registry });
    registry = r.registry;
    heroes.push(`${r.entry.fingerprint.archetype}|${r.entry.fingerprint.placement}`);
  }
  assert.equal(new Set(heroes).size, heroes.length, heroes.join(', '));
  assert.ok(new Set(heroes.map(h => h.split('|')[0])).size >= 4, heroes.join(', '));
});

test('архитектура, заданная вручную, не меняется балансировкой реестра', () => {
  let registry = [];
  for (let i = 0; i < 4; i++) {
    const r = generate({ ...examples[0], id: `fixed-${i}`, architecture: 'catalog' }, { registry });
    registry = r.registry;
    assert.equal(r.concept.designDNA.primaryArchetype, 'catalog');
  }
});

const isGold = h => h >= 36 && h <= 54;
const hueOf = hex => {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  if (!d) return -1;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};

test('тёмный фон с золотым акцентом не выдаётся по умолчанию (§5)', () => {
  for (const [id, d] of Object.entries(DIRECTIONS)) {
    if (d.mode !== 'dark') continue;
    const [a, b] = d.ac[0];
    const span = b - a >= 300; // нейтральные направления (галерея) — без цветового тона
    assert.ok(span || b < 36 || a > 54, `${id}: тон акцента ${a}–${b}° попадает в золотой диапазон`);
  }
  for (const niche of NICHES) {
    for (let i = 0; i < 6; i++) {
      const c = buildConcept({ brand: `${niche.id}-${i}`, niche: niche.kw[0] instanceof RegExp ? niche.label : niche.kw[0] });
      const p = c.visualSystem.palette;
      if (p.mode === 'dark') assert.ok(!isGold(hueOf(p.accent)), `${niche.id}-${i}: ${p.accent}`);
    }
  }
});

test('шрифты: по умолчанию системные и без внешних запросов', () => {
  const r = generate(examples[0]);
  assert.doesNotMatch(r.html, /fonts\.googleapis/);
  assert.deepEqual(r.concept.visualSystem.typography.webFonts, []);
  assert.equal(normalizeProject(examples[0]).fonts, 'system');
});

test('шрифты: fonts:"web" подключает Google Fonts с кириллицей и оставляет системный запасной стек', () => {
  for (const id of Object.keys(ARCHETYPES)) {
    const r = generate({ ...examples[0], id: `web-${id}`, architecture: id, fonts: 'web' });
    const t = r.concept.visualSystem.typography;
    assert.ok(t.webFonts.length >= 1, id);
    assert.match(r.html, /<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?family=/, id);
    for (const f of t.webFonts) assert.ok(r.html.includes(`family=${f.family.replace(/ /g, '+')}:wght@`), `${id}: ${f.family}`);
    assert.ok(t.display.startsWith(`"${t.webFonts[0].family}"`) && /serif|monospace|sans-serif/.test(t.display), id);
    assert.deepEqual(r.audit.errors, [], id);
  }
});

test('шрифты: настройка сохраняется при экспорте и повторном импорте', () => {
  const raw = { ...examples[0], fonts: 'web' };
  const exported = exportProject(raw, buildConcept(raw));
  assert.equal(exported.fonts, 'web');
  assert.equal(normalizeProject(exported).fonts, 'web');
  assert.equal(normalizeProject({ ...examples[0], fonts: 'что-то другое' }).fonts, 'system');
});
