import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConcept, generate, exportProject, TRANSITIONS, TRANSITION_IDS, chooseTransition, describeTransition } from '../src/engine/index.js';
import { transitionCss, transitionHtml } from '../src/engine/cinematic/transitions.js';

const base = { brand: 'Ханой', niche: 'кафе', title: 'Вьетнамская кухня', contacts: { email: 'hello@example.com' },
  services: [['Фо', 'Суп'], ['Нем', 'Роллы']], advantages: [['Травы', 'Свежие'], ['Бульон', '12 часов']] };

test('авто-выбор воспроизводим и учитывает архитектуру и класс', () => {
  const a = buildConcept(base).visualSystem.transition, b = buildConcept(base).visualSystem.transition;
  assert.deepEqual(a, b);
  assert.ok(TRANSITIONS[a.type]);
  assert.ok(['split', 'diagonal'].includes(buildConcept({ ...base, architecture: 'brutalist' }).visualSystem.transition.type));
  assert.ok(['none', 'fade'].includes(buildConcept({ ...base, architecture: 'minimal' }).visualSystem.transition.type));
  for (let i = 0; i < 12; i++) assert.ok(['fade', 'glow', 'arch', 'none'].includes(buildConcept({ ...base, brand: 'Люкс ' + i, tier: 'luxury' }).visualSystem.transition.type));
});

test('настройки градиента владельца применяются и ограничиваются допустимыми значениями', () => {
  const tr = chooseTransition({ passthrough: { transitionType: 'wave', transitionFrom: '#FF3366', transitionTo: 'не цвет', transitionAngle: 999, transitionHeight: 5, transitionIntensity: 70 } }, {});
  assert.deepEqual({ ...tr }, { type: 'wave', from: '#ff3366', to: '', angle: 360, height: 24, intensity: 70, rationale: 'Выбрано владельцем проекта' });
  const css = transitionCss(tr);
  assert.ok(css.includes('color-mix(in srgb,#ff3366 70%,transparent)'), 'свой цвет начала');
  assert.ok(css.includes('var(--ds-accent) 55%'), 'пустой цвет конца — авто из палитры');
  assert.ok(css.includes('height:24px'));
  assert.match(describeTransition(tr), /Волна: цвета #ff3366 → глубокий акцент, угол 360°, высота 24 px, интенсивность 70%/);
});

test('переход — декоративная полоса со своим местом: без отрицательных отступов и поверх контента', () => {
  for (const type of TRANSITION_IDS) {
    const tr = chooseTransition({ passthrough: { transitionType: type } }, {});
    const html = transitionHtml(tr), css = transitionCss(tr, 'framed');
    if (type === 'none') { assert.equal(html, ''); assert.equal(css, ''); continue; }
    assert.equal(html, `<div class="uds-transition uds-transition--${type}" aria-hidden="true"></div>`);
    assert.doesNotMatch(css, /margin[^;]*-|z-index|position:fixed/, type);
    assert.match(css, new RegExp(`\\.uds-transition--${type}::before\\{`), `${type}: рисунок в ::before, заливка полосы не обрезается`);
  }
  assert.match(transitionCss(chooseTransition({ passthrough: { transitionType: 'fade' } }, {}), 'framed'), /border-top:0/, 'в «рамках» линии на стыке убираются');
  assert.doesNotMatch(transitionCss(chooseTransition({ passthrough: { transitionType: 'fade' } }, {}), 'editorial'), /border-top:0/);
});

test('страница с каждым типом перехода проходит аудит; выбор сохраняется в экспорте', () => {
  for (const type of TRANSITION_IDS) for (const palette of ['light', 'dark']) {
    const r = generate({ ...base, id: `tr-${type}-${palette}`, palette, transitionType: type });
    assert.deepEqual(r.audit.errors, [], `${type}/${palette}`);
    const count = (r.html.match(/class="uds-transition /g) || []).length;
    assert.equal(count, type === 'none' ? 0 : r.concept.homepage.sectionOrder.length - 1, `${type}: переход между каждой парой секций`);
  }
  const r = generate({ ...base, transitionType: 'arch', transitionFrom: '#123456', transitionHeight: 90 });
  const again = generate(JSON.parse(JSON.stringify(exportProject(r.project))));
  assert.equal(again.concept.visualSystem.transition.type, 'arch');
  assert.equal(again.concept.visualSystem.transition.from, '#123456');
  assert.equal(again.concept.visualSystem.transition.height, 90);
});
