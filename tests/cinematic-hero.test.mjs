import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConcept, generate, directScene, SCENE_PROFILES } from '../src/engine/index.js';
import { example, full } from './helpers.mjs';
import { sceneMarkup, sceneCss, sceneScript } from '../src/engine/cinematic/scene-runtime.js';

test('Cinematic Hero Director выбирает валидный профиль по контексту проекта', () => {
  const luxury = buildConcept({ ...full, tier: 'luxury' });
  const scene = directScene(luxury, { ...full, tier: 'luxury' });
  assert.equal(scene.type, 'luxury-cinematic');
  assert.equal(scene.intensity, 'calm');
  assert.equal(scene.mobileFallback, true);
  assert.ok(SCENE_PROFILES[scene.type]);
});

test('каждая сцена имеет профиль и безопасные CSS/HTML слои', () => {
  for (const type of Object.keys(SCENE_PROFILES)) {
    const scene = { type, layers: SCENE_PROFILES[type].layers, intensity: 'balanced' };
    assert.match(sceneMarkup(scene), new RegExp('uds-scene--' + type));
    assert.match(sceneCss(scene), /prefers-reduced-motion/);
  }
});

test('рендерер добавляет выбранную сцену в Hero, сохраняя текст и CTA', () => {
  const result = generate(example('photograf'));
  assert.match(result.html, /data-scene="[^"]+"/);
  assert.match(result.html, /data-cinematic-scene/);
  assert.match(result.html, /prefers-reduced-motion/);
  assert.match(result.html, /id="hero-h"/);
});

test('статичная архитектура оставляет сцену декоративной и не запускает runtime', () => {
  const scene = directScene({
    visualSystem: { archetype: 'catalog', nicheId: 'shop', motion: 'static', motionPlan: { intensity: 'calm' } },
  }, { tier: 'standard' });
  assert.equal(scene.motionEnabled, false);
  assert.equal(sceneScript(scene), '');
});
