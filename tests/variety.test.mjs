import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConcept, generate, exportProject, BUTTONS, CARD_SHAPES, CARD_SHAPE_IDS, REVEALS, REVEAL_IDS, choosePhotoComposition, chooseVariety } from '../src/engine/index.js';
import { BUTTON_CSS } from '../src/engine/css.js';
import { cardShapeCss, photoCompositionCss, revealCss } from '../src/engine/variety.js';

const base = { brand: 'Поток', niche: 'студия йоги', title: 'Йога для спины', contacts: { email: 'hello@example.com' },
  services: [['Хатха', 'Спокойная практика'], ['Виньяса', 'Динамичные связки']], advantages: [['Малые группы', 'До 8 человек'], ['Утро и вечер', 'Удобное время']] };

test('формы карточек без арок, 15 эффектов появления и стилей кнопок', () => {
  assert.equal(CARD_SHAPE_IDS.length, 14);
  assert.equal(CARD_SHAPES.arch, undefined, 'арочные карточки исключены из генератора');
  assert.equal(REVEAL_IDS.length, 15);
  assert.equal(Object.keys(BUTTONS).length, 15);
  assert.deepEqual(Object.keys(BUTTON_CSS).sort(), Object.keys(BUTTONS).sort(), 'у каждого стиля кнопки есть CSS');
  for (const id of CARD_SHAPE_IDS) assert.ok(cardShapeCss(id), id);
  for (const id of REVEAL_IDS) assert.ok(revealCss(id), id);
});

test('веер и перекрытие не сдвигают фото при включённом reduced motion', () => {
  assert.match(photoCompositionCss('fan'), /prefers-reduced-motion:reduce\)\{\.gallery--fan>li\{transition:none\}\.gallery--fan>li:hover,\.gallery--fan>li\[data-reveal\]\.is-in:hover\{transform:none\}\}/);
  assert.match(photoCompositionCss('overlap'), /prefers-reduced-motion:reduce\)\{\.gallery--overlap>li\{transition:none\}/);
  assert.match(photoCompositionCss('overlap'), /\.gallery--overlap>li:nth-child\(3n\+2\):hover,\.gallery--overlap>li:nth-child\(3n\):hover,\.gallery--overlap>li\[data-reveal\]\.is-in:nth-child\(3n\+2\):hover,\.gallery--overlap>li\[data-reveal\]\.is-in:nth-child\(3n\):hover\{transform:none\}/);
  assert.match(photoCompositionCss('fan'), /\.gallery--fan>li\[data-reveal\]\.is-in\{transform:rotate\(var\(--photo-tilt,0deg\)\) translateY\(var\(--photo-rise,0px\)\)\}/);
  assert.match(photoCompositionCss('overlap'), /\.gallery--overlap>li\[data-reveal\]\.is-in:nth-child\(3n\)\{transform:translate\(-24px,-10px\)/);
  assert.match(photoCompositionCss('fan'), /\.gallery--fan>li\[data-reveal\]\.is-in:hover\{transform:translateY\(-10px\) rotate\(0\) scale\(1\.045\)\}/);
});

test('веер симметричен для 3–4 фото и переключается на слоистую раскладку для больших наборов', () => {
  for (const count of [3, 4]) {
    const gallery = Array.from({ length: count }, (_, i) => ({ src: `https://img.example/${i}.jpg`, alt: `Фото ${i + 1}` }));
    const { html } = generate({ ...base, gallery, photoComposition: 'fan' });
    assert.match(html, new RegExp(`gallery--fan--count-${count}`));
  }
  const largeGallery = Array.from({ length: 6 }, (_, i) => ({ src: `https://img.example/${i}.jpg`, alt: `Фото ${i + 1}` }));
  assert.equal(choosePhotoComposition({ gallery: largeGallery, passthrough: { photoComposition: 'fan' } }), 'overlap');
});

test('генератор сохраняет округлые карточки, а выбор владельца управляет эффектом появления', () => {
  const c = buildConcept({ ...base, cardShape: 'ticket', revealEffect: 'flip-y', buttonStyle: 'neon' }).visualSystem;
  assert.equal(c.variety.cardShape, 'rounded');
  assert.equal(c.variety.reveal, 'flip-y');
  assert.equal(c.variety.revealForced, true);
  assert.equal(c.button.id, 'neon');
  const auto = buildConcept({ ...base, cardShape: 'нет', revealEffect: 'нет', buttonStyle: 'нет' }).visualSystem;
  assert.ok(CARD_SHAPES[auto.variety.cardShape] && REVEALS[auto.variety.reveal] && BUTTONS[auto.button.id]);
  assert.equal(auto.variety.revealForced, false);
});

test('авто-компоновка сохраняет скруглённые карточки для всех архитектур', () => {
  for (let i = 0; i < 12; i++) {
    const lux = buildConcept({ ...base, brand: 'Люкс ' + i, tier: 'luxury' }).visualSystem;
    assert.equal(lux.variety.cardShape, 'rounded');
    assert.ok(['fade-in', 'fade-up', 'blur-in', 'clip-up'].includes(lux.variety.reveal));
    assert.ok(['outline', 'underline'].includes(lux.button.id));
    const brut = buildConcept({ ...base, brand: 'Брут ' + i, architecture: 'brutalist' }).visualSystem;
    assert.equal(brut.variety.cardShape, 'rounded');
    assert.equal(brut.button.id, 'block');
  }
  assert.deepEqual(chooseVariety({}, { seed: 7 }), chooseVariety({}, { seed: 7 }), 'воспроизводимо');
});

test('формы не затрагивают линейки и карточки с переворотом; срезы не глубже отступа карточки', () => {
  for (const id of CARD_SHAPE_IDS) {
    const css = cardShapeCss(id);
    assert.doesNotMatch(css, /items--rules|items--numbered/, id);
    if (/clip-path|mask/.test(css)) assert.match(css, /:not\(\.item--flip\)/, `${id}: переворот исключён`);
    for (const [, px] of css.matchAll(/calc\(100% - (\d+)px\)/g)) assert.ok(Number(px) <= 22, `${id}: срез ${px}px`);
  }
});

test('появление: только с JavaScript, при reduced-motion всё сразу видно; ручной выбор включает появление', () => {
  for (const id of REVEAL_IDS) {
    const css = revealCss(id);
    assert.match(css, /^html\.js-reveal \[data-reveal\]\{/, `${id}: скрытие только после включения скрипта`);
    assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{html\.js-reveal \[data-reveal\]\{opacity:1;transform:none;filter:none;clip-path:none;transition:none\}\}/, id);
  }
  const forced = generate({ ...base, revealEffect: 'clip-left', architecture: 'minimal' });
  assert.ok(forced.html.includes("classList.add('js-reveal')"), 'скрипт появления включён ручным выбором');
  assert.ok(forced.html.includes('clip-path:inset(0 100% 0 0)'));
});

test('формы карточек из старых данных не меняют генерацию; эффекты и кнопки сохраняются', () => {
  CARD_SHAPE_IDS.forEach((shape, i) => {
    const r = generate({ ...base, id: `v-${shape}`, cardShape: shape, revealEffect: REVEAL_IDS[i], buttonStyle: Object.keys(BUTTONS)[i], palette: i % 2 ? 'dark' : 'light' });
    assert.deepEqual(r.audit.errors, [], shape);
    assert.equal(r.concept.visualSystem.variety.cardShape, 'rounded', shape);
    assert.match(r.html, /\.ds-button\{border-radius:999px!important\}/, 'кнопки всегда скруглены');
  });
  const r = generate({ ...base, cardShape: 'folded', revealEffect: 'zoom-out', buttonStyle: 'glass' });
  const again = generate(JSON.parse(JSON.stringify(exportProject(r.project))));
  assert.deepEqual([again.concept.visualSystem.variety.cardShape, again.concept.visualSystem.variety.reveal, again.concept.visualSystem.button.id], ['rounded', 'zoom-out', 'glass']);
});

