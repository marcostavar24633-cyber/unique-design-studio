import test from 'node:test';
import assert from 'node:assert/strict';
import { ARCHETYPES, ARCHETYPE_IDS, DIRECTIONS, NICHES, buildConcept, buildPalette, buildPrompt, detectNiche, generate, normalizeProject } from '../src/engine/index.js';
import { example, examples, full, unbranded } from './helpers.mjs';

test('контракт концепции содержит все поля спецификации (§8)', () => {
  for (const ex of examples) {
    const c = buildConcept(ex);
    for (const k of ['businessType', 'audience', 'primaryGoal', 'brandCharacter', 'contentPriority']) assert.ok(k in c.designBrief, `designBrief.${k}`);
    for (const k of ['primaryArchetype', 'secondaryArchetype', 'selectionRationale', 'colorDirection', 'typographyDirection', 'imageDirection', 'motionDirection']) assert.equal(typeof c.designDNA[k], 'string', `designDNA.${k}`);
    for (const k of ['heroComposition', 'navigationPattern', 'primaryCTA']) assert.ok(c.homepage[k], `homepage.${k}`);
    assert.ok(Array.isArray(c.homepage.sectionOrder) && c.homepage.sectionOrder.length);
    assert.equal(typeof c.uniquenessCheck.templateReuseDetected, 'boolean');
    assert.ok(Array.isArray(c.uniquenessCheck.repeatedPatterns) && Array.isArray(c.uniquenessCheck.differentiationActions));
    assert.ok(Array.isArray(c.designBrief.contentPriority) && c.designBrief.contentPriority.length);
    assert.ok(c.designDNA.selectionRationale.length > 40);
  }
});

test('выбор архитектуры соответствует ориентирам ниш (§10)', () => {
  const expected = {
    'doma-tech': ['product-first', 'catalog'], photograf: ['immersive', 'editorial'], penka: ['editorial', 'modular-grid'],
    raki: ['product-first', 'storytelling'], hair: ['editorial', 'split-utility'], telescopes: ['catalog', 'product-first'],
  };
  for (const [id, allowed] of Object.entries(expected)) {
    const c = buildConcept(example(id));
    assert.ok(allowed.includes(c.designDNA.primaryArchetype), `${id}: ${c.designDNA.primaryArchetype}`);
    assert.ok(allowed.includes(c.designDNA.secondaryArchetype), `${id} secondary: ${c.designDNA.secondaryArchetype}`);
  }
});

test('не каждая ниша превращается в тёмный премиальный лендинг (§4, §5)', () => {
  const modes = examples.map(ex => buildConcept(ex).visualSystem.palette.mode);
  assert.ok(modes.filter(m => m === 'light').length >= 3, modes.join());
  const archetypes = new Set(examples.map(ex => buildConcept(ex).designDNA.primaryArchetype));
  assert.ok(archetypes.size >= 4, [...archetypes].join());
});

test('адаптивное кадрирование фотографий учитывает нулевые координаты и безопасные значения по умолчанию', () => {
  const project = {
    ...full,
    images: { hero: 'https://example.com/hero.jpg', heroAlt: 'Тестовое фото' },
    imageArtDirection: { hero: {
      desktop: { x: 0, y: 100 },
      tablet: { x: 120, y: -10 },
      mobile: { x: null, y: '' },
    } },
  };
  const result = generate(project);
  assert.match(result.html, /--ds-crop-desktop:0% 100%/);
  assert.match(result.html, /--ds-crop-tablet:100% 0%/);
  assert.match(result.html, /--ds-crop-mobile:50% 50%/);
});

test('мобильное фото Hero экспортируется в picture, а старый проект остаётся совместимым', () => {
  const base = generate({ ...full, images: { hero: 'https://example.com/desktop.jpg', heroAlt: 'Главное фото' } });
  assert.ok(base.html.includes('src="https://example.com/desktop.jpg"'));
  assert.ok(!base.html.includes('<picture class="ds-hero-picture">'));
  const responsive = generate({ ...full, images: { hero: 'https://example.com/desktop.jpg', heroMobile: 'https://example.com/mobile.jpg', heroAlt: 'Главное фото' } });
  assert.ok(responsive.html.includes('<picture class="ds-hero-picture"><source media="(max-width:600px)" srcset="https://example.com/mobile.jpg">'));
  assert.ok(responsive.html.includes('src="https://example.com/desktop.jpg"'));
});

test('mobile art direction supports separate gallery and service image sources', () => {
  const project = { ...full, gallery: [{ src: 'https://example.com/gallery.jpg', alt: 'Desktop gallery' }], services: [{ title: 'Service', image: 'https://example.com/service.jpg' }], imageArtDirection: { mobileSources: { gallery: { 0: 'https://example.com/gallery-mobile.jpg' }, services: { 0: 'https://example.com/service-mobile.jpg' } } } };
  const html = generate(project).html;
  assert.ok(html.includes('srcset="https://example.com/gallery-mobile.jpg"'));
  assert.ok(html.includes('srcset="https://example.com/service-mobile.jpg"'));
  assert.ok(html.includes('src="https://example.com/gallery.jpg"'));
  assert.ok(html.includes('src="https://example.com/service.jpg"'));
});

test('генерация детерминирована', () => {
  const a = generate(example('penka')), b = generate(example('penka'));
  assert.equal(a.html, b.html);
  assert.deepEqual(a.concept, b.concept);
});

test('ниша распознаётся по описанию, неизвестная получает универсальный профиль с гипотезой', () => {
  assert.equal(detectNiche(normalizeProject({ niche: 'Юридическая консультация' })).id, 'proservices');
  assert.equal(detectNiche(normalizeProject({ niche: 'брак и семья' })).id, 'generic', '«брак» не должен совпадать с «рак»');
  const c = buildConcept({ brand: 'X', niche: 'нечто неописуемое' });
  assert.ok(c.designBrief.assumptions.some(a => a.includes('Ниша не распознана')));
  assert.ok(c.designBrief.assumptions.some(a => a.startsWith('Аудитория — гипотеза')));
});

test('справочники согласованы', () => {
  for (const n of NICHES) {
    for (const a of n.candidates) assert.ok(ARCHETYPES[a], `${n.id}: ${a}`);
    for (const d of n.directions) assert.ok(DIRECTIONS[d], `${n.id}: ${d}`);
  }
  assert.equal(ARCHETYPE_IDS.length, 10);
  for (const a of Object.values(ARCHETYPES)) assert.ok(Object.keys(a.placements).length >= 2);
});

test('все 10 архитектур дают разные композиции hero и проходят проверку', () => {
  const heroes = new Set();
  for (const id of ARCHETYPE_IDS) {
    const r = generate({ ...full, architecture: id });
    assert.equal(r.concept.designDNA.primaryArchetype, id);
    assert.deepEqual(r.audit.errors, [], id);
    const hero = /<section class="hero[\s\S]*?<\/section>/.exec(r.html)[0].replace(/>[^<]+</g, '><');
    heroes.add(hero);
  }
  assert.equal(heroes.size, 10);
});

test('контраст палитры не ниже 4.5:1 для всех направлений и множества сидов', () => {
  for (const dir of Object.keys(DIRECTIONS)) for (let seed = 1; seed <= 150; seed++) {
    for (const accent of ['', '#f08a7b', '#ffee00', '#101010', '#7a7a7a']) {
      for (const p of buildPalette(dir, seed, { accent }).pairs) assert.ok(p.ratio >= 4.5, `${dir} seed ${seed} accent ${accent}: ${p.name} ${p.ratio}`);
    }
  }
});

test('выбор пользователя соблюдается: палитра, акцент, точная архитектура', () => {
  // Без фирменного профиля: палитру и акцент задаёт сам проект.
  const c = buildConcept({ ...unbranded(example('penka')), palette: 'Тёмная', accent: '#ff5500', architecture: 'brutalist' });
  assert.equal(c.visualSystem.palette.mode, 'dark');
  assert.equal(c.visualSystem.palette.accent, '#ff5500');
  assert.equal(c.designDNA.primaryArchetype, 'brutalist');
  assert.equal(buildConcept({ ...unbranded(example('raki')), palette: 'Тёмная', accent: '#f08a7b' }).visualSystem.direction, 'graphite-coral');
  // С фирменным профилем акцент проекта всё равно переопределяет акцент бренда.
  assert.equal(buildConcept({ ...example('penka'), accent: '#ff5500' }).visualSystem.palette.accent, '#ff5500');
});

test('промт для AI-помощника содержит выбранную концепцию (§11.3)', () => {
  const ex = example('telescopes');
  const c = buildConcept(ex);
  const prompt = buildPrompt(ex, c);
  assert.ok(prompt.includes(ARCHETYPES[c.designDNA.primaryArchetype].name));
  assert.ok(prompt.includes(c.homepage.heroComposition));
  assert.ok(prompt.includes('Не выдумывай цены'));
});
