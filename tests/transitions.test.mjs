import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConcept, generate, exportProject, TRANSITIONS, TRANSITION_IDS, chooseTransition, describeTransition } from '../src/engine/index.js';
import { transitionCss, transitionHtml } from '../src/engine/cinematic/transitions.js';

const base = { brand: 'Ханой', niche: 'кафе', title: 'Вьетнамская кухня', contacts: { email: 'hello@example.com' },
  services: [['Фо', 'Суп'], ['Нем', 'Роллы']], advantages: [['Травы', 'Свежие'], ['Бульон', '12 часов']] };

test('градиентный переход всегда применяется между блоками', () => {
  const a = buildConcept(base).visualSystem.transition, b = buildConcept(base).visualSystem.transition;
  assert.deepEqual(a, b);
  assert.equal(a.type, 'fade');
  assert.equal(buildConcept({ ...base, architecture: 'brutalist' }).visualSystem.transition.type, 'fade');
  assert.equal(buildConcept({ ...base, architecture: 'minimal' }).visualSystem.transition.type, 'fade');
  for (const type of TRANSITION_IDS) assert.equal(buildConcept({ ...base, tier: 'luxury', transitionType: type }).visualSystem.transition.type, 'fade');
});

test('настройки градиента владельца применяются и ограничиваются допустимыми значениями', () => {
  const tr = chooseTransition({ passthrough: { transitionType: 'wave', transitionFrom: '#FF3366', transitionTo: 'не цвет', transitionAngle: 999, transitionHeight: 5, transitionIntensity: 70 } }, {});
  assert.deepEqual({ ...tr }, { type: 'fade', from: '#ff3366', to: '', angle: 360, height: 24, intensity: 70, rationale: 'Постоянный градиентный переход между блоками' });
  const css = transitionCss(tr);
  assert.ok(css.includes('color-mix(in srgb,#ff3366 70%,transparent)'), 'свой цвет начала');
  assert.ok(css.includes('var(--ds-accent) 55%'), 'пустой цвет конца — авто из палитры');
  assert.ok(css.includes('height:48px'), '24 px — высота настройки; псевдоэлемент занимает по 24 px с каждой стороны');
  assert.match(describeTransition(tr), /Мягкий градиент: цвета #ff3366 → глубокий акцент, угол 360°, высота 24 px, интенсивность 70%/);
});

test('градиентный переход не добавляет высоту секции и остаётся декоративным', () => {
  for (const type of TRANSITION_IDS) {
    const tr = chooseTransition({ passthrough: { transitionType: type } }, {});
    const html = transitionHtml(tr), css = transitionCss(tr, 'framed');
    assert.equal(tr.type, 'fade');
    assert.equal(html, '<div class="uds-transition uds-transition--fade" aria-hidden="true"></div>');
    assert.match(css, /height:0/, `${type}: переход не занимает место в потоке`);
    assert.doesNotMatch(css, /position:fixed/, type);
    assert.match(css, /\.uds-transition--fade::before\{/, `${type}: рисунок в ::before, заливка полосы не обрезается`);
  }
  assert.match(transitionCss(chooseTransition({ passthrough: { transitionType: 'fade' } }, {}), 'framed'), /border-top:0/, 'в «рамках» линии на стыке убираются');
  assert.doesNotMatch(transitionCss(chooseTransition({ passthrough: { transitionType: 'fade' } }, {}), 'editorial'), /border-top:0/);
});

test('страница с каждым типом перехода проходит аудит; выбор сохраняется в экспорте', () => {
  for (const type of TRANSITION_IDS) for (const palette of ['light', 'dark']) {
    const r = generate({ ...base, id: `tr-${type}-${palette}`, palette, transitionType: type });
    assert.deepEqual(r.audit.errors, [], `${type}/${palette}`);
    const count = (r.html.match(/class="uds-transition /g) || []).length;
    assert.equal(count, r.concept.homepage.sectionOrder.length, `${type}: градиент между первым экраном и секциями, а также между секциями`);
  }
  const r = generate({ ...base, transitionType: 'arch', transitionFrom: '#123456', transitionHeight: 90 });
  const again = generate(JSON.parse(JSON.stringify(exportProject(r.project))));
  assert.equal(again.concept.visualSystem.transition.type, 'fade');
  assert.equal(again.concept.visualSystem.transition.from, '#123456');
  assert.equal(again.concept.visualSystem.transition.height, 90);
});
