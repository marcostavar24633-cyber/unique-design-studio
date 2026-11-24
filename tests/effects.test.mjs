import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConcept, generate, exportProject, CARD_EFFECT_IDS, HERO_EFFECT_IDS, chooseEffects, describeEffects } from '../src/engine/index.js';
import { cardEffectCss, heroEffectCss, effectsScript, heroEffectMarkup } from '../src/engine/effects.js';

const photo = 'https://example.com/a.jpg';
const base = { brand: 'Поток', niche: 'студия йоги', title: 'Йога для спины', contacts: { email: 'hello@example.com' },
  services: [['Хатха', 'Спокойная практика', '900 ₽', '', '', '', 'Хит'], ['Виньяса', 'Динамичные связки']], advantages: [['12 лет практики', 'Опыт'], ['8 человек', 'В группе']] };

test('24 эффекта карточек и 22 эффекта первого экрана', () => {
  assert.equal(CARD_EFFECT_IDS.length, 24);
  assert.equal(HERO_EFFECT_IDS.length, 22);
});

test('ручной выбор главнее; «без эффекта» поддержан; неизвестное — авто', () => {
  const fx = buildConcept({ ...base, cardEffect: 'stack', heroEffect: 'aurora' }).visualSystem.effects;
  assert.equal(fx.card, 'stack'); assert.equal(fx.hero, 'aurora');
  const none = buildConcept({ ...base, cardEffect: 'none', heroEffect: 'none' }).visualSystem.effects;
  assert.equal(none.card, 'none'); assert.equal(none.hero, 'none');
  const auto = buildConcept({ ...base, cardEffect: 'нет', heroEffect: 'нет' }).visualSystem.effects;
  assert.ok(CARD_EFFECT_IDS.includes(auto.card) && (HERO_EFFECT_IDS.includes(auto.hero) || auto.hero === 'none'));
  assert.deepEqual(chooseEffects({}, { seed: 5 }), chooseEffects({}, { seed: 5 }));
});

test('фотоэффекты первого экрана без фото не применяются и честно описаны', () => {
  for (const id of ['ken-burns', 'duotone', 'photo-wipe', 'double-exposure']) {
    const fx = chooseEffects({ passthrough: { heroEffect: id } }, {});
    assert.equal(fx.hero, 'none', id);
    assert.match(describeEffects(fx), /нужны фото/);
    assert.equal(chooseEffects({ images: { hero: photo }, passthrough: { heroEffect: id } }, {}).hero, id);
  }
  assert.equal(chooseEffects({ images: { hero: photo }, passthrough: { heroEffect: 'slideshow' } }, {}).hero, 'none', 'слайд-шоу требует двух фото');
  assert.equal(chooseEffects({ images: { hero: photo }, gallery: [{ src: photo }, { src: 'https://example.com/b.jpg' }], passthrough: { heroEffect: 'slideshow' } }, {}).hero, 'slideshow');
  for (let i = 0; i < 20; i++) {
    const fx = buildConcept({ ...base, brand: 'Без фото ' + i }).visualSystem.effects;
    assert.ok(!['ken-burns', 'duotone', 'photo-wipe', 'double-exposure', 'slideshow'].includes(fx.hero), 'авто без фото не выбирает фотоэффекты');
  }
});

test('доступность: наведение дублируется фокусом, движение — только без reduced-motion, слои декоративны', () => {
  for (const id of CARD_EFFECT_IDS) {
    const css = cardEffectCss(id);
    if (/:hover/.test(css) && !/@media\(hover:hover\)/.test(css)) assert.match(css, /:focus-within/, `${id}: наведение без фокуса`);
    if (/animation:|transition:transform|transform:translate|rotateX/.test(css)) {
      assert.ok(/prefers-reduced-motion:no-preference|@media\(hover:hover\)/.test(css) || /prefers-reduced-motion:reduce/.test(css), `${id}: движение должно быть ограничено настройкой доступности`);
    }
  }
  for (const id of HERO_EFFECT_IDS) {
    const css = heroEffectCss({ hero: id }, { mode: 'light', accent: '#cc5522' });
    const animated = (css.match(/animation:[^;}]+/g) || []).filter(rule => !/^animation:\s*none\b/.test(rule));
    if (animated.length) assert.match(css, /@media\(prefers-reduced-motion:no-preference\)/, `${id}: анимация только без reduced-motion`);
    const markup = heroEffectMarkup({ hero: id }, { gallery: [{ src: photo }, { src: photo }], images: { hero: photo } });
    assert.doesNotMatch(markup, /alt="[^"]+"/, `${id}: декоративные фото без alt-текста`);
  }
  const script = effectsScript({ card: 'magnetic', hero: 'magnetic-cta' });
  assert.match(script, /prefers-reduced-motion: reduce/);
  assert.match(script, /hover: hover\) and \(pointer: fine/);
});

test('бейдж — данные позиции: выводится только если задан и сохраняется в экспорте', () => {
  const r = generate({ ...base, architecture: 'split-utility' });
  assert.equal((r.html.match(/class="item__badge"/g) || []).length, 1);
  assert.ok(r.html.includes('<span class="item__badge">Хит</span>'));
  assert.equal(exportProject(r.project).services[0][6], 'Хит');
  assert.equal(generate({ ...base, services: [['A', 'a']] }).html.includes('item__badge"'), false);
});

test('счётчик и раскрытие строк сохраняют текст для чтения с экрана', () => {
  const s = effectsScript({ card: 'counter', hero: 'line-split' });
  assert.match(s, /setAttribute\('aria-label',full\)/);
  assert.match(s, /lh\.setAttribute\('aria-label',txt\)/);
  const page = generate({ ...base, heroEffect: 'line-split' }).html;
  assert.ok(!page.includes("h.setAttribute('aria-label',t);h.textContent=''"), 'при раскрытии строк пословная кинетика заголовка отключена');
});

test('каждый эффект даёт страницу без ошибок аудита; выбор сохраняется в экспорте', () => {
  const withPhotos = { ...base, images: { hero: photo, heroAlt: 'Зал' }, gallery: [{ src: photo, alt: 'Кадр' }, { src: photo, alt: 'Кадр 2' }] };
  for (const id of HERO_EFFECT_IDS) assert.deepEqual(generate({ ...withPhotos, id: 'h-' + id, heroEffect: id }).audit.errors, [], id);
  for (const id of CARD_EFFECT_IDS) assert.deepEqual(generate({ ...base, id: 'c-' + id, cardEffect: id }).audit.errors, [], id);
  const r = generate({ ...withPhotos, cardEffect: 'curtain', heroEffect: 'duotone' });
  const again = generate(JSON.parse(JSON.stringify(exportProject(r.project))));
  assert.deepEqual([again.concept.visualSystem.effects.card, again.concept.visualSystem.effects.hero], ['curtain', 'duotone']);
});
