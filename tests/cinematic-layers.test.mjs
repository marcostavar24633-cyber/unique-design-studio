import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConcept, generate, exportProject, CINEMATIC_PRESETS, CINEMATIC_PRESET_IDS, chooseCinematicLayers, describeCinematicLayers } from '../src/engine/index.js';
import { cinematicLayersCss, cinematicLightMarkup, textureStrength, NOISE_TILE, photoGrade } from '../src/engine/cinematic/visual-layers.js';
import { motionCss } from '../src/engine/motion.js';

const base = { brand: 'Ханой', niche: 'кафе вьетнамская кухня', title: 'Вьетнамская кухня', contacts: { email: 'hello@example.com' } };

test('слои выбираются воспроизводимо и следуют направлению графики', () => {
  const a = buildConcept({ ...base, graphicDirection: 'blueprint' }).visualSystem.cinematicLayers;
  const b = buildConcept({ ...base, graphicDirection: 'blueprint' }).visualSystem.cinematicLayers;
  assert.deepEqual(a, b);
  assert.equal(a.texture, 'blueprint');
  assert.equal(buildConcept({ ...base, graphicDirection: 'hud' }).visualSystem.cinematicLayers.texture, 'scanlines');
  assert.match(a.rationale, /направлению графики/);
});

test('ручной выбор владельца главнее, «без фактуры» не добавляет CSS и разметку', () => {
  const forced = buildConcept({ ...base, graphicDirection: 'blueprint', cinematicLayers: 'paper' }).visualSystem.cinematicLayers;
  assert.equal(forced.id, 'paper');
  assert.equal(forced.rationale, 'Выбрано владельцем проекта');
  const none = buildConcept({ ...base, cinematicLayers: 'none' }).visualSystem.cinematicLayers;
  assert.equal(cinematicLayersCss(none), '');
  assert.equal(cinematicLightMarkup(none), '');
  assert.equal(describeCinematicLayers(none), 'Без фактуры: чистые плоскости цвета');
  assert.equal(buildConcept({ ...base, cinematicLayers: 'нет-такого' }).visualSystem.cinematicLayers.rationale.includes('владельцем'), false, 'неизвестное значение игнорируется');
});

test('тёмная виньетка только на тёмных палитрах; люкс — сдержанно', () => {
  const light = chooseCinematicLayers({ passthrough: { cinematicLayers: 'film' } }, { palette: { mode: 'light' }, seed: 1 });
  const dark = chooseCinematicLayers({ passthrough: { cinematicLayers: 'film' } }, { palette: { mode: 'dark' }, seed: 1 });
  assert.ok(!light.lights.includes('vignette'), 'на светлом фоне виньетка затемнила бы края под тёмным текстом');
  assert.ok(dark.lights.includes('vignette'));
  const lux = chooseCinematicLayers({ tier: 'luxury', passthrough: { cinematicLayers: 'film' } }, { palette: { mode: 'light' }, seed: 1 });
  assert.equal(lux.intensity, 'calm');
  assert.ok(textureStrength(lux) < textureStrength(light));
});

test('фактура только позади контента: фон body без сброса цвета, без наложений и анимации', () => {
  for (const id of CINEMATIC_PRESET_IDS) for (const mode of ['light', 'dark']) {
    const layers = chooseCinematicLayers({ passthrough: { cinematicLayers: id } }, { palette: { mode }, seed: 3 });
    const css = cinematicLayersCss(layers);
    assert.doesNotMatch(css, /body\{background:/, `${id}/${mode}: шорткат background сбросил бы цвет фона`);
    assert.doesNotMatch(css, /@keyframes|animation:/, `${id}/${mode}: фактура статична`);
    assert.doesNotMatch(css, /position:fixed|z-index/, `${id}/${mode}: нет слоёв поверх контента`);
    assert.ok(textureStrength(layers) <= 0.12, `${id}/${mode}: слабая фактура`);
  }
  for (const f of [0.035, 0.55, 0.85]) assert.ok(Number.isInteger(Math.round(f * NOISE_TILE * 1000) / 1000), `плитка ${NOISE_TILE} без швов при частоте ${f}`);
});

test('каждый пресет даёт валидную страницу: аудит без ошибок, слои внутри декоративной сцены', () => {
  for (const id of CINEMATIC_PRESET_IDS) for (const palette of ['light', 'dark']) {
    const r = generate({ ...base, id: `cl-${id}-${palette}`, palette, cinematicLayers: id });
    assert.deepEqual(r.audit.errors, [], `${id}/${palette}`);
    const scene = r.html.match(/<div class="uds-scene[^"]*" data-cinematic-scene aria-hidden="true">([\s\S]*?)<\/div>/);
    assert.ok(scene, 'сцена на месте');
    for (const l of r.concept.visualSystem.cinematicLayers.lights.filter(x => x !== 'glow')) assert.ok(scene[1].includes(`uds-light--${l}`), `${id}: ${l} в aria-hidden сцене`);
    assert.ok(r.html.length < 250 * 1024);
  }
  assert.equal(Object.keys(CINEMATIC_PRESETS).length, CINEMATIC_PRESET_IDS.length);
});

test('выбор фактуры сохраняется в экспорте и переживает импорт', () => {
  const r = generate({ ...base, cinematicLayers: 'halftone' });
  const again = generate(JSON.parse(JSON.stringify(r.exported)));
  assert.equal(again.concept.visualSystem.cinematicLayers.id, 'halftone');
  assert.equal(exportProject(r.project).cinematicLayers, 'halftone');
});

test('цветокоррекция фото: мягкая, сдержаннее для люкса, отключается вместе с фактурой', () => {
  const layers = (id, extra = {}) => chooseCinematicLayers({ passthrough: { cinematicLayers: id }, ...extra }, { palette: { mode: 'light' }, seed: 1 });
  assert.equal(photoGrade(layers('film')), 'contrast(1.06) saturate(0.92) sepia(0.06)');
  assert.equal(photoGrade(layers('film', { tier: 'luxury' })), 'contrast(1.03) saturate(0.96) sepia(0.03)');
  for (const id of ['none', 'dotgrid']) assert.equal(photoGrade(layers(id)), '', `${id}: фото без коррекции`);
  for (const id of CINEMATIC_PRESET_IDS) {
    const g = photoGrade(layers(id));
    for (const [, fn, v] of g.matchAll(/(contrast|saturate|sepia)\(([\d.]+)\)/g)) {
      const n = Number(v);
      assert.ok(fn === 'sepia' ? n <= 0.1 : Math.abs(n - 1) <= 0.2, `${id}: ${fn}(${v}) — слишком сильно для реальных фото`);
    }
    const css = cinematicLayersCss(layers(id));
    assert.equal(css.includes('filter:var(--uds-grade)'), Boolean(g), `${id}: правило фото только при коррекции`);
  }
  assert.match(describeCinematicLayers(layers('film')), /фото — тёплый плёночный тон/);
});

test('наведение на карточку дописывает фильтр к коррекции, а не заменяет её', () => {
  const css = motionCss({ mechanics: ['hover-lift'], intensity: 'balanced' });
  if (css.includes(':hover img')) assert.match(css, /filter:var\(--uds-grade,\) saturate\(1\.04\)/);
  const page = generate({ ...base, cinematicLayers: 'film', services: [['Фо', 'Суп', '450 ₽', 'https://example.com/a.jpg']] }).html;
  if (page.includes(':hover img')) assert.ok(page.includes('filter:var(--uds-grade,) saturate(1.04)'));
  assert.ok(page.includes('--uds-grade:contrast(1.06) saturate(0.92) sepia(0.06)'));
});
