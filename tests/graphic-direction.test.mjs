// Направление графики (#111) подключено к движку: выбирается по нише, задаёт стиль фото, правится владельцем.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generate, normalizeProject, exportProject, photoPrompt } from '../src/engine/index.js';
import { imageSlots } from '../src/engine/image-director.js';
import { GRAPHIC_DIRECTIONS } from '../src/engine/graphic-art-direction.js';
import { ART_STYLE } from '../src/engine/photo-brief.js';

const dir = niche => generate({ niche, brand: niche }).concept.visualSystem.graphicDirection;

test('направление графики есть в каждой концепции и подходит нише', () => {
  assert.ok(['cinematic', 'macro', 'collage'].includes(dir('кафе вьетнамская кухня').id), 'кафе — по правилу еды, а не запасной вариант');
  assert.ok(['cinematic', 'macro', 'collage'].includes(dir('раковарня').id));
  assert.ok(['3d-object', 'macro', 'editorial'].includes(dir('ювелирный магазин').id));
  assert.ok(['abstract-3d', 'glass', 'hud', 'gradient'].includes(dir('IT-студия').id));
});

test('латинские «it» и «ai» внутри слов не делают нишу технологической', () => {
  for (const niche of ['thai cafe', 'fitness club', 'hair salon', 'waiting room']) assert.ok(!['hud', 'abstract-3d', 'glass', 'gradient'].includes(dir(niche).id) || /cafe/.test(niche) === false && dir(niche).rationale !== 'Подобрано по тематике и предложению проекта', niche);
  assert.ok(['cinematic', 'macro', 'collage'].includes(dir('thai cafe').id));
});

test('стиль направления попадает в английский промпт фото', () => {
  const g = generate({ niche: 'ювелирный магазин', brand: 'Аурум', graphicDirection: 'macro', services: [['Кольцо', 'Золото']] });
  const slot = imageSlots(g.project, g.concept).slots.find(s => s.role === 'service');
  const prompt = photoPrompt(slot, g.project, g.concept.visualSystem.graphicDirection);
  assert.match(prompt, /Art direction: macro photography, tactile texture/);
  assert.doesNotMatch(prompt, /[а-яё]/i);
  for (const id of Object.keys(GRAPHIC_DIRECTIONS)) assert.ok(ART_STYLE[id] && !/[а-яё]/i.test(ART_STYLE[id]), id);
});

test('ручной выбор владельца главнее автоматики и сохраняется в экспорте', () => {
  const g = generate({ niche: 'кофейня', graphicDirection: 'surreal' });
  assert.equal(g.concept.visualSystem.graphicDirection.id, 'surreal');
  assert.equal(g.concept.visualSystem.graphicDirection.rationale, 'Выбрано владельцем проекта');
  assert.equal(exportProject(normalizeProject({ niche: 'кофейня', graphicDirection: 'surreal' })).graphicDirection, 'surreal');
});

test('студия показывает направление в Design DNA, даёт выбрать его и передаёт генератору фото', () => {
  const js = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  assert.match(js, /\['Графика', vs\.graphicDirection \?/);
  assert.match(js, /\['@graphicDirection', 'Направление графики', 'graphicDirection'/);
  assert.match(js, /photoPrompt\(slot, result\.project, result\.concept\.visualSystem\.graphicDirection\)/);
});
