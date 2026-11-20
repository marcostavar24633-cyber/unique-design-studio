import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConcept, generate, exportProject, TYPE_STYLE_IDS, SECTION_LAYOUT_IDS, TEXT_ANIMATIONS, BUTTON_ANIMATION_IDS, chooseTypography } from '../src/engine/index.js';
import { typeStyleCss, textAnimationCss, buttonAnimationCss, buttonAnimationScript, EXTRA_LAYOUT_CSS, FILLED_LAYOUTS } from '../src/engine/typography-layout.js';

const base = { brand: 'Поток', niche: 'студия йоги', title: 'Йога для спины', contacts: { email: 'hello@example.com' },
  services: [['Хатха', 'Спокойная практика'], ['Виньяса', 'Связки']], advantages: [['Малые группы', 'До 8'], ['Утро', 'И вечер']], gallery: [{ src: 'https://example.com/a.jpg', alt: 'Зал' }, { src: 'https://example.com/b.jpg', alt: 'Коврики' }] };

test('по 15 стилей типографики и раскладок секций, 10 анимаций кнопок, 7 новых анимаций текста', () => {
  assert.equal(TYPE_STYLE_IDS.length, 15);
  assert.equal(SECTION_LAYOUT_IDS.length, 15);
  assert.equal(BUTTON_ANIMATION_IDS.length, 10);
  assert.equal(Object.keys(TEXT_ANIMATIONS).length, 7);
  for (const id of TYPE_STYLE_IDS) assert.ok(typeStyleCss(id), id);
  for (const id of Object.keys(TEXT_ANIMATIONS)) assert.ok(textAnimationCss(id), id);
  for (const id of BUTTON_ANIMATION_IDS) assert.ok(buttonAnimationCss(id), id);
});

test('стили типографики не меняют цвета текста (контраст сохраняется)', () => {
  for (const id of TYPE_STYLE_IDS) assert.doesNotMatch(typeStyleCss(id).replace(/text-decoration-color:[^;}]+|background:[^;}]+|;color:var\(--u-accent-ink\)/g, ''), /(^|[;{])color:/, id);
});

test('анимации — только без reduced-motion; прокрутка — только при поддержке animation-timeline', () => {
  for (const id of Object.keys(TEXT_ANIMATIONS)) {
    const css = textAnimationCss(id);
    assert.match(css, /prefers-reduced-motion:no-preference/, id);
    if (/animation-timeline/.test(css)) assert.match(css, /@supports \(animation-timeline:view\(\)\)/, id);
  }
  for (const id of BUTTON_ANIMATION_IDS) if (/animation:/.test(buttonAnimationCss(id))) assert.match(buttonAnimationCss(id), /prefers-reduced-motion:no-preference/, id);
  assert.match(buttonAnimationScript('ripple'), /prefers-reduced-motion: reduce/);
  assert.equal(buttonAnimationScript('pulse'), '');
});

test('ручной выбор главнее, «без» поддержан; авто воспроизводимо', () => {
  const t = buildConcept({ ...base, typeStyle: 'marker-highlight', textAnimation: 'blur-in', buttonAnimation: 'jelly', sectionLayout: 'bands' }).visualSystem;
  assert.deepEqual([t.typography2.typeStyle, t.typography2.textAnimation, t.typography2.buttonAnimation, t.sectionLayout], ['marker-highlight', 'blur-in', 'jelly', 'bands']);
  const none = buildConcept({ ...base, typeStyle: 'none', textAnimation: 'none', buttonAnimation: 'none' }).visualSystem.typography2;
  assert.deepEqual([none.typeStyle, none.textAnimation, none.buttonAnimation], ['none', 'none', 'none']);
  assert.deepEqual(chooseTypography({}, { seed: 3 }), chooseTypography({}, { seed: 3 }));
});

test('каждая раскладка секций даёт свой CSS и композицию галереи; на заливных раскладках авто-переход отключён', () => {
  for (const id of SECTION_LAYOUT_IDS) {
    const r = generate({ ...base, id: 'l-' + id, sectionLayout: id });
    assert.equal(r.concept.visualSystem.sectionLayout, id);
    assert.ok(r.html.includes(`section-layout--${id}`), id);
    assert.ok(r.html.includes(`.sec--gallery.section-layout--${id}`), `${id}: композиция галереи`);
    assert.deepEqual(r.audit.errors, [], id);
    if (FILLED_LAYOUTS.has(id) && id !== 'framed') assert.equal(r.concept.visualSystem.transition.type, 'none', `${id}: без полосы-перехода`);
  }
  assert.equal(Object.keys(EXTRA_LAYOUT_CSS).length, 11);
});

test('несовместимая со стилем кнопки анимация пропускается', () => {
  const arrow = generate({ ...base, buttonStyle: 'arrow', buttonAnimation: 'nudge' }).html;
  assert.ok(!arrow.includes('uds-nudge'), 'стрелка-стиль + толчок стрелки не совмещаются');
  const solid = generate({ ...base, buttonStyle: 'solid', buttonAnimation: 'nudge' }).html;
  assert.ok(solid.includes('uds-nudge'));
});

test('выбор сохраняется в экспорте; каждый стиль и анимация дают страницу без ошибок аудита', () => {
  TYPE_STYLE_IDS.forEach((id, i) => {
    const r = generate({ ...base, id: 't-' + id, typeStyle: id, textAnimation: Object.keys(TEXT_ANIMATIONS)[i % 7], buttonAnimation: BUTTON_ANIMATION_IDS[i % 10], palette: i % 2 ? 'dark' : 'light' });
    assert.deepEqual(r.audit.errors, [], id);
  });
  const r = generate({ ...base, typeStyle: 'small-caps', sectionLayout: 'rail', textAnimation: 'underline-draw', buttonAnimation: 'lift' });
  const v = generate(JSON.parse(JSON.stringify(exportProject(r.project)))).concept.visualSystem;
  assert.deepEqual([v.typography2.typeStyle, v.sectionLayout, v.typography2.textAnimation, v.typography2.buttonAnimation], ['small-caps', 'rail', 'underline-draw', 'lift']);
});
