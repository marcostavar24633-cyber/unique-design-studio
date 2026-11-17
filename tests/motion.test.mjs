// Motion Design Engine: выбор механик под бренд, бюджет, доступность и производительность.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generate } from '../src/engine/index.js';
import { autopilot } from '../src/engine/autopilot.js';
import { INTENSITY, MECHANICS, chooseMotion, motionCss, motionScript } from '../src/engine/motion.js';

const site = (niche, extra = {}) => generate(autopilot({ niche, email: 'hello@example.com', ...extra }, { registry: [] }).project, { registry: [] });
/** Убирает блоки @media с учётом вложенных скобок. */
function stripMedia(css) {
  let out = '', i = 0;
  while (i < css.length) {
    if (css.startsWith('@media', i)) {
      let j = css.indexOf('{', i), depth = 1; j++;
      while (depth && j < css.length) { if (css[j] === '{') depth++; else if (css[j] === '}') depth--; j++; }
      i = j;
    } else out += css[i++];
  }
  return out;
}

test('у каждого сайта есть план анимации в пределах бюджета интенсивности', () => {
  for (const niche of ['кофейня', 'стоматология', 'фитнес-клуб', 'музыкальный магазин', 'юрист', 'интернет-магазин одежды']) {
    const plan = site(niche).concept.visualSystem.motionPlan;
    assert.ok(INTENSITY[plan.intensity], niche);
    assert.ok(plan.mechanics.length >= 1 && plan.mechanics.length <= INTENSITY[plan.intensity].budget, `${niche}: ${plan.mechanics}`);
    for (const m of plan.mechanics) assert.ok(MECHANICS[m], `${niche}: неизвестная механика ${m}`);
    assert.equal(new Set(plan.mechanics).size, plan.mechanics.length, 'без повторов');
  }
});

test('интенсивность следует за характером: люкс и медицина спокойные, выразительные ниши — выразительные', () => {
  assert.equal(site('ювелирный магазин', { tier: 'luxury' }).concept.visualSystem.motionPlan.intensity, 'calm');
  assert.equal(site('стоматология').concept.visualSystem.motionPlan.intensity, 'calm');
  assert.equal(site('фитнес-клуб').concept.visualSystem.motionPlan.intensity, 'expressive');
  const luxury = site('ювелирный магазин', { tier: 'luxury' }).concept.visualSystem.motionPlan.mechanics;
  for (const loud of ['magnetic-buttons', 'tilt-cards', 'dynamic-gradient', 'kinetic-type']) assert.ok(!luxury.includes(loud), `люкс без ${loud}`);
});

test('кинематографичное появление и кинетика заголовка не включаются одновременно', () => {
  for (let seed = 0; seed < 40; seed++) {
    const plan = chooseMotion({ tier: 'premium', brandCharacter: 'дерзкий, яркий' }, { archetype: 'asymmetric', motion: 'reveal', nicheId: 'events', seed });
    assert.ok(!(plan.mechanics.includes('cinematic-reveal') && plan.mechanics.includes('kinetic-type')), String(seed));
  }
});

test('статичная архитектура не получает анимаций появления', () => {
  const plan = chooseMotion({ tier: 'standard' }, { archetype: 'catalog', motion: 'static', nicheId: 'music', seed: 1 });
  for (const m of ['scroll-reveal', 'cinematic-reveal', 'kinetic-type', 'parallax', 'scroll-progress', 'dynamic-gradient']) assert.ok(!plan.mechanics.includes(m), m);
});

test('всё движение — внутри prefers-reduced-motion: no-preference, эффекты курсора — только для точного указателя', () => {
  const all = { intensity: 'expressive', duration: 500, distance: 20, mechanics: Object.keys(MECHANICS) };
  const css = motionCss(all);
  const outside = stripMedia(css);
  assert.doesNotMatch(outside, /animation|transition|transform:/, 'вне медиазапросов только переменные');
  assert.match(css, /@media\(prefers-reduced-motion:no-preference\) and \(hover:hover\) and \(pointer:fine\)\{[^]*\.item\{/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\.m-progress\{display:none\}\}/);
  // Анимируются только transform и opacity (и фон градиента, который не вызывает перерасчёт раскладки).
  for (const m of css.matchAll(/@keyframes [\w-]+\{([^]*?\})\}/g)) assert.doesNotMatch(m[1], /\b(width|height|top|left|margin|padding)\s*:/, m[0]);
  const js = motionScript(all);
  assert.match(js, /prefers-reduced-motion: reduce/);
  assert.match(js, /hover: hover\) and \(pointer: fine/);
  assert.match(js, /requestAnimationFrame\(function\(\)\{document\.documentElement\.classList\.add\('js-motion'\)\}\)/, 'содержимое не прячется, если кадры не рисуются');
  assert.match(js, /\{passive:true\}/);
});

test('кинетика заголовка сохраняет текст для экранных дикторов', () => {
  const js = motionScript({ mechanics: ['kinetic-type'] });
  assert.match(js, /h\.setAttribute\('aria-label',t\)/);
  assert.match(js, /s\.setAttribute\('aria-hidden','true'\)/);
});

test('план анимации попадает в Design DNA и в страницу, страница остаётся валидной', () => {
  const g = site('фитнес-клуб');
  const plan = g.concept.visualSystem.motionPlan;
  assert.equal(g.concept.designDNA.motionDirection, plan.label);
  assert.match(plan.label, /prefers-reduced-motion/);
  if (plan.mechanics.includes('cinematic-reveal')) assert.match(g.html, /@keyframes m-rise/);
  if (plan.mechanics.includes('magnetic-buttons')) assert.match(g.html, /--m-mx/);
  assert.equal((g.html.match(/<script>/g) || []).length, 1, 'один встроенный скрипт страницы');
  assert.ok(g.audit.ok, g.audit.errors.map(e => e.message).join('; '));
});


test('Cinematic Motion Design включается из настроек генератора полным согласованным набором', () => {
  const plan = chooseMotion({ tier: 'premium', brandCharacter: 'смелый и выразительный' }, { archetype: 'immersive', motion: 'parallax', nicheId: 'studio', seed: 42 });
  for (const id of ['scroll-reveal','cinematic-reveal','parallax','glass-cards','microinteractions']) assert.ok(plan.mechanics.includes(id), id);
  const css = motionCss(plan);
  assert.match(css, /backdrop-filter:blur\(18px\)/);
  assert.match(css, /box-shadow:0 8px 28px/);
  assert.match(css, /prefers-reduced-motion:no-preference/);
  assert.match(motionScript(plan), /requestAnimationFrame/);
});


test('спокойная ниша не получает избыточные эффекты только ради эффекта', () => {
  const plan = chooseMotion({ tier: 'standard', brandCharacter: 'спокойный и надёжный' }, { archetype: 'minimal', motion: 'static', nicheId: 'medical', seed: 8 });
  assert.ok(!plan.mechanics.includes('parallax'));
  assert.ok(!plan.mechanics.includes('tilt-cards'));
  assert.ok(!plan.mechanics.includes('dynamic-gradient'));
});
